import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  indexArtifact,
  openStorageCatalog,
} from "./lib/ai-pet-world-storage-catalog.mjs"
import { refreshGameMapAutoVisualJudgeLearning } from "./lib/game-map-auto-visual-judge-learning.mjs"

const ROOT = process.cwd()
const RECORD_ID = "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v1"
const CAPACITY_SLOT_ID = "v7-capacity-slot-123"
const OWNER_COMMAND_REF = "project-owner-authorized-slot-123-duplicate-owner-rejection-and-storage-repair-20260727"
const RECORD_PATH = `data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}/record.json`
const INDEX_PATH = "data/world-samples/original-image-library/natural-home-v1/index.json"
const CANONICAL_REVIEW_PATH = `data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}/reviews/owner-review.json`
const DUPLICATE_REVIEW_PATH = `data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}/reviews/owner/ai-cold-start-owner-review-${RECORD_ID}-2026-07-27T14-06-58-845Z.json`
const AUTHORITATIVE_REVIEW_PATH = `data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}/reviews/owner/ai-cold-start-owner-review-${RECORD_ID}-2026-07-27T14-07-30-021Z.json`
const DUPLICATE_FAILURE_PATH = `.runtime/ai-painter/auto-visual-judge-learning/original-image-owner-failures/ai-assisted-cold-start-owner-failure-${RECORD_ID}-2026-07-27T14-06-58-845Z/failure-record.json`
const AUTHORITATIVE_FAILURE_PATH = `.runtime/ai-painter/auto-visual-judge-learning/original-image-owner-failures/ai-assisted-cold-start-owner-failure-${RECORD_ID}-2026-07-27T14-07-30-021Z/failure-record.json`
const CAPACITY_POINTER_PATH = ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json"
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-v7-duplicate-owner-rejection-repairs"

const recordPath = resolveProjectPath(RECORD_PATH)
const indexPath = resolveProjectPath(INDEX_PATH)
const canonicalReviewPath = resolveProjectPath(CANONICAL_REVIEW_PATH)
const duplicateReviewPath = resolveProjectPath(DUPLICATE_REVIEW_PATH)
const authoritativeReviewPath = resolveProjectPath(AUTHORITATIVE_REVIEW_PATH)
const duplicateFailurePath = resolveProjectPath(DUPLICATE_FAILURE_PATH)
const authoritativeFailurePath = resolveProjectPath(AUTHORITATIVE_FAILURE_PATH)
const capacityPointerPath = resolveProjectPath(CAPACITY_POINTER_PATH)
for (const requiredPath of [
  recordPath,
  indexPath,
  canonicalReviewPath,
  duplicateReviewPath,
  authoritativeReviewPath,
  duplicateFailurePath,
  authoritativeFailurePath,
  capacityPointerPath,
]) {
  assert(fs.existsSync(requiredPath), `required evidence is missing: ${projectPath(requiredPath)}`)
}

const record = readJson(recordPath)
const index = readJson(indexPath)
const canonicalReview = readJson(canonicalReviewPath)
const duplicateReview = readJson(duplicateReviewPath)
const authoritativeReview = readJson(authoritativeReviewPath)
const duplicateFailure = readJson(duplicateFailurePath)
const authoritativeFailure = readJson(authoritativeFailurePath)
const capacityPointer = readJson(capacityPointerPath)
const capacityPlanPath = resolveProjectPath(capacityPointer.capacityPlanPath)
const capacityPlanSha256Before = sha256File(capacityPlanPath)
const capacityPointerSha256Before = sha256File(capacityPointerPath)

assert(record.recordId === RECORD_ID, "record identity mismatch")
assert(record.status === "rejected", "record is not rejected")
assert(record.reviews?.ownerReviewStatus === "owner_rejected", "record owner review status mismatch")
assert(!record.v7CapacityContribution, "rejected record unexpectedly has a V7 capacity contribution")
for (const review of [canonicalReview, duplicateReview, authoritativeReview]) {
  assert(review.recordId === RECORD_ID, "owner review record identity mismatch")
  assert(review.decision === "owner_rejected", "owner review decisions conflict")
  assert(review.imageSha256 === record.originalImage.sha256, "owner review image identity mismatch")
}
assert(sha256File(canonicalReviewPath) === sha256File(authoritativeReviewPath), "canonical review is not the explicit composition-duplicate review")
assert(authoritativeReview.reasonCodes.includes("composition_duplicate"), "authoritative review lacks composition_duplicate")
assert(!duplicateReview.reasonCodes.includes("composition_duplicate"), "earlier duplicate review unexpectedly contains the explicit reason")
for (const failure of [duplicateFailure, authoritativeFailure]) {
  assert(failure.recordId === RECORD_ID, "owner failure record identity mismatch")
  assert(failure.imageSha256 === record.originalImage.sha256, "owner failure image identity mismatch")
  assert(failure.status === "owner_rejected", "owner failure status mismatch")
}
assert(authoritativeFailure.reasonCodes.includes("composition_duplicate"), "authoritative owner failure lacks composition_duplicate")

