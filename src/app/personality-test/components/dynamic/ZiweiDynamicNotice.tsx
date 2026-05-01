/**
 * 当前文件负责：展示紫微动态测试中的错误与未起运提示。
 */

import type {
  ZiweiDynamicResult,
  ZiweiDynamicChart,
  ZiweiFlowResult
} from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

export function ZiweiDynamicErrorNotice({
  chartResult
}: {
  chartResult: ZiweiDynamicResult<ZiweiDynamicChart> | null
}) {
  if (!chartResult || chartResult.ok) {
    return null
  }

  return (
    <div
      style={{
        border: "1px solid #ffccc7",
        background: "#fff2f0",
        borderRadius: 8,
        padding: 12,
        color: "#a8071a",
        marginBottom: 16
      }}
    >
      {chartResult.message}
    </div>
  )
}

export function ZiweiDaYunInactiveNotice({
  activeFlowResult,
  visible
}: {
  activeFlowResult: ZiweiFlowResult | null
  visible: boolean
}) {
  if (!visible) {
    return null
  }

  return (
    <div
      style={{
        border: "1px solid #ffe58f",
        background: "#fffbe6",
        borderRadius: 8,
        padding: 12,
        color: "#8c6d1f",
        marginBottom: 16
      }}
    >
      {activeFlowResult?.inactiveReason ??
        "尚未起运，当前仍按本命盘运行。"}
    </div>
  )
}