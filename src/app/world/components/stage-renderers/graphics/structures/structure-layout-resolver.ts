/**
 * 当前文件负责：根据世界地图地块推导家园结构在舞台上的位置。
 */

import type {
  WorldMapState,
  WorldMapTile,
  WorldMapTileType,
} from "@/world/map/world-map"

import {
  GARDEN_HEIGHT,
  GARDEN_STAGE_POSITION,
  GARDEN_WIDTH,
  HOME_CONSTRUCTION_HEIGHT,
  HOME_CONSTRUCTION_STAGE_POSITION,
  HOME_CONSTRUCTION_WIDTH,
  INCUBATOR_STAGE_POSITION,
  TEMP_SHELTER_HEIGHT,
  TEMP_SHELTER_STAGE_POSITION,
  TEMP_SHELTER_WIDTH,
  type StagePoint,
  type StageStructureLayout,
  type TileBounds,
} from "./structure-types"

type StructureRect = {
  x: number
  y: number
  width: number
  height: number
}

export function resolveStageStructureLayout(
  map: WorldMapState | null
): StageStructureLayout {
  if (!map) {
    return {
      tempShelter: TEMP_SHELTER_STAGE_POSITION,
      incubator: INCUBATOR_STAGE_POSITION,
      homeConstruction: HOME_CONSTRUCTION_STAGE_POSITION,
      garden: GARDEN_STAGE_POSITION,
    }
  }

  const shelterCenter = getTileGroupStageCenter(map, "shelter_foundation")
  const shelterBounds = getTileGroupStageBounds(map, "shelter_foundation")
  const gardenCenter = getTileGroupStageCenter(map, "garden_soil")
  const gardenBounds = getTileGroupStageBounds(map, "garden_soil")
  const townPathBounds = getTileGroupStageBounds(map, "town_path")
  const pathBounds = getTileGroupStageBounds(map, "path")

  const tempShelter = shelterCenter
    ? {
        x: Math.round(shelterCenter.x - TEMP_SHELTER_WIDTH / 2),
        y: Math.round(shelterCenter.y - TEMP_SHELTER_HEIGHT / 2),
      }
    : TEMP_SHELTER_STAGE_POSITION

  const incubator = {
    x: tempShelter.x + 35,
    y: tempShelter.y + 47,
  }

  const garden = gardenCenter
    ? {
        x: Math.round(gardenCenter.x - GARDEN_WIDTH / 2),
        y: Math.round(gardenCenter.y - GARDEN_HEIGHT / 2),
      }
    : GARDEN_STAGE_POSITION

  const homeConstruction = resolveHomeConstructionPosition({
    map,
    shelterBounds,
    gardenBounds,
    pathBounds,
    townPathBounds,
    tempShelter,
    garden,
  })

  return {
    tempShelter,
    incubator,
    homeConstruction,
    garden,
  }
}

function resolveHomeConstructionPosition(input: {
  map: WorldMapState
  shelterBounds: StructureRect | null
  gardenBounds: StructureRect | null
  pathBounds: StructureRect | null
  townPathBounds: StructureRect | null
  tempShelter: StagePoint
  garden: StagePoint
}): StagePoint {
  const blockedRects = [
    toStructureRect(input.tempShelter, TEMP_SHELTER_WIDTH, TEMP_SHELTER_HEIGHT),
    toStructureRect(input.garden, GARDEN_WIDTH, GARDEN_HEIGHT),
  ]

  if (input.shelterBounds) {
    blockedRects.push(expandRect(input.shelterBounds, 24))
  }

  if (input.gardenBounds) {
    blockedRects.push(expandRect(input.gardenBounds, 20))
  }

  const candidates = buildHomeConstructionCandidates(input)

  const safeCandidate = candidates.find((candidate) =>
    isSafeHomeCandidate({
      point: candidate,
      map: input.map,
      blockedRects,
    })
  )

  return safeCandidate ?? HOME_CONSTRUCTION_STAGE_POSITION
}

