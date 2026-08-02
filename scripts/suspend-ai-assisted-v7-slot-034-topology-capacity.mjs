import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-v7-topology-capacity-suspensions"
const DIAGNOSIS_LATEST_PATH = ".runtime/ai-painter/ai-assisted-v7-qualified-topology-diagnostics/latest.json"
const CAPACITY_PLAN_LATEST_PATH = ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json"
const LIBRARY_INDEX_PATH = "data/world-samples/original-image-library/natural-home-v1/index.json"
const AUTHORIZATION_ID = "project-owner-authorized-slot-034-duplicate-topology-capacity-suspension-20260728"
const RETAINED_RECORD_ID = "ai-cold-start-condition-pair-007-riparian-tropical-forest-v3"
const SUSPENDED_RECORD_ID = "ai-cold-start-v7-v7-capacity-slot-034-riparian-tropical-forest-v1"
const SUSPENDED_SLOT_ID = "v7-capacity-slot-034"

const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId = `ai-assisted-v7-topology-capacity-suspension-${SUSPENDED_SLOT_ID}-${createdAtUtc.replace(/[:.]/g, "-")}`

const diagnosisLatest = readJson(DIAGNOSIS_LATEST_PATH)
const diagnosis = readJson(diagnosisLatest.runPath)
const capacityPlanLatest = readJson(CAPACITY_PLAN_LATEST_PATH)
const capacityPlan = readJson(capacityPlanLatest.capacityPlanPath)
const libraryIndex = readJson(LIBRARY_INDEX_PATH)
const retainedRecord = requiredRecord(libraryIndex, RETAINED_RECORD_ID)
const suspendedRecord = requiredRecord(libraryIndex, SUSPENDED_RECORD_ID)
const contributionPath = suspendedRecord.v7CapacityContribution?.contributionPath
const contribution = readJson(contributionPath)
const suspendedDiagnostic = diagnosis.diagnostics.find((entry) => entry.recordId === SUSPENDED_RECORD_ID)
const collision = suspendedDiagnostic?.matchedReferences?.find((entry) => entry.recordId === RETAINED_RECORD_ID)

assert(
  diagnosisLatest.status === "qualified_topology_findings_diagnosed_owner_decision_required",
  "qualified topology diagnosis is not waiting for an owner decision",
)
assert(diagnosisLatest.runId === diagnosis.runId, "qualified topology diagnosis pointer mismatch")
assert(diagnosis.summary?.currentQualifiedCollisionGroupCount === 1, "expected one current-qualified topology collision group")
assert(
  (diagnosis.summary?.currentQualifiedCollisionGroups ?? []).some(
    (group) => group.length === 2 && group.includes(RETAINED_RECORD_ID) && group.includes(SUSPENDED_RECORD_ID),
  ),
  "authorized collision group is missing from the diagnosis",
)
assert(collision?.macroTopologyDuplicate === true, "authorized records are not diagnosed as a macro-topology duplicate")
assert(collision?.referenceClass === "current_qualified_topology_collision", "diagnosed collision class mismatch")
assert(retainedRecord.status === "ai_assisted_cold_start_eligible", "retained record is not currently eligible")
assert(suspendedRecord.status === "ai_assisted_cold_start_eligible", "slot-034 record is not currently eligible")
assert(retainedRecord.reviews?.ownerReviewStatus === "owner_approved", "retained record owner review is not approved")
assert(suspendedRecord.reviews?.ownerReviewStatus === "owner_approved", "slot-034 owner review is not approved")
assert(new Date(retainedRecord.createdAtUtc) < new Date(suspendedRecord.createdAtUtc), "retained record is not the earlier record")
assert(contribution.recordId === SUSPENDED_RECORD_ID, "slot-034 contribution record mismatch")
assert(contribution.capacitySlotId === SUSPENDED_SLOT_ID, "slot-034 contribution identity mismatch")
assert(contribution.split === "train", "slot-034 contribution split mismatch")
assert(capacityPlan.auditSummary?.qualifiedExistingRecordCount === 41, "source capacity plan must contain 41 qualified records")
assert(capacityPlan.gapSummary?.requiredNewRecordCount === 23, "source capacity plan must contain a 23-record gap")

