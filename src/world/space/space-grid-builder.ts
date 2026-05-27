import type {
  HomeMapState,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import { clamp } from "@/world/procedural-painter/scene-composer/scene-composer-random"

import type {
  SpaceCell,
  SpaceGrid,
  SpaceOccupancyKind,
  SpacePassability,
  SpaceRegion,
  SpaceRegionKind,
  SpaceTerrainKind,
  SpaceTraceStrength,
} from "./space-schema"
import { summarizeSpaceGrid } from "./space-summary"

export type BuildSpaceGridFromHomeMapStateInput = {
  homeMapState: HomeMapState
}

type IndexedPlacement = {
  placement: MapPlacement
  column: number
  row: number
}

export function buildSpaceGridFromHomeMapState(
  input: BuildSpaceGridFromHomeMapStateInput
): SpaceGrid {
  const { homeMapState } = input
  const columns = Math.max(1, Math.round(homeMapState.mapSize.columns))
  const rows = Math.max(1, Math.round(homeMapState.mapSize.rows))
  const tileSize = Math.max(1, Math.round(homeMapState.mapSize.tileSize))
  const indexedPlacements = homeMapState.placements.map((placement) =>
    indexPlacement(placement, {
      columns,
      rows,
      tileSize,
    })
  )
  const cells: SpaceCell[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cellPlacements = indexedPlacements
        .filter((indexedPlacement) =>
          isPlacementOccupyingCell(indexedPlacement, {
            row,
            column,
          })
        )
        .map((indexedPlacement) => indexedPlacement.placement)
      const regionKind = resolveRegionKind({
        row,
        column,
        rows,
        columns,
        placements: cellPlacements,
      })
      const occupancyKind = resolveOccupancyKind(cellPlacements)
      const terrainKind = resolveTerrainKind({
        homeMapState,
        regionKind,
        occupancyKind,
      })
      const traceStrength = resolveTraceStrength({
        homeMapState,
        indexedPlacements,
        row,
        column,
      })
      const passability = resolvePassability({
        regionKind,
        occupancyKind,
        placements: cellPlacements,
      })

      cells.push({
        id: `space_cell_${column}_${row}`,
        x: column * tileSize + tileSize / 2,
        y: row * tileSize + tileSize / 2,
        z: resolveZLayer({ occupancyKind, regionKind }),
        layer: resolveZLayer({ occupancyKind, regionKind }),
        row,
        column,
        regionKind,
        terrainKind,
        passability,
        movementCost: resolveMovementCost({
          terrainKind,
          passability,
          traceStrength,
          spacePressure: homeMapState.resources.spacePressure,
        }),
        occupancyKind,
        occupancyIds: cellPlacements
          .filter((placement) => !isMovementTraceCompatibilityPlacement(placement))
          .map((placement) => placement.id),
        traceStrength,
        traceLevel: resolveTraceLevel(traceStrength),
        moistureHint: resolveMoistureHint(homeMapState),
        ecologyHealthHint: resolveEcologyHealthHint(homeMapState),
      })
    }
  }

  const partialGrid: SpaceGrid = {
    id: `space_grid_${homeMapState.worldId}`,
    worldId: homeMapState.worldId,
    columns,
    rows,
    tileSize,
    width: columns * tileSize,
    height: rows * tileSize,
    cells,
    regions: buildSpaceRegions(cells),
    summary: emptySummary(),
  }

  return {
    ...partialGrid,
    summary: summarizeSpaceGrid(partialGrid),
  }
}

function indexPlacement(
  placement: MapPlacement,
  input: {
    columns: number
    rows: number
    tileSize: number
  }
): IndexedPlacement {
  const column =
    placement.x <= input.columns
      ? Math.round(placement.x) - 1
      : Math.floor(placement.x / input.tileSize)
  const row =
    placement.y <= input.rows
      ? Math.round(placement.y) - 1
      : Math.floor(placement.y / input.tileSize)

  return {
    placement,
    column: clamp(column, 0, input.columns - 1),
    row: clamp(row, 0, input.rows - 1),
  }
}

function isPlacementOccupyingCell(
  indexedPlacement: IndexedPlacement,
  cell: {
    row: number
    column: number
  }
): boolean {
  if (isMovementTraceCompatibilityPlacement(indexedPlacement.placement)) {
    return false
  }

  const radius = resolveOccupancyRadius(indexedPlacement.placement)
  return (
    Math.abs(indexedPlacement.column - cell.column) <= radius &&
    Math.abs(indexedPlacement.row - cell.row) <= radius
  )
}

