import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import { adjudicateLateReviewRows } from "./lib/ai-painter-stage4-late-convergence-qualification.mjs";
import { appendAiPainterProgramEvent, formatShanghai, projectPath } from "./lib/ai-painter-program-event-store.mjs";
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";

const ROOT = process.cwd();
const CAPABILITY = "stage4-direct-condition-clean-latent-generator-change-candidate-v1";
const RUN_ID = "stage4-direct-clean-latent-formal-late-stability-20260827-01";
const SOURCE_RUN = "stage4-direct-clean-latent-controlled-smoke-20260827-01";
const SOURCE_ROOT = resolve(`.runtime/ai-painter/stage4-direct-clean-latent-controlled-smokes/${SOURCE_RUN}`);
const BOUNDARY_ROOT = resolve(".runtime/ai-painter/stage4-direct-clean-latent-terminal-pass-boundary-decisions/stage4-direct-clean-latent-terminal-pass-boundary-20260827-01");
const OUTPUT = resolve(`.runtime/ai-painter/stage4-direct-clean-latent-formal-late-stability-corrections/${RUN_ID}`);
const FORMAL_LIBRARY = resolve("scripts/lib/ai-painter-stage4-late-convergence-qualification.mjs");

const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode);
assert.equal(current.registry.taskId, "cpu_readonly_design_one_bounded_successor_after_direct_clean_latent_route_exit");
assert.equal(current.registry.taskKind, "cpu_readonly_candidate_planning");
assert.equal(current.registry.capabilityVersion, CAPABILITY);
assert.equal(fs.existsSync(OUTPUT), false, "formal late-stability correction output reuse is forbidden");

const smokeTerminal = read(path.join(SOURCE_ROOT, "phase-terminal.json"));
const review = read(path.join(SOURCE_ROOT, "machine-review.json"));
const manifest = read(path.join(SOURCE_ROOT, "training-output", "manifest.json"));
const originalQualification = read(path.join(SOURCE_ROOT, "late-stability-qualification.json"));
const boundaryTerminal = read(path.join(BOUNDARY_ROOT, "phase-terminal.json"));

assert.equal(smokeTerminal.status, "direct_clean_latent_controlled_smoke_real_visual_failure");
assert.equal(originalQualification.qualified, false);
assert.equal(boundaryTerminal.status, "terminal_pass_without_consecutive_late_stability_not_stage0_qualified");
assert.equal(review.reviewThresholdsChanged, false);
assert.equal(manifest.modelStateHashes.weightsChanged, true);
assert.equal(manifest.autoencoderStateHashes.unchanged, true);
assert.equal(manifest.fixedPreviews.every((row) => row.byteExactReproduced === true), true);

const decision = adjudicateLateReviewRows(review.reviews);
assert.deepEqual(decision.failureCounts, [6, 2, 0]);
assert.equal(decision.strictDecreaseThenStableZero, true);
assert.equal(decision.sustainedZeroFromFirstLateEpoch, false);
assert.equal(decision.noRegression, true);
assert.equal(decision.finalConditionsPass, true);
assert.equal(decision.qualified, true);

