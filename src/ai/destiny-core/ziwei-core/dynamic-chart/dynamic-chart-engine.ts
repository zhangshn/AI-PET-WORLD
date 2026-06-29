import type {
  FullZiweiChart,
  FullZiweiDynamicChart,
  FullZiweiDynamicChartInput
} from "../contracts"
import { resolveZiweiPlacementDirection } from "../star-placement/cycle-direction"

import { buildDynamicFlow } from "./dynamic-flow-builder"
import {
  getDaYunPalace,
  getDynamicStartAge,
  getLiuNianPalace,
  getLiuRiPalace,
  getLiuShiPalace,
  getLiuYuePalace
} from "./dynamic-flow-palaces"

export function buildFullZiweiDynamicChart(params: {
  chart: FullZiweiChart
  input: FullZiweiDynamicChartInput
}): FullZiweiDynamicChart {
  const direction = resolveZiweiPlacementDirection({
    yearStem: params.chart.lunarInfo.yearStem,
    gender: params.chart.input.gender
  })
  const startAge = getDynamicStartAge(params.chart.foundation.elementBase)
  const isDaYunStarted = params.input.currentAge >= startAge
  const natalPalace = params.chart.foundation.lifePalace

  const daYunPalace = getDaYunPalace({
    lifePalace: natalPalace,
    direction,
    startAge,
    currentAge: params.input.currentAge
  })
  const liuNianPalace = getLiuNianPalace(params.input.currentYear)
  const liuYuePalace = getLiuYuePalace({
    liuNianPalace,
    currentLunarMonth: params.input.currentLunarMonth
  })
  const liuRiPalace = getLiuRiPalace({
    liuYuePalace,
    currentLunarDay: params.input.currentLunarDay
  })
  const liuShiPalace = getLiuShiPalace({
    liuRiPalace,
    currentTimeBranch: params.input.currentTimeBranch
  })

  return {
    flows: [
      buildDynamicFlow({
        chart: params.chart,
        type: "natal",
        palace: natalPalace,
        isActive: true
      }),
      buildDynamicFlow({
        chart: params.chart,
        type: "daYun",
        palace: daYunPalace,
        isActive: isDaYunStarted,
        inactiveReason: isDaYunStarted
          ? undefined
          : `尚未起运，当前年龄 ${params.input.currentAge} 岁，起运岁数为 ${startAge} 岁。`
      }),
      buildDynamicFlow({
        chart: params.chart,
        type: "liuNian",
        palace: liuNianPalace,
        isActive: true
      }),
      buildDynamicFlow({
        chart: params.chart,
        type: "liuYue",
        palace: liuYuePalace,
        isActive: true
      }),
      buildDynamicFlow({
        chart: params.chart,
        type: "liuRi",
        palace: liuRiPalace,
        isActive: true
      }),
      buildDynamicFlow({
        chart: params.chart,
        type: "liuShi",
        palace: liuShiPalace,
        isActive: true
      })
    ],
    debug: {
      direction,
      startAge,
      currentAge: params.input.currentAge,
      isDaYunStarted
    }
  }
}
