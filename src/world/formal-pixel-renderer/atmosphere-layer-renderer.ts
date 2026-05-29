// 该文件用于把 WorldViewModel atmosphere 转换成正式氛围层绘制指令。

import type { WorldViewAtmosphere } from "@/world/world-view-model/world-view-model-schema"

import type { FormalPixelAtmosphereLayer, FormalPixelAtmosphereRenderItem } from "./formal-pixel-renderer-schema"

export function buildFormalAtmosphereLayer(atmosphere: WorldViewAtmosphere): FormalPixelAtmosphereLayer {
  return {
    kind: "atmosphere",
    items: [toAtmosphereRenderItem(atmosphere)],
    tags: [
      "formal_pixel_atmosphere_layer",
      "source_world_view_model_atmosphere",
      "read_only_render_model",
      "no_debug_copy",
    ],
  }
}

function toAtmosphereRenderItem(atmosphere: WorldViewAtmosphere): FormalPixelAtmosphereRenderItem {
  return {
    id: "formal_atmosphere_primary",
    layerKind: "atmosphere",
    mood: atmosphere.mood,
    weather: atmosphere.weather,
    opacity: atmosphere.opacity,
    drawOrder: 9_000,
    tags: [
      "formal_pixel_atmosphere",
      `mood_${atmosphere.mood}`,
      `weather_${atmosphere.weather}`,
    ],
  }
}
