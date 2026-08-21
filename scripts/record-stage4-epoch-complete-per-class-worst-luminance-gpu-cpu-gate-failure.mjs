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
const errorCode = process.argv[3] ?? "project_root_resolution_used_parent_index_three_instead_of_two"
const message = process.argv[4] ?? "The readonly GPU entry rejected its own registered .runtime output because the project root was resolved one directory too high."
const requestId = `owner-authorized-stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-${runId}`
const output = path.join(root, ".runtime", "ai-painter", "owner-action-requests", requestId)
const authorization = path.join(output, "gpu-authorization.json")
if (!fs.existsSync(authorization)) throw new Error("authorization_missing")
if (fs.existsSync(path.join(output, "gpu-consumption.json"))) throw new Error("unexpected_gpu_consumption")
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const relative = (file) => path.relative(root, file).replaceAll("\\", "/")
const bind = (file) => ({ path: relative(file), sha256: hash(file) })
const report = path.join(output, "cpu-gate-failure-report.json")
const terminal = path.join(output, "phase-terminal.json")
const capsule = path.join(output, "local-task-capsule.json")
for (const file of [report, terminal, capsule]) {
  if (fs.existsSync(file)) throw new Error(`immutable_output_exists:${relative(file)}`)
}
const recordedAtUtc = new Date().toISOString()
writeJsonAtomic(report, {
  schemaVersion: "stage4-epoch-complete-per-class-worst-luminance-gpu-cpu-gate-failure-v1",
  status: "failed_closed_before_gpu_authorization_consumption",
  errorCode,
  message,
  authorization: bind(authorization),
  safety: { gpuAuthorizationConsumed: false, cudaStarted: false, checkpointRead: false, optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, trainingStarted: false },
  recordedAtUtc,
  recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
})
writeJsonAtomic(terminal, {
  schemaVersion: "stage4-epoch-complete-per-class-worst-luminance-gpu-terminal-v1",
  status: "stage4_epoch_complete_per_class_worst_luminance_gpu_cpu_gate_failed_closed",
  report: bind(report),
  authorization: bind(authorization),
  authorizationConsumed: false,
  retryAuthorized: false,
  recordedAtUtc,
  recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
})
writeJsonAtomic(capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  currentStage: "Stage4 readonly GPU qualification CPU gate failed before authorization consumption",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  candidateTerminal: bind(terminal),
  latestBlocker: errorCode,
  nextLegalAction: "use_new_run_id_after_bounded_logical_runtime_resolution_correction",
  evidence: { report: bind(report), authorization: bind(authorization) },
  recordedAtUtc,
  recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
})
for (const file of [authorization, report, terminal, capsule]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file),
    storageLayer: "hot", runId,
    artifactType: "stage4_epoch_complete_per_class_worst_luminance_gpu_cpu_gate_failure",
    byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: hash(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-epoch-complete-per-class-worst-luminance-gpu-cpu-gate-failure-${runId}`,
  timestamp: recordedAtUtc,
  action: "stage4_epoch_complete_per_class_worst_luminance_gpu_cpu_gate",
  runId, kind: "cpu_validation", status: "failure",
  title: "Stage4 epoch-complete readonly GPU CPU gate failed before consumption",
  titleZh: "Stage4完整Epoch只读GPU资格CPU门在消费前失败关闭",
  detailZh: "项目根目录层级计算错误导致合法.runtime路径被误判；GPU授权未消费，CUDA、Checkpoint、优化器、反向传播和训练均未启动。",
  evidencePath: relative(terminal), evidenceSha256: hash(terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: "recorded", report: bind(report), terminal: bind(terminal), capsule: bind(capsule) }, null, 2))
