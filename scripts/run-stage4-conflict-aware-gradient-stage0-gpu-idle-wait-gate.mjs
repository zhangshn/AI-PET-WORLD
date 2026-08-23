import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
const output = path.resolve(ROOT, `.runtime/ai-painter/stage4-conflict-aware-gradient-stage0-gpu-idle-wait-gates/${runId}`)
if (fs.existsSync(output)) throw new Error("wait gate namespace already exists")
const bindings = {
  priorTerminal: [".runtime/ai-painter/stage4-conflict-aware-gradient-stage0-gpu-idle-rechecks/20260822-145124773/phase-terminal.json", "766853091bf1af68088dcf9efd75c153446ec77416868b3770503fbeb8924e0b"],
  priorReport: [".runtime/ai-painter/stage4-conflict-aware-gradient-stage0-gpu-idle-rechecks/20260822-145124773/gpu-idle-recheck-report.json", "9c19d2da98e1c8a5bc4c08b7e05ae483d0082424cbbb04e0a192b3308fbaefab"],
  ownerRequest: [".runtime/ai-painter/owner-action-requests/owner-action-request-stage4-conflict-aware-gradient-stage0-gpu-idle-retry-20260822-145124773/request.json", "add87456825eaa527f83f47a23fb7db67561fd8994c0aa3973357c83f999a396"],
  cpuReport: [".runtime/ai-painter/stage4-semantic-mixture-formal-stage-mode-cpu-regressions/20260822-144057016/cpu-report.json", "21e91ad77224a7ad7151afdcc2afa6fb16cf23018dd23ee2dc099fe8d80b1160"],
}
for (const [name,[relative,expected]] of Object.entries(bindings)) { const absolute=path.resolve(ROOT,relative); if(!fs.existsSync(absolute)||sha(absolute)!==expected) throw new Error(`${name} identity changed`) }
const limits = { maximumIdleUtilizationPercent: 10, maximumNonTrainingMemoryUsedMiB: 3000, minimumFreeMemoryMiB: 4096 }
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const startedAt = new Date().toISOString()
const samples = []
let consecutive = 0
for (let attempt = 1; attempt <= 180; attempt += 1) {
  const sample = collectGpu(attempt)
  samples.push(sample)
  consecutive = sample.passed ? consecutive + 1 : 0
  process.stdout.write(`${JSON.stringify({kind:"gpu_idle_wait_sample",attempt,utilizationPercent:sample.utilizationPercent,memoryUsedMiB:sample.memoryUsedMiB,pythonComputeProcessCount:sample.pythonComputeProcessCount,passed:sample.passed,consecutive})}\n`)
  if (consecutive >= 3) break
  if (attempt < 180) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000)
}
const passed = consecutive >= 3
const now = new Date().toISOString()
const reportPath = path.join(output, "gpu-idle-wait-report.json")
writeJsonAtomic(reportPath, {
  schemaVersion: "stage4-conflict-aware-gradient-stage0-gpu-idle-wait-report-v1",
  status: passed ? "passed_three_consecutive_gpu_idle_samples" : "gpu_idle_wait_timeout_failed_closed",
  runId, limits, sampleIntervalSeconds: 10, maximumWaitMinutes: 30,
  requiredConsecutivePasses: 3, achievedConsecutivePasses: consecutive,
  samples, boundHashesPassed: true, checkpointRead: false, optimizerCreated: false,
  backwardExecuted: false, gpuTrainingStarted: false,
  startedAtUtc: startedAt, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
const terminalPath = path.join(output, "phase-terminal.json")
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-conflict-aware-gradient-stage0-gpu-idle-wait-terminal-v1",
  status: passed ? "stage4_conflict_aware_gradient_stage0_gpu_idle_wait_passed" : "stage4_conflict_aware_gradient_stage0_gpu_idle_wait_failed_closed",
  runId, report: bind(reportPath), passed, stage0AuthorizationMayBeCreated: passed,
  checkpointRead: false, optimizerCreated: false, backwardExecuted: false, gpuTrainingStarted: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
})
const capsulePath = path.join(output, "local-task-capsule.json")
writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: passed ? "passed" : "failed_closed", runId,
  task: "bounded_gpu_idle_wait_before_conflict_aware_stage0",
  outcomeZh: passed ? "GPU连续三次满足正式空闲门，可以建立全新Stage 0授权。" : "30分钟内GPU未连续三次满足正式空闲门。",
  evidence: { terminal: bind(terminalPath), report: bind(reportPath), cpuReport: bind(bindings.cpuReport[0]) },
  nextLegalAction: passed ? "create_fresh_implementation_lineage_and_stage0_authorization" : "owner_remove_nontraining_gpu_load",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now,
})
const planPath = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const syncPath = path.join(output, "plan-sync-record.json")
writeJsonAtomic(syncPath, { schemaVersion:"ai-painter-stage4-plan-sync-record-v1",status:"synchronized",runId,uniqueModulePlan:bind(planPath),terminal:bind(terminalPath),nextLegalAction:passed?"create_and_consume_fresh_stage0_authorization":"owner_remove_nontraining_gpu_load",fixedTotalProgress:{completedStages:3,totalStages:5,percent:60},recordedAtUtc:now })
for (const file of [reportPath,terminalPath,capsulePath,syncPath,planPath]) index(file)
appendAiPainterProgramEvent({ id:`stage4-conflict-aware-stage0-gpu-idle-wait-${runId}`,timestamp:now,action:"stage4_conflict_aware_stage0_gpu_idle_wait",runId,kind:"bounded_readonly_gpu_idle_wait",status:passed?"success":"failed",title:passed?"Stage 0 GPU idle wait passed":"Stage 0 GPU idle wait failed",titleZh:passed?"Stage 0 GPU空闲等待门通过":"Stage 0 GPU空闲等待门失败",detailZh:passed?`连续三次GPU利用率不超过10%；samples=${samples.length}`:`30分钟等待未通过；samples=${samples.length}`,evidencePath:project(terminalPath),evidenceSha256:sha(terminalPath),fixedTotalProgress:{completedStages:3,totalStages:5,percent:60} })
const ownerRequest = recordAiPainterOwnerActionRequest({
  schemaVersion:"ai-painter-owner-action-request-input-v1",
  requestId:`owner-action-request-stage4-conflict-aware-gradient-stage0-wait-${runId}`,
  subsystem:"ai_painter_stage4_conflict_aware_gradient_stage0",
  status:passed?"owner_authorized_pending_execution":"waiting_owner_authorization",
  taskIdentity:{stage:4,action:passed?"run_fresh_stage0":"remove_gpu_load",candidate:"stage4_conflict_aware_existing_gradient_aggregation_v1",waitGateRunId:runId},
  ownerVisibleConclusionZh:passed?"GPU空闲门通过，Owner已授权继续建立并消费全新Stage 0授权。":"GPU空闲等待超时，Stage 0未启动。",
  localSystemFindingZh:passed?"连续三次GPU资源状态满足正式门限。":"30分钟内GPU资源状态未连续三次满足正式门限。",
  blockingReasonCode:passed?"owner_authorized_stage0_pending_atomic_execution":"gpu_compute_busy_with_nontraining_workload",
  whyCannotProceedZh:passed?"必须建立全新实施血缘和一次性执行授权后才能训练。":"必须先移除非训练GPU负载。",
  minimumRequestedActionZh:passed?"立即建立并原子消费全新Stage 0授权并执行一次训练。":"关闭GPU应用后另行授权。",
  invariants:["GPU正式门限不变","模型、Loss、数据和审核阈值不变","旧授权、runId和输出目录不得复用"],
  forbiddenActions:["reuse_old_authorization","reuse_checkpoint","automatic_retry","lower_resource_gate","modify_model_or_loss","start_stage1","start_stage2"],
  ownerFacingMessageZh:passed?"资源门已通过，项目可立即进入本次全新Stage 0。":"资源门未通过，本轮已安全关闭。",
  nextActionAfterAuthorization:passed?["create_fresh_implementation_lineage","create_and_consume_fresh_stage0_authorization","run_stage0_once"]:["remove_nontraining_gpu_load"],
  evidencePaths:[project(terminalPath),project(reportPath),project(bindings.cpuReport[0])],
},{root:ROOT,script:"scripts/run-stage4-conflict-aware-gradient-stage0-gpu-idle-wait-gate.mjs"})
console.log(JSON.stringify({status:passed?"gpu_idle_wait_passed":"gpu_idle_wait_failed_closed",terminal:bind(terminalPath),report:bind(reportPath),ownerRequest},null,2))
process.exitCode = passed ? 0 : 1

