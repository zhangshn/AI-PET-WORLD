import type { HomeMapPoint } from "./home-map-structure-schema"
import type { GameMapBounds } from "./game-map-geometry"

export type GameMapCompositeManifestVersion = "game-map-composite-manifest-v1"

export type GameMapCompositeChunkLayer =
  | "terrain"
  | "object"
  | "walkable"
  | "collision"
  | "interaction"

export type GameMapCompositeChunkKind =
  | "terrain_region"
  | "path_region"
  | "object_unit"
  | "walkable_region"
  | "collision_region"
  | "interaction_region"

export type GameMapVisualUnitKind =
  | "grass_texture"
  | "water_texture"
  | "shoreline_texture"
  | "path_texture"
  | "boundary_texture"
  | "tree_visual_unit"
  | "rock_visual_unit"
  | "shrub_visual_unit"
  | "flower_visual_unit"
  | "grass_detail_visual_unit"

export type GameMapPainterInputKind =
  | "condition_mask_region"
  | "condition_mask_object"
  | "condition_mask_path"

export type GameMapCompositeMaterialSource =
  | "ai_painter_region_texture"
  | "ai_painter_object_visual_unit"

export type GameMapCompositeMaterialBinding = {
  bindingId: string
  slotId: string
  source: GameMapCompositeMaterialSource
  approvedAssetId: string
  imageUrl: string
  imageSha256: string
  imageWidth: number
  imageHeight: number
  imageFormat: "png" | "webp" | "jpg"
  sourceFactIds: string[]
  tags: string[]
}

export type GameMapCompositeOutput = {
  source: "runtime_compositor_from_ai_visual_units"
  imageUrl: string
  imageSha256: string
  imageWidth: number
  imageHeight: number
  imageFormat: "png" | "webp" | "jpg"
  sourceFactIds: string[]
  tags: string[]
}

export type GameMapCompositeTileChunk = {
  chunkId: string
  layer: GameMapCompositeChunkLayer
  kind: GameMapCompositeChunkKind
  sourceId: string
  sourceFactIds: string[]
  bounds: GameMapBounds
  zIndex: number
  canRepeat: boolean
  requiresAiPainterMaterial: boolean
}

export type GameMapVisualUnitSlot = {
  slotId: string
  unitKind: GameMapVisualUnitKind
  sourceId: string
  sourceFactIds: string[]
  bounds: GameMapBounds
  maskGeometry:
    | {
        kind: "polygon"
        points: HomeMapPoint[]
      }
    | {
        kind: "rect"
        rect: GameMapBounds
      }
  zIndex: number
  painterContract: {
    inputKind: GameMapPainterInputKind
    mustPreserveFacts: string[]
    forbiddenPayloads: string[]
  }
}

export type GameMapCompositeManifest = {
  schemaVersion: GameMapCompositeManifestVersion
  manifestId: string
  gameMapFrameId: string
  structureId: string
  worldId: string
  ownerId: string
  tick: number
  sourceFactIds: string[]
  tileChunks: GameMapCompositeTileChunk[]
  visualUnitSlots: GameMapVisualUnitSlot[]
  visualMaterialBindings: GameMapCompositeMaterialBinding[]
  compositeOutput: GameMapCompositeOutput | null
  compositionStatus: {
    mode: "chunked_runtime_map"
    canEnterWorld: boolean
    blockedReasons: string[]
  }
  tags: string[]
}

export type GameMapCompositeManifestValidationResult = {
  passed: boolean
  issues: string[]
}

