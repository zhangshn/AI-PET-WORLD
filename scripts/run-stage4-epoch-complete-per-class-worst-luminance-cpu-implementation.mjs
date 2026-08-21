import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const PYTHON = path.resolve(ROOT, "ml/ai-painter/.venv/Scripts/python.exe")
const CONTRACT_ID = "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1"
const AUTH_SCHEMA = "owner-authorized-stage4-epoch-complete-per-class-worst-luminance-cpu-implementation-v1"
const SCOPE = "one_cpu_inactive_stage4_epoch_complete_per_class_worst_luminance_selection_and_checkpoint_identity_implementation"
const ALLOWED_ACTIONS = Object.freeze([
  "verify_bound_causal_terminal_report_decision_contract_and_cpu_report",
  "extend_existing_trainer_with_epoch_complete_per_class_selection_identity",
  "extend_inactive_configuration_compiler_and_support_contract",
  "extend_cpu_positive_negative_contract_checker",
  "execute_python_syntax_cpu_regression_and_configuration_audit",
  "write_support_contract_cpu_report_owner_request_terminal_and_local_records",
])
const FORBIDDEN = Object.freeze([
  "read_or_load_checkpoint", "create_optimizer", "execute_backward", "modify_model_weights",
  "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training",
  "change_model_architecture", "change_existing_loss_weights", "change_dataset_or_split",
  "change_checkpoint_format", "change_machine_review_thresholds", "use_failed_preview_as_target",
  "use_review_result_as_target", "add_optimizer_steps", "select_free_hyperparameters",
])

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const shaFile = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/")
const bind = (file) => ({ path: rel(file), sha256: shaFile(file) })
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.equal(resolved.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return resolved
}
const run = (command, args) => spawnSync(command, args, {
  cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
})
const writeTextAtomic = (target, value) => {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  const descriptor = fs.openSync(temporary, "wx")
  try { fs.writeFileSync(descriptor, value, "utf8"); fs.fsyncSync(descriptor) }
  finally { fs.closeSync(descriptor) }
  fs.renameSync(temporary, target)
}

