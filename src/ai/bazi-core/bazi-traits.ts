/**
 * 当前文件负责：根据八字动力向量生成 AI 行为标签。
 */

import type {
  BaziBehaviorTag,
  BaziDynamicsVector,
} from "./bazi-types"

function isHigh(value: number): boolean {
  return value >= 62
}

export function buildBaziBehaviorTags(
  dynamics: BaziDynamicsVector
): BaziBehaviorTag[] {
  const tags: BaziBehaviorTag[] = []

  if (isHigh(dynamics.actionIntensity)) tags.push("high_action_release")
  if (isHigh(dynamics.reactionSpeed)) tags.push("fast_reaction")
  if (isHigh(dynamics.sensoryDepth)) tags.push("deep_observer")
  if (isHigh(dynamics.stability)) tags.push("stable_state")
  if (isHigh(dynamics.consistency)) tags.push("consistent_pattern")
  if (isHigh(dynamics.explorationDrive)) tags.push("strong_exploration")
  if (isHigh(dynamics.persistence)) tags.push("persistent_behavior")
  if (isHigh(dynamics.adaptability)) tags.push("adaptive_response")

  if (tags.length === 0) {
    tags.push("balanced_dynamics")
  }

  return tags
}