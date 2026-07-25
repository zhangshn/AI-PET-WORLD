import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  evaluateConditionalRgbGenerationSequence,
  readConditionalRgbGenerationRequests,
} from "./lib/ai-assisted-conditional-rgb-sequence-guard.mjs"
import {
  appendAiPainterProgramEvent,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import { auditCompleteMapScope } from "./lib/complete-map-scope-gate.mjs"
import { validateFoundationalCompleteMapVisualStandard } from "./lib/foundational-complete-map-visual-standard.mjs"

const ROOT = process.cwd()
const LEGACY_SOURCE_RECORD_ID = argumentValue("--source-record-id")
const V7_TASK_MANIFEST_ARG = argumentValue("--v7-task-manifest")
const AUTONOMY_TASK_MANIFEST_ARG = argumentValue("--autonomy-task-manifest")
const EARTH_TASK_MANIFEST_ARG = argumentValue("--earth-task-manifest")
const AUTONOMY_REBUILD_ID = argumentValue("--autonomy-rebuild-id")
const AUTONOMY_OWNER_AUTHORIZATION_ID = argumentValue("--owner-authorization-id")
const v7Mode = Boolean(V7_TASK_MANIFEST_ARG)
const autonomyMode = Boolean(AUTONOMY_TASK_MANIFEST_ARG || AUTONOMY_REBUILD_ID)
const earthMode = Boolean(EARTH_TASK_MANIFEST_ARG)
assert(
  [Boolean(LEGACY_SOURCE_RECORD_ID), v7Mode, autonomyMode, earthMode].filter(Boolean).length === 1,
  "use exactly one source mode",
)
assert(
  !autonomyMode || (AUTONOMY_TASK_MANIFEST_ARG && AUTONOMY_REBUILD_ID && AUTONOMY_OWNER_AUTHORIZATION_ID),
  "autonomy mode requires task manifest, rebuild id, and owner authorization id",
)
const v7TaskManifest = v7Mode ? readJson(V7_TASK_MANIFEST_ARG) : null
const autonomyTaskManifest = autonomyMode ? readJson(AUTONOMY_TASK_MANIFEST_ARG) : null
const earthTaskManifest = earthMode ? readJson(EARTH_TASK_MANIFEST_ARG) : null
const SOURCE_RECORD_ID = LEGACY_SOURCE_RECORD_ID
  ?? v7TaskManifest?.row?.capacitySlotId
  ?? AUTONOMY_REBUILD_ID
  ?? earthTaskManifest?.conditionLabel
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-cold-start", "conditional-rgb-generation-requests")
const SEQUENCE_BLOCK_ROOT = path.join(OUTPUT_ROOT, "sequence-blocks")
const PREPARATION_FAILURE_ROOT = ".runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests/preparation-failures"
const COMPLETE_MAP_SCOPE_AUDIT_ROOT = ".runtime/ai-painter/complete-map-scope-audits"
const WORLD_PROFILE_ID = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"
const OWNER_AUTHORIZATION_REF = "conversation-owner-authorization-2026-07-13"
const V7_OWNER_AUTHORIZATION_REF = v7Mode
  ? "owner-authorized-v7-remaining-104-continuous-batch-20260723"
  : null
const AUTONOMY_OWNER_AUTHORIZATION_REF = autonomyMode ? AUTONOMY_OWNER_AUTHORIZATION_ID : null
const EARTH_OWNER_AUTHORIZATION_REF = earthMode
  ? "owner-authorized-earth-reference-naturalized-complete-map-single-rgb-20260725"
  : null
const POLICY_VERSION = "owner-authorized-ai-assisted-cold-start-v1"
const DERIVATIVE_POLICY_VERSION = "owner-approved-high-resolution-four-three-derivative-v1"
const SOURCE_CONTRACT = "generator-native-exact-four-three-no-smaller-than-1024x768-with-audited-training-derivative"
const STYLE_GUIDANCE_MODE = "versioned_foundational_complete_map_visual_standard_aggregate_only_v1"
const ownerAuthorizedRetry = process.argv.includes("--owner-authorized-retry")
const retryReason = argumentValue("--retry-reason")
let preparationFailureRecorded = false
assert(SOURCE_RECORD_ID, "an explicit source identity is required; the program must never default to a previous condition")
const earthTaskDir = earthMode ? path.dirname(resolveProjectPath(EARTH_TASK_MANIFEST_ARG)) : null
const earthConditionPackPath = earthMode ? path.join(earthTaskDir, "compiled-conditions", "condition-pack.json") : null
const earthConditionPack = earthMode ? readJson(earthConditionPackPath) : null
const batchPointer = (v7Mode || autonomyMode || earthMode) ? null : readJson(".runtime/ai-painter/ai-assisted-conditional-world-facts/latest.json")
const batch = v7Mode
  ? v7TaskManifest
  : autonomyMode
    ? autonomyTaskManifest
    : earthMode
      ? earthTaskManifest
    : readJson(batchPointer.manifestPath)
const row = v7Mode
  ? batch.row
  : autonomyMode
    ? (batch.rows ?? []).find((entry) => entry.rebuildId === SOURCE_RECORD_ID)
    : earthMode
      ? {
          sourceRecordId: SOURCE_RECORD_ID,
          conditionLabel: earthTaskManifest.conditionLabel,
          generationContractVersion: earthTaskManifest.generationContractVersion,
          blueprintPath: earthTaskManifest.blueprintPath,
          blueprintSha256: sha256(fs.readFileSync(resolveProjectPath(earthTaskManifest.blueprintPath))),
          directorOutputPath: earthTaskManifest.directorPath,
          directorOutputSha256: sha256(fs.readFileSync(resolveProjectPath(earthTaskManifest.directorPath))),
          taskPackagePath: earthTaskManifest.taskPath,
          taskPackageSha256: earthTaskManifest.taskSha256,
          conditionPackPath: projectPath(earthConditionPackPath),
          conditionPackSha256: earthConditionPack.conditionPackSha256,
          regionalLandscapeType: "lowland-evergreen-tropical-forest",
        }
  : (batch.rows ?? []).find((entry) => entry.sourceRecordId === SOURCE_RECORD_ID)
assert(row, `condition blueprint row missing: ${SOURCE_RECORD_ID}`)
if (v7Mode) {
  assert(v7TaskManifest.continuousBatchAuthorization?.authorizationId === V7_OWNER_AUTHORIZATION_REF, "V7 continuous batch authorization is missing from the task manifest")
  assert(v7TaskManifest.continuousBatchAuthorization?.executionMode === "sequential_one_active_generation_request", "V7 generation request is not in sequential batch mode")
  assert(v7TaskManifest.continuousBatchAuthorization?.ownerApprovalAutomatic === false, "V7 generation request must not auto-approve owner review")
  assert(v7TaskManifest.continuousBatchAuthorization?.gpuTrainingAutomatic === false, "V7 generation request must not auto-start GPU training")
  assert(row.imageGenerationAuthorized === true, "V7 task is not authorized for continuous RGB generation")
  assert(row.gpuTrainingAuthorized === false, "V7 task unexpectedly authorizes GPU training")
}
if (autonomyMode) {
  const rebuildIdentity = /^autonomous-world-rebuild-(\d{3})$/.exec(SOURCE_RECORD_ID)
  const authorizationIdentity = /^owner-authorized-autonomous-world-rebuild-(\d{3})-single-rgb-(\d{8})$/.exec(
    AUTONOMY_OWNER_AUTHORIZATION_REF ?? "",
  )
  assert(rebuildIdentity, "autonomy rebuild identity is invalid")
  assert(
    authorizationIdentity?.[1] === rebuildIdentity[1],
    "autonomy single-image authorization identity mismatch",
  )
  assert(batch.status === "all_24_autonomous_world_condition_tasks_ready_rgb_missing", "autonomy rebuild manifest is not ready for RGB")
  assert(batch.ownerAuthorizationRef === "owner-authorized-no-preset-home-site-engineering-rebuild-24-20260724", "autonomy rebuild authorization mismatch")
  assert(batch.imageGenerationStarted === false && batch.imagesGenerated === 0, "autonomy rebuild manifest already reports RGB generation")
  assert(batch.gpuTrainingStarted === false, "autonomy rebuild manifest unexpectedly reports GPU training")
  assert(row.status === "task_ready_rgb_missing", "selected autonomy rebuild row is not waiting for RGB")
  assert(row.conditionLabel === `autonomous-complete-map-${rebuildIdentity[1]}`, "selected autonomy condition identity mismatch")
  assert(row.channelCount === 23, "selected autonomy row must contain 23 channels")
  assert(row.focalAreaNonZeroCount === 0, "selected autonomy row must keep focal_area all-zero")
  assert(row.completeMapScopePassed === true, "selected autonomy row did not pass complete-map scope")
  assert(row.presetHomeSiteSemanticsDetected === false, "selected autonomy row contains preset home-site semantics")
  assert(row.sourceTransformReuse === false, "selected autonomy row reuses transformed source geometry")
  assert(row.pairedRgbCount === 0, "selected autonomy row already has paired RGB")
  validateAutonomySkeletonAudit(batch)
}
if (earthMode) {
  assert(
    earthTaskManifest.status === "naturalized_complete_map_task_ready_rgb_authorization_required",
    "earth-reference task is not waiting for bounded RGB authorization",
  )
  assert(
    earthTaskManifest.imageCount === 0 && earthTaskManifest.imageGenerationStarted === false,
    "earth-reference task already contains RGB output",
  )
  assert(earthTaskManifest.gpuTrainingStarted === false, "earth-reference task unexpectedly reports GPU training")
  assert(
    /^earth-reference-naturalized-complete-map-[a-f0-9]{12}$/.test(row.conditionLabel),
    "earth-reference condition identity is invalid",
  )
}
const blueprint = readJson(row.blueprintPath)
row.generationContractVersion ??= blueprint.generationContractVersion
const directorOutput = readJson(row.directorOutputPath)
const task = readJson(row.taskPackagePath)
const conditionPack = readJson(row.conditionPackPath)
const guideManifestPath = path.join(path.dirname(resolveProjectPath(row.conditionPackPath)), "condition-guide-manifest.json")
assert(fs.existsSync(guideManifestPath), `condition guide must be built first: ${projectPath(guideManifestPath)}`)
const guide = readJson(guideManifestPath)
const library = readJson("data/world-samples/original-image-library/natural-home-v1/library.json")
const index = readJson("data/world-samples/original-image-library/natural-home-v1/index.json")
const sourceRecord = (v7Mode || autonomyMode || earthMode)
  ? {
      recordId: SOURCE_RECORD_ID,
      classification: { regionalLandscapeType: row.regionalLandscapeType },
      worldBinding: {
        snapshotId: earthMode
          ? readJson(library.provisionalVisualSnapshotPath).snapshotId
          : blueprint.earthParameterSnapshotId,
        snapshotPath: earthMode
          ? library.provisionalVisualSnapshotPath
          : blueprint.earthParameterSnapshotPath,
      },
    }
  : (index.records ?? []).find((entry) => entry.recordId === SOURCE_RECORD_ID)
assert(sourceRecord, `source record missing: ${SOURCE_RECORD_ID}`)
const coverageBlueprint = readJson("data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json")
const landscapeProfile = earthMode
  ? {
      typeId: blueprint.landscapeType,
      nameZh: "真实地球参照自然化低地、河谷与低丘生态镶嵌",
      requiredFeatures: blueprint.landscapeProfile?.measuredNaturalSystems ?? [],
      optionalFeatures: [],
    }
  : (coverageBlueprint.regionalLandscapeTypes ?? [])
    .find((entry) => entry.typeId === blueprint.landscapeType)
assert(landscapeProfile, `regional landscape profile missing: ${blueprint.landscapeType}`)
const visualStandardPointer = readJson(".runtime/ai-painter/foundational-complete-map-visual-standards/latest.json")
const visualStandardPath = visualStandardPointer.standardPath ?? visualStandardPointer.runPath
const visualStandard = readJson(visualStandardPath)
const visualStandardValidation = validateFoundationalCompleteMapVisualStandard(visualStandard)
const visualStandardSha256 = sha256(fs.readFileSync(resolveProjectPath(visualStandardPath)))
const visualStandardPromptProfile = visualStandard.generatorProfile
const connectivityBlueprint = readJson(blueprint.connectivityBlueprintPath)

assert(((v7Mode || autonomyMode || earthMode) ? blueprint.sourceImageGeometryRead : batch.sourceImageGeometryRead) === false, "condition batch must not read source RGB geometry")
assert(
  v7Mode
    ? blueprint.existingRgbMayBeBoundAsTarget === false && blueprint.outputContract?.needsNewRgbPairCreatedAfterThisBlueprint === true
    : autonomyMode
      ? blueprint.sourceRgbRead === false && blueprint.sourceTransformReuse === false && row.pairedRgbCount === 0
      : earthMode
        ? blueprint.sourceRgbRead === false
          && blueprint.sourceTransformReuse === false
          && blueprint.outputContract?.rgbCreated === false
      : row.existingRgbBound === false && row.needsNewRgbPair === true,
  "condition row is not waiting for new RGB",
)
assert(task.worldProfileId === WORLD_PROFILE_ID && conditionPack.worldProfileId === WORLD_PROFILE_ID, "world profile mismatch")
assert(directorOutput.worldId === blueprint.worldId && directorOutput.tick === blueprint.tick, "director output does not match the selected world-fact blueprint")
assert(blueprint.environmentContext?.contractVersion === "world-visual-environment-context-v1", "world environment context is missing")
assert(
  earthMode
    ? task.directorPlan?.singleMapEcologyPlan?.season === blueprint.environmentContext.season
      && task.directorPlan?.singleMapMaterialPlan?.environmentState === blueprint.environmentContext.environmentState
    : sameJson(task.environmentContext, blueprint.environmentContext),
  "task and blueprint environment contexts differ",
)
assert(directorOutput.singleMapEcologyPlan?.season === blueprint.environmentContext.season, "director season differs from blueprint")
assert(directorOutput.singleMapMaterialPlan?.environmentState === blueprint.environmentContext.environmentState, "director environment state differs from blueprint")
assert(conditionPack.channels?.length === 23, "condition pack must contain 23 channels")
assert(guide.conditionPackId === conditionPack.conditionPackId, "condition guide identity mismatch")
assert(visualStandardValidation.passed, `foundational complete-map visual standard invalid: ${visualStandardValidation.issues.join(",")}`)
verifyHash(guide.guidePath, guide.guideSha256, "condition guide hash mismatch")
const routeConditionAudit = await auditRouteCondition(conditionPack)
assert(routeConditionAudit.pathPixels > 0, "terrain path condition is empty")
assert(routeConditionAudit.pathWaterOverlapPixels === 0, "terrain path overlaps the water condition")
assert(routeConditionAudit.pathCollisionOverlapPixels === 0, "terrain path overlaps the collision condition")

const timestamp = new Date().toISOString()
const shortId = earthMode
  ? "001"
  : row.conditionLabel.match(/^(?:complete-map-v2|v7-complete-map|autonomous-complete-map)-(\d{3})$/)?.[1]
assert(shortId, "formal condition label sequence missing")
const completeMapScopeAudit = await auditCompleteMapScope({
  blueprint,
  directorOutput,
  task,
  conditionPack,
  connectivityBlueprint,
})
const completeMapScopeAuditStored = persistCompleteMapScopeAudit({
  timestamp,
  shortId,
  audit: completeMapScopeAudit,
  visualStandard,
  visualStandardPath,
  visualStandardSha256,
})
assert(completeMapScopeAudit.passed, `${completeMapScopeAudit.failureCode}: ${completeMapScopeAudit.issues.join(",")}`)
const outputRecordBase = v7Mode
  ? `ai-cold-start-v7-${SOURCE_RECORD_ID}-${blueprint.landscapeType}`
  : autonomyMode
    ? `ai-cold-start-autonomy-${SOURCE_RECORD_ID}-${blueprint.landscapeType}`
    : earthMode
      ? `ai-cold-start-earth-reference-${SOURCE_RECORD_ID}`
  : `ai-cold-start-condition-pair-${shortId}-${blueprint.landscapeType}`
const generationRequests = readConditionalRgbGenerationRequests(OUTPUT_ROOT)
const sequenceGate = v7Mode
  ? evaluateV7SingleSlotSequence({ sourceRecordId: SOURCE_RECORD_ID, generationRequests, ownerAuthorizedRetry, retryReason })
  : autonomyMode
    ? evaluateAutonomySingleImageSequence({ sourceRecordId: SOURCE_RECORD_ID, generationRequests })
    : earthMode
      ? evaluateEarthReferenceSingleImageSequence({ sourceRecordId: SOURCE_RECORD_ID, generationRequests })
  : evaluateConditionalRgbGenerationSequence({
      sourceRecordId: SOURCE_RECORD_ID,
      conditionLabel: row.conditionLabel,
      generationContractVersion: row.generationContractVersion,
      taskId: task.taskId,
      conditionPackId: conditionPack.conditionPackId,
      conditionPackSha256: conditionPack.conditionPackSha256,
      outputRecordBase,
      libraryRecords: index.records ?? [],
      generationRequests,
      ownerAuthorizedRetry,
      retryReason,
    })
if (!sequenceGate.allowed) {
  const blockRecord = saveSequenceBlock({
    timestamp,
    sourceRecordId: SOURCE_RECORD_ID,
    conditionLabel: row.conditionLabel,
    generationContractVersion: row.generationContractVersion,
    outputRecordBase,
    sequenceGate,
  })
  console.error(JSON.stringify(blockRecord, null, 2))
  process.exit(2)
}
const requestId = `conditional-rgb-${shortId}-${timestamp.replace(/[:.]/g, "-")}`
const outputVersion = nextOutputVersion(index, outputRecordBase, OUTPUT_ROOT)
const outputRecordId = `${outputRecordBase}-v${outputVersion}`
const requestDir = path.join(OUTPUT_ROOT, requestId)
fs.mkdirSync(requestDir, { recursive: true })

const routeConditionProfile = buildRouteConditionProfile(conditionPack)
const retryRepairProfile = ownerAuthorizedRetry
  ? {
      contractVersion: "owner-authorized-conditional-rgb-retry-repair-v1",
      reason: retryReason.trim(),
      mayChangeWorldFacts: false,
      mayChangeConditionGeometry: false,
      mayChangeReviewThresholds: false,
    }
  : null
const semanticConditionSummary = buildSemanticConditionSummary(blueprint, directorOutput, landscapeProfile)
const prompt = buildPrompt(
  blueprint,
  directorOutput,
  semanticConditionSummary,
  landscapeProfile,
  visualStandardPromptProfile,
  routeConditionProfile,
  retryRepairProfile,
)
assert(prompt.includes(blueprint.semanticRules.routeIntent), "prompt does not contain the selected blueprint route intent")
assert(prompt.includes(blueprint.semanticRules.waterFlow), "prompt does not contain the selected blueprint water-flow intent")
assert(prompt.includes(boundsSummary("entrance", blueprint.geometry.entranceBounds)), "prompt does not contain the selected blueprint entrance bounds")
assert(prompt.includes("No preset home site"), "prompt does not contain the no-preset-home-site policy")
assert(prompt.includes(blueprint.environmentContext.season), "prompt does not contain the selected season")
assert(prompt.includes(blueprint.environmentContext.environmentState), "prompt does not contain the selected environment state")
for (const feature of landscapeProfile.requiredFeatures ?? []) {
  assert(prompt.includes(feature), `prompt does not contain required landscape feature: ${feature}`)
}
const promptEvidence = {
  schemaVersion: "ai-assisted-cold-start-prompt-evidence-v1",
  promptId: requestId,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  ownerAuthorizationRef: v7Mode
    ? V7_OWNER_AUTHORIZATION_REF
    : autonomyMode
      ? AUTONOMY_OWNER_AUTHORIZATION_REF
      : earthMode
        ? EARTH_OWNER_AUTHORIZATION_REF
      : OWNER_AUTHORIZATION_REF,
  policyVersion: POLICY_VERSION,
  generatorProvider: "OpenAI",
  generatorSystem: "Codex built-in image generation",
  targetCategoryId: "complete-maps",
  targetWorldProfileId: WORLD_PROFILE_ID,
  targetRegionalLandscapeType: sourceRecord.classification.regionalLandscapeType,
  targetVisualContract: SOURCE_CONTRACT,
  trainingDerivativeContract: "nearest-neighbor-no-crop-no-upscale-to-1024x768",
  derivativePolicyVersion: DERIVATIVE_POLICY_VERSION,
  targetVisualSnapshotId: sourceRecord.worldBinding.snapshotId,
  targetVisualSnapshotPath: sourceRecord.worldBinding.snapshotPath,
  targetMonsoonSeason: blueprint.environmentContext.season,
  targetEnvironmentState: blueprint.environmentContext.environmentState,
  environmentContextContractVersion: blueprint.environmentContext.contractVersion,
  environmentContext: blueprint.environmentContext,
  sourceConditionBlueprintId: blueprint.blueprintId,
  conditionLabel: row.conditionLabel,
  generationContractVersion: row.generationContractVersion,
  sourceConditionBlueprintPath: row.blueprintPath,
  sourceConditionBlueprintSha256: row.blueprintSha256,
  directorOutputPath: row.directorOutputPath,
  directorOutputSha256: row.directorOutputSha256,
  promptConstruction: "dynamic_complete_map_scope_plus_foundational_visual_standard_plus_world_facts_director_23_channels_v9",
  landscapeProfile: {
    typeId: landscapeProfile.typeId,
    nameZh: landscapeProfile.nameZh,
    requiredFeatures: landscapeProfile.requiredFeatures ?? [],
    optionalFeatures: landscapeProfile.optionalFeatures ?? [],
  },
  semanticConditionSummary,
  routeConditionProfile,
  routeConditionAudit,
  completeMapScopeAuditPath: completeMapScopeAuditStored.runPath,
  completeMapScopeAuditSha256: completeMapScopeAuditStored.sha256,
  completeMapScopeAudit,
  retryRepairProfile,
  taskPackageId: task.taskId,
  taskPackagePath: row.taskPackagePath,
  taskPackageSha256: row.taskPackageSha256,
  conditionPackId: conditionPack.conditionPackId,
  conditionPackPath: row.conditionPackPath,
  conditionPackSha256: conditionPack.conditionPackSha256,
  conditionGuideManifestPath: projectPath(guideManifestPath),
  conditionGuidePath: guide.guidePath,
  conditionGuideSha256: guide.guideSha256,
  styleGuidanceMode: STYLE_GUIDANCE_MODE,
  styleReferenceRecordIds: [],
  styleReferences: [],
  historicalCompleteMapImageReferencesUsed: false,
  foundationalVisualStandardId: visualStandard.standardId,
  foundationalVisualStandardPath: visualStandardPath,
  foundationalVisualStandardSha256: visualStandardSha256,
  foundationalVisualStandardSourceRecordIds: visualStandard.sourceEvidence.map((entry) => entry.recordId),
  foundationalVisualStandardPromptProfile: visualStandardPromptProfile,
  requiredStyleFailureRepairs: [
    "style_system_drift",
    "camera_scale_too_close",
    "object_scale_too_large",
    "pixel_texture_density_mismatch",
  ],
  prompt,
  negativeConstraints: [
    "condition_geometry_drift",
    "invented_major_geometry",
    "path_entering_water",
    "objects_blocking_route",
    "preset_home_site_or_construction_clearing",
    "photorealism_or_painterly_blur",
    "low_resolution_upscale",
    "tile_collage_or_repeated_stamp_patterns",
    "characters_animals_buildings",
    "snow_glacier_desert",
    "text_ui_watermark",
    "owner_rejected_style_pattern",
    "close_camera_or_oversized_objects",
  ],
}
const promptPath = path.join(requestDir, "prompt-evidence.json")
writeJson(promptPath, promptEvidence)
const request = {
  schemaVersion: "ai-assisted-conditional-rgb-generation-request-v1",
  requestId,
  status: "ready_for_openai_assisted_generation",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: promptEvidence.createdAtAsiaShanghai,
  sourceRecordId: SOURCE_RECORD_ID,
  conditionLabel: row.conditionLabel,
  generationContractVersion: row.generationContractVersion,
  outputRecordId,
  title: autonomyMode
    ? `自主世界重建训练原图 ${shortId} v${outputVersion}: ${blueprint.landscapeType}`
    : v7Mode
    ? `V7自主生成训练原图 ${shortId} v${outputVersion}: ${blueprint.landscapeType}`
    : earthMode
    ? `真实地球参照自然化完整地图单图 ${shortId} v${outputVersion}: ${blueprint.landscapeType}`
    : `AI辅助条件配对图 ${shortId} v${outputVersion}: ${blueprint.landscapeType}`,
  categoryId: "complete-maps",
  regionalLandscapeType: promptEvidence.targetRegionalLandscapeType,
  environmentContextContractVersion: promptEvidence.environmentContextContractVersion,
  environmentContext: promptEvidence.environmentContext,
  promptEvidencePath: projectPath(promptPath),
  promptEvidenceSha256: sha256(fs.readFileSync(promptPath)),
  taskPackagePath: row.taskPackagePath,
  conditionPackPath: row.conditionPackPath,
  conditionGuideManifestPath: projectPath(guideManifestPath),
  foundationalVisualStandardId: visualStandard.standardId,
  foundationalVisualStandardPath: visualStandardPath,
  foundationalVisualStandardSha256: visualStandardSha256,
  foundationalVisualStandardPromptProfile: visualStandardPromptProfile,
  completeMapScopeAuditPath: completeMapScopeAuditStored.runPath,
  completeMapScopeAuditSha256: completeMapScopeAuditStored.sha256,
  completeMapScopeAudit,
  routeConditionProfile,
  routeConditionAudit,
  retryRepairProfile,
  styleGuidanceMode: STYLE_GUIDANCE_MODE,
  referenceImagePaths: [guide.guidePath],
  referenceImageRoles: ["authoritative_semantic_condition_guide"],
  historicalCompleteMapImageReferencesUsed: false,
  generatedImagePath: null,
  generatedImageSha256: null,
  sourceContract: SOURCE_CONTRACT,
  derivativePolicyVersion: DERIVATIVE_POLICY_VERSION,
  automaticStorage: true,
  existingRgbReusedAsTarget: false,
  requiresMachineReview: true,
  requiresOwnerReview: true,
  continuousBatchAuthorizationId: v7Mode ? V7_OWNER_AUTHORIZATION_REF : null,
  autonomySingleImageAuthorizationId: autonomyMode ? AUTONOMY_OWNER_AUTHORIZATION_REF : null,
  earthReferenceSingleImageAuthorizationId: earthMode ? EARTH_OWNER_AUTHORIZATION_REF : null,
  automaticNextGenerationAuthorized: false,
  automaticRetryAuthorized: false,
  ownerApprovalAutomatic: false,
  capacityContributionAutomaticBeforeOwnerApproval: false,
  gpuTrainingAuthorized: false,
  conditionalTrainingEligible: false,
  sequenceGate: {
    code: sequenceGate.code,
    priorRequestCount: sequenceGate.priorRequestCount,
    priorRecordCount: sequenceGate.priorRecordCount,
    ownerAuthorizedRetry,
    retryReason: retryReason?.trim() || null,
  },
}
const requestPath = path.join(requestDir, "request.json")
writeJson(requestPath, request)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), {
  schemaVersion: "ai-assisted-conditional-rgb-generation-request-latest-v1",
  requestId,
  status: request.status,
  createdAtUtc: timestamp,
  requestPath: projectPath(requestPath),
  promptEvidencePath: projectPath(promptPath),
})

