/**
 * 当前文件负责：展示八字动态环境对 AI 状态的修正值。
 */

import type { BaziRuntimeProfileView } from "./bazi-runtime-panel-types"

import {
  BAZI_RUNTIME_MODIFIER_LABELS,
  formatRuntimeScore
} from "./bazi-runtime-panel-labels"

export function BaziRuntimeModifierTable({
  runtimeProfile
}: {
  runtimeProfile: BaziRuntimeProfileView
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={sectionTitleStyle}>动态状态修正</div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerCellStyle}>修正项</th>
            <th style={headerCellStyle}>数值</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(BAZI_RUNTIME_MODIFIER_LABELS).map(([key, label]) => {
            return (
              <tr key={key}>
                <td style={labelCellStyle}>{label}</td>
                <td style={cellStyle}>
                  {formatRuntimeScore(runtimeProfile.modifiers[key])}
                </td>
              </tr>
            )
          })}
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