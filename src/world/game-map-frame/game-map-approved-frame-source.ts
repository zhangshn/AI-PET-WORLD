import { buildCurrentWorldHomeMapStructure } from "./game-map-current-world-structure-builder"
import type { GameMapRuntimeFramePipelineResult } from "./game-map-runtime-frame-pipeline"
import { runGameMapRuntimeFramePipeline } from "./game-map-runtime-frame-pipeline"
import type { GameMapApprovedFrameInput } from "./game-map-visual-layer-binding"
import type { CurrentWorldRuntimeStructureSource } from "./game-map-current-world-structure-builder"

export type GameMapApprovedFrameRecordSource = {
  ownerId: string
  worldId: string
  tick: number
  sourceFactIds: string[]
  tags: string[]
  approvedFrame: {
    frameId: string
    sourceImageCandidateId: string
    imageUrl: string
    imageFormat: "png" | "webp" | "jpg"
    width: number
    height: number
    sourceImageSha256: string
    sourceImageByteLength: number
    sourceImagePayloadQualityPassed: boolean
    approvalScope: "approved_for_controlled_mvp" | "approved_for_game_world"
    approvedForProduction: boolean
    vj0Status: "vj_0_passed"
    vj1Status: "vj_1_passed"
    vj2Status: "vj_2_not_implemented" | "vj_2_passed"
    tags: string[]
  }
}

export type RunCurrentWorldRuntimeFramePipelineInput = {
  saveRecord: CurrentWorldRuntimeStructureSource
  sourceFactIds: string[]
  approvedFrameRecord: GameMapApprovedFrameRecordSource | null
  allowStructuredFallback?: boolean
  outputRoot?: string
  createdAt?: string
}

export function toGameMapApprovedFrameInput(
  record: GameMapApprovedFrameRecordSource | null
): GameMapApprovedFrameInput | null {
  if (!record) return null

  const approvedFrame = record.approvedFrame
  return {
    frameId: approvedFrame.frameId,
    worldId: record.worldId,
    tick: record.tick,
    sourceImageCandidateId: approvedFrame.sourceImageCandidateId,
    imageUrl: approvedFrame.imageUrl,
    imageFormat: approvedFrame.imageFormat,
    width: approvedFrame.width,
    height: approvedFrame.height,
    sourceImageSha256: approvedFrame.sourceImageSha256,
    sourceImageByteLength: approvedFrame.sourceImageByteLength,
    sourceImagePayloadQualityPassed: approvedFrame.sourceImagePayloadQualityPassed,
    approvalScope: approvedFrame.approvalScope,
    approvedForProduction: approvedFrame.approvedForProduction,
    vj0Status: approvedFrame.vj0Status,
    vj1Status: approvedFrame.vj1Status,
    vj2Status: approvedFrame.vj2Status,
    sourceFactIds: record.sourceFactIds,
    tags: Array.from(new Set([...record.tags, ...approvedFrame.tags])),
  }
}

export async function runCurrentWorldRuntimeFramePipeline(
  input: RunCurrentWorldRuntimeFramePipelineInput
): Promise<GameMapRuntimeFramePipelineResult> {
  const structure = buildCurrentWorldHomeMapStructure({
    saveRecord: input.saveRecord,
    sourceFactIds: input.sourceFactIds,
  })

  return runGameMapRuntimeFramePipeline({
    structure,
    approvedFrame: toGameMapApprovedFrameInput(input.approvedFrameRecord),
    allowStructuredFallback: input.allowStructuredFallback,
    outputRoot: input.outputRoot,
    createdAt: input.createdAt,
  })
}
