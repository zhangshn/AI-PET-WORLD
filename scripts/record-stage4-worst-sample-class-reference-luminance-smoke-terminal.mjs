import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
if (process.argv.includes("--smoke-run")) {
  const smokeRoot = path.join(root, ".runtime", "ai-painter", "stage4-worst-sample-class-reference-luminance-smokes", runId)
  const smokeFiles = [
    "preflight-report.json",
    "gpu-consumption.json",
    "active-config.json",
    "training-output/manifest.json",
    "training-output/fixed-preview-reviews.json",
    "training-output/complete-world-ai-assisted-conditional-denoiser.pt",
    "finalization/finalization-report.json",
    "finalization/phase-terminal.json",
    "local-task-capsule.json",
    "owner-action-request.json",
  ].map((name) => path.join(smokeRoot, name))
  for (const file of smokeFiles) if (!fs.existsSync(file)) throw new Error(`missing Smoke terminal evidence: ${file}`)
  const smokeHash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
  const terminalPath = path.join(smokeRoot, "finalization", "phase-terminal.json")
  const reviewPath = path.join(smokeRoot, "training-output", "fixed-preview-reviews.json")
  const terminal = JSON.parse(fs.readFileSync(terminalPath, "utf8"))
  const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"))
  if (
    terminal.status !== "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed"
    || review.previewPassCount !== 2
    || review.previewFailCount !== 3
  ) throw new Error("Smoke terminal evidence changed")
  for (const file of smokeFiles) {
    const stat = fs.statSync(file)
    indexArtifact({
      logicalPath: logicalProjectPath(file),
      physicalUri: fs.realpathSync(file),
      storageLayer: "hot",
      runId,
      artifactType: "stage4_worst_sample_class_reference_luminance_30_epoch_smoke",
      byteSize: stat.size,
      modifiedAtUtc: stat.mtime.toISOString(),
      sha256: smokeHash(file),
    })
  }
  appendAiPainterProgramEvent({
    id: `stage4-worst-sample-class-reference-luminance-smoke-${runId}`,
    timestamp: new Date().toISOString(),
    action: "stage4_worst_sample_class_reference_luminance_30_epoch_smoke",
    runId,
    kind: "gpu_training",
    status: "failed_closed",
    title: "Stage4 worst sample-class 30 Epoch Smoke failed machine review",
    titleZh: "Stage4最差样本—类别30 Epoch Smoke机器审核失败关闭",
    detailZh: "30 Epoch训练、权重变化、Checkpoint和五张固定预览字节复现均完成；Epoch 20和30通过，但总计仅2/5通过，按正式聚合门失败关闭，未启动Stage 0。",
    evidencePath: logicalProjectPath(terminalPath),
    evidenceSha256: smokeHash(terminalPath),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  })
  console.log(JSON.stringify({ status: "recorded", terminal: { path: logicalProjectPath(terminalPath), sha256: smokeHash(terminalPath) }, review: { path: logicalProjectPath(reviewPath), sha256: smokeHash(reviewPath) } }, null, 2))
  process.exit(0)
}
const output = path.join(root, ".runtime", "ai-painter", "stage4-worst-sample-class-reference-luminance-smoke-entry-integrations", runId)
const files = ["registration-terminal.json", "inactive-smoke-config.json", "training-objective-support-contract.json", "registry.json", "cpu-report.json", "phase-terminal.json", "local-task-capsule.json"].map((name) => path.join(output, name))
for (const file of files) if (!fs.existsSync(file)) throw new Error(`missing terminal evidence: ${file}`)
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const terminal = files.find((file) => file.endsWith("phase-terminal.json"))
for (const file of files) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: "stage4_worst_sample_class_reference_luminance_smoke_entry_cpu_failure",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: hash(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-worst-sample-class-reference-luminance-smoke-entry-${runId}`,
  timestamp: new Date().toISOString(),
  action: "stage4_worst_sample_class_reference_luminance_smoke_entry_cpu_gate",
  runId,
  kind: "cpu_validation",
  status: "failed_closed",
  title: "Stage4 worst sample-class Smoke entry CPU gate failed closed",
  titleZh: "Stage4最差样本—类别Smoke入口CPU门失败关闭",
  detailZh: "Node已识别新只读GPU资格，但Trainer执行血缘尚未登记新训练目标；未建立或消费GPU Smoke授权，未启动GPU、优化器、反向传播或训练。",
  evidencePath: logicalProjectPath(terminal),
  evidenceSha256: hash(terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: "recorded", terminal: { path: logicalProjectPath(terminal), sha256: hash(terminal) } }, null, 2))