console.log(JSON.stringify({
  status: request.status,
  requestId,
  outputRecordId,
  requestPath: projectPath(requestPath),
  promptEvidencePath: projectPath(promptPath),
  conditionGuidePath: guide.guidePath,
  styleGuidanceMode: STYLE_GUIDANCE_MODE,
  styleReferencePaths: [],
  historicalCompleteMapImageReferencesUsed: false,
  prompt,
}, null, 2))

function evaluateV7SingleSlotSequence({ sourceRecordId, generationRequests, ownerAuthorizedRetry: retryAuthorized, retryReason: reason }) {
  const priorRequests = generationRequests.filter((entry) => entry.sourceRecordId === sourceRecordId)
  if (priorRequests.length === 0) {
    return {
      allowed: true,
      code: "v7_continuous_batch_slot_first_rgb_authorized",
      priorRequestCount: 0,
      priorRecordCount: 0,
    }
  }
  if (priorRequests.every(isReplaceableV7PreGenerationFailure)) {
    return {
      allowed: true,
      code: "v7_pre_generation_request_replacement_under_existing_batch_authorization",
      priorRequestCount: priorRequests.length,
      priorRecordCount: 0,
    }
  }
  if (retryAuthorized && reason?.trim()) {
    return {
      allowed: true,
      code: "v7_single_slot_retry_explicitly_owner_authorized",
      priorRequestCount: priorRequests.length,
      priorRecordCount: 0,
    }
  }
  return {
    allowed: false,
    code: "v7_single_slot_duplicate_generation_blocked",
    priorRequestCount: priorRequests.length,
    priorRecordCount: 0,
    blockers: ["existing_v7_slot_generation_request", "explicit_owner_retry_authorization_missing"],
  }
}

