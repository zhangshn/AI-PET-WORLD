/**
 * 当前文件职责：从 HomeMapState 生成 MVP FormalVisualModel 刷新预检结果。
 */

import { buildFormalVisualModelFromSnapshot } from "@/world/formal-visual-model/formal-visual-model-gateway"
import type { FormalVisualModel } from "@/world/formal-visual-model/formal-visual-model-gateway"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import { buildWorldLoopRenderableState } from "@/world/world-loop/world-loop-gateway"

export type MvpFormalVisualRefreshInput = {
  nextHomeMapState: HomeMapState
  shouldRefreshSnapshot: boolean
  now: number
  warnings: string[]
  tags: string[]
}

export type MvpFormalVisualRefreshResult = {
  shouldBuildFormalVisualModel: boolean
  formalVisualModelReady: boolean
  formalVisualModel: FormalVisualModel | null
  precheckReason: string
  warnings: string[]
  messages: string[]
  tags: string[]
}

export function buildMvpFormalVisualRefresh(
  input: MvpFormalVisualRefreshInput
): MvpFormalVisualRefreshResult {
  const shouldBuildFormalVisualModel =
    input.shouldRefreshSnapshot && input.warnings.length === 0
  const renderableState = shouldBuildFormalVisualModel
    ? buildWorldLoopRenderableState({
        homeMapState: input.nextHomeMapState,
        now: input.now,
      })
    : null
  const formalVisualModel = renderableState
    ? buildFormalVisualModelFromSnapshot(renderableState.renderableWorldSnapshot)
    : null

  return {
    shouldBuildFormalVisualModel,
    formalVisualModelReady: Boolean(formalVisualModel),
    formalVisualModel,
    precheckReason: shouldBuildFormalVisualModel
      ? "FormalVisualModel refresh precheck passed."
      : "FormalVisualModel refresh precheck skipped.",
    warnings: input.warnings,
    messages: input.warnings.length === 0
      ? ["MVP formal visual refresh checked."]
      : input.warnings,
    tags: [
      "mvp_formal_visual_refresh",
      "formal_visual_generator_driven",
      "no_formal_world_view_generation",
      ...input.tags,
    ],
  }
}
