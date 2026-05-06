/**
 * 当前文件负责：根据孵化器、宠物、家园与管家偏置判断管家的当前任务。
 */

import type { GenderAwareBehaviorBias } from "@/ai/gateway"
import type { HomeState } from "@/types/home"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"

import {
  buildButlerProfileTaskTuning,
  type ButlerProfileTaskTuning,
} from "./butler-profile-tuning"

import type {
  ButlerState,
  ButlerSystemInput,
  ButlerTask,
} from "./butler-schema"

type ButlerTaskContext = {
  pet: PetState | null
  incubator: IncubatorState | null
  home: HomeState | null
  time: ButlerSystemInput["time"]
  behaviorBias: GenderAwareBehaviorBias | null
  profileTuning: ButlerProfileTaskTuning
  pendingOpportunityCount: number
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 50
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

function petExistsAndBorn(pet: PetState | null): boolean {
  return !!pet
}

function isIncubatorCompleted(incubator: IncubatorState | null): boolean {
  if (!incubator) return true

  return incubator.progress >= 100 || incubator.status === "hatched"
}

function getCarePriority(context: ButlerTaskContext): number {
  const base = context.behaviorBias?.butlerBehaviorBias.carePriority ?? 50

  return clampScore(base + context.profileTuning.carePriorityOffset)
}

function getConstructionDrive(context: ButlerTaskContext): number {
  const base =
    context.behaviorBias?.butlerBehaviorBias.constructionDrive ?? 50

  return clampScore(base + context.profileTuning.constructionDriveOffset)
}

function shouldPrioritizeNewbornPet(pet: PetState | null): boolean {
  if (!pet) return false

  return pet.lifeState.phase === "newborn" || pet.lifeState.phase === "adaptation"
}

function shouldOfferFood(context: ButlerTaskContext): boolean {
  const { pet } = context

  if (!pet?.timelineSnapshot) return false

  const hunger = pet.timelineSnapshot.state.physical.hunger
  const emotion = pet.timelineSnapshot.state.emotional.label
  const carePriority = getCarePriority(context)
  const foodSensitivity = context.profileTuning.foodSensitivityOffset

  if (hunger >= 58 - Math.max(0, foodSensitivity) * 0.2) return true

  if (
    hunger >=
      48 -
        Math.max(0, carePriority - 50) * 0.08 -
        Math.max(0, foodSensitivity) * 0.15 &&
    (emotion === "low" || emotion === "anxious" || emotion === "irritated")
  ) {
    return true
  }

  return false
}

function shouldOfferRest(context: ButlerTaskContext): boolean {
  const { pet, time } = context

  if (!pet?.timelineSnapshot) return false

  const energy = pet.timelineSnapshot.state.physical.energy
  const phaseTag = pet.timelineSnapshot.fortune.phaseTag
  const hour = time.hour
  const carePriority = getCarePriority(context)
  const restSensitivity = context.profileTuning.restSensitivityOffset

  if (
    energy <=
    40 +
      Math.max(0, carePriority - 50) * 0.08 +
      Math.max(0, restSensitivity) * 0.2
  ) {
    return true
  }

  if (phaseTag === "recovery_phase") return true
  if ((hour >= 22 || hour <= 5) && energy <= 65) return true

  return false
}

function shouldOfferApproach(context: ButlerTaskContext): boolean {
  const { pet } = context

  if (!pet?.timelineSnapshot) return false

  const relation = pet.timelineSnapshot.state.relational.label
  const emotion = pet.timelineSnapshot.state.emotional.label
  const hunger = pet.timelineSnapshot.state.physical.hunger
  const energy = pet.timelineSnapshot.state.physical.energy
  const approachSensitivity = context.profileTuning.approachSensitivityOffset

  const hungerLimit = 65 + Math.max(0, approachSensitivity) * 0.15
  const energyLimit = 35 - Math.max(0, approachSensitivity) * 0.1

  return (
    (relation === "secure" || relation === "attached") &&
    hunger < hungerLimit &&
    energy > energyLimit &&
    emotion !== "irritated" &&
    emotion !== "anxious"
  )
}

function shouldObserveBeforeActing(context: ButlerTaskContext): boolean {
  const observationBias = context.profileTuning.observationBiasOffset

  if (observationBias < 8) return false
  if (context.pendingOpportunityCount > 0) return true

  return context.pet?.action === "observing"
}

function shouldBuildHome(context: ButlerTaskContext): boolean {
  const { home, pet, incubator } = context

  if (!home) return false
  if (!isIncubatorCompleted(incubator)) return false
  if (home.status === "completed") return false

  const constructionDrive = getConstructionDrive(context)

  if (!pet?.timelineSnapshot) {
    return true
  }

  const energy = pet.timelineSnapshot.state.physical.energy
  const hunger = pet.timelineSnapshot.state.physical.hunger

  if (shouldPrioritizeNewbornPet(pet)) {
    return constructionDrive >= 72 && energy > 45 && hunger < 55
  }

  if (energy <= 35 || hunger >= 65) {
    return constructionDrive >= 76
  }

  return true
}

function choosePetCareTask(context: ButlerTaskContext): ButlerTask | null {
  if (shouldObserveBeforeActing(context)) {
    return "watching_pet"
  }

  if (shouldOfferFood(context)) {
    return "offering_food"
  }

  if (shouldOfferRest(context)) {
    return "offering_rest"
  }

  if (shouldOfferApproach(context)) {
    return "offering_approach"
  }

  return null
}

function buildTaskContext(
  input: ButlerSystemInput,
  state: ButlerState
): ButlerTaskContext {
  const behaviorBias =
    input.butlerBehaviorBias ??
    state.behaviorBias ??
    input.pet?.lifeProfile.genderAwareBehaviorBias ??
    null

  return {
    pet: input.pet,
    incubator: input.incubator,
    home: input.home,
    time: input.time,
    behaviorBias,
    profileTuning: buildButlerProfileTaskTuning(state.profile),
    pendingOpportunityCount: state.pendingOpportunities.length,
  }
}

export function chooseButlerTask(
  input: ButlerSystemInput,
  state: ButlerState
): ButlerTask {
  const context = buildTaskContext(input, state)

  if (!isIncubatorCompleted(context.incubator)) {
    return "watching_incubator"
  }

  if (petExistsAndBorn(context.pet)) {
    const careTask = choosePetCareTask(context)

    if (careTask) {
      return careTask
    }

    if (shouldBuildHome(context)) {
      return "building_home"
    }

    return "watching_pet"
  }

  if (shouldBuildHome(context)) {
    return "building_home"
  }

  if (context.pendingOpportunityCount > 0) {
    return "watching_pet"
  }

  return "idle"
}