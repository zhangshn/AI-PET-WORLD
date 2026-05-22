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

export type WorldLayoutPersonalityInput = {
  structurePreference: number
  carePreference: number
  protectionPreference: number
  aestheticPreference: number
  quietPreference: number
  adaptabilityPreference: number
}

export type WorldLayoutResourceInput = {
  materialReadiness: number
  careReadiness: number
  naturalGrowth: number
  groundHealth: number
  spacePressure: number
}

export type WorldLayoutPhaseInput = {
  phase: "initial_empty_land" | "first_home_seed" | "basic_living_preparation"
  developmentPressure: number
  expansionReadiness: number
}

export type WorldLayoutPathStyle = "direct" | "curved" | "clustered"
export type WorldLayoutShelterBias =
  | "near_center"
  | "edge_protected"
  | "resource_adjacent"
export type WorldLayoutNatureBias = "open" | "soft_boundary" | "dense_boundary"
export type WorldLayoutQuietAreaBias =
  | "near_shelter"
  | "near_nature"
  | "near_care"

export type WorldLayoutVariantInput = {
  variantId: string
  pathStyle: WorldLayoutPathStyle
  shelterBias: WorldLayoutShelterBias
  natureBias: WorldLayoutNatureBias
  quietAreaBias: WorldLayoutQuietAreaBias
}

export type WorldLayoutGenerationInput = {
  worldId: string
  ownerId: string
  seed: string
  birthSignature: string
  worldSalt: string
  personality: WorldLayoutPersonalityInput
  resources: WorldLayoutResourceInput
  phase: WorldLayoutPhaseInput
  variant: WorldLayoutVariantInput
  tags: string[]
}

export type WorldLayoutGenerationAudit = {
  selectedVariant: WorldLayoutVariantInput
  personalityDrivers: string[]
  resourceDrivers: string[]
  phaseDrivers: string[]
  stableSeed: string
  warnings: string[]
  tags: string[]
}

export type WorldLayoutGenerationBuildResult = {
  layoutInput: WorldLayoutGenerationInput
  audit: WorldLayoutGenerationAudit
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
