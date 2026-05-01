/**
 * 当前文件负责：展示八字动力底盘调试信息表。
 */

import type { BaziProfileView } from "./bazi-panel-types"

export function BaziDebugTable({
  baziProfile
}: {
  baziProfile: BaziProfileView
}) {
  if (!baziProfile.summary && !baziProfile.debug) {
    return null
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={sectionTitleStyle}>调试信息</div>

      <table style={tableStyle}>
        <tbody>
          {baziProfile.summary && (
            <tr>
              <td style={labelCellStyle}>摘要</td>
              <td style={cellStyle}>{baziProfile.summary}</td>
            </tr>
          )}

          {baziProfile.debug?.usedPillars && (
            <tr>
              <td style={labelCellStyle}>使用柱</td>
              <td style={cellStyle}>
                {baziProfile.debug.usedPillars.join(" / ")}
              </td>
            </tr>
          )}

          {typeof baziProfile.debug?.missingHour === "boolean" && (
            <tr>
              <td style={labelCellStyle}>时辰缺失</td>
              <td style={cellStyle}>
                {baziProfile.debug.missingHour ? "是" : "否"}
              </td>
            </tr>
          )}

          {baziProfile.debug?.note && (
            <tr>
              <td style={labelCellStyle}>说明</td>
              <td style={cellStyle}>{baziProfile.debug.note}</td>
            </tr>
          )}
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
  lineHeight: 1.7,
}