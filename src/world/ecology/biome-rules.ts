/**
 * 当前文件职责：提供稳定、可审计的地貌资源规则。
 */

import type { BiomeRule, BiomeType } from "./ecology-schema"

export const BIOME_TYPES: readonly BiomeType[] = [
  "grassland",
  "forest",
  "desert",
  "oasis",
]

export const BIOME_RULES: Record<BiomeType, BiomeRule> = {
  grassland: {
    biomeType: "grassland",
    resources: {
      groundHealth: resource("groundHealth", 78, 0, 86, 0.8, 0.18, [
        "stable_soil",
      ]),
      naturalGrowth: resource("naturalGrowth", 46, 0, 70, 0.8, 0.2, [
        "soft_growth",
      ]),
      materialReadiness: resource("materialReadiness", 38, 0, 72, 0.7, 0.16, [
        "balanced_material",
      ]),
      careReadiness: resource("careReadiness", 58, 0, 76, 0.75, 0.14, [
        "easy_care",
      ]),
      spacePressure: resource("spacePressure", 18, 0, 62, -0.12, 0.22, [
        "open_ground",
      ]),
    },
    layoutModifiers: {
      compactnessBias: 0,
      boundaryDensityBias: 0,
      pathFlexibilityBias: 0,
      shelterSafetyBias: 0,
    },
    constructionModifiers: { materialCostMultiplier: 1, maintenanceRisk: 0.24 },
    visualTokens: ["open_ground", "soft_grass", "mvp_starting_biome"],
    tags: ["biome_rule", "grassland", "balanced_resource_profile"],
  },
  forest: {
    biomeType: "forest",
    resources: {
      groundHealth: resource("groundHealth", 72, 0, 82, 0.72, 0.24, [
        "root_bound_soil",
      ]),
      naturalGrowth: resource("naturalGrowth", 68, 0, 92, 1, 0.36, [
        "dense_growth",
      ]),
      materialReadiness: resource("materialReadiness", 48, 0, 82, 0.9, 0.2, [
        "wood_rich",
      ]),
      careReadiness: resource("careReadiness", 52, 0, 70, 0.68, 0.22, [
        "shade_care",
      ]),
      spacePressure: resource("spacePressure", 32, 0, 72, 0.08, 0.42, [
        "dense_boundary",
      ]),
    },
    layoutModifiers: {
      compactnessBias: 0.08,
      boundaryDensityBias: 0.18,
      pathFlexibilityBias: 0.08,
      shelterSafetyBias: 0.06,
    },
    constructionModifiers: { materialCostMultiplier: 0.92, maintenanceRisk: 0.4 },
    visualTokens: ["forest_edge", "dense_boundary", "wood_rich"],
    tags: ["biome_rule", "forest", "growth_heavy_resource_profile"],
  },
  desert: {
    biomeType: "desert",
    resources: {
      groundHealth: resource("groundHealth", 56, 0, 62, 0.45, 0.42, [
        "dry_ground",
      ]),
      naturalGrowth: resource("naturalGrowth", 24, 0, 42, 0.35, 0.5, [
        "water_stress",
      ]),
      materialReadiness: resource("materialReadiness", 34, 0, 64, 0.55, 0.28, [
        "scarce_material",
      ]),
      careReadiness: resource("careReadiness", 42, 0, 58, 0.5, 0.44, [
        "shade_priority",
      ]),
      spacePressure: resource("spacePressure", 26, 0, 55, -0.06, 0.32, [
        "compact_survival",
      ]),
    },
    layoutModifiers: {
      compactnessBias: 0.16,
      boundaryDensityBias: -0.12,
      pathFlexibilityBias: -0.06,
      shelterSafetyBias: 0.16,
    },
    constructionModifiers: { materialCostMultiplier: 1.18, maintenanceRisk: 0.52 },
    visualTokens: ["dry_ground", "water_stress", "shade_priority"],
    tags: ["biome_rule", "desert", "scarcity_resource_profile"],
  },
  oasis: {
    biomeType: "oasis",
    resources: {
      groundHealth: resource("groundHealth", 70, 0, 78, 0.7, 0.22, [
        "water_adjacent_soil",
      ]),
      naturalGrowth: resource("naturalGrowth", 62, 0, 86, 0.92, 0.28, [
        "water_adjacent",
      ]),
      materialReadiness: resource("materialReadiness", 40, 0, 70, 0.68, 0.2, [
        "mixed_material",
      ]),
      careReadiness: resource("careReadiness", 68, 0, 90, 1, 0.16, [
        "care_rich",
      ]),
      spacePressure: resource("spacePressure", 38, 0, 78, 0.1, 0.48, [
        "space_pressure",
      ]),
    },
    layoutModifiers: {
      compactnessBias: 0.12,
      boundaryDensityBias: 0.1,
      pathFlexibilityBias: 0.12,
      shelterSafetyBias: 0.02,
    },
    constructionModifiers: { materialCostMultiplier: 1.04, maintenanceRisk: 0.34 },
    visualTokens: ["water_adjacent", "life_event_ready_later", "space_pressure"],
    tags: ["biome_rule", "oasis", "care_growth_resource_profile"],
  },
}

export function getBiomeRule(biomeType: BiomeType): BiomeRule {
  return BIOME_RULES[biomeType]
}

export function selectBiomeType(input: {
  requestedBiomeType: BiomeType | undefined
  seed: string
}): BiomeType {
  if (input.requestedBiomeType) {
    return input.requestedBiomeType
  }

  const index = Math.floor(
    buildDeterministicRatio(input.seed, "v2-biome-rule") * BIOME_TYPES.length
  )

  return BIOME_TYPES[Math.min(BIOME_TYPES.length - 1, index)]
}

function resource(
  resourceKey: BiomeRule["resources"][keyof BiomeRule["resources"]]["resourceKey"],
  initial: number,
  min: number,
  max: number,
  regenPerTick: number,
  pressure: number,
  tags: string[]
): BiomeRule["resources"][keyof BiomeRule["resources"]] {
  return {
    resourceKey,
    initial,
    min,
    max,
    regenPerTick,
    pressure,
    tags,
  }
}

function buildDeterministicRatio(seed: string, salt: string): number {
  const value = `${seed}:${salt}`
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) / 4294967295
}
