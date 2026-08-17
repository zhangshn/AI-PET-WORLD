import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"


const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")

const output = path.join(
  root, ".runtime", "ai-painter",
  "stage4-full-rollout-worst-sample-class-reference-luminance-cpu-implementations",
  runId,
)
const requestId = `owner-authorized-stage4-full-rollout-worst-sample-class-reference-luminance-cpu-implementation-${runId}`
const authorizationRoot = path.join(root, ".runtime", "ai-painter", "owner-action-requests", requestId)
const files = {
  config: path.join(output, "inactive-config.json"),
  cpu: path.join(output, "cpu-report.json"),
  audit: path.join(output, "configuration-audit.json"),
  support: path.join(output, "training-objective-support-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  authorization: path.join(authorizationRoot, "authorization.json"),
  consumption: path.join(authorizationRoot, "implementation-consumption.json"),
}
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const projectPath = (file) => path.relative(root, file).replace(/\\/g, "/")
const bind = (file) => ({ path: projectPath(file), sha256: hash(file) })

for (const file of [files.config, files.cpu, files.authorization, files.consumption]) {
  if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)
}
for (const file of [files.audit, files.support, files.owner, files.terminal, files.capsule]) {
  if (fs.existsSync(file)) throw new Error(`immutable output exists: ${projectPath(file)}`)
}
const cpu = JSON.parse(fs.readFileSync(files.cpu, "utf8"))
const config = JSON.parse(fs.readFileSync(files.config, "utf8"))
const authorization = JSON.parse(fs.readFileSync(files.authorization, "utf8"))
const consumption = JSON.parse(fs.readFileSync(files.consumption, "utf8"))
const contract = config.training?.stage4FullRolloutWorstSampleClassReferenceLuminanceObligation
const existing = config.training?.stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation
const auditChecks = {
  exactContractIdentity:
    contract?.contractId === "stage4_full_rollout_worst_sample_class_reference_luminance_obligation_v1",
  inactiveAndAllGatesClosed:
    contract?.status === "cpu_support_verified_inactive"
    && Object.values(contract?.activationGate ?? {}).every((value) => value === false),
  perSampleClassMaximum:
    contract?.aggregation?.perSample === "retain_each_batch_sample_before_aggregation"
    && contract?.aggregation?.selection === "maximum_over_sample_and_class",
  existingDerivedWeightsReused:
    JSON.stringify(contract?.sourceContract?.derivedWeights)
    === JSON.stringify(existing?.sourceContract?.derivedWeights),
  existingRolloutWeightReused:
    contract?.aggregation?.rolloutWeight
    === config.training?.stage4FullRolloutFinalVisibleConsistency?.weight,
  legalOriginalSupervisionOnly:
    contract?.legalSupervision?.reference === "original_owner_approved_reference_rgb"
    && contract?.legalSupervision?.conditionPack === "original_compiled_23_channel_condition_pack"
    && contract?.legalSupervision?.failedPreviewPixelsUsedAsTargets === false
    && contract?.legalSupervision?.machineReviewThresholdsUsedAsTargets === false
    && contract?.legalSupervision?.machineReviewResultsUsedAsTargets === false,
  westBoundaryNonRegression:
    JSON.stringify(contract?.routeWestBoundaryNonRegression?.requiredBoundarySides) === JSON.stringify(["west"])
    && contract?.routeWestBoundaryNonRegression?.freeThresholdSelected === false,
  frozenCompatibility:
    Object.values(contract?.compatibility ?? {}).every((value, index) =>
      index === Object.keys(contract.compatibility).length - 1 ? value === true : value === false
    ),
}
if (
  cpu.status !== "passed_stage4_full_rollout_worst_sample_class_reference_luminance_cpu_contract"
  || cpu.positivePassed !== cpu.positiveTotal
  || cpu.negativePassed !== cpu.negativeTotal
  || !Object.values(auditChecks).every(Boolean)
  || authorization.requestId !== requestId
  || consumption.authorizationSha256 !== hash(files.authorization)
) throw new Error("CPU success evidence or configuration audit is invalid")

