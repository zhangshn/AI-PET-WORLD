import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const ROLE_ORDER = Object.freeze([
  "terrain_route_hydrology_spatial_realization",
  "per_class_object_semantic_realization",
  "global_visual_harmonization_and_native_complete_rgb_decode",
])
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const freshJson = (target, body) => { fs.mkdirSync(path.dirname(target), { recursive: true }); const handle = fs.openSync(target, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
const authorizationArg = arg("--authorization"), authorizationSha256 = arg("--authorization-sha256"), consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = file(authorizationArg), consumptionPath = file(consumptionArg)
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-isolated-responsibility-component-cpu-support-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_inactive_three_responsibility_isolated_component_implementation_only")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  const target = file(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
  assert.equal(/\.(pt|pth|ckpt|safetensors)$/iu.test(evidence.path), false, `${name}_checkpoint_forbidden`)
}
const structuralSourcePath = file(authorization.structuralSource.path)
assert.equal(sha(structuralSourcePath), authorization.structuralSource.sha256, "structural_source_sha256_mismatch")
assert.equal(authorization.structuralSource.use, "immutable_existing_formal_topology_source_only_not_execution_identity")
const programs = {
  runner: file("scripts/run-stage4-isolated-responsibility-component-cpu-support.mjs"),
  compiler: file("ml/ai-painter/scripts/compile_stage4_isolated_responsibility_component_inactive_configs.py"),
  checker: file("ml/ai-painter/scripts/check_stage4_isolated_responsibility_component_cpu.py"),
  modelFactory: file("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: file("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = file(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_already_exists")
const python = file("ml/ai-painter/.venv/Scripts/python.exe")
const source = authorization.sourceEvidence
const checkerArgs = [
  programs.checker,
  "--source-config", rel(structuralSourcePath),
  "--source-family-contract", source.componentFamilyContract.path,
  "--source-parameter-audit", source.parameterSourceAudit.path,
  "--source-evidence-isolation", source.evidenceIsolationContract.path,
]
const syntax = spawnSync(python, ["-m", "py_compile", programs.modelFactory, programs.modeRegistry, programs.compiler, programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(syntax.status, 0, `python_syntax_check_failed:${syntax.stderr}`)
const check = spawnSync(python, checkerArgs, { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout)
assert.equal(cpu.status, "passed")
assert.equal(cpu.positive.passed, cpu.positive.total)
assert.equal(cpu.negative.passed, cpu.negative.total)
const consumedAtUtc = new Date().toISOString()
freshJson(consumptionPath, {
  schemaVersion: "stage4-isolated-responsibility-component-cpu-support-consumption-v1",
  status: "stage4_isolated_responsibility_component_cpu_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorizationPath: authorizationArg,
  authorizationSha256,
  oneTimeConsumption: true,
  consumedAtUtc,
  consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
})
fs.mkdirSync(output, { recursive: true })
const inactiveDir = path.join(output, "inactive-configs")
const compile = spawnSync(python, [
  programs.compiler,
  "--source-config", rel(structuralSourcePath),
  "--source-family-contract", source.componentFamilyContract.path,
  "--source-parameter-audit", source.parameterSourceAudit.path,
  "--source-evidence-isolation", source.evidenceIsolationContract.path,
  "--output-dir", rel(inactiveDir),
], { cwd: ROOT, encoding: "utf8" })
assert.equal(compile.status, 0, `inactive_config_compilation_failed:${compile.stderr}`)
const compiled = JSON.parse(compile.stdout)
assert.equal(compiled.status, "stage4_isolated_responsibility_component_inactive_configs_compiled")
assert.deepEqual(Object.keys(compiled.configs), ROLE_ORDER)
const now = new Date().toISOString()
const files = {
  support: path.join(output, "component-support-contract.json"),
  parameter: path.join(output, "parameter-structure-difference-report.json"),
  isolation: path.join(output, "evidence-isolation-report.json"),
  cpu: path.join(output, "cpu-report.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  sync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-three-isolated-responsibility-component-support-contract-v1",
  status: "cpu_supported_inactive",
  roleOrder: ROLE_ORDER,
  authorityBinding: { roleId: "authoritative_world_structure_binding", trainable: false },
  inactiveConfigs: compiled.configs,
  sharedImmutableBoundaries: {
    approvedDataCount: 64,
    split: { train: 48, validation: 8, challenge: 4, regression: 4 },
    conditionChannels: 23,
    latentChannels: 12,
    autoencoderFrozen: true,
    autoencoderDownsampleFactor: 4,
    existingLossValuesAndWeightsChanged: false,
    checkpointFormatChanged: false,
    reviewThresholdsChanged: false,
  },
  parameterTopology: { baseWidth: 64, widthHierarchy: [64, 128, 256], timeEmbeddingChannels: 256 },
  parameterNamespacesIndependent: true,
  sharedTrainableParametersAllowed: false,
  modelNameCreated: false,
  activationStatus: "cpu_supported_inactive",
  recordedAtUtc: now,
})
writeJsonAtomic(files.parameter, {
  schemaVersion: "stage4-three-isolated-responsibility-component-parameter-structure-report-v1",
  status: "passed",
  components: Object.fromEntries(ROLE_ORDER.map((role) => [role, cpu.componentAudits[role]])),
  exactTopologyShapes: cpu.exactTopologyShapes,
  responsibilitySpecificExistingExpertSets: {
    [ROLE_ORDER[0]]: ["route"],
    [ROLE_ORDER[1]]: ["footprints", "tree", "rock", "vegetation"],
    [ROLE_ORDER[2]]: [],
  },
  freeWidthChosen: false,
  freeLayerCountChosen: false,
  freeLossChosen: false,
  recordedAtUtc: now,
})
writeJsonAtomic(files.isolation, {
  schemaVersion: "stage4-three-isolated-responsibility-component-evidence-isolation-report-v1",
  status: "passed",
  roleOrder: ROLE_ORDER,
  predecessorChain: [
    { roleId: ROLE_ORDER[0], predecessorRoleId: "authoritative_world_structure_binding" },
    { roleId: ROLE_ORDER[1], predecessorRoleId: ROLE_ORDER[0] },
    { roleId: ROLE_ORDER[2], predecessorRoleId: ROLE_ORDER[1] },
  ],
  parameterNamespacesIndependent: true,
  checkpointIdentitiesIndependent: true,
  outputArtifactIdentitiesIndependent: true,
  phaseTerminalIdentitiesIndependent: true,
  samePackageImmediatePredecessorOnly: true,
  crossRunEvidenceAllowed: false,
  historicalCheckpointAllowed: false,
  outputDirectoryReuseAllowed: false,
  recordedAtUtc: now,
})
writeJsonAtomic(files.cpu, {
  ...cpu,
  status: "stage4_isolated_responsibility_component_cpu_support_passed",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  inactiveConfigs: compiled.configs,
  supportContract: bind(files.support),
  parameterStructureReport: bind(files.parameter),
  evidenceIsolationReport: bind(files.isolation),
  recordedAtUtc: now,
})
writeJsonAtomic(files.owner, {
  schemaVersion: "stage4-three-isolated-responsibility-component-readonly-gpu-owner-action-request-v1",
  status: "owner_authorization_required",
  requestedAction: "independent_readonly_gpu_qualification_for_three_isolated_responsibility_components_only",
  roleOrder: ROLE_ORDER,
  sourceSupportContract: bind(files.support),
  sourceCpuReport: bind(files.cpu),
  sourceParameterStructureReport: bind(files.parameter),
  sourceEvidenceIsolationReport: bind(files.isolation),
  requiredExecutionOrder: ROLE_ORDER,
  independentAuthorizationRunIdOutputAndTerminalPerRoleRequired: true,
  stopOnAnyRoleFailure: true,
  forbiddenNextScope: ["create_optimizer", "backward", "modify_weights", "write_checkpoint", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "training", "formal_inference", "checkpoint_promotion", "runtime_frame", "enter_world"],
  recordedAtUtc: now,
})
const planPath = file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"), beforeSha256 = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/mu, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4三个责任隔离训练组件CPU未激活支持已通过，等待逐组件独立只读GPU资格；未启动训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true)
const bullet = "- Stage4三个责任隔离训练组件CPU未激活支持已完成：地形道路水体、四类对象语义、全局视觉与原生RGB分别拥有独立参数命名空间、Checkpoint身份、输出身份和终态身份；仅复用既有23通道、12通道潜变量、64/128/256拓扑、冻结Autoencoder及现有Loss。全部执行门关闭，尚未取得GPU资格或启动训练。"
if (!plan.includes(bullet)) plan = plan.replace(anchor, `${bullet}\n\n${anchor}`)
const tempPlan = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(tempPlan, plan, "utf8")
fs.renameSync(tempPlan, planPath)
writeJsonAtomic(files.sync, {
  schemaVersion: "stage4-three-isolated-responsibility-component-cpu-support-plan-sync-v1",
  status: "unique_plan_synchronized",
  uniqueModulePlan: bind(planPath),
  beforeSha256,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-three-isolated-responsibility-component-cpu-support-terminal-v1",
  status: "stage4_three_isolated_responsibility_component_cpu_support_succeeded_inactive",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  inactiveConfigs: compiled.configs,
  supportContract: bind(files.support),
  parameterStructureReport: bind(files.parameter),
  evidenceIsolationReport: bind(files.isolation),
  cpuReport: bind(files.cpu),
  ownerActionRequest: bind(files.owner),
  checkpointWeightsRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  modelWeightsModified: false,
  smokeStarted: false,
  trainingStarted: false,
  nextLegalAction: "owner_authorize_independent_readonly_gpu_qualification_for_three_isolated_responsibility_components_only",
  recordedAtUtc: now,
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  currentStage: "Stage4 three isolated responsibility components CPU-supported inactive",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: bind(files.terminal),
  nextLegalAction: "owner_authorize_independent_readonly_gpu_qualification_for_three_isolated_responsibility_components_only",
  recordedAtUtc: now,
})
for (const target of [...Object.values(compiled.configs).map((entry) => file(entry.path)), ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_isolated_responsibility_component_cpu_support", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-isolated-responsibility-component-cpu-support-${authorization.runId}`,
  timestamp: now,
  action: "stage4_isolated_responsibility_component_cpu_support",
  runId: authorization.runId,
  kind: "cpu_inactive_component_implementation",
  status: "success",
  title: "Three isolated responsibility components CPU-supported inactive",
  titleZh: "Stage4三个责任隔离组件CPU未激活支持通过",
  detailZh: "三个组件参数、Checkpoint、输出和终态隔离；GPU与训练门保持关闭。",
  evidencePath: rel(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: "stage4_three_isolated_responsibility_component_cpu_support_succeeded_inactive",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  inactiveConfigs: compiled.configs,
  supportContract: bind(files.support),
  parameterStructureReport: bind(files.parameter),
  evidenceIsolationReport: bind(files.isolation),
  cpuReport: bind(files.cpu),
  ownerActionRequest: bind(files.owner),
  terminal: bind(files.terminal),
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2))
