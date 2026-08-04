import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const EXPECTED_OWNER_COMMAND = "允许"
const COMMAND_REF = "owner-authorized-v7-repair-r1-strict-revalidation-after-trajectory-root-fix-20260803"
const SCOPE = "v7_repair_r1_strict_challenge_multiseed_revalidation_only"
const RESOLUTION_ID = "owner-action-request-v7-repair-r1-strict-revalidation-after-directory-fix-resolution-20260803"
const PENDING_REQUEST_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-validation-2026-08-03t06-41-11-643z/request.json"
const PENDING_REQUEST_SHA256 = "6d8c0f37649d18c932dbf3c0405d411190430a2f2e83365d9bcffa02facc1710"
const FAILED_REPORT_PATH = ".runtime/ai-painter/v7-repair-r1-strict-revalidations/ai-assisted-v7-repair-r1-strict-revalidation-2026-08-03T06-41-11-643Z/validation-report.json"
const FAILED_REPORT_SHA256 = "a3129fbaaaa51e89d6f82346cff43cf47acaa884b66311cf2c3ec8b179857341"
const SINGLE_RUNNER_PATH = "scripts/run-ai-assisted-conditional-inference-validation.mjs"
const SINGLE_RUNNER_SHA256 = "8db90be77e4e5cf70469b570673f82cec88e1bede1b0f5090276adc2ca9362d6"
const BATCH_RUNNER_PATH = "scripts/run-ai-assisted-v7-post-training-validation.mjs"
const BATCH_RUNNER_SHA256 = "ce1cf6f4a2b5218b0285c04d7a5f4df17784f62ffcc66375a9557dfc2a7f1bef"
const CHECKPOINT_SHA256 = "572c59f75d55419f7e59bc57546891abfd47665eaa29598ee7acc64516e5164b"
const args = parseArgs(process.argv.slice(2))

assert(args.ownerCommand === EXPECTED_OWNER_COMMAND, "owner command does not match the current explicit approval")
assert(fileHashMatches(PENDING_REQUEST_PATH, PENDING_REQUEST_SHA256), "failed validation owner request hash mismatch")
assert(fileHashMatches(FAILED_REPORT_PATH, FAILED_REPORT_SHA256), "failed validation report hash mismatch")
assert(fileHashMatches(SINGLE_RUNNER_PATH, SINGLE_RUNNER_SHA256), "fixed single-trajectory runner hash mismatch")
assert(fileHashMatches(BATCH_RUNNER_PATH, BATCH_RUNNER_SHA256), "strict revalidation batch runner hash mismatch")

const pendingRequest = readJson(PENDING_REQUEST_PATH)
const failedReport = readJson(FAILED_REPORT_PATH)
assert(pendingRequest.status === "waiting_owner_authorization", "failed validation request is not waiting for Owner authorization")
assert(pendingRequest.blockingReasonCode === "v7_post_training_validation_machine_or_execution_failed", "failed validation request reason mismatch")
assert(failedReport.status === "post_training_validation_execution_failed", "prior strict revalidation is not an execution failure")
assert(failedReport.issueCodes?.includes("v7_post_training_validation_trajectory_execution_failed"), "prior strict revalidation failure code mismatch")
assert(failedReport.checkpointSha256 === CHECKPOINT_SHA256, "prior strict revalidation checkpoint mismatch")
assert(failedReport.plannedTrajectoryCount === 8, "prior strict revalidation trajectory plan mismatch")
assert(failedReport.trainingWeightsModified === false, "prior strict revalidation unexpectedly modified weights")
assert(failedReport.automaticRetryCount === 0, "prior strict revalidation unexpectedly retried")

