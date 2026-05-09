/**
 * 当前文件负责：判断管家消息意图是否允许进入未来投递队列。
 *
 * 注意：
 * 这里不发送 P-Phone 消息。
 * 这里只做 delivery boundary 审计。
 */

import type {
  BuildButlerMessageDeliveryDecisionInput,
  ButlerMessageDeliveryDecision,
} from "./butler-message-delivery-schema"

function buildBlockedDeliveryDecision(input: {
  source: BuildButlerMessageDeliveryDecisionInput
  blockReason: ButlerMessageDeliveryDecision["blockReason"]
  tags: string[]
}): ButlerMessageDeliveryDecision {
  const decision = input.source.decision

  return {
    canEnterDeliveryQueue: false,
    blockReason: input.blockReason,
    decisionReason: decision?.reason ?? null,
    priority: decision?.priority ?? null,
    draftText: decision?.draftText ?? null,
    createdAtTick: decision?.createdAtTick ?? input.source.tick,
    checkedAtTick: input.source.tick,
    tags: ["message_delivery", "blocked", ...input.tags],
  }
}

export function buildButlerMessageDeliveryDecision(
  input: BuildButlerMessageDeliveryDecisionInput
): ButlerMessageDeliveryDecision {
  const { decision } = input

  if (!decision) {
    return buildBlockedDeliveryDecision({
      source: input,
      blockReason: "no_decision",
      tags: ["no_decision"],
    })
  }

  if (!decision.shouldContactPlayer || decision.priority === "silent") {
    return buildBlockedDeliveryDecision({
      source: input,
      blockReason: "silent_decision",
      tags: [`reason_${decision.reason}`],
    })
  }

  if (!decision.draftText) {
    return buildBlockedDeliveryDecision({
      source: input,
      blockReason: "missing_draft_text",
      tags: [`reason_${decision.reason}`],
    })
  }

  if (
    decision.cooldownUntilTick !== null &&
    input.tick < decision.cooldownUntilTick
  ) {
    return buildBlockedDeliveryDecision({
      source: input,
      blockReason: "cooling_down",
      tags: [
        `reason_${decision.reason}`,
        `cooldown_until_${decision.cooldownUntilTick}`,
      ],
    })
  }

  if (decision.priority === "low") {
    return buildBlockedDeliveryDecision({
      source: input,
      blockReason: "low_priority_observe_only",
      tags: [`reason_${decision.reason}`, "observe_only"],
    })
  }

  return {
    canEnterDeliveryQueue: true,
    blockReason: "none",
    decisionReason: decision.reason,
    priority: decision.priority,
    draftText: decision.draftText,
    createdAtTick: decision.createdAtTick,
    checkedAtTick: input.tick,
    tags: [
      "message_delivery",
      "allowed",
      `reason_${decision.reason}`,
      `priority_${decision.priority}`,
    ],
  }
}
