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

const requestId = `owner-authorized-stage4-per-class-worst-sample-reference-feature-structure-cpu-${runId}`
const output = path.join(
  root,
  ".runtime",
  "ai-painter",
  "stage4-per-class-worst-sample-reference-feature-structure-cpu-implementations",
  runId,
)
const authorizationRoot = path.join(root, ".runtime", "ai-painter", "owner-action-requests", requestId)
const files = {
  config: path.join(output, "inactive-config.json"),
  cpu: path.join(output, "cpu-report.json"),
  audit: path.join(output, "configuration-audit.json"),
  legacyCpu: path.join(output, "legacy-reference-feature-replay-cpu-report.json"),
  legacyAudit: path.join(output, "legacy-reference-feature-replay-config-audit.json"),
  support: path.join(output, "training-objective-support-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  authorization: path.join(authorizationRoot, "implementation-authorization.json"),
  consumption: path.join(authorizationRoot, "implementation-consumption.json"),
  trainer: path.join(root, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py"),
  compiler: path.join(root, "ml", "ai-painter", "scripts", "compile_stage4_per_class_worst_sample_reference_feature_structure_obligation_config.py"),
  checker: path.join(root, "ml", "ai-painter", "scripts", "check_stage4_per_class_worst_sample_reference_feature_structure_obligation_cpu.py"),
  plan: path.join(root, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md"),
}

const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const projectPath = (file) => path.relative(root, file).replace(/\\/g, "/")
const bind = (file) => ({ path: projectPath(file), sha256: hash(file) })

for (const file of [
  files.config,
  files.cpu,
  files.audit,
  files.legacyCpu,
  files.legacyAudit,
  files.authorization,
  files.consumption,
  files.trainer,
  files.compiler,
  files.checker,
  files.plan,
]) {
  if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)
}
for (const file of [files.support, files.owner, files.terminal, files.capsule]) {
  if (fs.existsSync(file)) throw new Error(`immutable output exists: ${projectPath(file)}`)
}

const config = JSON.parse(fs.readFileSync(files.config, "utf8"))
const cpu = JSON.parse(fs.readFileSync(files.cpu, "utf8"))
const audit = JSON.parse(fs.readFileSync(files.audit, "utf8"))
const legacyCpu = JSON.parse(fs.readFileSync(files.legacyCpu, "utf8"))
const authorization = JSON.parse(fs.readFileSync(files.authorization, "utf8"))
const consumption = JSON.parse(fs.readFileSync(files.consumption, "utf8"))
const contract = config.training?.stage4PerClassWorstSampleReferenceFeatureStructureObligation

if (
  contract?.contractId !== "stage4_per_class_worst_sample_reference_feature_structure_obligation_v1"
  || contract?.status !== "cpu_support_verified_inactive"
  || Object.values(contract?.activationGate ?? {}).some((value) => value !== false)
  || cpu.status !== "passed_stage4_per_class_worst_sample_reference_feature_structure_cpu_contract"
  || cpu.positivePassed !== 15
  || cpu.positiveTotal !== 15
  || cpu.negativePassed !== 21
  || cpu.negativeTotal !== 21
  || audit.status !== "passed_configuration_audit"
  || audit.allActivationGatesFalse !== true
  || legacyCpu.status !== "passed_stage4_epoch_worst_reference_feature_replay_cpu_contract"
  || legacyCpu.positivePassed !== legacyCpu.positiveTotal
  || legacyCpu.negativePassed !== legacyCpu.negativeTotal
  || authorization.requestId !== requestId
  || authorization.scope !== "one_cpu_inactive_stage4_per_class_worst_sample_reference_feature_structure_obligation_implementation"
  || consumption.status !== "consumed_once"
  || consumption.authorizationSha256 !== hash(files.authorization)
) throw new Error("CPU success evidence or immutable implementation lineage is invalid")

const timestamp = new Date().toISOString()
const fixedTotalProgress = { completedStages: 3, totalStages: 5, percent: 60 }
const common = {
  runId,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
  fixedTotalProgress,
  inactiveConfig: bind(files.config),
  cpuReport: bind(files.cpu),
  configurationAudit: bind(files.audit),
  legacyCompatibilityCpuReport: bind(files.legacyCpu),
  legacyCompatibilityAudit: bind(files.legacyAudit),
  implementationAuthorization: bind(files.authorization),
  implementationConsumption: bind(files.consumption),
  implementation: {
    trainer: bind(files.trainer),
    compiler: bind(files.compiler),
    cpuChecker: bind(files.checker),
  },
  checkpointWeightsRead: false,
  optimizerCreated: false,
  backwardExecuted: false,
  gpuUsed: false,
  trainingStarted: false,
}

writeJsonAtomic(files.support, {
  schemaVersion: "stage4-per-class-worst-sample-reference-feature-structure-support-contract-v1",
  status: "cpu_support_verified_inactive",
  contractId: contract.contractId,
  sourceContracts: contract.sourceContracts,
  selection: contract.selection,
  totalLoss: contract.totalLoss,
  checkpointQualification: contract.checkpointQualification,
  legalSupervision: contract.legalSupervision,
  compatibility: contract.compatibility,
  subsequentReadonlyGpuQualificationRequiresSeparateOwnerAuthorization: true,
  subsequentSmokeOrTrainingRequiresSeparateOwnerAuthorization: true,
  ...common,
})

writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_executed",
  requestedAction: "one_readonly_gpu_per_class_worst_sample_reference_feature_structure_qualification",
  nextAfterSuccess: "compile_new_candidate_smoke_entry_then_owner_authorize_one_new_smoke",
  forbiddenActions: authorization.deniedActions,
  ...common,
})

