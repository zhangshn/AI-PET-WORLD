/**
 * 当前文件负责：管理紫微动态面板的当前动态层与时间选择状态。
 */

import { useMemo, useState } from "react"

import type { BirthPattern } from "../../../ai/ziwei-core/schema"

import type { ActiveDynamicFlow } from "../types"

import {
  getTimeBranchFromHour,
  resolveCurrentAge
} from "../utils"

import type { ZiweiDynamicTimeSelection } from "../components/ZiweiDynamicTimeTable"

import { buildInitialTimeSelection } from "../components/dynamic/ziwei-dynamic-helpers"

export function useZiweiDynamicInputState({
  pattern,
  currentYear,
  timelineDay,
  timelineHour
}: {
  pattern: BirthPattern
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

  return {
    activeFlow,
    setActiveFlow,
    timeSelection,
    setTimeSelection
  }
}