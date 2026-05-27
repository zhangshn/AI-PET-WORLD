import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { SpaceGrid } from "@/world/space"

import {
  normalizeTraceStrength,
  resolveTraceStrengthLevel,
} from "./trace-lifecycle"
import type { TraceFact, TraceField } from "./trace-schema"
import { summarizeTraceField } from "./trace-summary"

export type TraceLifecycleTickResult = {
  nextTraceField: TraceField
  messages: string[]
  warnings: string[]
  tags: string[]
}

export function runTraceLifecycleTick(input: {
  previousTraceField?: TraceField
  derivedTraceField: TraceField
  currentTick: number
  homeMapState: HomeMapState
  spaceGrid: SpaceGrid
}): TraceLifecycleTickResult {
  const previousTraces = input.previousTraceField?.traces ?? []
  const derivedTraces = input.derivedTraceField.traces
  const previousByIdentity = new Map(
    previousTraces.map((trace) => [buildTraceIdentity(trace), trace])
  )
  const derivedByIdentity = new Map(
    derivedTraces.map((trace) => [buildTraceIdentity(trace), trace])
  )
  const nextTraces = [
    ...derivedTraces.map((derivedTrace) => {
      const previousTrace = previousByIdentity.get(buildTraceIdentity(derivedTrace))

      if (!previousTrace) {
        return createGeneratedTrace({
          derivedTrace,
          currentTick: input.currentTick,
        })
      }

      return reinforceTrace({
        previousTrace,
        derivedTrace,
        currentTick: input.currentTick,
        homeMapState: input.homeMapState,
      })
    }),
    ...previousTraces
      .filter((previousTrace) => !derivedByIdentity.has(buildTraceIdentity(previousTrace)))
      .map((previousTrace) =>
        decayTrace({
          previousTrace,
          currentTick: input.currentTick,
        })
      ),
  ]
  const retainedTraces = retainTraceHistory(nextTraces)
  const traceFieldWithoutSummary: Omit<TraceField, "summary"> = {
    id: input.derivedTraceField.id,
    worldId: input.derivedTraceField.worldId,
    traces: retainedTraces,
    projectedCellIds: uniqueStrings(
      retainedTraces.flatMap((trace) => trace.relatedCellIds)
    ),
  }
  const warnings =
    retainedTraces.length < nextTraces.length
      ? [
          `Trace lifecycle retained ${retainedTraces.length} of ${nextTraces.length} traces.`,
        ]
      : []

  return {
    nextTraceField: {
      ...traceFieldWithoutSummary,
      summary: summarizeTraceField(traceFieldWithoutSummary),
    },
    messages: [
      "Trace lifecycle tick completed.",
      `Derived traces: ${derivedTraces.length}.`,
      `Previous traces: ${previousTraces.length}.`,
      `Next traces: ${retainedTraces.length}.`,
    ],
    warnings,
    tags: [
      "trace_lifecycle_tick",
      "explicit_runtime_tick_only",
      "trace_effects_not_applied",
      "home_map_state_not_modified_by_trace",
      `space_cells:${input.spaceGrid.cells.length}`,
      ...warnings.map(() => "trace_history_retention_warning"),
    ],
  }
}

function createGeneratedTrace(input: {
  derivedTrace: TraceFact
  currentTick: number
}): TraceFact {
  return withLifecycleUpdate({
    trace: input.derivedTrace,
    strength: input.derivedTrace.strength,
    lifecyclePhase: "generated",
    currentTick: input.currentTick,
    createdAtTick: input.currentTick,
    lastReinforcedTick: input.currentTick,
    auditTag: "trace_generated_by_explicit_tick",
  })
}

