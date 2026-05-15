/**
 * 当前文件负责：定义地图摆放请求与规则结果类型。
 */

import type { WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"
import type {
  HomeMapLayer,
  HomeZone,
  HomeZoneId,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

export type PlacementAnchor = "top-left" | "bottom-center" | "center"

export type PlacementRuleId =
  | "no_isolated_assets"
  | "requires_ground_support"
  | "continuous_path"
  | "avoid_collision"
  | "zone_density_limit"

export type PlacementLayer = HomeMapLayer

export type PlacementRule = {
  id: PlacementRuleId
  description: string
  severity: "info" | "warn" | "block"
  tags: string[]
}

export type PlacementRecipeItem = {
  id: string
  assetId: WorldMapAssetId
  layer: PlacementLayer
  zoneId: HomeZoneId
  x: number
  y: number
  width: number
  height: number
  scale: number
  priority: number
  anchor: PlacementAnchor
  requiredSupportLayer?: PlacementLayer
  tags: string[]
}

export type PlacementRequest = {
  mapId: string
  columns: number
  rows: number
  tileSize: number
  zones: HomeZone[]
  recipeItems: PlacementRecipeItem[]
  existingPlacements?: MapPlacement[]
  rules: PlacementRule[]
}

export type PlacementRejectedItem = {
  itemId: string
  reason: string
  ruleId: PlacementRuleId
}

export type PlacementResult = {
  placements: MapPlacement[]
  rejected: PlacementRejectedItem[]
  warnings: string[]
  appliedRules: PlacementRuleId[]
}
