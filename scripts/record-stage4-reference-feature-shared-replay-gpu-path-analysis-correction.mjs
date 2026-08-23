import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const root = path.resolve(ROOT, process.argv[2])
const terminal = path.join(root, "phase-terminal.json")
const prior = path.join(root, "cpu-gate-failure-report.json")
const output = path.join(root, "failure-analysis-correction.json")
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/")
const bind = (file) => ({ path: rel(file), sha256: sha(file) })
const now = new Date().toISOString()
writeJsonAtomic(output, {
  schemaVersion: "stage4-reference-feature-shared-replay-gpu-path-analysis-correction-v1",
  status: "failure_analysis_corrected_closed",
  priorFailureTerminal: bind(terminal), priorFailureReport: bind(prior),
  correctedCause: "The project-logical .runtime path is a registered Windows junction whose physical resolution is D:/AI-PET-WORLD-DATA/hot/runtime. The new runner resolved the junction before checking project membership and therefore rejected a valid registered runtime path as an escape.",
  correctedRepairBoundary: "Use the established logical boundary check based on the absolute project-logical path before resolving the registered runtime physical mapping. Keep absolute input, parent traversal, unregistered external paths, old runIds, consumed grants and output reuse rejected.",
  gpuAuthorizationConsumed: false, checkpointRead: false, gpuStarted: false, trainingStarted: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
const stat = fs.statSync(output)
indexArtifact({ logicalPath: logicalProjectPath(output), physicalUri: fs.realpathSync(output), storageLayer: "hot", runId: path.basename(root).replace("owner-authorized-stage4-reference-feature-shared-replay-readonly-gpu-", ""), byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(output) })
appendAiPainterProgramEvent({ id: `stage4-reference-feature-shared-replay-path-correction-${Date.now()}`, timestamp: now, action: "stage4_reference_feature_shared_replay_gpu_path_failure_analysis_correction", kind: "evidence_correction", status: "success", title: "Stage4 GPU CPU-gate path diagnosis corrected", titleZh: "Stage4 GPU CPU门路径失败归因已纠正", detailZh: "确认.runtime为项目注册的Windows物理映射；新运行器在物理解析后误判越界。原失败终态不改写，追加纠正证据，GPU授权仍未消费。", evidencePath: rel(output), evidenceSha256: sha(output), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "failure_analysis_corrected_closed", correction: bind(output) }, null, 2))
