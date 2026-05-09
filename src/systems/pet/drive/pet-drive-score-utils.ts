/**
 * 当前文件负责：提供 drive 分数计算的通用工具。
 */

import type { DriveScores, DriveType } from "./pet-drive-types"

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

export function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function createEmptyScores(): DriveScores {
  return {
    eat: 0,
    rest: 0,
    avoid: 0,
    approach: 0,
    explore: 0,
    observe: 0,
  }
}

export function createEmptyReasons(): Record<DriveType, string[]> {
  return {
    eat: [],
    rest: [],
    avoid: [],
    approach: [],
    explore: [],
    observe: [],
  }
}

export function addScore(
  scores: DriveScores,
  reasons: Record<DriveType, string[]>,
  drive: DriveType,
  amount: number,
  reason: string
) {
  if (amount <= 0) return

  scores[drive] += amount
  reasons[drive].push(`${reason} +${round(amount)}`)
}

export function subtractScore(
  scores: DriveScores,
  reasons: Record<DriveType, string[]>,
  drive: DriveType,
  amount: number,
  reason: string
) {
  if (amount <= 0) return

  scores[drive] -= amount
  reasons[drive].push(`${reason} -${round(amount)}`)
}