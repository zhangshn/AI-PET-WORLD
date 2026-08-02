import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { isOwnerAuthorizedAiAssistedColdStartRef } from "./lib/original-image-library-contract.mjs"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const POLICY_VERSION = "owner-authorized-ai-assisted-cold-start-v1"
const WORLD_PROFILE_ID = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"
const OUTPUT_ROOT = path.join(ROOT, "data", "world-samples", "ai-assisted-cold-start-dataset-packages")
const INDEX_PATH = "data/world-samples/original-image-library/natural-home-v1/index.json"
const CONFIG_PATH = "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v2.json"
const modelConfig = readRequiredJson(CONFIG_PATH)
const dictionaryPointer = readRequiredJson("data/world-visual-data-dictionary/latest.json")
const index = readRequiredJson(INDEX_PATH)
const conditionalFactsPointer = readRequiredJson(".runtime/ai-painter/ai-assisted-conditional-world-facts/latest.json")
const conditionalFactsManifest = readRequiredJson(conditionalFactsPointer.manifestPath)
const trainingGateApprovalPointer = readOptionalJson(".runtime/ai-painter/ai-assisted-training-gate-owner-approvals/latest.json")
const connectivityCoverageBlueprint = readRequiredJson("data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json")
const connectivityCoverage = connectivityCoverageBlueprint.connectivityCoverage
const connectivityContract = readRequiredJson("data/world-samples/world-connectivity/world-connectivity-contract-v1.json")
const connectivityCoveragePointer = readOptionalJson("data/world-samples/world-connectivity/coverage/latest.json")
const connectivityCoverageManifest = connectivityCoveragePointer?.manifestPath
  ? readOptionalJson(connectivityCoveragePointer.manifestPath)
  : null
const currentConditionRows = conditionalFactsManifest.rows ?? []
const currentConditionByWorldId = new Map(currentConditionRows.map((row) => [row.worldId, row]))
const timestamp = new Date().toISOString()
const packageId = `natural-home-ai-assisted-cold-start-${dictionaryPointer.dictionaryVersionId}-${timestamp.replace(/[:.]/g, "-")}`
const packageDir = path.join(OUTPUT_ROOT, packageId)

const eligibleRecords = (index.records ?? [])
  .filter((record) => record.status === "ai_assisted_cold_start_eligible")
  .sort((left, right) => left.recordId.localeCompare(right.recordId))

assert(eligibleRecords.length > 0, "no owner-approved AI-assisted cold-start records")
assert(currentConditionRows.length === 21, `expected 21 current condition rows, got ${currentConditionRows.length}`)
assert(currentConditionByWorldId.size === currentConditionRows.length, "current condition world identities must be unique")
fs.mkdirSync(OUTPUT_ROOT, { recursive: true })
fs.mkdirSync(packageDir, { recursive: false })

