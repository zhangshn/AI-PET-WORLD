/**
 * 当前文件负责：展示紫微动态盘运行状态说明。
 */

import type { ZiweiDynamicChart } from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

export function ZiweiDynamicRuntimeLine({
  chartData
}: {
  chartData: ZiweiDynamicChart | null
}) {
  if (!chartData) {
    return null
  }

  return (
    <div style={{ marginTop: 12, color: "#666", lineHeight: 1.8 }}>
      大运方向：{chartData.debug.direction}；起运岁数：
      {chartData.debug.startAge}；当前是否起运：
      {chartData.debug.isDaYunStarted ? "是" : "否"}
    </div>
  )
}