export function validateGameMapCompositeManifest(
  manifest: GameMapCompositeManifest
): GameMapCompositeManifestValidationResult {
  const issues: string[] = []

  if (manifest.schemaVersion !== "game-map-composite-manifest-v1") {
    issues.push("schema_version_invalid")
  }
  if (!isNonEmptyString(manifest.manifestId)) issues.push("manifest_id_missing")
  if (!isNonEmptyString(manifest.gameMapFrameId)) issues.push("game_map_frame_id_missing")
  if (!isNonEmptyString(manifest.structureId)) issues.push("structure_id_missing")
  if (!isNonEmptyString(manifest.worldId)) issues.push("world_id_missing")
  if (!isNonEmptyString(manifest.ownerId)) issues.push("owner_id_missing")
  if (!Number.isInteger(manifest.tick)) issues.push("tick_invalid")
  if (!isNonEmptyStringArray(manifest.sourceFactIds)) {
    issues.push("source_fact_ids_missing")
  }
  if (!Array.isArray(manifest.tileChunks) || manifest.tileChunks.length === 0) {
    issues.push("tile_chunks_missing")
  }
  if (!Array.isArray(manifest.visualUnitSlots) || manifest.visualUnitSlots.length === 0) {
    issues.push("visual_unit_slots_missing")
  }
  if (!Array.isArray(manifest.visualMaterialBindings)) {
    issues.push("visual_material_bindings_missing")
  }
  if (
    manifest.compositeOutput !== null &&
    !isValidCompositeOutput(manifest.compositeOutput, manifest.sourceFactIds)
  ) {
    issues.push("composite_output_invalid")
  }
  if (manifest.compositionStatus.mode !== "chunked_runtime_map") {
    issues.push("composition_mode_invalid")
  }
  if (
    !manifest.compositionStatus.canEnterWorld &&
    !manifest.compositionStatus.blockedReasons.includes(
      "visual_unit_materials_not_fully_bound"
    ) &&
    !manifest.compositionStatus.blockedReasons.includes("composite_output_missing")
  ) {
    issues.push("composition_block_reason_missing")
  }
  if (!manifest.tags.includes("p7_7_composite_map_manifest")) {
    issues.push("p7_7_tag_missing")
  }
  if (!manifest.tags.includes("not_program_final_render")) {
    issues.push("program_render_block_tag_missing")
  }

  for (const chunk of manifest.tileChunks) {
    validateTileChunk(chunk, manifest.sourceFactIds, issues)
  }

  for (const slot of manifest.visualUnitSlots) {
    validateVisualUnitSlot(slot, manifest.sourceFactIds, issues)
  }

  for (const binding of manifest.visualMaterialBindings) {
    validateMaterialBinding(binding, manifest.visualUnitSlots, manifest.sourceFactIds, issues)
  }

  if (manifest.compositionStatus.canEnterWorld) {
    validateWorldReadyManifest(manifest, issues)
  }

  return {
    passed: issues.length === 0,
    issues,
  }
}

export function isGameMapCompositeManifest(
  value: unknown
): value is GameMapCompositeManifest {
  if (!isRecord(value)) return false

  const manifest = value as GameMapCompositeManifest
  return validateGameMapCompositeManifest(manifest).passed
}

function validateTileChunk(
  chunk: GameMapCompositeTileChunk,
  frameSourceFactIds: string[],
  issues: string[]
): void {
  if (!isNonEmptyString(chunk.chunkId)) issues.push("chunk_id_missing")
  if (!isNonEmptyString(chunk.sourceId)) issues.push("chunk_source_id_missing")
  if (!isNonEmptyStringArray(chunk.sourceFactIds)) issues.push("chunk_source_facts_missing")
  if (!isValidBounds(chunk.bounds)) issues.push("chunk_bounds_invalid")
  if (!Number.isInteger(chunk.zIndex)) issues.push("chunk_z_index_invalid")
  if (!chunk.sourceFactIds.every((factId) => frameSourceFactIds.includes(factId))) {
    issues.push("chunk_source_facts_not_bound_to_frame")
  }
}

function validateVisualUnitSlot(
  slot: GameMapVisualUnitSlot,
  frameSourceFactIds: string[],
  issues: string[]
): void {
  if (!isNonEmptyString(slot.slotId)) issues.push("slot_id_missing")
  if (!isNonEmptyString(slot.sourceId)) issues.push("slot_source_id_missing")
  if (!isNonEmptyStringArray(slot.sourceFactIds)) issues.push("slot_source_facts_missing")
  if (!isValidBounds(slot.bounds)) issues.push("slot_bounds_invalid")
  if (!isValidMaskGeometry(slot.maskGeometry)) issues.push("slot_mask_geometry_invalid")
  if (!Number.isInteger(slot.zIndex)) issues.push("slot_z_index_invalid")
  if (!isRecord(slot.painterContract)) issues.push("slot_painter_contract_missing")
  if (!slot.sourceFactIds.every((factId) => frameSourceFactIds.includes(factId))) {
    issues.push("slot_source_facts_not_bound_to_frame")
  }
  if (!slot.painterContract.forbiddenPayloads.includes("new_world_fact")) {
    issues.push("slot_forbids_new_world_fact_missing")
  }
  if (!slot.painterContract.forbiddenPayloads.includes("program_final_render")) {
    issues.push("slot_forbids_program_final_render_missing")
  }
}

function isValidMaskGeometry(
  value: GameMapVisualUnitSlot["maskGeometry"] | unknown
): value is GameMapVisualUnitSlot["maskGeometry"] {
  if (!isRecord(value)) return false
  if (value.kind === "polygon") {
    return Array.isArray(value.points) && value.points.length >= 3 && value.points.every(isPoint)
  }
  if (value.kind === "rect") {
    return isValidBounds(value.rect)
  }
  return false
}