function evaluateAutonomySingleImageSequence({ sourceRecordId, generationRequests }) {
  const priorRequests = generationRequests.filter((entry) => entry.sourceRecordId === sourceRecordId)
  return priorRequests.length === 0
    ? {
        allowed: true,
        code: "autonomy_rebuild_single_rgb_explicitly_authorized",
        priorRequestCount: 0,
        priorRecordCount: 0,
      }
    : {
        allowed: false,
        code: "autonomy_rebuild_duplicate_generation_blocked",
        priorRequestCount: priorRequests.length,
        priorRecordCount: 0,
        blockers: ["existing_autonomy_rebuild_generation_request"],
      }
}

function evaluateEarthReferenceSingleImageSequence({ sourceRecordId, generationRequests }) {
  const priorRequests = generationRequests.filter((entry) => entry.sourceRecordId === sourceRecordId)
  return priorRequests.length === 0
    ? {
        allowed: true,
        code: "earth_reference_naturalized_complete_map_single_rgb_owner_authorized",
        priorRequestCount: 0,
        priorRecordCount: 0,
      }
    : {
        allowed: false,
        code: "earth_reference_naturalized_complete_map_single_rgb_already_requested",
        priorRequestCount: priorRequests.length,
        priorRecordCount: 0,
        blockers: ["existing_earth_reference_naturalized_complete_map_generation_request"],
      }
}

