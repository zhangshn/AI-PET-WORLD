/**
 * 当前文件职责：提供 AI 管家自主意识核心的统一公开入口。
 */

import { auditButlerAutonomousIntent } from "./audit"
import { buildButlerConsciousState } from "./conscious-state"
import { buildButlerGoals } from "./goal-generator"
import { buildButlerMotivations } from "./motivation-engine"
import { buildButlerSoulProfileFromButlerProfile } from "./soul-profile-adapter"
import { buildButlerWorldPerception } from "./world-perception"
import type {
  ButlerAutonomousIntent,
  ButlerAutonomyInput,
  ButlerAutonomyResult,
  ButlerGoal,
  ButlerMemoryEffect,
  ButlerMemoryState,
  ButlerMotivation,
} from "./schema"

export function buildButlerAutonomyResult(
  input: ButlerAutonomyInput
): ButlerAutonomyResult {
  const soulProfile =
    input.butlerSoulProfile ??
    buildButlerSoulProfileFromButlerProfile(input.butlerProfile)
  const memoryState = input.butlerMemoryState ?? buildEmptyButlerMemoryState(input)
  const perception = buildButlerWorldPerception(input)
  const consciousState = buildButlerConsciousState({ input, perception })
  const motivations = buildButlerMotivations({
    soulProfile,
    perception,
    consciousState,
    memoryState,
  })
  const candidateGoals = buildButlerGoals({
    motivations,
    perception,
    consciousState,
    memoryState,
  })
  const selectedIntent = buildSelectedIntent({
    input,
    perception,
    motivations,
    candidateGoals,
    memoryState,
    consciousState,
  })
  const memoryEffects = buildMemoryEffects({
    selectedIntent,
    memoryState,
  })
  const audit = auditButlerAutonomousIntent({
    intent: selectedIntent,
    worldId: input.worldId,
    ownerId: input.ownerId,
  })

  return {
    soulProfile,
    perception,
    consciousState,
    motivations,
    candidateGoals,
    selectedIntent,
    memoryEffects,
    audit,
    explanations: [
      {
        id: `butler-autonomy-explanation-${input.worldId}-${input.now}`,
        title: "管家自主意识判断",
        body: selectedIntent.reason,
        tags: ["butler_autonomy_explanation", selectedIntent.kind],
      },
    ],
    tags: [
      "butler_autonomy_result",
      "schema_phase_ready",
      selectedIntent.kind,
      consciousState.focus,
      ...audit.tags,
    ],
  }
}

function buildEmptyButlerMemoryState(input: ButlerAutonomyInput): ButlerMemoryState {
  return {
    memoryId: `butler-memory-${input.worldId}-${input.ownerId}`,
    recentEvents: [],
    learnedPreferences: {
      shelterBias: 50,
      careBias: 50,
      storageBias: 50,
      boundaryBias: 50,
      waitingBias: 50,
      resourceCautionBias: 50,
    },
    unresolvedConcerns: [],
    tags: ["butler_memory_seed", "empty_memory_state"],
  }
}

function buildSelectedIntent(input: {
  input: ButlerAutonomyInput
  perception: ReturnType<typeof buildButlerWorldPerception>
  motivations: ButlerMotivation[]
  candidateGoals: ButlerGoal[]
  memoryState: ButlerMemoryState
  consciousState: ReturnType<typeof buildButlerConsciousState>
}): ButlerAutonomousIntent {
  const selectedGoal = [...input.candidateGoals].sort(
    (left, right) => right.priority - left.priority
  )[0]

  return {
    intentId: `butler-intent-${input.input.worldId}-${input.input.now}`,
    kind: selectedGoal.kind,
    priority: selectedGoal.priority,
    confidence: selectedGoal.confidence,
    constructionAllowed: selectedGoal.constructionAllowed,
    emotionalTone: input.consciousState.emotionalTone,
    sourceMotivations: input.motivations
      .filter((motivation) => motivation.intensity >= 45)
      .map((motivation) => motivation.motivationId),
    perceivedWorldFacts: input.perception.perceivedFacts,
    memoryReferences: input.memoryState.recentEvents.slice(-3).map((event) => event.eventId),
    reason: [
      `管家选择 ${selectedGoal.kind}。`,
      selectedGoal.reason,
      input.perception.risks.length > 0
        ? `当前风险：${input.perception.risks.join("、")}。`
        : "当前没有高强度风险。",
    ].join(""),
    nextExpectedConsumer: selectedGoal.constructionAllowed
      ? "construction_planner"
      : selectedGoal.kind === "explain_to_player"
        ? "p_phone"
        : "memory_only",
    tags: ["butler_autonomous_intent", selectedGoal.kind],
  }
}

function buildMemoryEffects(input: {
  selectedIntent: ButlerAutonomousIntent
  memoryState: ButlerMemoryState
}): ButlerMemoryEffect[] {
  if (input.selectedIntent.kind === "wait_and_record") {
    return [{
      effectId: "memory-effect-waiting-bias",
      targetPreference: "waitingBias",
      delta: 1,
      reason: "本轮选择等待记录，轻微增强等待策略经验。",
      tags: ["memory_effect", "waiting_bias"],
    }]
  }

  if (input.selectedIntent.kind === "prepare_resources") {
    return [{
      effectId: "memory-effect-resource-caution",
      targetPreference: "resourceCautionBias",
      delta: 1,
      reason: "本轮关注资源准备，轻微增强资源谨慎经验。",
      tags: ["memory_effect", "resource_caution"],
    }]
  }

  return []
}
