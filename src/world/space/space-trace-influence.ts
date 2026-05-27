import type { TraceFact, TraceField } from "@/world/trace"
import { clamp } from "@/world/procedural-painter/scene-composer/scene-composer-random"

import type {
  SpaceCell,
  SpaceGrid,
  SpaceRegionKind,
  SpaceTraceInfluence,
  SpaceTraceInfluenceFactor,
  SpaceTraceInfluenceSummary,
} from "./space-schema"

export type BuildTraceInfluenceForSpaceGridResult = {
  traceInfluenceByCellId: Record<string, SpaceTraceInfluence>
  summary: SpaceTraceInfluenceSummary
  warnings: string[]
  tags: string[]
}

export function buildTraceInfluenceForSpaceGrid(input: {
  spaceGrid: SpaceGrid
  traceField?: TraceField
}): BuildTraceInfluenceForSpaceGridResult {
  if (!input.traceField || input.traceField.traces.length === 0) {
    const summary = emptySummary()
    return {
      traceInfluenceByCellId: {},
      summary,
      warnings: ["No persisted TraceField was provided."],
      tags: ["space_trace_influence", "no_trace_field"],
    }
  }

  const traceInfluenceByCellId = input.spaceGrid.cells.reduce<
    Record<string, SpaceTraceInfluence>
  >((result, cell) => {
    const factors = input.traceField
      ? buildTraceInfluenceFactorsForCell({
          cell,
          traces: input.traceField.traces,
        })
      : []

    if (factors.length === 0) return result

    return {
      ...result,
      [cell.id]: {
        cellId: cell.id,
        strength: clamp(
          Math.round(average(factors.map((factor) => factor.strength))),
          0,
          100
        ),
        movementCostDelta: clamp(
          Math.round(sum(factors.map((factor) => factor.movementCostDelta))),
          -24,
          36
        ),
        familiarityDelta: clamp(
          Math.round(sum(factors.map((factor) => factor.familiarityDelta))),
          -10,
          40
        ),
        visualIntensityDelta: clamp(
          Math.round(sum(factors.map((factor) => factor.visualIntensityDelta))),
          -20,
          50
        ),
        factors,
      },
    }
  }, {})
  const summary = summarizeTraceInfluence({
    spaceGrid: input.spaceGrid,
    traceInfluenceByCellId,
    traceField: input.traceField,
  })

  return {
    traceInfluenceByCellId,
    summary,
    warnings: summary.warnings,
    tags: summary.tags,
  }
}

function buildTraceInfluenceFactorsForCell(input: {
  cell: SpaceCell
  traces: TraceFact[]
}): SpaceTraceInfluenceFactor[] {
  return input.traces
    .filter((trace) => isTraceRelatedToCell(trace, input.cell))
    .map((trace) => {
      const weight = trace.strength / 100
      const lifecycleMultiplier = resolveLifecycleMultiplier(trace)

      return {
        traceId: trace.id,
        traceType: trace.type,
        lifecyclePhase: trace.lifecyclePhase,
        movementCostDelta: clamp(
          Math.round(trace.effects.movementCostDelta * weight * lifecycleMultiplier),
          -10,
          12
        ),
        familiarityDelta: clamp(
          Math.round(trace.effects.familiarityDelta * weight * lifecycleMultiplier),
          -4,
          12
        ),
        visualIntensityDelta: clamp(
          Math.round(
            trace.effects.visualIntensityDelta * weight * lifecycleMultiplier
          ),
          -8,
          16
        ),
        strength: trace.strength,
        reason: `trace_effect:${trace.id}`,
      }
    })
}

function isTraceRelatedToCell(trace: TraceFact, cell: SpaceCell): boolean {
  if (trace.relatedCellIds.includes(cell.id)) return true
  if (trace.scope.cellIds.includes(cell.id)) return true
  if (trace.regionKinds.includes(cell.regionKind)) {
    return distanceToTraceArea(trace, cell) <= trace.area.radius
  }

  return false
}

function distanceToTraceArea(trace: TraceFact, cell: SpaceCell): number {
  return Math.hypot(cell.x - trace.area.x, cell.y - trace.area.y)
}

function resolveLifecycleMultiplier(trace: TraceFact): number {
  if (trace.lifecyclePhase === "strengthened") return 1.2
  if (trace.lifecyclePhase === "accumulating") return 1
  if (trace.lifecyclePhase === "repaired") return 0.82
  if (trace.lifecyclePhase === "transformed") return 0.78
  if (trace.lifecyclePhase === "deposited") return 0.45
  if (trace.lifecyclePhase === "decaying") return 0.36
  if (trace.lifecyclePhase === "covered") return 0.28

  return 0.7
}

function summarizeTraceInfluence(input: {
  spaceGrid: SpaceGrid
  traceInfluenceByCellId: Record<string, SpaceTraceInfluence>
  traceField: TraceField
}): SpaceTraceInfluenceSummary {
  const influencedCells = input.spaceGrid.cells.filter(
    (cell) => input.traceInfluenceByCellId[cell.id]
  )
  const familiarRegions = new Set<SpaceRegionKind>()
  const highTraceMovementCostRegions = new Set<SpaceRegionKind>()

  influencedCells.forEach((cell) => {
    const influence = input.traceInfluenceByCellId[cell.id]
    if (influence.familiarityDelta >= 8) familiarRegions.add(cell.regionKind)
    if (influence.movementCostDelta >= 8) {
      highTraceMovementCostRegions.add(cell.regionKind)
    }
  })

  const highMaintenanceTraceCount = input.traceField.traces.filter(
    (trace) => trace.effects.maintenancePriorityDelta >= 4
  ).length

  return {
    totalInfluencedCells: influencedCells.length,
    averageTraceInfluenceStrength: roundMetric(
      average(
        influencedCells.map(
          (cell) => input.traceInfluenceByCellId[cell.id]?.strength ?? 0
        )
      )
    ),
    averageFamiliarity: roundMetric(
      average(
        influencedCells.map(
          (cell) => input.traceInfluenceByCellId[cell.id]?.familiarityDelta ?? 0
        )
      )
    ),
    highMaintenanceTraceCount,
    familiarRegionCount: familiarRegions.size,
    preferredObservationRegions: Array.from(familiarRegions),
    highTraceMovementCostRegions: Array.from(highTraceMovementCostRegions),
    maintenancePriorityHints: input.traceField.traces
      .filter((trace) => trace.effects.maintenancePriorityDelta >= 4)
      .slice(0, 8)
      .map((trace) => trace.id),
    warnings: [],
    tags: [
      "space_trace_influence",
      "read_only_trace_effect_projection",
      "hard_passability_rules_preserved",
    ],
  }
}

function emptySummary(): SpaceTraceInfluenceSummary {
  return {
    totalInfluencedCells: 0,
    averageTraceInfluenceStrength: 0,
    averageFamiliarity: 0,
    highMaintenanceTraceCount: 0,
    familiarRegionCount: 0,
    preferredObservationRegions: [],
    highTraceMovementCostRegions: [],
    maintenancePriorityHints: [],
    warnings: ["No trace influence was projected."],
    tags: ["space_trace_influence", "empty"],
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return sum(values) / values.length
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2))
}