const immutableEvidencePaths = [
  duplicateReviewPath,
  authoritativeReviewPath,
  duplicateFailurePath,
  authoritativeFailurePath,
  canonicalReviewPath,
]
const immutableHashesBefore = Object.fromEntries(
  immutableEvidencePaths.map((filePath) => [projectPath(filePath), sha256File(filePath)]),
)
const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId = `ai-assisted-v7-duplicate-owner-rejection-repair-${CAPACITY_SLOT_ID}-${createdAtUtc.replace(/[:.]/g, "-")}`
const reconciliation = {
  schemaVersion: "ai-assisted-v7-duplicate-owner-rejection-reconciliation-v1",
  status: "duplicate_owner_rejection_reconciled",
  reconciledAtUtc: createdAtUtc,
  reconciledAtAsiaShanghai: createdAtAsiaShanghai,
  ownerCommandRef: OWNER_COMMAND_REF,
  authoritativeReviewPath: AUTHORITATIVE_REVIEW_PATH,
  authoritativeReviewSha256: sha256File(authoritativeReviewPath),
  authoritativeFailurePath: AUTHORITATIVE_FAILURE_PATH,
  authoritativeFailureSha256: sha256File(authoritativeFailurePath),
  duplicateReviewPaths: [DUPLICATE_REVIEW_PATH],
  duplicateFailurePaths: [DUPLICATE_FAILURE_PATH],
  learningDeduplicationIdentity: `${RECORD_ID}:${record.originalImage.sha256}`,
  learningEvidenceCount: 1,
  bothImmutableReviewHistoriesPreserved: true,
  bothImmutableFailureHistoriesPreserved: true,
  decisionChanged: false,
  capacityContributionCreated: false,
}
const repairedRecord = {
  ...record,
  ownerReviewReconciliation: reconciliation,
  updatedAtUtc: createdAtUtc,
  updatedAtAsiaShanghai: createdAtAsiaShanghai,
}
writeJsonAtomic(recordPath, repairedRecord)

const indexedRecordPosition = (index.records ?? []).findIndex((entry) => entry.recordId === RECORD_ID)
assert(indexedRecordPosition >= 0, "original-image library index record is missing")
const repairedIndexRecords = [...index.records]
repairedIndexRecords[indexedRecordPosition] = {
  ...repairedIndexRecords[indexedRecordPosition],
  status: repairedRecord.status,
  reviews: repairedRecord.reviews,
  blockReasons: repairedRecord.blockReasons,
  trainingEligibility: repairedRecord.trainingEligibility,
  aiAssistedColdStartEligible: repairedRecord.aiAssistedColdStartEligible,
  independentTrainingEligible: repairedRecord.independentTrainingEligible,
  ownerReviewReconciliation: reconciliation,
  updatedAtUtc: createdAtUtc,
  updatedAtAsiaShanghai: createdAtAsiaShanghai,
}
writeJsonAtomic(indexPath, {
  ...index,
  updatedAt: createdAtUtc,
  records: repairedIndexRecords,
})

const learningRecord = refreshGameMapAutoVisualJudgeLearning({
  trigger: "slot_123_duplicate_owner_rejection_reconciled",
})
const suppressedOwnerFailure = learningRecord.ownerReviewDeduplication?.suppressed?.find(
  (entry) =>
    entry.recordId === RECORD_ID
    && entry.imageSha256 === record.originalImage.sha256
    && entry.suppressedPath === DUPLICATE_FAILURE_PATH
    && entry.authoritativePath === AUTHORITATIVE_FAILURE_PATH,
)
assert(suppressedOwnerFailure, "owner failure learning duplicate was not suppressed")
const compositionPattern = learningRecord.learnedFailurePatterns.find((pattern) => pattern.code === "composition_duplicate")
assert(compositionPattern?.evidencePaths.includes(AUTHORITATIVE_FAILURE_PATH), "authoritative composition failure is absent from learning")
assert(!compositionPattern?.evidencePaths.includes(DUPLICATE_FAILURE_PATH), "duplicate owner failure entered composition learning")

