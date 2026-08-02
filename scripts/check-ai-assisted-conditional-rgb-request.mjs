import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { auditCompleteMapScope } from "./lib/complete-map-scope-gate.mjs"
import { validateFoundationalCompleteMapVisualStandard } from "./lib/foundational-complete-map-visual-standard.mjs"
import { validateGenerationInputHistoryBoundary } from "./lib/generation-input-history-boundary.mjs"

const ROOT = process.cwd()
const failures = []
const explicitRequestPath = argumentValue("--request")
const latest = readJsonSafe(".runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests/latest.json")
if (!latest && !explicitRequestPath) failPreflight("conditional_rgb_latest_pointer_missing")
const selectedRequestPath = explicitRequestPath ?? latest?.requestPath
if (!selectedRequestPath) failPreflight("conditional_rgb_request_path_missing")
const request = readJsonSafe(selectedRequestPath)
if (!request) failPreflight(`conditional_rgb_request_unreadable:${selectedRequestPath}`)
if (!explicitRequestPath && latest?.requestId !== request.requestId) {
  failPreflight(`conditional_rgb_latest_pointer_identity_mismatch:${latest?.requestId}:${request.requestId}`)
}
for (const [field, value] of [
  ["promptEvidencePath", request.promptEvidencePath],
  ["taskPackagePath", request.taskPackagePath],
  ["conditionPackPath", request.conditionPackPath],
  ["conditionGuideManifestPath", request.conditionGuideManifestPath],
  ["foundationalVisualStandardPath", request.foundationalVisualStandardPath],
  ["completeMapScopeAuditPath", request.completeMapScopeAuditPath],
  ["preRgbConditionGuideNoveltyAuditPath", request.preRgbConditionGuideNoveltyAuditPath],
]) {
  if (!value) failPreflight(`conditional_rgb_request_required_path_missing:${field}`)
}
const evidence = readJson(request.promptEvidencePath)
for (const [field, value] of [
  ["sourceConditionBlueprintPath", evidence.sourceConditionBlueprintPath],
  ["directorOutputPath", evidence.directorOutputPath],
  ["taskPackagePath", evidence.taskPackagePath],
  ["conditionPackPath", evidence.conditionPackPath],
  ["foundationalVisualStandardPath", evidence.foundationalVisualStandardPath],
  ["completeMapScopeAuditPath", evidence.completeMapScopeAuditPath],
]) {
  if (!value) failPreflight(`conditional_rgb_prompt_evidence_required_path_missing:${field}`)
}
const blueprint = readJson(evidence.sourceConditionBlueprintPath)
const director = readJson(evidence.directorOutputPath)
const task = readJson(evidence.taskPackagePath)
const conditionPack = readJson(evidence.conditionPackPath)
const guideManifest = readJson(request.conditionGuideManifestPath)
const connectivityBlueprint = readJson(blueprint.connectivityBlueprintPath)
const visualStandard = readJson(evidence.foundationalVisualStandardPath)
const persistedScopeAudit = readJson(evidence.completeMapScopeAuditPath)
const routeConditionAudit = await auditRouteCondition(conditionPack)
const completeMapScopeAudit = await auditCompleteMapScope({ blueprint, directorOutput: director, task, conditionPack, connectivityBlueprint })
const visualStandardValidation = validateFoundationalCompleteMapVisualStandard(visualStandard)
const generationInputHistoryBoundary =
  validateGenerationInputHistoryBoundary({
    root: ROOT,
    request,
    evidence,
    guideManifest,
    conditionPack,
    visualStandard,
  })