function reinforceTrace(input: {
  previousTrace: TraceFact
  derivedTrace: TraceFact
  currentTick: number
  homeMapState: HomeMapState
}): TraceFact {
  const strengthDelta = input.derivedTrace.strength - input.previousTrace.strength
  const nextStrength = normalizeTraceStrength(
    input.previousTrace.strength * 0.58 + input.derivedTrace.strength * 0.42
  )
  const ecologyHealth = input.homeMapState.resources.groundHealth
  const lifecyclePhase = resolveReinforcedLifecyclePhase({
    trace: input.derivedTrace,
    strengthDelta,
    nextStrength,
    ecologyHealth,
  })

  return withLifecycleUpdate({
    trace: {
      ...input.derivedTrace,
      createdAtTick: input.previousTrace.createdAtTick,
      lastReinforcedTick: input.currentTick,
    },
    strength: nextStrength,
    lifecyclePhase,
    currentTick: input.currentTick,
    createdAtTick: input.previousTrace.createdAtTick,
    lastReinforcedTick: input.currentTick,
    auditTag:
      lifecyclePhase === "strengthened"
        ? "trace_strengthened_by_explicit_tick"
        : "trace_accumulated_by_explicit_tick",
  })
}

function decayTrace(input: {
  previousTrace: TraceFact
  currentTick: number
}): TraceFact {
  const nextStrength = normalizeTraceStrength(input.previousTrace.strength - 12)
  const lifecyclePhase =
    nextStrength <= 8
      ? "deposited"
      : input.previousTrace.lifecyclePhase === "covered"
        ? "covered"
        : "decaying"

  return withLifecycleUpdate({
    trace: input.previousTrace,
    strength: nextStrength,
    lifecyclePhase,
    currentTick: input.currentTick,
    createdAtTick: input.previousTrace.createdAtTick,
    lastReinforcedTick: input.previousTrace.lastReinforcedTick,
    auditTag: "trace_decayed_by_explicit_tick",
  })
}

function resolveReinforcedLifecyclePhase(input: {
  trace: TraceFact
  strengthDelta: number
  nextStrength: number
  ecologyHealth: number
}): TraceFact["lifecyclePhase"] {
  if (
    input.trace.type === "ecology_change" &&
    input.ecologyHealth > 70 &&
    input.nextStrength < 50
  ) {
    return "repaired"
  }

  if (input.trace.lifecyclePhase === "covered" && input.nextStrength < 42) {
    return "covered"
  }

  if (input.trace.sourceKind === "world_event" && input.nextStrength < 55) {
    return "transformed"
  }

  if (input.strengthDelta >= 8 || input.nextStrength >= 80) {
    return "strengthened"
  }

  return "accumulating"
}

function withLifecycleUpdate(input: {
  trace: TraceFact
  strength: number
  lifecyclePhase: TraceFact["lifecyclePhase"]
  currentTick: number
  createdAtTick: number
  lastReinforcedTick?: number
  auditTag: string
}): TraceFact {
  const strength = normalizeTraceStrength(input.strength)

  return {
    ...input.trace,
    strength,
    strengthLevel: resolveTraceStrengthLevel(strength),
    lifecyclePhase: input.lifecyclePhase,
    age: Math.max(0, input.currentTick - input.createdAtTick),
    createdAtTick: input.createdAtTick,
    updatedAtTick: input.currentTick,
    lastReinforcedTick: input.lastReinforcedTick,
    visualHints: {
      ...input.trace.visualHints,
      intensity: strength,
      opacityHint: Number((strength / 100).toFixed(2)),
    },
    audit: {
      ...input.trace.audit,
      tags: uniqueStrings([...input.trace.audit.tags, input.auditTag]),
    },
    tags: uniqueStrings([...input.trace.tags, input.auditTag]),
  }
}

function retainTraceHistory(traces: TraceFact[]): TraceFact[] {
  return [...traces]
    .filter((trace) => !(trace.strength <= 0 && trace.age > 120))
    .sort((left, right) => {
      if (right.strength !== left.strength) return right.strength - left.strength
      return left.id.localeCompare(right.id)
    })
    .slice(0, 80)
    .sort((left, right) => left.id.localeCompare(right.id))
}

function buildTraceIdentity(trace: TraceFact): string {
  const regionKey = trace.regionKinds.join("+") || "none"
  return [
    trace.type,
    trace.target.kind,
    trace.target.id,
    trace.scope.kind,
    regionKey,
  ].join("|")
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}
