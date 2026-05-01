"use client"

/**
 * 当前文件负责：展示紫微动态层的大运、流年、流月、流日、流时测试时间表。
 */

import type { BranchPalace } from "../../../ai/ziwei-core/schema"
import type { ActiveDynamicFlow } from "../types"

import {
  BRANCH_LABELS,
  DYNAMIC_FLOW_LABELS
} from "../constants"

export interface ZiweiDynamicTimeSelection {
  currentAge: number
  currentYear: number
  currentLunarMonth: number
  currentLunarDay: number
  currentTimeBranch: BranchPalace
}

const TIME_BRANCH_ORDER: BranchPalace[] = [
  "zi",
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai"
]

function getMonthLabel(month: number): string {
  const labels = [
    "正月",
    "二月",
    "三月",
    "四月",
    "五月",
    "六月",
    "七月",
    "八月",
    "九月",
    "十月",
    "冬月",
    "腊月"
  ]

  return labels[month - 1] ?? `${month}月`
}

function getDayLabel(day: number): string {
  const labels: Record<number, string> = {
    1: "初一",
    2: "初二",
    3: "初三",
    4: "初四",
    5: "初五",
    6: "初六",
    7: "初七",
    8: "初八",
    9: "初九",
    10: "初十",
    11: "十一",
    12: "十二",
    13: "十三",
    14: "十四",
    15: "十五",
    16: "十六",
    17: "十七",
    18: "十八",
    19: "十九",
    20: "二十",
    21: "廿一",
    22: "廿二",
    23: "廿三",
    24: "廿四",
    25: "廿五",
    26: "廿六",
    27: "廿七",
    28: "廿八",
    29: "廿九",
    30: "三十"
  }

  return labels[day] ?? `${day}日`
}

function buildDaYunStartAges(startAge: number): number[] {
  return Array.from({ length: 10 }, (_, index) => {
    return startAge + index * 10
  })
}

function getActiveDaYunStartAge(params: {
  startAge: number
  currentAge: number
}): number {
  if (params.currentAge < params.startAge) {
    return params.startAge
  }

  const offset = Math.floor((params.currentAge - params.startAge) / 10) * 10
  return params.startAge + offset
}

function buildYearRange(params: {
  birthYear: number
  startAge: number
  currentAge: number
}): number[] {
  const baseAge =
    params.currentAge < params.startAge
      ? 1
      : getActiveDaYunStartAge({
          startAge: params.startAge,
          currentAge: params.currentAge
        })

  const startYear = params.birthYear + baseAge - 1

  return Array.from({ length: 12 }, (_, index) => {
    return startYear + index
  })
}

function isSelectedDaYunAge(params: {
  startAge: number
  selectedStartAge: number
  currentAge: number
}): boolean {
  if (params.currentAge < params.startAge) {
    return false
  }

  return (
    params.currentAge >= params.selectedStartAge &&
    params.currentAge <= params.selectedStartAge + 9
  )
}

function TimeCell({
  title,
  subtitle,
  selected,
  disabled,
  onClick
}: {
  title: string
  subtitle?: string
  selected?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        minWidth: 82,
        minHeight: 46,
        padding: "6px 8px",
        border: selected ? "2px solid #722ed1" : "1px solid #ddd",
        background: selected ? "#f9f0ff" : "#fff",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        textAlign: "center",
        lineHeight: 1.4
      }}
    >
      <div style={{ fontWeight: selected ? 700 : 500 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: "#666" }}>
          {subtitle}
        </div>
      )}
    </button>
  )
}

function TimeRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px minmax(0, 1fr)",
        gap: 8,
        alignItems: "center",
        borderTop: "1px solid #eee",
        padding: "8px 0"
      }}
    >
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function ZiweiDynamicTimeTable({
  birthYear,
  startAge,
  selection,
  activeFlow,
  onSelectionChange,
  onActiveFlowChange
}: {
  birthYear: number
  startAge: number
  selection: ZiweiDynamicTimeSelection
  activeFlow: ActiveDynamicFlow
  onSelectionChange: (selection: ZiweiDynamicTimeSelection) => void
  onActiveFlowChange: (flow: ActiveDynamicFlow) => void
}) {
  const daYunStartAges = buildDaYunStartAges(startAge)
  const yearRange = buildYearRange({
    birthYear,
    startAge,
    currentAge: selection.currentAge
  })
  const months = Array.from({ length: 12 }, (_, index) => index + 1)
  const days = Array.from({ length: 30 }, (_, index) => index + 1)

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 10,
        padding: 12,
        background: "#fafafa",
        marginTop: 14
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        动态时间表
      </div>

      <TimeRow label="大运">
        {daYunStartAges.map((age) => {
          const startYear = birthYear + age - 1
          const endYear = startYear + 9

          return (
            <TimeCell
              key={age}
              title={`${age}-${age + 9}`}
              subtitle={`${startYear}-${endYear}`}
              selected={
                activeFlow === "daYun" &&
                isSelectedDaYunAge({
                  startAge,
                  selectedStartAge: age,
                  currentAge: selection.currentAge
                })
              }
              onClick={() => {
                onSelectionChange({
                  ...selection,
                  currentAge: age,
                  currentYear: startYear
                })
                onActiveFlowChange("daYun")
              }}
            />
          )
        })}
      </TimeRow>

      <TimeRow label="流年">
        {yearRange.map((year) => (
          <TimeCell
            key={year}
            title={String(year)}
            subtitle={`${year - birthYear + 1}岁`}
            selected={
              activeFlow === "liuNian" &&
              selection.currentYear === year
            }
            onClick={() => {
              onSelectionChange({
                ...selection,
                currentYear: year,
                currentAge: Math.max(1, year - birthYear + 1)
              })
              onActiveFlowChange("liuNian")
            }}
          />
        ))}
      </TimeRow>

      <TimeRow label="流月">
        {months.map((month) => (
          <TimeCell
            key={month}
            title={getMonthLabel(month)}
            selected={
              activeFlow === "liuYue" &&
              selection.currentLunarMonth === month
            }
            onClick={() => {
              onSelectionChange({
                ...selection,
                currentLunarMonth: month
              })
              onActiveFlowChange("liuYue")
            }}
          />
        ))}
      </TimeRow>

      <TimeRow label="流日">
        {days.map((day) => (
          <TimeCell
            key={day}
            title={getDayLabel(day)}
            selected={
              activeFlow === "liuRi" &&
              selection.currentLunarDay === day
            }
            onClick={() => {
              onSelectionChange({
                ...selection,
                currentLunarDay: day
              })
              onActiveFlowChange("liuRi")
            }}
          />
        ))}
      </TimeRow>

      <TimeRow label="流时">
        {TIME_BRANCH_ORDER.map((branch) => (
          <TimeCell
            key={branch}
            title={`${BRANCH_LABELS[branch]}时`}
            subtitle={branch}
            selected={
              activeFlow === "liuShi" &&
              selection.currentTimeBranch === branch
            }
            onClick={() => {
              onSelectionChange({
                ...selection,
                currentTimeBranch: branch
              })
              onActiveFlowChange("liuShi")
            }}
          />
        ))}
      </TimeRow>

      <div style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
        当前选择：
        {DYNAMIC_FLOW_LABELS[activeFlow] ?? activeFlow}；
        年龄 {selection.currentAge}；
        年份 {selection.currentYear}；
        农历 {selection.currentLunarMonth} 月 {selection.currentLunarDay} 日；
        {BRANCH_LABELS[selection.currentTimeBranch]}时
      </div>
    </div>
  )
}