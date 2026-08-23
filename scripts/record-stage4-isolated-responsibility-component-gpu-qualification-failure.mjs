import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
const packageId = arg("--package-id")
const failedOutputArg = arg("--failed-output")
const cpuReportArg = arg("--cpu-report")
assert.match(runId ?? "", /^\d{8}-\d{9}$/)
assert.match(packageId ?? "", /^stage4-isolated-responsibility-component-gpu-qualification-\d{8}-\d{9}$/)
assert.ok(failedOutputArg && cpuReportArg)
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const failedOutput = absolute(failedOutputArg)
const failureReport = path.join(failedOutput, "failure-report.json")
const failedTerminal = path.join(failedOutput, "phase-terminal.json")
const cpuReport = absolute(cpuReportArg)
const packageManifest = absolute(`.runtime/ai-painter/stage4-isolated-responsibility-component-gpu-authorizations/${packageId}/authorization-package.json`)
for (const target of [failureReport, failedTerminal, cpuReport, packageManifest]) assert.equal(fs.existsSync(target), true)
const failure = JSON.parse(fs.readFileSync(failureReport, "utf8"))
assert.equal(failure.status, "isolated_responsibility_component_readonly_gpu_qualification_failed_closed")
assert.equal(failure.roleId, "terrain_route_hydrology_spatial_realization")
assert.equal(JSON.parse(fs.readFileSync(cpuReport, "utf8")).status, "passed")
const manifest = JSON.parse(fs.readFileSync(packageManifest, "utf8"))
assert.equal(manifest.packageId, packageId)
const later = manifest.authorizations.slice(1)
for (const item of later) {
  assert.equal(fs.existsSync(absolute(item.consumptionPath)), false, `${item.roleId}_authorization_must_remain_unconsumed`)
  assert.equal(fs.existsSync(absolute(item.outputDirectory)), false, `${item.roleId}_output_must_remain_absent`)
}
const output = absolute(`.runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualification-failures/${runId}`)
assert.equal(fs.existsSync(output), false)
fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const files = {
  terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "waiting_owner_authorization",
  requestedAction: "cpu_readonly_identify_unused_formal_parameter_graph_boundary_for_terrain_component_only",
  boundFailureTerminal: bind(failedTerminal),
  boundFailureReport: bind(failureReport),
  constraints: {
    gpuRetryAuthorized: false,
    objectComponentAuthorizationConsumptionAuthorized: false,
    finalComponentAuthorizationConsumptionAuthorized: false,
    optimizerAuthorized: false,
    backwardAuthorized: false,
    trainingAuthorized: false,
  },
  recordedAtUtc: now,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-three-isolated-responsibility-component-readonly-gpu-chain-failure-terminal-v1",
  status: "stage4_three_isolated_responsibility_component_readonly_gpu_chain_failed_closed_at_terrain",
  qualificationPackage: bind(packageManifest),
  cpuEntryReport: bind(cpuReport),
  failedRole: "terrain_route_hydrology_spatial_realization",
  failedRoleTerminal: bind(failedTerminal),
  failedRoleReport: bind(failureReport),
  laterRoleAuthorizationsUnconsumed: true,
  laterRoleOutputsAbsent: true,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "cpu_readonly_identify_unused_formal_parameter_graph_boundary_for_terrain_component_only",
  ownerActionRequest: bind(files.owner),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 terrain responsibility component readonly GPU qualification failed closed",
  latestTerminal: bind(files.terminal),
  nextLegalAction: "cpu_readonly_identify_unused_formal_parameter_graph_boundary_for_terrain_component_only",
  gpuRetryAuthorized: false,
  smokeStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
})
const planPath = absolute("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const before = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4地形责任组件只读GPU资格在正式参数计算图检查处失败关闭；对象与最终组件授权未消费，未启动Smoke或训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true)
const bullet = "- Stage4三个责任隔离组件只读GPU资格链在首个地形组件处失败关闭：真实CUDA前向已开始且地形组件授权已消费，但正式参数组中至少一个Tensor未进入本次输出计算图，torch.autograd.grad按失败关闭策略拒绝；对象和最终组件授权保持未消费、输出目录不存在。下一步只允许CPU只读定位未使用参数的正式计算图边界，不得自动重试GPU资格或启动Smoke/训练。\n"
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
const temporary = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(temporary, plan, "utf8")
fs.renameSync(temporary, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-isolated-responsibility-component-gpu-failure-plan-sync-v1", status: "unique_plan_synchronized", planPath: relative(planPath), beforeSha256: before, afterSha256: sha(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now })
for (const target of [failureReport, failedTerminal, cpuReport, packageManifest, ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId, artifactType: "stage4_isolated_responsibility_component_readonly_gpu_qualification_failure", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({ id: `stage4-isolated-responsibility-component-gpu-failure-${runId}`, timestamp: now, action: "stage4_isolated_responsibility_component_readonly_gpu_qualification", runId, kind: "readonly_gpu_qualification", status: "failed_closed", title: "Stage4 isolated responsibility component GPU qualification failed at terrain", titleZh: "Stage4地形责任组件只读GPU资格失败关闭", detailZh: "正式参数组存在未进入本次输出计算图的Tensor；对象与最终组件授权保持未消费，未启动训练。", evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_three_isolated_responsibility_component_readonly_gpu_chain_failed_closed_at_terrain", terminal: bind(files.terminal), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule), planSync: bind(files.planSync), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } }, null, 2))
