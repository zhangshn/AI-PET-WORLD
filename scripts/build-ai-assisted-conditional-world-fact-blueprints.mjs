import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  REQUIRED_DIRECTOR_OUTPUT_FIELDS,
  REQUIRED_TASK_PACKAGE_FIELDS,
  assertWorldVisualDictionaryContract,
  loadWorldVisualDictionaryContract,
} from "./lib/world-visual-dictionary-contract.mjs"
import { auditCompleteMapScope } from "./lib/complete-map-scope-gate.mjs"
import {
  appendAiPainterProgramEvent,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-conditional-world-facts")
const INDEX_PATH = "data/world-samples/original-image-library/natural-home-v1/index.json"
const PROFILE_PATH = "data/world-samples/original-image-library/natural-home-v1/mainland-southeast-asia-tropical-monsoon-profile-v1.json"
const CONNECTIVITY_POINTER_PATH = "data/world-samples/world-connectivity/blueprints/latest.json"
const WORLD_PROFILE_ID = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"
const OWNER_AUTHORIZATION_REF = "conversation-owner-authorization-2026-07-18-rebuild-all-condition-blueprints-new-labels"
const V7_CONTINUOUS_BATCH_AUTHORIZATION_ID = "owner-authorized-v7-remaining-104-continuous-batch-20260723"
const GENERATION_CONTRACT_VERSION = "complete-map-scope-world-facts-v2"
const LABEL_PREFIX = "complete-map-v2"
const WIDTH = 1024
const HEIGHT = 768
const V7_SLOT_ID = argumentValue("--v7-slot-id")
const AUTONOMY_REBUILD_24 = process.argv.includes("--autonomy-rebuild-24")
const SUPERSEDE_INCOMPATIBLE_PRE_GENERATION_TASK = process.argv.includes("--supersede-incompatible-pre-generation-task")
const REVISE_SOURCE_RECORD_ID = argumentValue("--revise-source-record-id")
const REVISION_REASON = argumentValue("--revision-reason")
const REVISION_OWNER_COMMAND_REF = argumentValue("--owner-command-ref")
const timestamp = new Date().toISOString()
const revisionMode = Boolean(REVISE_SOURCE_RECORD_ID)
if (revisionMode) {
  assert(REVISION_REASON, "--revision-reason is required for a single-condition revision")
  assert(REVISION_OWNER_COMMAND_REF, "--owner-command-ref is required for a single-condition revision")
}
const batchId = revisionMode
  ? `complete-map-world-facts-v2-revision-${timestamp.replace(/[:.]/g, "-")}`
  : `complete-map-world-facts-v2-${timestamp.replace(/[:.]/g, "-")}`
const batchDir = path.join(OUTPUT_ROOT, batchId)

const dictionary = loadWorldVisualDictionaryContract()
assertWorldVisualDictionaryContract(dictionary)
const index = readRequiredJson(INDEX_PATH)
const profile = readRequiredJson(PROFILE_PATH)
const connectivityPointer = readRequiredJson(CONNECTIVITY_POINTER_PATH)
const connectivityBlueprint = readRequiredJson(connectivityPointer.blueprintPath)

assert(profile.worldProfileId === WORLD_PROFILE_ID, "world profile identity mismatch")
assert(connectivityPointer.worldProfileId === WORLD_PROFILE_ID, "connectivity profile identity mismatch")
assert(connectivityBlueprint.blueprintId === connectivityPointer.blueprintId, "connectivity blueprint identity mismatch")

if (V7_SLOT_ID) {
  await buildV7CapacitySlot(V7_SLOT_ID)
  process.exit(0)
}
if (AUTONOMY_REBUILD_24) {
  await buildAutonomyRebuild24()
  process.exit(0)
}

const sourceRecords = (index.records ?? [])
  .filter((record) => record.categoryId === "complete-maps")
  .filter((record) => record.status === "ai_assisted_cold_start_eligible")
  .filter((record) => !record.worldBinding?.conditionPackPath)
  .sort((left, right) => left.recordId.localeCompare(right.recordId))

assert(sourceRecords.length === 21, `expected 21 unbound complete maps, got ${sourceRecords.length}`)
fs.mkdirSync(batchDir, { recursive: true })

const rows = []
try {
  if (revisionMode) {
    const previousPointer = readRequiredJson(path.join(OUTPUT_ROOT, "latest.json"))
    const previousManifest = readRequiredJson(previousPointer.manifestPath)
    assert(previousManifest.rows?.length === 21, "single-condition revision requires a complete 21-row predecessor")
    assert(previousManifest.rows.some((row) => row.sourceRecordId === REVISE_SOURCE_RECORD_ID), `revision target is missing: ${REVISE_SOURCE_RECORD_ID}`)
    for (const [index, summary] of sourceRecords.entries()) {
      const previousRow = previousManifest.rows.find((row) => row.sourceRecordId === summary.recordId)
      assert(previousRow, `previous condition row missing: ${summary.recordId}`)
      rows.push(summary.recordId === REVISE_SOURCE_RECORD_ID
        ? buildOne(summary, index)
        : { ...previousRow, inheritedFromBatchId: previousManifest.batchId })
    }
  } else {
    for (const [index, summary] of sourceRecords.entries()) rows.push(buildOne(summary, index))
  }
} catch (error) {
  const failure = {
    schemaVersion: "ai-assisted-conditional-world-fact-build-failure-v2",
    status: "failed",
    batchId,
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    error: error instanceof Error ? error.message : "unknown_build_error",
    completedBlueprintCount: rows.length,
    automaticStorage: true,
  }
  writeJson(path.join(batchDir, "failure.json"), failure)
  throw error
}

const manifest = {
  schemaVersion: "ai-assisted-conditional-world-fact-batch-v2",
  status: "condition_blueprints_ready_rgb_pairs_missing",
  batchId,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  ownerAuthorizationRef: revisionMode ? REVISION_OWNER_COMMAND_REF : OWNER_AUTHORIZATION_REF,
  generationContractVersion: GENERATION_CONTRACT_VERSION,
  labelPrefix: LABEL_PREFIX,
  rebuildMode: revisionMode ? "single_condition_geometry_revision" : "full_new_identity_batch",
  revision: revisionMode ? {
    sourceRecordId: REVISE_SOURCE_RECORD_ID,
    reason: REVISION_REASON,
    ownerCommandRef: REVISION_OWNER_COMMAND_REF,
    revisedRowCount: 1,
    inheritedRowCount: 20,
  } : null,
  sourceBlueprintReuse: false,
  historicalBatchMutation: false,
  historicalBatchesRetained: true,
  completeMapScopeRequired: true,
  policyVersion: "owner-authorized-ai-assisted-cold-start-v1",
  worldProfileId: WORLD_PROFILE_ID,
  dictionaryVersionId: dictionary.dictionaryVersionId,
  profilePath: PROFILE_PATH,
  profileSha256: sha256(fs.readFileSync(resolveProjectPath(PROFILE_PATH))),
  connectivityContractId: connectivityPointer.contractId,
  connectivityBlueprintId: connectivityPointer.blueprintId,
  connectivityBlueprintPath: connectivityPointer.blueprintPath,
  connectivityBlueprintSha256: connectivityPointer.blueprintSha256,
  sourceMode: "generation_intent_before_rgb_plus_locked_world_rules",
  sourceImageGeometryRead: false,
  changesRuntimeWorldFacts: false,
  existingRgbBoundToGeneratedConditions: false,
  generatedBlueprintCount: rows.length,
  generatedConditionPackCount: rows.length,
  pairedRgbCount: 0,
  formalTrainingEligible: false,
  conditionalTrainingEligible: false,
  blockers: [
    "condition_blueprints_require_new_rgb_pairs",
    "ai_assisted_conditional_training_threshold_pending_owner_approval",
    "world_connectivity_coverage_thresholds_pending",
  ],
  rows,
  automaticStorage: true,
}
const manifestPath = path.join(batchDir, "manifest.json")
writeJson(manifestPath, manifest)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), {
  schemaVersion: "ai-assisted-conditional-world-fact-latest-v2",
  status: manifest.status,
  batchId,
  generationContractVersion: GENERATION_CONTRACT_VERSION,
  labelPrefix: LABEL_PREFIX,
  createdAtUtc: timestamp,
  manifestPath: projectPath(manifestPath),
  generatedBlueprintCount: rows.length,
  generatedConditionPackCount: rows.length,
  pairedRgbCount: 0,
  conditionalTrainingEligible: false,
})

console.log(JSON.stringify({
  status: manifest.status,
  batchId,
  manifestPath: projectPath(manifestPath),
  generatedBlueprintCount: rows.length,
  generatedConditionPackCount: rows.length,
  pairedRgbCount: 0,
  blockers: manifest.blockers,
}, null, 2))