const preRgbNoveltyAudit = readJson(
  request.preRgbConditionGuideNoveltyAuditPath,
)
check(
  sha256(
    fs.readFileSync(
      resolveProjectPath(
        request.preRgbConditionGuideNoveltyAuditPath,
      ),
    ),
  ) === request.preRgbConditionGuideNoveltyAuditSha256,
  "pre_rgb_condition_guide_novelty_audit_hash_mismatch",
)
check(
  preRgbNoveltyAudit.passed === true &&
    preRgbNoveltyAudit
      .crossModalHistoricalRgbComparisonIncompleteCount === 0 &&
    preRgbNoveltyAudit
      .crossModalHistoricalRgbWaterShapeMatches?.length === 0 &&
    request.preRgbConditionGuideNoveltyGate
      ?.matchedCrossModalHistoricalRgbWaterShapeCount === 0 &&
    request.preRgbConditionGuideNoveltyGate
      ?.crossModalHistoricalRgbComparisonIncompleteCount === 0,
  "pre_rgb_cross_modal_historical_rgb_water_shape_gate_missing_or_failed",
)
const earthReferenceMode = request.earthReferenceSingleImageAuthorizationId
  === "owner-authorized-earth-reference-naturalized-complete-map-single-rgb-20260725"
const v7SlotSingleImageMode = Boolean(request.v7SlotSingleImageAuthorizationId)
const thailandRebuild64BatchAuthorizationIds = new Set([
  "owner-authorized-thailand-rebuild64-complete-batch-generation-20260731",
  "owner-authorized-thailand-rebuild64-remaining63-full-world-rgb-generation-20260801",
  "owner-authorized-thailand-rebuild64-failed8-rgb-replacements-20260801",
  "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-20260801",
])
const v7SlotBatchMode = thailandRebuild64BatchAuthorizationIds.has(
  request.v7SlotBatchAuthorizationId,
)
const v7SlotMode = v7SlotSingleImageMode || v7SlotBatchMode
const selectedEnvironmentState = blueprint.environmentContext?.environmentState
  ?? blueprint.environmentContext?.monsoonPhase

