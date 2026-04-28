/**
 * 当前文件负责：渲染世界地图地块之间的边缘、水岸与过渡像素。
 */

import { Graphics } from "pixi.js"

import type { WorldMapTileType } from "@/world/map/world-map"

import { getStageTileVisual } from "../../config/stage-visual-config"
import { createPointSeed } from "../../shared/stage-renderer-utils"
import type { TileContext } from "./tile-types"
import {
  getTileAt,
  isGrassLike,
  isGroundLike,
  isPathLike,
} from "./tile-utils"

const EDGE_ALPHA = 0.18

export function drawTileEdges(graphic: Graphics, context: TileContext) {
  const { map, type, x, y, tileX, tileY, tileSize } = context
  const visual = getStageTileVisual(type)
  const top = getTileAt(map, tileX, tileY - 1)
  const right = getTileAt(map, tileX + 1, tileY)
  const bottom = getTileAt(map, tileX, tileY + 1)
  const left = getTileAt(map, tileX - 1, tileY)

  if (type === "water") {
    drawWaterEdge(graphic, context, top, right, bottom, left)
    return
  }

  if (
    isPathLike(type) ||
    type === "soil" ||
    type === "garden_soil" ||
    type === "mud"
  ) {
    drawGroundEdge(graphic, context, top, right, bottom, left)
    return
  }

  if (isGrassLike(type)) {
    if (top && !isGrassLike(top)) {
      graphic.rect(x, y, tileSize, 2).fill({
        color: visual.edge,
        alpha: EDGE_ALPHA,
      })
    }

    if (bottom && !isGrassLike(bottom)) {
      graphic.rect(x, y + tileSize - 2, tileSize, 2).fill({
        color: visual.edge,
        alpha: EDGE_ALPHA,
      })
    }

    if (left && !isGrassLike(left)) {
      graphic.rect(x, y, 2, tileSize).fill({
        color: visual.edge,
        alpha: EDGE_ALPHA,
      })
    }

    if (right && !isGrassLike(right)) {
      graphic.rect(x + tileSize - 2, y, 2, tileSize).fill({
        color: visual.edge,
        alpha: EDGE_ALPHA,
      })
    }
  }
}

function drawWaterEdge(
  graphic: Graphics,
  context: TileContext,
  top?: WorldMapTileType,
  right?: WorldMapTileType,
  bottom?: WorldMapTileType,
  left?: WorldMapTileType
) {
  const { x, y, tileX, tileY, tileSize } = context
  const visual = getStageTileVisual("water")
  const shoreVisual = getStageTileVisual("mud")
  const seed = createPointSeed(tileX, tileY)

  if (top && top !== "water") {
    drawShoreBand(graphic, {
      x,
      y,
      width: tileSize,
      height: 4,
      shoreColor: shoreVisual.light,
      foamColor: visual.detail,
      alpha: 0.2,
    })
  }

  if (bottom && bottom !== "water") {
    drawShoreBand(graphic, {
      x,
      y: y + tileSize - 5,
      width: tileSize,
      height: 5,
      shoreColor: shoreVisual.dark,
      foamColor: visual.detail,
      alpha: 0.18,
    })
  }

  if (left && left !== "water") {
    drawShoreBand(graphic, {
      x,
      y,
      width: 4,
      height: tileSize,
      shoreColor: shoreVisual.light,
      foamColor: visual.detail,
      alpha: 0.16,
    })
  }

  if (right && right !== "water") {
    drawShoreBand(graphic, {
      x: x + tileSize - 4,
      y,
      width: 4,
      height: tileSize,
      shoreColor: shoreVisual.dark,
      foamColor: visual.detail,
      alpha: 0.14,
    })
  }

  if (top && isGroundLike(top) && seed % 2 === 0) {
    graphic.rect(x + 4, y + 3, 5, 1).fill({
      color: visual.detail,
      alpha: 0.42,
    })
  }

  if (bottom && isGroundLike(bottom) && seed % 3 === 0) {
    graphic.rect(x + 12, y + tileSize - 6, 7, 1).fill({
      color: visual.detail,
      alpha: 0.34,
    })
  }

  if (left && isGroundLike(left) && seed % 5 === 0) {
    graphic.rect(x + 2, y + 8, 1, 7).fill({
      color: visual.detail,
      alpha: 0.3,
    })
  }

  if (right && isGroundLike(right) && seed % 7 === 0) {
    graphic.rect(x + tileSize - 3, y + 13, 1, 6).fill({
      color: visual.detail,
      alpha: 0.28,
    })
  }
}

