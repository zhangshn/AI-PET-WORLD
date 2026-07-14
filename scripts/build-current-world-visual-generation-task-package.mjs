import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  REQUIRED_DIRECTOR_OUTPUT_FIELDS,
  REQUIRED_TASK_PACKAGE_FIELDS,
  assertWorldVisualDictionaryContract,
  loadWorldVisualDictionaryContract,
} from "./lib/world-visual-dictionary-contract.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "world-visual-generation-task-packages")
const timestamp = new Date().toISOString()
const timestampLocal = formatShanghai(timestamp)

const dictionary = loadWorldVisualDictionaryContract()
assertWorldVisualDictionaryContract(dictionary)

const worldPointer = readRequiredJson("data/world-runtime/latest-world.json")
const worldState = readRequiredJson(worldPointer.path)
const runtimeRecord = readRequiredJson(".runtime/game-map-runtime-frame/latest-runtime-frame.json")
const runtimeFrame = runtimeRecord.runtimeFrame
const EXPECTED_WORLD_PROFILE = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"
assert(runtimeFrame && typeof runtimeFrame === "object", "latest RuntimeFrame is missing")
assert(worldState.worldId === runtimeFrame.worldId, "world state and RuntimeFrame worldId mismatch")
assert(worldState.ownerId === runtimeFrame.ownerId, "world state and RuntimeFrame ownerId mismatch")
assert(worldState.tick === runtimeFrame.tick, "world state and RuntimeFrame tick mismatch")
assert(worldState.worldProfileId === EXPECTED_WORLD_PROFILE, "current world profile is not the authorized tropical monsoon MVP profile")

const taskId = `world-visual-task-${runtimeFrame.worldId}-${runtimeFrame.tick}-${timestamp.replace(/[:.]/g, "-")}`
const directorRunId = `world-visual-director-${runtimeFrame.worldId}-${runtimeFrame.tick}-${timestamp.replace(/[:.]/g, "-")}`
const latestAuditPointer = readOptionalJson(
  "data/world-samples/dataset-blueprints/latest-natural-home-complete-map-audit.json",
)
const latestAudit = latestAuditPointer?.auditPath ? readOptionalJson(latestAuditPointer.auditPath) : null
const datasetPackagePointer = readOptionalJson(
  "data/world-samples/dataset-packages/latest.json",
)
const projectOwnedCheckpointPointer = readOptionalJson(
  ".runtime/ai-painter/project-owned-complete-world-model/latest.json",
)
const learningConsumptionPointer = readOptionalJson(
  ".runtime/ai-painter/visual-learning-feedback-consumption/latest.json",
)
const learningConsumption = learningConsumptionPointer?.recordPath
  ? readOptionalJson(learningConsumptionPointer.recordPath)
  : null
const visualFactPointer = readRequiredJson(
  ".runtime/ai-painter/world-visual-fact-manifests/latest.json",
)
const visualFactManifest = readRequiredJson(visualFactPointer.manifestPath)
assert(visualFactManifest.passed === true, "current VisualFactManifest did not pass")
assert(visualFactManifest.worldProfileId === EXPECTED_WORLD_PROFILE, "VisualFactManifest world profile mismatch")
assert(visualFactManifest.worldId === runtimeFrame.worldId, "VisualFactManifest worldId mismatch")
assert(visualFactManifest.tick === runtimeFrame.tick, "VisualFactManifest tick mismatch")
const latestOwnerDecision = readLatestOwnerDecision(
  runtimeFrame.runtimeFrameId,
  runtimeFrame.composition?.compositeOutput?.imageSha256,
)
const previousFailures = buildPreviousFailures(latestOwnerDecision, latestAudit, learningConsumption)
const scene = deriveSceneContext(runtimeFrame, visualFactManifest)

const directorPlan = buildDirectorPlan({
  directorRunId,
  taskId,
  timestamp,
  dictionary,
  runtimeFrame,
  visualFactManifest,
  scene,
  previousFailures,
})

const materialRecipes = [
  material("grass", "main_ground", "natural greens", "mid value", "player-scale fine detail", "soft grass-to-neighbor blend", "balanced", "continuous readable game ground"),
  material("dirt_path", "route", "earth ochre", "mid-light route band", "broad readable marks", "embedded soft grass edge", "sparse", "continuous route, never overlay tape"),
  material("water", "water", "blue-green depth range", "dark-to-mid depth", "broad flow shapes", "shoreline-mediated edge", "balanced", "coherent water body"),
  material("shoreline", "transition", "wet earth and cool green", "mid transition band", "irregular medium marks", "soft grass-water bridge", "sparse", "natural readable bank"),
  material("mud_patch", "accent", "muted wet earth", "mid-dark", "small controlled patch", "feathered into grass/path", "sparse", "wear cue without gray camouflage"),
  material("forest_edge", "boundary", "deep natural green", "dark frame", "large grouped mass", "irregular vegetation edge", "balanced", "natural boundary, not a wall"),
  material("stone", "object", "neutral stone", "clear object value", "object-scale planes", "ground pocket and contact shadow", "sparse", "grounded obstacle"),
  material("vegetation_detail", "accent", "controlled green and flower accents", "local contrast", "small clustered marks", "dissolved into base terrain", "sparse", "detail rhythm without random scatter"),
]

