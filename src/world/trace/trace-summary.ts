import type {
  TraceField,
  TraceFieldSummary,
  TraceLifecyclePhase,
  TraceSourceKind,
  TraceType,
} from "./trace-schema"

const LIFECYCLE_PHASES: TraceLifecyclePhase[] = [
  "generated",
  "accumulating",
  "strengthened",
  "decaying",
  "covered",
  "repaired",
  "deposited",
]

const SOURCE_KINDS: TraceSourceKind[] = [
  "space_projection",
  "movement_compatibility_input",
  "ecology_state",
  "placement_state",
  "world_event_placeholder",
  "unknown",
]

export function summarizeTraceField(
  traceField: Omit<TraceField, "summary">
): TraceFieldSummary {
  const traces = traceField.traces

  return {
    totalTraces: traces.length,
    spatialUseTraces: countType(traces, "spatial_use"),
    movementTraces: countType(traces, "movement"),
    ecologyChangeTraces: countType(traces, "ecology_change"),
    behaviorActivityTraces: countType(traces, "behavior_activity"),
    constructionMaintenanceTraces: countType(
      traces,
      "construction_maintenance"
    ),
    relationshipInteractionTraces: countType(
      traces,
      "relationship_interaction"
    ),
    timePassageTraces: countType(traces, "time_passage"),
    eventImpactTraces: countType(traces, "event_impact"),
    weakTraces: traces.filter((trace) => trace.strengthLevel === "weak").length,
    mediumTraces: traces.filter((trace) => trace.strengthLevel === "medium")
      .length,
    strongTraces: traces.filter((trace) => trace.strengthLevel === "strong")
      .length,
    landmarkTraces: traces.filter(
      (trace) => trace.strengthLevel === "landmark"
    ).length,
    averageStrength: average(traces.map((trace) => trace.strength)),
    averageAge: average(traces.map((trace) => trace.age)),
    lifecycleCounts: countByKind(LIFECYCLE_PHASES, (phase) =>
      traces.filter((trace) => trace.lifecyclePhase === phase).length
    ),
    sourceCounts: countByKind(SOURCE_KINDS, (sourceKind) =>
      traces.filter((trace) => trace.sourceKind === sourceKind).length
    ),
  }
}

function countType(
  traces: Omit<TraceField, "summary">["traces"],
  type: TraceType
): number {
  return traces.filter((trace) => trace.type === type).length
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

  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
  )
}
