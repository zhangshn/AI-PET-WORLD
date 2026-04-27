/**
 * 当前文件负责：根据实体移动配置计算下一帧世界坐标。
 */

import type { WorldPosition } from "../map/world-map"
import type { WorldEntity } from "../entities/entity-types"

export type MovementIntent =
  | "idle"
  | "wander"
  | "approach"
  | "avoid"
  | "observe"
  | "rest"

export type MovementBoundary = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type MovementStepInput = {
  entity: WorldEntity
  tick: number
  boundary: MovementBoundary
  intent?: MovementIntent
  targetPosition?: WorldPosition
}

export type MovementStepResult = {
  entity: WorldEntity
  moved: boolean
  previousPosition: WorldPosition
  nextPosition: WorldPosition
  intent: MovementIntent
}

export function stepEntityMovement(input: MovementStepInput): MovementStepResult {
  const intent = input.intent ?? resolveDefaultMovementIntent(input.entity)
  const previousPosition = input.entity.spatial.position

  if (!input.entity.flags.canMove || input.entity.movement.mode === "static") {
    return {
      entity: input.entity,
      moved: false,
      previousPosition,
      nextPosition: previousPosition,
      intent: "idle",
    }
  }

  const nextPosition = resolveNextPosition({
    entity: input.entity,
    tick: input.tick,
    boundary: input.boundary,
    intent,
    targetPosition: input.targetPosition,
  })

  const moved = hasPositionChanged(previousPosition, nextPosition)

  return {
    entity: {
      ...input.entity,
      spatial: {
        ...input.entity.spatial,
        position: nextPosition,
      },
      movement: {
        ...input.entity.movement,
        lastMovedAtTick: moved
          ? input.tick
          : input.entity.movement.lastMovedAtTick,
      },
      updatedAtTick: moved ? input.tick : input.entity.updatedAtTick,
    },
    moved,
    previousPosition,
    nextPosition,
    intent,
  }
}

export function stepEntityMovements(input: {
  entities: WorldEntity[]
  tick: number
  boundary: MovementBoundary
}): MovementStepResult[] {
  return input.entities.map((entity) =>
    stepEntityMovement({
      entity,
      tick: input.tick,
      boundary: input.boundary,
    })
  )
}

export function createMovementBoundary(input: {
  width: number
  height: number
}): MovementBoundary {
  return {
    minX: 0,
    minY: 0,
    maxX: Math.max(0, input.width - 1),
    maxY: Math.max(0, input.height - 1),
  }
}

function resolveDefaultMovementIntent(entity: WorldEntity): MovementIntent {
  if (!entity.flags.canMove) return "idle"

  if (entity.movement.mode === "wander") return "wander"
  if (entity.movement.mode === "directed") return "approach"

  return "idle"
}

function resolveNextPosition(input: {
  entity: WorldEntity
  tick: number
  boundary: MovementBoundary
  intent: MovementIntent
  targetPosition?: WorldPosition
}): WorldPosition {
  if (input.intent === "idle" || input.intent === "rest") {
    return input.entity.spatial.position
  }

  if (input.intent === "wander") {
    return resolveWanderPosition({
      entity: input.entity,
      tick: input.tick,
      boundary: input.boundary,
    })
  }

  if (input.intent === "approach" || input.intent === "observe") {
    const target =
      input.targetPosition ??
      input.entity.movement.targetPosition ??
      input.entity.movement.homePosition

    if (!target) return input.entity.spatial.position

    return moveTowardPosition({
      from: input.entity.spatial.position,
      to: target,
      speed: input.entity.movement.speedPerTick,
      boundary: input.boundary,
    })
  }

  if (input.intent === "avoid") {
    const target =
      input.targetPosition ??
      input.entity.movement.targetPosition ??
      input.entity.movement.homePosition

    if (!target) return input.entity.spatial.position

    return moveAwayFromPosition({
      from: input.entity.spatial.position,
      awayFrom: target,
      speed: input.entity.movement.speedPerTick,
      boundary: input.boundary,
    })
  }

  return input.entity.spatial.position
}

function resolveWanderPosition(input: {
  entity: WorldEntity
  tick: number
  boundary: MovementBoundary
}): WorldPosition {
  const current = input.entity.spatial.position
  const home = input.entity.movement.homePosition ?? current
  const radius = input.entity.movement.wanderRadius ?? 3
  const speed = input.entity.movement.speedPerTick

  const seed = createMovementSeed(input.entity.id, input.tick)
  const angle = (seed % 360) * (Math.PI / 180)
  const targetDistance = Math.max(1, radius * 0.72)

  const target = {
    x: home.x + Math.cos(angle) * targetDistance,
    y: home.y + Math.sin(angle) * targetDistance,
  }

  const next = moveTowardPosition({
    from: current,
    to: target,
    speed,
    boundary: input.boundary,
  })

  return clampPositionToBoundary(next, input.boundary)
}

function moveTowardPosition(input: {
  from: WorldPosition
  to: WorldPosition
  speed: number
  boundary: MovementBoundary
}): WorldPosition {
  const dx = input.to.x - input.from.x
  const dy = input.to.y - input.from.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance <= 0.001) {
    return clampPositionToBoundary(input.from, input.boundary)
  }

  const step = Math.max(0, input.speed)

  if (distance <= step) {
    return clampPositionToBoundary(input.to, input.boundary)
  }

  return clampPositionToBoundary(
    {
      x: input.from.x + (dx / distance) * step,
      y: input.from.y + (dy / distance) * step,
    },
    input.boundary
  )
}

function moveAwayFromPosition(input: {
  from: WorldPosition
  awayFrom: WorldPosition
  speed: number
  boundary: MovementBoundary
}): WorldPosition {
  const dx = input.from.x - input.awayFrom.x
  const dy = input.from.y - input.awayFrom.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance <= 0.001) {
    return clampPositionToBoundary(
      {
        x: input.from.x + input.speed,
        y: input.from.y,
      },
      input.boundary
    )
  }

  return clampPositionToBoundary(
    {
      x: input.from.x + (dx / distance) * input.speed,
      y: input.from.y + (dy / distance) * input.speed,
    },
    input.boundary
  )
}

function clampPositionToBoundary(
  position: WorldPosition,
  boundary: MovementBoundary
): WorldPosition {
  return {
    x: clampNumber(position.x, boundary.minX, boundary.maxX),
    y: clampNumber(position.y, boundary.minY, boundary.maxY),
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