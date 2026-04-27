/**
 * 当前文件负责：渲染世界地图地块与地块细节。
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

export function drawWorldTiles(input: DrawWorldTilesInput) {
  if (!input.map) return

  const terrainGraphic = new Graphics()
  const detailGraphic = new Graphics()

  for (const tile of input.map.tiles) {
    const x = tile.x * input.map.tileSize
    const y = tile.y * input.map.tileSize

    terrainGraphic.rect(x, y, input.map.tileSize, input.map.tileSize).fill(
      getTileColorWithVariation(tile.type, tile.x, tile.y)
    )

    drawTileDetail(detailGraphic, tile.type, x, y, input.map.tileSize)
  }

  input.terrainLayer.addChild(terrainGraphic)
  input.detailLayer.addChild(detailGraphic)
}

export function getTileColor(type: WorldMapTileType): number {
  switch (type) {
    case "wild_grass":
      return 0x5f9f45
    case "short_grass":
      return 0x79b957
    case "soil":
      return 0xa86f3f
    case "flower_patch":
      return 0x76b852
    case "stone":
      return 0x8a8f7a
    case "water":
      return 0x4fa3d1
    case "forest_edge":
      return 0x3f7f39
    case "mud":
      return 0x7a5738
    case "path":
      return 0xc28a4a
    case "shelter_foundation":
      return 0xb78b58
    case "garden_soil":
      return 0x9a6336
    default:
      return 0x79b957
  }
}

function getTileColorWithVariation(
  type: WorldMapTileType,
  x: number,
  y: number
): number {
  const baseColor = getTileColor(type)
  const variation = ((x * 17 + y * 31) % 5) - 2

  if (variation === 0) return baseColor

  const r = (baseColor >> 16) & 255
  const g = (baseColor >> 8) & 255
  const b = baseColor & 255
  const amount = variation * 5

  const nextR = clampNumber(r + amount, 0, 255)
  const nextG = clampNumber(g + amount, 0, 255)
  const nextB = clampNumber(b + amount, 0, 255)

  return (nextR << 16) + (nextG << 8) + nextB
}

function drawTileDetail(
  graphic: Graphics,
  type: WorldMapTileType,
  x: number,
  y: number,
  tileSize: number
) {
  if (type === "short_grass") {
    graphic.rect(x + 4, y + 18, 3, 4).fill(0x5f9f45)
    graphic.rect(x + 15, y + 12, 2, 5).fill(0x6dad4f)
    return
  }

  if (type === "wild_grass") {
    graphic.rect(x + 4, y + 13, 4, 9).fill(0x3f7f39)
    graphic.rect(x + 11, y + 9, 3, 11).fill(0x4f9142)
    graphic.rect(x + 18, y + 14, 3, 8).fill(0x3f7f39)
    return
  }

  if (type === "path") {
    graphic.rect(x, y, tileSize, 3).fill({
      color: 0xf0b96a,
      alpha: 0.35,
    })
    graphic.rect(x + 4, y + 8, 5, 3).fill({
      color: 0x8a5a2b,
      alpha: 0.22,
    })
    graphic.rect(x + 15, y + 16, 4, 3).fill({
      color: 0x8a5a2b,
      alpha: 0.18,
    })
    return
  }

  if (type === "soil" || type === "garden_soil") {
    graphic.rect(x + 2, y + 6, tileSize - 4, 2).fill({
      color: 0x70421f,
      alpha: 0.35,
    })
    graphic.rect(x + 2, y + 14, tileSize - 4, 2).fill({
      color: 0x70421f,
      alpha: 0.28,
    })
    graphic.rect(x + 2, y + 21, tileSize - 4, 2).fill({
      color: 0x70421f,
      alpha: 0.22,
    })
    return
  }

  if (type === "flower_patch") {
    graphic.rect(x + 7, y + 7, 3, 3).fill(0xf7a8c8)
    graphic.rect(x + 14, y + 10, 3, 3).fill(0xffd166)
    graphic.rect(x + 17, y + 16, 3, 3).fill(0xf28482)
    graphic.rect(x + 6, y + 16, 3, 4).fill(0x3f7f39)
    return
  }

  if (type === "forest_edge") {
    graphic.rect(x + 4, y + 10, 16, 12).fill(0x2f6b2f)
    graphic.rect(x + 8, y + 15, 6, 9).fill(0x7a4b2a)
    graphic.rect(x + 1, y + 5, 22, 10).fill(0x4f9142)
    graphic.rect(x + 5, y + 2, 14, 7).fill(0x5fa34b)
    return
  }

  if (type === "water") {
    graphic.rect(x + 2, y + 7, tileSize - 4, 3).fill(0x8ed3ef)
    graphic.rect(x + 6, y + 15, tileSize - 10, 2).fill(0xb7e7f7)
    graphic.rect(x + 1, y + tileSize - 3, tileSize - 2, 3).fill({
      color: 0x2f7fad,
      alpha: 0.45,
    })
    return
  }

  if (type === "stone") {
    graphic.rect(x + 6, y + 9, 12, 9).fill(0xa6a990)
    graphic.rect(x + 8, y + 7, 9, 4).fill(0xd0d2b8)
    graphic.rect(x + 10, y + 17, 8, 2).fill(0x686b5a)
    return
  }

  if (type === "mud") {
    graphic.rect(x + 5, y + 9, 12, 3).fill(0x5a3b22)
    graphic.rect(x + 11, y + 17, 8, 2).fill(0x5a3b22)
    graphic.rect(x + 2, y + 21, 16, 2).fill({
      color: 0x3f2a18,
      alpha: 0.35,
    })
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}