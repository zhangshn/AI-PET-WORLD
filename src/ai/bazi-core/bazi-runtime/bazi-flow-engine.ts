/**
 * 当前文件负责：计算八字流年、流月、流日、流时干支。
 */

import type {
  BaziPillar
} from "../bazi-schema"

import type {
  BaziFlowResult
} from "./bazi-runtime-schema"

import { calculateBaziChart } from "../bazi-calculator"

export function buildBaziFlowResult(params: {
  currentYear: number
  currentMonth: number
  currentDay: number
  currentHour?: number | null
}): BaziFlowResult {
  const chart = calculateBaziChart({
    year: params.currentYear,
    month: params.currentMonth,
    day: params.currentDay,
    hour: params.currentHour ?? null,
  })

  return {
    liuNian: chart.yearPillar,
    liuYue: chart.monthPillar,
    liuRi: chart.dayPillar,
    liuShi: chart.hourPillar,
  }
}

export function getRuntimeFlowPillars(flowResult: BaziFlowResult): BaziPillar[] {
  return [
    flowResult.liuNian,
    flowResult.liuYue,
    flowResult.liuRi,
    ...(flowResult.liuShi ? [flowResult.liuShi] : []),
  ]
}