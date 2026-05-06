/**
 * 当前文件负责：把当前 goal 映射为候选行为权重。
 */

import type { PetGoalState } from "../pet-goal/pet-goal-gateway"
import type { PetActionWeights } from "./pet-action-weight-types"

export function applyActionGoalLayer(
  goal: PetGoalState | undefined,
  weights: PetActionWeights
) {
  if (!goal) return

  switch (goal.type) {
    case "expand_territory":
      weights.exploring += 18
      weights.walking += 10
      weights.observing += 3
      weights.resting -= 4
      break

    case "observe_boundary":
      weights.observing += 18
      weights.alert_idle += 10
      weights.exploring -= 8
      weights.approaching -= 6
      break

    case "restore_self":
      weights.resting += 20
      weights.sleeping += 14
      weights.exploring -= 16
      weights.walking -= 10
      weights.approaching -= 10
      break

    case "satisfy_need":
      weights.eating += 24
      weights.walking += 4
      weights.exploring -= 10
      break

    case "secure_attachment":
      weights.approaching += 18
      weights.observing += 4
      break

    case "preserve_distance":
      weights.alert_idle += 16
      weights.observing += 10
      weights.approaching -= 14
      break

    case "stabilize_state":
      weights.observing += 10
      weights.resting += 10
      weights.idle += 8
      weights.exploring -= 8
      break

    case "idle_drift":
    default:
      weights.idle += 6
      break
  }
}