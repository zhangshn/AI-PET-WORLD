import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const authorizationPath = path.resolve(ROOT, process.argv[2])
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
const root = path.dirname(authorizationPath)
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/")
const bind = (file) => ({ path: rel(file), sha256: sha(file) })
const now = new Date().toISOString()
const files = { report: path.join(root, "cpu-gate-failure-report.json"), terminal: path.join(root, "phase-terminal.json"), capsule: path.join(root, "local-task-capsule.json"), planSync: path.join(root, "plan-sync-record.json") }
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-reference-feature-shared-replay-gpu-cpu-gate-failure-report-v1",
  status: "failed_closed_before_gpu_authorization_consumption",
  errorCode: "windows_project_path_membership_false_rejection",
  error: "resolve_project rejected the authorization outputNamespace before GPU preflight because the CPU checker passed an already-resolved absolute output path into a validator that requires a project-logical relative identity.",
  impact: { cpuGatePassed: false, gpuAuthorizationConsumed: false, checkpointRead: false, gpuStarted: false, trainingStarted: false },
  boundedRepair: "CPU checker must pass the authorization's logical outputNamespace to runner validation and independently compare its resolved value; runner path rejection contract remains unchanged.",
  authorization: bind(authorizationPath), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-reference-feature-shared-replay-gpu-cpu-gate-terminal-v1",
  status: "stage4_reference_feature_shared_replay_gpu_cpu_gate_failed_closed",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  failureReport: bind(files.report), authorization: bind(authorizationPath),
  authorizationConsumed: false, checkpointRead: false, gpuStarted: false, trainingStarted: false,
  automaticRetryStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 reference-feature shared replay readonly GPU CPU gate failed closed before consumption",
  latestTerminal: bind(files.terminal), nextLegalAction: "owner_authorize_bounded_cpu_checker_logical_output_namespace_fix_and_new_readonly_gpu_qualification",
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
const planPath = path.join(ROOT, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；完整Epoch逐类别参考特征共享回放CPU支持已通过，但首次只读GPU资格在授权消费前因CPU检查器输出命名空间参数形态错误而失败关闭；未读取Checkpoint、未启动GPU或训练")
const temporary = `${planPath}.${process.pid}.${Date.now()}.tmp`
const fd = fs.openSync(temporary, "wx")
try { fs.writeFileSync(fd, plan, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
fs.renameSync(temporary, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
for (const file of [authorizationPath, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: authorization.runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({ id: `stage4-reference-feature-shared-replay-gpu-cpu-gate-failure-${authorization.runId}`, timestamp: now, action: "stage4_reference_feature_shared_replay_gpu_cpu_gate", runId: authorization.runId, kind: "cpu_gate_failure", status: "failed", title: "Stage4 reference-feature shared replay GPU CPU gate failed before consumption", titleZh: "Stage4参考特征共享回放GPU的CPU门在消费前失败关闭", detailZh: "CPU检查器把已解析绝对输出路径传给只接受项目逻辑相对路径的运行器验证函数，触发项目内路径误拒绝。GPU授权未消费，未读取Checkpoint、未启动GPU或训练。", evidencePath: rel(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_reference_feature_shared_replay_gpu_cpu_gate_failure_recorded", terminal: bind(files.terminal), failureReport: bind(files.report), capsule: bind(files.capsule) }, null, 2))