const completeMaps = eligibleRecords.filter((record) => record.categoryId === "complete-maps")
const completeMapSplits = new Map(completeMaps.map((record, indexValue) => [record.recordId, splitForIndex(indexValue)]))
const samples = eligibleRecords.map((summary) => buildSample(summary, completeMapSplits.get(summary.recordId) ?? "knowledge"))
const ownerAuthorizationRefs = [...new Set(samples.map((sample) => sample.ownerAuthorizationRef))].sort()
const autoencoderSamples = samples.filter((sample) => sample.trainingRoles.includes("rgb_autoencoder_warmup"))
const conditionBoundSamples = samples.filter((sample) => sample.trainingRoles.includes("conditional_denoiser"))
const currentConditionBoundSamples = conditionBoundSamples.filter((sample) => sample.currentConditionIdentityMatches === true)
const v7CapacityContributionSamples = conditionBoundSamples.filter((sample) => sample.v7CapacityContributionRegistered === true)
const pairedWorldIds = new Set(currentConditionBoundSamples.map((sample) => sample.conditionWorldId))
const unpairedConditionRows = currentConditionRows.filter((row) => !pairedWorldIds.has(row.worldId))
assert(pairedWorldIds.size === currentConditionBoundSamples.length, "current condition RGB pairs must have unique world identities")
assert(new Set(conditionBoundSamples.map((sample) => sample.conditionWorldId)).size === conditionBoundSamples.length, "all condition-bound samples must have unique world identities")
assert(new Set(v7CapacityContributionSamples.map((sample) => sample.v7CapacitySlotId)).size === v7CapacityContributionSamples.length, "V7 capacity contributions must have unique slot identities")
const conditionOnlyBlueprints = (conditionalFactsManifest.rows ?? []).map((row) => ({
  sourceRecordId: row.sourceRecordId,
  worldId: row.worldId,
  taskId: row.taskId,
  targetRegionalLandscapeType: row.targetRegionalLandscapeType,
  snapshotId: row.snapshotId,
  blueprintPath: row.blueprintPath,
  blueprintSha256: row.blueprintSha256,
  directorOutputPath: row.directorOutputPath,
  directorOutputSha256: row.directorOutputSha256,
  taskPackagePath: row.taskPackagePath,
  taskPackageSha256: row.taskPackageSha256,
  conditionPackPath: row.conditionPackPath,
  conditionPackSha256: row.conditionPackSha256,
  conditionPackFileSha256: sha256(fs.readFileSync(resolveProjectPath(row.conditionPackPath))),
  channelCount: row.channelCount,
  existingRgbBound: false,
  needsNewRgbPair: true,
}))
assert(conditionalFactsManifest.sourceImageGeometryRead === false, "conditional facts must not be inferred from RGB")
assert(conditionalFactsManifest.existingRgbBoundToGeneratedConditions === false, "existing RGB must remain unbound")
assert(conditionOnlyBlueprints.length === 21, `expected 21 condition-only blueprints, got ${conditionOnlyBlueprints.length}`)
const categoryCounts = countBy(samples, (sample) => sample.categoryId)
const splitCounts = countBy(autoencoderSamples, (sample) => sample.split)
const conditionalThreshold = trainingGateApprovalPointer?.approvals?.conditionalDenoiserThreshold
const autoencoderVisualReview = trainingGateApprovalPointer?.approvals?.autoencoderV2VisualReview
const connectivityThreshold = trainingGateApprovalPointer?.approvals?.worldConnectivityCoverageThreshold
const conditionalThresholdApproved = conditionalThreshold?.decision === "approved"
  && currentConditionBoundSamples.length >= conditionalThreshold.minimumCurrentConditionPairCount
const autoencoderVisualApproved = autoencoderVisualReview?.decision === "approved"
const connectivityThresholdApproved = connectivityThreshold?.decision === "approved"
  && connectivityCoverage?.minimumThresholdStatus === "owner_approved"
const connectivityCoverageEvidenceValid = validateConnectivityCoverageEvidence()
const connectivityCoverageMet = connectivityThresholdApproved
  && connectivityCoverage?.thresholdMet === true
  && connectivityCoverageEvidenceValid
const blockers = [
  ...(conditionBoundSamples.length === 0 ? ["condition_bound_complete_map_samples_missing"] : []),
  ...(unpairedConditionRows.length > 0 ? ["condition_blueprints_require_new_rgb_pairs"] : []),
  ...(!conditionalThresholdApproved ? ["ai_assisted_conditional_training_threshold_pending_owner_approval"] : []),
  ...(!autoencoderVisualApproved ? ["ai_assisted_autoencoder_v2_visual_review_pending_owner_approval"] : []),
  ...(!connectivityThresholdApproved ? ["world_connectivity_coverage_thresholds_pending"] : []),
  ...(connectivityThresholdApproved && connectivityCoverage?.thresholdMet === true && !connectivityCoverageEvidenceValid
    ? ["world_connectivity_coverage_evidence_invalid"]
    : []),
  ...(connectivityThresholdApproved && !connectivityCoverageMet ? (connectivityCoverage.remainingBlockers ?? ["world_connectivity_coverage_insufficient"]) : []),
]
const canTrainConditionalDenoiser = blockers.length === 0
const packageStatus = canTrainConditionalDenoiser
  ? "conditional_denoiser_training_ready"
  : unpairedConditionRows.length === 0 && conditionalThresholdApproved && autoencoderVisualApproved && connectivityThresholdApproved
    ? "conditional_rgb_pairs_complete_owner_gates_approved_connectivity_coverage_insufficient"
    : unpairedConditionRows.length === 0
      ? "conditional_rgb_pairs_complete_owner_gates_pending"
      : "autoencoder_warmup_ready_condition_blueprints_ready_rgb_pairing_blocked"

