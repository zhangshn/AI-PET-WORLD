/**
 * 当前文件负责：读取宠物事件叙事所需的上下文字段。
 */

import type { PetEventStyleInput } from "@/ai/event-style/schema"
import type { NarrativeType } from "@/types/event"
import type { HomeState } from "@/types/home"
import type { PetAction, PetMood } from "@/types/pet"
import type { PetStateLike } from "./event-schema"

export function getPetEventKey(pet: PetStateLike): string {
  return pet.id || pet.name
}

export function getLegacyDrivePrimary(pet: PetStateLike): string | null {
  return pet.timelineSnapshot?.state.drive.primary ?? null
}

export function getSourceDriveFromPet(pet: PetStateLike): string | null {
  const payload = pet.timelineSnapshot?.state?.drive
  const dominant = (payload as Record<string, unknown> | undefined)?.dominant

  if (typeof dominant === "string" && dominant.length > 0) {
    return dominant
  }

  return getLegacyDrivePrimary(pet)
}

export function getPhaseTag(pet: PetStateLike): string | null {
  return pet.timelineSnapshot?.fortune.phaseTag ?? null
}

export function getEmotionalLabel(pet: PetStateLike): string | null {
  return pet.timelineSnapshot?.state.emotional.label ?? null
}

export function buildHomeContextFromHomeState(
  home?: HomeState
): PetEventStyleInput["homeContext"] {
  if (!home) return undefined

  if (home.status === "completed") {
    return {
      homeNote: "家园已经搭好，周围看起来安稳了不少",
    }
  }

  if (home.status === "building") {
    return {
      homeNote: "家园还在一点点搭建起来",
    }
  }

  return undefined
}

export function getEventAction(pet: PetStateLike): PetAction {
  return pet.action
}

export function getEventMood(pet: PetStateLike): PetMood {
  return pet.mood
}

export function getNarrativeTypeByAction(
  action: PetAction,
  pet: PetStateLike
): NarrativeType {
  const energy = pet.timelineSnapshot?.state.physical.energy ?? 50
  const hunger = pet.timelineSnapshot?.state.physical.hunger ?? 50
  const arousal = pet.timelineSnapshot?.state.emotional.arousal ?? 0.5
  const sourceDrive = getSourceDriveFromPet(pet) ?? "observe"

  if (action === "walking") {
    if (energy < 25) return "linger"
    if (sourceDrive === "approach") return "approach_target"
    if (sourceDrive === "eat" && hunger >= 65) return "approach_target"
    if (sourceDrive === "observe") return "observe_environment"
    if (arousal >= 0.55) return "observe_environment"
    return "observe_environment"
  }

  if (action === "idle") {
    if (energy < 25) return "recover"
    if (sourceDrive === "observe") return "observe_environment"
    if (arousal >= 0.65) return "observe_environment"
    if (sourceDrive === "rest") return "recover"
    return "linger"
  }

  if (action === "observing") {
    return "observe_environment"
  }

  if (action === "resting") {
    return "recover"
  }

  if (action === "alert_idle") {
    return "observe_environment"
  }

  if (action === "exploring") {
    if (arousal >= 0.65) return "discover"
    if (sourceDrive === "explore") return "discover"
    return "observe_environment"
  }

  if (action === "approaching") {
    return "approach_target"
  }

  if (action === "eating") {
    return "satisfy_need"
  }

  if (action === "sleeping") {
    return "recover"
  }

  return "unknown"
}

export function getActionEventIntensity(pet: PetStateLike): number {
  const energy = pet.timelineSnapshot?.state.physical.energy ?? 50
  const emotionalArousal = pet.timelineSnapshot?.state.emotional.arousal ?? 0.5

  const normalizedEnergy = Math.max(0, Math.min(1, energy / 100))
  const normalizedEmotion = Math.max(0, Math.min(1, emotionalArousal))

  const intensity = (1 - normalizedEnergy) * 0.45 + normalizedEmotion * 0.55

  return Number(Math.max(0, Math.min(1, intensity)).toFixed(2))
}