function validateAutonomySkeletonAudit(taskManifest) {
  const latest = readJson(".runtime/ai-painter/ai-assisted-v7-autonomy-rebuild-condition-skeleton-audits/latest.json")
  const report = readJson(latest.reportPath)
  verifyHash(latest.reportPath, latest.reportSha256, "autonomy skeleton audit report hash mismatch")
  const taskManifestPath = projectPath(resolveProjectPath(AUTONOMY_TASK_MANIFEST_ARG))
  const taskManifestSha256 = sha256(fs.readFileSync(resolveProjectPath(AUTONOMY_TASK_MANIFEST_ARG)))
  assert(latest.status === "passed_no_transform_condition_skeleton_duplicate", "autonomy skeleton audit is not passed")
  assert(latest.auditedRecordCount === 24 && latest.comparisonCount === 276, "autonomy skeleton audit coverage mismatch")
  assert(latest.exactDuplicatePairCount === 0, "autonomy skeleton audit found exact duplicates")
  assert(latest.strongTransformDuplicatePairCount === 0, "autonomy skeleton audit found transform duplicates")
  assert(latest.attentionPairCount === 0 && latest.distinctPairCount === 276, "autonomy skeleton audit has unresolved attention pairs")
  assert(latest.focalAreaAllZeroCount === 24, "autonomy skeleton audit focal_area coverage mismatch")
  assert(latest.imageGenerationStarted === false && latest.imagesGenerated === 0, "autonomy skeleton audit already reports RGB generation")
  assert(latest.gpuTrainingStarted === false, "autonomy skeleton audit unexpectedly reports GPU training")
  assert(latest.rgbGenerationEligibleByThisAudit === true, "autonomy skeleton audit does not permit bounded RGB generation")
  assert(latest.formalTrainingAuthorized === false, "autonomy skeleton audit must not authorize formal training")
  assert(report.sourceManifestPath === taskManifestPath, "autonomy skeleton audit source manifest path mismatch")
  assert(report.sourceManifestSha256 === taskManifestSha256, "autonomy skeleton audit source manifest hash mismatch")
  assert(taskManifest.runId === report.sourceRunId, "autonomy skeleton audit source run mismatch")
}