const taskPackage = {
  schemaVersion: "runtime-frame-generation-task-v1",
  taskId,
  createdAt: timestamp,
  createdAtAsiaShanghai: timestampLocal,
  status: latestAudit?.status === "training_data_sufficient" ? "ready_for_inference_contract_only" : "blocked_data_gap_insufficient",
  generationMode: previousFailures.length > 0 ? "repair_generation" : "first_generation",
  dictionaryVersionId: dictionary.dictionaryVersionId,
  worldId: runtimeFrame.worldId,
  ownerId: runtimeFrame.ownerId,
  tick: runtimeFrame.tick,
  worldProfileId: worldState.worldProfileId,
  earthParameterSnapshotId: worldState.earthParameterSnapshotId,
  outputSize: { width: 1024, height: 768, aspect: "4:3", frameScope: "complete_runtime_frame" },
  singleMapScope: {
    activeScopeId: "versions/current-single-map-visual-scope",
    activeGoal: "single_complete_map_visual",
    reservedFeatures: ["player_character", "player_movement", "click_collect_build_inspect", "multi_tick_variation"],
    forbiddenCurrentRequirements: ["player_character", "building", "animal", "interaction_mechanics", "multi_tick_animation"],
    allowedCurrentRequirements: ["map_structure", "terrain", "material", "ecology", "composition", "art_direction", "storage"],
  },
  sourceFactIds: visualFactManifest.visualFactIds,
  sourceBindings: {
    worldStatePath: projectPath(worldPointer.path),
    runtimeFramePath: ".runtime/game-map-runtime-frame/latest-runtime-frame.json",
    runtimeFrameId: runtimeFrame.runtimeFrameId,
    structureId: runtimeFrame.structureId,
    dictionaryPath: dictionary.dictionaryPath,
    dataAuditPath: latestAuditPointer?.auditPath ?? null,
    datasetPackageId: datasetPackagePointer?.packageId ?? null,
    datasetPackagePath: datasetPackagePointer?.manifestPath ?? null,
    datasetPackageStatus: datasetPackagePointer?.status ?? "missing",
    learningFeedbackPath: learningConsumptionPointer?.recordPath ?? null,
    visualFactManifestId: visualFactManifest.manifestId,
    visualFactManifestPath: visualFactPointer.manifestPath,
    visualFactManifestSha256: visualFactPointer.manifestSha256,
  },
  directorPlan,
  mapGrammar: {
    requiredParts: scene.requiredParts,
    optionalParts: ["branch_path", "resource_pocket", "decorative_cluster"],
    routeGraph: scene.routeGraph,
    adjacencyRules: scene.adjacencyRules,
    forbiddenLayouts: ["isolated_path", "fragmented_water", "unreadable_center", "uniform_noise_field", "material_test_board"],
  },
  spatialLayers: {
    terrainRegions: runtimeFrame.layers.terrain,
    walkableRegions: runtimeFrame.layers.walkable,
    collisionRegions: runtimeFrame.layers.collision,
    interactionRegions: [],
    objectFootprints: runtimeFrame.layers.objects.map((object) => ({
      objectId: object.sourceObjectId,
      kind: object.kind,
      footprint: object.footprint,
      blocksMovement: object.blocksMovement,
    })),
    stateRegions: runtimeFrame.runtimeState?.stateRefs ?? [],
  },
  ecologyState: {
    biomeType: scene.ecology.biomeType,
    moistureLevel: scene.ecology.moistureLevel,
    growthStage: scene.ecology.growthStage,
    vegetationDensity: scene.ecology.vegetationDensity,
    waterInfluence: scene.ecology.waterInfluence,
    pathWear: scene.ecology.pathWear,
    source: "visual_fact_manifest_world_signals_and_runtime_structure",
    missingWorldSignals: visualFactManifest.worldSignals.missingSignals,
  },
  singleMapEcologyFields: {
    sourceEntryId: "ecology/single-map-ecology-fields",
    moistureMap: { zones: ["balanced_grass", "shoreline_wet", "path_wear"] },
    grassGrowthPattern: { pathEdge: "thinned", center: "controlled", boundary: "denser", waterEdge: "wet_variant" },
    shorelineEcology: { cues: ["wet_grass", "reeds", "cooler_tone", "irregular_bank"] },
    pathWearEcology: { cues: ["soft_edge", "sparse_mud", "grass_thinning"] },
    boundaryVegetation: { role: "natural_frame", forbidden: "flat_wall" },
    objectGroundPockets: runtimeFrame.layers.objects.map((object) => ({ objectId: object.sourceObjectId, footprint: object.footprint })),
    noiseControl: { microDetail: "balanced", randomScatter: "forbidden", quietAreasRequired: true },
  },
  gameplayContract: {
    playerScaleReference: "implied_only_no_player_render",
    movementReadability: "route_and_open_ground_visual_read",
    collisionReadability: "blocked_regions_have_natural_visual_causes",
    interactionCueBudget: "reserved_no_current_interaction_cues",
    cameraGameplayFit: "top_down_complete_map_read",
  },
  visualStyle: {
    camera: "top_down_slight_three_quarter_2d",
    palette: "mainland_southeast_asia_tropical_monsoon_natural_home",
    lighting: "single_soft_daylight_direction",
    materialDensity: "controlled_multi_scale_detail",
    grounding: "footprint_contact_shadow_and_transition_required",
  },
  drawingProcess: {
    intentLock: { framePurpose: "complete_player_facing_game_map_candidate", dictionaryVersionId: dictionary.dictionaryVersionId },
    semanticInventory: { required: scene.requiredParts.map((entry) => entry.partId), allowed: scene.allowedObjectTypes },
    spatialBlockout: { source: "runtime_frame_structured_layers", textureBeforeBlockoutForbidden: true },
    cameraScale: { output: "1024x768", objectScale: "bound_to_runtime_footprints", pathWidth: "bound_to_walkable_regions" },
    valuePlan: { order: scene.readOrder },
    colorPlan: { unity: "single natural-home palette", grayGreenCamouflageForbidden: true },
    materialPass: { recipeIds: materialRecipes.map((entry) => entry.materialId) },
    groundingPass: { footprintRequired: true, contactShadowRequired: true, stickerEdgesForbidden: true },
    polishPass: { quietAreasRequired: true, randomNoiseForbidden: true },
    reviewPass: { machineReview: true, ownerReview: true, ownerRejectOverridesMachinePass: true },
  },
  artDirection: {
    genreRead: "high-resolution pixel-art playable natural home world map",
    cameraLanguage: "top-down or slight three-quarter 2D game camera",
    styleFamily: "professional high-resolution 2d pixel game map",
    mood: "alive natural gentle exploratory and gameplay-readable",
    forbiddenLooks: ["noise_map", "asset_collage", "sticker_objects", "debug_preview", "wallpaper", "program_drawn_final_art"],
    professionalStandards: ["first_glance_game_read", "style_unity", "spatial_clarity", "material_clarity", "object_grounding", "controlled_polish"],
  },
  materialRecipes,
  singleMapMaterialFields: materialRecipes.map((entry) => ({
    sourceEntryId: "material-recipe/single-map-material-field-schema",
    materialId: entry.materialId,
    roleInMap: entry.gameplayMeaning,
    colorFamily: entry.baseColorRange,
    valueBand: entry.valueRange,
    markScale: entry.textureScale,
    edgeTransition: entry.edgeBehavior,
    detailBudget: entry.detailBehavior,
    professionalCue: entry.professionalCue,
  })),
  compositionRecipe: {
    focalPoint: scene.primaryFocus,
    readOrder: scene.readOrder,
    routeShape: { graph: scene.routeGraph, continuity: "unbroken", edge: "soft_embedded" },
    massBalance: { terrainKinds: scene.terrainKinds, waterRegion: scene.waterPlacement, boundary: "framing_not_wall" },
    negativeSpacePlan: { preserve: ["home_center", "path_sides", "main_grass_read"] },
    detailClusterPlan: { cluster: ["boundary", "shoreline", "selected_meadow_pockets"], quiet: ["route", "center", "main_grass"] },
    edgeFramePlan: { type: "irregular_natural_vegetation", hardCropForbidden: true },
  },
  singleMapCompositionFields: {
    sourceEntryId: "composition-recipe/single-map-composition-fields",
    mapReadGoal: "first_glance_complete_natural_home_map",
    primaryFocalArea: scene.primaryFocus,
    entrancePlacement: scene.entranceFact ? { sourceFactId: scene.entranceFact.factId, bounds: scene.entranceFact.bounds } : null,
    mainRoutePlan: { sources: scene.pathRecords.map((entry) => entry.structureRecordId) },
    waterPlacement: scene.waterPlacement,
    boundaryFrame: scene.boundaryFact ? { sourceFactId: scene.boundaryFact.factId, bounds: scene.boundaryFact.bounds, type: "natural_irregular_frame" } : null,
    openSpacePlan: { preserve: ["home_center", "main_route", "grass_read"] },
    detailRhythmPlan: { rule: "cluster_and_quiet_area_alternation" },
    visualBalance: { priority: ["route", "center", "land_water", "boundary", "details"] },
  },
  renderLayerRecipe: {
    orderedLayers: ["base_terrain", "water", "path", "shoreline", "boundary", "object_footprints", "objects", "contact_shadows", "vegetation_detail", "polish"],
    occlusionRules: ["objects_may_not_hide_route", "details_may_not_hide_shoreline", "boundary_may_not_close_entrance"],
    spatialBindings: ["terrain_to_terrain_regions", "objects_to_object_footprints", "path_to_walkable_regions"],
    contactRequirements: ["all_objects_bind_to_footprint", "trees_and_rocks_require_contact_shadow"],
    forbiddenFinalLayers: ["debug", "fallback", "placeholder", "program_drawn_final_art"],
  },
  qualityRubric: {
    categories: ["game_read", "map_grammar", "material_quality", "style_unity", "grounding", "gameplay_readability", "polish"],
    gradeBands: ["professional", "near_pass", "useful_training", "failed", "blocked"],
    minimumDisplayGate: 85,
    ownerReviewOverride: true,
    requiredReviewOutput: ["reviewId", "scores", "status", "failureCodes", "nextFixTargets"],
  },
  singleMapAcceptance: {
    sourceEntryId: "review/single-map-visual-acceptance",
    activeGates: ["single_map_scope", "map_structure", "material_quality", "composition_quality", "art_direction", "object_grounding", "storage_trace", "owner_review"],
    reservedNonGates: ["player_character", "movement_mechanics", "interaction_mechanics", "multi_tick_variation"],
    passDefinition: "one_complete_professional_natural_home_map_visual",
    ownerReviewRequired: true,
  },
  allowedEntities: runtimeFrame.layers.objects.map((object) => ({ id: object.sourceObjectId, kind: object.kind, position: object.position, footprint: object.footprint })),
  forbiddenContent: ["player", "butler", "building", "construction", "npc", "animal", "debug_overlay", "local_material_test_board"],
  previousFailures,
  failureMemoryBinding: {
    sourceConsumptionId: learningConsumption?.consumptionId ?? null,
    sourceLearningRunId: learningConsumption?.source?.learningRunId ?? null,
    generationConstraintCount: learningConsumption?.generationConstraints?.length ?? 0,
    constraintsConsumedByProgram: Boolean(learningConsumption),
  },
  storageContract: {
    mustStoreGeneratedImage: true,
    mustStoreTaskJson: true,
    mustStoreModelCheckpoint: true,
    mustStoreMachineReview: true,
    mustStoreDictionaryReview: true,
    mustStoreFailureCodes: true,
    mustStoreNextFixTargets: true,
    ownerReviewStatus: "pending",
  },
  inferenceGate: {
    status: "blocked_project_owned_model_not_ready",
    canRunCompleteVisualInference: false,
    reasons: [
      ...(latestAudit?.status === "training_data_sufficient" ? [] : ["data_gap_insufficient"]),
      ...(projectOwnedCheckpointPointer ? [] : ["project_owned_checkpoint_missing"]),
    ],
  },
  bootstrapInferenceGate: {
    status: "historical_third_party_bootstrap_disabled",
    canRunBootstrapInference: false,
    canEnterWorld: false,
    canCountAsPositiveSample: false,
    independentTrainingEligible: false,
    requiresMachineReview: true,
    requiresOwnerReview: true,
    dataSufficiencyRequiredForCandidateGeneration: true,
    dataSufficiencyRequiredForFormalTrainingPromotion: true,
  },
}

