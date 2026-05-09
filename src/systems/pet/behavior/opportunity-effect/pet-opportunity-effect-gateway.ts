/**
 * 当前文件负责：作为行为执行层下宠物机会接受后实际效果的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 pet-opportunity 效果逻辑，不改变运行逻辑。
 * 后续会把接受机会后的具体效果逐步迁入 behavior。
 */

export {
  applyAcceptedApproachOfferEffect,
  applyAcceptedRestOfferEffect,
  type ApplyPetOpportunityEffectInput,
  type ApplyPetOpportunityEffectResult,
} from "../../pet-opportunity/pet-opportunity-gateway"
