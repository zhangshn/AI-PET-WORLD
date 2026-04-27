/**
 * 当前文件负责：把世界实体系统转换为运行时快照，供 world-runtime 与 UI 层读取。
 */

import type {
  EntityRuntimeState,
  WorldRuntimeEntity,
  WorldRuntimeEntityKind,
} from "./entity-runtime"
import { createEmptyEntityRuntime, upsertWorldEntity } from "./entity-runtime"
import type { WorldMapState } from "../map/world-map"
import type {
  WorldEntity,
  WorldEntityKind,
  WorldEntitySnapshot,
} from "../entities/entity-types"
import {
  createEmptyWorldEntityRegistry,
  createWorldEntityRegistry,
  getWorldEntitySnapshot,
  type WorldEntityRegistryState,
} from "../entities/entity-registry"
import { spawnStarterWorldEntities } from "../entities/entity-spawner"

export type RuntimeEntityMappingResult = {
  entities: EntityRuntimeState
  sourceSnapshot: WorldEntitySnapshot
}

export type StarterRuntimeEntityInput = {
  map: WorldMapState
  tick?: number
}

export type StarterRuntimeEntityResult = RuntimeEntityMappingResult & {
  registry: WorldEntityRegistryState
}

export function mapWorldEntityKindToRuntimeKind(
  kind: WorldEntityKind
): WorldRuntimeEntityKind {
  switch (kind) {
    case "pet":
      return "pet"
    case "butler":
      return "butler"
    case "structure":
    case "incubator":
    case "home":
      return "structure"
    case "vegetation":
      return "vegetation"
    case "resource":
      return "resource"
    case "creature":
      return "creature"
    case "npc":
      return "npc"
    case "environment":
      return "resource"
    default:
      return "resource"
  }
}

export function mapWorldEntityToRuntimeEntity(
  entity: WorldEntity
): WorldRuntimeEntity {
  return {
    id: entity.id,
    kind: mapWorldEntityKindToRuntimeKind(entity.kind),
    type: entity.type,
    name: entity.name,
    position: entity.spatial.position,
    active: entity.lifecycle === "active" || entity.lifecycle === "spawning",
    createdAtTick: entity.createdAtTick,
    expiresAtTick: entity.expiresAtTick,
    metadata: {
      description: entity.description,
      radius: entity.spatial.radius,
      height: entity.spatial.height,
      walkable: entity.spatial.walkable,
      blocksMovement: entity.spatial.blocksMovement,
      blocksSight: entity.spatial.blocksSight,
      interactionRange: entity.spatial.interactionRange,
      visual: entity.visual,
      stimulus: entity.stimulus,
      movement: entity.movement,
      flags: entity.flags,
      sourceKind: entity.kind,
      sourceLifecycle: entity.lifecycle,
      ...entity.metadata,
    },
  }
}

export function mapWorldEntitiesToRuntimeState(
  entities: WorldEntity[]
): EntityRuntimeState {
  return entities.reduce((state, entity) => {
    return upsertWorldEntity(state, mapWorldEntityToRuntimeEntity(entity))
  }, createEmptyEntityRuntime())
}

export function mapWorldEntityRegistryToRuntimeState(
  registry: WorldEntityRegistryState
): RuntimeEntityMappingResult {
  const sourceSnapshot = getWorldEntitySnapshot(registry)

  return {
    entities: mapWorldEntitiesToRuntimeState(sourceSnapshot.entities),
    sourceSnapshot,
  }
}

export function createStarterWorldEntityRegistry(input: {
  map: WorldMapState
  tick?: number
}): WorldEntityRegistryState {
  const spawnResult = spawnStarterWorldEntities({
    map: input.map,
    tick: input.tick ?? 0,
  })

  return createWorldEntityRegistry(spawnResult.entities, input.tick ?? 0)
}

export function createStarterRuntimeEntities(
  input: StarterRuntimeEntityInput
): StarterRuntimeEntityResult {
  const registry = createStarterWorldEntityRegistry(input)
  const mapped = mapWorldEntityRegistryToRuntimeState(registry)

  return {
    registry,
    entities: mapped.entities,
    sourceSnapshot: mapped.sourceSnapshot,
  }
}

export function createEmptyRuntimeEntityMapping(): RuntimeEntityMappingResult {
  const registry = createEmptyWorldEntityRegistry()

  return mapWorldEntityRegistryToRuntimeState(registry)
}