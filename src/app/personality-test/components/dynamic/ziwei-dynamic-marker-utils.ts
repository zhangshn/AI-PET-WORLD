/**
 * 当前文件负责：构建紫微测试盘中的本命、大命、年命、月命、日命、时命标记。
 */

import type {
  ZiweiDynamicChart
} from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

import type { ActiveDynamicFlow } from "../../types"
import type { ZiweiChartFlowMarker } from "../chart/ziwei-chart-types"

function shouldShowMarker(params: {
  markerFlow: ActiveDynamicFlow
  activeFlow: ActiveDynamicFlow
}): boolean {
  const order: ActiveDynamicFlow[] = [
    "natal",
    "daYun",
    "liuNian",
    "liuYue",
    "liuRi",
    "liuShi"
  ]

  const activeIndex = order.indexOf(params.activeFlow)
  const markerIndex = order.indexOf(params.markerFlow)

  if (params.activeFlow === "natal") {
    return params.markerFlow === "natal"
  }

  return markerIndex > 0 && markerIndex <= activeIndex
}

function isMarkerActive(params: {
  markerFlow: ActiveDynamicFlow
  activeFlow: ActiveDynamicFlow
}): boolean {
  const order: ActiveDynamicFlow[] = [
    "natal",
    "daYun",
    "liuNian",
    "liuYue",
    "liuRi",
    "liuShi"
  ]

  const activeIndex = order.indexOf(params.activeFlow)
  const markerIndex = order.indexOf(params.markerFlow)

  if (params.activeFlow === "natal") {
    return params.markerFlow === "natal"
  }

  return markerIndex > 0 && markerIndex <= activeIndex
}

export function buildZiweiFlowMarkers(params: {
  chart: ZiweiDynamicChart
  activeFlow: ActiveDynamicFlow
}): ZiweiChartFlowMarker[] {
  const allMarkers: ZiweiChartFlowMarker[] = [
    {
      kind: "natal",
      label: "本命",
      palace: params.chart.natal.palace,
      active: isMarkerActive({
        markerFlow: "natal",
        activeFlow: params.activeFlow
      }),
      inactive: !params.chart.natal.isActive
    },
    {
      kind: "daYun",
      label: "大命",
      palace: params.chart.daYun.palace,
      active: isMarkerActive({
        markerFlow: "daYun",
        activeFlow: params.activeFlow
      }),
      inactive: !params.chart.daYun.isActive
    },
    {
      kind: "liuNian",
      label: "年命",
      palace: params.chart.liuNian.palace,
      active: isMarkerActive({
        markerFlow: "liuNian",
        activeFlow: params.activeFlow
      }),
      inactive: !params.chart.liuNian.isActive
    },
    {
      kind: "liuYue",
      label: "月命",
      palace: params.chart.liuYue.palace,
      active: isMarkerActive({
        markerFlow: "liuYue",
        activeFlow: params.activeFlow
      }),
      inactive: !params.chart.liuYue.isActive
    },
    {
      kind: "liuRi",
      label: "日命",
      palace: params.chart.liuRi.palace,
      active: isMarkerActive({
        markerFlow: "liuRi",
        activeFlow: params.activeFlow
      }),
      inactive: !params.chart.liuRi.isActive
    },
    {
      kind: "liuShi",
      label: "时命",
      palace: params.chart.liuShi.palace,
      active: isMarkerActive({
        markerFlow: "liuShi",
        activeFlow: params.activeFlow
      }),
      inactive: !params.chart.liuShi.isActive
    }
  ]

  return allMarkers.filter((marker) => {
    return shouldShowMarker({
      markerFlow: marker.kind,
      activeFlow: params.activeFlow
    })
  })
}