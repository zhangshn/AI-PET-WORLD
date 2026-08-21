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
const CONTRACT_ID = "stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1"
const AUTH_SCHEMA = "owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-implementation-v1"
const SCOPE = "one_cpu_inactive_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_implementation"
const ALLOWED_ACTIONS = Object.freeze([
  "verify_bound_design_terminal_report_decision_contract_cpu_report_and_data_audit",
  "extend_existing_trainer_with_inactive_per_class_worst_sample_luminance_obligation",
  "compile_one_inactive_configuration",
  "extend_cpu_positive_negative_contract_checker",
  "execute_python_syntax_cpu_regression_and_configuration_audit",
  "write_support_contract_cpu_report_owner_request_terminal_and_local_records",
])
const FORBIDDEN = Object.freeze([
  "read_or_load_checkpoint", "create_optimizer", "execute_backward", "modify_model_weights",
  "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training",
  "change_model_architecture", "change_existing_loss_weights", "change_dataset_or_split",
  "change_checkpoint_format", "change_machine_review_thresholds", "use_failed_preview_as_target",
  "use_review_result_as_target",
])

const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1] }
const shaFile = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.equal(resolved.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return resolved
}
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/")
const bind = (file) => ({ path: rel(file), sha256: shaFile(file) })
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const writeTextAtomic = (target, value) => {
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  const fd = fs.openSync(temp, "wx")
  try { fs.writeFileSync(fd, value, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(temp, target)
}
const run = (command, args) => spawnSync(command, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })

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
assert.equal(same(authorization.allowedActions, ALLOWED_ACTIONS), true, "allowed_actions_not_exact")
assert.equal(FORBIDDEN.every((name) => authorization.deniedActions.includes(name)), true, "denied_actions_incomplete")
assert.equal(authorization.checkpointReadAuthorized, false)
assert.equal(authorization.optimizerCreationAuthorized, false)
assert.equal(authorization.backwardExecutionAuthorized, false)
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

const syntax = run(PYTHON, ["-m", "py_compile",
  "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  "ml/ai-painter/scripts/compile_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_config.py",
  "ml/ai-painter/scripts/check_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_cpu.py",
])
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAt = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-consumption-v1",
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
const fd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) }
finally { fs.closeSync(fd) }
const consumptionSha = shaFile(consumptionPath)

const sourceBinding = authorization.sourceEvidence.priorInactiveConfig
const inactiveConfig = path.join(output, "inactive-config.json")
const compiler = run(PYTHON, [
  "ml/ai-painter/scripts/compile_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_config.py",
  "--source", sourceBinding.path, "--source-sha256", sourceBinding.sha256,
  "--authorization", authorizationArg, "--authorization-sha256", authorizationSha,
  "--consumption", consumptionArg, "--consumption-sha256", consumptionSha,
  "--output", rel(inactiveConfig),
])
assert.equal(compiler.status, 0, `inactive_config_compilation_failed:${compiler.stderr}`)
const cpuReport = path.join(output, "cpu-report.json")
const configAudit = path.join(output, "configuration-audit.json")
const checker = run(PYTHON, [
  "ml/ai-painter/scripts/check_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_cpu.py",
  "--config", rel(inactiveConfig), "--config-sha256", shaFile(inactiveConfig),
  "--source", sourceBinding.path, "--source-sha256", sourceBinding.sha256,
  "--output", rel(cpuReport), "--audit-output", rel(configAudit),
])
assert.equal(checker.status, 0, `cpu_regression_failed:${checker.stdout}:${checker.stderr}`)
const cpu = readJson(cpuReport)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
const audit = readJson(configAudit)
assert.equal(audit.status, "passed_configuration_audit")

