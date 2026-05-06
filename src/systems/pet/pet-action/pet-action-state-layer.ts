/**
 * 当前文件负责：把身体、情绪与关系状态映射为候选行为权重。
 */

import type { PetActionWeights } from "./pet-action-weight-types"

export function applyActionPhysicalLayer(params: {
  energy: number
  hunger: number
  weights: PetActionWeights
}) {
  const { energy, hunger, weights } = params

  if (energy < 20) {
    weights.sleeping += 36
    weights.resting += 18
    weights.exploring -= 28
    weights.approaching -= 12
    weights.walking -= 10
  }

  if (energy < 40) {
    weights.resting += 8
    weights.exploring -= 10
  }

  if (hunger > 70) {
    weights.eating += 32
    weights.exploring -= 12
    weights.approaching -= 6
  }

  if (hunger > 85) {
    weights.eating += 18
    weights.resting += 6
    weights.exploring -= 10
    weights.walking -= 8
  }
}

export function applyActionEmotionRelationLayer(params: {
  emotional: string
  relational: string
  riskTolerance: number
  weights: PetActionWeights
}) {
  const {
    emotional,
    relational,
    riskTolerance,
    weights,
  } = params

  if (emotional === "anxious" || emotional === "irritated") {
    weights.alert_idle += 20
    weights.observing += 14
    weights.approaching -= 12
    weights.exploring -= 10

    if (riskTolerance >= 75) {
      weights.exploring += 6
      weights.walking += 4
    }
  }

  if (emotional === "alert") {
    weights.observing += 10
    weights.alert_idle += 8
  }

  if (relational === "attached" || relational === "secure") {
    weights.approaching += 14
  }

  if (relational === "guarded" || relational === "distant") {
    weights.approaching -= 12
    weights.observing += 8
  }
}