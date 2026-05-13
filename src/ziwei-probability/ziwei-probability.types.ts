/**
 * 当前文件负责：定义紫微概率解释系统类型。
 */

import type {
  CarePriority,
  GardenStyleType,
  HomeStyleType,
  PetMatchType,
  ShelterStyleType,
  VisualColorTone,
  ZiweiVisualArchetype,
} from "../visual-system/visual-dna.types"

export type ZiweiMainStar =
  | "ziwei"
  | "tianji"
  | "taiyang"
  | "wuqu"
  | "tiantong"
  | "lianzhen"
  | "tianfu"
  | "taiyin"
  | "tanlang"
  | "jumen"
  | "tianxiang"
  | "tianliang"
  | "qisha"
  | "pojun"

export type ZiweiPairId =
  | "ziwei_tianfu"
  | "ziwei_tanlang"
  | "ziwei_qisha"
  | "ziwei_pojun"
  | "tianji_taiyin"
  | "tianji_jumen"
  | "tianji_tianliang"
  | "taiyang_taiyin"
  | "taiyang_jumen"
  | "taiyang_tianliang"
  | "wuqu_tianfu"
  | "wuqu_tanlang"
  | "wuqu_qisha"
  | "wuqu_pojun"
  | "tiantong_taiyin"
  | "tiantong_jumen"
  | "tiantong_tianliang"
  | "lianzhen_tianfu"
  | "lianzhen_tanlang"
  | "lianzhen_qisha"
  | "lianzhen_pojun"
  | "tianfu_tianxiang"
  | "taiyin_tianliang"
  | "qisha_pojun"

export type ArchetypeScoreMap = Record<ZiweiVisualArchetype, number>

export type PetMatchScoreMap = Record<PetMatchType, number>

export type VisualPreferenceScoreMap = {
  order: number
  warmth: number
  protection: number
  decoration: number
  nature: number
  stability: number
}

export type ZiweiPreferenceBias = {
  archetypeScores: ArchetypeScoreMap
  petMatchScores: PetMatchScoreMap
  visualScores: VisualPreferenceScoreMap
  colorToneHints: VisualColorTone[]
  homeStyleHints: HomeStyleType[]
  gardenStyleHints: GardenStyleType[]
  shelterStyleHints: ShelterStyleType[]
  carePriorityHints: CarePriority[]
  explanation: string
}

export type ZiweiProbabilityInput = {
  primaryStars: ZiweiMainStar[]
  pairIds: ZiweiPairId[]
  source: "ziwei_primary" | "bazi_fallback" | "mock"
}

export type ZiweiProbabilityProfile = {
  input: ZiweiProbabilityInput
  archetypeScores: ArchetypeScoreMap
  petMatchScores: PetMatchScoreMap
  visualScores: VisualPreferenceScoreMap
  colorToneCandidates: VisualColorTone[]
  homeStyleCandidates: HomeStyleType[]
  gardenStyleCandidates: GardenStyleType[]
  shelterStyleCandidates: ShelterStyleType[]
  carePriorityCandidates: CarePriority[]
  topArchetype: ZiweiVisualArchetype
  secondaryArchetype?: ZiweiVisualArchetype
  topPetMatchType: PetMatchType
  confidence: number
  explanations: string[]
  source: "ziwei_primary" | "bazi_fallback" | "mock"
}
