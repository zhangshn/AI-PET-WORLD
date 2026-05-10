/**
 * 当前文件负责：把宠物后台状态翻译成像素表现意图。
 */

import type {
  PetState,
} from "@/types/pet"

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

function hasTextSignal(value: unknown, pattern: RegExp): boolean {
  if (!value || typeof value !== "object") return false

  const text = JSON.stringify(value)

  return pattern.test(text)
}

function resolveEmotionTone(pet: PetState): ActorVisualIntentEmotionTone {
  if (pet.mood === "alert") return "alert"
  if (pet.mood === "curious") return "curious"
  if (pet.mood === "calm" || pet.mood === "happy") return "calm"
  if (pet.energy <= 28) return "tired"

  return "warm"
}

function resolveExplorationFocus(
  pet: PetState
): ActorVisualIntentFocusTarget {
  const goalType = pet.currentGoal?.type

  if (goalType === "observe_boundary" || goalType === "expand_territory") {
    return "boundary"
  }

  if (pet.currentGoal?.targetZoneType === "observation_zone") {
    return "garden"
  }

  return "home"
}

function buildReasonTags(pet: PetState): string[] {
  const interpretationTone = readStringField(
    pet.latestWorldInterpretation,
    "tone"
  )
  const lifeLineDirection = readStringField(
    pet.latestLifeLineInfluence,
    "direction"
  )

  return [
    "actor_visual_intent",
    "actor_pet",
    `pet_action_${pet.action}`,
    `pet_mood_${pet.mood}`,
    pet.currentGoal ? `pet_goal_${pet.currentGoal.type}` : "pet_goal_none",
    interpretationTone
      ? `world_interpretation_${interpretationTone}`
      : "world_interpretation_none",
    lifeLineDirection
      ? `lifeline_${lifeLineDirection}`
      : "lifeline_none",
  ]
}

function buildPetIntent(input: {
  pet: PetState
  pose: ActorVisualIntentPose
  motionStyle: ActorVisualIntentMotionStyle
  focusTarget: ActorVisualIntentFocusTarget
  emotionTone?: ActorVisualIntentEmotionTone
  intensity: number
  extraTags?: string[]
}): ActorVisualIntent {
  return {
    actor: "pet",
    pose: input.pose,
    motionStyle: input.motionStyle,
    focusTarget: input.focusTarget,
    emotionTone: input.emotionTone ?? resolveEmotionTone(input.pet),
    intensity: clampIntensity(input.intensity),
    reasonTags: [
      ...buildReasonTags(input.pet),
      ...(input.extraTags ?? []),
    ],
  }
}

export function buildPetVisualIntent(
  pet: PetState | null
): ActorVisualIntent | null {
  if (!pet) return null

  if (pet.action === "sleeping") {
    return buildPetIntent({
      pet,
      pose: "sleep",
      motionStyle: "still",
      focusTarget: null,
      emotionTone: "tired",
      intensity: 100 - pet.energy,
      extraTags: ["sleeping", "no_motion"],
    })
  }

  if (pet.action === "resting") {
    return buildPetIntent({
      pet,
      pose: "rest",
      motionStyle: "slow",
      focusTarget: "home",
      emotionTone: pet.energy <= 30 ? "tired" : "calm",
      intensity: 42 + (100 - pet.energy) * 0.25,
      extraTags: ["resting"],
    })
  }

  if (pet.action === "eating") {
    return buildPetIntent({
      pet,
      pose: "eat",
      motionStyle: "still",
      focusTarget: "home",
      emotionTone: "warm",
      intensity: 58 + pet.hunger * 0.25,
      extraTags: ["eating"],
    })
  }

  if (pet.action === "alert_idle" || pet.mood === "alert") {
    return buildPetIntent({
      pet,
      pose: "alert",
      motionStyle: pet.action === "alert_idle" ? "still" : "hesitate",
      focusTarget: "boundary",
      emotionTone: "alert",
      intensity: 68,
      extraTags: ["alert_attention"],
    })
  }

  if (pet.action === "observing") {
    const carefulObservation = hasTextSignal(
      pet.latestWorldInterpretation,
      /careful|cautious|boundary|unknown|risk|observe/i
    )

    return buildPetIntent({
      pet,
      pose: "observe",
      motionStyle: carefulObservation ? "hesitate" : "still",
      focusTarget: carefulObservation ? "boundary" : "home",
      emotionTone: carefulObservation ? "alert" : resolveEmotionTone(pet),
      intensity: carefulObservation ? 64 : 46,
      extraTags: [
        "observing",
        carefulObservation ? "careful_interpretation" : "calm_observation",
      ],
    })
  }

  if (pet.action === "walking" || pet.action === "exploring") {
    return buildPetIntent({
      pet,
      pose: "walk",
      motionStyle: "wander",
      focusTarget: resolveExplorationFocus(pet),
      emotionTone: pet.mood === "curious" ? "curious" : resolveEmotionTone(pet),
      intensity: pet.action === "exploring" ? 62 : 48,
      extraTags: ["movement_exploration"],
    })
  }

  if (pet.action === "approaching") {
    return buildPetIntent({
      pet,
      pose: "walk",
      motionStyle: "targeted",
      focusTarget: "butler",
      emotionTone: pet.mood === "curious" ? "curious" : "warm",
      intensity: 56,
      extraTags: ["approaching"],
    })
  }

  return buildPetIntent({
    pet,
    pose: "idle",
    motionStyle: pet.mood === "curious" ? "wander" : "still",
    focusTarget: pet.mood === "curious" ? "boundary" : null,
    intensity: pet.mood === "curious" ? 38 : 24,
    extraTags: ["idle"],
  })
}
