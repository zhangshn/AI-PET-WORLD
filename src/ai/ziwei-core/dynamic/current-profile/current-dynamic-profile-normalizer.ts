/**
 * 当前文件负责：提供紫微当前流动人格合成时使用的数值归一化工具。
 */

import type {
  CorePersonality,
  PersonalityTraits
} from "../../schema"

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5
  }

  if (value < 0) {
    return 0
  }

  if (value > 1) {
    return 1
  }

  return Number(value.toFixed(3))
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 50
  }

  if (value < 0) {
    return 0
  }

  if (value > 100) {
    return 100
  }

  return Math.round(value)
}

export function getBiasDelta(bias: number): number {
  return (clampScore(bias) - 50) / 50
}

export function normalizeCorePersonality(
  core: CorePersonality
): CorePersonality {
  return {
    activity: clampUnit(core.activity),
    curiosity: clampUnit(core.curiosity),
    dependency: clampUnit(core.dependency),
    confidence: clampUnit(core.confidence),
    sensitivity: clampUnit(core.sensitivity)
  }
}

export function normalizeTraits(
  traits: PersonalityTraits
): PersonalityTraits {
  const normalized: PersonalityTraits = {
    ...traits
  }

  Object.keys(normalized).forEach((key) => {
    normalized[key] = clampScore(normalized[key])
  })

  return normalized
}