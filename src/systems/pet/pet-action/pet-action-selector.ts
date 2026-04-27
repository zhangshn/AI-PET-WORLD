/**
 * 当前文件负责：根据驱动、目标、认知、人格、记忆与状态，选择宠物下一步候选行为。
 */

import type { PetAction, PetState } from "../../../types/pet"
import type { DriveSnapshot, DriveType } from "../../driveSystem"
import type { PetGoalState } from "../../goalSystem"
import type { ActionDecisionReason } from "./pet-action-stability"

export type SelectPetActionInput = {
  pet: PetState
  dominantDrive: DriveType
  currentGoal?: PetGoalState
  snapshot?: PetState["timelineSnapshot"]
  driveSnapshot?: DriveSnapshot
}

export type SelectPetActionResult = {
  action: PetAction
  reason: ActionDecisionReason
}

export function selectPetAction(
  input: SelectPetActionInput
): SelectPetActionResult {
  if (!input.snapshot || !input.driveSnapshot) {
    return {
      action: "idle",
      reason: "bootstrap_default",
    }
  }

  const state = input.snapshot.state
  const phaseTag = input.snapshot.fortune.phaseTag
  const branchTag = input.snapshot.trajectory.branchTag

  const energy = input.pet.energy
  const hunger = input.pet.hunger
  const emotional = state.emotional.label
  const relational = state.relational.label

  const consciousness = input.pet.consciousnessProfile.bias
  const finalBias = input.pet.finalPersonalityProfile.bias.petBehaviorBias
  const lifePhase = input.pet.lifeState.phase
  const memory = input.pet.memoryState.preferenceBias

  if (energy <= 6) {
    return {
      action: "sleeping",
      reason: "hard_low_energy",
    }
  }

  if (hunger >= 95) {
    return {
      action: "eating",
      reason: "hard_extreme_hunger",
    }
  }

  const weights: Record<PetAction, number> = {
    sleeping: 0,
    resting: 0,
    eating: 0,
    exploring: 0,
    walking: 0,
    approaching: 0,
    observing: 0,
    alert_idle: 0,
    idle: 5,
  }

  const d = input.driveSnapshot.values

  weights.exploring += d.explore
  weights.walking += d.explore * 0.6
  weights.approaching += d.approach
  weights.walking += d.approach * 0.5
  weights.observing += d.observe
  weights.idle += d.observe * 0.3
  weights.alert_idle += d.avoid * 0.6
  weights.observing += d.avoid * 0.25
  weights.resting += d.rest
  weights.sleeping += d.rest * 0.7
  weights.eating += d.eat

  weights.observing += finalBias.observationNeed * 0.18
  weights.approaching += finalBias.attachmentNeed * 0.12
  weights.exploring += finalBias.explorationRange * 0.14
  weights.resting += finalBias.restNeed * 0.12

  if (lifePhase === "newborn") {
    weights.exploring -= 34
    weights.walking -= 18
    weights.observing += 22
    weights.resting += 18
    weights.approaching += 10
  }

  if (lifePhase === "adaptation") {
    weights.exploring -= 22
    weights.walking -= 8
    weights.observing += 18
    weights.resting += 10
  }

  if (lifePhase === "dependent") {
    weights.exploring -= 10
    weights.approaching += 14
    weights.observing += 8
  }

  if (lifePhase === "curious") {
    weights.exploring += 8
    weights.observing += 5
  }

  if (consciousness.changeSeeking >= 75) {
    weights.exploring += 10
    weights.walking += 6
    weights.idle -= 4
  }

  if (consciousness.observationBias >= 75) {
    weights.observing += 12
    weights.alert_idle += 4
  }

  if (consciousness.attachmentBias >= 75) {
    weights.approaching += 10
  }

  if (consciousness.comfortSeeking >= 75) {
    weights.resting += 10
    weights.sleeping += 8
    weights.exploring -= 8
  }

  if (consciousness.restResistance >= 75) {
    weights.resting -= 8
    weights.sleeping -= 6
    weights.exploring += 6
    weights.walking += 4
  }

  weights.exploring += memory.exploreBias * 0.5
  weights.observing += memory.observeBias * 0.5
  weights.approaching += memory.approachBias * 0.5
  weights.resting += memory.restBias * 0.5
  weights.eating += memory.eatBias * 0.5

  applyGoalBias(input.currentGoal, weights)
  applyCognitionBias(input.pet, weights)

  if (energy < 20) {
    weights.sleeping += 36
    weights.resting += 18
    weights.exploring -= 28
    weights.approaching -= 12
    weights.walking -= 10
  }

  if (energy < 40) {
    weights.resting += 8
    weights.exploring -= 10
  }

  if (hunger > 70) {
    weights.eating += 32
    weights.exploring -= 12
    weights.approaching -= 6
  }

  if (hunger > 85) {
    weights.eating += 18
    weights.resting += 6
    weights.exploring -= 10
    weights.walking -= 8
  }

  if (emotional === "anxious" || emotional === "irritated") {
    weights.alert_idle += 20
    weights.observing += 14
    weights.approaching -= 12
    weights.exploring -= 10

    if (consciousness.riskTolerance >= 75) {
      weights.exploring += 6
      weights.walking += 4
    }
  }

  if (emotional === "alert") {
    weights.observing += 10
    weights.alert_idle += 8
  }

  if (relational === "attached" || relational === "secure") {
    weights.approaching += 14
  }

  if (relational === "guarded" || relational === "distant") {
    weights.approaching -= 12
    weights.observing += 8
  }

  if (phaseTag === "sensitive_phase") {
    weights.observing += 12
    weights.alert_idle += 12
    weights.approaching -= 12
    weights.exploring -= 10
  }

  if (phaseTag === "recovery_phase") {
    weights.resting += 18
    weights.sleeping += 10
    weights.exploring -= 12
    weights.approaching -= 6

    if (consciousness.restResistance >= 80) {
      weights.exploring += 5
      weights.walking += 4
    }
  }

  if (phaseTag === "attachment_phase") {
    weights.approaching += 12
  }

  if (phaseTag === "growth_phase") {
    weights.exploring += 10
    weights.walking += 5
  }

  if (branchTag === "defense") {
    weights.alert_idle += 10
    weights.observing += 8
    weights.exploring -= 10
    weights.approaching -= 8
  }

  if (branchTag === "attachment") {
    weights.approaching += 8
  }

  if (branchTag === "curiosity") {
    weights.exploring += 8
    weights.walking += 4
  }

  weights.walking += Math.random() * 4
  weights.exploring += Math.random() * 3
  weights.observing += Math.random() * 2

  for (const key in weights) {
    if (weights[key as PetAction] < 0) {
      weights[key as PetAction] = 0
    }
  }

  return {
    action: pickActionByWeight(weights),
    reason: "goal_guided_selection",
  }
}

