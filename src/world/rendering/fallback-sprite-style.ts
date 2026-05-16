/**
 * 当前文件负责：提供地图素材缺失时的临时像素 fallback。
 */

import {
  WORLD_MAP_ASSETS,
  type WorldMapAssetId,
} from "@/world/map-assets/world-map-asset-registry"

export function buildFallbackSpriteBackground(
  assetId: WorldMapAssetId,
  path: string
): string {
  if (assetId === "groundGrassBase01") {
    return [
      "radial-gradient(circle at 22% 28%, rgba(115, 156, 91, 0.22) 0 12%, transparent 13%)",
      "radial-gradient(circle at 74% 68%, rgba(68, 113, 59, 0.16) 0 10%, transparent 11%)",
      "linear-gradient(135deg, rgba(83, 132, 68, 0.28), rgba(93, 143, 74, 0.2))",
      "linear-gradient(#597f46, #5c8549)",
    ].join(", ")
  }

  if (assetId === "groundGrassBase02") {
    return [
      "radial-gradient(circle at 34% 62%, rgba(132, 166, 96, 0.18) 0 11%, transparent 12%)",
      "radial-gradient(circle at 78% 24%, rgba(64, 111, 59, 0.14) 0 9%, transparent 10%)",
      "linear-gradient(45deg, rgba(91, 137, 72, 0.22), rgba(101, 148, 79, 0.18))",
      "linear-gradient(#5d854a, #5b8248)",
    ].join(", ")
  }

  if (assetId === "butlerBodyStandard01") {
    return [
      "linear-gradient(#2b2524 0 18%, transparent 18%)",
      "linear-gradient(90deg, transparent 0 18%, #d5a37e 18% 32%, transparent 32% 68%, #d5a37e 68% 82%, transparent 82%)",
      "linear-gradient(#d5a37e 0 32%, #60708d 32% 78%, #252b35 78%)",
    ].join(", ")
  }

  if (
    assetId === "petPoseSkeletonIdleFront01" ||
    assetId === "petPartBodyRound01"
  ) {
    return [
      "radial-gradient(circle at 36% 34%, #221817 0 4%, transparent 5%)",
      "radial-gradient(circle at 64% 34%, #221817 0 4%, transparent 5%)",
      "linear-gradient(135deg, transparent 0 12%, #9b604b 12% 24%, transparent 24%)",
      "linear-gradient(225deg, transparent 0 12%, #9b604b 12% 24%, transparent 24%)",
      "linear-gradient(#c78161 0 52%, #a86651 52%)",
    ].join(", ")
  }

  return `url(${path})`
}

export function getFallbackSpriteColor(assetId: WorldMapAssetId): string {
  const asset = WORLD_MAP_ASSETS[assetId]

  if (asset.category === "actor") return "#c78161"
  if (asset.category === "structure") return "#b68756"
  if (asset.category === "facility") return "#d0a45d"
  if (asset.category === "nature") return "#4f8b45"
  if (asset.category === "surface_decoration") return "#76a95f"
  if (asset.category === "edge") return "#80603e"
  if (asset.category === "path") return "#7b5536"

  return "#4c7337"
}
