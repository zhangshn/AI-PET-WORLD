"use client"

/**
 * 当前文件负责：组装紫微动态层的大运、流年、流月、流日、流时测试时间表。
 */

import type { ActiveDynamicFlow } from "../types"
import { BRANCH_LABELS } from "../constants"

import {
  getDayLabel,
  getMonthLabel,
  TIME_BRANCH_ORDER
} from "./dynamic-time/ziwei-time-labels"

import {
  buildDaYunStartAges,
  buildYearRange,
  isDynamicFlowVisible,
  isSelectedDaYunAge
} from "./dynamic-time/ziwei-time-utils"

import { buildDynamicTimeSummary } from "./dynamic-time/ziwei-time-summary"

import { ZiweiTimeCell } from "./dynamic-time/ZiweiTimeCell"
import { ZiweiTimeRow } from "./dynamic-time/ZiweiTimeRow"
import type { ZiweiDynamicTimeSelection } from "./dynamic-time/ziwei-time-types"

export type { ZiweiDynamicTimeSelection } from "./dynamic-time/ziwei-time-types"

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

  const months = Array.from({ length: 12 }, (_, index) => {
    return index + 1
  })

  const days = Array.from({ length: 30 }, (_, index) => {
    return index + 1
  })

  const shouldShowDaYunSelection = isDynamicFlowVisible({
    activeFlow,
    targetFlow: "daYun"
  })

  const shouldShowLiuNianSelection = isDynamicFlowVisible({
    activeFlow,
    targetFlow: "liuNian"
  })

  const shouldShowLiuYueSelection = isDynamicFlowVisible({
    activeFlow,
    targetFlow: "liuYue"
  })

  const shouldShowLiuRiSelection = isDynamicFlowVisible({
    activeFlow,
    targetFlow: "liuRi"
  })

  const shouldShowLiuShiSelection = isDynamicFlowVisible({
    activeFlow,
    targetFlow: "liuShi"
  })

  const currentSummary = buildDynamicTimeSummary({
    activeFlow,
    birthYear,
    startAge,
    selection
  })

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

      <ZiweiTimeRow label="大运">
        {daYunStartAges.map((age) => {
          const startYear = birthYear + age - 1
          const endYear = startYear + 9

          return (
            <ZiweiTimeCell
              key={age}
              title={`${age}-${age + 9}`}
              subtitle={`${startYear}-${endYear}`}
              selected={
                shouldShowDaYunSelection &&
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
      </ZiweiTimeRow>

      <ZiweiTimeRow label="流年">
        {yearRange.map((year) => {
          const isSelectedYear = Number(selection.currentYear) === year

          return (
            <ZiweiTimeCell
              key={year}
              title={String(year)}
              subtitle={`${year - birthYear + 1}岁`}
              selected={shouldShowLiuNianSelection && isSelectedYear}
              onClick={() => {
                onSelectionChange({
                  ...selection,
                  currentYear: year,
                  currentAge: Math.max(1, year - birthYear + 1)
                })
                onActiveFlowChange("liuNian")
              }}
            />
          )
        })}
      </ZiweiTimeRow>

      <ZiweiTimeRow label="流月">
        {months.map((month) => (
          <ZiweiTimeCell
            key={month}
            title={getMonthLabel(month)}
            selected={
              shouldShowLiuYueSelection &&
              Number(selection.currentLunarMonth) === month
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
      </ZiweiTimeRow>

      <ZiweiTimeRow label="流日">
        {days.map((day) => (
          <ZiweiTimeCell
            key={day}
            title={getDayLabel(day)}
            selected={
              shouldShowLiuRiSelection &&
              Number(selection.currentLunarDay) === day
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
      </ZiweiTimeRow>

      <ZiweiTimeRow label="流时">
        {TIME_BRANCH_ORDER.map((branch) => (
          <ZiweiTimeCell
            key={branch}
            title={`${BRANCH_LABELS[branch]}时`}
            subtitle={branch}
            selected={
              shouldShowLiuShiSelection &&
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
      </ZiweiTimeRow>

      <div style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
        {currentSummary}
      </div>
    </div>
  )
}