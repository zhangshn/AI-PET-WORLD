/**
 * 当前文件负责：组装八字原局与动态运势合并展示面板。
 */

import { useMemo, useState } from "react"
import type { CSSProperties } from "react"

import {
  buildBaziRuntimeProfile,
  type BaziPillar,
  type BaziProfile,
  type BaziRuntimeGender,
  type WuXingElement,
  type BaziRuntimeModifiers
} from "../../../../ai/bazi-core/bazi-gateway"

import type { DynamicGenderInput } from "../../types"

import { InfoCard } from "../common/InfoCard"

import {
  BAZI_RUNTIME_ELEMENT_LABELS,
  BAZI_RUNTIME_MODIFIER_LABELS,
  formatRuntimeScore,
  getBaziRuntimeDirectionLabel,
  getBaziRuntimeGenderLabel
} from "./bazi-runtime-panel-labels"

import { BaziRuntimeTimeSelector } from "./BaziRuntimeTimeSelector"

import type {
  BaziRuntimeActiveLevel,
  BaziRuntimeTimeSelection
} from "./bazi-runtime-panel-types"

function resolveGender(dynamicGender: DynamicGenderInput): BaziRuntimeGender {
  if (dynamicGender === "male" || dynamicGender === "female") {
    return dynamicGender
  }

  return "unknown"
}

function renderPillarLabel(pillar: BaziPillar | null): string {
  return pillar?.label ?? "未知"
}

function renderStem(pillar: BaziPillar | null): string {
  return pillar?.stem ?? "未知"
}

function renderBranch(pillar: BaziPillar | null): string {
  return pillar?.branch ?? "未知"
}

function renderHiddenStems(pillar: BaziPillar | null): string {
  if (!pillar) {
    return "未知"
  }

  return pillar.hiddenStems.length > 0 ? pillar.hiddenStems.join(" / ") : "-"
}

function renderElementLabel(element: WuXingElement): string {
  return BAZI_RUNTIME_ELEMENT_LABELS[element]
}

function renderElementPair(pillar: BaziPillar | null): string {
  if (!pillar) {
    return "未知"
  }

  return `${renderElementLabel(pillar.stemElement)} / ${renderElementLabel(
    pillar.branchElement
  )}`
}

function renderYinYang(pillar: BaziPillar | null): string {
  if (!pillar) {
    return "未知"
  }

  return pillar.yinYang === "yang" ? "阳" : "阴"
}

const ELEMENT_KEYS: WuXingElement[] = [
  "wood",
  "fire",
  "earth",
  "metal",
  "water",
]

const MODIFIER_KEYS: Array<keyof BaziRuntimeModifiers> = [
  "activityModifier",
  "emotionModifier",
  "recoveryModifier",
  "cautionModifier",
  "explorationModifier",
  "perceptionModifier",
]

