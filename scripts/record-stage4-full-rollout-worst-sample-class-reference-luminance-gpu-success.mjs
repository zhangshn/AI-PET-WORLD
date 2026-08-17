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
const rootOutput = path.join(
  root, ".runtime", "ai-painter",
  "stage4-full-rollout-worst-sample-class-reference-luminance-readonly-gpu-qualifications",
  runId,
)
const output = path.join(rootOutput, "execution")
const authorization = path.join(
  root, ".runtime", "ai-painter", "owner-action-requests",
  `owner-authorized-stage4-worst-sample-class-reference-luminance-readonly-gpu-qualification-${runId}`,
  "authorization.json",
)
if (!fs.existsSync(authorization)) throw new Error("GPU authorization is missing")
const authorizationValue = JSON.parse(fs.readFileSync(authorization, "utf8"))
const files = {
  cpu: path.join(root, authorizationValue.bindings.cpuReport.path),
  preflight: path.join(rootOutput, "preflight-report.json"),
  report: path.join(output, "gpu-qualification-report.json"),
  cuda: path.join(output, "cuda-telemetry.json"),
  telemetry: path.join(output, "step-telemetry.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  owner: path.join(output, "owner-action-request.json"),
  authorization,
  consumption: path.join(path.dirname(authorization), "gpu-consumption.json"),
}
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const projectPath = (file) => path.relative(root, file).replace(/\\/g, "/")
const bind = (file) => ({ path: projectPath(file), sha256: hash(file) })
for (const file of [files.cpu, files.preflight, files.report, files.cuda, files.telemetry, files.terminal, files.capsule]) {
  if (!fs.existsSync(file)) throw new Error(`missing GPU qualification evidence: ${projectPath(file)}`)
}
if (fs.existsSync(files.owner)) throw new Error(`immutable output exists: ${projectPath(files.owner)}`)
const cpu = JSON.parse(fs.readFileSync(files.cpu, "utf8"))
const preflight = JSON.parse(fs.readFileSync(files.preflight, "utf8"))
const report = JSON.parse(fs.readFileSync(files.report, "utf8"))
const terminal = JSON.parse(fs.readFileSync(files.terminal, "utf8"))
const worst = report.worstSampleClassEvidence
if (
  cpu.status !== "passed_stage4_full_rollout_worst_sample_class_reference_luminance_readonly_gpu_cpu_gate"
  || cpu.positivePassed !== cpu.positiveTotal
  || cpu.negativePassed !== cpu.negativeTotal
  || preflight.status !== "passed_without_authorization_consumption_or_checkpoint_read"
  || report.status !== "passed_readonly_50_step_worst_sample_class_reference_luminance_gradient_qualification"
  || terminal.status !== "stage4_full_rollout_worst_sample_class_reference_luminance_readonly_gpu_qualification_succeeded_closed"
  || Object.values(report.perClassGradientEvidence ?? {}).length !== 4
  || !Array.isArray(worst?.weightedPerSampleClass)
  || worst.weightedPerSampleClass.length !== 1
  || worst.weightedPerSampleClass[0].length !== 4
  || worst.decodedRgbGradientFinite !== true
  || !(worst.insideMaskDecodedRgbGradientAbsSum > 0)
  || worst.outsideMaskDecodedRgbGradientAbsSum !== 0
  || worst.denoiserGradientFinite !== true
  || !(worst.denoiserGradientAbsSum > 0)
  || JSON.stringify(worst.routeWestBoundary?.requiredSides) !== JSON.stringify(["west"])
  || worst.routeWestBoundary?.equalCandidatePasses !== true
  || worst.routeWestBoundary?.syntheticRegressionRejected !== true
  || worst.routeWestBoundary?.freeThresholdSelected !== false
  || report.stateHashes?.denoiserBefore !== report.stateHashes?.denoiserAfter
  || report.stateHashes?.autoencoderBefore !== report.stateHashes?.autoencoderAfter
  || report.safety?.optimizerCreated !== false
  || report.safety?.backwardExecuted !== false
  || report.safety?.modelWeightsModified !== false
  || report.safety?.checkpointWritten !== false
  || report.safety?.trainingStarted !== false
) throw new Error("readonly GPU qualification success evidence is invalid")

const timestamp = new Date().toISOString()
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_executed",
  requestedAction: "compile_and_authorize_one_new_30_epoch_model_smoke_with_stage4_full_rollout_worst_sample_class_reference_luminance_obligation_v1",
  prerequisite: bind(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  forbiddenActions: [
    "reuse_failed_smoke_or_stage_checkpoint",
    "use_failed_preview_pixels_as_training_targets",
    "use_machine_review_thresholds_or_results_as_training_targets",
    "change_model_architecture",
    "select_free_hyperparameters",
    "start_stage0_before_smoke_success",
  ],
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
for (const file of Object.values(files)) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: "stage4_full_rollout_worst_sample_class_reference_luminance_readonly_gpu_qualification",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: hash(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-full-rollout-worst-sample-class-reference-luminance-gpu-${runId}`,
  timestamp,
  action: "stage4_full_rollout_worst_sample_class_reference_luminance_readonly_gpu_qualification",
  runId,
  kind: "gpu_validation",
  status: "success",
  title: "Stage4 worst sample-class final-visible reference luminance readonly GPU qualification completed",
  titleZh: "Stage4最差样本—类别最终可见参考亮度只读GPU资格完成",
  detailZh: "50步最终解码RGB的逐样本逐类别派生加权最大值、掩码内外梯度和west边界非回退均通过；模型与Autoencoder状态不变，未创建优化器、未执行.backward()、未写Checkpoint或训练。",
  evidencePath: projectPath(files.terminal),
  evidenceSha256: hash(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: "recorded",
  terminal: bind(files.terminal),
  report: bind(files.report),
  ownerActionRequest: bind(files.owner),
  localTaskCapsule: bind(files.capsule),
}, null, 2))
