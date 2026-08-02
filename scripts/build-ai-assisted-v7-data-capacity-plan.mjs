import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  deriveThailandMvpLandscapeFromWindowFacts,
  THAILAND_MVP_SUPPORTED_LANDSCAPE_TYPES,
} from "./lib/real-earth-region-governance.mjs"

const ROOT = process.cwd()
const CONFIG_PATH = "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json"
const COVERAGE_BLUEPRINT_PATH = "data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json"
const DATASET_LATEST_PATH = "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json"
const RECLASSIFICATION_LATEST_PATH = ".runtime/ai-painter/ai-assisted-v7-capacity-reclassifications/latest.json"
const TOPOLOGY_SUSPENSION_LATEST_PATH = ".runtime/ai-painter/ai-assisted-v7-topology-capacity-suspensions/latest.json"
const FIXED_WINDOW_PLAN_LATEST_PATH = ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json"
const WITHDRAWN_OWNER_REJECTED_RECORD_PATH = "data/world-samples/original-image-library/natural-home-v1/complete-maps/ai-cold-start-v7-v7-capacity-slot-122-river-floodplain-v2/record.json"
const WITHDRAWN_OWNER_REJECTED_REPLACEMENT_AUTHORIZATION_ID = "owner-authorized-slot-122-withdrawal-unassigned-regression-replacement-gap-20260729"
const LEGACY_CONNECTIVITY_ISOLATION_LATEST_PATH = ".runtime/ai-painter/ai-assisted-v7-legacy-connectivity-capacity-isolations/latest.json"
const REBUILD64_FRAMEWORK_AUDIT_LATEST_PATH = ".runtime/ai-painter/earth-geospatial-v7-capacity-146-209-complete-framework-audits/latest.json"
const REBUILD64_DYNAMIC_READINESS_LATEST_PATH = ".runtime/ai-painter/thailand-rebuild64-full-world-dynamic-readiness-checks/latest.json"
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans"
const EXPECTED_WORLD_PROFILE = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"
const EXPECTED_MAP_SCOPE = "complete-natural-home-map"
const EXPECTED_CONDITION_CONTRACT = "complete-map-scope-world-facts-v2"
const REQUIRED_TOTAL = 64
const REQUIRED_SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }
const FIXED_SLOT_START = 110
const FIXED_SLOT_END = 145
const FORMAL_ENHANCEMENT_TOTAL = 128
const FORMAL_ENHANCEMENT_SPLITS = { train: 96, validation: 16, challenge: 8, regression: 8 }
const MIN_LANDSCAPE_COUNT = 3
const REQUIRED_SEASONS = [
  "wet_season",
  "wet_to_dry_transition",
  "dry_season",
  "dry_to_wet_transition",
]
const EXTRA_SEASON_PRIORITY = [
  "wet_to_dry_transition",
  "dry_to_wet_transition",
  "dry_season",
  "wet_season",
]

const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId = `ai-assisted-v7-data-capacity-plan-${createdAtUtc.replace(/[:.]/g, "-")}`
const runRoot = path.join(ROOT, OUTPUT_ROOT, runId)

const config = readJson(CONFIG_PATH)
const decision = config.training?.dataCapacityDecision
const coverageBlueprint = readJson(COVERAGE_BLUEPRINT_PATH)
const datasetLatest = readJson(DATASET_LATEST_PATH)
const sourceIndex = readJson(datasetLatest.sourceIndexPath)
const reclassificationLatest = readJson(RECLASSIFICATION_LATEST_PATH)
const reclassification = readJson(reclassificationLatest.runPath)
const topologySuspensionLatest = readJson(TOPOLOGY_SUSPENSION_LATEST_PATH)
const topologySuspension = readJson(topologySuspensionLatest.runPath)
const withdrawnOwnerRejectedRecord = readJson(WITHDRAWN_OWNER_REJECTED_RECORD_PATH)
const fixedWindowPlanLatest = readJson(FIXED_WINDOW_PLAN_LATEST_PATH)
const fixedWindowPlan = readJson(fixedWindowPlanLatest.runPath)
const fixedCapacityGapList = fixedWindowPlan.capacityGapListPath
  ? readJson(fixedWindowPlan.capacityGapListPath)
  : null
const landscapeTypes = (coverageBlueprint.regionalLandscapeTypes ?? []).map((entry) => entry.typeId)
const legacyConnectivityIsolationLatest =
  fs.existsSync(resolvePath(LEGACY_CONNECTIVITY_ISOLATION_LATEST_PATH))
    ? readJson(LEGACY_CONNECTIVITY_ISOLATION_LATEST_PATH)
    : null

if (
  legacyConnectivityIsolationLatest?.status ===
  "owner_isolated_legacy40_from_current_v7_training_capacity"
) {
  buildAuthorizedThailandMvp64RebuildPlan({
    isolationLatest: legacyConnectivityIsolationLatest,
    sourceWindowPlanLatest: fixedWindowPlanLatest,
  })
  process.exit(0)
}

assert(decision?.status === "owner_approved", "V7 data-capacity decision is not owner approved")
assert(decision?.purpose === "mvp_first_training_capacity", "V7 data-capacity decision purpose mismatch")
assert(decision?.totalCompleteMaps === REQUIRED_TOTAL, "V7 MVP data-capacity total must be 64")
assert(sameJson(decision?.splitCounts, REQUIRED_SPLITS), "V7 MVP split must be 48/8/4/4")
assert(decision?.formalEnhancementTarget?.totalCompleteMaps === FORMAL_ENHANCEMENT_TOTAL, "formal enhancement target must remain 128")
assert(sameJson(decision?.formalEnhancementTarget?.splitCounts, FORMAL_ENHANCEMENT_SPLITS), "formal enhancement split must remain 96/16/8/8")
assert(decision?.batchImageGenerationAuthorized === false, "MVP capacity decision must not authorize batch image generation")
assert(decision?.continuousBatchAuthorization?.authorizationId === "owner-authorized-v7-remaining-104-continuous-batch-20260723", "continuous batch authorization identity mismatch")
assert(decision?.continuousBatchAuthorization?.authorizedRecordCount === 104, "continuous batch authorization must cover the remaining 104 slots")
assert(decision?.continuousBatchAuthorization?.status === "stopped_by_owner_not_reusable", "historical continuous batch authorization must remain stopped")
assert(decision?.continuousBatchAuthorization?.executionMode === "sequential_one_active_generation_request", "continuous batch must remain strictly sequential")
assert(decision?.continuousBatchAuthorization?.ownerApprovalAutomatic === false, "continuous batch must not grant owner approval")
assert(decision?.continuousBatchAuthorization?.gpuTrainingAutomatic === false, "continuous batch must not start GPU training")
assert(decision?.gpuTrainingAuthorized === false, "GPU training must remain unauthorized")
assert(reclassificationLatest.status === "owner_suspended_transform_derived_capacity_contributions", "transform-derived capacity reclassification is missing")
assert(reclassification.authorization?.authorizationId === "owner-authorized-transform-derived-capacity-suspension-and-sakaerat-engineering-pretrain-20260724", "capacity reclassification authorization mismatch")
assert(reclassification.reclassification?.suspendedRecordCount === 17, "expected 17 suspended transform-derived records")
assert(reclassification.reclassification?.capacityContributionAllowed === false, "suspended records must not retain capacity eligibility")
assert(reclassification.reclassification?.formalV7TrainingEligible === false, "suspended records must not retain formal V7 training eligibility")
assert(topologySuspensionLatest.status === "owner_suspended_duplicate_topology_capacity_contribution", "duplicate-topology capacity suspension is missing")
assert(topologySuspension.authorization?.authorizationId === "project-owner-authorized-slot-034-duplicate-topology-capacity-suspension-20260728", "duplicate-topology capacity suspension authorization mismatch")
assert(topologySuspension.suspendedRecord?.recordId === "ai-cold-start-v7-v7-capacity-slot-034-riparian-tropical-forest-v1", "duplicate-topology suspended record mismatch")
assert(topologySuspension.suspendedRecord?.capacitySlotId === "v7-capacity-slot-034", "duplicate-topology suspended slot mismatch")
assert(topologySuspension.suspendedRecord?.currentCapacityContributionAllowed === false, "duplicate-topology record must not retain capacity eligibility")
assert(topologySuspension.reclassification?.suspendedRecordCount === 1, "expected one duplicate-topology suspended record")
assert(topologySuspension.reclassification?.replacementCapacitySlotIdentityAssigned === false, "replacement slot identity must remain unassigned without owner authorization")
assert(withdrawnOwnerRejectedRecord.recordId === "ai-cold-start-v7-v7-capacity-slot-122-river-floodplain-v2", "withdrawn owner-rejected record identity mismatch")
assert(withdrawnOwnerRejectedRecord.reviews?.ownerReviewStatus === "owner_rejected", "withdrawn capacity record must remain owner rejected")
assert(withdrawnOwnerRejectedRecord.v7CapacityContribution?.status === "withdrawn_owner_rejected", "slot-122 capacity contribution must remain withdrawn")
assert(withdrawnOwnerRejectedRecord.v7CapacityContribution?.capacitySlotId === "v7-capacity-slot-122", "withdrawn capacity slot identity mismatch")
assert(withdrawnOwnerRejectedRecord.v7CapacityContribution?.withdrawalReasonCodes?.includes("owner_rejected_duplicate_macro_structure") === true, "slot-122 withdrawal failure evidence mismatch")
assert(sameJson(coverageBlueprint.requiredStateFramework?.monsoonSeasons, REQUIRED_SEASONS), "monsoon season framework mismatch")
assert(coverageBlueprint.requiredStateFramework?.selectionMethod === "key_states_plus_pairwise_coverage_plus_unseen_challenge", "coverage selection method mismatch")
assert(coverageBlueprint.requiredStateFramework?.fullCartesianProductForbidden === true, "full Cartesian-product prohibition is missing")
assert(landscapeTypes.length === 20, "expected 20 approved regional landscape types")

