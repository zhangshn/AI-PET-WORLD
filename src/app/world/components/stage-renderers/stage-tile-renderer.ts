/**
 * 当前文件负责：渲染世界地图地块与程序化像素细节。
 */

import { Graphics } from "pixi.js"

import type { WorldMapState, WorldMapTileType } from "@/world/map/world-map"

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
  switch (type) {
    case "wild_grass":
      return 0x5d9a43
    case "short_grass":
      return 0x78b85a
    case "soil":
      return 0xa87545
    case "flower_patch":
      return 0x75b65a
    case "stone":
      return 0x8f927e
    case "water":
      return 0x4e9fca
    case "forest_edge":
      return 0x3f7d3a
    case "mud":
      return 0x76553a
    case "path":
      return 0xc58c51
    case "shelter_foundation":
      return 0xb58b5d
    case "garden_soil":
      return 0x98633a
    default:
      return 0x78b85a
  }
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
  const seed = getTileSeed(tileX, tileY)

  if (seed % 3 === 0) {
    graphic.rect(x, y, tileSize, 3).fill({
      color: 0x9bd26f,
      alpha: HIGHLIGHT_ALPHA,
    })
  }

  if (seed % 4 === 0) {
    graphic.rect(x + 2, y + tileSize - 4, tileSize - 4, 2).fill({
      color: 0x3f7334,
      alpha: 0.12,
    })
  }

  if (type === "forest_edge") {
    graphic.rect(x, y, tileSize, tileSize).fill({
      color: 0x245f2e,
      alpha: 0.14,
    })
  }
}

function drawWaterBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize } = context
  const seed = getTileSeed(tileX, tileY)

  graphic.rect(x, y, tileSize, tileSize).fill({
    color: 0x2f7fad,
    alpha: 0.18,
  })

  graphic.rect(x + 1, y + 1, tileSize - 2, 2).fill({
    color: 0xb9e9f4,
    alpha: 0.28,
  })

  if (seed % 2 === 0) {
    graphic.rect(x + 4, y + 8, tileSize - 8, 2).fill({
      color: 0xb7e7f7,
      alpha: 0.42,
    })
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 7, y + 17, tileSize - 12, 2).fill({
      color: 0x8ed3ef,
      alpha: 0.34,
    })
  }

  graphic.rect(x + 1, y + tileSize - 3, tileSize - 2, 3).fill({
    color: 0x246f99,
    alpha: 0.32,
  })
}

function drawPathBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize } = context
  const seed = getTileSeed(tileX, tileY)

  graphic.rect(x, y, tileSize, 3).fill({
    color: 0xe7b36e,
    alpha: 0.3,
  })

  graphic.rect(x, y + tileSize - 3, tileSize, 3).fill({
    color: 0x8e5e32,
    alpha: 0.12,
  })

  if (seed % 2 === 0) {
    graphic.rect(x + 4, y + 8, 5, 3).fill({
      color: 0x8a5a2b,
      alpha: 0.22,
    })
  }

  if (seed % 4 === 0) {
    graphic.rect(x + 15, y + 16, 4, 3).fill({
      color: 0x8a5a2b,
      alpha: 0.18,
    })
  }

  if (seed % 5 === 0) {
    graphic.rect(x + 10, y + 4, 8, 2).fill({
      color: 0xf2c07b,
      alpha: 0.22,
    })
  }
}

function drawSoilBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize } = context
  const seed = getTileSeed(tileX, tileY)

  graphic.rect(x + 2, y + 6, tileSize - 4, 2).fill({
    color: 0x70421f,
    alpha: 0.28,
  })

  graphic.rect(x + 2, y + 14, tileSize - 4, 2).fill({
    color: 0x70421f,
    alpha: 0.22,
  })

  graphic.rect(x + 2, y + 21, tileSize - 4, 2).fill({
    color: 0x70421f,
    alpha: 0.18,
  })

  if (seed % 2 === 0) {
    graphic.rect(x + 5, y + 10, 3, 2).fill({
      color: 0xd09860,
      alpha: 0.24,
    })
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 15, y + 18, 4, 2).fill({
      color: 0x6b3f22,
      alpha: 0.16,
    })
  }
}

function drawFoundationBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize } = context
  const seed = getTileSeed(tileX, tileY)

  graphic.rect(x, y, tileSize, tileSize).fill({
    color: 0x7a512e,
    alpha: 0.08,
  })

  if (seed % 2 === 0) {
    graphic.rect(x, y, tileSize, 2).fill({
      color: 0xe0b977,
      alpha: 0.18,
    })
  }
}

