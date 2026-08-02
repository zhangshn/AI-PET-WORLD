import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const POINTER_PATH = ".runtime/ai-painter/ai-assisted-v7-topology-capacity-suspensions/latest.json"
const EXPECTED_AUTHORIZATION_ID = "project-owner-authorized-slot-034-duplicate-topology-capacity-suspension-20260728"
const failures = []

const pointer = readJson(POINTER_PATH)
const report = pointer?.runPath ? readJson(pointer.runPath) : null

check(Boolean(pointer), "topology_capacity_suspension_pointer_missing")
check(Boolean(report), "topology_capacity_suspension_report_missing")
if (pointer && report) {
  check(pointer.status === "owner_suspended_duplicate_topology_capacity_contribution", "topology_capacity_suspension_pointer_status_invalid")
  check(report.status === pointer.status, "topology_capacity_suspension_status_mismatch")
  check(report.authorization?.authorizationId === EXPECTED_AUTHORIZATION_ID, "topology_capacity_suspension_authorization_mismatch")
  check(report.retainedRecord?.recordId === "ai-cold-start-condition-pair-007-riparian-tropical-forest-v3", "retained_record_identity_mismatch")
  check(report.suspendedRecord?.recordId === "ai-cold-start-v7-v7-capacity-slot-034-riparian-tropical-forest-v1", "suspended_record_identity_mismatch")
  check(report.suspendedRecord?.capacitySlotId === "v7-capacity-slot-034", "suspended_slot_identity_mismatch")
  check(report.suspendedRecord?.currentCapacityContributionAllowed === false, "suspended_capacity_eligibility_not_closed")
  check(report.reclassification?.qualifiedCountAfter === 40, "projected_qualified_count_invalid")
  check(report.reclassification?.requiredNewRecordCountAfter === 24, "projected_gap_count_invalid")
  check(report.reclassification?.historicalImageRetained === true, "historical_image_retention_missing")
  check(report.reclassification?.historicalMachineReviewRetained === true, "historical_machine_review_retention_missing")
  check(report.reclassification?.historicalOwnerReviewRetained === true, "historical_owner_review_retention_missing")
  check(report.reclassification?.historicalContributionRetained === true, "historical_contribution_retention_missing")
  check(report.reclassification?.recordModified === false, "source_record_was_marked_modified")
  check(report.reclassification?.libraryIndexModified === false, "library_index_was_marked_modified")
  check(report.reclassification?.replacementCapacitySlotIdentityAssigned === false, "unauthorized_replacement_slot_identity_assigned")
  check(report.executionBoundary?.imagesGenerated === 0, "image_generation_boundary_violated")
  check(report.executionBoundary?.gpuTrainingStarted === false, "gpu_training_boundary_violated")
  for (const evidence of [
    report.sourceDiagnosis,
    report.sourceCapacityPlan,
    report.retainedRecord,
    report.suspendedRecord,
  ]) {
    validateHash(evidence?.path ?? evidence?.recordPath, evidence?.sha256 ?? evidence?.recordSha256)
  }
  validateHash(report.retainedRecord?.imagePath, report.retainedRecord?.imageSha256)
  validateHash(report.retainedRecord?.conditionGuidePath, report.retainedRecord?.conditionGuideSha256)
  validateHash(report.retainedRecord?.machineReviewPath, report.retainedRecord?.machineReviewSha256)
  validateHash(report.retainedRecord?.ownerReviewPath, report.retainedRecord?.ownerReviewSha256)
  validateHash(report.suspendedRecord?.imagePath, report.suspendedRecord?.imageSha256)
  validateHash(report.suspendedRecord?.conditionGuidePath, report.suspendedRecord?.conditionGuideSha256)
  validateHash(report.suspendedRecord?.machineReviewPath, report.suspendedRecord?.machineReviewSha256)
  validateHash(report.suspendedRecord?.ownerReviewPath, report.suspendedRecord?.ownerReviewSha256)
  validateHash(report.suspendedRecord?.contributionPath, report.suspendedRecord?.contributionSha256)
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0
    ? "slot_034_topology_capacity_suspension_check_passed"
    : "slot_034_topology_capacity_suspension_check_failed",
  runId: report?.runId ?? null,
  retainedRecordId: report?.retainedRecord?.recordId ?? null,
  suspendedRecordId: report?.suspendedRecord?.recordId ?? null,
  qualifiedCountAfter: report?.reclassification?.qualifiedCountAfter ?? null,
  requiredNewRecordCountAfter: report?.reclassification?.requiredNewRecordCountAfter ?? null,
  imagesGenerated: report?.executionBoundary?.imagesGenerated ?? null,
  gpuTrainingStarted: report?.executionBoundary?.gpuTrainingStarted ?? null,
  failures,
}

console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function validateHash(value, expected) {
  check(typeof value === "string" && value.length > 0, `evidence_path_missing:${value}`)
  check(typeof expected === "string" && /^[a-f0-9]{64}$/.test(expected), `evidence_hash_invalid:${value}`)
  if (typeof value !== "string" || typeof expected !== "string") return
  const resolved = resolveProjectPath(value)
  check(fs.existsSync(resolved), `evidence_file_missing:${value}`)
  if (fs.existsSync(resolved)) check(fileSha256(value) === expected, `evidence_hash_mismatch:${value}`)
}

function readJson(value) {
  try {
    return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
  } catch {
    return null
  }
}

function fileSha256(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolveProjectPath(value))).digest("hex")
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project: ${value}`)
  return resolved
}

function check(condition, message) {
  if (!condition && !failures.includes(message)) failures.push(message)
}
