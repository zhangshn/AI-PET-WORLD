import type {
  GameMapCompositeManifest,
  GameMapCompositeMaterialBinding,
  GameMapCompositeMaterialSource,
  GameMapCompositeOutput,
  GameMapVisualUnitSlot,
} from "./game-map-composite-schema"
import { validateGameMapCompositeManifest } from "./game-map-composite-schema"

export type GameMapApprovedVisualUnitMaterialInput = {
  approvedAssetId: string
  slotId: string
  source: GameMapCompositeMaterialSource
  imageUrl: string
  imageSha256: string
  imageWidth: number
  imageHeight: number
  imageFormat: "png" | "webp" | "jpg"
  sourceFactIds: string[]
  tags: string[]
}

export type BindGameMapCompositeMaterialsStatus =
  | "materials_bound"
  | "blocked_missing_slots"
  | "blocked_extra_slots"
  | "blocked_invalid_materials"
  | "blocked_source_facts_mismatch"
  | "blocked_training_or_candidate_material"

export type BindGameMapCompositeMaterialsResult = {
  status: BindGameMapCompositeMaterialsStatus
  passed: boolean
  manifest: GameMapCompositeManifest | null
  blockedReasons: string[]
  tags: string[]
}

export type BindGameMapCompositeOutputStatus =
  | "composite_output_bound"
  | "blocked_materials_incomplete"
  | "blocked_output_invalid"
  | "blocked_source_facts_mismatch"
  | "blocked_training_or_candidate_output"
  | "blocked_manifest_invalid"

export type BindGameMapCompositeOutputResult = {
  status: BindGameMapCompositeOutputStatus
  passed: boolean
  manifest: GameMapCompositeManifest | null
  blockedReasons: string[]
  tags: string[]
}

const BLOCKED_TRAINING_OR_CANDIDATE_TAGS = [
  "training_candidate",
  "candidate_only",
  "partial_or_crop_candidate",
  "single_model_output_only",
  "single_direct_output",
  "local_asset_preview",
  "composite_quality_failed_candidate_only",
  "composite_grid_artifact_suspected",
  "composite_visible_grid_artifact_suspected",
  "composite_patch_band_artifact_suspected",
  "composite_repetitive_texture_suspected",
  "composite_dense_texture_suspected",
]

export function bindGameMapCompositeMaterials(input: {
  manifest: GameMapCompositeManifest
  materials: GameMapApprovedVisualUnitMaterialInput[]
}): BindGameMapCompositeMaterialsResult {
  const { manifest, materials } = input
  const slotsById = new Map(manifest.visualUnitSlots.map((slot) => [slot.slotId, slot]))
  const materialsBySlotId = new Map(materials.map((material) => [material.slotId, material]))
  const missingSlots = manifest.visualUnitSlots.filter(
    (slot) => !materialsBySlotId.has(slot.slotId)
  )
  const extraMaterials = materials.filter((material) => !slotsById.has(material.slotId))

  if (missingSlots.length > 0) {
    return blocked("blocked_missing_slots", missingSlots.map((slot) => slot.slotId))
  }
  if (extraMaterials.length > 0) {
    return blocked("blocked_extra_slots", extraMaterials.map((material) => material.slotId))
  }

  const bindings: GameMapCompositeMaterialBinding[] = []
  const invalidReasons: string[] = []

  for (const slot of manifest.visualUnitSlots) {
    const material = materialsBySlotId.get(slot.slotId)
    if (!material) continue

    const validationIssue = validateMaterialInput(material, slot, manifest.sourceFactIds)
    if (validationIssue !== null) {
      invalidReasons.push(`${slot.slotId}:${validationIssue}`)
      continue
    }

    bindings.push({
      bindingId: `binding-${slot.slotId}`,
      slotId: slot.slotId,
      source: material.source,
      approvedAssetId: material.approvedAssetId,
      imageUrl: material.imageUrl,
      imageSha256: material.imageSha256,
      imageWidth: material.imageWidth,
      imageHeight: material.imageHeight,
      imageFormat: material.imageFormat,
      sourceFactIds: [...material.sourceFactIds],
      tags: [...material.tags, "approved_ai_painter_visual_unit_material"],
    })
  }

  if (invalidReasons.some((reason) => reason.includes("training_or_candidate_tag"))) {
    return blocked("blocked_training_or_candidate_material", invalidReasons)
  }
  if (invalidReasons.some((reason) => reason.includes("source_fact"))) {
    return blocked("blocked_source_facts_mismatch", invalidReasons)
  }
  if (invalidReasons.length > 0) {
    return blocked("blocked_invalid_materials", invalidReasons)
  }

  const nextManifest: GameMapCompositeManifest = {
    ...manifest,
    visualMaterialBindings: bindings,
    compositionStatus: {
      mode: "chunked_runtime_map",
      canEnterWorld: false,
      blockedReasons: [
        "composite_output_missing",
        "runtime_compositor_not_approved",
        "visual_judge_composite_gate_not_complete",
      ],
    },
    tags: uniqueTags([
      ...manifest.tags,
      "visual_material_bindings_complete",
      "requires_runtime_composite_output",
    ]),
  }
  const validation = validateGameMapCompositeManifest(nextManifest)

  if (!validation.passed) {
    return blocked("blocked_invalid_materials", validation.issues)
  }

  return {
    status: "materials_bound",
    passed: true,
    manifest: nextManifest,
    blockedReasons: [],
    tags: ["visual_material_bindings_complete", "world_page_still_blocked"],
  }
}