function buildOne(summary, index) {
  const record = readRequiredJson(summary.recordPath)
  assert(record.recordId === summary.recordId, `record identity mismatch: ${summary.recordId}`)
  assert(record.reviews?.ownerReviewStatus === "owner_approved", `owner review missing: ${summary.recordId}`)
  assert(record.worldBinding?.worldProfileId === WORLD_PROFILE_ID, `world profile mismatch: ${summary.recordId}`)
  assert(!record.worldBinding?.conditionPackPath, `record already has a condition pack: ${summary.recordId}`)

  const promptPath = resolveProjectPath(record.aiAssistedColdStart.promptEvidencePath)
  verifyHash(promptPath, record.aiAssistedColdStart.promptEvidenceSha256, `prompt hash mismatch: ${summary.recordId}`)
  const promptEvidence = readRequiredJson(promptPath)
  assert(promptEvidence.createdAtUtc <= record.createdAtUtc, `prompt does not predate record: ${summary.recordId}`)
  assert(promptEvidence.targetWorldProfileId === WORLD_PROFILE_ID, `prompt world profile mismatch: ${summary.recordId}`)

  const snapshotId = record.worldBinding.snapshotId
  const snapshotPath = promptEvidence.targetVisualSnapshotPath
    ?? snapshotPathForId(snapshotId)
  const snapshot = readRequiredJson(snapshotPath)
  assert(snapshot.snapshotId === snapshotId, `snapshot identity mismatch: ${summary.recordId}`)

  const recipe = recipeFor(record.recordId, promptEvidence.targetRegionalLandscapeType)
  const conditionLabel = conditionLabelFor(index)
  const environmentContext = buildEnvironmentContext({ record, snapshot, recipe })
  const sampleDir = path.join(batchDir, conditionLabel)
  const taskId = `training-world-visual-task-${conditionLabel}-${timestamp.replace(/[:.]/g, "-")}`
  const worldId = `training-world:${conditionLabel}`
  const geometry = buildGeometry(conditionLabel, recipe)
  const blueprint = buildBlueprint({ record, conditionLabel, promptEvidence, snapshot, snapshotPath, recipe, geometry, environmentContext, taskId, worldId })
  const blueprintPath = path.join(sampleDir, "world-fact-blueprint.json")
  writeJson(blueprintPath, blueprint)

  const visualFacts = buildVisualFacts({ conditionLabel, recipe, geometry, environmentContext, taskId, worldId, blueprintPath })
  const visualFactPath = path.join(sampleDir, "visual-fact-manifest.json")
  writeJson(visualFactPath, visualFacts)

  const directorPlan = buildDirectorPlan({ conditionLabel, recipe, geometry, environmentContext, taskId, worldId, visualFacts, snapshot })
  const taskPackage = buildTaskPackage({ record, conditionLabel, recipe, geometry, environmentContext, taskId, worldId, visualFacts, visualFactPath, directorPlan, snapshot, snapshotPath, blueprintPath })
  validateRequiredFields(directorPlan, REQUIRED_DIRECTOR_OUTPUT_FIELDS, `director:${record.recordId}`)
  validateRequiredFields(taskPackage, REQUIRED_TASK_PACKAGE_FIELDS, `task:${record.recordId}`)
  taskPackage.taskSha256 = sha256(Buffer.from(JSON.stringify(taskPackage)))

  const taskPath = path.join(sampleDir, "task-package.json")
  const directorPath = path.join(sampleDir, "director-output.json")
  const taskManifestPath = path.join(sampleDir, "manifest.json")
  writeJson(taskPath, taskPackage)
  writeJson(directorPath, directorPlan)
  const taskManifest = {
    schemaVersion: "world-visual-generation-task-manifest-v1",
    taskId,
    status: taskPackage.status,
    inferenceStatus: taskPackage.inferenceGate.status,
    createdAt: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    dictionaryVersionId: dictionary.dictionaryVersionId,
    worldId,
    ownerId: "project-owner",
    tick: 0,
    worldProfileId: WORLD_PROFILE_ID,
    generationContractVersion: GENERATION_CONTRACT_VERSION,
    conditionLabel,
    earthParameterSnapshotId: snapshotId,
    environmentContext,
    runtimeFrameId: null,
    sourceMode: "training_world_fact_blueprint",
    taskSha256: taskPackage.taskSha256,
    taskPath: projectPath(taskPath),
    directorPath: projectPath(directorPath),
    blueprintPath: projectPath(blueprintPath),
    imageCount: 0,
    automaticStorage: true,
  }
  writeJson(taskManifestPath, taskManifest)

  const compiler = spawnSync(process.execPath, [
    path.join(ROOT, "scripts", "compile-current-world-visual-conditions.mjs"),
    "--task", projectPath(taskPath),
    "--task-manifest", projectPath(taskManifestPath),
  ], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  assert(compiler.status === 0, `condition compilation failed for ${record.recordId}: ${compiler.stderr || compiler.stdout}`)
  const conditionManifestPath = path.join(sampleDir, "compiled-conditions", "manifest.json")
  const conditionManifest = readRequiredJson(conditionManifestPath)
  assert(conditionManifest.channelCount === 23, `condition channel count mismatch: ${record.recordId}`)

  return {
    sourceRecordId: record.recordId,
    conditionLabel,
    generationContractVersion: GENERATION_CONTRACT_VERSION,
    sourceBlueprintReuse: false,
    promptEvidencePath: record.aiAssistedColdStart.promptEvidencePath,
    promptEvidenceSha256: record.aiAssistedColdStart.promptEvidenceSha256,
    targetRegionalLandscapeType: recipe.landscape,
    snapshotId,
    environmentContextContractVersion: environmentContext.contractVersion,
    season: environmentContext.season,
    environmentState: environmentContext.environmentState,
    worldId,
    taskId,
    blueprintPath: projectPath(blueprintPath),
    blueprintSha256: sha256(fs.readFileSync(blueprintPath)),
    visualFactManifestPath: projectPath(visualFactPath),
    visualFactManifestSha256: visualFacts.manifestSha256,
    directorOutputPath: projectPath(directorPath),
    directorOutputSha256: sha256(fs.readFileSync(directorPath)),
    taskPackagePath: projectPath(taskPath),
    taskPackageSha256: sha256(fs.readFileSync(taskPath)),
    conditionManifestPath: projectPath(conditionManifestPath),
    conditionPackPath: conditionManifest.conditionPackPath,
    conditionPackSha256: conditionManifest.conditionPackSha256,
    channelCount: conditionManifest.channelCount,
    sourceImageGeometryRead: false,
    existingRgbBound: false,
    needsNewRgbPair: true,
  }
}

function buildBlueprint({ record, conditionLabel, promptEvidence, snapshot, snapshotPath, recipe, geometry, environmentContext, taskId, worldId }) {
  return {
    schemaVersion: "ai-assisted-training-world-fact-blueprint-v2",
    blueprintId: `training-world-facts-${conditionLabel}`,
    status: "training_facts_ready_rgb_pair_missing",
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    ownerAuthorizationRef: revisionMode ? REVISION_OWNER_COMMAND_REF : OWNER_AUTHORIZATION_REF,
    generationContractVersion: GENERATION_CONTRACT_VERSION,
    conditionLabel,
    sourceBlueprintReuse: false,
    completeMapScopeRequired: true,
    sourceMode: "generation_intent_before_rgb_plus_locked_world_rules",
    sourceRecordId: record.recordId,
    sourcePromptEvidencePath: record.aiAssistedColdStart.promptEvidencePath,
    sourcePromptEvidenceSha256: record.aiAssistedColdStart.promptEvidenceSha256,
    sourcePromptCreatedAtUtc: promptEvidence.createdAtUtc,
    sourceImagePathRead: false,
    sourceImageGeometryRead: false,
    existingRgbMayBeBoundAsTarget: false,
    taskId,
    worldId,
    tick: 0,
    worldProfileId: WORLD_PROFILE_ID,
    earthParameterSnapshotId: snapshot.snapshotId,
    earthParameterSnapshotPath: projectPath(snapshotPath),
    connectivityContractId: connectivityPointer.contractId,
    connectivityBlueprintId: connectivityPointer.blueprintId,
    connectivityBlueprintPath: connectivityPointer.blueprintPath,
    connectivityTrainingEligible: false,
    connectivityThresholdStatus: "pending_owner_approval",
    landscapeType: recipe.landscape,
    environmentContext,
    canvas: { width: WIDTH, height: HEIGHT, frameScope: "complete_runtime_frame" },
    geometry,
    semanticRules: {
      waterFlow: recipe.waterFlow,
      routeIntent: recipe.routeIntent,
      siteSelectionPolicy: "initial_natural_world_no_preset_home_site",
      camera: "top_down_slight_three_quarter_2d",
      style: "native_1024x768_high_resolution_pixel_game_map",
      forbidden: [
        "building",
        "character",
        "animal",
        "bridge",
        "text",
        "ui",
        "program_drawn_final_art",
        "preset_home_site",
        "construction_clearing",
        "route_convergence_platform",
      ],
    },
    outputContract: {
      generatesRgb: false,
      changesRuntimeWorldFacts: false,
      formalCandidate: false,
      needsNewRgbPairCreatedAfterThisBlueprint: true,
    },
    automaticStorage: true,
  }
}

function buildVisualFacts({ conditionLabel, recipe, geometry, environmentContext, taskId, worldId, blueprintPath }) {
  const facts = [
    fact(`${conditionLabel}:entrance`, "entrance", geometry.entranceBounds),
    fact(`${conditionLabel}:natural-boundary`, "natural_boundary", { x: 0, y: 0, width: WIDTH, height: HEIGHT }),
    ...geometry.terrainRegions.map((region) => ({
      factId: `${conditionLabel}:terrain:${region.sourceId}`,
      semanticType: `terrain_${region.kind}`,
      sourceType: "training_world_fact_blueprint",
      polygon: region.polygon,
    })),
  ]
  const payload = {
    schemaVersion: "world-visual-fact-manifest-v1",
    manifestId: `visual-facts-${taskId}`,
    createdAt: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    passed: true,
    worldId,
    ownerId: "project-owner",
    tick: 0,
    worldProfileId: WORLD_PROFILE_ID,
    generationContractVersion: GENERATION_CONTRACT_VERSION,
    conditionLabel,
    sourceMode: "training_world_fact_blueprint",
    sourceBlueprintPath: projectPath(blueprintPath),
    sourceImageGeometryRead: false,
    visualFactIds: facts.map((entry) => entry.factId),
    visualFacts: facts,
    forbiddenLeakIds: [],
    counts: { includedFacts: facts.length, excludedFacts: 0 },
    worldSignals: {
      biomeType: recipe.landscape,
      moistureLevel: recipe.moisture,
      vegetationDensity: recipe.vegetationDensity,
      environmentContext,
      missingSignals: [],
    },
  }
  payload.manifestSha256 = sha256(Buffer.from(JSON.stringify(payload)))
  return payload
}

function buildDirectorPlan({ conditionLabel, recipe, geometry, environmentContext, taskId, worldId, visualFacts, snapshot }) {
  const sceneIntent = {
    sceneIntentId: `natural-home-${conditionLabel}`,
    sceneType: "training_complete_natural_home_map",
    mainStory: `A ${recipe.landscape} natural-home region in ${environmentContext.environmentState}, defined before RGB creation.`,
    primaryFocus: "complete_natural_region",
    mustShow: ["entrance", "main_path", "natural_boundary", ...(geometry.hasWater ? ["water_edge"] : [])],
    mayShow: ["tree", "rock", "shrub", "flower_patch", "grass_detail"],
    mustNotShow: [
      "player",
      "butler",
      "building",
      "animal",
      "debug_preview",
      "material_test_board",
      "preset_home_site",
      "construction_clearing",
      "route_convergence_platform",
    ],
  }
  const compositionPlan = {
    readOrder: ["entrance", "main_path", ...(geometry.hasWater ? ["water_edge"] : []), "natural_boundary", "ecological_zones"],
    focalHierarchy: ["complete_natural_region", "route", ...(geometry.hasWater ? ["water_edge"] : []), "boundary", "detail_clusters"],
    layoutIntent: recipe.routeIntent,
    clutterBudget: "controlled_with_quiet_playable_areas",
    cameraFit: "top_down_complete_map_readability",
  }
  const terrainPlan = {
    baseTerrain: "grass",
    terrainKinds: [...new Set(geometry.terrainRegions.map((entry) => entry.kind))],
    terrainTransitions: ["grass_to_path", ...(geometry.hasWater ? ["grass_to_water", "water_to_shoreline"] : []), "object_to_ground"],
    pathWearRules: ["soft_embedded_edge", "limited_mud", "continuous_route"],
    waterEdgeRules: geometry.hasWater ? ["coherent_water_mass", "visible_shoreline_transition", "no_vertical_wall"] : [],
    forbiddenTerrainArtifacts: ["random_noise_field", "gray_green_camouflage", "pasted_path_band", "hard_cut_shoreline"],
  }
  return {
    schemaVersion: "world-visual-director-output-v1",
    directorRunId: `training-world-director-${conditionLabel}-${timestamp.replace(/[:.]/g, "-")}`,
    createdAt: timestamp,
    dictionaryVersionId: dictionary.dictionaryVersionId,
    worldId,
    generationContractVersion: GENERATION_CONTRACT_VERSION,
    conditionLabel,
    tick: 0,
    sourceFactIds: visualFacts.visualFactIds,
    singleMapScopePlan: { activeGoal: "single_complete_map_visual", outputSize: { width: WIDTH, height: HEIGHT } },
    sceneIntent,
    compositionPlan,
    terrainPlan,
    assetPlan: { allowedKinds: ["tree", "rock", "shrub", "flower_patch", "grass_detail"], objectCount: geometry.objectFootprints.length },
    motionPlan: { currentScope: "static_visual_milestone", futureRuntimeMotionReserved: true },
    drawingProcessPlan: { structureBeforePixels: true, sourceImageGeometryRead: false, programDrawnFinalArtForbidden: true },
    artDirectionPlan: standardArtDirection(),
    materialRecipePlan: { requiredMaterials: ["grass", "dirt_path", "stone", "vegetation_detail", ...(geometry.hasWater ? ["water", "shoreline"] : [])] },
    singleMapEcologyPlan: {
      landscapeType: recipe.landscape,
      moisture: recipe.moisture,
      vegetationDensity: recipe.vegetationDensity,
      snapshotId: snapshot.snapshotId,
      season: environmentContext.season,
      environmentState: environmentContext.environmentState,
      groundMoisture: environmentContext.groundMoisture,
    },
    singleMapMaterialPlan: {
      palette: "mainland_southeast_asia_tropical_monsoon_natural_home",
      season: environmentContext.season,
      environmentState: environmentContext.environmentState,
      weather: environmentContext.weather,
      lighting: environmentContext.lighting,
      groundMoisture: environmentContext.groundMoisture,
    },
    compositionRecipePlan: compositionPlan,
    singleMapCompositionPlan: {
      entranceBounds: geometry.entranceBounds,
      routeIntent: recipe.routeIntent,
      siteSelectionPolicy: "initial_natural_world_no_preset_home_site",
    },
    renderLayerRecipePlan: standardRenderLayers(),
    qualityRubricPlan: { required: ["game_read", "map_grammar", "style_unity", "grounding", "polish"], ownerReviewRequired: true },
    singleMapAcceptancePlan: { passDefinition: "one_complete_professional_natural_home_map_visual", ownerReviewRequired: true },
    fixPlanInput: { previousFailures: [], source: "new_training_fact_blueprint" },
    generationTaskDraft: { schemaVersion: "runtime-frame-generation-task-v1", taskId, outputSize: { width: WIDTH, height: HEIGHT }, requiredParts: sceneIntent.mustShow },
    safety: { changesRuntimeWorldFacts: false, existingRgbBindingForbidden: true, formalCandidate: false },
  }
}

function buildTaskPackage({ record, conditionLabel, recipe, geometry, environmentContext, taskId, worldId, visualFacts, visualFactPath, directorPlan, snapshot, snapshotPath, blueprintPath }) {
  const materialRecipes = standardMaterials(geometry.hasWater)
  return {
    schemaVersion: "runtime-frame-generation-task-v1",
    taskId,
    createdAt: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    status: "training_condition_blueprint_ready_rgb_pair_missing",
    generationMode: "new_training_pair_preparation",
    dictionaryVersionId: dictionary.dictionaryVersionId,
    worldId,
    ownerId: "project-owner",
    tick: 0,
    worldProfileId: WORLD_PROFILE_ID,
    generationContractVersion: GENERATION_CONTRACT_VERSION,
    conditionLabel,
    earthParameterSnapshotId: snapshot.snapshotId,
    environmentContext,
    outputSize: { width: WIDTH, height: HEIGHT, aspect: "4:3", frameScope: "complete_runtime_frame" },
    singleMapScope: { activeGoal: "single_complete_map_visual", forbiddenCurrentRequirements: ["player", "building", "animal"], allowedCurrentRequirements: ["map_structure", "terrain", "material", "ecology", "composition", "storage"] },
    sourceFactIds: visualFacts.visualFactIds,
    sourceBindings: {
      sourceMode: "training_world_fact_blueprint",
      trainingBlueprintPath: projectPath(blueprintPath),
      promptEvidencePath: record.aiAssistedColdStart.promptEvidencePath,
      visualFactManifestId: visualFacts.manifestId,
      visualFactManifestPath: projectPath(visualFactPath),
      visualFactManifestSha256: visualFacts.manifestSha256,
      dictionaryPath: dictionary.dictionaryPath,
      worldProfilePath: PROFILE_PATH,
      earthParameterSnapshotPath: projectPath(snapshotPath),
      connectivityBlueprintPath: connectivityPointer.blueprintPath,
      datasetPackagePath: null,
      datasetPackageId: null,
      runtimeFramePath: null,
      runtimeFrameId: null,
      structureId: `training-structure-${conditionLabel}`,
    },
    directorPlan,
    mapGrammar: {
      requiredParts: directorPlan.sceneIntent.mustShow.map((partId) => ({ partId })),
      routeGraph: { intent: recipe.routeIntent },
      adjacencyRules: [],
      forbiddenLayouts: [
        "isolated_path",
        "fragmented_water",
        "material_test_board",
        "preset_home_site",
        "construction_clearing",
        "rectangular_route_platform",
      ],
    },
    spatialLayers: {
      terrainRegions: geometry.terrainRegions,
      walkableRegions: geometry.walkableRegions,
      collisionRegions: geometry.collisionRegions,
      interactionRegions: [],
      objectFootprints: geometry.objectFootprints,
      stateRegions: [],
    },
    ecologyState: {
      biomeType: recipe.landscape,
      moistureLevel: recipe.moisture,
      vegetationDensity: recipe.vegetationDensity,
      season: environmentContext.season,
      environmentState: environmentContext.environmentState,
      weather: environmentContext.weather,
      lighting: environmentContext.lighting,
      groundMoisture: environmentContext.groundMoisture,
      source: "locked_profile_snapshot_and_generation_intent",
    },
    singleMapEcologyFields: { moistureMap: { source: "water_geometry" }, boundaryVegetation: { role: "natural_frame" }, noiseControl: { randomScatter: "forbidden", quietAreasRequired: true } },
    gameplayContract: { movementReadability: "route_and_open_ground_visual_read", collisionReadability: "blocked_regions_have_natural_visual_causes", cameraGameplayFit: "top_down_complete_map_read" },
    visualStyle: standardVisualStyle(),
    drawingProcess: { intentLock: true, spatialBlockoutSource: "training_world_fact_blueprint", textureBeforeBlockoutForbidden: true, sourceImageGeometryRead: false, reviewPass: { machineReview: true, ownerReview: true } },
    artDirection: { genreRead: "high-resolution pixel-art playable natural home world map", styleFamily: "professional high-resolution 2d pixel game map", forbiddenLooks: ["noise_map", "asset_collage", "debug_preview", "program_drawn_final_art"] },
    materialRecipes,
    singleMapMaterialFields: materialRecipes,
    compositionRecipe: {
      routeShape: recipe.routeIntent,
      negativeSpacePlan: {
        preserve: ["main_route", "multiple_natural_ecological_zones"],
        presetConstructionClearingForbidden: true,
      },
    },
    singleMapCompositionFields: {
      entrancePlacement: geometry.entranceBounds,
      mainRoutePlan: recipe.routeIntent,
      boundaryFrame: "natural_irregular_frame",
      siteSelectionPolicy: "runtime_butler_autonomy_only",
    },
    renderLayerRecipe: standardRenderLayers(),
    qualityRubric: { categories: ["game_read", "map_grammar", "material_quality", "style_unity", "grounding", "polish"], ownerReviewOverride: true },
    singleMapAcceptance: { activeGates: ["map_structure", "material_quality", "composition_quality", "object_grounding", "storage_trace", "owner_review"], passDefinition: "one_complete_professional_natural_home_map_visual", ownerReviewRequired: true },
    allowedEntities: geometry.objectFootprints.map((entry) => ({ id: entry.objectId, kind: entry.kind, footprint: entry.footprint })),
    forbiddenContent: ["player", "butler", "building", "construction", "npc", "animal", "debug_overlay", "local_material_test_board"],
    previousFailures: [],
    storageContract: { mustStoreGeneratedImage: true, mustStoreTaskJson: true, mustStoreModelCheckpoint: true, mustStoreMachineReview: true, mustStoreFailureCodes: true, ownerReviewStatus: "pending" },
    inferenceGate: { status: "blocked_rgb_pair_missing_and_owner_threshold_pending", canRunCompleteVisualInference: false, reasons: ["condition_blueprint_requires_new_rgb_pair", "ai_assisted_conditional_training_threshold_pending_owner_approval"] },
    bootstrapInferenceGate: { status: "historical_third_party_bootstrap_disabled", canRunBootstrapInference: false, canEnterWorld: false, canCountAsPositiveSample: false, independentTrainingEligible: false, requiresMachineReview: true, requiresOwnerReview: true },
  }
}

function buildGeometry(sampleId, recipe) {
  const grass = polygonRegion(`${sampleId}-grass`, "grass", rectPolygon(0, 0, 1, 1))
  const waterRegions = []
  const shorelineRegions = []
  recipe.waterLines.forEach((line, index) => {
    shorelineRegions.push(polygonRegion(`${sampleId}-shore-line-${index + 1}`, "shoreline", ribbonPolygon(line.points, line.width + 0.025)))
    waterRegions.push(polygonRegion(`${sampleId}-water-line-${index + 1}`, "water", ribbonPolygon(line.points, line.width)))
  })
  recipe.waterEllipses.forEach((ellipse, index) => {
    shorelineRegions.push(polygonRegion(`${sampleId}-shore-basin-${index + 1}`, "shoreline", ellipsePolygon(ellipse.cx, ellipse.cy, ellipse.rx + 0.025, ellipse.ry + 0.025)))
    waterRegions.push(polygonRegion(`${sampleId}-water-basin-${index + 1}`, "water", ellipsePolygon(ellipse.cx, ellipse.cy, ellipse.rx, ellipse.ry)))
  })
  const pathRegions = recipe.pathLines.map((line, index) => polygonRegion(`${sampleId}-path-${index + 1}`, "path_ground", ribbonPolygon(line.points, line.width)))
  const boundaryPlan = edgeBoundaries(sampleId, recipe.boundaryDepth, recipe.pathLines)
  const boundaryRegions = boundaryPlan.regions
  const mudRegions = recipe.mudAreas.map((area, index) => polygonRegion(`${sampleId}-mud-${index + 1}`, "mud_patch", ellipsePolygon(area.cx, area.cy, area.rx, area.ry)))
  const tallGrassRegions = recipe.tallGrassAreas.map((area, index) => polygonRegion(`${sampleId}-tall-grass-${index + 1}`, "tall_grass", ellipsePolygon(area.cx, area.cy, area.rx, area.ry)))
  const objectExclusionPolygons = [...waterRegions, ...pathRegions].map((entry) => entry.polygon)
  const objectFootprints = buildObjects(sampleId, recipe, objectExclusionPolygons)
  const collisionRegions = [
    ...waterRegions.map((entry) => ({ sourceId: `${entry.sourceId}-collision`, polygon: entry.polygon })),
    ...boundaryRegions.map((entry) => ({ sourceId: `${entry.sourceId}-collision`, polygon: entry.polygon })),
  ]
  const entrance = recipe.pathLines[0].points[0]
  return {
    hasWater: waterRegions.length > 0,
    terrainRegions: [grass, ...shorelineRegions, ...waterRegions, ...pathRegions, ...boundaryRegions, ...mudRegions, ...tallGrassRegions],
    walkableRegions: pathRegions.map((entry) => ({ sourceId: `${entry.sourceId}-walkable`, polygon: entry.polygon })),
    collisionRegions,
    boundaryPassages: boundaryPlan.passages,
    objectFootprints,
    entranceBounds: boundsFromCenter(entrance.x, entrance.y, 0.08, 0.06),
    focalBounds: null,
  }
}

function buildObjects(sampleId, recipe, exclusionPolygons) {
  const random = seededRandom(sampleId)
  const rows = []
  const kinds = [
    ...Array(recipe.objectCounts.tree).fill("tree"),
    ...Array(recipe.objectCounts.rock).fill("rock"),
    ...Array(recipe.objectCounts.vegetation).fill(recipe.primaryVegetation),
  ]
  for (let index = 0; index < kinds.length; index += 1) {
    const kind = kinds[index]
    const size = kind === "tree" ? [0.055, 0.075] : kind === "rock" ? [0.038, 0.032] : [0.042, 0.036]
    let x = 0.15
    let y = 0.15
    let accepted = false
    for (let attempt = 0; attempt < 120; attempt += 1) {
      x = 0.07 + random() * 0.86
      y = 0.06 + random() * 0.88
      const candidate = normalizedBoundsFromCenter(x, y, size[0], size[1])
      if (boundsTouchesAnyPolygon(candidate, exclusionPolygons)) continue
      if (rows.some((row) => normalizedBoundsOverlap(candidate, normalizePixelBounds(row.footprint), 0.012))) continue
      accepted = true
      break
    }
    assert(accepted, `unable to place non-overlapping object ${index + 1} for ${sampleId}`)
    rows.push({
      objectId: `${sampleId}-${kind}-${String(index + 1).padStart(2, "0")}`,
      kind,
      footprint: boundsFromCenter(x, y, size[0], size[1]),
      blocksMovement: ["tree", "rock"].includes(kind),
    })
  }
  return rows
}

function recipeFor(recordId, landscapeFromPrompt) {
  const id = recordId.match(/map-(\d{3})/)?.[1]
  const specs = {
    "001": spec("lowland-evergreen-tropical-forest", "river_left_north_to_south", "lower entrance to central clearing", [line([[0.12, -0.05], [0.16, 0.35], [0.10, 0.7], [0.18, 1.05]], 0.085)], [], [line([[0.5, 1.03], [0.49, 0.72], [0.53, 0.51], [0.48, 0.32]], 0.032)], [0.5, 0.48]),
    "002": spec("tropical-valley-floor", "upper_left_to_lower_right", "south entrance to asymmetric center on the southwest bank", [line([[-0.05, 0.08], [0.28, 0.22], [0.62, 0.46], [1.05, 0.9]], 0.075)], [], [line([[0.28, 1.03], [0.33, 0.78], [0.43, 0.64], [0.52, 0.52]], 0.03)], [0.52, 0.52]),
    "004": spec("moist-deciduous-teak-forest", "west_creek_north_to_south", "lower entrance through teak glade to upper-left continuation", [line([[0.16, -0.03], [0.12, 0.34], [0.18, 0.66], [0.13, 1.03]], 0.035)], [], [line([[0.55, 1.03], [0.48, 0.72], [0.42, 0.5], [0.22, 0.12]], 0.032)], [0.43, 0.52]),
    "005": spec("seasonal-evergreen-semi-evergreen-forest", "no_major_water", "lower entrance through modest center to upper continuation", [], [], [line([[0.46, 1.03], [0.4, 0.74], [0.53, 0.49], [0.58, -0.03]], 0.03)], [0.5, 0.5]),
    "006": spec("dry-dipterocarp-woodland", "dry_drainage_no_surface_water", "lower entrance across open woodland", [], [], [line([[0.32, 1.03], [0.38, 0.72], [0.55, 0.5], [0.72, 0.12]], 0.032)], [0.54, 0.52], "low", "open"),
    "007": spec("bamboo-grove", "small_moist_hollow", "lower entrance through bamboo clearings", [], [ellipse(0.68, 0.36, 0.07, 0.05)], [line([[0.45, 1.03], [0.43, 0.74], [0.52, 0.52], [0.36, 0.2]], 0.03)], [0.5, 0.55], "high"),
    "008": {
      ...spec("riparian-tropical-forest", "upper_left_to_lower_right", "lower entrance on the broad eastern bank to upper continuation", [line([[-0.05, 0.08], [0.02, 0.11], [0.09, 0.16], [0.13, 0.23], [0.17, 0.31], [0.25, 0.36], [0.32, 0.41], [0.36, 0.49], [0.4, 0.56], [0.48, 0.61], [0.54, 0.67], [0.56, 0.75], [0.59, 0.82], [0.66, 0.9], [0.72, 1.03]], 0.065)], [], [line([[0.84, 1.03], [0.79, 0.91], [0.76, 0.82], [0.77, 0.72], [0.78, 0.64], [0.72, 0.58], [0.7, 0.53], [0.73, 0.45], [0.74, 0.39], [0.69, 0.33], [0.63, 0.27], [0.6, 0.2], [0.57, 0.12]], 0.03)], [0.7, 0.57], "high"),
      centerIntent: "irregular_playable_natural_home_center_semantic_only_no_rectangular_ground_patch",
      focalSize: { width: 0.1, height: 0.08 },
    },
    "009": spec("monsoon-grassland", "shallow_drainage_swale", "lower entrance through the southwestern open grassland center on stable ground", [line([[0.1, 0.18], [0.4, 0.4], [0.7, 0.63], [0.95, 0.8]], 0.022)], [], [line([[0.68, 1.03], [0.64, 0.82], [0.42, 0.62], [0.22, 0.5], [0.23, 0.42]], 0.032)], [0.32, 0.55], "medium", "open"),
    "010": spec("tropical-forest-glade", "small_shaded_depression", "southern entrance crosses the complete glade and continues through the northern boundary", [], [ellipse(0.72, 0.67, 0.055, 0.04)], [line([[0.18, 1.03], [0.32, 0.75], [0.5, 0.52], [0.68, 0.28], [0.82, -0.03]], 0.03)], [0.5, 0.52], "high"),
    "011": spec("river-floodplain", "river_with_drainage_branch", "higher-ground route through the southern floodplain center", [line([[-0.04, 0.22], [0.35, 0.28], [0.66, 0.48], [1.04, 0.62]], 0.065), line([[0.64, 0.48], [0.72, 0.7], [0.88, 0.92]], 0.025)], [], [line([[0.12, 1.03], [0.28, 0.78], [0.4, 0.68], [0.56, 0.66]], 0.03)], [0.42, 0.7], "high"),
    "012": spec("freshwater-swamp", "connected_shallow_basin", "raised southern route to playable dry swamp center", [line([[0.28, 0.28], [0.5, 0.22], [0.74, 0.28]], 0.04)], [ellipse(0.3, 0.48, 0.16, 0.2), ellipse(0.74, 0.48, 0.16, 0.2)], [line([[0.52, 1.03], [0.52, 0.76], [0.52, 0.56], [0.52, 0.42]], 0.028)], [0.52, 0.5], "very_high"),
    "013": spec("reed-marsh", "connected_shallow_water_lanes", "raised path to marsh overlook", [line([[0.15, -0.03], [0.3, 0.34], [0.2, 0.72], [0.36, 1.03]], 0.035), line([[0.72, -0.03], [0.6, 0.34], [0.7, 0.68], [0.58, 1.03]], 0.03)], [], [line([[0.9, 1.03], [0.82, 0.72], [0.74, 0.52], [0.82, 0.2]], 0.028)], [0.74, 0.52], "very_high"),
    "014": spec("pond-short-creek", "pond_connected_to_short_creek", "land route around the western side of the pond", [line([[0.58, 0.34], [0.74, 0.2], [0.83, -0.03]], 0.035)], [ellipse(0.45, 0.53, 0.18, 0.14)], [line([[0.1, 1.03], [0.14, 0.76], [0.2, 0.58], [0.22, 0.28]], 0.03)], [0.24, 0.54], "high"),
    "015": spec("tropical-mountain-stream", "higher_ground_to_lower_outlet", "land route across elevation terraces", [line([[0.26, -0.03], [0.36, 0.28], [0.52, 0.55], [0.72, 1.03]], 0.035)], [], [line([[0.82, 1.03], [0.68, 0.72], [0.62, 0.5], [0.7, 0.16]], 0.028)], [0.61, 0.52], "high"),
    "016": spec("limestone-foothill", "no_major_surface_water", "lower saddle route ascending gently", [], [], [line([[0.18, 1.03], [0.38, 0.72], [0.53, 0.55], [0.72, 0.28]], 0.03)], [0.52, 0.54], "medium"),
    "017": spec("rocky-low-hill", "no_major_surface_water", "southern entrance crosses the open hill saddle and continues through the northern boundary", [], [], [line([[0.24, 1.03], [0.36, 0.74], [0.52, 0.52], [0.68, 0.28], [0.8, -0.03]], 0.03)], [0.52, 0.52], "medium"),
    "018": spec("forested-low-mountain", "no_major_surface_water", "lower route follows saddle toward high ground", [], [], [line([[0.48, 1.03], [0.45, 0.74], [0.54, 0.5], [0.68, 0.12]], 0.03)], [0.53, 0.53], "high"),
    "019": spec("tropical-valley-floor", "upper_left_to_lower_right_drainage", "southern entrance crosses the complete lower valley floor and reaches the protected center below the drainage", [line([[-0.03, 0.1], [0.28, 0.12], [0.65, 0.28], [1.03, 0.55]], 0.028)], [], [line([[0.18, 1.03], [0.32, 0.84], [0.55, 0.72], [0.72, 0.78]], 0.03)], [0.55, 0.72], "high"),
    "020": spec("wet-season-drainage-hollow", "connected_intermediate_shallow_swale", "raised path bends around the southwestern side of the central hollow", [line([[-0.03, 0.14], [0.32, 0.38], [0.62, 0.6], [1.03, 0.88]], 0.018)], [], [line([[0.86, 1.03], [0.64, 0.74], [0.3, 0.62], [0.15, 0.55]], 0.03)], [0.32, 0.68], "very_high"),
    "021": spec("dry-season-exposed-riverbank", "upper_right_to_lower_left", "southern entrance follows stable eastern high ground to the complete-map center beside the river", [line([[1.04, 0.08], [0.72, 0.3], [0.45, 0.58], [-0.04, 0.9]], 0.065)], [], [line([[0.9, 1.03], [0.91, 0.78], [0.88, 0.54], [0.86, 0.36]], 0.03)], [0.88, 0.54], "medium", "open"),
    "022": spec("grassland-forest-transition", "no_major_surface_water", "lower grassland route through transition to upper-right forest", [], [], [line([[0.42, 1.03], [0.48, 0.72], [0.6, 0.48], [0.92, 0.08]], 0.032)], [0.55, 0.55], "medium", "transition"),
  }
  const recipe = specs[id]
  assert(recipe, `missing training fact recipe for ${recordId}`)
  if (landscapeFromPrompt) assert(recipe.landscape === landscapeFromPrompt, `landscape recipe mismatch for ${recordId}`)
  return recipe
}

function spec(landscape, waterFlow, routeIntent, waterLines = [], waterEllipses = [], pathLines = [], center = [0.5, 0.5], moisture = "high", vegetationDensity = "balanced") {
  const primaryVegetation = landscape.includes("bamboo") ? "bamboo" : landscape.includes("marsh") ? "reed" : "shrub"
  return {
    landscape,
    waterFlow,
    routeIntent,
    waterLines,
    waterEllipses,
    pathLines,
    center: { x: center[0], y: center[1] },
    moisture,
    vegetationDensity,
    primaryVegetation,
    boundaryDepth: vegetationDensity === "open" ? 0.035 : 0.055,
    objectCounts: vegetationDensity === "open" ? { tree: 6, rock: 5, vegetation: 7 } : { tree: 10, rock: 4, vegetation: 8 },
    mudAreas: moisture === "very_high" ? [ellipse(center[0] - 0.12, center[1] + 0.12, 0.09, 0.05)] : [],
    tallGrassAreas: moisture === "very_high" || landscape.includes("grassland") ? [ellipse(center[0] + 0.16, center[1] - 0.12, 0.12, 0.08)] : [],
  }
}

function conditionLabelFor(index) {
  assert(Number.isInteger(index) && index >= 0 && index < 21, `condition label index invalid: ${index}`)
  return `${LABEL_PREFIX}-${String(index + 1).padStart(3, "0")}`
}

function line(points, width) { return { points: points.map(([x, y]) => ({ x, y })), width } }
function ellipse(cx, cy, rx, ry) { return { cx, cy, rx, ry } }
function polygonRegion(sourceId, kind, polygon) { return { sourceId, kind, polygon } }
function rectPolygon(x, y, width, height) { return scalePoints([{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }]) }
function ellipsePolygon(cx, cy, rx, ry, count = 28) { return scalePoints(Array.from({ length: count }, (_, index) => ({ x: cx + Math.cos(index * Math.PI * 2 / count) * rx, y: cy + Math.sin(index * Math.PI * 2 / count) * ry }))) }

function ribbonPolygon(points, width) {
  const left = []
  const right = []
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)]
    const next = points[Math.min(points.length - 1, index + 1)]
    const dx = next.x - previous.x
    const dy = next.y - previous.y
    const length = Math.hypot(dx, dy) || 1
    const nx = -dy / length * width
    const ny = dx / length * width
    left.push({ x: points[index].x + nx, y: points[index].y + ny })
    right.unshift({ x: points[index].x - nx, y: points[index].y - ny })
  }
  return scalePoints([...left, ...right])
}