const sourceIndex = {
  schemaVersion: "ai-assisted-cold-start-dataset-source-index-v1",
  policyVersion: POLICY_VERSION,
  ownerAuthorizationRef: ownerAuthorizationRefs.length === 1 ? ownerAuthorizationRefs[0] : null,
  ownerAuthorizationRefs,
  packageId,
  dictionaryVersionId: dictionaryPointer.dictionaryVersionId,
  sampleCount: samples.length,
  categoryCounts,
  samples,
  conditionOnlyBlueprintCount: conditionOnlyBlueprints.length,
  conditionOnlyBlueprints,
  currentConditionPairCount: currentConditionBoundSamples.length,
  currentConditionUnpairedCount: unpairedConditionRows.length,
  currentConditionPairs: currentConditionBoundSamples.map((sample) => ({
    sampleId: sample.sampleId,
    conditionLabel: sample.conditionLabel,
    worldId: sample.conditionWorldId,
    taskPackageId: sample.taskPackageId,
    conditionPackPath: sample.conditionPackPath,
    imageSha256: sample.imageSha256,
  })),
  v7CapacityContributionCount: v7CapacityContributionSamples.length,
  v7CapacityContributions: v7CapacityContributionSamples.map((sample) => ({
    sampleId: sample.sampleId,
    capacitySlotId: sample.v7CapacitySlotId,
    split: sample.split,
    conditionLabel: sample.conditionLabel,
    worldId: sample.conditionWorldId,
    taskPackageId: sample.taskPackageId,
    conditionPackPath: sample.conditionPackPath,
    imageSha256: sample.imageSha256,
    contributionPath: sample.v7CapacityContributionPath,
    contributionSha256: sample.v7CapacityContributionSha256,
  })),
}
writeJson(path.join(packageDir, "source-index.json"), sourceIndex)

for (const split of ["train", "validation", "challenge", "regression", "knowledge"]) {
  const rows = samples.filter((sample) => sample.split === split)
  writeJson(path.join(packageDir, "splits", `${split}.json`), {
    schemaVersion: "ai-assisted-cold-start-dataset-split-v1",
    packageId,
    split,
    sampleCount: rows.length,
    samples: rows,
  })
}

