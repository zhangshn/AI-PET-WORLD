/**
 * 当前文件负责：作为 AI-PET-WORLD 全部 AI 子系统统一总入口。
 */

import type { BirthInput, PersonalityProfile } from "./ziwei-core/schema"
import { buildPersonalityProfile } from "./ziwei-core/ziwei-gateway"

import type { PublicPersonalityView } from "./ziwei-core/mapper"
import { buildPublicPersonalityView } from "./ziwei-core/mapper"

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

import type { PetEventStyleInput } from "./event-style/schema"
import { buildPetEventMessage } from "./event-style/event-gateway"

import type { ZiweiConsciousnessKernel } from "./consciousness/consciousness-gateway"
import { buildConsciousnessFromPersonality } from "./consciousness/consciousness-gateway"

import type { PetMemoryState } from "./memory-core/memory-gateway"
import { buildInitialPetMemoryState } from "./memory-core/memory-gateway"

import type { BaziProfile } from "./bazi-core/bazi-types"
import { buildBaziProfile } from "./bazi-core/bazi-gateway"

import type { FinalPersonalityProfile } from "./personality-vector/vector-gateway"
import { buildFinalPersonalityProfile } from "./personality-vector/vector-gateway"

import {
  getWorldAutonomyRuleset,
  getEntityAutonomyPolicy,
  getOpportunityRule,
  entityOwnsFinalDecision,
  opportunityRequiresSelfAcceptance,
  opportunityCanDirectlyResolveOutcome,
} from "./autonomy-core/autonomy-gateway"

import type {
  WorldStimulusSystemState,
  BuildWorldStimuliInput,
} from "./world-stimulus-system/stimulus-gateway"
import { buildNextWorldStimulusState } from "./world-stimulus-system/stimulus-gateway"

import type {
  BuildCognitionInput,
  CognitionResult,
} from "./cognition-layer/cognition-gateway"
import { buildStimulusCognition } from "./cognition-layer/cognition-gateway"

import type {
  ActiveBehaviorProcess,
  BuildBehaviorProcessInput,
  StepBehaviorProcessInput,
  StepBehaviorProcessResult,
} from "./behavior-core/behavior-gateway"
import {
  buildBehaviorProcessFromCognition,
  stepBehaviorProcess,
} from "./behavior-core/behavior-gateway"

export type PetBirthAiBundle = {
  personalityProfile: PersonalityProfile
  publicPersonalityView: PublicPersonalityView
  baziProfile: BaziProfile
  finalPersonalityProfile: FinalPersonalityProfile
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
  const publicPersonalityView = buildPublicPersonalityView(personalityProfile)

  const baziProfile = buildBaziProfile({
    year: input.birthInput.year,
    month: input.birthInput.month,
    day: input.birthInput.day,
    hour: input.birthInput.hour,
    minute: input.birthInput.minute,
  })

  const finalPersonalityProfile = buildFinalPersonalityProfile({
    ziweiProfile: personalityProfile,
    baziProfile,
  })

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
    baziProfile,
    finalPersonalityProfile,
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

export function buildPetEvent(input: PetEventStyleInput): string {
  return buildPetEventMessage(input)
}

export {
  getWorldAutonomyRuleset,
  getEntityAutonomyPolicy,
  getOpportunityRule,
  entityOwnsFinalDecision,
  opportunityRequiresSelfAcceptance,
  opportunityCanDirectlyResolveOutcome,
}

export function buildWorldStimuli(
  input: BuildWorldStimuliInput
): WorldStimulusSystemState {
  return buildNextWorldStimulusState(input)
}

export function buildPetStimulusCognition(
  input: BuildCognitionInput
): CognitionResult {
  return buildStimulusCognition(input)
}

export function buildPetBehaviorProcess(
  input: BuildBehaviorProcessInput
): ActiveBehaviorProcess | null {
  return buildBehaviorProcessFromCognition(input)
}

export function stepPetBehaviorProcess(
  input: StepBehaviorProcessInput
): StepBehaviorProcessResult {
  return stepBehaviorProcess(input)
}

export type { BirthInput, PersonalityProfile } from "./ziwei-core/schema"

export type { PublicPersonalityView } from "./ziwei-core/mapper"

export type { BaziProfile } from "./bazi-core/bazi-types"

export type {
  FinalPersonalityProfile,
  FinalPersonalityVector,
  FinalPersonalityBias,
  PersonalitySourceMode,
} from "./personality-vector/vector-gateway"

export type {
  PetTimelineSnapshot,
  TimelineBehaviorShiftInput,
} from "./timeline-system/timeline-gateway"

export type {
  StateUpdateEvent,
  PlayerRelationInput,
} from "./timeline-system/state/state-updater"

export type { PetEventStyleInput } from "./event-style/schema"

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

export type {
  AutonomousEntityType,
  AutonomyConstraint,
  AutonomyConstraintCode,
  AutonomyDecisionStage,
  AutonomousBehaviorChainRule,
  BehaviorOpportunityType,
  EntityAutonomyPolicy,
  OpportunityRule,
  WorldAutonomyRuleset,
} from "./autonomy-core/autonomy-gateway"

export type {
  WorldStimulus,
  WorldStimulusCategory,
  WorldStimulusIntensity,
  WorldStimulusSystemState,
  WorldStimulusType,
  BuildWorldStimuliInput,
} from "./world-stimulus-system/stimulus-gateway"

export type {
  BuildCognitionInput,
  CognitionResult,
  StimulusInterpretation,
  StimulusReactionTendency,
} from "./cognition-layer/cognition-gateway"

export type {
  ActiveBehaviorProcess,
  BehaviorDelta,
  BehaviorProcessStage,
  BehaviorProcessType,
  BuildBehaviorProcessInput,
  StepBehaviorProcessInput,
  StepBehaviorProcessResult,
} from "./behavior-core/behavior-gateway"