function collectGpu(attempt){
  const gpu=spawnSync("nvidia-smi",["--query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu","--format=csv,noheader,nounits"],{encoding:"utf8"})
  if(gpu.status!==0) return {attempt,recordedAtUtc:new Date().toISOString(),available:false,passed:false,error:gpu.stderr.trim()}
  const parts=gpu.stdout.trim().split(/,\s*/)
  const apps=spawnSync("nvidia-smi",["--query-compute-apps=pid,process_name","--format=csv,noheader,nounits"],{encoding:"utf8"})
  const pythonComputeProcessCount=apps.stdout.split(/\r?\n/).filter(line=>/python(?:\.exe)?/i.test(line)).length
  const sample={attempt,recordedAtUtc:new Date().toISOString(),available:true,name:parts[0],driverVersion:parts[1],memoryTotalMiB:Number(parts[2]),memoryUsedMiB:Number(parts[3]),utilizationPercent:Number(parts[4]),temperatureC:Number(parts[5]),pythonComputeProcessCount}
  sample.freeMemoryMiB=sample.memoryTotalMiB-sample.memoryUsedMiB
  sample.passed=sample.utilizationPercent<=limits.maximumIdleUtilizationPercent&&sample.memoryUsedMiB<=limits.maximumNonTrainingMemoryUsedMiB&&sample.freeMemoryMiB>=limits.minimumFreeMemoryMiB&&pythonComputeProcessCount===0
  return sample
}
function sha(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}
function project(file){return path.relative(ROOT,path.resolve(ROOT,file)).replaceAll("\\","/")}
function bind(file){const absolute=path.resolve(ROOT,file);return{path:project(absolute),sha256:sha(absolute)}}
function index(file){const stat=fs.statSync(file);indexArtifact({logicalPath:logicalProjectPath(file),physicalUri:fs.realpathSync(file),storageLayer:"hot",runId,artifactType:"stage4_conflict_aware_stage0_gpu_idle_wait",byteSize:stat.size,modifiedAtUtc:stat.mtime.toISOString(),sha256:sha(file)})}