const transformSuspendedRecordIds = new Set(reclassification.suspendedRecords.map((record) => record.recordId))
const topologySuspendedRecordIds = new Set([topologySuspension.suspendedRecord.recordId])
const suspendedRecordIds = new Set([...transformSuspendedRecordIds, ...topologySuspendedRecordIds])
const eligibleSourceRecords = (sourceIndex.samples ?? []).filter((sample) => sample.categoryId === "complete-maps"
  && sample.formalConditionalTrainingEligible === true
  && sample.conditionBound === true
  && (sample.currentConditionIdentityMatches === true || sample.v7CapacityContributionRegistered === true))
const suspendedHistoricalRecords = eligibleSourceRecords.filter((sample) => suspendedRecordIds.has(sample.recordId))
const transformSuspendedHistoricalRecords = eligibleSourceRecords.filter((sample) => transformSuspendedRecordIds.has(sample.recordId))
const topologySuspendedHistoricalRecords = eligibleSourceRecords.filter((sample) => topologySuspendedRecordIds.has(sample.recordId))
const currentRecords = eligibleSourceRecords.filter((sample) => !suspendedRecordIds.has(sample.recordId))
assert(transformSuspendedHistoricalRecords.length === 17, `expected 17 transform-suspended records in source index, received ${transformSuspendedHistoricalRecords.length}`)
assert(topologySuspendedHistoricalRecords.length === 1, `expected one topology-suspended record in source index, received ${topologySuspendedHistoricalRecords.length}`)
assert(suspendedHistoricalRecords.length === 18, `expected 18 total suspended records in source index, received ${suspendedHistoricalRecords.length}`)
const audits = currentRecords.map(auditExistingRecord)
const qualifiedRecords = audits.filter((audit) => audit.passed)
const failedAudits = audits.filter((audit) => !audit.passed)
assertUniqueQualifiedIdentities(qualifiedRecords)
const registeredV7SlotNumbers = qualifiedRecords
  .map((audit) => audit.record.v7CapacitySlotId)
  .filter(Boolean)
  .map(capacitySlotNumber)
  .sort((left, right) => left - right)
const qualifiedByCell = buildCellCounts(qualifiedRecords.map((audit) => audit.record))
const replacementGaps = [
  ...topologySuspendedHistoricalRecords.map((record) => createReplacementGap(record, topologySuspension)),
  createOwnerRejectedWithdrawalReplacementGap(withdrawnOwnerRejectedRecord),
]

const fixedSlotPlan = buildFixedAuthorizedSlotPlan({
  windowPlanLatest: fixedWindowPlanLatest,
  windowPlan: fixedWindowPlan,
  gapList: fixedCapacityGapList,
  qualifiedRecords,
  replacementGaps,
})
const plannedSlots = [...fixedSlotPlan.plannedSlots, ...replacementGaps]
assert(qualifiedRecords.length + plannedSlots.length === REQUIRED_TOTAL, "qualified records plus planned slots must total 64")
const targetCountsByLandscape = countBy(
  [
    ...qualifiedRecords.map((audit) => audit.record.classification?.regionalLandscapeType),
    ...plannedSlots.map((slot) => slot.regionalLandscapeType),
  ],
  (landscapeType) => landscapeType,
)
assert(landscapeTypes.every((landscapeType) => (targetCountsByLandscape[landscapeType] ?? 0) >= MIN_LANDSCAPE_COUNT), "fixed slot plan must retain at least three records per landscape")
assert(sum(Object.values(targetCountsByLandscape)) === REQUIRED_TOTAL, "fixed landscape target allocation must total 64")

const plannedSplitCounts = countBy(plannedSlots, (slot) => slot.split)
const existingSplitCounts = countBy(qualifiedRecords.map((audit) => audit.record), (record) => record.split)
const finalSplitCounts = Object.fromEntries(Object.keys(REQUIRED_SPLITS).map((split) => [
  split,
  (existingSplitCounts[split] ?? 0) + (plannedSplitCounts[split] ?? 0),
]))
assert(sameJson(finalSplitCounts, REQUIRED_SPLITS), "final planned split does not equal 48/8/4/4")

const coverageMatrix = buildCoverageMatrix({ qualifiedRecords, plannedSlots, qualifiedByCell })
const gapList = {
  schemaVersion: "ai-assisted-v7-data-capacity-gap-list-v1",
  runId,
  status: plannedSlots.length === 0 && failedAudits.length === 0 ? "capacity_complete" : "data_build_required",
  createdAtUtc,
  createdAtAsiaShanghai,
  approvedTargetCount: REQUIRED_TOTAL,
  formalEnhancementTargetCount: FORMAL_ENHANCEMENT_TOTAL,
  auditedSourceRecordCount: eligibleSourceRecords.length,
  qualifiedExistingRecordCount: qualifiedRecords.length,
  suspendedHistoricalRecordCount: suspendedHistoricalRecords.length,
  suspendedHistoricalRecords: suspendedHistoricalRecords.map((record) => ({
    recordId: record.recordId,
    capacitySlotId: record.v7CapacitySlotId,
    reason: topologySuspendedRecordIds.has(record.recordId)
      ? "duplicate_macro_topology_capacity_contribution_suspended"
      : "transform_derived_capacity_contribution_suspended",
  })),
  failedExistingAuditCount: failedAudits.length,
  requiredNewRecordCount: plannedSlots.length,
  splitDeficits: Object.fromEntries(Object.keys(REQUIRED_SPLITS).map((split) => [
    split,
    Math.max(0, REQUIRED_SPLITS[split] - (existingSplitCounts[split] ?? 0)),
  ])),
  missingSeasonCounts: Object.fromEntries(REQUIRED_SEASONS.map((season) => [
    season,
    plannedSlots.filter((slot) => slot.monsoonSeason === season).length,
  ])),
  failedAudits: failedAudits.map((audit) => ({ recordId: audit.recordId, issues: audit.issues })),
  fixedSlotIdentityAuthority: fixedSlotPlan.evidence,
  plannedSlots,
  gates: {
    automaticBatchGenerationAllowed: false,
    gpuTrainingAllowed: false,
    imageGenerationAllowedByThisPlan: false,
    ownerApprovalAutomatic: false,
    capacityContributionBeforeOwnerApproval: false,
    continuousBatchAuthorizationId: null,
    supersededContinuousBatchAuthorizationId: decision.continuousBatchAuthorization.authorizationId,
    nextRequiredAction: "owner_review_mvp_64_capacity_plan_before_any_bounded_data_build",
  },
}