function edgeBoundaries(sampleId, depth, pathLines = []) {
  const rasterPassageClearance = 0.04
  const topPassages = mergeIntervals(pathLines.flatMap((route, routeIndex) => route.points
    .filter((point) => point.y <= 0)
    .map((point) => ({
      edge: "top",
      routeIndex,
      start: Math.max(0, point.x - route.width - rasterPassageClearance),
      end: Math.min(1, point.x + route.width + rasterPassageClearance),
    }))))
  const topRegions = []
  let cursor = 0
  for (const passage of topPassages) {
    if (passage.start > cursor) {
      topRegions.push(polygonRegion(
        `${sampleId}-boundary-top-${topRegions.length + 1}`,
        "natural_boundary",
        rectPolygon(cursor, 0, passage.start - cursor, depth),
      ))
    }
    cursor = Math.max(cursor, passage.end)
  }
  if (cursor < 1) {
    topRegions.push(polygonRegion(
      `${sampleId}-boundary-top-${topRegions.length + 1}`,
      "natural_boundary",
      rectPolygon(cursor, 0, 1 - cursor, depth),
    ))
  }
  if (topPassages.length === 0) {
    topRegions.splice(0, topRegions.length, polygonRegion(`${sampleId}-boundary-top`, "natural_boundary", rectPolygon(0, 0, 1, depth)))
  }
  return {
    regions: [
      ...topRegions,
      polygonRegion(`${sampleId}-boundary-left`, "natural_boundary", rectPolygon(0, 0, depth, 1)),
      polygonRegion(`${sampleId}-boundary-right`, "natural_boundary", rectPolygon(1 - depth, 0, depth, 1)),
    ],
    passages: topPassages.map((passage, index) => ({
      passageId: `${sampleId}-top-route-passage-${index + 1}`,
      edge: passage.edge,
      routeIndex: passage.routeIndex,
      bounds: {
        x: Math.round(passage.start * WIDTH),
        y: 0,
        width: Math.round((passage.end - passage.start) * WIDTH),
        height: Math.round(depth * HEIGHT),
      },
      purpose: "route_continuation_without_collision",
    })),
  }
}