const timestamp = new Date().toISOString()
const fixedTotalProgress = { completedStages: 3, totalStages: 5, percent: 60 }
writeJsonAtomic(files.audit, {
  schemaVersion: "stage4-full-rollout-worst-sample-class-reference-luminance-configuration-audit-v1",
  status: "passed",
  runId,
  checks: auditChecks,
  inactiveConfig: bind(files.config),
  cpuReport: bind(files.cpu),
  checkpointWeightsRead: false,
  gpuUsed: false,
  trainingStarted: false,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
const common = {
  runId,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
  fixedTotalProgress,
  inactiveConfig: bind(files.config),
  cpuReport: bind(files.cpu),
  configurationAudit: bind(files.audit),
  implementationAuthorization: bind(files.authorization),
  implementationConsumption: bind(files.consumption),
  checkpointWeightsRead: false,
  optimizerCreated: false,
  backwardExecuted: false,
  gpuUsed: false,
  trainingStarted: false,
}
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-full-rollout-worst-sample-class-reference-luminance-support-contract-v1",
  status: "cpu_support_verified_inactive",
  contractId: contract.contractId,
  sourceContract: contract.sourceContract,
  requiredClasses: contract.requiredClasses,
  rolloutBinding: contract.rolloutBinding,
  aggregation: contract.aggregation,
  checkpointQualification: contract.checkpointQualification,
  routeWestBoundaryNonRegression: contract.routeWestBoundaryNonRegression,
  legalSupervision: contract.legalSupervision,
  compatibility: contract.compatibility,
  subsequentReadonlyGpuQualificationRequiresSeparateOwnerAuthorization: true,
  subsequentSmokeOrTrainingRequiresSeparateOwnerAuthorization: true,
  ...common,
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_executed",
  requestedAction: "one_readonly_gpu_50_step_worst_sample_class_reference_luminance_gradient_qualification",
  nextAfterSuccess: "compile_new_candidate_smoke_entry_then_owner_authorize_one_new_smoke",
  forbiddenActions: authorization.deniedActions,
  ...common,
})
const support = bind(files.support)
const owner = bind(files.owner)
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-full-rollout-worst-sample-class-reference-luminance-cpu-terminal-v1",
  status: "stage4_full_rollout_worst_sample_class_reference_luminance_cpu_succeeded_closed",
  nextLegalAction: "separately_authorized_readonly_gpu_qualification",
  supportContract: support,
  ownerActionRequest: owner,
  ...common,
})
const terminal = bind(files.terminal)
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress,
  currentStage: "Stage4 worst validation sample-class final-visible luminance CPU support complete",
  candidateTerminal: terminal,
  latestBlocker: "readonly_gpu_qualification_not_yet_authorized",
  nextLegalAction: "one_readonly_gpu_50_step_worst_sample_class_reference_luminance_qualification",
  evidence: {
    inactiveConfig: common.inactiveConfig,
    cpuReport: common.cpuReport,
    configurationAudit: common.configurationAudit,
    supportContract: support,
    ownerActionRequest: owner,
  },
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: common.recordedAtAsiaShanghai,
})

for (const file of [files.config, files.cpu, files.audit, files.support, files.owner, files.terminal, files.capsule]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: "stage4_full_rollout_worst_sample_class_reference_luminance_cpu_support",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: hash(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-full-rollout-worst-sample-class-reference-luminance-cpu-${runId}`,
  timestamp,
  action: "stage4_full_rollout_worst_sample_class_reference_luminance_cpu_support",
  runId,
  kind: "cpu_validation",
  status: "success",
  title: "Stage4 worst sample-class final-visible luminance CPU support completed",
  titleZh: "Stage4最差样本—类别最终可见亮度CPU支持完成",
  detailZh: `CPU正向${cpu.positivePassed}/${cpu.positiveTotal}、反向${cpu.negativePassed}/${cpu.negativeTotal}，配置审计全部通过；未读取Checkpoint、未创建优化器、未执行.backward()、未启动GPU或训练。`,
  evidencePath: projectPath(files.terminal),
  evidenceSha256: hash(files.terminal),
  fixedTotalProgress,
})
console.log(JSON.stringify({
  status: "recorded",
  terminal,
  supportContract: support,
  ownerActionRequest: owner,
  configurationAudit: bind(files.audit),
  localTaskCapsule: bind(files.capsule),
}, null, 2))