function isReplaceableV7PreGenerationFailure(request) {
  return request.status === "generation_failed_retryable"
    && request.lastGenerationFailureCode === "v7_stale_task_manifest_selected_before_generation"
    && !request.generatedImagePath
}

function buildPrompt(value, director, summary, profile, visualStandardProfile, routeProfile, retryProfile) {
  const objectCounts = countObjects(value.geometry.objectFootprints)
  const terrainKinds = Array.from(new Set(value.geometry.terrainRegions.map((region) => region.kind)))
  const environment = value.environmentContext
  const hasSurfaceWater = terrainKinds.includes("water")
  const waterMaterialInstruction = hasSurfaceWater
    ? "Render only the connected freshwater and embedded natural shoreline defined by the guide."
    : "Do not add visible surface water or shoreline; preserve the guide's dry drainage state."
  const groundMaterialInstruction = environment.groundMoisture === "dry"
    ? "Use seasonally dry tropical ground, straw-gold dry grass variation and open woodland negative space without desert identity. Render the compacted route as a narrower, clearly distinct reddish-brown soil material with readable shoulders and continuous edges; do not classify or render the surrounding dry grass as route material."
    : `Use ${environment.groundMoisture} tropical ground consistent with the locked environment state.`
  const requiredFeatures = (profile.requiredFeatures ?? []).join(", ")
  const optionalFeatures = (profile.optionalFeatures ?? []).join(", ")
  const ecologyInstruction = buildRegionalEcologyInstruction(profile)
  const routeMaterialInstruction = buildRouteMaterialInstruction(environment)
  const paletteInstruction = buildPaletteInstruction(environment)
  const retryInstruction = retryProfile
    ? `\nOwner-authorized retry repair: ${retryProfile.reason}. Apply this repair only to visual material expression. Do not alter world facts, condition geometry, object footprints, camera, environment context or review thresholds.`
    : ""
  return `Use case: stylized-concept\nAsset type: generator-native high-resolution exact 4:3 complete playable game-map cold-start RGB paired to an authoritative semantic condition guide\nPrimary request: Convert the only image reference, the authoritative semantic condition guide for ${value.blueprintId}, into one complete professional 2D high-resolution pure pixel-art game map for AI-PET-WORLD. Output one exact 4:3 image at the generator's native high resolution, no smaller than 1024x768. Do not crop, upscale, add borders, text or UI. The project program will preserve the raw source unchanged and create a separately audited nearest-neighbor 1024x768 training derivative. The only image reference is the sole authority for this run's layout. Preserve its exact water, shoreline, route, natural boundary and object-footprint geometry. The focal_area model channel is an inactive all-zero compatibility channel and is deliberately excluded from the visible guide. No preset home site, activity center, building plot, construction clearing, central square, route-convergence platform or protected empty patch may be invented. No historical complete-map RGB image is supplied as an image reference. Use only the persisted versioned foundational complete-map visual standard aggregate for shared game visual language; never reconstruct or reuse a historical complete-map composition.\nComplete-map scope: show the entire connected natural region in one frame, including the authorized boundary entrance or exit relation, continuous natural passage organization, multiple recognizable spatial or ecological zones, natural boundary and large-world connectivity meaning. A magnified river segment, road segment, pond, clearing, material patch or other local scene is forbidden.\nWorld-fact identity: landscapeType=${value.landscapeType}; waterFlow=${value.semanticRules.waterFlow}; routeIntent=${value.semanticRules.routeIntent}; siteSelectionPolicy=${value.semanticRules.siteSelectionPolicy}; ${boundsSummary("entrance", value.geometry.entranceBounds)}.\nEnvironment context: contract=${environment.contractVersion}; season=${environment.season}; monsoonPhase=${environment.monsoonPhase}; environmentState=${environment.environmentState}; weather=${environment.weather}; lighting=${environment.lighting}; groundMoisture=${environment.groundMoisture}; visibility=${environment.visibility}.\nRegional ecology profile: typeId=${profile.typeId}; nameZh=${profile.nameZh}; requiredFeatures=${requiredFeatures}; optionalFeatures=${optionalFeatures}. Required features are identity constraints, not optional decoration. ${ecologyInstruction}\nDirector composition: layoutIntent=${director.compositionPlan.layoutIntent}; readOrder=${director.compositionPlan.readOrder.join(" -> ")}; focalHierarchy=${director.compositionPlan.focalHierarchy.join(" -> ")}; clutterBudget=${director.compositionPlan.clutterBudget}.\nCondition summary: ${JSON.stringify(summary)}.\nRoute raster contract: ${JSON.stringify(routeProfile)}. Render one continuous compacted-earth route across the full guide-defined path footprint, with visual coverage close to expectedNonZeroRatio=${routeProfile.expectedNonZeroRatio}. ${routeMaterialInstruction}\nScene/backdrop: class-Earth mainland Southeast Asia ${value.landscapeType} under the exact environment context above.\nVersioned foundational complete-map visual standard (aggregate numeric and text profile, no historical RGB): ${JSON.stringify(visualStandardProfile)}. ${paletteInstruction} Match the aggregate visual language without copying any historical composition.\nStyle/medium: professional high-resolution pure pixel art with the approved distant game-map scale, dense fine deliberate pixel clusters, layered terrain microtexture, crisp small-scale silhouettes and coherent warm daylight; no smooth digital painting and no coarse low-resolution sprite look\nComposition/framing: entire 4:3 playable region visible at once from the approved distant elevated ${value.semanticRules.camera} camera; terrainKinds=${terrainKinds.join(", ")}; objectFootprints=${JSON.stringify(objectCounts)}; maintain multiple naturally formed ecological spaces without reserving a construction site\nMaterials/textures: ${waterMaterialInstruction} ${groundMaterialInstruction} Ground all vegetation and rocks using the approved fine pixel density.${retryInstruction}\nConstraints: follow the selected blueprint, world director output and condition guide; keep objects out of water and route; do not clear objects around any artificial center; use one coherent world scale and the locked light direction; produce a composition unique to this condition\nAvoid: local_scene_not_complete_map, preset_home_site_or_construction_clearing, home-center marker, activity-center marker, building plot, construction clearing, central square, rectangular bare-earth patch, route-convergence platform, buildings, bridges, characters, animals, pets, vehicles, text, UI, watermark, invented major geometry, historical-complete-map composition reuse, previous-candidate composition reuse, snow, glacier, desert, generic savanna, orchard rows, temperate woodland, photorealism, painterly blur, low-resolution enlargement, tile collage, repeated stamps, uniform green noise, floating objects, close camera, oversized trees, oversized rocks, coarse pixel texture, owner-rejected style pattern, globally bright yellow-green ground, washed highlights, broken route segments, pale tan route blending into grass`
}

