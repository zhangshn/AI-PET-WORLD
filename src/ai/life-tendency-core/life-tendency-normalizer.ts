/**
 * 当前文件负责：提供当前生命趋向合成时使用的数值工具。
 */

import type {
  LifeTendencyLevel,
  LifeTendencyScoreItem
} from "./life-tendency-schema"

export function clampLifeTendencyScore(value: number): number {
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

export function mixLifeTendencyScore(params: {
  ziwei: number | null
  bazi: number
  fiveDimension: number
}): number {
  if (params.ziwei === null) {
    return clampLifeTendencyScore(
      params.bazi * 0.6 +
        params.fiveDimension * 0.4
    )
  }

  return clampLifeTendencyScore(
    params.ziwei * 0.55 +
      params.bazi * 0.3 +
      params.fiveDimension * 0.15
  )
}

export function getLifeTendencyLevel(
  score: number
): LifeTendencyLevel {
  if (score >= 70) {
    return "strong"
  }

  if (score >= 55) {
    return "medium_high"
  }

  if (score >= 45) {
    return "medium"
  }

  if (score >= 30) {
    return "medium_low"
  }

  return "low"
}

export function getTopLifeTendencies(
  items: LifeTendencyScoreItem[],
  limit = 4
): LifeTendencyScoreItem[] {
  return [...items]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}