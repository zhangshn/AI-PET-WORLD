/**
 * 当前文件职责：从家园地图和地形状态派生生态状态。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type { EcologyState, TerrainState } from "./environment-schema"

export type BuildEcologyStateInput = {
  homeMapState: HomeMapState
  terrainState: TerrainState
}

export function buildEcologyState(
  input: BuildEcologyStateInput
): EcologyState {
  const { homeMapState, terrainState } = input
  const totalCells = getTotalCells(terrainState)
  const naturePlacementCount = homeMapState.placements.filter(
    (placement) => placement.layer === "nature"
  ).length
  const grasslandRatio = ratio(
    terrainState.summary.grasslandCells,
    totalCells
  )
  const waterPresence = clampPercent(
    ratio(terrainState.summary.waterCells, totalCells) * 100
  )
  const vegetationDensity = clampPercent(
    naturePlacementCount * 4 +
      grasslandRatio * 45 +
      homeMapState.resources.naturalGrowth * 0.35
  )
  const averageFertility = averageTerrainValue(
    terrainState,
    (cell) => cell.fertility
  )
  const averageMoisture = averageTerrainValue(
    terrainState,
    (cell) => cell.moisture
  )
  const naturalGrowthPotential = clampPercent(
    homeMapState.resources.naturalGrowth * 0.45 +
      averageFertility * 0.35 +
      averageMoisture * 0.2
  )
  const habitatStability = clampPercent(
    homeMapState.resources.groundHealth * 0.35 +
      waterPresence * 0.2 +
      vegetationDensity * 0.25 +
      (100 - homeMapState.resources.spacePressure) * 0.2
  )

  return {
    vegetationDensity,
    waterPresence,
    naturalGrowthPotential,
    habitatStability,
    tags: buildEcologyTags({
      vegetationDensity,
      waterPresence,
      habitatStability,
    }),
  }
}

function buildEcologyTags(input: {
  vegetationDensity: number
  waterPresence: number
  habitatStability: number
}): string[] {
  return [
    input.vegetationDensity >= 55 ? "high_vegetation" : "low_vegetation",
    input.waterPresence > 0 ? "has_water" : "no_water",
    input.habitatStability >= 55 ? "stable_habitat" : "fragile_habitat",
  ]
}

function getTotalCells(terrainState: TerrainState): number {
  return Math.max(1, terrainState.width * terrainState.height)
}

function ratio(value: number, total: number): number {
  return total <= 0 ? 0 : value / total
}

function averageTerrainValue(
  terrainState: TerrainState,
  selector: (cell: TerrainState["cells"][string]) => number
): number {
  const cells = Object.values(terrainState.cells)

  if (cells.length === 0) {
    return 0
  }

  return (
    cells.reduce((total, cell) => total + selector(cell), 0) / cells.length
  )
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}
