/**
 * 当前文件负责：定义地图摆放规则与校验函数。
 */

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"
import type { InitialHomeSceneRecipe } from "@/world/generation/generation-schema"

import type {
  PlacementRule,
  PlacementRuleResult,
} from "./placement-schema"

export const PLACEMENT_RULES = {
  noIsolatedAssets: {
    id: "no_isolated_assets",
    description: "禁止素材孤立摆放。",
    severity: "warn",
    tags: ["placement", "semantic_context"],
  },
  requiresBuildingGroundSupport: {
    id: "requires_building_ground_support",
    description: "建筑必须有地面承托。",
    severity: "block",
    tags: ["placement", "ground_support", "structure"],
  },
  requiresFacilityGroundSupport: {
    id: "requires_facility_ground_support",
    description: "设施必须有地面承托。",
    severity: "block",
    tags: ["placement", "ground_support", "facility"],
  },
  continuousPath: {
    id: "continuous_path",
    description: "道路必须连续。",
    severity: "block",
    tags: ["placement", "path"],
  },
  avoidCollision: {
    id: "avoid_collision",
    description: "避免核心对象碰撞。",
    severity: "block",
    tags: ["placement", "collision"],
  },
  clusterCoreLivingArea: {
    id: "cluster_core_living_area",
    description: "核心生活区必须聚合。",
    severity: "warn",
    tags: ["placement", "core_living"],
  },
  higherNaturalBoundaryDensity: {
    id: "higher_natural_boundary_density",
    description: "外围自然物件密度应更高。",
    severity: "warn",
    tags: ["placement", "nature_density"],
  },
  avoidEmptyCentralGrass: {
    id: "avoid_empty_central_grass",
    description: "中央不能大面积空草地。",
    severity: "warn",
    tags: ["placement", "visual_center"],
  },
  forbidOldBirthDeviceTags: {
    id: "forbid_old_birth_device_tags",
    description: "禁止旧出生装置相关标签进入地图。",
    severity: "block",
    tags: ["placement", "product_boundary"],
  },
} as const satisfies Record<string, PlacementRule>

export const INITIAL_HOME_PLACEMENT_RULE_SET: PlacementRule[] = [
  PLACEMENT_RULES.noIsolatedAssets,
  PLACEMENT_RULES.requiresBuildingGroundSupport,
  PLACEMENT_RULES.requiresFacilityGroundSupport,
  PLACEMENT_RULES.continuousPath,
  PLACEMENT_RULES.avoidCollision,
  PLACEMENT_RULES.clusterCoreLivingArea,
  PLACEMENT_RULES.higherNaturalBoundaryDensity,
  PLACEMENT_RULES.avoidEmptyCentralGrass,
  PLACEMENT_RULES.forbidOldBirthDeviceTags,
]

export function validatePlacementRules(input: {
  placements: MapPlacement[]
  recipe: InitialHomeSceneRecipe
}): PlacementRuleResult[] {
  return [
    validateForbiddenTags(input.placements),
    validatePathContinuity(input.placements),
    validateCoreSupport(input.placements, "structure"),
    validateCoreSupport(input.placements, "facility"),
    validateCollision(input.placements),
    validateCentralDensity(input.placements),
    validateNaturalBoundaryDensity(input.placements),
    validateCoreLivingCluster(input.placements, input.recipe),
  ]
}

function validateForbiddenTags(placements: MapPlacement[]): PlacementRuleResult {
  const affected = placements
    .filter((placement) =>
      placement.tags.some((tag) => tag === "old_birth_device")
    )
    .map((placement) => placement.id)

  return result(
    "forbid_old_birth_device_tags",
    affected.length === 0,
    affected.length === 0
      ? "未发现旧产品概念标签。"
      : "发现旧产品概念标签。",
    affected
  )
}

