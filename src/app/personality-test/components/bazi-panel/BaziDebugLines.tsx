/**
 * 当前文件负责：展示八字动力底盘调试信息。
 */

import { ValueLine } from "../common/ValueLine"

export function BaziDebugLines({
  summary,
  debug
}: {
  summary?: string
  debug?: {
    usedPillars?: string[]
    missingHour?: boolean
    note?: string
  }
}) {
  if (!summary && !debug) {
    return null
  }

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px solid #eee",
        lineHeight: 1.8
      }}
    >
      <strong>调试信息</strong>

      {summary && (
        <div style={{ marginTop: 8, color: "#555" }}>
          {summary}
        </div>
      )}

      {debug?.usedPillars && (
        <ValueLine
          label="使用柱"
          value={debug.usedPillars.join(" / ")}
        />
      )}

      {typeof debug?.missingHour === "boolean" && (
        <ValueLine
          label="时辰缺失"
          value={debug.missingHour ? "是" : "否"}
        />
      )}

      {debug?.note && (
        <div style={{ color: "#888", marginTop: 6 }}>
          {debug.note}
        </div>
      )}
    </div>
  )
}