/**
 * 当前文件负责：应用家园地图变化记录。
 */

import type {
  HomeMapState,
  MapDiff,
  MapPlacement,
} from "./home-map-state-schema"

type PlacementPatch = NonNullable<MapDiff["patch"]>

type CreateBaseMapDiffInput = {
  id: string
  placementId: string
  reason: string
  createdAt: number
  tags?: string[]
}

export type CreateAddPlacementDiffInput = CreateBaseMapDiffInput & {
  placement: MapPlacement
}

export type CreateRemovePlacementDiffInput = CreateBaseMapDiffInput

export type CreateUpdatePlacementDiffInput = CreateBaseMapDiffInput & {
  patch: Pick<PlacementPatch, "scale" | "alpha" | "label" | "tags">
}

export type CreateMovePlacementDiffInput = CreateBaseMapDiffInput & {
  patch: Pick<PlacementPatch, "x" | "y">
}

export function applyMapDiffs(
  homeMapState: HomeMapState,
  mapDiffs: MapDiff[]
): HomeMapState {
  if (mapDiffs.length === 0) return homeMapState

  const placements = mapDiffs.reduce(
    (currentPlacements, diff) => applyMapDiff(currentPlacements, diff),
    [...homeMapState.placements]
  )
  const latestDiffTick = Math.max(...mapDiffs.map((diff) => diff.createdAt))

  return {
    ...homeMapState,
    placements,
    mapDiffs: [...homeMapState.mapDiffs, ...mapDiffs],
    updatedAt: Math.max(homeMapState.updatedAt, latestDiffTick),
  }
}

export function createAddPlacementDiff(
  input: CreateAddPlacementDiffInput
): MapDiff {
  return {
    id: input.id,
    operation: "add",
    placementId: input.placementId,
    placement: input.placement,
    reason: input.reason,
    createdAt: input.createdAt,
    tags: input.tags ?? ["map_diff", "add_placement"],
  }
}

export function createRemovePlacementDiff(
  input: CreateRemovePlacementDiffInput
): MapDiff {
  return {
    id: input.id,
    operation: "remove",
    placementId: input.placementId,
    reason: input.reason,
    createdAt: input.createdAt,
    tags: input.tags ?? ["map_diff", "remove_placement"],
  }
}

export function createUpdatePlacementDiff(
  input: CreateUpdatePlacementDiffInput
): MapDiff {
  return {
    id: input.id,
    operation: "update",
    placementId: input.placementId,
    patch: input.patch,
    reason: input.reason,
    createdAt: input.createdAt,
    tags: input.tags ?? ["map_diff", "update_placement"],
  }
}

export function createMovePlacementDiff(
  input: CreateMovePlacementDiffInput
): MapDiff {
  return {
    id: input.id,
    operation: "move",
    placementId: input.placementId,
    patch: input.patch,
    reason: input.reason,
    createdAt: input.createdAt,
    tags: input.tags ?? ["map_diff", "move_placement"],
  }
}

function applyMapDiff(
  placements: MapPlacement[],
  diff: MapDiff
): MapPlacement[] {
  if (diff.operation === "add") {
    if (!diff.placement) return placements

    return [
      ...placements.filter((placement) => placement.id !== diff.placementId),
      diff.placement,
    ]
  }

  if (diff.operation === "remove") {
    return placements.filter((placement) => placement.id !== diff.placementId)
  }

  if (diff.operation === "update" || diff.operation === "move") {
    if (!diff.patch) return placements

    return placements.map((placement) => {
      if (placement.id !== diff.placementId) return placement

      return {
        ...placement,
        ...diff.patch,
        tags: diff.patch?.tags ? [...diff.patch.tags] : placement.tags,
      }
    })
  }

  return placements
}
