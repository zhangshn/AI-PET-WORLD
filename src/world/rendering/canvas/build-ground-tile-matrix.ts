/**
 * 当前文件负责：从地表 placements 构建 Canvas tile matrix。
 */

import type {
  HomeMapSize,
  MapCoordinate,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

import type {
  GroundCanvasCell,
  GroundCanvasLayerInput,
} from "./ground-canvas-types"

export function buildGroundCanvasLayerInput(args: {
  mapSize: HomeMapSize
  tileSize: number
  groundPlacements: MapPlacement[]
  supportPlacements: MapPlacement[]
  pathPlacements: MapPlacement[]
  edgePlacements: MapPlacement[]
  decalPlacements: MapPlacement[]
}): GroundCanvasLayerInput {
  const matrix = createEmptyMatrix(args.mapSize)

  assignSinglePlacement(matrix, args.mapSize, args.groundPlacements, "ground")
  assignSinglePlacement(matrix, args.mapSize, args.supportPlacements, "support")
  assignSinglePlacement(matrix, args.mapSize, args.pathPlacements, "path")
  assignSinglePlacement(matrix, args.mapSize, args.edgePlacements, "edge")
  assignDecals(matrix, args.mapSize, args.decalPlacements)

  return {
    mapSize: args.mapSize,
    tileSize: args.tileSize,
    matrix,
    placements: {
      ground: args.groundPlacements,
      support: args.supportPlacements,
      path: args.pathPlacements,
      edge: args.edgePlacements,
      decals: args.decalPlacements,
    },
    dirtyKey: buildTerrainDirtyKey([
      ...args.groundPlacements,
      ...args.supportPlacements,
      ...args.pathPlacements,
      ...args.edgePlacements,
      ...args.decalPlacements,
    ]),
  }
}

export function iteratePlacementCells(
  placement: MapPlacement,
  mapSize: HomeMapSize
): Array<{ x: number; y: number }> {
  if (isInMap(placement, mapSize)) {
    return [{ x: placement.x, y: placement.y }]
  }

  return []
}

function createEmptyMatrix(mapSize: HomeMapSize): GroundCanvasCell[][] {
  return Array.from({ length: mapSize.rows }, (_, rowIndex) =>
    Array.from({ length: mapSize.columns }, (_, columnIndex) => ({
      tileX: columnIndex + 1,
      tileY: rowIndex + 1,
      decals: [],
    }))
  )
}

function assignSinglePlacement(
  matrix: GroundCanvasCell[][],
  mapSize: HomeMapSize,
  placements: MapPlacement[],
  key: "ground" | "support" | "path" | "edge"
) {
  placements.forEach((placement) => {
    iteratePlacementCells(placement, mapSize).forEach((cell) => {
      matrix[cell.y - 1][cell.x - 1][key] = placement
    })
  })
}

function assignDecals(
  matrix: GroundCanvasCell[][],
  mapSize: HomeMapSize,
  placements: MapPlacement[]
) {
  placements.forEach((placement) => {
    iteratePlacementCells(placement, mapSize).forEach((cell) => {
      matrix[cell.y - 1][cell.x - 1].decals.push(placement)
    })
  })
}

function buildTerrainDirtyKey(placements: MapPlacement[]): string {
  return [...placements]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((placement) =>
      [
        placement.id,
        placement.assetId,
        placement.x,
        placement.y,
        placement.layer,
        placement.scale,
        placement.alpha,
        placement.tags.join("."),
      ].join(":")
    )
    .join("|")
}

function isInMap(point: MapCoordinate, mapSize: HomeMapSize): boolean {
  return (
    point.x >= 1 &&
    point.x <= mapSize.columns &&
    point.y >= 1 &&
    point.y <= mapSize.rows
  )
}