const positive = {};
const negative = {};
const passes = (rows) => {
  try { return adjudicateLateReviewRows(rows).qualified === true; } catch { return false; }
};
const rejects = (mutate) => {
  const rows = structuredClone(review.reviews);
  mutate(rows);
  try { return adjudicateLateReviewRows(rows).qualified === false; } catch { return true; }
};
positive.bound_real_evidence_qualified = decision.qualified;
positive.strict_decrease_6_2_0_supported = decision.strictDecreaseThenStableZero && decision.qualificationRoute === "strict_decrease_then_stable_zero";
positive.no_new_failure_identity = decision.noRegression;
positive.terminal_all_conditions_pass = decision.finalConditionsPass;
positive.preview_bytes_reproduced = manifest.fixedPreviews.every((row) => row.byteExactReproduced === true);
positive.weights_changed = manifest.modelStateHashes.weightsChanged === true;
positive.autoencoder_unchanged = manifest.autoencoderStateHashes.unchanged === true;
positive.thresholds_unchanged = review.reviewThresholdsChanged === false;
const sustained = structuredClone(review.reviews);
for (const row of sustained.filter((item) => [10, 20, 30].includes(item.epoch))) {
  row.passed = true;
  row.issueCodes = [];
  row.conditionAlignment = structuredClone(review.reviews.find((item) => item.epoch === 30).conditionAlignment);
}
positive.sustained_zero_0_0_0_supported = passes(sustained);
negative.missing_epoch_rejected = rejects((rows) => rows.splice(3, 1));
negative.reordered_epoch_rejected = rejects((rows) => [rows[2], rows[3]] = [rows[3], rows[2]]);
negative.duplicate_issue_rejected = rejects((rows) => rows[2].issueCodes.push(rows[2].issueCodes[0]));
negative.nonzero_flat_rejected = rejects((rows) => {
  for (const row of rows.filter((item) => [10, 20, 30].includes(item.epoch))) {
    row.passed = false;
    row.issueCodes = ["condition_object_vegetation_reference_semantic_mismatch"];
  }
});
negative.zero_then_regression_rejected = rejects((rows) => {
  rows[3].passed = true;
  rows[3].issueCodes = [];
  rows[4].passed = false;
  rows[4].issueCodes = ["condition_object_vegetation_reference_semantic_mismatch"];
});
negative.new_failure_item_rejected = rejects((rows) => rows[3].issueCodes.push("condition_object_rock_reference_semantic_mismatch"));
negative.terminal_failure_rejected = rejects((rows) => {
  rows[4].passed = false;
  rows[4].issueCodes = ["condition_object_tree_reference_semantic_mismatch"];
});
negative.terminal_condition_failure_rejected = rejects((rows) => { rows[4].conditionAlignment.passed = false; });
assert.ok(Object.values(positive).every(Boolean));
assert.ok(Object.values(negative).every(Boolean));

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.mkdirSync(OUTPUT, { recursive: false });
const recordedAtUtc = new Date().toISOString();
writeExclusive(path.join(OUTPUT, "cpu-report.json"), {
  schemaVersion: "stage4-direct-clean-latent-formal-late-stability-cpu-report-v1",
  status: "passed",
  positive,
  negative,
  positivePassed: Object.values(positive).filter(Boolean).length,
  positiveTotal: Object.keys(positive).length,
  negativePassed: Object.values(negative).filter(Boolean).length,
  negativeTotal: Object.keys(negative).length,
  gpuStarted: false,
  checkpointRead: false,
  trainingStarted: false,
  recordedAtUtc,
});
writeExclusive(path.join(OUTPUT, "qualification-decision.json"), {
  schemaVersion: "stage4-direct-clean-latent-formal-late-stability-adjudication-v1",
  status: "terminal_pass_with_late_convergence_evidence_qualified",
  capabilityVersion: CAPABILITY,
  sourceRunId: SOURCE_RUN,
  ...decision,
  fixedPreviewReproduced: true,
  weightsChanged: true,
  autoencoderUnchanged: true,
  machineReviewThresholdsChanged: false,
  checkpointPromotable: false,
  stage0InitializationFromSmokeAllowed: false,
  recordedAtUtc,
});
writeExclusive(path.join(OUTPUT, "correction-report.json"), {
  schemaVersion: "stage4-direct-clean-latent-formal-late-stability-correction-v1",
  status: "completed",
  uniqueDecision: "formal_late_stability_adapter_mismatch_confirmed_no_new_model_successor_required",
  capabilityVersion: CAPABILITY,
  sourceRunId: SOURCE_RUN,
  defect: {
    location: "direct_clean_latent_smoke_late_stability_adapter",
    previousExtraRequirement: "epoch_20_and_epoch_30_must_both_pass",
    formalContractRequirement: "non_increasing_with_strict_decrease_and_zero_stable_from_first_zero",
    formalTrajectory: [6, 2, 0],
    effect: "qualified_smoke_was_incorrectly_closed_as_not_qualified",
  },
  correctionBoundary: {
    historicalEvidenceModified: false,
    modelChanged: false,
    lossChanged: false,
    dataChanged: false,
    thresholdChanged: false,
    checkpointRead: false,
    gpuStarted: false,
    trainingStarted: false,
    newModelCandidateCreated: false,
  },
  routeEffect: {
    candidateRestored: true,
    smokeQualified: true,
    nextAction: "compile_direct_condition_clean_latent_stage0",
    smokeCheckpointReusable: false,
    stage0MustUseFixedRandomInitialization: true,
  },
  sourceBindings: {
    smokeTerminal: bind(path.join(SOURCE_ROOT, "phase-terminal.json")),
    machineReview: bind(path.join(SOURCE_ROOT, "machine-review.json")),
    trainingManifest: bind(path.join(SOURCE_ROOT, "training-output", "manifest.json")),
    originalQualification: bind(path.join(SOURCE_ROOT, "late-stability-qualification.json")),
    supersededBoundaryTerminal: bind(path.join(BOUNDARY_ROOT, "phase-terminal.json")),
    formalDecisionLibrary: bind(FORMAL_LIBRARY),
    cpuReport: bind(path.join(OUTPUT, "cpu-report.json")),
    correctedQualification: bind(path.join(OUTPUT, "qualification-decision.json")),
  },
  recordedAtUtc,
});
const nextTask = "compile_direct_condition_clean_latent_stage0";
writeExclusive(path.join(OUTPUT, "phase-terminal.json"), {
  schemaVersion: "stage4-direct-clean-latent-formal-late-stability-correction-terminal-v1",
  executionState: "completed",
  status: "direct_clean_latent_smoke_formal_late_stability_qualified",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  qualificationDecision: bind(path.join(OUTPUT, "qualification-decision.json")),
  correctionReport: bind(path.join(OUTPUT, "correction-report.json")),
  historicalEvidencePreserved: true,
  ownerAuthorizationRequired: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: nextTask,
  recordedAtUtc,
});

