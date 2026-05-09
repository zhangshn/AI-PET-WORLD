/**
 * 当前文件负责：根据宠物记忆生成目标覆盖项。
 */

import type {
  GoalDraft,
  GoalSystemInput,
} from "./pet-goal-types"

import {
  getGoalEnergy,
  getGoalHunger,
  getGoalMemory,
  getGoalRelation,
} from "./pet-goal-context"

import {
  attachGoalSpatialTarget,
} from "./pet-goal-spatial-layer"

import {
  GOAL_MEMORY_TUNING,
} from "./pet-goal-tuning"

export function buildMemoryGoalOverride(
  input: GoalSystemInput
): GoalDraft | null {
  const time = input.time
  const memory = getGoalMemory(input)
  const energy = getGoalEnergy(input)
  const hunger = getGoalHunger(input)
  const relation = getGoalRelation(input)
  const tuning = GOAL_MEMORY_TUNING

  if (
    (time.period === "Night" || time.hour >= 22 || time.hour <= 5) &&
    memory.worldImpression.nightSafetyBias >=
      tuning.nightSafetyBiasThreshold &&
    energy <= tuning.nightRecoveryEnergyThreshold &&
    hunger < tuning.nightRecoveryHungerLimit
  ) {
    return attachGoalSpatialTarget(input, {
      type: "restore_self",
      priority: "high",
      summary: "记忆表明夜晚恢复通常有效，当前目标偏向夜间回收。",
      source: "memory",
    })
  }

  if (
    memory.worldImpression.explorationConfidence <=
      tuning.explorationLowConfidenceThreshold &&
    energy <= tuning.explorationLowConfidenceEnergyThreshold
  ) {
    return attachGoalSpatialTarget(input, {
      type: "restore_self",
      priority: "high",
      summary: "过去经验表明持续探索代价偏高，当前目标提前转向恢复。",
      source: "memory",
    })
  }

  if (
    memory.worldImpression.observationConfidence >=
      tuning.observationConfidenceThreshold &&
    (relation === "guarded" || relation === "distant")
  ) {
    return attachGoalSpatialTarget(input, {
      type: "observe_boundary",
      priority: "medium",
      summary: "过去经验表明观察通常有效，当前目标倾向先看边界。",
      source: "memory",
    })
  }

  if (
    memory.relationImpression.caretakerTrust >=
      tuning.caretakerTrustThreshold &&
    hunger >= tuning.caretakerTrustHungerThreshold
  ) {
    return attachGoalSpatialTarget(input, {
      type: "satisfy_need",
      priority: "high",
      summary: "记忆表明外部照料在需求升高时可靠，当前目标偏向优先满足身体需要。",
      source: "memory",
    })
  }

  if (
    memory.relationImpression.approachSafety >=
      tuning.approachSafetyThreshold &&
    (relation === "secure" || relation === "attached")
  ) {
    return {
      type: "secure_attachment",
      priority: "medium",
      summary: "靠近经验整体安全，当前目标偏向维持连接。",
      source: "memory",
    }
  }

  if (
    memory.selfImpression.recoveryConfidence >=
      tuning.recoveryConfidenceThreshold &&
    energy <= tuning.recoveryConfidenceEnergyThreshold
  ) {
    return attachGoalSpatialTarget(input, {
      type: "restore_self",
      priority: "high",
      summary: "经验表明恢复通常有效，当前目标更快切到回收自身。",
      source: "memory",
    })
  }

  if (
    memory.selfImpression.rhythmConfidence >=
      tuning.rhythmConfidenceThreshold &&
    time.period === "Night" &&
    energy <= tuning.rhythmEnergyThreshold
  ) {
    return attachGoalSpatialTarget(input, {
      type: "stabilize_state",
      priority: "medium",
      summary: "经验正在形成稳定节律，当前目标偏向顺着夜间节奏维持状态。",
      source: "memory",
    })
  }

  return null
}