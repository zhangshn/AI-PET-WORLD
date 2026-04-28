/**
 * 当前文件负责：渲染世界地图地块与程序化像素细节。
 */

import { Graphics } from "pixi.js"

import type { WorldMapState, WorldMapTileType } from "@/world/map/world-map"

import {
  getStageTileVisual,
  STAGE_VISUAL_CONFIG,
} from "./config/stage-visual-config"
import { clampNumber, createPointSeed } from "./shared/stage-renderer-utils"

export type DrawWorldTilesInput = {
  terrainLayer: {
    addChild: (child: Graphics) => void
  }
  detailLayer: {
    addChild: (child: Graphics) => void
  }
  map: WorldMapState | null
}

type TileContext = {
  map: WorldMapState
  type: WorldMapTileType
  x: number
  y: number
  tileX: number
  tileY: number
  tileSize: number
}

const EDGE_ALPHA = 0.18
const HIGHLIGHT_ALPHA = 0.18

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

export function getTileColor(type: WorldMapTileType): number {
  return getStageTileVisual(type).base
}

function drawTileBase(graphic: Graphics, context: TileContext) {
  const { type, x, y, tileX, tileY, tileSize } = context

  graphic.rect(x, y, tileSize, tileSize).fill(
    getTileColorWithVariation(type, tileX, tileY)
  )

  if (isGrassLike(type)) {
    drawSoftGrassBase(graphic, context)
    return
  }

  if (type === "water") {
    drawWaterBase(graphic, context)
    return
  }

  if (type === "path") {
    drawPathBase(graphic, context)
    return
  }

  if (type === "soil" || type === "garden_soil") {
    drawSoilBase(graphic, context)
    return
  }

  if (type === "shelter_foundation") {
    drawFoundationBase(graphic, context)
  }
}

function drawSoftGrassBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  if (seed % 3 === 0) {
    graphic.rect(x, y, tileSize, 3).fill({
      color: visual.light,
      alpha: HIGHLIGHT_ALPHA,
    })
  }

  if (seed % 4 === 0) {
    graphic.rect(x + 2, y + tileSize - 4, tileSize - 4, 2).fill({
      color: visual.dark,
      alpha: 0.12,
    })
  }

  if (type === "forest_edge") {
    graphic.rect(x, y, tileSize, tileSize).fill({
      color: visual.dark,
      alpha: 0.14,
    })
  }
}

function drawWaterBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize } = context
  const visual = getStageTileVisual("water")
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x, y, tileSize, tileSize).fill({
    color: visual.dark,
    alpha: 0.18,
  })

  graphic.rect(x + 1, y + 1, tileSize - 2, 2).fill({
    color: STAGE_VISUAL_CONFIG.highlightColor,
    alpha: 0.18,
  })

  if (seed % 2 === 0) {
    graphic.rect(x + 4, y + 8, tileSize - 8, 2).fill({
      color: visual.light,
      alpha: 0.42,
    })
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 7, y + 17, tileSize - 12, 2).fill({
      color: visual.detail,
      alpha: 0.34,
    })
  }

  graphic.rect(x + 1, y + tileSize - 3, tileSize - 2, 3).fill({
    color: visual.dark,
    alpha: 0.32,
  })
}

function drawPathBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize } = context
  const visual = getStageTileVisual("path")
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x, y, tileSize, 3).fill({
    color: visual.detail,
    alpha: 0.3,
  })

  graphic.rect(x, y + tileSize - 3, tileSize, 3).fill({
    color: visual.dark,
    alpha: 0.12,
  })

  if (seed % 2 === 0) {
    graphic.rect(x + 4, y + 8, 5, 3).fill({
      color: visual.dark,
      alpha: 0.22,
    })
  }

  if (seed % 4 === 0) {
    graphic.rect(x + 15, y + 16, 4, 3).fill({
      color: visual.dark,
      alpha: 0.18,
    })
  }

  if (seed % 5 === 0) {
    graphic.rect(x + 10, y + 4, 8, 2).fill({
      color: visual.light,
      alpha: 0.22,
    })
  }
}

function drawSoilBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x + 2, y + 6, tileSize - 4, 2).fill({
    color: visual.dark,
    alpha: 0.28,
  })

  graphic.rect(x + 2, y + 14, tileSize - 4, 2).fill({
    color: visual.dark,
    alpha: 0.22,
  })

  graphic.rect(x + 2, y + 21, tileSize - 4, 2).fill({
    color: visual.dark,
    alpha: 0.18,
  })

  if (seed % 2 === 0) {
    graphic.rect(x + 5, y + 10, 3, 2).fill({
      color: visual.light,
      alpha: 0.24,
    })
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 15, y + 18, 4, 2).fill({
      color: visual.edge,
      alpha: 0.16,
    })
  }
}

function drawFoundationBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize } = context
  const visual = getStageTileVisual("shelter_foundation")
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x, y, tileSize, tileSize).fill({
    color: visual.dark,
    alpha: 0.08,
  })

  if (seed % 2 === 0) {
    graphic.rect(x, y, tileSize, 2).fill({
      color: visual.light,
      alpha: 0.18,
    })
  }
}

