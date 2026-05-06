/**
 * 当前文件负责：定义与维护管家和宠物之间的长期关系状态。
 */

import type {
  ButlerOpportunityType,
} from "./butler-schema"
import type { ButlerMemoryEntry } from "./butler-memory"
import type {
  ButlerTaskDecisionTrace,
} from "./butler-task-decision-trace"

export type ButlerRelationTone =
  | "unfamiliar"
  | "observing"
  | "familiar"
  | "trusted"
  | "guarded"

export type ButlerOpportunityFeedback = {
  tick: number
  type: ButlerOpportunityType
  accepted: boolean
  expired?: boolean
  reason?: string
  value?: number
}

export type ButlerRelationState = {
  familiarity: number
  trustEstimate: number
  careHistory: number
  observationCount: number
  successfulOffers: number
  rejectedOffers: number
  lastInteractionTick: number | null
  latestOpportunityFeedback: ButlerOpportunityFeedback | null
  tone: ButlerRelationTone
  tags: string[]
}

export function createInitialButlerRelationState(): ButlerRelationState {
  return {
    familiarity: 0,
    trustEstimate: 0,
    careHistory: 0,
    observationCount: 0,
    successfulOffers: 0,
    rejectedOffers: 0,
    lastInteractionTick: null,
    latestOpportunityFeedback: null,
    tone: "unfamiliar",
    tags: [],
  }
}

function clampRelationValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}

function getObservationFamiliaritySoftCap(relation: ButlerRelationState): number {
  if (relation.successfulOffers >= 8 && relation.trustEstimate >= 45) {
    return 52
  }

  if (relation.successfulOffers >= 4 && relation.trustEstimate >= 28) {
    return 42
  }

  if (relation.successfulOffers >= 1 && relation.trustEstimate >= 12) {
    return 32
  }

  return 24
}

function applyFamiliaritySoftCap(input: {
  current: number
  delta: number
  softCap: number
  hardCap?: number
}): number {
  const hardCap = input.hardCap ?? 100

  if (input.delta <= 0) {
    return clampRelationValue(input.current + input.delta)
  }

  if (input.current >= input.softCap) {
    return clampRelationValue(
      input.current + Math.min(1, input.delta * 0.25)
    )
  }

  const next = input.current + input.delta

  if (next <= input.softCap) {
    return clampRelationValue(next)
  }

  const overflow = next - input.softCap

  return clampRelationValue(
    Math.min(hardCap, input.softCap + overflow * 0.35)
  )
}

function applyTrustSoftCap(input: {
  current: number
  delta: number
  successfulOffers: number
  rejectedOffers: number
}): number {
  if (input.delta <= 0) {
    return clampRelationValue(input.current + input.delta)
  }

  const successCap =
    12 +
    input.successfulOffers * 6 -
    input.rejectedOffers * 2

  const softCap = Math.max(10, Math.min(80, successCap))

  if (input.current >= softCap) {
    return clampRelationValue(
      input.current + Math.min(1, input.delta * 0.25)
    )
  }

  const next = input.current + input.delta

  if (next <= softCap) {
    return clampRelationValue(next)
  }

  const overflow = next - softCap

  return clampRelationValue(softCap + overflow * 0.35)
}

function deriveRelationTone(input: {
  familiarity: number
  trustEstimate: number
  successfulOffers: number
  rejectedOffers: number
}): ButlerRelationTone {
  if (input.rejectedOffers >= 5 && input.trustEstimate < 35) {
    return "guarded"
  }

  if (
    input.trustEstimate >= 72 &&
    input.familiarity >= 58 &&
    input.successfulOffers >= 8
  ) {
    return "trusted"
  }

  if (
    input.familiarity >= 38 &&
    input.trustEstimate >= 18 &&
    input.successfulOffers >= 2
  ) {
    return "familiar"
  }

  if (input.familiarity > 0 || input.trustEstimate > 0) {
    return "observing"
  }

  return "unfamiliar"
}

function rebuildRelationTone(
  relation: Omit<ButlerRelationState, "tone" | "tags">
): ButlerRelationTone {
  return deriveRelationTone({
    familiarity: relation.familiarity,
    trustEstimate: relation.trustEstimate,
    successfulOffers: relation.successfulOffers,
    rejectedOffers: relation.rejectedOffers,
  })
}

function isObservationGrowthMilestone(
  memoryEntry: ButlerMemoryEntry | null
): boolean {
  if (!memoryEntry) return true
  if (memoryEntry.type !== "observation") return true

  return (
    memoryEntry.repeatCount === 1 ||
    memoryEntry.repeatCount === 3 ||
    memoryEntry.repeatCount === 6 ||
    memoryEntry.repeatCount === 10 ||
    memoryEntry.repeatCount === 15 ||
    memoryEntry.repeatCount === 20 ||
    memoryEntry.repeatCount % 10 === 0
  )
}