function resolveOccupancyRadius(placement: MapPlacement): number {
  if (placement.layer === "structure") return 1
  if (placement.layer === "facility") return 1
  if (placement.layer === "nature" && placement.scale > 1.1) return 1

  return 0
}

function resolveRegionKind(input: {
  row: number
  column: number
  rows: number
  columns: number
  placements: MapPlacement[]
}): SpaceRegionKind {
  if (
    input.row === 0 ||
    input.column === 0 ||
    input.row === input.rows - 1 ||
    input.column === input.columns - 1
  ) {
    return "boundary"
  }

  if (
    input.placements.some(
      (placement) => placement.layer === "structure" || placement.layer === "facility"
    )
  ) {
    return "structure"
  }

  const xRatio = (input.column + 0.5) / input.columns
  const yRatio = (input.row + 0.5) / input.rows
  const centerDistance = Math.hypot(xRatio - 0.5, yRatio - 0.5)

  if (centerDistance < 0.18) {
    return "home"
  }

  if (centerDistance < 0.36) {
    return "yard"
  }

  return "nature"
}

function resolveTerrainKind(input: {
  homeMapState: HomeMapState
  regionKind: SpaceRegionKind
  occupancyKind: SpaceOccupancyKind
}): SpaceTerrainKind {
  if (
    input.regionKind === "structure" ||
    input.occupancyKind === "structure_object"
  ) {
    return "built"
  }

  const biomeType = input.homeMapState.ecologyState?.biomeType
  const resources = input.homeMapState.resources

  if (biomeType === "desert") return "sand"
  if (biomeType === "oasis") return resources.groundHealth < 42 ? "wetland" : "grass"
  if (biomeType === "forest") return "forest_floor"

  if (resources.spacePressure > 76) return "soil"
  if (resources.groundHealth < 34) return "soil"
  if (resources.naturalGrowth > 78) return "forest_floor"

  return "grass"
}

function resolvePassability(input: {
  regionKind: SpaceRegionKind
  occupancyKind: SpaceOccupancyKind
  placements: MapPlacement[]
}): SpacePassability {
  if (input.occupancyKind === "structure_object") {
    return "blocked"
  }

  if (input.regionKind === "boundary") {
    return "restricted"
  }

  if (input.occupancyKind === "natural_object") {
    return input.placements.some((placement) =>
      hasAnyToken(placement, ["tree", "large", "canopy"])
    )
      ? "restricted"
      : "passable"
  }

  if (input.occupancyKind === "life_object") {
    return "restricted"
  }

  return "passable"
}

function resolveOccupancyKind(placements: MapPlacement[]): SpaceOccupancyKind {
  if (
    placements.some(
      (placement) => placement.layer === "structure" || placement.layer === "facility"
    )
  ) {
    return "structure_object"
  }

  if (placements.some((placement) => placement.layer === "actor")) {
    return "life_object"
  }

  if (placements.some((placement) => placement.layer === "nature")) {
    return "natural_object"
  }

  if (
    placements.some(
      (placement) =>
        placement.layer === "zone" ||
        placement.layer === "surface-decoration" ||
        placement.layer === "atmosphere"
    )
  ) {
    return "event_anchor"
  }

  return "empty"
}

function resolveTraceStrength(input: {
  homeMapState: HomeMapState
  indexedPlacements: IndexedPlacement[]
  row: number
  column: number
}): number {
  const tracePlacements = input.indexedPlacements.filter((indexedPlacement) =>
    isMovementTraceCompatibilityPlacement(indexedPlacement.placement)
  )

  if (tracePlacements.length === 0) {
    return 0
  }

  const strongestSignal = tracePlacements.reduce((strength, indexedPlacement) => {
    const distance = Math.hypot(
      indexedPlacement.column - input.column,
      indexedPlacement.row - input.row
    )
    const localSignal = clamp(Math.round(100 - distance * 42), 0, 100)
    return Math.max(strength, localSignal)
  }, 0)
  const resourceBias = Math.round(
    input.homeMapState.resources.groundHealth * 0.08 +
      input.homeMapState.resources.naturalGrowth * 0.12
  )

  return clamp(strongestSignal + resourceBias, 0, 100)
}

function resolveTraceLevel(traceStrength: number): SpaceTraceStrength {
  if (traceStrength >= 72) return "strong"
  if (traceStrength >= 38) return "medium"
  if (traceStrength > 0) return "weak"

  return "none"
}