const snapshots = snapshotInputs(packageDir)
const manifest = {
  schemaVersion: "ai-assisted-cold-start-dataset-package-v1",
  policyVersion: POLICY_VERSION,
  ownerAuthorizationRef: ownerAuthorizationRefs.length === 1 ? ownerAuthorizationRefs[0] : null,
  ownerAuthorizationRefs,
  packageId,
  parentPackageId: readOptionalJson(path.join(OUTPUT_ROOT, "latest.json"))?.packageId ?? null,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  status: packageStatus,
  immutable: true,
  trainingLane: "ai_assisted_cold_start",
  checkpointOwnership: "project_owned_architecture_ai_assisted_cold_start_weights",
  modelConfigId: modelConfig.modelId,
  modelArchitectureVersion: modelConfig.architectureVersion,
  modelConfigPath: CONFIG_PATH,
  dictionaryVersionId: dictionaryPointer.dictionaryVersionId,
  worldProfileId: WORLD_PROFILE_ID,
  sampleCount: samples.length,
  categoryCounts,
  completeMapCount: completeMaps.length,
  autoencoderSampleCount: autoencoderSamples.length,
  conditionBoundCompleteMapCount: conditionBoundSamples.length,
  currentConditionPairCount: currentConditionBoundSamples.length,
  v7CapacityContributionCount: v7CapacityContributionSamples.length,
  currentConditionUnpairedCount: unpairedConditionRows.length,
  currentConditionExpectedCount: currentConditionRows.length,
  conditionOnlyBlueprintCount: conditionOnlyBlueprints.length,
  conditionalFactsBatchId: conditionalFactsManifest.batchId,
  conditionalFactsManifestPath: conditionalFactsPointer.manifestPath,
  conditionalFactsManifestSha256: sha256(fs.readFileSync(resolveProjectPath(conditionalFactsPointer.manifestPath))),
  trainingGateApprovalId: trainingGateApprovalPointer?.approvalId ?? null,
  trainingGateApprovalPath: trainingGateApprovalPointer?.approvalPath ?? null,
  trainingGateApprovalSha256: trainingGateApprovalPointer?.approvalSha256 ?? null,
  trainingGateStatus: {
    conditionalThresholdApproved,
    autoencoderVisualApproved,
    connectivityThresholdApproved,
    connectivityCoverageMet,
  },
  connectivityCoverage: {
    minimumPositiveRecordCount: connectivityCoverage?.minimumPositiveRecordCount ?? null,
    minimumNegativeRecordCount: connectivityCoverage?.minimumNegativeRecordCount ?? null,
    minimumPositivePerAxis: connectivityCoverage?.minimumPositivePerAxis ?? null,
    minimumNegativePerAxis: connectivityCoverage?.minimumNegativePerAxis ?? null,
    currentPositiveRecordCount: connectivityCoverage?.currentPositiveRecordCount ?? 0,
    currentNegativeRecordCount: connectivityCoverage?.currentNegativeRecordCount ?? 0,
    axisCounts: connectivityCoverage?.axisCounts ?? {},
    thresholdMet: connectivityCoverageMet,
    evidenceValid: connectivityCoverageEvidenceValid,
    datasetId: connectivityCoverageManifest?.datasetId ?? null,
    manifestPath: connectivityCoveragePointer?.manifestPath ?? null,
    manifestSha256: connectivityCoveragePointer?.manifestSha256 ?? null,
  },
  splitCounts,
  readinessContract: {
    autoencoderWarmup: "nonempty_owner_approved_rgb_technical_gate_only",
    conditionalDenoiser: "owner_approved_threshold_and_per_image_23_channel_binding_required",
    conditionOnlyBlueprints: "must_receive_new_rgb_generated_after_the_condition_pack; existing_rgb_rebinding_forbidden",
    formalInference: "conditional_checkpoint_and_all_formal_gates_required",
    inventedThresholdsAllowed: false,
  },
  canStartAutoencoderWarmup: autoencoderSamples.length > 0,
  canTrainConditionalDenoiser,
  canStartFormalTraining: false,
  formalInferenceEligible: false,
  blockers,
  thirdPartyWeightsLoaded: false,
  thirdPartyGeneratedTrainingOutputUsed: true,
  aiGenerationDependencyDeclared: true,
  sourceIndexPath: projectPath(path.join(packageDir, "source-index.json")),
  snapshots,
  automaticStorage: true,
}
writeJson(path.join(packageDir, "manifest.json"), manifest)
const latestPath = path.join(OUTPUT_ROOT, "latest.json")
writeJson(latestPath, {
  schemaVersion: "ai-assisted-cold-start-dataset-package-latest-v1",
  packageId,
  status: manifest.status,
  createdAtUtc: timestamp,
  manifestPath: projectPath(path.join(packageDir, "manifest.json")),
  sourceIndexPath: manifest.sourceIndexPath,
  sampleCount: samples.length,
  autoencoderSampleCount: autoencoderSamples.length,
  conditionBoundCompleteMapCount: conditionBoundSamples.length,
  currentConditionPairCount: currentConditionBoundSamples.length,
  v7CapacityContributionCount: v7CapacityContributionSamples.length,
  currentConditionUnpairedCount: unpairedConditionRows.length,
  conditionOnlyBlueprintCount: conditionOnlyBlueprints.length,
  conditionalFactsBatchId: conditionalFactsManifest.batchId,
  canStartAutoencoderWarmup: manifest.canStartAutoencoderWarmup,
  canTrainConditionalDenoiser: manifest.canTrainConditionalDenoiser,
})
const indexedArtifactCount = indexGeneratedPackageArtifacts(packageDir, latestPath)
appendAiPainterProgramEvent({
  action: "build_ai_assisted_cold_start_dataset_package",
  runId: packageId,
  kind: "dataset_package_built",
  status: "success",
  stage: "ai_assisted_cold_start_dataset_package_built",
  title: "AI-assisted cold-start dataset package built and indexed",
  titleZh: "AI 辅助冷启动数据集包已构建并写入索引",
  titleEn: "The AI-assisted cold-start dataset package was built and indexed",
  detail: `The program built package ${packageId}, indexed ${indexedArtifactCount} artifacts with SHA-256, and preserved all immutable source histories.`,
  detailZh: `程序构建数据集包 ${packageId}，将 ${indexedArtifactCount} 项产物连同 SHA-256 写入 SQLite，并保留全部不可变来源历史。`,
  summaryZh: `数据集包包含 ${samples.length} 个样本、${currentConditionBoundSamples.length} 条当前条件配对和 ${v7CapacityContributionSamples.length} 条历史 V7 容量贡献。容量资格暂停由独立容量计划执行；本轮未生成图片，未启动 GPU 训练。`,
  summaryEn: `The package contains ${samples.length} samples, ${currentConditionBoundSamples.length} current condition pairs, and ${v7CapacityContributionSamples.length} historical V7 capacity contributions. Capacity suspensions are applied by the separate capacity plan. No image was generated and GPU training did not start.`,
  evidencePath: manifest.sourceIndexPath,
  evidence: [
    projectPath(path.join(packageDir, "manifest.json")),
    manifest.sourceIndexPath,
    projectPath(latestPath),
  ],
})

