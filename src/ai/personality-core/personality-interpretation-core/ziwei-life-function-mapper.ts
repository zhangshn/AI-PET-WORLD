/**
 * 当前文件负责：先按男女视角进入紫微结构，再映射生命功能结果。
 */

import type { PersonalityProfile, SectorName, StarId } from "../../destiny-core/ziwei-core/ziwei-core-schema"

import {
  getGenderAwareZiweiTraitWeights,
  getGenderLifeFunctionFocus,
} from "./gender-perspective-rules"
import type {
  GenderPerspective,
  ZiweiLifeFunctionKey,
  ZiweiLifeFunctionProfile,
  ZiweiLifeFunctionResult,
} from "./interpretation-schema"
import {
  ZIWEI_LIFE_FUNCTION_ORDER,
  ZIWEI_LIFE_FUNCTION_RULES,
} from "./ziwei-structure-rules"
import {
  getInterpretationScoreLevelLabel,
  resolveInterpretationScoreLevel,
  weightedInterpretationScore,
} from "./interpretation-utils"

function readProfileScore(
  profile: PersonalityProfile,
  key: string
): number {
  const traitValue = profile.traits[key]

  if (typeof traitValue === "number") {
    return traitValue
  }

  const core = profile.corePersonality as unknown as Record<string, number>
  const coreValue = core[key]

  if (typeof coreValue === "number") {
    return coreValue <= 1 ? Math.round(coreValue * 100) : coreValue
  }

  return 50
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
    return 84
  }

  if (isSupportSector) {
    return 70
  }

  if (isOppositeSector) {
    return 62
  }

  if (sourceStars.length > 0) {
    return 56
  }

  return 45
}

function resolveGenderAwareTraitScore(input: {
  profile: PersonalityProfile
  functionKey: ZiweiLifeFunctionKey
  genderPerspective: GenderPerspective
}): number {
  const traitWeights = getGenderAwareZiweiTraitWeights({
    functionKey: input.functionKey,
    genderPerspective: input.genderPerspective,
  })

  return weightedInterpretationScore(
    Object.entries(traitWeights).map(([traitKey, weight]) => ({
      score: readProfileScore(input.profile, traitKey),
      weight,
    }))
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

  const genderAwareTraitScore = resolveGenderAwareTraitScore({
    profile: input.profile,
    functionKey: input.functionKey,
    genderPerspective: input.genderPerspective,
  })

  const structureScore = resolveSectorStructureScore(
    input.profile,
    rule.sourceSector
  )

  const baseScore = weightedInterpretationScore([
    {
      score: genderAwareTraitScore,
      weight: 0.68,
    },
    {
      score: structureScore,
      weight: 0.32,
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
    relatedTraits: Object.keys(
      getGenderAwareZiweiTraitWeights({
        functionKey: input.functionKey,
        genderPerspective: input.genderPerspective,
      })
    ),
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

  return `${viewpointText}先进入紫微结构映射，再生成生命功能。当前最明显的生命功能集中在${strongestText}。`
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
      note: "紫微主导模式下，gender 先进入生命功能映射，再生成分数与解释；不是先算统一性格再套男女文案。",
    },
  }
}