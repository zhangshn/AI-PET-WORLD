import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = ".runtime/ai-painter/v7-post-training-validation-reconciliations"
const args = parseArgs(process.argv.slice(2))
assert(args.canonicalReport, "--canonical-report is required")
assert(args.duplicateReport, "--duplicate-report is required")

const canonical = readJson(args.canonicalReport)
const duplicate = readJson(args.duplicateReport)
assert(canonical.schemaVersion === "ai-assisted-v7-post-training-validation-report-v1", "canonical report schema is invalid")
assert(duplicate.schemaVersion === canonical.schemaVersion, "duplicate report schema is invalid")
assert(canonical.ownerCommandRef === duplicate.ownerCommandRef, "owner command identities differ")
assert(canonical.checkpointSha256 === duplicate.checkpointSha256, "checkpoint identities differ")
assert(canonical.completedTrajectoryCount === 8 && duplicate.completedTrajectoryCount === 8, "both batches must contain eight completed trajectories")

const canonicalIdentities = trajectoryIdentities(canonical)
const duplicateIdentities = trajectoryIdentities(duplicate)
assert(JSON.stringify(canonicalIdentities) === JSON.stringify(duplicateIdentities), "batch trajectories are not exact deterministic duplicates")

const canonicalTokenAccounting = sumModelReportAccounting(canonical)
const duplicateTokenAccounting = sumModelReportAccounting(duplicate)
assert(JSON.stringify(canonicalTokenAccounting) === JSON.stringify(duplicateTokenAccounting), "duplicate batch compute accounting differs")

const createdAtUtc = new Date().toISOString()
const reconciliationId = `ai-assisted-v7-post-training-validation-reconciliation-${createdAtUtc.replace(/[:.]/g, "-")}`
const reconciliation = {
  schemaVersion: "ai-assisted-v7-post-training-validation-reconciliation-v1",
  reconciliationId,
  status: "reconciled_machine_failed_not_formal",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ownerCommandRef: canonical.ownerCommandRef,
  checkpointSha256: canonical.checkpointSha256,
  canonicalBatch: {
    batchId: canonical.batchId,
    reportPath: projectPath(args.canonicalReport),
    reportSha256: sha256File(args.canonicalReport),
    role: "authoritative_validation_result",
  },
  duplicateBatch: {
    batchId: duplicate.batchId,
    reportPath: projectPath(args.duplicateReport),
    reportSha256: sha256File(args.duplicateReport),
    role: "unintended_deterministic_duplicate_execution_evidence_only",
    excludedFromValidationSampleCount: true,
    exclusionReason: "The hidden background launch remained active while monitoring incorrectly reported no process; a second foreground launch repeated the same eight deterministic trajectories.",
  },
  executionAccounting: {
    authorizedBatchIntentCount: 1,
    completedBatchExecutionCount: 2,
    unintendedDuplicateBatchCount: 1,
    uniqueAuthorizedTrajectoryCount: 8,
    physicalTrajectoryExecutionCount: 16,
    exactDuplicateOutputCount: 8,
    preInferenceExecutionFailureCount: 2,
    preInferenceFailureGeneratedImageCount: 0,
    preInferenceFailureLocalValidationTokenCount: 0,
  },
  result: {
    uniqueTrajectoryCount: 8,
    machinePassedCount: canonical.machinePassedCount,
    machineRejectedCount: canonical.machineRejectedCount,
    issueCodes: canonical.issueCodes,
    formalInferenceEligible: false,
    runtimeFrameEligible: false,
    canEnterWorld: false,
  },
  validationTokenAccounting: {
    schemaVersion: "ai-assisted-local-validation-reconciled-token-accounting-v1",
    localValidationTokenUnit: "one_latent_spatial_position_processed_by_one_denoiser_sample_forward_pass",
    isNlpToken: false,
    tokenizerUsed: false,
    authoritativeUniqueValidationWork: canonicalTokenAccounting,
    physicalGpuWorkIncludingUnintendedDuplicate: addAccounting(canonicalTokenAccounting, duplicateTokenAccounting),
    externalApiTokens: 0,
  },
  trainingWeightsModified: false,
  formalCandidate: false,
  formalInferenceEligible: false,
  runtimeFrameEligible: false,
  canEnterWorld: false,
  nextActionZh: "把8条唯一验证轨迹的失败项写入下一轮V7修复设计；未经项目所有者新授权，不得再验证、训练、正式推理或进入世界。",
  automaticStorage: true,
}

