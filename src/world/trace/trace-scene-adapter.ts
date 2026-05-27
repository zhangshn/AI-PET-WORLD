import type {
  SceneTraceFact,
  SceneTraceKind,
} from "@/world/procedural-painter/scene-composer/scene-composer-schema"

import type { TraceFact, TraceField, TraceType } from "./trace-schema"
import {
  buildTraceVisualProjectionFromTraceField,
  type TraceVisualProjection,
} from "./trace-visual-projection"

export function adaptTraceFieldToSceneTraceFacts(input: {
  traceField: TraceField
  maxTraces?: number
}): SceneTraceFact[] {
  const maxTraces = input.maxTraces ?? 12

  return [...input.traceField.traces]
    .sort(compareTracePriority)
    .slice(0, maxTraces)
    .map((trace) => ({
      id: trace.id,
      kind: mapTraceTypeToSceneTraceKind(trace.type),
      x: trace.area.x,
      y: trace.area.y,
      radius: trace.area.radius,
      strength: trace.strength,
      age: trace.age,
    }))
}

export function adaptTraceFieldToTraceVisualProjection(input: {
  traceField?: TraceField
  includeHidden?: boolean
}): TraceVisualProjection {
  return buildTraceVisualProjectionFromTraceField(input)
}

function compareTracePriority(left: TraceFact, right: TraceFact): number {
  if (right.strength !== left.strength) {
    return right.strength - left.strength
  }

  return left.id.localeCompare(right.id)
}

function mapTraceTypeToSceneTraceKind(type: TraceType): SceneTraceKind {
  if (type === "movement") return "movement"
  if (type === "spatial_use") return "spatial_use"
  if (type === "ecology_change") return "ecology"

  return "world"
}
