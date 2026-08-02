import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  indexArtifact,
  openStorageCatalog,
} from "./lib/ai-pet-world-storage-catalog.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-cold-start-record-artifact-index-repairs"
const recordId = argumentValue("--record-id")
const categoryId = argumentValue("--category-id") ?? "complete-maps"

assert(recordId && /^ai-cold-start-v7-v7-capacity-slot-\d{3}-[a-z0-9-]+-v\d+$/.test(recordId), "--record-id must identify one V7 capacity record")
assert(categoryId === "complete-maps", "only complete-maps records are supported")

const recordPath = path.join(
  ROOT,
  "data",
  "world-samples",
  "original-image-library",
  "natural-home-v1",
  categoryId,
  recordId,
  "record.json",
)
assert(fs.existsSync(recordPath), `record is missing: ${projectPath(recordPath)}`)
const record = readJson(recordPath)
assert(record.recordId === recordId, "record identity mismatch")
assert(record.reviews?.machineReviewStatus === "machine_contract_passed_waiting_owner_visual_review", "machine review is not passed")
assert(record.reviews?.ownerReviewStatus === "owner_approved", "owner review is not approved")
assert(record.v7CapacityContribution?.status === "registered", "V7 capacity contribution is not registered")

const promptEvidencePath = resolveProjectPath(record.aiAssistedColdStart?.promptEvidencePath)
const requestRoot = path.dirname(promptEvidencePath)
const requestPath = path.join(requestRoot, "request.json")
assert(fs.existsSync(requestPath), "conditional RGB request is missing")
const request = readJson(requestPath)
assert(request.outputRecordId === recordId, "conditional RGB request record mismatch")

const candidateRoot = path.dirname(resolveProjectPath(record.aiAssistedColdStart?.trainingDerivativePath))
const reviewRunReportPath = resolveProjectPath(
  request.automaticReview?.runReportPath
    ?? request.automaticReviewRunReportPath
    ?? request.intakeResult?.automaticReviewRunReportPath,
)
assert(reviewRunReportPath && fs.existsSync(reviewRunReportPath), "review pipeline report is missing")
const reviewRun = readJson(reviewRunReportPath)
assert(reviewRun.recordId === recordId, "review pipeline report record mismatch")

const contributionPath = resolveProjectPath(record.v7CapacityContribution.contributionPath)
assert(fs.existsSync(contributionPath), "capacity contribution is missing")
const contribution = readJson(contributionPath)
assert(contribution.recordId === recordId, "capacity contribution record mismatch")

const targetRoots = [
  {
    label: "candidate",
    root: candidateRoot,
    artifactRunId: request.requestId,
  },
  {
    label: "conditional_request",
    root: requestRoot,
    artifactRunId: request.requestId,
  },
  {
    label: "original_image_record",
    root: path.dirname(recordPath),
    artifactRunId: record.v7CapacityContribution.contributionId,
  },
  {
    label: "review_pipeline",
    root: path.dirname(reviewRunReportPath),
    artifactRunId: reviewRun.runId,
  },
  {
    label: "capacity_contribution",
    root: path.dirname(contributionPath),
    artifactRunId: record.v7CapacityContribution.contributionId,
  },
]
for (const target of targetRoots) {
  assert(isProjectLogicalPath(target.root), `repair target escapes project root: ${target.root}`)
  assert(fs.existsSync(target.root) && fs.statSync(target.root).isDirectory(), `repair target is missing: ${projectPath(target.root)}`)
}

const requiredArtifacts = [
  path.join(candidateRoot, "source-generated.png"),
  resolveProjectPath(record.aiAssistedColdStart.trainingDerivativePath),
  path.join(path.dirname(recordPath), record.originalImage.path),
  resolveProjectPath(record.reviews.machineReviewPath),
  resolveProjectPath(record.reviews.ownerReviewPath),
  requestPath,
  promptEvidencePath,
  reviewRunReportPath,
  contributionPath,
]
for (const filePath of requiredArtifacts) {
  assert(filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile(), `required repair artifact is missing: ${projectPath(filePath)}`)
}
assert(sha256File(requiredArtifacts[0]) === request.generatedImageSourceSha256, "generated source image hash mismatch")
assert(sha256File(requiredArtifacts[1]) === request.normalizedImageSha256, "training derivative hash mismatch")
assert(sha256File(requiredArtifacts[2]) === record.originalImage.sha256, "original library image hash mismatch")

const filesByLogicalPath = new Map()
for (const target of targetRoots) {
  for (const filePath of collectFiles(target.root)) {
    const logicalPath = projectPath(filePath)
    if (!filesByLogicalPath.has(logicalPath)) {
      const info = fs.statSync(filePath)
      filesByLogicalPath.set(logicalPath, {
        logicalPath,
        physicalUri: fs.realpathSync(filePath),
        storageLayer: "hot",
        runId: target.artifactRunId,
        byteSize: info.size,
        modifiedAtUtc: info.mtime.toISOString(),
        sha256: sha256File(filePath),
      })
    }
  }
}
const artifacts = [...filesByLogicalPath.values()].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath))
assert(artifacts.length > 0, "repair target contains no artifacts")

const database = openStorageCatalog()
const artifactLookup = database.prepare(`
  SELECT logical_path, physical_uri, run_id, artifact_type, byte_size, modified_at_utc, sha256, indexed_at_utc
  FROM artifacts
  WHERE logical_path = ?
`)
const beforeRows = artifacts.map((artifact) => artifactLookup.get(artifact.logicalPath) ?? null)
const missingBefore = artifacts.filter((artifact, index) => beforeRows[index] == null)
const mismatchedBefore = artifacts.filter((artifact, index) => {
  const row = beforeRows[index]
  return row != null && (
    row.sha256 !== artifact.sha256
    || Number(row.byte_size) !== artifact.byteSize
    || path.resolve(row.physical_uri) !== path.resolve(artifact.physicalUri)
  )
})

