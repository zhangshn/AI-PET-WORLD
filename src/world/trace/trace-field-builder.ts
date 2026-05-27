import type {
  HomeMapState,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import { clamp } from "@/world/procedural-painter/scene-composer/scene-composer-random"
import type {
  SpaceCell,
  SpaceGrid,
  SpaceRegionKind,
  SpaceTerrainKind,
} from "@/world/space"

import {
  normalizeTraceStrength,
  resolveTraceAge,
  resolveTraceLifecyclePhase,
  resolveTraceStrengthLevel,
} from "./trace-lifecycle"
import { summarizeTraceField } from "./trace-summary"
import type {
  TraceArea,
  TraceFact,
  TraceField,
  TraceSourceKind,
  TraceType,
} from "./trace-schema"

export type BuildTraceFieldFromWorldInput = {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
}

export function buildTraceFieldFromWorld(
  input: BuildTraceFieldFromWorldInput
): TraceField {
  const traces = buildRegionTraces(input)
  const traceFieldWithoutSummary = {
    id: `trace_field_${input.homeMapState.worldId}`,
    worldId: input.homeMapState.worldId,
    traces,
    projectedCellIds: uniqueStrings(
      traces.flatMap((trace) => trace.relatedCellIds)
    ),
  }

  return {
    ...traceFieldWithoutSummary,
    summary: summarizeTraceField(traceFieldWithoutSummary),
  }
}

function buildRegionTraces(input: BuildTraceFieldFromWorldInput): TraceFact[] {
  const regionKinds = Array.from(
    new Set(input.spaceGrid.cells.map((cell) => cell.regionKind))
  )

  return regionKinds.flatMap((regionKind) => {
    const regionCells = input.spaceGrid.cells.filter(
      (cell) => cell.regionKind === regionKind
    )
    return [
      buildSpatialUseTrace({
        ...input,
        regionKind,
        regionCells,
      }),
      buildMovementTrace({
        ...input,
        regionKind,
        regionCells,
      }),
      buildEcologyChangeTrace({
        ...input,
        regionKind,
        regionCells,
      }),
    ].filter((trace): trace is TraceFact => Boolean(trace))
  })
}

function buildSpatialUseTrace(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  regionKind: SpaceRegionKind
  regionCells: SpaceCell[]
}): TraceFact | null {
  const signalCells = input.regionCells.filter(
    (cell) =>
      cell.occupancyKind !== "empty" ||
      cell.traceStrength >= 38 ||
      (cell.passability !== "blocked" && cell.movementCost >= 72)
  )

  if (signalCells.length === 0) {
    return null
  }

  const occupiedRatio =
    signalCells.filter((cell) => cell.occupancyKind !== "empty").length /
    Math.max(1, input.regionCells.length)
  const costSignal = average(
    signalCells
      .filter((cell) => cell.passability !== "blocked")
      .map((cell) => cell.movementCost)
  )
  const strength = normalizeTraceStrength(
    average(signalCells.map((cell) => cell.traceStrength)) * 0.4 +
      occupiedRatio * 100 * 0.35 +
      costSignal * 0.25
  )

  return buildTraceFact({
    homeMapState: input.homeMapState,
    type: "spatial_use",
    sourceKind: "space_projection",
    strength,
    cells: signalCells,
    relatedPlacementIds: uniqueStrings(
      signalCells.flatMap((cell) => cell.occupancyIds)
    ),
    regionKind: input.regionKind,
    tags: ["space_projection", "spatial_use"],
  })
}

function buildMovementTrace(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  regionKind: SpaceRegionKind
  regionCells: SpaceCell[]
}): TraceFact | null {
  const signalCells = input.regionCells.filter((cell) => cell.traceStrength > 0)

  if (signalCells.length === 0) {
    return null
  }

  const relatedMovementPlacementIds = resolveMovementCompatibilityPlacementIds({
    homeMapState: input.homeMapState,
    spaceGrid: input.spaceGrid,
    regionKind: input.regionKind,
  })
  const sourceKind: TraceSourceKind =
    relatedMovementPlacementIds.length > 0
      ? "movement_compatibility_input"
      : "space_projection"
  const strength = normalizeTraceStrength(
    average(signalCells.map((cell) => cell.traceStrength)) * 0.72 +
      Math.max(...signalCells.map((cell) => cell.traceStrength)) * 0.28
  )

  return buildTraceFact({
    homeMapState: input.homeMapState,
    type: "movement",
    sourceKind,
    strength,
    cells: signalCells,
    relatedPlacementIds: relatedMovementPlacementIds,
    regionKind: input.regionKind,
    tags: ["movement_trace", sourceKind],
  })
}

