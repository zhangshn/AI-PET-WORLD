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

import type {
  ButlerMessageDecision,
} from "./butler-message-decision-schema"

function isHomeGoalDecision(
  decision: ButlerMessageDecision
): boolean {
  return (
    decision.reason === "home_goal_execution_observed" ||
    decision.reason === "home_goal_maintenance_observed" ||
    decision.reason === "home_goal_incubator_observed" ||
    decision.tags.includes("home_goal_message_context") ||
    decision.tags.includes("goal_execution_memory")
  )
}

function isHighValueHomeGoalDecision(
  decision: ButlerMessageDecision
): boolean {
  if (!isHomeGoalDecision(decision)) return false

  if (decision.priority === "medium" || decision.priority === "high") {
    return true
  }

  if (decision.reason === "home_goal_maintenance_observed") {
    return true
  }

  if (decision.reason === "home_goal_incubator_observed") {
    return true
  }

  return false
}

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

function buildAllowedDeliveryDecision(input: {
  source: BuildButlerMessageDeliveryDecisionInput
  decision: ButlerMessageDecision
  tags: string[]
}): ButlerMessageDeliveryDecision {
  return {
    canEnterDeliveryQueue: true,
    blockReason: "none",
    decisionReason: input.decision.reason,
    priority: input.decision.priority,
    draftText: input.decision.draftText,
    createdAtTick: input.decision.createdAtTick,
    checkedAtTick: input.source.tick,
    tags: [
      "message_delivery",
      "allowed",
      `reason_${input.decision.reason}`,
      `priority_${input.decision.priority}`,
      ...input.tags,
    ],
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

  if (isHomeGoalDecision(decision)) {
    if (isHighValueHomeGoalDecision(decision)) {
      return buildAllowedDeliveryDecision({
        source: input,
        decision,
        tags: [
          "home_goal_delivery",
          "goal_execution_memory",
          decision.reason === "home_goal_maintenance_observed"
            ? "home_goal_maintenance_delivery"
            : "home_goal_progress_delivery",
          decision.tags.includes("no_pet_control")
            ? "no_pet_control"
            : "pet_control_unknown",
        ],
      })
    }

    return buildBlockedDeliveryDecision({
      source: input,
      blockReason: "home_goal_low_priority_record_only",
      tags: [
        `reason_${decision.reason}`,
        "home_goal_delivery",
        "record_only",
        "low_priority_home_goal",
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

  return buildAllowedDeliveryDecision({
    source: input,
    decision,
    tags: [],
  })
}