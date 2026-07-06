import type { GameMapFrame } from "./game-map-frame-schema"
import { validateGameMapFrame, validateHomeMapStructure } from "./game-map-frame-validator"
import type { HomeMapStructure } from "./home-map-structure-schema"
import { collectHomeMapStructureSourceFactIds } from "./home-map-structure-schema"

export type GameMapVisualJudgeStatus =
  | "game_map_vj_passed"
  | "game_map_vj_failed"

export type GameMapVisualJudgeIssue = {
  code: string
  severity: "error" | "warning"
  message: string
}

export type GameMapVisualJudgeReport = {
  status: GameMapVisualJudgeStatus
  passed: boolean
  canEnterRuntimeFrame: boolean
  worldId: string
  tick: number
  frameId: string
  structureId: string
  summary: {
    errorCount: number
    warningCount: number
  }
  issues: GameMapVisualJudgeIssue[]
  tags: string[]
}

const TRAINING_OR_PARTIAL_TAGS = [
  "partial_or_crop_candidate",
  "training_candidate",
  "single_direct_output",
  "single_source_overfit",
  "local_asset_preview",
  "candidate_only",
]

export function judgeGameMapFrameForRuntime(
  frame: GameMapFrame,
  structure: HomeMapStructure
): GameMapVisualJudgeReport {
  const issues: GameMapVisualJudgeIssue[] = []
  const structureResult = validateHomeMapStructure(structure)
  const frameResult = validateGameMapFrame(frame, structure)

  for (const item of structureResult.issues) {
    issues.push(error(`structure_${item.code}`, item.message))
  }
  for (const item of frameResult.issues) {
    issues.push(error(`frame_${item.code}`, item.message))
  }

  if (
    frame.visualLayer.status !== "approved" &&
    frame.visualLayer.status !== "structured_fallback"
  ) {
    issues.push(
      error(
        "visual_layer_not_approved",
        "GameMapFrame must have an approved visualLayer or structured fallback before it can enter RuntimeFrame."
      )
    )
  } else {
    if (frame.visualLayer.imageWidth < structure.size.width) {
      issues.push(
        error(
          "visual_layer_width_too_small",
          "Approved visual layer must cover the full map width."
        )
      )
    }
    if (frame.visualLayer.imageHeight < structure.size.height) {
      issues.push(
        error(
          "visual_layer_height_too_small",
          "Approved visual layer must cover the full map height."
        )
      )
    }
    if (
      frame.visualLayer.status === "approved" &&
      frame.visualLayer.imageSha256.length !== 64
    ) {
      issues.push(
        error(
          "visual_layer_sha_invalid",
          "Approved visual layer must bind a valid SHA-256 digest."
        )
      )
    }
  }

  if (containsAny(frame.tags, TRAINING_OR_PARTIAL_TAGS)) {
    issues.push(
      error(
        "training_or_partial_tags_present",
        "Training, partial, crop, or candidate-only tags cannot enter RuntimeFrame."
      )
    )
  }

  if (
    frame.visualLayer.status === "approved" &&
    !frame.tags.includes("visual_layer_approved_bound")
  ) {
    issues.push(
      error(
        "visual_layer_approved_binding_tag_missing",
        "GameMapFrame must be produced by the approved visualLayer binding step."
      )
    )
  }
  if (
    frame.visualLayer.status === "structured_fallback" &&
    !frame.tags.includes("visual_layer_structured_fallback_bound")
  ) {
    issues.push(
      error(
        "visual_layer_structured_fallback_binding_tag_missing",
        "GameMapFrame must be produced by the structured fallback visualLayer binding step."
      )
    )
  }
  if (
    frame.visualLayer.status === "structured_fallback" &&
    !frame.tags.includes("structured_fallback_runtime_safe")
  ) {
    issues.push(
      error(
        "structured_fallback_runtime_safe_tag_missing",
        "Structured fallback RuntimeFrame must be explicitly tagged as runtime safe."
      )
    )
  }

  if (frame.terrainLayer.regions.length === 0) {
    issues.push(error("terrain_layer_empty", "GameMapFrame terrainLayer must not be empty."))
  }
  if (frame.walkableLayer.regions.length === 0) {
    issues.push(error("walkable_layer_empty", "GameMapFrame walkableLayer must not be empty."))
  }
  if (frame.collisionLayer.regions.length === 0) {
    issues.push(error("collision_layer_empty", "GameMapFrame collisionLayer must not be empty."))
  }
  if (frame.objectLayer.objects.length === 0) {
    issues.push(error("object_layer_empty", "GameMapFrame objectLayer must not be empty."))
  }
  if (frame.interactionLayer.items.length === 0) {
    issues.push(
      error("interaction_layer_empty", "GameMapFrame interactionLayer must not be empty.")
    )
  }

  const expectedFactIds = collectHomeMapStructureSourceFactIds(structure)
  if (!sameStringSet(frame.sourceFactIds, expectedFactIds)) {
    issues.push(
      error(
        "source_fact_ids_not_same_source",
        "GameMapFrame must keep the same source facts as HomeMapStructure."
      )
    )
  }

  const errorCount = issues.filter((item) => item.severity === "error").length
  const warningCount = issues.filter((item) => item.severity === "warning").length
  const passed = errorCount === 0

  return {
    status: passed ? "game_map_vj_passed" : "game_map_vj_failed",
    passed,
    canEnterRuntimeFrame: passed,
    worldId: frame.worldId,
    tick: frame.tick,
    frameId: frame.frameId,
    structureId: frame.structureId,
    summary: {
      errorCount,
      warningCount,
    },
    issues,
    tags: passed
      ? ["game_map_visual_judge_passed", "runtime_frame_candidate"]
      : ["game_map_visual_judge_failed", "runtime_frame_blocked"],
  }
}

function error(code: string, message: string): GameMapVisualJudgeIssue {
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

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}
