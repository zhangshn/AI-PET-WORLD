/**
 * 当前文件负责：定义初始家园地图布局规则。
 */

import type {
  HomeMapSize,
  HomeZone,
  MapCoordinate,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

export type PlacementLayoutRole =
  | "functional_core"
  | "nature_boundary"
  | "surface_decoration"
  | "support"
  | "path"
  | "construction_material"
  | "actor"
  | "other"

export type LayoutPointInput = {
  point: MapCoordinate
  zones: HomeZone[]
  mapSize: HomeMapSize
}

export type PlacementLayoutInput = {
  placement: MapPlacement
  zones: HomeZone[]
  placements?: MapPlacement[]
  mapSize: HomeMapSize
}

export const INITIAL_HOME_LAYOUT_RULES = {
  functionalCore: {
    functionalCoreMaxDistance: 32,
    facilitySupportMaxDistance: 3,
    actorCoreMaxDistance: 18,
  },
  support: {
    supportRequiredForLayers: ["structure", "facility"] as const,
    supportNearDistance: 2,
    supportEdgeSoftness: 0.3,
  },
  path: {
    pathBlockingLayers: ["nature", "facility", "structure"] as const,
    pathDecorationForbidden: true,
    pathCoreClearance: 1,
  },
  natureBoundary: {
    natureCoreAvoidDistance: 4,
    naturePathAvoidDistance: 2,
    natureBoundaryPreferredDistance: 8,
    natureMaxInsideVisualCenterRatio: 0.2,
  },
  surfaceDecoration: {
    decorationPathAvoidDistance: 1,
    decorationFacilityAvoidDistance: 1,
    decorationMaxDensityInCore: 0.25,
    decorationPreferredNearSupportEdge: 2,
  },
  constructionMaterial: {
    materialTargetZoneMaxDistance: 5,
    materialLivingPointMinDistance: 2,
    materialPathMaxDistance: 3,
  },
} as const

const CORE_ZONE_TYPES = new Set([
  "entry_area",
  "initial_care",
  "temporary_shelter",
  "quiet_living",
  "storage_tools",
])

export function classifyPlacementRole(
  placement: MapPlacement
): PlacementLayoutRole {
  if (placement.layer === "path") return "path"
  if (placement.layer === "actor") return "actor"
  if (isSupportPlacement(placement)) return "support"
  if (placement.tags.includes("construction_material")) {
    return "construction_material"
  }
  if (isFunctionalCorePlacement(placement)) return "functional_core"
  if (isNatureBoundaryPlacement(placement)) return "nature_boundary"
  if (isSurfaceDecorationPlacement(placement)) return "surface_decoration"

  return "other"
}

export function isFunctionalCorePlacement(placement: MapPlacement): boolean {
  return (
    placement.tags.includes("core_living") ||
    placement.tags.includes("care") ||
    placement.tags.includes("rest") ||
    placement.tags.includes("quiet_living") ||
    placement.tags.includes("storage") ||
    placement.tags.includes("temporary_shelter")
  )
}

export function isNatureBoundaryPlacement(placement: MapPlacement): boolean {
  return (
    placement.layer === "nature" ||
    placement.tags.includes("nature_boundary") ||
    placement.tags.includes("tree") ||
    placement.tags.includes("bush")
  )
}

export function isSurfaceDecorationPlacement(placement: MapPlacement): boolean {
  return (
    placement.layer === "surface-decoration" ||
    placement.tags.includes("surface_decoration") ||
    placement.tags.includes("construction_decoration")
  )
}

export function isSupportPlacement(placement: MapPlacement): boolean {
  return (
    placement.tags.includes("ground_support") ||
    placement.tags.includes("temporary_shelter_support") ||
    placement.tags.includes("care_support") ||
    placement.tags.includes("quiet_living_support")
  )
}

export function shouldAvoidCoreZone(input: LayoutPointInput): boolean {
  const visualCenter = input.zones.find((zone) => zone.type === "visual_center")
  const coreZones = input.zones.filter((zone) => CORE_ZONE_TYPES.has(zone.type))

  return (
    coreZones.some((zone) => isPointInsideInnerZone(input.point, zone, 1)) ||
    (visualCenter ? isPointInsideInnerZone(input.point, visualCenter, 5) : false)
  )
}

export function shouldAvoidPathOverlap(input: {
  point: MapCoordinate
  pathPlacements: MapPlacement[]
  minDistance?: number
}): boolean {
  const minDistance =
    input.minDistance ?? INITIAL_HOME_LAYOUT_RULES.path.pathCoreClearance

  return input.pathPlacements.some(
    (placement) => getManhattanDistance(input.point, placement) <= minDistance
  )
}

export function shouldStayNearSupport(input: {
  point: MapCoordinate
  supportPlacements: MapPlacement[]
  maxDistance?: number
}): boolean {
  const maxDistance =
    input.maxDistance ?? INITIAL_HOME_LAYOUT_RULES.support.supportNearDistance

  return input.supportPlacements.some(
    (placement) => getManhattanDistance(input.point, placement) <= maxDistance
  )
}

export function scorePlacementLayout(input: PlacementLayoutInput): number {
  const role = classifyPlacementRole(input.placement)
  const placements = input.placements ?? []
  const pathPlacements = placements.filter((placement) => placement.layer === "path")
  const supportPlacements = placements.filter(isSupportPlacement)
  let score = 100

  if (
    (role === "nature_boundary" || role === "surface_decoration") &&
    shouldAvoidCoreZone({
      point: input.placement,
      zones: input.zones,
      mapSize: input.mapSize,
    })
  ) {
    score -= 35
  }

  if (
    (role === "nature_boundary" ||
      role === "surface_decoration" ||
      role === "construction_material") &&
    shouldAvoidPathOverlap({
      point: input.placement,
      pathPlacements,
      minDistance:
        role === "nature_boundary"
          ? INITIAL_HOME_LAYOUT_RULES.natureBoundary.naturePathAvoidDistance
          : INITIAL_HOME_LAYOUT_RULES.surfaceDecoration.decorationPathAvoidDistance,
    })
  ) {
    score -= 35
  }

  if (
    (input.placement.layer === "facility" || input.placement.layer === "structure") &&
    !shouldStayNearSupport({
      point: input.placement,
      supportPlacements,
      maxDistance: INITIAL_HOME_LAYOUT_RULES.support.supportNearDistance,
    })
  ) {
    score -= 30
  }

  return Math.max(0, score)
}

export function getPlacementDistance(
  first: MapCoordinate,
  second: MapCoordinate
): number {
  return getManhattanDistance(first, second)
}

export function isPointInZone(point: MapCoordinate, zone: HomeZone): boolean {
  return (
    point.x >= zone.bounds.x &&
    point.x < zone.bounds.x + zone.bounds.width &&
    point.y >= zone.bounds.y &&
    point.y < zone.bounds.y + zone.bounds.height
  )
}

function isPointInsideInnerZone(
  point: MapCoordinate,
  zone: HomeZone,
  padding: number
): boolean {
  return (
    point.x >= zone.bounds.x + padding &&
    point.x < zone.bounds.x + zone.bounds.width - padding &&
    point.y >= zone.bounds.y + padding &&
    point.y < zone.bounds.y + zone.bounds.height - padding
  )
}

function getManhattanDistance(
  first: MapCoordinate,
  second: MapCoordinate
): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y)
}
