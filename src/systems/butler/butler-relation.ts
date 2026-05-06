/**
 * 当前文件负责：定义与维护管家和宠物之间的长期关系状态。
 */

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

export type ButlerRelationState = {
  familiarity: number
  trustEstimate: number
  careHistory: number
  observationCount: number
  successfulOffers: number
  rejectedOffers: number
  lastInteractionTick: number | null
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

function deriveRelationTone(input: {
  familiarity: number
  trustEstimate: number
  rejectedOffers: number
}): ButlerRelationTone {
  if (input.rejectedOffers >= 5 && input.trustEstimate < 35) {
    return "guarded"
  }

  if (input.trustEstimate >= 72 && input.familiarity >= 55) {
    return "trusted"
  }

  if (input.familiarity >= 35) {
    return "familiar"
  }

  if (input.familiarity > 0) {
    return "observing"
  }

  return "unfamiliar"
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

  return uniqueTags(tags).slice(0, 28)
}

function deriveRelationDelta(input: {
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

    return {
      familiarity: 1,
      trustEstimate: 0,
      careHistory: 0,
      observationCount: 1,
      successfulOffers: 0,
      rejectedOffers: 0,
    }
  }

  if (task === "offering_food") {
    return {
      familiarity: 2,
      trustEstimate: 1,
      careHistory: 1,
      observationCount: 0,
      successfulOffers: 0,
      rejectedOffers: 0,
    }
  }

  if (task === "offering_rest") {
    return {
      familiarity: 2,
      trustEstimate: 1,
      careHistory: 1,
      observationCount: 0,
      successfulOffers: 0,
      rejectedOffers: 0,
    }
  }

  if (task === "offering_approach") {
    return {
      familiarity: 2,
      trustEstimate: 0,
      careHistory: 1,
      observationCount: 0,
      successfulOffers: 0,
      rejectedOffers: 0,
    }
  }

  if (task === "building_home") {
    return {
      familiarity: input.trace.context.hasTimelineSnapshot ? 1 : 0,
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

  const nextBase = {
    familiarity: clampRelationValue(
      input.relation.familiarity + delta.familiarity
    ),
    trustEstimate: clampRelationValue(
      input.relation.trustEstimate + delta.trustEstimate
    ),
    careHistory: input.relation.careHistory + delta.careHistory,
    observationCount:
      input.relation.observationCount + delta.observationCount,
    successfulOffers:
      input.relation.successfulOffers + delta.successfulOffers,
    rejectedOffers:
      input.relation.rejectedOffers + delta.rejectedOffers,
    lastInteractionTick: shouldTouchInteraction
      ? input.tick
      : input.relation.lastInteractionTick,
  }

  const tone = deriveRelationTone({
    familiarity: nextBase.familiarity,
    trustEstimate: nextBase.trustEstimate,
    rejectedOffers: nextBase.rejectedOffers,
  })

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