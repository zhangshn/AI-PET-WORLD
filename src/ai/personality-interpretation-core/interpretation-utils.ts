/**
 * 当前文件负责：提供人格解释核心的通用工具函数。
 */

import {
  INTERPRETATION_DEFAULT_SCORE,
  INTERPRETATION_HIGH_SCORE,
  INTERPRETATION_MAX_SCORE,
  INTERPRETATION_MEDIUM_HIGH_SCORE,
  INTERPRETATION_MEDIUM_LOW_SCORE,
  INTERPRETATION_MEDIUM_SCORE,
  INTERPRETATION_MIN_SCORE,
} from "./interpretation-constants"

import type { ScoreLevel } from "./interpretation-schema"

export function clampInterpretationScore(value: number): number {
  return Math.max(
    INTERPRETATION_MIN_SCORE,
    Math.min(INTERPRETATION_MAX_SCORE, Math.round(value))
  )
}

export function averageInterpretationScores(values: number[]): number {
  if (values.length === 0) {
    return INTERPRETATION_DEFAULT_SCORE
  }

  const total = values.reduce((sum, value) => sum + value, 0)

  return clampInterpretationScore(total / values.length)
}

export function weightedInterpretationScore(
  values: Array<{
    score: number
    weight: number
  }>
): number {
  if (values.length === 0) {
    return INTERPRETATION_DEFAULT_SCORE
  }

  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0)

  if (totalWeight <= 0) {
    return INTERPRETATION_DEFAULT_SCORE
  }

  const total = values.reduce(
    (sum, item) => sum + item.score * item.weight,
    0
  )

  return clampInterpretationScore(total / totalWeight)
}

export function resolveInterpretationScoreLevel(score: number): ScoreLevel {
  if (score >= INTERPRETATION_HIGH_SCORE) return "high"
  if (score >= INTERPRETATION_MEDIUM_HIGH_SCORE) return "medium_high"
  if (score >= INTERPRETATION_MEDIUM_SCORE) return "medium"
  if (score >= INTERPRETATION_MEDIUM_LOW_SCORE) return "medium_low"

  return "low"
}

export function getInterpretationScoreLevelLabel(level: ScoreLevel): string {
  const labels: Record<ScoreLevel, string> = {
    high: "很强",
    medium_high: "偏强",
    medium: "中等",
    medium_low: "偏弱",
    low: "较弱",
  }

  return labels[level]
}

export function dedupeInterpretationTexts(texts: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  texts.forEach((text) => {
    const normalized = text.trim()

    if (!normalized || seen.has(normalized)) {
      return
    }

    seen.add(normalized)
    result.push(normalized)
  })

  return result
}

export function buildFinalVectorFingerprint(
  vector: Record<string, number>
): string {
  return Object.entries(vector)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${Math.round(value)}`)
    .join("|")
}