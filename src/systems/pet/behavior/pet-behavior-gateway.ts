/**
 * 当前文件负责：统一导出宠物行为执行层的公开入口。
 *
 * behavior 属于第 8 层：行为执行层。
 * 它只负责把上层意图或已接受机会表达为行为效果，不负责主体判断。
 */

export {
  applyAcceptedApproachOfferEffect,
  applyAcceptedRestOfferEffect,
  type ApplyPetOpportunityEffectInput,
  type ApplyPetOpportunityEffectResult,
} from "./opportunity-effect/pet-opportunity-effect-gateway"

export {
  expressPetAction,
} from "./expression/pet-expression-behavior-gateway"

export type {
  PetExpressionInput,
  PetExpressionReason,
  PetExpressionResult,
} from "./expression/pet-expression-behavior-gateway"
