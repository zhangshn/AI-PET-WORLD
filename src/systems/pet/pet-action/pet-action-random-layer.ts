/**
 * 当前文件负责：为行为权重加入轻量自然扰动。
 */

import type { PetActionWeights } from "./pet-action-weight-types"

import {
  ACTION_RANDOM_TUNING,
} from "./pet-action-tuning"

export function applyActionRandomLayer(weights: PetActionWeights) {
  weights.walking += Math.random() * ACTION_RANDOM_TUNING.walking
  weights.exploring += Math.random() * ACTION_RANDOM_TUNING.exploring
  weights.observing += Math.random() * ACTION_RANDOM_TUNING.observing
}