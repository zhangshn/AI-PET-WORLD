/**
 * 当前文件负责：构建紫微测试盘中的本命、大命、年命、月命、日命、时命标记。
 */

import type {
  ZiweiDynamicChart
} from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

import type { ActiveDynamicFlow } from "../../types"
import type { ZiweiChartFlowMarker } from "../chart/ziwei-chart-types"

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