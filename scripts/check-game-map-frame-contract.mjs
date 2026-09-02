import { readFileSync } from "node:fs"

const checks = []

function check(label, condition) {
  checks.push({ label, condition })
}

function read(path) {
  return readFileSync(path, "utf8")
}

const structureSchema = read("src/world/game-map-frame/home-map-structure-schema.ts")
const frameSchema = read("src/world/game-map-frame/game-map-frame-schema.ts")
const builder = read("src/world/game-map-frame/game-map-frame-builder.ts")
const layerGenerator = read("src/world/game-map-frame/game-map-layer-generator.ts")
const geometry = read("src/world/game-map-frame/game-map-geometry.ts")
const validator = read("src/world/game-map-frame/game-map-frame-validator.ts")
const visualBinding = read("src/world/game-map-frame/game-map-visual-layer-binding.ts")
const visualJudge = read("src/world/game-map-frame/game-map-visual-judge.ts")
const compositeSchema = read("src/world/game-map-frame/game-map-composite-schema.ts")
const compositeBuilder = read("src/world/game-map-frame/game-map-composite-builder.ts")
const compositeJudge = read("src/world/game-map-frame/game-map-composite-judge.ts")
const formalVisualJudge = read("src/world/game-map-frame/game-map-formal-visual-judge.ts")
const compositeMaterialBinding = read("src/world/game-map-frame/game-map-composite-material-binding.ts")
const materialPack = read("src/world/game-map-frame/game-map-approved-visual-unit-material-pack.ts")
const materialPackBuilder = read("src/world/game-map-frame/game-map-approved-visual-unit-material-pack-builder.ts")
const materialRequest = read("src/world/game-map-frame/game-map-material-generation-request.ts")
const materialInputPack = read("src/world/game-map-frame/game-map-material-input-pack.ts")
const runtimeCompositor = read("src/world/game-map-frame/game-map-runtime-compositor.ts")
const runtimeFrameSchema = read("src/world/game-map-frame/game-map-runtime-frame-schema.ts")
const runtimeFrameBuilder = read("src/world/game-map-frame/game-map-runtime-frame-builder.ts")
const runtimeFrameFinalizer = read("src/world/game-map-frame/game-map-runtime-frame-finalizer.ts")
const runtimeFrameStore = read("src/world/game-map-frame/game-map-runtime-frame-store.ts")
const runtimeRenderer = read("src/world/game-map-frame/game-map-runtime-renderer.ts")
const runtimePipeline = read("src/world/game-map-frame/game-map-runtime-frame-pipeline.ts")
const currentWorldStructure = read("src/world/game-map-frame/game-map-current-world-structure-builder.ts")
const approvedFrameSource = read("src/world/game-map-frame/game-map-approved-frame-source.ts")
const sample = read("src/world/game-map-frame/natural-home-mvp-sample.ts")
const index = read("src/world/game-map-frame/index.ts")
const worldPage = read("src/app/world/world-live-runtime-page.tsx")
const worldImageRoute = read("src/app/api/world/game-map-runtime-frame/image/route.ts")
const legacyImageRoute = read("src/app/api/ai-painter/game-map-runtime-frame/image/route.ts")
const currentExecutionGuide = read("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const packageJson = read("package.json")
const currentRuntimeWriter = read("scripts/write-current-game-map-runtime-frame.mjs")
const materialRequestWriter = read("scripts/write-current-game-map-material-generation-request.mjs")
const materialInputPackWriter = read("scripts/write-current-game-map-material-input-pack.mjs")
const materialSlotInferenceRunner = read("scripts/run-current-game-map-material-slot-inference.mjs")
const materialSlotLocalInference = read("ml/ai-painter/scripts/infer_game_map_material_slots.py")
const localDetailTraining = read("ml/ai-painter/scripts/train_natural_home_local_detail_models.py")
const objectAlphaConfig = read("ml/ai-painter/configs/training_natural_home_local_details_v42_object_alpha.json")
const materialSlotRepairDataset = read("ml/ai-painter/scripts/prepare_game_map_material_slot_repair_dataset.py")
const materialSlotRepairConfig = read("ml/ai-painter/configs/training_natural_home_local_details_v44_material_slot_repair.json")
const materialSlotRepairAssembler = read("scripts/assemble-game-map-material-slot-v44-model-root.mjs")
const materialQualityJudge = read("scripts/judge-current-game-map-material-quality.mjs")
const materialPackWriter = read("scripts/build-current-game-map-approved-material-pack.mjs")
const compositeRuntimeWriter = read("scripts/write-current-game-map-composite-runtime-frame.mjs")
const dictionaryContract = read("scripts/lib/world-visual-dictionary-contract.mjs")
const runtimePipelineRunner = read("scripts/run-current-game-map-material-slot-v46-runtime-pipeline.mjs")
const gameWorldFrameGate = read("ml/ai-painter/scripts/judge_natural_home_game_world_frame.py")
const gameWorldFrameGateCheck = read("scripts/check-natural-home-game-world-frame-gate.mjs")

check("HomeMapStructure schema exists", structureSchema.includes("HomeMapStructure"))
check("HomeMapStructure version is fixed", structureSchema.includes('"home-map-structure-v1"'))
check("GameMapFrame schema exists", frameSchema.includes("GameMapFrame"))
check("GameMapFrame version is fixed", frameSchema.includes('"game-map-frame-v1"'))
check("GameMapFrame terrain layer exists", frameSchema.includes("terrainLayer"))
check("GameMapFrame object layer exists", frameSchema.includes("objectLayer"))
check("GameMapFrame walkable layer exists", frameSchema.includes("walkableLayer"))
check("GameMapFrame collision layer exists", frameSchema.includes("collisionLayer"))
check("GameMapFrame interaction layer exists", frameSchema.includes("interactionLayer"))
check("GameMapFrame runtime layer exists", frameSchema.includes("runtimeLayer"))
check("GameMapFrame visual layer exists", frameSchema.includes("visualLayer"))
check(
  "Visual layer starts as not generated",
  builder.includes('status: "not_generated"') && builder.includes('source: "none"')
)
check(
  "Builder uses structure facts instead of image reverse inference",
  builder.includes("collectHomeMapStructureSourceFactIds") &&
    !builder.includes("png") &&
    !builder.includes("imageUrl")
)
check("P5-2 layer generator exists", layerGenerator.includes("generateGameMapLayers"))
check("P5-2 terrain layer is generated", layerGenerator.includes("terrainLayer"))
check("P5-2 object layer is generated", layerGenerator.includes("objectLayer"))
check("P5-2 walkable layer is generated", layerGenerator.includes("walkableLayer"))
check("P5-2 collision layer is generated", layerGenerator.includes("collisionLayer"))
check("P5-2 interaction layer is generated", layerGenerator.includes("interactionLayer"))
check("P5-2 runtime layer is generated", layerGenerator.includes("runtimeLayer"))
check(
  "Path generation uses continuous corridors",
  layerGenerator.includes("pathToSegmentRegions") &&
    layerGenerator.includes("buildPolylineCorridorPolygon") &&
    layerGenerator.includes("path-corridor-") &&
    !layerGenerator.includes("path-segment-")
)
check(
  "Geometry helper builds real corridor polygons",
  geometry.includes("buildSegmentPolygon") &&
    geometry.includes("buildPolylineCorridorPolygon") &&
    geometry.includes("Math.hypot") &&
    geometry.includes("rectsOverlap")
)
check("Validator checks entry to home path", validator.includes("entry_to_home_path_missing"))
check("Validator checks source facts", validator.includes("source_fact_ids_mismatch"))
check("Validator checks collision layer", validator.includes("blocked_object_missing"))
check("Validator checks path points", validator.includes("path_point_out_of_bounds"))
check("Validator checks object bounds", validator.includes("object_footprint_out_of_bounds"))
check("Validator checks path terrain", validator.includes("path_terrain_missing"))
check("Validator checks path walkable", validator.includes("path_walkable_missing"))
check("Validator checks path blocking", validator.includes("blocking_object_overlaps_path"))
check(
  "Runtime layer binds source structure",
  layerGenerator.includes("structure:${structure.structureId}") &&
    validator.includes("runtime_layer_structure_ref_missing")
)
check("P5-3 visual layer binding exists", visualBinding.includes("bindAiPainterCandidateVisualLayer"))
check("P5-3 ApprovedFrame binding exists", visualBinding.includes("bindApprovedFrameVisualLayer"))
check(
  "Candidate binding keeps candidates non-showable",
  visualBinding.includes("candidate.canShowToPlayer !== false") &&
    visualBinding.includes("candidate_not_showable_to_player")
)
check("Candidate binding requires project model source", visualBinding.includes('candidate.sourceKind !== "project_model_generated"'))
check("Approved binding requires game world scope", visualBinding.includes('approvedFrame.approvalScope !== "approved_for_game_world"'))
check("Approved binding requires VJ-2 pass", visualBinding.includes('approvedFrame.vj2Status !== "vj_2_passed"'))
check(
  "Approved binding requires composite input tags",
  visualBinding.includes("formal_full_world_frame") &&
    visualBinding.includes("single_approved_visual_layer") &&
    visualBinding.includes("not_world_page_runtime") &&
    visualBinding.includes("requires_composite_game_map_runtime_frame")
)
check(
  "Approved binding blocks training or partial tags",
  visualBinding.includes("partial_or_crop_candidate") &&
    visualBinding.includes("training_candidate") &&
    visualBinding.includes("single_direct_output")
)
check(
  "Visual layer schema separates candidate and approved",
  frameSchema.includes('status: "candidate"') &&
    frameSchema.includes('status: "approved"') &&
    frameSchema.includes("candidateId: string")
)
check("P5-4 game map VisualJudge exists", visualJudge.includes("judgeGameMapFrameForRuntime"))
check(
  "P5-4 VisualJudge requires approved or structured fallback visual layer",
  visualJudge.includes('frame.visualLayer.status !== "approved"') &&
    visualJudge.includes('frame.visualLayer.status !== "structured_fallback"') &&
    visualJudge.includes("visual_layer_not_approved")
)
check(
  "P5-4 VisualJudge blocks cropped visual layers",
  visualJudge.includes("visual_layer_width_too_small") &&
    visualJudge.includes("visual_layer_height_too_small")
)
check(
  "P5-4 VisualJudge blocks training and partial tags",
  visualJudge.includes("training_or_partial_tags_present") &&
    visualJudge.includes("partial_or_crop_candidate")
)
check(
  "P5-4 VisualJudge requires visual map layers and reserves interaction",
  visualJudge.includes("terrain_layer_empty") &&
    visualJudge.includes("walkable_layer_empty") &&
    visualJudge.includes("collision_layer_empty") &&
    visualJudge.includes("interaction_layer_reserved_current_scope")
)
check(
  "P5-4 VisualJudge keeps source facts same source",
  visualJudge.includes("collectHomeMapStructureSourceFactIds") &&
    visualJudge.includes("source_fact_ids_not_same_source")
)
check("P5-5 RuntimeFrame schema exists", runtimeFrameSchema.includes("GameMapRuntimeFrame"))
check(
  "P5-5 RuntimeFrame is for /world game runtime",
  runtimeFrameSchema.includes('page: "/world"') &&
    runtimeFrameSchema.includes('mode: "game_runtime"') &&
    runtimeFrameSchema.includes("canShowInWorld: boolean")
)
check(
  "P5-5 RuntimeFrame forbids training payloads",
  runtimeFrameSchema.includes("training_image") &&
    runtimeFrameSchema.includes("candidate_image") &&
    runtimeFrameSchema.includes("partial_crop_image")
)
check("P5-5 RuntimeFrame builder exists", runtimeFrameBuilder.includes("buildGameMapRuntimeFrame"))
check(
  "P5-5 RuntimeFrame builder requires passed VisualJudge",
  runtimeFrameBuilder.includes("!judgeReport.passed") &&
    runtimeFrameBuilder.includes("blocked_visual_judge_not_passed")
)
check(
  "P5-5 RuntimeFrame builder keeps map layers",
  runtimeFrameBuilder.includes("terrain: frame.terrainLayer.regions") &&
    runtimeFrameBuilder.includes("walkable: frame.walkableLayer.regions") &&
    runtimeFrameBuilder.includes("collision: frame.collisionLayer.regions") &&
    runtimeFrameBuilder.includes("interactions: frame.interactionLayer.items")
)
check(
  "P5-5 RuntimeFrame builder keeps visual identity",
  runtimeFrameBuilder.includes("structured_fallback_skin") &&
    runtimeFrameBuilder.includes("ai_painter_approved_frame") &&
    runtimeFrameBuilder.includes("approvedFrameId: frame.visualLayer.approvedFrameId") &&
    runtimeFrameBuilder.includes("imageSha256: frame.visualLayer.imageSha256")
)
check(
  "P5-5 RuntimeFrame schema supports structured fallback visual",
  runtimeFrameSchema.includes('"structured_fallback_skin"') &&
    runtimeFrameSchema.includes("isRuntimeVisualIdentity") &&
    runtimeFrameSchema.includes("approvedFrameId === null")
)
check(
  "P6-3 RuntimeFrame pipeline supports structured fallback",
  runtimePipeline.includes("bindStructuredFallbackVisualLayer") &&
    runtimePipeline.includes("allowStructuredFallback")
)
check(
  "Current single-map visual scope allows reserved interaction layer to be empty",
  visualJudge.includes("interaction_layer_reserved_current_scope") &&
    !visualJudge.includes("interaction_layer_empty")
)
check(
  "World visual dictionary runtime contract exists",
  dictionaryContract.includes("world-visual-dictionary-runtime-contract-v1") &&
    dictionaryContract.includes("ACTIVE_SINGLE_MAP_DOCUMENTS") &&
    dictionaryContract.includes("REQUIRED_TASK_PACKAGE_FIELDS") &&
    dictionaryContract.includes("REQUIRED_DIRECTOR_OUTPUT_FIELDS")
)
check(
  "Runtime training archive loads dictionary contract",
  runtimePipelineRunner.includes("loadWorldVisualDictionaryContract") &&
    runtimePipelineRunner.includes("dictionaryContract") &&
    runtimePipelineRunner.includes("tryLoadWorldVisualDictionaryContract")
)
check(
  "Runtime training archive plans contaminated grass material repair",
  runtimePipelineRunner.includes("strict-grass-material-contamination") &&
    runtimePipelineRunner.includes("grass_material_water_contamination_suspected") &&
    runtimePipelineRunner.includes("grass_material_path_fragment_suspected") &&
    runtimePipelineRunner.includes("grass_material_blue_object_fragment_suspected")
)
check(
  "Complete game-world gate writes dictionary contract",
  gameWorldFrameGate.includes("load_dictionary_contract") &&
    gameWorldFrameGate.includes("dictionaryContract") &&
    gameWorldFrameGate.includes("dictionary_contract_must_pass")
)
check(
  "Complete game-world gate check requires dictionary contract",
  gameWorldFrameGateCheck.includes("world-visual-dictionary-runtime-contract-v1") &&
    gameWorldFrameGateCheck.includes("dictionary_contract_must_pass") &&
    gameWorldFrameGateCheck.includes("single_complete_map_visual")
)
check(
  "P5-5 RuntimeFrame builder keeps approved visual fields",
  runtimeFrameBuilder.includes("approvedFrameId: frame.visualLayer.approvedFrameId") &&
    runtimeFrameBuilder.includes("imageSha256: frame.visualLayer.imageSha256")
)
check("P7-7 composite manifest schema exists", compositeSchema.includes("GameMapCompositeManifest"))
check(
  "P7-7 composite manifest separates chunks and visual unit slots",
  compositeSchema.includes("GameMapCompositeTileChunk") &&
    compositeSchema.includes("GameMapVisualUnitSlot") &&
    compositeSchema.includes("tileChunks") &&
    compositeSchema.includes("visualUnitSlots")
)
check(
  "P7-7 composite manifest forbids direct world entry",
  compositeBuilder.includes("canEnterWorld: false") &&
    compositeSchema.includes("visual_unit_materials_not_fully_bound")
)
check(
  "P7-7 composite contract forbids program final render",
  compositeSchema.includes("program_final_render") &&
    compositeSchema.includes("not_program_final_render")
)
check(
  "P7-7 composite builder maps layers to chunks",
  compositeBuilder.includes("frame.terrainLayer.regions.map") &&
    compositeBuilder.includes("frame.objectLayer.objects.map") &&
    compositeBuilder.includes("frame.walkableLayer.regions.map") &&
    compositeBuilder.includes("frame.collisionLayer.regions.map") &&
    compositeBuilder.includes("frame.interactionLayer.items.map")
)
check(
  "P7-7 composite builder declares AI Painter visual unit slots",
  compositeBuilder.includes("requires_ai_painter_visual_units") &&
    compositeBuilder.includes("regionToVisualUnitSlot") &&
    compositeBuilder.includes("objectToVisualUnitSlot")
)
check(
  "P7-7 RuntimeFrame carries composite manifest",
  runtimeFrameSchema.includes("composition: GameMapCompositeManifest") &&
    runtimeFrameSchema.includes("isGameMapCompositeManifest(value.composition)") &&
    runtimeFrameBuilder.includes("buildGameMapCompositeManifest(frame)") &&
    runtimeFrameBuilder.includes("p7_7_composite_manifest_attached")
)
check(
  "P7-9 composite manifest requires full compositor output for /world",
  compositeSchema.includes("GameMapCompositeOutput") &&
    compositeSchema.includes("compositeOutput") &&
    compositeSchema.includes("runtime_compositor_from_ai_visual_units") &&
    compositeSchema.includes("world_ready_composite_output_missing")
)
check("P7-8 composite VisualJudge exists", compositeJudge.includes("judgeGameMapCompositeManifestForWorld"))
check(
  "P7-8 composite VisualJudge blocks incomplete material bindings",
  compositeJudge.includes("visual_material_bindings_incomplete") &&
    compositeJudge.includes("Every visual unit slot must bind an approved AI Painter material")
)
check(
  "P7-9 composite VisualJudge blocks missing composite output",
  compositeJudge.includes("composite_output_missing") &&
    compositeJudge.includes("runtime_compositor_from_ai_visual_units")
)
check(
  "P7-9 composite VisualJudge requires formal full-frame approval",
  compositeJudge.includes("formal_game_map_visual_judge_missing") &&
    compositeJudge.includes("formal_game_map_visual_judge_passed") &&
    compositeJudge.includes("Complete /world map requires formal full-frame VisualJudge approval")
)
check(
  "P7-9 formal full-frame VisualJudge exists",
  formalVisualJudge.includes("judgeFormalGameMapCompositeOutput") &&
    formalVisualJudge.includes("game-map-formal-visual-judge-report-v1") &&
    formalVisualJudge.includes("formal_game_map_visual_judge_passed") &&
    formalVisualJudge.includes("formal_game_map_visual_judge_failed")
)
check(
  "P7-9 formal VisualJudge blocks weak full-map images",
  formalVisualJudge.includes("formal_world_frame_green_dominance_too_high") &&
    formalVisualJudge.includes("formal_world_frame_neon_highlight_too_high") &&
    formalVisualJudge.includes("formal_world_frame_water_presence_too_low") &&
    formalVisualJudge.includes("formal_world_frame_luma_out_of_range") &&
    formalVisualJudge.includes("formal_world_frame_required_units_missing") &&
    formalVisualJudge.includes("formal_world_frame_vertical_paste_boundary_detected") &&
    formalVisualJudge.includes("formal_world_frame_horizontal_paste_boundary_detected")
)
check(
  "P7-8 composite VisualJudge requires final world tag",
  compositeJudge.includes("composite_runtime_frame_tag_missing") &&
    compositeJudge.includes("composite_game_map_runtime_frame")
)
check(
  "P7-8 composite VisualJudge blocks single image and training tags",
  compositeJudge.includes("single_approved_visual_layer") &&
    compositeJudge.includes("structured_fallback_runtime_frame") &&
    compositeJudge.includes("training_candidate") &&
    compositeJudge.includes("candidate_only")
)
check(
  "P7-8 composite VisualJudge blocks system-gate-only visual quality",
  compositeJudge.includes("visual_quality_unverified_system_gate") &&
    compositeJudge.includes("visual_material_quality_unverified") &&
    compositeJudge.includes("system-gate-only materials cannot enter /world")
)
check(
  "P7-8 RuntimeFrame store diagnoses invalid composite world readiness",
    runtimeFrameStore.includes("composite_game_map_runtime_frame_tag_missing") &&
    runtimeFrameStore.includes("composition_status_blocks_world") &&
    runtimeFrameStore.includes("composition_manifest_world_tag_missing") &&
    runtimeFrameStore.includes("composition_composite_output_missing")
)
check(
  "P7-8 /world requires composition world readiness",
  worldPage.includes("runtimeFrame.composition.compositionStatus.canEnterWorld === true") &&
    worldPage.includes("runtimeFrame.composition.tags.includes(WORLD_DISPLAY_REQUIRED_TAG)")
)
check(
  "P7-9 material binder separates materials from final world output",
  compositeMaterialBinding.includes("bindGameMapCompositeMaterials") &&
    compositeMaterialBinding.includes("bindGameMapCompositeOutput") &&
    compositeMaterialBinding.includes("composite_output_missing") &&
    compositeMaterialBinding.includes("world_page_still_blocked")
)
check(
  "P7-9 Runtime Compositor writes complete output from AI visual units",
  runtimeCompositor.includes("composeGameMapRuntimeOutput") &&
    runtimeCompositor.includes("sharp") &&
    runtimeCompositor.includes("bindGameMapCompositeOutput") &&
    runtimeCompositor.includes("runtime_compositor_from_ai_visual_units") &&
    runtimeCompositor.includes("auditPath")
)
check(
  "P7-9 Runtime Compositor writes formal VisualJudge report",
  runtimeCompositor.includes("judgeFormalGameMapCompositeOutput") &&
    runtimeCompositor.includes("formalVisualJudgePath") &&
    runtimeCompositor.includes("formalVisualJudgeReport.tags")
)
check(
  "P7-9 Runtime Compositor alpha-masks AI visual units by source geometry",
  runtimeCompositor.includes("applySlotAlphaMask") &&
    runtimeCompositor.includes("buildSlotAlphaMaskSvg") &&
    runtimeCompositor.includes("slotMaskBlurRadius") &&
    runtimeCompositor.includes("slot.maskGeometry") &&
    runtimeCompositor.includes("<polygon points=") &&
    runtimeCompositor.includes("<rect x=")
)
check(
  "P7-9 Runtime Compositor validates source material bytes",
  runtimeCompositor.includes("sourceSha256 !== binding.imageSha256") &&
    runtimeCompositor.includes("metadata.width !== binding.imageWidth") &&
    runtimeCompositor.includes("blocked_material_image_mismatch")
)
check(
  "P7-9 Runtime Compositor blocks visible grid artifacts",
  runtimeCompositor.includes("measureCompositeOutputQuality") &&
    runtimeCompositor.includes("gridArtifactSuspected") &&
    runtimeCompositor.includes("composite_grid_artifact_suspected") &&
    runtimeCompositor.includes("visibleGridArtifactSuspected") &&
    runtimeCompositor.includes("composite_visible_grid_artifact_suspected") &&
    runtimeCompositor.includes("patchBandArtifactSuspected") &&
    runtimeCompositor.includes("composite_patch_band_artifact_suspected") &&
    compositeMaterialBinding.includes("composite_patch_band_artifact_suspected") &&
    compositeJudge.includes("composite_patch_band_artifact_suspected") &&
    compositeMaterialBinding.includes("composite_visible_grid_artifact_suspected") &&
    compositeJudge.includes("composite_visible_grid_artifact_suspected") &&
    compositeJudge.includes("composite_grid_artifact_suspected")
)
check(
  "P7-9 Runtime Compositor blocks dense or repeated whole-map texture",
  runtimeCompositor.includes("measureRepetitiveTextureMetrics") &&
    runtimeCompositor.includes("denseTextureArtifactSuspected") &&
    runtimeCompositor.includes("composite_repetitive_texture_suspected") &&
    runtimeCompositor.includes("composite_dense_texture_suspected") &&
    compositeMaterialBinding.includes("composite_dense_texture_suspected") &&
    compositeJudge.includes("composite_dense_texture_suspected")
)
check(
  "P7-9 Runtime Compositor blocks object materials without alpha isolation",
  runtimeCompositor.includes("objectMaterialAlphaMissingCount") &&
    runtimeCompositor.includes("isObjectVisualUnitKind") &&
    runtimeCompositor.includes('unitKind.endsWith("_visual_unit")') &&
    runtimeCompositor.includes("composite_object_material_alpha_missing") &&
    compositeJudge.includes("composite_object_material_alpha_missing")
)
check(
  "P7-10 Object visual-unit models use RGBA alpha targets",
  materialSlotLocalInference.includes('"tree_visual_unit": "tree_object"') &&
    materialSlotLocalInference.includes('"rock_visual_unit": "rock_object"') &&
    materialSlotLocalInference.includes('"flower_visual_unit": "grass_object"') &&
    materialSlotLocalInference.includes("REFERENCE_DATASET_CATEGORY") &&
    localDetailTraining.includes("CATEGORY_TARGET_ALPHA_CHANNELS") &&
    localDetailTraining.includes('"tree_trunk", "tree_crown"') &&
    localDetailTraining.includes('"rock"') &&
    localDetailTraining.includes('"grass"') &&
    localDetailTraining.includes('category_config["outputChannels"] = 4') &&
    objectAlphaConfig.includes('"outputChannels": 4')
)
check(
  "P7-7 Material Pack is the approved visual unit source boundary",
  materialPack.includes("game-map-approved-visual-unit-material-pack-v1") &&
    materialPack.includes("bindGameMapCompositeMaterialsFromPack") &&
    materialPack.includes("approved_visual_unit_material_pack")
)
check(
  "P7-7 Material Pack blocks candidate and training tags",
  materialPack.includes("candidate_only") &&
    materialPack.includes("training_candidate") &&
    materialPack.includes("partial_or_crop_candidate")
)
check(
  "P7-8 Material Pack builder reads reviewed files without drawing",
  materialPackBuilder.includes("buildGameMapApprovedMaterialPackFromFiles") &&
    materialPackBuilder.includes("readFile") &&
    materialPackBuilder.includes("imageSha256") &&
    !materialPackBuilder.includes("create: {")
)
check(
  "P7-8 Material Pack builder has no unverified system gate approval path",
  !materialPackBuilder.includes("visual_quality_unverified_system_gate") &&
    !materialPackBuilder.includes("System gate only verifies structure and file integrity") &&
    materialPackBuilder.includes("visual_quality_reviewed_for_world")
)
check(
  "P7-8 Material Pack builder requires passed quality report for visual review",
  materialPackBuilder.includes("qualityReport") &&
    materialPackBuilder.includes("isPassedMaterialQualityReport") &&
    materialPackBuilder.includes("approved_material_pack_quality_report_missing_or_failed") &&
    materialPackBuilder.includes("game-map-material-quality-report-v1")
)
check(
  "P7-8 Material Pack writer builds from slot files",
  materialPackWriter.includes("collectMaterialFiles") &&
    materialPackWriter.includes("slot.slotId") &&
    materialPackWriter.includes("buildGameMapApprovedMaterialPackFromFiles") &&
    materialPackWriter.includes("material-quality-report.json") &&
    materialPackWriter.includes('reviewer: "visual_judge"') &&
    materialPackWriter.includes("process.exitCode = 1")
)
check(
  "P7-8 Material Generation Request declares per-slot tasks",
  materialRequest.includes("game-map-material-generation-request-v1") &&
    materialRequest.includes("GameMapMaterialGenerationTask") &&
    materialRequest.includes("outputFileName: `${slot.slotId}.png`")
)
check(
  "P7-8 Material Generation Request cannot enter world directly",
  materialRequest.includes("canEnterWorldDirectly: false") &&
    materialRequest.includes("not_approved_material_pack") &&
    materialRequest.includes("must_be_reviewed_before_material_pack")
)
check(
  "P7-8 Material Request writer reads RuntimeFrame composition",
  materialRequestWriter.includes("runtimeFrame.composition") &&
    materialRequestWriter.includes("writeGameMapMaterialGenerationRequest")
)
check(
  "P7-8 Material Input Pack writes condition masks for local model input",
  materialInputPack.includes("game-map-material-input-pack-v1") &&
    materialInputPack.includes("condition_mask_only") &&
    materialInputPack.includes("not_visual_material") &&
    materialInputPack.includes("buildConditionMaskSvg") &&
    materialInputPack.includes("maskGeometry") &&
    materialInputPack.includes("<polygon") &&
    materialInputPack.includes("<rect")
)
check(
  "P7-8 Composite builder keeps main grass terrain as one continuous AI Painter slot",
  compositeBuilder.includes("slotId: `slot-terrain-${region.id}`") &&
    !compositeBuilder.includes("splitTerrainRegionSlots") &&
    !compositeBuilder.includes("bounds.width * bounds.height > 256 * 192")
)
check(
  "P7-8 Grass terrain patches share one reference source to avoid stitched map seams",
  materialSlotLocalInference.includes("terrainPatchReferenceGroup") &&
    materialSlotLocalInference.includes("parseTerrainPatchSlotId") &&
    materialSlotLocalInference.includes("referenceGroup")
)
check(
  "P7-8 Grass terrain patches avoid object-heavy reference samples",
  materialSlotLocalInference.includes("filter_reference_sample_ids") &&
    materialSlotLocalInference.includes("noisy_tokens") &&
    materialSlotLocalInference.includes("score_grass_reference_image") &&
    materialSlotLocalInference.includes("green_ratio") &&
    materialSlotLocalInference.includes("dark_ratio") &&
    materialSlotLocalInference.includes('slot.get("unitKind") != "grass_texture"')
)
check(
  "P7-8 Material Input Pack uses real slot geometry instead of white rectangles",
  materialRequest.includes("maskGeometry: slot.maskGeometry") &&
    compositeSchema.includes("maskGeometry") &&
    compositeBuilder.includes("points: region.polygon") &&
    compositeBuilder.includes("objectMaskGeometry") &&
    compositeBuilder.includes('object.kind === "tree"') &&
    compositeBuilder.includes('object.kind === "rock"')
)
check(
  "P7-8 Material Input Pack writer reads latest material request",
  materialInputPackWriter.includes("latest-material-generation-request.json") &&
    materialInputPackWriter.includes("buildGameMapMaterialInputPack") &&
    materialInputPackWriter.includes("ready_for_local_model_slot_inference")
)
check(
  "P7-8 Material Slot Inference runner requires local model outputs",
  materialSlotInferenceRunner.includes("AI_PAINTER_SLOT_INFERENCE_COMMAND") &&
    materialSlotInferenceRunner.includes("AI_PAINTER_MATERIAL_OUTPUT_DIR") &&
    materialSlotInferenceRunner.includes("expected-material-outputs.json") &&
    materialSlotInferenceRunner.includes("blocked_local_model_slot_inference_command_missing") &&
    materialSlotInferenceRunner.includes("no_program_placeholder")
)
check(
  "P7-8 Material Slot Inference verifies every slot output",
  materialSlotInferenceRunner.includes("verifyMaterialOutputs") &&
    materialSlotInferenceRunner.includes("missingFiles") &&
    materialSlotInferenceRunner.includes("ready_for_approved_material_pack") &&
    !materialSlotInferenceRunner.includes("canvas") &&
    !materialSlotInferenceRunner.includes("program_final_render")
)
check(
  "P7-8 Local material slot inference uses local model checkpoints",
  materialSlotLocalInference.includes("build_tiny_unet") &&
    materialSlotLocalInference.includes("torch.load") &&
    materialSlotLocalInference.includes("natural-home-local-detail-v25-diversity-generalization-training") &&
    materialSlotLocalInference.includes("local_model_generated_material_slots") &&
    materialSlotLocalInference.includes("requires_approved_material_pack")
)
check(
  "P7-8 Local material slot inference maps slots to condition channels",
  materialSlotLocalInference.includes("UNIT_TO_MODEL_CATEGORY") &&
    materialSlotLocalInference.includes("UNIT_TO_ACTIVE_CHANNELS") &&
    materialSlotLocalInference.includes("V1_CONDITION_CHANNELS") &&
    !materialSlotLocalInference.includes("ImageDraw")
)
check(
  "P7-8 Local material slot inference gives large grass structural variation",
  materialSlotLocalInference.includes("apply_slot_condition_variation") &&
    materialSlotLocalInference.includes("condition-variation-v1") &&
    materialSlotLocalInference.includes('slot.get("unitKind") != "grass_texture"')
)
check(
  "P7-8 Local material slot inference follows checkpoint input extras",
  materialSlotLocalInference.includes("checkpoint_config_condition_channels") &&
    materialSlotLocalInference.includes("build_extra_channels") &&
    materialSlotLocalInference.includes("inputExtras") &&
    materialSlotLocalInference.includes("style_channels") &&
    materialSlotLocalInference.includes("material slot condition channel mismatch")
)
check(
  "P7-12 Local material slot inference keeps grass path shoreline model-dominant",
  materialSlotLocalInference.includes("normalize_model_dominant_material_output") &&
    materialSlotLocalInference.includes("model_dominant_material_output") &&
    materialSlotLocalInference.includes('unit_kind in {"grass_texture", "shoreline_texture", "path_texture"}')
)
check(
  "P7-8 Material quality judge records per-slot visual failures",
  materialQualityJudge.includes("game-map-material-quality-report-v1") &&
    materialQualityJudge.includes("material_visual_quality_failed") &&
    materialQualityJudge.includes("composite_visual_quality_must_not_enter_world") &&
    materialQualityJudge.includes("passedCount") &&
    materialQualityJudge.includes("failedCount")
)
check(
  "P7-10 Material quality judge blocks bad object alpha and contaminated terrain textures",
  materialQualityJudge.includes("object_material_alpha_coverage_too_low") &&
    materialQualityJudge.includes("object_material_alpha_coverage_too_high") &&
    materialQualityJudge.includes("grass_forest_canopy_texture_suspected") &&
    materialQualityJudge.includes("grass_material_water_contamination_suspected") &&
    materialQualityJudge.includes("grass_material_path_fragment_suspected") &&
    materialQualityJudge.includes("grass_material_blue_object_fragment_suspected") &&
    materialQualityJudge.includes("path_material_visual_identity_too_weak") &&
    materialQualityJudge.includes("path_green_contamination_suspected") &&
    materialQualityJudge.includes("path_dense_texture_suspected") &&
    materialQualityJudge.includes("isForestLikeGrassTexture") &&
    materialQualityJudge.includes("minObjectAlphaCoverage")
)
check(
  "P7-10 Material quality judge only auto-selects completed material slot inference reports",
  materialQualityJudge.includes("isMaterialSlotInferenceReport") &&
    materialQualityJudge.includes('report?.status === "material_slot_inference_completed"') &&
    materialQualityJudge.includes('report.tags.includes("game_map_material_slot_inference")') &&
    materialQualityJudge.includes('report.tags.includes("completed")')
)
check(
  "P7-11 Material slot repair dataset uses same-source target and masks, not program drawing",
  materialSlotRepairDataset.includes("game-map-material-slot-repair-dataset-v1") &&
    materialSlotRepairDataset.includes("same_source_target_png_and_masks_v1_only") &&
    materialSlotRepairDataset.includes("notProgramDrawing") &&
    materialSlotRepairDataset.includes("notWorldRuntimeFrame") &&
    materialSlotRepairDataset.includes("grass_forest") === false &&
    materialSlotRepairDataset.includes("ImageDraw") === false &&
    materialSlotRepairConfig.includes("training-natural-home-local-details-v44-material-slot-repair") &&
    materialSlotRepairConfig.includes('"notProgramDrawing": true') &&
    packageJson.includes('"prepare:game-map-material-slot-v44-repair"') &&
    packageJson.includes('"train:game-map-material-slot-v44-grass"') &&
    packageJson.includes('"train:game-map-material-slot-v44-road"') &&
    packageJson.includes('"train:game-map-material-slot-v44-rock-object"')
)
check(
  "P7-11 Material slot V44 uses combined checkpoint root for local inference",
  materialSlotRepairAssembler.includes("game-map-material-slot-combined-model-root-v1") &&
    materialSlotRepairAssembler.includes("rock_object") &&
    materialSlotRepairAssembler.includes("copy_existing_local_checkpoints_and_overlay_repaired_categories") &&
    materialSlotRepairAssembler.includes("notProgramDrawing") &&
    packageJson.includes('"assemble:game-map-material-slot-v44-model-root"') &&
    packageJson.includes('"run:game-map-material-slot-inference:v44-local"') &&
    packageJson.includes("natural-home-local-detail-v44-material-slot-repair-combined") &&
    packageJson.includes("--reference-dataset-root .runtime") &&
    packageJson.includes("game-map-material-slot-v44-repair-dataset")
)
check(
  "P7-8 Material quality judge measures real image bytes",
  materialQualityJudge.includes("sharp") &&
    materialQualityJudge.includes("lumaMean") &&
    materialQualityJudge.includes("lumaStd") &&
    materialQualityJudge.includes("edgeDensity") &&
    materialQualityJudge.includes("material_grid_artifact_suspected") &&
    materialQualityJudge.includes("material_dense_texture_suspected") &&
    materialQualityJudge.includes("material_flat_texture_suspected") &&
    materialQualityJudge.includes("material_bright_border_suspected") &&
    materialQualityJudge.includes("denseTextureArtifact") &&
    materialQualityJudge.includes("flatTextureArtifact") &&
    materialQualityJudge.includes("brightBorderArtifact") &&
    materialQualityJudge.includes("measureGridArtifactMetrics") &&
    materialQualityJudge.includes("measureBorderContrastMetrics") &&
    materialQualityJudge.includes("quantizedColorCount") &&
    !materialQualityJudge.includes("canvas") &&
    !materialQualityJudge.includes("program_final_render")
)
check(
  "P7-8 Material quality judge is exposed as an npm command",
  packageJson.includes('"judge:game-map-material-quality"') &&
    packageJson.includes("judge-current-game-map-material-quality.mjs")
)
check(
  "P7-8 Composite Runtime writer consumes approved material pack",
  compositeRuntimeWriter.includes("loadGameMapApprovedVisualUnitMaterialPack") &&
    compositeRuntimeWriter.includes("bindGameMapCompositeMaterialsFromPack") &&
    compositeRuntimeWriter.includes("composeGameMapRuntimeOutput") &&
    compositeRuntimeWriter.includes("finalizeGameMapRuntimeFrameForWorld")
)
check(
  "P7-9 Composite Runtime writer overwrites latest with blocked frame on failed VJ",
  compositeRuntimeWriter.includes("buildBlockedRuntimeFrame") &&
    compositeRuntimeWriter.includes("composite_output_missing") &&
    compositeRuntimeWriter.includes("blockedLatestStatus")
)
check(
  "P7-8 Composite Runtime writer does not program draw",
  !compositeRuntimeWriter.includes("canvas") &&
    !compositeRuntimeWriter.includes("svg") &&
    !compositeRuntimeWriter.includes("program_final_render")
)
check(
  "P7-9 RuntimeFrame finalizer only opens /world after composite judge",
  runtimeFrameFinalizer.includes("finalizeGameMapRuntimeFrameForWorld") &&
    runtimeFrameFinalizer.includes("judgeGameMapCompositeManifestForWorld") &&
    runtimeFrameFinalizer.includes("canShowInWorld: true") &&
    runtimeFrameFinalizer.includes("blocked_composite_judge")
)
check(
  "P7-9 /world displays composite output instead of single visual image",
  worldPage.includes("runtimeFrame.composition.compositeOutput") &&
    worldPage.includes("compositeOutput?.imageUrl") &&
    !worldPage.includes("src={runtimeFrame.visual.imageUrl")
)
check("P5-6 RuntimeFrame store exists", runtimeFrameStore.includes("readLatestGameMapRuntimeFrameRecord"))
check("P6 RuntimeFrame store writer exists", runtimeFrameStore.includes("writeGameMapRuntimeFrameRecord"))
check(
  "P6 RuntimeFrame writer preserves history and latest",
  runtimeFrameStore.includes('"records"') &&
    runtimeFrameStore.includes("latest-runtime-frame.json") &&
    runtimeFrameStore.includes("getGameMapRuntimeFrameRecordPath")
)
check(
  "P6 RuntimeFrame writer validates schema before write",
  runtimeFrameStore.includes("blocked_invalid_runtime_frame") &&
    runtimeFrameStore.includes("isGameMapRuntimeFrame(input.runtimeFrame)")
)
check("P6-2 RuntimeFrame renderer exists", runtimeRenderer.includes("buildGameMapRuntimeRenderModel"))
check(
  "P6-2 RuntimeFrame renderer keeps all game layers",
  runtimeRenderer.includes("runtimeFrame.layers.terrain.map") &&
    runtimeRenderer.includes("runtimeFrame.layers.objects.map") &&
    runtimeRenderer.includes("runtimeFrame.layers.walkable.map") &&
    runtimeRenderer.includes("runtimeFrame.layers.collision.map") &&
    runtimeRenderer.includes("runtimeFrame.layers.interactions.map")
)
check(
  "P6-2 RuntimeFrame renderer is not a single training image",
  runtimeRenderer.includes("not_single_training_image") &&
    runtimeRenderer.includes("rendered_from_runtime_frame_layers")
)
check("P6-3 RuntimeFrame pipeline exists", runtimePipeline.includes("runGameMapRuntimeFramePipeline"))
check(
  "P6-3 RuntimeFrame pipeline validates structure and frame",
  runtimePipeline.includes("validateHomeMapStructure") &&
    runtimePipeline.includes("validateGameMapFrame")
)
check(
  "P6-3 RuntimeFrame pipeline binds approved visual layer",
  runtimePipeline.includes("bindApprovedFrameVisualLayer") &&
    runtimePipeline.includes("blocked_visual_layer_binding")
)
check(
  "P6-3 RuntimeFrame pipeline runs VisualJudge before build",
  runtimePipeline.includes("judgeGameMapFrameForRuntime") &&
    runtimePipeline.includes("blocked_visual_judge")
)
check(
  "P6-3 RuntimeFrame pipeline writes store only after RuntimeFrame build",
  runtimePipeline.includes("buildGameMapRuntimeFrame") &&
    runtimePipeline.includes("writeGameMapRuntimeFrameRecord") &&
    runtimePipeline.includes("runtime_frame_written")
)
check("P7 current world structure builder exists", currentWorldStructure.includes("buildCurrentWorldHomeMapStructure"))
check(
  "P7 current world structure is bound to current world identity",
  currentWorldStructure.includes("worldId: saveRecord.worldId") &&
    currentWorldStructure.includes("ownerId: saveRecord.ownerId") &&
    currentWorldStructure.includes("tick: saveRecord.tick")
)
check(
  "P7 current world structure preserves source facts",
  currentWorldStructure.includes("normalizeSourceFactIds") &&
    currentWorldStructure.includes("sourceFactIds")
)
check(
  "P7 current world structure remains natural home MVP only",
  currentWorldStructure.includes('scope: "natural_home_mvp"') &&
    currentWorldStructure.includes('"character"') &&
    currentWorldStructure.includes('"building_construction"')
)
check(
  "P7 required path corridors cannot overlap water",
  geometry.includes("polygonsOverlap") &&
    validator.includes("buildPolylineCorridorPolygon") &&
    validator.includes('region.kind === "water"') &&
    validator.includes('"path_overlaps_water"')
)
check("P7 ApprovedFrame source adapter exists", approvedFrameSource.includes("toGameMapApprovedFrameInput"))
check(
  "P7 ApprovedFrame adapter preserves gate-critical fields",
  approvedFrameSource.includes("approvalScope: approvedFrame.approvalScope") &&
    approvedFrameSource.includes("approvedForProduction: approvedFrame.approvedForProduction") &&
    approvedFrameSource.includes("vj2Status: approvedFrame.vj2Status") &&
    approvedFrameSource.includes("sourceFactIds: record.sourceFactIds")
)
check(
  "P7 current world RuntimeFrame pipeline exists",
  approvedFrameSource.includes("runCurrentWorldRuntimeFramePipeline") &&
    approvedFrameSource.includes("runGameMapRuntimeFramePipeline")
)
check("P7 current RuntimeFrame writer command exists", currentRuntimeWriter.includes("writeReport"))
check(
  "P7 writer reads current runtime and ApprovedFrame",
  currentRuntimeWriter.includes("readCurrentRuntime") &&
    currentRuntimeWriter.includes("readApprovedFrameRecord")
)
check(
  "P7 writer can produce structured fallback only as internal validation",
  currentRuntimeWriter.includes("blocked_approved_frame_missing") &&
    currentRuntimeWriter.includes("allowStructuredFallback: true") &&
    currentRuntimeWriter.includes("structured_fallback_visual_layer_used")
)
check(
  "P7 writer uses current world pipeline",
  currentRuntimeWriter.includes("runCurrentWorldRuntimeFramePipeline") &&
    currentRuntimeWriter.includes("sourceFactIds")
)
check(
  "Package exposes P7 writer command",
  packageJson.includes('"write:game-map-current-runtime-frame"') &&
    packageJson.includes("scripts/write-current-game-map-runtime-frame.mjs")
)
check(
  "P5-6 RuntimeFrame store validates current world",
  runtimeFrameStore.includes("world_id_mismatch") &&
    runtimeFrameStore.includes("tick_mismatch") &&
    runtimeFrameStore.includes("source_fact_ids_mismatch")
)
check(
  "P5-6 /world reads only GameMapRuntimeFrame",
  worldPage.includes("readLatestGameMapRuntimeFrameRecord") &&
    worldPage.includes("GameMapRuntimeFrame")
)
check(
  "P6-2 /world reads RuntimeFrame but requires composite map gate",
  worldPage.includes("readLatestGameMapRuntimeFrameRecord") &&
    worldPage.includes("WORLD_DISPLAY_REQUIRED_TAG") &&
    worldPage.includes("composite_game_map_runtime_frame")
)
check(
  "P6-4 /world does not treat a single ApprovedFrame image as game map",
  worldPage.includes("ApprovedFrame") &&
    worldPage.includes("WORLD_DISPLAY_REQUIRED_TAG") &&
    worldPage.includes("single_approved_visual_layer")
)
check(
  "P6-4 RuntimeFrame builder blocks /world until composite map exists",
  runtimeFrameBuilder.includes("layers:") &&
    runtimeFrameBuilder.includes("visual:") &&
    runtimeFrameBuilder.includes("canShowInWorld: false") &&
    runtimeFrameBuilder.includes("requires_composite_game_map_runtime_frame")
)
check(
  "P5-6 /world no longer reads old ApprovedFrame directly",
  !worldPage.includes("readLatestWorldVisualApprovedFrameRecord") &&
    !worldPage.includes("buildWorldGameRuntimeFrame") &&
    !worldPage.includes("buildWorldRuntimeFrameGate")
)
check(
  "P5-6 /world blocks training and candidate payloads",
  worldPage.includes("训练图") &&
    worldPage.includes("候选图") &&
    worldPage.includes("局部图") &&
    worldPage.includes("单张模型输出")
)
check(
  "P7-6 /world blocks structured fallback player display",
  worldPage.includes("isWorldDisplayRuntimeFrame") &&
    worldPage.includes("runtimeFrame.composition.compositeOutput") &&
    worldPage.includes("结构化 fallback") &&
    worldPage.includes("structured_fallback_runtime_frame")
)
check(
  "Sample is natural home MVP only",
  sample.includes('scope: "natural_home_mvp"') &&
    sample.includes("fact-natural-home-grass-main") &&
    sample.includes("fact-natural-home-entry-path")
)
check(
  "Sample forbids later-stage facts",
  sample.includes('"character"') &&
    sample.includes('"animal"') &&
    sample.includes('"building_construction"')
)
check("Index exports contract", index.includes('export * from "./game-map-frame-schema"'))
check("Index exports layer generator", index.includes('export * from "./game-map-layer-generator"'))
check("Index exports visual layer binding", index.includes('export * from "./game-map-visual-layer-binding"'))
check("Index exports visual judge", index.includes('export * from "./game-map-visual-judge"'))
check("Index exports composite schema", index.includes('export * from "./game-map-composite-schema"'))
check("Index exports composite builder", index.includes('export * from "./game-map-composite-builder"'))
check("Index exports composite judge", index.includes('export * from "./game-map-composite-judge"'))
check("Index exports formal visual judge", index.includes('export * from "./game-map-formal-visual-judge"'))
check("Index exports composite material binding", index.includes('export * from "./game-map-composite-material-binding"'))
check("Index exports approved material pack", index.includes('export * from "./game-map-approved-visual-unit-material-pack"'))
check("Index exports approved material pack builder", index.includes('export * from "./game-map-approved-visual-unit-material-pack-builder"'))
check("Index exports material generation request", index.includes('export * from "./game-map-material-generation-request"'))
check("Index exports material input pack", index.includes('export * from "./game-map-material-input-pack"'))
check("Index exports runtime compositor", index.includes('export * from "./game-map-runtime-compositor"'))
check("Index exports runtime frame", index.includes('export * from "./game-map-runtime-frame-schema"'))
check("Index exports runtime frame finalizer", index.includes('export * from "./game-map-runtime-frame-finalizer"'))
check("Index exports runtime frame store", index.includes('export * from "./game-map-runtime-frame-store"'))
check("Index exports runtime renderer", index.includes('export * from "./game-map-runtime-renderer"'))
check("Index exports runtime pipeline", index.includes('export * from "./game-map-runtime-frame-pipeline"'))
check("Index exports current world structure builder", index.includes('export * from "./game-map-current-world-structure-builder"'))
check("Index exports ApprovedFrame source adapter", index.includes('export * from "./game-map-approved-frame-source"'))
check(
  "package exposes composite runtime writer",
  packageJson.includes('"write:game-map-material-generation-request"') &&
  packageJson.includes('"write:game-map-material-input-pack"') &&
  packageJson.includes('"run:game-map-material-slot-inference"') &&
  packageJson.includes('"run:game-map-material-slot-inference:local"') &&
  packageJson.includes('"build:game-map-approved-material-pack"') &&
  packageJson.includes('"write:game-map-composite-runtime-frame"') &&
    packageJson.includes("write-current-game-map-material-generation-request.mjs") &&
    packageJson.includes("write-current-game-map-material-input-pack.mjs") &&
    packageJson.includes("run-current-game-map-material-slot-inference.mjs") &&
    packageJson.includes("infer_game_map_material_slots.py") &&
    packageJson.includes("build-current-game-map-approved-material-pack.mjs") &&
    packageJson.includes("write-current-game-map-composite-runtime-frame.mjs")
)
check(
  "Runtime renderer marks MVP frontend readiness",
  runtimeRenderer.includes("mvp_game_frontend_render_ready") &&
    runtimeRenderer.includes("world_page_runtime_layers_only")
)
check(
  "Current execution guide is the single module plan",
  currentExecutionGuide.includes("# AI-PET-WORLD 唯一模块计划表") &&
    currentExecutionGuide.includes("本文档是项目唯一计划表")
)
check(
  "Single module plan excludes run-level evidence",
  !currentExecutionGuide.includes("runId=") &&
    !currentExecutionGuide.includes("SHA-256=") &&
    !currentExecutionGuide.includes("当前唯一下一步")
)
check("Complete-world command remains owned by package scripts", packageJson.includes('"run:complete-game-world"'))
check(
  "World image route rehashes served bytes",
  worldImageRoute.includes('createHash("sha256")') &&
    worldImageRoute.includes("blocked_world_runtime_image_content_sha_mismatch") &&
    worldImageRoute.includes("observedSha256 !== compositeOutput.imageSha256")
)
check(
  "World image route enforces physical runtime path",
  worldImageRoute.includes("assertRuntimePath") &&
    worldImageRoute.includes("blocked_world_runtime_image_outside_workspace")
)
check(
  "World image route derives Content-Type from imageFormat",
  worldImageRoute.includes('format === "webp"') &&
    worldImageRoute.includes('format === "jpg"') &&
    worldImageRoute.includes("image/jpeg")
)
check(
  "Legacy image route rehashes served bytes",
  legacyImageRoute.includes('createHash("sha256")') &&
    legacyImageRoute.includes("game_map_runtime_image_content_sha_mismatch") &&
    legacyImageRoute.includes("x-world-runtime-image-sha256")
)

let failed = 0
for (const item of checks) {
  if (item.condition) {
    console.log(`OK ${item.label}`)
  } else {
    failed += 1
    console.error(`FAIL ${item.label}`)
  }
}

if (failed > 0) {
  console.error(`GameMapFrame contract check failed: ${failed} failure(s).`)
  process.exit(1)
}

console.log(`GameMapFrame contract check passed: ${checks.length} assertions.`)

