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
  buildButlerEducationStrategy,
  buildInitialOpportunityCooldowns,
  canCreateOpportunity,
  hasPendingOpportunity,
  markOpportunityCreated,
  removeExpiredOpportunities,
  type ButlerEducationStrategy,
} from "./education/butler-education-gateway"

export {
  buildButlerBehaviorExecution,
  createApproachOffer,
  createFoodOffer,
  createRestOffer,
  type BuildButlerBehaviorExecutionInput,
  type ButlerBehaviorExecution,
  type ButlerBehaviorExecutionKind,
  type ButlerBehaviorExecutionTarget,
} from "./behavior/butler-behavior-gateway"

export {
  buildButlerMessageDecision,
  buildButlerMessageDeliveryDecision,
  type BuildButlerMessageDecisionInput,
  type BuildButlerMessageDeliveryDecisionInput,
  type ButlerMessageDecision,
  type ButlerMessageDecisionPriority,
  type ButlerMessageDecisionReason,
  type ButlerMessageDeliveryBlockReason,
  type ButlerMessageDeliveryDecision,
} from "./message-decision/butler-message-decision-gateway"

export { chooseButlerTask } from "./intention/butler-intention-gateway"

export { deriveButlerMood } from "./intention/butler-intention-gateway"

export {
  buildButlerProfileTaskTuning,
  type ButlerProfileTaskTuning,
} from "./tuning/butler-tuning-gateway"

export {
  buildButlerTaskDecisionTrace,
  type ButlerTaskDecisionGate,
  type ButlerTaskDecisionScore,
  type ButlerTaskDecisionTrace,
} from "./intention/butler-intention-gateway"

export {
  appendButlerMemoryEntry,
  createButlerMemoryEntry,
  createButlerMemoryEntryFromBehaviorExecution,
  createButlerMemoryEntryFromOpportunityFeedback,
  createButlerMemoryEntryFromTaskDecision,
  createInitialButlerMemoryState,
  shouldRememberTaskDecision,
  createInitialButlerRelationState,
  updateButlerRelationFromOpportunityFeedback,
  updateButlerRelationFromBehaviorExecutionMemory,
  updateButlerRelationFromTaskDecision,
  buildButlerExperienceInterpretation,
  buildButlerRelationTaskTuning,
  type ButlerMemoryEntry,
  type ButlerMemoryState,
  type ButlerMemoryType,
  type ButlerOpportunityFeedback,
  type ButlerRelationState,
  type ButlerRelationTone,
  type ButlerExperienceInterpretation,
  type ButlerExperienceInterpreterInput,
  type ButlerRelationTaskTuning,
} from "./memory-relation/butler-memory-relation-gateway"

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
