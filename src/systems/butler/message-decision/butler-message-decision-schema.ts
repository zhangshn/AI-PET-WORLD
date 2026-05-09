/**
 * 当前文件负责：定义管家主动消息判断层的最小类型。
 *
 * message decision 不等于 P-Phone 消息。
 * 它只表示管家是否形成“联系玩家”的意图。
 */

import type {
  ButlerEducationStrategy,
  ButlerRelationState,
  ButlerState,
  ButlerTask,
} from "../butler-gateway"

export type ButlerMessageDecisionPriority =
  | "silent"
  | "low"
  | "medium"
  | "high"

export type ButlerMessageDecisionReason =
  | "none"
  | "first_pet_birth_observation"
  | "education_strategy_changed"
  | "repeated_rejection_observed"
  | "stable_care_progress"
  | "protective_boundary_pattern"
  | "needs_player_attention"

export type ButlerMessageDecision = {
  shouldContactPlayer: boolean
  priority: ButlerMessageDecisionPriority
  reason: ButlerMessageDecisionReason
  summary: string
  suggestedTone: "quiet" | "gentle" | "reassuring" | "careful" | "urgent"
  sourceTask: ButlerTask
  relationTone: ButlerRelationState["tone"]
  educationPosture: ButlerEducationStrategy["posture"] | null
  tags: string[]
}

export type BuildButlerMessageDecisionInput = {
  butler: ButlerState
  tick: number
}