database.exec("BEGIN IMMEDIATE")
try {
  for (const artifact of artifacts) indexArtifact(artifact)
  database.exec("COMMIT")
} catch (error) {
  database.exec("ROLLBACK")
  throw error
}

const afterRows = artifacts.map((artifact) => artifactLookup.get(artifact.logicalPath) ?? null)
const failures = []
for (let index = 0; index < artifacts.length; index += 1) {
  const artifact = artifacts[index]
  const row = afterRows[index]
  if (!row) failures.push(`artifact_not_indexed:${artifact.logicalPath}`)
  else {
    if (row.sha256 !== artifact.sha256) failures.push(`artifact_sha256_mismatch:${artifact.logicalPath}`)
    if (Number(row.byte_size) !== artifact.byteSize) failures.push(`artifact_byte_size_mismatch:${artifact.logicalPath}`)
    if (path.resolve(row.physical_uri) !== path.resolve(artifact.physicalUri)) failures.push(`artifact_physical_uri_mismatch:${artifact.logicalPath}`)
  }
  if (sha256File(resolveProjectPath(artifact.logicalPath)) !== artifact.sha256) {
    failures.push(`source_file_changed_during_repair:${artifact.logicalPath}`)
  }
}
assert(failures.length === 0, failures.join(","))

const createdAtUtc = new Date().toISOString()
const repairRunId = `ai-assisted-cold-start-record-artifact-index-repair-${recordId}-${createdAtUtc.replace(/[:.]/g, "-")}`
const report = {
  schemaVersion: "ai-assisted-cold-start-record-artifact-index-repair-v1",
  runId: repairRunId,
  status: "storage_catalog_artifact_index_repaired",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  recordId,
  categoryId,
  reason: "The approved conditional RGB record files existed with valid hashes, but some files were absent from the SQLite artifact catalog.",
  reasonZh: "已通过审核的条件 RGB 记录文件及哈希均正确，但部分文件未进入 SQLite 产物目录。",
  repair: "Index the existing record, candidate, request, review-pipeline, and capacity-contribution files in one SQLite transaction without modifying source evidence.",
  repairZh: "在单个 SQLite 事务中补录既有原图记录、候选、请求、审核流水线和容量贡献文件，不修改任何源证据。",
  targetRoots: targetRoots.map((target) => ({
    label: target.label,
    path: projectPath(target.root),
    artifactRunId: target.artifactRunId,
  })),
  artifactCount: artifacts.length,
  missingBeforeCount: missingBefore.length,
  mismatchedBeforeCount: mismatchedBefore.length,
  missingAfterCount: 0,
  mismatchedAfterCount: 0,
  requiredArtifacts: requiredArtifacts.map((filePath) => ({
    path: projectPath(filePath),
    byteSize: fs.statSync(filePath).size,
    sha256: sha256File(filePath),
  })),
  artifacts,
  sourceFilesModified: false,
  imageGenerated: false,
  machineReviewRerun: false,
  ownerReviewChanged: false,
  capacityChanged: false,
  gpuTrainingStarted: false,
  runtimeAdvanced: false,
  worldPageAdvanced: false,
  automaticStorage: true,
}
const written = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: repairRunId,
  fileName: "repair-report.json",
  record: report,
  latest: {
    recordId,
    artifactCount: report.artifactCount,
    missingBeforeCount: report.missingBeforeCount,
    missingAfterCount: report.missingAfterCount,
  },
})
const event = appendAiPainterProgramEvent({
  action: "repair_ai_assisted_cold_start_record_artifact_index",
  runId: repairRunId,
  kind: "storage_catalog_repair_completed",
  status: "success",
  title: "AI-assisted cold-start record SQLite artifact index repaired",
  titleZh: "AI 辅助冷启动原图记录的 SQLite 产物索引已修复",
  detail: `recordId=${recordId}; artifactCount=${artifacts.length}; missingBefore=${missingBefore.length}; missingAfter=0; sourceFilesModified=false`,
  detailZh: `记录=${recordId}；产物数=${artifacts.length}；修复前缺失=${missingBefore.length}；修复后缺失=0；源文件修改=false`,
  script: "scripts/repair-ai-assisted-cold-start-record-artifact-index.mjs",
  currentStep: "storage_catalog_artifact_index_repair",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: recordId,
  evidencePath: written.runPath,
  nextAction: "independently_check_repaired_storage_catalog",
  nextActionZh: "独立检查修复后的存储目录",
})

console.log(JSON.stringify({
  status: report.status,
  repairRunId,
  recordId,
  artifactCount: report.artifactCount,
  missingBeforeCount: report.missingBeforeCount,
  mismatchedBeforeCount: report.mismatchedBeforeCount,
  missingAfterCount: report.missingAfterCount,
  mismatchedAfterCount: report.mismatchedAfterCount,
  reportPath: written.runPath,
  ledgerEventId: event.id,
  sourceFilesModified: false,
  imageGenerated: false,
  gpuTrainingStarted: false,
}, null, 2))

function collectFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(child))
    else if (entry.isFile()) files.push(child)
  }
  return files
}
function resolveProjectPath(value) {
  assert(value, "required project path is missing")
  const resolved = path.resolve(ROOT, value)
  assert(isProjectLogicalPath(resolved), `path escapes project root: ${value}`)
  return resolved
}
function isProjectLogicalPath(value) {
  const resolved = path.resolve(value)
  return resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`)
}
function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}
function readJson(value) {
  return JSON.parse(fs.readFileSync(value, "utf8"))
}
function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}
