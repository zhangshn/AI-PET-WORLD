import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const EXPECTED_COMMAND = "授权"
const COMMAND_REF = "owner-authorized-v7-repair-r1-full-stage0-stage1-stage2-training-20260802"
const SCOPE = "v7_repair_r1_full_stage0_stage1_stage2_training_only"
const RESOLUTION_ID = "owner-action-request-v7-repair-r1-full-training-resolution-20260802"
const SMOKE_POINTER_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r1/latest-program-check.json"
const args = parseArgs(process.argv.slice(2))

assert(args.ownerCommand === EXPECTED_COMMAND, "owner command does not exactly authorize repair R1 full training")
const smokePointer = readJson(SMOKE_POINTER_PATH)
assert(smokePointer.status === "stage0_smoke_program_passed_stopped", "repair R1 Stage 0 Smoke program is not completed")
assert(smokePointer.fullTrainingAuthorized === false, "smoke pointer improperly claims full training authorization")
assert(smokePointer.formalInferenceEligible === false && smokePointer.canEnterWorld === false, "smoke downstream boundary is invalid")
const pendingRequest = readJson(smokePointer.nextOwnerRequestPath)
assert(pendingRequest.status === "waiting_owner_authorization", "repair R1 full-training request is not waiting")
assert(pendingRequest.taskIdentity?.smokeRunId === smokePointer.runId, "full-training request smoke identity mismatch")
assert(pendingRequest.taskIdentity?.previewMachinePassed === false, "corrected one-epoch preview review is not recorded")
assert(pendingRequest.resolution?.fullTrainingAuthorized === false, "pending request already authorizes full training")

const recorded = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId: RESOLUTION_ID,
  subsystem: "ai_painter_v7_bounded_repair_r1_full_training",
  status: "resolved_owner_authorized",
  taskIdentity: {
    ...pendingRequest.taskIdentity,
    parentRequestId: pendingRequest.requestId,
    authorizationScope: SCOPE,
    requiredStages: [0, 1, 2],
    requiredEpochsPerStage: 40,
    requiredSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
    conditionChannelCount: 23,
  },
  ownerVisibleConclusionZh: "项目所有者已授权V7修复R1完整Stage 0→1→2训练。",
  localSystemFindingZh: "授权只覆盖从新随机Stage 0开始并按父Checkpoint链执行Stage 1与Stage 2；Smoke预览画质失败作为1 epoch诊断证据保留，不得伪造成正式通过。",
  blockingReasonCode: "resolved_owner_authorized_v7_repair_r1_full_training",
  whyCannotProceedZh: "本记录仅解除完整训练阻断；训练后的严格challenge复验、正式推理、RuntimeFrame和进入世界仍保持独立阻断。",
  minimumRequestedActionZh: "本地训练程序按Stage 0、Stage 1、Stage 2顺序执行；任一阶段失败立即停止并自动保存证据。",
  invariants: pendingRequest.invariants,
  forbiddenActions: ["strict_challenge_revalidation", "formal_model_promotion", "formal_image_generation", "runtime_frame", "world_entry"],
  ownerFacingMessageZh: "V7修复R1完整三阶段训练已获授权；训练结束后自动停止，等待项目所有者单独决定是否授权严格复验。",
  nextActionAfterAuthorization: ["preflight_locked_dataset_and_repair_contract", "train_new_stage_0", "train_stage_1_from_new_stage_0", "train_stage_2_from_new_stage_1", "stop_and_request_separate_strict_revalidation_authorization"],
  evidencePaths: [smokePointer.reportPath, smokePointer.previewReviewPath, smokePointer.nextOwnerRequestPath],
  ownerDecision: { decision: "authorized", commandRef: COMMAND_REF, commandZh: args.ownerCommand, scope: SCOPE },
  resolution: {
    fullTrainingAuthorized: true,
    requiredStagesAuthorized: [0, 1, 2],
    strictStageOrderRequired: true,
    newRandomStage0Required: true,
    revalidationAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
    executionCompleted: false,
  },
}, {
  root: ROOT,
  sourceEvidencePath: smokePointer.previewReviewPath,
  script: "scripts/authorize-ai-assisted-v7-bounded-repair-r1-full-training.mjs",
})

appendAiPainterProgramEvent({
  action: "authorize_ai_assisted_v7_bounded_repair_r1_full_training",
  runId: RESOLUTION_ID,
  kind: "owner_authorization_recorded",
  status: "success",
  title: "Owner authorized V7 repair R1 full Stage 0 to Stage 2 training",
  titleZh: "项目所有者已授权V7修复R1完整Stage 0至Stage 2训练",
  detail: `${COMMAND_REF}; scope=${SCOPE}; revalidation=false; formalInference=false; runtimeFrame=false; world=false`,
  detailZh: "只授权完整三阶段训练；严格复验、正式推理、RuntimeFrame和进入世界仍未授权。",
  script: "scripts/authorize-ai-assisted-v7-bounded-repair-r1-full-training.mjs",
  currentStep: "v7_repair_r1_full_training_authorized_pending_preflight",
  evidencePath: recorded.requestPath,
  nextAction: "run_v7_repair_r1_full_training_preflight",
  nextActionZh: "执行锁定数据、配置、授权和父链预检后按顺序训练三个Stage。",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({ ok: true, commandRef: COMMAND_REF, scope: SCOPE, authorization: recorded, boundaries: {
  fullTrainingAuthorized: true,
  revalidationAuthorized: false,
  formalInferenceAuthorized: false,
  runtimeFrameAuthorized: false,
  worldEntryAuthorized: false,
} }, null, 2))

function parseArgs(values) { const index = values.indexOf("--owner-command"); return { ownerCommand: index >= 0 ? values[index + 1] : null } }
function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function assert(condition, message) { if (!condition) throw new Error(message) }
