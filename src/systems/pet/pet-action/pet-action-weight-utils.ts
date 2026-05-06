/**
 * 当前文件负责：提供宠物行为权重工具函数。
 */

import type { PetAction } from "../../../types/pet"
import type { PetActionWeights } from "./pet-action-weight-types"

export function createEmptyActionWeights(): PetActionWeights {
  return {
    sleeping: 0,
    resting: 0,
    eating: 0,
    exploring: 0,
    walking: 0,
    approaching: 0,
    observing: 0,
    alert_idle: 0,
    idle: 5,
  }
}

export function normalizeActionWeights(weights: PetActionWeights) {
  for (const key in weights) {
    const action = key as PetAction

    if (weights[action] < 0) {
      weights[action] = 0
    }
  }
}

export function pickActionByWeight(weights: PetActionWeights): PetAction {
  const entries = Object.entries(weights) as [PetAction, number][]
  const total = entries.reduce(
    (sum, [, weight]) => sum + Math.max(weight, 0),
    0
  )

  if (total <= 0) return "idle"

  let randomValue = Math.random() * total

  for (const [action, weight] of entries) {
    const safeWeight = Math.max(weight, 0)

    if (randomValue < safeWeight) return action

    randomValue -= safeWeight
  }

  return entries[0][0]
}