check(
  request.sourceRecordId === (
    earthReferenceMode
      ? blueprint.conditionLabel
      : v7SlotMode
        ? director.v7SlotBinding?.slotId
      : (blueprint.sourceRecordId ?? blueprint.capacitySlotId ?? blueprint.rebuildId)
  ),
  "source_record_blueprint_mismatch",
)
if (/^v7-capacity-slot-\d{3}$/.test(request.sourceRecordId ?? "")) {
  const slotIdentity = /^v7-capacity-slot-(\d{3})$/.exec(request.sourceRecordId)
  const singleImageAuthorizationIdentity = /^project-owner-authorization-\d{4}-\d{2}-\d{2}-v7-capacity-slot-(\d{3})-single-rgb-generation(?:-attempt-\d+)?$/.exec(
    request.v7SlotSingleImageAuthorizationId ?? "",
  )
  if (singleImageAuthorizationIdentity) {
    check(
      singleImageAuthorizationIdentity[1] === slotIdentity?.[1],
      "v7_slot_single_image_authorization_identity_mismatch",
    )
    check(request.continuousBatchAuthorizationId === null, "v7_slot_single_image_must_not_use_continuous_batch_authorization")
    check(request.automaticNextGenerationAuthorized === false, "v7_slot_single_image_must_not_authorize_next_generation")
    check(request.automaticRetryAuthorized === false, "v7_slot_single_image_must_not_authorize_retry")
  } else if (v7SlotBatchMode) {
    check(
      thailandRebuild64BatchAuthorizationIds.has(
        request.v7SlotBatchAuthorizationId,
      ),
      "thailand_rebuild64_batch_authorization_mismatch",
    )
    check(
      request.continuousBatchAuthorizationId === null,
      "thailand_rebuild64_batch_must_use_its_dedicated_authorization_field",
    )
    check(
      request.automaticNextGenerationAuthorized === false,
      "thailand_rebuild64_each_request_must_not_self_authorize_next_generation",
    )
  } else {
    check(request.continuousBatchAuthorizationId === "owner-authorized-v7-remaining-104-continuous-batch-20260723", "v7_continuous_batch_authorization_mismatch")
  }
  check(request.ownerApprovalAutomatic === false, "v7_owner_approval_must_remain_manual")
  check(request.capacityContributionAutomaticBeforeOwnerApproval === false, "v7_capacity_contribution_must_wait_for_owner_review")
  check(request.gpuTrainingAuthorized === false, "v7_gpu_training_must_remain_blocked")
  const sourcePackage = readJson(
    blueprint.realEarthRegionSourcePackagePath,
  )
  check(
    sourcePackage.packageId === blueprint.realEarthRegionSourcePackageId
      && sourcePackage.packageSha256 ===
        blueprint.realEarthRegionSourcePackageSha256
      && sourcePackage.scope?.currentMvpRegionScope ===
        "thailand_sakaerat_wang_nam_khiao_only"
      && sourcePackage.scope?.reusableOutsideThailand === false,
    "real_earth_region_source_package_missing",
  )
  check(
    connectivityBlueprint.identityBoundary
      ?.region0001InstanceInherited === false
      && connectivityBlueprint.anonymousTrainingCoordinateProjection
        ?.region0001ConcreteInstanceRead === false
      && connectivityBlueprint.currentRegion?.neighborRegionIds?.length > 0,
    "concrete_region_connectivity_instance_reused",
  )
  check(
    /^[a-f0-9]{64}$/.test(
      evidence.structuralIdentities
        ?.themeArchitectureIdentity ?? "",
    )
      && /^[a-f0-9]{64}$/.test(
        evidence.structuralIdentities
          ?.instanceDetailIdentity ?? "",
      )
      && sameJson(
        evidence.structuralIdentities,
        blueprint.structuralIdentities,
      ),
    "complete_map_structural_identity_missing",
  )
}
if (/^autonomous-world-rebuild-\d{3}$/.test(request.sourceRecordId ?? "")) {
  const rebuildIdentity = /^autonomous-world-rebuild-(\d{3})$/.exec(request.sourceRecordId)
  const authorizationIdentity = /^owner-authorized-autonomous-world-rebuild-(\d{3})-single-rgb-(\d{8})$/.exec(
    request.autonomySingleImageAuthorizationId ?? "",
  )
  check(request.conditionLabel === `autonomous-complete-map-${rebuildIdentity?.[1]}`, "autonomy_single_image_condition_mismatch")
  check(
    authorizationIdentity?.[1] === rebuildIdentity?.[1],
    "autonomy_single_image_authorization_mismatch",
  )
  check(request.continuousBatchAuthorizationId === null, "autonomy_single_image_must_not_use_continuous_batch_authorization")
  check(request.automaticNextGenerationAuthorized === false, "autonomy_single_image_must_not_authorize_next_generation")
  check(request.automaticRetryAuthorized === false, "autonomy_single_image_must_not_authorize_retry")
  check(request.ownerApprovalAutomatic === false, "autonomy_single_image_owner_approval_must_remain_manual")
  check(request.capacityContributionAutomaticBeforeOwnerApproval === false, "autonomy_single_image_capacity_contribution_must_wait_for_owner_review")
  check(request.gpuTrainingAuthorized === false, "autonomy_single_image_gpu_training_must_remain_blocked")
}
if (earthReferenceMode) {
  check(
    request.conditionLabel === blueprint.conditionLabel
      && /^earth-reference-naturalized-complete-map-[a-f0-9]{12}$/.test(request.conditionLabel ?? ""),
    "earth_reference_single_image_condition_mismatch",
  )
  check(request.continuousBatchAuthorizationId === null, "earth_reference_single_image_must_not_use_continuous_batch_authorization")
  check(request.automaticNextGenerationAuthorized === false, "earth_reference_single_image_must_not_authorize_next_generation")
  check(request.automaticRetryAuthorized === false, "earth_reference_single_image_must_not_authorize_retry")
  check(request.ownerApprovalAutomatic === false, "earth_reference_single_image_owner_approval_must_remain_manual")
  check(request.capacityContributionAutomaticBeforeOwnerApproval === false, "earth_reference_single_image_capacity_contribution_must_wait_for_owner_review")
  check(request.gpuTrainingAuthorized === false, "earth_reference_single_image_gpu_training_must_remain_blocked")
  check(blueprint.sourceMode === "naturalized_earth_facts_plus_locked_connectivity", "earth_reference_source_mode_invalid")
  check(blueprint.sourceRgbRead === false, "earth_reference_source_rgb_must_not_be_read")
  check(blueprint.sourceImageGeometryRead === false, "earth_reference_source_image_geometry_must_not_be_read")
}
check(request.conditionLabel === blueprint.conditionLabel, "request_condition_label_mismatch")
check(request.generationContractVersion === blueprint.generationContractVersion, "request_generation_contract_version_mismatch")
check(evidence.conditionLabel === blueprint.conditionLabel, "prompt_condition_label_mismatch")
check(evidence.generationContractVersion === blueprint.generationContractVersion, "prompt_generation_contract_version_mismatch")
check(evidence.promptConstruction === "full_rectangular_world_plus_future_dynamic_readiness_plus_world_facts_director_23_channels_v10", "full_world_dynamic_prompt_contract_missing")
check(
  evidence.worldFrameContract?.contractVersion === "complete-rectangular-world-and-future-dynamic-readiness-v2"
    && evidence.worldFrameContract?.frameCoverage?.everyPixelMustResolveToInWorldSurfaceOrInWorldObject === true
    && evidence.worldFrameContract?.frameCoverage?.continuousWorldSurfaceMustFillRectangleEdgeToEdge === true
    && evidence.worldFrameContract?.frameCoverage?.externalBackdropAllowed === false
    && evidence.worldFrameContract?.frameCoverage?.solidColorMatteAllowed === false
    && evidence.worldFrameContract?.frameCoverage?.floatingMapOrIslandCutoutAllowed === false
    && evidence.worldFrameContract?.semanticDecomposition?.futureRuntimeMotionReserved === true,
  "full_world_dynamic_readiness_evidence_missing",
)
check(
  evidence.conditionGuideFullWorldRenderingContract?.contractVersion === "complete-rectangular-world-and-future-dynamic-readiness-v2"
    && evidence.conditionGuideFullWorldRenderingContract?.everyPixelIsInWorld === true
    && evidence.conditionGuideFullWorldRenderingContract?.baseSurfaceCoverageRatio === 1
    && evidence.conditionGuideFullWorldRenderingContract?.naturalBoundarySemantic === "dense_in_world_edge_ecology_not_external_background"
    && evidence.conditionGuideFullWorldRenderingContract?.externalBackdropAllowed === false
    && evidence.conditionGuideFullWorldRenderingContract?.floatingMapOrIslandCutoutAllowed === false,
  "condition_guide_full_world_rendering_contract_missing",
)
check(evidence.styleGuidanceMode === "versioned_foundational_complete_map_visual_standard_aggregate_only_v1", "foundational_visual_standard_guidance_contract_missing")
check(request.styleGuidanceMode === evidence.styleGuidanceMode, "request_style_guidance_mode_mismatch")
check(Array.isArray(evidence.styleReferences) && evidence.styleReferences.length === 0, "historical_complete_map_style_references_must_be_empty")
check(Array.isArray(evidence.styleReferenceRecordIds) && evidence.styleReferenceRecordIds.length === 0, "historical_complete_map_style_reference_ids_must_be_empty")
check(evidence.historicalCompleteMapImageReferencesUsed === false, "prompt_evidence_historical_complete_map_reference_block_missing")
check(request.historicalCompleteMapImageReferencesUsed === false, "request_historical_complete_map_reference_block_missing")
check(Array.isArray(request.referenceImagePaths) && request.referenceImagePaths.length === 1, "request_must_have_exactly_one_condition_guide_reference")
check(request.referenceImagePaths?.[0] === evidence.conditionGuidePath, "request_reference_must_be_condition_guide")
check(request.referenceImageRoles?.length === 1 && request.referenceImageRoles[0] === "authoritative_semantic_condition_guide", "request_reference_role_invalid")
for (const issue of generationInputHistoryBoundary.issues) {
  check(false, issue)
}
check(evidence.targetVisualContract === "generator-native-exact-four-three-no-smaller-than-1024x768-with-audited-training-derivative", "cold_start_source_contract_missing")
check(evidence.derivativePolicyVersion === "owner-approved-high-resolution-four-three-derivative-v1", "cold_start_derivative_policy_missing")
check(evidence.trainingDerivativeContract === "nearest-neighbor-no-crop-no-upscale-to-1024x768", "cold_start_training_derivative_contract_missing")
check(request.sourceContract === evidence.targetVisualContract, "request_source_contract_mismatch")
check(request.derivativePolicyVersion === evidence.derivativePolicyVersion, "request_derivative_policy_mismatch")
check(blueprint.environmentContext?.contractVersion === "world-visual-environment-context-v1", "blueprint_environment_context_missing")
check(evidence.environmentContextContractVersion === blueprint.environmentContext?.contractVersion, "prompt_environment_contract_mismatch")
check(sameJson(evidence.environmentContext, blueprint.environmentContext), "prompt_blueprint_environment_context_mismatch")
check(sameJson(request.environmentContext, blueprint.environmentContext), "request_blueprint_environment_context_mismatch")
if (earthReferenceMode || v7SlotMode) {
  check(task.directorPlan?.singleMapEcologyPlan?.season === blueprint.environmentContext?.season, "task_blueprint_season_mismatch")
  check(task.directorPlan?.singleMapMaterialPlan?.environmentState === selectedEnvironmentState, "task_blueprint_environment_state_mismatch")
  check(task.directorPlan?.singleMapMaterialPlan?.weather === blueprint.environmentContext?.weather, "task_blueprint_weather_mismatch")
  check(task.directorPlan?.singleMapMaterialPlan?.lighting === blueprint.environmentContext?.lighting, "task_blueprint_lighting_mismatch")
  check(task.directorPlan?.singleMapMaterialPlan?.groundMoisture === blueprint.environmentContext?.groundMoisture, "task_blueprint_ground_moisture_mismatch")
} else {
  check(sameJson(task.environmentContext, blueprint.environmentContext), "task_blueprint_environment_context_mismatch")
}
check(director.singleMapEcologyPlan?.season === blueprint.environmentContext?.season, "director_blueprint_season_mismatch")
check(director.singleMapMaterialPlan?.environmentState === selectedEnvironmentState, "director_blueprint_environment_state_mismatch")
check(evidence.semanticConditionSummary?.blueprintId === blueprint.blueprintId, "semantic_summary_blueprint_mismatch")
check(evidence.landscapeProfile?.typeId === blueprint.landscapeType, "landscape_profile_identity_mismatch")
check(evidence.semanticConditionSummary?.landscapeProfile?.typeId === blueprint.landscapeType, "semantic_summary_landscape_profile_mismatch")
for (const feature of evidence.landscapeProfile?.requiredFeatures ?? []) {
  check(evidence.prompt.includes(feature), `required_landscape_feature_missing_from_prompt:${feature}`)
}
check(evidence.semanticConditionSummary?.directorLayoutIntent === director.compositionPlan?.layoutIntent, "director_layout_intent_mismatch")
check(evidence.prompt.includes(blueprint.semanticRules.waterFlow), "selected_water_flow_missing_from_prompt")
check(evidence.prompt.includes(blueprint.semanticRules.routeIntent), "selected_route_intent_missing_from_prompt")
check(evidence.prompt.includes(boundsSummary("entrance", blueprint.geometry.entranceBounds)), "selected_entrance_bounds_missing_from_prompt")
check(evidence.prompt.includes("No preset home site"), "no_preset_home_site_policy_missing_from_prompt")
check(evidence.prompt.includes("focal_area model channel is an inactive all-zero compatibility channel"), "inactive_focal_area_policy_missing_from_prompt")
check(evidence.prompt.includes("The only image reference is the sole authority for this run's layout"), "condition_guide_layout_authority_missing")
check(evidence.prompt.includes("No historical complete-map RGB image is supplied as an image reference"), "historical_complete_map_reference_block_missing")
check(visualStandardValidation.passed, `foundational_visual_standard_invalid:${visualStandardValidation.issues.join(",")}`)
check(evidence.foundationalVisualStandardId === visualStandard.standardId, "foundational_visual_standard_identity_mismatch")
check(request.foundationalVisualStandardId === visualStandard.standardId, "request_foundational_visual_standard_identity_mismatch")
check(evidence.foundationalVisualStandardSha256 === sha256(fs.readFileSync(resolveProjectPath(evidence.foundationalVisualStandardPath))), "foundational_visual_standard_hash_mismatch")
check(sameJson(request.foundationalVisualStandardPromptProfile, visualStandard.generatorProfile), "request_foundational_visual_standard_profile_mismatch")
check(sameJson(evidence.foundationalVisualStandardPromptProfile, visualStandard.generatorProfile), "prompt_foundational_visual_standard_profile_mismatch")
check(evidence.foundationalVisualStandardSourceRecordIds?.length === 22, "foundational_visual_standard_source_count_mismatch")
check(evidence.prompt.includes("Versioned foundational complete-map visual standard"), "foundational_visual_standard_instruction_missing")
check(evidence.prompt.includes("A magnified river segment, road segment, pond, clearing, material patch or other local scene is forbidden"), "local_scene_prevention_instruction_missing")
check(evidence.prompt.includes(visualStandard.inputSha256), "foundational_visual_standard_input_identity_missing_from_prompt")
check(completeMapScopeAudit.passed, `complete_map_scope_failed:${completeMapScopeAudit.issues.join(",")}`)
check(persistedScopeAudit.passed === true, "persisted_complete_map_scope_audit_not_passed")
check(sameJson(evidence.completeMapScopeAudit, completeMapScopeAudit), "prompt_complete_map_scope_audit_mismatch")
check(sameJson(request.completeMapScopeAudit, completeMapScopeAudit), "request_complete_map_scope_audit_mismatch")
check(evidence.completeMapScopeAuditSha256 === sha256(fs.readFileSync(resolveProjectPath(evidence.completeMapScopeAuditPath))), "complete_map_scope_audit_hash_mismatch")
check(evidence.routeConditionProfile?.contractVersion === "route-condition-text-profile-v1", "route_condition_text_profile_missing")
check(evidence.routeConditionProfile?.channelId === "terrain_path_ground", "route_condition_text_profile_channel_invalid")
check(evidence.routeConditionProfile?.channelSha256 === conditionPack.channels?.find((entry) => entry.id === "terrain_path_ground")?.sha256, "route_condition_text_profile_hash_mismatch")
check(evidence.prompt.includes(`expectedNonZeroRatio=${evidence.routeConditionProfile.expectedNonZeroRatio}`), "route_condition_coverage_target_missing_from_prompt")
check(sameJson(request.routeConditionProfile, evidence.routeConditionProfile), "request_route_condition_text_profile_mismatch")
check(sameRouteAudit(evidence.routeConditionAudit, routeConditionAudit), "prompt_evidence_route_condition_audit_mismatch")
check(sameRouteAudit(request.routeConditionAudit, routeConditionAudit), "request_route_condition_audit_mismatch")
if (request.sequenceGate?.ownerAuthorizedRetry) {
  check(evidence.retryRepairProfile?.contractVersion === "owner-authorized-conditional-rgb-retry-repair-v1", "owner_authorized_retry_profile_missing")
  check(Boolean(evidence.retryRepairProfile?.reason), "owner_authorized_retry_reason_missing")
  check(evidence.prompt.includes(evidence.retryRepairProfile.reason), "owner_authorized_retry_reason_missing_from_prompt")
  check(sameJson(request.retryRepairProfile, evidence.retryRepairProfile), "request_retry_repair_profile_mismatch")
}
check(evidence.prompt.includes("exact 4:3 image at the generator's native high resolution"), "generator_native_four_three_instruction_missing")
check(evidence.prompt.includes("preserve the raw source unchanged"), "immutable_raw_source_instruction_missing")
check(evidence.prompt.includes("nearest-neighbor 1024x768 training derivative"), "training_derivative_instruction_missing")
for (const field of ["season", "environmentState", "weather", "lighting", "groundMoisture"]) {
  const value = field === "environmentState"
    ? selectedEnvironmentState
    : blueprint.environmentContext?.[field]
  check(Boolean(value), `environment_context_field_missing:${field}`)
  check(evidence.prompt.includes(value), `prompt_environment_field_missing:${field}`)
}
if (blueprint.environmentContext?.season === "dry_season") {
  check(!evidence.prompt.includes("wet-season post-rain"), "dry_season_prompt_contains_wet_season_text")
  check(!evidence.prompt.includes("moist tropical terrain"), "dry_season_prompt_contains_moist_terrain_text")
}
if (!(blueprint.geometry?.terrainRegions ?? []).some((region) => region.kind === "water")) {
  check(evidence.prompt.includes("Do not add visible surface water or shoreline"), "no_water_prompt_constraint_missing")
}
check(routeConditionAudit.pathWaterOverlapPixels === 0, "selected_path_overlaps_water_condition")
check(routeConditionAudit.pathCollisionOverlapPixels === 0, "selected_path_overlaps_collision_condition")
if (blueprint.semanticRules.waterFlow !== "river_left_north_to_south") {
  check(!evidence.prompt.includes("left-side connected north-to-south freshwater river"), "previous_blueprint_water_geometry_leaked_into_prompt")
}
if (blueprint.semanticRules.routeIntent !== "lower entrance to central clearing") {
  check(!evidence.prompt.includes("lower entrance, single dirt route into the central playable clearing"), "previous_blueprint_route_geometry_leaked_into_prompt")
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0
    ? "ai_assisted_conditional_rgb_request_check_passed"
    : "ai_assisted_conditional_rgb_request_check_failed",
  requestId: request.requestId,
  sourceRecordId: request.sourceRecordId,
  outputRecordId: request.outputRecordId,
  blueprintId: blueprint.blueprintId,
  waterFlow: blueprint.semanticRules.waterFlow,
  routeIntent: blueprint.semanticRules.routeIntent,
  directorLayoutIntent: director.compositionPlan.layoutIntent,
  environmentContext: blueprint.environmentContext,
  routeConditionAudit,
  completeMapScopeAudit,
  foundationalVisualStandardId: visualStandard.standardId,
  generationInputHistoryBoundary,
  failures,
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sameRouteAudit(left, right) {
  return ["pathPixels", "pathWaterOverlapPixels", "pathCollisionOverlapPixels"]
    .every((field) => left?.[field] === right?.[field])
}

console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function boundsSummary(label, bounds) {
  return `${label}Bounds=x:${bounds.x},y:${bounds.y},width:${bounds.width},height:${bounds.height}`
}
async function auditRouteCondition(conditionPack) {
  const water = await readConditionChannel(conditionPack, "terrain_water")
  const route = await readConditionChannel(conditionPack, "terrain_path_ground")
  const collision = await readConditionChannel(conditionPack, "collision")
  check(water.info.width === route.info.width && water.info.height === route.info.height, "path_water_condition_size_mismatch")
  check(collision.info.width === route.info.width && collision.info.height === route.info.height, "path_collision_condition_size_mismatch")
  let pathPixels = 0
  let pathWaterOverlapPixels = 0
  let pathCollisionOverlapPixels = 0
  for (let index = 0; index < route.data.length; index += 1) {
    if (route.data[index] === 0) continue
    pathPixels += 1
    if (water.data[index] > 0) pathWaterOverlapPixels += 1
    if (collision.data[index] > 0) pathCollisionOverlapPixels += 1
  }
  return {
    pathPixels,
    pathWaterOverlapPixels,
    pathCollisionOverlapPixels,
    pathWaterOverlapRatio: ratio(pathWaterOverlapPixels, pathPixels),
    pathCollisionOverlapRatio: ratio(pathCollisionOverlapPixels, pathPixels),
  }
}
async function readConditionChannel(conditionPack, channelId) {
  const channel = conditionPack.channels?.find((entry) => entry.id === channelId)
  if (!channel) throw new Error(`condition channel missing: ${channelId}`)
  return sharp(resolveProjectPath(channel.path), { failOn: "error" }).greyscale().raw().toBuffer({ resolveWithObject: true })
}
function ratio(value, total) { return total === 0 ? 0 : Number((value / total).toFixed(6)) }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function check(condition, failure) { if (!condition) failures.push(failure) }
function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function readJsonSafe(value) {
  if (!value) return null
  try {
    return readJson(value)
  } catch {
    return null
  }
}
function failPreflight(failure) {
  console.error(JSON.stringify({
    ok: false,
    status: "ai_assisted_conditional_rgb_request_check_failed",
    phase: "request_evidence_preflight",
    failures: [failure],
  }, null, 2))
  process.exit(1)
}
function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project: ${value}`)
  return resolved
}
