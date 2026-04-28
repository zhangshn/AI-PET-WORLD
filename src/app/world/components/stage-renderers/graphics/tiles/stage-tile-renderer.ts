/**
 * 当前文件负责：组织世界地图地块渲染流程。
 */

import { Graphics } from "pixi.js"

import { drawTileBase } from "./tile-base-renderer"
import { drawTileDetail } from "./tile-detail-renderer"
import { drawTileEdges } from "./tile-edge-renderer"
import type { DrawWorldTilesInput, TileContext } from "./tile-types"
import { getTileColor } from "./tile-utils"

export function drawWorldTiles(input: DrawWorldTilesInput) {
  if (!input.map) return

  const terrainGraphic = new Graphics()
  const detailGraphic = new Graphics()

  for (const tile of input.map.tiles) {
    const x = tile.x * input.map.tileSize
    const y = tile.y * input.map.tileSize

    const context: TileContext = {
      map: input.map,
      type: tile.type,
      x,
      y,
      tileX: tile.x,
      tileY: tile.y,
      tileSize: input.map.tileSize,
    }

    drawTileBase(terrainGraphic, context)
    drawTileEdges(terrainGraphic, context)
    drawTileDetail(detailGraphic, context)
  }

  input.terrainLayer.addChild(terrainGraphic)
  input.detailLayer.addChild(detailGraphic)
}

export { getTileColor }
export type { DrawWorldTilesInput, TileContext }