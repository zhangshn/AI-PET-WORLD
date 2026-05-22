/**
 * 当前文件职责：生成管家当前行为执行快照。
 */

import type {
  BuildButlerBehaviorExecutionInput,
  ButlerBehaviorExecution,
} from "./butler-behavior-execution-schema"

function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getPerceivedHomeGoalTag(
  input: BuildButlerBehaviorExecutionInput
): string {
  return input.butlerWorldPerception?.tags.find((tag) =>
    tag.startsWith("home_goal_")
  ) ?? "home_goal_none"
}

function getPerceivedSignalKindTag(
  input: BuildButlerBehaviorExecutionInput
): string {
  return input.butlerWorldPerception?.tags.find((tag) =>
    tag.startsWith("signal_")
  ) ?? "signal_none"
}

function getPerceptionIntensity(
  input: BuildButlerBehaviorExecutionInput
): number {
  return input.butlerWorldPerception?.perceivedSignals[0]?.intensity ?? 0
}

function buildBaseTags(input: BuildButlerBehaviorExecutionInput): string[] {
  return [
    "butler_behavior_execution",
    `task_${input.task}`,
    input.educationStrategy
      ? `education_${input.educationStrategy.posture}`
      : "education_none",
    `relation_${input.relation.tone}`,
    getPerceivedHomeGoalTag(input),
    getPerceivedSignalKindTag(input),
    "perception_context",
  ]
}

function resolvePerceptionExecution(input: {
  source: BuildButlerBehaviorExecutionInput
  baseTags: string[]
}): ButlerBehaviorExecution | null {
  const perception = input.source.butlerWorldPerception
  const signal = perception?.perceivedSignals[0]
  if (!perception || !signal) return null

  const goalTag = getPerceivedHomeGoalTag(input.source)
  const bonus = Math.max(0, Math.min(18, signal.intensity * 0.18))

  if (
    signal.kind === "maintenance_context" ||
    signal.kind === "care_context" ||
    goalTag === "home_goal_stabilize_initial_care" ||
    goalTag === "home_goal_maintain_home_facilities"
  ) {
    return {
      kind: "home_maintenance",
      target: "home",
      intensity: clampIntensity(48 + bonus),
      canAffectHome: true,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家感知到家园存在维护或初始照护线索。",
      reason: `${perception.summary} 管家将其解释为家园维护倾向。`,
      tags: [
        ...input.baseTags,
        "perception_driven_execution",
        "goal_driven_execution",
        goalTag,
        "home_maintenance",
        "home_effect_allowed",
        "no_pet_control",
      ],
      createdAtTick: input.source.tick,
    }
  }

  if (signal.kind === "construction_context") {
    return {
      kind: "home_building",
      target: "home",
      intensity: clampIntensity(44 + bonus),
      canAffectHome: true,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家感知到家园基础空间正在成长。",
      reason: `${perception.summary} 管家将其解释为建设倾向。`,
      tags: [
        ...input.baseTags,
        "perception_driven_execution",
        "goal_driven_execution",
        goalTag,
        "home_building",
        "home_effect_allowed",
        "no_pet_control",
      ],
      createdAtTick: input.source.tick,
    }
  }

  if (signal.kind === "exploration_context") {
    return {
      kind: "space_tidying",
      target: goalTag === "home_goal_open_garden_area" ? "garden" : "world",
      intensity: clampIntensity(38 + bonus),
      canAffectHome: true,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家感知到家园边界和开放空间正在变化。",
      reason: `${perception.summary} 管家将其解释为空间整理倾向。`,
      tags: [
        ...input.baseTags,
        "perception_driven_execution",
        "goal_driven_execution",
        goalTag,
        "space_tidying",
        "home_effect_allowed",
        "no_pet_control",
      ],
      createdAtTick: input.source.tick,
    }
  }

  return null
}

export function buildButlerBehaviorExecution(
  input: BuildButlerBehaviorExecutionInput
): ButlerBehaviorExecution {
  const baseTags = buildBaseTags(input)
  const perceptionExecution =
    input.task === "building_home" ||
    input.task === "idle" ||
    input.task === "watching_pet"
      ? resolvePerceptionExecution({ source: input, baseTags })
      : null

  if (perceptionExecution) return perceptionExecution

  if (input.task === "building_home") {
    return {
      kind: "home_building",
      target: "home",
      intensity: clampIntensity(
        46 + input.relation.careHistory * 0.25 + getPerceptionIntensity(input) * 0.05
      ),
      canAffectHome: true,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家正在把当前精力放在家园建设上。",
      reason: "当前任务是 building_home，行为执行层只生成建设意图快照。",
      tags: [...baseTags, "home_building", "home_effect_allowed", "no_pet_control"],
      createdAtTick: input.tick,
    }
  }

  if (
    input.task === "offering_food" ||
    input.task === "offering_rest" ||
    input.task === "offering_approach"
  ) {
    return {
      kind: "care_opportunity_support",
      target: "pet",
      intensity: clampIntensity(
        38 +
          input.relation.trustEstimate * 0.25 +
          (input.educationStrategy?.approachIntensityOffset ?? 0)
      ),
      canAffectHome: false,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家正在提供照护机会，但不会替宠物做决定。",
      reason: "当前任务是照护机会类任务，宠物是否接受仍由宠物自主判断。",
      tags: [...baseTags, "care_opportunity", "pet_self_acceptance_required"],
      createdAtTick: input.tick,
    }
  }

  if (input.task === "watching_pet") {
    return {
      kind: "protective_waiting",
      target: "pet",
      intensity: clampIntensity(44 + input.relation.trustEstimate * 0.2),
      canAffectHome: false,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家正在保持观察和保护性等待。",
      reason: "当前任务是 watching_pet，行为执行层只表达守护和等待。",
      tags: [...baseTags, "protective_waiting", "no_pet_control"],
      createdAtTick: input.tick,
    }
  }

  return {
    kind: "idle_observation",
    target: "world",
    intensity: clampIntensity(24 + input.relation.observationCount * 0.2),
    canAffectHome: false,
    canAffectPet: false,
    canContactPlayer: false,
    summary: "管家正在观察世界状态，等待更明确的行动理由。",
    reason: "当前没有需要立即执行的行为，保持轻量观察。",
    tags: [...baseTags, "idle_observation"],
    createdAtTick: input.tick,
  }
}