function drawShoreBand(
  graphic: Graphics,
  input: {
    x: number
    y: number
    width: number
    height: number
    shoreColor: number
    foamColor: number
    alpha: number
  }
) {
  graphic.rect(input.x, input.y, input.width, input.height).fill({
    color: input.shoreColor,
    alpha: input.alpha,
  })

  if (input.width >= input.height) {
    graphic.rect(input.x + 2, input.y, Math.max(2, input.width - 4), 1).fill({
      color: input.foamColor,
      alpha: input.alpha + 0.12,
    })
    return
  }

  graphic.rect(input.x, input.y + 2, 1, Math.max(2, input.height - 4)).fill({
    color: input.foamColor,
    alpha: input.alpha + 0.1,
  })
}

function drawGroundEdge(
  graphic: Graphics,
  context: TileContext,
  top?: WorldMapTileType,
  right?: WorldMapTileType,
  bottom?: WorldMapTileType,
  left?: WorldMapTileType
) {
  const { x, y, tileX, tileY, tileSize, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  if (top && isGrassLike(top)) {
    graphic.rect(x, y, tileSize, 3).fill({
      color: visual.edge,
      alpha: 0.2,
    })

    if (seed % 2 === 0) {
      graphic.rect(x + 5, y, 7, 1).fill({
        color: visual.light,
        alpha: 0.18,
      })
    }
  }

  if (bottom && isGrassLike(bottom)) {
    graphic.rect(x, y + tileSize - 3, tileSize, 3).fill({
      color: visual.edge,
      alpha: 0.15,
    })

    if (seed % 3 === 0) {
      graphic.rect(x + 12, y + tileSize - 2, 6, 1).fill({
        color: visual.dark,
        alpha: 0.14,
      })
    }
  }

  if (left && isGrassLike(left)) {
    graphic.rect(x, y, 3, tileSize).fill({
      color: visual.edge,
      alpha: 0.15,
    })

    if (seed % 5 === 0) {
      graphic.rect(x, y + 7, 1, 7).fill({
        color: visual.light,
        alpha: 0.14,
      })
    }
  }

  if (right && isGrassLike(right)) {
    graphic.rect(x + tileSize - 3, y, 3, tileSize).fill({
      color: visual.edge,
      alpha: 0.15,
    })

    if (seed % 7 === 0) {
      graphic.rect(x + tileSize - 2, y + 11, 1, 6).fill({
        color: visual.dark,
        alpha: 0.12,
      })
    }
  }

  if (
    top === "water" ||
    right === "water" ||
    bottom === "water" ||
    left === "water"
  ) {
    drawGroundNearWaterPixels(graphic, context, top, right, bottom, left)
  }
}

function drawGroundNearWaterPixels(
  graphic: Graphics,
  context: TileContext,
  top?: WorldMapTileType,
  right?: WorldMapTileType,
  bottom?: WorldMapTileType,
  left?: WorldMapTileType
) {
  const { x, y, tileX, tileY, tileSize, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  if (top === "water") {
    graphic.rect(x + 2, y, tileSize - 4, 2).fill({
      color: visual.light,
      alpha: 0.18,
    })
  }

  if (bottom === "water") {
    graphic.rect(x + 3, y + tileSize - 2, tileSize - 6, 2).fill({
      color: visual.dark,
      alpha: 0.14,
    })
  }

  if (left === "water") {
    graphic.rect(x, y + 2, 2, tileSize - 4).fill({
      color: visual.light,
      alpha: 0.12,
    })
  }

  if (right === "water") {
    graphic.rect(x + tileSize - 2, y + 2, 2, tileSize - 4).fill({
      color: visual.dark,
      alpha: 0.1,
    })
  }

  if (seed % 4 === 0) {
    graphic.rect(x + 8, y + 18, 4, 2).fill({
      color: visual.detail,
      alpha: 0.16,
    })
  }
}