function mergeIntervals(intervals) {
  const sorted = [...intervals].sort((left, right) => left.start - right.start)
  const merged = []
  for (const interval of sorted) {
    const previous = merged.at(-1)
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval })
      continue
    }
    previous.end = Math.max(previous.end, interval.end)
  }
  return merged
}

function boundsFromCenter(cx, cy, width, height) {
  return {
    x: Math.round((cx - width / 2) * WIDTH),
    y: Math.round((cy - height / 2) * HEIGHT),
    width: Math.round(width * WIDTH),
    height: Math.round(height * HEIGHT),
  }
}

function normalizedBoundsFromCenter(cx, cy, width, height) {
  return { x: cx - width / 2, y: cy - height / 2, width, height }
}

function normalizePixelBounds(bounds) {
  return { x: bounds.x / WIDTH, y: bounds.y / HEIGHT, width: bounds.width / WIDTH, height: bounds.height / HEIGHT }
}

function boundsTouchesAnyPolygon(bounds, polygons) {
  const points = [
    [bounds.x, bounds.y],
    [bounds.x + bounds.width, bounds.y],
    [bounds.x, bounds.y + bounds.height],
    [bounds.x + bounds.width, bounds.y + bounds.height],
    [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2],
  ]
  return points.some(([x, y]) => pointInAnyPolygon(x, y, polygons))
}

function normalizedBoundsOverlap(left, right, margin = 0) {
  return left.x < right.x + right.width + margin
    && left.x + left.width + margin > right.x
    && left.y < right.y + right.height + margin
    && left.y + left.height + margin > right.y
}

function scalePoints(points) {
  return points.map((point) => ({
    x: Math.round(clamp(point.x, 0, 1) * WIDTH),
    y: Math.round(clamp(point.y, 0, 1) * HEIGHT),
  }))
}

function pointInAnyPolygon(x, y, polygons) {
  const px = x * WIDTH
  const py = y * HEIGHT
  return polygons.some((polygon) => pointInPolygon(px, py, polygon))
}

function pointInPolygon(x, y, polygon) {
  let inside = false
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const a = polygon[current]
    const b = polygon[previous]
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function fact(factId, semanticType, bounds) { return { factId, semanticType, sourceType: "training_world_fact_blueprint", bounds } }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)) }

