/**
 * 当前文件负责：根据宠物当前目标区域，对宠物状态施加区域影响。
 */

import type { PetAction, PetMood, PetState } from "../../../types/pet"
import type { WorldZone } from "../../../world/ecology/world-zone-types"

export type RunPetZoneInfluenceInput = {
  pet: PetState
  action: PetAction
  zones: WorldZone[]
}

export type RunPetZoneInfluenceResult = {
  pet: PetState
}

export function runPetZoneInfluence(
  input: RunPetZoneInfluenceInput
): RunPetZoneInfluenceResult {
  const zone = findCurrentGoalZone(input.pet, input.zones)

  if (!zone) {
    return {
      pet: input.pet,
    }
  }

  let nextPet: PetState = {
    ...input.pet,
  }

  const effect = zone.effect

  if (
    zone.type === "sleep_zone" &&
    (input.action === "sleeping" || input.action === "resting")
  ) {
    nextPet = {
      ...nextPet,
      energy: clamp(nextPet.energy + Math.max(1, effect.restBonus * 0.08)),
      hunger: clamp(nextPet.hunger + 0.4),
    }
  }

  if (
    zone.type === "quiet_zone" &&
    (input.action === "resting" || input.action === "observing")
  ) {
    nextPet = {
      ...nextPet,
      energy: clamp(nextPet.energy + Math.max(1, effect.restBonus * 0.05)),
      mood: normalizeQuietZoneMood(nextPet.mood),
    }
  }

  if (
    zone.type === "warm_zone" &&
    (input.action === "resting" ||
      input.action === "sleeping" ||
      input.action === "idle")
  ) {
    nextPet = {
      ...nextPet,
      energy: clamp(nextPet.energy + Math.max(1, effect.comfortBonus * 0.04)),
      mood: normalizeWarmZoneMood(nextPet.mood),
    }
  }

  if (
    zone.type === "food_zone" &&
    (input.action === "eating" || nextPet.currentGoal?.type === "satisfy_need")
  ) {
    nextPet = {
      ...nextPet,
      hunger: clamp(nextPet.hunger - 1.5),
      energy: clamp(nextPet.energy + 0.6),
    }
  }

  if (
    zone.type === "observation_zone" &&
    (input.action === "observing" ||
      nextPet.currentGoal?.type === "observe_boundary")
  ) {
    nextPet = {
      ...nextPet,
      mood: nextPet.mood === "alert" ? "curious" : nextPet.mood,
    }
  }

  if (
    zone.type === "exploration_zone" &&
    (input.action === "exploring" || input.action === "walking")
  ) {
    nextPet = {
      ...nextPet,
      energy: clamp(nextPet.energy - 0.8),
      hunger: clamp(nextPet.hunger + 0.4),
    }
  }

  return {
    pet: nextPet,
  }
}

function findCurrentGoalZone(
  pet: PetState,
  zones: WorldZone[]
): WorldZone | null {
  const goal = pet.currentGoal

  if (!goal) return null

  if (goal.targetZoneId) {
    const byId = zones.find(
      (zone) => zone.id === goal.targetZoneId && zone.isActive
    )

    if (byId) return byId
  }

  if (goal.targetZoneType) {
    return (
      zones.find(
        (zone) => zone.type === goal.targetZoneType && zone.isActive
      ) ?? null
    )
  }

  return null
}

function normalizeQuietZoneMood(mood: PetMood): PetMood {
  if (mood === "alert" || mood === "sad") return "normal"

  return mood
}

function normalizeWarmZoneMood(mood: PetMood): PetMood {
  if (mood === "normal") return "happy"

  return mood
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}