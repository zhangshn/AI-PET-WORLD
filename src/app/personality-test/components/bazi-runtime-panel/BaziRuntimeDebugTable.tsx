/**
 * 当前文件负责：展示八字动态运行层调试信息。
 */

import type { BaziRuntimeProfileView } from "./bazi-runtime-panel-types"

export function BaziRuntimeDebugTable({
  runtimeProfile
}: {
  runtimeProfile: BaziRuntimeProfileView
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={sectionTitleStyle}>动态调试信息</div>

      <table style={tableStyle}>
        <tbody>
          <tr>
            <td style={labelCellStyle}>使用动态柱</td>
            <td style={cellStyle}>
              {runtimeProfile.debug.usedRuntimePillars.join(" / ")}
            </td>
          </tr>
          <tr>
            <td style={labelCellStyle}>说明</td>
            <td style={cellStyle}>{runtimeProfile.debug.note}</td>
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

const labelCellStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  background: "#fafafa",
  color: "#666",
  fontWeight: 700,
  width: 110,
}

const cellStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  lineHeight: 1.7,
}