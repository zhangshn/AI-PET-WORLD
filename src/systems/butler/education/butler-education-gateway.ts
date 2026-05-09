/**
 * 当前文件负责：统一导出管家幼儿期照看 / 教育判断相关入口。
 *
 * education 属于管家照看与教育边界。
 * 它只判断如何提供机会、保护、等待或引导，不直接控制宠物行为。
 */

export {
  buildInitialOpportunityCooldowns,
  canCreateOpportunity,
  hasPendingOpportunity,
  markOpportunityCreated,
  removeExpiredOpportunities,
} from "./opportunity/butler-opportunity-education-gateway"

export {
  buildButlerEducationStrategy,
  type ButlerEducationStrategy,
} from "./strategy/butler-education-strategy-gateway"