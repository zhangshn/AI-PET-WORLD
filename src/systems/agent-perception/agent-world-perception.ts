/**
 * 当前文件职责：把世界事实转换为生命体可感知的环境线索。
 */

import type { HomeGoalState, HomeState } from "@/types/home"

export type WorldSignalKind =
  | "care_context"
  | "maintenance_context"
  | "construction_context"
  | "exploration_context"
  | "background_context"

export type WorldSignal = {
  id: string
  kind: WorldSignalKind
  intensity: number
  summary: string
  facts: string[]
  tags: string[]
}

export type PetPerceptionDriveBias = Partial<{
  eat: number
  rest: number
  avoid: number
  approach: number
  explore: number
  observe: number
}>

export type ButlerWorldPerceptionSnapshot = {
  perceivedSignals: WorldSignal[]
  strongestHomeGoalId: HomeGoalState["id"] | null
  strongestSignalId: string | null
  summary: string
  tags: string[]
}

export type PetWorldPerceptionSnapshot = {
  perceivedSignals: WorldSignal[]
  strongestSignalId: string | null
  summary: string
  tags: string[]
}

function clampSignalValue(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function addDriveBias(
  bias: PetPerceptionDriveBias,
  key: keyof PetPerceptionDriveBias,
  value: number
): void {
  if (!Number.isFinite(value) || value <= 0) return

  bias[key] = clampSignalValue((bias[key] ?? 0) + value)
}

function priorityToIntensity(priority: HomeGoalState["priority"]): number {
  if (priority === "urgent") return 88
  if (priority === "high") return 72
  if (priority === "medium") return 56
  return 34
}

function buildGoalSignal(goal: HomeGoalState): WorldSignal {
  const intensity = priorityToIntensity(goal.priority)
  const base = {
    id: `home_goal_${goal.id}`,
    intensity: clampSignalValue(intensity),
    facts: [goal.title, goal.reason],
    tags: [
      "world_signal",
      "home_goal_signal",
      `home_goal_${goal.id}`,
      "perception_only",
    ],
  }

  if (goal.id === "stabilize_initial_care") {
    return {
      ...base,
      kind: "care_context",
      summary: "初始照护区需要保持稳定。",
    }
  }

  if (goal.id === "maintain_home_facilities") {
    return {
      ...base,
      kind: "maintenance_context",
      summary: "家园设施或空间出现维护需求。",
    }
  }

  if (goal.id === "build_temporary_shelter" || goal.id === "complete_basic_living") {
    return {
      ...base,
      kind: "construction_context",
      summary: "家园基础空间正在成长。",
    }
  }

  return {
    ...base,
    kind: "exploration_context",
    summary: "家园边界和开放空间正在变化。",
  }
}

export function buildWorldSignalsFromHome(home: HomeState | null | undefined): WorldSignal[] {
  if (!home) return []

  const signals: WorldSignal[] = []

  if (home.lifecycle) {
    signals.push({
      id: `home_lifecycle_${home.lifecycle.phase}`,
      kind: "background_context",
      intensity: clampSignalValue(28 + home.lifecycle.phaseProgress * 0.25),
      summary: home.lifecycle.summary,
      facts: [home.lifecycle.mainGoal, home.lifecycle.nextGoal],
      tags: [
        "world_signal",
        "home_lifecycle_signal",
        `home_phase_${home.lifecycle.phase}`,
        "perception_only",
      ],
    })
  }

  for (const goal of home.homeGoals ?? []) {
    signals.push(buildGoalSignal(goal))
  }

  return signals.sort((a, b) => b.intensity - a.intensity).slice(0, 12)
}

export function buildButlerWorldPerception(input: {
  home: HomeState | null | undefined
}): ButlerWorldPerceptionSnapshot {
  const perceivedSignals = buildWorldSignalsFromHome(input.home)
  const strongestSignal = perceivedSignals[0] ?? null
  const goalTag = strongestSignal?.tags.find((tag) => tag.startsWith("home_goal_")) ?? null

  return {
    perceivedSignals,
    strongestHomeGoalId: goalTag
      ? (goalTag.replace("home_goal_", "") as HomeGoalState["id"])
      : null,
    strongestSignalId: strongestSignal?.id ?? null,
    summary: strongestSignal
      ? `管家感知到：${strongestSignal.summary}`
      : "管家暂时没有感知到明确的家园管理线索。",
    tags: [
      "butler_world_perception",
      strongestSignal ? `signal_${strongestSignal.kind}` : "signal_none",
      goalTag ?? "home_goal_none",
      "perception_not_command",
    ],
  }
}

export function buildPetWorldPerception(input: {
  home: HomeState | null | undefined
}): PetWorldPerceptionSnapshot {
  const perceivedSignals = buildWorldSignalsFromHome(input.home).filter(
    (signal) => signal.kind === "exploration_context" || signal.kind === "background_context"
  )
  const strongestSignal = perceivedSignals[0] ?? null

  return {
    perceivedSignals,
    strongestSignalId: strongestSignal?.id ?? null,
    summary: strongestSignal
      ? `宠物可能注意到：${strongestSignal.summary}`
      : "宠物暂时没有明显注意到新的环境线索。",
    tags: ["pet_world_perception", "perception_not_command", "no_behavior_override"],
  }
}

export function buildPetPerceptionDriveBias(
  perception: PetWorldPerceptionSnapshot | null | undefined
): PetPerceptionDriveBias {
  const bias: PetPerceptionDriveBias = {}

  if (!perception || perception.perceivedSignals.length === 0) {
    return bias
  }

  for (const signal of perception.perceivedSignals.slice(0, 4)) {
    const strength = clampSignalValue(signal.intensity) / 100

    if (signal.kind === "exploration_context") {
      addDriveBias(bias, "explore", 5 * strength)
      addDriveBias(bias, "observe", 3 * strength)
    }

    if (signal.kind === "background_context") {
      addDriveBias(bias, "observe", 4 * strength)
      addDriveBias(bias, "rest", 2 * strength)
    }
  }

  return bias
}