const capacityPlan = {
  schemaVersion: "ai-assisted-v7-data-capacity-plan-v1",
  runId,
  status: gapList.status === "capacity_complete"
    ? "capacity_complete_waiting_owner_training_authorization"
    : "blocked_pending_owner_approved_mvp_64_dataset_implementation",
  createdAtUtc,
  createdAtAsiaShanghai,
  decisionId: decision.decisionId,
  decisionPath: CONFIG_PATH,
  decisionSha256: fileSha256(CONFIG_PATH),
  coverageBlueprintId: coverageBlueprint.blueprintId,
  coverageBlueprintPath: COVERAGE_BLUEPRINT_PATH,
  coverageBlueprintSha256: fileSha256(COVERAGE_BLUEPRINT_PATH),
  sourcePackageId: datasetLatest.packageId,
  sourceIndexPath: datasetLatest.sourceIndexPath,
  sourceIndexSha256: fileSha256(datasetLatest.sourceIndexPath),
  fixedSlotIdentityAuthority: fixedSlotPlan.evidence,
  capacityReclassification: {
    runId: reclassification.runId,
    path: reclassificationLatest.runPath,
    sha256: fileSha256(reclassificationLatest.runPath),
    suspendedHistoricalRecordCount: suspendedHistoricalRecords.length,
    transformSuspendedHistoricalRecordCount: transformSuspendedHistoricalRecords.length,
    topologySuspendedHistoricalRecordCount: topologySuspendedHistoricalRecords.length,
    suspendedRecordIds: [...suspendedRecordIds].sort(),
  },
  topologyCapacitySuspension: {
    runId: topologySuspension.runId,
    path: topologySuspensionLatest.runPath,
    sha256: fileSha256(topologySuspensionLatest.runPath),
    authorizationId: topologySuspension.authorization.authorizationId,
    retainedRecordId: topologySuspension.retainedRecord.recordId,
    suspendedRecordId: topologySuspension.suspendedRecord.recordId,
    suspendedCapacitySlotId: topologySuspension.suspendedRecord.capacitySlotId,
    replacementCapacitySlotIdentityAssigned: false,
  },
  ownerRejectedCapacityWithdrawal: {
    authorizationId: WITHDRAWN_OWNER_REJECTED_REPLACEMENT_AUTHORIZATION_ID,
    recordId: withdrawnOwnerRejectedRecord.recordId,
    capacitySlotId: withdrawnOwnerRejectedRecord.v7CapacityContribution.capacitySlotId,
    recordPath: WITHDRAWN_OWNER_REJECTED_RECORD_PATH,
    recordSha256: fileSha256(WITHDRAWN_OWNER_REJECTED_RECORD_PATH),
    ownerReviewPath: withdrawnOwnerRejectedRecord.reviews.ownerReviewPath,
    ownerReviewSha256: fileSha256(withdrawnOwnerRejectedRecord.reviews.ownerReviewPath),
    contributionPath: withdrawnOwnerRejectedRecord.v7CapacityContribution.contributionPath,
    contributionSha256: fileSha256(withdrawnOwnerRejectedRecord.v7CapacityContribution.contributionPath),
    replacementCapacitySlotIdentityAssigned: false,
    authorizedReplacementSplit: "regression",
  },
  approvedCapacity: {
    purpose: "mvp_first_training_capacity",
    total: REQUIRED_TOTAL,
    splitCounts: REQUIRED_SPLITS,
    regionalLandscapeTypeCount: landscapeTypes.length,
    monsoonSeasonFramework: REQUIRED_SEASONS,
    selectionMethod: coverageBlueprint.requiredStateFramework.selectionMethod,
    fullCartesianProductForbidden: true,
    allocationRule: "at least three trusted complete maps per approved landscape type, retain all stronger existing coverage, then distribute a bounded structural-diversity reserve to total 64; no full product across all world axes",
  },
  formalEnhancementTarget: {
    status: decision.formalEnhancementTarget.status,
    total: FORMAL_ENHANCEMENT_TOTAL,
    splitCounts: FORMAL_ENHANCEMENT_SPLITS,
    currentFirstTrainingGate: false,
  },
  auditSummary: {
    auditedSourceRecordCount: eligibleSourceRecords.length,
    qualifiedExistingRecordCount: qualifiedRecords.length,
    failedExistingAuditCount: failedAudits.length,
    suspendedHistoricalRecordCount: suspendedHistoricalRecords.length,
    uniqueQualifiedImageCount: new Set(qualifiedRecords.map((audit) => audit.record.imageSha256)).size,
    uniqueQualifiedConditionCount: new Set(qualifiedRecords.map((audit) => audit.record.conditionLabel)).size,
    registeredV7CapacityContributionCount: registeredV7SlotNumbers.length,
    nextCapacitySlotId: plannedSlots[0]?.slotId ?? null,
    existingSplitCounts,
  },
  gapSummary: {
    requiredNewRecordCount: plannedSlots.length,
    plannedSplitCounts,
    finalSplitCounts,
    currentSeasonCounts: countBy(qualifiedRecords.map((audit) => audit.record), (record) => record.classification?.monsoonSeason),
    plannedSeasonCounts: countBy(plannedSlots, (slot) => slot.monsoonSeason),
  },
  evidenceFiles: {
    coverageMatrixPath: `${OUTPUT_ROOT}/${runId}/coverage-matrix.json`,
    gapListPath: `${OUTPUT_ROOT}/${runId}/gap-list.json`,
  },
  executionBoundary: {
    imagesGenerated: 0,
    gpuTrainingStarted: false,
    trainingStarted: false,
    existingRecordsModified: false,
    suspendedHistoryDeleted: false,
    runtimeEligibilityGranted: false,
    formalInferenceEligibilityGranted: false,
  },
  automaticStorage: true,
}

writeIndexedJson(path.join(runRoot, "coverage-matrix.json"), coverageMatrix)
writeIndexedJson(path.join(runRoot, "gap-list.json"), gapList)
capacityPlan.evidenceFiles.coverageMatrixSha256 = fileSha256(capacityPlan.evidenceFiles.coverageMatrixPath)
capacityPlan.evidenceFiles.gapListSha256 = fileSha256(capacityPlan.evidenceFiles.gapListPath)
writeIndexedJson(path.join(runRoot, "capacity-plan.json"), capacityPlan)
const capacityPlanPath = `${OUTPUT_ROOT}/${runId}/capacity-plan.json`
const capacityPlanSha256 = fileSha256(capacityPlanPath)
writeIndexedJson(path.join(ROOT, OUTPUT_ROOT, "latest.json"), {
  schemaVersion: "ai-assisted-v7-data-capacity-plan-latest-v1",
  runId,
  status: capacityPlan.status,
  updatedAtUtc: createdAtUtc,
  updatedAtAsiaShanghai: createdAtAsiaShanghai,
  capacityPlanPath,
  capacityPlanSha256,
  coverageMatrixPath: capacityPlan.evidenceFiles.coverageMatrixPath,
  coverageMatrixSha256: capacityPlan.evidenceFiles.coverageMatrixSha256,
  gapListPath: capacityPlan.evidenceFiles.gapListPath,
  gapListSha256: capacityPlan.evidenceFiles.gapListSha256,
  auditedSourceRecordCount: eligibleSourceRecords.length,
  qualifiedExistingRecordCount: qualifiedRecords.length,
  suspendedHistoricalRecordCount: suspendedHistoricalRecords.length,
  requiredNewRecordCount: plannedSlots.length,
  finalSplitCounts,
})

appendAiPainterProgramEvent({
  action: "build_ai_assisted_v7_data_capacity_plan",
  runId,
  kind: capacityPlan.status.startsWith("blocked_") ? "step_blocked" : "step_completed",
  status: capacityPlan.status.startsWith("blocked_") ? "blocked" : "success",
  stage: "ai_assisted_v7_data_capacity_plan_built",
  title: "V7 64-map MVP capacity matrix and gap list built",
  titleZh: "V7 的 64 张 MVP 完整地图容量矩阵与缺口清单已由程序生成",
  titleEn: "The V7 64-complete-map MVP capacity matrix and gap list were built by the program",
  detail: `Qualified ${qualifiedRecords.length} trusted complete maps; ${plannedSlots.length} records are still required. No image generation or GPU training was started.`,
  detailZh: `程序确认 ${qualifiedRecords.length} 张可信完整地图，仍缺 ${plannedSlots.length} 张；本轮未生成图片，未启动 GPU 训练。`,
  summaryZh: `程序审计 ${eligibleSourceRecords.length} 条既有候选容量记录，隔离 ${suspendedHistoricalRecords.length} 条变换派生历史记录，确认 ${qualifiedRecords.length} 条可信完整地图；MVP 首次训练容量仍缺 ${plannedSlots.length} 条。128 张保留为后续增强目标。本轮未生成图片，未启动 GPU 训练。`,
  summaryEn: `The program audited ${eligibleSourceRecords.length} existing candidate capacity records, suspended ${suspendedHistoricalRecords.length} transform-derived historical records, and qualified ${qualifiedRecords.length} trusted complete maps; ${plannedSlots.length} records are still required for the MVP first-training capacity. The 128-map target remains a later enhancement target. No image generation or GPU training was started.`,
  evidencePath: `${OUTPUT_ROOT}/${runId}/capacity-plan.json`,
  evidence: [
    `${OUTPUT_ROOT}/${runId}/capacity-plan.json`,
    `${OUTPUT_ROOT}/${runId}/coverage-matrix.json`,
    `${OUTPUT_ROOT}/${runId}/gap-list.json`,
  ],
  errorCode: capacityPlan.status.startsWith("blocked_") ? "v7_mvp_data_capacity_64_not_yet_complete" : null,
})

console.log(JSON.stringify({
  status: capacityPlan.status,
  runId,
  capacityPlanPath: `${OUTPUT_ROOT}/${runId}/capacity-plan.json`,
  auditedSourceRecordCount: eligibleSourceRecords.length,
  qualifiedExistingRecordCount: qualifiedRecords.length,
  suspendedHistoricalRecordCount: suspendedHistoricalRecords.length,
  failedExistingAuditCount: failedAudits.length,
  requiredNewRecordCount: plannedSlots.length,
  existingSplitCounts,
  plannedSplitCounts,
  finalSplitCounts,
  currentSeasonCounts: capacityPlan.gapSummary.currentSeasonCounts,
  plannedSeasonCounts: capacityPlan.gapSummary.plannedSeasonCounts,
  imagesGenerated: 0,
  gpuTrainingStarted: false,
  trainingStarted: false,
}, null, 2))

