/**
 * 当前文件职责：定义人格驱动房屋偏好的结构化协议。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import type { BiomeType } from "@/world/ecology/ecology-schema"
import type { HomeZoneType } from "@/world/map-state/home-map-state-schema"

export type HouseArchetype =
  | "ordered_compact_cabin"
  | "warm_care_cottage"
  | "protective_courtyard"
  | "quiet_retreat_house"
  | "aesthetic_garden_home"
  | "adaptive_modular_home"

export type HouseMaterialPreference =
  | "balanced_natural_mix"
  | "wood_and_leaf"
  | "stone_and_shade"
  | "water_softened_clay"
  | "lightweight_modular"

export type HouseSpatialPreference = {
  footprint: "compact" | "balanced" | "expandable"
  privacy: "open" | "buffered" | "protected"
  layoutFlow: "ordered" | "soft" | "clustered" | "adaptive"
  preferredAnchorZone: HomeZoneType
  expansionReadiness: number
  maintenanceRisk: number
  tags: string[]
}

export type HousePreference = {
  preferenceId: string
  archetype: HouseArchetype
  materialPreference: HouseMaterialPreference
  spatialPreference: HouseSpatialPreference
  scalePreference: "conservative" | "moderate" | "expandable"
  resourcePosture: "scarce" | "stable" | "abundant"
  sourceBiome: BiomeType
  personalityDrivers: Array<keyof ButlerConstructionStyleVector>
  resourceDrivers: string[]
  styleReason: string
  styleTags: string[]
}

export type HousePreferenceBuildInput = {
  worldId: string
  seed: string
  constructionStyle: ButlerConstructionStyleVector
  biomeType: BiomeType
  resources: {
    materialReadiness: number
    careReadiness: number
    naturalGrowth: number
    groundHealth: number
    spacePressure: number
  }
  maintenanceRisk: number
  materialCostMultiplier: number
  boundaryDensityBias: number
  shelterSafetyBias: number
  tags: string[]
}

export type HousePreferenceAudit = {
  auditId: string
  passed: boolean
  warnings: string[]
  tags: string[]
}
