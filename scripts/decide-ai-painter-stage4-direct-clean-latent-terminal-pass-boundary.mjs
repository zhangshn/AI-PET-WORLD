import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { appendAiPainterProgramEvent, formatShanghai, projectPath } from "./lib/ai-painter-program-event-store.mjs";
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";

const ROOT = process.cwd();
const CAPABILITY = "stage4-direct-condition-clean-latent-generator-change-candidate-v1";
const RUN_ID = "stage4-direct-clean-latent-terminal-pass-boundary-20260827-01";
const SOURCE_RUN = "stage4-direct-clean-latent-controlled-smoke-20260827-01";
const SOURCE_ROOT = resolve(`.runtime/ai-painter/stage4-direct-clean-latent-controlled-smokes/${SOURCE_RUN}`);
const CLOSURE_ROOT = resolve(`.runtime/ai-painter/stage4-direct-clean-latent-smoke-failure-closures/${SOURCE_RUN}`);
const OUTPUT = resolve(`.runtime/ai-painter/stage4-direct-clean-latent-terminal-pass-boundary-decisions/${RUN_ID}`);

const current = await readCurrentExecutionRegistry(ROOT);
assert.equal(current.ok, true, current.errorCode);
assert.equal(current.registry.taskId, "cpu_readonly_decide_direct_clean_latent_terminal_pass_without_late_stability");
assert.equal(current.registry.taskKind, "cpu_readonly_adjudication");
assert.equal(current.registry.capabilityVersion, CAPABILITY);
assert.equal(fs.existsSync(OUTPUT), false, "boundary decision run/output reuse is forbidden");
const terminal = read(path.join(SOURCE_ROOT, "phase-terminal.json"));
const manifest = read(path.join(SOURCE_ROOT, "training-output", "manifest.json"));
const review = read(path.join(SOURCE_ROOT, "machine-review.json"));
const qualification = read(path.join(SOURCE_ROOT, "late-stability-qualification.json"));
const closure = read(path.join(CLOSURE_ROOT, "failure-closure-report.json"));
assert.equal(terminal.status, "direct_clean_latent_controlled_smoke_real_visual_failure");
assert.equal(manifest.epochCount, 30);
assert.equal(manifest.modelStateHashes.weightsChanged, true);
assert.equal(manifest.autoencoderStateHashes.unchanged, true);
assert.equal(review.reviewThresholdsChanged, false);
assert.equal(review.reviews.find((row) => row.epoch === 30).passed, true);
assert.deepEqual([10, 20, 30].map((epoch) => review.reviews.find((row) => row.epoch === epoch).issueCodes.length), [6, 2, 0]);
assert.equal(qualification.qualified, false);
assert.equal(closure.lateStabilityDecision.noTerminalRegression, true);
assert.equal(closure.lateStabilityDecision.consecutiveTerminalPasses, false);
const selectedMetrics = [1, 5, 10, 20, 30].map((epoch) => {
  const row = manifest.metrics.find((item) => item.epoch === epoch);
  return { epoch, trainingCompositeLoss: row.trainingCompositeLoss, checkpointSelectionScore: row.checkpointSelectionScore, decodedRgbMae: row.metrics.decodedRgbMae, objectSemanticRgbMae: row.metrics.objectSemanticRgbMae };
});
for (let index = 1; index < selectedMetrics.length; index += 1) {
  assert.ok(selectedMetrics[index].trainingCompositeLoss < selectedMetrics[index - 1].trainingCompositeLoss, "training Loss did not strictly improve across evidence nodes");
  assert.ok(selectedMetrics[index].checkpointSelectionScore < selectedMetrics[index - 1].checkpointSelectionScore, "checkpoint score did not strictly improve across evidence nodes");
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.mkdirSync(OUTPUT, { recursive: false });
const recordedAtUtc = new Date().toISOString();
const verdict = "terminal_pass_without_consecutive_late_stability_not_stage0_qualified";
writeExclusive(path.join(OUTPUT, "boundary-decision-report.json"), {
  schemaVersion: "stage4-direct-clean-latent-terminal-pass-boundary-decision-v1",
  status: "completed",
  uniqueDecision: verdict,
  capabilityVersion: CAPABILITY,
  sourceRunId: SOURCE_RUN,
  facts: {
    trainingCompleted: true,
    epochCount: 30,
    optimizerStepCount: 30,
    modelWeightsChanged: true,
    autoencoderUnchanged: true,
    fixedPreviewByteReproductionValid: manifest.fixedPreviews.every((row) => row.byteExactReproduced === true),
    machineReviewThresholdsChanged: false,
    lateFailureCounts: [6, 2, 0],
    terminalEpochPassed: true,
    noTerminalRegression: true,
    consecutiveEpoch20And30Passes: false,
    singleValidationIdentityOnly: true,
  },
  metricTimeline: selectedMetrics,
  decisionReason: "Epoch 30 is a genuine pass and the trajectory improves, but one passing terminal preview cannot replace the frozen requirement for two consecutive late passes. The candidate therefore has promising evidence but no formal Stage 0 qualification.",
  decisionReasonZh: "Epoch 30为真实通过且训练轨迹持续改善，但单个终态通过不能替代冻结合同要求的两个连续晚期通过，因此该候选有正向证据但不具备Stage 0正式资格。",
  routeEffects: {
    currentSmokeClosed: true,
    checkpointReusable: false,
    checkpointPromotable: false,
    automaticRetryAllowed: false,
    stage0Allowed: false,
    thresholdChangeAllowed: false,
    nextActionLimitedToCpuReadOnlySuccessorDesign: true,
  },
  sourceBindings: {
    smokeTerminal: bind(path.join(SOURCE_ROOT, "phase-terminal.json")),
    trainingManifest: bind(path.join(SOURCE_ROOT, "training-output", "manifest.json")),
    machineReview: bind(path.join(SOURCE_ROOT, "machine-review.json")),
    lateStabilityQualification: bind(path.join(SOURCE_ROOT, "late-stability-qualification.json")),
    failureClosure: bind(path.join(CLOSURE_ROOT, "failure-closure-report.json")),
  },
  gpuStarted: false,
  checkpointRead: false,
  trainingStarted: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
});
const nextTask = "cpu_readonly_design_one_bounded_successor_after_direct_clean_latent_route_exit";
writeExclusive(path.join(OUTPUT, "phase-terminal.json"), {
  schemaVersion: "stage4-direct-clean-latent-terminal-pass-boundary-terminal-v1",
  executionState: "completed",
  status: verdict,
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  boundaryDecision: bind(path.join(OUTPUT, "boundary-decision-report.json")),
  currentCandidateExitedWithoutStage0Qualification: true,
  checkpointRead: false,
  gpuStarted: false,
  trainingStarted: false,
  ownerAuthorizationRequired: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: nextTask,
  recordedAtUtc,
});
const evidenceFiles = [
  path.join(SOURCE_ROOT, "phase-terminal.json"),
  path.join(SOURCE_ROOT, "training-output", "manifest.json"),
  path.join(SOURCE_ROOT, "machine-review.json"),
  path.join(SOURCE_ROOT, "late-stability-qualification.json"),
  path.join(CLOSURE_ROOT, "failure-closure-report.json"),
  path.join(OUTPUT, "boundary-decision-report.json"),
  path.join(OUTPUT, "phase-terminal.json"),
];
writeExclusive(path.join(OUTPUT, "local-task-capsule.json"), {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
  currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: verdict },
  candidateTerminal: { runId: RUN_ID, status: verdict, programStatus: "cpu_readonly_decision_completed", previewMachineStatus: review.status, previewCount: 5, previewPassCount: 1, previewFailCount: 4, checkpointWritten: false, modelWeightsModified: false, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) },
  latestBlocker: { code: "consecutive_late_pass_evidence_missing", summaryZh: "终态通过，但Epoch 20与30未连续通过，不能进入Stage 0。" },
  nextAllowedAction: { code: nextTask, labelZh: "只读设计唯一有界后继候选", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
  forbiddenActions: ["reuse_smoke_checkpoint", "automatic_retry", "start_stage0", "lower_machine_review_threshold", "free_hyperparameter_change", "multiple_successor_candidates"],
  taskIdentity: { modelId: CAPABILITY, sampleId: "194", sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] },
  evidence: evidenceFiles.map((file) => ({ kind: path.basename(file, path.extname(file)), labelZh: path.basename(file), ...bind(file), expectedSha256: sha256(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })),
  integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
});
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: nextTask,
  taskKind: "cpu_readonly_candidate_planning",
  runId: RUN_ID,
  lifecycleStage: "change_candidate",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(path.join(OUTPUT, "local-task-capsule.json")),
  terminalEvidencePath: projectPath(path.join(OUTPUT, "phase-terminal.json")),
});
appendAiPainterProgramEvent({
  id: `stage4-direct-clean-latent-terminal-boundary-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_direct_clean_latent_terminal_pass_boundary_decided",
  runId: RUN_ID,
  kind: "cpu_readonly_adjudication",
  status: "success",
  title: "Direct clean-latent terminal-pass boundary decided",
  titleZh: "直达干净潜变量终态通过但稳定不足边界裁决完成",
  detailZh: "Epoch 30真实通过，但缺少Epoch 20/30连续通过；当前候选不具备Stage 0资格并退出。",
  evidencePath: projectPath(path.join(OUTPUT, "phase-terminal.json")),
  evidenceSha256: sha256(path.join(OUTPUT, "phase-terminal.json")),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
});
console.log(JSON.stringify({
  status: verdict,
  terminalEpochPassed: true,
  lateFailureCounts: [6, 2, 0],
  stage0Qualified: false,
  currentCandidateExited: true,
  report: bind(path.join(OUTPUT, "boundary-decision-report.json")),
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
