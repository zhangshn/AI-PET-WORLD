import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
const output = path.resolve(ROOT, `.runtime/ai-painter/stage4-conflict-aware-gradient-stage0-gpu-idle-rechecks/${runId}`)
if (fs.existsSync(output)) throw new Error("recheck evidence namespace already exists")
const files = {
  priorTerminal: [".runtime/ai-painter/stage4-conflict-aware-gradient-stage0-gpu-idle-rechecks/20260822-144921624/phase-terminal.json", "99a5e6a5e17b0a8c7e26589d2d771848dcf76bf27e309d09ed832152573d4708"],
  priorPreflight: [".runtime/ai-painter/stage4-conflict-aware-gradient-stage0-gpu-idle-rechecks/20260822-144921624/gpu-idle-recheck-report.json", "6c3077bb5216e1735c16a12b8fe268bcb0ed1d05d50e96d5b9f911fd714c137d"],
  cpuReport: [".runtime/ai-painter/stage4-semantic-mixture-formal-stage-mode-cpu-regressions/20260822-144057016/cpu-report.json", "21e91ad77224a7ad7151afdcc2afa6fb16cf23018dd23ee2dc099fe8d80b1160"],
  ownerRequest: [".runtime/ai-painter/owner-action-requests/owner-action-request-stage4-conflict-aware-gradient-stage0-gpu-idle-retry-20260822-144921624/request.json", "9530c0173f56b977e778a738ca6427f7941f3a440169b9c8664862b4f136aa3e"],
}
for (const [name,[relative,expected]] of Object.entries(files)) { const absolute=path.resolve(ROOT,relative); if(!fs.existsSync(absolute)||sha(absolute)!==expected) throw new Error(`${name} identity changed`) }
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const reportPath = path.join(output, "gpu-idle-recheck-report.json")
writeJsonAtomic(reportPath, {
  schemaVersion: "stage4-conflict-aware-gradient-stage0-gpu-idle-recheck-v1",
  status: "gpu_idle_recheck_failed_closed",
  runId,
  boundHashesPassed: true,
  python: { torch: "2.11.0+cu128", cudaAvailable: true, deviceCount: 1, deviceName: "NVIDIA GeForce RTX 5050" },
  gpu: { name: "NVIDIA GeForce RTX 5050", driverVersion: "610.88", memoryTotalMiB: 8151, memoryUsedMiB: 1154, utilizationPercent: 12, temperatureC: 51, pythonComputeProcessCount: 0 },
  formalLimits: { maximumIdleUtilizationPercent: 10, maximumNonTrainingMemoryUsedMiB: 3000, minimumFreeMemoryMiB: 4096 },
  blocker: "gpu_compute_busy_with_nontraining_workload",
  diskFreeBytes: 109301391360,
  freshImplementationAuthorizationCreated: false,
  freshStage0AuthorizationCreated: false,
  authorizationConsumed: false,
  checkpointRead: false,
  gpuTrainingStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
const terminalPath = path.join(output, "phase-terminal.json")
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-conflict-aware-gradient-stage0-gpu-idle-recheck-terminal-v1",
  status: "stage4_conflict_aware_gradient_aggregation_stage0_gpu_idle_recheck_failed_closed",
  runId,
  blocker: "gpu_compute_busy_with_nontraining_workload",
  report: bind(reportPath),
  priorFailure: bind(files.priorTerminal[0]),
  stage0Started: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  automaticRetryAllowed: false,
  recordedAtUtc: now,
})
const capsulePath = path.join(output, "local-task-capsule.json")
writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: "failed_closed",
  runId,
  task: "verify_gpu_idle_before_fresh_conflict_aware_stage0",
  outcomeZh: "绑定、CUDA和磁盘通过；GPU利用率12%高于正式空闲上限10%，未建立或消费训练授权。",
  evidence: { report: bind(reportPath), terminal: bind(terminalPath), cpuReport: bind(files.cpuReport[0]) },
  nextLegalAction: "owner_authorize_one_new_gpu_idle_check_after_nontraining_gpu_load_is_removed",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
})
const planPath = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const syncPath = path.join(output, "plan-sync-record.json")
writeJsonAtomic(syncPath, { schemaVersion: "ai-painter-stage4-plan-sync-record-v1", status: "synchronized", runId, uniqueModulePlan: bind(planPath), terminal: bind(terminalPath), nextLegalAction: "remove_nontraining_gpu_load_then_authorize_one_fresh_check", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now })
for (const file of [reportPath, terminalPath, capsulePath, syncPath, planPath]) index(file)
appendAiPainterProgramEvent({ id:`stage4-conflict-aware-stage0-gpu-idle-recheck-failed-${runId}`,timestamp:now,action:"stage4_conflict_aware_stage0_gpu_idle_recheck",runId,kind:"readonly_gpu_idle_check",status:"failed",title:"Stage 0 GPU idle recheck failed closed",titleZh:"Stage 0 GPU空闲复检失败关闭",detailZh:"GPU利用率12%高于正式上限10%；未建立授权、未读取Checkpoint、未训练。",evidencePath:project(terminalPath),evidenceSha256:sha(terminalPath),fixedTotalProgress:{completedStages:3,totalStages:5,percent:60} })
const nextRequest = recordAiPainterOwnerActionRequest({
  schemaVersion:"ai-painter-owner-action-request-input-v1",
  requestId:`owner-action-request-stage4-conflict-aware-gradient-stage0-gpu-idle-retry-${runId}`,
  subsystem:"ai_painter_stage4_conflict_aware_gradient_stage0",status:"waiting_owner_authorization",
  taskIdentity:{stage:4,action:"fresh_gpu_idle_check_then_stage0",candidate:"stage4_conflict_aware_existing_gradient_aggregation_v1"},
  ownerVisibleConclusionZh:"唯一一次GPU空闲复检仍未通过，Stage 0未启动。",
  localSystemFindingZh:"全部不可变绑定、CUDA和磁盘通过；GPU利用率12%高于正式上限10%。",
  blockingReasonCode:"gpu_compute_busy_with_nontraining_workload",
  whyCannotProceedZh:"必须先移除非训练GPU负载，再以全新命令范围执行一次资源门和全新Stage 0授权。",
  minimumRequestedActionZh:"关闭GPU加速应用后，授权一次新的GPU空闲检查；通过后直接建立并消费全新Stage 0授权。",
  invariants:["正式GPU空闲上限10%不变","模型、Loss、数据与审核阈值不变","所有旧授权和runId不得复用"],
  forbiddenActions:["reuse_old_authorization","automatic_retry","lower_resource_gate","modify_model_or_loss","start_stage1","start_stage2"],
  ownerFacingMessageZh:"请先关闭或暂停浏览器硬件加速、NVIDIA Overlay、游戏或其他GPU应用，再发送下一条授权。",
  nextActionAfterAuthorization:["run_one_gpu_idle_check","create_fresh_implementation_lineage","create_and_consume_fresh_stage0_authorization","run_stage0_once"],
  evidencePaths:[project(terminalPath),project(reportPath),project(files.cpuReport[0])],
},{root:ROOT,script:"scripts/record-stage4-conflict-aware-gradient-stage0-gpu-idle-recheck-failure.mjs"})
console.log(JSON.stringify({status:"gpu_idle_recheck_failure_recorded",terminal:bind(terminalPath),report:bind(reportPath),capsule:bind(capsulePath),planSync:bind(syncPath),nextOwnerActionRequest:nextRequest},null,2))

function sha(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}
function project(file){return path.relative(ROOT,path.resolve(ROOT,file)).replaceAll("\\","/")}
function bind(file){const absolute=path.resolve(ROOT,file);return{path:project(absolute),sha256:sha(absolute)}}
function index(file){const stat=fs.statSync(file);indexArtifact({logicalPath:logicalProjectPath(file),physicalUri:fs.realpathSync(file),storageLayer:"hot",runId,artifactType:"stage4_conflict_aware_stage0_gpu_idle_recheck",byteSize:stat.size,modifiedAtUtc:stat.mtime.toISOString(),sha256:sha(file)})}
