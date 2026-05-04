/**
 * 当前文件负责：维护管家系统状态，并调度任务判断、机会生成与情绪推导。
 */

import {
  getEntityAutonomyPolicy,
  getOpportunityRule,
} from "../ai/autonomy-core/autonomy-gateway"

import {
  buildInitialOpportunityCooldowns,
  canCreateOpportunity,
  chooseButlerTask,
  createApproachOffer,
  createFoodOffer,
  createRestOffer,
  deriveButlerMood,
  hasPendingOpportunity,
  markOpportunityCreated,
  removeExpiredOpportunities,
  type ButlerOpportunity,
  type ButlerOpportunityType,
  type ButlerState,
  type ButlerSystemInput,
} from "./butler/butler-gateway"

export type {
  ButlerMood,
  ButlerOpportunity,
  ButlerOpportunityCooldowns,
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
    opportunityCooldowns: buildInitialOpportunityCooldowns(),
    behaviorBias: null,
  }

  update(input: ButlerSystemInput): ButlerState {
    const butlerPolicy = getEntityAutonomyPolicy("butler")
    const foodRule = getOpportunityRule("food_offer")
    const restRule = getOpportunityRule("rest_offer")
    const approachRule = getOpportunityRule("approach_offer")

    this.state.behaviorBias =
      input.butlerBehaviorBias ??
      input.pet?.lifeProfile.genderAwareBehaviorBias ??
      null

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

    const bias = this.state.behaviorBias?.butlerBehaviorBias
    const carePriority = bias?.carePriority ?? 50
    const responseSpeed = bias?.responseSpeed ?? 50

    this.tryCreateOpportunity({
      type: "food_offer",
      shouldCreate:
        this.state.task === "offering_food" &&
        !!foodRule &&
        foodRule.requiresSelfAcceptance,
      create: () =>
        createFoodOffer(input.tick, 18 + (carePriority - 50) * 0.18),
      tick: input.tick,
    })

    this.tryCreateOpportunity({
      type: "rest_offer",
      shouldCreate:
        this.state.task === "offering_rest" &&
        !!restRule &&
        restRule.requiresSelfAcceptance,
      create: () =>
        createRestOffer(input.tick, 16 + (carePriority - 50) * 0.16),
      tick: input.tick,
    })

    this.tryCreateOpportunity({
      type: "approach_offer",
      shouldCreate:
        this.state.task === "offering_approach" &&
        !!approachRule &&
        approachRule.requiresSelfAcceptance,
      create: () =>
        createApproachOffer(input.tick, 12 + (responseSpeed - 50) * 0.14),
      tick: input.tick,
    })

    return this.state
  }

  private tryCreateOpportunity(input: {
    type: ButlerOpportunityType
    shouldCreate: boolean
    create: () => ButlerOpportunity
    tick: number
  }) {
    if (!input.shouldCreate) return

    if (hasPendingOpportunity(this.state.pendingOpportunities, input.type)) {
      return
    }

    if (
      !canCreateOpportunity({
        type: input.type,
        tick: input.tick,
        cooldowns: this.state.opportunityCooldowns,
      })
    ) {
      return
    }

    this.state.pendingOpportunities.push(input.create())

    this.state.opportunityCooldowns = markOpportunityCreated({
      type: input.type,
      tick: input.tick,
      cooldowns: this.state.opportunityCooldowns,
    })
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