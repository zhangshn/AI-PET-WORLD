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

function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(100, Math.round(value)))
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
  const baseTags = buildBaseTags(input)

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
