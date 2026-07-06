import type {
  GameMapCompositeManifest,
  GameMapCompositeTileChunk,
  GameMapVisualUnitSlot,
} from "./game-map-composite-schema"
import { validateGameMapCompositeManifest } from "./game-map-composite-schema"

export type GameMapCompositeJudgeStatus =
  | "game_map_composite_vj_passed"
  | "game_map_composite_vj_failed"

export type GameMapCompositeJudgeIssue = {
  code: string
  severity: "error" | "warning"
  message: string
}

export type GameMapCompositeJudgeReport = {
  status: GameMapCompositeJudgeStatus
  passed: boolean
  canEnterWorld: boolean
  manifestId: string
  worldId: string
  tick: number
  summary: {
    errorCount: number
    warningCount: number
    tileChunkCount: number
    visualUnitSlotCount: number
    materialBindingCount: number
    hasCompositeOutput: boolean
  }
  issues: GameMapCompositeJudgeIssue[]
  tags: string[]
}

const BLOCKED_TAGS = [
  "single_approved_visual_layer",
  "structured_fallback_runtime_frame",
  "training_candidate",
  "partial_or_crop_candidate",
  "candidate_only",
  "single_model_output_only",
  "single_direct_output",
  "local_asset_preview",
  "visual_quality_unverified_system_gate",
  "composite_quality_failed_candidate_only",
  "composite_grid_artifact_suspected",
  "composite_visible_grid_artifact_suspected",
  "composite_patch_band_artifact_suspected",
  "composite_repetitive_texture_suspected",
  "composite_dense_texture_suspected",
  "composite_object_material_alpha_missing",
]

export function judgeGameMapCompositeManifestForWorld(
  manifest: GameMapCompositeManifest
): GameMapCompositeJudgeReport {
  const issues: GameMapCompositeJudgeIssue[] = []
  const validation = validateGameMapCompositeManifest(manifest)

  for (const issue of validation.issues) {
    issues.push(error(`manifest_${issue}`, `Composite manifest validation failed: ${issue}.`))
  }

  requireChunkKind(manifest.tileChunks, "terrain_region", issues)
  requireChunkKind(manifest.tileChunks, "path_region", issues)
  requireChunkKind(manifest.tileChunks, "object_unit", issues)
  requireChunkKind(manifest.tileChunks, "walkable_region", issues)
  requireChunkKind(manifest.tileChunks, "collision_region", issues)
  requireChunkKind(manifest.tileChunks, "interaction_region", issues)

  requireVisualUnitKind(manifest.visualUnitSlots, "grass_texture", issues)
  requireVisualUnitKind(manifest.visualUnitSlots, "path_texture", issues)

  if (containsAny(manifest.tags, BLOCKED_TAGS)) {
    issues.push(
      error(
        "blocked_tags_present",
        "Composite world frame cannot contain single-image, training, candidate, or fallback tags."
      )
    )
  }

  const boundSlotIds = new Set(
    manifest.visualMaterialBindings.map((binding) => binding.slotId)
  )
  const missingMaterialSlots = manifest.visualUnitSlots.filter(
    (slot) => !boundSlotIds.has(slot.slotId)
  )
  if (missingMaterialSlots.length > 0) {
    issues.push(
      error(
        "visual_material_bindings_incomplete",
        "Every visual unit slot must bind an approved AI Painter material before /world display."
      )
    )
  }
  if (manifest.compositeOutput === null) {
    issues.push(
      error(
        "composite_output_missing",
        "Complete /world map requires a runtime compositor output made from AI visual units."
      )
    )
  } else {
    if (manifest.compositeOutput.source !== "runtime_compositor_from_ai_visual_units") {
      issues.push(error("composite_output_source_invalid", "Composite output source is invalid."))
    }
    if (!manifest.compositeOutput.tags.includes("runtime_compositor_from_ai_visual_units")) {
      issues.push(
        error(
          "composite_output_source_tag_missing",
          "Composite output must declare runtime_compositor_from_ai_visual_units."
        )
      )
    }
    if (containsAny(manifest.compositeOutput.tags, BLOCKED_TAGS)) {
      issues.push(
        error(
          "composite_output_has_blocked_tags",
          "Composite output cannot be a training, candidate, local preview, or single model output."
        )
      )
    }
    if (!manifest.compositeOutput.tags.includes("formal_game_map_visual_judge_passed")) {
      issues.push(
        error(
          "formal_game_map_visual_judge_missing",
          "Complete /world map requires formal full-frame VisualJudge approval after runtime composition."
        )
      )
    }
  }

  const unverifiedMaterialBindings = manifest.visualMaterialBindings.filter((binding) =>
    containsAny(binding.tags, BLOCKED_TAGS)
  )
  if (unverifiedMaterialBindings.length > 0) {
    issues.push(
      error(
        "visual_material_quality_unverified",
        "Complete /world map requires visual-quality-reviewed materials; system-gate-only materials cannot enter /world."
      )
    )
  }

  if (!manifest.compositionStatus.canEnterWorld) {
    issues.push(
      error(
        "composition_status_blocks_world",
        "Composite manifest is still marked as blocked from /world."
      )
    )
  }
  if (!manifest.tags.includes("composite_game_map_runtime_frame")) {
    issues.push(
      error(
        "composite_runtime_frame_tag_missing",
        "Complete game map must carry composite_game_map_runtime_frame."
      )
    )
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length
  const warningCount = issues.filter((issue) => issue.severity === "warning").length
  const passed = errorCount === 0

  return {
    status: passed ? "game_map_composite_vj_passed" : "game_map_composite_vj_failed",
    passed,
    canEnterWorld: passed,
    manifestId: manifest.manifestId,
    worldId: manifest.worldId,
    tick: manifest.tick,
    summary: {
      errorCount,
      warningCount,
      tileChunkCount: manifest.tileChunks.length,
      visualUnitSlotCount: manifest.visualUnitSlots.length,
      materialBindingCount: manifest.visualMaterialBindings.length,
      hasCompositeOutput: manifest.compositeOutput !== null,
    },
    issues,
    tags: passed
      ? [
          "game_map_composite_visual_judge_passed",
          "composite_game_map_runtime_frame",
          "world_page_ready_candidate",
        ]
      : [
          "game_map_composite_visual_judge_failed",
          "world_page_blocked_until_composite_map",
        ],
  }
}

function requireChunkKind(
  chunks: GameMapCompositeTileChunk[],
  kind: GameMapCompositeTileChunk["kind"],
  issues: GameMapCompositeJudgeIssue[]
): void {
  if (!chunks.some((chunk) => chunk.kind === kind)) {
    issues.push(error(`chunk_${kind}_missing`, `Composite map is missing ${kind}.`))
  }
}

function requireVisualUnitKind(
  slots: GameMapVisualUnitSlot[],
  kind: GameMapVisualUnitSlot["unitKind"],
  issues: GameMapCompositeJudgeIssue[]
): void {
  if (!slots.some((slot) => slot.unitKind === kind)) {
    issues.push(error(`slot_${kind}_missing`, `Composite map is missing ${kind}.`))
  }
}

function error(code: string, message: string): GameMapCompositeJudgeIssue {
  return {
    code,
    severity: "error",
    message,
  }
}

function containsAny(values: string[], blocked: string[]): boolean {
  const valueSet = new Set(values)
  return blocked.some((value) => valueSet.has(value))
}
