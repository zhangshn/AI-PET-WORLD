/**
 * 当前文件负责：在出生时辰未知时，先按男女视角进入八字动力映射，再生成性格。
 */

import type { BaziProfile } from "../bazi-core/bazi-types"
import type { FinalPersonalityProfile } from "../personality-vector/vector-gateway"

import {
  BAZI_DYNAMICS_WEIGHT,
  FINAL_VECTOR_CALIBRATION_WEIGHT,
  ZIWEI_STRUCTURE_WEIGHT,
} from "./interpretation-constants"
import {
  BAZI_GENDER_FUNCTION_ORDER,
  BAZI_GENDER_FUNCTION_RULES,
  BAZI_PRIMARY_FIVE_DIMENSION_RULES,
} from "./bazi-gender-rules"
import { FIVE_DIMENSION_ORDER } from "./five-dimension-rules"
import type {
  BaziDynamicsSupportKey,
  BaziDynamicsSupportProfile,
  BaziGenderFunctionKey,
  BaziGenderFunctionProfile,
  BaziGenderFunctionResult,
  FiveDimensionKey,
  FiveDimensionProfile,
  FiveDimensionResult,
  GenderPerspective,
} from "./interpretation-schema"
import {
  averageInterpretationScores,
  getInterpretationScoreLevelLabel,
  resolveInterpretationScoreLevel,
  weightedInterpretationScore,
} from "./interpretation-utils"

function readBaziSupportScore(input: {
  profile: BaziDynamicsSupportProfile
  key: BaziDynamicsSupportKey
}): number {
  return input.profile.items.find((item) => item.key === input.key)?.score ?? 50
}

function readVectorSupportScore(input: {
  profile: FinalPersonalityProfile
  key: string
}): number {
  const vector = input.profile.vector as Record<string, number>
  const value = vector[input.key]

  if (typeof value !== "number") {
    return 50
  }

  return value
}

function resolveGenderAwareBaziFunctionScore(input: {
  baziSupportProfile: BaziDynamicsSupportProfile
  functionKey: BaziGenderFunctionKey
  genderPerspective: GenderPerspective
}): number {
  const rule = BAZI_GENDER_FUNCTION_RULES[input.functionKey]

  const weights =
    input.genderPerspective === "male"
      ? rule.maleSupportWeights
      : rule.femaleSupportWeights

  return weightedInterpretationScore(
    Object.entries(weights).map(([supportKey, weight]) => ({
      score: readBaziSupportScore({
        profile: input.baziSupportProfile,
        key: supportKey as BaziDynamicsSupportKey,
      }),
      weight,
    }))
  )
}

function buildBaziGenderFunctionSummary(input: {
  label: string
  score: number
  genderFocus: string
}): string {
  const level = resolveInterpretationScoreLevel(input.score)
  const levelLabel = getInterpretationScoreLevelLabel(level)

  return `${input.label}${levelLabel}。${input.genderFocus}`
}

function buildBaziGenderFunctionResult(input: {
  baziSupportProfile: BaziDynamicsSupportProfile
  functionKey: BaziGenderFunctionKey
  genderPerspective: GenderPerspective
}): BaziGenderFunctionResult {
  const rule = BAZI_GENDER_FUNCTION_RULES[input.functionKey]
  const score = resolveGenderAwareBaziFunctionScore(input)
  const level = resolveInterpretationScoreLevel(score)

  const genderFocus =
    input.genderPerspective === "male" ? rule.maleFocus : rule.femaleFocus

  return {
    key: rule.key,
    label: rule.label,
    sourceKey: rule.sourceKey,
    score,
    level,
    baseMeaning: rule.baseMeaning,
    genderFocus,
    summary: buildBaziGenderFunctionSummary({
      label: rule.label,
      score,
      genderFocus,
    }),
  }
}

function buildBaziGenderFunctionProfileSummary(input: {
  genderPerspective: GenderPerspective
  strongestFunctions: BaziGenderFunctionResult[]
}): string {
  const viewpointText =
    input.genderPerspective === "male" ? "男命视角" : "女命视角"

  const strongestText = input.strongestFunctions
    .map((item) => item.label)
    .join("、")

  return `${viewpointText}先进入八字动力映射，再生成人格功能。当前最明显的八字人格功能集中在${strongestText}。`
}

