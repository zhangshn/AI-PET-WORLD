import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import { CAPACITY_ARM, FUSION_ARM, compileAdjudicationContract, compileSmokeContract, validateAdjudicationContract, validateSmokeContract } from "./lib/ai-painter-stage4-controlled-structure-smoke-contracts.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const canonicalSha = (value) => crypto.createHash("sha256").update(JSON.stringify(value, Object.keys(value).sort())).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const authorizationPath = absolute(arg("--authorization"))
const authorizationSha = arg("--authorization-sha256")
assert.equal(sha(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-controlled-structure-smoke-contract-compilation-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "compile_two_unsigned_unexecuted_controlled_smoke_contracts_and_cross_arm_adjudication_only")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.contractCompilationAuthorized, true)
for (const key of ["ownerPrivateKeyReadAuthorized", "signatureAuthorized", "gpuAuthorized", "checkpointWeightsReadAuthorized", "optimizerAuthorized", "backwardAuthorized", "smokeAuthorized", "trainingAuthorized"]) assert.equal(authorization[key], false, `${key}_must_be_false`)
for (const [name, binding] of Object.entries({ ...authorization.bindings, ...authorization.programLineage })) {
  const target = absolute(binding.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(sha(target), binding.sha256, `${name}_sha256_mismatch`)
}
assert.deepEqual(authorization.taskIdentity, { arms: [FUSION_ARM, CAPACITY_ARM], sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6", sampleSplit: "validation", seed: 20263722, topology: "west", resolution: { width: 256, height: 192 }, epochCount: 30, previewEpochs: [1, 5, 10, 20, 30] })
const output = absolute(authorization.execution.outputDirectory)
const consumption = absolute(authorization.execution.consumptionPath)
assert.equal(fs.existsSync(output), false, "output_directory_already_exists")
assert.equal(fs.existsSync(consumption), false, "authorization_already_consumed")
const check = spawnSync(process.execPath, [authorization.programLineage.checker.path], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr}`)
const cpuReport = JSON.parse(check.stdout)
assert.equal(cpuReport.status, "passed")
assert.equal(cpuReport.positive.passed, cpuReport.positive.total)
assert.equal(cpuReport.negative.passed, cpuReport.negative.total)
const reserve = (offset) => {
  const [date, number] = authorization.runId.split("-")
  return `${date}-${String(Number(number) + offset).padStart(9, "0")}`
}
const fusionReserved = reserve(1)
const capacityReserved = reserve(2)
assert.notEqual(fusionReserved, capacityReserved)
const fusionOutput = absolute(`.runtime/ai-painter/stage4-controlled-structure-controlled-smokes/${fusionReserved}-${FUSION_ARM}`)
const capacityOutput = absolute(`.runtime/ai-painter/stage4-controlled-structure-controlled-smokes/${capacityReserved}-${CAPACITY_ARM}`)
assert.equal(fs.existsSync(fusionOutput), false, "fusion_future_output_already_exists")
assert.equal(fs.existsSync(capacityOutput), false, "capacity_future_output_already_exists")

fs.mkdirSync(path.dirname(consumption), { recursive: true })
const consumeRecord = { schemaVersion: "stage4-controlled-structure-smoke-contract-compilation-consumption-v1", status: "owner_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, oneTimeConsumption: true, authorization: bind(authorizationPath), consumedAtUtc: new Date().toISOString() }
const descriptor = fs.openSync(consumption, "wx")
try { fs.writeFileSync(descriptor, `${JSON.stringify(consumeRecord, null, 2)}\n`, "utf8"); fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const read = (binding) => JSON.parse(fs.readFileSync(absolute(binding.path), "utf8"))
const baselineConfig = read(authorization.bindings.baselineConfig)
const fusionConfig = read(authorization.bindings.fusionConfig)
const capacityConfig = read(authorization.bindings.capacityConfig)
const conditionOrder = baselineConfig.conditionChannelOrder
assert.equal(conditionOrder.length, 23)
const lossIdentity = {
  denoiserLossWeights: baselineConfig.training.denoiserLossWeights,
  trainingContractKeys: Object.keys(baselineConfig.training).filter((key) => key.startsWith("stage4")).sort(),
}
const frozen = {
  approvedDatasetCount: 64,
  split: { train: 48, validation: 8, challenge: 4, regression: 4 },
  sourceIndex: authorization.bindings.sourceIndex,
  conditionChannelCount: 23,
  conditionChannelOrder: conditionOrder,
  conditionChannelOrderSha256: crypto.createHash("sha256").update(JSON.stringify(conditionOrder)).digest("hex"),
  autoencoderCheckpoint: { path: ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt", sha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba" },
  existingLossIdentity: lossIdentity,
  existingLossIdentitySha256: crypto.createHash("sha256").update(JSON.stringify(lossIdentity)).digest("hex"),
  checkpointFormat: baselineConfig.training.checkpointSelection ?? baselineConfig.training.checkpointPolicy ?? "existing_formal_stage4_checkpoint_format_unchanged",
  machineReviewThresholds: "existing_formal_stage4_smoke_thresholds_unchanged",
  dataChanged: false,
  lossChanged: false,
  checkpointFormatChanged: false,
  machineReviewThresholdChanged: false,
}
const qualification = (prefix) => ({ terminal: authorization.bindings[`${prefix}Terminal`], report: authorization.bindings[`${prefix}Report`], cudaTelemetry: authorization.bindings[`${prefix}Cuda`], conditionGradientEvidence: authorization.bindings[`${prefix}Gradient`] })
const fusionContract = compileSmokeContract({ arm: FUSION_ARM, reservedRunId: fusionReserved, sourceConfig: fusionConfig, sourceConfigBinding: authorization.bindings.fusionConfig, qualification: qualification("fusion"), frozen })
const capacityContract = compileSmokeContract({ arm: CAPACITY_ARM, reservedRunId: capacityReserved, sourceConfig: capacityConfig, sourceConfigBinding: authorization.bindings.capacityConfig, qualification: qualification("capacity"), frozen })
const fusionPath = path.join(output, "condition-fusion-only-30-epoch-smoke-contract.json")
const capacityPath = path.join(output, "capacity-only-30-epoch-smoke-contract.json")
writeJsonAtomic(fusionPath, fusionContract)
writeJsonAtomic(capacityPath, capacityContract)
validateSmokeContract(fusionContract, { arm: FUSION_ARM, sourceConfigSha256: authorization.bindings.fusionConfig.sha256, terminalSha256: authorization.bindings.fusionTerminal.sha256, reportSha256: authorization.bindings.fusionReport.sha256, cudaSha256: authorization.bindings.fusionCuda.sha256, gradientSha256: authorization.bindings.fusionGradient.sha256 })
validateSmokeContract(capacityContract, { arm: CAPACITY_ARM, sourceConfigSha256: authorization.bindings.capacityConfig.sha256, terminalSha256: authorization.bindings.capacityTerminal.sha256, reportSha256: authorization.bindings.capacityReport.sha256, cudaSha256: authorization.bindings.capacityCuda.sha256, gradientSha256: authorization.bindings.capacityGradient.sha256 })
const adjudication = compileAdjudicationContract({ fusionContractBinding: bind(fusionPath), capacityContractBinding: bind(capacityPath), baselineConfigBinding: authorization.bindings.baselineConfig, frozen })
const adjudicationPath = path.join(output, "cross-arm-result-adjudication-contract.json")
writeJsonAtomic(adjudicationPath, adjudication)
validateAdjudicationContract(adjudication, { baselineConfigSha256: authorization.bindings.baselineConfig.sha256, fusionContractSha256: sha(fusionPath), capacityContractSha256: sha(capacityPath) })
const namespaceAudit = {
  schemaVersion: "stage4-controlled-structure-smoke-evidence-isolation-audit-v1",
  status: "passed",
  runIdsDistinct: fusionReserved !== capacityReserved,
  outputDirectoriesDistinct: fusionContract.futureEvidenceNamespace.outputDirectory !== capacityContract.futureEvidenceNamespace.outputDirectory,
  authorizationTemplatesDistinct: fusionContract.futureAuthorizationTemplate.requestId !== capacityContract.futureAuthorizationTemplate.requestId,
  checkpointIdentitiesDistinct: fusionContract.futureEvidenceNamespace.checkpointIdentity !== capacityContract.futureEvidenceNamespace.checkpointIdentity,
  manifestIdentitiesDistinct: fusionContract.futureEvidenceNamespace.manifest !== capacityContract.futureEvidenceNamespace.manifest,
  finalizationIdentitiesDistinct: fusionContract.futureEvidenceNamespace.finalization !== capacityContract.futureEvidenceNamespace.finalization,
  futureOutputsAbsent: !fs.existsSync(fusionOutput) && !fs.existsSync(capacityOutput),
  historicalEvidenceAccepted: false,
  failedCheckpointAccepted: false,
  crossArmArtifactAccepted: false,
  baselineExecutionStarted: false,
  smokeStarted: false,
  gpuStarted: false,
  trainingStarted: false,
}
// Explicit assertions keep false-valued safety fields from being mistaken for failures.
for (const key of ["runIdsDistinct", "outputDirectoriesDistinct", "authorizationTemplatesDistinct", "checkpointIdentitiesDistinct", "manifestIdentitiesDistinct", "finalizationIdentitiesDistinct", "futureOutputsAbsent"]) assert.equal(namespaceAudit[key], true)
for (const key of ["historicalEvidenceAccepted", "failedCheckpointAccepted", "crossArmArtifactAccepted", "baselineExecutionStarted", "smokeStarted", "gpuStarted", "trainingStarted"]) assert.equal(namespaceAudit[key], false)
const auditPath = path.join(output, "evidence-isolation-audit.json")
const cpuPath = path.join(output, "cpu-report.json")
writeJsonAtomic(auditPath, namespaceAudit)
writeJsonAtomic(cpuPath, cpuReport)
const now = new Date().toISOString()
const ownerPath = path.join(output, "owner-action-request.json")
writeJsonAtomic(ownerPath, { schemaVersion: "ai-painter-owner-action-request-v1", status: "waiting_owner_authorization", requestedAction: "authorize_separate_execution_of_two_compiled_controlled_smokes_then_readonly_cross_arm_adjudication", fusionSmokeContract: bind(fusionPath), capacitySmokeContract: bind(capacityPath), crossArmAdjudicationContract: bind(adjudicationPath), ownerSignatureRequiredForEachSmoke: true, automaticSmokeStartAuthorized: false, automaticStage0StartAuthorized: false, recordedAtUtc: now })
const terminalPath = path.join(output, "phase-terminal.json")
writeJsonAtomic(terminalPath, { schemaVersion: "stage4-controlled-structure-smoke-contract-compilation-terminal-v1", status: "stage4_controlled_structure_two_smoke_and_cross_arm_contracts_compiled_successfully", authorization: bind(authorizationPath), consumption: bind(consumption), cpuReport: bind(cpuPath), fusionSmokeContract: bind(fusionPath), capacitySmokeContract: bind(capacityPath), crossArmAdjudicationContract: bind(adjudicationPath), evidenceIsolationAudit: bind(auditPath), ownerActionRequest: bind(ownerPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, safety: { ownerPrivateKeyRead: false, signed: false, gpuStarted: false, checkpointRead: false, optimizerCreated: false, backwardExecuted: false, smokeStarted: false, trainingStarted: false }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
const capsulePath = path.join(output, "local-task-capsule.json")
writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Two controlled structure Smoke contracts compiled but unsigned and unexecuted", latestTerminal: bind(terminalPath), nextLegalAction: "separately_authorize_and_execute_two_controlled_smokes_then_readonly_cross_arm_adjudication", recordedAtUtc: now })
const planPath = absolute("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const beforePlan = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4两个受控结构臂的只读GPU资格已通过，两份独立30 Epoch Smoke合同及跨臂裁决合同已编译但未签署、未执行；未启动GPU或训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true)
const bullet = "- Stage4条件融合臂和容量臂已分别形成独立、未签署、未执行的30 Epoch受控Smoke合同；两臂固定样本194、种子20263722、west拓扑、256×192和Epoch 1/5/10/20/30预览，未来授权、runId、输出、Checkpoint、Manifest及Finalization命名空间相互隔离。跨臂裁决合同只接受这两份未来Smoke的新证据，基线只作结构参照；当前未启动Smoke或训练。\n"
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
const temporary = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(temporary, plan, "utf8")
fs.renameSync(temporary, planPath)
const planSyncPath = path.join(output, "plan-sync-record.json")
writeJsonAtomic(planSyncPath, { schemaVersion: "stage4-controlled-structure-smoke-contract-compilation-plan-sync-v1", status: "unique_plan_synchronized", planPath: relative(planPath), beforeSha256: beforePlan, afterSha256: sha(planPath), terminal: bind(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now })
for (const target of [authorizationPath, consumption, fusionPath, capacityPath, adjudicationPath, auditPath, cpuPath, ownerPath, terminalPath, capsulePath, planSyncPath]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_controlled_structure_smoke_contract_compilation", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({ id: `stage4-controlled-structure-smoke-contract-compilation-${authorization.runId}`, timestamp: now, action: "stage4_controlled_structure_smoke_contract_compilation", runId: authorization.runId, kind: "cpu_contract_compilation", status: "success", title: "Stage4 controlled structure Smoke contracts compiled", titleZh: "Stage4两个受控结构臂Smoke合同及跨臂裁决合同编译完成", detailZh: "两份未来Smoke保持未签署、未授权、未消费、未执行；未读取Checkpoint、未启动GPU或训练。", evidencePath: relative(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: JSON.parse(fs.readFileSync(terminalPath, "utf8")).status, terminal: bind(terminalPath), fusionSmokeContract: bind(fusionPath), capacitySmokeContract: bind(capacityPath), crossArmAdjudicationContract: bind(adjudicationPath), cpuReport: bind(cpuPath), evidenceIsolationAudit: bind(auditPath), ownerActionRequest: bind(ownerPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } }, null, 2))
