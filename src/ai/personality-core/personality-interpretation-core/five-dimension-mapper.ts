/**
 * 当前文件负责：把紫微生命功能与八字辅助动力映射为五维性格。
 */

import type {
  BaziDynamicsSupportKey,
  BaziDynamicsSupportProfile,
  FiveDimensionKey,
  FiveDimensionProfile,
  FiveDimensionResult,
  GenderPerspective,
  ZiweiLifeFunctionKey,
  ZiweiLifeFunctionProfile,
} from "./interpretation-schema"
import { FIVE_DIMENSION_ORDER, FIVE_DIMENSION_RULES } from "./five-dimension-rules"
import {
  averageInterpretationScores,
  getInterpretationScoreLevelLabel,
  resolveInterpretationScoreLevel,
  weightedInterpretationScore,
} from "./interpretation-utils"

function readLifeFunctionScore(input: {
  profile: ZiweiLifeFunctionProfile
  key: ZiweiLifeFunctionKey
}): number {
  return (
    input.profile.functions.find((item) => item.key === input.key)?.score ?? 50
  )
}

function readLifeFunctionFocus(input: {
  profile: ZiweiLifeFunctionProfile
  key: ZiweiLifeFunctionKey
}): string {
  return (
    input.profile.functions.find((item) => item.key === input.key)
      ?.genderFocus ?? ""
  )
}

function readBaziSupportScore(input: {
  profile: BaziDynamicsSupportProfile
  key: BaziDynamicsSupportKey
}): number {
  return input.profile.items.find((item) => item.key === input.key)?.score ?? 50
}

function buildGenderFocusText(input: {
  lifeFunctionProfile: ZiweiLifeFunctionProfile
  sourceFunctions: ZiweiLifeFunctionKey[]
}): string {
  return input.sourceFunctions
    .map((functionKey) =>
      readLifeFunctionFocus({
        profile: input.lifeFunctionProfile,
        key: functionKey,
      })
    )
    .filter(Boolean)
    .join("；")
}

function buildFiveDimensionSummary(input: {
  label: string
  score: number
  genderFocus: string
}): string {
  const level = resolveInterpretationScoreLevel(input.score)
  const levelLabel = getInterpretationScoreLevelLabel(level)

  return `${input.label}${levelLabel}。${input.genderFocus}`
}

function buildFiveDimensionResult(input: {
  dimensionKey: FiveDimensionKey
  lifeFunctionProfile: ZiweiLifeFunctionProfile
  baziSupportProfile: BaziDynamicsSupportProfile
}): FiveDimensionResult {
  const rule = FIVE_DIMENSION_RULES[input.dimensionKey]

  const ziweiScore = averageInterpretationScores(
    rule.sourceFunctions.map((functionKey) =>
      readLifeFunctionScore({
        profile: input.lifeFunctionProfile,
        key: functionKey,
      })
    )
  )

  const baziScore = averageInterpretationScores(
    rule.baziSupportKeys.map((supportKey) =>
      readBaziSupportScore({
        profile: input.baziSupportProfile,
        key: supportKey,
      })
    )
  )

  const score = weightedInterpretationScore([
    {
      score: ziweiScore,
      weight: 0.78,
    },
    {
      score: baziScore,
      weight: 0.22,
    },
  ])

  const level = resolveInterpretationScoreLevel(score)
  const genderFocus = buildGenderFocusText({
    lifeFunctionProfile: input.lifeFunctionProfile,
    sourceFunctions: rule.sourceFunctions,
  })

  return {
    key: rule.key,
    label: rule.label,
    score,
    level,
    baseMeaning: rule.baseMeaning,
    sourceFunctions: rule.sourceFunctions,
    sourceBaziFunctions: [],
    genderFocus,
    baziSupportKeys: rule.baziSupportKeys,
    summary: buildFiveDimensionSummary({
      label: rule.label,
      score,
      genderFocus,
    }),
  }
}

function buildFiveDimensionProfileSummary(input: {
  genderPerspective: GenderPerspective
  strongestDimensions: FiveDimensionResult[]
}): string {
  const viewpointText =
    input.genderPerspective === "male" ? "男命视角" : "女命视角"

  const strongestText = input.strongestDimensions
    .map((item) => item.label)
    .join("、")

  return `${viewpointText}下，最终五维性格最明显的是${strongestText}。五维分数由已完成性别映射的紫微生命功能主导，八字动力辅助。`
}

export function mapFiveDimensionProfile(input: {
  genderPerspective: GenderPerspective
  lifeFunctionProfile: ZiweiLifeFunctionProfile
  baziSupportProfile: BaziDynamicsSupportProfile
}): FiveDimensionProfile {
  const dimensions = FIVE_DIMENSION_ORDER.map((dimensionKey) =>
    buildFiveDimensionResult({
      dimensionKey,
      lifeFunctionProfile: input.lifeFunctionProfile,
      baziSupportProfile: input.baziSupportProfile,
    })
  )

  const strongestDimensions = [...dimensions]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return {
    genderPerspective: input.genderPerspective,
    dimensions,
    strongestDimensions,
    summary: buildFiveDimensionProfileSummary({
      genderPerspective: input.genderPerspective,
      strongestDimensions,
    }),
    debug: {
      source: "ziwei_gender_bazi",
      note: "五维性格由性别化紫微生命功能与八字辅助动力生成，不再依赖 FinalPersonalityVector。",
    },
  }
}