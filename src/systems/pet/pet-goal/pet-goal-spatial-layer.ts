/**
 * 当前文件负责：为宠物目标附加世界区域目标。
 */

import type { WorldZone, WorldZoneType } from "../../../world/ecology/world-zone-types"

import type {
  GoalDraft,
  GoalSystemInput,
  PetGoalType,
} from "./pet-goal-types"

function findActiveZone(
  zones: WorldZone[] | undefined,
  zoneType: WorldZoneType
): WorldZone | null {
  return zones?.find((zone) => zone.type === zoneType && zone.isActive) ?? null
}

export function resolveGoalTargetZoneType(
  goalType: PetGoalType
): WorldZoneType | undefined {
  switch (goalType) {
    case "restore_self":
      return "quiet_zone"
    case "satisfy_need":
      return "food_zone"
    case "expand_territory":
      return "exploration_zone"
    case "observe_boundary":
      return "observation_zone"
    case "stabilize_state":
      return "warm_zone"
    default:
      return undefined
  }
}

export function attachGoalSpatialTarget<T extends GoalDraft>(
  input: GoalSystemInput,
  goal: T
): T {
  const targetZoneType = resolveGoalTargetZoneType(goal.type)
  if (!targetZoneType) return goal

  const zone = findActiveZone(input.zones, targetZoneType)
  if (!zone) return goal

  return {
    ...goal,
    targetZoneType: zone.type,
    targetZoneId: zone.id,
    targetWorldPosition: {
      x: zone.x,
      y: zone.y,
    },
    summary: `${goal.summary} 目标区域锁定为：${zone.name}。`,
  }
}