function resolveMovementCost(input: {
  terrainKind: SpaceTerrainKind
  passability: SpacePassability
  traceStrength: number
  spacePressure: number
}): number {
  if (input.passability === "blocked") {
    return 999
  }

  const terrainBaseCost: Record<SpaceTerrainKind, number> = {
    grass: 34,
    soil: 46,
    forest_floor: 54,
    sand: 62,
    wetland: 74,
    stone: 48,
    built: 42,
    unknown: 68,
  }
  const passabilityCost =
    input.passability === "restricted"
      ? 74
      : input.passability === "unknown"
        ? 86
        : terrainBaseCost[input.terrainKind]
  const pressureCost = Math.round(input.spacePressure * 0.24)
  const traceDiscount = Math.round(input.traceStrength * 0.18)

  return clamp(passabilityCost + pressureCost - traceDiscount, 12, 160)
}

function resolveZLayer(input: {
  occupancyKind: SpaceOccupancyKind
  regionKind: SpaceRegionKind
}): number {
  if (input.occupancyKind === "structure_object") return 2
  if (input.occupancyKind === "natural_object") return 1
  if (input.occupancyKind === "life_object") return 1
  if (input.regionKind === "boundary") return 1

  return 0
}

function buildSpaceRegions(cells: SpaceCell[]): SpaceRegion[] {
  const regionKinds = Array.from(new Set(cells.map((cell) => cell.regionKind)))

  return regionKinds.map((kind) => {
    const regionCells = cells.filter((cell) => cell.regionKind === kind)
    const movementCostCells = regionCells.filter(
      (cell) => cell.passability !== "blocked" && cell.passability !== "unknown"
    )

    return {
      id: `space_region_${kind}`,
      kind,
      label: labelForRegionKind(kind),
      bounds: {
        minX: Math.min(...regionCells.map((cell) => cell.x)),
        minY: Math.min(...regionCells.map((cell) => cell.y)),
        maxX: Math.max(...regionCells.map((cell) => cell.x)),
        maxY: Math.max(...regionCells.map((cell) => cell.y)),
      },
      cellIds: regionCells.map((cell) => cell.id),
      passableCells: regionCells.filter((cell) => cell.passability === "passable")
        .length,
      blockedCells: regionCells.filter((cell) => cell.passability === "blocked")
        .length,
      averageMovementCost: average(
        movementCostCells.map((cell) => cell.movementCost)
      ),
      averageTraceStrength: average(
        regionCells.map((cell) => cell.traceStrength)
      ),
    }
  })
}

function labelForRegionKind(kind: SpaceRegionKind): string {
  if (kind === "home") return "Home core"
  if (kind === "yard") return "Yard"
  if (kind === "nature") return "Nature area"
  if (kind === "structure") return "Structure area"
  if (kind === "boundary") return "Boundary"
  if (kind === "unopened") return "Unopened area"

  return "Unknown area"
}

function resolveMoistureHint(homeMapState: HomeMapState): number {
  return clamp(
    Math.round(
      homeMapState.resources.groundHealth * 0.48 +
        homeMapState.resources.naturalGrowth * 0.32 +
        (100 - homeMapState.resources.spacePressure) * 0.2
    ),
    0,
    100
  )
}

function resolveEcologyHealthHint(homeMapState: HomeMapState): number {
  return clamp(
    Math.round(
      homeMapState.resources.groundHealth * 0.62 +
        homeMapState.resources.naturalGrowth * 0.38
    ),
    0,
    100
  )
}

function isMovementTraceCompatibilityPlacement(placement: MapPlacement): boolean {
  return placement.layer === "path" || placement.tags.includes("path")
}

function hasAnyToken(placement: MapPlacement, tokens: string[]): boolean {
  const placementTokens = [
    placement.id,
    placement.assetId,
    placement.label,
    placement.layer,
    ...placement.tags,
  ].map((token) => token.toLowerCase())

  return tokens.some((token) =>
    placementTokens.some((placementToken) => placementToken.includes(token))
  )
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
  )
}

function emptySummary() {
  return {
    totalCells: 0,
    passableCells: 0,
    blockedCells: 0,
    restrictedCells: 0,
    occupiedCells: 0,
    averageMovementCost: 0,
    averageTraceStrength: 0,
    regionCounts: {
      home: 0,
      yard: 0,
      nature: 0,
      structure: 0,
      boundary: 0,
      unopened: 0,
      unknown: 0,
    },
    terrainCounts: {
      grass: 0,
      soil: 0,
      forest_floor: 0,
      sand: 0,
      wetland: 0,
      stone: 0,
      built: 0,
      unknown: 0,
    },
    occupancyCounts: {
      empty: 0,
      natural_object: 0,
      structure_object: 0,
      life_object: 0,
      event_anchor: 0,
      unknown: 0,
    },
  }
}
