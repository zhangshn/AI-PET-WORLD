import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  FINAL_LUMA,
  RESIDUAL_CLASSES,
  SOURCE_RUN_ID,
  adjudicateConflictAwareStage0Failure,
} from "./lib/ai-painter-stage4-conflict-aware-stage0-residual-semantic-adjudication.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze([
  "verify_current_stage0_residual_semantic_failure_evidence",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_adjudication_authorization",
  "write_problem_analysis_decision_exit_request_and_terminal",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const DENIALS = Object.freeze([
  "read_or_load_checkpoint_weights", "reuse_failed_checkpoint", "modify_model", "modify_loss",
  "select_free_hyperparameters", "start_gpu", "start_training", "rerun_stage0",
  "lower_review_thresholds", "use_failed_preview_as_training_target", "use_review_result_as_training_target",
  "reuse_historical_stage0", "reuse_old_run_id", "reuse_old_authorization", "reuse_old_checkpoint",
  "auto_generate_same_type_loss", "start_stage1", "start_stage2", "start_stage5", "formal_inference",
  "checkpoint_promotion", "runtime_frame", "world_entry",
])

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const target = path.resolve(ROOT, value)
  assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return target
}
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const writeTextAtomic = (target, content) => {
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  const descriptor = fs.openSync(temp, "wx")
  try {
    fs.writeFileSync(descriptor, content, "utf8")
    fs.fsyncSync(descriptor)
  } finally {
    fs.closeSync(descriptor)
  }
  fs.renameSync(temp, target)
}

const authorizationArg = arg("--authorization")
const authorizationSha256 = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-conflict-aware-stage0-residual-semantic-adjudication-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.sourceRunId, SOURCE_RUN_ID)
assert.equal(authorization.scope, "one_cpu_readonly_conflict_aware_stage0_residual_semantic_causal_adjudication")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_not_exact")
assert.equal(DENIALS.every((entry) => authorization.deniedActions.includes(entry)), true, "denied_actions_incomplete")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.automaticRetryAuthorized, false)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(authorization.stage1Authorized, false)
assert.equal(authorization.stage2Authorized, false)

