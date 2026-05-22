/**
 * 当前文件负责：定义家园地图持久化状态。
 */

import type { WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"

export type HomeMapSize = {
  columns: number
  rows: number
  tileSize: number
}

export type HomeZoneType =
  | "visual_center"
  | "entry_area"
  | "initial_care"
  | "temporary_shelter"
  | "quiet_living"
  | "storage_tools"
  | "natural_boundary"

export type MapPlacementLayer =
  | "ground"
  | "path"
  | "edge"
  | "zone"
  | "structure"
  | "facility"
  | "nature"
  | "surface-decoration"
  | "actor"
  | "atmosphere"

export type MapDiffOperation = "add" | "remove" | "update" | "move"

export type MapCoordinate = {
  x: number
  y: number
}

export type MapBounds = MapCoordinate & {
  width: number
  height: number
}

export type HomeZone = {
  id: string
  type: HomeZoneType
  name: string
  purpose: string
  bounds: MapBounds
  tags: string[]
}

export type HomeResourceState = {
  groundHealth: number
  naturalGrowth: number
  materialReadiness: number
  careReadiness: number
  spacePressure: number
  tags: string[]
}

export type ConstructionPlanSummary = {
  id: string
  title: string
  targetZoneType: HomeZoneType
  status: "planned" | "active" | "paused" | "completed"
  progress: number
  reason: string
  tags: string[]
}

export type MapPlacement = {
  id: string
  assetId: WorldMapAssetId
  x: number
  y: number
  layer: MapPlacementLayer
  scale: number
  alpha: number
  label: string
  source: "scene_recipe" | "placement_engine" | "construction_plan"
  tags: string[]
}

export type MapDiff = {
  id: string
  operation: MapDiffOperation
  placementId: string
  placement?: MapPlacement
  patch?: Partial<
    Pick<MapPlacement, "x" | "y" | "scale" | "alpha" | "label" | "tags">
  >
  reason: string
  createdAt: number
  tags: string[]
}

export type HomeMapState = {
  worldId: string
  ownerId: string
  seed: string
  mapSize: HomeMapSize
  zones: HomeZone[]
  placements: MapPlacement[]
  resources: HomeResourceState
  constructionPlans: ConstructionPlanSummary[]
  mapDiffs: MapDiff[]
  createdAt: number
  updatedAt: number
  tags: string[]
}
