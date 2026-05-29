// 该文件用于把 WorldViewModel traces 转换成正式痕迹层绘制指令。

import type { WorldViewTrace } from "@/world/world-view-model/world-view-model-schema"

import type { FormalPixelTraceLayer, FormalPixelTraceRenderItem } from "./formal-pixel-renderer-schema"

export function buildFormalTraceLayer(traces: WorldViewTrace[]): FormalPixelTraceLayer {
  return {
    kind: "trace",
    items: traces.map(toTraceRenderItem),
    tags: [
      "formal_pixel_trace_layer",
      "source_world_view_model_traces",
      "read_only_render_model",
      "not_random_decoration",
    ],
  }
}

function toTraceRenderItem(trace: WorldViewTrace): FormalPixelTraceRenderItem {
  return {
    id: trace.id,
    layerKind: "trace",
    x: trace.x,
    y: trace.y,
    radius: trace.radius,
    visualKind: trace.visualKind,
    intensity: trace.intensity,
    opacity: trace.opacity,
    traceLayer: trace.layer,
    drawOrder: buildTraceDrawOrder(trace),
    tags: buildTraceTags(trace),
  }
}

function buildTraceDrawOrder(trace: WorldViewTrace): number {
  const layerOffset = trace.layer === "ground" ? 0 : trace.layer === "surface" ? 80 : 160
  return 2_000 + layerOffset + trace.y
}

function buildTraceTags(trace: WorldViewTrace): string[] {
  return [
    "formal_pixel_trace",
    `trace_visual_${trace.visualKind}`,
    `trace_layer_${trace.layer}`,
    trace.intensity >= 70 ? "strong_trace" : trace.intensity >= 35 ? "medium_trace" : "soft_trace",
  ]
}