directorPlan.generationTaskDraft = {
  schemaVersion: taskPackage.schemaVersion,
  taskId,
  outputSize: taskPackage.outputSize,
  requiredParts: taskPackage.mapGrammar.requiredParts.map((entry) => entry.partId),
  previousFailureCount: previousFailures.length,
}

validateRequiredFields(taskPackage, REQUIRED_TASK_PACKAGE_FIELDS, "task package")
validateRequiredFields(directorPlan, REQUIRED_DIRECTOR_OUTPUT_FIELDS, "director output")
validateTaskPackage(taskPackage)

const canonical = JSON.stringify(taskPackage)
taskPackage.taskSha256 = crypto.createHash("sha256").update(canonical).digest("hex")
const taskDir = path.join(OUTPUT_ROOT, taskId)
const taskPath = path.join(taskDir, "task-package.json")
const directorPath = path.join(taskDir, "director-output.json")
const manifestPath = path.join(taskDir, "manifest.json")
const manifest = {
  schemaVersion: "world-visual-generation-task-manifest-v1",
  taskId,
  status: taskPackage.status,
  inferenceStatus: taskPackage.inferenceGate.status,
  createdAt: timestamp,
  createdAtAsiaShanghai: timestampLocal,
  dictionaryVersionId: dictionary.dictionaryVersionId,
  worldId: runtimeFrame.worldId,
  ownerId: runtimeFrame.ownerId,
  tick: runtimeFrame.tick,
  worldProfileId: worldState.worldProfileId,
  earthParameterSnapshotId: worldState.earthParameterSnapshotId,
  runtimeFrameId: runtimeFrame.runtimeFrameId,
  taskSha256: taskPackage.taskSha256,
  taskPath: projectPath(taskPath),
  directorPath: projectPath(directorPath),
  imageCount: 0,
  automaticStorage: true,
}

