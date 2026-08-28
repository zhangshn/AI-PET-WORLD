import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { appendAiPainterProgramEvent, formatShanghai, projectPath } from "./lib/ai-painter-program-event-store.mjs";
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";

const ROOT = process.cwd();
const RUN_ID = "stage4-direct-clean-latent-controlled-smoke-20260827-01";
const CAPABILITY = "stage4-direct-condition-clean-latent-generator-change-candidate-v1";
const SOURCE_ROOT = resolve(`.runtime/ai-painter/stage4-direct-clean-latent-controlled-smokes/${RUN_ID}`);
const OUTPUT = resolve(`.runtime/ai-painter/stage4-direct-clean-latent-smoke-failure-closures/${RUN_ID}`);
const sourceTerminalPath = path.join(SOURCE_ROOT, "phase-terminal.json");
const reviewPath = path.join(SOURCE_ROOT, "machine-review.json");
const qualificationPath = path.join(SOURCE_ROOT, "late-stability-qualification.json");
const manifestPath = path.join(SOURCE_ROOT, "manifest.json");

const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode);
assert.equal(current.registry.taskId, "record_direct_condition_clean_latent_smoke_failure_and_close");
assert.equal(current.registry.taskKind, "cpu_readonly_recording");
assert.equal(current.registry.runId, RUN_ID);
assert.equal(current.registry.capabilityVersion, CAPABILITY);
assert.equal(fs.existsSync(OUTPUT), false, "failure closure output reuse is forbidden");
const sourceTerminal = read(sourceTerminalPath);
const review = read(reviewPath);
const qualification = read(qualificationPath);
assert.equal(sourceTerminal.status, "direct_clean_latent_controlled_smoke_real_visual_failure");
assert.equal(review.previewCount, 5);
assert.equal(review.previewPassCount, 1);
assert.equal(review.previewFailCount, 4);
assert.equal(qualification.qualified, false);
const late = [10, 20, 30].map((epoch) => {
  const row = review.reviews.find((item) => item.epoch === epoch);
  assert.ok(row, `late review epoch ${epoch} missing`);
  return { epoch, passed: row.passed, failureCount: row.issueCodes.length, failureItems: [...row.issueCodes] };
});
assert.deepEqual(late.map((row) => row.failureCount), [6, 2, 0]);
assert.deepEqual(late[1].failureItems, [
  "condition_terrain_water_coverage_mismatch",
  "condition_terrain_path_ground_uncontracted_boundary_contact",
]);
assert.equal(late[2].passed, true);
const noTerminalRegression = late[2].failureItems.every((item) => late[1].failureItems.includes(item));
const consecutiveTerminalPasses = late[1].passed && late[2].passed;
assert.equal(noTerminalRegression, true);
assert.equal(consecutiveTerminalPasses, false);

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.mkdirSync(OUTPUT, { recursive: false });
const recordedAtUtc = new Date().toISOString();
writeExclusive(path.join(OUTPUT, "late-stability-semantic-clarification.json"), {
  schemaVersion: "stage4-direct-clean-latent-late-stability-semantic-clarification-v1",
  status: "qualification_result_unchanged_field_semantics_corrected_for_future_runs",
  runId: RUN_ID,
  immutableSourceQualification: bind(qualificationPath),
  lateEpochs: late,
  terminalEpochPassed: true,
  noTerminalRegression,
  consecutiveTerminalPasses,
  formalQualificationSatisfied: false,
  exactReason: "epoch_20_and_epoch_30_not_both_passed",
  historicalEvidenceModified: false,
  recordedAtUtc,
});
writeExclusive(path.join(OUTPUT, "failure-closure-report.json"), {
  schemaVersion: "stage4-direct-clean-latent-smoke-failure-closure-report-v1",
  status: "failed_closed_without_retry",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  trainingFacts: {
    epochCount: 30,
    optimizerStepCount: 30,
    modelWeightsChanged: true,
    autoencoderUnchanged: true,
    finalEpochMachineReviewPassed: true,
  },
  machineReviewTimeline: review.reviews.map((row) => ({ epoch: row.epoch, passed: row.passed, failureCount: row.issueCodes.length, failureItems: row.issueCodes })),
  lateStabilityDecision: {
    failureCounts: [6, 2, 0],
    terminalEpochPassed: true,
    noTerminalRegression,
    consecutiveTerminalPasses,
    qualified: false,
    failureCode: "late_stability_requires_epoch_20_and_epoch_30_consecutive_passes",
  },
  checkpoint: { written: true, promotable: false, reusable: false },
  automaticRetryStarted: false,
  stage0Started: false,
  ownerAuthorizationRequired: false,
  sourceTerminal: bind(sourceTerminalPath),
  sourceManifest: bind(manifestPath),
  sourceMachineReview: bind(reviewPath),
  sourceQualification: bind(qualificationPath),
  semanticClarification: bind(path.join(OUTPUT, "late-stability-semantic-clarification.json")),
  recordedAtUtc,
});
writeExclusive(path.join(OUTPUT, "phase-terminal.json"), {
  schemaVersion: "stage4-direct-clean-latent-smoke-failure-closure-terminal-v1",
  executionState: "completed",
  status: "direct_clean_latent_controlled_smoke_failed_closed_without_retry",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  failureClosureReport: bind(path.join(OUTPUT, "failure-closure-report.json")),
  sourceSmokeTerminal: bind(sourceTerminalPath),
  historicalEvidenceModified: false,
  automaticRetryStarted: false,
  stage0Started: false,
  ownerAuthorizationRequired: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "cpu_readonly_decide_direct_clean_latent_terminal_pass_without_late_stability",
  recordedAtUtc,
});
const evidenceFiles = [
  sourceTerminalPath,
  manifestPath,
  reviewPath,
  qualificationPath,
  path.join(OUTPUT, "late-stability-semantic-clarification.json"),
  path.join(OUTPUT, "failure-closure-report.json"),
  path.join(OUTPUT, "phase-terminal.json"),
];
writeExclusive(path.join(OUTPUT, "local-task-capsule.json"), {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}-failure-closure`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
  currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: "direct_clean_latent_controlled_smoke_failed_closed_without_retry" },
  candidateTerminal: { runId: RUN_ID, status: "direct_clean_latent_controlled_smoke_failed_closed_without_retry", programStatus: "failed_closed", previewMachineStatus: review.status, previewCount: 5, previewPassCount: 1, previewFailCount: 4, checkpointWritten: true, modelWeightsModified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) },
  latestBlocker: { code: "late_stability_requires_epoch_20_and_epoch_30_consecutive_passes", summaryZh: "Epoch 30通过，但Epoch 20仍有两项失败，未形成连续晚期通过。" },
  nextAllowedAction: { code: "cpu_readonly_decide_direct_clean_latent_terminal_pass_without_late_stability", labelZh: "只读裁决终态通过但晚期稳定不足的路线边界", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
  forbiddenActions: ["reuse_smoke_checkpoint", "automatic_retry", "start_stage0_before_qualification", "lower_machine_review_threshold", "free_hyperparameter_change"],
  taskIdentity: { modelId: CAPABILITY, sampleId: "194", sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] },
  evidence: evidenceFiles.map((file) => ({ kind: path.basename(file, path.extname(file)), labelZh: path.basename(file), ...bind(file), expectedSha256: sha256(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })),
  integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
});
const nextTask = "cpu_readonly_decide_direct_clean_latent_terminal_pass_without_late_stability";
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: `${RUN_ID}-failure-closure`,
  taskId: nextTask,
  taskKind: "cpu_readonly_adjudication",
  runId: `${RUN_ID}-failure-closure`,
  lifecycleStage: "readonly_gpu_qualified",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(path.join(OUTPUT, "local-task-capsule.json")),
  terminalEvidencePath: projectPath(path.join(OUTPUT, "phase-terminal.json")),
});
appendAiPainterProgramEvent({
  id: `stage4-direct-clean-latent-smoke-failure-closure-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_direct_clean_latent_smoke_failure_closed_without_retry",
  runId: RUN_ID,
  kind: "cpu_readonly_recording",
  status: "failed_closed",
  title: "Direct clean-latent Smoke failed closed without retry",
  titleZh: "直达干净潜变量Smoke真实失败关闭且未重试",
  detailZh: "Epoch 30机器审核通过，但Epoch 20仍有两项失败，未满足连续晚期通过合同；原始资格结果不变。",
  evidencePath: projectPath(path.join(OUTPUT, "phase-terminal.json")),
  evidenceSha256: sha256(path.join(OUTPUT, "phase-terminal.json")),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
});
console.log(JSON.stringify({
  status: "direct_clean_latent_controlled_smoke_failed_closed_without_retry",
  runId: RUN_ID,
  terminalEpochPassed: true,
  lateFailureCounts: [6, 2, 0],
  consecutiveTerminalPasses: false,
  noTerminalRegression: true,
  terminal: bind(path.join(OUTPUT, "phase-terminal.json")),
  report: bind(path.join(OUTPUT, "failure-closure-report.json")),
  registrySha256: advanced.registrySha256,
  nextLegalAction: nextTask,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
}, null, 2));

function resolve(relative) { const candidate = path.resolve(ROOT, relative); assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`)); return candidate; }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(file) { return { path: projectPath(file), sha256: sha256(file) }; }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }); }
