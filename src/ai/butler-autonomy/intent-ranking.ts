/**
 * 当前文件职责：对管家自主目标进行排序，并生成本轮主意图。
 */

import type {
  ButlerAutonomousIntent,
  ButlerAutonomyInput,
  ButlerConsciousState,
  ButlerGoal,
  ButlerMemoryState,
  ButlerMotivation,
  ButlerWorldPerception,
} from "./butler-autonomy-schema"

export function buildButlerSelectedIntent(input: {
  input: ButlerAutonomyInput
  perception: ButlerWorldPerception
  motivations: ButlerMotivation[]
  candidateGoals: ButlerGoal[]
  memoryState: ButlerMemoryState
  consciousState: ButlerConsciousState
}): ButlerAutonomousIntent {
  const rankedGoals = rankGoals(input)
  const selectedGoal = rankedGoals[0] ?? buildFallbackObserveGoal()
  const highIntensityMotivations = input.motivations.filter(
    (motivation) => motivation.intensity >= 45
  )

  return {
    intentId: `butler-intent-${input.input.worldId}-${input.input.now}`,
    kind: selectedGoal.kind,
    priority: selectedGoal.priority,
    confidence: selectedGoal.confidence,
    constructionAllowed: selectedGoal.constructionAllowed,
    emotionalTone: input.consciousState.emotionalTone,
    sourceMotivations: highIntensityMotivations.map(
      (motivation) => motivation.motivationId
    ),
    perceivedWorldFacts: input.perception.perceivedFacts,
    memoryReferences: input.memoryState.recentEvents
      .slice(-3)
      .map((event) => event.eventId),
    reason: buildIntentReason({
      selectedGoal,
      perception: input.perception,
      consciousState: input.consciousState,
      highIntensityMotivations,
    }),
    nextExpectedConsumer: resolveExpectedConsumer(selectedGoal),
    tags: [
      "butler_autonomous_intent",
      "intent_ranking_selected",
      selectedGoal.kind,
      selectedGoal.constructionAllowed
        ? "construction_planner_candidate"
        : "non_construction_intent",
    ],
  }
}

function rankGoals(input: {
  perception: ButlerWorldPerception
  candidateGoals: ButlerGoal[]
  memoryState: ButlerMemoryState
  consciousState: ButlerConsciousState
}): ButlerGoal[] {
  return [...input.candidateGoals]
    .map((goal) => ({
      goal,
      score: calculateGoalScore({
        goal,
        perception: input.perception,
        memoryState: input.memoryState,
        consciousState: input.consciousState,
      }),
    }))
    .sort((left, right) => right.score - left.score)
    .map((item) => ({
      ...item.goal,
      priority: clampScore(item.score),
      confidence: clampScore((item.goal.confidence + item.score) / 2),
      tags: uniqueTags([
        ...item.goal.tags,
        "intent_ranking_scored",
        `ranking_score:${clampScore(item.score)}`,
      ]),
    }))
}

function calculateGoalScore(input: {
  goal: ButlerGoal
  perception: ButlerWorldPerception
  memoryState: ButlerMemoryState
  consciousState: ButlerConsciousState
}): number {
  const baseScore = input.goal.priority
  const feasibilityAdjustment = buildFeasibilityAdjustment(input)
  const memoryAdjustment = buildMemoryAdjustment(input)
  const recoveryAdjustment = buildRecoveryAdjustment(input)
  const riskAdjustment = buildRiskAdjustment(input)

  return clampScore(
    baseScore +
      feasibilityAdjustment +
      memoryAdjustment +
      recoveryAdjustment +
      riskAdjustment
  )
}

function buildFeasibilityAdjustment(input: {
  goal: ButlerGoal
  perception: ButlerWorldPerception
}): number {
  if (!input.goal.constructionAllowed) return 0

  if (input.perception.resourcePressure >= 70) return -18
  if (input.perception.spacePressure >= 75) return -14
  if (input.perception.resourcePressure >= 55) return -8

  return 6
}

function buildMemoryAdjustment(input: {
  goal: ButlerGoal
  memoryState: ButlerMemoryState
}): number {
  const preferences = input.memoryState.learnedPreferences

  switch (input.goal.kind) {
    case "wait_and_record":
      return Math.round((preferences.waitingBias - 50) / 5)
    case "prepare_resources":
      return Math.round((preferences.resourceCautionBias - 50) / 5)
    case "prepare_care":
      return Math.round((preferences.careBias - 50) / 5)
    case "maintain_boundary":
      return Math.round((preferences.boundaryBias - 50) / 5)
    case "stabilize_shelter":
      return Math.round((preferences.shelterBias - 50) / 5)
    case "organize_storage":
      return Math.round((preferences.storageBias - 50) / 5)
    default:
      return 0
  }
}

function buildRecoveryAdjustment(input: {
  goal: ButlerGoal
  consciousState: ButlerConsciousState
}): number {
  if (input.consciousState.recoveryPressure <= 0) return 0

  if (input.goal.kind === "wait_and_record") return 16
  if (input.goal.kind === "observe_world") return 12
  if (input.goal.kind === "explain_to_player") return 8
  if (input.goal.constructionAllowed) return -16

  return 0
}

function buildRiskAdjustment(input: {
  goal: ButlerGoal
  perception: ButlerWorldPerception
}): number {
  if (input.perception.risks.length === 0) return 0

  if (input.goal.kind === "observe_world") return 8
  if (input.goal.kind === "wait_and_record") return 10
  if (input.goal.kind === "maintain_boundary") return 6

  return 0
}

function buildIntentReason(input: {
  selectedGoal: ButlerGoal
  perception: ButlerWorldPerception
  consciousState: ButlerConsciousState
  highIntensityMotivations: ButlerMotivation[]
}): string {
  const motivationText = input.highIntensityMotivations.length > 0
    ? `高强度动机：${input.highIntensityMotivations
        .map((motivation) => `${motivation.kind}${motivation.intensity}`)
        .join("、")}。`
    : "当前没有明显高强度动机。"

  return [
    `管家选择 ${input.selectedGoal.kind}。`,
    input.selectedGoal.reason,
    motivationText,
    input.perception.risks.length > 0
      ? `当前风险：${input.perception.risks.join("、")}。`
      : "当前没有高强度风险。",
    `意识状态：${input.consciousState.focus}/${input.consciousState.emotionalTone}。`,
  ].join("")
}

function resolveExpectedConsumer(
  goal: ButlerGoal
): ButlerAutonomousIntent["nextExpectedConsumer"] {
  if (goal.constructionAllowed) return "construction_planner"
  if (goal.kind === "explain_to_player") return "p_phone"
  if (goal.kind === "observe_world") return "event_log"
  return "memory_only"
}

function buildFallbackObserveGoal(): ButlerGoal {
  return {
    goalId: "goal-fallback-observe-world",
    kind: "observe_world",
    priority: 50,
    confidence: 55,
    constructionAllowed: false,
    sourceMotivationIds: [],
    reason: "候选目标为空时，管家回到观察世界，避免无目标停摆。",
    tags: ["butler_goal", "observe_world", "fallback_goal"],
  }
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
