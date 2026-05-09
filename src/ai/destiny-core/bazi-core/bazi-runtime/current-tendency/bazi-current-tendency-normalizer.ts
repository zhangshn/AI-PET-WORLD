/**
 * 当前文件负责：提供八字当前流动趋向合成时使用的数值归一化工具。
 */

import type {
  WuXingElement,
  WuXingScore
} from "../../bazi-schema"

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

export function getScoreDelta(value: number): number {
  return (clampScore(value) - 50) / 50
}

export function getDominantElements(
  scores: WuXingScore,
  limit = 2
): WuXingElement[] {
  return (Object.keys(scores) as WuXingElement[])
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, limit)
}

export function getWeakElements(
  scores: WuXingScore,
  limit = 2
): WuXingElement[] {
  return (Object.keys(scores) as WuXingElement[])
    .sort((a, b) => scores[a] - scores[b])
    .slice(0, limit)
}