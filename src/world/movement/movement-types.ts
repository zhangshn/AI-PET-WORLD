/**
 * 当前文件负责：定义世界移动系统的通用类型。
 */

import type { WorldPosition } from "../map/world-map"

export type MovementIntent =
  | "idle"
  | "move_to_zone"
  | "move_to_entity"
  | "wander"
  | "avoid"
  | "return_home"

export type WorldMovementState = {
  entityId: string
  intent: MovementIntent
  position: WorldPosition
  targetPosition: WorldPosition | null
  speed: number
  arrived: boolean
}

export type MovementStepResult = {
  next: WorldMovementState
  distanceToTarget: number
}