/**
 * 当前文件负责：展示八字 AI 动力向量与行为偏置表。
 */

import type { BaziProfileView } from "./bazi-panel-types"

import {
  BAZI_BEHAVIOR_BIAS_LABELS,
  BAZI_DYNAMIC_VECTOR_LABELS,
  formatBaziScore
} from "./bazi-panel-labels"

export function BaziVectorTable({
  baziProfile
}: {
  baziProfile: BaziProfileView
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={sectionTitleStyle}>AI 动力映射</div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerCellStyle}>动力项</th>
            <th style={headerCellStyle}>数值</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(BAZI_DYNAMIC_VECTOR_LABELS).map(([key, label]) => (
            <tr key={key}>
              <td style={labelCellStyle}>{label}</td>
              <td style={cellStyle}>
                {formatBaziScore(baziProfile.dynamicVector?.[key])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ ...tableStyle, marginTop: 10 }}>
        <thead>
          <tr>
            <th style={headerCellStyle}>行为偏置</th>
            <th style={headerCellStyle}>数值</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(BAZI_BEHAVIOR_BIAS_LABELS).map(([key, label]) => (
            <tr key={key}>
              <td style={labelCellStyle}>{label}</td>
              <td style={cellStyle}>
                {formatBaziScore(baziProfile.behaviorBias?.[key])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  marginBottom: 8,
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
}

const headerCellStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  background: "#f7f7f7",
  textAlign: "center",
}

const labelCellStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  background: "#fafafa",
  color: "#666",
  fontWeight: 700,
  width: 120,
}

const cellStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  textAlign: "center",
}