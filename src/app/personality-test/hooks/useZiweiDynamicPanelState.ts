/**
 * 当前文件负责：集中管理紫微动态面板的动态流、时间选择、命盘结果与影响结果。
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
  ZiweiDynamicChart,
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

import type { ZiweiChartFlowMarker } from "../components/chart/ziwei-chart-types"
import type { ZiweiDynamicTimeSelection } from "../components/ZiweiDynamicTimeTable"

import {
  buildInitialTimeSelection,
  buildZiweiFlowMarkers,
  getActiveFlowResult
} from "../components/dynamic/ziwei-dynamic-helpers"

export function useZiweiDynamicPanelState({
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
  let chartData: ZiweiDynamicChart | null = null

  if (chartResult?.ok) {
    chartData = chartResult.data
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

  return {
    activeFlow,
    setActiveFlow,

    timeSelection,
    setTimeSelection,

    chartResult,
    chartData,
    influenceResult,

    activePalace,
    activeFlowResult,
    flowMarkers,
    startAge,
    isDaYunRequestedButInactive
  }
}