const authorizationArg = arg("--authorization")
const authorizationSha = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, AUTH_SCHEMA)
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.contractId, CONTRACT_ID)
assert.equal(same(authorization.allowedActions, ALLOWED_ACTIONS), true, "allowed_actions_not_exact")
assert.equal(FORBIDDEN.every((name) => authorization.deniedActions.includes(name)), true, "denied_actions_incomplete")
assert.equal(authorization.checkpointReadAuthorized, false)
assert.equal(authorization.optimizerCreationAuthorized, false)
assert.equal(authorization.backwardExecutionAuthorized, false)
assert.equal(authorization.modelWeightModificationAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(authorization.oneTimeConsumptionRequired, true)
assert.equal(authorization.automaticRetryAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_already_exists")
for (const [name, binding] of Object.entries(authorization.sourceEvidence)) {
  const source = projectFile(binding.path)
  assert.equal(fs.existsSync(source), true, `${name}_missing`)
  assert.equal(shaFile(source), binding.sha256, `${name}_sha256_mismatch`)
}
assert.equal(fs.existsSync(PYTHON), true, "project_python_missing")

const trainerPath = projectFile("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const compilerPath = projectFile("ml/ai-painter/scripts/compile_stage4_epoch_complete_per_class_worst_luminance_selection_config.py")
const checkerPath = projectFile("ml/ai-painter/scripts/check_stage4_epoch_complete_per_class_worst_luminance_selection_cpu.py")
const syntax = run(PYTHON, ["-m", "py_compile", rel(trainerPath), rel(compilerPath), rel(checkerPath)])
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAt = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-epoch-complete-per-class-worst-luminance-cpu-consumption-v1",
  status: "consumed_once",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: SCOPE,
  authorizationPath: authorizationArg,
  authorizationSha256: authorizationSha,
  oneTimeConsumption: true,
  consumedAtUtc: consumedAt,
  consumedAtAsiaShanghai: formatShanghai(consumedAt),
}
const consumptionDescriptor = fs.openSync(consumptionPath, "wx")
try {
  fs.writeFileSync(consumptionDescriptor, `${JSON.stringify(consumption, null, 2)}\n`, "utf8")
  fs.fsyncSync(consumptionDescriptor)
} finally {
  fs.closeSync(consumptionDescriptor)
}
const consumptionSha = shaFile(consumptionPath)

const sourceBinding = authorization.sourceEvidence.priorInactiveConfig
const inactiveConfig = path.join(output, "inactive-config.json")
const compiler = run(PYTHON, [
  rel(compilerPath),
  "--source", sourceBinding.path,
  "--source-sha256", sourceBinding.sha256,
  "--authorization", authorizationArg,
  "--authorization-sha256", authorizationSha,
  "--consumption", consumptionArg,
  "--consumption-sha256", consumptionSha,
  "--output", rel(inactiveConfig),
])
assert.equal(compiler.status, 0, `inactive_config_compilation_failed:${compiler.stdout}:${compiler.stderr}`)
const cpuReport = path.join(output, "cpu-report.json")
const configAudit = path.join(output, "configuration-audit.json")
const checker = run(PYTHON, [
  rel(checkerPath),
  "--config", rel(inactiveConfig),
  "--config-sha256", shaFile(inactiveConfig),
  "--source", sourceBinding.path,
  "--source-sha256", sourceBinding.sha256,
  "--output", rel(cpuReport),
  "--audit-output", rel(configAudit),
])
assert.equal(checker.status, 0, `cpu_regression_failed:${checker.stdout}:${checker.stderr}`)
const cpu = readJson(cpuReport)
const audit = readJson(configAudit)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
assert.equal(audit.status, "passed_configuration_audit")
assert.equal(audit.trainIdentityCount, 48)

const now = new Date().toISOString()
const files = {
  support: path.join(output, "training-objective-support-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
  implementation: path.join(output, "implementation-attestation.json"),
}
writeJsonAtomic(files.implementation, {
  schemaVersion: "stage4-epoch-complete-per-class-worst-luminance-implementation-attestation-v1",
  status: "cpu_implementation_verified",
  contractId: CONTRACT_ID,
  implementation: { trainer: bind(trainerPath), compiler: bind(compilerPath), checker: bind(checkerPath) },
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  runtimeActions: { checkpointRead: false, optimizerCreated: false, backwardExecuted: false, gpuStarted: false, trainingStarted: false },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-epoch-complete-per-class-worst-luminance-support-contract-v1",
  status: "cpu_support_verified_inactive",
  contractId: CONTRACT_ID,
  implementation: bind(files.implementation),
  inactiveConfig: bind(inactiveConfig),
  cpuReport: bind(cpuReport),
  configurationAudit: bind(configAudit),
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  guarantees: {
    completeTrainPopulationPerEpoch: 48,
    oneMaximumPerClass: ["footprints", "tree", "rock", "vegetation"],
    detachedScoreIdentityLedgerOnly: true,
    lexicographicSampleIdTieBreak: true,
    existingReplayPassesReused: 2,
    additionalOptimizerSteps: 0,
    firstEpochCollectionOnly: true,
    validationPopulation: 8,
    validationExistingRolloutSeedsIncluded: true,
    checkpointSelectionsPersistExactIdentityFields: true,
    batchSizeOneLocalMaximumRemovedWhenActive: true,
    modelLossWeightsDataCheckpointThresholdsChanged: false,
  },
  activation: { checkpointRead: false, optimizer: false, backward: false, weightMutation: false, gpu: false, training: false },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "owner_readonly_gpu_qualification_authorization_required_not_authorized",
  requestedAction: `execute_${CONTRACT_ID}_independent_readonly_gpu_qualification`,
  boundInactiveConfig: bind(inactiveConfig),
  boundSupportContract: bind(files.support),
  boundCpuReport: bind(cpuReport),
  boundConfigurationAudit: bind(configAudit),
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-epoch-complete-per-class-worst-luminance-cpu-terminal-v1",
  status: "stage4_epoch_complete_per_class_worst_luminance_cpu_succeeded_closed",
  contractId: CONTRACT_ID,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  inactiveConfig: bind(inactiveConfig),
  supportContract: bind(files.support),
  cpuReport: bind(cpuReport),
  configurationAudit: bind(configAudit),
  ownerActionRequest: bind(files.owner),
  implementationAttestation: bind(files.implementation),
  checkpointRead: false,
  optimizerCreated: false,
  backwardExecuted: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 epoch-complete per-class worst-sample luminance CPU support completed",
  latestTerminal: bind(files.terminal),
  latestSupportContract: bind(files.support),
  nextLegalAction: `owner_authorize_readonly_gpu_qualification_for_${CONTRACT_ID}`,
  evidence: {
    inactiveConfig: bind(inactiveConfig), cpuReport: bind(cpuReport),
    configurationAudit: bind(configAudit), supportContract: bind(files.support),
  },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, `状态：active-module-plan / AI Painter固定进度3/5（60%）；${CONTRACT_ID}的CPU未激活支持、48条train完整Epoch选择、两次既有回放复用和validation Checkpoint身份审计已通过；尚未执行只读GPU资格、Smoke或正式训练`)
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "plan_anchor_missing")
const bullet = `- ${CONTRACT_ID}的CPU未激活支持已完成：每个完整Epoch覆盖48条train记录并分别选择footprints/tree/rock/vegetation最大义务，下一Epoch仅复用既有两次回放预算重算可微Loss；Checkpoint资格覆盖8条validation及既有rollout seeds并落盘精确身份。未新增优化步骤、Loss权重、数据或阈值。下一步仅可执行独立只读GPU梯度资格。\n`
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, {
  schemaVersion: "ai-painter-plan-sync-record-v1",
  status: "unique_plan_synchronized",
  plan: bind(planPath),
  terminal: bind(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

for (const file of [authorizationPath, consumptionPath, inactiveConfig, cpuReport, configAudit, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: authorization.runId,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: shaFile(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-epoch-complete-per-class-worst-luminance-cpu-${authorization.runId}`,
  timestamp: now,
  action: "stage4_epoch_complete_per_class_worst_luminance_cpu_support",
  runId: authorization.runId,
  kind: "cpu_inactive_support",
  status: "success",
  title: "Stage4 epoch-complete per-class worst-sample luminance CPU support passed",
  titleZh: "Stage4完整Epoch逐类别最差样本亮度结构CPU支持通过",
  detailZh: "48条训练记录按完整Epoch收集，四类独立选择并复用既有两次回放；validation身份覆盖8条记录及既有采样种子。未读取Checkpoint、未启动GPU或训练。",
  evidencePath: rel(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: readJson(files.terminal).status,
  terminal: bind(files.terminal),
  cpuReport: bind(cpuReport),
  configurationAudit: bind(configAudit),
  inactiveConfig: bind(inactiveConfig),
  supportContract: bind(files.support),
  ownerActionRequest: bind(files.owner),
  implementationAttestation: bind(files.implementation),
  capsule: bind(files.capsule),
  planSync: bind(files.planSync),
  consumption: bind(consumptionPath),
}, null, 2))
