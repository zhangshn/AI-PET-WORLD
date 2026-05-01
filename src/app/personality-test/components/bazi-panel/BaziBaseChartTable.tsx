/**
 * 当前文件负责：展示八字基础排盘表。
 */

import type {
  BaziPillarView,
  BaziProfileView
} from "./bazi-panel-types"

import {
  getBaziElementLabel,
  getBaziYinYangLabel
} from "./bazi-panel-labels"

function getPillars(baziProfile: BaziProfileView): Array<{
  key: string
  label: string
  pillar: BaziPillarView | null
}> {
  return [
    {
      key: "year",
      label: "年柱",
      pillar: baziProfile.chart.yearPillar,
    },
    {
      key: "month",
      label: "月柱",
      pillar: baziProfile.chart.monthPillar,
    },
    {
      key: "day",
      label: "日柱",
      pillar: baziProfile.chart.dayPillar,
    },
    {
      key: "hour",
      label: "时柱",
      pillar: baziProfile.chart.hourPillar ?? null,
    },
  ]
}

function renderPillarValue(
  pillar: BaziPillarView | null,
  field: keyof BaziPillarView
): string {
  if (!pillar) {
    return "未知"
  }

  const value = pillar[field]

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(" / ") : "-"
  }

  if (typeof value === "string") {
    return value
  }

  return "-"
}

export function BaziBaseChartTable({
  baziProfile
}: {
  baziProfile: BaziProfileView
}) {
  const pillars = getPillars(baziProfile)

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
        }}
      >
        <thead>
          <tr>
            <th style={headerCellStyle}>日期</th>
            {pillars.map((item) => (
              <th key={item.key} style={headerCellStyle}>
                {item.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          <tr>
            <td style={labelCellStyle}>柱</td>
            {pillars.map((item) => (
              <td key={item.key} style={mainCellStyle}>
                {item.pillar?.label ?? "未知"}
              </td>
            ))}
          </tr>

          <tr>
            <td style={labelCellStyle}>天干</td>
            {pillars.map((item) => (
              <td key={item.key} style={cellStyle}>
                {renderPillarValue(item.pillar, "stem")}
              </td>
            ))}
          </tr>

          <tr>
            <td style={labelCellStyle}>地支</td>
            {pillars.map((item) => (
              <td key={item.key} style={cellStyle}>
                {renderPillarValue(item.pillar, "branch")}
              </td>
            ))}
          </tr>

          <tr>
            <td style={labelCellStyle}>藏干</td>
            {pillars.map((item) => (
              <td key={item.key} style={cellStyle}>
                {renderPillarValue(item.pillar, "hiddenStems")}
              </td>
            ))}
          </tr>

          <tr>
            <td style={labelCellStyle}>五行</td>
            {pillars.map((item) => (
              <td key={item.key} style={cellStyle}>
                {item.pillar
                  ? `${getBaziElementLabel(item.pillar.stemElement)} / ${getBaziElementLabel(item.pillar.branchElement)}`
                  : "未知"}
              </td>
            ))}
          </tr>

          <tr>
            <td style={labelCellStyle}>阴阳</td>
            {pillars.map((item) => (
              <td key={item.key} style={cellStyle}>
                {getBaziYinYangLabel(item.pillar?.yinYang)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

const headerCellStyle: React.CSSProperties = {
  padding: "10px 8px",
  border: "1px solid #e5e5e5",
  background: "#f7f7f7",
  textAlign: "center",
  fontWeight: 700,
}

const labelCellStyle: React.CSSProperties = {
  padding: "10px 8px",
  border: "1px solid #e5e5e5",
  background: "#fafafa",
  color: "#666",
  fontWeight: 700,
  width: 72,
}

const cellStyle: React.CSSProperties = {
  padding: "10px 8px",
  border: "1px solid #e5e5e5",
  textAlign: "center",
  whiteSpace: "pre-line",
}

const mainCellStyle: React.CSSProperties = {
  ...cellStyle,
  fontWeight: 800,
  fontSize: 18,
}