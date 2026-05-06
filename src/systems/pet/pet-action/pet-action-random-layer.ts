/**
 * 当前文件负责：为行为权重加入轻量自然扰动。
 */

import type { PetActionWeights } from "./pet-action-weight-types"

export function applyActionRandomLayer(weights: PetActionWeights) {
  weights.walking += Math.random() * 4
  weights.exploring += Math.random() * 3
  weights.observing += Math.random() * 2
}