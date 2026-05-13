/**
 * 当前文件负责：导出紫微概率解释系统入口。
 */

export {
  buildZiweiProbabilityProfile,
} from "./ziwei-probability-aggregator"

export {
  mockZiweiProbabilityInputs,
  mockZiweiProbabilityProfiles,
} from "./ziwei-probability.mock"

export {
  ziweiPairPreferenceBiases,
} from "./ziwei-pair-preferences"

export {
  ziweiStarPreferenceBiases,
} from "./ziwei-star-preferences"

export type {
  ArchetypeScoreMap,
  PetMatchScoreMap,
  VisualPreferenceScoreMap,
  ZiweiMainStar,
  ZiweiPairId,
  ZiweiPreferenceBias,
  ZiweiProbabilityInput,
  ZiweiProbabilityProfile,
} from "./ziwei-probability.types"
