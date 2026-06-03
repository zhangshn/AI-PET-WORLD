/**
 * 褰撳墠鏂囦欢鑱岃矗锛氬畾涔?V2.0 runtime 鍦拌矊瑙勫垯涓庤祫婧愮害鏉熷崗璁€? */

import type { ResourceKey } from "@/world/resource-cycle/resource-schema"

export type BiomeType = "grassland" | "forest" | "desert" | "oasis"

export type BiomeResourceRule = {
  resourceKey: ResourceKey
  initial: number
  min: number
  max: number
  regenPerTick: number
  pressure: number
  tags: string[]
}

export type BiomeRule = {
  biomeType: BiomeType
  resources: Record<ResourceKey, BiomeResourceRule>
  layoutModifiers: {
    compactnessBias: number
    boundaryDensityBias: number
    pathFlexibilityBias: number
    shelterSafetyBias: number
  }
  constructionModifiers: {
    materialCostMultiplier: number
    maintenanceRisk: number
  }
  visualTokens: string[]
  tags: string[]
}
