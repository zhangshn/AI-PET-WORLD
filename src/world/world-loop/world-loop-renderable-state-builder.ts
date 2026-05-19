/**
 * 当前文件职责：从 HomeMapState 派生 WorldLoop 可渲染状态。
 */

import { buildEnvironmentStateFromHomeMap } from "@/world/environment/environment-gateway"
import { buildPlacementGeometryAuditReport } from "@/world/geometry-audit/geometry-audit-gateway"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import {
  buildRenderableWorldSnapshot,
  buildVisualState,
} from "@/world/rendering/renderer-gateway"

import type { WorldLoopRenderableState } from "./world-loop-schema"

export type BuildWorldLoopRenderableStateInput = {
  homeMapState: HomeMapState
  now: number
}

export function buildWorldLoopRenderableState(
  input: BuildWorldLoopRenderableStateInput
): WorldLoopRenderableState {
  const environmentState = buildEnvironmentStateFromHomeMap({
    homeMapState: input.homeMapState,
    generatedAt: input.now,
  })
  const placementGeometryAudit = buildPlacementGeometryAuditReport({
    homeMapState: input.homeMapState,
    checkedAt: input.now,
  })
  const visualState = buildVisualState({
    homeMapState: input.homeMapState,
    environmentState,
    placementGeometryAudit,
    generatedAt: input.now,
  })
  const renderableWorldSnapshot = buildRenderableWorldSnapshot({
    visualState,
  })

  return {
    homeMapState: input.homeMapState,
    environmentState,
    placementGeometryAudit,
    renderableWorldSnapshot,
    tags: [
      "world_loop_renderable_state_v0",
      "persisted_state_restore",
      ...renderableWorldSnapshot.tags,
    ],
  }
}
