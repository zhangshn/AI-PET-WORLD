/**
 * 当前文件负责：统一导出管家系统模块的公开入口。
 */

export type {
  ButlerMood,
  ButlerOpportunity,
  ButlerOpportunityCooldowns,
  ButlerOpportunityType,
  ButlerState,
  ButlerSystemInput,
  ButlerTask,
} from "./butler-schema"

export {
  buildInitialOpportunityCooldowns,
  canCreateOpportunity,
  createApproachOffer,
  createFoodOffer,
  createRestOffer,
  hasPendingOpportunity,
  markOpportunityCreated,
  removeExpiredOpportunities,
} from "./butler-opportunity-runner"

export { chooseButlerTask } from "./butler-task-runner"

export { deriveButlerMood } from "./butler-mood-runner"