fs.mkdirSync(taskDir, { recursive: true })
writeJson(taskPath, taskPackage)
writeJson(directorPath, directorPlan)
writeJson(manifestPath, manifest)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), { ...manifest, manifestPath: projectPath(manifestPath) })

console.log(JSON.stringify(manifest, null, 2))

function buildDirectorPlan({ directorRunId, taskId, timestamp, dictionary, runtimeFrame, visualFactManifest, scene, previousFailures }) {
  return {
    schemaVersion: "world-visual-director-output-v1",
    directorRunId,
    createdAt: timestamp,
    dictionaryVersionId: dictionary.dictionaryVersionId,
    worldId: runtimeFrame.worldId,
    tick: runtimeFrame.tick,
    sourceFactIds: visualFactManifest.visualFactIds,
    visualFactManifestRef: {
      manifestId: visualFactManifest.manifestId,
      manifestSha256: visualFactManifest.manifestSha256,
      excludedFactCount: visualFactManifest.counts.excludedFacts,
      forbiddenLeakCount: visualFactManifest.forbiddenLeakIds.length,
    },
    singleMapScopePlan: {
      scopeEntryId: "versions/current-single-map-visual-scope",
      activeGoal: "single_complete_map_visual",
      reservedFeatures: ["player_character", "player_movement", "click_collect_build_inspect", "multi_tick_variation"],
      scopeLeakFailureCodes: ["active_scope_player_feature_leak", "active_scope_interaction_feature_leak", "active_scope_dynamic_tick_required"],
    },
    sceneIntent: {
      sceneIntentId: `natural-home-${runtimeFrame.worldId}-${runtimeFrame.tick}`,
      sceneType: "natural_home_runtime_frame",
      mainStory: "A complete earth-like natural home map bound to current runtime world facts.",
      primaryFocus: scene.primaryFocus,
      mustShow: scene.requiredParts.map((entry) => entry.partId),
      mayShow: scene.allowedObjectTypes,
      mustNotShow: ["player", "butler", "building", "animal", "debug_preview", "material_test_board"],
    },
    compositionPlan: {
      readOrder: scene.readOrder,
      focalHierarchy: scene.focalHierarchy,
      layoutIntent: "one coherent complete natural-home game map",
      clutterBudget: "controlled_with_quiet_playable_areas",
      cameraFit: "top_down_complete_map_readability",
    },
    terrainPlan: {
      baseTerrain: scene.baseTerrain,
      terrainKinds: scene.terrainKinds,
      terrainTransitions: scene.transitions,
      pathWearRules: ["soft_embedded_edge", "limited_mud", "continuous_route"],
      waterEdgeRules: ["coherent_water_mass", "visible_shoreline_transition", "no_vertical_wall"],
      forbiddenTerrainArtifacts: ["random_noise_field", "gray_green_camouflage", "pasted_path_band", "hard_cut_shoreline"],
    },
    assetPlan: {
      allowedObjectTypes: scene.allowedObjectTypes,
      objectClusterRules: ["boundary_cluster", "shoreline_cluster", "quiet_center", "route_clearance"],
      groundingRules: ["runtime_footprint_binding", "contact_shadow", "scale_consistency", "no_sticker_edge"],
      forbiddenAssets: ["unrelated_building", "character", "animal", "sticker_cutout"],
    },
    motionPlan: { status: "reserved_current_single_map_phase", animatedFields: [] },
    drawingProcessPlan: {
      processSteps: ["intent_lock", "semantic_inventory", "spatial_blocking", "value_grouping", "color_script", "material_pass", "grounding_pass", "polish_pass", "review_pass"],
      requiredDataRefs: dictionary.requiredActiveDocuments,
      skippedStepPolicy: "block_generation",
    },
    artDirectionPlan: {
      targetEntryId: "art-direction/professional-game-art-direction",
      playerFacingStandard: "formal_game_map_not_training_preview",
      forbiddenLooks: ["noise", "collage", "sticker", "wallpaper", "debug_preview"],
      styleUnityTargets: ["camera", "palette", "scale", "lighting", "material_language"],
    },
    materialRecipePlan: {
      requiredMaterials: scene.requiredMaterials,
      materialRecipeRefs: ["material-recipe/complete-map-material-token-library", "material-recipe/single-map-material-field-schema"],
      transitionPriorities: ["grass_to_path", "grass_to_water", "object_to_ground"],
    },
    singleMapEcologyPlan: {
      ecologyEntryId: "ecology/single-map-ecology-fields",
      requiredFields: ["moistureMap", "grassGrowthPattern", "shorelineEcology", "pathWearEcology", "boundaryVegetation", "objectGroundPockets", "noiseControl"],
      reservedFields: ["player_ecology", "interaction_ecology", "multi_tick_simulation"],
    },
    singleMapMaterialPlan: {
      materialEntryId: "material-recipe/single-map-material-field-schema",
      requiredMaterials: ["grass", "dirt_path", "water", "shoreline", "forest_edge", "stone", "vegetation_detail"],
      requiredFieldNames: ["roleInMap", "colorFamily", "valueBand", "markScale", "edgeTransition", "detailBudget", "professionalCue"],
    },
    compositionRecipePlan: {
      readOrder: scene.readOrder,
      focalHierarchy: scene.focalHierarchy,
      negativeSpaceTargets: ["home_center", "route_sides", "main_grass_read"],
      detailRhythmTargets: ["controlled_clusters", "quiet_areas", "no_random_scatter"],
    },
    singleMapCompositionPlan: {
      compositionEntryId: "composition-recipe/single-map-composition-fields",
      requiredFieldNames: ["mapReadGoal", "primaryFocalArea", "entrancePlacement", "mainRoutePlan", "waterPlacement", "boundaryFrame", "openSpacePlan", "detailRhythmPlan", "visualBalance"],
      forbiddenDependencies: ["player_character", "interaction_marker", "ui_marker"],
    },
    renderLayerRecipePlan: {
      orderedLayerRefs: ["base_terrain", "water", "path", "shoreline", "boundary", "footprints", "objects", "shadows", "detail", "polish"],
      preserveRules: ["route_readability", "center_readability", "object_contact", "terrain_transition"],
      forbiddenLayerOutputs: ["debug", "fallback", "placeholder", "program_only_final_art"],
    },
    qualityRubricPlan: {
      rubricEntryId: "quality-rubric/professional-map-quality-rubric",
      categoryWeights: { gameRead: 0.2, mapGrammar: 0.15, materialQuality: 0.15, styleUnity: 0.15, grounding: 0.15, gameplayReadability: 0.1, polish: 0.1 },
      minimumDisplayGate: 85,
      ownerOverride: true,
    },
    singleMapAcceptancePlan: {
      acceptanceEntryId: "review/single-map-visual-acceptance",
      activeGates: ["single_map_scope", "map_structure", "material_quality", "composition_quality", "art_direction", "object_grounding", "storage_trace", "owner_review"],
      reservedNonGates: ["player", "movement", "interaction", "multi_tick"],
      ownerReviewRequired: true,
    },
    fixPlanInput: {
      previousReviewRecordId: previousFailures[0]?.reviewRecordId ?? null,
      failureCodes: previousFailures.map((failure) => failure.code),
      priorityTargets: previousFailures.map((failure, index) => ({ priority: index + 1, code: failure.code, target: failure.nextFixTarget })),
      ownerComment: previousFailures.find((failure) => failure.source === "owner_review")?.detail ?? null,
    },
    generationTaskDraft: { taskId },
    safety: {
      canShowToPlayer: false,
      changesWorldFacts: false,
      bypassesReview: false,
      usesStructuredTask: true,
      includesDrawingMethod: true,
      includesArtDirection: true,
      includesQualityRubric: true,
      includesSingleMapScope: true,
      excludesReservedGameplayGates: true,
      carriesPreviousFailures: previousFailures.length > 0,
      generationMode: previousFailures.length > 0 ? "repair_generation" : "first_generation",
    },
  }
}

