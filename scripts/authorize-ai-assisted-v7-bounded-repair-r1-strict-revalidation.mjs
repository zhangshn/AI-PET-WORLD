import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const EXPECTED_OWNER_COMMAND = "授权V7 R1严格challenge多种子训练后复验"
const COMMAND_REF = "owner-authorized-v7-repair-r1-strict-challenge-multiseed-revalidation-20260803"
const SCOPE = "v7_repair_r1_strict_challenge_multiseed_revalidation_only"
const RESOLUTION_ID = "owner-action-request-v7-repair-r1-strict-revalidation-resolution-20260803"
const PENDING_REQUEST_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-repair-r1-strict-revalidation-2026-08-03t04-12-49-525z/request.json"
const PENDING_REQUEST_SHA256 = "2e4a648ceb28732568330757000437b2f24e5a57466546491546a5de61e74945"
const TRAINING_FINALIZATION_SHA256 = "bede1821fff7ac3b6cbdf5bd475f669997bcc2edd3a5c84915704873446fed68"
const STAGE2_CHECKPOINT_SHA256 = "572c59f75d55419f7e59bc57546891abfd47665eaa29598ee7acc64516e5164b"
const args = parseArgs(process.argv.slice(2))

assert(args.ownerCommand === EXPECTED_OWNER_COMMAND, "owner command does not exactly authorize V7 R1 strict challenge multiseed revalidation")
assert(fileHashMatches(PENDING_REQUEST_PATH, PENDING_REQUEST_SHA256), "V7 R1 strict revalidation pending request hash mismatch")
const pendingRequest = readJson(PENDING_REQUEST_PATH)
assert(pendingRequest.status === "waiting_owner_authorization", "V7 R1 strict revalidation request is not waiting")
assert(pendingRequest.subsystem === "ai_painter_v7_repair_r1_strict_revalidation", "V7 R1 strict revalidation subsystem mismatch")
assert(pendingRequest.resolution?.revalidationAuthorized === false, "pending request already authorizes revalidation")
assert(pendingRequest.taskIdentity?.stage2CheckpointSha256 === STAGE2_CHECKPOINT_SHA256, "pending request Stage 2 checkpoint identity mismatch")
assert(fileHashMatches(pendingRequest.taskIdentity.trainingFinalizationPath, TRAINING_FINALIZATION_SHA256), "training finalization hash mismatch")
assert(fileHashMatches(pendingRequest.taskIdentity.stage2CheckpointPath, STAGE2_CHECKPOINT_SHA256), "Stage 2 checkpoint file hash mismatch")

const recorded = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId: RESOLUTION_ID,
  subsystem: "ai_painter_v7_repair_r1_strict_revalidation",
  status: "resolved_owner_authorized",
  taskIdentity: {
    ...pendingRequest.taskIdentity,
    parentRequestId: pendingRequest.requestId,
    parentRequestSha256: PENDING_REQUEST_SHA256,
    authorizationScope: SCOPE,
    strictHeldOutSplit: "challenge",
    challengeRecordCount: 4,
    seedsPerRecord: 2,
    plannedTrajectoryCount: 8,
  },
  ownerVisibleConclusionZh: "项目所有者已授权V7修复R1执行一次严格challenge多种子训练后复验。",
  localSystemFindingZh: "授权只覆盖当前R1 Stage 2 Checkpoint的4条challenge记录、每条2个固定种子的完整推理和机器审核；不会修改训练权重。",
  blockingReasonCode: "resolved_owner_authorized_v7_repair_r1_strict_revalidation",
  whyCannotProceedZh: "本记录仅解除一次严格复验阻断；正式模型晋升、正式推理、RuntimeFrame和进入世界继续保持独立阻断。",
  minimumRequestedActionZh: "本地程序先执行只读预检，再原子消费本授权并执行8条固定轨迹；任一执行失败立即停止并保存证据。",
  invariants: pendingRequest.invariants,
  forbiddenActions: ["modify_training_weights", "automatic_retry", "formal_model_promotion", "formal_image_generation", "runtime_frame", "world_entry"],
  ownerFacingMessageZh: "V7修复R1严格challenge多种子复验已获一次性授权；完成后自动停止，等待项目所有者审核结果。",
  nextActionAfterAuthorization: ["run_read_only_revalidation_preflight", "consume_authorization_once", "run_8_fixed_challenge_trajectories", "save_machine_review_and_token_evidence", "stop_for_owner_review"],
  evidencePaths: [PENDING_REQUEST_PATH, pendingRequest.taskIdentity.trainingFinalizationPath, pendingRequest.taskIdentity.stage2CheckpointPath],
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
  sourceEvidencePath: PENDING_REQUEST_PATH,
  script: "scripts/authorize-ai-assisted-v7-bounded-repair-r1-strict-revalidation.mjs",
})

appendAiPainterProgramEvent({
  action: "authorize_ai_assisted_v7_bounded_repair_r1_strict_revalidation",
  runId: RESOLUTION_ID,
  kind: "owner_authorization_recorded",
  status: "success",
  title: "Owner authorized one V7 repair R1 strict challenge multiseed revalidation",
  titleZh: "项目所有者已授权一次V7修复R1严格challenge多种子复验",
  detail: `${COMMAND_REF}; scope=${SCOPE}; trajectories=8; formalInference=false; runtimeFrame=false; world=false`,
  detailZh: "只授权当前R1 Checkpoint执行8条严格复验轨迹；正式推理、RuntimeFrame和进入世界仍未授权。",
  script: "scripts/authorize-ai-assisted-v7-bounded-repair-r1-strict-revalidation.mjs",
  currentStep: "v7_repair_r1_strict_revalidation_authorized_pending_preflight",
  evidencePath: recorded.requestPath,
  nextAction: "run_v7_repair_r1_strict_revalidation_read_only_preflight",
  nextActionZh: "先执行锁定Checkpoint、数据、条件包、轨迹与资源的只读预检。",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  ok: true,
  commandRef: COMMAND_REF,
  scope: SCOPE,
  authorization: recorded,
  boundaries: {
    revalidationAuthorized: true,
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
