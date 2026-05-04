/**
 * 当前文件负责：把紫微主结构与男女视角映射为生命功能结果。
 */

import type { PersonalityProfile, SectorName, StarId } from "../ziwei-core/schema"

import { getGenderLifeFunctionFocus } from "./gender-perspective-rules"
import type {
  GenderPerspective,
  ZiweiLifeFunctionProfile,
  ZiweiLifeFunctionResult,
} from "./interpretation-schema"
import {
  ZIWEI_LIFE_FUNCTION_ORDER,
  ZIWEI_LIFE_FUNCTION_RULES,
} from "./ziwei-structure-rules"
import {
  averageInterpretationScores,
  getInterpretationScoreLevelLabel,
  resolveInterpretationScoreLevel,
  weightedInterpretationScore,
} from "./interpretation-utils"

function readTraitScore(
  profile: PersonalityProfile,
  traitKey: string
): number {
  const value = profile.traits[traitKey]

  if (typeof value !== "number") {
    return 50
  }

  return value
}

function getSectorStars(
  profile: PersonalityProfile,
  sector: SectorName
): StarId[] {
  return profile.pattern.sectors[sector] ?? []
}

function resolveSectorStructureScore(
  profile: PersonalityProfile,
  sector: SectorName
): number {
  const sourceStars = getSectorStars(profile, sector)
  const isPrimarySector = profile.pattern.primarySector === sector
  const isSupportSector = profile.pattern.supportSectors.includes(sector)
  const isOppositeSector = profile.pattern.oppositeSector === sector

  if (isPrimarySector) {
    return 82
  }

  if (isSupportSector) {
    return 68
  }

  if (isOppositeSector) {
    return 60
  }

  if (sourceStars.length > 0) {
    return 56
  }

  return 45
}

function resolveTraitScore(
  profile: PersonalityProfile,
  relatedTraits: string[]
): number {
  return averageInterpretationScores(
    relatedTraits.map((traitKey) => readTraitScore(profile, traitKey))
  )
}

function buildFunctionSummary(input: {
  label: string
  score: number
  genderFocus: string
}): string {
  const level = resolveInterpretationScoreLevel(input.score)
  const levelLabel = getInterpretationScoreLevelLabel(level)

  return `${input.label}${levelLabel}。${input.genderFocus}`
}

function buildLifeFunctionResult(input: {
  profile: PersonalityProfile
  genderPerspective: GenderPerspective
  functionKey: ZiweiLifeFunctionResult["key"]
}): ZiweiLifeFunctionResult {
  const rule = ZIWEI_LIFE_FUNCTION_RULES[input.functionKey]
  const sourceStars = getSectorStars(input.profile, rule.sourceSector)

  const traitScore = resolveTraitScore(input.profile, rule.relatedTraits)
  const structureScore = resolveSectorStructureScore(
    input.profile,
    rule.sourceSector
  )

  const baseScore = weightedInterpretationScore([
    {
      score: traitScore,
      weight: 0.62,
    },
    {
      score: structureScore,
      weight: 0.38,
    },
  ])

  const level = resolveInterpretationScoreLevel(baseScore)
  const genderFocus = getGenderLifeFunctionFocus({
    functionKey: rule.key,
    genderPerspective: input.genderPerspective,
  })

  return {
    key: rule.key,
    label: rule.label,
    sourceSector: rule.sourceSector,
    sourceStars,
    baseScore,
    score: baseScore,
    level,
    baseMeaning: rule.baseMeaning,
    genderFocus,
    relatedTraits: rule.relatedTraits,
    summary: buildFunctionSummary({
      label: rule.label,
      score: baseScore,
      genderFocus,
    }),
  }
}

function buildLifeFunctionProfileSummary(input: {
  genderPerspective: GenderPerspective
  strongestFunctions: ZiweiLifeFunctionResult[]
}): string {
  const viewpointText =
    input.genderPerspective === "male" ? "男命视角" : "女命视角"

  const strongestText = input.strongestFunctions
    .map((item) => item.label)
    .join("、")

  return `${viewpointText}下，紫微主结构最明显的生命功能集中在${strongestText}。这里的差异来自同一套紫微结构在不同解释视角下的转译，不改变底层命盘。`
}

export function mapZiweiToLifeFunctionProfile(input: {
  ziweiProfile: PersonalityProfile
  genderPerspective: GenderPerspective
}): ZiweiLifeFunctionProfile {
  const functions = ZIWEI_LIFE_FUNCTION_ORDER.map((functionKey) =>
    buildLifeFunctionResult({
      profile: input.ziweiProfile,
      genderPerspective: input.genderPerspective,
      functionKey,
    })
  )

  const strongestFunctions = [...functions]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return {
    genderPerspective: input.genderPerspective,
    functions,
    strongestFunctions,
    summary: buildLifeFunctionProfileSummary({
      genderPerspective: input.genderPerspective,
      strongestFunctions,
    }),
    debug: {
      source: "ziwei",
      note: "生命功能以紫微结构为主轴生成；男女视角在紫微结构解释阶段进入，不修改紫微原盘。",
    },
  }
}