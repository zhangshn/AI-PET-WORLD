/**
 * 当前文件职责：定义管家 / 宠物 actor 的只读几何投影协议。
 */

import type { Point2D, SpatialShape } from "@/world/spatial/spatial-gateway"

export type ActorGeometryKind = "butler" | "pet"

export type ActorGeometryPose =
  | "idle"
  | "observing"
  | "approaching"
  | "resting"
  | "working"
  | "unknown"

export type ActorAttentionDirection =
  | "north"
  | "east"
  | "south"
  | "west"
  | "center"
  | "unknown"

export type ActorGeometrySource =
  | "runtime_projection"
  | "deterministic_placeholder"
  | "unknown"

export type ActorGeometryProjection = {
  actorId: string
  actorKind: ActorGeometryKind
  anchor: Point2D
  body: SpatialShape
  interactionRadius: SpatialShape
  attentionDirection: ActorAttentionDirection
  pose: ActorGeometryPose
  source: ActorGeometrySource
  tags: string[]
}

export type BuildActorGeometryProjectionInput = {
  actorId: string
  actorKind: ActorGeometryKind
  anchor: Point2D
  pose?: ActorGeometryPose
  attentionDirection?: ActorAttentionDirection
  source?: ActorGeometrySource
  scale?: number
  tags?: string[]
}

export type BuildButlerActorGeometryProjectionInput = Omit<
  BuildActorGeometryProjectionInput,
  "actorKind"
>

export type BuildPetActorGeometryProjectionInput = Omit<
  BuildActorGeometryProjectionInput,
  "actorKind"
>
