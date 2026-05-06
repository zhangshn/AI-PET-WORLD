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

export {
  buildButlerProfileTaskTuning,
} from "./butler-profile-tuning"

export type {
  ButlerProfileTaskTuning,
} from "./butler-profile-tuning"

export {
  buildButlerTaskDecisionTrace,
} from "./butler-task-decision-trace"

export type {
  ButlerTaskDecisionGate,
  ButlerTaskDecisionScore,
  ButlerTaskDecisionTrace,
} from "./butler-task-decision-trace"

export {
  appendButlerMemoryEntry,
  createButlerMemoryEntry,
  createButlerMemoryEntryFromTaskDecision,
  createInitialButlerMemoryState,
  shouldRememberTaskDecision,
} from "./butler-memory"

export type {
  ButlerMemoryEntry,
  ButlerMemoryState,
  ButlerMemoryType,
} from "./butler-memory"