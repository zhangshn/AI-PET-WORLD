/**
 * 当前文件负责：组装八字动力底盘展示面板。
 */

import { InfoCard } from "../common/InfoCard"

import { BaziBaseChartTable } from "./BaziBaseChartTable"
import { BaziDebugTable } from "./BaziDebugTable"
import { BaziEnergyTable } from "./BaziEnergyTable"
import { BaziVectorTable } from "./BaziVectorTable"

import type { BaziProfileView } from "./bazi-panel-types"

export function BaziProfilePanel({
  baziProfile
}: {
  baziProfile: BaziProfileView
}) {
  const modeLabel =
    baziProfile.mode === "FOUR_PILLARS"
      ? "四柱"
      : baziProfile.mode === "THREE_PILLARS"
        ? "三柱"
        : baziProfile.chart.hasHour
          ? "四柱"
          : "三柱"

  const precisionLabel =
    baziProfile.precision === "high"
      ? "高"
      : baziProfile.precision === "medium"
        ? "中"
        : baziProfile.chart.hasHour
          ? "高"
          : "中"

  return (
    <InfoCard title="☯ 八字动力底盘">
      <div style={{ lineHeight: 1.7 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 14,
            fontSize: 14,
          }}
        >
          <tbody>
            <tr>
              <td style={labelCellStyle}>当前模式</td>
              <td style={cellStyle}>{modeLabel}</td>
              <td style={labelCellStyle}>能量精度</td>
              <td style={cellStyle}>{precisionLabel}</td>
            </tr>
            <tr>
              <td style={labelCellStyle}>日主</td>
              <td style={cellStyle}>{baziProfile.dayMaster ?? "-"}</td>
              <td style={labelCellStyle}>时辰</td>
              <td style={cellStyle}>
                {baziProfile.chart.hasHour ? "已知" : "未知"}
              </td>
            </tr>
          </tbody>
        </table>

        <BaziBaseChartTable baziProfile={baziProfile} />
        <BaziEnergyTable baziProfile={baziProfile} />
        <BaziVectorTable baziProfile={baziProfile} />
        <BaziDebugTable baziProfile={baziProfile} />
      </div>
    </InfoCard>
  )
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