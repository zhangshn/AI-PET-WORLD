/**
 * 当前文件负责：判断管家是否形成主动联系玩家的意图。
 *
 * 注意：
 * 这里不生成 P-Phone 消息，不写系统日志。
 * 它只生成 message decision，供未来 message delivery / P-Phone 层读取。
 */

import type {
  BuildButlerMessageDecisionInput,
  ButlerMessageDecision,
  ButlerMessageDecisionPriority,
  ButlerMessageDecisionReason,
} from "./butler-message-decision-schema"

function buildSilentDecision(
  input: BuildButlerMessageDecisionInput,
  summary = "当前管家没有形成联系玩家的必要。"
): ButlerMessageDecision {
  return {
    shouldContactPlayer: false,
    priority: "silent",
    reason: "none",
    summary,
    suggestedTone: "quiet",
    sourceTask: input.butler.task,
    relationTone: input.butler.relation.tone,
    educationPosture: input.butler.latestEducationStrategy?.posture ?? null,
    tags: ["message_decision", "silent"],
  }
}

function buildDecision(input: {
  source: BuildButlerMessageDecisionInput
  priority: ButlerMessageDecisionPriority
  reason: ButlerMessageDecisionReason
  summary: string
  suggestedTone: ButlerMessageDecision["suggestedTone"]
  tags: string[]
}): ButlerMessageDecision {
  return {
    shouldContactPlayer: input.priority !== "silent",
    priority: input.priority,
    reason: input.reason,
    summary: input.summary,
    suggestedTone: input.suggestedTone,
    sourceTask: input.source.butler.task,
    relationTone: input.source.butler.relation.tone,
    educationPosture:
      input.source.butler.latestEducationStrategy?.posture ?? null,
    tags: ["message_decision", ...input.tags],
  }
}

function hasRecentRepeatedRejection(
  input: BuildButlerMessageDecisionInput
): boolean {
  const relation = input.butler.relation

  return (
    relation.rejectedOffers >= 3 &&
    relation.rejectedOffers >= relation.successfulOffers + 2
  )
}

function hasStableCareProgress(
  input: BuildButlerMessageDecisionInput
): boolean {
  const relation = input.butler.relation

  return (
    relation.successfulOffers >= 4 &&
    relation.trustEstimate >= 55 &&
    relation.familiarity >= 35
  )
}

function hasCarefulEducationPosture(
  input: BuildButlerMessageDecisionInput
): boolean {
  return (
    input.butler.latestEducationStrategy?.posture === "observe_first" ||
    input.butler.latestEducationStrategy?.posture === "cautious_distance"
  )
}

export function buildButlerMessageDecision(
  input: BuildButlerMessageDecisionInput
): ButlerMessageDecision {
  const { butler } = input
  const latestStrategy = butler.latestEducationStrategy

  if (!latestStrategy) {
    return buildSilentDecision(
      input,
      "当前还没有教育策略快照，管家暂时不主动联系玩家。"
    )
  }

  if (
    hasRecentRepeatedRejection(input) &&
    hasCarefulEducationPosture(input)
  ) {
    return buildDecision({
      source: input,
      priority: "medium",
      reason: "repeated_rejection_observed",
      summary:
        "宠物近期多次没有接受照看机会，管家形成了更谨慎的观察姿态，但不会要求玩家干预。",
      suggestedTone: "careful",
      tags: [
        "repeated_rejection",
        `posture_${latestStrategy.posture}`,
        `relation_${butler.relation.tone}`,
      ],
    })
  }

  if (hasStableCareProgress(input)) {
    return buildDecision({
      source: input,
      priority: "low",
      reason: "stable_care_progress",
      summary:
        "宠物对照看机会的接受经验正在稳定形成，管家可以记录为阶段性照看进展。",
      suggestedTone: "gentle",
      tags: [
        "stable_care",
        `posture_${latestStrategy.posture}`,
        `relation_${butler.relation.tone}`,
      ],
    })
  }

  if (
    butler.task === "offering_approach" &&
    latestStrategy.posture === "cautious_distance"
  ) {
    return buildDecision({
      source: input,
      priority: "low",
      reason: "education_strategy_changed",
      summary:
        "管家检测到靠近需要更谨慎，因此只形成轻量联系意图，不会打断宠物当前自主判断。",
      suggestedTone: "reassuring",
      tags: [
        "approach_boundary",
        "cautious_distance",
        `relation_${butler.relation.tone}`,
      ],
    })
  }

  return buildSilentDecision(input)
}
