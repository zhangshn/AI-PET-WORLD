/**
 * 当前文件负责：根据身体、世界状态、关系与意识核选择基础目标。
 */

import type {
  GoalDraft,
  GoalSystemInput,
} from "./pet-goal-types"

import {
  getGoalBranchTag,
  getGoalEmotion,
  getGoalEnergy,
  getGoalHunger,
  getGoalKernel,
  getGoalPhaseTag,
  getGoalRelation,
} from "./pet-goal-context"

import {
  buildMemoryGoalOverride,
} from "./pet-goal-memory-layer"

import {
  attachGoalSpatialTarget,
} from "./pet-goal-spatial-layer"

import {
  GOAL_BASE_NEED_TUNING,
} from "./pet-goal-tuning"

export function chooseBaseGoal(input: GoalSystemInput): GoalDraft {
  const energy = getGoalEnergy(input)
  const hunger = getGoalHunger(input)
  const emotion = getGoalEmotion(input)
  const relation = getGoalRelation(input)
  const phaseTag = getGoalPhaseTag(input)
  const branchTag = getGoalBranchTag(input)
  const kernel = getGoalKernel(input)
  const tuning = GOAL_BASE_NEED_TUNING

  const memoryOverride = buildMemoryGoalOverride(input)
  if (memoryOverride) return memoryOverride

  if (energy <= tuning.criticalEnergyThreshold) {
    return attachGoalSpatialTarget(input, {
      type: "restore_self",
      priority: "critical",
      summary: "生理状态接近极限，当前目标转为恢复自身。",
      source: "body",
    })
  }

  if (hunger >= tuning.highHungerThreshold) {
    return attachGoalSpatialTarget(input, {
      type: "satisfy_need",
      priority: "high",
      summary: "身体需求上升，当前目标转为满足进食需求。",
      source: "body",
    })
  }

  if (
    emotion === "alert" ||
    emotion === "irritated" ||
    phaseTag === "sensitive_phase" ||
    branchTag === "defense"
  ) {
    if (
      kernel.threatInterpretation === "observe_first" ||
      kernel.threatInterpretation === "stabilize_first"
    ) {
      return attachGoalSpatialTarget(input, {
        type: "observe_boundary",
        priority: "high",
        summary: "当前世界读数偏不稳定，先观察边界而不直接进入。",
        source: "world",
      })
    }

    return {
      type: "preserve_distance",
      priority: "high",
      summary: "当前世界读数偏压迫，先维持距离与边界。",
      source: "world",
    }
  }

  if (
    (relation === "secure" ||
      relation === "attached" ||
      phaseTag === "attachment_phase") &&
    (
      kernel.attachmentApproach === "warm_and_open" ||
      kernel.attachmentApproach === "relationship_as_anchor"
    )
  ) {
    return {
      type: "secure_attachment",
      priority: "medium",
      summary: "当前目标偏向确认连接与维持关系靠近。",
      source: "relation",
    }
  }

  if (
    energy <= tuning.recoveryEnergyThreshold ||
    phaseTag === "recovery_phase"
  ) {
    return attachGoalSpatialTarget(input, {
      type: "restore_self",
      priority: "high",
      summary: "当前目标偏向恢复、回收与重新稳定状态。",
      source: "body",
    })
  }

  if (kernel.coreDrive === "expand" || kernel.coreDrive === "breakthrough") {
    return attachGoalSpatialTarget(input, {
      type: "expand_territory",
      priority: "medium",
      summary: "当前目标偏向向外扩展、试探新边界。",
      source: "consciousness",
    })
  }

  if (kernel.coreDrive === "understand") {
    return attachGoalSpatialTarget(input, {
      type: "observe_boundary",
      priority: "medium",
      summary: "当前目标偏向先理解环境，再决定是否深入。",
      source: "consciousness",
    })
  }

  if (kernel.coreDrive === "stabilize") {
    return attachGoalSpatialTarget(input, {
      type: "stabilize_state",
      priority: "medium",
      summary: "当前目标偏向维持秩序与稳定，不急于外扩。",
      source: "consciousness",
    })
  }

  if (kernel.coreDrive === "connect") {
    return {
      type: "secure_attachment",
      priority: "medium",
      summary: "当前目标偏向寻找连接与可依附的关系锚点。",
      source: "consciousness",
    }
  }

  return {
    type: "idle_drift",
    priority: "low",
    summary: "当前目标较弱，顺着状态缓慢漂移。",
    source: "consciousness",
  }
}