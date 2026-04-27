/**
 * 当前文件负责：维护世界中实体的空间位置。
 */

import type { WorldPosition } from "../map/world-map"

export type SpatialEntityState = {
  entityId: string
  entityType: string
  position: WorldPosition
  radius: number
  active: boolean
}

export type SpatialRuntimeState = {
  entities: SpatialEntityState[]
}

export function createEmptySpatialRuntime(): SpatialRuntimeState {
  return {
    entities: [],
  }
}

export function upsertSpatialEntity(
  state: SpatialRuntimeState,
  entity: SpatialEntityState
): SpatialRuntimeState {
  const exists = state.entities.some((item) => item.entityId === entity.entityId)

  return {
    entities: exists
      ? state.entities.map((item) =>
          item.entityId === entity.entityId ? entity : item
        )
      : [...state.entities, entity],
  }
}

export function removeSpatialEntity(
  state: SpatialRuntimeState,
  entityId: string
): SpatialRuntimeState {
  return {
    entities: state.entities.filter((item) => item.entityId !== entityId),
  }
}