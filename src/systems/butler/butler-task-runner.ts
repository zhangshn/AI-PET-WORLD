/**
 * 当前文件负责：根据孵化器、宠物、家园与管家偏置判断管家的当前任务。
 */

import type { GenderAwareBehaviorBias } from "@/ai/gateway"
import type { HomeState } from "@/types/home"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"

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
  pendingOpportunityCount: number
}

function petExistsAndBorn(pet: PetState | null): boolean {
  return !!pet
}

function isIncubatorCompleted(incubator: IncubatorState | null): boolean {
  if (!incubator) return true

  return incubator.progress >= 100 || incubator.status === "hatched"
}

function getCarePriority(behaviorBias: GenderAwareBehaviorBias | null): number {
  return behaviorBias?.butlerBehaviorBias.carePriority ?? 50
}

function getConstructionDrive(
  behaviorBias: GenderAwareBehaviorBias | null
): number {
  return behaviorBias?.butlerBehaviorBias.constructionDrive ?? 50
}

function shouldPrioritizeNewbornPet(pet: PetState | null): boolean {
  if (!pet) return false

  return pet.lifeState.phase === "newborn" || pet.lifeState.phase === "adaptation"
}

function shouldOfferFood(
  pet: PetState | null,
  behaviorBias: GenderAwareBehaviorBias | null
): boolean {
  if (!pet?.timelineSnapshot) return false

  const hunger = pet.timelineSnapshot.state.physical.hunger
  const emotion = pet.timelineSnapshot.state.emotional.label
  const carePriority = getCarePriority(behaviorBias)

  if (hunger >= 58) return true

  if (
    hunger >= 48 - Math.max(0, carePriority - 50) * 0.08 &&
    (emotion === "low" || emotion === "anxious" || emotion === "irritated")
  ) {
    return true
  }

  return false
}

function shouldOfferRest(
  pet: PetState | null,
  time: ButlerSystemInput["time"],
  behaviorBias: GenderAwareBehaviorBias | null
): boolean {
  if (!pet?.timelineSnapshot) return false

  const energy = pet.timelineSnapshot.state.physical.energy
  const phaseTag = pet.timelineSnapshot.fortune.phaseTag
  const hour = time.hour
  const carePriority = getCarePriority(behaviorBias)

  if (energy <= 40 + Math.max(0, carePriority - 50) * 0.08) return true
  if (phaseTag === "recovery_phase") return true
  if ((hour >= 22 || hour <= 5) && energy <= 65) return true

  return false
}

function shouldOfferApproach(pet: PetState | null): boolean {
  if (!pet?.timelineSnapshot) return false

  const relation = pet.timelineSnapshot.state.relational.label
  const emotion = pet.timelineSnapshot.state.emotional.label
  const hunger = pet.timelineSnapshot.state.physical.hunger
  const energy = pet.timelineSnapshot.state.physical.energy

  return (
    (relation === "secure" || relation === "attached") &&
    hunger < 65 &&
    energy > 35 &&
    emotion !== "irritated" &&
    emotion !== "anxious"
  )
}

function shouldBuildHome(context: ButlerTaskContext): boolean {
  const { home, pet, incubator, behaviorBias } = context

  if (!home) return false
  if (!isIncubatorCompleted(incubator)) return false
  if (home.status === "completed") return false

  const constructionDrive = getConstructionDrive(behaviorBias)

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
  const { pet, time, behaviorBias } = context

  if (shouldOfferFood(pet, behaviorBias)) {
    return "offering_food"
  }

  if (shouldOfferRest(pet, time, behaviorBias)) {
    return "offering_rest"
  }

  if (shouldOfferApproach(pet)) {
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