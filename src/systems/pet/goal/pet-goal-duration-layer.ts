/**
 * 当前文件负责：计算宠物目标的持续时间。
 */

import type { ZiweiConsciousnessKernel } from "../../../ai/consciousness-core/consciousness/consciousness-gateway"
import type { PetMemoryState } from "../../../ai/memory-core/memory-gateway"

import type {
  PetGoalType,
} from "./pet-goal-types"

import {
  GOAL_DURATION_TUNING,
} from "./pet-goal-tuning"

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

  const tuning = GOAL_DURATION_TUNING
  let duration = tuning.baseDuration[goalType]

  if (
    goalType === "expand_territory" &&
    kernel.bias.changeSeeking >=
      tuning.consciousness.expandChangeSeekingThreshold
  ) {
    duration += tuning.consciousness.expandChangeSeekingDelta
  }

  if (
    goalType === "observe_boundary" &&
    kernel.bias.observationBias >=
      tuning.consciousness.observeBiasThreshold
  ) {
    duration += tuning.consciousness.observeBiasDelta
  }

  if (
    goalType === "restore_self" &&
    kernel.bias.restResistance >=
      tuning.consciousness.restoreRestResistanceThreshold
  ) {
    duration += tuning.consciousness.restoreRestResistanceDelta
  }

  if (
    goalType === "restore_self" &&
    memory.selfImpression.recoveryConfidence >=
      tuning.memory.recoveryConfidenceThreshold
  ) {
    duration += tuning.memory.recoveryConfidenceDelta
  }

  if (
    goalType === "expand_territory" &&
    memory.preferenceBias.exploreBias >=
      tuning.memory.exploreBiasThreshold
  ) {
    duration += tuning.memory.exploreBiasDelta
  }

  return Math.max(tuning.minimumDuration, duration)
}