function seededRandom(seedText) {
  let state = Number.parseInt(crypto.createHash("sha256").update(seedText).digest("hex").slice(0, 8), 16) >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function standardVisualStyle() {
  return { camera: "top_down_slight_three_quarter_2d", palette: "mainland_southeast_asia_tropical_monsoon_natural_home", lighting: "single_soft_daylight_direction", materialDensity: "controlled_multi_scale_detail", grounding: "footprint_contact_shadow_and_transition_required" }
}

function standardArtDirection() {
  return { targetEntryId: "art-direction/professional-game-art-direction", playerFacingStandard: "formal_game_map_not_training_preview", forbiddenLooks: ["noise", "collage", "sticker", "wallpaper", "debug_preview"], styleUnityTargets: ["camera", "palette", "scale", "lighting", "material_language"] }
}

function standardRenderLayers() {
  return { orderedLayerRefs: ["base_terrain", "shoreline", "water", "path", "boundary", "footprints", "objects", "shadows", "detail", "polish"], preserveRules: ["route_readability", "center_readability", "object_contact", "terrain_transition"], forbiddenLayerOutputs: ["debug", "fallback", "placeholder", "program_only_final_art"] }
}

function standardMaterials(hasWater) {
  return [
    { materialId: "grass", roleInMap: "main_ground", professionalCue: "continuous readable game ground" },
    { materialId: "dirt_path", roleInMap: "route", professionalCue: "continuous embedded route" },
    { materialId: "stone", roleInMap: "object", professionalCue: "grounded obstacle" },
    { materialId: "vegetation_detail", roleInMap: "accent", professionalCue: "controlled detail rhythm" },
    ...(hasWater ? [
      { materialId: "water", roleInMap: "water", professionalCue: "coherent connected water" },
      { materialId: "shoreline", roleInMap: "transition", professionalCue: "continuous natural bank" },
    ] : []),
  ]
}

function buildEnvironmentContext({ record, snapshot, recipe }) {
  const environment = snapshot.environment
  assert(environment && typeof environment === "object", `snapshot environment missing: ${record.recordId}`)
  const recordSeason = record.classification?.monsoonSeason ?? null
  const snapshotSeason = environment.season ?? null
  assert(snapshotSeason, `snapshot season missing: ${record.recordId}`)
  if (recordSeason) assert(recordSeason === snapshotSeason, `record and snapshot season mismatch: ${record.recordId}`)

  const environmentState = record.classification?.environmentState
    ?? environment.monsoonPhase
    ?? environment.weather
  assert(environmentState, `environment state missing: ${record.recordId}`)
  assert(environment.weather, `snapshot weather missing: ${record.recordId}`)
  assert(environment.lighting, `snapshot lighting missing: ${record.recordId}`)
  assert(environment.groundMoisture, `snapshot ground moisture missing: ${record.recordId}`)

  return {
    contractVersion: "world-visual-environment-context-v1",
    season: snapshotSeason,
    monsoonPhase: environment.monsoonPhase ?? null,
    environmentState,
    weather: environment.weather,
    lighting: environment.lighting,
    groundMoisture: environment.groundMoisture,
    visibility: environment.visibility ?? null,
    wind: environment.wind ?? null,
    standingWaterOutsideDefinedWaterBodies: environment.standingWaterOutsideDefinedWaterBodies === true,
    habitatMoistureClass: recipe.moisture,
    sourceSnapshotId: snapshot.snapshotId,
    sourceRecordClassificationUsed: Boolean(recordSeason || record.classification?.environmentState),
  }
}

function snapshotPathForId(snapshotId) {
  const paths = {
    "mainland-southeast-asia-tropical-monsoon-provisional-wet-season-post-rain-v2": "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-v2.json",
    "mainland-southeast-asia-tropical-monsoon-provisional-wet-to-dry-transition-v1": "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-wet-to-dry-transition-v1.json",
    "mainland-southeast-asia-tropical-monsoon-provisional-late-dry-season-v1": "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-late-dry-season-v1.json",
    "mainland-southeast-asia-tropical-monsoon-provisional-dry-to-wet-transition-v1": "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-dry-to-wet-transition-v1.json",
  }
  assert(paths[snapshotId], `unknown environment snapshot: ${snapshotId}`)
  return paths[snapshotId]
}

async function buildV7CapacitySlot(slotId) {
  const v7OutputRoot = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-v7-data-tasks")
  const planPointerPath = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-v7-data-capacity-plans", "latest.json")
  const planPointer = readRequiredJson(planPointerPath)
  verifyHash(resolveProjectPath(planPointer.gapListPath), planPointer.gapListSha256, "V7 gap-list hash mismatch")
  const gapList = readRequiredJson(planPointer.gapListPath)
  const slot = gapList.plannedSlots?.find((entry) => entry.slotId === slotId)
  assert(slot, `V7 capacity slot missing: ${slotId}`)
  assert(slot.imageGenerationAuthorized === true, "V7 slot is outside the owner-authorized continuous generation batch")
  assert(slot.gpuTrainingAuthorized === false, "V7 slot unexpectedly authorizes GPU training")
  assert(slot.automaticBatchGenerationAllowed === true, "V7 slot does not authorize continuous batch generation")
  assert(slot.continuousBatchAuthorizationId === V7_CONTINUOUS_BATCH_AUTHORIZATION_ID, "V7 continuous batch authorization identity mismatch")
  assert(slot.mapScope === "complete-natural-home-map", "V7 slot is not a complete map")
  assert(slot.requiredConditionContract === GENERATION_CONTRACT_VERSION, "V7 condition contract mismatch")
  assert(slot.requiredNativeResolution?.width === WIDTH && slot.requiredNativeResolution?.height === HEIGHT, "V7 native resolution mismatch")
  const existingTask = findExistingV7CapacitySlotTask(v7OutputRoot, slotId)
  if (existingTask) {
    assert(
      SUPERSEDE_INCOMPATIBLE_PRE_GENERATION_TASK,
      `V7 capacity slot task already exists and cannot be repeated: ${slotId} (${existingTask})`,
    )
    assert(
      taskRequiresNoPresetSiteSupersession(existingTask),
      `V7 capacity slot task already satisfies the no-preset-site contract and cannot be superseded: ${slotId}`,
    )
    assert(
      !findExistingV7GenerationRequest(slotId),
      `V7 capacity slot already has a generation request and cannot supersede its task: ${slotId}`,
    )
  }
  const ownerAuthorizationRef = V7_CONTINUOUS_BATCH_AUTHORIZATION_ID

  const coveragePath = "data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json"
  const coverage = readRequiredJson(coveragePath)
  const landscapeProfile = coverage.regionalLandscapeTypes?.find((entry) => entry.typeId === slot.regionalLandscapeType)
  assert(landscapeProfile, `approved landscape profile missing: ${slot.regionalLandscapeType}`)
  const snapshotEntry = coverage.availableVisualSnapshots?.find((entry) => entry.season === slot.monsoonSeason)
  assert(snapshotEntry, `approved environment snapshot missing: ${slot.monsoonSeason}`)
  const snapshotPath = snapshotEntry.path
  const snapshot = readRequiredJson(snapshotPath)
  assert(snapshot.snapshotId === snapshotEntry.snapshotId, "V7 snapshot identity mismatch")

  const runId = `ai-assisted-v7-data-task-${slotId}-${timestamp.replace(/[:.]/g, "-")}`
  const runDir = path.join(v7OutputRoot, runId)
  const sampleDir = path.join(runDir, slotId)
  fs.mkdirSync(sampleDir, { recursive: true })

  try {
    const conditionLabel = `v7-complete-map-${slotId.replace("v7-capacity-slot-", "")}`
    const taskId = `training-world-visual-task-${conditionLabel}-${timestamp.replace(/[:.]/g, "-")}`
    const worldSeed = sha256(Buffer.from(`${planPointer.runId}:${slotId}:${slot.regionalLandscapeType}:${slot.monsoonSeason}`))
    const worldId = `training-world:${conditionLabel}:${worldSeed.slice(0, 12)}`
    const recipe = v7RecipeFor(slot, worldSeed)
    const syntheticRecord = {
      recordId: slotId,
      classification: {
        monsoonSeason: slot.monsoonSeason,
        environmentState: snapshot.environment.monsoonPhase,
      },
      aiAssistedColdStart: { promptEvidencePath: null },
    }
    const environmentContext = buildEnvironmentContext({ record: syntheticRecord, snapshot, recipe })
    const geometry = buildGeometry(conditionLabel, recipe)
    const blueprintPath = path.join(sampleDir, "world-fact-blueprint.json")
    const blueprint = {
      schemaVersion: "ai-assisted-training-world-fact-blueprint-v2",
      blueprintId: `training-world-facts-${conditionLabel}`,
      status: "v7_capacity_world_facts_ready_rgb_missing",
      createdAtUtc: timestamp,
      createdAtAsiaShanghai: formatShanghai(timestamp),
      ownerAuthorizationRef,
      generationContractVersion: GENERATION_CONTRACT_VERSION,
      conditionLabel,
      capacitySlotId: slotId,
      capacityPlanRunId: planPointer.runId,
      capacityGapListPath: planPointer.gapListPath,
      capacityGapListSha256: planPointer.gapListSha256,
      split: slot.split,
      coverageRole: slot.coverageRole,
      uniqueWorldSeed: worldSeed,
      uniqueLayoutVariant: recipe.layoutVariant,
      sourceBlueprintReuse: false,
      completeMapScopeRequired: true,
      sourceMode: "v7_capacity_slot_plus_locked_world_rules_before_rgb",
      sourceRecordId: null,
      sourceImagePathRead: false,
      sourceImageGeometryRead: false,
      existingRgbMayBeBoundAsTarget: false,
      taskId,
      worldId,
      tick: 0,
      worldProfileId: WORLD_PROFILE_ID,
      earthParameterSnapshotId: snapshot.snapshotId,
      earthParameterSnapshotPath: projectPath(snapshotPath),
      connectivityContractId: connectivityPointer.contractId,
      connectivityBlueprintId: connectivityPointer.blueprintId,
      connectivityBlueprintPath: connectivityPointer.blueprintPath,
      connectivityTrainingEligible: true,
      connectivityThresholdStatus: "owner_approved_27_positive_27_negative_nine_axes_3_plus_3",
      landscapeType: recipe.landscape,
      landscapeProfile: {
        requiredFeatures: landscapeProfile.requiredFeatures,
        optionalFeatures: landscapeProfile.optionalFeatures,
      },
      environmentContext,
      canvas: { width: WIDTH, height: HEIGHT, frameScope: "complete_runtime_frame" },
      geometry,
      semanticRules: {
        waterFlow: recipe.waterFlow,
        routeIntent: recipe.routeIntent,
        siteSelectionPolicy: "initial_natural_world_no_preset_home_site",
        camera: "top_down_slight_three_quarter_2d",
        style: "native_1024x768_high_resolution_pixel_game_map",
        forbidden: [
          "building",
          "character",
          "animal",
          "bridge",
          "text",
          "ui",
          "program_drawn_final_art",
          "preset_home_site",
          "construction_clearing",
          "route_convergence_platform",
        ],
      },
      outputContract: {
        generatesRgb: false,
        changesRuntimeWorldFacts: false,
        formalCandidate: false,
        needsNewRgbPairCreatedAfterThisBlueprint: true,
      },
      automaticStorage: true,
    }
    writeJson(blueprintPath, blueprint)

    const visualFacts = buildVisualFacts({ conditionLabel, recipe, geometry, environmentContext, taskId, worldId, blueprintPath })
    const visualFactPath = path.join(sampleDir, "visual-fact-manifest.json")
    writeJson(visualFactPath, visualFacts)
    const directorPlan = buildDirectorPlan({ conditionLabel, recipe, geometry, environmentContext, taskId, worldId, visualFacts, snapshot })
    directorPlan.capacitySlotId = slotId
    directorPlan.uniqueWorldSeed = worldSeed
    directorPlan.uniqueLayoutVariant = recipe.layoutVariant
    directorPlan.singleMapEcologyPlan.requiredFeatures = landscapeProfile.requiredFeatures
    directorPlan.singleMapEcologyPlan.optionalFeatures = landscapeProfile.optionalFeatures

    const taskPackage = buildTaskPackage({
      record: syntheticRecord,
      conditionLabel,
      recipe,
      geometry,
      environmentContext,
      taskId,
      worldId,
      visualFacts,
      visualFactPath,
      directorPlan,
      snapshot,
      snapshotPath,
      blueprintPath,
    })
    taskPackage.status = "v7_capacity_task_ready_rgb_missing"
    taskPackage.generationMode = "v7_capacity_slot_task_preparation"
    taskPackage.capacitySlot = slot
    taskPackage.uniqueWorldSeed = worldSeed
    taskPackage.uniqueLayoutVariant = recipe.layoutVariant
    taskPackage.sourceBindings.promptEvidencePath = null
    taskPackage.sourceBindings.capacityPlanPath = planPointer.capacityPlanPath
    taskPackage.sourceBindings.capacityGapListPath = planPointer.gapListPath
    taskPackage.sourceBindings.capacityGapListSha256 = planPointer.gapListSha256
    taskPackage.sourceBindings.capacitySlotId = slotId
    taskPackage.ecologyState.requiredFeatures = landscapeProfile.requiredFeatures
    taskPackage.ecologyState.optionalFeatures = landscapeProfile.optionalFeatures
    taskPackage.inferenceGate = {
      status: "continuous_batch_rgb_generation_authorized_rgb_missing",
      canRunCompleteVisualInference: false,
      reasons: ["rgb_missing"],
      authorizationId: V7_CONTINUOUS_BATCH_AUTHORIZATION_ID,
      ownerApprovalAutomatic: false,
      gpuTrainingAuthorized: false,
    }
    taskPackage.storageContract.mustStoreModelCheckpoint = false
    validateRequiredFields(directorPlan, REQUIRED_DIRECTOR_OUTPUT_FIELDS, `v7-director:${slotId}`)
    validateRequiredFields(taskPackage, REQUIRED_TASK_PACKAGE_FIELDS, `v7-task:${slotId}`)
    taskPackage.taskSha256 = sha256(Buffer.from(JSON.stringify(taskPackage)))

    const taskPath = path.join(sampleDir, "task-package.json")
    const directorPath = path.join(sampleDir, "director-output.json")
    const taskManifestPath = path.join(sampleDir, "manifest.json")
    writeJson(taskPath, taskPackage)
    writeJson(directorPath, directorPlan)
    const taskManifest = {
      schemaVersion: "world-visual-generation-task-manifest-v1",
      taskId,
      status: taskPackage.status,
      inferenceStatus: taskPackage.inferenceGate.status,
      createdAt: timestamp,
      createdAtAsiaShanghai: formatShanghai(timestamp),
      dictionaryVersionId: dictionary.dictionaryVersionId,
      worldId,
      ownerId: "project-owner",
      tick: 0,
      worldProfileId: WORLD_PROFILE_ID,
      generationContractVersion: GENERATION_CONTRACT_VERSION,
      conditionLabel,
      capacitySlotId: slotId,
      split: slot.split,
      earthParameterSnapshotId: snapshot.snapshotId,
      environmentContext,
      runtimeFrameId: null,
      sourceMode: "v7_capacity_slot_plus_locked_world_rules_before_rgb",
      taskSha256: taskPackage.taskSha256,
      taskPath: projectPath(taskPath),
      directorPath: projectPath(directorPath),
      blueprintPath: projectPath(blueprintPath),
      imageCount: 0,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
      automaticStorage: true,
    }
    writeJson(taskManifestPath, taskManifest)

    const compiler = spawnSync(process.execPath, [
      path.join(ROOT, "scripts", "compile-current-world-visual-conditions.mjs"),
      "--task", projectPath(taskPath),
      "--task-manifest", projectPath(taskManifestPath),
    ], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    assert(compiler.status === 0, `V7 condition compilation failed: ${compiler.stderr || compiler.stdout}`)
    const conditionManifestPath = path.join(sampleDir, "compiled-conditions", "manifest.json")
    const conditionManifest = readRequiredJson(conditionManifestPath)
    const conditionPack = readRequiredJson(conditionManifest.conditionPackPath)
    assert(conditionManifest.channelCount === 23, "V7 condition channel count mismatch")

    const scopeAudit = await auditCompleteMapScope({ blueprint, directorOutput: directorPlan, task: taskPackage, conditionPack, connectivityBlueprint })
    const scopeAuditPath = path.join(sampleDir, "complete-map-scope-audit.json")
    writeJson(scopeAuditPath, scopeAudit)
    assert(scopeAudit.passed === true, `V7 complete-map scope blocked: ${(scopeAudit.issues ?? []).join(",")}`)

    const row = {
      capacitySlotId: slotId,
      status: "task_ready_rgb_missing",
      split: slot.split,
      coverageRole: slot.coverageRole,
      regionalLandscapeType: slot.regionalLandscapeType,
      monsoonSeason: slot.monsoonSeason,
      conditionLabel,
      worldId,
      uniqueWorldSeed: worldSeed,
      uniqueLayoutVariant: recipe.layoutVariant,
      environmentSnapshotId: snapshot.snapshotId,
      blueprintPath: projectPath(blueprintPath),
      blueprintSha256: sha256(fs.readFileSync(blueprintPath)),
      directorOutputPath: projectPath(directorPath),
      directorOutputSha256: sha256(fs.readFileSync(directorPath)),
      taskPackagePath: projectPath(taskPath),
      taskPackageSha256: sha256(fs.readFileSync(taskPath)),
      conditionManifestPath: projectPath(conditionManifestPath),
      conditionPackPath: conditionManifest.conditionPackPath,
      conditionPackSha256: conditionManifest.conditionPackSha256,
      conditionPackCanonicalSha256: conditionManifest.conditionPackSha256,
      conditionPackFileSha256: sha256(fs.readFileSync(resolveProjectPath(conditionManifest.conditionPackPath))),
      completeMapScopeAuditPath: projectPath(scopeAuditPath),
      completeMapScopeAuditSha256: sha256(fs.readFileSync(scopeAuditPath)),
      channelCount: conditionManifest.channelCount,
      completeMapScopePassed: true,
      pairedRgbCount: 0,
      imageGenerationAuthorized: true,
      gpuTrainingAuthorized: false,
      continuousBatchAuthorizationId: V7_CONTINUOUS_BATCH_AUTHORIZATION_ID,
      supersedesTaskManifestPath: existingTask,
      supersessionReason: existingTask ? "preset_home_site_contract_removed_before_rgb_generation" : null,
    }
    const manifest = {
      schemaVersion: "ai-assisted-v7-data-task-run-v1",
      runId,
      status: "task_ready_rgb_generation_authorized_by_continuous_batch",
      createdAtUtc: timestamp,
      createdAtAsiaShanghai: formatShanghai(timestamp),
      ownerAuthorizationRef,
      supersedesTaskManifestPath: existingTask,
      supersessionReason: existingTask ? "preset_home_site_contract_removed_before_rgb_generation" : null,
      capacityPlanRunId: planPointer.runId,
      capacityGapListPath: planPointer.gapListPath,
      capacityGapListSha256: planPointer.gapListSha256,
      row,
      continuousBatchAuthorization: {
        authorizationId: V7_CONTINUOUS_BATCH_AUTHORIZATION_ID,
        executionMode: "sequential_one_active_generation_request",
        ownerApprovalAutomatic: false,
        gpuTrainingAutomatic: false,
      },
      blockers: ["rgb_missing", "machine_review_missing", "owner_review_missing"],
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
      automaticStorage: true,
    }
    const manifestPath = path.join(runDir, "manifest.json")
    writeJson(manifestPath, manifest)
    const latestPath = path.join(v7OutputRoot, "latest.json")
    writeJsonAtomic(latestPath, {
      schemaVersion: "ai-assisted-v7-data-task-latest-v1",
      runId,
      status: manifest.status,
      updatedAtUtc: timestamp,
      updatedAtAsiaShanghai: formatShanghai(timestamp),
      capacitySlotId: slotId,
      manifestPath: projectPath(manifestPath),
      manifestSha256: sha256(fs.readFileSync(manifestPath)),
      taskPackagePath: row.taskPackagePath,
      conditionPackPath: row.conditionPackPath,
      completeMapScopeAuditPath: row.completeMapScopeAuditPath,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    })
    indexV7RunArtifacts(runDir, runId)
    indexV7Artifact(latestPath, runId)
    appendAiPainterProgramEvent({
      runId,
      status: "success",
      stage: "ai_assisted_v7_capacity_slot_task_prepared",
      action: "prepare_v7_capacity_slot_task",
      kind: "v7_data_task",
      titleZh: `V7 容量槽位 ${slotId.replace("v7-capacity-slot-", "")} 的完整地图任务已由程序准备并自动保存`,
      titleEn: `The complete-map task for ${slotId} was prepared and saved by the program`,
      summaryZh: "程序已保存世界事实、世界导演、任务包、23 通道条件、完整地图范围审核和双哈希证据。未生成 RGB，未启动 GPU，当前等待项目所有者对单张 RGB 的单独授权。",
      summaryEn: "The program saved world facts, World Director output, the task package, 23-channel conditions, the complete-map scope audit, and dual-hash evidence. No RGB was generated and no GPU was started; explicit owner authorization for one RGB is still required.",
      evidence: [
        projectPath(manifestPath),
        row.blueprintPath,
        row.directorOutputPath,
        row.taskPackagePath,
        row.conditionPackPath,
        row.completeMapScopeAuditPath,
      ],
    })
    console.log(JSON.stringify(manifest, null, 2))
  } catch (error) {
    const failure = {
      schemaVersion: "ai-assisted-v7-data-task-build-failure-v1",
      runId,
      capacitySlotId: slotId,
      status: "failed_before_rgb_generation",
      createdAtUtc: timestamp,
      createdAtAsiaShanghai: formatShanghai(timestamp),
      error: error instanceof Error ? error.message : "unknown_v7_task_build_error",
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
      automaticStorage: true,
    }
    const failurePath = path.join(runDir, "failure.json")
    writeJsonAtomic(failurePath, failure)
    indexV7Artifact(failurePath, runId)
    appendAiPainterProgramEvent({
      runId,
      status: "failed",
      stage: "ai_assisted_v7_capacity_slot_task_preparation_failed",
      action: "prepare_v7_capacity_slot_task",
      kind: "v7_data_task",
      titleZh: "V7 容量槽位任务准备失败，程序已阻断并保存证据",
      titleEn: "V7 capacity slot task preparation failed; the program blocked and saved evidence",
      summaryZh: failure.error,
      summaryEn: failure.error,
      evidence: [projectPath(failurePath)],
      errorCode: "v7_capacity_slot_task_preparation_failed",
    })
    throw error
  }
}

async function buildAutonomyRebuild24() {
  const authorizationId = "owner-authorized-no-preset-home-site-engineering-rebuild-24-20260724"
  const outputRoot = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-v7-autonomy-rebuild-data-tasks")
  const coveragePath = "data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json"
  const factualReferencePath = "data/world-samples/original-image-library/natural-home-v1/sakaerat-wang-nam-khiao-mvp-reference-v1.json"
  const coverage = readRequiredJson(coveragePath)
  const factualReference = readRequiredJson(factualReferencePath)
  const landscapeProfiles = coverage.regionalLandscapeTypes ?? []
  const snapshotProfiles = coverage.availableVisualSnapshots ?? []

  assert(landscapeProfiles.length === 20, `expected 20 approved landscape profiles, received ${landscapeProfiles.length}`)
  assert(snapshotProfiles.length === 4, `expected 4 approved monsoon snapshots, received ${snapshotProfiles.length}`)
  assert(factualReference.referenceId === "sakaerat-wang-nam-khiao-mvp-reference-v1", "Sakaerat factual reference identity mismatch")

  const entries = [
    ...landscapeProfiles.map((landscape, index) => ({
      landscape,
      season: snapshotProfiles[index % snapshotProfiles.length],
      variant: 1,
    })),
    ...landscapeProfiles.slice(0, 4).map((landscape, index) => ({
      landscape,
      season: snapshotProfiles[(index + 2) % snapshotProfiles.length],
      variant: 2,
    })),
  ].map((entry, index) => ({
    ...entry,
    rebuildId: `autonomous-world-rebuild-${String(index + 1).padStart(3, "0")}`,
    split: index < 19 ? "train" : index < 21 ? "validation" : index === 21 ? "challenge" : "regression",
  }))
  assert(entries.length === 24, `autonomy rebuild expected 24 entries, received ${entries.length}`)

  const runId = `ai-assisted-v7-autonomy-rebuild-24-${timestamp.replace(/[:.]/g, "-")}`
  const runDir = path.join(outputRoot, runId)
  fs.mkdirSync(runDir, { recursive: true })
  const rows = []

  try {
    for (const [index, entry] of entries.entries()) {
      const sampleDir = path.join(runDir, entry.rebuildId)
      fs.mkdirSync(sampleDir, { recursive: true })
      const conditionLabel = `autonomous-complete-map-${String(index + 1).padStart(3, "0")}`
      const taskId = `training-world-visual-task-${conditionLabel}-${timestamp.replace(/[:.]/g, "-")}`
      const worldSeed = sha256(Buffer.from(`${authorizationId}:${entry.rebuildId}:${entry.landscape.typeId}:${entry.season.season}:${entry.variant}`))
      const worldId = `training-world:${conditionLabel}:${worldSeed.slice(0, 12)}`
      const snapshot = readRequiredJson(entry.season.path)
      assert(snapshot.snapshotId === entry.season.snapshotId, `snapshot identity mismatch: ${entry.rebuildId}`)
      const recipe = autonomyRebuildRecipe(entry, worldSeed)
      const syntheticRecord = {
        recordId: entry.rebuildId,
        classification: {
          monsoonSeason: entry.season.season,
          environmentState: entry.season.environmentState,
        },
        aiAssistedColdStart: { promptEvidencePath: null },
      }
      const environmentContext = buildEnvironmentContext({ record: syntheticRecord, snapshot, recipe })
      const geometry = buildGeometry(conditionLabel, recipe)
      const blueprintPath = path.join(sampleDir, "world-fact-blueprint.json")
      const blueprint = {
        schemaVersion: "ai-assisted-training-world-fact-blueprint-v2",
        blueprintId: `training-world-facts-${conditionLabel}`,
        status: "autonomous_world_facts_ready_rgb_missing",
        createdAtUtc: timestamp,
        createdAtAsiaShanghai: formatShanghai(timestamp),
        ownerAuthorizationRef: authorizationId,
        generationContractVersion: GENERATION_CONTRACT_VERSION,
        conditionLabel,
        rebuildId: entry.rebuildId,
        split: entry.split,
        uniqueWorldSeed: worldSeed,
        uniqueLayoutVariant: recipe.layoutVariant,
        sourceBlueprintReuse: false,
        sourceTransformReuse: false,
        sourceRgbRead: false,
        sourceImageGeometryRead: false,
        completeMapScopeRequired: true,
        sourceMode: "autonomous_world_facts_plus_locked_earth_reference_before_rgb",
        taskId,
        worldId,
        tick: 0,
        worldProfileId: WORLD_PROFILE_ID,
        earthParameterSnapshotId: snapshot.snapshotId,
        earthParameterSnapshotPath: projectPath(entry.season.path),
        factualReferenceId: factualReference.referenceId,
        factualReferencePath,
        connectivityContractId: connectivityPointer.contractId,
        connectivityBlueprintId: connectivityPointer.blueprintId,
        connectivityBlueprintPath: connectivityPointer.blueprintPath,
        landscapeType: recipe.landscape,
        landscapeProfile: {
          requiredFeatures: entry.landscape.requiredFeatures,
          optionalFeatures: entry.landscape.optionalFeatures,
        },
        environmentContext,
        canvas: { width: WIDTH, height: HEIGHT, frameScope: "complete_runtime_frame" },
        geometry,
        semanticRules: {
          waterFlow: recipe.waterFlow,
          routeIntent: recipe.routeIntent,
          siteSelectionPolicy: "initial_natural_world_no_preset_home_site",
          focalAreaPolicy: "inactive_all_zero_compatibility_channel",
          camera: "top_down_slight_three_quarter_2d",
          style: "native_1024x768_high_resolution_pixel_game_map",
          forbidden: [
            "building",
            "character",
            "animal",
            "bridge",
            "text",
            "ui",
            "program_drawn_final_art",
            "preset_home_site",
            "construction_clearing",
            "route_convergence_platform",
            "mirrored_historical_layout",
            "rotated_historical_layout",
          ],
        },
        outputContract: {
          generatesRgb: false,
          changesRuntimeWorldFacts: false,
          formalCandidate: false,
          needsNewRgbPairCreatedAfterThisBlueprint: true,
        },
        automaticStorage: true,
      }
      writeJson(blueprintPath, blueprint)

      const visualFacts = buildVisualFacts({
        conditionLabel,
        recipe,
        geometry,
        environmentContext,
        taskId,
        worldId,
        blueprintPath,
      })
      const visualFactPath = path.join(sampleDir, "visual-fact-manifest.json")
      writeJson(visualFactPath, visualFacts)

      const directorPlan = buildDirectorPlan({
        conditionLabel,
        recipe,
        geometry,
        environmentContext,
        taskId,
        worldId,
        visualFacts,
        snapshot,
      })
      directorPlan.autonomyContract = {
        siteSelectionPolicy: "runtime_butler_autonomy_only",
        presetHomeSite: false,
        constructionClearing: false,
        focalAreaActive: false,
      }
      directorPlan.factualReference = {
        referenceId: factualReference.referenceId,
        path: factualReferencePath,
        copiedRealMapGeometry: false,
        externalImageUsed: false,
      }
      directorPlan.singleMapEcologyPlan.requiredFeatures = entry.landscape.requiredFeatures
      directorPlan.singleMapEcologyPlan.optionalFeatures = entry.landscape.optionalFeatures

      const taskPackage = buildTaskPackage({
        record: syntheticRecord,
        conditionLabel,
        recipe,
        geometry,
        environmentContext,
        taskId,
        worldId,
        visualFacts,
        visualFactPath,
        directorPlan,
        snapshot,
        snapshotPath: entry.season.path,
        blueprintPath,
      })
      taskPackage.status = "autonomous_world_task_ready_rgb_missing"
      taskPackage.generationMode = "bounded_owner_authorized_autonomy_rebuild_24"
      taskPackage.rebuildIdentity = {
        rebuildId: entry.rebuildId,
        split: entry.split,
        authorizationId,
        uniqueWorldSeed: worldSeed,
        uniqueLayoutVariant: recipe.layoutVariant,
      }
      taskPackage.sourceBindings.promptEvidencePath = null
      taskPackage.sourceBindings.factualReferencePath = factualReferencePath
      taskPackage.ecologyState.requiredFeatures = entry.landscape.requiredFeatures
      taskPackage.ecologyState.optionalFeatures = entry.landscape.optionalFeatures
      taskPackage.inferenceGate = {
        status: "rgb_generation_not_started",
        canRunCompleteVisualInference: false,
        reasons: ["rgb_missing", "machine_review_missing", "owner_review_missing"],
        authorizationId,
        ownerApprovalAutomatic: false,
        gpuTrainingAuthorized: false,
      }
      taskPackage.storageContract.mustStoreModelCheckpoint = false
      validateRequiredFields(directorPlan, REQUIRED_DIRECTOR_OUTPUT_FIELDS, `autonomy-director:${entry.rebuildId}`)
      validateRequiredFields(taskPackage, REQUIRED_TASK_PACKAGE_FIELDS, `autonomy-task:${entry.rebuildId}`)
      taskPackage.taskSha256 = sha256(Buffer.from(JSON.stringify(taskPackage)))

      const taskPath = path.join(sampleDir, "task-package.json")
      const directorPath = path.join(sampleDir, "director-output.json")
      const taskManifestPath = path.join(sampleDir, "manifest.json")
      writeJson(taskPath, taskPackage)
      writeJson(directorPath, directorPlan)
      const taskManifest = {
        schemaVersion: "world-visual-generation-task-manifest-v1",
        taskId,
        status: taskPackage.status,
        inferenceStatus: taskPackage.inferenceGate.status,
        createdAt: timestamp,
        createdAtAsiaShanghai: formatShanghai(timestamp),
        dictionaryVersionId: dictionary.dictionaryVersionId,
        worldId,
        ownerId: "project-owner",
        tick: 0,
        worldProfileId: WORLD_PROFILE_ID,
        generationContractVersion: GENERATION_CONTRACT_VERSION,
        conditionLabel,
        rebuildId: entry.rebuildId,
        split: entry.split,
        earthParameterSnapshotId: snapshot.snapshotId,
        environmentContext,
        runtimeFrameId: null,
        sourceMode: "autonomous_world_facts_plus_locked_earth_reference_before_rgb",
        taskSha256: taskPackage.taskSha256,
        taskPath: projectPath(taskPath),
        directorPath: projectPath(directorPath),
        blueprintPath: projectPath(blueprintPath),
        imageCount: 0,
        imageGenerationStarted: false,
        gpuTrainingStarted: false,
        automaticStorage: true,
      }
      writeJson(taskManifestPath, taskManifest)

      const compiler = spawnSync(process.execPath, [
        path.join(ROOT, "scripts", "compile-current-world-visual-conditions.mjs"),
        "--task", projectPath(taskPath),
        "--task-manifest", projectPath(taskManifestPath),
      ], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      assert(compiler.status === 0, `condition compilation failed for ${entry.rebuildId}: ${compiler.stderr || compiler.stdout}`)
      const conditionManifestPath = path.join(sampleDir, "compiled-conditions", "manifest.json")
      const conditionManifest = readRequiredJson(conditionManifestPath)
      const conditionPack = readRequiredJson(conditionManifest.conditionPackPath)
      assert(conditionManifest.channelCount === 23, `condition channel count mismatch: ${entry.rebuildId}`)
      const focalArea = conditionPack.channels?.find((channel) => channel.id === "focal_area")
      assert(focalArea, `focal_area missing: ${entry.rebuildId}`)
      assert(Number(focalArea.statistics?.nonZeroCount ?? -1) === 0, `focal_area must be all-zero: ${entry.rebuildId}`)
      assert(!activePresetHomeSiteSemantics(taskPackage), `active preset home-site semantics detected: ${entry.rebuildId}`)

      const scopeAudit = await auditCompleteMapScope({
        blueprint,
        directorOutput: directorPlan,
        task: taskPackage,
        conditionPack,
        connectivityBlueprint,
      })
      const scopeAuditPath = path.join(sampleDir, "complete-map-scope-audit.json")
      writeJson(scopeAuditPath, scopeAudit)
      assert(scopeAudit.passed === true, `complete-map scope blocked for ${entry.rebuildId}: ${(scopeAudit.issues ?? []).join(",")}`)

      rows.push({
        rebuildId: entry.rebuildId,
        status: "task_ready_rgb_missing",
        split: entry.split,
        regionalLandscapeType: entry.landscape.typeId,
        monsoonSeason: entry.season.season,
        conditionLabel,
        worldId,
        uniqueWorldSeed: worldSeed,
        uniqueLayoutVariant: recipe.layoutVariant,
        blueprintPath: projectPath(blueprintPath),
        blueprintSha256: sha256(fs.readFileSync(blueprintPath)),
        directorOutputPath: projectPath(directorPath),
        directorOutputSha256: sha256(fs.readFileSync(directorPath)),
        taskPackagePath: projectPath(taskPath),
        taskPackageSha256: sha256(fs.readFileSync(taskPath)),
        conditionManifestPath: projectPath(conditionManifestPath),
        conditionPackPath: conditionManifest.conditionPackPath,
        conditionPackSha256: conditionManifest.conditionPackSha256,
        conditionPackFileSha256: sha256(fs.readFileSync(resolveProjectPath(conditionManifest.conditionPackPath))),
        completeMapScopeAuditPath: projectPath(scopeAuditPath),
        completeMapScopeAuditSha256: sha256(fs.readFileSync(scopeAuditPath)),
        channelCount: 23,
        focalAreaNonZeroCount: 0,
        completeMapScopePassed: true,
        presetHomeSiteSemanticsDetected: false,
        sourceTransformReuse: false,
        pairedRgbCount: 0,
      })
    }

    assert(new Set(rows.map((row) => row.worldId)).size === 24, "autonomy rebuild world identities must be unique")
    assert(new Set(rows.map((row) => row.uniqueLayoutVariant)).size === 24, "autonomy rebuild layout identities must be unique")
    const manifest = {
      schemaVersion: "ai-assisted-v7-autonomy-rebuild-24-run-v1",
      runId,
      status: "all_24_autonomous_world_condition_tasks_ready_rgb_missing",
      createdAtUtc: timestamp,
      createdAtAsiaShanghai: formatShanghai(timestamp),
      ownerAuthorizationRef: authorizationId,
      sourceReclassificationPointerPath: ".runtime/ai-painter/ai-assisted-v7-preset-home-site-reclassifications/latest.json",
      factualReferenceId: factualReference.referenceId,
      factualReferencePath,
      worldProfileId: WORLD_PROFILE_ID,
      generatedTaskCount: rows.length,
      generatedConditionPackCount: rows.length,
      channelCountPerTask: 23,
      focalAreaPolicy: "all_zero_inactive_compatibility_channel",
      sourceTransformReuse: false,
      historicalRgbRead: false,
      imageGenerationStarted: false,
      imagesGenerated: 0,
      gpuTrainingStarted: false,
      ownerApprovalAutomatic: false,
      blockers: ["rgb_missing", "machine_review_missing", "owner_review_missing"],
      splitCounts: countRowsBy(rows, "split"),
      rows,
      automaticStorage: true,
    }
    const manifestPath = path.join(runDir, "manifest.json")
    writeJsonAtomic(manifestPath, manifest)
    writeJsonAtomic(path.join(outputRoot, "latest.json"), {
      schemaVersion: "ai-assisted-v7-autonomy-rebuild-24-latest-v1",
      runId,
      status: manifest.status,
      updatedAtUtc: timestamp,
      updatedAtAsiaShanghai: formatShanghai(timestamp),
      manifestPath: projectPath(manifestPath),
      manifestSha256: sha256(fs.readFileSync(manifestPath)),
      generatedTaskCount: rows.length,
      imagesGenerated: 0,
      gpuTrainingStarted: false,
    })
    indexV7RunArtifacts(runDir, runId)
    indexV7Artifact(path.join(outputRoot, "latest.json"), runId)
    appendAiPainterProgramEvent({
      runId,
      status: "success",
      stage: "ai_assisted_v7_autonomy_rebuild_24_conditions",
      action: "build_24_autonomous_world_condition_tasks",
      kind: "v7_data_task",
      titleZh: "24条无固定家园中心的自主自然世界条件任务已由程序建立并保存",
      titleEn: "The program built and saved 24 autonomous natural-world condition tasks without preset home sites",
      summaryZh: "程序建立了24套全新世界事实、世界导演、完整地图任务包和23通道。所有focal_area均为全零；未读取历史RGB，未复用镜像或旋转骨架，未生成图片，未启动GPU训练。",
      summaryEn: "The program built 24 new world-fact, World Director, complete-map task, and 23-channel packages. Every focal_area is all-zero; no historical RGB or transformed skeleton was reused, no image was generated, and no GPU training started.",
      evidence: [projectPath(manifestPath), factualReferencePath, coveragePath],
      evidencePath: projectPath(manifestPath),
      evidenceSha256: sha256(fs.readFileSync(manifestPath)),
    })
    console.log(JSON.stringify({
      status: manifest.status,
      runId,
      manifestPath: projectPath(manifestPath),
      manifestSha256: sha256(fs.readFileSync(manifestPath)),
      generatedTaskCount: rows.length,
      splitCounts: manifest.splitCounts,
      imagesGenerated: 0,
      gpuTrainingStarted: false,
    }, null, 2))
  } catch (error) {
    const failure = {
      schemaVersion: "ai-assisted-v7-autonomy-rebuild-24-failure-v1",
      runId,
      status: "failed_before_rgb_generation",
      createdAtUtc: timestamp,
      createdAtAsiaShanghai: formatShanghai(timestamp),
      completedTaskCount: rows.length,
      error: error instanceof Error ? error.message : "unknown_autonomy_rebuild_error",
      imageGenerationStarted: false,
      imagesGenerated: 0,
      gpuTrainingStarted: false,
      automaticStorage: true,
    }
    const failurePath = path.join(runDir, "failure.json")
    writeJsonAtomic(failurePath, failure)
    indexV7RunArtifacts(runDir, runId)
    appendAiPainterProgramEvent({
      runId,
      status: "failed",
      stage: "ai_assisted_v7_autonomy_rebuild_24_conditions",
      action: "build_24_autonomous_world_condition_tasks",
      kind: "v7_data_task",
      titleZh: "24条自主自然世界条件重建被程序阻断并保存失败证据",
      titleEn: "The 24-record autonomous-world condition rebuild was blocked and the program saved failure evidence",
      summaryZh: failure.error,
      summaryEn: failure.error,
      evidence: [projectPath(failurePath)],
      evidencePath: projectPath(failurePath),
      evidenceSha256: sha256(fs.readFileSync(failurePath)),
      errorCode: "autonomy_rebuild_24_condition_task_failed",
    })
    throw error
  }
}

function autonomyRebuildRecipe(entry, worldSeed) {
  const random = seededRandom(`${entry.rebuildId}:${worldSeed}`)
  const waterRequired = entry.landscape.requiredFeatures.some((feature) => (
    /(river|water|stream|pond|creek|swamp|marsh|drainage|bank)/i.test(feature)
  ))
  const routeOnLeft = Number.parseInt(worldSeed.slice(0, 2), 16) % 2 === 0
  const routeBand = routeOnLeft ? [0.16, 0.42] : [0.58, 0.84]
  const waterBand = routeOnLeft ? [0.62, 0.86] : [0.14, 0.38]
  const routePoints = makeIndependentBoundaryRoute(random, routeBand, entry.variant)
  const water = waterRequired
    ? makeIndependentWaterGeometry(entry.landscape.typeId, random, waterBand, entry.variant)
    : { lines: [], ellipses: [], flow: "no_major_surface_water_in_current_world_facts" }
  const seasonalProfile = v7SeasonalProfile(entry.season.season)
  assert(seasonalProfile, `seasonal profile missing: ${entry.rebuildId}`)
  const vegetationDensity = /(grassland|glade|dry-dipterocarp|rocky)/.test(entry.landscape.typeId)
    ? "open"
    : /(swamp|marsh|riparian|evergreen|mountain)/.test(entry.landscape.typeId)
      ? "high"
      : "balanced"
  const primaryVegetation = entry.landscape.typeId.includes("bamboo")
    ? "bamboo"
    : entry.landscape.typeId.includes("marsh") || entry.landscape.typeId.includes("swamp")
      ? "reed"
      : "shrub"
  const baseCounts = vegetationDensity === "open"
    ? { tree: 7, rock: 6, vegetation: 9 }
    : vegetationDensity === "high"
      ? { tree: 14, rock: 5, vegetation: 13 }
      : { tree: 10, rock: 5, vegetation: 10 }
  const mudAreas = seasonalProfile.moisture === "very_high"
    ? [ellipse(routeOnLeft ? 0.7 : 0.3, 0.72 - random() * 0.25, 0.08, 0.045)]
    : []
  const tallGrassAreas = /grassland|marsh|swamp|floodplain|drainage/.test(entry.landscape.typeId)
    ? [ellipse(routeOnLeft ? 0.72 : 0.28, 0.26 + random() * 0.35, 0.11, 0.075)]
    : []

  return {
    landscape: entry.landscape.typeId,
    waterFlow: water.flow,
    routeIntent: `${entry.landscape.typeId}_${entry.season.season}_boundary_to_boundary_natural_passage_without_preset_home_site`,
    waterLines: water.lines,
    waterEllipses: water.ellipses,
    pathLines: [line(routePoints.map((point) => [point.x, point.y]), 0.027 + random() * 0.009)],
    moisture: seasonalProfile.moisture,
    vegetationDensity,
    primaryVegetation,
    boundaryDepth: vegetationDensity === "open" ? 0.035 : 0.055,
    objectCounts: adjustObjectCountsForSeason(baseCounts, seasonalProfile),
    mudAreas,
    tallGrassAreas,
    layoutVariant: `autonomous-world-fact-grammar-${entry.rebuildId}-${worldSeed.slice(0, 16)}`,
    siteSelectionPolicy: "initial_natural_world_no_preset_home_site",
  }
}

function makeIndependentBoundaryRoute(random, [minimumX, maximumX], variant) {
  const pointCount = 6 + variant
  const points = []
  for (let index = 0; index < pointCount; index += 1) {
    const progress = index / (pointCount - 1)
    const wave = Math.sin((progress * Math.PI * (1.2 + random() * 0.7)) + random() * 0.8) * 0.045
    const x = clamp(minimumX + (maximumX - minimumX) * (0.25 + random() * 0.5) + wave, minimumX, maximumX)
    points.push({ x: Number(x.toFixed(6)), y: Number((1.03 - progress * 1.06).toFixed(6)) })
  }
  return points
}

function makeIndependentWaterGeometry(landscapeType, random, [minimumX, maximumX], variant) {
  const centerX = minimumX + (maximumX - minimumX) * (0.3 + random() * 0.4)
  if (landscapeType === "pond-short-creek") {
    const pondY = 0.35 + random() * 0.25
    return {
      lines: [line([
        [centerX, pondY],
        [centerX + (random() - 0.5) * 0.06, pondY - 0.18],
        [centerX + (random() - 0.5) * 0.08, -0.03],
      ], 0.026)],
      ellipses: [ellipse(centerX, pondY, 0.11 + random() * 0.035, 0.08 + random() * 0.025)],
      flow: "single_connected_pond_to_short_creek_outlet",
    }
  }
  if (landscapeType === "freshwater-swamp") {
    return {
      lines: [],
      ellipses: [
        ellipse(centerX, 0.32 + random() * 0.12, 0.11, 0.16),
        ellipse(centerX + (random() - 0.5) * 0.08, 0.66 + random() * 0.1, 0.12, 0.14),
      ],
      flow: "two_connected_shallow_swamp_basins_with_continuous_edge",
    }
  }
  const pointCount = 6 + variant
  const points = []
  for (let index = 0; index < pointCount; index += 1) {
    const progress = index / (pointCount - 1)
    const x = clamp(centerX + Math.sin(progress * Math.PI * (1.4 + random())) * 0.055 + (random() - 0.5) * 0.025, minimumX, maximumX)
    points.push([Number(x.toFixed(6)), Number((-0.03 + progress * 1.06).toFixed(6))])
  }
  return {
    lines: [line(points, /river|floodplain|riverbank|riparian/.test(landscapeType) ? 0.06 : 0.035)],
    ellipses: [],
    flow: `${landscapeType}_continuous_north_to_south_natural_hydrology`,
  }
}

function activePresetHomeSiteSemantics(value, keyPath = "") {
  if (value === null || value === undefined) return false
  if (typeof value === "string") {
    if (/(^|\.)(mustNotShow|forbidden|forbiddenLayouts|forbiddenContent)(\.|$)/i.test(keyPath)) return false
    return /home[_ -]?center|activity[_ -]?center|construction[_ -]?clearing|building[_ -]?candidate|route[_ -]?convergence[_ -]?platform/i.test(value)
  }
  if (Array.isArray(value)) return value.some((entry, index) => activePresetHomeSiteSemantics(entry, `${keyPath}.${index}`))
  if (typeof value !== "object") return false
  return Object.entries(value).some(([key, entry]) => activePresetHomeSiteSemantics(entry, keyPath ? `${keyPath}.${key}` : key))
}

function countRowsBy(rows, field) {
  return rows.reduce((counts, row) => {
    counts[row[field]] = (counts[row[field]] ?? 0) + 1
    return counts
  }, {})
}

function indexV7RunArtifacts(runDir, runId) {
  for (const filePath of listFilesRecursive(runDir)) indexV7Artifact(filePath, runId)
}

function indexV7Artifact(filePath, runId) {
  const stat = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha256(fs.readFileSync(filePath)),
  })
}

function listFilesRecursive(root) {
  const files = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...listFilesRecursive(resolved))
    else if (entry.isFile()) files.push(resolved)
  }
  return files
}