function buildPreviousFailures(ownerDecision, audit, learningConsumption) {
  const failures = []
  if (ownerDecision && ownerDecision.status !== "success" && ownerDecision.status !== "approved" && ownerDecision.status !== "passed") {
    failures.push({
      code: ownerDecision.error ?? "owner_review_failed_current_map_not_professional_game_standard",
      source: "owner_review",
      reviewRecordId: ownerDecision.id ?? ownerDecision.runId ?? null,
      detail: ownerDecision.detailZh ?? ownerDecision.detail ?? "Owner rejected the current complete map.",
      nextFixTarget: "complete_map_professional_visual_quality",
      evidenceTimestamp: ownerDecision.timestamp ?? null,
    })
  }
  for (const gate of audit?.blockingGates ?? []) {
    failures.push({
      code: `data_gap_${gate.gate}`,
      source: "data_sufficiency_audit",
      reviewRecordId: audit.auditId ?? null,
      detail: `current=${gate.current}; required=${gate.minimum}; missing=${gate.missing}`,
      nextFixTarget: gate.gate,
      evidenceTimestamp: audit.generatedAt ?? null,
    })
  }
  for (const constraint of learningConsumption?.generationConstraints ?? []) {
    if (failures.some((failure) => failure.code === constraint.code)) continue
    failures.push({
      code: constraint.code,
      source: "automatic_visual_learning_feedback",
      reviewRecordId: learningConsumption.consumptionId,
      detail: `targetArea=${constraint.targetArea}; occurrenceCount=${constraint.occurrenceCount}; action=${constraint.action}`,
      nextFixTarget: constraint.targetArea,
      evidenceTimestamp: learningConsumption.createdAt,
      evidencePaths: constraint.evidencePaths,
    })
  }
  return failures
}