const support = bind(files.support)
const owner = bind(files.owner)
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-per-class-worst-sample-reference-feature-structure-cpu-terminal-v1",
  status: "stage4_per_class_worst_sample_reference_feature_structure_cpu_succeeded_closed",
  nextLegalAction: "separately_authorized_readonly_gpu_qualification",
  supportContract: support,
  ownerActionRequest: owner,
  uniqueModulePlan: bind(files.plan),
  ...common,
})

const terminal = bind(files.terminal)
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress,
  currentStage: "Stage4 per-class worst-sample reference feature structure CPU support complete",
  candidateTerminal: terminal,
  latestBlocker: "readonly_gpu_qualification_not_yet_authorized",
  nextLegalAction: "one_readonly_gpu_per_class_worst_sample_reference_feature_structure_qualification",
  evidence: {
    inactiveConfig: common.inactiveConfig,
    cpuReport: common.cpuReport,
    configurationAudit: common.configurationAudit,
    legacyCompatibilityCpuReport: common.legacyCompatibilityCpuReport,
    supportContract: support,
    ownerActionRequest: owner,
  },
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: common.recordedAtAsiaShanghai,
})

for (const file of [
  files.config,
  files.cpu,
  files.audit,
  files.legacyCpu,
  files.legacyAudit,
  files.support,
  files.owner,
  files.terminal,
  files.capsule,
]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: "stage4_per_class_worst_sample_reference_feature_structure_cpu_support",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: hash(file),
  })
}

{
  const stat = fs.statSync(files.plan)
  indexArtifact({
    logicalPath: logicalProjectPath(files.plan),
    physicalUri: fs.realpathSync(files.plan),
    storageLayer: "hot",
    runId,
    artifactType: "ai_painter_unique_module_plan",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: hash(files.plan),
  })
}

appendAiPainterProgramEvent({
  id: `stage4-per-class-worst-sample-reference-feature-structure-cpu-${runId}`,
  timestamp,
  action: "stage4_per_class_worst_sample_reference_feature_structure_cpu_support",
  runId,
  kind: "cpu_validation",
  status: "success",
  title: "Stage4 per-class worst-sample reference feature structure CPU support completed",
  titleZh: "Stage4逐类别最差样本参考特征结构CPU支持完成",
  detailZh: `新合同CPU正向${cpu.positivePassed}/${cpu.positiveTotal}、反向${cpu.negativePassed}/${cpu.negativeTotal}，旧回放兼容正向${legacyCpu.positivePassed}/${legacyCpu.positiveTotal}、反向${legacyCpu.negativePassed}/${legacyCpu.negativeTotal}；未读取Checkpoint、未创建优化器、未执行.backward()、未启动GPU或训练。`,
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