function v7RecipeFor(slot, worldSeed) {
  if (slot.slotId === "v7-capacity-slot-001") {
    assert(slot.regionalLandscapeType === "lowland-evergreen-tropical-forest", `V7 ${slot.slotId} landscape recipe is not defined`)
    assert(slot.monsoonSeason === "wet_to_dry_transition", `V7 ${slot.slotId} season recipe is not defined`)
    const recipe = spec(
      slot.regionalLandscapeType,
      "no_major_surface_water_in_current_world_facts",
      "south_boundary_entry_curves_through_irregular_home_center_and_continues_to_northeast_world_connection",
      [],
      [],
      [line([[0.2, 1.03], [0.26, 0.82], [0.4, 0.64], [0.46, 0.53], [0.58, 0.38], [0.76, -0.03]], 0.032)],
      [0.46, 0.53],
      "high_to_moderate",
      "high",
    )
    recipe.layoutVariant = `v7-complete-map-grammar-south-to-northeast-${worldSeed.slice(0, 12)}`
    recipe.centerIntent = "irregular_playable_natural_home_center_without_rectangular_ground_patch"
    recipe.focalSize = { width: 0.14, height: 0.11 }
    recipe.objectCounts = { tree: 12, rock: 5, vegetation: 10 }
    return recipe
  }

  if (slot.slotId === "v7-capacity-slot-002") {
    assert(slot.regionalLandscapeType === "lowland-evergreen-tropical-forest", `V7 ${slot.slotId} landscape recipe is not defined`)
    assert(slot.monsoonSeason === "wet_to_dry_transition", `V7 ${slot.slotId} season recipe is not defined`)
    const recipe = spec(
      slot.regionalLandscapeType,
      "no_major_surface_water_in_current_world_facts",
      "southeast_boundary_entry_bends_around_an_offset_irregular_home_center_and_continues_to_northwest_world_connection",
      [],
      [],
      [line([[0.82, 1.03], [0.74, 0.84], [0.64, 0.69], [0.58, 0.57], [0.49, 0.47], [0.37, 0.31], [0.27, -0.03]], 0.034)],
      [0.58, 0.57],
      "high_to_moderate",
      "high",
    )
    recipe.layoutVariant = `v7-complete-map-grammar-southeast-to-northwest-offset-center-${worldSeed.slice(0, 12)}`
    recipe.centerIntent = "offset_irregular_playable_natural_home_center_with_distinct_open_and_forest_edge_zones"
    recipe.focalSize = { width: 0.16, height: 0.1 }
    recipe.objectCounts = { tree: 14, rock: 4, vegetation: 12 }
    return recipe
  }

  if (slot.slotId === "v7-capacity-slot-003") {
    assert(slot.regionalLandscapeType === "lowland-evergreen-tropical-forest", `V7 ${slot.slotId} landscape recipe is not defined`)
    assert(slot.monsoonSeason === "dry_season", `V7 ${slot.slotId} season recipe is not defined`)
    const recipe = spec(
      slot.regionalLandscapeType,
      "no_major_surface_water_in_current_world_facts",
      "southwest_boundary_entry_curves_through_an_east_offset_irregular_home_center_and_continues_to_the_north_world_connection",
      [],
      [],
      [line([[0.18, 1.03], [0.28, 0.84], [0.46, 0.7], [0.64, 0.58], [0.71, 0.45], [0.62, 0.26], [0.54, -0.03]], 0.033)],
      [0.64, 0.58],
      "medium",
      "high",
    )
    recipe.layoutVariant = `v7-complete-map-grammar-southwest-to-north-dry-season-east-offset-center-${worldSeed.slice(0, 12)}`
    recipe.centerIntent = "east_offset_irregular_playable_natural_home_center_with_dry_season_open_floor_and_layered_evergreen_boundary_zones"
    recipe.focalSize = { width: 0.15, height: 0.12 }
    recipe.objectCounts = { tree: 13, rock: 6, vegetation: 9 }
    return recipe
  }

  const slotNumber = Number(slot.slotId.match(/v7-capacity-slot-(\d{3})/)?.[1])
  assert(Number.isInteger(slotNumber) && slotNumber >= 4 && slotNumber <= 107, `V7 slot recipe is outside the authorized range: ${slot.slotId}`)
  const sourceRecipeId = v7LandscapeRecipeId(slot.regionalLandscapeType)
  assert(sourceRecipeId, `V7 landscape recipe is not defined: ${slot.regionalLandscapeType}`)
  const source = recipeFor(`ai-cold-start-map-${sourceRecipeId}`, slot.regionalLandscapeType)
  const transformIndex = (slotNumber - 4) % 8
  const scaleX = 0.9 + (Number.parseInt(worldSeed.slice(0, 2), 16) / 255) * 0.08
  const scaleY = 1 + (Number.parseInt(worldSeed.slice(2, 4), 16) / 255) * 0.06
  const recipe = transformCompleteMapRecipe(source, transformIndex, scaleX, scaleY)
  const seasonalProfile = v7SeasonalProfile(slot.monsoonSeason)
  assert(seasonalProfile, `V7 season recipe is not defined: ${slot.monsoonSeason}`)
  recipe.moisture = seasonalProfile.moisture
  recipe.layoutVariant = `v7-complete-map-${slot.regionalLandscapeType}-${slot.monsoonSeason}-transform-${transformIndex}-${worldSeed.slice(0, 12)}`
  recipe.routeIntent = `${slot.regionalLandscapeType}_${slot.monsoonSeason}_continuous_boundary_to_boundary_natural_passage_without_preset_home_site`
  recipe.siteSelectionPolicy = "initial_natural_world_no_preset_home_site"
  recipe.objectCounts = adjustObjectCountsForSeason(source.objectCounts, seasonalProfile)
  return recipe
}