console.log(JSON.stringify({
  status: manifest.status,
  packageId,
  packagePath: projectPath(packageDir),
  sampleCount: samples.length,
  categoryCounts,
  autoencoderSampleCount: autoencoderSamples.length,
  conditionBoundCompleteMapCount: conditionBoundSamples.length,
  currentConditionPairCount: currentConditionBoundSamples.length,
  v7CapacityContributionCount: v7CapacityContributionSamples.length,
  currentConditionUnpairedCount: unpairedConditionRows.length,
  splitCounts,
  blockers,
  indexedArtifactCount,
  imagesGenerated: 0,
  gpuTrainingStarted: false,
}, null, 2))

function buildSample(summary, split) {
  const record = readRequiredJson(summary.recordPath)
  assert(record.recordId === summary.recordId, `record identity mismatch: ${summary.recordId}`)
  assert(record.status === "ai_assisted_cold_start_eligible", `record is not eligible: ${summary.recordId}`)
  assert(record.aiAssistedColdStartEligible === true, `AI cold-start eligibility missing: ${summary.recordId}`)
  assert(record.independentTrainingEligible === false, `independent lane contamination: ${summary.recordId}`)
  assert(record.aiAssistedColdStart?.policyVersion === POLICY_VERSION, `policy mismatch: ${summary.recordId}`)
  assert(
    isOwnerAuthorizedAiAssistedColdStartRef(record.aiAssistedColdStart?.ownerAuthorizationRef),
    `owner authorization mismatch: ${summary.recordId}`,
  )
  assert(record.aiAssistedColdStart?.trainingLane === "ai_assisted_cold_start", `training lane mismatch: ${summary.recordId}`)
  assert(record.source?.thirdPartyContentUsed === false, `third-party content present: ${summary.recordId}`)
  assert(record.source?.thirdPartyGenerativeModelUsed === true, `AI generation dependency missing: ${summary.recordId}`)
  assert(record.source?.copiedFromExistingWork === false, `copied work present: ${summary.recordId}`)
  assert(record.worldBinding?.worldProfileId === WORLD_PROFILE_ID, `world profile mismatch: ${summary.recordId}`)
  assert(record.reviews?.ownerReviewStatus === "owner_approved", `owner review missing: ${summary.recordId}`)
  assert(record.reviews?.machineReviewStatus === "machine_contract_passed_waiting_owner_visual_review", `machine review missing: ${summary.recordId}`)
  assert(record.gameUseContract?.directWorldDisplayAllowed === false, `direct world display must be blocked: ${summary.recordId}`)
  assert(record.gameUseContract?.directRuntimeFrameUseAllowed === false, `direct RuntimeFrame use must be blocked: ${summary.recordId}`)
  assert(record.originalImage?.width === 1024 && record.originalImage?.height === 768, `native image size invalid: ${summary.recordId}`)

  const sourceImagePath = resolveProjectPath(path.join(record.relativeDirectory, record.originalImage.path))
  verifyHash(sourceImagePath, record.originalImage.sha256, `image hash mismatch: ${summary.recordId}`)
  const promptPath = resolveProjectPath(record.aiAssistedColdStart.promptEvidencePath)
  verifyHash(promptPath, record.aiAssistedColdStart.promptEvidenceSha256, `prompt hash mismatch: ${summary.recordId}`)
  const machineReviewPath = resolveProjectPath(record.reviews.machineReviewPath)
  const ownerReviewPath = resolveProjectPath(record.reviews.ownerReviewPath)
  const machineReview = readRequiredJson(machineReviewPath)
  const ownerReview = readRequiredJson(ownerReviewPath)
  assert(machineReview.passed === true && machineReview.imageSha256 === record.originalImage.sha256, `machine review invalid: ${summary.recordId}`)
  assert(ownerReview.decision === "owner_approved" && ownerReview.imageSha256 === record.originalImage.sha256, `owner review invalid: ${summary.recordId}`)

  const packageImagePath = path.join(packageDir, "images", record.categoryId, `${record.recordId}.png`)
  fs.mkdirSync(path.dirname(packageImagePath), { recursive: true })
  fs.copyFileSync(sourceImagePath, packageImagePath)
  verifyHash(packageImagePath, record.originalImage.sha256, `packaged image hash mismatch: ${summary.recordId}`)

  const conditionPackPath = record.worldBinding?.conditionPackPath ?? null
  const conditionWorldId = record.conditionBinding?.worldId ?? record.worldBinding?.worldId ?? null
  const currentConditionRow = conditionWorldId ? currentConditionByWorldId.get(conditionWorldId) : null
  const conditionReferencePresent = record.categoryId === "complete-maps"
    && Boolean(record.worldBinding?.taskPackageId)
    && Boolean(conditionPackPath)
    && fs.existsSync(conditionPackPath ? resolveProjectPath(conditionPackPath) : "")
  const currentConditionIdentityMatches = Boolean(currentConditionRow)
    && record.worldBinding?.taskPackageId === currentConditionRow.taskId
    && conditionPackPath === currentConditionRow.conditionPackPath
  const v7CapacityContribution = record.v7CapacityContribution?.status === "registered"
    ? validateV7CapacityContribution(record, machineReview)
    : null
  const v7CapacityContributionRegistered = Boolean(v7CapacityContribution)
  const conditionIdentityMatches = currentConditionIdentityMatches || v7CapacityContributionRegistered
  const conditionBound = conditionReferencePresent
    && conditionIdentityMatches
    && record.conditionBinding?.formalConditionalTrainingEligible === true
    && machineReview.semanticConditionAudit?.passed === true
  const trainingRoles = []
  if (record.categoryId === "complete-maps") trainingRoles.push("rgb_autoencoder_warmup")
  else trainingRoles.push("visual_knowledge_reference")
  if (conditionBound) trainingRoles.push("conditional_denoiser")

  return {
    sampleId: record.recordId,
    recordId: record.recordId,
    title: record.title,
    categoryId: record.categoryId,
    split: v7CapacityContribution?.split ?? split,
    trainingRoles,
    imagePath: projectPath(packageImagePath),
    imageSha256: record.originalImage.sha256,
    width: 1024,
    height: 768,
    sourceRecordPath: record.recordPath,
    sourceRecordSha256: sha256(fs.readFileSync(resolveProjectPath(record.recordPath))),
    promptEvidencePath: record.aiAssistedColdStart.promptEvidencePath,
    promptEvidenceSha256: record.aiAssistedColdStart.promptEvidenceSha256,
    machineReviewPath: record.reviews.machineReviewPath,
    machineReviewSha256: sha256(fs.readFileSync(machineReviewPath)),
    ownerReviewPath: record.reviews.ownerReviewPath,
    ownerReviewSha256: sha256(fs.readFileSync(ownerReviewPath)),
    ownerReviewStatus: "owner_approved",
    machineReviewStatus: "passed",
    worldProfileId: record.worldBinding.worldProfileId,
    snapshotId: record.worldBinding.snapshotId,
    classification: record.classification,
    taskPackageId: record.worldBinding?.taskPackageId ?? null,
    conditionPackPath,
    conditionLabel: currentConditionRow?.conditionLabel ?? v7CapacityContribution?.conditionLabel ?? null,
    conditionWorldId,
    conditionGenerationContractVersion: currentConditionRow?.generationContractVersion ?? v7CapacityContribution?.conditionGenerationContractVersion ?? null,
    currentConditionIdentityMatches,
    v7CapacityContributionRegistered,
    v7CapacitySlotId: v7CapacityContribution?.capacitySlotId ?? null,
    v7CapacityContributionPath: v7CapacityContribution?.contributionPath ?? null,
    v7CapacityContributionSha256: v7CapacityContribution?.contributionSha256 ?? null,
    conditionReferencePresent,
    conditionBindingStatus: record.conditionBinding?.status ?? null,
    formalConditionalTrainingEligible: record.conditionBinding?.formalConditionalTrainingEligible === true,
    conditionBound,
    realEarthRegionId:
      record.conditionBinding?.realEarthRegionId ?? null,
    realEarthRegionSourcePackageId:
      record.conditionBinding?.realEarthRegionSourcePackageId ?? null,
    realEarthRegionSourcePackagePath:
      record.conditionBinding?.realEarthRegionSourcePackagePath ?? null,
    realEarthRegionSourcePackageSha256:
      record.conditionBinding?.realEarthRegionSourcePackageSha256 ?? null,
    connectivityBlueprintId:
      record.conditionBinding?.connectivityBlueprintId ?? null,
    connectivityBlueprintPath:
      record.conditionBinding?.connectivityBlueprintPath ?? null,
    structuralIdentities:
      record.conditionBinding?.structuralIdentities ?? null,
    connectivityBinding: record.worldBinding?.connectivityBinding ?? null,
    policyVersion: POLICY_VERSION,
    ownerAuthorizationRef: record.aiAssistedColdStart.ownerAuthorizationRef,
    independentTrainingEligible: false,
    aiAssistedColdStartEligible: true,
    thirdPartyWeightsLoaded: false,
    thirdPartyGeneratedTrainingOutputUsed: true,
    directWorldDisplayAllowed: false,
    directRuntimeFrameUseAllowed: false,
  }
}

