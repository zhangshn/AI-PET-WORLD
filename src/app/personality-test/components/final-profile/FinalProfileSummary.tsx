/**
 * 当前文件负责：展示最终融合人格的摘要信息。
 */

import { ValueLine } from "../common/ValueLine"

export function FinalProfileSummary({
  hasBirthHour,
  labels,
  summary
}: {
  hasBirthHour: boolean
  labels: string[]
  summary: string
}) {
  return (
    <div style={{ lineHeight: 1.9 }}>
      <ValueLine
        label="当前模式"
        value={hasBirthHour ? "紫微结构 + 八字动力融合" : "八字三柱动力人格"}
      />
      <ValueLine
        label="人格标签"
        value={labels.join(" / ")}
      />
      <div style={{ marginTop: 8, color: "#555" }}>
        {summary}
      </div>
    </div>
  )
}