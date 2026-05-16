/**
 * 当前文件负责：把 HomeMapState 转换为地图渲染模型。
 */

import type {
  HomeMapSize,
  HomeMapState,
  MapPlacement,
  MapPlacementLayer,
} from "@/world/map-state/home-map-state-schema"

import { buildGroundCanvasLayerInput } from "./canvas/build-ground-tile-matrix"
import type { GroundCanvasLayerInput } from "./canvas/ground-canvas-types"

export type HomeMapPlacementsByLayer = Record<
  MapPlacementLayer,
  MapPlacement[]
>

export type HomeMapRenderModel = {
  mapSize: HomeMapSize
  placementsByLayer: HomeMapPlacementsByLayer
  groundCanvas: GroundCanvasLayerInput
  groundPlacements: MapPlacement[]
  supportPlacements: MapPlacement[]
  pathPlacements: MapPlacement[]
  edgePlacements: MapPlacement[]
  zonePlacements: MapPlacement[]
  structurePlacements: MapPlacement[]
  facilityPlacements: MapPlacement[]
  naturePlacements: MapPlacement[]
  surfaceDecorationPlacements: MapPlacement[]
  entityPlacements: MapPlacement[]
  actorPlacements: MapPlacement[]
  atmospherePlacements: MapPlacement[]
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
  const placementsByLayer = groupPlacementsByLayer(homeMapState.placements)
  const supportPlacements = placementsByLayer.ground.filter(isSupportPlacement)
  const groundPlacements = placementsByLayer.ground.filter(
    (placement) => !isSupportPlacement(placement)
  )
  const entityPlacements = [
    ...placementsByLayer.structure,
    ...placementsByLayer.facility,
    ...placementsByLayer.nature,
  ]
  const groundCanvas = buildGroundCanvasLayerInput({
    mapSize: homeMapState.mapSize,
    tileSize: homeMapState.mapSize.tileSize,
    groundPlacements,
    supportPlacements,
    pathPlacements: placementsByLayer.path,
    edgePlacements: placementsByLayer.edge,
    decalPlacements: placementsByLayer["surface-decoration"],
  })

  return {
    mapSize: homeMapState.mapSize,
    placementsByLayer,
    groundCanvas,
    groundPlacements,
    supportPlacements,
    pathPlacements: placementsByLayer.path,
    edgePlacements: placementsByLayer.edge,
    zonePlacements: placementsByLayer.zone,
    structurePlacements: placementsByLayer.structure,
    facilityPlacements: placementsByLayer.facility,
    naturePlacements: placementsByLayer.nature,
    surfaceDecorationPlacements: placementsByLayer["surface-decoration"],
    entityPlacements,
    actorPlacements: placementsByLayer.actor,
    atmospherePlacements: placementsByLayer.atmosphere,
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

function isSupportPlacement(placement: MapPlacement): boolean {
  return (
    placement.tags.includes("ground_support") ||
    placement.tags.includes("temporary_shelter_support") ||
    placement.tags.includes("care_support") ||
    placement.tags.includes("rest_support") ||
    placement.id.startsWith("support-") ||
    placement.id.includes("support")
  )
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
