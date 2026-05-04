/**
 * 当前文件负责：处理宠物自主接受管家机会后的轻量状态影响。
 */

import type { PetState } from "@/types/pet"
import type { ButlerOpportunity } from "@/systems/butlerSystem"

export type ApplyPetOpportunityEffectInput = {
  pet: PetState | null
  opportunity: ButlerOpportunity
}

export type ApplyPetOpportunityEffectResult = {
  pet: PetState | null
  energyDelta: number
  hungerDelta: number
  memorySummary: string
}

function clamp(value: number, min = -100, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function pushLimitedSummary(
  summaries: string[],
  summary: string,
  max = 6
): string[] {
  const next = [summary, ...summaries.filter((item) => item !== summary)]
  return next.slice(0, max)
}

export function applyAcceptedRestOfferEffect(
  input: ApplyPetOpportunityEffectInput
): ApplyPetOpportunityEffectResult {
  const { pet, opportunity } = input

  if (!pet || opportunity.type !== "rest_offer") {
    return {
      pet,
      energyDelta: 0,
      hungerDelta: 0,
      memorySummary: "",
    }
  }

  const comfortLevel = opportunity.payload?.comfortLevel ?? opportunity.intensity
  const energyDelta = Math.max(1, Math.round(2 + comfortLevel * 0.04))

  const previousEnergy =
    pet.timelineSnapshot?.state.physical.energy ?? pet.energy

  const nextEnergy = clampPercent(previousEnergy + energyDelta)

  const memorySummary = "恢复机会被自主接受，恢复环境被记为较可靠。"

  const nextPet: PetState = {
    ...pet,
    energy: Math.round(nextEnergy),
    memoryState: {
      ...pet.memoryState,
      selfImpression: {
        ...pet.memoryState.selfImpression,
        recoveryConfidence: clamp(
          pet.memoryState.selfImpression.recoveryConfidence + 2
        ),
        rhythmConfidence: clamp(
          pet.memoryState.selfImpression.rhythmConfidence + 1
        ),
      },
      preferenceBias: {
        ...pet.memoryState.preferenceBias,
        restBias: clamp(pet.memoryState.preferenceBias.restBias + 2),
      },
      summaries: pushLimitedSummary(pet.memoryState.summaries, memorySummary),
    },
    timelineSnapshot: pet.timelineSnapshot
      ? {
          ...pet.timelineSnapshot,
          state: {
            ...pet.timelineSnapshot.state,
            physical: {
              ...pet.timelineSnapshot.state.physical,
              energy: nextEnergy,
            },
          },
        }
      : pet.timelineSnapshot,
  }

  return {
    pet: nextPet,
    energyDelta,
    hungerDelta: 0,
    memorySummary,
  }
}

export function applyAcceptedApproachOfferEffect(
  input: ApplyPetOpportunityEffectInput
): ApplyPetOpportunityEffectResult {
  const { pet, opportunity } = input

  if (!pet || opportunity.type !== "approach_offer") {
    return {
      pet,
      energyDelta: 0,
      hungerDelta: 0,
      memorySummary: "",
    }
  }

  const socialWarmth = opportunity.payload?.socialWarmth ?? opportunity.intensity
  const trustDelta = socialWarmth >= 35 ? 2 : 1
  const approachDelta = socialWarmth >= 35 ? 3 : 2

  const memorySummary = "接近机会被自主回应，关系距离被记为更安全。"

  const nextPet: PetState = {
    ...pet,
    memoryState: {
      ...pet.memoryState,
      relationImpression: {
        ...pet.memoryState.relationImpression,
        caretakerTrust: clamp(
          pet.memoryState.relationImpression.caretakerTrust + trustDelta
        ),
        approachSafety: clamp(
          pet.memoryState.relationImpression.approachSafety + approachDelta
        ),
      },
      preferenceBias: {
        ...pet.memoryState.preferenceBias,
        approachBias: clamp(
          pet.memoryState.preferenceBias.approachBias + approachDelta
        ),
      },
      summaries: pushLimitedSummary(pet.memoryState.summaries, memorySummary),
    },
  }

  return {
    pet: nextPet,
    energyDelta: 0,
    hungerDelta: 0,
    memorySummary,
  }
}