const runDir = path.resolve(ROOT, OUTPUT_ROOT, reconciliationId)
fs.mkdirSync(path.dirname(runDir), { recursive: true })
fs.mkdirSync(runDir, { recursive: false })
const reportPath = path.join(runDir, "reconciliation-report.json")
writeJson(reportPath, reconciliation)
const ownerActionRequest = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId: `owner-action-request-v7-validation-failed-${createdAtUtc.replace(/[:.]/g, "-").toLowerCase()}`,
  subsystem: "ai_painter_v7_post_training_validation_outcome",
  status: "waiting_owner_authorization",
  taskIdentity: {
    modelId: canonical.modelId,
    checkpointSha256: canonical.checkpointSha256,
    reconciliationId,
    canonicalBatchId: canonical.batchId,
    uniqueTrajectoryCount: reconciliation.result.uniqueTrajectoryCount,
    machinePassedCount: reconciliation.result.machinePassedCount,
    machineRejectedCount: reconciliation.result.machineRejectedCount,
  },
  ownerVisibleConclusionZh: "V7严格留出训练后验证已完成，8条唯一轨迹全部被机器拒绝，当前权重不具备正式推理资格。",
  localSystemFindingZh: `失败码由本地程序自动汇总为：${reconciliation.result.issueCodes.join(", ")}。重复批次已自动对账并排除出唯一验证样本。`,
  blockingReasonCode: "v7_post_training_validation_all_8_machine_rejected",
  whyCannotProceedZh: "训练后验证未通过，不能启动正式推理、RuntimeFrame或世界运行；模型修复、重训和重新验证都需要新的owner授权。",
  minimumRequestedActionZh: "请项目所有者决定是否授权根据5类失败设计下一轮V7修复、从新Stage 0重训并重新验证。",
  invariants: [
    "validation_and_duplicate_execution_evidence_remain_immutable",
    "training_dataset_remains_64_with_48_8_4_4_split",
    "formal_inference_runtime_frame_and_world_remain_blocked",
  ],
  forbiddenActions: [
    "delete_or_overwrite_validation_evidence",
    "lower_review_thresholds_to_force_pass",
    "automatically_retrain_or_revalidate",
    "start_formal_inference",
    "start_runtime_frame",
    "enter_world",
  ],
  ownerFacingMessageZh: "V7训练后验证未通过。失败证据、计算量、重复执行对账和下一步最小授权请求已由本地程序自动保存。",
  nextActionAfterAuthorization: [
    "design_bounded_v7_repair",
    "run_cpu_positive_negative_regression",
    "retrain_from_new_stage_0",
    "rerun_strict_held_out_validation",
    "stop_before_formal_inference",
  ],
  evidencePaths: [projectPath(reportPath)],
  ownerDecision: null,
  resolution: {
    postTrainingValidationPassed: false,
    repairRetrainingAuthorized: false,
    revalidationAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  },
}, {
  root: ROOT,
  sourceEvidencePath: projectPath(reportPath),
  script: "scripts/reconcile-ai-assisted-v7-post-training-validation.mjs",
})
const pointer = {
  schemaVersion: "ai-assisted-v7-post-training-validation-reconciliation-pointer-v1",
  reconciliationId,
  status: reconciliation.status,
  reportPath: projectPath(reportPath),
  reportSha256: sha256File(reportPath),
  canonicalBatchId: canonical.batchId,
  duplicateBatchId: duplicate.batchId,
  ownerActionRequest,
  formalInferenceEligible: false,
  runtimeFrameEligible: false,
  canEnterWorld: false,
}
writeJson(path.resolve(ROOT, OUTPUT_ROOT, "latest.json"), pointer)
appendAiPainterProgramEvent({
  action: "reconcile_ai_assisted_v7_post_training_validation",
  runId: reconciliationId,
  kind: "post_training_validation_reconciled",
  status: "failed",
  title: "V7 post-training validation reconciled with one excluded duplicate batch",
  titleZh: "V7训练后验证已完成对账，并排除一个重复批次",
  detail: `unique=8; rejected=${canonical.machineRejectedCount}; physical=16; duplicate=8`,
  detailZh: `唯一轨迹=8；机器拒绝=${canonical.machineRejectedCount}；物理执行=16；重复执行=8`,
  script: "scripts/reconcile-ai-assisted-v7-post-training-validation.mjs",
  currentStep: "post_training_validation_failed_waiting_owner_direction",
  evidencePath: projectPath(reportPath),
  nextAction: "design_next_v7_repair_only_after_owner_authorization",
  nextActionZh: reconciliation.nextActionZh,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  ok: true,
  status: reconciliation.status,
  reconciliationId,
  reportPath: projectPath(reportPath),
  reportSha256: sha256File(reportPath),
  result: reconciliation.result,
  validationTokenAccounting: reconciliation.validationTokenAccounting,
  ownerActionRequest,
}, null, 2))

function parseArgs(values) {
  const read = (name) => { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : null }
  return { canonicalReport: read("--canonical-report"), duplicateReport: read("--duplicate-report") }
}
function trajectoryIdentities(report) {
  return report.trajectories.map((row) => ({ conditionLabel: row.conditionLabel, seed: row.seed, outputImageSha256: row.outputImageSha256 }))
}
function sumModelReportAccounting(report) {
  const total = emptyAccounting()
  for (const trajectory of report.trajectories) {
    const manifest = readJson(trajectory.manifestPath)
    const modelReport = readJson(manifest.modelReportPath)
    const run = modelReport.validationTokenAccounting?.runTotals
    assert(run, `token accounting missing for ${trajectory.runId}`)
    for (const key of Object.keys(total)) total[key] += Number(run[key] ?? 0)
  }
  return total
}
function emptyAccounting() {
  return { denoiserSampleForwardPasses: 0, latentSpatialTokens: 0, latentChannelValues: 0, conditionScalarValues: 0, decodedRgbFrames: 0, decodedRgbPixelPredictions: 0 }
}
function addAccounting(left, right) {
  return Object.fromEntries(Object.keys(left).map((key) => [key, left[key] + right[key]]))
}
function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function writeJson(value, data) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.writeFileSync(value, `${JSON.stringify(data, null, 2)}\n`) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex") }
function projectPath(value) { return path.relative(ROOT, path.resolve(ROOT, value)).replaceAll("\\", "/") }
function assert(condition, message) { if (!condition) throw new Error(message) }
