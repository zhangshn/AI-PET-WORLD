/**
 * Current AI entry for the active AI-PET-WORLD business line.
 *
 * This gateway only exposes the current butler/world creation capabilities.
 * Legacy actor timeline, behavior, memory, and event exports were removed
 * with the old runtime line.
 */

import type { PersonalityProfile } from "./destiny-core/ziwei-core/ziwei-core-schema"
import type { PublicPersonalityView } from "./destiny-core/ziwei-core/public-view"
import { buildPublicPersonalityView } from "./destiny-core/ziwei-core/public-view"

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
  entityOwnsFinalDecision,
  getEntityAutonomyPolicy,
  getOpportunityRule,
  getWorldAutonomyRuleset,
  opportunityCanDirectlyResolveOutcome,
  opportunityRequiresSelfAcceptance,
} from "./consciousness-core/autonomy-core/autonomy-gateway"

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

export function buildPublicPersonality(
  profile: PersonalityProfile
): PublicPersonalityView {
  return buildPublicPersonalityView(profile)
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
  entityOwnsFinalDecision,
  getEntityAutonomyPolicy,
  getOpportunityRule,
  getWorldAutonomyRuleset,
  opportunityCanDirectlyResolveOutcome,
  opportunityRequiresSelfAcceptance,
}

export { buildLifePersonalityProfile } from "./personality-core/life-profile-core/life-profile-gateway"

export type {
  BirthInput,
  PersonalityProfile,
} from "./destiny-core/ziwei-core/ziwei-core-schema"

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
  AutonomousBehaviorChainRule,
  AutonomousEntityType,
  AutonomyConstraint,
  AutonomyConstraintCode,
  AutonomyDecisionStage,
  BehaviorOpportunityType,
  EntityAutonomyPolicy,
  OpportunityRule,
  WorldAutonomyRuleset,
} from "./consciousness-core/autonomy-core/autonomy-gateway"

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

export { buildButlerProfile } from "./personality-core/butler-profile-core/butler-profile-gateway"

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
