/**
 * 当前文件负责：维护世界实体实例运行状态。
 */

import type { WorldPosition } from "../map/world-map"

export type WorldRuntimeEntityKind =
  | "pet"
  | "butler"
  | "npc"
  | "structure"
  | "creature"
  | "vegetation"
  | "resource"

export type WorldRuntimeEntity = {
  id: string
  kind: WorldRuntimeEntityKind
  type: string
  name: string
  position: WorldPosition
  active: boolean
  createdAtTick: number
  expiresAtTick?: number
  metadata?: Record<string, unknown>
}

export type EntityRuntimeState = {
  entities: WorldRuntimeEntity[]
}

export function createEmptyEntityRuntime(): EntityRuntimeState {
  return {
    entities: [],
  }
}

export function upsertWorldEntity(
  state: EntityRuntimeState,
  entity: WorldRuntimeEntity
): EntityRuntimeState {
  const exists = state.entities.some((item) => item.id === entity.id)

  return {
    entities: exists
      ? state.entities.map((item) => item.id === entity.id ? entity : item)
      : [...state.entities, entity],
  }
}

export function removeExpiredWorldEntities(input: {
  state: EntityRuntimeState
  tick: number
}): EntityRuntimeState {
  return {
    entities: input.state.entities.filter((entity) => {
      if (!entity.expiresAtTick) return true
      return entity.expiresAtTick >= input.tick
    }),
  }
}