function v7LandscapeRecipeId(landscapeType) {
  return {
    "lowland-evergreen-tropical-forest": "001",
    "seasonal-evergreen-semi-evergreen-forest": "005",
    "moist-deciduous-teak-forest": "004",
    "dry-dipterocarp-woodland": "006",
    "bamboo-grove": "007",
    "riparian-tropical-forest": "008",
    "monsoon-grassland": "009",
    "tropical-forest-glade": "010",
    "river-floodplain": "011",
    "freshwater-swamp": "012",
    "reed-marsh": "013",
    "pond-short-creek": "014",
    "tropical-mountain-stream": "015",
    "limestone-foothill": "016",
    "rocky-low-hill": "017",
    "forested-low-mountain": "018",
    "tropical-valley-floor": "019",
    "wet-season-drainage-hollow": "020",
    "dry-season-exposed-riverbank": "021",
    "grassland-forest-transition": "022",
  }[landscapeType]
}

function v7SeasonalProfile(season) {
  return {
    wet_season: { moisture: "very_high", treeDelta: 1, vegetationDelta: 3 },
    wet_to_dry_transition: { moisture: "high", treeDelta: 0, vegetationDelta: 1 },
    dry_season: { moisture: "low", treeDelta: -1, vegetationDelta: -2 },
    dry_to_wet_transition: { moisture: "medium", treeDelta: 0, vegetationDelta: 2 },
  }[season]
}