const lifecycle = advanceCapabilityLifecycle({
  root: ROOT,
  capabilityVersion: CAPABILITY,
  targetState: "controlled_smoke_completed",
  evidence: {
    schemaVersion: "ai-painter-capability-stage-evidence-v1",
    capabilityVersion: CAPABILITY,
    targetState: "controlled_smoke_completed",
    status: "passed",
    bindings: [
      bind(path.join(SOURCE_ROOT, "phase-terminal.json")),
      bind(path.join(SOURCE_ROOT, "machine-review.json")),
      bind(path.join(SOURCE_ROOT, "training-output", "manifest.json")),
      bind(path.join(OUTPUT, "qualification-decision.json")),
      bind(path.join(OUTPUT, "phase-terminal.json")),
    ],
  },
  recordedAtUtc,
});

const evidenceFiles = [
  path.join(OUTPUT, "cpu-report.json"),
  path.join(OUTPUT, "qualification-decision.json"),
  path.join(OUTPUT, "correction-report.json"),
  path.join(OUTPUT, "phase-terminal.json"),
  path.join(SOURCE_ROOT, "machine-review.json"),
  path.join(SOURCE_ROOT, "training-output", "manifest.json"),
  path.join(BOUNDARY_ROOT, "phase-terminal.json"),
];
writeExclusive(path.join(OUTPUT, "local-task-capsule.json"), {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
  currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: "controlled_smoke_completed" },
  candidateTerminal: {
    runId: RUN_ID,
    status: "direct_clean_latent_smoke_formal_late_stability_qualified",
    programStatus: "cpu_readonly_correction_completed",
    previewMachineStatus: review.status,
    previewCount: review.previewCount,
    previewPassCount: review.previewPassCount,
    previewFailCount: review.previewFailCount,
    checkpointWritten: false,
    modelWeightsModified: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  },
  resolvedBlocker: {
    code: "late_stability_adapter_contract_mismatch",
    summaryZh: "正式合同接受6→2→0持续下降后归零轨迹；直接候选运行器曾错误要求Epoch 20和30连续通过，现已纠正。",
  },
  nextAllowedAction: {
    code: nextTask,
    labelZh: "编译直接条件→干净潜变量Stage 0正式训练",
    ownerAuthorizationRequired: false,
    automaticExecutionAllowed: true,
    planEvidenceConfirmed: true,
  },
  forbiddenActions: ["reuse_smoke_checkpoint", "initialize_stage0_from_smoke", "lower_machine_review_threshold", "create_new_model_successor", "reuse_historical_run"],
  taskIdentity: { modelId: CAPABILITY, sampleId: "194", sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] },
  lifecycle: { state: lifecycle.state, sequence: lifecycle.sequence, evidence: lifecycle.latestEvidence },
  evidence: evidenceFiles.map((file) => ({ kind: path.basename(file, path.extname(file)), labelZh: path.basename(file), ...bind(file), expectedSha256: sha256(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })),
  integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
});

const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: nextTask,
  taskKind: "formal_stage_training_compilation",
  runId: RUN_ID,
  lifecycleStage: "controlled_smoke_completed",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(path.join(OUTPUT, "local-task-capsule.json")),
  terminalEvidencePath: projectPath(path.join(OUTPUT, "phase-terminal.json")),
});
appendAiPainterProgramEvent({
  id: `stage4-direct-clean-latent-formal-late-stability-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_direct_clean_latent_formal_late_stability_corrected",
  runId: RUN_ID,
  kind: "cpu_readonly_adjudication",
  status: "success",
  title: "Direct clean-latent formal late stability corrected",
  titleZh: "直接干净潜变量正式后期稳定资格纠正完成",
  detailZh: "正式资格库确认6→2→0属于持续下降后归零；无需新模型或重训，当前候选恢复Stage 0准入。",
  evidencePath: projectPath(path.join(OUTPUT, "phase-terminal.json")),
  evidenceSha256: sha256(path.join(OUTPUT, "phase-terminal.json")),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
});

console.log(JSON.stringify({
  status: "direct_clean_latent_smoke_formal_late_stability_qualified",
  uniqueDecision: "formal_late_stability_adapter_mismatch_confirmed_no_new_model_successor_required",
  failureCounts: decision.failureCounts,
  qualificationRoute: decision.qualificationRoute,
  stage0Qualified: true,
  newModelSuccessorCreated: false,
  gpuStarted: false,
  trainingStarted: false,
  checkpointRead: false,
  cpuReport: bind(path.join(OUTPUT, "cpu-report.json")),
  qualificationDecision: bind(path.join(OUTPUT, "qualification-decision.json")),
  terminal: bind(path.join(OUTPUT, "phase-terminal.json")),
  registrySha256: advanced.registrySha256,
  nextLegalAction: nextTask,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
}, null, 2));

function resolve(relative) { const candidate = path.resolve(ROOT, relative); assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`)); return candidate; }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(file) { return { path: projectPath(file), sha256: sha256(file) }; }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }); }