const report = {
  schemaVersion: "ai-assisted-v7-topology-capacity-suspension-v1",
  runId,
  status: "owner_suspended_duplicate_topology_capacity_contribution",
  createdAtUtc,
  createdAtAsiaShanghai,
  authorization: {
    authorizationId: AUTHORIZATION_ID,
    authorizedBy: "project_owner",
    decision: "retain condition-pair-007 and suspend slot-034 from current V7 capacity because both records share the same macro topology",
    decisionZh: "保留 condition-pair-007；因两条记录共享同一宏观拓扑，暂停 slot-034 的当前 V7 容量资格。",
  },
  sourceDiagnosis: {
    runId: diagnosis.runId,
    path: diagnosisLatest.runPath,
    sha256: fileSha256(diagnosisLatest.runPath),
    currentQualifiedCollisionGroupCount: diagnosis.summary.currentQualifiedCollisionGroupCount,
    diagnosticDistinctTopologyLowerBound: diagnosis.summary.diagnosticDistinctTopologyLowerBound,
  },
  sourceCapacityPlan: {
    runId: capacityPlan.runId,
    path: capacityPlanLatest.capacityPlanPath,
    sha256: fileSha256(capacityPlanLatest.capacityPlanPath),
    qualifiedExistingRecordCount: capacityPlan.auditSummary.qualifiedExistingRecordCount,
    requiredNewRecordCount: capacityPlan.gapSummary.requiredNewRecordCount,
  },
  retainedRecord: buildRecordEvidence(retainedRecord),
  suspendedRecord: {
    ...buildRecordEvidence(suspendedRecord),
    capacitySlotId: SUSPENDED_SLOT_ID,
    split: contribution.split,
    contributionPath,
    contributionSha256: fileSha256(contributionPath),
    previousCapacityContributionStatus: contribution.status,
    currentCapacityContributionAllowed: false,
    currentFormalV7TrainingEligible: false,
  },
  collisionEvidence: {
    macroTopologyDuplicate: collision.macroTopologyDuplicate,
    exactConditionGuideDuplicate: collision.exactConditionGuideDuplicate,
    topologyMetrics: collision.topologyMetrics,
    waterLayoutIntersection: collision.waterLayoutIntersection,
    routeLayoutIntersection: collision.routeLayoutIntersection,
    rgbExactOrNearDuplicate: collision.rgbExactOrNearDuplicate,
    rgbRejectedCompositionMatch: collision.rgbRejectedCompositionMatch,
  },
  reclassification: {
    qualifiedCountBefore: 41,
    qualifiedCountAfter: 40,
    requiredNewRecordCountBefore: 23,
    requiredNewRecordCountAfter: 24,
    suspendedRecordCount: 1,
    suspendedSplitCounts: { train: 1, validation: 0, challenge: 0, regression: 0 },
    historicalImageRetained: true,
    historicalMachineReviewRetained: true,
    historicalOwnerReviewRetained: true,
    historicalContributionRetained: true,
    recordModified: false,
    libraryIndexModified: false,
    replacementCapacitySlotIdentityAssigned: false,
  },
  executionBoundary: {
    imagesGenerated: 0,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    trainingStarted: false,
    runtimeStarted: false,
    worldPageChanged: false,
  },
  nextRequiredAction: "rebuild_dataset_package_then_capacity_plan_with_one_unassigned_replacement_gap",
  automaticStorage: true,
}

const written = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "suspension-report.json",
  record: report,
  latest: {
    updatedAtAsiaShanghai: createdAtAsiaShanghai,
    authorizationId: AUTHORIZATION_ID,
    retainedRecordId: RETAINED_RECORD_ID,
    suspendedRecordId: SUSPENDED_RECORD_ID,
    suspendedCapacitySlotId: SUSPENDED_SLOT_ID,
    suspendedRecordCount: 1,
    currentCapacityContributionAllowed: false,
    replacementCapacitySlotIdentityAssigned: false,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
})
const reportSha256 = fileSha256(written.runPath)

appendAiPainterProgramEvent({
  action: "suspend_ai_assisted_v7_duplicate_topology_capacity_contribution",
  runId,
  kind: "capacity_reclassification_completed",
  status: "success",
  stage: "ai_assisted_v7_duplicate_topology_capacity_suspended",
  title: "Slot-034 duplicate-topology V7 capacity eligibility suspended",
  titleZh: "slot-034 的重复拓扑 V7 容量资格已由程序暂停",
  titleEn: "The program suspended slot-034 duplicate-topology V7 capacity eligibility",
  detail: "Condition-pair-007 was retained. Slot-034 history was preserved but no longer counts toward current V7 capacity.",
  detailZh: "程序保留 condition-pair-007；slot-034 的原图、审核、哈希和贡献历史完整保留，但不再计入当前 V7 容量。",
  summaryZh: "当前合格容量预计由 41 降至 40，缺口由 23 增至 24。未生成图片，未启动 GPU 训练，也未分配新的替补槽位身份。",
  summaryEn: "Current qualified capacity is projected to decrease from 41 to 40 and the gap to increase from 23 to 24. No image was generated, GPU training did not start, and no new replacement slot identity was assigned.",
  evidencePath: written.runPath,
  evidenceSha256: reportSha256,
  evidence: [
    written.runPath,
    diagnosisLatest.runPath,
    retainedRecord.recordPath,
    suspendedRecord.recordPath,
    contributionPath,
  ],
})

console.log(JSON.stringify({
  status: report.status,
  runId,
  reportPath: written.runPath,
  reportSha256,
  retainedRecordId: RETAINED_RECORD_ID,
  suspendedRecordId: SUSPENDED_RECORD_ID,
  qualifiedCountBefore: 41,
  qualifiedCountAfter: 40,
  requiredNewRecordCountBefore: 23,
  requiredNewRecordCountAfter: 24,
  imagesGenerated: 0,
  gpuTrainingStarted: false,
}, null, 2))

function buildRecordEvidence(record) {
  const imagePath = `${record.relativeDirectory}/source/original.png`
  const machineReviewPath = record.reviews?.machineReviewPath
  const ownerReviewPath = record.reviews?.ownerReviewPath
  return {
    recordId: record.recordId,
    createdAtUtc: record.createdAtUtc,
    recordPath: record.recordPath,
    recordSha256: fileSha256(record.recordPath),
    imagePath,
    imageSha256: fileSha256(imagePath),
    conditionGuidePath: record.conditionBinding?.guidePath,
    conditionGuideSha256: fileSha256(record.conditionBinding?.guidePath),
    machineReviewPath,
    machineReviewSha256: fileSha256(machineReviewPath),
    ownerReviewPath,
    ownerReviewSha256: fileSha256(ownerReviewPath),
    machineReviewStatus: record.reviews?.machineReviewStatus,
    ownerReviewStatus: record.reviews?.ownerReviewStatus,
  }
}

function requiredRecord(index, recordId) {
  const record = (index.records ?? []).find((entry) => entry.recordId === recordId)
  assert(record, `original-image record missing: ${recordId}`)
  return record
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}

function fileSha256(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolveProjectPath(value))).digest("hex")
}

function resolveProjectPath(value) {
  assert(typeof value === "string" && value.length > 0, "required project path is missing")
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`)
  assert(fs.existsSync(resolved), `required file is missing: ${value}`)
  return resolved
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
