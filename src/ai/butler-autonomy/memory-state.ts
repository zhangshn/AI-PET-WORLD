/**
 * 当前文件职责：提供管家记忆种子、记忆效果和最小记忆生命周期工具。
 */

import type {
  ButlerAutonomousIntent,
  ButlerAutonomyInput,
  ButlerMemoryEffect,
  ButlerMemoryEvent,
  ButlerMemoryState,
} from "./butler-autonomy-schema"

export function buildInitialButlerMemoryState(
  input: ButlerAutonomyInput
): ButlerMemoryState {
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
    tags: [
      "butler_memory_seed",
      "empty_memory_state",
      "working_memory_ready",
      "short_term_memory_ready",
      "reflection_memory_pending",
    ],
  }
}

export function buildButlerMemoryEffects(input: {
  selectedIntent: ButlerAutonomousIntent
  memoryState: ButlerMemoryState
}): ButlerMemoryEffect[] {
  const currentPreferences = input.memoryState.learnedPreferences

  switch (input.selectedIntent.kind) {
    case "wait_and_record":
      return [
        buildMemoryEffect({
          targetPreference: "waitingBias",
          delta: buildAdaptiveDelta(currentPreferences.waitingBias, 1),
          reason: "本轮选择等待记录，轻微增强等待策略经验。",
          tags: ["waiting_bias", "short_term_memory"],
        }),
      ]
    case "prepare_resources":
      return [
        buildMemoryEffect({
          targetPreference: "resourceCautionBias",
          delta: buildAdaptiveDelta(currentPreferences.resourceCautionBias, 1),
          reason: "本轮关注资源准备，轻微增强资源谨慎经验。",
          tags: ["resource_caution", "short_term_memory"],
        }),
      ]
    case "prepare_care":
      return [
        buildMemoryEffect({
          targetPreference: "careBias",
          delta: buildAdaptiveDelta(currentPreferences.careBias, 1),
          reason: "本轮关注照护准备，轻微增强照护准备经验。",
          tags: ["care_bias", "future_life_boundary"],
        }),
      ]
    case "maintain_boundary":
      return [
        buildMemoryEffect({
          targetPreference: "boundaryBias",
          delta: buildAdaptiveDelta(currentPreferences.boundaryBias, 1),
          reason: "本轮关注边界维护，轻微增强边界维护经验。",
          tags: ["boundary_bias", "ecology_respect"],
        }),
      ]
    case "preserve_quiet_space":
      return [
        buildMemoryEffect({
          targetPreference: "boundaryBias",
          delta: buildAdaptiveDelta(currentPreferences.boundaryBias, 1),
          reason: "本轮保留安静空间，轻微增强空间克制和边界经验。",
          tags: ["quiet_space", "anti_overbuilding"],
        }),
      ]
    default:
      return []
  }
}

export function applyButlerMemoryEffects(input: {
  memoryState: ButlerMemoryState
  effects: ButlerMemoryEffect[]
  event?: ButlerMemoryEvent
}): ButlerMemoryState {
  const learnedPreferences = input.effects.reduce(
    (preferences, effect) => ({
      ...preferences,
      [effect.targetPreference]: clampScore(
        preferences[effect.targetPreference] + effect.delta
      ),
    }),
    input.memoryState.learnedPreferences
  )
  const recentEvents = input.event
    ? [...input.memoryState.recentEvents, input.event].slice(-20)
    : input.memoryState.recentEvents

  return {
    ...input.memoryState,
    recentEvents,
    learnedPreferences,
    tags: uniqueTags([
      ...input.memoryState.tags,
      "butler_memory_effects_applied",
      input.effects.length > 0
        ? "memory_preferences_updated"
        : "memory_preferences_unchanged",
    ]),
  }
}

export function buildMemoryEventFromSelectedIntent(input: {
  selectedIntent: ButlerAutonomousIntent
  occurredAt: number
}): ButlerMemoryEvent {
  return {
    eventId: `memory-event-${input.selectedIntent.intentId}`,
    occurredAt: input.occurredAt,
    kind:
      input.selectedIntent.kind === "wait_and_record"
        ? "waiting_decision"
        : "intent_selected",
    summary: input.selectedIntent.reason,
    worldFacts: input.selectedIntent.perceivedWorldFacts,
    emotionalMark: resolveMemoryEmotionalMark(input.selectedIntent),
    learningTags: [
      "intent_memory_event",
      input.selectedIntent.kind,
      input.selectedIntent.constructionAllowed
        ? "construction_candidate"
        : "non_construction_intent",
    ],
  }
}

function buildMemoryEffect(input: {
  targetPreference: ButlerMemoryEffect["targetPreference"]
  delta: number
  reason: string
  tags: string[]
}): ButlerMemoryEffect {
  return {
    effectId: `memory-effect-${input.targetPreference}`,
    targetPreference: input.targetPreference,
    delta: input.delta,
    reason: input.reason,
    tags: ["memory_effect", ...input.tags],
  }
}

function buildAdaptiveDelta(currentValue: number, baseDelta: number): number {
  if (currentValue >= 80) return Math.max(0, baseDelta - 1)
  if (currentValue <= 20) return baseDelta + 1
  return baseDelta
}

function resolveMemoryEmotionalMark(
  intent: ButlerAutonomousIntent
): ButlerMemoryEvent["emotionalMark"] {
  if (intent.emotionalTone === "frustrated") return "frustrated"
  if (intent.emotionalTone === "protective") return "protective"
  if (intent.constructionAllowed) return "concerned"
  if (intent.kind === "wait_and_record") return "neutral"
  return "satisfied"
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
