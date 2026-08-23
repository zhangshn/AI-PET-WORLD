import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")

const runRoot = path.join(
  root,
  ".runtime",
  "ai-painter",
  "stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-smokes",
  runId,
)
const files = {
  terminal: path.join(runRoot, "finalization", "phase-terminal.json"),
  finalization: path.join(runRoot, "finalization", "finalization-report.json"),
  consumption: path.join(runRoot, "gpu-consumption.json"),
  preflight: path.join(runRoot, "preflight-report.json"),
  activeConfig: path.join(runRoot, "active-config.json"),
  telemetry: path.join(runRoot, "training-output", "stage4-step-telemetry.json"),
  progress: path.join(runRoot, "training-output", "progress.json"),
  capsule: path.join(runRoot, "finalization", "local-task-capsule.json"),
  ownerRequest: path.join(runRoot, "finalization", "owner-action-request.json"),
  planSync: path.join(runRoot, "finalization", "plan-sync-record.json"),
  plan: path.join(root, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md"),
}

for (const file of [
  files.terminal,
  files.finalization,
  files.consumption,
  files.preflight,
  files.activeConfig,
  files.telemetry,
  files.progress,
  files.plan,
]) {
  if (!fs.existsSync(file)) throw new Error(`missing evidence: ${logical(file)}`)
}
for (const file of [files.capsule, files.ownerRequest, files.planSync]) {
  if (fs.existsSync(file)) throw new Error(`immutable output exists: ${logical(file)}`)
}

const terminal = readJson(files.terminal)
const finalization = readJson(files.finalization)
const consumption = readJson(files.consumption)
const telemetry = readJson(files.telemetry)
if (
  terminal.status !== "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_execution_failed_closed"
  || finalization.status !== terminal.status
  || consumption.status !== "fact_conditioned_semantic_mixture_stage4_smoke_authorization_atomically_consumed"
  || consumption.oneTimeConsumption !== true
  || telemetry.latestStep !== "optimizer_step"
  || telemetry.latestStatus !== "completed"
  || telemetry.events.some((event) => Number(event.epoch ?? 1) > 1)
  || fs.existsSync(path.join(runRoot, "training-output", "manifest.json"))
  || fs.existsSync(path.join(runRoot, "training-output", "complete-world-ai-assisted-conditional-denoiser.pt"))
) throw new Error("first-Epoch scheduling failure evidence is inconsistent")

const timestamp = new Date().toISOString()
const fixedTotalProgress = { completedStages: 3, totalStages: 5, percent: 60 }
const evidence = {
  terminal: bind(files.terminal),
  finalization: bind(files.finalization),
  executionConsumption: bind(files.consumption),
  preflight: bind(files.preflight),
  activeConfig: bind(files.activeConfig),
  stepTelemetry: bind(files.telemetry),
  progress: bind(files.progress),
}

writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress,
  currentStage: "Stage4 reference-feature shared replay Smoke failed during Epoch 1 scheduling",
  latestBlocker: "first_epoch_shared_replay_requested_before_prior_epoch_identity_exists",
  rootCause: {
    contractRule: "first_epoch_collect_identity_only_keep_existing_supervision",
    observedFailure: "stage4_epoch_complete_shared_replay_selection rejected missing prior-Epoch identity after the first optimizer step",
    classification: "execution_scheduling_wiring_defect_not_visual_gpu_or_data_failure",
  },
  nextLegalAction: "owner_authorized_cpu_bounded_first_epoch_shared_replay_schedule_fix",
  forbiddenActions: [
    "reuse_consumed_authorization",
    "reuse_run_id_or_output_directory",
    "reuse_partial_weights",
    "automatic_smoke_retry",
    "stage0",
    "stage1",
    "stage2",
  ],
  evidence,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(files.ownerRequest, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_executed",
  requestedAction: "fix_first_epoch_shared_replay_schedule_and_run_cpu_regression_before_new_smoke_authorization",
  sourceTerminal: evidence.terminal,
  sourceFinalization: evidence.finalization,
  sourceConsumption: evidence.executionConsumption,
  exactRequiredBehavior: {
    epoch1: "collect luminance and reference-feature identities only; preserve existing non-shared-replay supervision",
    epoch2AndLater: "use prior completed Epoch luminance and reference-feature identities in the existing two replay lanes",
    optimizerStepBudgetChanged: false,
    modelLossDataThresholdChanged: false,
  },
  automaticRetryAuthorized: false,
  stage0Authorized: false,
  fixedTotalProgress,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})

