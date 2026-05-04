/**
 * 当前文件负责：提供人格解释核心的统一出口。
 */

import {
  buildGenderPerspectiveComparison,
  buildPersonalityInterpretationProfileInternal,
} from "./gender-comparison-mapper"

import type {
  BuildGenderPerspectiveComparisonInput,
  BuildPersonalityInterpretationInput,
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

export type {
  BaziDynamicsSupportItem,
  BaziDynamicsSupportKey,
  BaziDynamicsSupportProfile,
  BuildGenderPerspectiveComparisonInput,
  BuildPersonalityInterpretationInput,
  FiveDimensionKey,
  FiveDimensionProfile,
  FiveDimensionResult,
  GenderLifeFunctionFocus,
  GenderPerspective,
  GenderPerspectiveComparison,
  GenderPerspectiveRule,
  PersonalityInterpretationProfile,
  ScoreLevel,
  ZiweiLifeFunctionKey,
  ZiweiLifeFunctionProfile,
  ZiweiLifeFunctionResult,
  ZiweiLifeFunctionRule,
} from "./interpretation-schema"