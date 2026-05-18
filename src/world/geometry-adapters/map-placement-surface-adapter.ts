/**
 * 当前文件职责：根据地图 placement 推断基础世界地表类型。
 */

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"
import type { WorldSurfaceType } from "@/world/core-rules/world-rule-gateway"

export function inferSurfaceTypeFromPlacement(
  placement: MapPlacement
): WorldSurfaceType {
  if (placement.layer === "ground") {
    return inferGroundSurfaceType(placement)
  }

  if (placement.layer === "path") {
    return "soil"
  }

  if (placement.layer === "structure") {
    return "constructed_foundation"
  }

  if (placement.layer === "facility") {
    return "wood"
  }

  return "grass"
}

function inferGroundSurfaceType(placement: MapPlacement): WorldSurfaceType {
  const normalizedTags = placement.tags.map((tag) => tag.toLowerCase())
  const normalizedAssetId = placement.assetId.toLowerCase()

  if (
    normalizedTags.includes("sand") ||
    normalizedAssetId.includes("sand")
  ) {
    return "sand"
  }

  if (
    normalizedTags.includes("water") ||
    normalizedAssetId.includes("water")
  ) {
    return "water"
  }

  if (
    normalizedTags.includes("stone") ||
    normalizedAssetId.includes("stone")
  ) {
    return "stone"
  }

  return "grass"
}