function buildRelationTags(input: {
  relation: ButlerRelationState
  trace: ButlerTaskDecisionTrace
  memoryEntry: ButlerMemoryEntry | null
}): string[] {
  const tags = [
    ...input.relation.tags,
    `relation_tone_${input.relation.tone}`,
    `task_${input.trace.selectedTask}`,
    input.trace.context.hasPet ? "has_pet" : "no_pet",
    input.trace.context.hasTimelineSnapshot ? "has_timeline" : "no_timeline",
  ]

  if (input.trace.context.petLifePhase) {
    tags.push(`life_phase_${input.trace.context.petLifePhase}`)
  }

  if (input.memoryEntry) {
    tags.push(`memory_${input.memoryEntry.type}`)
    tags.push(`memory_repeat_${input.memoryEntry.repeatCount}`)
  }

  if (input.relation.latestOpportunityFeedback) {
    tags.push(`latest_feedback_${input.relation.latestOpportunityFeedback.type}`)
    tags.push(
      input.relation.latestOpportunityFeedback.accepted
        ? "latest_feedback_accepted"
        : "latest_feedback_rejected"
    )
  }

  tags.push(
    `observation_soft_cap_${getObservationFamiliaritySoftCap(input.relation)}`
  )

  return uniqueTags(tags).slice(0, 36)
}

function buildOpportunityFeedbackTags(input: {
  relation: ButlerRelationState
  feedback: ButlerOpportunityFeedback
}): string[] {
  const tags = [
    ...input.relation.tags,
    `relation_tone_${input.relation.tone}`,
    `opportunity_${input.feedback.type}`,
    input.feedback.accepted
      ? "opportunity_accepted"
      : "opportunity_rejected",
  ]

  if (input.feedback.expired) {
    tags.push("opportunity_expired")
  }

  if (input.feedback.value !== undefined) {
    tags.push("opportunity_has_value")
  }

  if (input.feedback.reason) {
    tags.push("opportunity_has_reason")
  }

  tags.push(
    `observation_soft_cap_${getObservationFamiliaritySoftCap(input.relation)}`
  )

  return uniqueTags(tags).slice(0, 36)
}

function deriveRelationDelta(input: {
  relation: ButlerRelationState
  trace: ButlerTaskDecisionTrace
  memoryEntry: ButlerMemoryEntry | null
}) {
  const task = input.trace.selectedTask

  if (!input.trace.context.hasPet) {
    return {
      familiarity: 0,
      trustEstimate: 0,
      careHistory: 0,
      observationCount: 0,
      successfulOffers: 0,
      rejectedOffers: 0,
    }
  }

  if (task === "watching_pet") {
    if (!isObservationGrowthMilestone(input.memoryEntry)) {
      return {
        familiarity: 0,
        trustEstimate: 0,
        careHistory: 0,
        observationCount: 0,
        successfulOffers: 0,
        rejectedOffers: 0,
      }
    }

    const softCap = getObservationFamiliaritySoftCap(input.relation)
    const canGainFamiliarity = input.relation.familiarity < softCap + 8

    return {
      familiarity: canGainFamiliarity ? 1 : 0,
      trustEstimate: 0,
      careHistory: 0,
      observationCount: 1,
      successfulOffers: 0,
      rejectedOffers: 0,
    }
  }

  if (task === "offering_food") {
    return {
      familiarity: 1,
      trustEstimate: 0,
      careHistory: 1,
      observationCount: 0,
      successfulOffers: 0,
      rejectedOffers: 0,
    }
  }

  if (task === "offering_rest") {
    return {
      familiarity: 1,
      trustEstimate: 0,
      careHistory: 1,
      observationCount: 0,
      successfulOffers: 0,
      rejectedOffers: 0,
    }
  }

  if (task === "offering_approach") {
    return {
      familiarity: 1,
      trustEstimate: 0,
      careHistory: 1,
      observationCount: 0,
      successfulOffers: 0,
      rejectedOffers: 0,
    }
  }

  if (task === "building_home") {
    return {
      familiarity:
        input.trace.context.hasTimelineSnapshot &&
        input.relation.familiarity < 20
          ? 1
          : 0,
      trustEstimate: 0,
      careHistory: 0,
      observationCount: 0,
      successfulOffers: 0,
      rejectedOffers: 0,
    }
  }

  return {
    familiarity: 0,
    trustEstimate: 0,
    careHistory: 0,
    observationCount: 0,
    successfulOffers: 0,
    rejectedOffers: 0,
  }
}

