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
const adjudicationRootArg = arg("--adjudication-root")
const cpuReportArg = arg("--cpu-report")
assert.match(runId ?? "", /^\d{8}-\d{9}$/)
assert.ok(adjudicationRootArg && cpuReportArg)
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const adjudicationRoot = absolute(adjudicationRootArg)
const graphReport = path.join(adjudicationRoot, "parameter-graph-report.json")
const decisionPath = path.join(adjudicationRoot, "decision.json")
const cpuReport = absolute(cpuReportArg)
const runner = absolute("ml/ai-painter/scripts/run_stage4_isolated_responsibility_component_readonly_gpu_qualification.py")
const checker = absolute("ml/ai-painter/scripts/check_stage4_isolated_responsibility_component_gpu_entry_cpu.py")
const modelFactory = absolute("ml/ai-painter/src/ai_painter/complete_world/model.py")
const modeRegistry = absolute("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")
for (const target of [graphReport, decisionPath, cpuReport, runner, checker, modelFactory, modeRegistry]) assert.equal(fs.existsSync(target), true)
assert.equal(sha(graphReport), "f3c3e0090f304e121ee56ad11c472ac4a5a9bc4160a3116212f8d506bebe8ff0")
assert.equal(sha(decisionPath), "924210b8a4533603ed90656e497b5f5ccbf275c3ea77bcac244b076e47000ad9")
assert.equal(sha(modelFactory), "66b656e00aab1a2796c219fe85efe8331b972f674f5ce7bce2adee4d800f1527")
assert.equal(sha(modeRegistry), "54cad8a924ee12fe70777a7896b691c794e3baf9e24cf4dbcaa871dd486a8f2a")
const graph = JSON.parse(fs.readFileSync(graphReport, "utf8"))
const decision = JSON.parse(fs.readFileSync(decisionPath, "utf8"))
const cpu = JSON.parse(fs.readFileSync(cpuReport, "utf8"))
assert.equal(decision.decision, "formal_gradient_parameter_subset_contract_mismatch")
assert.equal(graph.summary.ordinaryUnusedCount, 12)
assert.equal(graph.summary.ordinaryRouteAllReachable, true)
assert.equal(graph.summary.formalRouteAllReachable, true)
assert.equal(graph.summary.ordinaryUnusedParameterNames.every((name) => name.includes(".output_bound_condition_probe.")), true)
assert.equal(cpu.status, "passed")
assert.equal(cpu.positive.passed, cpu.positive.total)
assert.equal(cpu.negative.passed, cpu.negative.total)
const output = absolute(`.runtime/ai-painter/stage4-terrain-formal-parameter-subset-corrections/${runId}`)
assert.equal(fs.existsSync(output), false)
fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const files = {
  terminal: path.join(output, "phase-terminal.json"),
  support: path.join(output, "formal-parameter-subset-support-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-isolated-responsibility-component-formal-parameter-subset-support-v1",
  status: "cpu_supported_inactive",
  decision: decision.decision,
  formalResponsibilityParameterRule: "all trainable denoiser parameters reachable from the current component responsibility output",
  inactiveAuxiliaryModuleIdentity: "output_bound_condition_probe",
  inactiveAuxiliaryParameterCount: 12,
  inactiveAuxiliaryParameters: graph.summary.ordinaryUnusedParameterNames,
  routeExpertAndParticipationMustRemainReachable: true,
  finiteNonZeroRequiredForEveryFormalResponsibilityParameter: true,
  freeSubsetInjectionAllowed: false,
  modelFactoryModified: false,
  modeRegistryModified: false,
  recordedAtUtc: now,
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "waiting_owner_authorization",
  requestedAction: "materialize_new_three_component_readonly_gpu_qualification_package_and_execute_in_order",
  reason: "prior terrain authorization was consumed and later authorizations bind the superseded diagnostic runner lineage",
  oldPackageReusable: false,
  oldObjectAndFinalAuthorizationsConsumed: false,
  requiredOrder: ["terrain_route_hydrology_spatial_realization", "per_class_object_semantic_realization", "global_visual_harmonization_and_native_complete_rgb_decode"],
  automaticGpuRetryAuthorized: false,
  smokeAuthorized: false,
  trainingAuthorized: false,
  recordedAtUtc: now,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-terrain-formal-parameter-graph-boundary-adjudication-terminal-v1",
  status: "stage4_terrain_formal_parameter_subset_contract_correction_cpu_succeeded_inactive",
  decision: decision.decision,
  parameterGraphReport: bind(graphReport),
  decisionEvidence: bind(decisionPath),
  cpuReport: bind(cpuReport),
  supportContract: bind(files.support),
  correctedGpuRunner: bind(runner),
  correctedCpuChecker: bind(checker),
  frozenModelFactory: bind(modelFactory),
  frozenModeRegistry: bind(modeRegistry),
  exactUnusedParameterCount: 12,
  exactUnusedParameters: graph.summary.ordinaryUnusedParameterNames,
  oldObjectAndFinalAuthorizationsRemainUnconsumedButAreLineageStale: true,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_authorize_new_three_component_readonly_gpu_qualification_package_only",
  ownerActionRequest: bind(files.owner),
  checkpointRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 terrain formal parameter subset CPU correction passed inactive", latestTerminal: bind(files.terminal), nextLegalAction: "owner_authorize_new_three_component_readonly_gpu_qualification_package_only", gpuStarted: false, smokeStarted: false, trainingStarted: false, recordedAtUtc: now })
const planPath = absolute("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const before = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4地形责任组件计算图已裁决为正式参数子集合同不匹配并完成CPU未激活修正；尚未重新执行GPU资格，未启动Smoke或训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true)
const bullet = "- Stage4地形责任组件计算图边界已唯一裁决为formal_gradient_parameter_subset_contract_mismatch：route expert及participation全部进入正式责任输出；仅output_bound_condition_probe辅助头的12个参数不属于该输出图。只读GPU诊断入口和CPU检查器已改为精确区分正式责任参数与未激活辅助头，CPU正向37/37、反向15/15通过；模型工厂、Mode Registry和Loss未修改，未重跑GPU。下一步需用新证据血缘重新物化三组件只读GPU资格包。\n"
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
const temporary = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(temporary, plan, "utf8")
fs.renameSync(temporary, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-terrain-formal-parameter-subset-correction-plan-sync-v1", status: "unique_plan_synchronized", planPath: relative(planPath), beforeSha256: before, afterSha256: sha(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now })
for (const target of [graphReport, decisionPath, cpuReport, runner, checker, modelFactory, modeRegistry, ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId, artifactType: "stage4_terrain_formal_parameter_subset_cpu_correction", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({ id: `stage4-terrain-formal-parameter-subset-correction-${runId}`, timestamp: now, action: "stage4_terrain_formal_parameter_graph_boundary_adjudication_and_cpu_correction", runId, kind: "cpu_readonly_adjudication_and_bounded_correction", status: "success", title: "Stage4 terrain formal parameter subset corrected", titleZh: "Stage4地形责任组件正式参数子集合同已修正", detailZh: "route正式参数全部可达；仅辅助condition probe的12个参数不属于本次输出图。诊断入口和CPU检查器完成有界修正，未启动GPU或训练。", evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_terrain_formal_parameter_subset_contract_correction_cpu_succeeded_inactive", terminal: bind(files.terminal), graphReport: bind(graphReport), decision: bind(decisionPath), cpuReport: bind(cpuReport), supportContract: bind(files.support), ownerActionRequest: bind(files.owner), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } }, null, 2))
