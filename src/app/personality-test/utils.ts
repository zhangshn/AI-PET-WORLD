/**
 * 当前文件负责：提供 personality-test 页面使用的展示与时间工具函数。
 */

import type {
  BranchPalace,
  SectorName,
  StarId
} from "../../ai/ziwei-core/schema"

import {
  BRANCH_LABELS,
  SECTOR_LABELS_FALLBACK,
  TIME_BRANCH_BY_HOUR
} from "./constants"

import {
  DEV_SECTOR_LABELS,
  getDevStarLabel
} from "./devLabels"

export function getSectorLabel(sector: SectorName): string {
  return DEV_SECTOR_LABELS?.[sector] || SECTOR_LABELS_FALLBACK[sector] || sector
}

export function getStarDisplay(starId: StarId): string {
  return `${starId}（${getDevStarLabel(starId)}）`
}

export function clampHour(hour: number): number {
  return ((hour % 24) + 24) % 24
}

export function getTimeBranchFromHour(hour: number): BranchPalace {
  return TIME_BRANCH_BY_HOUR[clampHour(hour)]
}

export function getBranchDisplay(branch: BranchPalace): string {
  return `${branch}（${BRANCH_LABELS[branch]}）`
}

export function resolveCurrentAge(day: number): number {
  return Math.max(1, Math.ceil(day / 365))
}