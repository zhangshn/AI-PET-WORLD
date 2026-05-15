/**
 * 当前文件负责：定义家园地图状态的数据结构。
 */

import type { WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"

export type HomeMapLayer =
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

export type HomeZoneId =
  | "visual_center"
  | "pet_arrival"
  | "initial_care"
  | "temporary_shelter"
  | "pet_rest"
  | "storage_tools"
  | "natural_boundary"

export type MapCoordinate = {
  x: number
  y: number
}

export type MapBounds = MapCoordinate & {
  width: number
  height: number
}

export type HomeZone = {
  id: HomeZoneId
  name: string
  purpose: string
  bounds: MapBounds
  requiredAssetIds: WorldMapAssetId[]
  optionalAssetIds: WorldMapAssetId[]
  forbiddenTags: string[]
  decorationDensity: "none" | "low" | "medium" | "high"
  pathConnectionTargetIds: HomeZoneId[]
  tags: string[]
}

export type MapPlacement = MapCoordinate & {
  id: string
  assetId: WorldMapAssetId
  layer: HomeMapLayer
  zoneId: HomeZoneId
  width: number
  height: number
  scale: number
  priority: number
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

export type MapDiff = {
  id: string
  reason: string
  addedPlacementIds: string[]
  removedPlacementIds: string[]
  changedPlacementIds: string[]
  tags: string[]
}

export type HomeMapState = {
  id: string
  name: string
  columns: number
  rows: number
  tileSize: number
  seed: string
  zones: HomeZone[]
  placements: MapPlacement[]
  resources: HomeResourceState
  diffs: MapDiff[]
  tags: string[]
}
