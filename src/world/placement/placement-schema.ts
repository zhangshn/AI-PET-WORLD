/**
 * 当前文件负责：定义 Placement Engine 类型。
 */

import type {
  HomeZone,
  MapBounds,
  MapPlacement,
  MapPlacementLayer,
} from "@/world/map-state/home-map-state-schema"

import type {
  ButlerConstructionStyleVector,
  InitialHomeAreaRecipe,
  InitialHomeSceneRecipe,
} from "@/world/generation/generation-schema"

export type PlacementAnchor = "top-left" | "bottom-center" | "center"

export type PlacementCollisionBox = MapBounds

export type PlacementArea = InitialHomeAreaRecipe & {
  bounds: MapBounds
}

export type PlacementRuleId =
  | "no_isolated_assets"
  | "requires_building_ground_support"
  | "requires_facility_ground_support"
  | "continuous_path"
  | "avoid_collision"
  | "cluster_core_living_area"
  | "higher_natural_boundary_density"
  | "avoid_empty_central_grass"
  | "complete_ground_coverage"
  | "forbid_old_birth_device_tags"

export type PlacementRule = {
  id: PlacementRuleId
  description: string
  severity: "info" | "warn" | "block"
  tags: string[]
}

export type PlacementRuleResult = {
  ruleId: PlacementRuleId
  passed: boolean
  message: string
  affectedPlacementIds: string[]
}

export type PlacementRequest = {
  worldId: string
  ownerId: string
  seed: string
  recipe: InitialHomeSceneRecipe
  zones: HomeZone[]
  rules: PlacementRule[]
  butlerConstructionStyle: ButlerConstructionStyleVector
}

export type PlacementResult = {
  placements: MapPlacement[]
  ruleResults: PlacementRuleResult[]
  rejectedPlacementIds: string[]
  warnings: string[]
}

export type CreatePlacementInput = {
  id: string
  assetId: MapPlacement["assetId"]
  x: number
  y: number
  layer: MapPlacementLayer
  scale?: number
  alpha?: number
  label: string
  source?: MapPlacement["source"]
  tags?: string[]
}
