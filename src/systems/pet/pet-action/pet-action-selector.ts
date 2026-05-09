/**
 * 当前文件负责：编排宠物候选行为权重，并选择下一步内部行为意图。
 */

import type { PetAction, PetState } from "../../../types/pet"
import type { DriveSnapshot, DriveType } from "../drive/pet-drive-gateway"
import type { PetGoalState } from "../goal/pet-goal-gateway"
import type { ActionDecisionReason } from "./pet-action-stability"

import {
  applyActionDriveLayer,
} from "./pet-action-drive-layer"

import {
  applyActionGoalLayer,
} from "./pet-action-goal-layer"

import {
  applyActionLifePhaseLayer,
} from "./pet-action-life-phase-layer"

import {
  applyActionPersonalityLayer,
} from "./pet-action-personality-layer"

import {
  applyActionEmotionRelationLayer,
  applyActionPhysicalLayer,
} from "./pet-action-state-layer"

import {
  applyActionTimelineLayer,
} from "./pet-action-timeline-layer"

import {
  applyActionRandomLayer,
} from "./pet-action-random-layer"

import {
  createEmptyActionWeights,
  normalizeActionWeights,
  pickActionByWeight,
} from "./pet-action-weight-utils"

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
  const lifePhase = input.pet.lifeState.phase
  const consciousness = input.pet.consciousnessProfile.bias

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

  const weights = createEmptyActionWeights()

  /**
   * action selector 只选择内部行为意图。
   * 世界刺激与认知不在这里直接加权，它们已经进入 drive / expression。
   */
  applyActionDriveLayer(input.driveSnapshot, weights)
  applyActionPersonalityLayer(input.pet, weights)
  applyActionLifePhaseLayer(lifePhase, weights)
  applyActionGoalLayer(input.currentGoal, weights)

  applyActionPhysicalLayer({
    energy,
    hunger,
    weights,
  })

  applyActionEmotionRelationLayer({
    emotional,
    relational,
    riskTolerance: consciousness.riskTolerance,
    weights,
  })

  applyActionTimelineLayer({
    phaseTag,
    branchTag,
    restResistance: consciousness.restResistance,
    weights,
  })

  applyActionRandomLayer(weights)
  normalizeActionWeights(weights)

  return {
    action: pickActionByWeight(weights),
    reason: "goal_guided_selection",
  }
}