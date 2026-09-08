import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createReader, sha256 } from "../lib/ai-painter-stage4-dataset-audit.mjs";
import { mergeExposureInventory, recordedOptimizerSteps, recordedReplaySteps, auditHistoricalExposure, discoverExposureInventory }
  from "../lib/ai-painter-stage4-historical-exposure.mjs";

const dir = ".runtime/ai-painter/history-run/training-output";
const evidencePath = `${dir}/condition-evidence.json`;
const stepPath = `${dir}/stage4-step-telemetry.json`;
const sampleId = "full-validation-sample-id";
function events() {
  return { schemaVersion: "stage4-bounded-repair-smoke-step-telemetry-v1", sampleId,
    events: [{ sequence: 1, step: "optimizer_step", status: "started", epoch: 1, batch: 1, recordedAtUtc: "2026-09-01T01:00:00.001Z" },
      { sequence: 2, step: "optimizer_step", status: "completed", epoch: 1, batch: 1, recordedAtUtc: "2026-09-01T01:00:00.002Z" }] };
}
function fixture(t, change = () => {}) {
  const tempRoot = fs.realpathSync(os.tmpdir());
  const root = fs.realpathSync(fs.mkdtempSync(path.join(tempRoot, "stage4-exposure-")));
  t.after(() => {
    const target = fs.realpathSync(root);
    assert.equal(target, root);
    assert.equal(path.dirname(target), tempRoot);
    assert.match(path.basename(target), /^stage4-exposure-[\w-]+$/);
    fs.rmSync(target, { recursive: true, force: true });
  });
  function write(logical, value) {
    const target = path.resolve(root, logical);
    const relative = path.relative(root, target);
    assert.ok(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    return { path: logical, sha256: sha256(bytes) };
  }
  const row = { sampleId, split: "validation", image: write("data/image.png", Buffer.from("synthetic-image")),
    conditionPack: write("data/condition-pack.json", { schemaVersion: "test-condition-pack" }) };
  const source = write("data/source-index.json", { samples: [{ sampleId, split: row.split,
    imagePath: row.image.path, imageSha256: row.image.sha256, conditionPackPath: row.conditionPack.path }] });
  const condition = { schemaVersion: "ai-assisted-conditional-denoiser-evidence-v4",
    records: [{ sampleId, split: row.split, conditionPackPath: row.conditionPack.path, velocityPredictionLoss: 1 },
      { split: "challenge", status: "reserved", metricsReadDuringTraining: false }] };
  const conditionBinding = write(evidencePath, condition);
  const manifest = { schemaVersion: "project-owned-ai-assisted-cold-start-checkpoint-v7",
    checkpointPath: `${dir}/checkpoint.pt`,
    sourceIndexPath: source.path, sourceIndexSha256: source.sha256,
    conditionEvidencePath: conditionBinding.path, conditionEvidenceSha256: conditionBinding.sha256,
    singleSampleOverfitSmoke: { enabled: true, sampleId, selectedSplit: row.split, conditionPackPath: row.conditionPack.path },
    trainingTokenAccounting: { runTotals: { optimizerSteps: 1 } }, bestCheckpointUpdated: true };
  const telemetry = events();
  change({ manifest, condition, row, telemetry, write });
  write(`${dir}/manifest.json`, manifest);
  write(evidencePath, condition);
  write(stepPath, telemetry);
  const reader = createReader(root);
  const inventory = { entries: mergeExposureInventory([evidencePath, stepPath], []), provesAllRunsInventoried: false };
  return { root, reader, rows: [row], inventory, write };
}

test("disk/catalog union retains catalog-only paths and null hashes", () => {
  const entries = mergeExposureInventory([evidencePath], [{ logical_path: stepPath, sha256: null, byte_size: 1 }]);
  assert.equal(entries.length, 2);
  assert.equal(entries.find((item) => item.path === stepPath).onDisk, false);
  assert.equal(entries.find((item) => item.path === evidencePath).catalogSha256, null);
});
test("inventory rejects traversal and duplicate identities", () => {
  assert.throws(() => mergeExposureInventory([".runtime/ai-painter/../condition-evidence.json"], []));
  assert.throws(() => mergeExposureInventory([evidencePath, evidencePath], []));
  const row = { logical_path: stepPath, sha256: null, byte_size: 1 };
  assert.throws(() => mergeExposureInventory([], [row, row]));
});
test("optimizer count requires paired completion events, not a success boolean", () => {
  assert.equal(recordedOptimizerSteps(events()).completedSteps, 1);
  const pending = events(); pending.events.pop(); pending.optimizerCompleted = true;
  assert.equal(recordedOptimizerSteps(pending).completedSteps, 0);
  assert.equal(recordedOptimizerSteps(pending).incompleteSteps, 1);
});
test("optimizer orphan, duplicate, out-of-order and cross-sample events are rejected", () => {
  const orphan = events(); orphan.events.shift();
  assert.throws(() => recordedOptimizerSteps(orphan), /unique start/);
  const duplicate = events(); duplicate.events.push({ ...duplicate.events[1], sequence: 3 });
  assert.throws(() => recordedOptimizerSteps(duplicate), /unique start/);
  const disorder = events(); disorder.events[1].sequence = 1;
  assert.throws(() => recordedOptimizerSteps(disorder), /increasing/);
  const cross = events(); cross.events[1].sampleId = "other";
  assert.throws(() => recordedOptimizerSteps(cross), /identity conflict/);
});
test("actual bound files distinguish evaluation from recorded non-train optimizer use", (t) => {
  const input = fixture(t);
  const report = auditHistoricalExposure(input);
  input.reader.verifyStable();
  assert.equal(report.summary.evaluationSamples, 1);
  assert.equal(report.summary.nonTrainOptimizerSamples, 1);
  assert.equal(report.perSample[0].recordedOptimizerSteps, 1);
  assert.equal(report.gaps.length, 0);
  assert.equal(report.reservations[0].provesNeverObserved, false);
  assert.equal(report.trainingAllowed, false);
  assert.equal(report.unseenHoldoutQualified, false);
  assert.equal(report.observations[0].checkpointSelectionProven, false);
});
test("evaluation and reserved status do not prove optimizer use or unseen status", (t) => {
  const input = fixture(t, ({ telemetry }) => { telemetry.events = []; });
  const report = auditHistoricalExposure(input);
  assert.equal(report.summary.evaluationSamples, 1);
  assert.equal(report.summary.recordedOptimizerSamples, 0);
  assert.equal(report.perSample[0].status, "historical_evaluation_recorded");
  assert.equal(report.perSample[0].unseenQualified, false);
});
test("source index hash substitution is an explicit coverage gap", (t) => {
  const report = auditHistoricalExposure(fixture(t, ({ manifest }) => { manifest.sourceIndexSha256 = "0".repeat(64); }));
  assert.equal(report.observations.length, 0);
  assert.ok(report.gaps.every((item) => /SHA mismatch/.test(item.reason)));
});
test("same sample name with changed RGB cannot be treated as identical exposure", (t) => {
  const report = auditHistoricalExposure(fixture(t, ({ row }) => { row.image.sha256 = "1".repeat(64); }));
  assert.equal(report.observations.length, 0);
  assert.ok(report.gaps.every((item) => /content\/split/.test(item.reason)));
});
test("altered evaluation bytes fail their manifest binding", (t) => {
  const report = auditHistoricalExposure(fixture(t, ({ condition }) => { condition.records[0].velocityPredictionLoss = 0.5; }));
  assert.equal(report.summary.evaluationSamples, 0);
  assert.ok(report.gaps.some((item) => /manifest binding/.test(item.reason)));
});
test("optimizer accounting mismatch does not certify a sample update count", (t) => {
  const report = auditHistoricalExposure(fixture(t, ({ manifest }) => { manifest.trainingTokenAccounting.runTotals.optimizerSteps = 0; }));
  assert.equal(report.summary.recordedOptimizerSamples, 0);
  assert.ok(report.gaps.some((item) => /accounting/.test(item.reason)));
});
test("unlogged replay totals do not inflate the paired-event lower bound", (t) => {
  const report = auditHistoricalExposure(fixture(t, ({ manifest }) => { manifest.trainingTokenAccounting.runTotals.optimizerSteps = 3; }));
  assert.equal(report.perSample[0].recordedOptimizerSteps, 1);
  assert.equal(report.observations.find((item) => item.usage === "recorded_optimizer_updates").reportedOptimizerSteps, 3);
  assert.ok(report.gaps.some((item) => item.code === "historical_optimizer_accounting_exceeds_paired_event_coverage"));
});
test("legacy relabelling is preserved as a conflict, not silently accepted as train", (t) => {
  const input = fixture(t, ({ condition, manifest, write }) => {
    condition.records[0].split = "train";
    manifest.conditionEvidenceSha256 = write(evidencePath, condition).sha256;
  });
  const report = auditHistoricalExposure(input);
  assert.equal(report.summary.evaluationSamples, 1);
  assert.equal(report.perSample[0].split, "validation");
  assert.ok(report.gaps.some((item) => item.code === "historical_evaluation_split_relabelled"));
});
test("missing trainer manifest remains a gap, never a fallback to latest", (t) => {
  const input = fixture(t);
  fs.unlinkSync(path.join(input.root, dir, "manifest.json"));
  const report = auditHistoricalExposure(input);
  assert.equal(report.observations.length, 0);
  assert.equal(report.gaps.length, 2);
  assert.equal(report.perSample[0].unseenQualified, false);
});
test("catalog conflicts are preserved alongside actual file observations", (t) => {
  const input = fixture(t);
  input.inventory.entries[0].catalogSha256 = "f".repeat(64);
  input.inventory.entries[0].catalogBytes = 1;
  const report = auditHistoricalExposure(input);
  assert.ok(report.gaps.some((item) => item.code === "historical_catalog_bytes_conflict"));
  assert.equal(report.trainingAllowed, false);
});
test("an empty historical inventory never qualifies holdouts", (t) => {
  const input = fixture(t); input.inventory.entries = [];
  const report = auditHistoricalExposure(input);
  assert.equal(report.summary.inventoryFiles, 0);
  assert.equal(report.perSample[0].unseenQualified, false);
});
test("real file discovery and read-only SQLite union include missing indexed evidence", (t) => {
  const input = fixture(t);
  const catalog = path.join(input.root, "catalog.sqlite");
  const database = new DatabaseSync(catalog);
  database.exec("CREATE TABLE artifacts(logical_path TEXT PRIMARY KEY,sha256 TEXT,byte_size INTEGER)");
  const missing = ".runtime/ai-painter/missing-run/condition-evidence.json";
  database.prepare("INSERT INTO artifacts VALUES(?,?,?)").run(missing, "e".repeat(64), 5);
  database.close();
  const before = sha256(fs.readFileSync(catalog));
  const inventory = discoverExposureInventory(input.root, catalog);
  assert.equal(inventory.entries.length, 3);
  assert.equal(inventory.entries.find((item) => item.path === missing).onDisk, false);
  assert.equal(sha256(fs.readFileSync(catalog)), before);
  const report = auditHistoricalExposure({ ...input, inventory });
  assert.ok(report.gaps.some((item) => item.path === missing && item.code === "historical_usage_evidence_unverified"));
});
test("input mutation after audit is detected by final receipt verification", (t) => {
  const input = fixture(t);
  auditHistoricalExposure(input);
  input.write(evidencePath, { changed: true });
  assert.throws(() => input.reader.verifyStable(), /SHA mismatch/);
});
test("copied optimizer event streams are not counted as extra training", (t) => {
  const input = fixture(t);
  const copiedDir = ".runtime/ai-painter/copied-run/training-output";
  const manifest = JSON.parse(fs.readFileSync(path.join(input.root, dir, "manifest.json"), "utf8"));
  manifest.checkpointPath = `${copiedDir}/checkpoint.pt`;
  input.write(`${copiedDir}/manifest.json`, manifest);
  input.write(`${copiedDir}/stage4-step-telemetry.json`, events());
  input.inventory.entries = mergeExposureInventory([evidencePath, stepPath, `${copiedDir}/stage4-step-telemetry.json`], []);
  const report = auditHistoricalExposure(input);
  assert.equal(report.perSample[0].recordedOptimizerRuns, 1);
  assert.equal(report.perSample[0].recordedOptimizerSteps, 1);
  assert.ok(report.gaps.some((item) => item.code === "duplicate_historical_optimizer_event_stream"));
});
test("optimizer records without timestamp or belonging to another output are rejected", (t) => {
  const noTime = events(); delete noTime.events[1].recordedAtUtc;
  assert.throws(() => recordedOptimizerSteps(noTime), /timestamp/);
  const report = auditHistoricalExposure(fixture(t, ({ manifest }) => { manifest.checkpointPath = ".runtime/ai-painter/other/checkpoint.pt"; }));
  assert.equal(report.summary.recordedOptimizerSamples, 0);
  assert.ok(report.gaps.some((item) => /directories differ/.test(item.reason)));
});

function withoutRecordedAt(report) {
  const { recordedAtUtc, ...stable } = report;
  assert.ok(Number.isFinite(Date.parse(recordedAtUtc)));
  return stable;
}

// Captured from the pre-versioning v1 implementation, not generated by v2.
for (const [name, change, expectedSha] of [
  ["bound use", () => {}, "cb0a08a15ae94d9e319669415ce68349c0ed9f1c6c8208569a1a1e1dd6010cac"],
  ["missing attribution", ({ telemetry }) => { telemetry.sampleId = null; },
    "0abb876c8fd33a688d583a49a34ac09f4e45bc49852978bc9e83bd03fae831a6"],
  ["evaluation role difference", ({ condition, manifest, write }) => {
    condition.records[0].split = "train";
    manifest.conditionEvidenceSha256 = write(evidencePath, condition).sha256;
  }, "0d1c72eb2295577d3836e8467ea0f3866248ff8c991ac0f7f2ff32560aa84176"],
  ["unlogged replay", ({ manifest }) => { manifest.trainingTokenAccounting.runTotals.optimizerSteps = 3; },
    "dec99a64e3f3c7d41b5949937f74cc7f89d97b7908ec8ba675a8eebc70554962"],
]) {
  test(`v1 serialized golden remains unchanged: ${name}`, (t) => {
    const input = fixture(t, change);
    const implicit = withoutRecordedAt(auditHistoricalExposure(input));
    const explicit = withoutRecordedAt(auditHistoricalExposure({ ...input, semanticsVersion: 1 }));
    assert.equal(JSON.stringify(implicit), JSON.stringify(explicit));
    assert.equal(sha256(Buffer.from(JSON.stringify(explicit))), expectedSha);
    assert.equal(Object.hasOwn(explicit, "runLevelOptimizerObservations"), false);
    assert.equal(Object.hasOwn(explicit, "evaluationRoleDifferences"), false);
    input.reader.verifyStable();
  });
}

test("unknown audit semantics fail closed before any evidence read", (t) => {
  const input = fixture(t);
  for (const semanticsVersion of [0, 4, null, "2", true, {}]) {
    assert.throws(() => auditHistoricalExposure({ ...input, semanticsVersion }), /unsupported.*semanticsVersion/);
  }
  assert.deepEqual(input.reader.receipts(), []);
});

test("public optimizer parser cannot opt into unknown attribution", () => {
  for (const sample of [null, undefined]) {
    const telemetry = events();
    telemetry.sampleId = sample;
    assert.throws(() => recordedOptimizerSteps(telemetry, true), /sample identity missing/);
    assert.throws(() => recordedOptimizerSteps(telemetry, { semanticsVersion: 2 }), /sample identity missing/);
  }
});

function auditV2(input) { return auditHistoricalExposure({ ...input, semanticsVersion: 2 }); }
function assertNoQualification(report) {
  assert.equal(report.schemaVersion, "ai-painter-stage4-historical-exposure-audit-v2");
  assert.equal(report.status, "bounded_historical_use_audited_not_qualified");
  for (const field of ["trainingAllowed", "unseenHoldoutQualified", "gpuStarted", "checkpointWeightsDeserialized"]) {
    assert.equal(report[field], false);
  }
  assert.ok(report.perSample.every((row) => row.unseenQualified === false));
}

for (const sample of [null, undefined]) {
  test(`v2 ${sample === null ? "null" : "absent"} sample preserves paired runtime facts and attribution gap`, (t) => {
    const input = fixture(t, ({ telemetry }) => { telemetry.sampleId = sample; });
    const report = auditV2(input);
    assertNoQualification(report);
    assert.equal(report.runLevelOptimizerObservations.length, 1);
    const run = report.runLevelOptimizerObservations[0];
    assert.equal(run.completedSteps, 1);
    assert.equal(run.incompleteSteps, 0);
    assert.equal(run.sampleId, null);
    assert.equal(run.split, null);
    assert.equal(run.sampleAttributionStatus, "unknown");
    assert.equal(run.evidencePath, stepPath);
    assert.equal(run.evidenceSha256, sha256(fs.readFileSync(path.join(input.root, stepPath))));
    for (const field of ["optimizerUpdateProven", "checkpointSelectionProven", "datasetBindingVerified", "weightLineageProven", "trainingAllowed"]) {
      assert.equal(run[field], false);
    }
    assert.equal(report.perSample[0].recordedOptimizerSteps, 0);
    assert.equal(report.perSample[0].recordedOptimizerRuns, 0);
    assert.equal(report.summary.recordedOptimizerSamples, 0);
    assert.ok(report.observations.every((item) => item.usage === "recorded_evaluation"));
    assert.deepEqual(report.gaps.map((item) => item.code), ["historical_optimizer_sample_attribution_missing"]);
    assert.equal(report.gaps[0].eventIdentity, run.eventIdentity);
    input.reader.verifyStable();
  });
}

test("v2 pending unattributed work remains a gap, never a completed step", (t) => {
  const input = fixture(t, ({ telemetry }) => {
    telemetry.sampleId = null; telemetry.events.pop(); telemetry.optimizerCompleted = true;
  });
  const report = auditV2(input);
  assert.equal(report.runLevelOptimizerObservations[0].completedSteps, 0);
  assert.equal(report.runLevelOptimizerObservations[0].incompleteSteps, 1);
  assert.equal(report.gaps[0].code, "historical_optimizer_sample_attribution_missing");
  assert.equal(report.gaps[0].incompleteSteps, 1);
  assert.equal(report.perSample[0].recordedOptimizerSteps, 0);
});

for (const state of ["empty", "non-optimizer", "failed"]) {
  test(`v2 ${state} unattributed telemetry is no-proof observation without invented completed steps`, (t) => {
    const input = fixture(t, ({ telemetry }) => {
      telemetry.sampleId = null;
      if (state === "empty") telemetry.events = [];
      if (state === "non-optimizer") telemetry.events = [{ sequence: 1, step: "heartbeat" }];
      if (state === "failed") telemetry.events[1].status = "failed";
    });
    const report = auditV2(input);
    assert.equal(report.runLevelOptimizerObservations.length, 1);
    assert.equal(report.runLevelOptimizerObservations[0].completedSteps, 0);
    assert.equal(report.runLevelOptimizerObservations[0].incompleteSteps, 0);
    assert.equal(report.gaps.length, 0);
    assert.equal(report.perSample[0].recordedOptimizerSteps, 0);
    assertNoQualification(report);
  });
}

for (const [name, mutate, reason] of [
  ["orphan completion", (log) => log.events.shift(), /unique start/],
  ["orphan failure", (log) => { log.events.shift(); log.events[0].status = "failed"; }, /without start/],
  ["duplicate start", (log) => { log.events[1] = { ...log.events[0], sequence: 2 }; }, /duplicate.*start/],
  ["duplicate completion", (log) => log.events.push({ ...log.events[1], sequence: 3 }), /unique start/],
  ["sequence reversal", (log) => { log.events[1].sequence = 1; }, /increasing/],
  ["fractional sequence", (log) => { log.events[1].sequence = 1.5; }, /increasing/],
  ["missing timestamp", (log) => { delete log.events[1].recordedAtUtc; }, /timestamp/],
  ["numeric timestamp", (log) => { log.events[1].recordedAtUtc = 9999; }, /timestamp/],
  ["malformed timestamp", (log) => { log.events[1].recordedAtUtc = "not-a-date"; }, /timestamp/],
  ["timestamp reversal", (log) => { log.events[1].recordedAtUtc = "2026-09-01T01:00:00.000Z"; }, /timestamp/],
  ["missing coordinates", (log) => { delete log.events[1].epoch; }, /coordinates/],
  ["invalid batch", (log) => { log.events[0].batch = 0; }, /coordinates/],
  ["unknown status", (log) => { log.events[1].status = "success"; }, /unsupported.*status/],
  ["cross-sample pair", (log) => { log.events[0].sampleId = "a"; log.events[1].sampleId = "b"; }, /identity conflict/],
  ["null event sample", (log) => { log.events[0].sampleId = null; }, /identity conflict/],
  ["multi-sample attribution", (log) => { log.events[1].sampleIds = ["a", "b"]; }, /sampleIds/],
  ["invalid top identity", (log) => { log.sampleId = ""; }, /identity missing/],
  ["unsupported schema", (log) => { log.schemaVersion = "caller-success"; }, /unsupported.*schema/],
]) {
  test(`v2 rejects malformed unattributed stream: ${name}`, (t) => {
    const report = auditV2(fixture(t, ({ telemetry }) => { telemetry.sampleId = null; mutate(telemetry); }));
    assert.equal(report.runLevelOptimizerObservations.length, 0);
    assert.equal(report.perSample[0].recordedOptimizerSteps, 0);
    const gap = report.gaps.find((item) => item.path === stepPath);
    assert.equal(gap.code, "historical_usage_evidence_unverified");
    assert.match(gap.reason, reason);
    assertNoQualification(report);
  });
}

test("v2 known top identity also rejects cross-sample events", (t) => {
  const report = auditV2(fixture(t, ({ telemetry }) => { telemetry.events[1].sampleId = "other"; }));
  assert.equal(report.perSample[0].recordedOptimizerSteps, 0);
  assert.ok(report.gaps.some((item) => /identity conflict/.test(item.reason)));
});

test("v2 event identities retain raw event sample IDs without inferring run attribution", (t) => {
  const identities = [];
  for (const eventSample of [undefined, "event-sample-a", "event-sample-b"]) {
    const input = fixture(t, ({ telemetry }) => {
      telemetry.sampleId = null;
      for (const event of telemetry.events) event.sampleId = eventSample;
    });
    const report = auditV2(input);
    const run = report.runLevelOptimizerObservations[0];
    identities.push(run.eventIdentity);
    assert.equal(run.sampleId, null);
    assert.equal(run.sampleAttributionStatus, "unknown");
    assert.equal(report.perSample[0].recordedOptimizerSteps, 0);
    assert.equal(report.gaps[0].code, "historical_optimizer_sample_attribution_missing");
  }
  assert.equal(new Set(identities).size, 3);
  const known = events(), withEventIds = events();
  for (const event of withEventIds.events) event.sampleId = sampleId;
  assert.equal(recordedOptimizerSteps(known).eventIdentity, recordedOptimizerSteps(withEventIds).eventIdentity);
});

test("v2 copied unattributed streams are flagged, but empty streams are not duplicate updates", (t) => {
  for (const completed of [true, false]) {
    const input = fixture(t, ({ telemetry }) => { telemetry.sampleId = null; if (!completed) telemetry.events = []; });
    const copiedPath = ".runtime/ai-painter/copied-run/training-output/stage4-step-telemetry.json";
    input.write(copiedPath, fs.readFileSync(path.join(input.root, stepPath)));
    input.inventory.entries = mergeExposureInventory([evidencePath, stepPath, copiedPath], []);
    const report = auditV2(input);
    assert.equal(report.runLevelOptimizerObservations.length, 2);
    assert.equal(report.runLevelOptimizerObservations.filter((item) => item.duplicateEventStream).length, completed ? 1 : 0);
    assert.equal(report.gaps.filter((item) => item.code === "duplicate_historical_optimizer_event_stream").length, completed ? 1 : 0);
    assert.equal(report.gaps.filter((item) => item.code === "historical_optimizer_sample_attribution_missing").length, completed ? 2 : 0);
    assert.equal(report.perSample[0].recordedOptimizerSteps, 0);
  }
});

test("v2 verifies released train row evaluated as regression without relabelling or invented optimizer use", (t) => {
  const input = fixture(t, ({ row, manifest, condition, telemetry, write }) => {
    row.split = "train";
    manifest.sourceIndexSha256 = write(manifest.sourceIndexPath, { samples: [{ sampleId, split: row.split,
      imagePath: row.image.path, imageSha256: row.image.sha256, conditionPackPath: row.conditionPack.path }] }).sha256;
    manifest.singleSampleOverfitSmoke.selectedSplit = "train";
    condition.records[0].split = "regression";
    manifest.conditionEvidenceSha256 = write(evidencePath, condition).sha256;
    telemetry.sampleId = null;
  });
  const legacy = auditHistoricalExposure(input);
  assert.ok(legacy.gaps.some((item) => item.code === "historical_evaluation_split_relabelled"));
  const report = auditV2(input);
  assert.equal(report.evaluationRoleDifferences.length, 1);
  const difference = report.evaluationRoleDifferences[0];
  assert.equal(difference.sampleId, sampleId);
  assert.equal(difference.releasedSplit, "train");
  assert.equal(difference.recordedEvaluationSplit, "regression");
  assert.equal(difference.recordIndex, 0);
  assert.equal(difference.evidenceSha256, sha256(fs.readFileSync(path.join(input.root, evidencePath))));
  for (const item of [difference, report.observations[0]]) {
    assert.equal(item.optimizerUpdateProven, false);
    assert.equal(item.checkpointSelectionProven, false);
    assert.equal(item.splitRelabelProven, false);
  }
  assert.equal(report.perSample[0].split, "train");
  assert.equal(report.perSample[0].evaluationRuns, 1);
  assert.equal(report.perSample[0].recordedOptimizerSteps, 0);
  assert.equal(report.runLevelOptimizerObservations.length, 1);
  assert.deepEqual(report.gaps.map((item) => item.code), ["historical_optimizer_sample_attribution_missing"]);
  input.reader.verifyStable();
  assertNoQualification(report);
});

for (const [name, change, reason] of [
  ["source binding", ({ manifest }) => { manifest.sourceIndexSha256 = "0".repeat(64); }, /SHA mismatch/],
  ["actual source split", ({ manifest, row, write }) => {
    manifest.sourceIndexSha256 = write(manifest.sourceIndexPath, { samples: [{ sampleId, split: "regression",
      imagePath: row.image.path, imageSha256: row.image.sha256, conditionPackPath: row.conditionPack.path }] }).sha256;
  }, /content\/split/],
  ["actual RGB bytes", ({ row, write }) => { write(row.image.path, Buffer.from("changed")); }, /SHA mismatch/],
  ["actual condition bytes", ({ row, write }) => { write(row.conditionPack.path, { changed: true }); }, /SHA mismatch/],
  ["evaluation binding", ({ manifest }) => { manifest.conditionEvidenceSha256 = "0".repeat(64); }, /manifest binding/],
  ["ambiguous source identity", ({ manifest, row, write }) => {
    const entry = { sampleId, split: row.split, imagePath: row.image.path,
      imageSha256: row.image.sha256, conditionPackPath: row.conditionPack.path };
    manifest.sourceIndexSha256 = write(manifest.sourceIndexPath, { samples: [entry, entry] }).sha256;
  }, /not unique/],
]) {
  test(`v2 role difference does not relax ${name}`, (t) => {
    const input = fixture(t, (values) => {
      values.condition.records[0].split = "regression";
      values.manifest.conditionEvidenceSha256 = values.write(evidencePath, values.condition).sha256;
      change(values);
    });
    const report = auditV2(input);
    assert.equal(report.evaluationRoleDifferences.length, 0);
    assert.equal(report.summary.evaluationSamples, 0);
    const gap = report.gaps.find((item) => item.code === "evaluation_binding_unverified");
    assert.match(gap.reason, reason);
    assertNoQualification(report);
  });
}

test("v2 does not add differences for the same evaluation role or parse replay events", (t) => {
  const input = fixture(t, ({ manifest, telemetry }) => {
    manifest.trainingTokenAccounting.runTotals.optimizerSteps = 3;
    telemetry.events.push({ sequence: 3, step: "path_replay_step", status: "completed", sampleId,
      epoch: 1, batch: 1, recordedAtUtc: "2026-09-01T01:00:00.003Z" });
  });
  const legacy = auditHistoricalExposure(input), report = auditV2(input);
  assert.deepEqual(report.gaps, legacy.gaps);
  assert.equal(report.gaps[0].code, "historical_optimizer_accounting_exceeds_paired_event_coverage");
  assert.equal(report.perSample[0].recordedOptimizerSteps, 1);
  assert.equal(report.evaluationRoleDifferences.length, 0);
  assert.equal(report.runLevelOptimizerObservations.length, 0);
});

test("v2 keeps missing manifest gaps, even with a plausible sibling manifest", (t) => {
  const input = fixture(t);
  const manifestPath = path.join(input.root, dir, "manifest.json");
  const sibling = ".runtime/ai-painter/history-run/manifest.json";
  input.write(sibling, fs.readFileSync(manifestPath));
  fs.unlinkSync(manifestPath);
  const legacy = auditHistoricalExposure(input), report = auditV2(input);
  assert.deepEqual(report.gaps, legacy.gaps);
  assert.equal(report.gaps.length, 2);
  assert.equal(report.observations.length, 0);
  assert.equal(report.evaluationRoleDifferences.length, 0);
  assert.equal(input.reader.receipts().some((item) => item.path === sibling), false);
});

test("v2 only reads explicit evidence/data bytes and keeps inputs unchanged", (t) => {
  const input = fixture(t, ({ telemetry }) => { telemetry.sampleId = null; });
  const snapshot = () => fs.readdirSync(input.root, { recursive: true }).sort().filter((logical) =>
    fs.statSync(path.join(input.root, logical)).isFile()).map((logical) =>
    [logical, sha256(fs.readFileSync(path.join(input.root, logical)))]);
  const before = snapshot();
  const report = auditV2({ ...input, trainingAllowed: true, unseenHoldoutQualified: true });
  input.reader.verifyStable();
  assert.deepEqual(snapshot(), before);
  assert.equal(input.reader.receipts().some((item) => /\.(?:pt|pth|safetensors)$/.test(item.path)), false);
  assert.equal(fs.existsSync(path.join(input.root, dir, "checkpoint.pt")), false);
  assertNoQualification(report);
  input.write(stepPath, { changed: true });
  assert.throws(() => input.reader.verifyStable(), /SHA mismatch/);
});

const replayKinds = ["epoch_worst_sample_class_replay", "epoch_complete_per_class_selected_luminance_replay",
  "epoch_complete_per_class_selected_reference_feature_replay"];
function replayFixture(t, change = () => {}) {
  let train;
  const input = fixture(t, args => {
    const { row, telemetry, manifest, write } = args;
    train = { sampleId: "separate-train-replay-sample", split: "train",
      image: write("data/train-image.png", Buffer.from("separate-train-RGB")),
      conditionPack: write("data/train-pack.json", { sampleId: "separate-train-replay-sample" }) };
    const source = write("data/source-index.json", { samples: [row, train].map(r => ({ sampleId: r.sampleId,
      split: r.split, imagePath: r.image.path, imageSha256: r.image.sha256, conditionPackPath: r.conditionPack.path })) });
    manifest.sourceIndexSha256 = source.sha256;
    const config = { training: {
      stage4EpochWorstSampleClassReplay: { enabled: true, replay: { passesPerObservedPrimaryBatch: 2 } },
      stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity: { enabled: true },
      stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay: { enabled: true },
    } };
    const configBinding = write("data/replay-config.json", config);
    manifest.configPath = configBinding.path; manifest.configSha256 = configBinding.sha256;
    manifest.trainingTokenAccounting.runTotals.optimizerSteps = 6;
    telemetry.events = [];
    const add = event => telemetry.events.push({ sequence: telemetry.events.length + 1,
      recordedAtUtc: `2026-09-01T01:00:00.00${telemetry.events.length + 1}Z`, ...event });
    for (const epoch of [1, 2]) {
      add({ step: "optimizer_step", status: "started", epoch, batch: 1 });
      add({ step: "optimizer_step", status: "completed", epoch, batch: 1 });
      for (const replayPass of [1, 2]) add({ step: epoch === 1 ? replayKinds[replayPass - 1] : replayKinds[replayPass === 1 ? 2 : 0],
        status: "completed", epoch, batch: 1, replayPass,
        sampleId: (epoch === 1 ? replayPass === 1 : replayPass === 2) ? row.sampleId : train.sampleId,
        classIdentity: "tree", selectionScore: 0.2 });
    }
    change({ ...args, train, config });
  });
  input.rows.push(train);
  return input;
}
const auditV3 = input => auditHistoricalExposure({ ...input, semanticsVersion: 3 });

test("v3 counts all three bound replay types under their own sample, independently of primary attribution", t => {
  const input = replayFixture(t), before = withoutRecordedAt(auditV2(input));
  const report = auditV3(input); input.reader.verifyStable();
  assert.equal(report.schemaVersion, "ai-painter-stage4-historical-exposure-audit-v3");
  assert.equal(report.gaps.length, 0);
  assert.equal(report.replayOptimizerObservations.length, 2);
  assert.equal(report.replayOptimizerObservations.reduce((n, g) => n + g.uniqueCompletedEvents, 0), 4);
  assert.deepEqual(new Set(report.replayOptimizerObservations.flatMap(e => Object.keys(e.eventTypeCounts))), new Set(replayKinds));
  assert.ok(report.replayOptimizerObservations.every(g => /^[a-f0-9]{64}$/.test(g.eventSelectionSha256)));
  assert.deepEqual(report.perSample.map(s => [s.recordedOptimizerSteps, s.recordedReplaySteps, s.totalRecordedOptimizerSteps]), [[2, 2, 4], [0, 2, 2]]);
  assert.equal(report.summary.recordedOptimizerSamples, 2);
  assert.equal(report.summary.nonTrainOptimizerSamples, 1);
  assert.equal(report.replayAccounting[0].eventsMatchReportedTotal, true);
  assert.equal(report.replayAccounting[0].wholeRunExecutionProven, false);
  assert.ok(report.replayOptimizerObservations.every(e => e.optimizerUpdateProven === false && e.historicalWeightsLoaded === false));
  assert.deepEqual(withoutRecordedAt(auditV2(input)), before);
  assert.equal(before.perSample[1].recordedOptimizerSteps, 0);
  assert.equal(before.gaps[0].code, "historical_optimizer_accounting_exceeds_paired_event_coverage");
  assert.equal(report.trainingAllowed, false); assert.equal(report.unseenHoldoutQualified, false);
});

for (const [name, change, reason] of [
  ["duplicate slot with another event type", ({ telemetry }) => { telemetry.events[3].replayPass = 1; }, /duplicate replay slot/],
  ["out-of-order pass", ({ telemetry }) => { telemetry.events[2].replayPass = 2; }, /pass order/],
  ["wrong batch", ({ telemetry }) => { telemetry.events[2].batch = 2; }, /preceding completed/],
  ["before primary completion", ({ telemetry }) => {
    [telemetry.events[1], telemetry.events[2]] = [telemetry.events[2], telemetry.events[1]];
    telemetry.events.forEach((e, i) => { e.sequence = i + 1; e.recordedAtUtc = `2026-09-01T01:00:00.00${i + 1}Z`; });
  }, /preceding completed/],
  ["timestamp reversal", ({ telemetry }) => { telemetry.events[2].recordedAtUtc = "2026-09-01T01:00:00.000Z"; }, /timestamp reversed/],
  ["missing sample", ({ telemetry }) => { delete telemetry.events[2].sampleId; }, /sample identity/],
  ["unknown replay type", ({ telemetry }) => { telemetry.events[2].step = "other_replay"; }, /unsupported historical replay/],
  ["completion boolean only", ({ telemetry }) => { telemetry.events[2].status = "started"; telemetry.events[2].completed = true; }, /not a recorded completion/],
  ["bad score", ({ telemetry }) => { telemetry.events[2].selectionScore = "0.2"; }, /class or selection/],
  ["out-of-release sample", ({ telemetry }) => { telemetry.events[2].sampleId = "unbound-sample"; }, /not bound.*release/],
  ["missing config hash", ({ manifest }) => { delete manifest.configSha256; }, /missing SHA binding/],
  ["config byte drift", ({ write }) => { write("data/replay-config.json", { forged: true }); }, /SHA mismatch/],
  ["over config budget", ({ config, manifest, write }) => {
    config.training.stage4EpochWorstSampleClassReplay.replay.passesPerObservedPrimaryBatch = 1;
    manifest.configSha256 = write(manifest.configPath, config).sha256;
  }, /pass order or budget/],
  ["disabled type", ({ config, manifest, write }) => {
    config.training.stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity.enabled = false;
    manifest.configSha256 = write(manifest.configPath, config).sha256;
  }, /enabled bound configuration/],
  ["changed replay RGB", ({ train }) => { train.image.sha256 = "a".repeat(64); }, /content\/split/],
  ["totals smaller than events", ({ manifest }) => { manifest.trainingTokenAccounting.runTotals.optimizerSteps = 5; }, /exceed or lack trainer accounting/],
]) test(`v3 rejects replay ${name} while retaining independently verified primary events`, t => {
  const input = replayFixture(t, change), report = auditV3(input);
  assert.equal(report.replayOptimizerObservations.length, 0);
  assert.match(report.gaps.find(g => g.code === "historical_replay_evidence_unverified").reason, reason);
  assert.equal(report.perSample[0].recordedOptimizerSteps, 2);
  assert.equal(report.trainingAllowed, false);
});

test("v3 missing replay events remain missing despite a larger ledger", t => {
  const report = auditV3(replayFixture(t, ({ telemetry }) => {
    telemetry.events = telemetry.events.filter(e => e.step === "optimizer_step");
  }));
  assert.equal(report.replayOptimizerObservations.length, 0);
  assert.equal(report.perSample[0].recordedOptimizerSteps, 2);
  assert.ok(report.gaps.some(g => g.code === "historical_optimizer_accounting_exceeds_paired_event_coverage"));
});

test("v3 known replay sample survives unknown primary attribution without assigning primary steps", t => {
  const report = auditV3(replayFixture(t, ({ telemetry }) => { telemetry.sampleId = null; }));
  assert.equal(report.runLevelOptimizerObservations[0].completedSteps, 2);
  assert.equal(report.perSample[0].recordedOptimizerSteps, 0);
  assert.deepEqual(report.perSample.map(s => s.recordedReplaySteps), [2, 2]);
  assert.ok(report.gaps.some(g => g.code === "historical_optimizer_sample_attribution_missing"));
});

test("v3 copied full or partial logs never multiply primary or replay counts", t => {
  const input = replayFixture(t), copied = ".runtime/ai-painter/copied-replay/training-output";
  const manifest = JSON.parse(fs.readFileSync(path.join(input.root, dir, "manifest.json")));
  manifest.checkpointPath = `${copied}/checkpoint.pt`;
  const log = JSON.parse(fs.readFileSync(path.join(input.root, stepPath)));
  log.events = log.events.filter(e => e.epoch === 1);
  manifest.trainingTokenAccounting.runTotals.optimizerSteps = 3;
  input.write(`${copied}/manifest.json`, manifest); input.write(`${copied}/stage4-step-telemetry.json`, log);
  input.inventory.entries.push({ path: `${copied}/stage4-step-telemetry.json`, onDisk: true, catalogSha256: null, catalogBytes: null });
  const report = auditV3(input);
  assert.deepEqual(report.perSample.map(s => s.totalRecordedOptimizerSteps), [4, 2]);
  assert.equal(report.replayOptimizerObservations.reduce((n, g) => n + g.duplicateCompletedEvents, 0), 2);
  assert.ok(report.gaps.some(g => g.code === "overlapping_historical_primary_event"));
});

test("replay parser is pure and reads no model or runtime files", () => {
  const telemetry = events(), config = { training: { stage4EpochWorstSampleClassReplay: { enabled: true,
    replay: { passesPerObservedPrimaryBatch: 2 } } } };
  const before = JSON.stringify([telemetry, config]);
  assert.deepEqual(recordedReplaySteps(telemetry, config).completedEvents, []);
  assert.equal(JSON.stringify([telemetry, config]), before);
});

// Captured before recovery support: v2 must not inherit new fields or semantics.
for (const [name, change, expectedSha] of [
  ["bound use", () => {}, "8ba573977942073ef11abbfbf39a620dc961fb6ceee9b38b144ea34b8d873d39"],
  ["missing attribution", ({ telemetry }) => { telemetry.sampleId = null; },
    "74d93785d926ccd8512c04fda9b8291b90715af94ee933afae4f4332b08af2d6"],
  ["evaluation role difference", ({ condition, manifest, write }) => {
    condition.records[0].split = "train";
    manifest.conditionEvidenceSha256 = write(evidencePath, condition).sha256;
  }, "daffee23fb8c3c7d733bb3ae387e2a96f8d858f5b82a491b9db1500c5b24f4fe"],
  ["unlogged replay", ({ manifest }) => { manifest.trainingTokenAccounting.runTotals.optimizerSteps = 3; },
    "1469d94d737ed487cf164b5452e25a7212208109c723101ed8839fa5a1849a15"],
]) test(`recovery extension preserves v2 serialized golden: ${name}`, t => {
  const input = fixture(t, change);
  const report = withoutRecordedAt(auditV2(input));
  assert.equal(sha256(Buffer.from(JSON.stringify(report))), expectedSha);
  assert.equal(JSON.stringify(withoutRecordedAt(auditV2({ ...input, recoveryRoots: [] }))), JSON.stringify(report));
  assert.equal(Object.hasOwn(report, "recoveredEvaluationSources"), false);
});

function recoveryFixture(t, change = () => {}, { keepManifest = false } = {}) {
  const input = fixture(t);
  const runDirectory = path.posix.dirname(dir), runId = path.posix.basename(runDirectory);
  const recoveryId = "synthetic-recovery-1", sourcePackageIdentity = "synthetic-original-package";
  const recoveryDirectory = `${runDirectory}/post-training-terminal-recoveries/${recoveryId}`;
  const documents = {}, bindings = {};
  function emit(name, logical, value) {
    change(name, value, { input, documents, bindings });
    documents[name] = value;
    return bindings[name] = input.write(logical, value);
  }
  const checkpoint = { path: `${dir}/checkpoint.pt`, sha256: "a".repeat(64) }; // Metadata only; file never created.
  const executeEvidence = { path: `.runtime/ai-painter/autonomous-closed-loop-executions/${sourcePackageIdentity}/phase-evidence/execute-attempt-0.json`,
    sha256: "b".repeat(64) }; // Metadata comparison only; no execute/QA leaf loading.
  const sourceTerminal = emit("sourceTerminal", `.runtime/ai-painter/autonomous-closed-loop-executions/${sourcePackageIdentity}/phase-terminal.json`, {
    schemaVersion: "ai-painter-autonomous-closed-loop-terminal-v1", packageIdentity: sourcePackageIdentity,
    status: "failed_closed", failureCode: "trainer_failed_after_start",
    finalResult: { status: "failed", failureKind: "business", failureCode: "trainer_failed_after_start" },
    latestEvidence: { phase: "execute", attempt: 0, path: "phase-evidence/execute-attempt-0.json", sha256: executeEvidence.sha256 },
  });
  const capability = "stage4_full_backbone_joint_condition_local_transport_denoiser_v1";
  const source = JSON.parse(fs.readFileSync(path.join(input.root, "data/source-index.json")));
  source.schemaVersion = "ai-assisted-cold-start-dataset-source-index-v1";
  source.packageId = "synthetic-data-package";
  const sourceIndex = emit("source", "data/source-index.json", source);
  const activeConfig = emit("config", `${runDirectory}/active-config.json`, {
    schemaVersion: "ai-painter-stage4-joint-condition-local-transport-full-data-screen-config-v1",
    status: "full_data_screen_active_not_started",
    denoiserArchitecture: capability, architectureVersion: "joint-condition-local-transport-denoiser-v1",
    executionIdentity: { runId, outputNamespace: runDirectory, crossRunEvidenceAllowed: false, namespaceReuseAllowed: false },
    evidenceBindings: { approvedDataset: { datasetPackageId: source.packageId, sourceIndex } },
  });
  const condition = JSON.parse(fs.readFileSync(path.join(input.root, evidencePath)));
  const conditionEvidence = emit("condition", evidencePath, condition);
  const recoveryEvidence = emit("recovery", `${recoveryDirectory}/post-checkpoint-recovery-evidence.json`, {
    schemaVersion: "ai-painter-stage4-joint-condition-local-transport-post-checkpoint-recovery-v1",
    status: "post_checkpoint_projection_failure_verified_recoverable", runId, recoveryId, sourcePackageIdentity,
    capabilityVersion: capability,
    failureClassification: { sourceFailureCode: "trainer_failed_after_start",
      correctedFailureCode: "post_checkpoint_manifest_projection_defect", originalTrainerManifestCreated: false },
    sourceEvidence: { activeConfig, sourceTerminal, executeEvidence, conditionEvidence, checkpointIdentityOnly: checkpoint },
    checkpoint: { ...checkpoint, promotable: false, loadedOrDeserializedDuringRecovery: false },
  });
  const flags = () => ({ schemaVersion: "ai-painter-stage4-joint-condition-local-transport-post-checkpoint-recovery-v1",
    recoveryId, correctedFailureCode: "post_checkpoint_manifest_projection_defect", sourceFailureTerminal: sourceTerminal,
    recoveryEvidence, derivedManifestNotOriginalTrainerManifest: true, checkpointPromotable: false,
    checkpointWeightsLoaded: false, gpuStarted: false, trainingRestarted: false });
  const trainingManifest = emit("trainer", `${recoveryDirectory}/recovered-trainer-evidence.json`, {
    schemaVersion: "ai-painter-joint-full-data-screen-recovered-training-evidence-v1",
    status: "stage4_joint_condition_local_transport_full_data_screen_training_completed_awaiting_automatic_machine_review",
    architectureVersion: "joint-condition-local-transport-denoiser-v1",
    stage4JointConditionLocalTransportFullDataScreen: { runId, architectureId: capability }, configPath: activeConfig.path, configSha256: activeConfig.sha256,
    checkpointPath: checkpoint.path, checkpointSha256: checkpoint.sha256, checkpointPromotionEligible: false,
    stage0InitializationEligible: false, evidenceRecovery: flags(),
  });
  const manifest = emit("manifest", `${recoveryDirectory}/manifest.json`, {
    schemaVersion: "ai-painter-joint-condition-local-transport-full-data-screen-manifest-v1", status: "real_visual_failure",
    capabilityVersion: capability,
    runId, packageIdentity: recoveryId, trainingManifest, checkpoint: { ...checkpoint, promotable: false },
    postCheckpointRecovery: flags(), stage0Started: false, trainingRetryStarted: false,
  });
  const recoveryTerminal = emit("terminal", `${recoveryDirectory}/phase-terminal.json`, {
    schemaVersion: "ai-painter-joint-full-data-screen-post-checkpoint-recovery-terminal-v1",
    executionState: "failed_closed", status: "full_data_screen_real_visual_failure", runId, recoveryId, sourcePackageIdentity,
    correctedSourceFailureCode: "post_checkpoint_manifest_projection_defect", manifest,
    recoveredTrainingEvidence: trainingManifest, recoveryEvidence, trainingRestarted: false, gpuStarted: false,
    checkpointWeightsLoaded: false, stage0Started: false,
  });
  const recoveryRoot = emit("root", `${recoveryDirectory}/registry-terminal-projection.json`, {
    schemaVersion: "ai-painter-joint-full-data-screen-post-checkpoint-recovery-registry-terminal-v1",
    executionState: "completed", resultExecutionState: "failed_closed", status: "full_data_screen_real_visual_failure",
    runId, recoveryId, sourcePackageIdentity, recoveryTerminal,
  });
  if (!keepManifest) fs.unlinkSync(path.join(input.root, dir, "manifest.json"));
  return { ...input, recoveryRoots: [recoveryRoot], recoveryBindings: bindings, recoveryDocuments: documents };
}

test("v3 explicit recovery root recovers evaluation only with exact real-file provenance", t => {
  const input = recoveryFixture(t);
  const report = auditV3(input); input.reader.verifyStable();
  const source = report.recoveredEvaluationSources[0];
  assert.equal(report.recoveredEvaluationSources.length, 1);
  assert.equal(source.acceptedEvaluationRecords, 1);
  assert.equal(source.role, "derived_recovery_evaluation_only");
  assert.equal(source.conditionIdentityScope, "historical_path_and_current_release_bytes_only");
  assert.equal(source.historicalConditionBytesIdentityProven, false);
  assert.equal(input.recoveryDocuments.source.samples[0].conditionPackSha256, undefined);
  assert.deepEqual(source.recoveryRoot, input.recoveryRoots[0]);
  assert.deepEqual(source.manifest, input.recoveryBindings.manifest);
  assert.deepEqual(source.conditionEvidence, input.recoveryBindings.condition);
  const observation = report.observations[0];
  assert.equal(observation.usage, "recorded_evaluation");
  assert.equal(observation.manifestPath, input.recoveryBindings.manifest.path);
  assert.equal(observation.evidenceRole, source.role);
  assert.deepEqual(observation.recoveryRoot, source.recoveryRoot);
  assert.equal(report.perSample[0].evaluationRuns, 1);
  assert.equal(report.perSample[0].totalRecordedOptimizerSteps, 0);
  assert.equal(report.replayOptimizerObservations.length, 0);
  assert.equal(report.gaps.length, 1);
  assert.equal(report.gaps[0].code, "historical_usage_evidence_unverified");
  for (const key of ["originalManifestRecreated", "optimizerUpdateProven", "checkpointSelectionProven", "trainingAllowed", "unseenHoldoutQualified"]) {
    assert.equal(source[key], false);
  }
  assert.equal(observation.optimizerUpdateProven, false);
  assert.equal(observation.checkpointSelectionProven, false);
  assert.equal(report.trainingAllowed, false); assert.equal(report.unseenHoldoutQualified, false);
  assert.equal(input.reader.receipts().some(r => /\.(pt|pth|safetensors)$/.test(r.path)), false);
  assert.equal(fs.existsSync(path.join(input.root, dir, "checkpoint.pt")), false);
});

test("recovery roots are v3-only, bounded, explicit and nonduplicate", t => {
  const input = recoveryFixture(t), root = input.recoveryRoots[0];
  for (const semanticsVersion of [1, 2]) {
    assert.throws(() => auditHistoricalExposure({ ...input, semanticsVersion }), /require semanticsVersion 3/);
  }
  for (const recoveryRoots of [null, {}, Array(17).fill(root)]) {
    assert.throws(() => auditV3({ ...input, recoveryRoots }), /bounded array/);
  }
  assert.throws(() => auditV3({ ...input, recoveryRoots: [root, root] }), /duplicate recovery roots/);
  assert.throws(() => auditV3({ ...input, recoveryRoots: [{ ...root, path: root.path.replace("registry-terminal-projection.json", "latest.json") }] }), /invalid explicit/);
  assert.deepEqual(input.reader.receipts(), []);
});

for (const [name, target, mutate, reason] of [
  ["terminal SHA", "root", doc => { doc.recoveryTerminal.sha256 = "0".repeat(64); }, /SHA mismatch/],
  ["unknown root schema", "root", doc => { doc.schemaVersion = "caller-success"; }, /unsupported recovery schema/],
  ["successful root", "root", doc => { doc.resultExecutionState = "completed"; }, /non-promotable failure/],
  ["wrong terminal run", "terminal", doc => { doc.runId = "other-run"; }, /run\/package\/identity/],
  ["wrong recovery identity", "recovery", doc => { doc.recoveryId = "other-recovery"; }, /run\/package\/identity/],
  ["wrong source package", "terminal", doc => { doc.sourcePackageIdentity = "other-package"; }, /run\/package\/identity/],
  ["source terminal schema", "sourceTerminal", doc => { doc.schemaVersion = "caller-failure"; }, /unsupported recovery schema/],
  ["source terminal package", "sourceTerminal", doc => { doc.packageIdentity = "other-package"; }, /source failure terminal identity\/status/],
  ["source terminal optional run", "sourceTerminal", doc => { doc.runId = "other-run"; }, /source failure terminal identity\/status/],
  ["successful source terminal", "sourceTerminal", doc => { doc.status = "completed"; }, /source failure terminal identity\/status/],
  ["source failure code", "sourceTerminal", doc => { doc.failureCode = "other-failure"; }, /source failure terminal identity\/status/],
  ["source final-result success", "sourceTerminal", doc => { doc.finalResult.status = "passed"; }, /source failure terminal identity\/status/],
  ["source execute identity", "sourceTerminal", doc => { doc.latestEvidence.path = "phase-evidence/execute-attempt-1.json"; }, /source failure execute identity/],
  ["source execute binding", "recovery", doc => { doc.sourceEvidence.executeEvidence.sha256 = "c".repeat(64); }, /cross-binding/],
  ["wrong derived package", "manifest", doc => { doc.packageIdentity = "other-package"; }, /manifest\/trainer run/],
  ["wrong trainer run", "trainer", doc => { doc.stage4JointConditionLocalTransportFullDataScreen.runId = "other-run"; }, /manifest\/trainer run/],
  ["mixed trainer binding", "terminal", doc => { doc.recoveredTrainingEvidence = { ...doc.recoveredTrainingEvidence, sha256: "c".repeat(64) }; }, /cross-binding/],
  ["mixed recovery binding", "manifest", doc => { doc.postCheckpointRecovery.recoveryEvidence = { ...doc.postCheckpointRecovery.recoveryEvidence, sha256: "c".repeat(64) }; }, /cross-binding/],
  ["mixed source terminal", "trainer", doc => { doc.evidenceRecovery.sourceFailureTerminal = { ...doc.evidenceRecovery.sourceFailureTerminal, sha256: "c".repeat(64) }; }, /cross-binding/],
  ["original manifest claim", "manifest", doc => { doc.postCheckpointRecovery.derivedManifestNotOriginalTrainerManifest = false; }, /original Manifest/],
  ["original creation claim", "recovery", doc => { doc.failureClassification.originalTrainerManifestCreated = true; }, /failure\/derived role/],
  ["promotable checkpoint", "manifest", doc => { doc.checkpoint.promotable = true; }, /non-promotable/],
  ["stage0 eligible trainer", "trainer", doc => { doc.stage0InitializationEligible = true; }, /non-promotable/],
  ["restarted training", "terminal", doc => { doc.trainingRestarted = true; }, /non-promotable/],
  ["wrong checkpoint identity", "trainer", doc => { doc.checkpointSha256 = "c".repeat(64); }, /cross-binding/],
  ["mixed active config", "trainer", doc => { doc.configSha256 = "c".repeat(64); }, /cross-binding/],
  ["cross-run config", "config", doc => { doc.executionIdentity.runId = "other-run"; }, /config execution identity/],
  ["manifest capability", "manifest", doc => { doc.capabilityVersion = "v2"; }, /capability identity/],
  ["recovery capability", "recovery", doc => { doc.capabilityVersion = "v2"; }, /capability identity/],
  ["config capability", "config", doc => { doc.denoiserArchitecture = "v2"; }, /capability identity/],
  ["trainer capability", "trainer", doc => { doc.stage4JointConditionLocalTransportFullDataScreen.architectureId = "v2"; }, /capability identity/],
  ["trainer architecture version", "trainer", doc => { doc.architectureVersion = "v2"; }, /capability identity/],
  ["source index hash", "config", doc => { doc.evidenceBindings.approvedDataset.sourceIndex = { ...doc.evidenceBindings.approvedDataset.sourceIndex, sha256: "c".repeat(64) }; }, /SHA mismatch/],
  ["source package mismatch", "config", doc => { doc.evidenceBindings.approvedDataset.datasetPackageId = "other-data"; }, /source dataset identity/],
  ["condition evidence hash", "recovery", doc => { doc.sourceEvidence.conditionEvidence = { ...doc.sourceEvidence.conditionEvidence, sha256: "c".repeat(64) }; }, /SHA mismatch/],
  ["another condition namespace", "recovery", doc => { doc.sourceEvidence.conditionEvidence = { ...doc.sourceEvidence.conditionEvidence, path: ".runtime/ai-painter/other/training-output/condition-evidence.json" }; }, /condition evidence namespace/],
  ["condition model-file substitution", "recovery", doc => { doc.sourceEvidence.conditionEvidence = { ...doc.sourceEvidence.conditionEvidence, path: `${dir}/checkpoint.pt` }; }, /condition evidence namespace/],
  ["source model-file substitution", "config", doc => { doc.evidenceBindings.approvedDataset.sourceIndex = { path: `${dir}/checkpoint.pt`, sha256: "a".repeat(64) }; }, /JSON path/],
]) test(`v3 explicit recovery rejects ${name}`, t => {
  const input = recoveryFixture(t, (part, doc) => { if (part === target) mutate(doc); });
  assert.throws(() => auditV3(input), reason);
  assert.equal(input.reader.receipts().some(r => /\.(pt|pth|safetensors)$/.test(r.path)), false);
});

test("bad recovery roots are not ignored when inventory is empty", t => {
  const input = recoveryFixture(t);
  input.inventory.entries = [];
  input.recoveryRoots[0] = { ...input.recoveryRoots[0], sha256: "c".repeat(64) };
  assert.throws(() => auditV3(input), /SHA mismatch/);
});

test("v3 recovery reads and hash-verifies the source failure terminal bytes", t => {
  const input = recoveryFixture(t);
  input.write(input.recoveryBindings.sourceTerminal.path, { ...input.recoveryDocuments.sourceTerminal, status: "completed" });
  assert.throws(() => auditV3(input), /SHA mismatch/);
});

for (const [name, mutate, reason] of [
  ["RGB identity", source => { source.samples[0].imageSha256 = "c".repeat(64); }, /content\/split/],
  ["released split", source => { source.samples[0].split = "train"; }, /content\/split/],
  ["condition path", source => { source.samples[0].conditionPackPath = "data/other-condition.json"; }, /content\/split/],
  ["duplicate sample", source => { source.samples.push({ ...source.samples[0] }); }, /not unique/],
]) test(`v3 recovery keeps source-row ${name} conflict closed`, t => {
  const input = recoveryFixture(t, (part, doc) => { if (part === "source") mutate(doc); });
  const report = auditV3(input);
  assert.equal(report.recoveredEvaluationSources[0].acceptedEvaluationRecords, 0);
  assert.equal(report.observations.length, 0);
  assert.match(report.gaps.find(g => g.code === "evaluation_binding_unverified").reason, reason);
});

test("v3 recovery verifies actual RGB/condition bytes, not source identity strings alone", t => {
  for (const field of ["image", "conditionPack"]) {
    const input = recoveryFixture(t);
    input.write(input.rows[0][field].path, Buffer.from("changed bytes"));
    const report = auditV3(input);
    assert.equal(report.recoveredEvaluationSources[0].acceptedEvaluationRecords, 0);
    assert.match(report.gaps.find(g => g.code === "evaluation_binding_unverified").reason, /SHA mismatch/);
  }
});

test("v3 recovery cannot bypass a present corrupt, mismatched or unsupported sibling Manifest", t => {
  for (const bytes of [Buffer.from("{"), { schemaVersion: "unsupported" },
    { schemaVersion: "project-owned-ai-assisted-cold-start-checkpoint-v7", conditionEvidencePath: evidencePath,
      conditionEvidenceSha256: "0".repeat(64) }]) {
    const input = recoveryFixture(t, () => {}, { keepManifest: true });
    input.write(`${dir}/manifest.json`, bytes);
    const report = auditV3(input);
    assert.equal(report.recoveredEvaluationSources[0].acceptedEvaluationRecords, 0);
    assert.equal(report.summary.evaluationSamples, 0);
    assert.ok(report.gaps.some(g => g.code === "evaluation_binding_unverified"));
  }
});

test("v3 recovery only handles ENOENT, never other sibling read failures", t => {
  const input = recoveryFixture(t), json = input.reader.json;
  input.reader.json = logical => {
    if (logical === `${dir}/manifest.json`) throw Object.assign(new Error("synthetic denied"), { code: "EACCES" });
    return json(logical);
  };
  const report = auditV3(input);
  assert.equal(report.recoveredEvaluationSources[0].acceptedEvaluationRecords, 0);
  assert.match(report.gaps.find(g => g.code === "evaluation_binding_unverified").reason, /synthetic denied/);
});

test("v3 recovery does not supply Manifest/config to optimizer or replay paths", t => {
  const input = recoveryFixture(t), telemetry = events();
  telemetry.events.push({ sequence: 3, step: replayKinds[0], status: "completed", epoch: 1, batch: 1,
    replayPass: 1, sampleId, classIdentity: "tree", selectionScore: 0.2, recordedAtUtc: "2026-09-01T01:00:00.003Z" });
  input.write(stepPath, telemetry);
  const report = auditV3(input);
  assert.equal(report.perSample[0].evaluationRuns, 1);
  assert.equal(report.perSample[0].totalRecordedOptimizerSteps, 0);
  assert.equal(report.replayOptimizerObservations.length, 0);
  assert.equal(report.replayAccounting.length, 0);
  assert.ok(report.gaps.some(g => g.code === "historical_usage_evidence_unverified"));
  assert.ok(report.gaps.some(g => g.code === "historical_replay_evidence_unverified"));
});

test("v3 recovered evaluation role difference stays evaluation, not data relabel or optimizer proof", t => {
  const input = recoveryFixture(t, (part, doc) => { if (part === "condition") doc.records[0].split = "regression"; });
  const report = auditV3(input);
  assert.equal(report.recoveredEvaluationSources[0].acceptedEvaluationRecords, 1);
  assert.equal(report.evaluationRoleDifferences.length, 1);
  assert.equal(report.evaluationRoleDifferences[0].splitRelabelProven, false);
  assert.equal(report.perSample[0].split, "validation");
  assert.equal(report.perSample[0].totalRecordedOptimizerSteps, 0);
});

test("v3 recovery reads only necessary provenance and has no filesystem side effects", t => {
  const input = recoveryFixture(t);
  const snapshot = () => fs.readdirSync(input.root, { recursive: true }).sort().filter(logical =>
    fs.statSync(path.join(input.root, logical)).isFile()).map(logical =>
    [logical, sha256(fs.readFileSync(path.join(input.root, logical)))]);
  const before = snapshot();
  auditV3(input); input.reader.verifyStable();
  assert.deepEqual(snapshot(), before);
  const allowed = new Set([...Object.values(input.recoveryBindings).map(b => b.path), stepPath,
    input.rows[0].image.path, input.rows[0].conditionPack.path]);
  assert.ok(input.reader.receipts().every(r => allowed.has(r.path)));
  assert.equal(fs.existsSync(path.join(input.root, dir, "manifest.json")), false);
});

for (const target of ["root", "sourceTerminal"]) test(`v3 recovery rechecks ${target} bytes after evidence processing`, t => {
  const input = recoveryFixture(t);
  const originalBytes = input.reader.bytes;
  let changed = false;
  input.reader.bytes = (logical, expected) => {
    const value = originalBytes(logical, expected);
    if (!changed && logical === stepPath) {
      changed = true;
      input.write(input.recoveryBindings[target].path, { changed: true });
    }
    return value;
  };
  assert.throws(() => auditV3(input), /SHA mismatch/);
});
