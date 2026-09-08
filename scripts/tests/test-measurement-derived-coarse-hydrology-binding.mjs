import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { buildMeasurementDerivedCoarseHydrologyProfile as build } from "../lib/measurement-derived-coarse-hydrology.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const assignment = { slotId: "synthetic-validation", fingerprints: { direct: "a".repeat(64) },
  sourcePixelWindow: { left: 0, top: 0, width: 96, height: 72 } };

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-hydrology-binding-test-"));
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("ai-painter-hydrology-binding-test-"));
    fs.rmSync(root, { recursive: true });
  });
  const write = (name, bytes) => {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    return { path: name, sha256: hash(bytes) };
  };
  const json = (name, value) => write(name, Buffer.from(JSON.stringify(value)));
  const u32 = Buffer.alloc(256 * 192 * 4);
  const f32 = Buffer.alloc(u32.length);
  for (let i = 0; i < 256 * 192; i++) { u32.writeUInt32LE(i % 128 + 1, i * 4); f32.writeFloatLE(0.2, i * 4); }
  const accumulation = write("data/accumulation.gz", gzipSync(u32));
  const floats = write("data/float.gz", gzipSync(f32));
  const drainage = write("data/drainage.gz", gzipSync(Buffer.alloc(256 * 192, 255)));
  const mask = write("data/mask.gz", gzipSync(Buffer.alloc(1024 * 768)));
  const hydrology = json("data/hydrology.json", { naturalHydrology: {
    method: "Priority-Flood plus D8", analysisGrid: { width: 256, height: 192 },
    accumulationPath: accumulation.path, accumulationSha256: accumulation.sha256,
    elevationPath: floats.path, elevationSha256: floats.sha256,
    slopePath: floats.path, slopeSha256: floats.sha256,
    drainageLikelihoodPath: drainage.path, drainageLikelihoodSha256: drainage.sha256,
  } });
  const removal = json("data/removal.json", { status: "engineered_feature_removal_evidence_compiled",
    evidenceContract: { finalWorldGeometryMustBeReconstructed: true, prohibitedUses: ["final_world_fact_geometry"] } });
  const lineage = json("data/lineage.json", { sourceArtifacts: [
    { ...hydrology, runId: "synthetic-hydrology", role: "soil_and_natural_hydrology" },
    { ...removal, runId: "synthetic-removal", role: "engineered_feature_removal" },
  ] });
  const run = json("data/run.json", { runId: "synthetic-naturalized", lineagePath: lineage.path,
    lineageSha256: lineage.sha256, combinedHumanRemovalMaskPath: mask.path,
    combinedHumanRemovalMaskSha256: mask.sha256 });
  return { root, write, json, run };
}

test("explicit run works without latest and binds the exact bytes", t => {
  const f = fixture(t);
  const result = build({ root: f.root, assignment, naturalizedRunBinding: f.run });
  assert.deepEqual(result.source.naturalizedWorldFactRun, f.run);
  assert.equal(result.coarseBands.length, 8);
  assert.equal(result.identityBoundary.historicalRgbRead, false);
});

test("legacy replay is numerically unchanged; explicit mode ignores a poisoned latest", t => {
  const f = fixture(t);
  const pointer = ".runtime/ai-painter/earth-geospatial-naturalized-world-fact-runs/latest.json";
  f.json(pointer, { runPath: f.run.path });
  const legacy = build({ root: f.root, assignment });
  const explicit = build({ root: f.root, assignment, naturalizedRunBinding: f.run });
  const { profileSha256, ...payload } = structuredClone(explicit);
  delete payload.source.naturalizedWorldFactRun;
  assert.equal(hash(JSON.stringify(payload)), legacy.profileSha256);
  f.write(pointer, Buffer.from("poisoned query pointer"));
  assert.deepEqual(build({ root: f.root, assignment, naturalizedRunBinding: f.run }), explicit);
});

for (const binding of [null, {}, { path: "data/run.json" }, { path: "../outside.json", sha256: "a".repeat(64) },
  { path: "data/latest.json", sha256: "a".repeat(64) }, { path: "F:/outside.json", sha256: "a".repeat(64) }]) {
  test(`invalid explicit binding fails without fallback: ${JSON.stringify(binding)}`, t => {
    const f = fixture(t);
    assert.throws(() => build({ root: f.root, assignment, naturalizedRunBinding: binding }), /binding is invalid/);
  });
}

test("wrong run hash and missing explicit file fail even when latest works", t => {
  const f = fixture(t);
  f.json(".runtime/ai-painter/earth-geospatial-naturalized-world-fact-runs/latest.json", { runPath: f.run.path });
  assert.throws(() => build({ root: f.root, assignment,
    naturalizedRunBinding: { ...f.run, sha256: "0".repeat(64) } }), /run hash mismatch/);
  assert.throws(() => build({ root: f.root, assignment,
    naturalizedRunBinding: { ...f.run, path: "data/missing.json" } }), /ENOENT/);
});

test("explicit run does not weaken downstream raster checks", t => {
  const f = fixture(t);
  f.write("data/drainage.gz", gzipSync(Buffer.alloc(256 * 192, 0)));
  assert.throws(() => build({ root: f.root, assignment, naturalizedRunBinding: f.run }), /raster hash mismatch/);
});
