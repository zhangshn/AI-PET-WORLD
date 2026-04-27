/**
 * 当前文件负责：管家任务判断、机会提供、孵化器照看、家园建造倾向，以及基于最终人格向量的管家行为偏置。
 */

import type { PetState } from "../types/pet"
import type { IncubatorState } from "../types/incubator"
import type { HomeState } from "../types/home"
import type { FinalPersonalityProfile } from "../ai/gateway"
import {
  getEntityAutonomyPolicy,
  getOpportunityRule,
} from "../ai/autonomy-core/autonomy-gateway"

export type ButlerTask =
  | "watching_incubator"
  | "building_home"
  | "watching_pet"
  | "offering_food"
  | "offering_rest"
  | "offering_approach"
  | "idle"

export type ButlerMood =
  | "calm"
  | "busy"
  | "gentle"
  | "alert"
  | "focused"

export type ButlerOpportunityType =
  | "food_offer"
  | "rest_offer"
  | "approach_offer"

export type ButlerOpportunity = {
  id: string
  type: ButlerOpportunityType
  createdAtTick: number
  expiresAtTick: number
  createdBy: "butler"
  target: "pet"
  summary: string
  intensity: number
  payload?: {
    foodPortion?: number
    comfortLevel?: number
    socialWarmth?: number
  }
}

export type ButlerState = {
  name: string
  task: ButlerTask
  mood: ButlerMood
  lastTaskChangedTick: number
  pendingOpportunities: ButlerOpportunity[]
  finalPersonalityProfile?: FinalPersonalityProfile | null
}

