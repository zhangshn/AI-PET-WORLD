/**
 * 当前文件负责：作为 education 下管家机会判断与机会状态管理的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 butler-opportunity-runner 实现，不改变运行逻辑。
 * butler-opportunity-runner 当前仍是混合模块，后续会逐步拆分：
 * - 机会判断 / 冷却 / 清理归入 education
 * - 机会创建动作归入 behavior
 */

export {
  buildInitialOpportunityCooldowns,
  canCreateOpportunity,
  hasPendingOpportunity,
  markOpportunityCreated,
  removeExpiredOpportunities,
} from "../../butler-pet-opportunity-runner"
