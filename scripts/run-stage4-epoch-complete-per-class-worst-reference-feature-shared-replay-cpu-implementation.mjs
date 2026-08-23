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
const CONTRACT_ID = "stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_selection_and_shared_replay_v1"
const AUTH_SCHEMA = "owner-authorized-stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementation-v1"
const SCOPE = "one_cpu_inactive_stage4_epoch_complete_per_class_worst_reference_feature_selection_and_shared_replay_implementation"
const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1] }
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/")
const bind = (file) => ({ path: rel(file), sha256: sha(file) })
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.equal(resolved.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return resolved
}
const run = (command, args) => spawnSync(command, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
const writeTextAtomic = (target, value) => {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  const fd = fs.openSync(temporary, "wx")
  try { fs.writeFileSync(fd, value, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(temporary, target)
}

const authorizationArg = arg("--authorization")
const authorizationSha = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(sha(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, AUTH_SCHEMA)
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.contractId, CONTRACT_ID)
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
  assert.equal(sha(source), binding.sha256, `${name}_sha256_mismatch`)
}
assert.equal(fs.existsSync(PYTHON), true, "project_python_missing")

const trainer = projectFile("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const compiler = projectFile("ml/ai-painter/scripts/compile_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_config.py")
const checker = projectFile("ml/ai-painter/scripts/check_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_cpu.py")
const syntax = run(PYTHON, ["-m", "py_compile", rel(trainer), rel(compiler), rel(checker)])
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAt = new Date().toISOString()
writeJsonAtomic(consumptionPath, {
  schemaVersion: "stage4-reference-feature-shared-replay-cpu-consumption-v1",
  status: "consumed_once", requestId: authorization.requestId,
  commandRef: authorization.commandRef, scope: SCOPE,
  authorizationPath: authorizationArg, authorizationSha256: authorizationSha,
  oneTimeConsumption: true, consumedAtUtc: consumedAt,
  consumedAtAsiaShanghai: formatShanghai(consumedAt),
})
const consumptionSha = sha(consumptionPath)
const source = authorization.sourceEvidence.priorInactiveConfig
const inactiveConfig = path.join(output, "inactive-config.json")
const compiled = run(PYTHON, [
  rel(compiler), "--source", source.path, "--source-sha256", source.sha256,
  "--authorization", authorizationArg, "--authorization-sha256", authorizationSha,
  "--consumption", consumptionArg, "--consumption-sha256", consumptionSha,
  "--output", rel(inactiveConfig),
])
assert.equal(compiled.status, 0, `inactive_config_failed:${compiled.stdout}:${compiled.stderr}`)
const cpuReport = path.join(output, "cpu-report.json")
const audit = path.join(output, "configuration-audit.json")
const checked = run(PYTHON, [
  rel(checker), "--config", rel(inactiveConfig), "--config-sha256", sha(inactiveConfig),
  "--source", source.path, "--source-sha256", source.sha256,
  "--output", rel(cpuReport), "--audit-output", rel(audit),
])
assert.equal(checked.status, 0, `cpu_regression_failed:${checked.stdout}:${checked.stderr}`)
const cpu = read(cpuReport)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
assert.equal(read(audit).status, "passed_configuration_audit")

const now = new Date().toISOString()
const files = {
  attestation: path.join(output, "implementation-attestation.json"),
  support: path.join(output, "training-objective-support-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-reference-feature-shared-replay-implementation-attestation-v1",
  status: "cpu_implementation_verified", contractId: CONTRACT_ID,
  implementation: { trainer: bind(trainer), compiler: bind(compiler), checker: bind(checker) },
  authorization: bind(authorizationPath), consumption: bind(consumptionPath),
  runtimeActions: { checkpointRead: false, optimizerCreated: false, backwardExecuted: false, gpuStarted: false, trainingStarted: false },
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-reference-feature-shared-replay-support-contract-v1",
  status: "cpu_support_verified_inactive", contractId: CONTRACT_ID,
  inactiveConfig: bind(inactiveConfig), cpuReport: bind(cpuReport), configurationAudit: bind(audit),
  implementationAttestation: bind(files.attestation), authorization: bind(authorizationPath), consumption: bind(consumptionPath),
  guarantees: {
    trainPopulation: 48, validationPopulation: 8, allExistingRolloutSeeds: true,
    independentClasses: ["footprints", "tree", "rock", "vegetation"],
    detachedScoreIdentityLedgerOnly: true, lexicographicSampleIdTieBreak: true,
    objectiveOrder: ["luminance", "reference_feature_structure"],
    sharedExistingReplayPasses: 2, addedReplayPasses: 0, addedOptimizerSteps: 0,
    existingLuminanceReplayPreserved: true, oldModesPreserved: true,
  },
  activation: { checkpointRead: false, optimizer: false, backward: false, weightMutation: false, gpu: false, training: false },
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "owner_readonly_gpu_qualification_authorization_required_not_authorized",
  requestedAction: `execute_${CONTRACT_ID}_independent_readonly_gpu_qualification`,
  boundInactiveConfig: bind(inactiveConfig), boundSupportContract: bind(files.support),
  boundCpuReport: bind(cpuReport), boundConfigurationAudit: bind(audit), automaticApproval: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-reference-feature-shared-replay-cpu-terminal-v1",
  status: "stage4_reference_feature_shared_replay_cpu_succeeded_closed", contractId: CONTRACT_ID,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  inactiveConfig: bind(inactiveConfig), supportContract: bind(files.support), cpuReport: bind(cpuReport),
  configurationAudit: bind(audit), ownerActionRequest: bind(files.owner), implementationAttestation: bind(files.attestation),
  checkpointRead: false, optimizerCreated: false, backwardExecuted: false, gpuStarted: false, trainingStarted: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 full-Epoch per-class reference-feature shared replay CPU support completed",
  latestTerminal: bind(files.terminal), latestSupportContract: bind(files.support),
  nextLegalAction: `owner_authorize_readonly_gpu_qualification_for_${CONTRACT_ID}`,
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, `状态：active-module-plan / AI Painter固定进度3/5（60%）；${CONTRACT_ID} CPU未激活支持、完整Epoch双目标共享回放及validation身份审计已通过；尚未执行只读GPU资格、Smoke或正式训练`)
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "plan_anchor_missing")
const bullet = `- ${CONTRACT_ID} CPU未激活支持已完成：48条train逐类参考特征最差身份与现有亮度身份共用唯一完整Epoch账本内核，按正式类别和目标顺序轮转复用既有两次回放；8条validation及既有rollout seeds身份进入Checkpoint资格。未增加优化步骤、Loss权重、数据或阈值。下一步仅可执行独立只读GPU资格。\n`
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, {
  schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized",
  plan: bind(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
for (const file of [authorizationPath, consumptionPath, inactiveConfig, cpuReport, audit, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: authorization.runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-reference-feature-shared-replay-cpu-${authorization.runId}`, timestamp: now,
  action: "stage4_reference_feature_shared_replay_cpu_support", runId: authorization.runId,
  kind: "cpu_inactive_support", status: "success",
  title: "Stage4 full-Epoch per-class reference-feature shared replay CPU support passed",
  titleZh: "Stage4完整Epoch逐类别参考特征共享回放CPU支持通过",
  detailZh: "48条训练记录按四类独立选择；亮度与参考特征目标共享原有两次回放，validation身份覆盖8条记录及既有种子。未读取Checkpoint、未启动GPU或训练。",
  evidencePath: rel(files.terminal), evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status, terminal: bind(files.terminal), cpuReport: bind(cpuReport),
  configurationAudit: bind(audit), inactiveConfig: bind(inactiveConfig), supportContract: bind(files.support),
  ownerActionRequest: bind(files.owner), implementationAttestation: bind(files.attestation),
  capsule: bind(files.capsule), planSync: bind(files.planSync), consumption: bind(consumptionPath),
}, null, 2))