const recorded = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId: RESOLUTION_ID,
  subsystem: "ai_painter_v7_repair_r1_strict_revalidation",
  status: "resolved_owner_authorized",
  taskIdentity: {
    modelId: failedReport.modelId,
    checkpointSha256: CHECKPOINT_SHA256,
    stage2CheckpointSha256: CHECKPOINT_SHA256,
    priorValidationBatchId: failedReport.batchId,
    priorValidationReportPath: FAILED_REPORT_PATH,
    priorValidationReportSha256: FAILED_REPORT_SHA256,
    parentRequestId: pendingRequest.requestId,
    parentRequestSha256: PENDING_REQUEST_SHA256,
    singleTrajectoryRunnerPath: SINGLE_RUNNER_PATH,
    singleTrajectoryRunnerSha256: SINGLE_RUNNER_SHA256,
    batchRunnerPath: BATCH_RUNNER_PATH,
    batchRunnerSha256: BATCH_RUNNER_SHA256,
    authorizationScope: SCOPE,
    strictHeldOutSplit: "challenge",
    challengeRecordCount: 4,
    seedsPerRecord: 2,
    plannedTrajectoryCount: 8,
    repairedDefect: "initialize_fixed_trajectory_root_before_unique_run_directory",
  },
  ownerVisibleConclusionZh: "项目所有者已授权在轨迹根目录初始化缺陷修复后，对当前V7 R1 Checkpoint执行一次严格challenge多种子复验。",
  localSystemFindingZh: "旧授权已消费且旧批次因轨迹根目录缺失在首条轨迹启动前失败；本授权绑定修复后的执行器哈希和原失败证据。",
  blockingReasonCode: "resolved_owner_authorized_v7_repair_r1_strict_revalidation_after_directory_fix",
  whyCannotProceedZh: "本记录仅解除当前Checkpoint一次严格复验的授权阻断，不授权训练、自动重试、正式推理、RuntimeFrame或世界运行。",
  minimumRequestedActionZh: "原子消费本授权后执行4条challenge记录、每条2个固定种子，共8条轨迹；任一执行失败立即停止并保存证据。",
  invariants: [
    "fixed_checkpoint_sha256",
    "fixed_four_challenge_records_two_seeds_each",
    "authorization_consumed_before_first_trajectory",
    "no_automatic_retry",
    "training_weights_unchanged",
    "formal_inference_runtime_frame_and_world_remain_blocked",
  ],
  forbiddenActions: [
    "modify_training_weights",
    "automatic_retry",
    "formal_model_promotion",
    "formal_image_generation",
    "runtime_frame",
    "world_entry",
  ],
  ownerFacingMessageZh: "当前V7 R1 Checkpoint的一次性严格复验已获授权；执行完成或失败后必须停止并等待Owner审核。",
  nextActionAfterAuthorization: [
    "consume_authorization_once",
    "run_8_fixed_challenge_trajectories_without_retry",
    "save_machine_review_token_and_hash_evidence",
    "stop_for_owner_review",
  ],
  evidencePaths: [
    PENDING_REQUEST_PATH,
    FAILED_REPORT_PATH,
    SINGLE_RUNNER_PATH,
    BATCH_RUNNER_PATH,
    failedReport.checkpointPath,
  ],
  ownerDecision: {
    decision: "authorized",
    commandRef: COMMAND_REF,
    commandZh: args.ownerCommand,
    scope: SCOPE,
  },
  resolution: {
    revalidationAuthorized: true,
    postTrainingValidationAuthorized: true,
    authorizedExecutionCount: 1,
    trainingWeightsMayChange: false,
    automaticRetryAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
    executionCompleted: false,
  },
}, {
  root: ROOT,
  sourceEvidencePath: FAILED_REPORT_PATH,
  script: "scripts/authorize-ai-assisted-v7-bounded-repair-r1-strict-revalidation-after-directory-fix.mjs",
})

appendAiPainterProgramEvent({
  action: "authorize_ai_assisted_v7_repair_r1_strict_revalidation_after_directory_fix",
  runId: RESOLUTION_ID,
  kind: "owner_authorization_recorded",
  status: "success",
  title: "Owner authorized one V7 R1 strict revalidation after trajectory-root repair",
  titleZh: "项目所有者已授权轨迹目录修复后的一次V7 R1严格复验",
  detail: `${COMMAND_REF}; checkpoint=${CHECKPOINT_SHA256}; trajectories=8; automaticRetry=false`,
  detailZh: "授权仅覆盖当前Checkpoint的8条固定challenge轨迹，禁止自动重试、修改权重和进入世界。",
  script: "scripts/authorize-ai-assisted-v7-bounded-repair-r1-strict-revalidation-after-directory-fix.mjs",
  currentStep: "v7_repair_r1_strict_revalidation_authorized_pending_execution",
  evidencePath: recorded.requestPath,
  nextAction: "run_8_fixed_challenge_trajectories_without_retry",
  nextActionZh: "原子消费新授权并执行8条固定challenge复验轨迹。",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  ok: true,
  commandRef: COMMAND_REF,
  scope: SCOPE,
  authorization: recorded,
  checkpointSha256: CHECKPOINT_SHA256,
  plannedTrajectoryCount: 8,
  boundaries: {
    trainingWeightsMayChange: false,
    automaticRetryAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  },
}, null, 2))

function parseArgs(values) {
  const index = values.indexOf("--owner-command")
  return { ownerCommand: index >= 0 ? values[index + 1] : null }
}
function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex") }
function fileHashMatches(value, expected) {
  const absolute = path.resolve(ROOT, value)
  return fs.existsSync(absolute) && sha256File(absolute) === expected
}
function assert(condition, message) { if (!condition) throw new Error(message) }
