// 该文件用于把 WorldViewModel actors 转换成正式角色层绘制指令。

import type { WorldViewActor } from "@/world/world-view-model/world-view-model-schema"

import type { FormalPixelActorLayer, FormalPixelActorRenderItem } from "./formal-pixel-renderer-schema"

export function buildFormalActorLayer(actors: WorldViewActor[]): FormalPixelActorLayer {
  return {
    kind: "actor",
    items: actors.map(toActorRenderItem),
    tags: [
      "formal_pixel_actor_layer",
      "source_world_view_model_actors",
      "read_only_render_model",
      "no_default_pet_generation",
    ],
  }
}

function toActorRenderItem(actor: WorldViewActor): FormalPixelActorRenderItem {
  return {
    id: actor.id,
    layerKind: "actor",
    kind: actor.kind,
    x: actor.x,
    y: actor.y,
    worldLayer: actor.layer,
    pose: actor.pose,
    label: actor.label,
    visible: actor.visible,
    drawOrder: buildActorDrawOrder(actor),
    tags: buildActorTags(actor),
  }
}

function buildActorDrawOrder(actor: WorldViewActor): number {
  const layerOffset = actor.layer === "back" ? 0 : actor.layer === "middle" ? 1_000 : 2_000
  const visibilityOffset = actor.visible ? 0 : -500
  return 4_000 + layerOffset + actor.y + visibilityOffset
}

function buildActorTags(actor: WorldViewActor): string[] {
  const tags = [
    "formal_pixel_actor",
    `actor_kind_${actor.kind}`,
    `actor_pose_${actor.pose}`,
    `world_layer_${actor.layer}`,
    actor.visible ? "visible_actor" : "hidden_actor",
  ]

  if (actor.kind === "butler") tags.push("butler_actor")
  if (actor.kind === "pet") tags.push("pet_actor_requires_formal_entry")

  return tags
}