function readLatestOwnerDecision(runtimeFrameId, imageSha256) {
  const ledger = readOptionalText(".runtime/ai-painter/training-process-ledger/events.jsonl")
  if (!ledger) return null
  return ledger.split(/\r?\n/).filter(Boolean).map(parseJson).filter(Boolean).filter((event) =>
    event.action === "owner_review_game_map_runtime_frame" &&
    event.archiveId === runtimeFrameId &&
    event.resourceSessionId === imageSha256
  ).at(-1) ?? null
}

function validateTaskPackage(task) {
  assert(task.outputSize.frameScope === "complete_runtime_frame", "task output must be complete RuntimeFrame")
  assert(task.outputSize.width === 1024 && task.outputSize.height === 768, "task output size must be 1024x768")
  assert(task.sourceFactIds.length > 0, "task must bind source world facts")
  assert(task.spatialLayers.terrainRegions.length > 0, "task must include terrain regions")
  assert(task.spatialLayers.walkableRegions.length > 0, "task must include walkable regions")
  assert(task.spatialLayers.collisionRegions.length > 0, "task must include collision regions")
  assert(task.spatialLayers.objectFootprints.length > 0, "task must include object footprints")
  assert(task.mapGrammar.requiredParts.length >= 5, "task must include all complete map parts")
  assert(!task.sourceFactIds.some((id) => /butler|construction/i.test(id)), "task source facts contain forbidden butler or construction facts")
  assert(task.sourceBindings.visualFactManifestId, "task must bind a VisualFactManifest")
  assert(Array.isArray(task.previousFailures), "previousFailures must be an array for first or repair generation")
  assert(task.storageContract.ownerReviewStatus === "pending", "new task owner review must start pending")
  assert(task.inferenceGate.canRunCompleteVisualInference === false, "inference cannot be marked runnable before implementation")
}

