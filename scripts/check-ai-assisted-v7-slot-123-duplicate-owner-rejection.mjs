import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { catalogPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const RECORD_ID = "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v1"
const CAPACITY_SLOT_ID = "v7-capacity-slot-123"
const POINTER_PATH = ".runtime/ai-painter/ai-assisted-v7-duplicate-owner-rejection-repairs/latest.json"
const pointer = readJson(POINTER_PATH)
assert(pointer.recordId === RECORD_ID, "repair pointer record mismatch")
const report = readJson(pointer.runPath)
assert(report.schemaVersion === "ai-assisted-v7-duplicate-owner-rejection-repair-v1", "repair report schema mismatch")
assert(report.status === "completed", "repair report status mismatch")
assert(report.recordId === RECORD_ID, "repair report record mismatch")
assert(report.duplicateHistoryDeleted === false, "duplicate history was deleted")
assert(report.reviewDecisionChanged === false, "owner decision changed")
assert(report.capacityChanged === false, "capacity changed")
assert(report.imageGenerated === false && report.gpuTrainingStarted === false, "repair generated an image or started GPU training")
assert(report.missingAfterCount === 0 && report.mismatchedAfterCount === 0, "repair report contains unresolved catalog failures")

const record = readJson(`data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}/record.json`)
const canonicalReview = readJson(report.canonicalReviewPath)
const duplicateReview = readJson(report.duplicateReviewPath)
const authoritativeReview = readJson(report.authoritativeReviewPath)
const duplicateFailure = readJson(report.duplicateFailurePath)
const authoritativeFailure = readJson(report.authoritativeFailurePath)
assert(record.status === "rejected" && record.reviews?.ownerReviewStatus === "owner_rejected", "record rejection status changed")
assert(!record.v7CapacityContribution, "rejected record has a capacity contribution")
assert(record.ownerReviewReconciliation?.status === "duplicate_owner_rejection_reconciled", "record reconciliation metadata missing")
assert(record.ownerReviewReconciliation?.authoritativeReviewPath === report.authoritativeReviewPath, "authoritative owner review pointer mismatch")
assert(record.ownerReviewReconciliation?.learningEvidenceCount === 1, "owner failure learning evidence count mismatch")
assert(canonicalReview.reviewId === authoritativeReview.reviewId, "canonical owner review is not authoritative")
assert(authoritativeReview.reasonCodes?.includes("composition_duplicate"), "authoritative review reason is not composition_duplicate")
assert(!duplicateReview.reasonCodes?.includes("composition_duplicate"), "duplicate review unexpectedly became authoritative")
assert(duplicateFailure.imageSha256 === authoritativeFailure.imageSha256, "duplicate failure image identity mismatch")
assert(authoritativeFailure.reasonCodes?.includes("composition_duplicate"), "authoritative failure reason mismatch")

for (const [filePath, expectedSha256] of [
  [report.duplicateReviewPath, report.duplicateReviewSha256],
  [report.authoritativeReviewPath, report.authoritativeReviewSha256],
  [report.canonicalReviewPath, report.canonicalReviewSha256],
  [report.duplicateFailurePath, report.duplicateFailureSha256],
  [report.authoritativeFailurePath, report.authoritativeFailureSha256],
  [report.learningHistoryPath, report.learningHistorySha256],
  [report.capacityPlanPath, report.capacityPlanSha256],
]) {
  assert(sha256File(resolveProjectPath(filePath)) === expectedSha256, `evidence hash mismatch: ${filePath}`)
}

const learning = readJson(report.learningHistoryPath)
assert(learning.runId === report.learningRunId, "repair learning history run mismatch")
const suppression = learning.ownerReviewDeduplication?.suppressed?.find(
  (entry) =>
    entry.recordId === RECORD_ID
    && entry.imageSha256 === report.imageSha256
    && entry.suppressedPath === report.duplicateFailurePath
    && entry.authoritativePath === report.authoritativeFailurePath,
)
assert(suppression, "duplicate owner failure suppression evidence missing")
const compositionPattern = learning.learnedFailurePatterns?.find((pattern) => pattern.code === "composition_duplicate")
assert(compositionPattern?.evidencePaths.includes(report.authoritativeFailurePath), "authoritative composition failure missing from learning")
assert(!compositionPattern?.evidencePaths.includes(report.duplicateFailurePath), "duplicate failure still contributes to learning")

const database = new DatabaseSync(catalogPath, { readOnly: true })
const artifactLookup = database.prepare(`
  SELECT logical_path, physical_uri, run_id, artifact_type, byte_size, modified_at_utc, sha256, indexed_at_utc
  FROM artifacts WHERE logical_path = ?
`)
const failures = []
for (const artifact of report.indexedArtifacts ?? []) {
  const filePath = resolveProjectPath(artifact.logicalPath)
  const row = artifactLookup.get(artifact.logicalPath)
  if (!fs.existsSync(filePath)) failures.push(`file_missing:${artifact.logicalPath}`)
  if (!row) failures.push(`catalog_row_missing:${artifact.logicalPath}`)
  else {
    if (row.sha256 !== artifact.sha256) failures.push(`catalog_sha256_mismatch:${artifact.logicalPath}`)
    if (Number(row.byte_size) !== artifact.byteSize) failures.push(`catalog_byte_size_mismatch:${artifact.logicalPath}`)
    if (path.resolve(row.physical_uri) !== path.resolve(fs.realpathSync(filePath))) failures.push(`catalog_physical_uri_mismatch:${artifact.logicalPath}`)
  }
}
const events = database.prepare(`
  SELECT event_id, title, title_zh, evidence_path
  FROM program_events
  WHERE run_id = ? AND action = ?
`).all(report.runId, "repair_ai_assisted_v7_duplicate_owner_rejection")
if (events.length !== 1) failures.push(`repair_event_count_invalid:${events.length}`)
for (const event of events) {
  if (!event.title || !event.title_zh) failures.push(`repair_event_bilingual_title_missing:${event.event_id}`)
  if (event.evidence_path !== pointer.runPath) failures.push(`repair_event_evidence_path_mismatch:${event.event_id}`)
}
database.close()

const capacityPlan = readJson(report.capacityPlanPath)
assert(capacityPlan.auditSummary?.qualifiedExistingRecordCount === 41, "qualified capacity count changed")
assert(capacityPlan.gapSummary?.requiredNewRecordCount === 23, "remaining capacity count changed")
const currentCapacityPointer = readJson(report.capacityPointerPath)
const currentCapacityPlan = readJson(currentCapacityPointer.capacityPlanPath)
assert(
  currentCapacityPlan.auditSummary?.nextCapacitySlotId === CAPACITY_SLOT_ID,
  "current capacity plan no longer keeps rejected slot-123 open",
)
assert(
  Number(currentCapacityPlan.auditSummary?.qualifiedExistingRecordCount) +
    Number(currentCapacityPlan.gapSummary?.requiredNewRecordCount) ===
      64,
  "current capacity plan no longer closes to the approved MVP capacity",
)

const result = {
  ok: failures.length === 0,
  status: failures.length === 0
    ? "ai_assisted_v7_slot_123_duplicate_owner_rejection_check_passed"
    : "ai_assisted_v7_slot_123_duplicate_owner_rejection_check_failed",
  repairRunId: report.runId,
  recordId: RECORD_ID,
  ownerDecision: canonicalReview.decision,
  authoritativeReasonCodes: authoritativeReview.reasonCodes,
  duplicateHistoryPreserved: true,
  ownerFailureLearningEvidenceCount: record.ownerReviewReconciliation.learningEvidenceCount,
  ownerReviewDuplicateSuppressedCount: learning.evidenceSummary.ownerReviewDuplicateSuppressedCount,
  indexedArtifactCount: report.indexedArtifactCount,
  historicalQualifiedCapacityCount:
    capacityPlan.auditSummary.qualifiedExistingRecordCount,
  historicalRemainingCapacityCount:
    capacityPlan.gapSummary.requiredNewRecordCount,
  currentCapacityPlanRunId: currentCapacityPlan.runId,
  currentQualifiedCapacityCount:
    currentCapacityPlan.auditSummary.qualifiedExistingRecordCount,
  currentRemainingCapacityCount:
    currentCapacityPlan.gapSummary.requiredNewRecordCount,
  capacityChanged: false,
  imageGenerated: false,
  gpuTrainingStarted: false,
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`)
  return resolved
}
function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}
function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}
