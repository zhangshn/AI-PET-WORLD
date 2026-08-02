import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const LIBRARY_INDEX_PATH = "data/world-samples/original-image-library/natural-home-v1/index.json"
const OUTPUT_ROOT = ".runtime/ai-painter/pre-rebuild64-autonomous-original-failed-group-archives"
const REVIEW_SCRIPT = path.join(ROOT, "scripts", "record-ai-assisted-cold-start-owner-review.mjs")
const NEW_SERIES_ID = "thailand-rebuild64-20260731"
const NEW_REFERENCE_RECORD_ID = "ai-cold-start-v7-v7-capacity-slot-198-grassland-forest-transition-v3"
const OWNER_COMMAND_REF = "owner-command-move-all-pre-rebuild64-autonomous-originals-to-failed-20260731"
const createdAtUtc = new Date().toISOString()
const archiveId = `pre-rebuild64-autonomous-original-failed-archive-${createdAtUtc.replace(/[:.]/g, "-")}`

const initialIndex = readJson(LIBRARY_INDEX_PATH)
const initialAutonomousGroup = (initialIndex.records ?? []).filter(isAutonomousPageRecord)
const newSeriesRecords = initialAutonomousGroup.filter(isNewSeriesRecord)
const targets = initialAutonomousGroup.filter((record) => !isNewSeriesRecord(record))

assert(initialAutonomousGroup.length === 41, `expected 41 current autonomous-page records, found ${initialAutonomousGroup.length}`)
assert(newSeriesRecords.length === 1, `expected one new64 record, found ${newSeriesRecords.length}`)
assert(newSeriesRecords[0].recordId === NEW_REFERENCE_RECORD_ID, "the only new64 page record is not slot-198 V3")
assert(targets.length === 40, `expected 40 pre-rebuild64 records, found ${targets.length}`)
for (const target of targets) {
  assert(target.status !== "rejected", `${target.recordId} is already rejected and should not be on the autonomous page`)
  assert(
    target.reviews?.machineReviewStatus === "machine_contract_passed_waiting_owner_visual_review",
    `${target.recordId} cannot use the formal owner rejection path`,
  )
}

const newReferenceBefore = snapshotNewReference(newSeriesRecords[0])
const storedPlan = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: `${archiveId}-plan`,
  fileName: "archive-plan.json",
  record: {
    schemaVersion: "pre-rebuild64-autonomous-original-failed-archive-plan-v1",
    archiveId,
    status: "archive_plan_frozen_before_mutation",
    createdAtUtc,
    createdAtAsiaShanghai: formatShanghai(createdAtUtc),
    ownerCommandRef: OWNER_COMMAND_REF,
    ownerInstruction: "The autonomous-generation-training-originals page must show only the new64 cohort; preserve every older image and classify all older records under failed records.",
    scope: {
      autonomousPageRecordCountBefore: initialAutonomousGroup.length,
      oldTargetCount: targets.length,
      keptNewSeriesRecordCount: newSeriesRecords.length,
      keptNewReferenceRecordId: NEW_REFERENCE_RECORD_ID,
      deleteFiles: false,
      moveDirectories: false,
      preserveImages: true,
      preserveReviewHistory: true,
    },
    targets: targets.map((record) => ({
      recordId: record.recordId,
      statusBefore: record.status,
      ownerReviewStatusBefore: record.reviews?.ownerReviewStatus ?? null,
      sequenceNumberBefore: record.autonomousGenerationTrainingOriginal?.sequenceNumber ?? null,
      capacityContributionStatusBefore: record.v7CapacityContribution?.status ?? null,
    })),
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    automaticStorage: true,
  },
  latest: {
    archiveId,
    phase: "plan",
    targetRecordCount: targets.length,
    keptNewReferenceRecordId: NEW_REFERENCE_RECORD_ID,
    deletedImageCount: 0,
    gpuTrainingStarted: false,
  },
})