const requestRoot = path.dirname(resolveProjectPath(repairedRecord.aiAssistedColdStart.promptEvidencePath))
const request = readJson(path.join(requestRoot, "request.json"))
const candidateRoot = path.dirname(resolveProjectPath(repairedRecord.aiAssistedColdStart.trainingDerivativePath))
const recordRoot = path.dirname(recordPath)
const reviewRunReportPath = resolveProjectPath(request.automaticReview?.runReportPath)
assert(fs.existsSync(reviewRunReportPath), "review pipeline report is missing")
const reviewRunRoot = path.dirname(reviewRunReportPath)
const learningHistoryPath = resolveProjectPath(learningRecord.historyPath)
const targetRoots = [
  { label: "candidate", root: candidateRoot },
  { label: "conditional_request", root: requestRoot },
  { label: "original_image_record", root: recordRoot },
  { label: "review_pipeline", root: reviewRunRoot },
  { label: "duplicate_owner_failure", root: path.dirname(duplicateFailurePath) },
  { label: "authoritative_owner_failure", root: path.dirname(authoritativeFailurePath) },
  { label: "learning_history", root: path.dirname(learningHistoryPath) },
]
const extraFiles = [
  indexPath,
  resolveProjectPath(".runtime/ai-painter/auto-visual-judge-learning/latest.json"),
]
const artifactsByLogicalPath = new Map()
for (const target of targetRoots) {
  assert(fs.existsSync(target.root) && fs.statSync(target.root).isDirectory(), `target root is missing: ${projectPath(target.root)}`)
  for (const filePath of collectFiles(target.root)) addArtifact(filePath, target.label)
}
for (const filePath of extraFiles) addArtifact(filePath, "shared_pointer")
const artifacts = [...artifactsByLogicalPath.values()].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath))

const database = openStorageCatalog()
const lookup = database.prepare(`
  SELECT logical_path, physical_uri, run_id, artifact_type, byte_size, modified_at_utc, sha256, indexed_at_utc
  FROM artifacts WHERE logical_path = ?
`)
const beforeRows = artifacts.map((artifact) => lookup.get(artifact.logicalPath) ?? null)
const missingBeforeCount = beforeRows.filter((row) => row == null).length
const mismatchedBeforeCount = artifacts.filter((artifact, indexValue) => {
  const row = beforeRows[indexValue]
  return row != null && (
    row.sha256 !== artifact.sha256
    || Number(row.byte_size) !== artifact.byteSize
    || path.resolve(row.physical_uri) !== path.resolve(artifact.physicalUri)
  )
}).length
database.exec("BEGIN IMMEDIATE")
try {
  for (const artifact of artifacts) indexArtifact(artifact)
  database.exec("COMMIT")
} catch (error) {
  database.exec("ROLLBACK")
  throw error
}
const catalogFailures = []
for (const artifact of artifacts) {
  const row = lookup.get(artifact.logicalPath)
  if (!row) catalogFailures.push(`catalog_row_missing:${artifact.logicalPath}`)
  else {
    if (row.sha256 !== artifact.sha256) catalogFailures.push(`catalog_sha256_mismatch:${artifact.logicalPath}`)
    if (Number(row.byte_size) !== artifact.byteSize) catalogFailures.push(`catalog_byte_size_mismatch:${artifact.logicalPath}`)
    if (path.resolve(row.physical_uri) !== path.resolve(artifact.physicalUri)) catalogFailures.push(`catalog_physical_uri_mismatch:${artifact.logicalPath}`)
  }
}
assert(catalogFailures.length === 0, catalogFailures.join(","))

for (const filePath of immutableEvidencePaths) {
  assert(
    sha256File(filePath) === immutableHashesBefore[projectPath(filePath)],
    `immutable owner evidence changed: ${projectPath(filePath)}`,
  )
}
assert(sha256File(capacityPointerPath) === capacityPointerSha256Before, "capacity latest pointer changed")
assert(sha256File(capacityPlanPath) === capacityPlanSha256Before, "capacity plan changed")

