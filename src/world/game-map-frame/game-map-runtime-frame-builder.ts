import type { GameMapFrame } from "./game-map-frame-schema"
import type { GameMapRuntimeFrame } from "./game-map-runtime-frame-schema"
import type { GameMapVisualJudgeReport } from "./game-map-visual-judge"
import { buildGameMapCompositeManifest } from "./game-map-composite-builder"

export type GameMapRuntimeFrameBuildStatus =
  | "runtime_frame_built"
  | "blocked_visual_judge_not_passed"
  | "blocked_visual_layer_not_runtime_ready"
  | "blocked_composite_manifest_invalid"
  | "blocked_training_or_partial_tags"

export type GameMapRuntimeFrameBuildResult = {
  status: GameMapRuntimeFrameBuildStatus
  passed: boolean
  runtimeFrame: GameMapRuntimeFrame | null
  blockedReasons: string[]
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

export function buildGameMapRuntimeFrame(input: {
  frame: GameMapFrame
  judgeReport: GameMapVisualJudgeReport
}): GameMapRuntimeFrameBuildResult {
  const { frame, judgeReport } = input

  if (!judgeReport.passed || !judgeReport.canEnterRuntimeFrame) {
    return blocked("blocked_visual_judge_not_passed", [
      "game_map_visual_judge_must_pass_before_runtime_frame",
    ])
  }
  if (
    frame.visualLayer.status !== "approved" &&
    frame.visualLayer.status !== "structured_fallback"
  ) {
    return blocked("blocked_visual_layer_not_runtime_ready", [
      "runtime_frame_requires_approved_or_structured_fallback_visual_layer",
    ])
  }
  if (containsAny(frame.tags, TRAINING_OR_PARTIAL_TAGS)) {
    return blocked("blocked_training_or_partial_tags", [
      "runtime_frame_cannot_include_training_or_partial_tags",
    ])
  }

  const compositeBuild = buildGameMapCompositeManifest(frame)
  if (!compositeBuild.passed || compositeBuild.manifest === null) {
    return blocked("blocked_composite_manifest_invalid", compositeBuild.blockedReasons)
  }

  const runtimeFrame: GameMapRuntimeFrame = {
    schemaVersion: "game-map-runtime-frame-v1",
    runtimeFrameId: `game-map-runtime-frame-${frame.frameId}`,
    gameMapFrameId: frame.frameId,
    structureId: frame.structureId,
    worldId: frame.worldId,
    ownerId: frame.ownerId,
    tick: frame.tick,
    sourceFactIds: frame.sourceFactIds,
    layers: {
      terrain: frame.terrainLayer.regions,
      objects: frame.objectLayer.objects,
      walkable: frame.walkableLayer.regions,
      collision: frame.collisionLayer.regions,
      interactions: frame.interactionLayer.items,
    },
    runtimeState: {
      phase: frame.runtimeLayer.phase,
      stateRefs: frame.runtimeLayer.stateRefs,
    },
    composition: compositeBuild.manifest,
    visual: {
      source:
        frame.visualLayer.status === "structured_fallback"
          ? "structured_fallback_skin"
          : "ai_painter_approved_frame",
      approvedFrameId: frame.visualLayer.approvedFrameId,
      candidateId: frame.visualLayer.candidateId,
      imageUrl:
        frame.visualLayer.status === "approved"
          ? frame.visualLayer.imageUrl
          : null,
      imageSha256: frame.visualLayer.imageSha256,
      imageWidth: frame.visualLayer.imageWidth,
      imageHeight: frame.visualLayer.imageHeight,
      imageFormat: frame.visualLayer.imageFormat,
    },
    worldPageContract: {
      page: "/world",
      mode: "game_runtime",
      canShowInWorld: false,
      forbiddenPayloads: [
        "training_image",
        "candidate_image",
        "partial_crop_image",
        "single_model_output_only",
        "single_approved_frame_image",
      ],
    },
    tags: [
      "game_map_runtime_frame",
      "p7_7_composite_manifest_attached",
      "requires_composite_game_map_runtime_frame",
      "not_training_image",
      frame.visualLayer.status === "structured_fallback"
        ? "structured_fallback_runtime_frame"
        : "single_approved_visual_layer",
    ],
  }

  return {
    status: "runtime_frame_built",
    passed: true,
    runtimeFrame,
    blockedReasons: [],
    tags: [
      "runtime_frame_built",
      "p7_7_composite_manifest_attached",
      "world_page_blocked_until_composite_map",
    ],
  }
}

function blocked(
  status: Exclude<GameMapRuntimeFrameBuildStatus, "runtime_frame_built">,
  blockedReasons: string[]
): GameMapRuntimeFrameBuildResult {
  return {
    status,
    passed: false,
    runtimeFrame: null,
    blockedReasons,
    tags: ["runtime_frame_blocked"],
  }
}

function containsAny(values: string[], blockedValues: string[]): boolean {
  const valueSet = new Set(values)
  return blockedValues.some((value) => valueSet.has(value))
}
