import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const runId = "20260823-032204189"
const authorizationPath = path.resolve(ROOT, `.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-controlled-structure-smoke-contract-compilation-${runId}/authorization.json`)
const consumptionPath = path.join(path.dirname(authorizationPath), "consumption.json")
const intendedOutput = path.resolve(ROOT, `.runtime/ai-painter/stage4-controlled-structure-smoke-contract-compilations/${runId}`)
assert.equal(fs.existsSync(authorizationPath), true)
assert.equal(fs.existsSync(consumptionPath), true)
assert.equal(fs.existsSync(intendedOutput), false)
const output = path.resolve(ROOT, `.runtime/ai-painter/stage4-controlled-structure-smoke-contract-compilation-failures/${runId}`)
assert.equal(fs.existsSync(output), false)
fs.mkdirSync(output, { recursive: true })
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const now = new Date().toISOString()
const files = { report: path.join(output, "failure-report.json"), terminal: path.join(output, "phase-terminal.json"), capsule: path.join(output, "local-task-capsule.json"), planSync: path.join(output, "plan-sync-record.json") }
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-controlled-structure-smoke-contract-compilation-parent-namespace-failure-report-v1",
  status: "failed_closed_after_authorization_consumption_before_contract_write",
  errorCode: "output_parent_namespace_missing",
  exactError: "ENOENT while creating immutable run directory because parent stage4-controlled-structure-smoke-contract-compilations did not exist",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  intendedOutputDirectory: relative(intendedOutput),
  intendedOutputAbsent: true,
  cpuRegressionBeforeConsumption: { status: "passed", positive: "13/13", negative: "13/13" },
  contractsWritten: false,
  checkpointRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  smokeStarted: false,
  trainingStarted: false,
  requiredRepair: "create_registered_parent_namespace_before immutable run directory_then_use_new_authorization_and_run_id",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-controlled-structure-smoke-contract-compilation-parent-failure-terminal-v1",
  status: "stage4_controlled_structure_smoke_contract_compilation_parent_namespace_failed_closed",
  failureReport: bind(files.report),
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  authorizationReusable: false,
  runIdReusable: false,
  outputDirectoryReusable: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "fix_parent_namespace_creation_then_compile_with_new_authorization_run_id_and_output",
  recordedAtUtc: now,
})
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Controlled Smoke contract compilation failed closed before contract write", latestTerminal: bind(files.terminal), nextLegalAction: "new_authorization_after_parent_namespace_creation_fix", recordedAtUtc: now })
const planPath = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const before = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4两个受控结构臂GPU资格已通过；受控Smoke合同正式编译因父命名空间缺失在合同写入前失败关闭，未读Checkpoint、未GPU、未训练；需新授权重新编译")
const temporary = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(temporary, plan, "utf8")
fs.renameSync(temporary, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-controlled-structure-smoke-contract-compilation-failure-plan-sync-v1", status: "unique_plan_synchronized_failure_closed", planPath: relative(planPath), beforeSha256: before, afterSha256: sha(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now })
for (const target of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId, artifactType: "stage4_controlled_structure_smoke_contract_compilation_failure", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({ id: `stage4-controlled-structure-smoke-contract-compilation-failure-${runId}`, timestamp: now, action: "stage4_controlled_structure_smoke_contract_compilation", runId, kind: "cpu_contract_compilation_failure", status: "failed", title: "Stage4 controlled Smoke contract compilation failed closed", titleZh: "Stage4受控Smoke合同编译因父命名空间缺失失败关闭", detailZh: "授权已消费但合同尚未写入；未读取Checkpoint、未启动GPU或训练，旧授权与runId不得复用。", evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: JSON.parse(fs.readFileSync(files.terminal, "utf8")).status, terminal: bind(files.terminal), failureReport: bind(files.report), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } }, null, 2))
