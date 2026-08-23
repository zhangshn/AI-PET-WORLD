import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, "project_relative_path_required")
  const target = path.resolve(ROOT, value)
  assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, "project_path_required")
  return target
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const authorizationArg = arg("--authorization")
const authorizationSha256 = arg("--authorization-sha256")
assert.ok(authorizationArg && authorizationSha256, "authorization_binding_required")
const authorizationPath = projectFile(authorizationArg)
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
const consumptionPath = path.join(path.dirname(authorizationPath), "consumption.json")
assert.equal(fs.existsSync(consumptionPath), false, "failed_authorization_must_remain_unconsumed")
const output = projectFile(`.runtime/ai-painter/stage4-controlled-structure-three-arm-cpu-support-failures/${authorization.runId}`)
assert.equal(fs.existsSync(output), false, "failure_output_already_exists")
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = {
  report: path.join(output, "failure-report.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-controlled-structure-three-arm-cpu-support-path-failure-report-v1",
  status: "failed_closed_before_authorization_consumption",
  errorCode: "registered_runtime_physical_mapping_rejected_as_outside_project",
  exactFailure: "Path.relative_to rejected D:/AI-PET-WORLD-DATA/hot/runtime against F:/ai-pet-world after Windows registered .runtime mapping resolution",
  impact: "formal_cpu_support_terminal_not_formed",
  cpuModelRegressionBeforeFormalRun: { status: "passed", positive: "18/18", negative: "13/13" },
  authorization: bind(authorizationPath),
  authorizationConsumed: false,
  checkpointRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  modelWeightsModified: false,
  trainingStarted: false,
  requiredRepair: "validate logical project-relative .runtime path before accepting the registered resolved physical runtime mapping",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const before = sha(planPath)
let planText = fs.readFileSync(planPath, "utf8")
planText = planText.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
planText = planText.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4三臂CPU模型回归18/18与13/13已通过，但正式证据运行在授权消费前因Windows注册.runtime物理映射被误判为项目外路径而失败关闭；未GPU、未训练")
const tempPlan = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(tempPlan, planText, "utf8")
fs.renameSync(tempPlan, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-controlled-structure-three-arm-cpu-support-failure-plan-sync-v1", status: "unique_plan_synchronized_failure_closed", planPath: relative(planPath), beforeSha256: before, afterSha256: sha(planPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-controlled-structure-three-arm-cpu-support-failure-terminal-v1",
  status: "stage4_controlled_structure_three_arm_cpu_support_registered_runtime_path_failed_closed",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  failureReport: bind(files.report),
  authorization: bind(authorizationPath),
  authorizationConsumed: false,
  checkpointRead: false,
  gpuStarted: false,
  trainingStarted: false,
  nextLegalAction: "fix_registered_runtime_logical_to_physical_path_contract_then_use_new_authorization",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 controlled three-arm CPU support path failure closed",
  terminal: bind(files.terminal),
  nextLegalAction: "fix_registered_runtime_logical_to_physical_path_contract_then_use_new_authorization",
  recordedAtUtc: now,
})
for (const target of Object.values(files)) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_controlled_structure_three_arm_cpu_support_failure", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-controlled-structure-three-arm-cpu-support-failure-${authorization.runId}`,
  timestamp: now,
  action: "stage4_controlled_structure_three_arm_cpu_support",
  runId: authorization.runId,
  kind: "cpu_inactive_implementation_failure",
  status: "failed",
  title: "Stage4 controlled structure CPU support path validation failed closed",
  titleZh: "Stage4三臂CPU支持因Windows注册.runtime路径误判失败关闭",
  detailZh: "CPU模型回归已通过，但正式运行在授权消费前停止；没有读取Checkpoint、使用GPU或训练。",
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: JSON.parse(fs.readFileSync(files.terminal, "utf8")).status, terminal: bind(files.terminal), failureReport: bind(files.report), authorizationConsumed: false, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } }, null, 2))
