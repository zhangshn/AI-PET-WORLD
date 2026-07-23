import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = ".runtime/ai-painter/storage-catalog-repairs"
const targetRunId = readArg("--run-id")
if (!targetRunId?.startsWith("ai-assisted-conditional-denoiser-v5-")) {
  throw new Error("--run-id must identify a V5 conditional denoiser run")
}

const targetRoot = path.resolve(
  ROOT,
  ".runtime",
  "ai-painter",
  "project-owned-complete-world-conditional-denoiser-v5",
  targetRunId,
)
if (!fs.existsSync(targetRoot)) throw new Error(`target run is missing: ${projectPath(targetRoot)}`)

const createdAtUtc = new Date().toISOString()
const repairRunId = `storage-catalog-repair-${targetRunId}-${createdAtUtc.replace(/[:.]/g, "-")}`
const artifacts = indexArtifactTree(targetRoot, targetRunId)
if (artifacts.length === 0) throw new Error("target run contains no artifacts")

const record = {
  schemaVersion: "ai-assisted-conditional-denoiser-storage-catalog-repair-v1",
  status: "storage_catalog_artifact_index_repaired",
  runId: repairRunId,
  targetRunId,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  reason: "The training run wrote immutable evidence to the D-drive hot store, but its run artifacts were not indexed in SQLite.",
  reasonZh: "训练运行已将不可变证据写入 D 盘热数据仓库，但本轮文件尚未进入 SQLite 产物索引。",
  repair: "Index the existing files in place with logical path, physical URI, run identity, byte size, modification time, artifact type, and SHA-256. Do not modify or rerun training.",
  repairZh: "原地补录现有文件的逻辑路径、物理路径、运行身份、字节数、修改时间、产物类型和 SHA-256；不修改训练结果，也不重新训练。",
  targetRoot: projectPath(targetRoot),
  artifactCount: artifacts.length,
  artifacts,
  checkpointModified: false,
  trainingRerun: false,
  gpuUsed: false,
  imageGenerated: false,
  automaticStorage: true,
}

const written = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: repairRunId,
  fileName: "report.json",
  record,
  latest: { targetRunId, artifactCount: artifacts.length },
})
indexSingleFile(path.resolve(ROOT, written.runPath), repairRunId)
indexSingleFile(path.resolve(ROOT, OUTPUT_ROOT, "latest.json"), repairRunId)

appendAiPainterProgramEvent({
  action: "repair_ai_assisted_conditional_denoiser_artifact_index",
  runId: repairRunId,
  kind: "storage_catalog_repair_completed",
  status: "success",
  title: "Conditional denoiser run artifact index repaired",
  titleZh: "条件去噪训练运行产物索引已修复",
  detail: `targetRunId=${targetRunId}; artifactCount=${artifacts.length}; trainingRerun=false; gpuUsed=false`,
  detailZh: `目标运行=${targetRunId}；产物数量=${artifacts.length}；重新训练=false；使用GPU=false`,
  script: "scripts/repair-ai-assisted-conditional-denoiser-artifact-index.mjs",
  currentStep: "training_artifact_storage_catalog_repair",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: repairRunId,
  evidencePath: written.runPath,
})

console.log(JSON.stringify({
  status: record.status,
  repairRunId,
  targetRunId,
  artifactCount: artifacts.length,
  reportPath: written.runPath,
  trainingRerun: false,
  gpuUsed: false,
}, null, 2))

function indexArtifactTree(rootPath, runId) {
  const records = []
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const childPath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) records.push(...indexArtifactTree(childPath, runId))
    else if (entry.isFile()) records.push(indexSingleFile(childPath, runId))
  }
  return records
}

function indexSingleFile(filePath, runId) {
  const info = fs.statSync(filePath)
  const record = {
    logicalPath: projectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
    sha256: sha256File(filePath),
  }
  indexArtifact(record)
  return record
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

function readArg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}
