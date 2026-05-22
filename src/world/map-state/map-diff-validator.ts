/**
 * 当前文件负责：校验地图变化是否允许写入家园状态。
 */

import {
  WORLD_MAP_ASSETS,
  type WorldMapAssetId,
} from "@/world/map-assets/world-map-asset-registry"

import type {
  HomeMapState,
  MapCoordinate,
  MapDiff,
  MapPlacement,
  MapPlacementLayer,
} from "./home-map-state-schema"

export type RejectedMapDiff = {
  diff: MapDiff
  reason: string
  tags: string[]
}

export type MapDiffValidationResult = {
  acceptedDiffs: MapDiff[]
  rejectedDiffs: RejectedMapDiff[]
  warnings: string[]
}

export type ValidateMapDiffsInput = {
  homeMapState: HomeMapState
  mapDiffs: MapDiff[]
}

export function validateMapDiffs(
  input: ValidateMapDiffsInput
): MapDiffValidationResult {
  const acceptedDiffs: MapDiff[] = []
  const rejectedDiffs: RejectedMapDiff[] = []
  const workingPlacements = [...input.homeMapState.placements]

  input.mapDiffs.forEach((diff) => {
    const rejectionReason = getMapDiffRejectionReason({
      homeMapState: {
        ...input.homeMapState,
        placements: workingPlacements,
      },
      diff,
    })

    if (rejectionReason) {
      rejectedDiffs.push({
        diff,
        reason: rejectionReason,
        tags: ["map_diff_rejected"],
      })

      return
    }

    acceptedDiffs.push(diff)

    if (diff.operation === "add" && diff.placement) {
      workingPlacements.push(diff.placement)
    }

    if (diff.operation === "remove") {
      const index = workingPlacements.findIndex(
        (placement) => placement.id === diff.placementId
      )

      if (index >= 0) workingPlacements.splice(index, 1)
    }

    if ((diff.operation === "update" || diff.operation === "move") && diff.patch) {
      const index = workingPlacements.findIndex(
        (placement) => placement.id === diff.placementId
      )

      if (index >= 0) {
        workingPlacements[index] = {
          ...workingPlacements[index],
          ...diff.patch,
          tags: diff.patch.tags
            ? [...diff.patch.tags]
            : workingPlacements[index].tags,
        }
      }
    }
  })

  return {
    acceptedDiffs,
    rejectedDiffs,
    warnings: rejectedDiffs.map((item) => item.reason),
  }
}

function getMapDiffRejectionReason(input: {
  homeMapState: HomeMapState
  diff: MapDiff
}): string | null {
  const { homeMapState, diff } = input

  if (!diff.id.trim()) return "MapDiff 缺少 id。"
  if (!diff.placementId.trim()) return "MapDiff 缺少 placementId。"

  if (diff.operation === "add") {
    if (!diff.placement) return "add 类型 MapDiff 必须包含 placement。"
    if (diff.placement.id !== diff.placementId) {
      return "add 类型 MapDiff 的 placement.id 必须等于 placementId。"
    }
    if (placementExists(homeMapState, diff.placementId)) {
      return `placementId 已存在：${diff.placementId}`
    }

    return getPlacementRejectionReason(homeMapState, diff.placement)
  }

  const existingPlacement = homeMapState.placements.find(
    (placement) => placement.id === diff.placementId
  )

  if (!existingPlacement) {
    return `${diff.operation} 类型 MapDiff 指向不存在的 placement：${diff.placementId}`
  }

  if (diff.operation === "remove") {
    if (isProtectedPlacement(existingPlacement)) {
      return `不能删除受保护的核心 placement：${diff.placementId}`
    }

    return null
  }

  if (diff.operation === "update") {
    if (!diff.patch) return "update 类型 MapDiff 必须包含 patch。"
    return null
  }

  if (diff.operation === "move") {
    if (!diff.patch) return "move 类型 MapDiff 必须包含 patch。"
    if (isProtectedPlacement(existingPlacement)) {
      return `不能移动受保护的核心 placement：${diff.placementId}`
    }

    const nextPoint = {
      x: diff.patch.x ?? existingPlacement.x,
      y: diff.patch.y ?? existingPlacement.y,
    }

    if (!isInsideMap(homeMapState, nextPoint)) {
      return `move 类型 MapDiff 坐标越界：${nextPoint.x},${nextPoint.y}`
    }

    if (
      hasBlockingPlacementAtPoint(homeMapState, nextPoint, existingPlacement.id)
    ) {
      return `move 类型 MapDiff 目标坐标被占用：${nextPoint.x},${nextPoint.y}`
    }

    return null
  }

  return null
}

