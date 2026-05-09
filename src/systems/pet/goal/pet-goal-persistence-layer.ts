/**
 * 当前文件负责：判断宠物是否应该保持上一轮目标。
 */

import type {
  GoalSystemInput,
} from "./pet-goal-types"

import {
  getGoalEnergy,
  getGoalHunger,
} from "./pet-goal-context"

import {
  GOAL_PERSISTENCE_TUNING,
} from "./pet-goal-tuning"

export function shouldKeepPreviousGoal(input: GoalSystemInput): boolean {
  const previousGoal = input.previousGoal
  if (!previousGoal) return false

  const energy = getGoalEnergy(input)
  const hunger = getGoalHunger(input)
  const tuning = GOAL_PERSISTENCE_TUNING

  if (energy <= tuning.interruptEnergyThreshold) {
    return false
  }

  if (hunger >= tuning.interruptHungerThreshold) {
    return false
  }

  return input.tick <= previousGoal.holdUntilTick
}