/**
 * 当前文件职责：从家园地图和地形状态派生材料状态。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type { MaterialState, TerrainState } from "./environment-schema"

export type BuildMaterialStateInput = {
  homeMapState: HomeMapState
  terrainState: TerrainState
}

export function buildMaterialState(
  input: BuildMaterialStateInput
): MaterialState {
  const { homeMapState, terrainState } = input
  const totalCells = Math.max(1, terrainState.width * terrainState.height)
  const naturePlacementCount = homeMapState.placements.filter(
    (placement) => placement.layer === "nature"
  ).length
  const hasStorageToolsZone = homeMapState.zones.some(
    (zone) => zone.type === "storage_tools"
  )
  const materialReadiness = homeMapState.resources.materialReadiness
  const careReadiness = homeMapState.resources.careReadiness
  const vegetationDensity = clampPercent(
    naturePlacementCount * 4 +
      (terrainState.summary.grasslandCells / totalCells) * 45 +
      homeMapState.resources.naturalGrowth * 0.35
  )
  const wood = clampPercent(
    naturePlacementCount * 5 +
      materialReadiness * 0.45 +
      (hasStorageToolsZone ? 15 : 0)
  )
  const stone = clampPercent(
    (terrainState.summary.stoneCells / totalCells) * 100 * 0.65 +
      materialReadiness * 0.35
  )
  const soil = clampPercent(
    ((terrainState.summary.soilCells + terrainState.summary.grasslandCells) /
      totalCells) *
      75
  )
  const water = clampPercent(
    (terrainState.summary.waterCells / totalCells) * 100 * 0.7 +
      careReadiness * 0.3
  )
  const food = clampPercent(
    careReadiness * 0.35 +
      homeMapState.resources.naturalGrowth * 0.35 +
      vegetationDensity * 0.3
  )
  const buildReadiness = clampPercent(
    (materialReadiness + wood + stone + soil) / 4
  )

  return {
    wood,
    stone,
    soil,
    water,
    food,
    buildReadiness,
    tags: buildMaterialTags({
      wood,
      stone,
      soil,
      water,
      buildReadiness,
    }),
  }
}

function buildMaterialTags(input: {
  wood: number
  stone: number
  soil: number
  water: number
  buildReadiness: number
}): string[] {
  const materialAverage = (input.wood + input.stone + input.soil) / 3

  return [
    materialAverage >= 55 ? "high_materials" : "low_materials",
    input.water >= 45 ? "water_ready" : "water_poor",
    input.buildReadiness >= 55 ? "build_ready" : "build_limited",
  ]
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}
