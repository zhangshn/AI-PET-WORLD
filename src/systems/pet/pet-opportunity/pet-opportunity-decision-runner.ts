/**
 * 当前文件负责：处理宠物对非食物类管家机会的自主判断。
 */

import type { PetState } from "@/types/pet"
import type { PetLearningState } from "../learning/pet-learning-gateway"
import type { ButlerOpportunity } from "@/systems/butlerSystem"

export type PetOpportunityDecision = {
  accepted: boolean
  reason: string
  intensity: number
}

export type EvaluatePetOpportunityInput = {
  pet: PetState | null
  opportunity: ButlerOpportunity
  learningState?: PetLearningState | null
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value))
}

function getPhysicalEnergy(pet: PetState): number {
  return pet.timelineSnapshot?.state.physical.energy ?? pet.energy
}

function getPhysicalHunger(pet: PetState): number {
  return pet.timelineSnapshot?.state.physical.hunger ?? pet.hunger
}

function getEmotionalLabel(pet: PetState): string {
  return pet.timelineSnapshot?.state.emotional.label ?? pet.mood
}

function getRelationalLabel(pet: PetState): string {
  return pet.timelineSnapshot?.state.relational.label ?? "neutral"
}

function getPhaseTag(pet: PetState): string {
  return pet.timelineSnapshot?.fortune.phaseTag ?? "stable_phase"
}

export function evaluateRestOffer(
  input: EvaluatePetOpportunityInput
): PetOpportunityDecision {
  const { pet, opportunity } = input
  const learningState = input.learningState ?? pet?.learningState ?? null

  if (!pet) {
    return {
      accepted: false,
      reason: "当前宠物状态不可用",
      intensity: 0.2,
    }
  }

  if (opportunity.type !== "rest_offer") {
    return {
      accepted: false,
      reason: "当前机会不是恢复机会",
      intensity: 0.2,
    }
  }

  const energy = getPhysicalEnergy(pet)
  const hunger = getPhysicalHunger(pet)
  const emotion = getEmotionalLabel(pet)
  const phaseTag = getPhaseTag(pet)
  const comfortLevel = opportunity.payload?.comfortLevel ?? opportunity.intensity

  let acceptanceScore = 0

  acceptanceScore += Math.max(0, 60 - energy) * 1.1
  acceptanceScore += Math.max(0, comfortLevel - 35) * 0.28
  acceptanceScore += (learningState?.restFamiliarity ?? 0) * 0.18
  acceptanceScore += (learningState?.butlerTrustLearning ?? 0) * 0.08

  if (pet.action === "resting" || pet.action === "sleeping") {
    acceptanceScore += 28
  }

  if (phaseTag === "recovery_phase") {
    acceptanceScore += 18
  }

  if (emotion === "anxious" || emotion === "irritated") {
    acceptanceScore += energy <= 45 ? 6 : -8
  }

  if (hunger >= 75) {
    acceptanceScore -= 18
  }

  const accepted = acceptanceScore >= 24

  return {
    accepted,
    reason: accepted
      ? "当前状态更需要恢复，因此接受了休息环境"
      : "当前自主判断还没有选择停下来休息",
    intensity: clamp(acceptanceScore / 80, 0.25, 0.85),
  }
}

export function evaluateApproachOffer(
  input: EvaluatePetOpportunityInput
): PetOpportunityDecision {
  const { pet, opportunity } = input
  const learningState = input.learningState ?? pet?.learningState ?? null

  if (!pet) {
    return {
      accepted: false,
      reason: "当前宠物状态不可用",
      intensity: 0.2,
    }
  }

  if (opportunity.type !== "approach_offer") {
    return {
      accepted: false,
      reason: "当前机会不是接近机会",
      intensity: 0.2,
    }
  }

  const hunger = getPhysicalHunger(pet)
  const energy = getPhysicalEnergy(pet)
  const emotion = getEmotionalLabel(pet)
  const relation = getRelationalLabel(pet)
  const socialWarmth = opportunity.payload?.socialWarmth ?? opportunity.intensity

  let acceptanceScore = 0

  acceptanceScore += (learningState?.approachSafetyLearning ?? 0) * 0.2
  acceptanceScore += (learningState?.butlerTrustLearning ?? 0) * 0.1

  if (relation === "secure") acceptanceScore += 26
  if (relation === "attached") acceptanceScore += 30
  if (relation === "trusting") acceptanceScore += 22
  if (relation === "guarded") acceptanceScore -= 12
  if (relation === "distant") acceptanceScore -= 18

  acceptanceScore += Math.max(0, socialWarmth - 35) * 0.22

  if (pet.action === "approaching") {
    acceptanceScore += 24
  }

  if (pet.action === "observing") {
    acceptanceScore += 8
  }

  if (emotion === "relaxed" || emotion === "content") {
    acceptanceScore += 10
  }

  if (emotion === "anxious" || emotion === "irritated") {
    acceptanceScore -= 18
  }

  if (hunger >= 70) {
    acceptanceScore -= 10
  }

  if (energy <= 25) {
    acceptanceScore -= 8
  }

  const accepted = acceptanceScore >= 24

  return {
    accepted,
    reason: accepted
      ? "当前安全感允许它回应接近机会"
      : "当前距离边界仍然更重要，因此没有回应接近",
    intensity: clamp(acceptanceScore / 80, 0.2, 0.8),
  }
}