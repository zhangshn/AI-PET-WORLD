import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { buildControlledStructureUniqueDerivationContract, CONTRACT_ID, CONTRACT_STATUS } from "./lib/ai-painter-stage4-controlled-structure-unique-derivation-rules.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze([
  "verify_bound_three_arm_design_evidence",
  "bind_owner_selected_unique_fusion_and_capacity_derivation_rules",
  "compile_inactive_materializable_three_arm_structure_contract",
  "audit_parameter_and_structural_differences",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_contract_authorization",
  "write_rules_contract_audit_owner_request_terminal_and_governance_records",
])
const DENIALS = Object.freeze([
  "modify_model_source", "implement_model_structure", "activate_contract", "modify_loss", "modify_data",
  "select_free_hyperparameters", "add_extra_layer", "add_free_channel_dimension",
  "read_or_load_checkpoint_weights", "create_optimizer", "execute_backward", "modify_model_weights",
  "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training",
  "reuse_historical_checkpoint", "lower_review_thresholds",
])
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const target = path.resolve(ROOT, value)
  assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return target
}
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const writeTextAtomic = (target, content) => {
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  const descriptor = fs.openSync(temp, "wx")
  try { fs.writeFileSync(descriptor, content, "utf8"); fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }
  fs.renameSync(temp, target)
}

