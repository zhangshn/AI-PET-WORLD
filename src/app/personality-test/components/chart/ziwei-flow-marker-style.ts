/**
 * 当前文件负责：计算紫微动态命宫标记的展示样式。
 */

import type { ZiweiChartFlowMarker } from "./ziwei-chart-types"

export function getZiweiFlowMarkerColor(marker: ZiweiChartFlowMarker): {
  border: string
  background: string
  color: string
} {
  if (marker.inactive) {
    return {
      border: "#ddd",
      background: "#f5f5f5",
      color: "#999"
    }
  }

  if (marker.active) {
    return {
      border: "#722ed1",
      background: "#722ed1",
      color: "#fff"
    }
  }

  if (marker.kind === "natal") {
    return {
      border: "#ff4d4f",
      background: "#fff1f0",
      color: "#a8071a"
    }
  }

  if (marker.kind === "daYun") {
    return {
      border: "#1677ff",
      background: "#e6f4ff",
      color: "#0958d9"
    }
  }

  if (marker.kind === "liuNian") {
    return {
      border: "#fa8c16",
      background: "#fff7e6",
      color: "#ad4e00"
    }
  }

  if (marker.kind === "liuYue") {
    return {
      border: "#52c41a",
      background: "#f6ffed",
      color: "#237804"
    }
  }

  if (marker.kind === "liuRi") {
    return {
      border: "#13c2c2",
      background: "#e6fffb",
      color: "#006d75"
    }
  }

  return {
    border: "#eb2f96",
    background: "#fff0f6",
    color: "#c41d7f"
  }
}