function drawTileEdges(graphic: Graphics, context: TileContext) {
  const { map, type, x, y, tileX, tileY, tileSize } = context
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
        color: 0x315f2f,
        alpha: EDGE_ALPHA,
      })
    }

    if (bottom && !isGrassLike(bottom)) {
      graphic.rect(x, y + tileSize - 2, tileSize, 2).fill({
        color: 0x315f2f,
        alpha: EDGE_ALPHA,
      })
    }

    if (left && !isGrassLike(left)) {
      graphic.rect(x, y, 2, tileSize).fill({
        color: 0x315f2f,
        alpha: EDGE_ALPHA,
      })
    }

    if (right && !isGrassLike(right)) {
      graphic.rect(x + tileSize - 2, y, 2, tileSize).fill({
        color: 0x315f2f,
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
  const edgeColor = 0xc9f0d2
  const shadowColor = 0x1f6f95

  if (top && top !== "water") {
    graphic.rect(x, y, tileSize, 3).fill({
      color: edgeColor,
      alpha: 0.42,
    })
  }

  if (bottom && bottom !== "water") {
    graphic.rect(x, y + tileSize - 4, tileSize, 4).fill({
      color: shadowColor,
      alpha: 0.25,
    })
  }

  if (left && left !== "water") {
    graphic.rect(x, y, 3, tileSize).fill({
      color: edgeColor,
      alpha: 0.28,
    })
  }

  if (right && right !== "water") {
    graphic.rect(x + tileSize - 3, y, 3, tileSize).fill({
      color: shadowColor,
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
  const { x, y, tileSize } = context
  const color = 0x6f4527

  if (top && isGrassLike(top)) {
    graphic.rect(x, y, tileSize, 3).fill({
      color,
      alpha: 0.22,
    })
  }

  if (bottom && isGrassLike(bottom)) {
    graphic.rect(x, y + tileSize - 3, tileSize, 3).fill({
      color,
      alpha: 0.16,
    })
  }

  if (left && isGrassLike(left)) {
    graphic.rect(x, y, 3, tileSize).fill({
      color,
      alpha: 0.16,
    })
  }

  if (right && isGrassLike(right)) {
    graphic.rect(x + tileSize - 3, y, 3, tileSize).fill({
      color,
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
  const { x, y, tileX, tileY } = context
  const seed = getTileSeed(tileX, tileY)

  if (seed % 2 === 0) {
    graphic.rect(x + 4, y + 18, 3, 4).fill(0x5f9f45)
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 15, y + 12, 2, 5).fill(0x6dad4f)
  }

  if (seed % 5 === 0) {
    graphic.rect(x + 19, y + 20, 2, 3).fill({
      color: 0xeff2a0,
      alpha: 0.42,
    })
  }
}

function drawWildGrassDetail(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY } = context
  const seed = getTileSeed(tileX, tileY)

  graphic.rect(x + 4, y + 13, 4, 9).fill(0x3f7f39)

  if (seed % 2 === 0) {
    graphic.rect(x + 11, y + 9, 3, 11).fill(0x4f9142)
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 18, y + 14, 3, 8).fill(0x3f7f39)
  }

  if (seed % 5 === 0) {
    graphic.rect(x + 7, y + 7, 2, 4).fill(0x75b65a)
  }
}

function drawFlowerPatchDetail(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY } = context
  const seed = getTileSeed(tileX, tileY)

  graphic.rect(x + 6, y + 16, 3, 4).fill(0x3f7f39)
  graphic.rect(x + 7, y + 7, 3, 3).fill(0xf7a8c8)

  if (seed % 2 === 0) {
    graphic.rect(x + 14, y + 10, 3, 3).fill(0xffd166)
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 17, y + 16, 3, 3).fill(0xf28482)
  }
}

function drawForestEdgeDetail(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY } = context
  const seed = getTileSeed(tileX, tileY)

  graphic.rect(x + 8, y + 15, 6, 9).fill(0x7a4b2a)
  graphic.rect(x + 4, y + 10, 16, 12).fill(0x2f6b2f)
  graphic.rect(x + 1, y + 5, 22, 10).fill(0x4f9142)

  if (seed % 2 === 0) {
    graphic.rect(x + 5, y + 2, 14, 7).fill(0x5fa34b)
  }

  graphic.rect(x + 4, y + 20, 16, 3).fill({
    color: 0x1f4f25,
    alpha: 0.22,
  })
}

function drawStoneDetail(graphic: Graphics, context: TileContext) {
  const { x, y } = context

  graphic.rect(x + 5, y + 15, 14, 4).fill({
    color: 0x565948,
    alpha: 0.2,
  })
  graphic.rect(x + 6, y + 9, 12, 9).fill(0xa6a990)
  graphic.rect(x + 8, y + 7, 9, 4).fill(0xd0d2b8)
  graphic.rect(x + 10, y + 17, 8, 2).fill(0x686b5a)
}

function drawMudDetail(graphic: Graphics, context: TileContext) {
  const { x, y } = context

  graphic.rect(x + 5, y + 9, 12, 3).fill(0x5a3b22)
  graphic.rect(x + 11, y + 17, 8, 2).fill(0x5a3b22)
  graphic.rect(x + 2, y + 21, 16, 2).fill({
    color: 0x3f2a18,
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
  const variation = (getTileSeed(x, y) % 7) - 3

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

function getTileSeed(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 10000

  return Math.abs(Math.floor(value))
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}