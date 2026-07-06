import type { GameMapCompositeManifest } from "./game-map-composite-schema"
import { judgeGameMapCompositeManifestForWorld } from "./game-map-composite-judge"
import type { GameMapRuntimeFrame } from "./game-map-runtime-frame-schema"
import { isGameMapRuntimeFrame } from "./game-map-runtime-frame-schema"

export type FinalizeGameMapRuntimeFrameStatus =
  | "runtime_frame_finalized"
  | "blocked_composite_judge"
  | "blocked_invalid_runtime_frame"

export type FinalizeGameMapRuntimeFrameResult = {
  status: FinalizeGameMapRuntimeFrameStatus
  passed: boolean
  runtimeFrame: GameMapRuntimeFrame | null
  blockedReasons: string[]
  tags: string[]
}

const BLOCKED_RUNTIME_TAGS = [
  "single_approved_visual_layer",
  "structured_fallback_runtime_frame",
  "requires_composite_game_map_runtime_frame",
  "world_page_blocked_until_formal_visual_judge",
  "runtime_composite_blocked",
]

const BLOCKED_COMPOSITION_TAGS = [
  "world_page_blocked_until_formal_visual_judge",
  "runtime_composite_blocked",
]

export function finalizeGameMapRuntimeFrameForWorld(input: {
  runtimeFrame: GameMapRuntimeFrame
  composition: GameMapCompositeManifest
}): FinalizeGameMapRuntimeFrameResult {
  const compositeJudge = judgeGameMapCompositeManifestForWorld(input.composition)

  if (!compositeJudge.passed || !compositeJudge.canEnterWorld) {
    return blocked("blocked_composite_judge", compositeJudge.issues.map((issue) => issue.code))
  }

  const composition: GameMapCompositeManifest = {
    ...input.composition,
    tags: uniqueTags(
      input.composition.tags.filter((tag) => !BLOCKED_COMPOSITION_TAGS.includes(tag))
    ),
  }

  const runtimeFrame: GameMapRuntimeFrame = {
    ...input.runtimeFrame,
    composition,
    worldPageContract: {
      ...input.runtimeFrame.worldPageContract,
      canShowInWorld: true,
    },
    tags: uniqueTags([
      ...input.runtimeFrame.tags.filter((tag) => !BLOCKED_RUNTIME_TAGS.includes(tag)),
      "composite_game_map_runtime_frame",
      "game_map_runtime_frame_world_ready",
      "p7_9_complete_game_map_runtime_frame",
    ]),
  }

  if (!isGameMapRuntimeFrame(runtimeFrame)) {
    return blocked("blocked_invalid_runtime_frame", ["runtime_frame_schema_invalid"])
  }

  return {
    status: "runtime_frame_finalized",
    passed: true,
    runtimeFrame,
    blockedReasons: [],
    tags: [
      "runtime_frame_finalized",
      "composite_game_map_runtime_frame",
      "world_page_ready",
    ],
  }
}

function blocked(
  status: Exclude<FinalizeGameMapRuntimeFrameStatus, "runtime_frame_finalized">,
  blockedReasons: string[]
): FinalizeGameMapRuntimeFrameResult {
  return {
    status,
    passed: false,
    runtimeFrame: null,
    blockedReasons,
    tags: ["game_map_runtime_frame_finalizer_blocked"],
  }
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}
