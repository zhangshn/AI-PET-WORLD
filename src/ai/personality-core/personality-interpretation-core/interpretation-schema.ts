/**
 * 当前文件负责：定义人格解释核心的公共类型。
 */

import type { BaziProfile } from "../../destiny-core/bazi-core/bazi-types"
import type { PersonalityProfile, SectorName, StarId } from "../../destiny-core/ziwei-core/schema"

export type GenderPerspective = "male" | "female"

export type PersonalityInterpretationMode =
  | "ziwei_primary"
  | "bazi_primary"

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

export type BaziGenderFunctionKey =
  | "actionRelease"
  | "reactionPattern"
  | "sensoryConnection"
  | "routineConsistency"
  | "explorationMomentum"
  | "stabilityBase"
  | "persistencePattern"
  | "adaptivePattern"

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

export type BaziGenderFunctionRule = {
  key: BaziGenderFunctionKey
  label: string
  sourceKey: BaziDynamicsSupportKey
  baseMeaning: string
  maleFocus: string
  femaleFocus: string
}

export type FiveDimensionRule = {
  key: FiveDimensionKey
  label: string
  baseMeaning: string
  sourceFunctions: ZiweiLifeFunctionKey[]
  baziSupportKeys: BaziDynamicsSupportKey[]
}

export type BaziPrimaryFiveDimensionRule = {
  key: FiveDimensionKey
  label: string
  baseMeaning: string
  sourceBaziFunctions: BaziGenderFunctionKey[]
  baziSupportKeys: BaziDynamicsSupportKey[]
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

export type BaziGenderFunctionResult = {
  key: BaziGenderFunctionKey
  label: string
  sourceKey: BaziDynamicsSupportKey
  score: number
  level: ScoreLevel
  baseMeaning: string
  genderFocus: string
  summary: string
}

export type BaziGenderFunctionProfile = {
  genderPerspective: GenderPerspective
  functions: BaziGenderFunctionResult[]
  strongestFunctions: BaziGenderFunctionResult[]
  summary: string
  debug: {
    source: "bazi_gender"
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
  sourceBaziFunctions: BaziGenderFunctionKey[]
  genderFocus: string
  baziSupportKeys: BaziDynamicsSupportKey[]
  summary: string
}

export type FiveDimensionProfile = {
  genderPerspective: GenderPerspective
  dimensions: FiveDimensionResult[]
  strongestDimensions: FiveDimensionResult[]
  summary: string
  debug: {
    source: "ziwei_gender_bazi" | "bazi_gender"
    note: string
  }
}

export type PersonalityInterpretationProfile = {
  mode: PersonalityInterpretationMode
  genderPerspective: GenderPerspective
  principle: string

  ziweiLifeFunctionProfile: ZiweiLifeFunctionProfile | null
  baziGenderFunctionProfile: BaziGenderFunctionProfile | null
  baziDynamicsSupportProfile: BaziDynamicsSupportProfile
  fiveDimensionProfile: FiveDimensionProfile

  summary: string
  debug: {
    doesModifyZiweiProfile: false
    doesModifyBaziProfile: false
    note: string
  }
}

export type GenderAwareBehaviorBias = {
  petBehaviorBias: {
    newbornActivity: number
    observationNeed: number
    attachmentNeed: number
    explorationRange: number
    restNeed: number
  }
  butlerBehaviorBias: {
    carePriority: number
    constructionDrive: number
    routinePreference: number
    riskTolerance: number
    responseSpeed: number
  }
  buildingBias: {
    expansionPreference: number
    stabilityPreference: number
    comfortPreference: number
    orderPreference: number
    adaptabilityPreference: number
  }
  debug: {
    source: "gender_aware_interpretation"
    note: string
  }
}

export type BuildGenderAwareBehaviorBiasInput = {
  interpretationProfile: PersonalityInterpretationProfile
}

export type GenderPerspectiveComparison = {
  mode: PersonalityInterpretationMode
  sameBirthStructure: true
  maleProfile: PersonalityInterpretationProfile
  femaleProfile: PersonalityInterpretationProfile
  conclusion: string
  debug: {
    note: string
  }
}

export type BuildPersonalityInterpretationInput = {
  ziweiProfile?: PersonalityProfile | null
  baziProfile: BaziProfile
  genderPerspective: GenderPerspective
  hasBirthHour: boolean
}

export type BuildGenderPerspectiveComparisonInput = {
  ziweiProfile?: PersonalityProfile | null
  baziProfile: BaziProfile
  hasBirthHour: boolean
}