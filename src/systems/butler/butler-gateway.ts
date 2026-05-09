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
  hasPendingOpportunity,
  markOpportunityCreated,
  removeExpiredOpportunities,
} from "./education/butler-education-gateway"

export {
  createApproachOffer,
  createFoodOffer,
  createRestOffer,
} from "./behavior/butler-behavior-gateway"

export { chooseButlerTask } from "./task/butler-task-runner"

export { deriveButlerMood } from "./intention/butler-intention-gateway"

export {
  buildButlerProfileTaskTuning,
  type ButlerProfileTaskTuning,
} from "./tuning/butler-tuning-gateway"

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

export {
  BUTLER_CORE_ALLOWED_CHAIN,
  BUTLER_CORE_AUTONOMOUS_DRIVE_MODULES,
  BUTLER_CORE_BEHAVIOR_EXECUTION_MODULES,
  BUTLER_CORE_BOUNDARY_MODULES,
  BUTLER_CORE_BOUNDARY_SUMMARY,
  BUTLER_CORE_EDUCATION_MODULES,
  BUTLER_CORE_FORBIDDEN_RULES,
  BUTLER_CORE_MEMORY_RELATION_MODULES,
  BUTLER_CORE_MESSAGE_DECISION_MODULES,
  BUTLER_CORE_PUBLIC_GATEWAYS,
  BUTLER_CORE_RUNTIME_MODULES,
  BUTLER_CORE_TEST_OR_UI_RULES,
  BUTLER_CORE_TUNING_MODULES,
  BUTLER_CORE_TYPE_BOUNDARY_MODULES,
  type ButlerCoreBoundaryLayer,
  type ButlerCoreBoundaryModule,
} from "./butler-core-boundary"
