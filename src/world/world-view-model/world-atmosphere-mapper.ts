import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"
import type { TraceField } from "@/world/trace"

import type { WorldViewAtmosphere } from "./world-view-model-schema"

export function buildWorldViewAtmosphere(input: {
  homeMapState: HomeMapState
  traceField?: TraceField
  saveRecord: WorldRuntimeSaveRecord
}): WorldViewAtmosphere {
  const resources = input.homeMapState.resources
  const averageTraceStrength = input.traceField?.summary.averageStrength ?? 0

  if (resources.spacePressure > 74) {
    return {
      mood: "busy",
      weather: "soft",
      opacity: clampOpacity(0.18 + averageTraceStrength / 1000),
    }
  }

  if (resources.groundHealth < 42) {
    return {
      mood: "recovering",
      weather: "damp",
      opacity: clampOpacity(0.2),
    }
  }

  if (resources.careReadiness > 68) {
    return {
      mood: "warm",
      weather: "clear",
      opacity: clampOpacity(0.14),
    }
  }

  return {
    mood: "calm",
    weather: resources.groundHealth > 58 ? "clear" : "soft",
    opacity: clampOpacity(0.12 + averageTraceStrength / 1600),
  }
}

function clampOpacity(value: number): number {
  return Number(Math.max(0.08, Math.min(0.28, value)).toFixed(2))
}
