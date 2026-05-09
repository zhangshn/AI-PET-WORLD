/**
 * 当前文件负责：维护管家系统状态，并调度任务判断、机会生成与情绪推导。
 */

import {
  getEntityAutonomyPolicy,
  getOpportunityRule,
} from "../ai/consciousness-core/autonomy-core/autonomy-gateway"

import type { ButlerProfile } from "../ai/gateway"

import {
  appendButlerMemoryEntry,
  buildButlerEducationStrategy,
  buildInitialOpportunityCooldowns,
  canCreateOpportunity,
  chooseButlerTask,
  createApproachOffer,
  createButlerMemoryEntry,
  createButlerMemoryEntryFromOpportunityFeedback,
  createButlerMemoryEntryFromTaskDecision,
  createFoodOffer,
  createInitialButlerMemoryState,
  createInitialButlerRelationState,
  createRestOffer,
  deriveButlerMood,
  hasPendingOpportunity,
  markOpportunityCreated,
  removeExpiredOpportunities,
  updateButlerRelationFromOpportunityFeedback,
  updateButlerRelationFromTaskDecision,
  type ButlerEducationStrategy,
  type ButlerMemoryState,
  type ButlerOpportunity,
  type ButlerOpportunityFeedback,
  type ButlerOpportunityType,
  type ButlerRelationState,
  type ButlerRelationTone,
  type ButlerState,
  type ButlerSystemInput,
} from "./butler/butler-gateway"

export type {
  ButlerMemoryEntry,
  ButlerMemoryState,
  ButlerMemoryType,
  ButlerMood,
  ButlerOpportunity,
  ButlerOpportunityCooldowns,
  ButlerOpportunityFeedback,
  ButlerOpportunityType,
  ButlerRelationState,
  ButlerRelationTone,
  ButlerState,
  ButlerSystemInput,
  ButlerTask,
} from "./butler/butler-gateway"

export type ButlerBoundaryInteractionFeedback = {
  tick: number
  petName: string
  petGoalType: string
  petAction: string
  butlerResponse: string
  reason: string
}

function clampRelationValue(value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(100, Math.round(value)))
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}

function deriveBoundaryRelationTone(input: {
  familiarity: number
  trustEstimate: number
  currentTone: ButlerRelationTone
}): ButlerRelationTone {
  if (input.trustEstimate >= 72 && input.familiarity >= 58) return "trusted"
  if (input.familiarity >= 38 && input.trustEstimate >= 18) return "familiar"
  if (input.familiarity > 0 || input.trustEstimate > 0) return "observing"

  return input.currentTone
}

export class ButlerSystem {
  private state: ButlerState = {
    name: "管家",
    task: "idle",
    mood: "calm",
    lastTaskChangedTick: 0,
    pendingOpportunities: [],
    opportunityCooldowns: buildInitialOpportunityCooldowns(),
    profile: null,
    behaviorBias: null,
    latestTaskDecisionTrace: null,
    memory: createInitialButlerMemoryState(),
    relation: createInitialButlerRelationState(),
  }

  update(input: ButlerSystemInput): ButlerState {
    const butlerPolicy = getEntityAutonomyPolicy("butler")
    const foodRule = getOpportunityRule("food_offer")
    const restRule = getOpportunityRule("rest_offer")
    const approachRule = getOpportunityRule("approach_offer")

    this.recordExpiredOpportunities(input.tick)

    this.state.behaviorBias =
      input.butlerBehaviorBias ??
      this.state.profile?.behaviorBias ??
      this.state.behaviorBias ??
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

    this.rememberLatestTaskDecision(input.tick)
    this.updateRelationFromLatestDecision(input.tick)

    if (!butlerPolicy?.ownsFinalDecision) {
      return this.state
    }

    const bias = this.state.behaviorBias?.butlerBehaviorBias
    const carePriority = bias?.carePriority ?? 50
    const responseSpeed = bias?.responseSpeed ?? 50

    const educationStrategy = buildButlerEducationStrategy(
      this.state.relation
    )

    this.tryCreateOpportunity({
      type: "food_offer",
      shouldCreate:
        this.state.task === "offering_food" &&
        !!foodRule &&
        foodRule.requiresSelfAcceptance,
      create: () =>
        createFoodOffer(
          input.tick,
          18 +
            (carePriority - 50) * 0.18 +
            educationStrategy.foodIntensityOffset
        ),
      tick: input.tick,
    })

    this.tryCreateOpportunity({
      type: "rest_offer",
      shouldCreate:
        this.state.task === "offering_rest" &&
        !!restRule &&
        restRule.requiresSelfAcceptance,
      create: () =>
        createRestOffer(
          input.tick,
          16 +
            (carePriority - 50) * 0.16 +
            educationStrategy.restIntensityOffset
        ),
      tick: input.tick,
    })

    this.tryCreateOpportunity({
      type: "approach_offer",
      shouldCreate:
        this.state.task === "offering_approach" &&
        !!approachRule &&
        approachRule.requiresSelfAcceptance,
      create: () =>
        createApproachOffer(
          input.tick,
          12 +
            (responseSpeed - 50) * 0.14 +
            educationStrategy.approachIntensityOffset
        ),
      tick: input.tick,
    })

    return this.state
  }

