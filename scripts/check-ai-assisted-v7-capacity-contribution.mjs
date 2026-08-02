import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const recordId = argumentValue("--record-id")
const index = readJson("data/world-samples/original-image-library/natural-home-v1/index.json")
const records = (index?.records ?? []).filter((summary) => !recordId || summary.recordId === recordId)
const failures = []
const registered = []

check(records.length > 0, "v7_capacity_contribution_record_missing")
for (const summary of records) {
  const record = readJson(summary.recordPath)
  const recordRegistered = record?.v7CapacityContribution?.status === "registered"
  const indexRegistered = summary.v7CapacityContribution?.status === "registered"
  if (recordRegistered !== indexRegistered) {
    check(false, `index_registration_mismatch:${summary.recordId}`)
  }
  if (!recordRegistered) continue
  registered.push({ summary, record })
  validate(summary, record)
}
check(registered.length > 0, "v7_capacity_contribution_not_registered")
check(new Set(registered.map(({ record }) => record.v7CapacityContribution.capacitySlotId)).size === registered.length, "v7_capacity_slot_duplicate")

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "v7_capacity_contribution_check_passed" : "v7_capacity_contribution_check_failed",
  checkedRecordCount: registered.length,
  records: registered.map(({ summary, record }) => ({
    recordId: summary.recordId,
    capacitySlotId: record.v7CapacityContribution.capacitySlotId,
    split: record.v7CapacityContribution.split,
    contributionPath: record.v7CapacityContribution.contributionPath,
  })),
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function validate(summary, record) {
  const pointer = record?.v7CapacityContribution
  check(Boolean(record), `record_missing:${summary.recordId}`)
  check(pointer?.status === "registered", `registration_missing:${summary.recordId}`)
  check(pointer?.capacitySlotId === summary.v7CapacityContribution.capacitySlotId, `index_slot_mismatch:${summary.recordId}`)
  validateHash(pointer?.contributionPath, pointer?.contributionSha256, `contribution_hash_mismatch:${summary.recordId}`)
  const contribution = readJson(pointer?.contributionPath)
  check(contribution?.schemaVersion === "ai-assisted-v7-capacity-contribution-v1", `contribution_schema_invalid:${summary.recordId}`)
  check(contribution?.recordId === record?.recordId, `contribution_record_mismatch:${summary.recordId}`)
  check(contribution?.capacitySlotId === pointer?.capacitySlotId, `contribution_slot_mismatch:${summary.recordId}`)
  check(contribution?.split === pointer?.split, `contribution_split_mismatch:${summary.recordId}`)
  check(contribution?.imageSha256 === record?.originalImage?.sha256, `contribution_image_mismatch:${summary.recordId}`)
  check(contribution?.conditionWorldId === record?.worldBinding?.worldId, `contribution_world_mismatch:${summary.recordId}`)
  check(contribution?.taskPackageId === record?.worldBinding?.taskPackageId, `contribution_task_mismatch:${summary.recordId}`)
  check(contribution?.conditionChannelCount === 23, `contribution_channel_count_invalid:${summary.recordId}`)
  check(contribution?.trainingEligibility?.aiAssistedConditionalDenoiser === true, `contribution_training_lane_invalid:${summary.recordId}`)
  check(contribution?.trainingEligibility?.independentTraining === false, `contribution_independent_lane_invalid:${summary.recordId}`)
  check(contribution?.trainingEligibility?.runtimeFrame === false && contribution?.trainingEligibility?.worldPage === false, `contribution_game_use_boundary_invalid:${summary.recordId}`)
  validateHash(contribution?.imagePath, contribution?.imageSha256, `source_image_hash_mismatch:${summary.recordId}`)
  validateHash(contribution?.taskPackagePath, contribution?.taskPackageSha256, `task_package_hash_mismatch:${summary.recordId}`)
  validateHash(contribution?.conditionPackPath, contribution?.conditionPackFileSha256, `condition_pack_hash_mismatch:${summary.recordId}`)
  validateHash(contribution?.completeMapScopeAuditPath, contribution?.completeMapScopeAuditSha256, `scope_audit_hash_mismatch:${summary.recordId}`)
  validateHash(contribution?.machineReviewPath, contribution?.machineReviewSha256, `machine_review_hash_mismatch:${summary.recordId}`)
  validateHash(contribution?.ownerReviewPath, contribution?.ownerReviewSha256, `owner_review_hash_mismatch:${summary.recordId}`)
  validateHash(contribution?.sourceCapacityGapListPath, contribution?.sourceCapacityGapListSha256, `source_gap_list_hash_mismatch:${summary.recordId}`)
}

function validateHash(value, expected, message) {
  const filePath = resolveProjectPath(value)
  check(Boolean(value) && fs.existsSync(filePath), `file_missing:${value}`)
  if (value && fs.existsSync(filePath)) check(sha256(fs.readFileSync(filePath)) === expected, message)
}
function argumentValue(name) { const indexValue = process.argv.indexOf(name); return indexValue >= 0 ? process.argv[indexValue + 1] : null }
function readJson(value) { try { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) } catch { return null } }
function resolveProjectPath(value) { if (!value) return ROOT; const resolved = path.resolve(ROOT, value); if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project root: ${value}`); return resolved }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function check(condition, message) { if (!condition && !failures.includes(message)) failures.push(message) }