function validateV7CapacityContribution(record, machineReview) {
  const pointer = record.v7CapacityContribution
  verifyHash(resolveProjectPath(pointer.contributionPath), pointer.contributionSha256, `V7 contribution hash mismatch: ${record.recordId}`)
  const contribution = readRequiredJson(pointer.contributionPath)
  const taskPackage = readRequiredJson(record.worldBinding.taskPackagePath)
  assert(contribution.schemaVersion === "ai-assisted-v7-capacity-contribution-v1", `V7 contribution schema invalid: ${record.recordId}`)
  assert(contribution.recordId === record.recordId, `V7 contribution record mismatch: ${record.recordId}`)
  assert(contribution.capacitySlotId === pointer.capacitySlotId, `V7 contribution slot mismatch: ${record.recordId}`)
  assert(contribution.split === pointer.split, `V7 contribution split mismatch: ${record.recordId}`)
  assert(contribution.imageSha256 === record.originalImage.sha256, `V7 contribution image mismatch: ${record.recordId}`)
  assert(contribution.taskPackageId === record.worldBinding.taskPackageId, `V7 contribution task mismatch: ${record.recordId}`)
  assert(contribution.conditionWorldId === record.worldBinding.worldId, `V7 contribution world mismatch: ${record.recordId}`)
  assert(contribution.conditionPackPath === record.worldBinding.conditionPackPath, `V7 contribution condition path mismatch: ${record.recordId}`)
  assert(contribution.conditionChannelCount === 23, `V7 contribution channel count invalid: ${record.recordId}`)
  assert(machineReview.styleFingerprintAudit?.passed === true, `V7 style audit failed: ${record.recordId}`)
  assert(machineReview.compositionNoveltyAudit?.passed === true, `V7 novelty audit failed: ${record.recordId}`)
  const taskSlotBinding = taskPackage.capacitySlot ?? taskPackage.v7SlotBinding
  assert(taskSlotBinding?.slotId === contribution.capacitySlotId, `V7 task slot mismatch: ${record.recordId}`)
  assert(taskSlotBinding?.split === contribution.split, `V7 task split mismatch: ${record.recordId}`)
  assert(v7ConditionLabel(taskPackage, taskSlotBinding) === contribution.conditionLabel, `V7 condition label mismatch: ${record.recordId}`)
  assert(taskPackage.generationContractVersion === "complete-map-scope-world-facts-v2", `V7 condition contract invalid: ${record.recordId}`)
  return {
    capacitySlotId: contribution.capacitySlotId,
    split: contribution.split,
    conditionLabel: contribution.conditionLabel,
    conditionGenerationContractVersion: taskPackage.generationContractVersion,
    contributionPath: pointer.contributionPath,
    contributionSha256: pointer.contributionSha256,
  }
}

