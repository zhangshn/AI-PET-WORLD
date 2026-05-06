/**
 * 当前文件负责：把当前生命运行趋向轻量映射到宠物 goal 解释。
 */

import type {
  CurrentLifeRuntimeBundle,
  LifeTendencyScores,
} from "../../../ai/gateway"

import type {
  GoalDraft,
  GoalPriority,
  PetGoalLifeTendencyHint,
  PetGoalType,
} from "./pet-goal-types"

import {
  GOAL_LIFE_TENDENCY_ATTACH_RULES,
  GOAL_LIFE_TENDENCY_CANDIDATE_TUNING,
  GOAL_LIFE_TENDENCY_SUMMARY_MARKERS,
} from "./pet-goal-tuning"

export type GoalLifeTendencyHint = {
  targetType: PetGoalType
  priorityBoost: 0 | 1
  summary: string
}

function getLifeRuntimeBundle(input: {
  currentLifeRuntimeBundle?: CurrentLifeRuntimeBundle | null
}): CurrentLifeRuntimeBundle | null {
  return input.currentLifeRuntimeBundle ?? null
}

function cleanLifeTendencySummary(summary: string): string {
  let cleaned = summary

  for (const marker of GOAL_LIFE_TENDENCY_SUMMARY_MARKERS) {
    const markerIndex = cleaned.indexOf(marker)

    if (markerIndex >= 0) {
      cleaned = cleaned.slice(0, markerIndex)
    }
  }

  return cleaned.trim()
}

function getBestScore(
  scores: LifeTendencyScores,
  keys: Array<keyof LifeTendencyScores>
): number {
  return Math.max(
    ...keys.map((key) => scores[key] ?? 0)
  )
}

function buildPrimaryHint(
  scores: LifeTendencyScores
): GoalLifeTendencyHint | null {
  const candidates = GOAL_LIFE_TENDENCY_CANDIDATE_TUNING
    .map((item) => {
      const score = getBestScore(scores, item.keys)

      return {
        type: item.type,
        score,
        minimumScore: item.minimumScore,
        priorityBoostScore: item.priorityBoostScore,
        summary: item.summary,
      }
    })
    .filter((item) => item.score >= item.minimumScore)
    .sort((a, b) => b.score - a.score)

  const best = candidates[0]

  if (!best) {
    return null
  }

  return {
    targetType: best.type,
    priorityBoost: best.score >= best.priorityBoostScore ? 1 : 0,
    summary: best.summary,
  }
}

function raisePriority(priority: GoalPriority): GoalPriority {
  if (priority === "low") {
    return "medium"
  }

  if (priority === "medium") {
    return "high"
  }

  return priority
}

function shouldAttachHintToGoal(params: {
  goalType: PetGoalType
  hintTargetType: PetGoalType
}): boolean {
  if (params.goalType === params.hintTargetType) {
    return true
  }

  const allowedTargets =
    GOAL_LIFE_TENDENCY_ATTACH_RULES[params.goalType] ?? []

  return allowedTargets.includes(params.hintTargetType)
}

function buildVisibleHint(params: {
  hint: GoalLifeTendencyHint
  attached: boolean
}): PetGoalLifeTendencyHint {
  return {
    targetType: params.hint.targetType,
    summary: params.hint.summary,
    priorityBoost: params.hint.priorityBoost,
    attached: params.attached,
  }
}

export function applyGoalLifeTendencyLayer(params: {
  goal: GoalDraft
  pet: {
    currentLifeRuntimeBundle?: CurrentLifeRuntimeBundle | null
  }
}): GoalDraft {
  const baseSummary = cleanLifeTendencySummary(params.goal.summary)

  const bundle = getLifeRuntimeBundle(params.pet)

  if (!bundle) {
    return {
      ...params.goal,
      summary: baseSummary,
      lifeTendencyHint: null,
    }
  }

  const hint = buildPrimaryHint(
    bundle.lifeTendencyProfile.scores
  )

  if (!hint) {
    return {
      ...params.goal,
      summary: baseSummary,
      lifeTendencyHint: null,
    }
  }

  const attached = shouldAttachHintToGoal({
    goalType: params.goal.type,
    hintTargetType: hint.targetType,
  })

  const visibleHint = buildVisibleHint({
    hint,
    attached,
  })

  if (!attached) {
    return {
      ...params.goal,
      lifeTendencyHint: visibleHint,
      summary: `${baseSummary} 生命趋向提示：${hint.summary}`,
    }
  }

  return {
    ...params.goal,
    lifeTendencyHint: visibleHint,
    priority:
      hint.priorityBoost > 0
        ? raisePriority(params.goal.priority)
        : params.goal.priority,
    summary: `${baseSummary} 生命趋向补充：${hint.summary}`,
  }
}