for (let index = 0; index < targets.length; index += 1) {
  const target = targets[index]
  execFileSync(process.execPath, [
    REVIEW_SCRIPT,
    "--record-id", target.recordId,
    "--category-id", "complete-maps",
    "--decision", "rejected",
    "--owner-command-ref", `${OWNER_COMMAND_REF}:${target.recordId}`,
    "--comment", "Old autonomous-training content has been superseded by the Thailand new64 rebuild. Preserve it as failed learning evidence and do not use it as a positive sample.",
    "--reason-codes", "owner_rejected_superseded_by_new64_rebuild",
    "--reason-codes-zh", "\u65e7\u81ea\u4e3b\u8bad\u7ec3\u5185\u5bb9\u5df2\u88ab\u6cf0\u56fd\u65b064\u7ec4\u91cd\u5efa\u53d6\u4ee3",
    "--affected-regions", "complete-map",
    "--next-training-target", "use_only_thailand_rebuild64_sequence_01_through_64_as_the_new_success_lane",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
  console.log(`[${index + 1}/${targets.length}] archived to failed group: ${target.recordId}`)
}

const finalIndex = readJson(LIBRARY_INDEX_PATH)
const targetIds = new Set(targets.map((record) => record.recordId))
const finalTargets = (finalIndex.records ?? []).filter((record) => targetIds.has(record.recordId))
const finalAutonomousGroup = (finalIndex.records ?? []).filter(isAutonomousPageRecord)
const issues = []
for (const target of finalTargets) {
  if (target.status !== "rejected") issues.push(`${target.recordId}:status_not_rejected`)
  if (target.trainingEligibility !== "owner_rejected") issues.push(`${target.recordId}:training_eligibility_not_owner_rejected`)
  if (target.aiAssistedColdStartEligible === true) issues.push(`${target.recordId}:positive_flag_still_true`)
  if (target.v7CapacityContribution?.status === "registered") issues.push(`${target.recordId}:capacity_still_registered`)
  const recordPath = resolveProjectPath(target.recordPath)
  const record = JSON.parse(fs.readFileSync(recordPath, "utf8"))
  const imagePath = path.resolve(path.dirname(recordPath), record.originalImage?.path ?? "")
  if (!record.originalImage?.path || !fs.existsSync(imagePath)) issues.push(`${target.recordId}:image_missing`)
}
assert(finalTargets.length === targets.length, "final target count changed")
assert(issues.length === 0, `archive verification failed: ${issues.join(", ")}`)
assert(finalAutonomousGroup.length === 1, `autonomous page still contains ${finalAutonomousGroup.length} records`)
assert(finalAutonomousGroup[0].recordId === NEW_REFERENCE_RECORD_ID, "autonomous page does not contain only the new slot-198 V3 record")
const newReferenceAfter = snapshotNewReference(finalAutonomousGroup[0])
assert(JSON.stringify(newReferenceAfter) === JSON.stringify(newReferenceBefore), "new slot-198 V3 state changed")

const completedAtUtc = new Date().toISOString()
const result = {
  schemaVersion: "pre-rebuild64-autonomous-original-failed-archive-result-v1",
  archiveId,
  status: "all_pre_rebuild64_autonomous_originals_preserved_and_classified_as_failed",
  createdAtUtc,
  completedAtUtc,
  completedAtAsiaShanghai: formatShanghai(completedAtUtc),
  ownerCommandRef: OWNER_COMMAND_REF,
  planPath: storedPlan.runPath,
  summary: {
    targetRecordCount: finalTargets.length,
    finalFailedRecordCount: finalTargets.filter((record) => record.status === "rejected").length,
    preservedImageCount: finalTargets.length,
    deletedImageCount: 0,
    movedDirectoryCount: 0,
    withdrawnRegisteredCapacityContributionCount: targets.filter((record) => record.v7CapacityContribution?.status === "registered").length,
    remainingAutonomousPageRecordCount: finalAutonomousGroup.length,
    remainingAutonomousPageRecordId: finalAutonomousGroup[0].recordId,
    newReferenceStatusUnchanged: true,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
  records: finalTargets.map((record) => ({
    recordId: record.recordId,
    status: record.status,
    trainingEligibility: record.trainingEligibility,
    ownerReviewStatus: record.reviews?.ownerReviewStatus ?? null,
    capacityContributionStatus: record.v7CapacityContribution?.status ?? null,
    recordPath: record.recordPath,
  })),
  automaticStorage: true,
}
const storedResult = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: `${archiveId}-completed`,
  fileName: "archive-result.json",
  record: result,
  latest: {
    archiveId,
    phase: "completed",
    targetRecordCount: result.summary.targetRecordCount,
    finalFailedRecordCount: result.summary.finalFailedRecordCount,
    preservedImageCount: result.summary.preservedImageCount,
    deletedImageCount: 0,
    remainingAutonomousPageRecordCount: 1,
    remainingAutonomousPageRecordId: NEW_REFERENCE_RECORD_ID,
    gpuTrainingStarted: false,
  },
})

appendAiPainterProgramEvent({
  timestamp: completedAtUtc,
  action: "archive_all_pre_rebuild64_autonomous_originals_to_failed_group",
  runId: archiveId,
  kind: "owner_authorized_training_data_reclassification",
  status: "success",
  title: "All pre-rebuild64 autonomous originals were preserved and moved to the failed group",
  titleZh: "\u65b064\u7ec4\u4e4b\u524d\u7684\u81ea\u4e3b\u8bad\u7ec3\u65e7\u539f\u56fe\u5df2\u5168\u90e8\u4fdd\u7559\u5e76\u5f52\u5165\u672a\u901a\u8fc7",
  detail: `targets=40; failed=40; preserved=40; deleted=0; autonomousPageRemaining=1:${NEW_REFERENCE_RECORD_ID}`,
  detailZh: `\u76ee\u6807=40\uff1b\u672a\u901a\u8fc7=40\uff1b\u4fdd\u7559\u539f\u56fe=40\uff1b\u5220\u9664=0\uff1b\u81ea\u4e3b\u8bad\u7ec3\u9875\u5269\u4f59=1`,
  script: "scripts/archive-pre-rebuild64-autonomous-originals-to-failed-group.mjs",
  currentStep: "pre_rebuild64_autonomous_original_failed_archive_complete",
  evidencePath: storedResult.runPath,
  evidence: [storedPlan.runPath, storedResult.runPath],
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  status: result.status,
  archiveId,
  resultPath: storedResult.runPath,
  summary: result.summary,
}, null, 2))

function isAutonomousPageRecord(record) {
  if (record.status === "rejected") return false
  return /^ai-cold-start-v7-v7-capacity-slot-\d{3}(?:-|$)/.test(record.recordId)
    || /^ai-cold-start-autonomy-autonomous-world-rebuild-\d{3}(?:-|$)/.test(record.recordId)
    || Boolean(record.autonomousGenerationTrainingOriginal?.sequenceNumber)
}
function isNewSeriesRecord(record) { return record.rebuild64Sequence?.seriesId === NEW_SERIES_ID }
function snapshotNewReference(record) {
  return {
    recordId: record.recordId,
    status: record.status,
    ownerReviewStatus: record.reviews?.ownerReviewStatus ?? null,
    trainingEligibility: record.trainingEligibility,
    sequenceCode: record.rebuild64Sequence?.sequenceCode ?? null,
    imageSha256: record.originalImage?.sha256 ?? null,
  }
}
function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`)
  assert(fs.existsSync(resolved), `file is missing: ${value}`)
  return resolved
}
function assert(condition, message) { if (!condition) throw new Error(message) }
