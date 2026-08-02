import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { catalogPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const RECORD_ID = "ai-cold-start-v7-v7-capacity-slot-119-monsoon-grassland-v2"
const CAPACITY_SLOT_ID = "v7-capacity-slot-119"
const CAPACITY_REVIEW_SHA256 = "e0a3bbcbd82d016869b3b525ae5a517997448d52495436c2271c68eb51f06e82"
const REPAIR_RUN_ID = "ai-assisted-v7-owner-review-capacity-binding-repair-v7-capacity-slot-119-2026-07-27T12-05-37-178Z"
const CANONICAL_REVIEW_PATH = `data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}/reviews/owner-review.json`
const REPAIR_REPORT_PATH = `.runtime/ai-painter/ai-assisted-v7-owner-review-capacity-binding-repairs/${REPAIR_RUN_ID}/repair-report.json`
const CAPACITY_LATEST_PATH = ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json"
const DATASET_LATEST_PATH = "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json"

const failures = []
const repairReport = readJson(REPAIR_REPORT_PATH)
const canonicalReviewSha256 = fileSha256(CANONICAL_REVIEW_PATH)
const capacityLatest = readJson(CAPACITY_LATEST_PATH)
const capacityPlan = readJson(capacityLatest.capacityPlanPath)
const gapList = readJson(capacityLatest.gapListPath)
const datasetLatest = readJson(DATASET_LATEST_PATH)

check(repairReport.status === "completed", "repair_report_not_completed")
check(repairReport.recordId === RECORD_ID, "repair_report_record_identity_mismatch")
check(repairReport.capacitySlotId === CAPACITY_SLOT_ID, "repair_report_slot_identity_mismatch")
check(repairReport.canonicalOwnerReviewSha256After === CAPACITY_REVIEW_SHA256, "repair_report_canonical_hash_mismatch")
check(repairReport.bothImmutableReviewHistoriesPreserved === true, "immutable_review_history_preservation_missing")
check(repairReport.reviewDecisionChanged === false, "repair_changed_owner_review_decision")
check(repairReport.imageChanged === false, "repair_changed_image")
check(canonicalReviewSha256 === CAPACITY_REVIEW_SHA256, "canonical_owner_review_hash_mismatch")

const latestHashesMatch = {
  capacityPlan: fileSha256(capacityLatest.capacityPlanPath) === capacityLatest.capacityPlanSha256,
  gapList: fileSha256(capacityLatest.gapListPath) === capacityLatest.gapListSha256,
  coverageMatrix: fileSha256(capacityLatest.coverageMatrixPath) === capacityLatest.coverageMatrixSha256,
}
check(Object.values(latestHashesMatch).every(Boolean), "capacity_plan_latest_hash_mismatch")
check(capacityPlan.runId === capacityLatest.runId, "capacity_plan_run_identity_mismatch")
check(capacityPlan.auditSummary?.qualifiedExistingRecordCount === 38, "qualified_capacity_count_mismatch")
check(capacityPlan.gapSummary?.requiredNewRecordCount === 26, "remaining_capacity_count_mismatch")
check(capacityPlan.auditSummary?.failedExistingAuditCount === 0, "capacity_existing_audit_failure_present")
check((gapList.plannedSlots ?? []).length === 26, "planned_slot_count_mismatch")
check(capacityPlan.executionBoundary?.imagesGenerated === 0, "capacity_plan_unexpected_image_generation")
check(capacityPlan.executionBoundary?.gpuTrainingStarted === false, "capacity_plan_unexpected_gpu_training")
check(capacityPlan.executionBoundary?.trainingStarted === false, "capacity_plan_unexpected_training")
check(datasetLatest.packageId === "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-07-27T12-05-49-350Z", "dataset_package_identity_mismatch")

const database = new DatabaseSync(catalogPath, { readOnly: true })
database.exec("PRAGMA busy_timeout=5000;")
const events = database.prepare(
  "SELECT event_id, timestamp_utc, action, run_id, status, evidence_path FROM program_events WHERE run_id = ? ORDER BY timestamp_utc",
).all(REPAIR_RUN_ID)
const artifacts = database.prepare(
  "SELECT logical_path, run_id, sha256, byte_size FROM artifacts WHERE run_id = ? ORDER BY logical_path",
).all(REPAIR_RUN_ID)
const canonicalArtifact = database.prepare(
  "SELECT logical_path, run_id, sha256, byte_size FROM artifacts WHERE logical_path = ?",
).get(CANONICAL_REVIEW_PATH)
database.close()

check(events.some(
  (event) => event.action === "repair_ai_assisted_v7_owner_review_capacity_binding" && event.status === "success",
), "sqlite_repair_success_event_missing")
check(artifacts.some((artifact) => artifact.logical_path === REPAIR_REPORT_PATH), "sqlite_repair_report_artifact_missing")
check(canonicalArtifact?.sha256 === CAPACITY_REVIEW_SHA256, "sqlite_canonical_owner_review_hash_mismatch")

const result = {
  ok: failures.length === 0,
  status: failures.length === 0
    ? "slot_119_owner_review_capacity_binding_repair_check_passed"
    : "slot_119_owner_review_capacity_binding_repair_check_failed",
  recordId: RECORD_ID,
  capacitySlotId: CAPACITY_SLOT_ID,
  repairRunId: REPAIR_RUN_ID,
  repairReportPath: REPAIR_REPORT_PATH,
  canonicalOwnerReviewPath: CANONICAL_REVIEW_PATH,
  canonicalOwnerReviewSha256: canonicalReviewSha256,
  bothImmutableReviewHistoriesPreserved: repairReport.bothImmutableReviewHistoriesPreserved,
  capacityPlanRunId: capacityLatest.runId,
  latestHashesMatch,
  qualifiedExistingRecordCount: capacityPlan.auditSummary?.qualifiedExistingRecordCount,
  requiredNewRecordCount: capacityPlan.gapSummary?.requiredNewRecordCount,
  failedExistingAuditCount: capacityPlan.auditSummary?.failedExistingAuditCount,
  splitDeficits: capacityPlan.gapSummary?.plannedSplitCounts,
  plannedSlotCount: (gapList.plannedSlots ?? []).length,
  nextSlot: (gapList.plannedSlots ?? [])[0] ?? null,
  datasetPackageId: datasetLatest.packageId,
  sqliteRepairEventCount: events.length,
  sqliteRepairArtifactCount: artifacts.length,
  sqliteCanonicalOwnerReviewSha256: canonicalArtifact?.sha256 ?? null,
  imageGenerated: false,
  gpuTrainingStarted: false,
  failures,
}
console.log(JSON.stringify(result, null, 2))
if (!result.ok) process.exitCode = 1

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}

function fileSha256(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolveProjectPath(value))).digest("hex")
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (!(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`))) {
    throw new Error(`path escapes project root: ${value}`)
  }
  return resolved
}

function check(condition, failure) {
  if (!condition) failures.push(failure)
}
