// 该文件用于审计正式像素渲染模型的只读边界。

import type { WorldViewModel } from "@/world/world-view-model/world-view-model-schema"

import type { FormalPixelRendererAudit, FormalPixelRenderLayers } from "./formal-pixel-renderer-schema"

export function buildFormalPixelRendererAudit(
  model: WorldViewModel,
  layers: FormalPixelRenderLayers
): FormalPixelRendererAudit {
  const visibleButlerActors = layers.actors.items.filter(
    (actor) => actor.kind === "butler" && actor.visible
  ).length
  const visiblePetActors = layers.actors.items.filter(
    (actor) => actor.kind === "pet" && actor.visible
  ).length
  const derivedVisualOnlyItems = layers.objects.items.filter(
    (object) => object.source === "derived_visual_only"
  ).length
  const worldFactItems = layers.objects.items.filter(
    (object) => object.source === "world_fact"
  ).length

  return {
    source: "world_view_model",
    readOnly: true,
    runtimeWrite: false,
    worldFactWrite: false,
    tickAdvance: false,
    debugVisualLabUsed: false,
    proceduralRendererUsed: false,
    defaultPetGenerated: false,
    visibleButlerActors,
    visiblePetActors,
    derivedVisualOnlyItems,
    worldFactItems,
    tags: buildAuditTags(model, visibleButlerActors, visiblePetActors),
  }
}

function buildAuditTags(
  model: WorldViewModel,
  visibleButlerActors: number,
  visiblePetActors: number
): string[] {
  const tags = [
    "formal_pixel_renderer_audit",
    "source_world_view_model_only",
    "read_only_render_projection",
    "no_runtime_write",
    "no_world_fact_write",
    "no_tick_advance",
    "no_debug_visual_lab",
    "no_procedural_renderer",
    "no_default_pet_generation",
  ]

  if (visibleButlerActors === 1) tags.push("one_visible_butler_actor")
  if (visiblePetActors === 0) tags.push("zero_visible_pet_actor")
  if (model.tags.includes("no_default_pet_actor")) tags.push("inherits_no_default_pet_actor_boundary")

  return tags
}
