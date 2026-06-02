/**
 * 当前文件负责：作为 AI-PET-WORLD 全部 AI 子系统统一总入口。
 */

import type { PersonalityProfile } from "./destiny-core/ziwei-core/ziwei-core-schema"

import type { PublicPersonalityView } from "./destiny-core/ziwei-core/public-view"
import { buildPublicPersonalityView } from "./destiny-core/ziwei-core/public-view"

import type {
  PetTimelineSnapshot,
  TimelineBehaviorShiftInput,
} from "./timeline-system/timeline-gateway"
import {
  updatePetTimelineSnapshot,
} from "./timeline-system/timeline-gateway"

import type {
  StateUpdateEvent,
  PlayerRelationInput,
} from "./timeline-system/state/state-updater"

import type { PetEventStyleInput } from "./event-style/event-style-schema"
import { buildPetEventMessage } from "./event-style/ai-event-style-gateway"

import type {
  BuildGenderPerspectiveComparisonInput,
  BuildPersonalityInterpretationInput,
  GenderPerspectiveComparison,
  PersonalityInterpretationProfile,
} from "./personality-core/personality-interpretation-core/interpretation-gateway"
import {
  buildPersonalityGenderComparison,
  buildPersonalityInterpretationProfile,
} from "./personality-core/personality-interpretation-core/interpretation-gateway"

import {
  getWorldAutonomyRuleset,
  getEntityAutonomyPolicy,
  getOpportunityRule,
  entityOwnsFinalDecision,
  opportunityRequiresSelfAcceptance,
  opportunityCanDirectlyResolveOutcome,
} from "./consciousness-core/autonomy-core/autonomy-gateway"

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

import type {
  BuildCurrentLifeRuntimeBundleFromWorldInput,
  BuildCurrentLifeTendencyFromRuntimeInput,
  CurrentLifeRuntimeBundle,
  CurrentLifeTendencyProfile,
  LifeTendencyRuntimeTime,
} from "./life-tendency-core/life-tendency-gateway"

import {
  buildCurrentLifeRuntimeBundle,
  buildCurrentLifeRuntimeBundleFromWorld,
  buildCurrentLifeTendencyFromRuntime,
  buildLifeRuntimeTimeFromWorld,
} from "./life-tendency-core/life-tendency-gateway"

import type {
  ButlerAutonomyInput,
  ButlerAutonomyResult,
} from "./butler-autonomy/butler-autonomy-schema"
import { buildButlerAutonomyResult } from "./butler-autonomy/butler-autonomy-gateway"

export function buildAiCurrentLifeRuntimeBundle(
  input: BuildCurrentLifeTendencyFromRuntimeInput
): CurrentLifeRuntimeBundle {
  return buildCurrentLifeRuntimeBundle(input)
}

export function buildAiLifeRuntimeTimeFromWorld(
  input: Parameters<typeof buildLifeRuntimeTimeFromWorld>[0]
): LifeTendencyRuntimeTime {
  return buildLifeRuntimeTimeFromWorld(input)
}

