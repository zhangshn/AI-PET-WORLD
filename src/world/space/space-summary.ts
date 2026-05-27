import type {
  SpaceGrid,
  SpaceGridSummary,
  SpaceOccupancyKind,
  SpaceRegionKind,
  SpaceTerrainKind,
} from "./space-schema"

const REGION_KINDS: SpaceRegionKind[] = [
  "home",
  "yard",
  "nature",
  "structure",
  "town_connection",
  "blocked",
  "boundary",
  "unopened",
  "locked",
  "unknown",
]

const TERRAIN_KINDS: SpaceTerrainKind[] = [
  "grass",
  "soil",
  "forest_floor",
  "sand",
  "wetland",
  "stone",
  "built",
  "unknown",
]

const OCCUPANCY_KINDS: SpaceOccupancyKind[] = [
  "empty",
  "natural_object",
  "structure_object",
  "life_object",
  "event_anchor",
  "unknown",
]

export function summarizeSpaceGrid(spaceGrid: SpaceGrid): SpaceGridSummary {
  const passableCells = spaceGrid.cells.filter(
    (cell) => cell.passability === "passable"
  ).length
  const blockedCells = spaceGrid.cells.filter(
    (cell) => cell.passability === "blocked"
  ).length
  const restrictedCells = spaceGrid.cells.filter(
    (cell) => cell.passability === "restricted"
  ).length
  const occupiedCells = spaceGrid.cells.filter(
    (cell) => cell.occupancyKind !== "empty"
  ).length
  const traceInfluencedCells = spaceGrid.cells.filter(
    (cell) => cell.traceInfluenceStrength > 0
  ).length
  const costCells = spaceGrid.cells.filter(
    (cell) => cell.passability !== "blocked" && cell.passability !== "unknown"
  )

  return {
    totalCells: spaceGrid.cells.length,
    passableCells,
    blockedCells,
    restrictedCells,
    occupiedCells,
    traceInfluencedCells,
    averageMovementCost: average(
      costCells.map((cell) => cell.movementCost)
    ),
    averageTraceStrength: average(
      spaceGrid.cells.map((cell) => cell.traceStrength)
    ),
    averageFamiliarity: average(
      spaceGrid.cells.map((cell) => cell.familiarity ?? 0)
    ),
    regionCounts: countByKind(REGION_KINDS, (kind) =>
      spaceGrid.cells.filter((cell) => cell.regionKind === kind).length
    ),
    terrainCounts: countByKind(TERRAIN_KINDS, (kind) =>
      spaceGrid.cells.filter((cell) => cell.terrainKind === kind).length
    ),
    occupancyCounts: countByKind(OCCUPANCY_KINDS, (kind) =>
      spaceGrid.cells.filter((cell) => cell.occupancyKind === kind).length
    ),
  }
}

function countByKind<T extends string>(
  kinds: T[],
  countForKind: (kind: T) => number
): Record<T, number> {
  return kinds.reduce<Record<T, number>>(
    (result, kind) => ({
      ...result,
      [kind]: countForKind(kind),
    }),
    {} as Record<T, number>
  )
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  return roundMetric(total / values.length)
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2))
}