function buildHomeConstructionCandidates(input: {
  map: WorldMapState
  shelterBounds: StructureRect | null
  gardenBounds: StructureRect | null
  pathBounds: StructureRect | null
  townPathBounds: StructureRect | null
  tempShelter: StagePoint
  garden: StagePoint
}): StagePoint[] {
  const candidates: StagePoint[] = []

  if (input.shelterBounds) {
    candidates.push(
      {
        x: Math.round(input.shelterBounds.x + input.shelterBounds.width + 56),
        y: Math.round(input.shelterBounds.y + 20),
      },
      {
        x: Math.round(input.shelterBounds.x),
        y: Math.round(input.shelterBounds.y + input.shelterBounds.height + 48),
      },
      {
        x: Math.round(input.shelterBounds.x + input.shelterBounds.width + 56),
        y: Math.round(input.shelterBounds.y + input.shelterBounds.height + 42),
      }
    )
  }

  if (input.pathBounds) {
    candidates.push({
      x: Math.round(input.pathBounds.x + input.pathBounds.width + 32),
      y: Math.round(input.pathBounds.y - HOME_CONSTRUCTION_HEIGHT - 18),
    })
  }

  if (input.townPathBounds) {
    candidates.push({
      x: Math.round(input.townPathBounds.x + 24),
      y: Math.round(input.townPathBounds.y - HOME_CONSTRUCTION_HEIGHT - 22),
    })
  }

  candidates.push(
    {
      x: input.tempShelter.x + TEMP_SHELTER_WIDTH + 72,
      y: input.tempShelter.y + 8,
    },
    HOME_CONSTRUCTION_STAGE_POSITION
  )

  return candidates
}

function isSafeHomeCandidate(input: {
  point: StagePoint
  map: WorldMapState
  blockedRects: StructureRect[]
}): boolean {
  const rect = toStructureRect(
    input.point,
    HOME_CONSTRUCTION_WIDTH,
    HOME_CONSTRUCTION_HEIGHT
  )

  if (!isRectInsideMap(rect, input.map)) return false

  if (input.blockedRects.some((blocked) => intersectsRect(rect, blocked))) {
    return false
  }

  return hasEnoughBuildableTiles({
    rect,
    map: input.map,
    minRatio: 0.42,
  })
}

function hasEnoughBuildableTiles(input: {
  rect: StructureRect
  map: WorldMapState
  minRatio: number
}): boolean {
  const minTileX = Math.max(0, Math.floor(input.rect.x / input.map.tileSize))
  const maxTileX = Math.min(
    input.map.size.width - 1,
    Math.floor((input.rect.x + input.rect.width) / input.map.tileSize)
  )
  const minTileY = Math.max(0, Math.floor(input.rect.y / input.map.tileSize))
  const maxTileY = Math.min(
    input.map.size.height - 1,
    Math.floor((input.rect.y + input.rect.height) / input.map.tileSize)
  )

  let total = 0
  let buildable = 0

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      total += 1

      const tile = input.map.tiles.find(
        (item) => item.x === tileX && item.y === tileY
      )

      if (!tile) continue
      if (tile.type === "water" || tile.type === "stone" || tile.type === "forest_edge") {
        continue
      }

      if (tile.buildable || tile.type === "short_grass" || tile.type === "wild_grass") {
        buildable += 1
      }
    }
  }

  if (total === 0) return false

  return buildable / total >= input.minRatio
}

function toStructureRect(
  point: StagePoint,
  width: number,
  height: number
): StructureRect {
  return {
    x: point.x,
    y: point.y,
    width,
    height,
  }
}

function expandRect(rect: StructureRect, padding: number): StructureRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

function isRectInsideMap(rect: StructureRect, map: WorldMapState): boolean {
  const mapWidth = map.size.width * map.tileSize
  const mapHeight = map.size.height * map.tileSize

  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= mapWidth &&
    rect.y + rect.height <= mapHeight
  )
}

function intersectsRect(a: StructureRect, b: StructureRect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  )
}

function getTileGroupStageCenter(
  map: WorldMapState,
  type: WorldMapTileType
): StagePoint | null {
  const bounds = getTileGroupStageBounds(map, type)

  if (!bounds) return null

  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
}

function getTileGroupStageBounds(
  map: WorldMapState,
  type: WorldMapTileType
): StructureRect | null {
  const tiles = map.tiles.filter((tile) => tile.type === type)

  if (tiles.length === 0) return null

  const bounds = getTileBounds(tiles)

  return {
    x: bounds.minX * map.tileSize,
    y: bounds.minY * map.tileSize,
    width: (bounds.maxX - bounds.minX + 1) * map.tileSize,
    height: (bounds.maxY - bounds.minY + 1) * map.tileSize,
  }
}

function getTileBounds(tiles: WorldMapTile[]): TileBounds {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const tile of tiles) {
    minX = Math.min(minX, tile.x)
    maxX = Math.max(maxX, tile.x)
    minY = Math.min(minY, tile.y)
    maxY = Math.max(maxY, tile.y)
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
  }
}