function v7ConditionLabel(taskPackage, taskSlotBinding) {
  return taskPackage.conditionLabel ?? `v7-complete-map-${taskSlotBinding.slotId.slice(-3)}`
}

function snapshotInputs(destinationRoot) {
  const sources = {
    originalImageIndex: INDEX_PATH,
    dictionary: dictionaryPointer.dictionaryPath,
    trainingDataPolicy: "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
    modelConfig: CONFIG_PATH,
    conditionalWorldFacts: conditionalFactsPointer.manifestPath,
    ...(trainingGateApprovalPointer?.approvalPath ? { trainingGateApproval: trainingGateApprovalPointer.approvalPath } : {}),
    connectivityCoverage: "data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json",
    connectivityCoverageManifest: connectivityCoveragePointer?.manifestPath,
  }
  const result = {}
  for (const [id, source] of Object.entries(sources).filter(([, source]) => Boolean(source))) {
    const sourcePath = resolveProjectPath(source)
    const destination = path.join(destinationRoot, "snapshots", `${id}${path.extname(sourcePath) || ".json"}`)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(sourcePath, destination)
    result[id] = { path: projectPath(destination), sha256: sha256(fs.readFileSync(destination)) }
  }
  return result
}

function validateConnectivityCoverageEvidence() {
  if (!connectivityCoveragePointer || !connectivityCoverageManifest) return false
  const manifestPath = connectivityCoveragePointer.manifestPath
  if (!manifestPath || !fs.existsSync(resolveProjectPath(manifestPath))) return false
  if (connectivityCoveragePointer.manifestSha256 !== sha256(fs.readFileSync(resolveProjectPath(manifestPath)))) return false
  if (connectivityCoverageManifest.schemaVersion !== "world-connectivity-coverage-dataset-v1") return false
  if (connectivityCoverageManifest.status !== "machine_verified_threshold_met") return false
  if (connectivityCoverageManifest.thresholdMet !== true) return false
  if (connectivityCoverageManifest.positiveRecordCount < connectivityThreshold.minimumPositiveRecordCount) return false
  if (connectivityCoverageManifest.negativeRecordCount < connectivityThreshold.minimumNegativeRecordCount) return false
  const axes = connectivityContract.trainingCoverageAxes ?? []
  if (axes.length !== 9) return false
  return axes.every((axis) => connectivityCoverageManifest.axisCounts?.[axis]?.positive >= connectivityThreshold.minimumPositivePerAxis
    && connectivityCoverageManifest.axisCounts?.[axis]?.negative >= connectivityThreshold.minimumNegativePerAxis)
}

