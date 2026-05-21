/**
 * 当前文件职责：定义 actor runtime projection 的只读输入边界协议。
 */

import type {
  ActorAttentionDirection,
  ActorGeometryProjection,
  ActorGeometryKind,
  ActorGeometryPose,
  ActorGeometrySource,
} from "@/world/actor-geometry/actor-geometry-gateway"

import type { Point2D } from "@/world/spatial/spatial-gateway"

export type ActorRuntimeProjectionSource =
  | "butler_runtime_context"
  | "pet_state"
  | "deterministic_placeholder"
  | "unknown"

export type ActorRuntimePresence =
  | "present"
  | "not_ready"
  | "unknown"

export type ActorRuntimeProjectionInput = {
  actorId: string
  actorKind: ActorGeometryKind
  worldId: string
  anchor: Point2D
  presence: ActorRuntimePresence
  pose: ActorGeometryPose
  attentionDirection: ActorAttentionDirection
  source: ActorRuntimeProjectionSource
  scale: number
  reason: string
  tags: string[]
}

export type ActorRuntimeProjectionResult = {
  actorId: string
  actorKind: ActorGeometryKind
  worldId: string
  presence: ActorRuntimePresence
  canProject: boolean
  anchor: Point2D
  pose: ActorGeometryPose
  attentionDirection: ActorAttentionDirection
  source: ActorRuntimeProjectionSource
  scale: number
  reason: string
  tags: string[]
}

export type ActorRuntimeGeometryProjectionStatus =
  | "projected"
  | "skipped_not_ready"
  | "skipped_unknown"

export type ActorRuntimeGeometryProjectionResult = {
  actorId: string
  actorKind: ActorGeometryKind
  worldId: string
  status: ActorRuntimeGeometryProjectionStatus
  canProject: boolean
  runtimeProjection: ActorRuntimeProjectionResult
  geometryProjection?: ActorGeometryProjection
  geometrySource: ActorGeometrySource
  reason: string
  tags: string[]
}

export type BuildButlerRuntimeProjectionInput = {
  worldId: string
  butlerId: string
  tickIndex: number
  currentTask: string
  mood: string
  attentionTargetType?: string
  anchor?: Point2D
  tags?: string[]
}

export type BuildPetRuntimeProjectionInput = {
  worldId: string
  petId: string
  isBorn: boolean
  action: string
  mood: string
  energy: number
  anchor?: Point2D
  tags?: string[]
}
