/**
 * 当前文件负责：把当前生命运行趋向轻量映射到宠物 goal 解释。
 */

import type {
  CurrentLifeRuntimeBundle,
  LifeTendencyScores,
} from "../../../ai/gateway"

import type {
  GoalPriority,
  PetGoalState,
  PetGoalType,
} from "./pet-goal-runner"

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

export function applyGoalLifeTendencyLayer(params: {
  goal: Omit<PetGoalState, "startedAtTick" | "holdUntilTick">
  pet: {
    currentLifeRuntimeBundle?: CurrentLifeRuntimeBundle | null
  }
}): Omit<PetGoalState, "startedAtTick" | "holdUntilTick"> {
  const bundle = getLifeRuntimeBundle(params.pet)

  if (!bundle) {
    return params.goal
  }

  const hint = buildPrimaryHint(
    bundle.lifeTendencyProfile.scores
  )

  if (!hint) {
    return params.goal
  }

  if (
    !shouldAttachHintToGoal({
      goalType: params.goal.type,
      hintTargetType: hint.targetType,
    })
  ) {
    return {
      ...params.goal,
      summary: `${params.goal.summary} 生命趋向提示：${hint.summary}`,
    }
  }

  return {
    ...params.goal,
    priority:
      hint.priorityBoost > 0
        ? raisePriority(params.goal.priority)
        : params.goal.priority,
    summary: `${params.goal.summary} 生命趋向补充：${hint.summary}`,
  }
}