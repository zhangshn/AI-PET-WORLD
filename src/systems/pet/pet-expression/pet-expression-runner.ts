/**
 * 当前文件负责：把内部行为意图转换成宠物当前阶段可表达的可见行为。
 */

import type {
  LifeTendencyScores,
} from "../../../ai/gateway"

import type {
  PetAction,
} from "../../../types/pet"

import type {
  PetExpressionInput,
  PetExpressionReason,
  PetExpressionResult,
} from "./pet-expression-types"

function getLifeScores(
  input: PetExpressionInput
): LifeTendencyScores | null {
  return input.currentLifeRuntimeBundle?.lifeTendencyProfile.scores ?? null
}

function buildResult(params: {
  expressedAction: PetAction
  reason: PetExpressionReason
  internalIntent: PetAction
  summary: string
}): PetExpressionResult {
  return {
    expressedAction: params.expressedAction,
    reason: params.reason,
    internalIntent: params.internalIntent,
    summary: params.summary,
  }
}

function isExploreLike(action: PetAction): boolean {
  return action === "exploring" || action === "walking"
}

function isApproachLike(action: PetAction): boolean {
  return action === "approaching"
}

function expressNewbornIntent(input: PetExpressionInput): PetExpressionResult | null {
  const scores = getLifeScores(input)

  if (input.energy <= 18) {
    return buildResult({
      expressedAction: "resting",
      reason: "newborn_low_energy_softened",
      internalIntent: input.rawAction,
      summary: "刚出生阶段能量表达受限，行为意图被表现为恢复性停留。",
    })
  }

  if (isExploreLike(input.rawAction)) {
    const observeScore = scores?.observe ?? 50
    const perceptionScore = scores?.perception ?? 50

    if (observeScore >= 56 || perceptionScore >= 56) {
      return buildResult({
        expressedAction: "observing",
        reason: "newborn_explore_intent_softened",
        internalIntent: input.rawAction,
        summary: "刚出生阶段已有探索意图，但可见表达先落在观察与辨认环境上。",
      })
    }

    return buildResult({
      expressedAction: "idle",
      reason: "newborn_explore_intent_softened",
      internalIntent: input.rawAction,
      summary: "刚出生阶段探索意图尚不能完整外显，因此表现为短暂停顿。",
    })
  }

  if (isApproachLike(input.rawAction)) {
    return buildResult({
      expressedAction: "observing",
      reason: "newborn_approach_intent_softened",
      internalIntent: input.rawAction,
      summary: "刚出生阶段靠近意图先表现为注视与确认安全感。",
    })
  }

  return null
}

function expressAdaptationIntent(input: PetExpressionInput): PetExpressionResult | null {
  const scores = getLifeScores(input)

  if (input.energy <= 22) {
    return buildResult({
      expressedAction: "resting",
      reason: "low_energy_expression_limit",
      internalIntent: input.rawAction,
      summary: "适应期能量不足，行为表达被限制为恢复状态。",
    })
  }

  if (input.hunger >= 82 && input.rawAction !== "eating") {
    return buildResult({
      expressedAction: "idle",
      reason: "high_hunger_expression_limit",
      internalIntent: input.rawAction,
      summary: "饥饿感偏高，当前不适合外扩表达，先表现为停顿。",
    })
  }

  if (input.rawAction === "exploring") {
    const actionScore = scores?.action ?? 50
    const exploreScore = scores?.explore ?? 50

    if (actionScore >= 72 && exploreScore >= 68) {
      return null
    }

    return buildResult({
      expressedAction: "walking",
      reason: "adaptation_explore_intent_softened",
      internalIntent: input.rawAction,
      summary: "适应期存在探索意图，但可见表达先收束为小范围移动。",
    })
  }

  if (
    input.rawAction === "walking" &&
    (scores?.observe ?? 50) >= 60
  ) {
    return buildResult({
      expressedAction: "observing",
      reason: "adaptation_high_observe_expression",
      internalIntent: input.rawAction,
      summary: "适应期观察倾向较强，移动意图被表达为停下观察。",
    })
  }

  return null
}

function expressDependentIntent(input: PetExpressionInput): PetExpressionResult | null {
  if (
    input.currentGoal?.type === "restore_self" &&
    isExploreLike(input.rawAction)
  ) {
    return buildResult({
      expressedAction: "resting",
      reason: "dependent_restore_expression",
      internalIntent: input.rawAction,
      summary: "依附期当前目标偏向恢复，探索意图被表达为靠近安全区域休整。",
    })
  }

  return null
}

export function expressPetAction(
  input: PetExpressionInput
): PetExpressionResult {
  if (input.energy <= 10 && input.rawAction !== "sleeping") {
    return buildResult({
      expressedAction: "resting",
      reason: "low_energy_expression_limit",
      internalIntent: input.rawAction,
      summary: "能量过低，当前行为表达被限制为恢复。",
    })
  }

  if (input.hunger >= 92 && input.rawAction !== "eating") {
    return buildResult({
      expressedAction: "idle",
      reason: "high_hunger_expression_limit",
      internalIntent: input.rawAction,
      summary: "饥饿过高，非进食意图被暂时压低为停顿。",
    })
  }

  if (input.lifePhase === "newborn") {
    const result = expressNewbornIntent(input)
    if (result) return result
  }

  if (input.lifePhase === "adaptation") {
    const result = expressAdaptationIntent(input)
    if (result) return result
  }

  if (input.lifePhase === "dependent") {
    const result = expressDependentIntent(input)
    if (result) return result
  }

  return buildResult({
    expressedAction: input.rawAction,
    reason: "no_expression_change",
    internalIntent: input.rawAction,
    summary: "当前行为意图可以直接表达为可见行为。",
  })
}