export function bindGameMapCompositeOutput(input: {
  manifest: GameMapCompositeManifest
  output: GameMapCompositeOutput
}): BindGameMapCompositeOutputResult {
  const { manifest, output } = input

  if (!allSlotsHaveMaterialBindings(manifest)) {
    return outputBlocked("blocked_materials_incomplete", [
      "visual_unit_materials_not_fully_bound",
    ])
  }
  if (containsAny(output.tags, BLOCKED_TRAINING_OR_CANDIDATE_TAGS)) {
    return outputBlocked("blocked_training_or_candidate_output", output.tags)
  }
  if (!sameStringSet(output.sourceFactIds, manifest.sourceFactIds)) {
    return outputBlocked("blocked_source_facts_mismatch", output.sourceFactIds)
  }
  if (!isValidCompositeOutputShape(output)) {
    return outputBlocked("blocked_output_invalid", ["composite_output_invalid"])
  }

  const nextManifest: GameMapCompositeManifest = {
    ...manifest,
    compositeOutput: {
      ...output,
      tags: uniqueTags([
        ...output.tags,
        "runtime_compositor_from_ai_visual_units",
        "complete_game_map_composite_output",
      ]),
    },
    compositionStatus: {
      mode: "chunked_runtime_map",
      canEnterWorld: true,
      blockedReasons: [],
    },
    tags: uniqueTags([
      ...manifest.tags.filter((tag) => tag !== "not_world_page_runtime"),
      "composite_game_map_runtime_frame",
      "composite_runtime_image_bound",
      "world_ready_composite_manifest",
    ]),
  }
  const validation = validateGameMapCompositeManifest(nextManifest)

  if (!validation.passed) {
    return outputBlocked("blocked_manifest_invalid", validation.issues)
  }

  return {
    status: "composite_output_bound",
    passed: true,
    manifest: nextManifest,
    blockedReasons: [],
    tags: [
      "composite_runtime_image_bound",
      "composite_game_map_runtime_frame",
      "world_ready_composite_manifest",
    ],
  }
}

function validateMaterialInput(
  material: GameMapApprovedVisualUnitMaterialInput,
  slot: GameMapVisualUnitSlot,
  frameSourceFactIds: string[]
): string | null {
  if (!isNonEmptyString(material.approvedAssetId)) return "asset_id_missing"
  if (material.source !== expectedMaterialSource(slot)) return "source_mismatch"
  if (!isNonEmptyString(material.imageUrl)) return "image_url_missing"
  if (!isNonEmptyString(material.imageSha256) || material.imageSha256.length !== 64) {
    return "sha_invalid"
  }
  if (!Number.isInteger(material.imageWidth) || material.imageWidth <= 0) {
    return "width_invalid"
  }
  if (!Number.isInteger(material.imageHeight) || material.imageHeight <= 0) {
    return "height_invalid"
  }
  if (
    material.imageFormat !== "png" &&
    material.imageFormat !== "webp" &&
    material.imageFormat !== "jpg"
  ) {
    return "image_format_invalid"
  }
  if (!sameStringSet(material.sourceFactIds, slot.sourceFactIds)) {
    return "slot_source_fact_mismatch"
  }
  if (!material.sourceFactIds.every((factId) => frameSourceFactIds.includes(factId))) {
    return "frame_source_fact_mismatch"
  }
  if (containsAny(material.tags, BLOCKED_TRAINING_OR_CANDIDATE_TAGS)) {
    return "training_or_candidate_tag_present"
  }
  return null
}

function expectedMaterialSource(slot: GameMapVisualUnitSlot): GameMapCompositeMaterialSource {
  return slot.painterContract.inputKind === "condition_mask_object"
    ? "ai_painter_object_visual_unit"
    : "ai_painter_region_texture"
}

function allSlotsHaveMaterialBindings(manifest: GameMapCompositeManifest): boolean {
  const boundSlotIds = new Set(manifest.visualMaterialBindings.map((binding) => binding.slotId))
  return manifest.visualUnitSlots.every((slot) => boundSlotIds.has(slot.slotId))
}

function isValidCompositeOutputShape(output: GameMapCompositeOutput): boolean {
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
      output.imageFormat === "jpg")
  )
}

function blocked(
  status: Exclude<BindGameMapCompositeMaterialsStatus, "materials_bound">,
  reasons: string[]
): BindGameMapCompositeMaterialsResult {
  return {
    status,
    passed: false,
    manifest: null,
    blockedReasons: reasons,
    tags: ["game_map_composite_material_binding_blocked"],
  }
}

function outputBlocked(
  status: Exclude<BindGameMapCompositeOutputStatus, "composite_output_bound">,
  reasons: string[]
): BindGameMapCompositeOutputResult {
  return {
    status,
    passed: false,
    manifest: null,
    blockedReasons: reasons,
    tags: ["game_map_composite_output_blocked"],
  }
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

function containsAny(values: string[], blocked: string[]): boolean {
  const valueSet = new Set(values)
  return blocked.some((value) => valueSet.has(value))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}
