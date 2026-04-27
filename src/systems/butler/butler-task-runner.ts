/**
 * 当前文件负责：根据宠物、孵化器、家园与管家偏置判断管家的当前任务。
 */

import type { PetState } from "@/types/pet"
import type { IncubatorState } from "@/types/incubator"
import type { HomeState } from "@/types/home"
import type { FinalPersonalityProfile } from "@/ai/gateway"
import type {
  ButlerState,
  ButlerSystemInput,
  ButlerTask,
} from "./butler-schema"

function petExistsAndBorn(pet: PetState | null): boolean {
  return !!pet
}

function isIncubatorCompleted(incubator: IncubatorState | null): boolean {
  if (!incubator) return true
  return incubator.progress >= 100 || incubator.status === "hatched"
}

function shouldOfferFood(
  pet: PetState | null,
  profile?: FinalPersonalityProfile | null
): boolean {
  if (!pet?.timelineSnapshot) return false

  const hunger = pet.timelineSnapshot.state.physical.hunger
  const emotion = pet.timelineSnapshot.state.emotional.label
  const carePriority = profile?.bias.butlerBehaviorBias.carePriority ?? 50

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
  inputTime: ButlerSystemInput["time"],
  profile?: FinalPersonalityProfile | null
): boolean {
  if (!pet?.timelineSnapshot) return false

  const energy = pet.timelineSnapshot.state.physical.energy
  const phaseTag = pet.timelineSnapshot.fortune.phaseTag
  const hour = inputTime.hour
  const carePriority = profile?.bias.butlerBehaviorBias.carePriority ?? 50

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

function shouldBuildHome(
  home: HomeState | null,
  pet: PetState | null,
  incubator: IncubatorState | null,
  profile?: FinalPersonalityProfile | null
): boolean {
  if (!home) return false

  if (!isIncubatorCompleted(incubator)) {
    return false
  }

  const constructionDrive =
    profile?.bias.butlerBehaviorBias.constructionDrive ?? 50

  if (pet?.timelineSnapshot) {
    const energy = pet.timelineSnapshot.state.physical.energy
    const hunger = pet.timelineSnapshot.state.physical.hunger
    const lifePhase = pet.lifeState?.phase

    if (lifePhase === "newborn" || lifePhase === "adaptation") {
      return constructionDrive >= 72 && energy > 45 && hunger < 55
    }

    if (energy <= 35 || hunger >= 65) {
      return constructionDrive >= 76
    }
  }

  return home.status !== "completed"
}

export function chooseButlerTask(
  input: ButlerSystemInput,
  state: ButlerState
): ButlerTask {
  const { pet, incubator, home, time } = input
  const profile =
    input.butlerPersonalityProfile ?? pet?.finalPersonalityProfile ?? null
  const butlerBias = profile?.bias.butlerBehaviorBias

  if (!isIncubatorCompleted(incubator)) {
    return "watching_incubator"
  }

  if (petExistsAndBorn(pet)) {
    if (
      butlerBias &&
      butlerBias.constructionDrive >= 68 &&
      shouldBuildHome(home, pet, incubator, profile)
    ) {
      return "building_home"
    }

    if (shouldOfferFood(pet, profile)) {
      return "offering_food"
    }

    if (shouldOfferRest(pet, time, profile)) {
      return "offering_rest"
    }

    if (shouldOfferApproach(pet)) {
      return "offering_approach"
    }

    if (shouldBuildHome(home, pet, incubator, profile)) {
      return "building_home"
    }

    return "watching_pet"
  }

  if (shouldBuildHome(home, pet, incubator, profile)) {
    return "building_home"
  }

  return state.pendingOpportunities.length > 0 ? "watching_pet" : "idle"
}