function auditExistingRecord(record) {
  const issues = []
  check(record.width === 1024 && record.height === 768, "resolution_not_native_1024x768")
  check(record.worldProfileId === EXPECTED_WORLD_PROFILE, "world_profile_mismatch")
  check(record.classification?.mapScope === EXPECTED_MAP_SCOPE, "complete_map_scope_missing")
  check(landscapeTypes.includes(record.classification?.regionalLandscapeType), "landscape_type_not_approved")
  check(REQUIRED_SEASONS.includes(record.classification?.monsoonSeason), "monsoon_season_not_approved")
  check(record.ownerReviewStatus === "owner_approved", "source_index_owner_review_not_approved")
  check(record.machineReviewStatus === "passed", "source_index_machine_review_not_passed")
  check(record.conditionGenerationContractVersion === EXPECTED_CONDITION_CONTRACT, "condition_contract_mismatch")
  check(record.currentConditionIdentityMatches === true || record.v7CapacityContributionRegistered === true, "condition_identity_mismatch")
  check(record.conditionBound === true && record.formalConditionalTrainingEligible === true, "formal_condition_binding_missing")
  if (record.v7CapacityContributionRegistered === true) {
    check(/^v7-capacity-slot-\d{3}$/.test(record.v7CapacitySlotId ?? ""), "v7_capacity_slot_invalid")
    check(/^v7-complete-map-\d{3}$/.test(record.conditionLabel ?? ""), "v7_condition_label_invalid")
    check(typeof record.v7CapacityContributionPath === "string" && fs.existsSync(resolvePath(record.v7CapacityContributionPath)), "v7_capacity_contribution_missing")
    if (typeof record.v7CapacityContributionPath === "string" && fs.existsSync(resolvePath(record.v7CapacityContributionPath))) {
      check(fileSha256(record.v7CapacityContributionPath) === record.v7CapacityContributionSha256, "v7_capacity_contribution_sha256_mismatch")
      const contribution = readJson(record.v7CapacityContributionPath)
      check(contribution.recordId === record.recordId, "v7_capacity_contribution_record_mismatch")
      check(contribution.capacitySlotId === record.v7CapacitySlotId, "v7_capacity_contribution_slot_mismatch")
      check(contribution.split === record.split, "v7_capacity_contribution_split_mismatch")
      check(contribution.imageSha256 === record.imageSha256, "v7_capacity_contribution_image_mismatch")
      check(contribution.conditionWorldId === record.conditionWorldId, "v7_capacity_contribution_world_mismatch")
      check(contribution.taskPackageId === record.taskPackageId, "v7_capacity_contribution_task_mismatch")
      check(contribution.conditionLabel === record.conditionLabel, "v7_capacity_contribution_condition_label_mismatch")
    }
  }

  const requiredFiles = [
    [record.imagePath, record.imageSha256, "image"],
    [record.sourceRecordPath, record.sourceRecordSha256, "source_record"],
    [record.machineReviewPath, record.machineReviewSha256, "machine_review"],
    [record.ownerReviewPath, record.ownerReviewSha256, "owner_review"],
    [record.conditionPackPath, null, "condition_pack"],
  ]
  for (const [filePath, expectedSha256, label] of requiredFiles) {
    check(typeof filePath === "string" && fs.existsSync(resolvePath(filePath)), `${label}_missing`)
    if (typeof filePath === "string" && fs.existsSync(resolvePath(filePath)) && expectedSha256) {
      check(fileSha256(filePath) === expectedSha256, `${label}_sha256_mismatch`)
    }
  }

  if (fs.existsSync(resolvePath(record.machineReviewPath))) {
    const machineReview = readJson(record.machineReviewPath)
    check(machineReview.passed === true, "machine_review_failed")
    check(machineReview.imageSha256 === record.imageSha256, "machine_review_image_identity_mismatch")
    check(machineReview.styleFingerprintAudit?.passed === true, "style_fingerprint_audit_failed")
    check(machineReview.compositionNoveltyAudit?.passed === true, "composition_novelty_audit_failed")
    check(machineReview.semanticConditionAudit?.passed === true, "semantic_condition_audit_failed")
  }
  if (fs.existsSync(resolvePath(record.ownerReviewPath))) {
    const ownerReview = readJson(record.ownerReviewPath)
    check(ownerReview.decision === "owner_approved", "owner_review_not_approved")
    check(ownerReview.imageSha256 === record.imageSha256, "owner_review_image_identity_mismatch")
  }
  if (fs.existsSync(resolvePath(record.conditionPackPath))) {
    const conditionPack = readJson(record.conditionPackPath)
    check(conditionPack.status === "compiled_conditions_ready", "condition_pack_not_ready")
    check(conditionPack.channels?.length === 23, "condition_pack_channel_count_not_23")
    check(conditionPack.canvas?.width === 1024 && conditionPack.canvas?.height === 768, "condition_canvas_not_1024x768")
    check(conditionPack.canvas?.frameScope === "complete_runtime_frame", "condition_frame_scope_not_complete_runtime_frame")
    check(conditionPack.worldId === record.conditionWorldId, "condition_world_identity_mismatch")
    for (const channel of conditionPack.channels ?? []) {
      check(typeof channel.path === "string" && fs.existsSync(resolvePath(channel.path)), `condition_channel_missing:${channel.channelId ?? "unknown"}`)
      if (channel.sha256 && fs.existsSync(resolvePath(channel.path))) {
        check(fileSha256(channel.path) === channel.sha256, `condition_channel_sha256_mismatch:${channel.channelId ?? "unknown"}`)
      }
    }
  }

  return {
    recordId: record.recordId,
    passed: issues.length === 0,
    issues,
    record,
  }

  function check(condition, issue) {
    if (!condition) issues.push(issue)
  }
}

