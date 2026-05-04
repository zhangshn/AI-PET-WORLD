/**
 * 当前文件负责：在出生时辰未知时，以八字为主生成男女视角人格解释。
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
  const score = readBaziSupportScore({
    profile: input.baziSupportProfile,
    key: rule.sourceKey,
  })
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

  return `${viewpointText}下，八字主导的人格动力重点集中在${strongestText}。当前出生时辰未知，不使用默认紫微盘强行解释。`
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
      note: "出生时辰未知时，八字成为人格定义主轴；男女视角仍然参与解释，不被忽略。",
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

function buildBaziGenderFocusText(input: {
  baziGenderFunctionProfile: BaziGenderFunctionProfile
  sourceBaziFunctions: BaziGenderFunctionKey[]
}): string {
  return input.sourceBaziFunctions
    .map((functionKey) =>
      readBaziGenderFunctionFocus({
        profile: input.baziGenderFunctionProfile,
        key: functionKey,
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

  const baziGenderScore = averageInterpretationScores(
    rule.sourceBaziFunctions.map((functionKey) =>
      readBaziGenderFunctionScore({
        profile: input.baziGenderFunctionProfile,
        key: functionKey,
      })
    )
  )

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
    sourceBaziFunctions: rule.sourceBaziFunctions,
  })

  return {
    key: rule.key,
    label: rule.label,
    score,
    level,
    baseMeaning: rule.baseMeaning,
    sourceFunctions: [],
    sourceBaziFunctions: rule.sourceBaziFunctions,
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

  return `${viewpointText}下，八字主导模式的五维重点为${strongestText}。由于出生时辰未知，系统不使用紫微完整盘，而以八字动力作为主要人格定义来源。`
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
      note: "八字主导模式下，五维由八字男女解释功能为主体，FinalPersonalityVector 仅作校准参考。",
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