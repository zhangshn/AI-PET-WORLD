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

const ROOT = process.cwd()
const CONFIG_PATH = "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json"
const COVERAGE_BLUEPRINT_PATH = "data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json"
const DATASET_LATEST_PATH = "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json"
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans"
const EXPECTED_WORLD_PROFILE = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"
const EXPECTED_MAP_SCOPE = "complete-natural-home-map"
const EXPECTED_CONDITION_CONTRACT = "complete-map-scope-world-facts-v2"
const REQUIRED_SPLITS = { train: 96, validation: 16, challenge: 8, regression: 8 }
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
const landscapeTypes = (coverageBlueprint.regionalLandscapeTypes ?? []).map((entry) => entry.typeId)

assert(decision?.status === "owner_approved", "V7 data-capacity decision is not owner approved")
assert(decision?.totalCompleteMaps === 128, "V7 data-capacity total must be 128")
assert(sameJson(decision?.splitCounts, REQUIRED_SPLITS), "V7 split must be 96/16/8/8")
assert(decision?.batchImageGenerationAuthorized === true, "the owner-authorized V7 continuous data batch is missing")
assert(decision?.continuousBatchAuthorization?.authorizationId === "owner-authorized-v7-remaining-104-continuous-batch-20260723", "continuous batch authorization identity mismatch")
assert(decision?.continuousBatchAuthorization?.authorizedRecordCount === 104, "continuous batch authorization must cover the remaining 104 slots")
assert(decision?.continuousBatchAuthorization?.executionMode === "sequential_one_active_generation_request", "continuous batch must remain strictly sequential")
assert(decision?.continuousBatchAuthorization?.ownerApprovalAutomatic === false, "continuous batch must not grant owner approval")
assert(decision?.continuousBatchAuthorization?.gpuTrainingAutomatic === false, "continuous batch must not start GPU training")
assert(decision?.gpuTrainingAuthorized === false, "GPU training must remain unauthorized")
assert(sameJson(coverageBlueprint.requiredStateFramework?.monsoonSeasons, REQUIRED_SEASONS), "monsoon season framework mismatch")
assert(coverageBlueprint.requiredStateFramework?.selectionMethod === "key_states_plus_pairwise_coverage_plus_unseen_challenge", "coverage selection method mismatch")
assert(coverageBlueprint.requiredStateFramework?.fullCartesianProductForbidden === true, "full Cartesian-product prohibition is missing")
assert(landscapeTypes.length === 20, "expected 20 approved regional landscape types")

const currentRecords = (sourceIndex.samples ?? []).filter((sample) => sample.categoryId === "complete-maps"
  && sample.formalConditionalTrainingEligible === true
  && sample.conditionBound === true
  && (sample.currentConditionIdentityMatches === true || sample.v7CapacityContributionRegistered === true))
const audits = currentRecords.map(auditExistingRecord)
const qualifiedRecords = audits.filter((audit) => audit.passed)
const failedAudits = audits.filter((audit) => !audit.passed)
assertUniqueQualifiedIdentities(qualifiedRecords)
const registeredV7SlotNumbers = qualifiedRecords
  .map((audit) => audit.record.v7CapacitySlotId)
  .filter(Boolean)
  .map(capacitySlotNumber)
  .sort((left, right) => left - right)
registeredV7SlotNumbers.forEach((slotNumber, index) => assert(slotNumber === index + 1, "registered V7 capacity slots must be contiguous from slot 001"))
const nextCapacitySlotNumber = registeredV7SlotNumbers.length + 1
const qualifiedByCell = buildCellCounts(qualifiedRecords.map((audit) => audit.record))

const targetCountsByLandscape = Object.fromEntries(landscapeTypes.map((landscapeType, index) => [
  landscapeType,
  6 + (index > 0 && index <= 8 ? 1 : 0),
]))
assert(sum(Object.values(targetCountsByLandscape)) === 128, "landscape target allocation must total 128")

const plannedSlots = []
for (const landscapeType of landscapeTypes) {
  const targetCount = targetCountsByLandscape[landscapeType]
  const currentForLandscape = qualifiedRecords
    .map((audit) => audit.record)
    .filter((record) => record.classification?.regionalLandscapeType === landscapeType)
  const seasonCounts = Object.fromEntries(REQUIRED_SEASONS.map((season) => [
    season,
    currentForLandscape.filter((record) => record.classification?.monsoonSeason === season).length,
  ]))
  let missingCount = Math.max(0, targetCount - currentForLandscape.length)

  for (const season of REQUIRED_SEASONS) {
    if (missingCount === 0) break
    if (seasonCounts[season] === 0) {
      plannedSlots.push(createPlannedSlot(landscapeType, season, "pairwise_landscape_season_baseline"))
      seasonCounts[season] += 1
      missingCount -= 1
    }
  }

  while (missingCount > 0) {
    const season = [...EXTRA_SEASON_PRIORITY].sort((left, right) => {
      const countDifference = seasonCounts[left] - seasonCounts[right]
      return countDifference || EXTRA_SEASON_PRIORITY.indexOf(left) - EXTRA_SEASON_PRIORITY.indexOf(right)
    })[0]
    plannedSlots.push(createPlannedSlot(landscapeType, season, "structural_diversity_reserve"))
    seasonCounts[season] += 1
    missingCount -= 1
  }
}

