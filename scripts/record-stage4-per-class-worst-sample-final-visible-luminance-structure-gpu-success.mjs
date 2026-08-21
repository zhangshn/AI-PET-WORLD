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
const gpuRunId = process.argv[2]
const cpuRunId = process.argv[3]
if (!/^[0-9]{8}-[0-9]{9}$/.test(gpuRunId ?? "")) throw new Error("gpuRunId is required")
if (!/^[0-9]{8}-[0-9]{9}$/.test(cpuRunId ?? "")) throw new Error("cpuRunId is required")

const authorizationRoot = path.join(
  root, ".runtime", "ai-painter", "owner-action-requests",
  `owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-structure-readonly-gpu-${gpuRunId}`,
)
const output = path.join(
  root, ".runtime", "ai-painter",
  "stage4-per-class-worst-sample-final-visible-luminance-structure-readonly-gpu-qualifications",
  gpuRunId,
)
const files = {
  report: path.join(output, "gpu-qualification-report.json"),
  cuda: path.join(output, "cuda-telemetry.json"),
  telemetry: path.join(output, "step-telemetry.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  owner: path.join(output, "owner-action-request.json"),
  sync: path.join(output, "plan-sync-record.json"),
  authorization: path.join(authorizationRoot, "gpu-authorization.json"),
  consumption: path.join(authorizationRoot, "gpu-consumption.json"),
  cpuGate: path.join(
    root, ".runtime", "ai-painter",
    "stage4-per-class-worst-sample-final-visible-luminance-structure-gpu-entry-cpu-checks",
    cpuRunId, "cpu-report.json",
  ),
  plan: path.join(root, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md"),
}
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const projectPath = (file) => path.relative(root, file).replace(/\\/g, "/")
const bind = (file) => ({ path: projectPath(file), sha256: hash(file) })

for (const file of [
  files.report, files.cuda, files.telemetry, files.terminal, files.capsule,
  files.authorization, files.consumption, files.cpuGate, files.plan,
]) {
  if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)
}
for (const file of [files.owner, files.sync]) {
  if (fs.existsSync(file)) throw new Error(`immutable output exists: ${projectPath(file)}`)
}

const report = JSON.parse(fs.readFileSync(files.report, "utf8"))
const terminal = JSON.parse(fs.readFileSync(files.terminal, "utf8"))
const consumption = JSON.parse(fs.readFileSync(files.consumption, "utf8"))
const cpuGate = JSON.parse(fs.readFileSync(files.cpuGate, "utf8"))
const evidence = report.perClassWorstSampleLuminanceEvidence
const classes = ["footprints", "tree", "rock", "vegetation"]
if (
  report.status !== "passed_readonly_50_step_per_class_worst_sample_final_visible_luminance_structure_gradient_qualification"
  || terminal.status !== "stage4_per_class_worst_sample_final_visible_luminance_structure_readonly_gpu_qualification_succeeded_closed"
  || consumption.status !== "consumed_once_before_gpu_execution"
  || cpuGate.status !== "passed_stage4_per_class_worst_sample_final_visible_luminance_structure_readonly_gpu_cpu_gate"
  || evidence?.diagnosticBatchSampleIds?.length !== 4
  || evidence?.validationIdentitySampleId !== "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
  || evidence?.cpuOracleExactlyMatched !== true
  || evidence?.sameFinalVisibleLossSlotExact !== true
  || evidence?.sameCheckpointQualificationTensorExact !== true
  || JSON.stringify(Object.keys(evidence?.perClassGradientEvidence ?? {})) !== JSON.stringify(classes)
  || classes.some((identity) => {
    const value = evidence.perClassGradientEvidence[identity]
    return value.cpuOracleExactlyMatched !== true
      || value.decodedRgbGradientFinite !== true
      || !(value.insideSelectedClassMaskGradientAbsSum > 0)
      || value.outsideSelectedClassMaskGradientAbsSum !== 0
      || value.denoiserGradientFinite !== true
      || !(value.denoiserGradientAbsSum > 0)
  })
  || report.stateHashes.denoiserBefore !== report.stateHashes.denoiserAfter
  || report.stateHashes.autoencoderBefore !== report.stateHashes.autoencoderAfter
  || report.safety.optimizerCreated !== false
  || report.safety.backwardExecuted !== false
  || report.safety.modelWeightsModified !== false
  || report.safety.checkpointWritten !== false
  || report.safety.trainingStarted !== false
) throw new Error("readonly GPU success evidence is invalid")

const timestamp = new Date().toISOString()
const fixedTotalProgress = { completedStages: 3, totalStages: 5, percent: 60 }
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "owner_new_30_epoch_smoke_authorization_required_not_authorized",
  requestedAction: (
    "compile_and_execute_one_new_30_epoch_smoke_for_"
    + "stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1"
  ),
  sourceTerminal: bind(files.terminal),
  sourceGpuReport: bind(files.report),
  sourceCudaTelemetry: bind(files.cuda),
  sourceCpuGate: bind(files.cpuGate),
  sourceAuthorizationConsumption: bind(files.consumption),
  historicalDenoiserOrCheckpointReuseAllowed: false,
  previousRunOrOutputReuseAllowed: false,
  automaticRetryAuthorized: false,
  fixedTotalProgress,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(files.sync, {
  schemaVersion: "ai-painter-stage4-plan-sync-record-v1",
  status: "synchronized",
  runId: gpuRunId,
  uniqueModulePlan: bind(files.plan),
  terminal: bind(files.terminal),
  nextLegalAction: terminal.nextLegalAction,
  fixedTotalProgress,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})

for (const file of [
  files.report, files.cuda, files.telemetry, files.terminal, files.capsule,
  files.owner, files.sync, files.authorization, files.consumption, files.cpuGate,
  files.plan,
]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: gpuRunId,
    artifactType: (
      file === files.plan
        ? "ai_painter_unique_module_plan"
        : "stage4_per_class_worst_sample_final_visible_luminance_structure_readonly_gpu_qualification"
    ),
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: hash(file),
  })
}

appendAiPainterProgramEvent({
  id: `stage4-per-class-worst-sample-final-visible-luminance-structure-gpu-${gpuRunId}`,
  timestamp,
  action: "stage4_per_class_worst_sample_final_visible_luminance_structure_readonly_gpu_qualification",
  runId: gpuRunId,
  kind: "readonly_gpu_qualification",
  status: "success",
  title: "Stage4 per-class worst-sample final-visible luminance structure readonly GPU qualification passed",
  titleZh: "Stage4逐类别最差样本最终可见亮度结构只读GPU资格通过",
  detailZh: "source-index正式顺序前四条train记录完成四类独立最大义务选择；CPU/GPU选择身份、同一Loss槽、Checkpoint资格、梯度边界和冻结状态全部通过。",
  evidencePath: projectPath(files.terminal),
  evidenceSha256: hash(files.terminal),
  fixedTotalProgress,
})

console.log(JSON.stringify({
  status: "recorded",
  terminal: bind(files.terminal),
  report: bind(files.report),
  cudaTelemetry: bind(files.cuda),
  cpuGate: bind(files.cpuGate),
  ownerActionRequest: bind(files.owner),
  planSyncRecord: bind(files.sync),
  localTaskCapsule: bind(files.capsule),
}, null, 2))
