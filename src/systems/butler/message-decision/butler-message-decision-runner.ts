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

const MESSAGE_DECISION_COOLDOWN_TICKS: Record<
  ButlerMessageDecisionReason,
  number
> = {
  none: 0,
  first_pet_birth_observation: 18,
  education_strategy_changed: 12,
  repeated_rejection_observed: 16,
  stable_care_progress: 24,
  protective_boundary_pattern: 10,
  needs_player_attention: 8,
}

function isSameReasonCoolingDown(
  input: BuildButlerMessageDecisionInput,
  reason: ButlerMessageDecisionReason
): boolean {
  const previousDecision = input.butler.latestMessageDecision

  if (!previousDecision) return false
  if (previousDecision.reason !== reason) return false
  if (!previousDecision.cooldownUntilTick) return false

  return input.tick < previousDecision.cooldownUntilTick
}

function buildSilentDecision(
  input: BuildButlerMessageDecisionInput,
  summary = "当前管家没有形成联系玩家的必要。"
): ButlerMessageDecision {
  return {
    shouldContactPlayer: false,
    priority: "silent",
    reason: "none",
    summary,
    draftText: null,
    suggestedTone: "quiet",
    sourceTask: input.butler.task,
    relationTone: input.butler.relation.tone,
    educationPosture: input.butler.latestEducationStrategy?.posture ?? null,
    createdAtTick: input.tick,
    cooldownUntilTick: null,
    tags: ["message_decision", "silent"],
  }
}

function buildDraftText(input: {
  reason: ButlerMessageDecisionReason
  suggestedTone: ButlerMessageDecision["suggestedTone"]
  summary: string
}): string {
  if (input.reason === "repeated_rejection_observed") {
    return "我注意到它最近几次没有接受我的照看机会。我会先放慢靠近和引导的节奏，继续观察它自己的选择，不会要求你立刻干预。"
  }

  if (input.reason === "stable_care_progress") {
    return "它对一些照看机会开始形成稳定回应了。我会继续保持现在的节奏，让它慢慢把这些经验变成自己的判断。"
  }

  if (input.reason === "education_strategy_changed") {
    return "我刚调整了靠近方式，会更谨慎一些。它现在仍然需要自己判断是否回应，我不会替它做决定。"
  }

  if (input.reason === "protective_boundary_pattern") {
    return "我观察到它在边界附近需要更多确认。我会先守住环境安全，同时尽量不打断它的探索。"
  }

  if (input.reason === "needs_player_attention") {
    return "我认为这件事需要你看一眼，但我不会把它当成命令，只会把当前判断告诉你。"
  }

  if (input.reason === "first_pet_birth_observation") {
    return "它刚来到这个世界，我会先保持观察，让它自己适应周围环境。"
  }

  return input.summary
}

function buildDecision(input: {
  source: BuildButlerMessageDecisionInput
  priority: ButlerMessageDecisionPriority
  reason: ButlerMessageDecisionReason
  summary: string
  suggestedTone: ButlerMessageDecision["suggestedTone"]
  tags: string[]
}): ButlerMessageDecision {
  const cooldownTicks =
    MESSAGE_DECISION_COOLDOWN_TICKS[input.reason] ?? 0

  const cooldownUntilTick =
    cooldownTicks > 0 ? input.source.tick + cooldownTicks : null
  const draftText = buildDraftText({
    reason: input.reason,
    suggestedTone: input.suggestedTone,
    summary: input.summary,
  })

  return {
    shouldContactPlayer: input.priority !== "silent",
    priority: input.priority,
    reason: input.reason,
    summary: input.summary,
    draftText,
    suggestedTone: input.suggestedTone,
    sourceTask: input.source.butler.task,
    relationTone: input.source.butler.relation.tone,
    educationPosture:
      input.source.butler.latestEducationStrategy?.posture ?? null,
    createdAtTick: input.source.tick,
    cooldownUntilTick,
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
    if (isSameReasonCoolingDown(input, "repeated_rejection_observed")) {
      return buildSilentDecision(
        input,
        "近期已经形成过重复拒绝相关联系意图，当前仍处于冷却观察中。"
      )
    }

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
    if (isSameReasonCoolingDown(input, "stable_care_progress")) {
      return buildSilentDecision(
        input,
        "稳定照看进展已经形成过联系意图，当前继续观察，不重复提醒。"
      )
    }

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
    if (isSameReasonCoolingDown(input, "education_strategy_changed")) {
      return buildSilentDecision(
        input,
        "靠近策略变化已经形成过联系意图，当前不重复提醒。"
      )
    }

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
