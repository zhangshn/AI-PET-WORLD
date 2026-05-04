/**
 * 当前文件负责：统一导出宠物机会判断与机会影响模块。
 */

export {
  evaluateApproachOffer,
  evaluateRestOffer,
  type EvaluatePetOpportunityInput,
  type PetOpportunityDecision,
} from "./pet-opportunity-decision-runner"

export {
  applyAcceptedApproachOfferEffect,
  applyAcceptedRestOfferEffect,
  type ApplyPetOpportunityEffectInput,
  type ApplyPetOpportunityEffectResult,
} from "./pet-opportunity-effect-runner"