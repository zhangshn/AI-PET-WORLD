/**
 * 当前文件负责：提供第一版轻量路径结果，后续可替换为完整寻路算法。
 */

import type { WorldPosition, WorldMapState } from "../map/world-map"

export type WorldPath = {
  points: WorldPosition[]
  blocked: boolean
}

export function buildSimpleWorldPath(input: {
  map: WorldMapState
  from: WorldPosition
  to: WorldPosition
}): WorldPath {
  const targetTile = input.map.tiles.find((tile) => {
    const worldX = tile.x * input.map.tileSize
    const worldY = tile.y * input.map.tileSize

    return (
      Math.abs(worldX - input.to.x) <= input.map.tileSize &&
      Math.abs(worldY - input.to.y) <= input.map.tileSize
    )
  })

  if (targetTile && !targetTile.walkable) {
    return {
      points: [input.from],
      blocked: true,
    }
  }

  return {
    points: [input.from, input.to],
    blocked: false,
  }
}