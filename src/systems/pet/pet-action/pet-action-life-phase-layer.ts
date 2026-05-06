/**
 * 当前文件负责：把生命阶段映射为候选行为权重。
 */

import type { PetLifePhase } from "../../../types/pet"
import type { PetActionWeights } from "./pet-action-weight-types"

export function applyActionLifePhaseLayer(
  lifePhase: PetLifePhase,
  weights: PetActionWeights
) {
  if (lifePhase === "newborn") {
    weights.exploring -= 34
    weights.walking -= 18
    weights.observing += 22
    weights.resting += 18
    weights.approaching += 10
  }

  if (lifePhase === "adaptation") {
    weights.exploring -= 22
    weights.walking -= 8
    weights.observing += 18
    weights.resting += 10
  }

  if (lifePhase === "dependent") {
    weights.exploring -= 10
    weights.approaching += 14
    weights.observing += 8
  }

  if (lifePhase === "curious") {
    weights.exploring += 8
    weights.observing += 5
  }
}