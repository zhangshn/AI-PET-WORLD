/**
 * 当前文件职责：提供 AI 管家自主意识核心的统一公开入口。
 */

import { auditButlerAutonomousIntent } from "./audit"
import { buildButlerConsciousState } from "./conscious-state"
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
  const motivations = buildMotivations({ input, perception, memoryState })
  const candidateGoals = buildGoals({ input, motivations })
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

function buildMotivations(input: {
  input: ButlerAutonomyInput
  perception: ReturnType<typeof buildButlerWorldPerception>
  memoryState: ButlerMemoryState
}): ButlerMotivation[] {
  return [
    buildMotivation("resource_prudence", input.perception.resourcePressure, "资源压力影响管家谨慎程度。", ["resource_pressure"]),
    buildMotivation("care", input.perception.careNeed, "照护准备影响管家是否准备照护环境。", ["care_need"]),
    buildMotivation("order", input.perception.storageNeed, "材料准备不足会提高整理和储备动机。", ["storage_need"]),
    buildMotivation("safety", input.perception.boundaryMaintenanceNeed, "土地和边界状态会提高安全维护动机。", ["boundary_need"]),
    buildMotivation("waiting", input.memoryState.learnedPreferences.waitingBias, "记忆中的等待倾向会影响本轮节奏。", ["memory_waiting_bias"]),
    buildMotivation("explanation", 48, "正式世界需要让用户理解管家为什么这样做。", ["explainability"]),
  ]
}

function buildMotivation(
  kind: ButlerMotivation["kind"],
  intensity: number,
  reason: string,
  tags: string[]
): ButlerMotivation {
  return {
    motivationId: `motivation-${kind}`,
    kind,
    intensity: clampScore(intensity),
    sourceSoulFactors: [],
    sourceWorldFactors: tags,
    sourceMemoryFactors: [],
    reason,
    tags: ["butler_motivation", kind, ...tags],
  }
}

function buildGoals(input: {
  input: ButlerAutonomyInput
  motivations: ButlerMotivation[]
}): ButlerGoal[] {
  const motivationByKind = new Map(
    input.motivations.map((motivation) => [motivation.kind, motivation])
  )

  return [
    buildGoal("wait_and_record", motivationByKind.get("resource_prudence")?.intensity ?? 50, false, "资源压力较高时，等待与记录是合法自主目标。"),
    buildGoal("prepare_resources", motivationByKind.get("order")?.intensity ?? 50, true, "材料准备不足时，管家会先整理资源。"),
    buildGoal("prepare_care", motivationByKind.get("care")?.intensity ?? 50, true, "照护准备不足时，管家会优先准备照护条件。"),
    buildGoal("maintain_boundary", motivationByKind.get("safety")?.intensity ?? 50, true, "边界和土地状态会触发维护目标。"),
    buildGoal("observe_world", 52, false, "管家可以先观察世界，不急于建设。"),
    buildGoal("explain_to_player", motivationByKind.get("explanation")?.intensity ?? 48, false, "管家需要向玩家解释当前判断。"),
  ]
}

function buildGoal(
  kind: ButlerGoal["kind"],
  priority: number,
  constructionAllowed: boolean,
  reason: string
): ButlerGoal {
  return {
    goalId: `goal-${kind}`,
    kind,
    priority: clampScore(priority),
    confidence: clampScore(50 + priority / 2),
    constructionAllowed,
    sourceMotivationIds: [`motivation-${kind}`],
    reason,
    tags: ["butler_goal", kind],
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

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
