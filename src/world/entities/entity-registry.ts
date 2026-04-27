/**
 * 当前文件负责：维护世界实体注册表，提供实体查询、写入、更新与快照能力。
 */

import type {
  WorldEntity,
  WorldEntityKind,
  WorldEntityLifecycleState,
  WorldEntitySnapshot,
} from "./entity-types"
import { isActiveWorldEntity } from "./entity-types"
import type { WorldPosition } from "../map/world-map"

export type WorldEntityRegistryState = {
  entities: WorldEntity[]
  version: number
  updatedAtTick: number
}

export type WorldEntityRegistryFilter = {
  kind?: WorldEntityKind
  type?: string
  lifecycle?: WorldEntityLifecycleState
  activeOnly?: boolean
}

export function createEmptyWorldEntityRegistry(): WorldEntityRegistryState {
  return {
    entities: [],
    version: 1,
    updatedAtTick: 0,
  }
}

export function createWorldEntityRegistry(
  entities: WorldEntity[],
  updatedAtTick = 0
): WorldEntityRegistryState {
  return {
    entities: dedupeWorldEntities(entities),
    version: 1,
    updatedAtTick,
  }
}

export function getWorldEntityById(
  registry: WorldEntityRegistryState,
  entityId: string
): WorldEntity | null {
  return registry.entities.find((entity) => entity.id === entityId) ?? null
}

export function getWorldEntitiesByKind(
  registry: WorldEntityRegistryState,
  kind: WorldEntityKind
): WorldEntity[] {
  return registry.entities.filter((entity) => entity.kind === kind)
}

export function getWorldEntitiesByType(
  registry: WorldEntityRegistryState,
  type: string
): WorldEntity[] {
  return registry.entities.filter((entity) => entity.type === type)
}

export function filterWorldEntities(
  registry: WorldEntityRegistryState,
  filter: WorldEntityRegistryFilter
): WorldEntity[] {
  return registry.entities.filter((entity) => {
    if (filter.kind && entity.kind !== filter.kind) return false
    if (filter.type && entity.type !== filter.type) return false
    if (filter.lifecycle && entity.lifecycle !== filter.lifecycle) return false
    if (filter.activeOnly && !isActiveWorldEntity(entity)) return false

    return true
  })
}

export function upsertWorldEntityToRegistry(
  registry: WorldEntityRegistryState,
  entity: WorldEntity,
  tick = registry.updatedAtTick
): WorldEntityRegistryState {
  const exists = registry.entities.some((item) => item.id === entity.id)

  return {
    entities: exists
      ? registry.entities.map((item) =>
          item.id === entity.id
            ? {
                ...entity,
                updatedAtTick: tick,
              }
            : item
        )
      : [
          ...registry.entities,
          {
            ...entity,
            updatedAtTick: tick,
          },
        ],
    version: registry.version + 1,
    updatedAtTick: tick,
  }
}

export function upsertWorldEntitiesToRegistry(
  registry: WorldEntityRegistryState,
  entities: WorldEntity[],
  tick = registry.updatedAtTick
): WorldEntityRegistryState {
  return entities.reduce(
    (nextRegistry, entity) =>
      upsertWorldEntityToRegistry(nextRegistry, entity, tick),
    registry
  )
}

export function updateWorldEntityInRegistry(
  registry: WorldEntityRegistryState,
  entityId: string,
  updater: (entity: WorldEntity) => WorldEntity,
  tick = registry.updatedAtTick
): WorldEntityRegistryState {
  const target = getWorldEntityById(registry, entityId)

  if (!target) return registry

  const updatedEntity = {
    ...updater(target),
    updatedAtTick: tick,
  }

  return {
    entities: registry.entities.map((entity) =>
      entity.id === entityId ? updatedEntity : entity
    ),
    version: registry.version + 1,
    updatedAtTick: tick,
  }
}

export function updateWorldEntityPosition(
  registry: WorldEntityRegistryState,
  entityId: string,
  position: WorldPosition,
  tick = registry.updatedAtTick
): WorldEntityRegistryState {
  return updateWorldEntityInRegistry(
    registry,
    entityId,
    (entity) => ({
      ...entity,
      spatial: {
        ...entity.spatial,
        position,
      },
      movement: {
        ...entity.movement,
        lastMovedAtTick: tick,
      },
    }),
    tick
  )
}

export function updateWorldEntityLifecycle(
  registry: WorldEntityRegistryState,
  entityId: string,
  lifecycle: WorldEntityLifecycleState,
  tick = registry.updatedAtTick
): WorldEntityRegistryState {
  return updateWorldEntityInRegistry(
    registry,
    entityId,
    (entity) => ({
      ...entity,
      lifecycle,
    }),
    tick
  )
}

export function removeWorldEntityFromRegistry(
  registry: WorldEntityRegistryState,
  entityId: string,
  tick = registry.updatedAtTick
): WorldEntityRegistryState {
  const nextEntities = registry.entities.filter(
    (entity) => entity.id !== entityId
  )

  if (nextEntities.length === registry.entities.length) return registry

  return {
    entities: nextEntities,
    version: registry.version + 1,
    updatedAtTick: tick,
  }
}

export function removeExpiredWorldEntitiesFromRegistry(
  registry: WorldEntityRegistryState,
  tick: number
): WorldEntityRegistryState {
  const nextEntities = registry.entities.filter((entity) => {
    if (!entity.expiresAtTick) return true
    return entity.expiresAtTick >= tick
  })

  if (nextEntities.length === registry.entities.length) {
    return {
      ...registry,
      updatedAtTick: tick,
    }
  }

  return {
    entities: nextEntities,
    version: registry.version + 1,
    updatedAtTick: tick,
  }
}

export function getWorldEntitySnapshot(
  registry: WorldEntityRegistryState
): WorldEntitySnapshot {
  const activeCount = registry.entities.filter(isActiveWorldEntity).length

  return {
    entities: registry.entities,
    count: registry.entities.length,
    activeCount,
  }
}

export function toWorldRuntimeEntities(
  registry: WorldEntityRegistryState
): WorldEntity[] {
  return registry.entities
}

function dedupeWorldEntities(entities: WorldEntity[]): WorldEntity[] {
  const entityMap = new Map<string, WorldEntity>()

  for (const entity of entities) {
    entityMap.set(entity.id, entity)
  }

  return Array.from(entityMap.values())
}