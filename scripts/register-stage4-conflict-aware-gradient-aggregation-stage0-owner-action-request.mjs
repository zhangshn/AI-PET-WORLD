import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")

const evidence = {
  qualificationTerminal: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-142452041/phase-terminal.json", "dbaf16d2edbd6faa4d60aad001555c54ed21df493a44c62ebceb8dff0afcb7fc"],
  qualificationReport: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-142452041/timeline-qualification-report.json", "41021fa164cef99804b9f8cde27f93c4576e2421718eab0ad161dd3d215a099d"],
  qualificationDecision: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-142452041/qualification-decision.json", "c4d5f90cca9142ba2fe06864af92cb542a7a62056a538b551781d078efe2f861"],
  sourceActionRequest: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-142452041/stage0-owner-action-request.json", "2ad8c1c14adb7c27f4046dbf968f3d7bd7f9e4701a8fe741e25ce856a02267f9"],
  smokeManifest: [".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-smokes/20260822-140244840/training-output/manifest.json", "ac79b903c5bd493b49e166cce54ea5142ae5d5fe28cb9cc9a2990b7d8a8291a5"],
  machineReview: [".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-smokes/20260822-140244840/training-output/fixed-preview-reviews.json", "f3fec75932dbaec969309df7200fd22a12ae10521f24fd07fa18a89cb59d9697"],
  inactiveConfig: [".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/inactive-config.json", "f9c7dbc10f31f728034e30722ca13e85d9b6d13e8377fe38a0d661582322c644"],
  supportContract: [".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/training-paradigm-support-contract.json", "69248e28e3d906bbac671503cfe4a65abce59d4386c9b7ed5cb040d59b9aac67"],
}
for (const [name, [relative, expected]] of Object.entries(evidence)) {
  const absolute = path.resolve(ROOT, relative)
  if (!fs.existsSync(absolute) || sha(absolute) !== expected) throw new Error(`${name} identity changed`)
}

const requestId = `owner-action-request-stage4-conflict-aware-gradient-stage0-${runId}`
const result = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId,
  subsystem: "ai_painter_stage4_conflict_aware_gradient_stage0",
  status: "owner_authorized_pending_execution",
  taskIdentity: {
    stage: 4,
    action: "run_stage0",
    candidate: "stage4_conflict_aware_existing_gradient_aggregation_v1",
    resolution: { width: 256, height: 192 },
    epochs: 40,
    seed: 20263722,
    splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
  },
  ownerVisibleConclusionZh: "冲突感知梯度聚合候选已通过后期稳定资格，Owner已授权一次全新Stage 0正式训练。",
  localSystemFindingZh: "本地程序已验证资格、Smoke证据、未激活配置和训练范式支持合同的不可变身份。",
  blockingReasonCode: "owner_authorized_stage0_pending_atomic_execution",
  whyCannotProceedZh: "必须完成CPU、活动配置、真实Trainer、CUDA资源和磁盘门禁，并原子消费一次性Stage 0授权后才能训练。",
  minimumRequestedActionZh: "执行一次固定256×192、40 Epoch的Stage 0正式训练；成功仅生成Stage 1动作请求，失败保存真实视觉证据。",
  invariants: [
    "64/64批准数据及48/8/4/4划分不变",
    "模型结构、Loss数值与权重、Checkpoint格式和机器审核阈值不变",
    "Autoencoder冻结且Denoiser从固定随机初始化开始",
    "一次总Loss backward及一次optimizer step",
  ],
  forbiddenActions: [
    "reuse_smoke_or_historical_checkpoint", "automatic_retry", "free_hyperparameter_tuning",
    "lower_machine_review_thresholds", "start_stage1", "start_stage2", "start_stage5",
    "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry",
  ],
  ownerFacingMessageZh: "本次Stage 0授权已登记为当前latest；旧请求保留且不再作为本次执行来源。",
  nextActionAfterAuthorization: [
    "run_cpu_positive_negative_gate", "compile_and_audit_active_stage0_config",
    "run_real_node_trainer_readonly_preflight", "run_python_cuda_disk_preflight",
    "atomically_consume_fresh_stage0_authorization", "run_one_stage0_training",
  ],
  evidencePaths: Object.values(evidence).map(([relative]) => relative),
  ownerDecision: {
    status: "authorized",
    commandRef: "owner-authorized-stage4-conflict-aware-existing-gradient-aggregation-stage0-20260822",
    scope: "one_fresh_stage0_training_only",
  },
}, {
  root: ROOT,
  script: "scripts/register-stage4-conflict-aware-gradient-aggregation-stage0-owner-action-request.mjs",
})
console.log(JSON.stringify(result, null, 2))

function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
