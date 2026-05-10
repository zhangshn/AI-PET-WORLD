/**
 * 当前文件负责：把管家后台状态翻译成像素表现意图。
 */

import type {
  ButlerState,
} from "@/types/butler"

import type {
  ActorVisualIntent,
  ActorVisualIntentEmotionTone,
  ActorVisualIntentFocusTarget,
  ActorVisualIntentMotionStyle,
  ActorVisualIntentPose,
} from "./actor-visual-intent-types"

function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(100, Math.round(value)))
}

function readStringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null

  const record = value as Record<string, unknown>
  const field = record[key]

  return typeof field === "string" ? field : null
}

function resolveEmotionTone(
  butler: ButlerState
): ActorVisualIntentEmotionTone {
  if (butler.mood === "alert") return "alert"
  if (butler.mood === "focused" || butler.mood === "busy") return "focused"
  if (butler.mood === "gentle") return "warm"

  return "calm"
}

function mapExecutionTarget(
  target: NonNullable<ButlerState["latestBehaviorExecution"]>["target"]
): ActorVisualIntentFocusTarget {
  if (target === "incubator") return "incubator"
  if (target === "garden") return "garden"
  if (target === "home") return "home"
  if (target === "pet") return "pet"
  if (target === "world") return "boundary"
  if (target === "player") return "home"

  return null
}

function buildReasonTags(butler: ButlerState): string[] {
  const execution = butler.latestBehaviorExecution
  const interpretationTone = readStringField(
    butler.latestWorldInterpretation,
    "tone"
  )

  return [
    "actor_visual_intent",
    "actor_butler",
    `butler_task_${butler.task}`,
    `butler_mood_${butler.mood}`,
    execution ? `execution_${execution.kind}` : "execution_none",
    interpretationTone
      ? `world_interpretation_${interpretationTone}`
      : "world_interpretation_none",
    ...(execution?.tags.slice(0, 8) ?? []),
  ]
}

function buildButlerIntent(input: {
  butler: ButlerState
  pose: ActorVisualIntentPose
  motionStyle: ActorVisualIntentMotionStyle
  focusTarget: ActorVisualIntentFocusTarget
  emotionTone?: ActorVisualIntentEmotionTone
  intensity: number
  extraTags?: string[]
}): ActorVisualIntent {
  return {
    actor: "butler",
    pose: input.pose,
    motionStyle: input.motionStyle,
    focusTarget: input.focusTarget,
    emotionTone: input.emotionTone ?? resolveEmotionTone(input.butler),
    intensity: clampIntensity(input.intensity),
    reasonTags: [
      ...buildReasonTags(input.butler),
      ...(input.extraTags ?? []),
    ],
  }
}

export function buildButlerVisualIntent(
  butler: ButlerState | null
): ActorVisualIntent | null {
  if (!butler) return null

  const execution = butler.latestBehaviorExecution

  if (execution) {
    if (
      execution.kind === "home_building" ||
      execution.kind === "home_maintenance" ||
      execution.kind === "space_tidying"
    ) {
      return buildButlerIntent({
        butler,
        pose: "work",
        motionStyle: "targeted",
        focusTarget: mapExecutionTarget(execution.target),
        emotionTone: "focused",
        intensity: execution.intensity,
        extraTags: ["execution_home_work"],
      })
    }

    if (execution.kind === "incubator_watch") {
      return buildButlerIntent({
        butler,
        pose: "observe",
        motionStyle: "targeted",
        focusTarget: "incubator",
        emotionTone: "focused",
        intensity: execution.intensity,
        extraTags: ["execution_incubator_watch"],
      })
    }

    if (execution.kind === "care_opportunity_support") {
      return buildButlerIntent({
        butler,
        pose: "offer",
        motionStyle: "slow",
        focusTarget: "pet",
        emotionTone: "warm",
        intensity: execution.intensity,
        extraTags: ["execution_care_opportunity"],
      })
    }

    if (execution.kind === "protective_waiting") {
      return buildButlerIntent({
        butler,
        pose: "observe",
        motionStyle: "hesitate",
        focusTarget: "pet",
        emotionTone: resolveEmotionTone(butler),
        intensity: execution.intensity,
        extraTags: ["execution_protective_waiting"],
      })
    }
  }

  if (butler.task === "building_home") {
    return buildButlerIntent({
      butler,
      pose: "work",
      motionStyle: "targeted",
      focusTarget: "home",
      emotionTone: "focused",
      intensity: 54,
      extraTags: ["task_home_building"],
    })
  }

  if (butler.task === "watching_incubator") {
    return buildButlerIntent({
      butler,
      pose: "observe",
      motionStyle: "targeted",
      focusTarget: "incubator",
      emotionTone: "focused",
      intensity: 58,
      extraTags: ["task_incubator_watch"],
    })
  }

  if (butler.task === "watching_pet") {
    return buildButlerIntent({
      butler,
      pose: "observe",
      motionStyle: "slow",
      focusTarget: "pet",
      intensity: 42,
      extraTags: ["task_pet_observation"],
    })
  }

  if (
    butler.task === "offering_food" ||
    butler.task === "offering_rest" ||
    butler.task === "offering_approach"
  ) {
    return buildButlerIntent({
      butler,
      pose: "offer",
      motionStyle: "slow",
      focusTarget: "pet",
      emotionTone: "warm",
      intensity: 48,
      extraTags: ["task_care_offer"],
    })
  }

  return buildButlerIntent({
    butler,
    pose: "idle",
    motionStyle: "still",
    focusTarget: null,
    intensity: butler.mood === "alert" ? 44 : 24,
    extraTags: ["task_idle"],
  })
}
