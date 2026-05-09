/**
 * 当前文件负责：把宠物 memory 中的经验材料沉淀为 learning state。
 *
 * 注意：
 * learning 只能形成稳定倾向，不能直接控制 action。
 */

import type {
  PetLearningState,
  UpdatePetLearningInput,
} from "./pet-learning-schema"

function clampLearningValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(-100, Math.min(100, Math.round(value)))
}

function smoothToward(input: {
  current: number
  target: number
  factor: number
}): number {
  const next =
    input.current + (input.target - input.current) * input.factor

  return clampLearningValue(next)
}

function buildLearningSummaries(learning: PetLearningState): string[] {
  const summaries: string[] = []

  if (learning.foodFamiliarity >= 10) {
    summaries.push("食物机会正在被学习为较熟悉的照看输入。")
  } else if (learning.foodFamiliarity <= -10) {
    summaries.push("食物机会暂时没有形成稳定熟悉感。")
  }

  if (learning.restFamiliarity >= 10) {
    summaries.push("恢复机会正在被学习为较可接受的环境支持。")
  }

  if (learning.butlerTrustLearning >= 10) {
    summaries.push("照料者信任正在从多次经验中逐渐形成。")
  } else if (learning.butlerTrustLearning <= -10) {
    summaries.push("照料者信任仍然偏低，需要更多稳定经验。")
  }

  if (learning.approachSafetyLearning >= 10) {
    summaries.push("靠近机会正在被学习为相对安全的关系输入。")
  } else if (learning.approachSafetyLearning <= -10) {
    summaries.push("靠近机会仍然容易被学习为需要保持边界。")
  }

  return summaries.slice(0, 6)
}

export function updatePetLearningState(
  input: UpdatePetLearningInput
): PetLearningState {
  const { previousLearning, memoryState } = input

  const foodTarget =
    memoryState.preferenceBias.eatBias * 0.65 +
    memoryState.relationImpression.caretakerTrust * 0.35

  const restTarget =
    memoryState.preferenceBias.restBias * 0.6 +
    memoryState.selfImpression.recoveryConfidence * 0.4

  const butlerTrustTarget =
    memoryState.relationImpression.caretakerTrust

  const approachTarget =
    memoryState.preferenceBias.approachBias * 0.55 +
    memoryState.relationImpression.approachSafety * 0.45

  const nextLearning: PetLearningState = {
    foodFamiliarity: smoothToward({
      current: previousLearning.foodFamiliarity,
      target: foodTarget,
      factor: 0.22,
    }),
    restFamiliarity: smoothToward({
      current: previousLearning.restFamiliarity,
      target: restTarget,
      factor: 0.22,
    }),
    butlerTrustLearning: smoothToward({
      current: previousLearning.butlerTrustLearning,
      target: butlerTrustTarget,
      factor: 0.18,
    }),
    approachSafetyLearning: smoothToward({
      current: previousLearning.approachSafetyLearning,
      target: approachTarget,
      factor: 0.2,
    }),
    lastUpdatedTick: input.tick,
    summaries: [],
  }

  return {
    ...nextLearning,
    summaries: buildLearningSummaries(nextLearning),
  }
}