export type ButlerSystemInput = {
  tick: number
  pet: PetState | null
  incubator: IncubatorState | null
  home: HomeState | null
  time: {
    day: number
    hour: number
    period?: string
  }
  butlerPersonalityProfile?: FinalPersonalityProfile | null
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function buildOpportunityId(
  type: ButlerOpportunityType,
  tick: number
): string {
  return `butler-${type}-${tick}`
}

function createFoodOffer(tick: number, portion: number): ButlerOpportunity {
  const safePortion = clamp(portion, 1, 100)

  return {
    id: buildOpportunityId("food_offer", tick),
    type: "food_offer",
    createdAtTick: tick,
    expiresAtTick: tick + 3,
    createdBy: "butler",
    target: "pet",
    summary: "管家提供了可被宠物自主决定是否接受的食物机会。",
    intensity: safePortion,
    payload: {
      foodPortion: safePortion,
    },
  }
}

function createRestOffer(
  tick: number,
  comfortLevel: number
): ButlerOpportunity {
  const safeComfort = clamp(comfortLevel, 1, 100)

  return {
    id: buildOpportunityId("rest_offer", tick),
    type: "rest_offer",
    createdAtTick: tick,
    expiresAtTick: tick + 4,
    createdBy: "butler",
    target: "pet",
    summary: "管家整理了恢复环境，给宠物提供休息机会。",
    intensity: safeComfort,
    payload: {
      comfortLevel: safeComfort,
    },
  }
}

function createApproachOffer(
  tick: number,
  socialWarmth: number
): ButlerOpportunity {
  const safeWarmth = clamp(socialWarmth, 1, 100)

  return {
    id: buildOpportunityId("approach_offer", tick),
    type: "approach_offer",
    createdAtTick: tick,
    expiresAtTick: tick + 2,
    createdBy: "butler",
    target: "pet",
    summary: "管家发起了一次可被宠物自主回应的关系接近机会。",
    intensity: safeWarmth,
    payload: {
      socialWarmth: safeWarmth,
    },
  }
}

function removeExpiredOpportunities(
  opportunities: ButlerOpportunity[],
  tick: number
): ButlerOpportunity[] {
  return opportunities.filter((item) => item.expiresAtTick >= tick)
}

function hasPendingOpportunity(
  opportunities: ButlerOpportunity[],
  type: ButlerOpportunityType
): boolean {
  return opportunities.some((item) => item.type === type)
}

function petExistsAndBorn(pet: PetState | null): boolean {
  return !!pet
}

function isIncubatorCompleted(incubator: IncubatorState | null): boolean {
  if (!incubator) return true
  return incubator.progress >= 100 || incubator.status === "hatched"
}

function shouldOfferFood(pet: PetState | null, profile?: FinalPersonalityProfile | null): boolean {
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

function chooseButlerTask(
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

function deriveButlerMood(task: ButlerTask): ButlerMood {
  switch (task) {
    case "watching_incubator":
      return "focused"
    case "building_home":
      return "busy"
    case "offering_food":
      return "gentle"
    case "offering_rest":
      return "gentle"
    case "offering_approach":
      return "calm"
    case "watching_pet":
      return "calm"
    case "idle":
    default:
      return "calm"
  }
}

export class ButlerSystem {
  private state: ButlerState = {
    name: "管家",
    task: "idle",
    mood: "calm",
    lastTaskChangedTick: 0,
    pendingOpportunities: [],
    finalPersonalityProfile: null,
  }

  update(input: ButlerSystemInput): ButlerState {
    const butlerPolicy = getEntityAutonomyPolicy("butler")
    const foodRule = getOpportunityRule("food_offer")
    const restRule = getOpportunityRule("rest_offer")
    const approachRule = getOpportunityRule("approach_offer")

    this.state.finalPersonalityProfile =
      input.butlerPersonalityProfile ?? input.pet?.finalPersonalityProfile ?? null

    this.state.pendingOpportunities = removeExpiredOpportunities(
      this.state.pendingOpportunities,
      input.tick
    )

    const nextTask = chooseButlerTask(input, this.state)

    if (nextTask !== this.state.task) {
      this.state.task = nextTask
      this.state.lastTaskChangedTick = input.tick
    }

    this.state.mood = deriveButlerMood(this.state.task)

    if (!butlerPolicy?.ownsFinalDecision) {
      return this.state
    }

    const bias = this.state.finalPersonalityProfile?.bias.butlerBehaviorBias

    const carePriority = bias?.carePriority ?? 50
    const responseSpeed = bias?.responseSpeed ?? 50

    if (
      this.state.task === "offering_food" &&
      foodRule &&
      foodRule.requiresSelfAcceptance &&
      !hasPendingOpportunity(this.state.pendingOpportunities, "food_offer")
    ) {
      this.state.pendingOpportunities.push(
        createFoodOffer(
          input.tick,
          18 + (carePriority - 50) * 0.18
        )
      )
    }

    if (
      this.state.task === "offering_rest" &&
      restRule &&
      restRule.requiresSelfAcceptance &&
      !hasPendingOpportunity(this.state.pendingOpportunities, "rest_offer")
    ) {
      this.state.pendingOpportunities.push(
        createRestOffer(
          input.tick,
          16 + (carePriority - 50) * 0.16
        )
      )
    }

    if (
      this.state.task === "offering_approach" &&
      approachRule &&
      approachRule.requiresSelfAcceptance &&
      !hasPendingOpportunity(this.state.pendingOpportunities, "approach_offer")
    ) {
      this.state.pendingOpportunities.push(
        createApproachOffer(
          input.tick,
          12 + (responseSpeed - 50) * 0.14
        )
      )
    }

    return this.state
  }

  getState(): ButlerState {
    return this.state
  }

  getButler(): ButlerState {
    return this.state
  }

  getPendingOpportunities(): ButlerOpportunity[] {
    return this.state.pendingOpportunities
  }

  consumeOpportunity(opportunityId: string) {
    this.state.pendingOpportunities = this.state.pendingOpportunities.filter(
      (item) => item.id !== opportunityId
    )
  }

  clearAllOpportunities() {
    this.state.pendingOpportunities = []
  }
}

export const butlerSystem = new ButlerSystem()
export default butlerSystem