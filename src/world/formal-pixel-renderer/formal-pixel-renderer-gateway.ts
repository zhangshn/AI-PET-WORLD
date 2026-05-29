// 该文件用于把 WorldViewModel 转换成正式像素渲染模型。

import type { WorldViewModel } from "@/world/world-view-model/world-view-model-schema"

import { buildFormalActorLayer } from "./actor-layer-renderer"
import { buildFormalAtmosphereLayer } from "./atmosphere-layer-renderer"
import { buildFormalObjectLayer } from "./object-layer-renderer"
import { buildFormalPixelRendererAudit } from "./formal-pixel-renderer-audit"
import type { FormalPixelRenderModel } from "./formal-pixel-renderer-schema"
import { buildFormalTileLayer } from "./tile-layer-renderer"
import { buildFormalTraceLayer } from "./trace-layer-renderer"

export function buildFormalPixelRenderModel(model: WorldViewModel): FormalPixelRenderModel {
  const layers = {
    tiles: buildFormalTileLayer(model.tiles),
    traces: buildFormalTraceLayer(model.traces),
    objects: buildFormalObjectLayer(model.objects),
    actors: buildFormalActorLayer(model.actors),
    atmosphere: buildFormalAtmosphereLayer(model.atmosphere),
  }

  return {
    worldId: model.worldId,
    ownerId: model.ownerId,
    tick: model.tick,
    savedAt: model.savedAt,
    canvas: model.canvas,
    layers,
    audit: buildFormalPixelRendererAudit(model, layers),
    tags: [
      "formal_pixel_render_model",
      "source_world_view_model_only",
      "formal_pixel_renderer_v0",
      "read_only_render_projection",
      "no_runtime_write",
      "no_world_fact_write",
      "no_tick_advance",
      "no_debug_visual_lab",
      "no_procedural_renderer",
      "no_default_pet_generation",
    ],
  }
}