function applyGoalBias(
  goal: PetGoalState | undefined,
  weights: Record<PetAction, number>
) {
  if (!goal) return

  switch (goal.type) {
    case "expand_territory":
      weights.exploring += 18
      weights.walking += 10
      weights.observing += 3
      weights.resting -= 4
      break

    case "observe_boundary":
      weights.observing += 18
      weights.alert_idle += 10
      weights.exploring -= 8
      weights.approaching -= 6
      break

    case "restore_self":
      weights.resting += 20
      weights.sleeping += 14
      weights.exploring -= 16
      weights.walking -= 10
      weights.approaching -= 10
      break

    case "satisfy_need":
      weights.eating += 24
      weights.walking += 4
      weights.exploring -= 10
      break

    case "secure_attachment":
      weights.approaching += 18
      weights.observing += 4
      break

    case "preserve_distance":
      weights.alert_idle += 16
      weights.observing += 10
      weights.approaching -= 14
      break

    case "stabilize_state":
      weights.observing += 10
      weights.resting += 10
      weights.idle += 8
      weights.exploring -= 8
      break

    case "idle_drift":
    default:
      weights.idle += 6
      break
  }
}

function applyCognitionBias(
  pet: PetState,
  weights: Record<PetAction, number>
) {
  if (!pet.latestCognition) return

  const cognition = pet.latestCognition

  if (cognition.reactionTendency === "chase") {
    weights.exploring += 18
    weights.walking += 10
    weights.observing += 6
  }

  if (cognition.reactionTendency === "observe") {
    weights.observing += 16
    weights.alert_idle += 6
  }

  if (cognition.reactionTendency === "avoid") {
    weights.alert_idle += 18
    weights.resting += 4
    weights.approaching -= 10
    weights.exploring -= 6
  }

  if (cognition.reactionTendency === "rest_nearby") {
    weights.resting += 16
    weights.sleeping += 8
    weights.observing += 4
  }

  if (cognition.interpretation === "exciting") {
    weights.exploring += 8
    weights.walking += 6
  }

  if (cognition.interpretation === "comforting") {
    weights.resting += 8
    weights.sleeping += 4
  }

  if (cognition.interpretation === "dangerous") {
    weights.alert_idle += 10
    weights.observing += 6
    weights.approaching -= 8
  }
}

function pickActionByWeight(weights: Record<PetAction, number>): PetAction {
  const entries = Object.entries(weights) as [PetAction, number][]
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(weight, 0), 0)

  if (total <= 0) return "idle"

  let randomValue = Math.random() * total

  for (const [action, weight] of entries) {
    const safeWeight = Math.max(weight, 0)

    if (randomValue < safeWeight) return action

    randomValue -= safeWeight
  }

  return entries[0][0]
}