function buildRegionalEcologyInstruction(profile) {
  const requiredFeatures = (profile.requiredFeatures ?? []).join(", ")
  return `Render a recognizable mainland Southeast Asian ${profile.nameZh} (${profile.typeId}) ecosystem whose dominant visual identity is ${requiredFeatures}. Do not substitute the canopy, ground layer, water regime or vegetation structure of another regional landscape profile.`
}

function buildRouteMaterialInstruction(environment) {
  if (environment.groundMoisture === "dry") {
    return "The route must remain visibly separate from dry grass for its entire length: use dark warm reddish-brown soil whose red component clearly dominates its green component, firm continuous shoulders and no straw-yellow or olive route fill."
  }
  return "The route must remain visibly separate from the moist ground layer for its entire length: use compacted warm reddish-brown earth, firm continuous shoulders and no green, yellow-green or vegetation-textured route fill."
}

function buildPaletteInstruction(environment) {
  if (environment.groundMoisture === "dry") {
    return "Keep most terrain in deep forest-green and dry olive midtones with dark grounded shadows; reserve brighter straw-gold accents for limited dry grass and warm reddish-brown for the route."
  }
  return "Keep most terrain in deep humid forest-green and restrained natural midtones with dark grounded shadows; reserve brighter green accents for limited post-rain growth and warm reddish-brown for the route."
}