function validatePathContinuity(placements: MapPlacement[]): PlacementRuleResult {
  const path = placements.filter((placement) => placement.layer === "path")
  const isolated = path.filter(
    (placement) =>
      !path.some(
        (candidate) =>
          candidate.id !== placement.id &&
          Math.abs(candidate.x - placement.x) +
            Math.abs(candidate.y - placement.y) ===
            1
      )
  )

  return result(
    "continuous_path",
    isolated.length === 0,
    isolated.length === 0 ? "道路连续。" : "道路存在断点。",
    isolated.map((placement) => placement.id)
  )
}

function validateCoreSupport(
  placements: MapPlacement[],
  layer: "structure" | "facility"
): PlacementRuleResult {
  const support = placements.filter((placement) =>
    ["ground", "zone", "path"].includes(placement.layer)
  )
  const unsupported = placements.filter(
    (placement) =>
      placement.layer === layer &&
      !support.some(
        (candidate) =>
          Math.abs(candidate.x - placement.x) <= 2 &&
          Math.abs(candidate.y - placement.y) <= 2
      )
  )

  return result(
    layer === "structure"
      ? "requires_building_ground_support"
      : "requires_facility_ground_support",
    unsupported.length === 0,
    unsupported.length === 0
      ? `${layer} 均有地面承托。`
      : `${layer} 存在缺少地面承托的对象。`,
    unsupported.map((placement) => placement.id)
  )
}

function validateCollision(placements: MapPlacement[]): PlacementRuleResult {
  const seen = new Map<string, string>()
  const affected: string[] = []

  placements.forEach((placement) => {
    if (["ground", "path", "edge", "surface-decoration"].includes(placement.layer)) {
      return
    }

    const key = `${placement.layer}:${placement.x}:${placement.y}`
    const existing = seen.get(key)

    if (existing) {
      affected.push(existing, placement.id)
      return
    }

    seen.set(key, placement.id)
  })

  return result(
    "avoid_collision",
    affected.length === 0,
    affected.length === 0 ? "核心对象未碰撞。" : "核心对象存在坐标碰撞。",
    Array.from(new Set(affected))
  )
}

function validateCentralDensity(placements: MapPlacement[]): PlacementRuleResult {
  const centralCount = placements.filter(
    (placement) =>
      placement.x >= 18 &&
      placement.x <= 62 &&
      placement.y >= 14 &&
      placement.y <= 34 &&
      placement.layer !== "ground"
  ).length

  return result(
    "avoid_empty_central_grass",
    centralCount >= 14,
    centralCount >= 14
      ? "视觉中心已有足够对象。"
      : "视觉中心仍过空。",
    []
  )
}

function validateNaturalBoundaryDensity(
  placements: MapPlacement[]
): PlacementRuleResult {
  const natureCount = placements.filter(
    (placement) =>
      placement.layer === "nature" || placement.layer === "surface-decoration"
  ).length

  return result(
    "higher_natural_boundary_density",
    natureCount >= 14,
    natureCount >= 14
      ? "自然边界密度满足 MVP 要求。"
      : "自然边界密度不足。",
    []
  )
}

function validateCoreLivingCluster(inputPlacements: MapPlacement[], recipe: InitialHomeSceneRecipe): PlacementRuleResult {
  const coreAreaTypes = new Set(["pet_arrival", "initial_care", "temporary_shelter", "pet_rest"])
  const coreZones = recipe.areas.filter((area) => coreAreaTypes.has(area.areaType))
  const maxDistance = coreZones.reduce((max, area) => {
    return Math.max(
      max,
      ...coreZones.map(
        (candidate) =>
          Math.abs(candidate.center.x - area.center.x) +
          Math.abs(candidate.center.y - area.center.y)
      )
    )
  }, 0)

  return result(
    "cluster_core_living_area",
    maxDistance <= 48 && inputPlacements.length > 0,
    maxDistance <= 48 ? "核心生活区保持聚合。" : "核心生活区距离过远。",
    []
  )
}

function result(
  ruleId: PlacementRuleResult["ruleId"],
  passed: boolean,
  message: string,
  affectedPlacementIds: string[]
): PlacementRuleResult {
  return {
    ruleId,
    passed,
    message,
    affectedPlacementIds,
  }
}