export function mapBaziGenderFunctionProfile(input: {
  baziSupportProfile: BaziDynamicsSupportProfile
  genderPerspective: GenderPerspective
}): BaziGenderFunctionProfile {
  const functions = BAZI_GENDER_FUNCTION_ORDER.map((functionKey) =>
    buildBaziGenderFunctionResult({
      baziSupportProfile: input.baziSupportProfile,
      functionKey,
      genderPerspective: input.genderPerspective,
    })
  )

  const strongestFunctions = [...functions]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return {
    genderPerspective: input.genderPerspective,
    functions,
    strongestFunctions,
    summary: buildBaziGenderFunctionProfileSummary({
      genderPerspective: input.genderPerspective,
      strongestFunctions,
    }),
    debug: {
      source: "bazi_gender",
      note: "出生时辰未知时，gender 先进入八字动力映射，再生成八字人格功能；不是先生成统一分数再套男女文案。",
    },
  }
}

function readBaziGenderFunctionScore(input: {
  profile: BaziGenderFunctionProfile
  key: BaziGenderFunctionKey
}): number {
  return input.profile.functions.find((item) => item.key === input.key)?.score ?? 50
}

function readBaziGenderFunctionFocus(input: {
  profile: BaziGenderFunctionProfile
  key: BaziGenderFunctionKey
}): string {
  return input.profile.functions.find((item) => item.key === input.key)
    ?.genderFocus ?? ""
}

function resolveGenderAwareDimensionScore(input: {
  dimensionKey: FiveDimensionKey
  baziGenderFunctionProfile: BaziGenderFunctionProfile
}): number {
  const rule = BAZI_PRIMARY_FIVE_DIMENSION_RULES[input.dimensionKey]

  const weights =
    input.baziGenderFunctionProfile.genderPerspective === "male"
      ? rule.maleFunctionWeights
      : rule.femaleFunctionWeights

  return weightedInterpretationScore(
    Object.entries(weights).map(([functionKey, weight]) => ({
      score: readBaziGenderFunctionScore({
        profile: input.baziGenderFunctionProfile,
        key: functionKey as BaziGenderFunctionKey,
      }),
      weight,
    }))
  )
}

function buildBaziGenderFocusText(input: {
  baziGenderFunctionProfile: BaziGenderFunctionProfile
  dimensionKey: FiveDimensionKey
}): string {
  const rule = BAZI_PRIMARY_FIVE_DIMENSION_RULES[input.dimensionKey]

  const weights =
    input.baziGenderFunctionProfile.genderPerspective === "male"
      ? rule.maleFunctionWeights
      : rule.femaleFunctionWeights

  return Object.keys(weights)
    .map((functionKey) =>
      readBaziGenderFunctionFocus({
        profile: input.baziGenderFunctionProfile,
        key: functionKey as BaziGenderFunctionKey,
      })
    )
    .filter(Boolean)
    .join("；")
}

function buildBaziPrimaryDimensionSummary(input: {
  label: string
  score: number
  genderFocus: string
}): string {
  const level = resolveInterpretationScoreLevel(input.score)
  const levelLabel = getInterpretationScoreLevelLabel(level)

  return `${input.label}${levelLabel}。${input.genderFocus}`
}

