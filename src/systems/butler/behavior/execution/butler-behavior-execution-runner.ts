/**
 * 当前文件负责：生成管家当前行为执行快照。
 *
 * 注意：
 * 这里不选择任务。
 * 这里不直接修改家园。
 * 这里不改变宠物行为。
 */

import type {
  BuildButlerBehaviorExecutionInput,
  ButlerBehaviorExecution,
} from "./butler-behavior-execution-schema"

import type {
  HomeGoalState,
} from "@/types/home"

function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(100, Math.round(value)))
}

function getTopHomeGoal(
  homeGoals: HomeGoalState[] | undefined
): HomeGoalState | null {
  if (!homeGoals || homeGoals.length === 0) return null

  return homeGoals[0] ?? null
}

function getHomeGoalIntensityBonus(goal: HomeGoalState | null): number {
  if (!goal) return 0

  if (goal.priority === "urgent") return 18
  if (goal.priority === "high") return 10
  if (goal.priority === "medium") return 5

  return 0
}

function getHomeGoalTag(goal: HomeGoalState | null): string {
  if (!goal) return "home_goal_none"

  return `home_goal_${goal.id}`
}

function resolveGoalDrivenHomeExecution(input: {
  goal: HomeGoalState
  baseTags: string[]
  tick: number
}): ButlerBehaviorExecution | null {
  const intensityBonus = getHomeGoalIntensityBonus(input.goal)

  if (input.goal.id === "stabilize_incubator") {
    return {
      kind: "incubator_watch",
      target: "incubator",
      intensity: clampIntensity(62 + intensityBonus),
      canAffectHome: false,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家正在根据家园目标优先稳定孵化器区域。",
      reason: `当前最高家园目标是：${input.goal.title}。${input.goal.reason}`,
      tags: [
        ...input.baseTags,
        "goal_driven_execution",
        getHomeGoalTag(input.goal),
        "incubator_priority",
        "no_pet_control",
      ],
      createdAtTick: input.tick,
    }
  }

  if (input.goal.id === "build_temporary_shelter") {
    return {
      kind: "home_building",
      target: "home",
      intensity: clampIntensity(54 + intensityBonus),
      canAffectHome: true,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家正在根据家园目标推进临时住所。",
      reason: `当前最高家园目标是：${input.goal.title}。${input.goal.reason}`,
      tags: [
        ...input.baseTags,
        "goal_driven_execution",
        getHomeGoalTag(input.goal),
        "home_building",
        "home_effect_allowed",
        "no_pet_control",
      ],
      createdAtTick: input.tick,
    }
  }

  if (input.goal.id === "complete_basic_living") {
    return {
      kind: "home_building",
      target: "home",
      intensity: clampIntensity(50 + intensityBonus),
      canAffectHome: true,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家正在根据家园目标补齐基础生活设施。",
      reason: `当前最高家园目标是：${input.goal.title}。${input.goal.reason}`,
      tags: [
        ...input.baseTags,
        "goal_driven_execution",
        getHomeGoalTag(input.goal),
        "basic_living",
        "home_effect_allowed",
        "no_pet_control",
      ],
      createdAtTick: input.tick,
    }
  }

  if (input.goal.id === "open_garden_area") {
    return {
      kind: "space_tidying",
      target: "garden",
      intensity: clampIntensity(46 + intensityBonus),
      canAffectHome: true,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家正在根据家园目标整理庭院与开放空间。",
      reason: `当前最高家园目标是：${input.goal.title}。${input.goal.reason}`,
      tags: [
        ...input.baseTags,
        "goal_driven_execution",
        getHomeGoalTag(input.goal),
        "garden_opening",
        "home_effect_allowed",
        "no_pet_control",
      ],
      createdAtTick: input.tick,
    }
  }

  if (input.goal.id === "maintain_home_facilities") {
    return {
      kind: "home_maintenance",
      target: "home",
      intensity: clampIntensity(50 + intensityBonus),
      canAffectHome: true,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家正在根据家园目标维护当前设施。",
      reason: `当前最高家园目标是：${input.goal.title}。${input.goal.reason}`,
      tags: [
        ...input.baseTags,
        "goal_driven_execution",
        getHomeGoalTag(input.goal),
        "home_maintenance",
        "home_effect_allowed",
        "no_pet_control",
      ],
      createdAtTick: input.tick,
    }
  }

  if (input.goal.id === "prepare_future_expansion") {
    return {
      kind: "space_tidying",
      target: "world",
      intensity: clampIntensity(38 + intensityBonus),
      canAffectHome: true,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家正在根据家园目标整理未来扩展空间。",
      reason: `当前最高家园目标是：${input.goal.title}。${input.goal.reason}`,
      tags: [
        ...input.baseTags,
        "goal_driven_execution",
        getHomeGoalTag(input.goal),
        "future_expansion",
        "home_effect_allowed",
        "no_pet_control",
      ],
      createdAtTick: input.tick,
    }
  }

  return null
}

function buildBaseTags(input: BuildButlerBehaviorExecutionInput): string[] {
  return [
    "butler_behavior_execution",
    `task_${input.task}`,
    input.educationStrategy
      ? `education_${input.educationStrategy.posture}`
      : "education_none",
    `relation_${input.relation.tone}`,
  ]
}

export function buildButlerBehaviorExecution(
  input: BuildButlerBehaviorExecutionInput
): ButlerBehaviorExecution {
  const topHomeGoal = getTopHomeGoal(input.homeGoals)
  const baseTags = [
    ...buildBaseTags(input),
    getHomeGoalTag(topHomeGoal),
  ]

  const goalDrivenExecution =
    topHomeGoal &&
    (
      input.task === "building_home" ||
      input.task === "watching_incubator" ||
      input.task === "idle" ||
      input.task === "watching_pet"
    )
      ? resolveGoalDrivenHomeExecution({
          goal: topHomeGoal,
          baseTags,
          tick: input.tick,
        })
      : null

  if (goalDrivenExecution) {
    return goalDrivenExecution
  }

  if (input.task === "watching_incubator") {
    return {
      kind: "incubator_watch",
      target: "incubator",
      intensity: clampIntensity(58 + input.relation.careHistory * 0.4),
      canAffectHome: false,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家正在优先看护孵化器，确认胚胎环境稳定。",
      reason: "当前任务是 watching_incubator，孵化器照看优先于家园建设。",
      tags: [...baseTags, "incubator_priority", "no_pet_control"],
      createdAtTick: input.tick,
    }
  }

  if (input.task === "building_home") {
    return {
      kind: "home_building",
      target: "home",
      intensity: clampIntensity(46 + input.relation.careHistory * 0.25),
      canAffectHome: true,
      canAffectPet: false,
      canContactPlayer: false,
      summary: "管家正在把当前精力放在家园建设上。",
      reason: "当前任务是 building_home，行为执行层只生成建设意图快照，不直接修改 homeSystem。",
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
      summary: "管家正在提供照看机会，但不会替宠物做决定。",
      reason: "当前任务是照看机会类任务，宠物是否接受仍由宠物自主判断。",
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
      reason: "当前任务是 watching_pet，行为执行层只表达守护和等待，不控制宠物。",
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