function buildAuthorizedThailandMvp64RebuildPlan({
  isolationLatest,
  sourceWindowPlanLatest,
}) {
  const isolation = readJson(isolationLatest.runPath)
  assert(
    isolation.authorization?.authorizationId ===
      "owner-authorized-isolate-legacy40-and-rebuild-thailand-mvp64-20260729",
    "legacy40 isolation and rebuild64 authorization mismatch",
  )
  assert(
    isolation.isolation?.isolatedRecordCount === 40 &&
      isolation.replacementPlan?.requiredCompliantRecordCount === 64,
    "authorized rebuild scope must isolate 40 and create 64 compliant records",
  )
  const completedSamples = (sourceIndex.samples ?? [])
    .filter((sample) => {
      if (sample.categoryId !== "complete-maps") return false
      if (sample.v7CapacityContributionRegistered !== true) return false
      const slotNumber = capacitySlotNumber(sample.v7CapacitySlotId)
      return slotNumber >= 146 && slotNumber <= 209
    })
    .sort((left, right) => capacitySlotNumber(left.v7CapacitySlotId) - capacitySlotNumber(right.v7CapacitySlotId))
  if (completedSamples.length === 64) {
    buildCompletedThailandMvp64CapacityPlan({
      isolation,
      isolationLatest,
      completedSamples,
    })
    return
  }
  const sourceWindowPlan = readJson(sourceWindowPlanLatest.runPath)
  const candidateWindowsPath =
    sourceWindowPlanLatest.candidateWindowsPath ??
    sourceWindowPlan.candidateWindowsPath
  const candidateCatalog = readJson(candidateWindowsPath)
  const candidates = candidateCatalog.candidates ?? []
  assert(candidates.length >= 64, "Thailand MVP candidate catalog has fewer than 64 windows")
  const selectedWindows = selectDiverseNonOverlappingWindows(candidates, 64)
  assert(selectedWindows.length === 64, "Thailand MVP rebuild must select 64 windows")
  assert(
    new Set(selectedWindows.map((entry) => entry.candidateId)).size === 64 &&
      new Set(selectedWindows.map((entry) => entry.fingerprints?.direct)).size === 64 &&
      new Set(selectedWindows.map((entry) => entry.fingerprints?.transformCanonical)).size === 64,
    "selected Thailand windows must have unique direct and transform-canonical identities",
  )

  const splitSequence = [
    ...Array(48).fill("train"),
    ...Array(8).fill("validation"),
    ...Array(4).fill("challenge"),
    ...Array(4).fill("regression"),
  ]
  const splitOffsets = { train: 0, validation: 0, challenge: 0, regression: 0 }
  const seasons = [
    "wet_season",
    "wet_to_dry_transition",
    "dry_season",
    "dry_to_wet_transition",
  ]
  const assignments = selectedWindows.map((window, index) => {
    const split = splitSequence[index]
    const splitIndex = splitOffsets[split]++
    const assignment = {
      slotId: `v7-capacity-slot-${String(146 + index).padStart(3, "0")}`,
      split,
      monsoonSeason: seasons[splitIndex % seasons.length],
      measurementWindowId: window.candidateId,
      measurementBounds: window.measurementBounds,
      sourcePixelWindow: window.sourcePixelWindow,
      measurementMetrics: window.metrics,
      measurementFingerprints: window.fingerprints,
      landscapeAssignmentByQuotaForbidden: true,
      sourceScope:
        "thailand_sakaerat_wang_nam_khiao_mvp_only",
      realEarthRegionSourcePackageRequired: true,
      independentRegionConnectivityRequired: true,
      themeArchitectureIdentityRequired: true,
      instanceDetailIdentityRequired: true,
      conditionPackagePreparationAuthorized: true,
      imageGenerationAuthorized: false,
      gpuTrainingAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
    }
    return {
      ...assignment,
      ...deriveThailandMvpLandscapeFromWindowFacts({
        assignment,
      }),
    }
  })
  const windowRunId =
    `earth-geospatial-v7-mvp-window-plan-rebuild64-` +
    createdAtUtc.replace(/[:.]/g, "-")
  const windowRoot = path.join(
    ROOT,
    ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans",
    windowRunId,
  )
  const windowPlan = {
    schemaVersion:
      "earth-geospatial-v7-mvp-window-plan-rebuild64-v2",
    runId: windowRunId,
    status:
      "authorized_rebuild64_world_facts_derived_condition_preparation_ready",
    createdAtUtc,
    createdAtAsiaShanghai,
    authorizationId:
      isolation.authorization.authorizationId,
    isolationRunId: isolation.runId,
    isolationPath: isolationLatest.runPath,
    isolationSha256: fileSha256(isolationLatest.runPath),
    contractId:
      "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1",
    candidateWindowsPath,
    candidateWindowsSha256: fileSha256(candidateWindowsPath),
    selectionMethod:
      "deterministic_farthest_point_across_grid_terrain_landcover_and_removal_metrics",
    counts: {
      availableCandidateCount: candidates.length,
      selectedWindowCount: assignments.length,
      supportedLandscapeTypeCount:
        THAILAND_MVP_SUPPORTED_LANDSCAPE_TYPES.length,
      uniqueDirectFingerprintCount:
        new Set(assignments.map((entry) => entry.measurementFingerprints.direct)).size,
      uniqueTransformCanonicalFingerprintCount:
        new Set(assignments.map((entry) => entry.measurementFingerprints.transformCanonical)).size,
      overlappingSelectedWindowPairCount: countOverlappingPairs(assignments),
    },
    assignments,
    outputBoundary: {
      perWindowWorldFactDerivationRequired: false,
      perWindowWorldFactDerivationCompleted: true,
      regionalLandscapeTypeMayNotBeAssignedByQuota: true,
      exactRealWorldGeometryCarriedForward: false,
      historicalRgbRead: false,
      imageGenerationStarted: false,
      rgbCreated: false,
      gpuTrainingStarted: false,
    },
    nextRequiredAction:
      "build_and_independently_audit_each_no_rgb_condition_package_in_slot_order",
  }
  assert(
    windowPlan.counts.overlappingSelectedWindowPairCount === 0,
    "selected rebuild windows overlap",
  )
  const windowPlanPath = path.join(windowRoot, "window-plan.json")
  writeIndexedJson(windowPlanPath, windowPlan)
  const windowPlanLogicalPath = logicalProjectPath(windowPlanPath)
  const windowPlanSha256 = fileSha256(windowPlanPath)
  writeJsonAtomic(
    path.join(
      ROOT,
      ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json",
    ),
    {
      schemaVersion:
        "earth-geospatial-v7-mvp-window-plan-v2-latest-pointer",
      runId: windowRunId,
      status: windowPlan.status,
      updatedAtUtc: createdAtUtc,
      runPath: windowPlanLogicalPath,
      contractId: windowPlan.contractId,
      authorizationId: windowPlan.authorizationId,
      candidateWindowsPath,
      candidateWindowsSha256: windowPlan.candidateWindowsSha256,
      selectedWindowCount: assignments.length,
      firstSlotId: assignments[0].slotId,
      lastSlotId: assignments.at(-1).slotId,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  )

  const gapList = {
    schemaVersion:
      "ai-assisted-v7-data-capacity-gap-list-v2",
    runId,
    status:
      "authorized_rebuild64_world_facts_derived_condition_preparation_ready",
    authorizationId: windowPlan.authorizationId,
    legacyHistoricalQualifiedCount: 40,
    structurallyReverifiedTrainingTruthCount: 0,
    requiredCompliantRecordCount: 64,
    splitCounts: REQUIRED_SPLITS,
    plannedSlots: assignments,
  }
  const capacityPlan = {
    schemaVersion: "ai-assisted-v7-data-capacity-plan-v2",
    runId,
    status:
      "authorized_rebuild64_world_facts_derived_condition_preparation_ready",
    createdAtUtc,
    createdAtAsiaShanghai,
    decisionId:
      "owner-approved-v7-mvp-first-training-capacity-64-20260725",
    authorizationId: windowPlan.authorizationId,
    isolation: {
      runId: isolation.runId,
      path: isolationLatest.runPath,
      sha256: fileSha256(isolationLatest.runPath),
      isolatedHistoricalRecordCount: 40,
    },
    sourceScope: {
      region:
        "Thailand / Sakaerat-Wang Nam Khiao / MVP only",
      candidateWindowsPath,
      candidateWindowsSha256:
        windowPlan.candidateWindowsSha256,
      selectedWindowPlanPath: windowPlanLogicalPath,
      selectedWindowPlanSha256: windowPlanSha256,
      automaticOtherCountryAcquisitionAllowed: false,
    },
    auditSummary: {
      legacyHistoricalQualifiedCount: 40,
      structurallyReverifiedTrainingTruthCount: 0,
      isolatedHistoricalRecordCount: 40,
      currentCompliantRecordCount: 0,
      requiredNewRecordCount: 64,
    },
    gapSummary: {
      requiredNewRecordCount: 64,
      plannedSlotCount: assignments.length,
      plannedSplitCounts: REQUIRED_SPLITS,
      firstPlannedSlotId: assignments[0].slotId,
      lastPlannedSlotId: assignments.at(-1).slotId,
    },
    gates: {
      perWindowWorldFactDerivationRequired: false,
      perWindowWorldFactDerivationCompleted: true,
      activeThailandMvpLandscapeTypes:
        THAILAND_MVP_SUPPORTED_LANDSCAPE_TYPES,
      realEarthRegionSourcePackageRequired: true,
      independentRegionConnectivityRequired: true,
      regionWorldGraphConnectionRequired: true,
      themeArchitectureIdentityRequired: true,
      instanceDetailIdentityRequired: true,
      fullHistoryConditionAndRgbAuditRequired: true,
      batchRgbAuthorized: false,
      gpuTrainingAuthorized: false,
    },
    executionBoundary: {
      conditionPackagesBuilt: 0,
      imagesGenerated: 0,
      gpuTrainingStarted: false,
      trainingStarted: false,
      runtimeFrameCreated: false,
      worldEntryStarted: false,
    },
  }
  const gapListPath = path.join(runRoot, "capacity-gap-list.json")
  const capacityPlanPath = path.join(runRoot, "capacity-plan.json")
  writeIndexedJson(gapListPath, gapList)
  writeIndexedJson(capacityPlanPath, capacityPlan)
  const capacityPlanLogicalPath = logicalProjectPath(capacityPlanPath)
  const gapListLogicalPath = logicalProjectPath(gapListPath)
  writeJsonAtomic(path.join(ROOT, OUTPUT_ROOT, "latest.json"), {
    schemaVersion:
      "ai-assisted-v7-data-capacity-plan-latest-v2",
    runId,
    status: capacityPlan.status,
    updatedAtUtc: createdAtUtc,
    capacityPlanPath: capacityPlanLogicalPath,
    capacityPlanSha256: fileSha256(capacityPlanPath),
    gapListPath: gapListLogicalPath,
    gapListSha256: fileSha256(gapListPath),
    qualifiedExistingRecordCount: 0,
    legacyHistoricalQualifiedCount: 40,
    requiredNewRecordCount: 64,
    plannedSlotCount: 64,
    firstPlannedSlotId: assignments[0].slotId,
    lastPlannedSlotId: assignments.at(-1).slotId,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  })
  appendAiPainterProgramEvent({
    action: "build_ai_assisted_v7_rebuild64_capacity_plan",
    runId,
    kind: "capacity_plan_completed",
    status: "success",
    stage: "authorized_rebuild64_world_facts_derived_condition_preparation_ready",
    title:
      "A new 64-record Thailand MVP V7 capacity rebuild plan was created",
    titleZh:
      "新的泰国MVP V7六十四条容量重建计划已建立",
    detail:
      "The plan uses 64 non-overlapping measured windows and slots 146 through 209. Landscape identities were derived from current window facts inside the owner-approved Thailand MVP subset. No RGB or GPU training was started.",
    detailZh:
      "计划使用64个互不重叠测量窗口和146至209槽位；生态身份已从逐窗事实派生，本轮未生成RGB、未启动GPU训练。",
    evidencePath: capacityPlanLogicalPath,
    evidence: [
      capacityPlanLogicalPath,
      gapListLogicalPath,
      windowPlanLogicalPath,
      isolationLatest.runPath,
    ],
  })
  console.log(JSON.stringify({
    runId,
    status: capacityPlan.status,
    capacityPlanPath: capacityPlanLogicalPath,
    capacityPlanSha256: fileSha256(capacityPlanPath),
    windowPlanPath: windowPlanLogicalPath,
    windowPlanSha256,
    selectedWindowCount: assignments.length,
    overlappingSelectedWindowPairCount:
      windowPlan.counts.overlappingSelectedWindowPairCount,
    firstPlannedSlotId: assignments[0].slotId,
    lastPlannedSlotId: assignments.at(-1).slotId,
    splitCounts: REQUIRED_SPLITS,
    currentCompliantRecordCount: 0,
    requiredNewRecordCount: 64,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
  }, null, 2))
}

function buildCompletedThailandMvp64CapacityPlan({ isolation, isolationLatest, completedSamples }) {
  const expectedSlotIds = Array.from({ length: 64 }, (_, index) => `v7-capacity-slot-${146 + index}`)
  assert(sameJson(completedSamples.map((sample) => sample.v7CapacitySlotId), expectedSlotIds), "completed rebuild64 slots are not exactly 146 through 209")
  assert(new Set(completedSamples.map((sample) => sample.recordId)).size === 64, "completed rebuild64 record identities are not unique")
  assert(new Set(completedSamples.map((sample) => sample.conditionWorldId)).size === 64, "completed rebuild64 condition world identities are not unique")
  assert(new Set(completedSamples.map((sample) => sample.structuralIdentities?.themeArchitectureIdentity)).size === 64, "completed rebuild64 theme architecture identities are not unique")
  assert(new Set(completedSamples.map((sample) => sample.structuralIdentities?.instanceDetailIdentity)).size === 64, "completed rebuild64 instance detail identities are not unique")
  const splitCounts = countBy(completedSamples, (sample) => sample.split)
  assert(sameJson(splitCounts, REQUIRED_SPLITS), "completed rebuild64 split does not equal 48/8/4/4")

  const records = completedSamples.map((sample) => {
    assert(sample.ownerReviewStatus === "owner_approved", `owner review is not approved: ${sample.recordId}`)
    assert(sample.machineReviewStatus === "passed", `machine review is not passed: ${sample.recordId}`)
    assert(sample.formalConditionalTrainingEligible === true, `formal condition eligibility is false: ${sample.recordId}`)
    assert(sample.conditionBound === true, `condition binding is missing: ${sample.recordId}`)
    assert(sample.v7CapacityContributionPath && fileHashMatches(sample.v7CapacityContributionPath, sample.v7CapacityContributionSha256), `capacity contribution hash mismatch: ${sample.recordId}`)
    const contribution = readJson(sample.v7CapacityContributionPath)
    assert(contribution.status === "registered", `capacity contribution is not registered: ${sample.recordId}`)
    assert(contribution.recordId === sample.recordId, `capacity contribution record mismatch: ${sample.recordId}`)
    assert(contribution.capacitySlotId === sample.v7CapacitySlotId, `capacity contribution slot mismatch: ${sample.recordId}`)
    assert(contribution.split === sample.split, `capacity contribution split mismatch: ${sample.recordId}`)
    assert(contribution.conditionChannelCount === 23, `condition channel count is not 23: ${sample.recordId}`)
    assert(fileHashMatches(sample.sourceRecordPath, sample.sourceRecordSha256), `source record hash mismatch: ${sample.recordId}`)
    assert(fileHashMatches(sample.machineReviewPath, sample.machineReviewSha256), `machine review hash mismatch: ${sample.recordId}`)
    assert(fileHashMatches(sample.ownerReviewPath, sample.ownerReviewSha256), `owner review hash mismatch: ${sample.recordId}`)
    return {
      recordId: sample.recordId,
      capacitySlotId: sample.v7CapacitySlotId,
      split: sample.split,
      imageSha256: sample.imageSha256,
      sourceRecordPath: sample.sourceRecordPath,
      sourceRecordSha256: sample.sourceRecordSha256,
      conditionWorldId: sample.conditionWorldId,
      conditionPackPath: sample.conditionPackPath,
      contributionPath: sample.v7CapacityContributionPath,
      contributionSha256: sample.v7CapacityContributionSha256,
      themeArchitectureIdentity: sample.structuralIdentities.themeArchitectureIdentity,
      instanceDetailIdentity: sample.structuralIdentities.instanceDetailIdentity,
    }
  })

  const frameworkAuditLatest = readJson(REBUILD64_FRAMEWORK_AUDIT_LATEST_PATH)
  const dynamicReadinessLatest = readJson(REBUILD64_DYNAMIC_READINESS_LATEST_PATH)
  assert(frameworkAuditLatest.status === "all_64_packages_passed_full_world_dynamic_readiness_framework_standard", "rebuild64 framework audit is not passed")
  assert(frameworkAuditLatest.passedTargetPackageCount === 64 && frameworkAuditLatest.hardFailurePairCount === 0, "rebuild64 framework audit count mismatch")
  assert(dynamicReadinessLatest.status === "passed" && dynamicReadinessLatest.conditionPackageCount === 64 && dynamicReadinessLatest.pairComparisonCount === 2016, "rebuild64 dynamic readiness audit mismatch")

  const gapList = {
    schemaVersion: "ai-assisted-v7-data-capacity-gap-list-v2",
    runId,
    status: "capacity_complete",
    authorizationId: isolation.authorization.authorizationId,
    legacyHistoricalQualifiedCount: 40,
    structurallyReverifiedTrainingTruthCount: 64,
    requiredCompliantRecordCount: 64,
    currentCompliantRecordCount: 64,
    requiredNewRecordCount: 0,
    splitCounts: REQUIRED_SPLITS,
    plannedSlots: [],
    registeredSlots: records,
  }
  const capacityPlan = {
    schemaVersion: "ai-assisted-v7-data-capacity-plan-v2",
    runId,
    status: "capacity_complete_waiting_owner_training_authorization",
    createdAtUtc,
    createdAtAsiaShanghai,
    decisionId: "owner-approved-v7-mvp-first-training-capacity-64-20260725",
    authorizationId: isolation.authorization.authorizationId,
    isolation: {
      runId: isolation.runId,
      path: isolationLatest.runPath,
      sha256: fileSha256(isolationLatest.runPath),
      isolatedHistoricalRecordCount: 40,
    },
    sourceDataset: {
      packageId: datasetLatest.packageId,
      manifestPath: datasetLatest.manifestPath,
      manifestSha256: fileSha256(datasetLatest.manifestPath),
      sourceIndexPath: datasetLatest.sourceIndexPath,
      sourceIndexSha256: fileSha256(datasetLatest.sourceIndexPath),
      v7CapacityContributionCount: 64,
    },
    auditSummary: {
      legacyHistoricalQualifiedCount: 40,
      structurallyReverifiedTrainingTruthCount: 64,
      isolatedHistoricalRecordCount: 40,
      currentCompliantRecordCount: 64,
      requiredNewRecordCount: 0,
      ownerApprovedRecordCount: 64,
      registeredCapacityCount: 64,
      uniqueCapacitySlotCount: 64,
    },
    gapSummary: {
      requiredNewRecordCount: 0,
      plannedSlotCount: 0,
      completedSlotCount: 64,
      completedSplitCounts: splitCounts,
    },
    audits: {
      frameworkAuditPath: frameworkAuditLatest.runPath,
      frameworkAuditSha256: fileSha256(frameworkAuditLatest.runPath),
      frameworkPassedPackageCount: 64,
      dynamicReadinessPath: dynamicReadinessLatest.runPath,
      dynamicReadinessSha256: fileSha256(dynamicReadinessLatest.runPath),
      dynamicReadinessPairCount: 2016,
    },
    records,
    gates: {
      capacityComplete: true,
      splitIsolationPassed: true,
      ownerTrainingAuthorizationRequired: true,
      gpuTrainingAuthorized: false,
      batchRgbAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
    },
    executionBoundary: {
      conditionPackagesBuilt: 64,
      imagesGenerated: 0,
      gpuTrainingStarted: false,
      trainingStarted: false,
      runtimeFrameCreated: false,
      worldEntryStarted: false,
    },
    automaticStorage: true,
  }
  const gapListPath = path.join(runRoot, "capacity-gap-list.json")
  const capacityPlanPath = path.join(runRoot, "capacity-plan.json")
  writeIndexedJson(gapListPath, gapList)
  writeIndexedJson(capacityPlanPath, capacityPlan)
  const capacityPlanLogicalPath = logicalProjectPath(capacityPlanPath)
  const gapListLogicalPath = logicalProjectPath(gapListPath)
  writeJsonAtomic(path.join(ROOT, OUTPUT_ROOT, "latest.json"), {
    schemaVersion: "ai-assisted-v7-data-capacity-plan-latest-v2",
    runId,
    status: capacityPlan.status,
    updatedAtUtc: createdAtUtc,
    capacityPlanPath: capacityPlanLogicalPath,
    capacityPlanSha256: fileSha256(capacityPlanPath),
    gapListPath: gapListLogicalPath,
    gapListSha256: fileSha256(gapListPath),
    qualifiedExistingRecordCount: 64,
    legacyHistoricalQualifiedCount: 40,
    requiredNewRecordCount: 0,
    plannedSlotCount: 0,
    completedSlotCount: 64,
    firstCompletedSlotId: records[0].capacitySlotId,
    lastCompletedSlotId: records.at(-1).capacitySlotId,
    splitCounts,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  })
  appendAiPainterProgramEvent({
    action: "build_ai_assisted_v7_rebuild64_capacity_plan",
    runId,
    kind: "capacity_plan_completed",
    status: "success",
    stage: capacityPlan.status,
    title: "Thailand rebuild64 V7 training capacity is complete",
    titleZh: "泰国 rebuild64 V7 训练容量已完成",
    detail: "All 64 owner-approved records are registered with the approved 48/8/4/4 split. GPU training remains blocked pending a separate owner authorization.",
    detailZh: "64张owner已通过记录已全部按48/8/4/4分组登记；GPU训练仍等待项目所有者单独授权。",
    evidencePath: capacityPlanLogicalPath,
    evidence: [capacityPlanLogicalPath, gapListLogicalPath, datasetLatest.manifestPath, frameworkAuditLatest.runPath, dynamicReadinessLatest.runPath],
  })
  console.log(JSON.stringify({
    runId,
    status: capacityPlan.status,
    capacityPlanPath: capacityPlanLogicalPath,
    capacityPlanSha256: fileSha256(capacityPlanPath),
    gapListPath: gapListLogicalPath,
    gapListSha256: fileSha256(gapListPath),
    currentCompliantRecordCount: 64,
    requiredNewRecordCount: 0,
    splitCounts,
    frameworkPassedPackageCount: 64,
    dynamicReadinessPairCount: 2016,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  }, null, 2))
}

function selectDiverseNonOverlappingWindows(candidates, count) {
  const ordered = [...candidates].sort((left, right) =>
    left.candidateId.localeCompare(right.candidateId),
  )
  const vectors = new Map(
    ordered.map((entry) => [entry.candidateId, windowFeatureVector(entry)]),
  )
  const selected = [
    [...ordered].sort((left, right) =>
      left.fingerprints.transformCanonical.localeCompare(
        right.fingerprints.transformCanonical,
      ),
    )[0],
  ]
  const selectedIds = new Set(selected.map((entry) => entry.candidateId))
  while (selected.length < count) {
    let best = null
    let bestDistance = -1
    for (const candidate of ordered) {
      if (selectedIds.has(candidate.candidateId)) continue
      const distance = Math.min(
        ...selected.map((current) =>
          squaredDistance(
            vectors.get(candidate.candidateId),
            vectors.get(current.candidateId),
          ),
        ),
      )
      if (
        distance > bestDistance ||
        (distance === bestDistance &&
          candidate.candidateId.localeCompare(best?.candidateId ?? "") < 0)
      ) {
        best = candidate
        bestDistance = distance
      }
    }
    assert(best, "unable to select a unique Thailand measurement window")
    selected.push(best)
    selectedIds.add(best.candidateId)
  }
  return selected
}

function windowFeatureVector(entry) {
  const metrics = entry.metrics ?? {}
  const cover = metrics.reconstructedLandCoverRatio ?? {}
  return [
    Number(entry.row ?? 0) / 10,
    Number(entry.column ?? 0) / 10,
    Number(metrics.relativeElevation ?? 0),
    Number(metrics.relativeRelief ?? 0),
    Number(metrics.normalizedSlope?.mean ?? 0),
    Number(metrics.normalizedSlope?.maximum ?? 0),
    Number(cover.treeCover ?? 0),
    Number(cover.grassland ?? 0),
    Number(metrics.humanRemovalRatio ?? 0),
  ]
}

function squaredDistance(left, right) {
  return left.reduce(
    (total, value, index) =>
      total + (value - right[index]) ** 2,
    0,
  )
}

function countOverlappingPairs(assignments) {
  let count = 0
  for (let left = 0; left < assignments.length; left += 1) {
    for (let right = left + 1; right < assignments.length; right += 1) {
      if (
        pixelWindowsOverlap(
          assignments[left].sourcePixelWindow,
          assignments[right].sourcePixelWindow,
        )
      ) {
        count += 1
      }
    }
  }
  return count
}

function pixelWindowsOverlap(left, right) {
  return !(
    left.left + left.width <= right.left ||
    right.left + right.width <= left.left ||
    left.top + left.height <= right.top ||
    right.top + right.height <= left.top
  )
}

function buildFixedAuthorizedSlotPlan({ windowPlanLatest, windowPlan, gapList, qualifiedRecords, replacementGaps }) {
  assert(windowPlanLatest.status === "real_geography_window_plan_ready_condition_build_required", "fixed window plan is not ready")
  assert(windowPlanLatest.runId === windowPlan.runId, "fixed window plan latest pointer mismatch")
  assert(windowPlan.authorizationId === "owner-authorized-v7-mvp64-gap38-real-geography-bounded-data-build-20260725", "fixed window plan authorization mismatch")
  assert(windowPlan.capacityGapListPath, "fixed window plan capacity gap-list path is missing")
  assert(windowPlan.capacityGapListSha256 === fileSha256(windowPlan.capacityGapListPath), "fixed capacity gap-list hash mismatch")
  assert(windowPlan.capacityPlanRunId === gapList.runId, "fixed capacity plan run identity mismatch")

  const assignments = windowPlan.assignments ?? []
  const expectedSlotIds = assignments.map((assignment) => assignment.slotId)
  assert(
    expectedSlotIds.every((slotId) => {
      const slotNumber = capacitySlotNumber(slotId)
      return slotNumber >= FIXED_SLOT_START && slotNumber <= FIXED_SLOT_END
    }),
    "fixed window assignments must remain inside slot-110 through slot-145",
  )
  const fixedSlots = (gapList.plannedSlots ?? [])
    .filter((slot) => {
      if (typeof slot.slotId !== "string") return false
      const slotNumber = capacitySlotNumber(slot.slotId)
      return slotNumber >= FIXED_SLOT_START && slotNumber <= FIXED_SLOT_END
    })
    .map((slot) => ({ ...slot }))
  assert(sameJson(fixedSlots.map((slot) => slot.slotId), expectedSlotIds), "remaining fixed capacity slots must match the latest authorized window assignments in original order")

  assert(assignments.length === fixedSlots.length, "fixed window assignment count mismatch")
  for (const slot of fixedSlots) {
    const assignment = assignments.find((candidate) => candidate.slotId === slot.slotId)
    assert(assignment, `fixed window assignment missing for ${slot.slotId}`)
    assert(assignment.regionalLandscapeType === slot.regionalLandscapeType, `fixed window landscape identity mismatch for ${slot.slotId}`)
    assert(assignment.monsoonSeason === slot.monsoonSeason, `fixed window season identity mismatch for ${slot.slotId}`)
    assert(assignment.split === slot.split, `fixed window split identity mismatch for ${slot.slotId}`)
  }

  const fixedSlotById = new Map(fixedSlots.map((slot) => [slot.slotId, slot]))
  const registeredFixedSlotIds = []
  for (const audit of qualifiedRecords) {
    const record = audit.record
    const slotId = record.v7CapacitySlotId
    if (!slotId) continue
    const slotNumber = capacitySlotNumber(slotId)
    if (slotNumber < FIXED_SLOT_START || slotNumber > FIXED_SLOT_END) continue
    const fixedSlot = fixedSlotById.get(slotId)
    if (!fixedSlot) continue
    assert(record.classification?.regionalLandscapeType === fixedSlot.regionalLandscapeType, `qualified landscape identity drift for ${slotId}`)
    assert(record.classification?.monsoonSeason === fixedSlot.monsoonSeason, `qualified season identity drift for ${slotId}`)
    assert(record.split === fixedSlot.split, `qualified split identity drift for ${slotId}`)
    registeredFixedSlotIds.push(slotId)
  }
  assert(new Set(registeredFixedSlotIds).size === registeredFixedSlotIds.length, "qualified fixed slot identities must be unique")

  const registeredFixedSlotSet = new Set(registeredFixedSlotIds)
  const plannedSlots = fixedSlots.filter((slot) => !registeredFixedSlotSet.has(slot.slotId))
  const existingRecords = qualifiedRecords.map((audit) => audit.record)
  const existingSplitCounts = countBy(existingRecords, (record) => record.split)
  const requiredRemainingSplitCounts = Object.fromEntries(Object.entries(REQUIRED_SPLITS).map(([split, target]) => [
    split,
    target - (existingSplitCounts[split] ?? 0),
  ]))
  const fixedRemainingSplitCounts = Object.fromEntries(Object.keys(REQUIRED_SPLITS).map((split) => [
    split,
    plannedSlots.filter((slot) => slot.split === split).length,
  ]))
  const replacementGapSplitCounts = Object.fromEntries(Object.keys(REQUIRED_SPLITS).map((split) => [
    split,
    replacementGaps.filter((slot) => slot.split === split).length,
  ]))
  const allRemainingSplitCounts = Object.fromEntries(Object.keys(REQUIRED_SPLITS).map((split) => [
    split,
    (fixedRemainingSplitCounts[split] ?? 0) + (replacementGapSplitCounts[split] ?? 0),
  ]))
  assert(Object.values(requiredRemainingSplitCounts).every((count) => count >= 0), "existing split exceeds approved target")
  assert(
    sameJson(allRemainingSplitCounts, requiredRemainingSplitCounts),
    `fixed slots plus unassigned replacement gaps do not match current approved deficits: actual=${JSON.stringify(allRemainingSplitCounts)} required=${JSON.stringify(requiredRemainingSplitCounts)}`,
  )
  assert(existingRecords.length + plannedSlots.length + replacementGaps.length === REQUIRED_TOTAL, "fixed slots plus unassigned replacement gaps do not close the 64-map target")

  return {
    plannedSlots,
    evidence: {
      contract: "preserve_owner_authorized_fixed_slot_identity_and_order",
      authorizationId: windowPlan.authorizationId,
      windowPlanRunId: windowPlan.runId,
      windowPlanPath: windowPlanLatest.runPath,
      windowPlanSha256: fileSha256(windowPlanLatest.runPath),
      sourceCapacityPlanRunId: windowPlan.capacityPlanRunId,
      sourceCapacityGapListPath: windowPlan.capacityGapListPath,
      sourceCapacityGapListSha256: windowPlan.capacityGapListSha256,
      fixedSlotRange: {
        first: expectedSlotIds[0],
        last: expectedSlotIds.at(-1),
        count: expectedSlotIds.length,
      },
      registeredFixedSlotIds: [...registeredFixedSlotIds].sort((left, right) => capacitySlotNumber(left) - capacitySlotNumber(right)),
      remainingFixedSlotIds: plannedSlots.map((slot) => slot.slotId),
      unassignedReplacementGapCount: replacementGaps.length,
      unassignedReplacementGaps: replacementGaps.map((gap) => ({
        replacementForSuspendedCapacitySlotId: gap.replacementForSuspendedCapacitySlotId,
        split: gap.split,
        regionalLandscapeType: gap.regionalLandscapeType,
        monsoonSeason: gap.monsoonSeason,
        reason: gap.reason,
      })),
      identitiesRecomputedOrRenumbered: false,
    },
  }
}

function createReplacementGap(record, suspension) {
  return {
    slotId: null,
    status: "planned_missing_record_identity_pending_owner_authorization",
    replacementForSuspendedCapacitySlotId: record.v7CapacitySlotId,
    replacementForSuspendedRecordId: record.recordId,
    regionalLandscapeType: record.classification?.regionalLandscapeType,
    monsoonSeason: record.classification?.monsoonSeason,
    coverageRole: "replace_suspended_duplicate_topology_capacity_without_reusing_identity",
    split: record.split,
    mapScope: EXPECTED_MAP_SCOPE,
    worldProfileId: EXPECTED_WORLD_PROFILE,
    requiredConditionContract: EXPECTED_CONDITION_CONTRACT,
    requiredNativeResolution: { width: 1024, height: 768 },
    reason: "duplicate_macro_topology_capacity_contribution_suspended",
    suspensionRunId: suspension.runId,
    suspensionAuthorizationId: suspension.authorization.authorizationId,
    replacementIdentityAssigned: false,
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
    automaticBatchGenerationAllowed: false,
    blockedReason: "replacement_capacity_slot_identity_requires_separate_owner_authorization",
  }
}

function createOwnerRejectedWithdrawalReplacementGap(record) {
  return {
    slotId: null,
    status: "planned_missing_record_identity_pending_owner_authorization",
    replacementForSuspendedCapacitySlotId: record.v7CapacityContribution.capacitySlotId,
    replacementForSuspendedRecordId: record.recordId,
    regionalLandscapeType: record.classification?.regionalLandscapeType,
    monsoonSeason: record.classification?.monsoonSeason,
    coverageRole: "replace_owner_rejected_withdrawn_capacity_without_reusing_identity",
    split: "regression",
    mapScope: EXPECTED_MAP_SCOPE,
    worldProfileId: EXPECTED_WORLD_PROFILE,
    requiredConditionContract: EXPECTED_CONDITION_CONTRACT,
    requiredNativeResolution: { width: 1024, height: 768 },
    reason: "owner_rejected_duplicate_macro_structure_capacity_contribution_withdrawn",
    withdrawalRecordPath: WITHDRAWN_OWNER_REJECTED_RECORD_PATH,
    withdrawalRecordSha256: fileSha256(WITHDRAWN_OWNER_REJECTED_RECORD_PATH),
    ownerReviewPath: record.reviews.ownerReviewPath,
    ownerReviewSha256: fileSha256(record.reviews.ownerReviewPath),
    ownerAuthorizationId: WITHDRAWN_OWNER_REJECTED_REPLACEMENT_AUTHORIZATION_ID,
    replacementIdentityAssigned: false,
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
    automaticBatchGenerationAllowed: false,
    blockedReason: "replacement_capacity_slot_identity_requires_separate_owner_authorization",
  }
}

function createPlannedSlot(regionalLandscapeType, monsoonSeason, coverageRole) {
  return {
    slotId: null,
    status: "planned_missing_record",
    regionalLandscapeType,
    monsoonSeason,
    coverageRole,
    split: null,
    mapScope: EXPECTED_MAP_SCOPE,
    worldProfileId: EXPECTED_WORLD_PROFILE,
    requiredConditionContract: EXPECTED_CONDITION_CONTRACT,
    requiredNativeResolution: { width: 1024, height: 768 },
    requiredDistinctness: [
      "unique_world_seed",
      "unique_layout_variant",
      "unique_concrete_region_connectivity_instance",
      "unique_theme_architecture_identity",
      "unique_instance_detail_identity",
      "unique_task_package_id",
      "unique_condition_label",
      "unique_rgb_sha256",
      "composition_novelty_audit_passed",
    ],
    requiredEvidence: [
      "real_earth_region_source_package",
      "current_region_graph_and_paired_connection",
      "world_facts",
      "world_director",
      "complete_map_scope_proof",
      "23_channel_condition_pack",
      "source_and_image_hashes",
      "machine_review",
      "owner_review",
      "split_identity",
    ],
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
    automaticBatchGenerationAllowed: false,
    continuousBatchAuthorizationId: null,
    blockedReason: "previous_continuous_batch_stopped_and_mvp_64_plan_requires_owner_review",
  }
}

function assignPlannedSplits(slots, existingRecords, firstSlotNumber) {
  const deficits = Object.fromEntries(Object.entries(REQUIRED_SPLITS).map(([split, target]) => [
    split,
    target - existingRecords.filter((record) => record.split === split).length,
  ]))
  assert(Object.values(deficits).every((value) => value >= 0), "existing split exceeds approved target")
  assert(sum(Object.values(deficits)) === slots.length, "split deficits do not match planned slot count")

  const ordered = [...slots].sort((left, right) => {
    const seasonDifference = EXTRA_SEASON_PRIORITY.indexOf(left.monsoonSeason) - EXTRA_SEASON_PRIORITY.indexOf(right.monsoonSeason)
    const landscapeDifference = landscapeTypes.indexOf(left.regionalLandscapeType) - landscapeTypes.indexOf(right.regionalLandscapeType)
    return seasonDifference || landscapeDifference || left.coverageRole.localeCompare(right.coverageRole)
  })
  let available = ordered
  for (const split of ["validation", "challenge", "regression"]) {
    const selected = selectEvenly(available, deficits[split])
    const selectedSet = new Set(selected)
    for (const slot of selected) slot.split = split
    available = available.filter((slot) => !selectedSet.has(slot))
  }
  assert(available.length === deficits.train, "remaining train slot count mismatch")
  for (const slot of available) slot.split = "train"
  slots.sort((left, right) => {
    const landscapeDifference = landscapeTypes.indexOf(left.regionalLandscapeType) - landscapeTypes.indexOf(right.regionalLandscapeType)
    return landscapeDifference || REQUIRED_SEASONS.indexOf(left.monsoonSeason) - REQUIRED_SEASONS.indexOf(right.monsoonSeason) || left.split.localeCompare(right.split)
  })
  slots.forEach((slot, index) => {
    slot.slotId = `v7-capacity-slot-${String(firstSlotNumber + index).padStart(3, "0")}`
  })
}

function assertUniqueQualifiedIdentities(audits) {
  const records = audits.map((audit) => audit.record)
  for (const [label, values] of [
    ["image sha256", records.map((record) => record.imageSha256)],
    ["condition world", records.map((record) => record.conditionWorldId)],
    ["task package", records.map((record) => record.taskPackageId)],
    ["condition label", records.map((record) => record.conditionLabel)],
  ]) {
    assert(values.every(Boolean), `qualified ${label} identity missing`)
    assert(new Set(values).size === values.length, `qualified ${label} identities must be unique`)
  }
}

function capacitySlotNumber(value) {
  const match = /^v7-capacity-slot-(\d{3})$/.exec(value ?? "")
  assert(match, `invalid registered V7 capacity slot: ${value}`)
  return Number(match[1])
}

function discoverHistoricalV7SlotNumbers() {
  const roots = [
    ".runtime/ai-painter/ai-assisted-v7-data-tasks",
    ".runtime/ai-painter/ai-assisted-v7-capacity-contributions",
    "data/world-samples/original-image-library/natural-home-v1/complete-maps",
  ]
  const numbers = new Set()
  for (const relativeRoot of roots) {
    const absoluteRoot = path.join(ROOT, relativeRoot)
    if (!fs.existsSync(absoluteRoot)) continue
    for (const entry of fs.readdirSync(absoluteRoot, { withFileTypes: true })) {
      const match = entry.name.match(/v7-capacity-slot-(\d{3})/)
      if (match) numbers.add(Number(match[1]))
    }
  }
  return [...numbers]
}

function selectEvenly(items, count) {
  if (count === 0) return []
  assert(count <= items.length, "cannot select more items than available")
  const selected = []
  const used = new Set()
  for (let index = 0; index < count; index += 1) {
    let candidateIndex = Math.floor(((index + 0.5) * items.length) / count)
    while (used.has(candidateIndex) && candidateIndex < items.length - 1) candidateIndex += 1
    while (used.has(candidateIndex) && candidateIndex > 0) candidateIndex -= 1
    assert(!used.has(candidateIndex), "even split selection produced a duplicate")
    used.add(candidateIndex)
    selected.push(items[candidateIndex])
  }
  return selected
}

function buildCoverageMatrix({ qualifiedRecords, plannedSlots, qualifiedByCell }) {
  const rows = landscapeTypes.map((landscapeType) => ({
    regionalLandscapeType: landscapeType,
    targetCount: targetCountsByLandscape[landscapeType],
    currentQualifiedCount: qualifiedRecords.filter((audit) => audit.record.classification?.regionalLandscapeType === landscapeType).length,
    plannedCount: plannedSlots.filter((slot) => slot.regionalLandscapeType === landscapeType).length,
    seasonCoverage: Object.fromEntries(REQUIRED_SEASONS.map((season) => {
      const cellKey = `${landscapeType}::${season}`
      const current = qualifiedByCell[cellKey] ?? 0
      const planned = plannedSlots.filter((slot) => slot.regionalLandscapeType === landscapeType && slot.monsoonSeason === season).length
      return [season, { currentQualified: current, planned, final: current + planned }]
    })),
  }))
  return {
    schemaVersion: "ai-assisted-v7-data-capacity-coverage-matrix-v1",
    runId,
    status: "planned_pending_data_build_and_owner_review",
    createdAtUtc,
    createdAtAsiaShanghai,
    approvedTotal: REQUIRED_TOTAL,
    formalEnhancementTarget: FORMAL_ENHANCEMENT_TOTAL,
    selectionMethod: coverageBlueprint.requiredStateFramework.selectionMethod,
    fullCartesianProductForbidden: true,
    matrixScope: "approved regional landscape type x four monsoon key states only; all other world axes remain selected by pairwise and challenge coverage",
    rows,
    totals: {
      currentQualified: qualifiedRecords.length,
      planned: plannedSlots.length,
      final: qualifiedRecords.length + plannedSlots.length,
    },
  }
}

function buildCellCounts(records) {
  const result = {}
  for (const record of records) {
    const key = `${record.classification?.regionalLandscapeType}::${record.classification?.monsoonSeason}`
    result[key] = (result[key] ?? 0) + 1
  }
  return result
}

function countBy(values, selector) {
  const result = {}
  for (const value of values) {
    const key = selector(value)
    result[key] = (result[key] ?? 0) + 1
  }
  return result
}

function writeIndexedJson(filePath, body) {
  writeJsonAtomic(filePath, body)
  const stat = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: fileSha256(filePath),
  })
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(resolvePath(filePath), "utf8"))
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolvePath(filePath))).digest("hex")
}

function fileHashMatches(filePath, expectedSha256) {
  return typeof filePath === "string"
    && typeof expectedSha256 === "string"
    && fileSha256(filePath) === expectedSha256
}

function resolvePath(filePath) {
  return path.resolve(ROOT, filePath)
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