assert(qualifiedRecords.length + plannedSlots.length === 128, "qualified records plus planned slots must total 128")
assignPlannedSplits(plannedSlots, qualifiedRecords.map((audit) => audit.record), nextCapacitySlotNumber)

const plannedSplitCounts = countBy(plannedSlots, (slot) => slot.split)
const existingSplitCounts = countBy(qualifiedRecords.map((audit) => audit.record), (record) => record.split)
const finalSplitCounts = Object.fromEntries(Object.keys(REQUIRED_SPLITS).map((split) => [
  split,
  (existingSplitCounts[split] ?? 0) + (plannedSplitCounts[split] ?? 0),
]))
assert(sameJson(finalSplitCounts, REQUIRED_SPLITS), "final planned split does not equal 96/16/8/8")

const coverageMatrix = buildCoverageMatrix({ qualifiedRecords, plannedSlots, qualifiedByCell })
const gapList = {
  schemaVersion: "ai-assisted-v7-data-capacity-gap-list-v1",
  runId,
  status: plannedSlots.length === 0 && failedAudits.length === 0 ? "capacity_complete" : "data_build_required",
  createdAtUtc,
  createdAtAsiaShanghai,
  approvedTargetCount: 128,
  auditedSourceRecordCount: currentRecords.length,
  qualifiedExistingRecordCount: qualifiedRecords.length,
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
  plannedSlots,
  gates: {
    automaticBatchGenerationAllowed: true,
    gpuTrainingAllowed: false,
    imageGenerationAllowedByThisPlan: true,
    ownerApprovalAutomatic: false,
    capacityContributionBeforeOwnerApproval: false,
    continuousBatchAuthorizationId: decision.continuousBatchAuthorization.authorizationId,
    nextRequiredAction: "run_remaining_slots_sequentially_then_owner_review_machine_passed_queue",
  },
}

const capacityPlan = {
  schemaVersion: "ai-assisted-v7-data-capacity-plan-v1",
  runId,
  status: gapList.status === "capacity_complete" ? "capacity_complete_waiting_owner_training_authorization" : "blocked_pending_approved_128_dataset_implementation",
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
  approvedCapacity: {
    total: 128,
    splitCounts: REQUIRED_SPLITS,
    regionalLandscapeTypeCount: landscapeTypes.length,
    monsoonSeasonFramework: REQUIRED_SEASONS,
    selectionMethod: coverageBlueprint.requiredStateFramework.selectionMethod,
    fullCartesianProductForbidden: true,
    allocationRule: "20x4 landscape-season pairwise baseline inside the approved axes, then bounded structural-diversity reserve; no full product across all world axes",
  },
  auditSummary: {
    auditedSourceRecordCount: currentRecords.length,
    qualifiedExistingRecordCount: qualifiedRecords.length,
    failedExistingAuditCount: failedAudits.length,
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
  qualifiedExistingRecordCount: qualifiedRecords.length,
  requiredNewRecordCount: plannedSlots.length,
  finalSplitCounts,
})

appendAiPainterProgramEvent({
  status: capacityPlan.status.startsWith("blocked_") ? "blocked" : "success",
  stage: "ai_assisted_v7_data_capacity_plan_built",
  titleZh: "V7 的 128 张完整地图容量矩阵与缺口清单已由程序生成",
  titleEn: "The V7 128-complete-map capacity matrix and gap list were built by the program",
  summaryZh: `程序审核现有 ${currentRecords.length} 条记录，其中 ${qualifiedRecords.length} 条合格；仍需 ${plannedSlots.length} 条完整地图记录。未生成图片、未启动 GPU 训练。`,
  summaryEn: `The program audited ${currentRecords.length} existing records and qualified ${qualifiedRecords.length}; ${plannedSlots.length} complete-map records are still required. No image generation or GPU training was started.`,
  evidence: [
    `${OUTPUT_ROOT}/${runId}/capacity-plan.json`,
    `${OUTPUT_ROOT}/${runId}/coverage-matrix.json`,
    `${OUTPUT_ROOT}/${runId}/gap-list.json`,
  ],
  errorCode: capacityPlan.status.startsWith("blocked_") ? "v7_data_capacity_128_not_yet_complete" : null,
})

console.log(JSON.stringify({
  status: capacityPlan.status,
  runId,
  capacityPlanPath: `${OUTPUT_ROOT}/${runId}/capacity-plan.json`,
  auditedSourceRecordCount: currentRecords.length,
  qualifiedExistingRecordCount: qualifiedRecords.length,
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
      "unique_task_package_id",
      "unique_condition_label",
      "unique_rgb_sha256",
      "composition_novelty_audit_passed",
    ],
    requiredEvidence: [
      "world_facts",
      "world_director",
      "complete_map_scope_proof",
      "23_channel_condition_pack",
      "source_and_image_hashes",
      "machine_review",
      "owner_review",
      "split_identity",
    ],
    imageGenerationAuthorized: true,
    gpuTrainingAuthorized: false,
    automaticBatchGenerationAllowed: true,
    continuousBatchAuthorizationId: decision.continuousBatchAuthorization.authorizationId,
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
    approvedTotal: 128,
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
  })
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(resolvePath(filePath), "utf8"))
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolvePath(filePath))).digest("hex")
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
