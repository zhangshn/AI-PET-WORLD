/**
 * 当前文件负责：作为自主驱动层下宠物机会接受 / 拒绝判断的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 pet-opportunity 判断逻辑，不改变运行逻辑。
 * pet-opportunity 当前仍是混合模块，后续会逐步拆分：
 * - 接受 / 拒绝判断归入自主驱动层
 * - 接受后的实际效果归入行为执行层
 */

export {
  evaluateApproachOffer,
  evaluateRestOffer,
  type EvaluatePetOpportunityInput,
  type PetOpportunityDecision,
} from "../pet-opportunity/pet-opportunity-gateway"
