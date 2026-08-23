import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const authorizationInput = process.argv[2]
assert.ok(authorizationInput, "authorization_required")
const authorizationPath = path.resolve(ROOT, authorizationInput)
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
const output = path.resolve(ROOT, authorization.outputNamespace)
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/")
const bind = (file) => ({ path: rel(file), sha256: sha(file) })
const terminalPath = path.join(output, "phase-terminal.json")
const reportPath = path.join(output, "gpu-qualification-report.json")
const cudaPath = path.join(output, "cuda-telemetry.json")
const terminal = JSON.parse(fs.readFileSync(terminalPath, "utf8"))
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))
assert.equal(terminal.status, "stage4_reference_feature_shared_replay_readonly_gpu_qualification_succeeded_closed")
assert.equal(report.status, "passed_stage4_reference_feature_shared_replay_readonly_gpu_qualification")
assert.equal(report.safety.optimizerCreated, false)
assert.equal(report.safety.backwardExecuted, false)
assert.equal(report.safety.modelWeightsModified, false)
assert.equal(report.safety.trainingStarted, false)
const now = new Date().toISOString()
const capsule = path.join(output, "local-task-capsule.json")
const planSync = path.join(output, "plan-sync-record.json")
const owner = path.join(output, "owner-action-request.json")
writeJsonAtomic(owner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "owner_stage4_30_epoch_smoke_authorization_required_not_authorized",
  requestedAction: "compile_and_execute_stage4_reference_feature_shared_replay_30_epoch_model_smoke",
  boundGpuTerminal: bind(terminalPath), boundGpuReport: bind(reportPath), boundCudaTelemetry: bind(cudaPath),
  automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 full-Epoch per-class reference-feature shared replay readonly GPU qualification passed",
  latestTerminal: bind(terminalPath), latestGpuReport: bind(reportPath), latestCudaTelemetry: bind(cudaPath),
  nextLegalAction: "owner_authorize_one_new_30_epoch_model_smoke_for_current_contract",
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
const planPath = path.join(ROOT, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；完整Epoch逐类别参考特征选择与亮度共享回放的CPU支持和独立只读GPU资格均已通过；尚未执行新配置30 Epoch Smoke或正式Stage 0/1/2训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true)
const bullet = "- stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_selection_and_shared_replay_v1只读GPU资格已通过：48条train、8条validation及既有rollout seeds完成真实CUDA 50步最终解码，四类独立身份、双目标两次共享回放、梯度与Checkpoint资格一致，模型和Autoencoder状态不变。下一步仅可执行一次全新30 Epoch模型Smoke。\n"
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
const temp = `${planPath}.${process.pid}.${Date.now()}.tmp`
const fd = fs.openSync(temp, "wx")
try { fs.writeFileSync(fd, plan, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
fs.renameSync(temp, planPath)
writeJsonAtomic(planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), terminal: bind(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
for (const file of [authorizationPath, terminalPath, reportPath, cudaPath, owner, capsule, planSync]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: authorization.runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({ id: `stage4-reference-feature-shared-replay-gpu-${authorization.runId}`, timestamp: now, action: "stage4_reference_feature_shared_replay_readonly_gpu_qualification", runId: authorization.runId, kind: "readonly_gpu_qualification", status: "success", title: "Stage4 reference-feature shared replay readonly GPU qualification passed", titleZh: "Stage4参考特征共享回放只读GPU资格通过", detailZh: "48条train与8条validation既有种子完成真实CUDA 50步解码；四类选择、双目标共享回放、梯度和身份通过，未训练或修改权重。", evidencePath: rel(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_reference_feature_shared_replay_gpu_success_recorded", terminal: bind(terminalPath), report: bind(reportPath), cudaTelemetry: bind(cudaPath), ownerActionRequest: bind(owner), capsule: bind(capsule), planSync: bind(planSync) }, null, 2))
