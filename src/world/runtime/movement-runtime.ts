/**
 * 当前文件负责：推进世界实体移动状态。
 */

import type {
  MovementStepResult,
  WorldMovementState,
} from "../movement/movement-types"
import { getWorldDistance } from "../movement/spatial-query"

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

  const distance = getWorldDistance(
    movement.position,
    movement.targetPosition
  )

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