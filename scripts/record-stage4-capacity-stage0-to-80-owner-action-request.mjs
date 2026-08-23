import path from "node:path"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const runId = "20260823-083751371"
const terminal = `.runtime/ai-painter/stage4-condition-fusion-stage0-final-route-adjudications/${runId}/phase-terminal.json`
const plan = `.runtime/ai-painter/stage4-stage0-to-80-continuation-plan-compilations/${runId}/execution-plan.json`
const action = `.runtime/ai-painter/stage4-stage0-to-80-continuation-plan-compilations/${runId}/owner-action-request.json`
const result = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId: `owner-action-request-stage4-capacity-stage0-to-80-${runId}`,
  subsystem: "ai_painter_stage4_capacity_stage0_to_stage2_continuation",
  status: "waiting_owner_authorization",
  taskIdentity: { stage: 4, candidate: "stage4_capacity_only_base_width_64_to_existing_level1_128", controlledStructureArm: "capacity_only_base_width_64_to_existing_level1_128", planCompilationRunId: runId },
  ownerVisibleConclusionZh: "条件融合路线已正式退出，容量臂是唯一剩余路线；Stage 0→1→2闭环总包已编译并通过CPU审计。",
  localSystemFindingZh: "计划仅绑定容量臂，三阶段独立消费且只从同包前序成功终态物化父Checkpoint；历史十包均失败关闭。",
  blockingReasonCode: "owner_offline_signature_required_for_unique_capacity_continuation_package",
  whyCannotProceedZh: "项目治理要求Owner私钥只能离线使用；本地程序和Codex均不得读取或代签。",
  minimumRequestedActionZh: "Owner仅执行一次计划中给出的离线签署命令；签署后本地持续执行器依次执行Stage 0、Stage 1和Stage 2。",
  invariants: ["原始64份数据及48/8/4/4划分不变", "23通道与冻结Autoencoder不变", "现有Loss和审核阈值不变", "只有同包前序成功Checkpoint可用于下一阶段"],
  forbiddenActions: ["reuse_historical_package", "reuse_failed_checkpoint", "automatic_retry", "add_candidate", "add_loss", "change_data", "lower_review_thresholds", "stage5", "world_entry"],
  ownerFacingMessageZh: "这是本路线唯一一次离线签署请求；签署后不再逐阶段要求Owner操作，除非出现真实失败或证据冲突。",
  nextActionAfterAuthorization: ["sign_unique_capacity_stage0_to_stage2_package_once", "run_local_continuous_executor"],
  evidencePaths: [terminal, plan, action],
  ownerDecision: { status: "not_yet_authorized", commandRef: "pending_owner_offline_signature", scope: "capacity_stage0_stage1_stage2_continuation_only" },
}, { root: process.cwd(), sourceEvidencePath: terminal, script: path.relative(process.cwd(), new URL(import.meta.url).pathname).replaceAll("\\", "/") })
console.log(JSON.stringify(result, null, 2))
