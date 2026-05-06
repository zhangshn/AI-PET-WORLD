/**
 * 当前文件负责：把生命阶段映射为候选行为权重。
 */

import type { PetLifePhase } from "../../../types/pet"
import type { PetActionWeights } from "./pet-action-weight-types"

import {
  ACTION_LIFE_PHASE_WEIGHT_TUNING,
} from "./pet-action-tuning"

export function applyActionLifePhaseLayer(
  lifePhase: PetLifePhase,
  weights: PetActionWeights
) {
  const tuning = ACTION_LIFE_PHASE_WEIGHT_TUNING[lifePhase]

  for (const [action, value] of Object.entries(tuning)) {
    const key = action as keyof PetActionWeights
    weights[key] += value ?? 0
  }
}