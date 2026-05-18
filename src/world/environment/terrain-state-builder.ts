/**
 * 当前文件职责：从家园地图状态派生地形状态。
 */

import { inferSurfaceTypeFromPlacement } from "@/world/geometry-adapters/geometry-adapter-gateway"
import type {
  HomeMapState,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import type { WorldSurfaceType } from "@/world/core-rules/world-rule-gateway"

import type {
  TerrainBiome,
  TerrainCellState,
  TerrainState,
} from "./environment-schema"

export type BuildTerrainStateFromHomeMapInput = {
  homeMapState: HomeMapState
}

export function buildTerrainStateFromHomeMap(
  input: BuildTerrainStateFromHomeMapInput
): TerrainState {
  const { homeMapState } = input
  const cells = buildDefaultTerrainCells(homeMapState)

  homeMapState.placements.forEach((placement) => {
    const key = buildCellKey(placement.x, placement.y)
    const cell = cells[key]

    if (!cell) {
      return
    }

    cells[key] = applyPlacementToTerrainCell(cell, placement)
  })

  return {
    width: homeMapState.mapSize.columns,
    height: homeMapState.mapSize.rows,
    cells,
    summary: buildTerrainSummary(cells),
  }
}

function buildDefaultTerrainCells(
  homeMapState: HomeMapState
): Record<string, TerrainCellState> {
  const cells: Record<string, TerrainCellState> = {}

  for (let y = 0; y < homeMapState.mapSize.rows; y += 1) {
    for (let x = 0; x < homeMapState.mapSize.columns; x += 1) {
      cells[buildCellKey(x, y)] = {
        x,
        y,
        biome: "grassland",
        surfaceType: "grass",
        moisture: 45,
        fertility: 55,
        slope: 5,
        sunlight: 70,
        tags: ["terrain_v0", "default_grassland"],
      }
    }
  }

  return cells
}

function applyPlacementToTerrainCell(
  cell: TerrainCellState,
  placement: MapPlacement
): TerrainCellState {
  if (placement.layer === "ground") {
    const surfaceType = inferSurfaceTypeFromPlacement(placement)

    return normalizeTerrainCell({
      ...cell,
      surfaceType,
      biome: buildBiomeFromSurfaceType(surfaceType),
      tags: appendTerrainTags(cell.tags, placement, "ground_surface"),
    })
  }

  if (placement.layer === "path") {
    return normalizeTerrainCell({
      ...cell,
      surfaceType: "soil",
      biome: "soil",
      fertility: cell.fertility - 10,
      tags: appendTerrainTags(cell.tags, placement, "path_soil"),
    })
  }

  if (placement.layer === "structure") {
    return normalizeTerrainCell({
      ...cell,
      surfaceType: "constructed_foundation",
      biome: "constructed",
      fertility: cell.fertility - 30,
      tags: appendTerrainTags(cell.tags, placement, "constructed_surface"),
    })
  }

  if (placement.layer === "facility") {
    return normalizeTerrainCell({
      ...cell,
      fertility: cell.fertility - 5,
      tags: appendTerrainTags(cell.tags, placement, "facility_pressure"),
    })
  }

  if (placement.layer === "nature") {
    return normalizeTerrainCell({
      ...cell,
      fertility: cell.fertility + 10,
      moisture: cell.moisture + 5,
      tags: appendTerrainTags(cell.tags, placement, "nature_growth"),
    })
  }

  return normalizeTerrainCell({
    ...cell,
    tags: appendTerrainTags(cell.tags, placement, `layer:${placement.layer}`),
  })
}

function normalizeTerrainCell(cell: TerrainCellState): TerrainCellState {
  return {
    ...cell,
    biome: buildBiomeFromSurfaceType(cell.surfaceType),
    moisture: clampPercent(cell.moisture),
    fertility: clampPercent(cell.fertility),
    slope: clampPercent(cell.slope),
    sunlight: clampPercent(cell.sunlight),
  }
}

function buildBiomeFromSurfaceType(surfaceType: WorldSurfaceType): TerrainBiome {
  if (surfaceType === "grass") {
    return "grassland"
  }

  if (surfaceType === "constructed_foundation" || surfaceType === "wood") {
    return "constructed"
  }

  return surfaceType
}

function appendTerrainTags(
  currentTags: string[],
  placement: MapPlacement,
  terrainTag: string
): string[] {
  return [
    ...currentTags,
    terrainTag,
    `placement:${placement.id}`,
    `placement_layer:${placement.layer}`,
    ...placement.tags,
  ]
}

function buildTerrainSummary(
  cells: Record<string, TerrainCellState>
): TerrainState["summary"] {
  const summary: TerrainState["summary"] = {
    grasslandCells: 0,
    soilCells: 0,
    waterCells: 0,
    sandCells: 0,
    stoneCells: 0,
    constructedCells: 0,
  }

  Object.values(cells).forEach((cell) => {
    if (cell.biome === "grassland") {
      summary.grasslandCells += 1
    }

    if (cell.biome === "soil") {
      summary.soilCells += 1
    }

    if (cell.biome === "water") {
      summary.waterCells += 1
    }

    if (cell.biome === "sand") {
      summary.sandCells += 1
    }

    if (cell.biome === "stone") {
      summary.stoneCells += 1
    }

    if (cell.biome === "constructed") {
      summary.constructedCells += 1
    }
  })

  return summary
}

function buildCellKey(x: number, y: number): string {
  return `${Math.floor(x)}_${Math.floor(y)}`
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}
