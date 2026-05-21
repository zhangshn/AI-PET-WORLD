/**
 * 当前文件职责：从 HomeMapState 派生 WorldLoop 可渲染状态。
 */

import {
  buildActorGeometryProjectionFromRuntime,
  buildButlerRuntimeProjection,
} from "@/world/actor-runtime-projection/actor-runtime-projection-gateway"
import type { ActorRuntimeGeometryProjectionResult } from "@/world/actor-runtime-projection/actor-runtime-projection-gateway"
import { buildEnvironmentStateFromHomeMap } from "@/world/environment/environment-gateway"
import { buildPlacementGeometryAuditReport } from "@/world/geometry-audit/geometry-audit-gateway"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import {
  buildRenderableWorldSnapshot,
  buildVisualState,
} from "@/world/rendering/renderer-gateway"
import type { Point2D } from "@/world/spatial/spatial-gateway"

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
  const actorRuntimeGeometryProjections =
    buildActorRuntimeGeometryProjectionsForRenderableState({
      homeMapState: input.homeMapState,
      now: input.now,
    })
  const visualState = buildVisualState({
    homeMapState: input.homeMapState,
    environmentState,
    placementGeometryAudit,
    actorRuntimeGeometryProjections,
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

function buildActorRuntimeGeometryProjectionsForRenderableState(input: {
  homeMapState: HomeMapState
  now: number
}): ActorRuntimeGeometryProjectionResult[] {
  const butlerRuntimeProjection = buildButlerRuntimeProjection({
    worldId: input.homeMapState.worldId,
    butlerId: buildButlerActorId(input.homeMapState.ownerId),
    tickIndex: input.now,
    currentTask: "inspect_environment",
    mood: "calm",
    attentionTargetType: "home",
    anchor: buildButlerActorAnchorFromHomeMap(input.homeMapState),
    tags: [
      "world_loop_renderable_actor_projection_v0",
      "actor_projection_origin:world_loop_renderable_state",
      "actor_kind:butler",
      "butler_first_life",
      "pet_not_default_actor",
    ],
  })

  return [
    buildActorGeometryProjectionFromRuntime(butlerRuntimeProjection),
  ]
}

function buildButlerActorId(ownerId: string): string {
  return `butler:${ownerId}`
}

function buildButlerActorAnchorFromHomeMap(
  homeMapState: HomeMapState
): Point2D {
  const actorPlacement = homeMapState.placements.find((placement) =>
    placement.layer === "actor" &&
    placement.tags.includes("actor_kind:butler")
  )

  if (actorPlacement) {
    return {
      x: actorPlacement.x,
      y: actorPlacement.y,
    }
  }

  const visualCenterZone = homeMapState.zones.find((zone) =>
    zone.type === "visual_center"
  )

  if (visualCenterZone) {
    return {
      x: visualCenterZone.bounds.x + visualCenterZone.bounds.width / 2,
      y: visualCenterZone.bounds.y + visualCenterZone.bounds.height / 2,
    }
  }

  const shelterZone = homeMapState.zones.find((zone) =>
    zone.type === "temporary_shelter"
  )

  if (shelterZone) {
    return {
      x: shelterZone.bounds.x + shelterZone.bounds.width / 2,
      y: shelterZone.bounds.y + shelterZone.bounds.height / 2,
    }
  }

  return {
    x: homeMapState.mapSize.columns / 2,
    y: homeMapState.mapSize.rows / 2,
  }
}
