/**
 * 当前文件负责：把 HomeMapState 转换为地图渲染模型。
 */

import type {
  HomeMapSize,
  HomeMapState,
  MapPlacement,
  MapPlacementLayer,
} from "@/world/map-state/home-map-state-schema"

export type HomeMapPlacementsByLayer = Record<
  MapPlacementLayer,
  MapPlacement[]
>

export type HomeMapRenderModel = {
  mapSize: HomeMapSize
  placementsByLayer: HomeMapPlacementsByLayer
  allPlacements: MapPlacement[]
  debugInfo: {
    worldId: string
    ownerId: string
    seed: string
    zoneCount: number
    placementCount: number
    constructionPlanCount: number
  }
}

export function buildHomeMapRenderModel(
  homeMapState: HomeMapState
): HomeMapRenderModel {
  return {
    mapSize: homeMapState.mapSize,
    placementsByLayer: groupPlacementsByLayer(homeMapState.placements),
    allPlacements: [...homeMapState.placements],
    debugInfo: {
      worldId: homeMapState.worldId,
      ownerId: homeMapState.ownerId,
      seed: homeMapState.seed,
      zoneCount: homeMapState.zones.length,
      placementCount: homeMapState.placements.length,
      constructionPlanCount: homeMapState.constructionPlans.length,
    },
  }
}

function groupPlacementsByLayer(
  placements: MapPlacement[]
): HomeMapPlacementsByLayer {
  const grouped = createEmptyLayerMap()

  placements.forEach((placement) => {
    grouped[placement.layer].push(placement)
  })

  return grouped
}

function createEmptyLayerMap(): HomeMapPlacementsByLayer {
  return {
    ground: [],
    path: [],
    edge: [],
    zone: [],
    structure: [],
    facility: [],
    nature: [],
    "surface-decoration": [],
    actor: [],
    atmosphere: [],
  }
}
