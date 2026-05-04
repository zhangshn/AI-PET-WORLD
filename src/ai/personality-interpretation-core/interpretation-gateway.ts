/**
 * 当前文件负责：提供人格解释核心的统一出口。
 */

import {
  buildGenderPerspectiveComparison,
  buildPersonalityInterpretationProfileInternal,
} from "./gender-comparison-mapper"

import {
  buildGenderAwareBehaviorBias,
} from "./interpretation-bias-mapper"

import type {
  BuildGenderAwareBehaviorBiasInput,
  BuildGenderPerspectiveComparisonInput,
  BuildPersonalityInterpretationInput,
  GenderAwareBehaviorBias,
  GenderPerspectiveComparison,
  PersonalityInterpretationProfile,
} from "./interpretation-schema"

export function buildPersonalityInterpretationProfile(
  input: BuildPersonalityInterpretationInput
): PersonalityInterpretationProfile {
  return buildPersonalityInterpretationProfileInternal(input)
}

export function buildPersonalityGenderComparison(
  input: BuildGenderPerspectiveComparisonInput
): GenderPerspectiveComparison {
  return buildGenderPerspectiveComparison(input)
}

export function buildPersonalityInterpretationBehaviorBias(
  input: BuildGenderAwareBehaviorBiasInput
): GenderAwareBehaviorBias {
  return buildGenderAwareBehaviorBias(input)
}

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
} from "./interpretation-schema"