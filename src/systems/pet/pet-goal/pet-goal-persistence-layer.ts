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

export function shouldKeepPreviousGoal(input: GoalSystemInput): boolean {
  const previousGoal = input.previousGoal
  if (!previousGoal) return false

  const energy = getGoalEnergy(input)
  const hunger = getGoalHunger(input)

  if (energy <= 12 || hunger >= 68) return false
  if (input.tick <= previousGoal.holdUntilTick) return true

  return false
}