import { buildGameMapFrameFromHomeMapStructure } from "./game-map-frame-builder"
import { validateGameMapFrame, validateHomeMapStructure } from "./game-map-frame-validator"
import { buildGameMapRuntimeFrame } from "./game-map-runtime-frame-builder"
import type { GameMapRuntimeFrame } from "./game-map-runtime-frame-schema"
import {
  writeGameMapRuntimeFrameRecord,
  type GameMapRuntimeFrameWriteResult,
} from "./game-map-runtime-frame-store"
import { judgeGameMapFrameForRuntime } from "./game-map-visual-judge"
import {
  bindApprovedFrameVisualLayer,
  bindStructuredFallbackVisualLayer,
  type GameMapApprovedFrameInput,
} from "./game-map-visual-layer-binding"
import type { GameMapFrame } from "./game-map-frame-schema"
import type { HomeMapStructure } from "./home-map-structure-schema"
import { collectHomeMapStructureSourceFactIds } from "./home-map-structure-schema"

export type GameMapRuntimeFramePipelineStatus =
  | "runtime_frame_written"
  | "blocked_structure_invalid"
  | "blocked_game_map_frame_invalid"
  | "blocked_visual_layer_binding"
  | "blocked_visual_judge"
  | "blocked_runtime_frame_build"
  | "blocked_runtime_frame_write"

export type GameMapRuntimeFramePipelineResult = {
  status: GameMapRuntimeFramePipelineStatus
  passed: boolean
  structure: HomeMapStructure
  gameMapFrame: GameMapFrame | null
  runtimeFrame: GameMapRuntimeFrame | null
  writeResult: GameMapRuntimeFrameWriteResult | null
  blockedReasons: string[]
  tags: string[]
}

export async function runGameMapRuntimeFramePipeline(input: {
  structure: HomeMapStructure
  approvedFrame: GameMapApprovedFrameInput | null
  allowStructuredFallback?: boolean
  outputRoot?: string
  createdAt?: string
}): Promise<GameMapRuntimeFramePipelineResult> {
  const structureValidation = validateHomeMapStructure(input.structure)
  if (!structureValidation.passed) {
    return blocked("blocked_structure_invalid", input.structure, null, null, [
      ...structureValidation.issues.map((issue) => issue.code),
    ])
  }

  const baseFrame = buildGameMapFrameFromHomeMapStructure(input.structure)
  const frameValidation = validateGameMapFrame(baseFrame, input.structure)
  if (!frameValidation.passed) {
    return blocked("blocked_game_map_frame_invalid", input.structure, baseFrame, null, [
      ...frameValidation.issues.map((issue) => issue.code),
    ])
  }

  const sourceFactIds = collectHomeMapStructureSourceFactIds(input.structure)
  let visualLayerBinding =
    input.approvedFrame || !input.allowStructuredFallback
      ? bindApprovedFrameVisualLayer({
          frame: baseFrame,
          approvedFrame: input.approvedFrame,
          expectedWorldId: input.structure.worldId,
          expectedTick: input.structure.tick,
          expectedSourceFactIds: sourceFactIds,
        })
      : bindStructuredFallbackVisualLayer({
          frame: baseFrame,
          expectedWorldId: input.structure.worldId,
          expectedTick: input.structure.tick,
          expectedSourceFactIds: sourceFactIds,
          width: input.structure.size.width,
          height: input.structure.size.height,
        })

  if (
    input.allowStructuredFallback &&
    input.approvedFrame &&
    !visualLayerBinding.passed &&
    visualLayerBinding.blockedReasons.includes("approved_frame_missing_composite_input_tags")
  ) {
    visualLayerBinding = bindStructuredFallbackVisualLayer({
      frame: baseFrame,
      expectedWorldId: input.structure.worldId,
      expectedTick: input.structure.tick,
      expectedSourceFactIds: sourceFactIds,
      width: input.structure.size.width,
      height: input.structure.size.height,
    })
  }

  if (!visualLayerBinding.passed) {
    return blocked(
      "blocked_visual_layer_binding",
      input.structure,
      visualLayerBinding.frame,
      null,
      visualLayerBinding.blockedReasons
    )
  }

  const judgeReport = judgeGameMapFrameForRuntime(visualLayerBinding.frame, input.structure)
  if (!judgeReport.passed || !judgeReport.canEnterRuntimeFrame) {
    return blocked(
      "blocked_visual_judge",
      input.structure,
      visualLayerBinding.frame,
      null,
      judgeReport.issues.map((issue) => issue.code)
    )
  }

  const runtimeFrameBuild = buildGameMapRuntimeFrame({
    frame: visualLayerBinding.frame,
    judgeReport,
  })

  if (!runtimeFrameBuild.passed || !runtimeFrameBuild.runtimeFrame) {
    return blocked(
      "blocked_runtime_frame_build",
      input.structure,
      visualLayerBinding.frame,
      null,
      runtimeFrameBuild.blockedReasons
    )
  }

  const writeResult = await writeGameMapRuntimeFrameRecord({
    runtimeFrame: runtimeFrameBuild.runtimeFrame,
    outputRoot: input.outputRoot,
    createdAt: input.createdAt,
  })

  if (writeResult.status !== "written" || !writeResult.record) {
    return blocked(
      "blocked_runtime_frame_write",
      input.structure,
      visualLayerBinding.frame,
      runtimeFrameBuild.runtimeFrame,
      writeResult.warnings
    )
  }

  return {
    status: "runtime_frame_written",
    passed: true,
    structure: input.structure,
    gameMapFrame: visualLayerBinding.frame,
    runtimeFrame: runtimeFrameBuild.runtimeFrame,
    writeResult,
    blockedReasons: [],
    tags: [
      "game_map_runtime_frame_pipeline",
      "runtime_frame_written",
      "world_page_blocked_until_composite_map",
    ],
  }
}

function blocked(
  status: Exclude<GameMapRuntimeFramePipelineStatus, "runtime_frame_written">,
  structure: HomeMapStructure,
  gameMapFrame: GameMapFrame | null,
  runtimeFrame: GameMapRuntimeFrame | null,
  blockedReasons: string[]
): GameMapRuntimeFramePipelineResult {
  return {
    status,
    passed: false,
    structure,
    gameMapFrame,
    runtimeFrame,
    writeResult: null,
    blockedReasons,
    tags: ["game_map_runtime_frame_pipeline", "blocked"],
  }
}
