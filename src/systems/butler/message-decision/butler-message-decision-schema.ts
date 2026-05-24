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
  | "first_pet_adoption_observation"
  | "education_strategy_changed"
  | "repeated_rejection_observed"
  | "stable_care_progress"
  | "protective_boundary_pattern"
  | "home_goal_execution_observed"
  | "home_goal_maintenance_observed"
  | "needs_player_attention"

export type ButlerMessageDecision = {
  shouldContactPlayer: boolean
  priority: ButlerMessageDecisionPriority
  reason: ButlerMessageDecisionReason
  summary: string

  /**
   * 管家主动消息草稿。
   * 只用于开发审计和未来 message delivery，不代表已经发送。
   */
  draftText: string | null
  suggestedTone: "quiet" | "gentle" | "reassuring" | "careful" | "urgent"
  sourceTask: ButlerTask
  relationTone: ButlerRelationState["tone"]
  educationPosture: ButlerEducationStrategy["posture"] | null

  /**
   * 本次主动消息判断生成时的 tick。
   */
  createdAtTick: number

  /**
   * 相同 reason 的主动消息判断建议冷却到哪个 tick。
   * silent 判断没有冷却。
   */
  cooldownUntilTick: number | null

  tags: string[]
}

export type BuildButlerMessageDecisionInput = {
  butler: ButlerState
  tick: number
}