export function BaziRuntimePanel({
  baziProfile,
  dynamicGender,
  initialYear,
  initialMonth,
  initialDay,
  initialHour
}: {
  baziProfile: BaziProfile
  dynamicGender: DynamicGenderInput
  initialYear: number
  initialMonth: number
  initialDay: number
  initialHour: number | null
}) {
  const [activeLevel, setActiveLevel] =
    useState<BaziRuntimeActiveLevel>("daYun")

  const [selection, setSelection] = useState<BaziRuntimeTimeSelection>({
    currentYear: initialYear,
    currentMonth: initialMonth,
    currentDay: initialDay,
    currentHour: initialHour,
  })

  const runtimeProfile = useMemo(() => {
    return buildBaziRuntimeProfile({
      birthChart: baziProfile.chart,
      gender: resolveGender(dynamicGender),
      currentYear: selection.currentYear,
      currentMonth: selection.currentMonth,
      currentDay: selection.currentDay,
      currentHour: selection.currentHour,
    })
  }, [baziProfile, dynamicGender, selection])

  const mergedRows: Array<{
    key: string
    group: "原局" | "动态"
    label: string
    pillar: BaziPillar | null
    note?: string
  }> = [
    {
      key: "birth-year",
      group: "原局",
      label: "年柱",
      pillar: baziProfile.chart.yearPillar,
    },
    {
      key: "birth-month",
      group: "原局",
      label: "月柱",
      pillar: baziProfile.chart.monthPillar,
    },
    {
      key: "birth-day",
      group: "原局",
      label: "日柱",
      pillar: baziProfile.chart.dayPillar,
    },
    {
      key: "birth-hour",
      group: "原局",
      label: "时柱",
      pillar: baziProfile.chart.hourPillar,
      note: baziProfile.chart.hasHour ? undefined : "出生时辰未知",
    },
    {
      key: "da-yun",
      group: "动态",
      label: "大运",
      pillar: runtimeProfile.daYun.currentDaYun?.pillar ?? null,
      note: runtimeProfile.daYun.currentDaYun
        ? `${runtimeProfile.daYun.currentDaYun.startAge}-${runtimeProfile.daYun.currentDaYun.endAge}岁`
        : "未起运",
    },
    {
      key: "liu-nian",
      group: "动态",
      label: "流年",
      pillar: runtimeProfile.flows.liuNian,
    },
    {
      key: "liu-yue",
      group: "动态",
      label: "流月",
      pillar: runtimeProfile.flows.liuYue,
      note: "按节气月令计算",
    },
    {
      key: "liu-ri",
      group: "动态",
      label: "流日",
      pillar: runtimeProfile.flows.liuRi,
    },
    {
      key: "liu-shi",
      group: "动态",
      label: "流时",
      pillar: runtimeProfile.flows.liuShi,
    },
  ]

  return (
    <InfoCard title="☯ 八字原局与动态运势">
      <div style={summaryGridStyle}>
        <div>
          <strong>当前模式：</strong>
          {baziProfile.mode === "FOUR_PILLARS" ? "四柱" : "三柱"}
        </div>
        <div>
          <strong>能量精度：</strong>
          {baziProfile.precision === "high" ? "高" : "中"}
        </div>
        <div>
          <strong>日主：</strong>
          {baziProfile.dayMaster}
        </div>
        <div>
          <strong>动态性别：</strong>
          {getBaziRuntimeGenderLabel(runtimeProfile.gender)}
        </div>
        <div>
          <strong>大运方向：</strong>
          {getBaziRuntimeDirectionLabel(runtimeProfile.daYun.direction)}
        </div>
        <div>
          <strong>起运岁数：</strong>
          {runtimeProfile.daYun.startAge} 岁
        </div>
        <div>
          <strong>当前年龄：</strong>
          {runtimeProfile.daYun.currentAge} 岁
        </div>
        <div>
          <strong>是否起运：</strong>
          {runtimeProfile.daYun.isStarted ? "是" : "否"}
        </div>
      </div>

      <BaziRuntimeTimeSelector
        runtimeProfile={runtimeProfile}
        activeLevel={activeLevel}
        selection={selection}
        onActiveLevelChange={setActiveLevel}
        onSelectionChange={setSelection}
      />

      <div style={{ marginTop: 16 }}>
        <div style={sectionTitleStyle}>原局 / 大运 / 流年 / 流月 / 流日 / 流时</div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={headerCellStyle}>分组</th>
                <th style={headerCellStyle}>层级</th>
                <th style={headerCellStyle}>干支</th>
                <th style={headerCellStyle}>天干</th>
                <th style={headerCellStyle}>地支</th>
                <th style={headerCellStyle}>藏干</th>
                <th style={headerCellStyle}>五行</th>
                <th style={headerCellStyle}>阴阳</th>
                <th style={headerCellStyle}>说明</th>
              </tr>
            </thead>

            <tbody>
              {mergedRows.map((row) => {
                const isDynamic = row.group === "动态"

                return (
                  <tr
                    key={row.key}
                    style={{
                      background: isDynamic ? "#fbf7ff" : "#fff",
                    }}
                  >
                    <td style={groupCellStyle}>{row.group}</td>
                    <td style={labelCellStyle}>{row.label}</td>
                    <td style={mainCellStyle}>{renderPillarLabel(row.pillar)}</td>
                    <td style={cellStyle}>{renderStem(row.pillar)}</td>
                    <td style={cellStyle}>{renderBranch(row.pillar)}</td>
                    <td style={cellStyle}>{renderHiddenStems(row.pillar)}</td>
                    <td style={cellStyle}>{renderElementPair(row.pillar)}</td>
                    <td style={cellStyle}>{renderYinYang(row.pillar)}</td>
                    <td style={cellStyle}>{row.note ?? "-"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={lowerGridStyle}>
        <div>
          <div style={sectionTitleStyle}>动态环境五行场</div>

          <table style={tableStyle}>
            <thead>
              <tr>
                {ELEMENT_KEYS.map((key) => (
                  <th key={key} style={headerCellStyle}>
                    {BAZI_RUNTIME_ELEMENT_LABELS[key]}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr>
                {ELEMENT_KEYS.map((key) => (
                  <td key={key} style={cellStyle}>
                    {formatRuntimeScore(
                      runtimeProfile.runtimeElementField.elementScores[key]
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <div style={sectionTitleStyle}>动态状态修正</div>

          <table style={tableStyle}>
            <tbody>
              {MODIFIER_KEYS.map((key) => (
                <tr key={key}>
                  <td style={labelCellStyle}>
                    {BAZI_RUNTIME_MODIFIER_LABELS[key]}
                  </td>
                  <td style={cellStyle}>
                    {formatRuntimeScore(runtimeProfile.modifiers[key])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
    </InfoCard>
  )
}

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(140px, 1fr))",
  gap: 10,
  padding: 12,
  border: "1px solid #eee",
  borderRadius: 10,
  background: "#fafafa",
  lineHeight: 1.7,
}

const lowerGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 16,
  marginTop: 16,
}

const sectionTitleStyle: CSSProperties = {
  fontWeight: 800,
  marginBottom: 8,
}

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
}

const headerCellStyle: CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  background: "#f7f7f7",
  textAlign: "center",
}

const groupCellStyle: CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  background: "#fafafa",
  color: "#555",
  fontWeight: 800,
  width: 72,
  textAlign: "center",
}

const labelCellStyle: CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  background: "#fafafa",
  color: "#666",
  fontWeight: 700,
  width: 100,
  textAlign: "center",
}

const cellStyle: CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  textAlign: "center",
  lineHeight: 1.6,
}

const mainCellStyle: CSSProperties = {
  ...cellStyle,
  fontWeight: 800,
  fontSize: 16,
}