function validateRequiredFields(value, fields, label) {
  for (const field of fields) assert(Object.hasOwn(value, field), `${label} missing required field: ${field}`)
}

function material(materialId, role, baseColorRange, valueRange, textureScale, edgeBehavior, detailBehavior, professionalCue) {
  return { materialId, baseColorRange, valueRange, textureScale, edgeBehavior, detailBehavior, gameplayMeaning: role, failureCodes: [], professionalCue }
}

function deriveSceneContext(runtimeFrame, visualFactManifest) {
  const facts = visualFactManifest.visualFacts
  const factBySemantic = (type) => facts.find((fact) => fact.semanticType === type) ?? null
  const entranceFact = factBySemantic("entry_area")
  const centerFact = factBySemantic("visual_center")
  const boundaryFact = factBySemantic("natural_boundary")
  const terrainRecords = visualFactManifest.structureBindings.terrainRecords
  const pathRecords = visualFactManifest.structureBindings.pathRecords
  const waterRecords = terrainRecords.filter((item) => item.kind === "water")
  const shorelineRecords = terrainRecords.filter((item) => item.kind === "shoreline")
  const boundaryRecords = terrainRecords.filter((item) => item.kind === "natural_boundary")
  const terrainKinds = [...new Set(terrainRecords.map((item) => item.kind))]
  const allowedObjectTypes = [...new Set(visualFactManifest.structureBindings.objectRecords.map((item) => item.kind))]
  const requiredParts = [
    entranceFact ? factPart("entrance", entranceFact.factId) : null,
    pathRecords[0] ? structurePart("main_path", pathRecords[0].structureRecordId) : null,
    centerFact ? factPart("home_center", centerFact.factId) : null,
    waterRecords[0] ? structurePart("water_edge", waterRecords[0].structureRecordId) : null,
    boundaryFact ? factPart("natural_boundary", boundaryFact.factId) : boundaryRecords[0] ? structurePart("natural_boundary", boundaryRecords[0].structureRecordId) : null,
  ].filter(Boolean)
  const readOrder = requiredParts.map((entry) => entry.partId)
  const requiredMaterials = [...new Set([
    ...terrainKinds.map(materialForTerrainKind).filter(Boolean),
    ...allowedObjectTypes.map(materialForObjectKind).filter(Boolean),
  ])]
  const transitions = [
    terrainKinds.includes("grass") && terrainKinds.includes("path_ground") ? "grass_to_path" : null,
    terrainKinds.includes("grass") && waterRecords.length > 0 ? "grass_to_water" : null,
    waterRecords.length > 0 && shorelineRecords.length > 0 ? "water_to_shoreline" : null,
    allowedObjectTypes.length > 0 ? "object_to_ground" : null,
  ].filter(Boolean)
  const waterPlacement = waterRecords[0]
    ? {
        sourceStructureId: waterRecords[0].structureRecordId,
        role: "coherent_water_mass",
        relativeLocation: relativePolygonLocation(waterRecords[0].polygon, 1024, 768),
        shorelineStructureIds: shorelineRecords.map((item) => item.structureRecordId),
      }
    : null
  const naturalGrowth = visualFactManifest.worldSignals.naturalGrowth
  const objectCount = visualFactManifest.structureBindings.objectRecords.length
  return {
    entranceFact,
    centerFact,
    boundaryFact,
    pathRecords,
    terrainKinds,
    allowedObjectTypes,
    requiredParts,
    requiredMaterials,
    transitions,
    waterPlacement,
    primaryFocus: centerFact ? "home_center" : requiredParts[0]?.partId ?? "complete_map",
    readOrder,
    focalHierarchy: [centerFact ? "home_center" : "complete_map", pathRecords.length > 0 ? "route" : null, waterRecords.length > 0 ? "water_edge" : null, boundaryRecords.length > 0 ? "boundary" : null, "detail_clusters"].filter(Boolean),
    routeGraph: {
      nodes: [entranceFact?.factId, ...pathRecords.map((item) => item.structureRecordId), centerFact?.factId, waterRecords[0]?.structureRecordId].filter(Boolean),
      edges: pathRecords.map((item, index) => ({ order: index, structureRecordId: item.structureRecordId })),
    },
    adjacencyRules: [
      entranceFact && pathRecords.length > 0 ? "entrance_touches_main_path" : null,
      centerFact && pathRecords.length > 0 ? "main_path_reaches_home_center" : null,
      waterRecords.length > 0 && shorelineRecords.length > 0 ? "shoreline_separates_grass_and_water" : null,
    ].filter(Boolean),
    baseTerrain: terrainKinds.includes("grass") ? "grass" : terrainKinds[0] ?? "unknown",
    ecology: {
      biomeType: visualFactManifest.worldSignals.biomeType ?? "unknown_not_provided",
      moistureLevel: waterRecords.length > 0 ? "water_influenced" : "world_signal_not_provided",
      growthStage: typeof naturalGrowth !== "number" ? "world_signal_not_provided" : naturalGrowth < 34 ? "young" : naturalGrowth < 67 ? "balanced" : "dense",
      vegetationDensity: objectCount < 12 ? "sparse" : objectCount < 40 ? "balanced" : "overloaded",
      waterInfluence: waterRecords.length > 0 ? "edge" : "none",
      pathWear: terrainKinds.includes("mud_patch") ? "readable_with_wear" : pathRecords.length > 0 ? "readable" : "none",
    },
  }
}

