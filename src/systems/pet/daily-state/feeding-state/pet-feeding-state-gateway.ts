/**
 * 当前文件负责：作为 daily-state 下宠物进食相关状态与喂食入口的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 pet-feeding 实现，不改变运行逻辑。
 * pet-feeding 当前仍是混合模块，后续会逐步拆分：
 * - 饥饿 / 饱腹 / 进食状态归入 daily-state
 * - 机会接受判断归入自主驱动层
 * - 实际进食效果归入行为执行层
 */

export {
  evaluateFoodOffer,
  applyFeeding,
  type ApplyFeedingInput,
  type ApplyFeedingResult,
  type EvaluateFoodOfferInput,
  type FoodOfferDecision,
} from "../../pet-feeding/pet-feeding-gateway"
