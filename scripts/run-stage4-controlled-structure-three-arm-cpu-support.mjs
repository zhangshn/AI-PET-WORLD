import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const ACTIONS = Object.freeze([
  "fix_registered_runtime_logical_physical_path_contract_in_compiler_checker_and_runner",
  "compile_three_exact_inactive_configs",
  "execute_cpu_positive_negative_regression",
  "audit_exact_parameter_and_tensor_shape_differences",
  "atomically_consume_one_cpu_implementation_authorization",
  "write_support_contract_reports_owner_request_terminal_and_governance_records",
])
const DENIALS = Object.freeze([
  "modify_model_source", "modify_mode_registry",
  "read_or_load_checkpoint", "create_optimizer", "execute_backward", "modify_model_weights",
  "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training",
  "activate_three_arm_contract", "modify_loss", "modify_data", "modify_checkpoint_format",
  "modify_machine_review_thresholds", "select_free_hyperparameter", "reuse_historical_checkpoint",
])
const AUTHORIZED_STARTING_LINEAGE = Object.freeze({
  compilerSha256: "322866e4ec7396059f37f9afd0601c0aa1843fb44a39c63dd47ebc84ea0bfdfa",
  checkerSha256: "6b7686d5e7fec36d02787ef4a23a6586f2bac9f5c1509efc9cd69f630ad5fa30",
  runnerSha256: "083beb72709a62be87193183cb6c158c6111023247ea8edff2cb9330543029a9",
  frozenModelFactorySha256: "6af8503ed89c49a470fc64767287a66e3c46c877587f0c14f1b7847ad116aeb5",
  frozenModeRegistrySha256: "ac7aa0ff10ae9dff0959cfd030314d70ed80c481d7093f1bfe336a59a1d8ea03",
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const target = path.resolve(ROOT, value)
  assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return target
}
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const run = (executable, values, maxBuffer = 64 * 1024 * 1024) => {
  const result = spawnSync(executable, values, { cwd: ROOT, encoding: "utf8", maxBuffer })
  assert.equal(result.status, 0, `command_failed:${executable}:${values.join(" ")}:${result.stderr}`)
  return result.stdout
}

const authorizationArg = arg("--authorization")
const authorizationSha256 = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-controlled-structure-three-arm-cpu-support-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_inactive_stage4_controlled_structure_three_arm_implementation")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_not_exact")
assert.equal(same(authorization.deniedActions, DENIALS), true, "denied_actions_not_exact")
assert.equal(authorization.modelSourceModificationAuthorized, false)
assert.equal(authorization.inactiveConfigCompilationAuthorized, true)
for (const permission of ["checkpointWeightsReadAuthorized", "optimizerAuthorized", "backwardAuthorized", "gpuAuthorized", "trainingAuthorized"]) assert.equal(authorization[permission], false, `${permission}_must_be_false`)
assert.equal(authorization.automaticRetryAuthorized, false)
assert.equal(authorization.oneTimeConsumption, true)
assert.deepEqual(authorization.authorizedStartingLineage, AUTHORIZED_STARTING_LINEAGE, "authorized_starting_lineage_mismatch")
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  const target = projectFile(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(shaFile(target), evidence.sha256, `${name}_sha256_mismatch`)
  assert.equal(/\.pt$/i.test(evidence.path), false, `${name}_checkpoint_evidence_forbidden`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-controlled-structure-three-arm-cpu-support.mjs"),
  compiler: projectFile("ml/ai-painter/scripts/compile_stage4_controlled_structure_three_arm_inactive_configs.py"),
  checker: projectFile("ml/ai-painter/scripts/check_stage4_controlled_structure_three_arm_cpu.py"),
  modelFactory: projectFile("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: projectFile("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
assert.equal(fs.existsSync(PYTHON), true, "project_python_missing")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_already_exists")

run(PYTHON, ["-m", "py_compile", programs.compiler, programs.checker, programs.modelFactory, programs.modeRegistry])
const sourceConfig = authorization.sourceEvidence.sourceConfig.path
const sourceContract = authorization.sourceEvidence.inactiveThreeArmContract.path
const cpuReport = JSON.parse(run(PYTHON, [programs.checker, "--source-config", sourceConfig, "--source-three-arm-contract", sourceContract]))
assert.equal(cpuReport.status, "passed")
assert.equal(cpuReport.positive.passed, cpuReport.positive.total)
assert.equal(cpuReport.negative.passed, cpuReport.negative.total)

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-controlled-structure-three-arm-cpu-support-consumption-v1",
  status: "cpu_inactive_implementation_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorization: bind(authorizationPath),
  oneTimeConsumption: true,
  consumedAtUtc,
  consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
}
const descriptor = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(descriptor, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const configsDirectory = `${authorization.outputNamespace}/inactive-configs`
const compileResult = JSON.parse(run(PYTHON, [programs.compiler, "--source-config", sourceConfig, "--source-three-arm-contract", sourceContract, "--output-dir", configsDirectory]))
assert.equal(compileResult.status, "stage4_controlled_structure_three_arm_inactive_configs_compiled")
const configBindings = Object.fromEntries(Object.entries(compileResult.configs).map(([arm, value]) => {
  const target = projectFile(value.path)
  assert.equal(target.startsWith(`${output}${path.sep}`), true, "compiled_config_outside_output")
  assert.equal(shaFile(target), value.sha256, "compiled_config_sha256_mismatch")
  return [arm, bind(target)]
}))

const now = new Date().toISOString()
const files = {
  cpu: path.join(output, "cpu-report.json"),
  support: path.join(output, "model-structure-support-contract.json"),
  audit: path.join(output, "parameter-structure-difference-report.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.cpu, { ...cpuReport, authorization: bind(authorizationPath), consumption: bind(consumptionPath), sourceEvidence: authorization.sourceEvidence, modelSource: bind(programs.modelFactory), modeRegistry: bind(programs.modeRegistry), inactiveConfigs: configBindings, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-controlled-structure-three-arm-model-support-contract-v1",
  status: "cpu_support_verified_inactive",
  architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
  armField: "stage4ControlledStructureArm",
  arms: {
    baseline_current_formal_structure: { structuralChange: "none", inactiveConfig: configBindings.baseline_current_formal_structure },
    condition_fusion_only_final_direct_residual_23_64_12: { structuralChange: "one_final_condition_residual", operators: ["Conv2d(23,64,3,padding=1,bias=true)", "SiLU", "Conv2d(64,12,3,padding=1,bias=true)"], merge: "predicted_velocity_plus_final_condition_residual_once", addedParameterTensors: 4, addedParameterCount: 20236, inactiveConfig: configBindings.condition_fusion_only_final_direct_residual_23_64_12 },
    capacity_only_base_width_64_to_existing_level1_128: { structuralChange: "denoiser_base_width_only", baseChannels: 128, derivedHierarchy: [128, 256, 512], timeEmbeddingChannels: 512, moduleNameSetChanged: false, inactiveConfig: configBindings.capacity_only_base_width_64_to_existing_level1_128 },
  },
  activationGateAllFalse: true,
  checkpointRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  modelWeightsModified: false,
  trainingStarted: false,
})
writeJsonAtomic(files.audit, {
  schemaVersion: "stage4-controlled-structure-three-arm-parameter-structure-difference-report-v1",
  status: "cpu_verified",
  baseline: cpuReport.baseline,
  conditionFusionOnly: cpuReport.conditionFusionOnly,
  capacityOnly: cpuReport.capacityOnly,
  exactIsolation: { baselineZeroDifference: true, fusionOnlyFourNewTensors: true, fusionAddedParameterCount: 20236, capacityOnlyExistingTensorShapesChanged: true, outputChannels: 12 },
})
writeJsonAtomic(files.owner, {
  schemaVersion: "stage4-controlled-structure-three-arm-readonly-gpu-owner-action-request-v1",
  status: "owner_authorization_required",
  action: "authorize_readonly_gpu_condition_and_gradient_causal_qualification_per_controlled_structure_arm",
  boundSupportContract: bind(files.support),
  boundParameterAudit: bind(files.audit),
  qualificationOrder: ["condition_fusion_only_final_direct_residual_23_64_12", "capacity_only_base_width_64_to_existing_level1_128"],
  requiredIsolation: "each_arm_independent_authorization_and_evidence_namespace",
  prohibitedNow: ["checkpoint_read", "optimizer", "backward", "weight_update", "smoke", "training"],
  automaticApproval: false,
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const before = shaFile(planPath)
let planText = fs.readFileSync(planPath, "utf8")
planText = planText.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
planText = planText.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4三臂受控结构的CPU未激活支持已完成，基线保持字节身份、条件融合臂仅新增23→64→12最终残差、容量臂仅将基础宽度64→128；尚未GPU资格、Smoke或训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(planText.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = "- Stage4三臂受控结构CPU未激活支持完成：基线与旧正式结构的状态字典、固定种子初始化和CPU输出字节身份一致；条件融合臂只新增4个张量、20236个参数；容量臂仅改变既有宽度派生张量形状且模块名称集合不变。下一步按证据隔离合同分别执行两个结构臂的只读GPU条件到达与梯度资格，未授权Smoke和训练。\n"
if (!planText.includes(bullet.trim())) planText = planText.replace(anchor, `${bullet}\n${anchor}`)
const tempPlan = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(tempPlan, planText, "utf8")
fs.renameSync(tempPlan, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-controlled-structure-three-arm-cpu-support-plan-sync-v1", status: "unique_plan_synchronized", planPath: relative(planPath), beforeSha256: before, afterSha256: shaFile(planPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-controlled-structure-three-arm-cpu-support-terminal-v1",
  status: "stage4_controlled_structure_three_arm_cpu_support_succeeded_inactive",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  inactiveConfigs: configBindings,
  supportContract: bind(files.support),
  parameterStructureDifferenceReport: bind(files.audit),
  cpuReport: bind(files.cpu),
  ownerActionRequest: bind(files.owner),
  planSync: bind(files.planSync),
  checkpointRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  modelWeightsModified: false,
  trainingStarted: false,
  nextLegalAction: "readonly_gpu_condition_and_gradient_causal_qualification_per_arm",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 controlled three-arm CPU inactive support",
  terminal: bind(files.terminal),
  latestDecision: "three_arm_cpu_support_succeeded_inactive",
  nextLegalAction: "readonly_gpu_condition_and_gradient_causal_qualification_per_arm",
  forbiddenActions: DENIALS,
  recordedAtUtc: now,
})
for (const target of [...Object.values(files), ...Object.values(configBindings).map((item) => projectFile(item.path))]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_controlled_structure_three_arm_cpu_support", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-controlled-structure-three-arm-cpu-support-${authorization.runId}`,
  timestamp: now,
  action: "stage4_controlled_structure_three_arm_cpu_support",
  runId: authorization.runId,
  kind: "cpu_inactive_model_structure_implementation",
  status: "success",
  title: "Stage4 controlled three-arm CPU support completed inactive",
  titleZh: "Stage4三臂受控结构CPU未激活支持完成",
  detailZh: "基线保持旧结构字节身份；融合臂仅新增23→64→12最终条件残差；容量臂仅把基础宽度64提升到128。未读取Checkpoint、未启动GPU、未反向传播或训练。",
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: readJson(files.terminal).status,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  inactiveConfigs: configBindings,
  supportContract: bind(files.support),
  parameterStructureDifferenceReport: bind(files.audit),
  cpuReport: bind(files.cpu),
  ownerActionRequest: bind(files.owner),
  terminal: bind(files.terminal),
  capsule: bind(files.capsule),
}, null, 2))
