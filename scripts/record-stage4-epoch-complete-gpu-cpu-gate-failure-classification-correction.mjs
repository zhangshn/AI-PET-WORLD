import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = process.argv[2]
if (!/^\d{8}-\d{9}$/.test(runId ?? "")) throw new Error("runId_required")
const output = path.join(root, ".runtime", "ai-painter", "stage4-epoch-complete-gpu-cpu-gate-failure-classification-corrections", runId)
if (fs.existsSync(output)) throw new Error("output_exists")
fs.mkdirSync(output, { recursive: true })
const sources = [
  path.join(root, ".runtime", "ai-painter", "owner-action-requests", "owner-authorized-stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-20260821-100827802", "phase-terminal.json"),
  path.join(root, ".runtime", "ai-painter", "owner-action-requests", "owner-authorized-stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-20260821-101031031", "phase-terminal.json"),
]
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const relative = (file) => path.relative(root, file).replaceAll("\\", "/")
const bind = (file) => ({ path: relative(file), sha256: hash(file) })
for (const file of sources) if (!fs.existsSync(file)) throw new Error(`source_missing:${relative(file)}`)
const recordedAtUtc = new Date().toISOString()
const report = path.join(output, "classification-correction-report.json")
const terminal = path.join(output, "phase-terminal.json")
const capsule = path.join(output, "local-task-capsule.json")
writeJsonAtomic(report, {
  schemaVersion: "stage4-epoch-complete-gpu-cpu-gate-failure-classification-correction-v1",
  status: "historical_failure_classification_corrected_without_source_mutation",
  corrections: [
    { source: bind(sources[0]), actualErrorCode: "registered_runtime_junction_resolved_as_external_path", actualMeaning: "The original project root was correct, but resolve() followed the registered .runtime junction before logical-path containment validation." },
    { source: bind(sources[1]), actualErrorCode: "project_root_parent_index_changed_from_three_to_two", actualMeaning: "The attempted correction temporarily selected F:/ai-pet-world/ml as ROOT, causing the formal output identity mismatch." },
  ],
  sourcesModified: false,
  gpuAuthorizationConsumedInEitherRun: false,
  checkpointReadInEitherRun: false,
  cudaStartedInEitherRun: false,
  recordedAtUtc,
  recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
})
writeJsonAtomic(terminal, {
  schemaVersion: "stage4-epoch-complete-gpu-cpu-gate-failure-classification-correction-terminal-v1",
  status: "stage4_epoch_complete_gpu_cpu_gate_failure_classification_correction_succeeded_closed",
  report: bind(report), sourceTerminals: sources.map(bind),
  recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
})
writeJsonAtomic(capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5",
  currentStage: "Historical CPU gate failure classification corrected; readonly GPU qualification subsequently succeeded",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  candidateTerminal: bind(terminal), latestBlocker: null,
  nextLegalAction: "compile_and_execute_one_new_bound_30_epoch_smoke",
  evidence: { correctionReport: bind(report), sourceTerminals: sources.map(bind) },
  recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
})
for (const file of [...sources, report, terminal, capsule]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_epoch_complete_gpu_cpu_gate_failure_classification_correction", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: hash(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-epoch-complete-gpu-cpu-gate-failure-classification-correction-${runId}`,
  timestamp: recordedAtUtc, action: "stage4_epoch_complete_gpu_cpu_gate_failure_classification_correction",
  runId, kind: "evidence_correction", status: "success",
  title: "Stage4 CPU gate historical failure classifications corrected",
  titleZh: "Stage4 CPU门历史失败分类已追加更正",
  detailZh: "未修改或覆盖历史失败证据；追加记录准确区分.runtime逻辑路径被物理映射误判与临时ROOT层级错误。两次GPU授权均未消费。",
  evidencePath: relative(terminal), evidenceSha256: hash(terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: "recorded", report: bind(report), terminal: bind(terminal), capsule: bind(capsule) }, null, 2))
