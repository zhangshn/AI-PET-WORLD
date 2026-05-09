/**
 * 当前文件负责：定义管家消息投递边界判断的最小类型。
 *
 * delivery decision 不等于真实发送。
 * 它只判断 message decision 是否允许进入未来投递队列。
 */

import type {
  ButlerMessageDecision,
} from "./butler-message-decision-schema"

export type ButlerMessageDeliveryBlockReason =
  | "none"
  | "no_decision"
  | "silent_decision"
  | "missing_draft_text"
  | "cooling_down"
  | "low_priority_observe_only"

export type ButlerMessageDeliveryDecision = {
  canEnterDeliveryQueue: boolean
  blockReason: ButlerMessageDeliveryBlockReason
  decisionReason: ButlerMessageDecision["reason"] | null
  priority: ButlerMessageDecision["priority"] | null
  draftText: string | null
  createdAtTick: number
  checkedAtTick: number
  tags: string[]
}

export type BuildButlerMessageDeliveryDecisionInput = {
  decision: ButlerMessageDecision | null
  tick: number
}