function getPlacementRejectionReason(
  homeMapState: HomeMapState,
  placement: MapPlacement
): string | null {
  if (!isRegisteredAssetId(placement.assetId)) {
    return `assetId 未注册：${placement.assetId}`
  }

  if (!isInsideMap(homeMapState, placement)) {
    return `placement 坐标越界：${placement.x},${placement.y}`
  }

  if (!isLayerCompatibleWithAsset(placement.layer, placement.assetId)) {
    return `placement layer 与 asset category 不匹配：${placement.layer} / ${placement.assetId}`
  }

  const placementsAtPoint = homeMapState.placements.filter(
    (candidate) => candidate.x === placement.x && candidate.y === placement.y
  )

  if (placementsAtPoint.some(isProtectedPlacement)) {
    return `目标坐标存在受保护核心对象：${placement.x},${placement.y}`
  }

  if (
    placementsAtPoint.some((candidate) => candidate.layer === "path") &&
    placement.layer !== "path" &&
    placement.layer !== "ground" &&
    placement.layer !== "edge"
  ) {
    return `不能覆盖主路径：${placement.x},${placement.y}`
  }

  if (hasBlockingPlacementAtPoint(homeMapState, placement, placement.id)) {
    return `目标坐标已有阻挡对象：${placement.x},${placement.y}`
  }

  if (
    (placement.layer === "facility" || placement.layer === "structure") &&
    homeMapState.resources.materialReadiness < 5
  ) {
    return "材料准备度过低，暂时不能添加设施或建筑。"
  }

  if (hasTooManyNearbySimilarDecorations(homeMapState, placement)) {
    return "附近同类装饰过多，拒绝重复堆叠。"
  }

  return null
}

function isRegisteredAssetId(assetId: WorldMapAssetId): boolean {
  return Object.prototype.hasOwnProperty.call(WORLD_MAP_ASSETS, assetId)
}

function isInsideMap(
  homeMapState: HomeMapState,
  point: MapCoordinate
): boolean {
  return (
    point.x >= 1 &&
    point.y >= 1 &&
    point.x <= homeMapState.mapSize.columns &&
    point.y <= homeMapState.mapSize.rows
  )
}

function placementExists(
  homeMapState: HomeMapState,
  placementId: string
): boolean {
  return homeMapState.placements.some(
    (placement) => placement.id === placementId
  )
}

function isLayerCompatibleWithAsset(
  layer: MapPlacementLayer,
  assetId: WorldMapAssetId
): boolean {
  const category = WORLD_MAP_ASSETS[assetId].category

  const expectedLayerByCategory: Record<string, MapPlacementLayer> = {
    ground: "ground",
    path: "path",
    edge: "edge",
    zone: "zone",
    structure: "structure",
    facility: "facility",
    nature: "nature",
    surface_decoration: "surface-decoration",
    actor: "actor",
    atmosphere: "atmosphere",
  }

  return expectedLayerByCategory[category] === layer
}

function hasBlockingPlacementAtPoint(
  homeMapState: HomeMapState,
  point: MapCoordinate,
  ignoredPlacementId: string
): boolean {
  return homeMapState.placements.some((placement) => {
    if (placement.id === ignoredPlacementId) return false
    if (placement.x !== point.x || placement.y !== point.y) return false

    return (
      placement.layer === "structure" ||
      placement.layer === "facility" ||
      placement.layer === "nature" ||
      placement.layer === "actor"
    )
  })
}

function isProtectedPlacement(placement: MapPlacement): boolean {
  const protectedTags = [
    "core_living",
    "arrival_focus",
    "temporary_shelter",
    "butler",
    "actor",
  ]

  return protectedTags.some((tag) => placement.tags.includes(tag))
}

function hasTooManyNearbySimilarDecorations(
  homeMapState: HomeMapState,
  placement: MapPlacement
): boolean {
  if (placement.layer !== "surface-decoration") return false

  const nearbySameAssetCount = homeMapState.placements.filter((candidate) => {
    if (candidate.assetId !== placement.assetId) return false
    if (candidate.layer !== "surface-decoration") return false

    const distance =
      Math.abs(candidate.x - placement.x) + Math.abs(candidate.y - placement.y)

    return distance <= 3
  }).length

  return nearbySameAssetCount >= 4
}
