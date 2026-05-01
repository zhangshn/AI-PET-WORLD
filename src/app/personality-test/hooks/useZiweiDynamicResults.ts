/**
 * 当前文件负责：根据紫微动态输入状态计算动态命盘、动态影响、当前动态层与命宫标记。
 */

import { useMemo } from "react"

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

import type { ZiweiChartFlowMarker } from "../components/chart/ziwei-chart-types"
import type { ZiweiDynamicTimeSelection } from "../components/ZiweiDynamicTimeTable"

import {
  buildZiweiFlowMarkers,
  getActiveFlowResult
} from "../components/dynamic/ziwei-dynamic-helpers"

export function useZiweiDynamicResults({
  pattern,
  hasBirthHour,
  dynamicGender,
  activeFlow,
  timeSelection
}: {
  pattern: BirthPattern
  hasBirthHour: boolean
  dynamicGender: DynamicGenderInput
  activeFlow: ActiveDynamicFlow
  timeSelection: ZiweiDynamicTimeSelection
}) {
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