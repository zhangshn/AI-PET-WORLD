/**
 * 当前文件负责：组合紫微动态面板的输入状态与计算结果。
 */

import type { BirthPattern } from "../../../ai/ziwei-core/schema"

import type { DynamicGenderInput } from "../types"

import { useZiweiDynamicInputState } from "./useZiweiDynamicInputState"
import { useZiweiDynamicResults } from "./useZiweiDynamicResults"

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
  const {
    activeFlow,
    setActiveFlow,
    timeSelection,
    setTimeSelection
  } = useZiweiDynamicInputState({
    pattern,
    currentYear,
    timelineDay,
    timelineHour
  })

  const dynamicResults = useZiweiDynamicResults({
    pattern,
    hasBirthHour,
    dynamicGender,
    activeFlow,
    timeSelection
  })

  return {
    activeFlow,
    setActiveFlow,
    timeSelection,
    setTimeSelection,
    ...dynamicResults
  }
}