const now = new Date().toISOString()
const files = {
  support: path.join(output, "training-objective-support-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
const trainer = projectFile("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const compilerFile = projectFile("ml/ai-painter/scripts/compile_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_config.py")
const checkerFile = projectFile("ml/ai-painter/scripts/check_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_cpu.py")
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-per-class-worst-sample-final-visible-luminance-structure-support-contract-v1",
  status: "cpu_support_verified_inactive",
  contractId: CONTRACT_ID,
  implementation: { trainer: bind(trainer), compiler: bind(compilerFile), checker: bind(checkerFile) },
  inactiveConfig: bind(inactiveConfig), cpuReport: bind(cpuReport), configurationAudit: bind(configAudit),
  authorization: bind(authorizationPath), consumption: bind(consumptionPath),
  guarantees: {
    fourClassesRetainIndependentWorstSamples: true,
    existingWeightedPerSampleClassTensorsReused: true,
    existingFullRolloutLossSlotReused: true,
    validationCheckpointQualificationUsesSamePerClassReduction: true,
    validationUsedForWeightUpdates: false,
    newModelOrFreeWeightAdded: false,
  },
  activation: { checkpointRead: false, optimizer: false, backward: false, weightMutation: false, gpu: false, training: false },
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "owner_readonly_gpu_qualification_authorization_required_not_authorized",
  requestedAction: `execute_${CONTRACT_ID}_independent_readonly_gpu_qualification`,
  boundInactiveConfig: bind(inactiveConfig), boundSupportContract: bind(files.support), boundCpuReport: bind(cpuReport),
  automaticApproval: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-terminal-v1",
  status: "stage4_per_class_worst_sample_final_visible_luminance_structure_cpu_succeeded_closed",
  contractId: CONTRACT_ID,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  inactiveConfig: bind(inactiveConfig), supportContract: bind(files.support), cpuReport: bind(cpuReport), configurationAudit: bind(configAudit), ownerActionRequest: bind(files.owner),
  checkpointRead: false, optimizerCreated: false, backwardExecuted: false, gpuStarted: false, trainingStarted: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 per-class worst-sample final-visible luminance structure CPU support completed",
  latestTerminal: bind(files.terminal), latestSupportContract: bind(files.support),
  nextLegalAction: `owner_authorize_readonly_gpu_qualification_for_${CONTRACT_ID}`,
  evidence: { inactiveConfig: bind(inactiveConfig), cpuReport: bind(cpuReport), configurationAudit: bind(configAudit), supportContract: bind(files.support) },
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, `状态：active-module-plan / AI Painter固定进度3/5（60%）；${CONTRACT_ID}的CPU未激活支持、正反回归和配置审计已通过，四类对象各自最差样本将替换单一全局最大值；尚未执行只读GPU资格、Smoke或正式训练`)
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "plan_anchor_missing")
const bullet = `- ${CONTRACT_ID}的CPU未激活支持已完成：复用现有50步最终解码RGB及加权逐样本逐类别亮度结构张量，四类对象分别选择最差样本后在同一Loss槽汇总，Checkpoint资格对8条validation记录使用相同逐类别最大值；未新增模型、Loss权重、优化步骤、数据或阈值。下一步仅可执行独立只读GPU梯度资格。\n`
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

for (const file of [authorizationPath, consumptionPath, inactiveConfig, cpuReport, configAudit, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: authorization.runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-per-class-worst-sample-luminance-cpu-${authorization.runId}`, timestamp: now,
  action: "stage4_per_class_worst_sample_final_visible_luminance_structure_cpu_support",
  runId: authorization.runId, kind: "cpu_inactive_support", status: "success",
  title: "Stage4 per-class worst-sample luminance CPU support passed",
  titleZh: "Stage4逐类别最差样本亮度结构CPU支持通过",
  detailZh: "四类对象分别保留最差样本并复用既有Loss槽与派生权重；未读取Checkpoint、未启动GPU或训练。",
  evidencePath: rel(files.terminal), evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: readJson(files.terminal).status,
  terminal: bind(files.terminal), cpuReport: bind(cpuReport), configurationAudit: bind(configAudit),
  inactiveConfig: bind(inactiveConfig), supportContract: bind(files.support), ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule), planSync: bind(files.planSync), consumption: bind(consumptionPath),
}, null, 2))