function deriveOpportunityFeedbackDelta(
  feedback: ButlerOpportunityFeedback
) {
  if (feedback.accepted) {
    if (feedback.type === "food_offer") {
      return {
        familiarity: 2,
        trustEstimate: 3,
        careHistory: 1,
        successfulOffers: 1,
        rejectedOffers: 0,
      }
    }

    if (feedback.type === "rest_offer") {
      return {
        familiarity: 2,
        trustEstimate: 2,
        careHistory: 1,
        successfulOffers: 1,
        rejectedOffers: 0,
      }
    }

    return {
      familiarity: 3,
      trustEstimate: 4,
      careHistory: 1,
      successfulOffers: 1,
      rejectedOffers: 0,
    }
  }

  if (feedback.expired) {
    return {
      familiarity: 0,
      trustEstimate: -1,
      careHistory: 0,
      successfulOffers: 0,
      rejectedOffers: 1,
    }
  }

  if (feedback.type === "approach_offer") {
    return {
      familiarity: 0,
      trustEstimate: -2,
      careHistory: 0,
      successfulOffers: 0,
      rejectedOffers: 1,
    }
  }

  return {
    familiarity: 0,
    trustEstimate: -1,
    careHistory: 0,
    successfulOffers: 0,
    rejectedOffers: 1,
  }
}

export function updateButlerRelationFromTaskDecision(input: {
  relation: ButlerRelationState
  trace: ButlerTaskDecisionTrace | null | undefined
  memoryEntry: ButlerMemoryEntry | null
  tick: number
}): ButlerRelationState {
  if (!input.trace) {
    return input.relation
  }

  const delta = deriveRelationDelta({
    relation: input.relation,
    trace: input.trace,
    memoryEntry: input.memoryEntry,
  })

  const shouldTouchInteraction =
    input.trace.context.hasPet &&
    (
      delta.familiarity > 0 ||
      delta.trustEstimate > 0 ||
      delta.careHistory > 0 ||
      delta.observationCount > 0
    )

  const nextSuccessfulOffers =
    input.relation.successfulOffers + delta.successfulOffers
  const nextRejectedOffers =
    input.relation.rejectedOffers + delta.rejectedOffers

  const nextBase = {
    familiarity: applyFamiliaritySoftCap({
      current: input.relation.familiarity,
      delta: delta.familiarity,
      softCap: getObservationFamiliaritySoftCap(input.relation),
    }),
    trustEstimate: applyTrustSoftCap({
      current: input.relation.trustEstimate,
      delta: delta.trustEstimate,
      successfulOffers: nextSuccessfulOffers,
      rejectedOffers: nextRejectedOffers,
    }),
    careHistory: input.relation.careHistory + delta.careHistory,
    observationCount:
      input.relation.observationCount + delta.observationCount,
    successfulOffers: nextSuccessfulOffers,
    rejectedOffers: nextRejectedOffers,
    lastInteractionTick: shouldTouchInteraction
      ? input.tick
      : input.relation.lastInteractionTick,
    latestOpportunityFeedback: input.relation.latestOpportunityFeedback,
  }

  const tone = rebuildRelationTone(nextBase)

  const nextRelation: ButlerRelationState = {
    ...nextBase,
    tone,
    tags: [],
  }

  return {
    ...nextRelation,
    tags: buildRelationTags({
      relation: nextRelation,
      trace: input.trace,
      memoryEntry: input.memoryEntry,
    }),
  }
}

export function updateButlerRelationFromOpportunityFeedback(input: {
  relation: ButlerRelationState
  feedback: ButlerOpportunityFeedback
}): ButlerRelationState {
  const delta = deriveOpportunityFeedbackDelta(input.feedback)
  const nextSuccessfulOffers =
    input.relation.successfulOffers + delta.successfulOffers
  const nextRejectedOffers =
    input.relation.rejectedOffers + delta.rejectedOffers

  const base = {
    familiarity: applyFamiliaritySoftCap({
      current: input.relation.familiarity,
      delta: delta.familiarity,
      softCap: getObservationFamiliaritySoftCap(input.relation),
    }),
    trustEstimate: applyTrustSoftCap({
      current: input.relation.trustEstimate,
      delta: delta.trustEstimate,
      successfulOffers: nextSuccessfulOffers,
      rejectedOffers: nextRejectedOffers,
    }),
    careHistory: input.relation.careHistory + delta.careHistory,
    observationCount: input.relation.observationCount,
    successfulOffers: nextSuccessfulOffers,
    rejectedOffers: nextRejectedOffers,
    lastInteractionTick: input.feedback.tick,
    latestOpportunityFeedback: input.feedback,
  }

  const tone = rebuildRelationTone(base)

  const nextRelation: ButlerRelationState = {
    ...base,
    tone,
    tags: [],
  }

  return {
    ...nextRelation,
    tags: buildOpportunityFeedbackTags({
      relation: nextRelation,
      feedback: input.feedback,
    }),
  }
}