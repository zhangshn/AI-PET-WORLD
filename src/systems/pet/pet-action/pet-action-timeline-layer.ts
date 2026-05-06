/**
 * 当前文件负责：把时间线阶段与轨迹分支映射为候选行为权重。
 */

import type { PetActionWeights } from "./pet-action-weight-types"

export function applyActionTimelineLayer(params: {
  phaseTag: string
  branchTag: string
  restResistance: number
  weights: PetActionWeights
}) {
  const {
    phaseTag,
    branchTag,
    restResistance,
    weights,
  } = params

  if (phaseTag === "sensitive_phase") {
    weights.observing += 12
    weights.alert_idle += 12
    weights.approaching -= 12
    weights.exploring -= 10
  }

  if (phaseTag === "recovery_phase") {
    weights.resting += 18
    weights.sleeping += 10
    weights.exploring -= 12
    weights.approaching -= 6

    if (restResistance >= 80) {
      weights.exploring += 5
      weights.walking += 4
    }
  }

  if (phaseTag === "attachment_phase") {
    weights.approaching += 12
  }

  if (phaseTag === "growth_phase") {
    weights.exploring += 10
    weights.walking += 5
  }

  if (branchTag === "defense") {
    weights.alert_idle += 10
    weights.observing += 8
    weights.exploring -= 10
    weights.approaching -= 8
  }

  if (branchTag === "attachment") {
    weights.approaching += 8
  }

  if (branchTag === "curiosity") {
    weights.exploring += 8
    weights.walking += 4
  }
}