/**
 * 当前文件负责：定义地图摆放规则与校验函数。
 */

import type { InitialHomeSceneRecipe } from "@/world/generation/generation-schema"
import type {
  HomeZone,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

import {
  INITIAL_HOME_LAYOUT_RULES,
  getPlacementDistance,
  isNatureBoundaryPlacement,
  isPointInZone,
  isSupportPlacement,
  isSurfaceDecorationPlacement,
  shouldAvoidCoreZone,
  shouldAvoidPathOverlap,
  shouldStayNearSupport,
} from "./layout-rules"
import type {
  PlacementRule,
  PlacementRuleResult,
} from "./placement-schema"

export const PLACEMENT_RULES = {
  completeGroundCoverage: {
    id: "complete_ground_coverage",
    description: "基础地表 tile 必须完整覆盖地图。",
    severity: "block",
    tags: ["placement", "ground", "tilemap"],
  },
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
  preventCoreZoneScatter: {
    id: "prevent_core_zone_scatter",
    description: "防止自然物件、装饰和材料堆散入核心区中心。",
    severity: "warn",
    tags: ["placement", "layout", "core_zone"],
  },
  preventPathOverlap: {
    id: "prevent_path_overlap",
    description: "防止自然物件、装饰和材料堆压住主路径。",
    severity: "block",
    tags: ["placement", "layout", "path"],
  },
  ensureFacilityHasSupport: {
    id: "ensure_facility_has_support",
    description: "设施必须靠近承托地面或路径。",
    severity: "block",
    tags: ["placement", "layout", "support"],
  },
  ensureNatureAsBoundary: {
    id: "ensure_nature_as_boundary",
    description: "树和灌木主要用于自然边界。",
    severity: "warn",
    tags: ["placement", "layout", "nature"],
  },
  ensureDecorationNearEdge: {
    id: "ensure_decoration_near_edge",
    description: "地表装饰应靠近边缘或承托过渡。",
    severity: "warn",
    tags: ["placement", "layout", "decoration"],
  },
  ensureMaterialPileNearConstructionZone: {
    id: "ensure_material_pile_near_construction_zone",
    description: "建设材料堆必须靠近建设区域但不贴宠物床。",
    severity: "warn",
    tags: ["placement", "layout", "construction"],
  },
} as const satisfies Record<string, PlacementRule>

export const INITIAL_HOME_PLACEMENT_RULE_SET: PlacementRule[] = [
  PLACEMENT_RULES.completeGroundCoverage,
  PLACEMENT_RULES.noIsolatedAssets,
  PLACEMENT_RULES.requiresBuildingGroundSupport,
  PLACEMENT_RULES.requiresFacilityGroundSupport,
  PLACEMENT_RULES.continuousPath,
  PLACEMENT_RULES.avoidCollision,
  PLACEMENT_RULES.clusterCoreLivingArea,
  PLACEMENT_RULES.higherNaturalBoundaryDensity,
  PLACEMENT_RULES.avoidEmptyCentralGrass,
  PLACEMENT_RULES.forbidOldBirthDeviceTags,
  PLACEMENT_RULES.preventCoreZoneScatter,
  PLACEMENT_RULES.preventPathOverlap,
  PLACEMENT_RULES.ensureFacilityHasSupport,
  PLACEMENT_RULES.ensureNatureAsBoundary,
  PLACEMENT_RULES.ensureDecorationNearEdge,
  PLACEMENT_RULES.ensureMaterialPileNearConstructionZone,
]

export function validatePlacementRules(input: {
  placements: MapPlacement[]
  recipe: InitialHomeSceneRecipe
}): PlacementRuleResult[] {
  const zones = buildZonesFromRecipe(input.recipe)

  return [
    validateGroundCoverage(input.placements, input.recipe),
    validateForbiddenTags(input.placements),
    validatePathContinuity(input.placements),
    validateCoreSupport(input.placements, "structure"),
    validateCoreSupport(input.placements, "facility"),
    validateCollision(input.placements),
    validateCentralDensity(input.placements),
    validateNaturalBoundaryDensity(input.placements),
    validateCoreLivingCluster(input.placements, input.recipe),
    validateCoreZoneScatter(input.placements, zones, input.recipe),
    validatePathOverlap(input.placements),
    validateFacilityHasSupport(input.placements),
    validateNatureAsBoundary(input.placements, zones, input.recipe),
    validateDecorationNearEdge(input.placements),
    validateMaterialPileNearConstructionZone(input.placements, zones),
  ]
}

export function validateGroundCoverage(
  placements: MapPlacement[],
  recipe: InitialHomeSceneRecipe
): PlacementRuleResult {
  const expectedCount = recipe.mapSize.columns * recipe.mapSize.rows
  const baseGroundPlacements = placements.filter((placement) =>
    placement.tags.includes("tilemap_ground")
  )
  const seen = new Set<string>()
  const duplicateIds: string[] = []
  const outOfRangeIds: string[] = []

  baseGroundPlacements.forEach((placement) => {
    const key = `${placement.x}:${placement.y}`

    if (seen.has(key)) duplicateIds.push(placement.id)
    seen.add(key)

    if (
      placement.x < 1 ||
      placement.y < 1 ||
      placement.x > recipe.mapSize.columns ||
      placement.y > recipe.mapSize.rows
    ) {
      outOfRangeIds.push(placement.id)
    }
  })

  const missingIds: string[] = []

  for (let y = 1; y <= recipe.mapSize.rows; y += 1) {
    for (let x = 1; x <= recipe.mapSize.columns; x += 1) {
      if (!seen.has(`${x}:${y}`)) {
        missingIds.push(`ground-${x}-${y}`)
      }
    }
  }

  const affected = [...duplicateIds, ...outOfRangeIds, ...missingIds]

  return result(
    "complete_ground_coverage",
    baseGroundPlacements.length === expectedCount && affected.length === 0,
    affected.length === 0
      ? `基础地表完整覆盖 ${expectedCount} 个 tile。`
      : "基础地表 tile 存在缺失、重复或越界。",
    affected
  )
}

function validateForbiddenTags(placements: MapPlacement[]): PlacementRuleResult {
  const forbiddenTags = new Set(["old_birth_device"])
  const affected = placements
    .filter((placement) => placement.tags.some((tag) => forbiddenTags.has(tag)))
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
  const support = getSupportPlacements(placements)
  const unsupported = placements.filter(
    (placement) =>
      placement.layer === layer &&
      !shouldStayNearSupport({
        point: placement,
        supportPlacements: support,
        maxDistance: INITIAL_HOME_LAYOUT_RULES.support.supportNearDistance,
      })
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

function validateCoreLivingCluster(
  inputPlacements: MapPlacement[],
  recipe: InitialHomeSceneRecipe
): PlacementRuleResult {
  const coreAreaTypes = new Set([
    "pet_arrival",
    "initial_care",
    "temporary_shelter",
    "pet_rest",
  ])
  const coreZones = recipe.areas.filter((area) =>
    coreAreaTypes.has(area.areaType)
  )
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
    maxDistance <= 48
      ? "核心生活区保持聚合。"
      : "核心生活区距离过远。",
    []
  )
}

function validateCoreZoneScatter(
  placements: MapPlacement[],
  zones: HomeZone[],
  recipe: InitialHomeSceneRecipe
): PlacementRuleResult {
  const affected = placements
    .filter(
      (placement) =>
        (isNatureBoundaryPlacement(placement) ||
          isSurfaceDecorationPlacement(placement) ||
          placement.tags.includes("construction_material")) &&
        shouldAvoidCoreZone({
          point: placement,
          zones,
          mapSize: recipe.mapSize,
        })
    )
    .map((placement) => placement.id)

  return result(
    "prevent_core_zone_scatter",
    affected.length === 0,
    affected.length === 0
      ? "自然、装饰和材料未散入核心区中心。"
      : "部分自然、装饰或材料进入核心区中心。",
    affected
  )
}

function validatePathOverlap(placements: MapPlacement[]): PlacementRuleResult {
  const pathPlacements = placements.filter((placement) => placement.layer === "path")
  const affected = placements
    .filter(
      (placement) =>
        (isNatureBoundaryPlacement(placement) ||
          isSurfaceDecorationPlacement(placement) ||
          placement.tags.includes("construction_material")) &&
        shouldAvoidPathOverlap({
          point: placement,
          pathPlacements,
          minDistance: 0,
        })
    )
    .map((placement) => placement.id)

  return result(
    "prevent_path_overlap",
    affected.length === 0,
    affected.length === 0
      ? "路径未被自然物件、装饰或材料压住。"
      : "路径被自然物件、装饰或材料压住。",
    affected
  )
}

function validateFacilityHasSupport(
  placements: MapPlacement[]
): PlacementRuleResult {
  const support = getSupportPlacements(placements)
  const affected = placements
    .filter(
      (placement) =>
        placement.layer === "facility" &&
        !shouldStayNearSupport({
          point: placement,
          supportPlacements: support,
          maxDistance:
            INITIAL_HOME_LAYOUT_RULES.functionalCore.facilitySupportMaxDistance,
        })
    )
    .map((placement) => placement.id)

  return result(
    "ensure_facility_has_support",
    affected.length === 0,
    affected.length === 0
      ? "设施均靠近承托地面或路径。"
      : "部分设施缺少承托关系。",
    affected
  )
}

function validateNatureAsBoundary(
  placements: MapPlacement[],
  zones: HomeZone[],
  recipe: InitialHomeSceneRecipe
): PlacementRuleResult {
  const nature = placements.filter(isNatureBoundaryPlacement)
  const visualCenter = zones.find((zone) => zone.type === "visual_center")
  const insideVisualCenterCount = visualCenter
    ? nature.filter((placement) => isPointInZone(placement, visualCenter)).length
    : 0
  const ratio = nature.length === 0 ? 0 : insideVisualCenterCount / nature.length
  const affected =
    ratio <=
    INITIAL_HOME_LAYOUT_RULES.natureBoundary.natureMaxInsideVisualCenterRatio
      ? []
      : nature
          .filter((placement) =>
            visualCenter ? isPointInZone(placement, visualCenter) : false
          )
          .map((placement) => placement.id)

  return result(
    "ensure_nature_as_boundary",
    affected.length === 0,
    affected.length === 0
      ? "树和灌木主要作为自然边界。"
      : `树和灌木进入视觉中心比例过高，当前 ${ratio.toFixed(2)}。`,
    recipe.mapSize.columns > 0 ? affected : []
  )
}

function validateDecorationNearEdge(
  placements: MapPlacement[]
): PlacementRuleResult {
  const support = placements.filter(isSupportPlacement)
  const decoration = placements.filter(isSurfaceDecorationPlacement)
  const affected = decoration
    .filter(
      (placement) =>
        !support.some(
          (candidate) =>
            getPlacementDistance(placement, candidate) <=
            INITIAL_HOME_LAYOUT_RULES.surfaceDecoration
              .decorationPreferredNearSupportEdge
        ) && !placement.tags.includes("natural_detail")
    )
    .map((placement) => placement.id)

  return result(
    "ensure_decoration_near_edge",
    affected.length === 0,
    affected.length === 0
      ? "地表装饰靠近边缘、承托或过渡区域。"
      : "部分地表装饰离边缘或承托过远。",
    affected
  )
}

function validateMaterialPileNearConstructionZone(
  placements: MapPlacement[],
  zones: HomeZone[]
): PlacementRuleResult {
  const restZone = zones.find((zone) => zone.type === "pet_rest")
  const petBed = placements.find((placement) => placement.id === "pet-bed")
  const materials = placements.filter((placement) =>
    placement.tags.includes("construction_material")
  )
  const affected = materials
    .filter((placement) => {
      const tooFarFromRest = restZone
        ? !isPointNearZone(
            placement,
            restZone,
            INITIAL_HOME_LAYOUT_RULES.constructionMaterial
              .materialTargetZoneMaxDistance
          )
        : false
      const tooCloseToPetBed = petBed
        ? getPlacementDistance(placement, petBed) <
          INITIAL_HOME_LAYOUT_RULES.constructionMaterial.materialPetBedMinDistance
        : false

      return tooFarFromRest || tooCloseToPetBed
    })
    .map((placement) => placement.id)

  return result(
    "ensure_material_pile_near_construction_zone",
    affected.length === 0,
    affected.length === 0
      ? "建设材料靠近目标区域且未贴住宠物床。"
      : "建设材料距离目标区过远或贴住宠物床。",
    affected
  )
}

function getSupportPlacements(placements: MapPlacement[]): MapPlacement[] {
  return placements.filter(
    (placement) => isSupportPlacement(placement) || placement.layer === "path"
  )
}

function buildZonesFromRecipe(recipe: InitialHomeSceneRecipe): HomeZone[] {
  return recipe.areas.map((area) => ({
    id: area.id,
    type: area.areaType,
    name: area.name,
    purpose: area.purpose,
    bounds: {
      x: area.center.x - Math.floor(area.size.width / 2),
      y: area.center.y - Math.floor(area.size.height / 2),
      width: area.size.width,
      height: area.size.height,
    },
    tags: area.tags,
  }))
}

function isPointNearZone(
  point: MapPlacement,
  zone: HomeZone,
  maxDistance: number
): boolean {
  if (isPointInZone(point, zone)) return true

  const nearestX = Math.min(
    zone.bounds.x + zone.bounds.width - 1,
    Math.max(zone.bounds.x, point.x)
  )
  const nearestY = Math.min(
    zone.bounds.y + zone.bounds.height - 1,
    Math.max(zone.bounds.y, point.y)
  )

  return (
    Math.abs(point.x - nearestX) + Math.abs(point.y - nearestY) <= maxDistance
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
