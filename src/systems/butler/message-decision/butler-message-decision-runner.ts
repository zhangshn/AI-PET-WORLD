/**
 * 当前文件职责：判断管家是否形成主动联系玩家的意图。
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
  first_pet_adoption_observation: 18,
  education_strategy_changed: 12,
  repeated_rejection_observed: 16,
  stable_care_progress: 24,
  protective_boundary_pattern: 10,
  home_goal_execution_observed: 18,
  home_goal_maintenance_observed: 14,
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

function getLatestGoalExecutionMemory(
  input: BuildButlerMessageDecisionInput
) {
  return input.butler.memory.entries.find(
    (entry) =>
      entry.tags.includes("behavior_execution") &&
      entry.tags.includes("goal_driven_execution")
  ) ?? null
}

function getHomeGoalTag(tags: string[]): string | null {
  return tags.find((tag) => tag.startsWith("home_goal_")) ?? null
}

function getGoalMemoryReason(
  tags: string[]
): ButlerMessageDecisionReason {
  if (
    tags.includes("home_maintenance") ||
    tags.includes("home_goal_maintain_home_facilities") ||
    tags.includes("home_goal_stabilize_initial_care")
  ) {
    return "home_goal_maintenance_observed"
  }

  return "home_goal_execution_observed"
}

function buildGoalMemorySummary(input: {
  reason: ButlerMessageDecisionReason
  homeGoalTag: string | null
}): string {
  if (input.reason === "home_goal_maintenance_observed") {
    return "管家近期注意到家园设施、空间或初始照护区需要维护，形成了轻量联系玩家的解释意图。"
  }

  if (input.homeGoalTag === "home_goal_build_temporary_shelter") {
    return "管家近期正在推进临时住所目标，形成了可向玩家解释的家园建设进展。"
  }

  if (input.homeGoalTag === "home_goal_complete_basic_living") {
    return "管家近期正在补齐基础生活设施，形成了可向玩家解释的生活支持进展。"
  }

  if (input.homeGoalTag === "home_goal_open_garden_area") {
    return "管家近期正在整理庭院和开放空间，形成了可向玩家解释的空间扩展进展。"
  }

  if (input.homeGoalTag === "home_goal_prepare_future_expansion") {
    return "管家近期正在为未来世界扩展整理空间，形成了可向玩家解释的准备进展。"
  }

  return "管家近期根据家园目标持续行动，形成了可向玩家解释的阶段性进展。"
}

function buildGoalDraftText(input: {
  reason: ButlerMessageDecisionReason
  homeGoalTag: string | null
}): string {
  if (input.reason === "home_goal_maintenance_observed") {
    return "我注意到家园里有一些设施或空间需要维护。我会先处理这些基础问题，让环境保持稳定。"
  }

  if (input.homeGoalTag === "home_goal_build_temporary_shelter") {
    return "我正在推进临时住所。现在最重要的是先让这个世界有一个能遮蔽、能整理、能继续成长的基础空间。"
  }

  if (input.homeGoalTag === "home_goal_complete_basic_living") {
    return "我在补齐基础生活设施。休息、食物和饮水这些支持能力稳定以后，后续生命关系进入会更安全。"
  }

  if (input.homeGoalTag === "home_goal_open_garden_area") {
    return "我正在整理庭院和开放空间。那里以后会成为观察、探索和扩展世界的重要区域。"
  }

  if (input.homeGoalTag === "home_goal_prepare_future_expansion") {
    return "我在为后续扩展预留空间。现在不会直接打开太多内容，只是先把家园结构整理到可以继续成长的状态。"
  }

  return "我最近在根据当前家园目标持续行动。我会优先处理环境和空间，不会替未来宠物做决定。"
}

function buildDraftText(input: {
  reason: ButlerMessageDecisionReason
  summary: string
  homeGoalTag?: string | null
}): string {
  if (
    input.reason === "home_goal_execution_observed" ||
    input.reason === "home_goal_maintenance_observed"
  ) {
    return buildGoalDraftText({
      reason: input.reason,
      homeGoalTag: input.homeGoalTag ?? null,
    })
  }

  if (input.reason === "repeated_rejection_observed") {
    return "我注意到它最近几次没有接受我的照护机会。我会先放慢靠近和引导的节奏，继续观察它自己的选择。"
  }

  if (input.reason === "stable_care_progress") {
    return "它对一些照护机会开始形成稳定回应了。我会继续保持现在的节奏，让它慢慢把这些经验变成自己的判断。"
  }

  if (input.reason === "education_strategy_changed") {
    return "我刚调整了靠近方式，会更谨慎一些。它现在仍然需要自己判断是否回应，我不会替它做决定。"
  }

  if (input.reason === "protective_boundary_pattern") {
    return "我观察到它在边界附近需要更多确认。我会先守住环境安全，同时尽量不打断它的探索。"
  }

  if (input.reason === "needs_player_attention") {
    return "我认为这件事需要你看一看，但我不会把它当成命令，只会把当前判断告诉你。"
  }

  if (input.reason === "first_pet_adoption_observation") {
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
  homeGoalTag?: string | null
}): ButlerMessageDecision {
  const cooldownTicks =
    MESSAGE_DECISION_COOLDOWN_TICKS[input.reason] ?? 0
  const cooldownUntilTick =
    cooldownTicks > 0 ? input.source.tick + cooldownTicks : null
  const draftText = buildDraftText({
    reason: input.reason,
    summary: input.summary,
    homeGoalTag: input.homeGoalTag ?? null,
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

function shouldReportGoalMemory(
  input: BuildButlerMessageDecisionInput
): boolean {
  const memory = getLatestGoalExecutionMemory(input)

  if (!memory) return false
  if (input.tick - memory.lastUpdatedTick > 6) return false
  if (memory.repeatCount < 2 && memory.importance < 62) return false

  return true
}

function buildGoalMemoryDecision(
  input: BuildButlerMessageDecisionInput
): ButlerMessageDecision | null {
  if (!shouldReportGoalMemory(input)) return null

  const memory = getLatestGoalExecutionMemory(input)
  if (!memory) return null

  const reason = getGoalMemoryReason(memory.tags)
  const homeGoalTag = getHomeGoalTag(memory.tags)

  if (isSameReasonCoolingDown(input, reason)) {
    return buildSilentDecision(
      input,
      "近期已经形成过家园目标执行相关联系意图，当前继续观察，不重复提醒。"
    )
  }

  return buildDecision({
    source: input,
    priority:
      reason === "home_goal_maintenance_observed" ? "medium" : "low",
    reason,
    summary: buildGoalMemorySummary({
      reason,
      homeGoalTag,
    }),
    suggestedTone:
      reason === "home_goal_maintenance_observed" ? "careful" : "gentle",
    homeGoalTag,
    tags: [
      "goal_execution_memory",
      "home_goal_message_context",
      homeGoalTag ?? "home_goal_unknown",
      `relation_${input.butler.relation.tone}`,
      `source_task_${input.butler.task}`,
      memory.tags.includes("no_pet_control")
        ? "no_pet_control"
        : "pet_control_unknown",
    ],
  })
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

  const goalMemoryDecision = buildGoalMemoryDecision(input)
  if (goalMemoryDecision) return goalMemoryDecision

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
        "宠物近期多次没有接受照护机会，管家形成了更谨慎的观察姿态，但不会要求玩家干预。",
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
        "稳定照护进展已经形成过联系意图，当前继续观察，不重复提醒。"
      )
    }

    return buildDecision({
      source: input,
      priority: "low",
      reason: "stable_care_progress",
      summary:
        "宠物对照护机会的接受经验正在稳定形成，管家可以记录为阶段性照护进展。",
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
