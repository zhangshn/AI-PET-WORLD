/**
 * 当前文件负责：展示八字大运列表与当前大运。
 */

import type { BaziRuntimeProfileView } from "./bazi-runtime-panel-types"
import {
  getBaziRuntimeDirectionLabel,
  getBaziRuntimeGenderLabel
} from "./bazi-runtime-panel-labels"

export function BaziDaYunTable({
  runtimeProfile
}: {
  runtimeProfile: BaziRuntimeProfileView
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={sectionTitleStyle}>大运</div>

      <table style={tableStyle}>
        <tbody>
          <tr>
            <td style={labelCellStyle}>性别</td>
            <td style={cellStyle}>
              {getBaziRuntimeGenderLabel(runtimeProfile.gender)}
            </td>
            <td style={labelCellStyle}>方向</td>
            <td style={cellStyle}>
              {getBaziRuntimeDirectionLabel(runtimeProfile.daYun.direction)}
            </td>
          </tr>
          <tr>
            <td style={labelCellStyle}>起运岁数</td>
            <td style={cellStyle}>{runtimeProfile.daYun.startAge}</td>
            <td style={labelCellStyle}>当前年龄</td>
            <td style={cellStyle}>{runtimeProfile.daYun.currentAge}</td>
          </tr>
          <tr>
            <td style={labelCellStyle}>是否起运</td>
            <td style={cellStyle}>
              {runtimeProfile.daYun.isStarted ? "是" : "否"}
            </td>
            <td style={labelCellStyle}>当前大运</td>
            <td style={cellStyle}>
              {runtimeProfile.daYun.currentDaYun?.pillar.label ?? "未起运"}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headerCellStyle}>序号</th>
              <th style={headerCellStyle}>年龄段</th>
              <th style={headerCellStyle}>年份段</th>
              <th style={headerCellStyle}>大运柱</th>
              <th style={headerCellStyle}>状态</th>
            </tr>
          </thead>
          <tbody>
            {runtimeProfile.daYun.daYunList.map((item) => {
              return (
                <tr
                  key={item.index}
                  style={{
                    background: item.active ? "#f9f0ff" : "#fff"
                  }}
                >
                  <td style={cellStyle}>{item.index + 1}</td>
                  <td style={cellStyle}>
                    {item.startAge}-{item.endAge} 岁
                  </td>
                  <td style={cellStyle}>
                    {item.startYear}-{item.endYear}
                  </td>
                  <td style={mainCellStyle}>{item.pillar.label}</td>
                  <td style={cellStyle}>{item.active ? "当前" : "-"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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

const mainCellStyle: React.CSSProperties = {
  ...cellStyle,
  fontWeight: 800,
  fontSize: 16,
}