const planText = fs.readFileSync(files.plan, "utf8")
const oldHeader = "状态：active-module-plan / AI Painter固定进度3/5（60%）；完整Epoch逐类别参考特征选择与亮度共享回放的CPU支持和独立只读GPU资格均已通过；尚未执行新配置30 Epoch Smoke或正式Stage 0/1/2训练"
const newHeader = "状态：active-module-plan / AI Painter固定进度3/5（60%）；完整Epoch逐类别参考特征选择与亮度共享回放Smoke已在Epoch 1调度接线处失败关闭；尚未取得当前候选Smoke资格或正式Stage 0/1/2训练资格"
if (!planText.includes(oldHeader)) throw new Error("unique plan header changed")
const anchor = "- stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_selection_and_shared_replay_v1只读GPU资格已通过：48条train、8条validation及既有rollout seeds完成真实CUDA 50步最终解码，四类独立身份、双目标两次共享回放、梯度与Checkpoint资格一致，模型和Autoencoder状态不变。下一步仅可执行一次全新30 Epoch模型Smoke。"
const addition = `${anchor}\n- 当前候选的新配置30 Epoch Smoke已在Epoch 1第一个主优化步骤完成后失败关闭：合同规定首Epoch只收集亮度与参考特征身份并保留既有监督，但训练器提前调用共享回放选择器，因不存在上一Epoch身份而主动拒绝。CPU、CUDA、磁盘、Autoencoder读取、前向、反向及首个优化步骤均正常；未形成Manifest、预览或Checkpoint，因此不是视觉、显卡或数据失败。本次一次性GPU授权已消费，部分权重不得复用；下一步只能有界修正首Epoch共享回放调度并使用全新授权。`
if (!planText.includes(anchor)) throw new Error("unique plan anchor changed")
writeTextAtomic(files.plan, planText.replace(oldHeader, newHeader).replace(anchor, addition))

writeJsonAtomic(files.planSync, {
  schemaVersion: "ai-painter-stage4-plan-sync-record-v1",
  status: "synchronized",
  runId,
  uniqueModulePlan: bind(files.plan),
  terminal: evidence.terminal,
  nextLegalAction: "owner_authorized_cpu_bounded_first_epoch_shared_replay_schedule_fix",
  fixedTotalProgress,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})

for (const file of Object.values(files).filter((value) => fs.existsSync(value))) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: file === files.plan
      ? "ai_painter_unique_module_plan"
      : "stage4_reference_feature_shared_replay_smoke_first_epoch_failure",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: hash(file),
  })
}

appendAiPainterProgramEvent({
  id: `stage4-reference-feature-shared-replay-smoke-first-epoch-failure-${runId}`,
  timestamp,
  action: "stage4_reference_feature_shared_replay_smoke_first_epoch_scheduling_failure",
  runId,
  kind: "gpu_training",
  status: "failed_closed",
  title: "Stage4 reference-feature shared replay Smoke closed by first-Epoch scheduling defect",
  titleZh: "Stage4参考特征共享回放Smoke因首Epoch调度接线缺陷关闭",
  detailZh: "首个主优化步骤完成后，共享回放在尚无上一Epoch身份时被提前调用并失败关闭；不是视觉、显卡或数据失败，未自动重试。",
  evidencePath: logical(files.terminal),
  evidenceSha256: hash(files.terminal),
  fixedTotalProgress,
})

console.log(JSON.stringify({
  status: "recorded",
  terminal: evidence.terminal,
  finalization: evidence.finalization,
  consumption: evidence.executionConsumption,
  localTaskCapsule: bind(files.capsule),
  ownerActionRequest: bind(files.ownerRequest),
  planSyncRecord: bind(files.planSync),
}, null, 2))

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function hash(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function logical(file) {
  return path.relative(root, file).replace(/\\/g, "/")
}

function bind(file) {
  return { path: logical(file), sha256: hash(file) }
}

function writeTextAtomic(file, text) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temp, text, "utf8")
  fs.renameSync(temp, file)
}