const sourceRoot = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/`
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  assert.equal(evidence.path.startsWith(sourceRoot), true, `${name}_historical_run_rejected`)
  const target = projectFile(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  if (name !== "failedCheckpointIdentityOnly") {
    assert.equal(shaFile(target), evidence.sha256, `${name}_sha256_mismatch`)
  }
}

const programs = {
  runner: projectFile("scripts/run-stage4-conflict-aware-stage0-residual-semantic-adjudication.mjs"),
  checker: projectFile("scripts/check-stage4-conflict-aware-stage0-residual-semantic-adjudication.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-conflict-aware-stage0-residual-semantic-adjudication.mjs"),
}
assert.deepEqual(
  authorization.programLineage,
  Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  "program_lineage_mismatch",
)
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-conflict-aware-stage0-residual-semantic-adjudication-consumption-v1",
  status: "cpu_readonly_adjudication_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorizationPath: authorizationArg,
  authorizationSha256,
  oneTimeConsumption: true,
  consumedAtUtc,
  consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
}
const consumptionDescriptor = fs.openSync(consumptionPath, "wx")
try {
  fs.writeFileSync(consumptionDescriptor, `${JSON.stringify(consumption, null, 2)}\n`, "utf8")
  fs.fsyncSync(consumptionDescriptor)
} finally {
  fs.closeSync(consumptionDescriptor)
}

const sourceEvidence = authorization.sourceEvidence
const terminal = readJson(projectFile(sourceEvidence.stage0Terminal.path))
const manifest = readJson(projectFile(sourceEvidence.stage0Manifest.path))
const review = readJson(projectFile(sourceEvidence.stage0MachineReview.path))
const activeConfig = readJson(projectFile(sourceEvidence.activeConfig.path))
const telemetry = readJson(projectFile(sourceEvidence.stage0Telemetry.path))
assert.equal(telemetry.status, "step_recorded", "telemetry_status_invalid")
const completedStepCount = (step) => telemetry.events.filter((entry) => entry.step === step && entry.status === "completed").length
const optimizerStepEvidence = {
  primaryOptimizerSteps: completedStepCount("optimizer_step"),
  luminanceReplaySteps: completedStepCount("epoch_complete_per_class_selected_luminance_replay"),
  referenceFeatureReplaySteps: completedStepCount("epoch_complete_per_class_selected_reference_feature_replay"),
  legacyReplaySteps: completedStepCount("epoch_worst_sample_class_replay"),
}
optimizerStepEvidence.total = Object.values(optimizerStepEvidence).reduce((sum, value) => sum + value, 0)
assert.equal(optimizerStepEvidence.total, 5760, "optimizer_step_identity_invalid")

const decision = adjudicateConflictAwareStage0Failure({
  terminal,
  manifest,
  review,
  activeConfig,
  failedCheckpointIdentity: {
    path: sourceEvidence.failedCheckpointIdentityOnly.path,
    sha256: sourceEvidence.failedCheckpointIdentityOnly.sha256,
  },
  directConflictWiringDefectEvidence: false,
  directResidualCapacityEvidence: false,
})
assert.equal(decision.selectedCause, "A")

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = {
  cpu: path.join(output, "cpu-report.json"),
  problem: path.join(output, "problem-report.json"),
  report: path.join(output, "causal-analysis-report.json"),
  decision: path.join(output, "adjudication.json"),
  exit: path.join(output, "training-paradigm-exit-proposal.json"),
  owner: path.join(output, "model-structure-review-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.cpu, {
  ...cpuReport,
  sourceRunId: SOURCE_RUN_ID,
  sourceEvidence,
  optimizerStepEvidence,
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
})
writeJsonAtomic(files.problem, {
  schemaVersion: "stage4-conflict-aware-stage0-residual-semantic-problem-report-v1",
  status: "problem_confirmed",
  sourceRunId: SOURCE_RUN_ID,
  facts: {
    epochsCompleted: 40,
    optimizerSteps: optimizerStepEvidence.total,
    conflictAwareAggregationActiveAcrossAllEpochs: true,
    epoch40Passed: ["road", "water", "vegetation"],
    epoch40LocalResponsePassed: RESIDUAL_CLASSES,
    epoch40ResidualReferenceSemanticMismatch: RESIDUAL_CLASSES,
    maskedLumaCorrelation: FINAL_LUMA,
    frozenMinimumMaskedLumaCorrelation: 0.08,
    validationCheckpointSelectionScore: { epoch1: 7.252712216589134, epoch40: 5.372003858235742 },
    bestEpoch: 30,
    terminalEpoch: 40,
    fixedPreviewPassCount: 0,
    fixedPreviewFailCount: 6,
  },
  sourceEvidence,
  failedCheckpointWeightsRead: false,
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-conflict-aware-stage0-residual-semantic-causal-analysis-report-v1",
  status: "causal_analysis_succeeded",
  sourceRunId: SOURCE_RUN_ID,
  selectedCause: decision.selectedCause,
  problem: decision.problem,
  evidence: decision.evidence,
  alternatives: decision.alternatives,
  metricTimeline: decision.metrics,
  reviewTimeline: decision.reviews,
  optimizerStepEvidence,
  failedCheckpointWeightsRead: false,
  forbiddenTargetsUsed: false,
})
writeJsonAtomic(files.decision, decision)
writeJsonAtomic(files.exit, {
  schemaVersion: "stage4-conflict-aware-training-paradigm-exit-proposal-v1",
  status: "current_conflict_aware_training_paradigm_exit_required",
  candidate: "stage4_conflict_aware_existing_gradient_aggregation_v1",
  reason: "Conflict-aware aggregation was active in all 40 epochs and improved part of the terminal result, but it did not constrain footprints, tree, and rock final reference semantics in the frozen multi-sample Stage 0.",
  sameStage0RerunAllowed: false,
  additionalSameTypeLossAllowed: false,
  failedCheckpointReuseAllowed: false,
  nextLegalAction: "cpu_readonly_substantive_model_structure_review",
})
writeJsonAtomic(files.owner, {
  schemaVersion: "stage4-substantive-model-structure-review-request-v1",
  status: "owner_authorization_required_for_cpu_readonly_model_structure_review",
  objective: "Determine whether a materially different condition-to-final-RGB fusion or Denoiser capacity boundary is justified by existing immutable evidence before any new architecture is built.",
  frozenInputs: ["original_64_approved_samples", "48_8_4_4_split", "23_condition_channels", "frozen_autoencoder", "machine_review_thresholds"],
  requiredOutcomes: ["condition_fusion_gap", "denoiser_capacity_gap", "joint_structure_gap", "evidence_insufficient"],
  prohibitedActions: ["generate_free_hyperparameters", "add_same_type_loss", "read_checkpoint_weights", "start_gpu", "start_training", "rerun_stage0"],
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planBeforeSha256 = shaFile(planPath)
let planText = fs.readFileSync(planPath, "utf8")
planText = planText.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
planText = planText.replace(
  /^状态：.*$/m,
  "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4冲突感知训练范式已完成40 Epoch正式Stage 0并以三类对象真实视觉失败退出，下一业务门为CPU只读实质模型结构审查",
)
const oldStatusLine = /^- Stage4冲突感知现有梯度聚合30 Epoch Smoke及后期稳定资格已经通过；.*$/m
assert.equal(oldStatusLine.test(planText), true, "unique_plan_conflict_aware_status_line_missing")
planText = planText.replace(
  oldStatusLine,
  "- Stage4冲突感知现有梯度聚合已完成只读GPU资格、30 Epoch Smoke、后期稳定资格及全新256×192、40 Epoch Stage 0。40 Epoch与5760次优化完整，冲突处理全程激活，Epoch 40道路、水体和vegetation通过，但footprints、tree、rock仍为reference_semantic_mismatch，亮度相关性为0.0488/-0.0862/0.0614，六个固定审核点0/6通过。CPU只读因果裁决唯一选择A：该训练范式有效改善部分对象但仍不足，最佳Epoch 30与终态Epoch 40差异不能解释终态三类失败；当前范式退出，不得重跑、复用失败Checkpoint或继续叠加同类Loss，下一步仅可做实质模型结构审查。",
)
writeTextAtomic(planPath, planText)
writeJsonAtomic(files.planSync, {
  schemaVersion: "stage4-conflict-aware-stage0-residual-semantic-plan-sync-v1",
  status: "unique_plan_synchronized",
  planPath: relative(planPath),
  beforeSha256: planBeforeSha256,
  afterSha256: shaFile(planPath),
  selectedCause: "A",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-conflict-aware-stage0-residual-semantic-adjudication-terminal-v1",
  status: "stage4_conflict_aware_stage0_residual_semantic_adjudication_succeeded_closed",
  sourceRunId: SOURCE_RUN_ID,
  selectedCause: "A",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  problemReport: bind(files.problem),
  causalAnalysisReport: bind(files.report),
  adjudication: bind(files.decision),
  trainingParadigmExitProposal: bind(files.exit),
  modelStructureReviewRequest: bind(files.owner),
  cpuReport: bind(files.cpu),
  planSync: bind(files.planSync),
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  nextLegalAction: "owner_authorization_for_cpu_readonly_substantive_model_structure_review",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 conflict-aware Stage 0 residual semantic adjudication",
  terminal: bind(files.terminal),
  latestDecision: "A_conflict_aware_training_paradigm_active_but_semantically_insufficient",
  nextLegalAction: "cpu_readonly_substantive_model_structure_review",
  forbiddenActions: DENIALS,
  recordedAtUtc: now,
})
for (const target of Object.values(files)) {
  const stat = fs.statSync(target)
  indexArtifact({
    logicalPath: logicalProjectPath(target),
    physicalUri: fs.realpathSync(target),
    storageLayer: "hot",
    runId: authorization.runId,
    artifactType: "stage4_conflict_aware_stage0_residual_semantic_adjudication",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: shaFile(target),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-conflict-aware-stage0-residual-semantic-adjudication-${authorization.runId}`,
  timestamp: now,
  action: "stage4_conflict_aware_stage0_residual_semantic_causal_adjudication",
  runId: authorization.runId,
  kind: "cpu_readonly_adjudication",
  status: "success",
  title: "Stage4 conflict-aware training paradigm exited after residual semantic failure",
  titleZh: "Stage4冲突感知训练范式因残余语义失败完成退出裁决",
  detailZh: "40 Epoch及5760次优化完整，冲突聚合全程激活并改善部分对象；footprints、tree、rock终态仍不达标，唯一裁决A，下一步仅允许CPU只读实质模型结构审查。",
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

console.log(JSON.stringify({
  status: readJson(files.terminal).status,
  selectedCause: "A",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: bind(files.terminal),
  problemReport: bind(files.problem),
  causalAnalysisReport: bind(files.report),
  adjudication: bind(files.decision),
  trainingParadigmExitProposal: bind(files.exit),
  modelStructureReviewRequest: bind(files.owner),
  cpuReport: bind(files.cpu),
  capsule: bind(files.capsule),
  planSync: bind(files.planSync),
}, null, 2))
