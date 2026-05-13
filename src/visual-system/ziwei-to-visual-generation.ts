/**
 * 当前文件负责：串联紫微概率、喜好画像和视觉生成结果。
 */

import {
  buildPreferenceProfileFromZiweiProbability,
} from "../preference-system/ziwei-preference-mapper"
import type {
  PreferenceProfile,
} from "../preference-system/preference.types"
import type {
  ZiweiProbabilityProfile,
} from "../ziwei-probability/ziwei-probability.types"
import {
  buildVisualDNAFromPreferenceProfile,
} from "./preference-to-visual-dna"
import {
  buildVisualGenerationResult,
} from "./visual-variant-mapper"
import type {
  VisualGenerationResult,
} from "./visual-dna.types"

export type ZiweiDrivenVisualGenerationResult = {
  probabilityProfile: ZiweiProbabilityProfile
  preferenceProfile: PreferenceProfile
  visualGenerationResult: VisualGenerationResult
}

export function buildVisualGenerationResultFromZiweiProbability(
  probabilityProfile: ZiweiProbabilityProfile
): VisualGenerationResult {
  const preferenceProfile = buildPreferenceProfileFromZiweiProbability(
    probabilityProfile
  )
  const visualDNA = buildVisualDNAFromPreferenceProfile(preferenceProfile)

  return buildVisualGenerationResult(visualDNA)
}

export function buildZiweiDrivenVisualGenerationResult(
  probabilityProfile: ZiweiProbabilityProfile
): ZiweiDrivenVisualGenerationResult {
  const preferenceProfile = buildPreferenceProfileFromZiweiProbability(
    probabilityProfile
  )
  const visualDNA = buildVisualDNAFromPreferenceProfile(preferenceProfile)
  const visualGenerationResult = buildVisualGenerationResult(visualDNA)

  return {
    probabilityProfile,
    preferenceProfile,
    visualGenerationResult,
  }
}
