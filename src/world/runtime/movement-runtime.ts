/**
 * 当前文件负责：推进世界实体移动状态。
 */

import type { EntityRuntimeState, WorldRuntimeEntity } from "./entity-runtime"
import type { WorldMapState, WorldPosition } from "../map/world-map"
import type {
  MovementStepResult,
  WorldMovementState,
} from "../movement/movement-types"
import { getWorldDistance } from "../movement/spatial-query"

export type RuntimeEntityMovementResult = {
  entities: EntityRuntimeState
  movedEntityIds: string[]
}

export function stepWorldMovement(
  movement: WorldMovementState
): MovementStepResult {
  if (!movement.targetPosition) {
    return {
      next: {
        ...movement,
        arrived: true,
      },
      distanceToTarget: 0,
    }
  }

  const distance = getWorldDistance(movement.position, movement.targetPosition)

  if (distance <= movement.speed) {
    return {
      next: {
        ...movement,
        position: movement.targetPosition,
        arrived: true,
      },
      distanceToTarget: 0,
    }
  }

  const dx = movement.targetPosition.x - movement.position.x
  const dy = movement.targetPosition.y - movement.position.y

  return {
    next: {
      ...movement,
      position: {
        x: movement.position.x + (dx / distance) * movement.speed,
        y: movement.position.y + (dy / distance) * movement.speed,
      },
      arrived: false,
    },
    distanceToTarget: distance,
  }
}

export function stepRuntimeEntityMovements(input: {
  entities: EntityRuntimeState
  map: WorldMapState
  tick: number
}): RuntimeEntityMovementResult {
  const movedEntityIds: string[] = []

  const nextEntities = input.entities.entities.map((entity) => {
    const nextEntity = stepRuntimeEntityMovement({
      entity,
      map: input.map,
      tick: input.tick,
    })

    if (hasPositionChanged(entity.position, nextEntity.position)) {
      movedEntityIds.push(entity.id)
    }

    return nextEntity
  })

  return {
    entities: {
      entities: nextEntities,
    },
    movedEntityIds,
  }
}

function stepRuntimeEntityMovement(input: {
  entity: WorldRuntimeEntity
  map: WorldMapState
  tick: number
}): WorldRuntimeEntity {
  const movement = readRuntimeEntityMovement(input.entity)

  if (!input.entity.active) return input.entity
  if (!movement.canMove) return input.entity

  if (input.entity.type === "butterfly") {
    return stepButterflyMovement({
      entity: input.entity,
      map: input.map,
      tick: input.tick,
      speed: movement.speedPerTick,
      wanderRadius: movement.wanderRadius,
      homePosition: movement.homePosition,
    })
  }

  return input.entity
}

function stepButterflyMovement(input: {
  entity: WorldRuntimeEntity
  map: WorldMapState
  tick: number
  speed: number
  wanderRadius: number
  homePosition: WorldPosition
}): WorldRuntimeEntity {
  const seed = createMovementSeed(input.entity.id, input.tick)
  const angle = (seed % 360) * (Math.PI / 180)
  const distance = Math.max(1, input.wanderRadius * 0.7)

  const target = {
    x: input.homePosition.x + Math.cos(angle) * distance,
    y: input.homePosition.y + Math.sin(angle) * distance,
  }

  const nextPosition = moveTowardPosition({
    from: input.entity.position,
    to: target,
    speed: input.speed,
    map: input.map,
  })

  return {
    ...input.entity,
    position: nextPosition,
    metadata: {
      ...input.entity.metadata,
      lastMovedAtTick: input.tick,
      movementTarget: target,
    },
  }
}

function readRuntimeEntityMovement(entity: WorldRuntimeEntity): {
  canMove: boolean
  speedPerTick: number
  wanderRadius: number
  homePosition: WorldPosition
} {
  const movement = entity.metadata?.movement
  const flags = entity.metadata?.flags

  const movementRecord =
    typeof movement === "object" && movement !== null
      ? (movement as Record<string, unknown>)
      : {}

  const flagRecord =
    typeof flags === "object" && flags !== null
      ? (flags as Record<string, unknown>)
      : {}

  return {
    canMove: readBoolean(flagRecord.canMove, false),
    speedPerTick: readNumber(movementRecord.speedPerTick, 0),
    wanderRadius: readNumber(movementRecord.wanderRadius, 3),
    homePosition: readPosition(movementRecord.homePosition, entity.position),
  }
}

function moveTowardPosition(input: {
  from: WorldPosition
  to: WorldPosition
  speed: number
  map: WorldMapState
}): WorldPosition {
  const dx = input.to.x - input.from.x
  const dy = input.to.y - input.from.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance <= 0.001) {
    return clampPositionToMap(input.from, input.map)
  }

  const speed = Math.max(0, input.speed)

  if (distance <= speed) {
    return clampPositionToMap(input.to, input.map)
  }

  return clampPositionToMap(
    {
      x: input.from.x + (dx / distance) * speed,
      y: input.from.y + (dy / distance) * speed,
    },
    input.map
  )
}

function clampPositionToMap(
  position: WorldPosition,
  map: WorldMapState
): WorldPosition {
  return {
    x: clampNumber(position.x, 0, Math.max(0, map.size.width - 1)),
    y: clampNumber(position.y, 0, Math.max(0, map.size.height - 1)),
  }
}

function hasPositionChanged(
  previous: WorldPosition,
  next: WorldPosition
): boolean {
  return (
    Math.abs(previous.x - next.x) > 0.001 ||
    Math.abs(previous.y - next.y) > 0.001
  )
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function readPosition(value: unknown, fallback: WorldPosition): WorldPosition {
  if (typeof value !== "object" || value === null) return fallback

  const record = value as Record<string, unknown>
  const x = readNumber(record.x, fallback.x)
  const y = readNumber(record.y, fallback.y)

  return { x, y }
}

function createMovementSeed(entityId: string, tick: number): number {
  let seed = tick * 97

  for (let index = 0; index < entityId.length; index += 1) {
    seed += entityId.charCodeAt(index) * (index + 11)
  }

  return Math.abs(seed)
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}