function splitForIndex(indexValue) {
  const bucket = indexValue % 10
  if (bucket <= 6) return "train"
  if (bucket === 7) return "validation"
  if (bucket === 8) return "challenge"
  return "regression"
}

function countBy(rows, selector) {
  const counts = {}
  for (const row of rows) {
    const key = selector(row)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function verifyHash(filePath, expected, message) {
  assert(fs.existsSync(filePath), `file missing: ${projectPath(filePath)}`)
  assert(sha256(fs.readFileSync(filePath)) === expected, message)
}

function readRequiredJson(value) {
  const result = readOptionalJson(value)
  assert(result, `required JSON missing: ${value}`)
  return result
}

function readOptionalJson(value) {
  try { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) } catch { return null }
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`)
  return resolved
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function indexGeneratedPackageArtifacts(packageRoot, pointerPath) {
  const files = [...collectFiles(packageRoot), pointerPath]
  for (const filePath of files) {
    const stat = fs.statSync(filePath)
    indexArtifact({
      logicalPath: logicalProjectPath(filePath),
      physicalUri: fs.realpathSync(filePath),
      storageLayer: "hot",
      runId: packageId,
      artifactType: "ai_assisted_cold_start_dataset_package",
      byteSize: stat.size,
      modifiedAtUtc: stat.mtime.toISOString(),
      sha256: sha256(fs.readFileSync(filePath)),
    })
  }
  return files.length
}

function collectFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(entryPath))
    else if (entry.isFile()) files.push(entryPath)
  }
  return files
}

function projectPath(filePath) { return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, "/") }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
