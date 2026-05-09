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

export { chooseButlerTask } from "./task/butler-task-runner"

export { deriveButlerMood } from "./butler-mood-runner"

export {
  buildButlerProfileTaskTuning,
} from "./butler-profile-tuning"

export type {
  ButlerProfileTaskTuning,
} from "./butler-profile-tuning"

export {
  buildButlerTaskDecisionTrace,
} from "./task/butler-task-decision-trace"

export type {
  ButlerTaskDecisionGate,
  ButlerTaskDecisionScore,
  ButlerTaskDecisionTrace,
} from "./task/butler-task-decision-trace"

export {
  appendButlerMemoryEntry,
  createButlerMemoryEntry,
  createButlerMemoryEntryFromOpportunityFeedback,
  createButlerMemoryEntryFromTaskDecision,
  createInitialButlerMemoryState,
  shouldRememberTaskDecision,
} from "./memory-relation/butler-memory"

export type {
  ButlerMemoryEntry,
  ButlerMemoryState,
  ButlerMemoryType,
} from "./memory-relation/butler-memory"

export {
  createInitialButlerRelationState,
  updateButlerRelationFromOpportunityFeedback,
  updateButlerRelationFromTaskDecision,
} from "./memory-relation/butler-relation"

export type {
  ButlerOpportunityFeedback,
  ButlerRelationState,
  ButlerRelationTone,
} from "./memory-relation/butler-relation"

export {
  buildButlerExperienceInterpretation,
  buildButlerRelationTaskTuning,
} from "./memory-relation/butler-relation-tuning"

export type {
  ButlerExperienceInterpretation,
  ButlerExperienceInterpreterInput,
  ButlerRelationTaskTuning,
} from "./memory-relation/butler-relation-tuning"