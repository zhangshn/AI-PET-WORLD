// 该文件用于把 WorldViewModel objects 转换成正式物体层绘制指令。

import type { WorldViewObject } from "@/world/world-view-model/world-view-model-schema"

import type { FormalPixelObjectLayer, FormalPixelObjectRenderItem } from "./formal-pixel-renderer-schema"

export function buildFormalObjectLayer(objects: WorldViewObject[]): FormalPixelObjectLayer {
  return {
    kind: "object",
    items: objects.map(toObjectRenderItem),
    tags: [
      "formal_pixel_object_layer",
      "source_world_view_model_objects",
      "read_only_render_model",
      "derived_visual_only_not_world_fact",
    ],
  }
}

function toObjectRenderItem(object: WorldViewObject): FormalPixelObjectRenderItem {
  return {
    id: object.id,
    layerKind: "object",
    kind: object.kind,
    source: object.source,
    x: object.x,
    y: object.y,
    worldLayer: object.layer,
    scale: object.scale,
    opacity: object.opacity,
    health: object.health,
    growthStage: object.growthStage,
    label: object.label,
    drawOrder: buildObjectDrawOrder(object),
    tags: buildObjectTags(object),
  }
}

function buildObjectDrawOrder(object: WorldViewObject): number {
  const layerOffset = object.layer === "back" ? 0 : object.layer === "middle" ? 1_000 : 2_000
  return 3_000 + layerOffset + object.y
}

function buildObjectTags(object: WorldViewObject): string[] {
  const tags = [
    "formal_pixel_object",
    `object_kind_${object.kind}`,
    `object_source_${object.source}`,
    `world_layer_${object.layer}`,
  ]

  if (object.source === "derived_visual_only") tags.push("no_runtime_write")
  if (object.kind === "tree") tags.push("procedural_tree_candidate")
  if (object.kind === "structure" || object.kind === "facility") tags.push("future_construction_visual_candidate")

  return [...tags, ...object.tags]
}
