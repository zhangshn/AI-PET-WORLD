/**
 * 当前文件负责：展示八字流年、流月、流日、流时。
 */

import type {
  BaziPillar
} from "../../../../ai/bazi-core/bazi-gateway"

import type { BaziRuntimeProfileView } from "./bazi-runtime-panel-types"

function renderPillar(pillar: BaziPillar | null): string {
  return pillar?.label ?? "未知"
}

function renderStemBranch(pillar: BaziPillar | null): string {
  if (!pillar) return "未知"
  return `${pillar.stem} / ${pillar.branch}`
}

function renderElements(pillar: BaziPillar | null): string {
  if (!pillar) return "未知"
  return `${pillar.stemElement} / ${pillar.branchElement}`
}

export function BaziFlowTable({
  runtimeProfile
}: {
  runtimeProfile: BaziRuntimeProfileView
}) {
  const rows = [
    {
      key: "liuNian",
      label: "流年",
      pillar: runtimeProfile.flows.liuNian,
    },
    {
      key: "liuYue",
      label: "流月",
      pillar: runtimeProfile.flows.liuYue,
    },
    {
      key: "liuRi",
      label: "流日",
      pillar: runtimeProfile.flows.liuRi,
    },
    {
      key: "liuShi",
      label: "流时",
      pillar: runtimeProfile.flows.liuShi,
    },
  ]

  return (
    <div style={{ marginTop: 16 }}>
      <div style={sectionTitleStyle}>流年 / 流月 / 流日 / 流时</div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerCellStyle}>层级</th>
            <th style={headerCellStyle}>干支</th>
            <th style={headerCellStyle}>天干 / 地支</th>
            <th style={headerCellStyle}>五行</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            return (
              <tr key={row.key}>
                <td style={labelCellStyle}>{row.label}</td>
                <td style={mainCellStyle}>{renderPillar(row.pillar)}</td>
                <td style={cellStyle}>{renderStemBranch(row.pillar)}</td>
                <td style={cellStyle}>{renderElements(row.pillar)}</td>
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
  textAlign: "center",
  width: 80,
}

const cellStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  textAlign: "center",
}

const mainCellStyle: React.CSSProperties = {
  ...cellStyle,
  fontWeight: 800,
  fontSize: 16,
}