export function buildAiCurrentLifeRuntimeBundleFromWorld(
  input: BuildCurrentLifeRuntimeBundleFromWorldInput
): CurrentLifeRuntimeBundle {
  return buildCurrentLifeRuntimeBundleFromWorld(input)
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

export function buildAiPersonalityInterpretation(
  input: BuildPersonalityInterpretationInput
): PersonalityInterpretationProfile {
  return buildPersonalityInterpretationProfile(input)
}

export function buildAiPersonalityGenderComparison(
  input: BuildGenderPerspectiveComparisonInput
): GenderPerspectiveComparison {
  return buildPersonalityGenderComparison(input)
}

export function buildAiCurrentLifeTendency(
  input: BuildCurrentLifeTendencyFromRuntimeInput
): CurrentLifeTendencyProfile {
  return buildCurrentLifeTendencyFromRuntime(input)
}

export function buildAiButlerAutonomy(
  input: ButlerAutonomyInput
): ButlerAutonomyResult {
  return buildButlerAutonomyResult(input)
}

export {
  getWorldAutonomyRuleset,
  getEntityAutonomyPolicy,
  getOpportunityRule,
  entityOwnsFinalDecision,
  opportunityRequiresSelfAcceptance,
  opportunityCanDirectlyResolveOutcome,
}

export {
  buildLifePersonalityProfile,
} from "./personality-core/life-profile-core/life-profile-gateway"

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

export type { BirthInput, PersonalityProfile } from "./destiny-core/ziwei-core/ziwei-core-schema"

export { buildPersonalityProfile } from "./destiny-core/ziwei-core/ziwei-gateway"

export type { PublicPersonalityView } from "./destiny-core/ziwei-core/public-view"

export type { BaziProfile } from "./destiny-core/bazi-core/bazi-gateway"

export type {
  BaziDynamicsSupportItem,
  BaziDynamicsSupportKey,
  BaziDynamicsSupportProfile,
  BaziGenderFunctionKey,
  BaziGenderFunctionProfile,
  BaziGenderFunctionResult,
  BuildGenderAwareBehaviorBiasInput,
  BuildGenderPerspectiveComparisonInput,
  BuildPersonalityInterpretationInput,
  FiveDimensionKey,
  FiveDimensionProfile,
  FiveDimensionResult,
  GenderAwareBehaviorBias,
  GenderLifeFunctionFocus,
  GenderPerspective,
  GenderPerspectiveComparison,
  GenderPerspectiveRule,
  PersonalityInterpretationMode,
  PersonalityInterpretationProfile,
  ScoreLevel,
  ZiweiLifeFunctionKey,
  ZiweiLifeFunctionProfile,
  ZiweiLifeFunctionResult,
  ZiweiLifeFunctionRule,
} from "./personality-core/personality-interpretation-core/interpretation-gateway"

export type {
  BuildLifePersonalityProfileInput,
  LifePersonalityProfileBundle,
  LifeProfileBirthInput,
  LifeProfileSubjectType,
} from "./personality-core/life-profile-core/life-profile-gateway"

export type {
  BuildCurrentLifeRuntimeBundleFromWorldInput,
  BuildCurrentLifeTendencyFromRuntimeInput,
  BuildLifeRuntimeTimeFromWorldInput,
  CurrentLifeRuntimeBundle,
  CurrentLifeTendencyProfile,
  LifeRuntimeWorldStartDate,
  LifeRuntimeWorldTimeInput,
  LifeTendencyFiveDimensionScores,
  LifeTendencyKey,
  LifeTendencyLabels,
  LifeTendencyLevel,
  LifeTendencyRuntimeGender,
  LifeTendencyRuntimeTime,
  LifeTendencyScoreInputs,
  LifeTendencyScoreItem,
  LifeTendencyScores,
  LifeTendencySourceProfile,
} from "./life-tendency-core/life-tendency-gateway"

export type {
  PetTimelineSnapshot,
  TimelineBehaviorShiftInput,
} from "./timeline-system/timeline-gateway"

export {
  buildPetTimelineSnapshot,
} from "./timeline-system/timeline-gateway"

export type {
  StateUpdateEvent,
  PlayerRelationInput,
} from "./timeline-system/state/state-updater"

export type { PetEventStyleInput } from "./event-style/event-style-schema"

export type {
  ZiweiConsciousnessKernel,
  ConsciousnessArchetype,
  ConsciousnessBias,
  ConsciousnessCoreDrive,
} from "./consciousness-core/consciousness/consciousness-gateway"

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
} from "./consciousness-core/autonomy-core/autonomy-gateway"

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

export {
  buildAgentCycleTrace,
  buildAgentExpression,
  buildAgentInterpretation,
  buildAgentIntention,
  buildAgentMemoryImpact,
  buildAgentPerception,
  buildAgentSignal,
} from "./consciousness-core/agent-core/agent-gateway"

export type {
  AgentCycleTrace,
  AgentExpression,
  AgentExpressionMode,
  AgentInterpretation,
  AgentInterpretationType,
  AgentIntention,
  AgentIntentionSource,
  AgentIntentionType,
  AgentMemoryImpact,
  AgentMemoryImpactType,
  AgentPerception,
  AgentPerceptionFocus,
  AgentSignal,
  AgentSignalCategory,
  AgentSignalPolarity,
  AgentSignalSource,
  AutonomousAgentId,
  AutonomousAgentKind,
} from "./consciousness-core/agent-core/agent-gateway"

export {
  buildButlerProfile,
} from "./personality-core/butler-profile-core/butler-profile-gateway"

export type {
  ButlerBirthTimeMode,
  ButlerBoundaryStyle,
  ButlerBuildStyle,
  ButlerCareStyle,
  ButlerMappingMode,
  ButlerOpportunityStyle,
  ButlerProfile,
  ButlerProfileBias,
  ButlerProfileBirthInput,
  ButlerProfileIdentity,
  ButlerProfileInput,
  ButlerProfileSource,
} from "./personality-core/butler-profile-core/butler-profile-gateway"

export type {
  ButlerAutonomousIntent,
  ButlerAutonomousIntentKind,
  ButlerAutonomyAudit,
  ButlerAutonomyAuditSeverity,
  ButlerAutonomyAuditWarning,
  ButlerAutonomyConsumer,
  ButlerAutonomyExplanation,
  ButlerAutonomyInput,
  ButlerAutonomyResult,
  ButlerConsciousFocus,
  ButlerConsciousState,
  ButlerEmotionalTone,
  ButlerExplanationTone,
  ButlerGoal,
  ButlerGoalKind,
  ButlerMemoryEffect,
  ButlerMemoryEmotionalMark,
  ButlerMemoryEvent,
  ButlerMemoryEventKind,
  ButlerMemoryLearnedPreferences,
  ButlerMemoryState,
  ButlerMotivation,
  ButlerMotivationKind,
  ButlerRhythmBias,
  ButlerSoulProfile,
  ButlerSoulSource,
  ButlerWorldPerception,
} from "./butler-autonomy/butler-autonomy-schema"
