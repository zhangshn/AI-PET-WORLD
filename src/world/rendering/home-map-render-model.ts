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

export type CanvasBuckets = {
  ground: MapPlacement[]
  path: MapPlacement[]
  edge: MapPlacement[]
  decal: MapPlacement[]
}

export type DomBuckets = {
  nonGroundPlacements: MapPlacement[]
}

export type HomeMapRenderModel = {
  mapSize: HomeMapSize
  tileSize: number
  placementsByLayer: HomeMapPlacementsByLayer
  canvas: CanvasBuckets
  dom: DomBuckets
  canvasRevision: string
  groundPlacements: MapPlacement[]
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
  const allPlacements = [...homeMapState.placements]
  const placementsByLayer = groupPlacementsByLayer(homeMapState.placements)
  const canvas = buildCanvasBuckets(allPlacements)
  const dom = buildDomBuckets(allPlacements)
  const entityPlacements = [
    ...placementsByLayer.structure,
    ...placementsByLayer.facility,
    ...placementsByLayer.nature,
  ]
  const canvasRevision = buildCanvasRevision(
    [...canvas.ground].sort(sortPlacementsForCanvas)
  )

  return {
    mapSize: homeMapState.mapSize,
    tileSize: homeMapState.mapSize.tileSize,
    placementsByLayer,
    canvas,
    dom,
    canvasRevision,
    groundPlacements: placementsByLayer.ground,
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
    allPlacements,
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

function buildCanvasBuckets(placements: MapPlacement[]): CanvasBuckets {
  const canvas: CanvasBuckets = {
    ground: [],
    path: [],
    edge: [],
    decal: [],
  }

  placements.forEach((placement) => {
    if (placement.layer === "ground") canvas.ground.push(placement)
    if (placement.layer === "path") canvas.path.push(placement)
    if (placement.layer === "edge") canvas.edge.push(placement)
    if (placement.layer === "surface-decoration") canvas.decal.push(placement)
  })

  return canvas
}

function buildDomBuckets(placements: MapPlacement[]): DomBuckets {
  return {
    nonGroundPlacements: placements.filter(
      (placement) => placement.layer !== "ground"
    ),
  }
}

function buildCanvasRevision(placements: readonly MapPlacement[]): string {
  let hash = 0x811c9dc5

  placements.forEach((placement) => {
    const token = [
      placement.id,
      placement.assetId,
      placement.layer,
      placement.x,
      placement.y,
    ].join("|")

    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index)
      hash = Math.imul(hash, 0x01000193)
    }
  })

  return (hash >>> 0).toString(36)
}

function sortPlacementsForCanvas(
  left: MapPlacement,
  right: MapPlacement
): number {
  return left.y - right.y || left.x - right.x || left.id.localeCompare(right.id)
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