function buildEcologyChangeTrace(input: {
  homeMapState: HomeMapState
  regionKind: SpaceRegionKind
  regionCells: SpaceCell[]
}): TraceFact | null {
  const resources = input.homeMapState.resources
  const ecologyStress = Math.max(
    0,
    100 - resources.groundHealth,
    100 - resources.naturalGrowth,
    resources.spacePressure
  )
  const regionEcologySignal =
    average(input.regionCells.map((cell) => 100 - cell.ecologyHealthHint)) * 0.5 +
    ecologyStress * 0.5
  const strength = normalizeTraceStrength(regionEcologySignal)

  if (strength < 18) {
    return null
  }

  return buildTraceFact({
    homeMapState: input.homeMapState,
    type: "ecology_change",
    sourceKind: "ecology_state",
    strength,
    cells: input.regionCells,
    relatedPlacementIds: [],
    regionKind: input.regionKind,
    tags: ["ecology_state", "ecology_change"],
    ecologyHealthHint: average(
      input.regionCells.map((cell) => cell.ecologyHealthHint)
    ),
  })
}

function buildTraceFact(input: {
  homeMapState: HomeMapState
  type: TraceType
  sourceKind: TraceSourceKind
  strength: number
  cells: SpaceCell[]
  relatedPlacementIds: string[]
  regionKind: SpaceRegionKind
  tags: string[]
  ecologyHealthHint?: number
}): TraceFact {
  const strength = normalizeTraceStrength(input.strength)
  const age = resolveTraceAge({
    createdAt: input.homeMapState.createdAt,
    updatedAt: input.homeMapState.updatedAt,
  })
  const area = buildTraceArea(input.cells)

  return {
    id: `trace_${input.homeMapState.worldId}_${input.type}_${input.regionKind}`,
    type: input.type,
    sourceKind: input.sourceKind,
    lifecyclePhase: resolveTraceLifecyclePhase({
      strength,
      age,
      sourceKind: input.sourceKind,
      ecologyHealthHint: input.ecologyHealthHint,
    }),
    strength,
    strengthLevel: resolveTraceStrengthLevel(strength),
    age,
    confidence: resolveConfidence({
      strength,
      cellCount: input.cells.length,
      sourceKind: input.sourceKind,
    }),
    area,
    relatedCellIds: input.cells.map((cell) => cell.id),
    relatedPlacementIds: input.relatedPlacementIds,
    regionKinds: [input.regionKind],
    terrainKinds: uniqueTerrainKinds(input.cells),
    createdAtTick: input.homeMapState.createdAt || 0,
    updatedAtTick: input.homeMapState.updatedAt || 0,
    tags: uniqueStrings([
      ...input.tags,
      `region:${input.regionKind}`,
      `type:${input.type}`,
      `source:${input.sourceKind}`,
    ]),
  }
}

function resolveMovementCompatibilityPlacementIds(input: {
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
  regionKind: SpaceRegionKind
}): string[] {
  return input.homeMapState.placements
    .filter(isMovementTraceCompatibilityPlacement)
    .filter((placement) => {
      const cell = findNearestCell(input.spaceGrid, placement)
      return cell?.regionKind === input.regionKind
    })
    .map((placement) => placement.id)
}

function findNearestCell(
  spaceGrid: SpaceGrid,
  placement: MapPlacement
): SpaceCell | undefined {
  const usesGridUnits =
    placement.x <= spaceGrid.columns && placement.y <= spaceGrid.rows
  const x = usesGridUnits
    ? (placement.x - 0.5) * spaceGrid.tileSize
    : placement.x
  const y = usesGridUnits
    ? (placement.y - 0.5) * spaceGrid.tileSize
    : placement.y

  return spaceGrid.cells.reduce<SpaceCell | undefined>((nearestCell, cell) => {
    if (!nearestCell) return cell

    const currentDistance = Math.hypot(cell.x - x, cell.y - y)
    const nearestDistance = Math.hypot(nearestCell.x - x, nearestCell.y - y)
    return currentDistance < nearestDistance ? cell : nearestCell
  }, undefined)
}

function buildTraceArea(cells: SpaceCell[]): TraceArea {
  const minX = Math.min(...cells.map((cell) => cell.x))
  const minY = Math.min(...cells.map((cell) => cell.y))
  const maxX = Math.max(...cells.map((cell) => cell.x))
  const maxY = Math.max(...cells.map((cell) => cell.y))
  const x = average(cells.map((cell) => cell.x))
  const y = average(cells.map((cell) => cell.y))
  const radius = clamp(
    Math.round(Math.max(maxX - minX, maxY - minY) / 2),
    1,
    9999
  )

  return {
    x,
    y,
    radius,
    minX,
    minY,
    maxX,
    maxY,
  }
}

function resolveConfidence(input: {
  strength: number
  cellCount: number
  sourceKind: TraceSourceKind
}): number {
  const sourceBonus =
    input.sourceKind === "movement_compatibility_input"
      ? 12
      : input.sourceKind === "ecology_state"
        ? 8
        : 4

  return clamp(Math.round(input.strength * 0.62 + input.cellCount + sourceBonus), 0, 100)
}

function uniqueTerrainKinds(cells: SpaceCell[]): SpaceTerrainKind[] {
  return Array.from(new Set(cells.map((cell) => cell.terrainKind)))
}

function isMovementTraceCompatibilityPlacement(placement: MapPlacement): boolean {
  return placement.layer === "path" || placement.tags.includes("path")
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
  )
}
