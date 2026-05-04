/**
 * 当前文件负责：定义人格解释核心的公共类型。
 */

import type { BaziProfile } from "../bazi-core/bazi-types"
import type { FinalPersonalityProfile } from "../personality-vector/vector-gateway"
import type { PersonalityProfile, SectorName, StarId } from "../ziwei-core/schema"

export type GenderPerspective = "male" | "female"

export type ScoreLevel =
  | "high"
  | "medium_high"
  | "medium"
  | "medium_low"
  | "low"

export type ZiweiLifeFunctionKey =
  | "coreSelf"
  | "taskExecution"
  | "longTermBond"
  | "caregivingCreation"
  | "innerRecovery"
  | "explorationRange"
  | "territorySafety"

export type FiveDimensionKey =
  | "exploration"
  | "attachment"
  | "stability"
  | "execution"
  | "caregiving"

export type BaziDynamicsSupportKey =
  | "actionIntensity"
  | "reactionSpeed"
  | "sensoryDepth"
  | "consistency"
  | "explorationDrive"
  | "stability"
  | "persistence"
  | "adaptability"

export type ZiweiLifeFunctionRule = {
  key: ZiweiLifeFunctionKey
  label: string
  sourceSector: SectorName
  baseMeaning: string
  relatedTraits: string[]
}

export type GenderPerspectiveRule = {
  genderPerspective: GenderPerspective
  label: string
  coreFocus: string
  description: string
}

export type GenderLifeFunctionFocus = {
  functionKey: ZiweiLifeFunctionKey
  maleFocus: string
  femaleFocus: string
}

export type FiveDimensionRule = {
  key: FiveDimensionKey
  label: string
  baseMeaning: string
  sourceFunctions: ZiweiLifeFunctionKey[]
  baziSupportKeys: BaziDynamicsSupportKey[]
  vectorSupportKeys: string[]
}

export type ZiweiLifeFunctionResult = {
  key: ZiweiLifeFunctionKey
  label: string
  sourceSector: SectorName
  sourceStars: StarId[]
  baseScore: number
  score: number
  level: ScoreLevel
  baseMeaning: string
  genderFocus: string
  relatedTraits: string[]
  summary: string
}

export type ZiweiLifeFunctionProfile = {
  genderPerspective: GenderPerspective
  functions: ZiweiLifeFunctionResult[]
  strongestFunctions: ZiweiLifeFunctionResult[]
  summary: string
  debug: {
    source: "ziwei"
    note: string
  }
}

export type BaziDynamicsSupportItem = {
  key: BaziDynamicsSupportKey
  label: string
  score: number
  level: ScoreLevel
  summary: string
}

export type BaziDynamicsSupportProfile = {
  items: BaziDynamicsSupportItem[]
  dominantElements: string[]
  weakElements: string[]
  summary: string
  debug: {
    source: "bazi"
    note: string
  }
}

export type FiveDimensionResult = {
  key: FiveDimensionKey
  label: string
  score: number
  level: ScoreLevel
  baseMeaning: string
  sourceFunctions: ZiweiLifeFunctionKey[]
  genderFocus: string
  baziSupportKeys: BaziDynamicsSupportKey[]
  vectorSupportKeys: string[]
  summary: string
}

export type FiveDimensionProfile = {
  genderPerspective: GenderPerspective
  dimensions: FiveDimensionResult[]
  strongestDimensions: FiveDimensionResult[]
  summary: string
  debug: {
    source: "ziwei_gender_bazi_vector"
    note: string
  }
}

export type PersonalityInterpretationProfile = {
  genderPerspective: GenderPerspective
  principle: string
  ziweiLifeFunctionProfile: ZiweiLifeFunctionProfile
  baziDynamicsSupportProfile: BaziDynamicsSupportProfile
  fiveDimensionProfile: FiveDimensionProfile
  summary: string
  debug: {
    doesModifyZiweiProfile: false
    doesModifyBaziProfile: false
    doesModifyFinalPersonalityVector: false
    note: string
  }
}

export type GenderPerspectiveComparison = {
  sameBirthStructure: true
  sameFinalVector: true
  maleProfile: PersonalityInterpretationProfile
  femaleProfile: PersonalityInterpretationProfile
  conclusion: string
  debug: {
    maleVectorFingerprint: string
    femaleVectorFingerprint: string
    note: string
  }
}

export type BuildPersonalityInterpretationInput = {
  ziweiProfile: PersonalityProfile
  baziProfile: BaziProfile
  finalPersonalityProfile: FinalPersonalityProfile
  genderPerspective: GenderPerspective
}

export type BuildGenderPerspectiveComparisonInput = {
  ziweiProfile: PersonalityProfile
  baziProfile: BaziProfile
  finalPersonalityProfile: FinalPersonalityProfile
}