function validateMaterialBinding(
  binding: GameMapCompositeMaterialBinding,
  slots: GameMapVisualUnitSlot[],
  frameSourceFactIds: string[],
  issues: string[]
): void {
  if (!isNonEmptyString(binding.bindingId)) issues.push("binding_id_missing")
  if (!isNonEmptyString(binding.slotId)) issues.push("binding_slot_id_missing")
  if (!slots.some((slot) => slot.slotId === binding.slotId)) {
    issues.push("binding_slot_not_found")
  }
  if (
    binding.source !== "ai_painter_region_texture" &&
    binding.source !== "ai_painter_object_visual_unit"
  ) {
    issues.push("binding_source_invalid")
  }
  if (!isNonEmptyString(binding.approvedAssetId)) issues.push("binding_asset_id_missing")
  if (!isNonEmptyString(binding.imageUrl)) issues.push("binding_image_url_missing")
  if (!isNonEmptyString(binding.imageSha256) || binding.imageSha256.length !== 64) {
    issues.push("binding_sha_invalid")
  }
  if (!Number.isInteger(binding.imageWidth) || binding.imageWidth <= 0) {
    issues.push("binding_width_invalid")
  }
  if (!Number.isInteger(binding.imageHeight) || binding.imageHeight <= 0) {
    issues.push("binding_height_invalid")
  }
  if (
    binding.imageFormat !== "png" &&
    binding.imageFormat !== "webp" &&
    binding.imageFormat !== "jpg"
  ) {
    issues.push("binding_image_format_invalid")
  }
  if (!isNonEmptyStringArray(binding.sourceFactIds)) {
    issues.push("binding_source_facts_missing")
  } else if (!binding.sourceFactIds.every((factId) => frameSourceFactIds.includes(factId))) {
    issues.push("binding_source_facts_not_bound_to_frame")
  }
  if (!Array.isArray(binding.tags)) issues.push("binding_tags_missing")
  if (
    Array.isArray(binding.tags) &&
    (binding.tags.includes("training_candidate") ||
      binding.tags.includes("candidate_only") ||
      binding.tags.includes("partial_or_crop_candidate") ||
      binding.tags.includes("single_model_output_only"))
  ) {
    issues.push("binding_has_training_or_candidate_tags")
  }
}

function validateWorldReadyManifest(
  manifest: GameMapCompositeManifest,
  issues: string[]
): void {
  if (!manifest.tags.includes("composite_game_map_runtime_frame")) {
    issues.push("world_ready_composite_tag_missing")
  }
  if (manifest.tags.includes("not_world_page_runtime")) {
    issues.push("world_ready_must_not_keep_not_world_page_runtime_tag")
  }
  if (manifest.compositeOutput === null) {
    issues.push("world_ready_composite_output_missing")
  } else if (!manifest.compositeOutput.tags.includes("runtime_compositor_from_ai_visual_units")) {
    issues.push("world_ready_composite_output_tag_missing")
  }

  const boundSlotIds = new Set(
    manifest.visualMaterialBindings.map((binding) => binding.slotId)
  )
  const missingSlotIds = manifest.visualUnitSlots
    .map((slot) => slot.slotId)
    .filter((slotId) => !boundSlotIds.has(slotId))

  if (missingSlotIds.length > 0) {
    issues.push("world_ready_visual_material_slots_missing")
  }
}

function isValidCompositeOutput(
  output: GameMapCompositeOutput,
  frameSourceFactIds: string[]
): boolean {
  return (
    output.source === "runtime_compositor_from_ai_visual_units" &&
    isNonEmptyString(output.imageUrl) &&
    isNonEmptyString(output.imageSha256) &&
    output.imageSha256.length === 64 &&
    Number.isInteger(output.imageWidth) &&
    output.imageWidth > 0 &&
    Number.isInteger(output.imageHeight) &&
    output.imageHeight > 0 &&
    (output.imageFormat === "png" ||
      output.imageFormat === "webp" ||
      output.imageFormat === "jpg") &&
    isNonEmptyStringArray(output.sourceFactIds) &&
    output.sourceFactIds.every((factId) => frameSourceFactIds.includes(factId)) &&
    Array.isArray(output.tags) &&
    !output.tags.includes("training_candidate") &&
    !output.tags.includes("candidate_only") &&
    !output.tags.includes("partial_or_crop_candidate") &&
    !output.tags.includes("single_model_output_only")
  )
}

function isValidBounds(value: unknown): value is GameMapBounds {
  const bounds = value as Record<string, unknown>
  return (
    isRecord(value) &&
    typeof bounds.x === "number" &&
    typeof bounds.y === "number" &&
    typeof bounds.width === "number" &&
    typeof bounds.height === "number" &&
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0
  )
}

function isPoint(value: unknown): value is HomeMapPoint {
  const point = value as Record<string, unknown>
  return (
    isRecord(value) &&
    typeof point.x === "number" &&
    typeof point.y === "number" &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString)
}
