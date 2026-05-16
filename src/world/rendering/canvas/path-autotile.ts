/**
 * 当前文件负责：根据路径邻接关系选择路径 tile 变体。
 */

import {
  WORLD_MAP_ASSETS,
  type WorldMapAssetId,
} from "@/world/map-assets/world-map-asset-registry"
import type { MapCoordinate } from "@/world/map-state/home-map-state-schema"

export function getCardinalMask(
  x: number,
  y: number,
  occupied: ReadonlySet<string>
): number {
  let mask = 0

  if (occupied.has(pointKey({ x, y: y - 1 }))) mask += 1
  if (occupied.has(pointKey({ x: x + 1, y }))) mask += 2
  if (occupied.has(pointKey({ x, y: y + 1 }))) mask += 4
  if (occupied.has(pointKey({ x: x - 1, y }))) mask += 8

  return mask
}

export function resolvePathAutotileAssetId(
  mask: number,
  fallbackAssetId: string
): string {
  const candidate = PATH_AUTOTILE_ASSET_BY_MASK[mask]

  if (candidate && candidate in WORLD_MAP_ASSETS) return candidate

  return fallbackAssetId
}

export function pointKey(point: MapCoordinate): string {
  return `${point.x}:${point.y}`
}

const PATH_AUTOTILE_ASSET_BY_MASK: Partial<Record<number, WorldMapAssetId>> = {
  1: "pathDirtVertical01",
  2: "pathDirtHorizontal01",
  3: "pathDirtCornerRightTop01",
  4: "pathDirtVertical01",
  5: "pathDirtVertical01",
  6: "pathDirtCornerRightBottom01",
  8: "pathDirtHorizontal01",
  9: "pathDirtCornerLeftTop01",
  10: "pathDirtHorizontal01",
  12: "pathDirtCornerLeftBottom01",
}