const report = {
  schemaVersion: "ai-assisted-v7-duplicate-owner-rejection-repair-v1",
  runId,
  status: "completed",
  createdAtUtc,
  createdAtAsiaShanghai,
  ownerCommandRef: OWNER_COMMAND_REF,
  recordId: RECORD_ID,
  capacitySlotId: CAPACITY_SLOT_ID,
  imageSha256: record.originalImage.sha256,
  duplicateReviewPath: DUPLICATE_REVIEW_PATH,
  duplicateReviewSha256: immutableHashesBefore[DUPLICATE_REVIEW_PATH],
  authoritativeReviewPath: AUTHORITATIVE_REVIEW_PATH,
  authoritativeReviewSha256: immutableHashesBefore[AUTHORITATIVE_REVIEW_PATH],
  canonicalReviewPath: CANONICAL_REVIEW_PATH,
  canonicalReviewSha256: sha256File(canonicalReviewPath),
  duplicateFailurePath: DUPLICATE_FAILURE_PATH,
  duplicateFailureSha256: immutableHashesBefore[DUPLICATE_FAILURE_PATH],
  authoritativeFailurePath: AUTHORITATIVE_FAILURE_PATH,
  authoritativeFailureSha256: immutableHashesBefore[AUTHORITATIVE_FAILURE_PATH],
  reconciliation,
  learningRunId: learningRecord.runId,
  learningHistoryPath: projectPath(learningHistoryPath),
  learningHistorySha256: sha256File(learningHistoryPath),
  ownerReviewEvidenceCountBeforeDeduplication:
    learningRecord.evidenceSummary.ownerReviewCountBeforeDeduplication,
  ownerReviewDuplicateSuppressedCount:
    learningRecord.evidenceSummary.ownerReviewDuplicateSuppressedCount,
  suppressedOwnerFailure,
  indexedArtifactCount: artifacts.length,
  missingBeforeCount,
  mismatchedBeforeCount,
  missingAfterCount: 0,
  mismatchedAfterCount: 0,
  indexedArtifacts: artifacts,
  capacityPointerPath: CAPACITY_POINTER_PATH,
  capacityPointerSha256: capacityPointerSha256Before,
  capacityPlanPath: capacityPointer.capacityPlanPath,
  capacityPlanSha256: capacityPlanSha256Before,
  capacityQualifiedCount: 41,
  capacityRemainingCount: 23,
  duplicateHistoryDeleted: false,
  reviewDecisionChanged: false,
  imageChanged: false,
  worldFactsChanged: false,
  conditionGeometryChanged: false,
  reviewThresholdsChanged: false,
  capacityChanged: false,
  imageGenerated: false,
  gpuTrainingStarted: false,
  runtimeStarted: false,
  worldPageChanged: false,
  automaticStorage: true,
}
const written = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "repair-report.json",
  record: report,
  latest: {
    recordId: RECORD_ID,
    capacitySlotId: CAPACITY_SLOT_ID,
    learningRunId: learningRecord.runId,
    indexedArtifactCount: artifacts.length,
  },
})
const event = appendAiPainterProgramEvent({
  action: "repair_ai_assisted_v7_duplicate_owner_rejection",
  runId,
  kind: "repair_completed",
  status: "success",
  title: "V7 duplicate owner rejection and storage index reconciled",
  titleZh: "V7 重复项目所有者拒绝记录与存储索引已协调",
  detail: `recordId=${RECORD_ID}; duplicateHistoryPreserved=true; learningEvidenceCount=1; indexedArtifactCount=${artifacts.length}; capacityChanged=false`,
  detailZh: `记录=${RECORD_ID}；重复历史已保留=true；失败学习证据数=1；索引产物数=${artifacts.length}；容量变化=false`,
  script: "scripts/repair-ai-assisted-v7-slot-123-duplicate-owner-rejection.mjs",
  currentStep: "slot_123_duplicate_owner_rejection_and_storage_repaired",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: RECORD_ID,
  evidencePath: written.runPath,
  nextAction: "wait_for_owner_authorization_before_new_slot_123_condition_seed_or_rgb",
  nextActionZh: "等待项目所有者另行授权slot-123新条件种子或RGB",
})

console.log(JSON.stringify({
  status: report.status,
  runId,
  recordId: RECORD_ID,
  duplicateHistoryDeleted: false,
  learningEvidenceCount: reconciliation.learningEvidenceCount,
  ownerReviewDuplicateSuppressedCount: report.ownerReviewDuplicateSuppressedCount,
  indexedArtifactCount: report.indexedArtifactCount,
  missingBeforeCount,
  mismatchedBeforeCount,
  missingAfterCount: 0,
  mismatchedAfterCount: 0,
  capacityChanged: false,
  imageGenerated: false,
  gpuTrainingStarted: false,
  reportPath: written.runPath,
  ledgerEventId: event.id,
}, null, 2))

function addArtifact(filePath, label) {
  const logicalPath = projectPath(filePath)
  if (artifactsByLogicalPath.has(logicalPath)) return
  const info = fs.statSync(filePath)
  artifactsByLogicalPath.set(logicalPath, {
    label,
    logicalPath,
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
    sha256: sha256File(filePath),
  })
}
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
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`)
  return resolved
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