function drawTileEdges(graphic: Graphics, context: TileContext) {
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

  if (type === "path" || type === "soil" || type === "garden_soil") {
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
  const { x, y, tileSize } = context
  const visual = getStageTileVisual("water")

  if (top && top !== "water") {
    graphic.rect(x, y, tileSize, 3).fill({
      color: visual.edge,
      alpha: 0.42,
    })
  }

  if (bottom && bottom !== "water") {
    graphic.rect(x, y + tileSize - 4, tileSize, 4).fill({
      color: visual.dark,
      alpha: 0.25,
    })
  }

  if (left && left !== "water") {
    graphic.rect(x, y, 3, tileSize).fill({
      color: visual.edge,
      alpha: 0.28,
    })
  }

  if (right && right !== "water") {
    graphic.rect(x + tileSize - 3, y, 3, tileSize).fill({
      color: visual.dark,
      alpha: 0.18,
    })
  }
}

function drawGroundEdge(
  graphic: Graphics,
  context: TileContext,
  top?: WorldMapTileType,
  right?: WorldMapTileType,
  bottom?: WorldMapTileType,
  left?: WorldMapTileType
) {
  const { x, y, tileSize, type } = context
  const visual = getStageTileVisual(type)

  if (top && isGrassLike(top)) {
    graphic.rect(x, y, tileSize, 3).fill({
      color: visual.edge,
      alpha: 0.22,
    })
  }

  if (bottom && isGrassLike(bottom)) {
    graphic.rect(x, y + tileSize - 3, tileSize, 3).fill({
      color: visual.edge,
      alpha: 0.16,
    })
  }

  if (left && isGrassLike(left)) {
    graphic.rect(x, y, 3, tileSize).fill({
      color: visual.edge,
      alpha: 0.16,
    })
  }

  if (right && isGrassLike(right)) {
    graphic.rect(x + tileSize - 3, y, 3, tileSize).fill({
      color: visual.edge,
      alpha: 0.16,
    })
  }
}

function drawTileDetail(graphic: Graphics, context: TileContext) {
  const { type } = context

  if (type === "short_grass") {
    drawShortGrassDetail(graphic, context)
    return
  }

  if (type === "wild_grass") {
    drawWildGrassDetail(graphic, context)
    return
  }

  if (type === "flower_patch") {
    drawFlowerPatchDetail(graphic, context)
    return
  }

  if (type === "forest_edge") {
    drawForestEdgeDetail(graphic, context)
    return
  }

  if (type === "stone") {
    drawStoneDetail(graphic, context)
    return
  }

  if (type === "mud") {
    drawMudDetail(graphic, context)
  }
}

function drawShortGrassDetail(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  if (seed % 2 === 0) {
    graphic.rect(x + 4, y + 18, 3, 4).fill(visual.detail)
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 15, y + 12, 2, 5).fill(visual.dark)
  }

  if (seed % 5 === 0) {
    graphic.rect(x + 19, y + 20, 2, 3).fill({
      color: visual.light,
      alpha: 0.42,
    })
  }
}

function drawWildGrassDetail(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x + 4, y + 13, 4, 9).fill(visual.detail)

  if (seed % 2 === 0) {
    graphic.rect(x + 11, y + 9, 3, 11).fill(visual.light)
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 18, y + 14, 3, 8).fill(visual.detail)
  }

  if (seed % 5 === 0) {
    graphic.rect(x + 7, y + 7, 2, 4).fill(visual.light)
  }
}

function drawFlowerPatchDetail(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x + 6, y + 16, 3, 4).fill(visual.dark)
  graphic.rect(x + 7, y + 7, 3, 3).fill(visual.detail)

  if (seed % 2 === 0) {
    graphic.rect(x + 14, y + 10, 3, 3).fill(
      STAGE_VISUAL_CONFIG.actor.petDefault.cloth
    )
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 17, y + 16, 3, 3).fill(
      STAGE_VISUAL_CONFIG.entity.flower.blossoms[1]
    )
  }
}

function drawForestEdgeDetail(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, type } = context
  const visual = getStageTileVisual(type)
  const treeVisual = STAGE_VISUAL_CONFIG.entity.tree
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x + 8, y + 15, 6, 9).fill(treeVisual.trunk)
  graphic.rect(x + 4, y + 10, 16, 12).fill(visual.detail)
  graphic.rect(x + 1, y + 5, 22, 10).fill(visual.light)

  if (seed % 2 === 0) {
    graphic.rect(x + 5, y + 2, 14, 7).fill(visual.light)
  }

  graphic.rect(x + 4, y + 20, 16, 3).fill({
    color: visual.edge,
    alpha: 0.22,
  })
}

function drawStoneDetail(graphic: Graphics, context: TileContext) {
  const { x, y, type } = context
  const visual = getStageTileVisual(type)

  graphic.rect(x + 5, y + 15, 14, 4).fill({
    color: visual.edge,
    alpha: 0.2,
  })
  graphic.rect(x + 6, y + 9, 12, 9).fill(visual.detail)
  graphic.rect(x + 8, y + 7, 9, 4).fill(visual.light)
  graphic.rect(x + 10, y + 17, 8, 2).fill(visual.dark)
}

function drawMudDetail(graphic: Graphics, context: TileContext) {
  const { x, y, type } = context
  const visual = getStageTileVisual(type)

  graphic.rect(x + 5, y + 9, 12, 3).fill(visual.detail)
  graphic.rect(x + 11, y + 17, 8, 2).fill(visual.detail)
  graphic.rect(x + 2, y + 21, 16, 2).fill({
    color: visual.dark,
    alpha: 0.35,
  })
}

function getTileAt(
  map: WorldMapState,
  x: number,
  y: number
): WorldMapTileType | undefined {
  if (x < 0 || y < 0 || x >= map.size.width || y >= map.size.height) {
    return undefined
  }

  return map.tiles.find((tile) => tile.x === x && tile.y === y)?.type
}

function isGrassLike(type: WorldMapTileType): boolean {
  return (
    type === "short_grass" ||
    type === "wild_grass" ||
    type === "flower_patch" ||
    type === "forest_edge"
  )
}

function getTileColorWithVariation(
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