import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
const evidence = {
  correctedTerminal: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/phase-terminal.json", "010771f7555e29043aee5dda7b142c820ef7d2a1ff0d55ea2a4bdea928cd4391"],
  correctedReport: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/cross-arm-comparison-report.json", "9ce5de9674a55f40da17b2fe791d6d90482f51f732c7638e69c1a267f6d6a7e7"],
  correctedDecision: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/cross-arm-adjudication.json", "adf504f93eef3646fcfa66bdba45108e97c115beeede488d5bae7d1c2b489337"],
  correctedActionRequest: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/owner-action-request.json", "b4e93240445072b2ba4beec40e0f284afd92ca12a128d00b867122829cfd4140"],
  mappingCpuReport: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-owner-action-mapping-cpu/20260823-055400000/cpu-report.json", "d3cee1b427c28028cbe8d00876dff0baedae0dbafa27fe47ccdac8840fdf9785"],
}
for (const [name, [relative, expected]] of Object.entries(evidence)) {
  const absolute = path.resolve(ROOT, relative)
  if (!fs.existsSync(absolute) || sha(absolute) !== expected) throw new Error(`${name} identity changed`)
}
const decision = JSON.parse(fs.readFileSync(path.resolve(ROOT, evidence.correctedDecision[0]), "utf8"))
if (decision.outcome !== "condition_fusion_only_priority" || decision.stage0Authorized !== false) throw new Error("winner decision identity invalid")
const requestId = `owner-action-request-stage4-condition-fusion-winner-stage0-${runId}`
const result = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId,
  subsystem: "ai_painter_stage4_condition_fusion_winner_stage0",
  status: "owner_authorized_pending_execution",
  taskIdentity: { stage: 4, action: "run_stage0", candidate: "condition_fusion_only_final_direct_residual_23_64_12", resolution: { width: 256, height: 192 }, epochs: 40, seed: 20263722, splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 } },
  ownerVisibleConclusionZh: "受控结构对照已正式选择条件融合臂，Owner已授权一次全新Stage 0正式训练。",
  localSystemFindingZh: "本地程序已验证跨臂裁决、训练资源遥测和取代旧模板的Stage 0动作映射。",
  blockingReasonCode: "owner_authorized_condition_fusion_stage0_pending_atomic_execution",
  whyCannotProceedZh: "必须先完成CPU、活动配置、Trainer及资源门禁，再原子消费一次性Stage 0授权。",
  minimumRequestedActionZh: "执行条件融合结构固定256×192、40 Epoch的全新Stage 0；成功仅请求Stage 1，失败保存真实视觉证据。",
  invariants: ["原始64份数据及48/8/4/4划分不变", "23通道、Loss、Checkpoint格式和审核阈值不变", "Autoencoder冻结且Denoiser固定随机初始化", "不读取Smoke或历史Checkpoint"],
  forbiddenActions: ["rerun_controlled_smokes", "reuse_checkpoint", "automatic_retry", "free_tuning", "lower_thresholds", "start_stage1", "start_stage2", "stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"],
  ownerFacingMessageZh: "新的Stage 0请求已取代旧的两臂重跑模板；历史请求保留为不可变记录。",
  nextActionAfterAuthorization: ["run_cpu_regression", "audit_active_stage0_config", "run_node_trainer_readonly_preflight", "run_python_cuda_disk_preflight", "atomically_consume_stage0_authorization", "run_one_stage0_training"],
  evidencePaths: Object.values(evidence).map(([relative]) => relative),
  ownerDecision: { status: "authorized", commandRef: "owner-authorized-stage4-condition-fusion-winner-stage0-20260823", scope: "one_fresh_condition_fusion_stage0_training_only" },
}, { root: ROOT, script: "scripts/register-stage4-condition-fusion-winner-stage0-owner-action-request.mjs" })
console.log(JSON.stringify(result, null, 2))

function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