function factPart(partId, sourceFactId) {
  return { partId, sourceType: "world_fact", sourceFactId, required: true }
}

function structurePart(partId, sourceStructureId) {
  return { partId, sourceType: "map_structure", sourceStructureId, required: true }
}

function materialForTerrainKind(kind) {
  return ({ grass: "grass", tall_grass: "grass", path_ground: "dirt_path", water: "water", shoreline: "shoreline", mud_patch: "mud_patch", natural_boundary: "forest_edge" })[kind] ?? null
}

function materialForObjectKind(kind) {
  return kind === "rock" ? "stone" : ["tree", "shrub", "flower_patch", "grass_detail"].includes(kind) ? "vegetation_detail" : null
}

function relativePolygonLocation(polygon, width, height) {
  const center = polygon.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 })
  center.x /= polygon.length
  center.y /= polygon.length
  const horizontal = center.x < width / 3 ? "west" : center.x > width * 2 / 3 ? "east" : "center"
  const vertical = center.y < height / 3 ? "north" : center.y > height * 2 / 3 ? "south" : "middle"
  return `${vertical}_${horizontal}`
}

function readRequiredJson(filePath) {
  const value = readOptionalJson(filePath)
  assert(value, `required JSON missing or invalid: ${filePath}`)
  return value
}

function readOptionalJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(ROOT, filePath), "utf8"))
  } catch {
    return null
  }
}

function readOptionalText(filePath) {
  try {
    return fs.readFileSync(path.resolve(ROOT, filePath), "utf8")
  } catch {
    return ""
  }
}

function parseJson(value) {
  try { return JSON.parse(value) } catch { return null }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function projectPath(filePath) {
  const absolute = path.resolve(ROOT, filePath)
  const relative = path.relative(ROOT, absolute)
  return relative.startsWith("..") || path.isAbsolute(relative) ? absolute : relative.replace(/\\/g, "/")
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
