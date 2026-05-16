/**
 * 当前文件负责：统一解析地图 placement 使用的素材注册信息。
 */

import {
  WORLD_MAP_ASSETS,
  type WorldMapAssetId,
} from "@/world/map-assets/world-map-asset-registry"
import type { WorldMapAssetAnchor } from "@/world/map-assets/world-map-asset-schema"

export interface ResolvedMapPlacementAsset {
  assetId: string
  path: string
  anchor?: WorldMapAssetAnchor
  crop?: { sx: number; sy: number; sw: number; sh: number }
}

export function resolveMapPlacementAsset(
  assetId: string
): ResolvedMapPlacementAsset | null {
  if (!isKnownMapAssetId(assetId)) return null

  const asset = WORLD_MAP_ASSETS[assetId]

  return {
    assetId,
    path: asset.path,
    anchor: asset.anchor,
  }
}

function isKnownMapAssetId(assetId: string): assetId is WorldMapAssetId {
  return assetId in WORLD_MAP_ASSETS
}
