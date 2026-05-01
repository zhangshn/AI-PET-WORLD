/**
 * 当前文件负责：展示八字五行能量与阴阳倾向表。
 */

import type { BaziProfileView } from "./bazi-panel-types"

import {
  BAZI_ELEMENT_LABELS,
  BAZI_YIN_YANG_LABELS,
  formatBaziScore,
  getBaziElementLabel
} from "./bazi-panel-labels"

export function BaziEnergyTable({
  baziProfile
}: {
  baziProfile: BaziProfileView
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={sectionTitleStyle}>能量分布</div>

      <table style={tableStyle}>
        <tbody>
          <tr>
            <td style={labelCellStyle}>主导五行</td>
            <td style={cellStyle}>
              {baziProfile.dominantElements.map(getBaziElementLabel).join(" / ")}
            </td>
          </tr>

          <tr>
            <td style={labelCellStyle}>相对弱项</td>
            <td style={cellStyle}>
              {baziProfile.weakElements && baziProfile.weakElements.length > 0
                ? baziProfile.weakElements.map(getBaziElementLabel).join(" / ")
                : "-"}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ ...tableStyle, marginTop: 10 }}>
        <thead>
          <tr>
            {Object.entries(BAZI_ELEMENT_LABELS).map(([key, label]) => (
              <th key={key} style={headerCellStyle}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {Object.keys(BAZI_ELEMENT_LABELS).map((key) => (
              <td key={key} style={cellStyle}>
                {formatBaziScore(baziProfile.elementScores?.[key])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <table style={{ ...tableStyle, marginTop: 10 }}>
        <thead>
          <tr>
            {Object.entries(BAZI_YIN_YANG_LABELS).map(([key, label]) => (
              <th key={key} style={headerCellStyle}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {Object.keys(BAZI_YIN_YANG_LABELS).map((key) => (
              <td key={key} style={cellStyle}>
                {formatBaziScore(baziProfile.yinYangScores?.[key])}
              </td>
            ))}
          </tr>
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
  width: 88,
}

const cellStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  textAlign: "center",
}