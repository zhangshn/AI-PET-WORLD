import type {
  HomeMapState,
  HomeZone,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"
import type { SpaceGrid } from "@/world/space"

import type {
  WorldViewActor,
  WorldViewActorPose,
} from "./world-view-model-schema"

export function buildWorldViewActors(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  saveRecord: WorldRuntimeSaveRecord
}): {
  actors: WorldViewActor[]
  tags: string[]
} {
  const butler = buildButlerActor(input)
  const petActors = buildPetActors(input.homeMapState)

  return {
    actors: [butler.actor, ...petActors],
    tags: [butler.tag],
  }
}

function buildButlerActor(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  saveRecord: WorldRuntimeSaveRecord
}): {
  actor: WorldViewActor
  tag: string
} {
  const actorPlacement = input.homeMapState.placements.find(isButlerPlacement)

  if (actorPlacement) {
    const point = placementToPixelPoint({
      x: actorPlacement.x,
      y: actorPlacement.y,
      homeMapState: input.homeMapState,
    })

    return {
      actor: {
        id: "butler_actor",
        kind: "butler",
        x: point.x,
        y: point.y,
        layer: "front",
        pose: mapButlerPose(input.saveRecord),
        label: "管家",
        visible: true,
      },
      tag: "butler_sprite_position_from_actor_placement",
    }
  }

  const fallbackZone = findButlerFallbackZone(input.homeMapState)
  const fallbackPoint = fallbackZone
    ? centerOfZone(fallbackZone, input.homeMapState)
    : input.spaceGrid.cells.find((cell) => cell.passable) ?? {
        x: input.homeMapState.mapSize.columns * input.homeMapState.mapSize.tileSize * 0.5,
        y: input.homeMapState.mapSize.rows * input.homeMapState.mapSize.tileSize * 0.5,
      }

  return {
    actor: {
      id: "butler_actor",
      kind: "butler",
      x: fallbackPoint.x,
      y: fallbackPoint.y,
      layer: "front",
      pose: mapButlerPose(input.saveRecord),
      label: "管家",
      visible: true,
    },
    tag: "butler_sprite_position_fallback_from_zone_center",
  }
}

function buildPetActors(homeMapState: HomeMapState): WorldViewActor[] {
  return homeMapState.placements.filter(isPetPlacement).map((placement) => ({
    id: `pet_actor_${placement.id}`,
    kind: "pet",
    ...placementToPixelPoint({
      x: placement.x,
      y: placement.y,
      homeMapState,
    }),
    layer: "front",
    pose: "idle",
    label: placement.label,
    visible: true,
  }))
}

function isButlerPlacement(placement: MapPlacement): boolean {
  return (
    placement.layer === "actor" &&
    (placement.tags.includes("butler") ||
      placement.id.toLowerCase().includes("butler") ||
      placement.label.toLowerCase().includes("butler"))
  )
}

function isPetPlacement(placement: MapPlacement): boolean {
  return (
    placement.layer === "actor" &&
    (placement.tags.includes("pet") ||
      placement.id.toLowerCase().includes("pet") ||
      placement.label.toLowerCase().includes("pet"))
  )
}

function findButlerFallbackZone(homeMapState: HomeMapState): HomeZone | undefined {
  return (
    homeMapState.zones.find((zone) => zone.type === "visual_center") ??
    homeMapState.zones.find((zone) => zone.type === "entry_area") ??
    homeMapState.zones.find((zone) => zone.type === "quiet_living")
  )
}

function centerOfZone(
  zone: HomeZone,
  homeMapState: HomeMapState
): { x: number; y: number } {
  const scale =
    zone.bounds.x <= homeMapState.mapSize.columns &&
    zone.bounds.y <= homeMapState.mapSize.rows
      ? homeMapState.mapSize.tileSize
      : 1

  return {
    x: (zone.bounds.x + zone.bounds.width / 2) * scale,
    y: (zone.bounds.y + zone.bounds.height / 2) * scale,
  }
}

function placementToPixelPoint(input: {
  x: number
  y: number
  homeMapState: HomeMapState
}): { x: number; y: number } {
  const scale =
    input.x <= input.homeMapState.mapSize.columns &&
    input.y <= input.homeMapState.mapSize.rows
      ? input.homeMapState.mapSize.tileSize
      : 1

  return {
    x: input.x * scale,
    y: input.y * scale,
  }
}

function mapButlerPose(saveRecord: WorldRuntimeSaveRecord): WorldViewActorPose {
  const motivation = saveRecord.lastButlerRuntimeDecision?.selectedMotivation

  if (motivation === "maintain_home") return "maintain"
  if (motivation === "observe_world") return "observe"
  if (motivation === "continue_construction") return "walk"
  if (motivation === "wait_for_resources") return "wait"

  return "idle"
}
