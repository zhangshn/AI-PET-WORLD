/**
 * 当前文件负责：组装八字大运、流年、流月、流日、流时动态面板。
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

function renderElementPair(pillar: BaziPillar | null): string {
  if (!pillar) {
    return "未知"
  }

  return `${pillar.stemElement} / ${pillar.branchElement}`
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

  const flowRows: Array<{
    key: string
    label: string
    pillar: BaziPillar | null
  }> = [
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
    <InfoCard title="☯ 八字动态运势">
      <BaziRuntimeTimeSelector
        runtimeProfile={runtimeProfile}
        activeLevel={activeLevel}
        selection={selection}
        onActiveLevelChange={setActiveLevel}
        onSelectionChange={setSelection}
      />

      <div style={{ marginTop: 16 }}>
        <div style={sectionTitleStyle}>大运总览</div>

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
              <td style={mainCellStyle}>
                {runtimeProfile.daYun.currentDaYun?.pillar.label ?? "未起运"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={sectionTitleStyle}>流年 / 流月 / 流日 / 流时</div>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headerCellStyle}>层级</th>
              <th style={headerCellStyle}>干支</th>
              <th style={headerCellStyle}>天干</th>
              <th style={headerCellStyle}>地支</th>
              <th style={headerCellStyle}>五行</th>
            </tr>
          </thead>

          <tbody>
            {flowRows.map((row) => (
              <tr key={row.key}>
                <td style={labelCellStyle}>{row.label}</td>
                <td style={mainCellStyle}>{renderPillarLabel(row.pillar)}</td>
                <td style={cellStyle}>{row.pillar?.stem ?? "未知"}</td>
                <td style={cellStyle}>{row.pillar?.branch ?? "未知"}</td>
                <td style={cellStyle}>{renderElementPair(row.pillar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
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

      <div style={{ marginTop: 16 }}>
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

const labelCellStyle: CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e5e5",
  background: "#fafafa",
  color: "#666",
  fontWeight: 700,
  width: 100,
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