/**
 * 当前文件负责：定义世界实体的基础类型、空间信息、感知信息与运行状态。
 */

import type { WorldPosition } from "../map/world-map"

export type WorldEntityKind =
  | "pet"
  | "butler"
  | "incubator"
  | "home"
  | "structure"
  | "vegetation"
  | "resource"
  | "creature"
  | "npc"
  | "environment"

export type WorldEntityLifecycleState =
  | "inactive"
  | "spawning"
  | "active"
  | "decaying"
  | "expired"

export type WorldEntityVisibility = "hidden" | "visible" | "debug_only"

export type WorldEntityMovementMode =
  | "static"
  | "wander"
  | "directed"
  | "attached"

export type WorldEntityInteractionTag =
  | "shelter"
  | "food_source"
  | "water_source"
  | "rest_spot"
  | "safe_spot"
  | "curiosity_source"
  | "danger_source"
  | "social_source"
  | "visual_motion"
  | "sound_source"
  | "scent_source"

export type WorldEntityStimulusChannel =
  | "visual"
  | "sound"
  | "scent"
  | "touch"
  | "temperature"
  | "movement"
  | "memory"

export type WorldEntitySpatial = {
  position: WorldPosition
  radius: number
  height?: number
  walkable: boolean
  blocksMovement: boolean
  blocksSight?: boolean
  interactionRange: number
}

export type WorldEntityVisual = {
  label: string
  icon?: string
  colorToken?: string
  layer: "ground" | "object" | "creature" | "actor" | "effect" | "debug"
  visibility: WorldEntityVisibility
}

export type WorldEntityStimulusProfile = {
  enabled: boolean
  channels: WorldEntityStimulusChannel[]
  intensity: number
  radius: number
  tags: WorldEntityInteractionTag[]
  cooldownTicks?: number
}

export type WorldEntityMovementProfile = {
  mode: WorldEntityMovementMode
  speedPerTick: number
  homePosition?: WorldPosition
  targetPosition?: WorldPosition
  wanderRadius?: number
  lastMovedAtTick?: number
}

export type WorldEntityRuntimeFlags = {
  selectable: boolean
  observable: boolean
  canBeStimulusSource: boolean
  canMove: boolean
  canExpire: boolean
}

export type WorldEntity = {
  id: string
  kind: WorldEntityKind
  type: string
  name: string
  description?: string
  lifecycle: WorldEntityLifecycleState
  spatial: WorldEntitySpatial
  visual: WorldEntityVisual
  stimulus: WorldEntityStimulusProfile
  movement: WorldEntityMovementProfile
  flags: WorldEntityRuntimeFlags
  createdAtTick: number
  updatedAtTick: number
  expiresAtTick?: number
  metadata: Record<string, unknown>
}

export type WorldEntitySnapshot = {
  entities: WorldEntity[]
  count: number
  activeCount: number
}

export type CreateWorldEntityInput = {
  id: string
  kind: WorldEntityKind
  type: string
  name: string
  description?: string
  position: WorldPosition
  radius?: number
  interactionRange?: number
  visual?: Partial<WorldEntityVisual>
  stimulus?: Partial<WorldEntityStimulusProfile>
  movement?: Partial<WorldEntityMovementProfile>
  flags?: Partial<WorldEntityRuntimeFlags>
  createdAtTick?: number
  expiresAtTick?: number
  metadata?: Record<string, unknown>
}

export function createWorldEntity(input: CreateWorldEntityInput): WorldEntity {
  const createdAtTick = input.createdAtTick ?? 0

  return {
    id: input.id,
    kind: input.kind,
    type: input.type,
    name: input.name,
    description: input.description,
    lifecycle: "active",
    spatial: {
      position: input.position,
      radius: input.radius ?? 1,
      walkable: false,
      blocksMovement: false,
      interactionRange: input.interactionRange ?? 3,
    },
    visual: {
      label: input.visual?.label ?? input.name,
      icon: input.visual?.icon,
      colorToken: input.visual?.colorToken,
      layer: input.visual?.layer ?? "object",
      visibility: input.visual?.visibility ?? "visible",
    },
    stimulus: {
      enabled: input.stimulus?.enabled ?? true,
      channels: input.stimulus?.channels ?? ["visual"],
      intensity: input.stimulus?.intensity ?? 30,
      radius: input.stimulus?.radius ?? input.interactionRange ?? 3,
      tags: input.stimulus?.tags ?? ["curiosity_source"],
      cooldownTicks: input.stimulus?.cooldownTicks,
    },
    movement: {
      mode: input.movement?.mode ?? "static",
      speedPerTick: input.movement?.speedPerTick ?? 0,
      homePosition: input.movement?.homePosition,
      targetPosition: input.movement?.targetPosition,
      wanderRadius: input.movement?.wanderRadius,
      lastMovedAtTick: input.movement?.lastMovedAtTick,
    },
    flags: {
      selectable: input.flags?.selectable ?? true,
      observable: input.flags?.observable ?? true,
      canBeStimulusSource: input.flags?.canBeStimulusSource ?? true,
      canMove: input.flags?.canMove ?? false,
      canExpire: input.flags?.canExpire ?? false,
    },
    createdAtTick,
    updatedAtTick: createdAtTick,
    expiresAtTick: input.expiresAtTick,
    metadata: input.metadata ?? {},
  }
}

export function isActiveWorldEntity(entity: WorldEntity): boolean {
  return entity.lifecycle === "active" || entity.lifecycle === "spawning"
}