/**
 * 当前文件负责：处理宠物对食物机会的自主判断，以及接受食物后的身体状态更新。
 */

import type { PetMood, PetState } from "../../../types/pet"
import type { ButlerOpportunity } from "../../butlerSystem"

export type FoodOfferDecision = {
  accepted: boolean
  intakeAmount: number
  reason: string
}

export type EvaluateFoodOfferInput = {
  pet: PetState | null
  opportunity: ButlerOpportunity
}

export type ApplyFeedingInput = {
  pet: PetState | null
  amount?: number
}

export type ApplyFeedingResult = {
  pet: PetState | null
  acceptedAmount: number
}

export function evaluateFoodOffer(
  input: EvaluateFoodOfferInput
): FoodOfferDecision {
  const { pet, opportunity } = input

  if (!pet || !pet.timelineSnapshot) {
    return {
      accepted: false,
      intakeAmount: 0,
      reason: "当前宠物状态不可用",
    }
  }

  if (opportunity.type !== "food_offer") {
    return {
      accepted: false,
      intakeAmount: 0,
      reason: "当前机会不是食物机会",
    }
  }

  const snapshot = pet.timelineSnapshot
  const hunger = snapshot.state.physical.hunger
  const energy = snapshot.state.physical.energy
  const emotion = snapshot.state.emotional.label

  const appetiteTrait = pet.personalityProfile.traits.appetite
  const comfortSeeking = pet.consciousnessProfile.bias.comfortSeeking
  const changeSeeking = pet.consciousnessProfile.bias.changeSeeking
  const memoryEatBias = pet.memoryState.preferenceBias.eatBias
  const currentGoal = pet.currentGoal?.type
  const currentAction = pet.action

  const offeredPortion =
    opportunity.payload?.foodPortion ?? Math.round(opportunity.intensity)

  let acceptanceScore = 0

  acceptanceScore += Math.max(0, hunger - 35) * 1.1

  if (energy <= 30) acceptanceScore += 10
  if (currentGoal === "satisfy_need") acceptanceScore += 22
  if (currentAction === "eating") acceptanceScore += 16

  acceptanceScore += (appetiteTrait - 50) * 0.35
  acceptanceScore += memoryEatBias * 0.35
  acceptanceScore += (comfortSeeking - 50) * 0.12

  if (changeSeeking >= 70 && hunger < 65) acceptanceScore -= 8

  if (emotion === "anxious" || emotion === "irritated") {
    if (hunger < 70) acceptanceScore -= 10
    else acceptanceScore -= 4
  }

  if (emotion === "relaxed" || emotion === "content") {
    acceptanceScore += 4
  }

  const accepted = acceptanceScore >= 18

  if (!accepted) {
    return {
      accepted: false,
      intakeAmount: 0,
      reason: "当前自主判断未选择接受食物机会",
    }
  }

  let intakeRatio = 0.35

  intakeRatio += (Math.max(0, hunger - 40) / 100) * 0.45
  intakeRatio += ((appetiteTrait - 50) / 100) * 0.22

  if (currentGoal === "satisfy_need") intakeRatio += 0.16
  if (currentAction === "eating") intakeRatio += 0.12

  if ((emotion === "anxious" || emotion === "irritated") && hunger < 75) {
    intakeRatio -= 0.12
  }

  intakeRatio += (memoryEatBias / 100) * 0.18
  intakeRatio = clamp(intakeRatio, 0.2, 1)

  const intakeAmount = Math.max(
    4,
    Math.min(offeredPortion, Math.round(offeredPortion * intakeRatio))
  )

  let reason = "基于当前身体状态与自主意愿选择了摄食"

  if (currentGoal === "satisfy_need") {
    reason = "当前目标正在满足身体需求"
  } else if (currentAction === "eating") {
    reason = "当前已经进入进食行为，继续完成这次摄食"
  } else if (hunger >= 70) {
    reason = "当前饥饿感较强，因此接受了食物机会"
  }

  return {
    accepted: true,
    intakeAmount,
    reason,
  }
}

export function applyFeeding(input: ApplyFeedingInput): ApplyFeedingResult {
  const { pet } = input
  const amount = input.amount ?? 15

  if (!pet?.timelineSnapshot) {
    return {
      pet,
      acceptedAmount: 0,
    }
  }

  const nextPet: PetState = {
    ...pet,
    timelineSnapshot: {
      ...pet.timelineSnapshot,
      state: {
        ...pet.timelineSnapshot.state,
        physical: {
          ...pet.timelineSnapshot.state.physical,
          hunger: Math.max(0, pet.timelineSnapshot.state.physical.hunger - amount),
          energy: Math.min(100, pet.timelineSnapshot.state.physical.energy + 2),
        },
      },
    },
  }

  const nextTimelineSnapshot = nextPet.timelineSnapshot

  if (!nextTimelineSnapshot) {
    return {
      pet: nextPet,
      acceptedAmount: 0,
    }
  }

  const physical = nextTimelineSnapshot.state.physical

  nextPet.hunger = Math.round(physical.hunger)
  nextPet.energy = Math.round(physical.energy)
  nextPet.mood = mapTimelineStateToPetMood(
    nextTimelineSnapshot.state.emotional.label
  )

  return {
    pet: nextPet,
    acceptedAmount: amount,
  }
}

function mapTimelineStateToPetMood(label: string): PetMood {
  if (label === "excited" || label === "content" || label === "relaxed") {
    return "happy"
  }

  if (label === "alert") return "alert"
  if (label === "curious") return "curious"

  if (label === "anxious" || label === "irritated" || label === "low") {
    return "sad"
  }

  return "normal"
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}