import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const EXPECTED_COMMAND = "允许V7 R2有界修复扩散时刻覆盖、短轨迹监督、Stage预览硬门禁和对象语义审核，并执行一次单样本GPU过拟合Smoke；不授权完整训练、正式推理、RuntimeFrame或进入世界。"
const COMMAND_REF = "owner-authorized-v7-bounded-repair-r2-single-sample-overfit-smoke-20260803"
const REQUEST_ID = "owner-action-request-v7-bounded-repair-r2-resolution-20260803"
const SCOPE = "v7_r2_timestep_short_trajectory_preview_gate_object_audit_single_sample_overfit_smoke_only"
const args = parseArgs(process.argv.slice(2))

assert(args.ownerCommand === EXPECTED_COMMAND, "owner command does not exactly authorize bounded V7 repair R2")

const recorded = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId: REQUEST_ID,
  subsystem: "ai_painter_v7_bounded_repair_r2",
  status: "resolved_owner_authorized",
  taskIdentity: {
    modelId: "ai-pet-world-complete-world-ai-assisted-cold-start-v7",
    failedCheckpointSha256: "572c59f75d55419f7e59bc57546891abfd47665eaa29598ee7acc64516e5164b",
    failedValidationBatchId: "ai-assisted-v7-repair-r1-strict-revalidation-2026-08-03T07-29-22-541Z",
    authorizationScope: SCOPE,
    datasetCapacityCount: 64,
    splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
    conditionChannelCount: 23,
  },
  ownerVisibleConclusionZh: "项目所有者已授权V7 R2有界修复及一次单样本GPU过拟合Smoke。",
  localSystemFindingZh: "修复范围锁定为扩散时刻真实覆盖、短轨迹监督、Stage预览失败硬阻断和对象语义审核；Smoke只验证单样本可学习性，不产生正式候选。",
  blockingReasonCode: "resolved_owner_authorized_v7_bounded_repair_r2_single_sample_overfit_smoke",
  whyCannotProceedZh: "本记录仅解除R2代码修复、静态检查和一次单样本GPU过拟合Smoke阻断；完整训练与所有下游运行仍独立阻断。",
  minimumRequestedActionZh: "完成R2有界实现与检查后执行一次单样本GPU过拟合Smoke，保存全部证据并自动停止。",
  invariants: [
    "dataset_remains_64_with_48_8_4_4_split",
    "condition_channels_remain_23",
    "failed_r1_checkpoint_is_evidence_only",
    "review_thresholds_are_not_lowered",
    "single_sample_smoke_is_nonformal",
  ],
  forbiddenActions: [
    "full_stage0_stage1_stage2_training",
    "strict_challenge_revalidation",
    "formal_model_promotion",
    "formal_image_generation",
    "runtime_frame",
    "world_entry",
  ],
  ownerFacingMessageZh: "V7 R2有界修复与一次单样本GPU过拟合Smoke已获授权；程序必须在Smoke后停止。",
  nextActionAfterAuthorization: [
    "consume_authorization_before_repair_write",
    "implement_timestep_coverage_v2",
    "implement_short_trajectory_supervision",
    "implement_stage_preview_hard_gate",
    "implement_object_semantic_audit",
    "run_read_only_contract_checks",
    "run_one_single_sample_gpu_overfit_smoke",
    "stop_without_full_training_or_inference",
  ],
  evidencePaths: [
    ".runtime/ai-painter/v7-repair-r1-strict-revalidations/ai-assisted-v7-repair-r1-strict-revalidation-2026-08-03T07-29-22-541Z/validation-report.json",
    ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r1/ai-assisted-v7-repair-r1-stage-2-2026-08-03T04-12-49-525Z/manifest.json",
  ],
  ownerDecision: {
    decision: "authorized",
    commandRef: COMMAND_REF,
    commandZh: args.ownerCommand,
    scope: SCOPE,
  },
  resolution: {
    repairImplementationAuthorized: true,
    staticAndContractChecksAuthorized: true,
    singleSampleGpuOverfitSmokeAuthorized: true,
    fullTrainingAuthorized: false,
    strictRevalidationAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
    executionCompleted: false,
  },
}, {
  root: ROOT,
  sourceEvidencePath: ".runtime/ai-painter/v7-repair-r1-strict-revalidations/ai-assisted-v7-repair-r1-strict-revalidation-2026-08-03T07-29-22-541Z/validation-report.json",
  script: "scripts/authorize-ai-assisted-v7-bounded-repair-r2.mjs",
})

appendAiPainterProgramEvent({
  action: "authorize_ai_assisted_v7_bounded_repair_r2",
  runId: REQUEST_ID,
  kind: "owner_authorization_recorded",
  status: "success",
  title: "Owner authorized bounded V7 repair R2 and one single-sample GPU overfit smoke",
  titleZh: "项目所有者已授权V7 R2有界修复及一次单样本GPU过拟合Smoke",
  detail: `${COMMAND_REF}; scope=${SCOPE}`,
  detailZh: "完整训练、严格复验、正式推理、RuntimeFrame和进入世界均未授权。",
  script: "scripts/authorize-ai-assisted-v7-bounded-repair-r2.mjs",
  currentStep: "v7_r2_authorized_pending_atomic_consumption",
  evidencePath: recorded.requestPath,
  nextAction: "consume_v7_r2_authorization_then_apply_bounded_repair",
  nextActionZh: "原子消费授权后执行有界修复、检查和一次单样本GPU过拟合Smoke。",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  ok: true,
  commandRef: COMMAND_REF,
  scope: SCOPE,
  authorization: recorded,
  boundaries: {
    singleSampleGpuOverfitSmokeAuthorized: true,
    fullTrainingAuthorized: false,
    strictRevalidationAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  },
}, null, 2))

function parseArgs(values) {
  const index = values.indexOf("--owner-command")
  return { ownerCommand: index >= 0 ? values[index + 1] : null }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

