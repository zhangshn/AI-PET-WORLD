import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  RESPONSIBILITY_ORDER,
  compileControlledThreeComponentStage0SmokeContract,
  validateControlledThreeComponentStage0SmokeContract,
} from "./lib/ai-painter-stage4-isolated-responsibility-component-smoke-contracts.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const read = (binding) => JSON.parse(fs.readFileSync(absolute(binding.path), "utf8"))

const authorizationPath = absolute(arg("--authorization"))
const authorizationSha = arg("--authorization-sha256")
assert.equal(sha(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-controlled-three-component-stage0-smoke-contract-compilation-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "compile_one_unsigned_unexecuted_controlled_three_component_stage0_smoke_contract_only")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.contractCompilationAuthorized, true)
for (const key of ["ownerPrivateKeyReadAuthorized", "signatureAuthorized", "gpuAuthorizationCreationAuthorized", "gpuAuthorizationConsumptionAuthorized", "checkpointWeightsReadAuthorized", "optimizerAuthorized", "backwardAuthorized", "modelWeightModificationAuthorized", "smokeAuthorized", "stage0Authorized", "stage1Authorized", "stage2Authorized", "trainingAuthorized"]) assert.equal(authorization[key], false, `${key}_must_be_false`)
for (const [name, binding] of Object.entries({ ...authorization.bindings, ...authorization.programLineage })) {
  const target = absolute(binding.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(sha(target), binding.sha256, `${name}_sha256_mismatch`)
}
assert.deepEqual(authorization.taskIdentity.responsibilityOrder, RESPONSIBILITY_ORDER)

const output = absolute(authorization.execution.outputDirectory)
const consumption = absolute(authorization.execution.consumptionPath)
assert.equal(fs.existsSync(output), false, "output_directory_already_exists")
assert.equal(fs.existsSync(consumption), false, "authorization_already_consumed")

const checker = spawnSync(process.execPath, [absolute(authorization.programLineage.checker.path)], { cwd: ROOT, encoding: "utf8" })
assert.equal(checker.status, 0, `cpu_regression_failed:${checker.stderr}`)
const cpuReport = JSON.parse(checker.stdout)
assert.equal(cpuReport.status, "passed")
assert.equal(cpuReport.positive.passed, cpuReport.positive.total)
assert.equal(cpuReport.negative.passed, cpuReport.negative.total)

fs.mkdirSync(path.dirname(consumption), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumptionRecord = {
  schemaVersion: "stage4-controlled-three-component-stage0-smoke-contract-compilation-consumption-v1",
  status: "owner_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  oneTimeConsumption: true,
  authorization: bind(authorizationPath),
  consumedAtUtc,
}
const descriptor = fs.openSync(consumption, "wx")
try {
  fs.writeFileSync(descriptor, `${JSON.stringify(consumptionRecord, null, 2)}\n`, "utf8")
  fs.fsyncSync(descriptor)
} finally {
  fs.closeSync(descriptor)
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })

const supportContract = read(authorization.bindings.componentSupportContract)
const qualificationSuccessTerminal = read(authorization.bindings.combinedTerminal)
const roleKeys = {
  terrain_route_hydrology_spatial_realization: "terrain",
  per_class_object_semantic_realization: "object",
  global_visual_harmonization_and_native_complete_rgb_decode: "final",
}
const sourceConfigs = {}
const sourceConfigBindings = {}
const qualificationBindings = { combined: authorization.bindings.combinedTerminal }
for (const roleId of RESPONSIBILITY_ORDER) {
  const prefix = roleKeys[roleId]
  sourceConfigBindings[roleId] = authorization.bindings[`${prefix}Config`]
  sourceConfigs[roleId] = read(sourceConfigBindings[roleId])
  qualificationBindings[roleId] = {
    terminal: authorization.bindings[`${prefix}Terminal`],
    report: authorization.bindings[`${prefix}Report`],
    cudaTelemetry: authorization.bindings[`${prefix}Cuda`],
    outputIdentity: authorization.bindings[`${prefix}OutputIdentity`],
    parameterNamespaceIdentity: authorization.bindings[`${prefix}ParameterNamespaceIdentity`],
  }
}
const channelOrders = RESPONSIBILITY_ORDER.map((roleId) => sourceConfigs[roleId].conditionChannelOrder)
for (const order of channelOrders) assert.deepEqual(order, channelOrders[0], "condition_channel_order_mismatch")
assert.equal(channelOrders[0].length, 23)
const lossIdentities = RESPONSIBILITY_ORDER.map((roleId) => ({
  denoiserLossVersion: sourceConfigs[roleId].training.denoiserLossVersion,
  denoiserLossWeights: sourceConfigs[roleId].training.denoiserLossWeights,
}))
for (const identity of lossIdentities) assert.deepEqual(identity, lossIdentities[0], "existing_loss_identity_mismatch")
const frozen = {
  approvedDatasetCount: 64,
  split: { train: 48, validation: 8, challenge: 4, regression: 4 },
  sourceIndex: authorization.bindings.sourceIndex,
  conditionChannelCount: 23,
  conditionChannelOrder: channelOrders[0],
  conditionChannelOrderSha256: crypto.createHash("sha256").update(JSON.stringify(channelOrders[0])).digest("hex"),
  autoencoderFrozen: true,
  projectAutoencoder: { path: ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt", sha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba" },
  existingLossIdentity: lossIdentities[0],
  existingLossIdentitySha256: crypto.createHash("sha256").update(JSON.stringify(lossIdentities[0])).digest("hex"),
  checkpointFormat: "existing_formal_stage4_checkpoint_format_unchanged",
  machineReviewThresholds: "existing_formal_stage4_machine_review_thresholds_unchanged",
  dataChanged: false,
  splitChanged: false,
  conditionChannelsChanged: false,
  existingLossValuesAndWeightsChanged: false,
  checkpointFormatChanged: false,
  machineReviewThresholdChanged: false,
}

const contract = compileControlledThreeComponentStage0SmokeContract({
  compilationRunId: authorization.runId,
  sourceConfigs,
  sourceConfigBindings,
  supportContract,
  supportContractBinding: authorization.bindings.componentSupportContract,
  qualificationSuccessTerminal,
  qualificationBindings,
  frozen,
})
const expected = {
  supportContractSha256: authorization.bindings.componentSupportContract.sha256,
  combinedTerminalSha256: authorization.bindings.combinedTerminal.sha256,
  configSha256s: Object.fromEntries(RESPONSIBILITY_ORDER.map((roleId) => [roleId, sourceConfigBindings[roleId].sha256])),
  qualificationSha256s: Object.fromEntries(RESPONSIBILITY_ORDER.map((roleId) => [roleId, {
    terminal: qualificationBindings[roleId].terminal.sha256,
    report: qualificationBindings[roleId].report.sha256,
    cudaTelemetry: qualificationBindings[roleId].cudaTelemetry.sha256,
  }])),
}
validateControlledThreeComponentStage0SmokeContract(contract, expected)
for (const component of contract.components) assert.equal(fs.existsSync(absolute(component.futureEvidenceNamespace.outputDirectory)), false, `${component.roleId}_future_output_already_exists`)

const contractPath = path.join(output, "controlled-three-component-stage0-smoke-contract.json")
writeJsonAtomic(contractPath, contract)
const evidenceAudit = {
  schemaVersion: "stage4-controlled-three-component-stage0-smoke-evidence-isolation-audit-v1",
  status: "passed",
  responsibilityOrder: [...RESPONSIBILITY_ORDER],
  authorizationTemplateCount: 3,
  runIdsDistinct: new Set(contract.components.map((item) => item.futureAuthorizationTemplate.reservedRunId)).size === 3,
  outputDirectoriesDistinct: new Set(contract.components.map((item) => item.futureEvidenceNamespace.outputDirectory)).size === 3,
  parameterNamespacesDistinct: new Set(contract.components.map((item) => item.parameterNamespace)).size === 3,
  checkpointIdentitiesDistinct: new Set(contract.components.map((item) => item.futureEvidenceNamespace.checkpointIdentity)).size === 3,
  outputIdentitiesDistinct: new Set(contract.components.map((item) => item.futureEvidenceNamespace.outputIdentity)).size === 3,
  terminalIdentitiesDistinct: new Set(contract.components.map((item) => item.futureEvidenceNamespace.phaseTerminal)).size === 3,
  samePackageImmediatePredecessorOnly: contract.components.every((item) => item.predecessor.sameSmokePackageRequired),
  futureOutputDirectoriesAbsent: contract.components.every((item) => !fs.existsSync(absolute(item.futureEvidenceNamespace.outputDirectory))),
  sourceBindingsSha256Verified: true,
  historicalRunAccepted: false,
  historicalDenoiserAccepted: false,
  failedCheckpointAccepted: false,
  crossComponentArtifactAccepted: false,
  ownerPrivateKeyRead: false,
  signed: false,
  gpuAuthorizationCreatedOrConsumed: false,
  checkpointWeightsRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  modelWeightsModified: false,
  smokeStarted: false,
  trainingStarted: false,
}
for (const key of ["runIdsDistinct", "outputDirectoriesDistinct", "parameterNamespacesDistinct", "checkpointIdentitiesDistinct", "outputIdentitiesDistinct", "terminalIdentitiesDistinct", "samePackageImmediatePredecessorOnly", "futureOutputDirectoriesAbsent", "sourceBindingsSha256Verified"]) assert.equal(evidenceAudit[key], true)
for (const key of ["historicalRunAccepted", "historicalDenoiserAccepted", "failedCheckpointAccepted", "crossComponentArtifactAccepted", "ownerPrivateKeyRead", "signed", "gpuAuthorizationCreatedOrConsumed", "checkpointWeightsRead", "gpuStarted", "optimizerCreated", "backwardExecuted", "modelWeightsModified", "smokeStarted", "trainingStarted"]) assert.equal(evidenceAudit[key], false)
const cpuPath = path.join(output, "cpu-report.json")
const auditPath = path.join(output, "evidence-isolation-audit.json")
writeJsonAtomic(cpuPath, cpuReport)
writeJsonAtomic(auditPath, evidenceAudit)

const now = new Date().toISOString()
const ownerPath = path.join(output, "owner-action-request.json")
writeJsonAtomic(ownerPath, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "waiting_owner_authorization",
  requestedAction: "authorize_one_controlled_three_component_stage0_smoke_package_execution",
  smokeContract: bind(contractPath),
  responsibilityOrder: [...RESPONSIBILITY_ORDER],
  onePackageThreeIndependentRoleAuthorizationsRequired: true,
  strictSequentialExecutionRequired: true,
  stopOnFailureRequired: true,
  automaticSmokeStartAuthorized: false,
  automaticStage0StartAuthorized: false,
  recordedAtUtc: now,
})
const terminalPath = path.join(output, "phase-terminal.json")
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-controlled-three-component-stage0-smoke-contract-compilation-terminal-v1",
  status: "stage4_controlled_three_component_stage0_smoke_contract_compiled_successfully",
  authorization: bind(authorizationPath),
  consumption: bind(consumption),
  cpuReport: bind(cpuPath),
  smokeContract: bind(contractPath),
  evidenceIsolationAudit: bind(auditPath),
  ownerActionRequest: bind(ownerPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  safety: { ownerPrivateKeyRead: false, signed: false, gpuAuthorizationCreatedOrConsumed: false, checkpointRead: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, smokeStarted: false, stage0Started: false, stage1Started: false, stage2Started: false, trainingStarted: false },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
const capsulePath = path.join(output, "local-task-capsule.json")
writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Controlled three-component Stage 0 Smoke contract compiled but unsigned and unexecuted",
  latestTerminal: bind(terminalPath),
  nextLegalAction: "owner_may_authorize_one_controlled_three_component_stage0_smoke_package_execution",
  recordedAtUtc: now,
})

