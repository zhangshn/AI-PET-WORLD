/**
 * 当前文件负责：展示八字动态环境五行场。
 */

import type { BaziRuntimeProfileView } from "./bazi-runtime-panel-types"
import {
  BAZI_RUNTIME_ELEMENT_LABELS,
  formatRuntimeScore
} from "./bazi-runtime-panel-labels"

export function BaziRuntimeEnergyTable({
  runtimeProfile
}: {
  runtimeProfile: BaziRuntimeProfileView
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={sectionTitleStyle}>动态环境五行场</div>

      <table style={tableStyle}>
        <thead>
          <tr>
            {Object.entries(BAZI_RUNTIME_ELEMENT_LABELS).map(([key, label]) => {
              return (
                <th key={key} style={headerCellStyle}>
                  {label}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            {Object.keys(BAZI_RUNTIME_ELEMENT_LABELS).map((key) => {
              return (
                <td key={key} style={cellStyle}>
                  {formatRuntimeScore(
                    runtimeProfile.runtimeElementField.elementScores[key]
                  )}
                </td>
              )
            })}
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

const cellStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  textAlign: "center",
}