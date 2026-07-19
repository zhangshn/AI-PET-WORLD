import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const modelConfig = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v2.json")
const pointer = readJson("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const manifest = pointer?.manifestPath ? readJson(pointer.manifestPath) : null
const sourceIndex = manifest?.sourceIndexPath ? readJson(manifest.sourceIndexPath) : null
const conditionalFactsManifest = manifest?.conditionalFactsManifestPath ? readJson(manifest.conditionalFactsManifestPath) : null
const trainingGateApproval = manifest?.trainingGateApprovalPath ? readJson(manifest.trainingGateApprovalPath) : null
const connectivityCoverageManifest = manifest?.connectivityCoverage?.manifestPath
  ? readJson(manifest.connectivityCoverage.manifestPath)
  : null
const failures = []

check(Boolean(pointer), "ai_assisted_dataset_pointer_missing")
check(Boolean(manifest), "ai_assisted_dataset_manifest_missing")
check(Boolean(sourceIndex), "ai_assisted_dataset_source_index_missing")
check(Boolean(conditionalFactsManifest), "conditional_world_facts_manifest_missing")
check(Boolean(trainingGateApproval), "training_gate_owner_approval_missing")
check(Boolean(connectivityCoverageManifest), "connectivity_coverage_manifest_missing")
if (pointer && manifest && sourceIndex && conditionalFactsManifest && trainingGateApproval && connectivityCoverageManifest) {
  check(manifest.schemaVersion === "ai-assisted-cold-start-dataset-package-v1", "ai_assisted_dataset_schema_invalid")
  check(manifest.packageId === pointer.packageId, "ai_assisted_dataset_identity_mismatch")
  check(manifest.policyVersion === "owner-authorized-ai-assisted-cold-start-v1", "ai_assisted_dataset_policy_invalid")
  check(manifest.trainingLane === "ai_assisted_cold_start", "ai_assisted_dataset_lane_invalid")
  check(manifest.checkpointOwnership === "project_owned_architecture_ai_assisted_cold_start_weights", "ai_assisted_checkpoint_ownership_invalid")
  check(manifest.modelConfigId === modelConfig?.modelId, "ai_assisted_model_config_identity_invalid")
  check(manifest.modelArchitectureVersion === modelConfig?.architectureVersion, "ai_assisted_model_architecture_version_invalid")
  check(manifest.immutable === true && manifest.automaticStorage === true, "ai_assisted_dataset_not_immutable_or_program_saved")
  check(manifest.canStartFormalTraining === false && manifest.formalInferenceEligible === false, "ai_assisted_dataset_must_not_claim_formal_readiness")
  check(manifest.canTrainConditionalDenoiser === true, "conditional_training_gate_not_open_after_connectivity_coverage_met")
  check(manifest.thirdPartyWeightsLoaded === false, "third_party_weights_must_not_be_loaded")
  check(manifest.thirdPartyGeneratedTrainingOutputUsed === true && manifest.aiGenerationDependencyDeclared === true, "AI_generation_dependency_not_declared")
  check(sourceIndex.packageId === manifest.packageId, "ai_assisted_source_index_identity_mismatch")
  check(sourceIndex.sampleCount === manifest.sampleCount, "ai_assisted_sample_count_mismatch")
  check(manifest.conditionOnlyBlueprintCount === 21, "condition_only_blueprint_count_invalid")
  check(sourceIndex.conditionOnlyBlueprintCount === manifest.conditionOnlyBlueprintCount, "condition_only_blueprint_count_mismatch")
  check(manifest.currentConditionExpectedCount === 21, "current_condition_expected_count_invalid")
  check(manifest.currentConditionPairCount === 21, "current_condition_pair_count_incomplete")
  check(manifest.currentConditionUnpairedCount === 0, "current_condition_unpaired_count_nonzero")
  check(manifest.conditionBoundCompleteMapCount === manifest.currentConditionPairCount, "current_condition_pair_manifest_count_mismatch")
  check(sourceIndex.currentConditionPairCount === manifest.currentConditionPairCount, "current_condition_pair_source_index_count_mismatch")
  check(sourceIndex.currentConditionUnpairedCount === manifest.currentConditionUnpairedCount, "current_condition_unpaired_source_index_count_mismatch")
  check(conditionalFactsManifest.batchId === manifest.conditionalFactsBatchId, "conditional_world_facts_batch_identity_mismatch")
  check(conditionalFactsManifest.sourceImageGeometryRead === false, "conditional_world_facts_must_not_read_rgb_geometry")
  check(conditionalFactsManifest.existingRgbBoundToGeneratedConditions === false, "existing_rgb_must_not_be_rebound")
  check(conditionalFactsManifest.pairedRgbCount === 0, "condition_only_blueprints_must_not_claim_rgb_pairs")
  validateHash(manifest.conditionalFactsManifestPath, manifest.conditionalFactsManifestSha256, "conditional_world_facts_manifest_hash_mismatch")
  validateHash(manifest.trainingGateApprovalPath, manifest.trainingGateApprovalSha256, "training_gate_owner_approval_hash_mismatch")
  check(trainingGateApproval.approvals?.conditionalDenoiserThreshold?.minimumCurrentConditionPairCount === 21, "conditional_training_owner_threshold_invalid")
  check(trainingGateApproval.approvals?.autoencoderV2VisualReview?.decision === "approved", "autoencoder_v2_owner_visual_review_missing")
  check(trainingGateApproval.approvals?.worldConnectivityCoverageThreshold?.minimumPositiveRecordCount === 27, "connectivity_positive_threshold_invalid")
  check(trainingGateApproval.approvals?.worldConnectivityCoverageThreshold?.minimumNegativeRecordCount === 27, "connectivity_negative_threshold_invalid")
  check(trainingGateApproval.approvals?.worldConnectivityCoverageThreshold?.minimumPositivePerAxis === 3, "connectivity_positive_per_axis_threshold_invalid")
  check(trainingGateApproval.approvals?.worldConnectivityCoverageThreshold?.minimumNegativePerAxis === 3, "connectivity_negative_per_axis_threshold_invalid")
  check(manifest.trainingGateStatus?.conditionalThresholdApproved === true, "conditional_training_threshold_not_applied")
  check(manifest.trainingGateStatus?.autoencoderVisualApproved === true, "autoencoder_visual_approval_not_applied")
  check(manifest.trainingGateStatus?.connectivityThresholdApproved === true, "connectivity_threshold_approval_not_applied")
  check(manifest.trainingGateStatus?.connectivityCoverageMet === true, "connectivity_coverage_not_applied")
  check(manifest.connectivityCoverage?.thresholdMet === true, "connectivity_coverage_threshold_not_met")
  check(manifest.connectivityCoverage?.evidenceValid === true, "connectivity_coverage_evidence_invalid")
  check(connectivityCoverageManifest.schemaVersion === "world-connectivity-coverage-dataset-v1", "connectivity_coverage_schema_invalid")
  check(connectivityCoverageManifest.status === "machine_verified_threshold_met", "connectivity_coverage_status_invalid")
  check(connectivityCoverageManifest.positiveRecordCount === 27, "connectivity_positive_record_count_invalid")
  check(connectivityCoverageManifest.negativeRecordCount === 27, "connectivity_negative_record_count_invalid")
  check(connectivityCoverageManifest.recordCount === 54, "connectivity_record_count_invalid")
  check(connectivityCoverageManifest.thresholdMet === true, "connectivity_coverage_manifest_threshold_not_met")
  validateHash(manifest.connectivityCoverage.manifestPath, manifest.connectivityCoverage.manifestSha256, "connectivity_coverage_manifest_hash_mismatch")
  for (const counts of Object.values(connectivityCoverageManifest.axisCounts ?? {})) {
    check(counts.positive >= 3 && counts.negative >= 3, "connectivity_axis_threshold_invalid")
  }
  check(!(manifest.blockers ?? []).includes("ai_assisted_conditional_training_threshold_pending_owner_approval"), "approved_conditional_threshold_still_blocked_as_pending")
  check(!(manifest.blockers ?? []).includes("ai_assisted_autoencoder_v2_visual_review_pending_owner_approval"), "approved_autoencoder_visual_review_still_blocked_as_pending")
  check(!(manifest.blockers ?? []).includes("world_connectivity_coverage_thresholds_pending"), "approved_connectivity_threshold_still_blocked_as_pending")
  check((manifest.blockers ?? []).length === 0, "conditional_training_blockers_remain_after_all_gates_met")
  check(!(manifest.blockers ?? []).includes("condition_blueprints_require_new_rgb_pairs"), "completed_condition_pairs_must_not_keep_rgb_pair_blocker")
  for (const sample of sourceIndex.samples ?? []) validateSample(sample)
  validateCurrentConditionPairCoverage(sourceIndex)
  for (const blueprint of sourceIndex.conditionOnlyBlueprints ?? []) validateConditionOnlyBlueprint(blueprint)
  for (const snapshot of Object.values(manifest.snapshots ?? {})) validateHash(snapshot.path, snapshot.sha256, `snapshot_hash_mismatch:${snapshot.path}`)
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "ai_assisted_cold_start_dataset_package_check_passed" : "ai_assisted_cold_start_dataset_package_check_failed",
  packageId: manifest?.packageId ?? null,
  packageStatus: manifest?.status ?? null,
  sampleCount: manifest?.sampleCount ?? 0,
  categoryCounts: manifest?.categoryCounts ?? {},
  autoencoderSampleCount: manifest?.autoencoderSampleCount ?? 0,
  conditionBoundCompleteMapCount: manifest?.conditionBoundCompleteMapCount ?? 0,
  currentConditionPairCount: manifest?.currentConditionPairCount ?? 0,
  currentConditionUnpairedCount: manifest?.currentConditionUnpairedCount ?? 0,
  conditionOnlyBlueprintCount: manifest?.conditionOnlyBlueprintCount ?? 0,
  canStartAutoencoderWarmup: manifest?.canStartAutoencoderWarmup ?? false,
  canTrainConditionalDenoiser: manifest?.canTrainConditionalDenoiser ?? false,
  blockers: manifest?.blockers ?? [],
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function validateConditionOnlyBlueprint(blueprint) {
  check(blueprint.channelCount === 23, `condition_only_channel_count_invalid:${blueprint.sourceRecordId}`)
  check(blueprint.existingRgbBound === false && blueprint.needsNewRgbPair === true, `condition_only_rgb_boundary_invalid:${blueprint.sourceRecordId}`)
  validateHash(blueprint.blueprintPath, blueprint.blueprintSha256, `condition_only_blueprint_hash_mismatch:${blueprint.sourceRecordId}`)
  validateHash(blueprint.directorOutputPath, blueprint.directorOutputSha256, `condition_only_director_hash_mismatch:${blueprint.sourceRecordId}`)
  validateHash(blueprint.taskPackagePath, blueprint.taskPackageSha256, `condition_only_task_hash_mismatch:${blueprint.sourceRecordId}`)
  validateHash(blueprint.conditionPackPath, blueprint.conditionPackFileSha256, `condition_only_pack_file_hash_mismatch:${blueprint.sourceRecordId}`)
  const conditionPack = readJson(blueprint.conditionPackPath)
  check(conditionPack?.conditionPackSha256 === blueprint.conditionPackSha256, `condition_only_pack_canonical_hash_mismatch:${blueprint.sourceRecordId}`)
}

function validateSample(sample) {
  check(sample.policyVersion === "owner-authorized-ai-assisted-cold-start-v1", `sample_policy_invalid:${sample.sampleId}`)
  check(sample.aiAssistedColdStartEligible === true && sample.independentTrainingEligible === false, `sample_lane_invalid:${sample.sampleId}`)
  check(sample.thirdPartyWeightsLoaded === false && sample.thirdPartyGeneratedTrainingOutputUsed === true, `sample_provenance_invalid:${sample.sampleId}`)
  check(sample.ownerReviewStatus === "owner_approved" && sample.machineReviewStatus === "passed", `sample_review_invalid:${sample.sampleId}`)
  check(sample.width === 1024 && sample.height === 768, `sample_size_invalid:${sample.sampleId}`)
  check(sample.directWorldDisplayAllowed === false && sample.directRuntimeFrameUseAllowed === false, `sample_direct_game_use_invalid:${sample.sampleId}`)
  validateHash(sample.imagePath, sample.imageSha256, `sample_image_hash_mismatch:${sample.sampleId}`)
  validateHash(sample.sourceRecordPath, sample.sourceRecordSha256, `sample_record_hash_mismatch:${sample.sampleId}`)
  validateHash(sample.promptEvidencePath, sample.promptEvidenceSha256, `sample_prompt_hash_mismatch:${sample.sampleId}`)
  validateHash(sample.machineReviewPath, sample.machineReviewSha256, `sample_machine_review_hash_mismatch:${sample.sampleId}`)
  validateHash(sample.ownerReviewPath, sample.ownerReviewSha256, `sample_owner_review_hash_mismatch:${sample.sampleId}`)
  if (sample.trainingRoles?.includes("conditional_denoiser")) {
    check(sample.conditionBound === true && Boolean(sample.conditionPackPath), `conditional_sample_binding_missing:${sample.sampleId}`)
    check(sample.currentConditionIdentityMatches === true, `conditional_sample_current_identity_mismatch:${sample.sampleId}`)
    check(sample.conditionGenerationContractVersion === "complete-map-scope-world-facts-v2", `conditional_sample_contract_invalid:${sample.sampleId}`)
    check(/^complete-map-v2-\d{3}$/.test(sample.conditionLabel ?? ""), `conditional_sample_label_invalid:${sample.sampleId}`)
  }
}

function validateCurrentConditionPairCoverage(index) {
  const pairs = index.currentConditionPairs ?? []
  const pairWorldIds = new Set(pairs.map((pair) => pair.worldId))
  const blueprintWorldIds = new Set((index.conditionOnlyBlueprints ?? []).map((row) => row.worldId))
  check(pairs.length === 21 && pairWorldIds.size === 21, "current_condition_pair_identities_not_unique_or_complete")
  check(blueprintWorldIds.size === 21, "current_condition_blueprint_world_identities_invalid")
  for (const worldId of blueprintWorldIds) check(pairWorldIds.has(worldId), `current_condition_pair_missing:${worldId}`)
}

function validateHash(value, expected, message) {
  const filePath = resolveProjectPath(value)
  check(fs.existsSync(filePath), `file_missing:${value}`)
  if (fs.existsSync(filePath)) check(sha256(fs.readFileSync(filePath)) === expected, message)
}

function readJson(value) { try { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) } catch { return null } }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project root: ${value}`); return resolved }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function check(condition, message) { if (!condition && !failures.includes(message)) failures.push(message) }
