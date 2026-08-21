import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = process.argv[2]
if (!/^\d{8}-\d{9}$/.test(runId ?? "")) throw new Error("runId_required")
const requestId = `owner-authorized-stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-${runId}`
const output = path.join(root, ".runtime", "ai-painter", "stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-qualifications", runId)
const authorizationRoot = path.join(root, ".runtime", "ai-painter", "owner-action-requests", requestId)
const files = {
  authorization: path.join(authorizationRoot, "gpu-authorization.json"),
  cpu: path.join(authorizationRoot, "cpu-entry-report.json"),
  preflight: path.join(authorizationRoot, "preflight-report.json"),
  consumption: path.join(authorizationRoot, "gpu-consumption.json"),
  report: path.join(output, "gpu-qualification-report.json"),
  cuda: path.join(output, "cuda-telemetry.json"),
  progress: path.join(output, "progress.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  owner: path.join(output, "owner-action-request.json"),
}
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const relative = (file) => path.relative(root, file).replaceAll("\\", "/")
const bind = (file) => ({ path: relative(file), sha256: hash(file) })
for (const file of [files.authorization, files.cpu, files.preflight, files.consumption, files.report, files.cuda, files.progress, files.terminal]) {
  if (!fs.existsSync(file)) throw new Error(`evidence_missing:${relative(file)}`)
}
for (const file of [files.capsule, files.owner]) {
  if (fs.existsSync(file)) throw new Error(`immutable_output_exists:${relative(file)}`)
}
const cpu = JSON.parse(fs.readFileSync(files.cpu, "utf8"))
const report = JSON.parse(fs.readFileSync(files.report, "utf8"))
const terminal = JSON.parse(fs.readFileSync(files.terminal, "utf8"))
const train = report.trainSelection
const validation = report.validationCheckpointIdentity
const gradients = Object.values(report.selectedGradientEvidence ?? {})
if (
  cpu.status !== "passed_stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_cpu_gate"
  || cpu.positivePassed !== cpu.positiveTotal || cpu.negativePassed !== cpu.negativeTotal
  || report.status !== "passed_epoch_complete_per_class_worst_luminance_readonly_gpu_qualification"
  || terminal.status !== "stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_qualification_succeeded_closed"
  || train?.identityCount !== 48 || validation?.identityCount !== 16
  || train?.perClassSelections?.length !== 4 || validation?.perClassSelections?.length !== 4
  || gradients.length !== 4
  || gradients.some((row) => row.selectionScoreExactlyReproduced !== true || row.decodedRgbGradientFinite !== true || !(row.insideMaskGradientAbsSum > 0) || row.outsideMaskGradientAbsSum !== 0 || !(row.denoiserGradientAbsSum > 0))
  || report.stateHashes?.denoiserBefore !== report.stateHashes?.denoiserAfter
  || report.stateHashes?.autoencoderBefore !== report.stateHashes?.autoencoderAfter
  || report.safety?.optimizerCreated !== false || report.safety?.backwardExecuted !== false
  || report.safety?.modelWeightsModified !== false || report.safety?.checkpointWritten !== false
  || report.safety?.trainingStarted !== false
) throw new Error("readonly_gpu_success_evidence_invalid")
const recordedAtUtc = new Date().toISOString()
const fixedTotalProgress = { completedStages: 3, totalStages: 5, percent: 60 }
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_executed",
  requestedAction: "compile_and_execute_one_new_30_epoch_smoke_for_stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1",
  prerequisite: bind(files.terminal),
  fixedTotalProgress,
  forbiddenActions: ["reuse_historical_checkpoint", "reuse_failed_run", "reuse_consumed_authorization", "change_model_or_loss_weights", "change_data_split", "lower_machine_review_thresholds", "start_stage0_before_smoke_and_late_stability_success"],
  recordedAtUtc,
  recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  currentStage: "Stage4 epoch-complete per-class worst luminance readonly GPU qualification complete",
  fixedTotalProgress,
  candidateTerminal: bind(files.terminal),
  latestBlocker: "new_30_epoch_smoke_not_yet_authorized_or_executed",
  nextLegalAction: "compile_and_execute_one_new_bound_30_epoch_smoke",
  evidence: { cpuReport: bind(files.cpu), preflight: bind(files.preflight), gpuReport: bind(files.report), cudaTelemetry: bind(files.cuda), consumption: bind(files.consumption), ownerActionRequest: bind(files.owner) },
  recordedAtUtc,
  recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
})
for (const file of Object.values(files)) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_qualification", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: hash(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-epoch-complete-per-class-worst-luminance-gpu-success-${runId}`,
  timestamp: recordedAtUtc,
  action: "stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_qualification",
  runId, kind: "gpu_validation", status: "success",
  title: "Stage4 epoch-complete per-class worst luminance readonly GPU qualification completed",
  titleZh: "Stage4完整Epoch逐类别最差样本最终亮度只读GPU资格完成",
  detailZh: "48条train、8条validation及全部既有rollout seeds完成真实CUDA 50步最终解码；四类独立选择、梯度和Checkpoint身份通过，模型与Autoencoder状态不变，未训练。",
  evidencePath: relative(files.terminal), evidenceSha256: hash(files.terminal), fixedTotalProgress,
})
console.log(JSON.stringify({ status: "recorded", terminal: bind(files.terminal), gpuReport: bind(files.report), cudaTelemetry: bind(files.cuda), ownerActionRequest: bind(files.owner), localTaskCapsule: bind(files.capsule) }, null, 2))
