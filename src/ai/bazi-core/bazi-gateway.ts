/**
 * 当前文件负责：提供八字动力系统统一出口。
 */

import type { BaziInput, BaziProfile } from "./bazi-types"
import { calculateBaziChart } from "./bazi-calculator"
import {
  calculateWuXingScore,
  getDominantElements,
  normalizeWuXingScore,
} from "./wuxing"
import {
  buildBaziDynamicsSummary,
  mapWuXingToDynamics,
} from "./bazi-mapper"
import { buildBaziBehaviorTags } from "./bazi-traits"
import { interpretBaziDynamics } from "./bazi-interpreter"

export function buildBaziProfile(input: BaziInput): BaziProfile {
  const chart = calculateBaziChart(input)
  const rawScore = calculateWuXingScore(chart)
  const distribution = normalizeWuXingScore(rawScore)
  const dominantElements = getDominantElements(distribution)
  const dynamics = mapWuXingToDynamics(distribution)
  const behaviorTags = buildBaziBehaviorTags(dynamics)
  const interpretation = interpretBaziDynamics({
    dominantElements,
    dynamics,
    behaviorTags,
  })

  return {
    chart,
    rawScore,
    distribution,
    dynamics,
    dominantElements,
    behaviorTags,
    interpretation,
    summary: buildBaziDynamicsSummary({
      dominantElements,
      dynamics,
    }),
    debug: {
      usedPillars: [
        chart.yearPillar.label,
        chart.monthPillar.label,
        chart.dayPillar.label,
        ...(chart.hourPillar ? [chart.hourPillar.label] : []),
      ],
      note: chart.hasHour
        ? "当前八字计算使用四柱 MVP 算法。"
        : "当前八字计算使用三柱 MVP 算法，适用于用户不知道出生时辰的情况。",
    },
  }
}