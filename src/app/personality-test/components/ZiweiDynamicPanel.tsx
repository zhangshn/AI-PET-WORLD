"use client"

/**
 * 当前文件负责：组装紫微命盘动态测试面板。
 */

import { useMemo, useState } from "react"

import {
  buildZiweiDynamicChartOnly,
  buildZiweiDynamicInfluence
} from "../../../ai/ziwei-core/ziwei-gateway"

import type {
  BirthPattern,
  BranchPalace
} from "../../../ai/ziwei-core/schema"

import type {
  ZiweiFlowResult
} from "../../../ai/ziwei-core/dynamic/dynamic-schema"

import type {
  ActiveDynamicFlow,
  DynamicGenderInput
} from "../types"

import {
  getTimeBranchFromHour,
  resolveCurrentAge
} from "../utils"

import { InfoCard } from "./common/InfoCard"
import { ZiweiChartBoard } from "./ZiweiChartBoard"
import { ZiweiDynamicDetail } from "./ZiweiDynamicDetail"
import { ZiweiDynamicTabs } from "./ZiweiDynamicTabs"
import {
  ZiweiDynamicTimeTable,
  type ZiweiDynamicTimeSelection
} from "./ZiweiDynamicTimeTable"

import type { ZiweiChartFlowMarker } from "./chart/ziwei-chart-types"

import { ZiweiBirthSummary } from "./dynamic/ZiweiBirthSummary"
import {
  ZiweiDaYunInactiveNotice,
  ZiweiDynamicErrorNotice
} from "./dynamic/ZiweiDynamicNotice"
import { ZiweiDynamicStatusBar } from "./dynamic/ZiweiDynamicStatusBar"
import {
  buildInitialTimeSelection,
  buildZiweiFlowMarkers,
  getActiveFlowResult
} from "./dynamic/ziwei-dynamic-helpers"

export function ZiweiDynamicPanel({
  pattern,
  hasBirthHour,
  dynamicGender,
  currentYear,
  timelineDay,
  timelineHour
}: {
  pattern: BirthPattern
  hasBirthHour: boolean
  dynamicGender: DynamicGenderInput
  currentYear: number
  timelineDay: number
  timelineHour: number
}) {
  const [activeFlow, setActiveFlow] = useState<ActiveDynamicFlow>("natal")

  const defaultAge = useMemo(() => {
    return resolveCurrentAge(timelineDay)
  }, [timelineDay])

  const defaultTimeBranch = useMemo(() => {
    return getTimeBranchFromHour(timelineHour)
  }, [timelineHour])

  const [timeSelection, setTimeSelection] =
    useState<ZiweiDynamicTimeSelection>(() => {
      return buildInitialTimeSelection({
        currentAge: defaultAge,
        currentYear,
        lunarMonth: pattern.lunarInfo.lunarMonth,
        lunarDay: pattern.lunarInfo.lunarDay,
        currentTimeBranch: defaultTimeBranch
      })
    })

  const chartResult = useMemo(() => {
    if (!hasBirthHour) {
      return null
    }

    return buildZiweiDynamicChartOnly({
      pattern,
      gender: dynamicGender,
      currentAge: timeSelection.currentAge,
      currentYear: timeSelection.currentYear,
      currentLunarMonth: timeSelection.currentLunarMonth,
      currentLunarDay: timeSelection.currentLunarDay,
      currentTimeBranch: timeSelection.currentTimeBranch
    })
  }, [
    hasBirthHour,
    pattern,
    dynamicGender,
    timeSelection
  ])

  const influenceResult = useMemo(() => {
    if (!hasBirthHour) {
      return null
    }

    return buildZiweiDynamicInfluence({
      pattern,
      gender: dynamicGender,
      currentAge: timeSelection.currentAge,
      currentYear: timeSelection.currentYear,
      currentLunarMonth: timeSelection.currentLunarMonth,
      currentLunarDay: timeSelection.currentLunarDay,
      currentTimeBranch: timeSelection.currentTimeBranch
    })
  }, [
    hasBirthHour,
    pattern,
    dynamicGender,
    timeSelection
  ])

  let activePalace: BranchPalace | undefined
  let activeFlowResult: ZiweiFlowResult | null = null
  let flowMarkers: ZiweiChartFlowMarker[] = []

  if (chartResult?.ok) {
    activeFlowResult = getActiveFlowResult(chartResult.data, activeFlow)
    activePalace = activeFlowResult.palace
    flowMarkers = buildZiweiFlowMarkers({
      chart: chartResult.data,
      activeFlow
    })
  }

  const startAge = chartResult?.ok ? chartResult.data.debug.startAge : 1

  const isDaYunRequestedButInactive =
    activeFlow === "daYun" &&
    activeFlowResult !== null &&
    !activeFlowResult.isActive

  return (
    <InfoCard title="🌌 紫微命盘">
      {!hasBirthHour ? (
        <div style={{ color: "#a66", lineHeight: 1.8 }}>
          当前出生时间未知，完整紫微结构暂不参与最终人格融合，也不进入动态运势计算。
        </div>
      ) : (
        <>
          <ZiweiBirthSummary pattern={pattern} />

          <div
            style={{
              borderTop: "1px solid #eee",
              paddingTop: 14,
              marginBottom: 14
            }}
          >
            <ZiweiDynamicStatusBar
              dynamicGender={dynamicGender}
              timeSelection={timeSelection}
              activeFlowResult={activeFlowResult}
            />

            <ZiweiDynamicTabs
              activeFlow={activeFlow}
              onChange={setActiveFlow}
            />

            <ZiweiDynamicErrorNotice chartResult={chartResult} />

            <ZiweiDaYunInactiveNotice
              activeFlowResult={activeFlowResult}
              visible={isDaYunRequestedButInactive}
            />
          </div>

          <ZiweiChartBoard
            pattern={pattern}
            activePalace={activePalace}
            branchToSectorMap={activeFlowResult?.dynamicBranchToSectorMap}
            flowMarkers={flowMarkers}
          />

          {chartResult?.ok && (
            <div style={{ marginTop: 12, color: "#666", lineHeight: 1.8 }}>
              大运方向：{chartResult.data.debug.direction}；起运岁数：
              {chartResult.data.debug.startAge}；当前是否起运：
              {chartResult.data.debug.isDaYunStarted ? "是" : "否"}
            </div>
          )}

          {chartResult?.ok && (
            <ZiweiDynamicTimeTable
              birthYear={currentYear}
              startAge={startAge}
              selection={timeSelection}
              activeFlow={activeFlow}
              onSelectionChange={setTimeSelection}
              onActiveFlowChange={setActiveFlow}
            />
          )}

          {activeFlowResult && influenceResult?.ok && (
            <div style={{ marginTop: 16 }}>
              <ZiweiDynamicDetail
                flow={activeFlowResult}
                influence={influenceResult.data}
              />
            </div>
          )}
        </>
      )}
    </InfoCard>
  )
}