function buildRouteConditionProfile(conditionPack) {
  const route = (conditionPack.channels ?? []).find((entry) => entry.id === "terrain_path_ground")
  assert(route, "terrain_path_ground condition channel is missing")
  assert(Number.isFinite(route.statistics?.nonZeroRatio), "terrain_path_ground non-zero ratio is missing")
  return {
    contractVersion: "route-condition-text-profile-v1",
    channelId: route.id,
    channelSha256: route.sha256,
    expectedNonZeroRatio: route.statistics.nonZeroRatio,
    sourceRefs: route.sourceRefs ?? [],
  }
}

async function auditRouteCondition(conditionPack) {
  const water = await readConditionChannel(conditionPack, "terrain_water")
  const route = await readConditionChannel(conditionPack, "terrain_path_ground")
  const collision = await readConditionChannel(conditionPack, "collision")
  let pathPixels = 0
  let pathWaterOverlapPixels = 0
  let pathCollisionOverlapPixels = 0
  for (let index = 0; index < route.data.length; index += 1) {
    if (route.data[index] === 0) continue
    pathPixels += 1
    if (water.data[index] > 0) pathWaterOverlapPixels += 1
    if (collision.data[index] > 0) pathCollisionOverlapPixels += 1
  }
  return { pathPixels, pathWaterOverlapPixels, pathCollisionOverlapPixels }
}

async function readConditionChannel(conditionPack, channelId) {
  const channel = conditionPack.channels?.find((entry) => entry.id === channelId)
  assert(channel, `condition channel missing: ${channelId}`)
  return sharp(resolveProjectPath(channel.path), { failOn: "error" }).greyscale().raw().toBuffer({ resolveWithObject: true })
}

function persistCompleteMapScopeAudit({ timestamp, shortId, audit, visualStandard, visualStandardPath, visualStandardSha256 }) {
  const auditId = `complete-map-scope-${shortId}-${timestamp.replace(/[:.]/g, "-")}`
  const record = {
    ...audit,
    auditId,
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    foundationalVisualStandardId: visualStandard.standardId,
    foundationalVisualStandardPath: visualStandardPath,
    foundationalVisualStandardSha256: visualStandardSha256,
  }
  const stored = writeImmutableProgramRun({
    root: COMPLETE_MAP_SCOPE_AUDIT_ROOT,
    runId: auditId,
    fileName: "scope-audit.json",
    record,
    latest: {
      auditId,
      sourceRecordId: SOURCE_RECORD_ID,
      passed: record.passed,
      failureCode: record.failureCode,
    },
  })
  const storedPath = resolveProjectPath(stored.runPath)
  const storedSha256 = sha256(fs.readFileSync(storedPath))
  appendAiPainterProgramEvent({
    action: record.passed ? "complete_map_scope_gate_passed" : "complete_map_scope_gate_blocked",
    runId: auditId,
    kind: record.passed ? "scope_gate_passed" : "step_failed",
    status: record.passed ? "success" : "failed",
    title: record.passed ? "Complete-map scope gate passed before generation" : "Local-scene output blocked before generation",
    titleZh: record.passed ? "完整地图范围门禁在生成前通过" : "程序在生成前阻断局部场景条件",
    detail: `sourceRecordId=${SOURCE_RECORD_ID}; passed=${record.passed}; issues=${record.issues.join(",") || "none"}; computeStarted=false`,
    detailZh: `来源记录=${SOURCE_RECORD_ID}；通过=${record.passed}；问题=${record.issues.join(",") || "无"}；未启动生成算力`,
    script: "scripts/build-ai-assisted-conditional-rgb-generation-request.mjs",
    currentStep: "complete_map_scope_gate",
    error: record.failureCode,
    errorZh: record.passed ? null : "世界导演或23通道未证明完整自然家园地图范围",
    finalGameMapSuccess: false,
    canEnterWorld: false,
    archiveId: SOURCE_RECORD_ID,
    evidencePath: stored.runPath,
  })
  return { ...stored, sha256: storedSha256 }
}

