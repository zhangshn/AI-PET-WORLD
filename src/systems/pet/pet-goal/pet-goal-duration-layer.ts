/**
 * 当前文件负责：计算宠物目标的持续时间。
 */

import type { ZiweiConsciousnessKernel } from "../../../ai/consciousness/consciousness-gateway"
import type { PetMemoryState } from "../../../ai/memory-core/memory-gateway"

import type {
  PetGoalType,
} from "./pet-goal-types"

const GOAL_BASE_DURATION: Record<PetGoalType, number> = {
  expand_territory: 4,
  observe_boundary: 3,
  restore_self: 4,
  satisfy_need: 3,
  secure_attachment: 3,
  preserve_distance: 3,
  stabilize_state: 4,
  idle_drift: 2,
}

export function buildGoalDuration(params: {
  goalType: PetGoalType
  kernel: ZiweiConsciousnessKernel
  memory: PetMemoryState
}): number {
  const {
    goalType,
    kernel,
    memory,
  } = params

  let duration = GOAL_BASE_DURATION[goalType]

  if (goalType === "expand_territory" && kernel.bias.changeSeeking >= 72) {
    duration += 2
  }

  if (goalType === "observe_boundary" && kernel.bias.observationBias >= 72) {
    duration += 2
  }

  if (goalType === "restore_self" && kernel.bias.restResistance >= 72) {
    duration -= 1
  }

  if (
    goalType === "restore_self" &&
    memory.selfImpression.recoveryConfidence >= 10
  ) {
    duration += 1
  }

  if (
    goalType === "expand_territory" &&
    memory.preferenceBias.exploreBias >= 10
  ) {
    duration += 1
  }

  return Math.max(2, duration)
}