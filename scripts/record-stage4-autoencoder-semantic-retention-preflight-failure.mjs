import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const runId = "20260822-125555578"
const authorizationPath = path.resolve(ROOT, ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-frozen-autoencoder-semantic-retention-audit-20260822-125555578/authorization.json")
const recordPath = path.resolve(path.dirname(authorizationPath), "preflight-failure-report.json")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const now = new Date().toISOString()
writeJsonAtomic(recordPath, {
  schemaVersion: "stage4-frozen-autoencoder-semantic-retention-preflight-failure-v1",
  status: "cpu_resource_preflight_failed_closed",
  runId,
  errorCode: "disk_probe_parent_directory_missing",
  specificError: "shutil.disk_usage was called on the not-yet-created formal output parent directory on Windows",
  scopeImpact: "preflight_only_no_gpu_no_checkpoint_read_no_consumption",
  authorization: { path: relative(authorizationPath), sha256: sha(authorizationPath) },
  gpuAuthorizationConsumed: false,
  checkpointRead: false,
  gpuStarted: false,
  trainingStarted: false,
  correctiveBoundary: "probe_nearest_existing_parent_without_creating_formal_output",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
const stat = fs.statSync(recordPath)
indexArtifact({ logicalPath: logicalProjectPath(recordPath), physicalUri: fs.realpathSync(recordPath), storageLayer: "hot", runId, artifactType: "stage4_autoencoder_semantic_retention_preflight_failure", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(recordPath) })
appendAiPainterProgramEvent({
  id: `stage4-autoencoder-semantic-retention-preflight-failure-${runId}`,
  timestamp: now,
  action: "stage4_autoencoder_semantic_retention_preflight",
  runId,
  kind: "cpu_resource_preflight",
  status: "failed",
  title: "Autoencoder audit preflight stopped before GPU consumption",
  titleZh: "Autoencoder审计在GPU授权消费前因Windows磁盘探测父目录不存在而关闭",
  detailZh: "未读取Checkpoint、未启动GPU、未训练；后续仅修正为查询最近的已存在父目录。",
  evidencePath: relative(recordPath),
  evidenceSha256: sha(recordPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: "failure_recorded", report: { path: relative(recordPath), sha256: sha(recordPath) } }, null, 2))
