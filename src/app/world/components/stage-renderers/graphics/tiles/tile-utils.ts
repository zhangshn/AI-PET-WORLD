/**
 * 当前文件负责：提供世界地块渲染的类型判断、邻居查询与颜色变化工具。
 */

import type { WorldMapState, WorldMapTileType } from "@/world/map/world-map"

import { getStageTileVisual } from "../../config/stage-visual-config"
import { clampNumber, createPointSeed } from "../../shared/stage-renderer-utils"

export function getTileColor(type: WorldMapTileType): number {
  return getStageTileVisual(type).base
}

export function getTileAt(
  map: WorldMapState,
  x: number,
  y: number
): WorldMapTileType | undefined {
  if (x < 0 || y < 0 || x >= map.size.width || y >= map.size.height) {
    return undefined
  }

  return map.tiles.find((tile) => tile.x === x && tile.y === y)?.type
}

export function isGrassLike(type: WorldMapTileType): boolean {
  return (
    type === "short_grass" ||
    type === "wild_grass" ||
    type === "flower_patch" ||
    type === "forest_edge"
  )
}

export function isPathLike(type: WorldMapTileType): boolean {
  return type === "path" || type === "town_path"
}

export function isSoilLike(type: WorldMapTileType): boolean {
  return type === "soil" || type === "garden_soil" || type === "mud"
}

export function isGroundLike(type: WorldMapTileType): boolean {
  return isGrassLike(type) || isPathLike(type) || isSoilLike(type)
}

export function getTileColorWithVariation(
  type: WorldMapTileType,
  x: number,
  y: number
): number {
  const baseColor = getTileColor(type)
  const variation = (createPointSeed(x, y) % 7) - 3

  if (variation === 0) return baseColor

  const r = (baseColor >> 16) & 255
  const g = (baseColor >> 8) & 255
  const b = baseColor & 255
  const amount = variation * 4

  const nextR = clampNumber(r + amount, 0, 255)
  const nextG = clampNumber(g + amount, 0, 255)
  const nextB = clampNumber(b + amount, 0, 255)

  return (nextR << 16) + (nextG << 8) + nextB
}