function transformCompleteMapRecipe(source, transformIndex, scaleX, scaleY) {
  const transformPoint = ({ x, y }) => {
    const mirrored = transformIndex % 2 === 1
    const warpAmplitude = [0, 0, 0.035, 0.035, -0.045, -0.045, 0.025, 0.025][transformIndex]
    const warpFrequency = transformIndex >= 6 ? 2 : 1
    const tx = mirrored ? 1 - x : x
    const ty = y
    const boundedY = Math.max(0, Math.min(1, ty))
    const warpedX = tx + Math.sin(boundedY * Math.PI * warpFrequency) * warpAmplitude
    return {
      x: roundCoordinate(0.5 + (warpedX - 0.5) * scaleX),
      y: roundCoordinate(0.5 + (ty - 0.5) * scaleY),
    }
  }
  const transformLine = (entry) => ({
    points: entry.points.map(transformPoint),
    width: Number((entry.width * Math.min(scaleX, scaleY)).toFixed(6)),
  })
  const transformRouteLine = (entry) => {
    const transformed = transformLine(entry)
    const sideClearance = Math.max(0.095, transformed.width + 0.06)
    const hasTopConnector = entry.points.some((point) => point.y <= 0)
    const topClearance = Math.max(0.105, transformed.width + 0.065)
    return {
      ...transformed,
      points: transformed.points.map((point) => ({
        x: Number(Math.max(sideClearance, Math.min(1 - sideClearance, point.x)).toFixed(6)),
        y: hasTopConnector ? point.y : Number(Math.max(topClearance, point.y).toFixed(6)),
      })),
    }
  }
  const transformEllipse = (entry) => {
    const center = transformPoint({ x: entry.cx, y: entry.cy })
    return {
      cx: center.x,
      cy: center.y,
      rx: Number((entry.rx * scaleX).toFixed(6)),
      ry: Number((entry.ry * scaleY).toFixed(6)),
    }
  }
  const center = transformPoint(source.center)
  return {
    ...structuredClone(source),
    waterFlow: `${source.waterFlow}_complete_map_transform_${transformIndex}`,
    routeIntent: `${source.routeIntent}_complete_map_transform_${transformIndex}`,
    waterLines: source.waterLines.map(transformLine),
    waterEllipses: source.waterEllipses.map(transformEllipse),
    pathLines: source.pathLines.map(transformRouteLine),
    center,
    mudAreas: source.mudAreas.map(transformEllipse),
    tallGrassAreas: source.tallGrassAreas.map(transformEllipse),
  }
}

function adjustObjectCountsForSeason(sourceCounts, seasonalProfile) {
  return {
    tree: Math.max(4, sourceCounts.tree + seasonalProfile.treeDelta),
    rock: sourceCounts.rock,
    vegetation: Math.max(5, sourceCounts.vegetation + seasonalProfile.vegetationDelta),
  }
}

function roundCoordinate(value) {
  return Number(Math.max(-0.08, Math.min(1.08, value)).toFixed(6))
}

function findExistingV7CapacitySlotTask(outputRoot, slotId) {
  if (!fs.existsSync(outputRoot)) return null
  for (const entry of fs.readdirSync(outputRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifestPath = path.join(outputRoot, entry.name, "manifest.json")
    if (!fs.existsSync(manifestPath)) continue
    const manifest = readRequiredJson(manifestPath)
    if (manifest.row?.capacitySlotId === slotId && manifest.status !== "failed_before_rgb_generation") {
      return projectPath(manifestPath)
    }
  }
  return null
}

function taskRequiresNoPresetSiteSupersession(manifestPath) {
  const manifest = readRequiredJson(manifestPath)
  const task = readRequiredJson(manifest.row?.taskPackagePath)
  const conditionPack = readRequiredJson(manifest.row?.conditionPackPath)
  const focalChannel = conditionPack.channels?.find((entry) => entry.id === "focal_area")
  return task.singleMapCompositionFields?.siteSelectionPolicy !== "runtime_butler_autonomy_only"
    || Number(focalChannel?.statistics?.nonZeroCount ?? 0) > 0
}

function findExistingV7GenerationRequest(slotId) {
  const requestRoot = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-cold-start", "conditional-rgb-generation-requests")
  if (!fs.existsSync(requestRoot)) return null
  for (const entry of fs.readdirSync(requestRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const requestPath = path.join(requestRoot, entry.name, "request.json")
    if (!fs.existsSync(requestPath)) continue
    const request = readRequiredJson(requestPath)
    if (request.sourceRecordId === slotId) return projectPath(requestPath)
  }
  return null
}

function validateRequiredFields(value, fields, label) {
  for (const field of fields) assert(value[field] !== undefined && value[field] !== null, `${label} missing required field: ${field}`)
}

function verifyHash(filePath, expected, message) {
  assert(fs.existsSync(filePath), `file missing: ${projectPath(filePath)}`)
  assert(sha256(fs.readFileSync(filePath)) === expected, message)
}

function readRequiredJson(value) {
  try { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
  catch (error) { throw new Error(`required JSON unreadable: ${value} (${error instanceof Error ? error.message : "unknown"})`) }
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

function projectPath(filePath) { return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, "/") }
function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
