/**
 * 当前文件负责：根据 recipe 与规则输出地图摆放结果。
 */

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import type {
  PlacementRecipeItem,
  PlacementRejectedItem,
  PlacementRequest,
  PlacementResult,
  PlacementRuleId,
} from "./placement-schema"

const LAYER_ORDER: Record<MapPlacement["layer"], number> = {
  ground: 1,
  path: 2,
  edge: 3,
  zone: 4,
  structure: 5,
  facility: 6,
  nature: 7,
  "surface-decoration": 8,
  actor: 9,
  atmosphere: 10,
}

const DENSITY_LIMIT_BY_ZONE = 12

export function runPlacementEngine(
  request: PlacementRequest
): PlacementResult {
  const warnings: string[] = []
  const rejected: PlacementRejectedItem[] = []
  const placements: MapPlacement[] = []

  request.recipeItems.forEach((item) => {
    const rejection = validatePlacementItem({
      item,
      request,
      placements,
    })

    if (rejection) {
      rejected.push(rejection)
      return
    }

    placements.push(toMapPlacement(item))
  })

  warnings.push(...buildPathWarnings(placements))
  warnings.push(...buildDensityWarnings(placements))

  return {
    placements: sortPlacements(placements),
    rejected,
    warnings,
    appliedRules: request.rules.map((rule) => rule.id),
  }
}

function validatePlacementItem(input: {
  item: PlacementRecipeItem
  request: PlacementRequest
  placements: MapPlacement[]
}): PlacementRejectedItem | null {
  const { item, request, placements } = input

  if (isOutOfBounds(item, request.columns, request.rows)) {
    return reject(item.id, "对象超出地图范围。", "requires_ground_support")
  }

  if (!request.zones.some((zone) => zone.id === item.zoneId)) {
    return reject(item.id, "对象没有可用区域归属。", "no_isolated_assets")
  }

  const sameLayerCollision = placements.some(
    (placement) =>
      placement.layer === item.layer &&
      placement.x === item.x &&
      placement.y === item.y
  )

  if (sameLayerCollision) {
    return reject(item.id, "同一图层坐标发生碰撞。", "avoid_collision")
  }

  return null
}

function toMapPlacement(item: PlacementRecipeItem): MapPlacement {
  return {
    id: item.id,
    assetId: item.assetId,
    layer: item.layer,
    zoneId: item.zoneId,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    scale: item.scale,
    priority: item.priority,
    tags: item.tags,
  }
}

function buildPathWarnings(placements: MapPlacement[]): string[] {
  const pathPlacements = placements.filter(
    (placement) => placement.layer === "path"
  )

  if (pathPlacements.length <= 1) return []

  const isolated = pathPlacements.filter(
    (placement) =>
      !pathPlacements.some(
        (candidate) =>
          candidate.id !== placement.id &&
          getManhattanDistance(placement, candidate) === 1
      )
  )

  if (isolated.length === 0) return []

  return [
    `路径存在 ${isolated.length} 个孤立 tile，需要在 recipe 中修正连接。`,
  ]
}

function buildDensityWarnings(placements: MapPlacement[]): string[] {
  const counts = placements.reduce<Record<string, number>>((acc, placement) => {
    acc[placement.zoneId] = (acc[placement.zoneId] ?? 0) + 1
    return acc
  }, {})

  return Object.entries(counts)
    .filter(([, count]) => count > DENSITY_LIMIT_BY_ZONE)
    .map(
      ([zoneId, count]) =>
        `${zoneId} 区域对象数量为 ${count}，超过 MVP 建议密度。`
    )
}

function isOutOfBounds(
  item: PlacementRecipeItem,
  columns: number,
  rows: number
): boolean {
  return item.x < 1 || item.y < 1 || item.x > columns || item.y > rows
}

function getManhattanDistance(
  a: Pick<MapPlacement, "x" | "y">,
  b: Pick<MapPlacement, "x" | "y">
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function sortPlacements(placements: MapPlacement[]): MapPlacement[] {
  return [...placements].sort((a, b) => {
    const layerDiff = LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer]

    if (layerDiff !== 0) return layerDiff
    if (a.priority !== b.priority) return a.priority - b.priority
    if (a.y !== b.y) return a.y - b.y

    return a.x - b.x
  })
}

function reject(
  itemId: string,
  reason: string,
  ruleId: PlacementRuleId
): PlacementRejectedItem {
  return {
    itemId,
    reason,
    ruleId,
  }
}
