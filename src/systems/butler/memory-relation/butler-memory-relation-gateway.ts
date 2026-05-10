/**
 * 当前文件负责：统一导出管家记忆 / 关系层的公开入口。
 *
 * memory-relation 属于第 5 层：记忆 / 关系层。
 * 它只记录管家经历、任务判断、机会反馈、关系变化与经验解释，
 * 不直接执行行为，也不直接决定任务、消息或宠物行为。
 */

export {
  appendButlerMemoryEntry,
  createButlerMemoryEntry,
  createButlerMemoryEntryFromBehaviorExecution,
  createButlerMemoryEntryFromOpportunityFeedback,
  createButlerMemoryEntryFromTaskDecision,
  createInitialButlerMemoryState,
  shouldRememberTaskDecision,
} from "./butler-memory"

export type {
  ButlerMemoryEntry,
  ButlerMemoryState,
  ButlerMemoryType,
} from "./butler-memory"

export {
  createInitialButlerRelationState,
  updateButlerRelationFromOpportunityFeedback,
  updateButlerRelationFromTaskDecision,
} from "./butler-relation"

export type {
  ButlerOpportunityFeedback,
  ButlerRelationState,
  ButlerRelationTone,
} from "./butler-relation"

export {
  buildButlerExperienceInterpretation,
  buildButlerRelationTaskTuning,
} from "./butler-relation-tuning"

export type {
  ButlerExperienceInterpretation,
  ButlerExperienceInterpreterInput,
  ButlerRelationTaskTuning,
} from "./butler-relation-tuning"