function buildSemanticConditionSummary(value, director, profile) {
  return {
    blueprintId: value.blueprintId,
    worldId: value.worldId,
    tick: value.tick,
    landscapeType: value.landscapeType,
    landscapeProfile: {
      typeId: profile.typeId,
      requiredFeatures: profile.requiredFeatures ?? [],
      optionalFeatures: profile.optionalFeatures ?? [],
    },
    environmentContext: value.environmentContext,
    waterFlow: value.semanticRules.waterFlow,
    routeIntent: value.semanticRules.routeIntent,
    siteSelectionPolicy: value.semanticRules.siteSelectionPolicy,
    entranceBounds: value.geometry.entranceBounds,
    focalAreaCompatibilityChannel: "inactive_all_zero_excluded_from_visible_guide",
    terrainKinds: Array.from(new Set(value.geometry.terrainRegions.map((region) => region.kind))),
    objectCounts: countObjects(value.geometry.objectFootprints),
    directorLayoutIntent: director.compositionPlan.layoutIntent,
    directorReadOrder: director.compositionPlan.readOrder,
  }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function countObjects(footprints) {
  return footprints.reduce((counts, object) => {
    counts[object.kind] = (counts[object.kind] ?? 0) + 1
    return counts
  }, {})
}

function boundsSummary(label, bounds) {
  return `${label}Bounds=x:${bounds.x},y:${bounds.y},width:${bounds.width},height:${bounds.height}`
}

function saveSequenceBlock({ timestamp, sourceRecordId, conditionLabel, generationContractVersion, outputRecordBase, sequenceGate }) {
  const blockId = `conditional-rgb-sequence-block-${timestamp.replace(/[:.]/g, "-")}`
  const block = {
    schemaVersion: "ai-assisted-conditional-rgb-sequence-block-v1",
    blockId,
    status: "blocked_before_generation",
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    sourceRecordId,
    conditionLabel,
    generationContractVersion,
    outputRecordBase,
    generatedImageCreated: false,
    computeStarted: false,
    ...sequenceGate,
  }
  const blockPath = path.join(SEQUENCE_BLOCK_ROOT, `${blockId}.json`)
  writeJson(blockPath, block)
  writeJson(path.join(SEQUENCE_BLOCK_ROOT, "latest.json"), {
    schemaVersion: "ai-assisted-conditional-rgb-sequence-block-latest-v1",
    blockId,
    status: block.status,
    code: block.code,
    blockPath: projectPath(blockPath),
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: block.createdAtAsiaShanghai,
  })
  return { ...block, blockPath: projectPath(blockPath) }
}
function nextOutputVersion(libraryIndex, base, requestRoot) {
  const libraryVersions = (libraryIndex.records ?? [])
    .map((record) => record.recordId?.match(new RegExp(`^${escapeRegExp(base)}-v(\\d+)$`))?.[1])
    .filter(Boolean)
    .map(Number)
  const requestVersions = fs.existsSync(requestRoot)
    ? fs.readdirSync(requestRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(requestRoot, entry.name, "request.json"))
      .filter((requestPath) => fs.existsSync(requestPath))
      .map((requestPath) => {
        try {
          return JSON.parse(fs.readFileSync(requestPath, "utf8")).outputRecordId
            ?.match(new RegExp(`^${escapeRegExp(base)}-v(\\d+)$`))?.[1]
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .map(Number)
    : []
  const versions = [...libraryVersions, ...requestVersions]
  return (versions.length ? Math.max(...versions) : 0) + 1
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }

function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function writeJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.writeFileSync(value, `${JSON.stringify(body, null, 2)}\n`, "utf8") }
function verifyHash(value, expected, message) { assert(fs.existsSync(resolveProjectPath(value)), `file missing: ${value}`); assert(sha256(fs.readFileSync(resolveProjectPath(value))) === expected, message) }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`); return resolved }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) {
  if (condition) return
  if (!preparationFailureRecorded) {
    preparationFailureRecorded = true
    const timestamp = new Date().toISOString()
    const failureId = `conditional-rgb-request-preparation-failure-${timestamp.replace(/[:.]/g, "-")}`
    const failure = {
      schemaVersion: "ai-assisted-conditional-rgb-request-preparation-failure-v1",
      failureId,
      status: "blocked_before_generation",
      failureCode: "conditional_rgb_request_precondition_failed",
      failureMessage: message,
      sourceRecordId: SOURCE_RECORD_ID ?? null,
      computeStarted: false,
      generatedImageCreated: false,
      automaticStorage: true,
      createdAtUtc: timestamp,
      createdAtAsiaShanghai: formatShanghai(timestamp),
    }
    const stored = writeImmutableProgramRun({
      root: PREPARATION_FAILURE_ROOT,
      runId: failureId,
      fileName: "failure-record.json",
      record: failure,
      latest: {
        failureId,
        sourceRecordId: failure.sourceRecordId,
        failureCode: failure.failureCode,
      },
    })
    appendAiPainterProgramEvent({
      action: "build_ai_assisted_conditional_rgb_request_blocked",
      runId: failureId,
      kind: "step_failed",
      status: "failed",
      title: "Conditional RGB request preparation blocked",
      titleZh: "条件 RGB 请求准备被程序阻断",
      detail: `failureCode=${failure.failureCode}; message=${message}; computeStarted=false`,
      detailZh: `失败码=${failure.failureCode}；原因=${message}；未启动生成算力`,
      script: "scripts/build-ai-assisted-conditional-rgb-generation-request.mjs",
      currentStep: "conditional_rgb_request_preparation",
      error: failure.failureCode,
      errorZh: message,
      finalGameMapSuccess: false,
      canEnterWorld: false,
      archiveId: SOURCE_RECORD_ID ?? failureId,
      evidencePath: stored.runPath,
      nextAction: "complete_the_missing_request_precondition_then_retry_the_same_source_record",
      nextActionZh: "补齐缺失的请求前置证据后，使用同一条件编号重新执行请求准备",
    })
  }
  throw new Error(message)
}
