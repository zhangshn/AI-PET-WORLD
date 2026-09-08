import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { adjudicateStage4SplitData } from "../lib/ai-painter-stage4-split-data-adjudication.mjs";
import { createReader, sha256, auditHistoricalGeometry, foundationExposure, SPLIT_COUNTS } from "../lib/ai-painter-stage4-dataset-audit.mjs";
import { auditHistoricalExposure } from "../lib/ai-painter-stage4-historical-exposure.mjs";

const PROGRAMS = ["scripts/lib/ai-painter-stage4-split-data-adjudication.mjs", "scripts/lib/ai-painter-stage4-dataset-audit.mjs",
  "scripts/lib/ai-painter-stage4-historical-exposure.mjs", "scripts/lib/ai-painter-stage4-historical-geometry.mjs",
  "scripts/lib/complete-map-semantic-topology-signature.mjs"];
const LIBRARY = "data/world-samples/original-image-library/natural-home-v1/index.json";
const CAPABILITY = "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json";
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])]));
  return value;
}
const canonical = value => JSON.stringify(sorted(value));

function fixture({ mutateFoundation = () => {}, historicalRoleAndUnattributedRun = false, evaluationSplits = [],
  configureRegistry = () => {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-data-adjudication-")), files = new Set();
  function put(logical, value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(canonical(value) + "\n");
    const target = path.join(root, logical); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes); files.add(logical); return { path: logical, sha256: sha256(bytes) };
  }
  function read(logical) { return JSON.parse(fs.readFileSync(path.join(root, logical))); }
  function rewrite(binding, edit) { const value = read(binding.path); edit(value); return put(binding.path, value); }
  for (const file of PROGRAMS) put(file, fs.readFileSync(file));
  put(".runtime/ai-painter/current-execution-registry/current.json", { registryRevision: 7, activeExecution: null });
  const rows = [], history = [];
  for (const [split, count] of Object.entries(SPLIT_COUNTS)) for (let i = 0; i < count; i++) {
    const ordinal = rows.length + 1, id = `${split}-sample-${i}`, taskId = `task-${ordinal}`, worldId = `world-${ordinal}`;
    const image = put(`data/images/${id}.bin`, Buffer.from(`synthetic-pixel-fixture-${ordinal}`));
    const conditionPack = put(`data/packs/${id}.json`, { fixture: true, sampleId: id });
    const bp = put(`data/blueprints/${id}.json`, { schemaVersion: "ai-assisted-training-world-fact-blueprint-v1", taskId, worldId,
      canvas: { width: 256, height: 192 }, geometry: { hasWater: false,
        terrainRegions: [{ kind: "grass", polygon: [{ x: ordinal, y: 1 }, { x: ordinal + 1, y: 2 }, { x: ordinal + 2, y: 8 }] }],
        walkableRegions: [], collisionRegions: [], objectFootprints: [],
        entranceBounds: { x: ordinal, y: 1, width: 1, height: 1 }, focalBounds: null } });
    const task = put(`data/tasks/${id}.json`, { taskId, worldId,
      sourceBindings: { trainingBlueprintPath: bp.path, trainingBlueprintSha256: bp.sha256 } });
    const record = { recordId: id, categoryId: "complete-maps", conditionBinding: { taskId, taskPackagePath: task.path } };
    const sourceRecord = put(`data/records/${id}.json`, record); history.push(record);
    rows.push({ ordinal, sampleId: id, split, image, conditionPack, sourceRecord });
  }
  put(LIBRARY, { records: history });
  const parent = put("data/parent.json", { samples: rows });
  const sourceIndex = put("data/source-index.json", { sampleCount: 64, samples: rows });
  const splits = Object.fromEntries(Object.keys(SPLIT_COUNTS).map(split => [split, put(`data/splits/${split}.json`,
    { split, sampleIds: rows.filter(r => r.split === split).map(r => r.sampleId) })]));
  const identityPayload = { parentRelease: parent, selectionReproductionSha256: sha256(Buffer.from(canonical(rows))),
    artifactHashes: Object.fromEntries([["source-index.json", sourceIndex.sha256], ...Object.entries(splits).map(([s, b]) => [`splits/${s}.json`, b.sha256])]) };
  const manifestBinding = put("data/manifest.json", { schemaVersion: "ai-painter-stage4-v2-independent-split-package-v1",
    datasetReleaseIdentity: `stage4-v2-split64-${sha256(Buffer.from(canonical(identityPayload)))}`,
    sampleCount: 64, splitCounts: SPLIT_COUNTS, sourceIndex, splits, identityPayload });
  const checkpoint = put("data/foundation.pt", Buffer.from("raw-test-bytes-never-deserialized"));
  const foundationImage = put("data/foundation-image.bin", Buffer.from("different-synthetic-pixel-fixture"));
  const foundationSource = put("data/foundation-source.json", { samples: [{ sampleId: "foundation", split: "train",
    imagePath: foundationImage.path, imageSha256: foundationImage.sha256 }] });
  const foundationDataset = put("data/foundation-dataset.json", { packageId: "foundation-dataset", sourceIndexPath: foundationSource.path });
  const sourceManifest = put("data/foundation-manifest.json", { checkpointPath: checkpoint.path, checkpointSha256: checkpoint.sha256,
    datasetManifestPath: foundationDataset.path, datasetManifestSha256: foundationDataset.sha256, datasetPackageId: "foundation-dataset",
    initialization: "random_initialization_only", trainingStage: "autoencoder_warmup_only" });
  const foundation = {
    schemaVersion: "ai-painter-stage4-v2-project-foundation-autoencoder-lineage-contract-v1",
    assetIdentity: "fixture-frozen-autoencoder",
    assetRole: "project_owned_cross_candidate_frozen_foundation_capability",
    checkpoint: { ...checkpoint, bytes: Buffer.byteLength("raw-test-bytes-never-deserialized") }, sourceManifest,
    consumerBoundary: { allowedRole: "frozen_autoencoder_foundation_dependency_only" },
    lineageInterpretation: { projectOwned: true, crossCandidateFoundation: true, failedDenoiserCheckpoint: false,
      denoiserWeightsMayBeLoaded: false, parentCheckpointMayBeLoaded: false,
      sourceManifestRemainingBlockersInherited: false, sourceManifestGovernanceFieldsInherited: false,
      sourceManifestRole: "immutable_asset_provenance_only" },
  };
  mutateFoundation(foundation);
  const foundationBinding = put("data/foundation.json", foundation);
  put(CAPABILITY, { datasetBinding: parent, foundationAssetBinding: { ...foundationBinding,
    identity: "fixture-frozen-autoencoder", role: "project_owned_cross_candidate_frozen_foundation_capability" } });
  const historicalEntries = [];
  if (evaluationSplits.length) {
    const run = ".runtime/ai-painter/fixture-split-evaluation/training-output";
    const records = evaluationSplits.map(split => rows.find(row => row.split === split));
    const historicalSource = put("data/historical-evaluation-source.json", { samples: records.map(row => ({
      sampleId: row.sampleId, split: row.split, imagePath: row.image.path, imageSha256: row.image.sha256,
      conditionPackPath: row.conditionPack.path })) });
    const condition = put(`${run}/condition-evidence.json`, {
      schemaVersion: "ai-assisted-conditional-denoiser-evidence-v4", records: records.map(row => ({
        sampleId: row.sampleId, split: row.split, conditionPackPath: row.conditionPack.path, velocityPredictionLoss: 1 })) });
    put(`${run}/manifest.json`, { schemaVersion: "project-owned-ai-assisted-cold-start-checkpoint-v7",
      checkpointPath: `${run}/checkpoint.pt`, sourceIndexPath: historicalSource.path, sourceIndexSha256: historicalSource.sha256,
      conditionEvidencePath: condition.path, conditionEvidenceSha256: condition.sha256 });
    historicalEntries.push({ path: condition.path, onDisk: true, catalogSha256: null, catalogBytes: null });
  }
  if (historicalRoleAndUnattributedRun) {
    const row = rows[0], run = ".runtime/ai-painter/fixture-history/training-output";
    const historicalSource = put("data/historical-source.json", { samples: [{ sampleId: row.sampleId, split: row.split,
      imagePath: row.image.path, imageSha256: row.image.sha256, conditionPackPath: row.conditionPack.path }] });
    const condition = put(`${run}/condition-evidence.json`, {
      schemaVersion: "ai-assisted-conditional-denoiser-evidence-v4", records: [{ sampleId: row.sampleId,
        split: "regression", conditionPackPath: row.conditionPack.path, velocityPredictionLoss: 1 }] });
    const telemetry = put(`${run}/stage4-step-telemetry.json`, {
      schemaVersion: "stage4-bounded-repair-smoke-step-telemetry-v1", sampleId: null,
      events: [
        { sequence: 1, step: "optimizer_step", status: "started", epoch: 1, batch: 1, recordedAtUtc: "2026-09-01T01:00:00.001Z" },
        { sequence: 2, step: "optimizer_step", status: "completed", epoch: 1, batch: 1, recordedAtUtc: "2026-09-01T01:00:00.002Z" },
      ],
    });
    put(`${run}/manifest.json`, { schemaVersion: "project-owned-ai-assisted-cold-start-checkpoint-v7",
      checkpointPath: `${run}/checkpoint.pt`, sourceIndexPath: historicalSource.path, sourceIndexSha256: historicalSource.sha256,
      conditionEvidencePath: condition.path, conditionEvidenceSha256: condition.sha256,
      trainingTokenAccounting: { runTotals: { optimizerSteps: 1 } } });
    for (const b of [condition, telemetry]) historicalEntries.push({ path: b.path, onDisk: true, catalogSha256: null, catalogBytes: null });
  }
  configureRegistry({ put, read });
  const reader = createReader(root);
  for (const file of files) reader.bytes(file);
  const selected = rows.map(row => ({ ...row, recordId: row.sampleId })).reverse();
  const geometryAudit = auditHistoricalGeometry({ reader, history, selected });
  const foundationAudit = foundationExposure(reader, foundation, rows);
  const exposure = auditHistoricalExposure({ root, reader, rows,
    inventory: { entries: historicalEntries, provesAllRunsInventoried: false, coversOtherTrainingFormats: false } });
  const baselineBinding = put(".runtime/baseline.json", {
    schemaVersion: "ai-painter-stage4-split-risk-audit-v1", status: "bounded_data_audit_completed_training_unqualified",
    datasetManifest: manifestBinding, summary: { historicalLibraryRecords: 64 },
    imageAudit: { selfReferences: selected.map(r => ({ sampleId: r.sampleId, recordId: r.recordId })) },
    foundationAudit, qualification: { trainingAllowed: false }, inputReceipts: reader.receipts(),
  });
  const geometryBinding = put(".runtime/geometry.json", { schemaVersion: "ai-painter-stage4-historical-geometry-replay-v1",
    status: "bounded_geometry_replay_completed_training_unqualified", baseline: baselineBinding,
    geometryAudit, qualification: geometryAudit.qualification, inputReceipts: reader.receipts() });
  const exposureBinding = put(".runtime/exposure.json", { ...exposure, datasetManifest: manifestBinding,
    qualification: { trainingAllowed: false }, inputReceipts: reader.receipts() });
  const args = { root, manifestBinding, baselineBinding, geometryBinding, exposureBinding };
  return { root, files, args, put, read, rewrite, run: extra => adjudicateStage4SplitData({ ...args, ...extra }),
    close: () => {
      const absolute = fs.realpathSync(root), temp = fs.realpathSync(os.tmpdir());
      assert.equal(path.dirname(absolute), temp); assert.ok(path.basename(absolute).startsWith("stage4-data-adjudication-"));
      fs.rmSync(absolute, { recursive: true, force: true });
    } };
}
function withFixture(fn, options) { const f = fixture(options); try { fn(f); } finally { f.close(); } }
function rejected(report, pattern) {
  assert.equal(report.status, "unknown_or_stale"); assert.equal(report.trainingAllowed, false);
  assert.match(report.blockers.at(-1).details.reason, pattern);
}

test("real-file diagnostic evidence yields bounded rejection, not permission; library order is not Dataset order", () => withFixture(f => {
  const before = [...f.files].map(p => [p, sha256(fs.readFileSync(path.join(f.root, p)))]);
  const r = f.run(); assert.equal(r.status, "blocked_data_qualification");
  assert.equal(r.findings.historicalGeometry.declaredGeometryChecked, 64);
  assert.equal(r.findings.uniqueFoundationBindingGaps, 1);
  for (const code of ["independent_holdout_qualification_missing", "full_history_non_exact_novelty_qualification_missing",
    "all_run_and_checkpoint_selection_coverage_unqualified", "foundation_historical_binding_incomplete"])
    assert.ok(r.blockers.some(b => b.code === code));
  assert.equal(r.trainingAllowed, false); assert.equal(r.currentRegistryModified, false);
  assert.equal(r.automaticSampleRelabellingAllowed, false);
  assert.deepEqual([...f.files].map(p => [p, sha256(fs.readFileSync(path.join(f.root, p)))]), before);
}));

test("missing historical bindings do not become missing models or an automatic retraining decision", () => withFixture(f => {
  const r = f.run(), assessment = r.findings.foundationAssessment;
  assert.equal(assessment.currentAssetIntegrity, "bound_checkpoint_and_source_manifest_bytes_verified");
  assert.equal(assessment.declaredReuseRole, "frozen_autoencoder_foundation_dependency_only");
  assert.equal(assessment.historicalIsolation, "not_qualified");
  assert.equal(assessment.exactCurrentSampleOverlapCount, 0);
  assert.equal(assessment.zeroExactOverlapProvesIndependentHoldout, false);
  assert.equal(assessment.retrainingDecision, "not_established_by_this_evidence");
  for (const key of ["checkpointDeserialized", "runtimeLoadProven", "runtimeFreezeProven",
    "optimizerExclusionProven", "assetReplacementSelected", "trainingAllowed"]) assert.equal(assessment[key], false);
  const gap = assessment.historicalBindingGaps[0];
  assert.equal(gap.filePresentNow, true); assert.equal(gap.currentReceiptEstablishesHistoricalBinding, false);
  assert.equal(gap.currentReceipt.sha256, sha256(fs.readFileSync(path.join(f.root, gap.path))));
  const blocker = r.blockers.find(b => b.code === "foundation_historical_binding_incomplete");
  assert.equal(blocker.scope, "independent_evaluation");
  assert.equal(blocker.details.affectedClaim, "foundation_training_history_and_holdout_isolation");
  assert.equal(r.trainingAllowed, false);
}));

test("evaluation is separated by split role and is not itself optimizer misuse or selection proof", () => withFixture(f => {
  const r = f.run(); assert.equal(r.status, "blocked_data_qualification");
  const details = r.blockers.find(b => b.code === "independent_holdout_qualification_missing").details;
  assert.equal(details.aggregateScope, "evaluation_observation_only_not_violation_or_current_candidate_inheritance");
  assert.equal(details.missingClaim, "challenge_unseen_and_per_split_selection_path_qualification");
  assert.equal(details.evaluationObservedSampleIds.length, 4);
  assert.equal(details.splitAssessment.length, 4);
  for (const row of details.splitAssessment) {
    assert.deepEqual(row.observedEvaluationSampleIds, [`${row.split}-sample-0`]);
    assert.deepEqual(row.observedOptimizerSampleIds, []);
    assert.equal(row.evaluationObservationAloneProvesViolation, false);
    assert.equal(row.selectionPathVerified, false);
  }
  assert.equal(details.splitAssessment.find(r => r.split === "validation").intendedRole,
    "metrics_and_checkpoint_selection_without_optimizer_updates");
  assert.equal(r.findings.nonTrainOptimizerExposure.length, 0);
  assert.equal(r.findings.historicalUseAssessment.currentCandidateWeightInheritanceProven, false);
  assert.equal(r.trainingAllowed, false);
}, { evaluationSplits: ["train", "validation", "challenge", "regression"] }));

test("no recorded evaluation never qualifies unseen challenge data", () => withFixture(f => {
  const r = f.run(), details = r.blockers.find(b => b.code === "independent_holdout_qualification_missing").details;
  assert.equal(details.absenceOfRecordedUseIsNotProofOfUnseen, true);
  assert.deepEqual(details.splitAssessment.find(r => r.split === "challenge").observedEvaluationSampleIds, []);
  assert.equal(r.trainingAllowed, false);
}));

test("current adjudication replays v1 exactly but uses current role and unattributed-event semantics", () => withFixture(f => {
  const before = fs.readFileSync(path.join(f.root, f.args.exposureBinding.path));
  const r = f.run(); assert.equal(r.status, "blocked_data_qualification");
  assert.equal(r.findings.legacyHistoricalUse.unverifiedItems, 2);
  const current = r.findings.historicalUseAssessment;
  assert.equal(current.schemaVersion, "ai-painter-stage4-historical-exposure-audit-v3");
  assert.equal(current.evaluationRoleDifferences.length, 1);
  assert.equal(current.runLevelOptimizerObservations.length, 1);
  assert.equal(current.gaps.some(g => g.code === "historical_evaluation_split_relabelled"), false);
  assert.ok(current.gaps.some(g => g.code === "historical_optimizer_sample_attribution_missing"));
  assert.equal(r.findings.historicalUse.unverifiedItems, 1);
  assert.equal(r.findings.historicalUse.recordedOptimizerSamples, 0);
  assert.equal(r.findings.nonTrainOptimizerExposure.length, 0);
  assert.equal(current.currentCandidateWeightInheritanceProven, false);
  assert.equal(r.trainingAllowed, false);
  assert.deepEqual(fs.readFileSync(path.join(f.root, f.args.exposureBinding.path)), before);
}, { historicalRoleAndUnattributedRun: true }));

for (const [label, mutateFoundation, message] of [
  ["identity", c => { c.assetIdentity = "unrelated-model"; }, /foundation_asset_identity_conflict/u],
  ["asset role", c => { c.assetRole = "failed_denoiser"; }, /foundation_asset_role_conflict/u],
  ["consumer role", c => { c.consumerBoundary.allowedRole = "denoiser_initialization"; }, /foundation_consumer_role_conflict/u],
  ["parent loading", c => { c.lineageInterpretation.parentCheckpointMayBeLoaded = true; }, /foundation_lineage_role_conflict/u],
  ["inherited blockers", c => { c.lineageInterpretation.sourceManifestRemainingBlockersInherited = true; }, /foundation_lineage_role_conflict/u],
  ["size", c => { c.checkpoint.bytes += 1; }, /foundation_checkpoint_size_conflict/u],
]) test(`foundation ${label} conflict cannot masquerade as only a historical isolation gap`, () =>
  withFixture(f => rejected(f.run(), message), { mutateFoundation }));

test("missing foundation source file remains an integrity failure, not merely a historical binding gap", () => withFixture(f => {
  fs.unlinkSync(path.join(f.root, "data/foundation-source.json"));
  rejected(f.run(), /ENOENT/u);
}));

test("changed foundation weight bytes remain an integrity failure without deserialization", () => withFixture(f => {
  fs.appendFileSync(path.join(f.root, "data/foundation.pt"), "changed");
  rejected(f.run(), /SHA mismatch/u);
}));

test("mid-read foundation replacement cannot leave an apparently verified asset assessment", () => withFixture(f => {
  const report = f.run({ progress: phase => {
    if (phase === "data_adjudication_before_final_input_recheck") fs.appendFileSync(path.join(f.root, "data/foundation.pt"), "changed");
  } });
  rejected(report, /SHA mismatch/u); assert.equal(report.findings, null);
}));

for (const name of ["manifestBinding", "baselineBinding", "geometryBinding", "exposureBinding"])
  test(`changed ${name} bytes cannot be consumed under an old hash`, () => withFixture(f => {
    fs.appendFileSync(path.join(f.root, f.args[name].path), " "); rejected(f.run(), /SHA mismatch/u);
  }));

test("a new SHA on a forged training-approved diagnostic does not grant qualification", () => withFixture(f => {
  f.args.exposureBinding = f.rewrite(f.args.exposureBinding, r => { r.qualification.trainingAllowed = true; });
  rejected(f.run(), /diagnostic_report_cannot_grant_training/u);
}));
test("forged per-sample use statistics are recomputed from actual evidence", () => withFixture(f => {
  f.args.exposureBinding = f.rewrite(f.args.exposureBinding, r => { r.perSample[0].recordedOptimizerRuns = 12; });
  rejected(f.run(), /exposure_evidence_does_not_reproduce:perSample/u);
}));
test("forged geometry summaries are recomputed from declared geometry", () => withFixture(f => {
  f.args.geometryBinding = f.rewrite(f.args.geometryBinding, r => { r.geometryAudit.summary.polygonOnlyRecords = 0; });
  rejected(f.run(), /geometry_evidence_does_not_reproduce/u);
}));
test("reports from another manifest or baseline cannot be mixed", () => withFixture(f => {
  f.args.exposureBinding = f.rewrite(f.args.exposureBinding, r => { r.datasetManifest.sha256 = "0".repeat(64); });
  rejected(f.run(), /exposure_dataset_binding_conflict/u);
  f.args.geometryBinding = f.rewrite(f.args.geometryBinding, r => { r.baseline.sha256 = "1".repeat(64); });
  rejected(f.run(), /exposure_dataset_binding_conflict|geometry_baseline_binding_conflict/u);
}));
test("data change after historical audit requires new evidence", () => withFixture(f => {
  fs.appendFileSync(path.join(f.root, "data/images/train-sample-0.bin"), "different"); rejected(f.run(), /SHA mismatch/u);
}));
test("duplicate or missing historical selection identities cannot hide behind ordering compatibility", () => withFixture(f => {
  f.args.baselineBinding = f.rewrite(f.args.baselineBinding, r => { r.imageAudit.selfReferences[0] = r.imageAudit.selfReferences[1]; });
  f.args.geometryBinding = f.rewrite(f.args.geometryBinding, r => { r.baseline = f.args.baselineBinding; });
  rejected(f.run(), /baseline_selected_records_conflict/u);
}));
test("old program drift remains explicit historical evidence, never new qualification", () => withFixture(f => {
  fs.appendFileSync(path.join(f.root, PROGRAMS[1]), "\n// later reader implementation\n");
  const r = f.run(); assert.equal(r.status, "blocked_data_qualification");
  assert.ok(r.historicalProgramBindings.some(b => !b.matchesCurrentBytes)); assert.equal(r.trainingAllowed, false);
}));
test("mid-read data mutation invalidates the final gate", () => withFixture(f => {
  const r = f.run({ progress: phase => {
    if (phase === "data_adjudication_before_final_input_recheck") fs.appendFileSync(path.join(f.root, "data/images/train-sample-0.bin"), "changed");
  } }); rejected(r, /SHA mismatch/u);
}));
test("missing binding and latest traversal are rejected, not guessed", () => withFixture(f => {
  rejected(f.run({ exposureBinding: undefined }), /missing SHA binding/u);
  rejected(f.run({ exposureBinding: { path: ".runtime/latest/exposure.json", sha256: "0".repeat(64) } }), /invalid explicit audit path/u);
}));
test("active execution is not overlapped even when evidence is otherwise reproducible", () => withFixture(f => {
  // This changes a bound receipt: either the snapshot or active-execution check rejects it.
  f.put(".runtime/ai-painter/current-execution-registry/current.json", { registryRevision: 8, activeExecution: { runId: "running" } });
  rejected(f.run(), /SHA mismatch|overlaps_active_execution/u);
}));

const RECOVERY_SCHEMA = "ai-painter-joint-full-data-screen-post-checkpoint-recovery-registry-terminal-v1";
function configureRecoveryRegistry(edit = () => {}) {
  return ({ put }) => {
    const manifest = put(".runtime/recovery/manifest.json", { fixture: true });
    const recoveredTrainingEvidence = put(".runtime/recovery/trainer.json", { fixture: true });
    const recoveryTerminal = put(".runtime/recovery/phase-terminal.json", { manifest, recoveredTrainingEvidence });
    const projection = { schemaVersion: RECOVERY_SCHEMA, runId: "fixture-run", status: "full_data_screen_real_visual_failure", recoveryTerminal };
    const latest = { ...put(".runtime/recovery/registry-terminal-projection.json", projection),
      runId: projection.runId, status: projection.status, evidence: { recoveryTerminal, manifest, recoveredTrainingEvidence } };
    edit({ put, latest, projection });
    put(".runtime/ai-painter/current-execution-registry/current.json", { registryRevision: 7, activeExecution: null,
      latestTrainingTerminal: latest });
  };
}

for (const [label, edit, reason] of [
  ["SHA", ({ latest }) => { latest.sha256 = "0".repeat(64); }, /SHA mismatch/u],
  ["run identity", ({ latest }) => { latest.runId = "different-run"; }, /registry_recovery_run_identity_conflict/u],
  ["status", ({ latest }) => { latest.status = "passed"; }, /registry_recovery_status_conflict/u],
  ["terminal", ({ latest }) => { latest.evidence.recoveryTerminal.sha256 = "1".repeat(64); }, /registry_recovery_terminal_binding_conflict/u],
  ["manifest", ({ latest }) => { latest.evidence.manifest.sha256 = "1".repeat(64); }, /registry_recovery_manifest_binding_conflict/u],
  ["trainer", ({ latest }) => { latest.evidence.recoveredTrainingEvidence.sha256 = "1".repeat(64); }, /registry_recovery_recoveredTrainingEvidence_binding_conflict/u],
  ["schema", ({ put, latest, projection }) => {
    Object.assign(latest, put(latest.path, { ...projection, schemaVersion: "unrelated-terminal-v1" }));
  }, /registry_recovery_projection_schema_conflict/u],
]) test(`registry recovery ${label} conflict cannot supply historical evaluation evidence`, () =>
  withFixture(f => rejected(f.run(), reason), { configureRegistry: configureRecoveryRegistry(edit) }));

test("matching registry cross-bindings still require the recovery reader's full provenance checks", () =>
  withFixture(f => rejected(f.run(), /invalid explicit recovery binding/u),
    { configureRegistry: configureRecoveryRegistry() }));

test("an unrelated bound terminal is not silently treated as a recovered manifest", () => withFixture(f => {
  const r = f.run(); assert.equal(r.status, "blocked_data_qualification");
  assert.deepEqual(r.findings.historicalUseAssessment.recoveredEvaluationSources, []);
  assert.equal(r.trainingAllowed, false);
}, { configureRegistry: ({ put }) => {
  const terminal = put(".runtime/unrelated-terminal.json", { schemaVersion: "unrelated-terminal-v1" });
  put(".runtime/ai-painter/current-execution-registry/current.json", { registryRevision: 7, activeExecution: null,
    latestTrainingTerminal: { ...terminal, runId: "unrelated" } });
} }));

test("adjudication CLI requires all explicit evidence pairs and rejects mixed modes", () => {
  for (const args of [
    ["--adjudicate-data"],
    ["--adjudicate-data", "--exposure-only"],
    ["--risk-report", ".runtime/risk.json"],
    ["--adjudicate-data", "--manifest", "data/manifest.json", "--sha256", "0".repeat(64)],
  ]) {
    const result = spawnSync(process.execPath, ["scripts/audit-ai-painter-stage4-split-release.mjs", ...args],
      { encoding: "utf8", windowsHide: true, timeout: 10000 });
    assert.equal(result.status, 1); assert.match(result.stderr, /required|require|cannot be mixed/u);
  }
});

test("a completed but unqualified CLI preflight exits 2, never the successful-command exit code", () => withFixture(f => {
  const b = f.args;
  const result = spawnSync(process.execPath, [path.resolve("scripts/audit-ai-painter-stage4-split-release.mjs"), "--adjudicate-data",
    "--manifest", b.manifestBinding.path, "--sha256", b.manifestBinding.sha256,
    "--risk-report", b.baselineBinding.path, "--risk-sha256", b.baselineBinding.sha256,
    "--geometry-report", b.geometryBinding.path, "--geometry-sha256", b.geometryBinding.sha256,
    "--exposure-report", b.exposureBinding.path, "--exposure-sha256", b.exposureBinding.sha256],
  { cwd: f.root, encoding: "utf8", windowsHide: true, timeout: 15000 });
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "blocked_data_qualification");
  assert.equal(report.qualification.trainingAllowed, false); assert.equal(report.evidence, null);
}));