const authorizationArg = arg("--authorization")
const authorizationSha256 = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-controlled-structure-unique-derivation-rules-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_stage4_controlled_structure_unique_derivation_contract")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_not_exact")
assert.equal(same(authorization.deniedActions, DENIALS), true, "denied_actions_not_exact")
for (const permission of ["modelSourceModificationAuthorized", "architectureImplementationAuthorized", "checkpointWeightsReadAuthorized", "gpuAuthorized", "trainingAuthorized"]) assert.equal(authorization[permission], false, `${permission}_must_be_false`)
assert.equal(authorization.automaticRetryAuthorized, false)
assert.equal(authorization.oneTimeConsumption, true)
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  const target = projectFile(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(shaFile(target), evidence.sha256, `${name}_sha256_mismatch`)
  assert.equal(/\.pt$/i.test(evidence.path), false, `${name}_checkpoint_evidence_forbidden`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-controlled-structure-unique-derivation-rules.mjs"),
  checker: projectFile("scripts/check-stage4-controlled-structure-unique-derivation-rules.mjs"),
  contractLibrary: projectFile("scripts/lib/ai-painter-stage4-controlled-structure-unique-derivation-rules.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)

const consumedAtUtc = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-controlled-structure-unique-derivation-rules-consumption-v1",
  status: "cpu_readonly_unique_derivation_contract_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorizationPath: authorizationArg,
  authorizationSha256,
  oneTimeConsumption: true,
  consumedAtUtc,
  consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
}
fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const descriptor = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(descriptor, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }

const evidence = authorization.sourceEvidence
const terminal = readJson(projectFile(evidence.designTerminal.path))
const designReport = readJson(projectFile(evidence.designReport.path))
const experiment = readJson(projectFile(evidence.threeArmExperiment.path))
const isolation = readJson(projectFile(evidence.evidenceIsolation.path))
const qualification = readJson(projectFile(evidence.futureQualification.path))
const ownerRequest = readJson(projectFile(evidence.designOwnerRequest.path))
const priorCpuReport = readJson(projectFile(evidence.designCpuReport.path))
const config = readJson(projectFile(evidence.activeConfig.path))
const modelSource = fs.readFileSync(projectFile(evidence.modelSource.path), "utf8")
assert.equal(config.conditionChannels, 23)
assert.equal(config.denoiserBaseChannels, 64)
assert.equal(config.latentChannels, 12)
assert.equal(config.latentDownsampleFactor, 4)
assert.match(modelSource, /nn\.Conv2d\(condition_channels, channels, 3, padding=1\)/)
assert.match(modelSource, /nn\.Conv2d\(channels, latent_channels, 3, padding=1\)/)
assert.match(modelSource, /predicted_velocity = base_velocity \+ torch\.stack\(/)
const baseline = experiment.baseline.structure
assert.equal(baseline.conditionChannelCount, config.conditionChannels)
assert.equal(baseline.denoiserBaseChannels, config.denoiserBaseChannels)
assert.equal(baseline.latentChannels, config.latentChannels)

const contract = buildControlledStructureUniqueDerivationContract({
  terminal,
  designReport,
  experiment,
  isolation,
  qualification,
  ownerRequest,
  cpuReport: priorCpuReport,
  baseline,
  ownerRules: authorization.ownerBoundRules,
})
assert.equal(contract.contractId, CONTRACT_ID)
assert.equal(contract.status, CONTRACT_STATUS)
assert.equal(contract.materializable, true)
assert.equal(contract.executableNow, false)

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = {
  cpu: path.join(output, "cpu-report.json"),
  rules: path.join(output, "unique-derivation-rules.json"),
  contract: path.join(output, "inactive-three-arm-structure-contract.json"),
  audit: path.join(output, "parameter-structure-difference-audit.json"),
  isolation: path.join(output, "evidence-isolation-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.cpu, { ...cpuReport, authorization: bind(authorizationPath), consumption: bind(consumptionPath), sourceEvidence: evidence, modelSourceModified: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.rules, {
  schemaVersion: "stage4-controlled-structure-unique-derivation-rules-v1",
  contractId: CONTRACT_ID,
  status: CONTRACT_STATUS,
  source: "owner_bound_immutable_command",
  conditionFusionOnly: authorization.ownerBoundRules.conditionFusionOnly,
  capacityOnly: authorization.ownerBoundRules.capacityOnly,
  forbiddenChanges: authorization.ownerBoundRules.forbiddenChanges,
  freeParameterCount: 0,
  activeNow: false,
})
writeJsonAtomic(files.contract, contract)
writeJsonAtomic(files.audit, {
  schemaVersion: "stage4-controlled-structure-parameter-difference-audit-v1",
  status: "cpu_verified",
  baseline: contract.baseline.parameterDifference,
  conditionFusionOnly: contract.conditionFusionOnly.parameterDifference,
  capacityOnly: contract.capacityOnly.parameterDifference,
  structuralDifferenceAudit: contract.structuralDifferenceAudit,
  exactFusionAddedParameterCount: 20236,
  capacityExactTensorShapeAuditRequiredAtImplementation: true,
  freeParameterCount: 0,
  modelSourceModified: false,
})
writeJsonAtomic(files.isolation, { schemaVersion: "stage4-controlled-structure-evidence-isolation-contract-v2", status: "cpu_verified_inactive", ...contract.evidenceIsolationContract, futureQualificationOrder: contract.futureQualificationOrder })
writeJsonAtomic(files.owner, {
  schemaVersion: "stage4-controlled-structure-cpu-inactive-implementation-owner-action-request-v1",
  status: "owner_authorization_required",
  action: contract.nextAction,
  scope: "implement_cpu_inactive_support_for_baseline_fusion_only_and_capacity_only_without_activation",
  boundContract: bind(files.contract),
  requiredNextChecks: ["model_factory_support", "exact_parameter_shape_audit", "cross_arm_structural_isolation", "configuration_compiler_inactive_contract", "cpu_positive_negative_regression"],
  prohibitedNow: ["activate_contract", "read_checkpoint", "start_gpu", "smoke", "train"],
  automaticApproval: false,
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const before = shaFile(planPath)
let planText = fs.readFileSync(planPath, "utf8")
planText = planText.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
planText = planText.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4三臂结构对照的Owner唯一派生规则已完成CPU未激活合同：融合臂固定23→64→12最终条件残差，容量臂固定64→128且保持12通道输出；尚未修改模型、激活、GPU或训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(planText.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = "- Stage4三臂结构对照唯一派生规则已完成CPU未激活合同：基线零变化；条件融合臂只新增一个23→64→12的最终条件残差分支（两层3×3卷积、中间单个SiLU、一次最终残差相加），精确新增20236个分支参数；容量臂只把基础宽度64提升为既有level1宽度128，并派生128→256→512层级，保持现有条件融合、层数及12通道输出不变。合同可物化但未激活，下一步只允许CPU未激活模型工厂与配置支持及精确参数形状隔离审计。\n"
if (!planText.includes(bullet.trim())) planText = planText.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, planText)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-controlled-structure-unique-derivation-rules-plan-sync-v1", status: "unique_plan_synchronized", planPath: relative(planPath), beforeSha256: before, afterSha256: shaFile(planPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-controlled-structure-unique-derivation-rules-terminal-v1",
  status: "stage4_controlled_structure_unique_derivation_rules_cpu_succeeded_inactive",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  uniqueDerivationRules: bind(files.rules),
  inactiveThreeArmStructureContract: bind(files.contract),
  parameterStructureDifferenceAudit: bind(files.audit),
  evidenceIsolationContract: bind(files.isolation),
  ownerActionRequest: bind(files.owner),
  cpuReport: bind(files.cpu),
  planSync: bind(files.planSync),
  modelSourceModified: false,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  nextLegalAction: contract.nextAction,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 controlled structure unique derivation rules",
  terminal: bind(files.terminal),
  latestDecision: CONTRACT_STATUS,
  nextLegalAction: contract.nextAction,
  forbiddenActions: DENIALS,
  recordedAtUtc: now,
})
for (const target of Object.values(files)) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_controlled_structure_unique_derivation_rules", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-controlled-structure-unique-derivation-rules-${authorization.runId}`,
  timestamp: now,
  action: "stage4_controlled_structure_unique_derivation_rules",
  runId: authorization.runId,
  kind: "cpu_readonly_contract_compilation",
  status: "success",
  title: "Stage4 unique controlled structure derivations bound inactive",
  titleZh: "Stage4两个结构对照的唯一派生规则已绑定为未激活合同",
  detailZh: "融合臂严格为23→64→12最终条件残差；容量臂严格为基础宽度64→128并保持12通道输出。没有修改模型、读取Checkpoint、启动GPU或训练。",
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: readJson(files.terminal).status,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: bind(files.terminal),
  uniqueDerivationRules: bind(files.rules),
  inactiveThreeArmStructureContract: bind(files.contract),
  parameterStructureDifferenceAudit: bind(files.audit),
  evidenceIsolationContract: bind(files.isolation),
  ownerActionRequest: bind(files.owner),
  cpuReport: bind(files.cpu),
  capsule: bind(files.capsule),
  planSync: bind(files.planSync),
}, null, 2))

