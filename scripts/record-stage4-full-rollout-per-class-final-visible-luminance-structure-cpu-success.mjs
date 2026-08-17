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
  root,
  ".runtime",
  "ai-painter",
  "stage4-full-rollout-per-class-final-visible-luminance-structure-cpu-implementations",
  runId,
)
const requestId = `owner-authorized-stage4-full-rollout-per-class-final-visible-luminance-structure-cpu-implementation-${runId}`
const authorizationRoot = path.join(root, ".runtime", "ai-painter", "owner-action-requests", requestId)
const files = {
  config: path.join(output, "inactive-config.json"),
  cpu: path.join(output, "cpu-report.json"),
  support: path.join(output, "training-objective-support-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  authorization: path.join(authorizationRoot, "authorization.json"),
  consumption: path.join(authorizationRoot, "consumption.json"),
}
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const projectPath = (file) => path.relative(root, file).replace(/\\/g, "/")
const bind = (file) => ({ path: projectPath(file), sha256: hash(file) })

for (const file of [files.config, files.cpu, files.authorization, files.consumption]) {
  if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)
}
for (const file of [files.support, files.owner, files.terminal, files.capsule]) {
  if (fs.existsSync(file)) throw new Error(`immutable output exists: ${projectPath(file)}`)
}
const cpu = JSON.parse(fs.readFileSync(files.cpu, "utf8"))
const config = JSON.parse(fs.readFileSync(files.config, "utf8"))
const authorization = JSON.parse(fs.readFileSync(files.authorization, "utf8"))
const consumption = JSON.parse(fs.readFileSync(files.consumption, "utf8"))
const contract = config.training?.stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation
if (
  cpu.status !== "passed_stage4_full_rollout_per_class_final_visible_luminance_structure_cpu"
  || cpu.positivePassed !== cpu.positiveTotal
  || cpu.negativePassed !== cpu.negativeTotal
  || contract?.contractId !== "stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_v1"
  || contract?.status !== "cpu_support_verified_inactive"
  || Object.values(contract?.activationGate ?? {}).some(Boolean)
  || authorization.requestId !== requestId
  || consumption.authorizationSha256 !== hash(files.authorization)
) throw new Error("CPU success evidence is invalid")

const timestamp = new Date().toISOString()
const fixedTotalProgress = { completedStages: 3, totalStages: 5, percent: 60 }
const common = {
  runId,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
  fixedTotalProgress,
  inactiveConfig: bind(files.config),
  cpuReport: bind(files.cpu),
  implementationAuthorization: bind(files.authorization),
  implementationConsumption: bind(files.consumption),
  checkpointWeightsRead: false,
  optimizerCreated: false,
  backwardExecuted: false,
  gpuUsed: false,
  trainingStarted: false,
}
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-full-rollout-per-class-final-visible-luminance-structure-support-contract-v1",
  status: "cpu_support_verified_inactive",
  contractId: contract.contractId,
  requiredClasses: contract.requiredClasses,
  rolloutBinding: contract.rolloutBinding,
  sourceContract: contract.sourceContract,
  aggregation: contract.aggregation,
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
  requestedAction: "one_readonly_gpu_50_step_final_decoded_rgb_per_class_luminance_structure_gradient_qualification",
  nextAfterSuccess: "compile_new_candidate_smoke_entry_then_owner_authorize_one_new_smoke",
  forbiddenActions: authorization.deniedActions,
  ...common,
})
const support = bind(files.support)
const owner = bind(files.owner)
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-full-rollout-per-class-final-visible-luminance-structure-cpu-terminal-v1",
  status: "stage4_full_rollout_per_class_final_visible_luminance_structure_cpu_succeeded_closed",
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
  currentStage: "Stage4 per-class 50-step final-visible luminance-structure CPU support complete",
  candidateTerminal: terminal,
  latestBlocker: "readonly_gpu_qualification_not_yet_authorized",
  nextLegalAction: "one_readonly_gpu_50_step_final_visible_luminance_structure_qualification",
  evidence: {
    inactiveConfig: common.inactiveConfig,
    cpuReport: common.cpuReport,
    supportContract: support,
    ownerActionRequest: owner,
  },
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: common.recordedAtAsiaShanghai,
})

for (const file of [files.config, files.cpu, files.support, files.owner, files.terminal, files.capsule]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: "stage4_full_rollout_per_class_luminance_structure_cpu_support",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: hash(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-full-rollout-per-class-luminance-structure-cpu-${runId}`,
  timestamp,
  action: "stage4_full_rollout_per_class_final_visible_luminance_structure_cpu_support",
  runId,
  kind: "cpu_validation",
  status: "success",
  title: "Stage4 per-class final-rollout luminance structure CPU support completed",
  titleZh: "Stage4逐类50步最终可见亮度空间结构CPU支持完成",
  detailZh: `CPU正向${cpu.positivePassed}/${cpu.positiveTotal}、反向${cpu.negativePassed}/${cpu.negativeTotal}；未读取Checkpoint、未创建优化器、未执行.backward()、未启动GPU或训练。`,
  evidencePath: projectPath(files.terminal),
  evidenceSha256: hash(files.terminal),
  fixedTotalProgress,
})
console.log(JSON.stringify({
  status: "recorded",
  terminal,
  supportContract: support,
  ownerActionRequest: owner,
  localTaskCapsule: bind(files.capsule),
}, null, 2))
