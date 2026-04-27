/**
 * 当前文件负责：维护管家系统状态，并调度任务判断、机会生成与情绪推导。
 */

import {
  getEntityAutonomyPolicy,
  getOpportunityRule,
} from "../ai/autonomy-core/autonomy-gateway"

import {
  chooseButlerTask,
  createApproachOffer,
  createFoodOffer,
  createRestOffer,
  deriveButlerMood,
  hasPendingOpportunity,
  removeExpiredOpportunities,
  type ButlerOpportunity,
  type ButlerState,
  type ButlerSystemInput,
} from "./butler/butler-gateway"

export type {
  ButlerMood,
  ButlerOpportunity,
  ButlerOpportunityType,
  ButlerState,
  ButlerSystemInput,
  ButlerTask,
} from "./butler/butler-gateway"

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
        createFoodOffer(input.tick, 18 + (carePriority - 50) * 0.18)
      )
    }

    if (
      this.state.task === "offering_rest" &&
      restRule &&
      restRule.requiresSelfAcceptance &&
      !hasPendingOpportunity(this.state.pendingOpportunities, "rest_offer")
    ) {
      this.state.pendingOpportunities.push(
        createRestOffer(input.tick, 16 + (carePriority - 50) * 0.16)
      )
    }

    if (
      this.state.task === "offering_approach" &&
      approachRule &&
      approachRule.requiresSelfAcceptance &&
      !hasPendingOpportunity(this.state.pendingOpportunities, "approach_offer")
    ) {
      this.state.pendingOpportunities.push(
        createApproachOffer(input.tick, 12 + (responseSpeed - 50) * 0.14)
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