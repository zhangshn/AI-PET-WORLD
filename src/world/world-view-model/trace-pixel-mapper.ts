import type { TraceFact } from "@/world/trace"

import type { WorldViewTrace } from "./world-view-model-schema"

export function mapTraceFieldToWorldViewTraces(input: {
  traces: TraceFact[]
}): WorldViewTrace[] {
  return input.traces.flatMap((trace) => {
    if (trace.visualHints.visualKind === "none") return []

    return [
      {
        id: `world_view_trace_${trace.id}`,
        visualKind: trace.visualHints.visualKind,
        x: trace.area.x,
        y: trace.area.y,
        radius: Math.max(6, Math.min(trace.area.radius, 96)),
        intensity: Math.max(0, Math.min(100, trace.visualHints.intensity)),
        opacity: Math.max(0.08, Math.min(0.42, trace.visualHints.opacityHint)),
        layer:
          trace.visualHints.visualKind === "attention_glow"
            ? "attention"
            : trace.visualHints.layerHint === "ground"
              ? "ground"
              : "surface",
      },
    ]
  })
}
