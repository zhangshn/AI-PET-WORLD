import type { HomeMapState, HomeZone, MapPlacement } from "@/world/map-state/home-map-state-schema"
import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"
import type { SpaceGrid } from "@/world/space"

import type {
  WorldViewActor,
  WorldViewActorPose,
} from "./world-view-model-schema"

const FORMAL_PET_ENTRY_TAGS = new Set([
  "life_entry_validated",
  "pet_world_entry_validated",
  "actor_input_boundary_validated",
])

export function buildWorldViewActors(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  saveRecord: WorldRuntimeSaveRecord
}): WorldViewActor[] {
  return [
    buildButlerActor(input),
    ...buildPetActors({
      homeMapState: input.homeMapState,
    }),
  ]
}

function buildButlerActor(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  saveRecord: WorldRuntimeSaveRecord
}): WorldViewActor {
  const actorPlacement = input.homeMapState.placements.find(
    (placement) =>
      placement.layer === "actor" &&
      (placement.tags.includes("butler") ||
        placement.id.toLowerCase().includes("butler") ||
        placement.label.toLowerCase().includes("butler") ||
        placement.label.includes("管家"))
  )

  if (actorPlacement) {
    const point = placementToPixelPoint({
      x: actorPlacement.x,
      y: actorPlacement.y,
      homeMapState: input.homeMapState,
    })

    return {
      id: "butler_actor",
      kind: "butler",
      x: point.x,
      y: point.y,
      layer: "front",
      pose: mapButlerPose(input.saveRecord),
      label: actorPlacement.label || "管家",
      visible: true,
    }
  }

  const fallbackZone = findButlerFallbackZone(input.homeMapState)
  const fallbackPoint = fallbackZone
    ? centerOfZone(fallbackZone, input.homeMapState)
    : input.spaceGrid.cells.find((cell) => cell.passable)?.coordinate ?? {
        x: input.homeMapState.mapSize.columns * input.homeMapState.mapSize.tileSize * 0.5,
        y: input.homeMapState.mapSize.rows * input.homeMapState.mapSize.tileSize * 0.5,
      }

  return {
    id: "butler_actor",
    kind: "butler",
    x: fallbackPoint.x,
    y: fallbackPoint.y,
    layer: "front",
    pose: mapButlerPose(input.saveRecord),
    label: "管家",
    visible: true,
  }
}

function buildPetActors(input: { homeMapState: HomeMapState }): WorldViewActor[] {
  return input.homeMapState.placements
    .filter(
      (placement) =>
        placement.layer === "actor" &&
        isPetPlacement(placement) &&
        hasValidatedPetEntryTag(placement)
    )
    .map((placement) => {
      const point = placementToPixelPoint({
        x: placement.x,
        y: placement.y,
        homeMapState: input.homeMapState,
      })

      return {
        id: `pet_actor_${placement.id}`,
        kind: "pet" as const,
        x: point.x,
        y: point.y,
        layer: "front" as const,
        pose: "idle" as const,
        label: placement.label,
        visible: true,
      }
    })
}

function isPetPlacement(placement: MapPlacement): boolean {
  return (
    placement.tags.includes("pet") ||
    placement.id.toLowerCase().includes("pet") ||
    placement.label.toLowerCase().includes("pet") ||
    placement.label.includes("宠物")
  )
}

function hasValidatedPetEntryTag(placement: MapPlacement): boolean {
  return placement.tags.some((tag) => FORMAL_PET_ENTRY_TAGS.has(tag))
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
