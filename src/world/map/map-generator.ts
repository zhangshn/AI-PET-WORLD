/**
 * 当前文件负责：生成 Starter Land 农场式自然地图。
 */

import {
  createWorldMapTile,
  type WorldMapState,
  type WorldMapTileType,
} from "./world-map"

function isInside(input: {
  x: number
  y: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}): boolean {
  return (
    input.x >= input.minX &&
    input.x <= input.maxX &&
    input.y >= input.minY &&
    input.y <= input.maxY
  )
}

function isWaterArea(x: number, y: number): boolean {
  return (
    isInside({ x, y, minX: 2, maxX: 16, minY: 3, maxY: 8 }) ||
    isInside({ x, y, minX: 3, maxX: 14, minY: 9, maxY: 10 })
  )
}

function isForestArea(x: number, y: number): boolean {
  return (
    isInside({ x, y, minX: 0, maxX: 63, minY: 0, maxY: 3 }) ||
    isInside({ x, y, minX: 54, maxX: 63, minY: 4, maxY: 20 }) ||
    isInside({ x, y, minX: 0, maxX: 6, minY: 10, maxY: 25 })
  )
}

function isShelterArea(x: number, y: number): boolean {
  return isInside({ x, y, minX: 8, maxX: 28, minY: 11, maxY: 22 })
}

function isGardenArea(x: number, y: number): boolean {
  return isInside({ x, y, minX: 40, maxX: 56, minY: 25, maxY: 35 })
}

function isFlowerField(x: number, y: number): boolean {
  return isInside({ x, y, minX: 42, maxX: 59, minY: 8, maxY: 19 })
}

function isWetland(x: number, y: number): boolean {
  return isInside({ x, y, minX: 2, maxX: 15, minY: 30, maxY: 39 })
}

function isMainPath(x: number, y: number): boolean {
  return (
    (x >= 9 && x <= 55 && y >= 23 && y <= 24) ||
    (x >= 23 && x <= 24 && y >= 12 && y <= 34) ||
    (x >= 35 && x <= 36 && y >= 18 && y <= 31)
  )
}

function isSmallPath(x: number, y: number): boolean {
  return (
    (x >= 12 && x <= 28 && y >= 15 && y <= 16) ||
    (x >= 36 && x <= 47 && y >= 26 && y <= 27)
  )
}

function shouldDecorateFlower(x: number, y: number): boolean {
  return (x * 7 + y * 11) % 19 === 0
}

function shouldDecorateGrass(x: number, y: number): boolean {
  return (x * 5 + y * 13) % 23 === 0
}

function shouldPlaceStone(x: number, y: number): boolean {
  return (
    (x * 17 + y * 7) % 47 === 0 &&
    !isShelterArea(x, y) &&
    !isGardenArea(x, y) &&
    !isMainPath(x, y) &&
    !isSmallPath(x, y)
  )
}

function resolveStarterTownTileType(x: number, y: number): WorldMapTileType {
  if (isWaterArea(x, y)) return "water"
  if (isMainPath(x, y) || isSmallPath(x, y)) return "path"
  if (isShelterArea(x, y)) return "shelter_foundation"
  if (isGardenArea(x, y)) return "garden_soil"
  if (isWetland(x, y)) return "mud"

  if (isFlowerField(x, y)) {
    return shouldDecorateFlower(x, y) ? "flower_patch" : "short_grass"
  }

  if (isForestArea(x, y)) {
    return shouldPlaceStone(x, y) ? "stone" : "forest_edge"
  }

  if (shouldPlaceStone(x, y)) return "stone"
  if (shouldDecorateFlower(x, y)) return "flower_patch"
  if (shouldDecorateGrass(x, y)) return "wild_grass"

  return "short_grass"
}

export function generateStarterWorldMap(): WorldMapState {
  const width = 64
  const height = 40
  const tileSize = 24

  const tiles = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push(
        createWorldMapTile({
          x,
          y,
          type: resolveStarterTownTileType(x, y),
        })
      )
    }
  }

  return {
    id: "starter-land-farm-v2",
    name: "Starter Land",
    size: {
      width,
      height,
    },
    tileSize,
    tiles,
  }
}