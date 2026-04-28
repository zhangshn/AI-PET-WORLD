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
  const gardenCenter = getTileGroupStageCenter(map, "garden_soil")
  const townPathCenter = getTileGroupStageCenter(map, "town_path")
  const pathCenter = getTileGroupStageCenter(map, "path")

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
    shelterCenter,
    gardenCenter,
    pathCenter,
    townPathCenter,
  })

  return {
    tempShelter,
    incubator,
    homeConstruction,
    garden,
  }
}

function resolveHomeConstructionPosition(input: {
  shelterCenter: StagePoint | null
  gardenCenter: StagePoint | null
  pathCenter: StagePoint | null
  townPathCenter: StagePoint | null
}): StagePoint {
  if (input.gardenCenter && input.shelterCenter) {
    const x =
      input.shelterCenter.x +
      (input.gardenCenter.x - input.shelterCenter.x) * 0.58
    const y =
      input.shelterCenter.y +
      (input.gardenCenter.y - input.shelterCenter.y) * 0.42

    return {
      x: Math.round(x - HOME_CONSTRUCTION_WIDTH / 2),
      y: Math.round(y - HOME_CONSTRUCTION_HEIGHT / 2),
    }
  }

  if (input.pathCenter && input.townPathCenter) {
    const x =
      input.pathCenter.x +
      (input.townPathCenter.x - input.pathCenter.x) * 0.34
    const y =
      input.pathCenter.y +
      (input.townPathCenter.y - input.pathCenter.y) * 0.18

    return {
      x: Math.round(x - HOME_CONSTRUCTION_WIDTH / 2),
      y: Math.round(y - HOME_CONSTRUCTION_HEIGHT / 2),
    }
  }

  return HOME_CONSTRUCTION_STAGE_POSITION
}

function getTileGroupStageCenter(
  map: WorldMapState,
  type: WorldMapTileType
): StagePoint | null {
  const tiles = map.tiles.filter((tile) => tile.type === type)

  if (tiles.length === 0) return null

  const bounds = getTileBounds(tiles)
  const centerX = ((bounds.minX + bounds.maxX + 1) / 2) * map.tileSize
  const centerY = ((bounds.minY + bounds.maxY + 1) / 2) * map.tileSize

  return {
    x: centerX,
    y: centerY,
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