function buildBaziPrimaryFiveDimensionResult(input: {
  dimensionKey: FiveDimensionKey
  baziGenderFunctionProfile: BaziGenderFunctionProfile
  baziSupportProfile: BaziDynamicsSupportProfile
  finalPersonalityProfile: FinalPersonalityProfile
}): FiveDimensionResult {
  const rule = BAZI_PRIMARY_FIVE_DIMENSION_RULES[input.dimensionKey]

  const baziGenderScore = resolveGenderAwareDimensionScore({
    dimensionKey: input.dimensionKey,
    baziGenderFunctionProfile: input.baziGenderFunctionProfile,
  })

  const baziSupportScore = averageInterpretationScores(
    rule.baziSupportKeys.map((supportKey) =>
      readBaziSupportScore({
        profile: input.baziSupportProfile,
        key: supportKey,
      })
    )
  )

  const vectorScore = averageInterpretationScores(
    rule.vectorSupportKeys.map((supportKey) =>
      readVectorSupportScore({
        profile: input.finalPersonalityProfile,
        key: supportKey,
      })
    )
  )

  const score = weightedInterpretationScore([
    {
      score: baziGenderScore,
      weight: ZIWEI_STRUCTURE_WEIGHT,
    },
    {
      score: baziSupportScore,
      weight: BAZI_DYNAMICS_WEIGHT,
    },
    {
      score: vectorScore,
      weight: FINAL_VECTOR_CALIBRATION_WEIGHT,
    },
  ])

  const level = resolveInterpretationScoreLevel(score)
  const genderFocus = buildBaziGenderFocusText({
    baziGenderFunctionProfile: input.baziGenderFunctionProfile,
    dimensionKey: input.dimensionKey,
  })

  return {
    key: rule.key,
    label: rule.label,
    score,
    level,
    baseMeaning: rule.baseMeaning,
    sourceFunctions: [],
    sourceBaziFunctions: Object.keys(
      input.baziGenderFunctionProfile.genderPerspective === "male"
        ? rule.maleFunctionWeights
        : rule.femaleFunctionWeights
    ) as BaziGenderFunctionKey[],
    genderFocus,
    baziSupportKeys: rule.baziSupportKeys,
    vectorSupportKeys: rule.vectorSupportKeys,
    summary: buildBaziPrimaryDimensionSummary({
      label: rule.label,
      score,
      genderFocus,
    }),
  }
}

function buildBaziPrimaryFiveDimensionSummary(input: {
  genderPerspective: GenderPerspective
  strongestDimensions: FiveDimensionResult[]
}): string {
  const viewpointText =
    input.genderPerspective === "male" ? "男命视角" : "女命视角"

  const strongestText = input.strongestDimensions
    .map((item) => item.label)
    .join("、")

  return `${viewpointText}下，八字主导模式先按性别进入动力映射，再生成五维性格。当前五维重点为${strongestText}。`
}

export function mapBaziPrimaryFiveDimensionProfile(input: {
  baziGenderFunctionProfile: BaziGenderFunctionProfile
  baziSupportProfile: BaziDynamicsSupportProfile
  finalPersonalityProfile: FinalPersonalityProfile
  genderPerspective: GenderPerspective
}): FiveDimensionProfile {
  const dimensions = FIVE_DIMENSION_ORDER.map((dimensionKey) =>
    buildBaziPrimaryFiveDimensionResult({
      dimensionKey,
      baziGenderFunctionProfile: input.baziGenderFunctionProfile,
      baziSupportProfile: input.baziSupportProfile,
      finalPersonalityProfile: input.finalPersonalityProfile,
    })
  )

  const strongestDimensions = [...dimensions]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return {
    genderPerspective: input.genderPerspective,
    dimensions,
    strongestDimensions,
    summary: buildBaziPrimaryFiveDimensionSummary({
      genderPerspective: input.genderPerspective,
      strongestDimensions,
    }),
    debug: {
      source: "bazi_gender_vector",
      note: "八字主导模式下，gender 先进入八字动力映射，再生成五维；FinalPersonalityVector 仅作校准参考。",
    },
  }
}

export function buildBaziPrimaryInterpretationParts(input: {
  baziProfile: BaziProfile
  baziSupportProfile: BaziDynamicsSupportProfile
  finalPersonalityProfile: FinalPersonalityProfile
  genderPerspective: GenderPerspective
}) {
  const baziGenderFunctionProfile = mapBaziGenderFunctionProfile({
    baziSupportProfile: input.baziSupportProfile,
    genderPerspective: input.genderPerspective,
  })

  const fiveDimensionProfile = mapBaziPrimaryFiveDimensionProfile({
    baziGenderFunctionProfile,
    baziSupportProfile: input.baziSupportProfile,
    finalPersonalityProfile: input.finalPersonalityProfile,
    genderPerspective: input.genderPerspective,
  })

  return {
    baziGenderFunctionProfile,
    fiveDimensionProfile,
  }
}