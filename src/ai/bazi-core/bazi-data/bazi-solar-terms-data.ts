/**
 * 当前文件负责：提供八字月令使用的节气边界。
 *
 * 当前版本使用工程级固定日期近似：
 * 年柱以立春为界，月柱以十二节为界。
 */

import type { EarthlyBranch } from "../bazi-schema"

export type BaziMonthBoundary = {
  month: number
  day: number
  branch: EarthlyBranch
  monthIndexFromYin: number
  name: string
}

export const BAZI_MONTH_BOUNDARIES: BaziMonthBoundary[] = [
  { month: 2, day: 4, branch: "寅", monthIndexFromYin: 0, name: "立春" },
  { month: 3, day: 6, branch: "卯", monthIndexFromYin: 1, name: "惊蛰" },
  { month: 4, day: 5, branch: "辰", monthIndexFromYin: 2, name: "清明" },
  { month: 5, day: 6, branch: "巳", monthIndexFromYin: 3, name: "立夏" },
  { month: 6, day: 6, branch: "午", monthIndexFromYin: 4, name: "芒种" },
  { month: 7, day: 7, branch: "未", monthIndexFromYin: 5, name: "小暑" },
  { month: 8, day: 8, branch: "申", monthIndexFromYin: 6, name: "立秋" },
  { month: 9, day: 8, branch: "酉", monthIndexFromYin: 7, name: "白露" },
  { month: 10, day: 8, branch: "戌", monthIndexFromYin: 8, name: "寒露" },
  { month: 11, day: 7, branch: "亥", monthIndexFromYin: 9, name: "立冬" },
  { month: 12, day: 7, branch: "子", monthIndexFromYin: 10, name: "大雪" },
  { month: 1, day: 6, branch: "丑", monthIndexFromYin: 11, name: "小寒" },
]

export function isBeforeLiChun(month: number, day: number): boolean {
  return month < 2 || (month === 2 && day < 4)
}

function isAfterOrSameBoundary(input: {
  month: number
  day: number
  boundary: BaziMonthBoundary
}): boolean {
  if (input.month > input.boundary.month) {
    return true
  }

  if (input.month === input.boundary.month) {
    return input.day >= input.boundary.day
  }

  return false
}

export function getBaziMonthBoundary(
  month: number,
  day: number
): BaziMonthBoundary {
  if (month === 1) {
    return day >= 6
      ? BAZI_MONTH_BOUNDARIES[11]
      : BAZI_MONTH_BOUNDARIES[10]
  }

  let current = BAZI_MONTH_BOUNDARIES[10]

  BAZI_MONTH_BOUNDARIES.forEach((boundary) => {
    if (
      boundary.month !== 1 &&
      isAfterOrSameBoundary({
        month,
        day,
        boundary,
      })
    ) {
      current = boundary
    }
  })

  return current
}