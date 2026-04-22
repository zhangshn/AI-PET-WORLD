/**
 * ======================================================
 * AI-PET-WORLD
 * AI Gateway
 * ======================================================
 */

import type {
  BirthInput,
  PersonalityProfile,
} from "./personality-core/schema"

import {
  buildPersonalityProfile,
} from "./personality-core/personality-gateway"

import type {
  PublicPersonalityView,
} from "./personality-core/mapper"

import {
  buildPublicPersonalityView,
} from "./personality-core/mapper"

import type {
  PetTimelineSnapshot,
  TimelineBehaviorShiftInput,
} from "./timeline-system/timeline-gateway"

import {
  buildPetTimelineSnapshot,
  updatePetTimelineSnapshot,
} from "./timeline-system/timeline-gateway"

import type {
  StateUpdateEvent,
  PlayerRelationInput,
} from "./timeline-system/state/state-updater"

import type {
  PetEventStyleInput,
} from "./event-style/schema"

import {
  buildPetEventMessage,
} from "./event-style/event-gateway"

import type {
  ZiweiConsciousnessKernel,
} from "./consciousness/consciousness-gateway"

import {
  buildConsciousnessFromPersonality,
} from "./consciousness/consciousness-gateway"

import type {
  PetMemoryState,
} from "./memory-core/memory-gateway"

import {
  buildInitialPetMemoryState,
} from "./memory-core/memory-gateway"

export type PetBirthAiBundle = {
  personalityProfile: PersonalityProfile
  publicPersonalityView: PublicPersonalityView
  consciousnessProfile: ZiweiConsciousnessKernel
  memoryState: PetMemoryState
  timelineSnapshot: PetTimelineSnapshot
}

export type UpdatePetAiStateInput = {
  currentSnapshot: PetTimelineSnapshot
  time: {
    day: number
    hour: number
    period?: string
  }
  events?: StateUpdateEvent[]
  behaviorShift?: TimelineBehaviorShiftInput
  tickDelta?: number
  shouldRefreshTrajectory?: boolean
  playerRelation?: PlayerRelationInput
}

export function buildPetBirthBundle(input: {
  birthInput: BirthInput
  time: {
    day: number
    hour: number
    period?: string
  }
}): PetBirthAiBundle {
  const personalityProfile = buildPersonalityProfile(input.birthInput)

  const publicPersonalityView =
    buildPublicPersonalityView(personalityProfile)

  const consciousnessProfile =
    buildConsciousnessFromPersonality(personalityProfile)

  const memoryState = buildInitialPetMemoryState()

  const timelineSnapshot = buildPetTimelineSnapshot({
    day: input.time.day,
    hour: input.time.hour,
    period: input.time.period,
  })

  return {
    personalityProfile,
    publicPersonalityView,
    consciousnessProfile,
    memoryState,
    timelineSnapshot,
  }
}

export function updatePetAiState(
  input: UpdatePetAiStateInput
): PetTimelineSnapshot {
  return updatePetTimelineSnapshot({
    currentSnapshot: input.currentSnapshot,
    day: input.time.day,
    hour: input.time.hour,
    period: input.time.period,
    events: input.events,
    behaviorShift: input.behaviorShift,
    tickDelta: input.tickDelta,
    shouldRefreshTrajectory: input.shouldRefreshTrajectory,
    playerRelation: input.playerRelation,
  })
}

export function buildPublicPersonality(
  profile: PersonalityProfile
): PublicPersonalityView {
  return buildPublicPersonalityView(profile)
}

export function buildPetEvent(
  input: PetEventStyleInput
): string {
  return buildPetEventMessage(input)
}

export type {
  BirthInput,
  PersonalityProfile,
} from "./personality-core/schema"

export type {
  PublicPersonalityView,
} from "./personality-core/mapper"

export type {
  PetTimelineSnapshot,
  TimelineBehaviorShiftInput,
} from "./timeline-system/timeline-gateway"

export type {
  StateUpdateEvent,
  PlayerRelationInput,
} from "./timeline-system/state/state-updater"

export type {
  PetEventStyleInput,
} from "./event-style/schema"

export type {
  ZiweiConsciousnessKernel,
  ConsciousnessArchetype,
  ConsciousnessBias,
  ConsciousnessCoreDrive,
} from "./consciousness/consciousness-gateway"

export type {
  PetMemoryState,
  MemoryActionRecord,
  MemoryEventKind,
  MemoryEventRecord,
  MemoryPreferenceBias,
  MemoryRelationImpression,
  MemorySelfImpression,
  MemoryWorldImpression,
  UpdateMemoryInput,
} from "./memory-core/memory-gateway"