  private rememberLatestTaskDecision(tick: number) {
    const trace = this.state.latestTaskDecisionTrace

    if (!trace) return
    if (this.state.memory.latestEntry?.lastUpdatedTick === tick) return

    const entry = createButlerMemoryEntryFromTaskDecision({
      tick,
      trace,
    })

    this.state.memory = appendButlerMemoryEntry({
      memory: this.state.memory,
      entry,
      maxEntries: 80,
    })
  }

  private rememberOpportunityFeedback(feedback: ButlerOpportunityFeedback) {
    const entry = createButlerMemoryEntryFromOpportunityFeedback({
      feedback,
    })

    this.state.memory = appendButlerMemoryEntry({
      memory: this.state.memory,
      entry,
      maxEntries: 80,
    })
  }

  private updateRelationFromLatestDecision(tick: number) {
    this.state.relation = updateButlerRelationFromTaskDecision({
      relation: this.state.relation,
      trace: this.state.latestTaskDecisionTrace,
      memoryEntry: this.state.memory.latestEntry,
      tick,
    })
  }

  private recordExpiredOpportunities(tick: number) {
    const expiredOpportunities = this.state.pendingOpportunities.filter(
      (item) => item.expiresAtTick < tick
    )

    for (const opportunity of expiredOpportunities) {
      this.recordOpportunityFeedback({
        tick,
        type: opportunity.type,
        accepted: false,
        expired: true,
        reason: "机会在有效期内没有被宠物接受，按过期反馈记录。",
      })
    }
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

  recordOpportunityFeedback(feedback: ButlerOpportunityFeedback) {
    this.state.relation = updateButlerRelationFromOpportunityFeedback({
      relation: this.state.relation,
      feedback,
    })

    this.rememberOpportunityFeedback(feedback)
  }

  recordBoundaryInteraction(feedback: ButlerBoundaryInteractionFeedback) {
    const entry = createButlerMemoryEntry({
      tick: feedback.tick,
      type: "relation_signal",
      sourceTask: this.state.task,
      summary:
        `管家记录：${feedback.petName}出现边界/短程探索行为。` +
        `管家回应=${feedback.butlerResponse}。原因：${feedback.reason}`,
      emotionalWeight:
        feedback.butlerResponse === "companion_response"
          ? 66
          : feedback.butlerResponse === "protective_response"
            ? 78
            : 48,
      importance:
        feedback.petGoalType === "expand_territory" ? 72 : 64,
      tags: [
        "dual_agent_interaction",
        "boundary_interaction",
        `pet_goal_${feedback.petGoalType}`,
        `pet_action_${feedback.petAction}`,
        `butler_response_${feedback.butlerResponse}`,
        `butler_task_${this.state.task}`,
      ],
    })

    this.state.memory = appendButlerMemoryEntry({
      memory: this.state.memory,
      entry,
      maxEntries: 80,
    })

    const familiarityDelta =
      feedback.butlerResponse === "not_observed" ? 0 : 1
    const trustDelta =
      feedback.butlerResponse === "companion_response"
        ? 2
        : feedback.butlerResponse === "boundary_waiting"
          ? 1
          : feedback.butlerResponse === "protective_response"
            ? 1
            : 0
    const careDelta =
      feedback.butlerResponse === "companion_response" ||
      feedback.butlerResponse === "protective_response"
        ? 1
        : 0

    const nextFamiliarity = clampRelationValue(
      this.state.relation.familiarity + familiarityDelta
    )
    const nextTrustEstimate = clampRelationValue(
      this.state.relation.trustEstimate + trustDelta
    )

    this.state.relation = {
      ...this.state.relation,
      familiarity: nextFamiliarity,
      trustEstimate: nextTrustEstimate,
      careHistory: this.state.relation.careHistory + careDelta,
      observationCount: this.state.relation.observationCount + 1,
      lastInteractionTick: feedback.tick,
      tone: deriveBoundaryRelationTone({
        familiarity: nextFamiliarity,
        trustEstimate: nextTrustEstimate,
        currentTone: this.state.relation.tone,
      }),
      tags: uniqueTags([
        ...this.state.relation.tags,
        "dual_agent_interaction",
        "boundary_interaction",
        `pet_goal_${feedback.petGoalType}`,
        `butler_response_${feedback.butlerResponse}`,
      ]).slice(0, 36),
    }
  }

  restore(state: ButlerState): void {
    this.state = {
      ...state,
      pendingOpportunities: [...state.pendingOpportunities],
      opportunityCooldowns: { ...state.opportunityCooldowns },
      memory: {
        ...state.memory,
        entries: [...state.memory.entries],
        latestEntry: state.memory.latestEntry
          ? { ...state.memory.latestEntry }
          : null,
      },
      relation: { ...state.relation },
    }
  }

  setProfile(profile: ButlerProfile | null): void {
    this.state.profile = profile
    this.state.behaviorBias = profile?.behaviorBias ?? null
  }

  getProfile(): ButlerProfile | null {
    return this.state.profile ?? null
  }

  getMemory(): ButlerMemoryState {
    return this.state.memory
  }

  getRelation(): ButlerRelationState {
    return this.state.relation
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
