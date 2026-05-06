/**
 * 当前文件负责：把当前生命运行趋向轻量映射到宠物 goal 解释。
 */

import type {
  CurrentLifeRuntimeBundle,
  LifeTendencyScores,
} from "../../../ai/gateway"

import type {
  GoalPriority,
  PetGoalLifeTendencyHint,
  PetGoalState,
  PetGoalType,
} from "./pet-goal-runner"

export type GoalLifeTendencyHint = {
  targetType: PetGoalType
  priorityBoost: 0 | 1
  summary: string
}

const LIFE_TENDENCY_SUMMARY_MARKERS = [
  " 生命趋向提示：",
  " 生命趋向补充：",
]

function getLifeRuntimeBundle(input: {
  currentLifeRuntimeBundle?: CurrentLifeRuntimeBundle | null
}): CurrentLifeRuntimeBundle | null {
  return input.currentLifeRuntimeBundle ?? null
}

function cleanLifeTendencySummary(summary: string): string {
  let cleaned = summary

  for (const marker of LIFE_TENDENCY_SUMMARY_MARKERS) {
    const markerIndex = cleaned.indexOf(marker)

    if (markerIndex >= 0) {
      cleaned = cleaned.slice(0, markerIndex)
    }
  }

  return cleaned.trim()
}

function shouldBoostPriority(score: number): boolean {
  return Number.isFinite(score) && score >= 72
}

function buildPrimaryHint(
  scores: LifeTendencyScores
): GoalLifeTendencyHint | null {
  const candidates: Array<{
    type: PetGoalType
    score: number
    summary: string
  }> = [
    {
      type: "expand_territory",
      score: Math.max(scores.explore, scores.action),
      summary:
        "当前生命趋向对外部变化与探索表达更敏感，因此目标解释偏向试探新边界。",
    },
    {
      type: "observe_boundary",
      score: Math.max(scores.observe, scores.perception),
      summary:
        "当前生命趋向强化观察与信息辨认，因此目标解释偏向先理解环境。",
    },
    {
      type: "restore_self",
      score: scores.recover,
      summary:
        "当前生命趋向提示恢复需求较明显，因此目标解释偏向回收自身与稳定状态。",
    },
    {
      type: "secure_attachment",
      score: Math.max(scores.approach, scores.care),
      summary:
        "当前生命趋向对连接与照护更敏感，因此目标解释偏向确认关系锚点。",
    },
    {
      type: "preserve_distance",
      score: Math.max(scores.boundary, scores.protect),
      summary:
        "当前生命趋向强化边界与保护，因此目标解释偏向维持安全距离。",
    },
    {
      type: "stabilize_state",
      score: scores.routine,
      summary:
        "当前生命趋向偏向秩序与节律，因此目标解释偏向维持稳定状态。",
    },
  ]

  const best = candidates
    .filter((item) => item.score >= 58)
    .sort((a, b) => b.score - a.score)[0]

  if (!best) {
    return null
  }

  return {
    targetType: best.type,
    priorityBoost: shouldBoostPriority(best.score) ? 1 : 0,
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

  if (
    params.goalType === "idle_drift" &&
    (
      params.hintTargetType === "observe_boundary" ||
      params.hintTargetType === "stabilize_state"
    )
  ) {
    return true
  }

  if (
    params.goalType === "restore_self" &&
    params.hintTargetType === "stabilize_state"
  ) {
    return true
  }

  if (
    params.goalType === "observe_boundary" &&
    params.hintTargetType === "preserve_distance"
  ) {
    return true
  }

  if (
    params.goalType === "expand_territory" &&
    params.hintTargetType === "observe_boundary"
  ) {
    return true
  }

  return false
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
  goal: Omit<PetGoalState, "startedAtTick" | "holdUntilTick">
  pet: {
    currentLifeRuntimeBundle?: CurrentLifeRuntimeBundle | null
  }
}): Omit<PetGoalState, "startedAtTick" | "holdUntilTick"> {
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