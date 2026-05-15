/**
 * 当前文件负责：定义世界生成输入与输出类型。
 */

import type { WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"
import type {
  HomeMapSize,
  HomeMapState,
  HomeZone,
  HomeZoneType,
  MapCoordinate,
} from "@/world/map-state/home-map-state-schema"

export type ButlerConstructionStyleVector = {
  structuredBuilder: number
  warmCaretaker: number
  protectiveKeeper: number
  aestheticOrganizer: number
  quietMaintainer: number
  adaptivePlanner: number
}

export type WorldGenerationInput = {
  worldId: string
  ownerId: string
  birthSignature: string
  worldSalt: string
  butlerConstructionStyle: ButlerConstructionStyleVector
  now: number
}

export type InitialHomeAreaType = HomeZoneType

export type InitialHomeAreaRecipe = {
  id: string
  areaType: InitialHomeAreaType
  name: string
  purpose: string
  center: MapCoordinate
  size: {
    width: number
    height: number
  }
  requiredAssets: WorldMapAssetId[]
  optionalAssets: WorldMapAssetId[]
  forbiddenTags: string[]
  density: "none" | "low" | "medium" | "high"
  pathConnections: InitialHomeAreaType[]
  supportRules: string[]
  tags: string[]
}

export type InitialHomeSceneRecipe = {
  id: string
  name: string
  mapSize: HomeMapSize
  visualCenter: {
    start: MapCoordinate
    end: MapCoordinate
  }
  areas: InitialHomeAreaRecipe[]
  tags: string[]
}

export type InitialHomeGenerationInput = WorldGenerationInput & {
  recipe?: InitialHomeSceneRecipe
}

export type InitialHomeGenerationResult = {
  homeMapState: HomeMapState
  zones: HomeZone[]
  warnings: string[]
  rejectedPlacementIds: string[]
  tags: string[]
}
