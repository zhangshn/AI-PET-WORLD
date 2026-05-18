/**
 * 当前文件职责：定义生态环境层派生状态协议。
 */

import type { WorldSurfaceType } from "@/world/core-rules/world-rule-gateway"

export type TerrainBiome =
  | "grassland"
  | "soil"
  | "water"
  | "sand"
  | "stone"
  | "constructed"

export type TerrainCellState = {
  x: number
  y: number
  biome: TerrainBiome
  surfaceType: WorldSurfaceType
  moisture: number
  fertility: number
  slope: number
  sunlight: number
  tags: string[]
}

export type TerrainState = {
  width: number
  height: number
  cells: Record<string, TerrainCellState>
  summary: {
    grasslandCells: number
    soilCells: number
    waterCells: number
    sandCells: number
    stoneCells: number
    constructedCells: number
  }
}

export type EcologyState = {
  vegetationDensity: number
  waterPresence: number
  naturalGrowthPotential: number
  habitatStability: number
  tags: string[]
}

export type MaterialState = {
  wood: number
  stone: number
  soil: number
  water: number
  food: number
  buildReadiness: number
  tags: string[]
}

export type EnvironmentState = {
  worldId: string
  generatedAt: number
  terrain: TerrainState
  ecology: EcologyState
  materials: MaterialState
  tags: string[]
}
