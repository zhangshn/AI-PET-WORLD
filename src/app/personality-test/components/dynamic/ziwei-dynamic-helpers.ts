/**
 * 当前文件负责：提供紫微动态测试面板使用的数据整理函数。
 */

import type {
  BranchPalace
} from "../../../../ai/ziwei-core/schema"

import type {
  ZiweiDynamicChart,
  ZiweiFlowResult
} from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

import type { ActiveDynamicFlow } from "../../types"
import type { ZiweiChartFlowMarker } from "../chart/ziwei-chart-types"
import type { ZiweiDynamicTimeSelection } from "../ZiweiDynamicTimeTable"

export function getActiveFlowResult(
  chart: ZiweiDynamicChart,
  activeFlow: ActiveDynamicFlow
): ZiweiFlowResult {
  return chart[activeFlow]
}

export function buildZiweiFlowMarkers(params: {
  chart: ZiweiDynamicChart
  activeFlow: ActiveDynamicFlow
}): ZiweiChartFlowMarker[] {
  return [
    {
      kind: "natal",
      label: "本命",
      palace: params.chart.natal.palace,
      active: params.activeFlow === "natal",
      inactive: !params.chart.natal.isActive
    },
    {
      kind: "daYun",
      label: "大命",
      palace: params.chart.daYun.palace,
      active: params.activeFlow === "daYun",
      inactive: !params.chart.daYun.isActive
    },
    {
      kind: "liuNian",
      label: "年命",
      palace: params.chart.liuNian.palace,
      active: params.activeFlow === "liuNian",
      inactive: !params.chart.liuNian.isActive
    },
    {
      kind: "liuYue",
      label: "月命",
      palace: params.chart.liuYue.palace,
      active: params.activeFlow === "liuYue",
      inactive: !params.chart.liuYue.isActive
    },
    {
      kind: "liuRi",
      label: "日命",
      palace: params.chart.liuRi.palace,
      active: params.activeFlow === "liuRi",
      inactive: !params.chart.liuRi.isActive
    },
    {
      kind: "liuShi",
      label: "时命",
      palace: params.chart.liuShi.palace,
      active: params.activeFlow === "liuShi",
      inactive: !params.chart.liuShi.isActive
    }
  ]
}

export function buildInitialTimeSelection(params: {
  currentAge: number
  currentYear: number
  lunarMonth: number
  lunarDay: number
  currentTimeBranch: BranchPalace
}): ZiweiDynamicTimeSelection {
  return {
    currentAge: Math.max(1, params.currentAge),
    currentYear: params.currentYear,
    currentLunarMonth: params.lunarMonth,
    currentLunarDay: params.lunarDay,
    currentTimeBranch: params.currentTimeBranch
  }
}