const planPath = absolute("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const beforePlan = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4三个责任隔离组件只读GPU资格已通过，受控三组件Stage 0 Smoke合同已编译但未签署、未执行；未启动GPU或训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true)
const bullet = "- Stage4受控三组件Stage 0 Smoke合同已完成CPU正反回归、固定身份编译和证据隔离审计；地形、对象、最终视觉三个未来角色具有独立授权模板、runId、输出、参数、Checkpoint及终态命名空间，并严格消费同包前序成功证据。合同当前未签署、未执行，未创建或消费GPU授权，未启动Smoke或训练。\n"
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
const temporary = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(temporary, plan, "utf8")
fs.renameSync(temporary, planPath)
const planSyncPath = path.join(output, "plan-sync-record.json")
writeJsonAtomic(planSyncPath, { schemaVersion: "stage4-controlled-three-component-stage0-smoke-contract-compilation-plan-sync-v1", status: "unique_plan_synchronized", planPath: relative(planPath), beforeSha256: beforePlan, afterSha256: sha(planPath), terminal: bind(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now })

for (const target of [authorizationPath, consumption, contractPath, auditPath, cpuPath, ownerPath, terminalPath, capsulePath, planSyncPath]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_controlled_three_component_stage0_smoke_contract_compilation", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-controlled-three-component-stage0-smoke-contract-compilation-${authorization.runId}`,
  timestamp: now,
  action: "stage4_controlled_three_component_stage0_smoke_contract_compilation",
  runId: authorization.runId,
  kind: "cpu_contract_compilation",
  status: "success",
  title: "Stage4 controlled three-component Stage 0 Smoke contract compiled",
  titleZh: "Stage4受控三组件Stage 0 Smoke合同编译完成",
  detailZh: "合同保持未签署、未授权、未执行；未创建或消费GPU授权，未读取Checkpoint，未启动GPU或训练。",
  evidencePath: relative(terminalPath),
  evidenceSha256: sha(terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

console.log(JSON.stringify({
  status: JSON.parse(fs.readFileSync(terminalPath, "utf8")).status,
  terminal: bind(terminalPath),
  smokeContract: bind(contractPath),
  cpuReport: bind(cpuPath),
  evidenceIsolationAudit: bind(auditPath),
  ownerActionRequest: bind(ownerPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
}, null, 2))
