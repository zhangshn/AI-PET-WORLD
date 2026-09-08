import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { bindAbsolute, validateSmokeTrainingDataUse } from "../lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";

function fixture(t, { split = "train", declared = split, sourceSplit = split, contributionSplit = split } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-smoke-split-policy-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => {
    fs.writeFileSync(path.join(root, file), JSON.stringify(value));
    return bindAbsolute(root, path.join(root, file));
  };
  const source = { samples: [{ sampleId: "sample-a", split: sourceSplit }],
    v7CapacityContributions: [{ sampleId: "sample-a", split: contributionSplit }] };
  const release = { schemaVersion: "ai-painter-stage4-v2-dataset-release-contract-v1",
    datasetReleaseIdentity: "fixture-release", sourcePackage: { sourceIndex: write("source.json", source) },
    samples: [{ sampleId: "sample-a", split }] };
  const payload = { datasetRelease: write("release.json", release), datasetPackageId: "fixture-release",
    fixedInputs: { sampleId: "sample-a", sampleSplit: declared } };
  return { root, payload, source, release, write };
}

test("a verified train source satisfies only the data-use guard, never capability qualification", (t) => {
  const f = fixture(t);
  const result = validateSmokeTrainingDataUse(f.root, f.payload);
  assert.deepEqual(result.sampleIds, ["sample-a"]);
  assert.equal(result.capabilityQualificationGranted, false);
});
for (const split of ["validation", "challenge", "regression", "unknown"]) {
  test(`${split} cannot update weights even when caller declares train`, (t) => {
    const f = fixture(t, { split, declared: "train" });
    assert.throws(() => validateSmokeTrainingDataUse(f.root, f.payload), {
      code: "stage4_smoke_non_train_optimizer_source",
    });
  });
}
for (const options of [{ sourceSplit: "validation" }, { contributionSplit: "validation" }, { declared: "validation" }]) {
  test(`source/contract inconsistency is refused: ${JSON.stringify(options)}`, (t) => {
    const f = fixture(t, options);
    assert.throws(() => validateSmokeTrainingDataUse(f.root, f.payload), /optimizer may consume only train/);
  });
}
test("duplicate, absent and renamed samples cannot bypass membership", (t) => {
  const f = fixture(t);
  for (const rows of [[], [{ sampleId: "other", split: "train" }],
    [{ sampleId: "sample-a", split: "train" }, { sampleId: "sample-a", split: "train" }]]) {
    f.release.samples = rows;
    f.payload.datasetRelease = f.write("release.json", f.release);
    assert.throws(() => validateSmokeTrainingDataUse(f.root, f.payload), /exactly once/);
  }
});
test("release and source bytes are rehashed on every attempt", (t) => {
  const f = fixture(t);
  f.write("source.json", { ...f.source, changed: true });
  assert.throws(() => validateSmokeTrainingDataUse(f.root, f.payload), /SHA-256/);
  f.write("source.json", f.source);
  f.write("release.json", { ...f.release, changed: true });
  assert.throws(() => validateSmokeTrainingDataUse(f.root, f.payload), /SHA-256/);
});
test("cross-release identity is rejected", (t) => {
  const f = fixture(t);
  f.payload.datasetPackageId = "other-release";
  assert.throws(() => validateSmokeTrainingDataUse(f.root, f.payload));
});
test("real frozen sample 194 remains validation and is rejected without mutating it", () => {
  const binding = { path: "data/ai-painter/system-governance/ai-painter-stage4-v2-mvp64-dataset-release-v1.json",
    sha256: "cd6b7e3fe70549788159237a86f1ab7144ee39db6cc011abaac43b6e5e15affc" };
  const release = JSON.parse(fs.readFileSync(binding.path));
  assert.throws(() => validateSmokeTrainingDataUse(process.cwd(), {
    datasetRelease: binding, datasetPackageId: release.datasetReleaseIdentity,
    fixedInputs: { sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6", sampleSplit: "validation" },
  }), { code: "stage4_smoke_non_train_optimizer_source" });
  assert.equal(bindAbsolute(process.cwd(), path.resolve(binding.path)).sha256, binding.sha256);
});
