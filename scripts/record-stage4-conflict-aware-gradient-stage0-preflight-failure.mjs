import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const runId = "20260822-144118675"
const output = path.resolve(ROOT, `.runtime/ai-painter/stage4-conflict-aware-gradient-stage0-preflight-failures/${runId}`)
if (fs.existsSync(output)) throw new Error("failure evidence namespace already exists")
const authorizationPath = path.resolve(ROOT, ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-conflict-aware-gradient-stage0-execution-20260822-144118589/execution-authorization.json")
const cpuReportPath = path.resolve(ROOT, ".runtime/ai-painter/stage4-semantic-mixture-formal-stage-mode-cpu-regressions/20260822-144057016/cpu-report.json")
const registeredRequestPath = path.resolve(ROOT, ".runtime/ai-painter/owner-action-requests/owner-action-request-stage4-conflict-aware-gradient-stage0-20260822-143923832/request.json")
const planPath = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const expected = new Map([
  [authorizationPath, "d1dc8cb2b9b855f94e77c286b6c92ab04ff5d2eb5546f3a2e9f00b70e702d203"],
  [cpuReportPath, sha(cpuReportPath)],
  [registeredRequestPath, "26b213c44795fbf9ef88797c1764c8de767746093ddc348bfcbad1125d623ffb"],
])
for (const [file, value] of expected) if (!fs.existsSync(file) || sha(file) !== value) throw new Error(`evidence identity changed: ${project(file)}`)
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
const consumptionPath = path.resolve(path.dirname(authorizationPath), "execution-consumption.json")
const formalRunRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${runId}`)
if (authorization.status !== "resolved_owner_authorized_not_consumed" || fs.existsSync(consumptionPath) || fs.existsSync(formalRunRoot)) throw new Error("preflight no-consumption boundary changed")

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const preflightPath = path.join(output, "preflight-report.json")
writeJsonAtomic(preflightPath, {
  schemaVersion: "stage4-conflict-aware-gradient-stage0-preflight-report-v1",
  status: "failed_readonly_preflight_closed",
  stage: 0,
  runId,
  blockers: ["gpu_compute_busy_with_nontraining_workload"],
  authorization: bind(authorizationPath),
  authorizationConsumed: false,
  gpuStarted: false,
  checkpointRead: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
  hardwareAtFailure: {
    gpu: { available: true, name: "NVIDIA GeForce RTX 5050", driverVersion: "610.88", memoryTotalMiB: 8151, memoryUsedMiB: 1317, utilizationPercent: 13, temperatureC: 52, pythonComputeProcessCount: 0, computeProcesses: [] },
  },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
const terminalPath = path.join(output, "phase-terminal.json")
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-conflict-aware-gradient-stage0-preflight-terminal-v1",
  status: "stage4_conflict_aware_gradient_aggregation_stage0_preflight_failed_closed",
  runId,
  blocker: "gpu_compute_busy_with_nontraining_workload",
  preflightReport: bind(preflightPath),
  authorization: bind(authorizationPath),
  authorizationConsumed: false,
  checkpointRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  automaticRetryAllowed: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
const capsulePath = path.join(output, "local-task-capsule.json")
writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: "failed_closed",
  runId,
  task: "one_fresh_conflict_aware_gradient_aggregation_stage0",
  outcomeZh: "CPU与治理门通过；正式资源预检因非训练GPU负载失败，Stage 0未启动。",
  evidence: { terminal: bind(terminalPath), preflight: bind(preflightPath), cpuReport: bind(cpuReportPath) },
  nextLegalAction: "after_gpu_is_idle_create_a_fresh_stage0_authorization_and_run_once",
  forbiddenReuse: { authorization: bind(authorizationPath), runId, formalOutputDirectory: project(formalRunRoot) },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
})
const syncPath = path.join(output, "plan-sync-record.json")
writeJsonAtomic(syncPath, {
  schemaVersion: "ai-painter-stage4-plan-sync-record-v1",
  status: "synchronized",
  runId,
  uniqueModulePlan: bind(planPath),
  terminal: bind(terminalPath),
  nextLegalAction: "owner_authorize_fresh_stage0_after_gpu_idle",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
})
for (const file of [preflightPath, terminalPath, capsulePath, syncPath, planPath]) index(file)
appendAiPainterProgramEvent({
  id: `stage4-conflict-aware-gradient-stage0-preflight-failed-${runId}`,
  timestamp: now,
  action: "stage4_conflict_aware_gradient_stage0_preflight",
  runId,
  kind: "cpu_cuda_resource_preflight",
  status: "failed",
  title: "Stage 0 preflight stopped before authorization consumption",
  titleZh: "Stage 0在授权消费前因非训练GPU负载失败关闭",
  detailZh: "CPU正向59/59、反向57/57通过；GPU利用率13%、显存1317 MiB、Python训练进程0；未读取Checkpoint、未创建优化器、未训练。",
  evidencePath: project(terminalPath),
  evidenceSha256: sha(terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
const nextRequest = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId: `owner-action-request-stage4-conflict-aware-gradient-stage0-gpu-idle-${runId}`,
  subsystem: "ai_painter_stage4_conflict_aware_gradient_stage0",
  status: "waiting_owner_authorization",
  taskIdentity: { stage: 4, action: "fresh_stage0_after_gpu_idle", candidate: "stage4_conflict_aware_existing_gradient_aggregation_v1" },
  ownerVisibleConclusionZh: "Stage 0未启动；正式资源门检测到非训练GPU负载并安全关闭。",
  localSystemFindingZh: "资格、CPU合同与治理均通过，唯一阻断是执行时GPU非训练负载；旧授权未消费但已关闭且不得复用。",
  blockingReasonCode: "gpu_compute_busy_with_nontraining_workload",
  whyCannotProceedZh: "GPU必须处于项目正式资源门允许的空闲状态，且必须建立全新一次性Stage 0授权。",
  minimumRequestedActionZh: "关闭或暂停占用GPU的非训练应用后，授权创建全新Stage 0授权并重新执行一次预检与训练。",
  invariants: ["旧授权、runId及输出目录不得复用", "模型、Loss、数据和审核阈值保持不变"],
  forbiddenActions: ["reuse_closed_authorization", "automatic_retry", "lower_thresholds", "start_stage1", "start_stage2"],
  ownerFacingMessageZh: "请先让GPU处于空闲状态；随后使用下一条新授权执行全新Stage 0。",
  nextActionAfterAuthorization: ["verify_gpu_idle", "create_fresh_stage0_authorization", "run_preflight_once", "run_stage0_once"],
  evidencePaths: [project(terminalPath), project(preflightPath), project(cpuReportPath)],
}, { root: ROOT, script: "scripts/record-stage4-conflict-aware-gradient-stage0-preflight-failure.mjs" })
console.log(JSON.stringify({ status: "failure_recorded_closed", terminal: bind(terminalPath), preflight: bind(preflightPath), capsule: bind(capsulePath), planSync: bind(syncPath), nextOwnerActionRequest: nextRequest }, null, 2))

function sha(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}
function project(file){return path.relative(ROOT,path.resolve(ROOT,file)).replaceAll("\\","/")}
function bind(file){const absolute=path.resolve(ROOT,file);return{path:project(absolute),sha256:sha(absolute)}}
function index(file){const stat=fs.statSync(file);indexArtifact({logicalPath:logicalProjectPath(file),physicalUri:fs.realpathSync(file),storageLayer:"hot",runId,artifactType:"stage4_conflict_aware_gradient_stage0_preflight",byteSize:stat.size,modifiedAtUtc:stat.mtime.toISOString(),sha256:sha(file)})}
