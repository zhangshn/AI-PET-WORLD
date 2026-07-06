import type {
  BranchPalace,
  FullZiweiChart,
  FullZiweiDynamicChart,
  FullZiweiDynamicChartInput
} from "../contracts"
import { resolveZiweiPlacementDirection } from "../star-placement/cycle-direction"

import { buildDynamicFlow } from "./dynamic-flow-builder"
import {
  getLiuNianStem,
  getLiuRiStem,
  getLiuShiStem,
  getLiuYueStem
} from "./dynamic-flow-stems"
import {
  getDaYunPalace,
  getDouJunPalace,
  getDynamicStartAge,
  getLiuNianPalace,
  getLiuRiPalace,
  getLiuShiPalace,
  getLiuYuePalace,
  getXiaoXianDirection,
  getXiaoXianPalace,
  getXiaoXianStartPalace
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
  const birthYearBranch = params.chart.lunarInfo.yearBranch
  const gender = params.chart.input.gender

  if (!birthYearBranch) {
    throw new Error("Missing birth year branch for Xiao Xian calculation.")
  }

  if (!gender) {
    throw new Error("Missing gender for Xiao Xian calculation.")
  }

  const daYunPalace = getDaYunPalace({
    lifePalace: natalPalace,
    direction,
    startAge,
    currentAge: params.input.currentAge
  })
  const liuNianPalace = getLiuNianPalace(params.input.currentYear)
  const douJunPalace = getDouJunPalace({
    liuNianPalace,
    birthLunarMonth: params.chart.lunarInfo.lunarMonth,
    birthTimeBranch: params.chart.lunarInfo.timeBranch
  })
  const liuYuePalace = getLiuYuePalace({
    douJunPalace,
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
  const xiaoXianDirection = getXiaoXianDirection(gender)
  const xiaoXianStartPalace = getXiaoXianStartPalace(birthYearBranch)
  const xiaoXianPalace = getXiaoXianPalace({
    birthYearBranch,
    gender,
    currentAge: params.input.currentAge
  })

  return {
    flows: [
      buildDynamicFlow({
        chart: params.chart,
        type: "natal",
        palace: natalPalace,
        stem: params.chart.lunarInfo.yearStem,
        stemSource: "birthYearStem",
        isActive: true
      }),
      buildDynamicFlow({
        chart: params.chart,
        type: "daYun",
        palace: daYunPalace,
        stem: getPalaceStem(params.chart, daYunPalace),
        stemSource: "dynamicPalaceStem",
        isActive: isDaYunStarted,
        inactiveReason: isDaYunStarted
          ? undefined
          : `尚未起运，当前年龄 ${params.input.currentAge} 岁，起运岁数为 ${startAge} 岁。`
      }),
      buildDynamicFlow({
        chart: params.chart,
        type: "liuNian",
        palace: liuNianPalace,
        stem: getLiuNianStem(params.input.currentYear),
        stemSource: "currentYearStem",
        isActive: true
      }),
      buildDynamicFlow({
        chart: params.chart,
        type: "liuYue",
        palace: liuYuePalace,
        stem: getLiuYueStem({
          currentYear: params.input.currentYear,
          currentLunarMonth: params.input.currentLunarMonth
        }),
        stemSource: "currentMonthStem",
        isActive: true
      }),
      buildDynamicFlow({
        chart: params.chart,
        type: "liuRi",
        palace: liuRiPalace,
        stem: getLiuRiStem({
          currentYear: params.input.currentYear,
          currentLunarMonth: params.input.currentLunarMonth,
          currentLunarDay: params.input.currentLunarDay
        }),
        stemSource: "currentDayStem",
        isActive: true
      }),
      buildDynamicFlow({
        chart: params.chart,
        type: "liuShi",
        palace: liuShiPalace,
        stem: getLiuShiStem({
          currentYear: params.input.currentYear,
          currentLunarMonth: params.input.currentLunarMonth,
          currentLunarDay: params.input.currentLunarDay,
          currentTimeBranch: params.input.currentTimeBranch
        }),
        stemSource: "currentTimeStem",
        isActive: true
      })
    ],
    debug: {
      direction,
      startAge,
      currentAge: params.input.currentAge,
      isDaYunStarted,
      xiaoXianDirection,
      xiaoXianStartPalace,
      xiaoXianPalace,
      douJunPalace
    }
  }
}

function getPalaceStem(
  chart: FullZiweiChart,
  palace: BranchPalace
): FullZiweiChart["palaces"][number]["palaceStem"] {
  const match = chart.palaces.find((item) => item.branch === palace)

  if (!match) {
    throw new Error(`Missing dynamic palace stem for branch: ${palace}`)
  }

  return match.palaceStem
}
