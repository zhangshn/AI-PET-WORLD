/**
 * 当前文件负责：组合紫微动态面板的输入状态与计算结果。
 */

import type {
  BirthPattern,
  PersonalityProfile
} from "../../../ai/destiny-core/ziwei-core/schema"

import type {
  ActiveDynamicFlow,
  DynamicGenderInput
} from "../types"

import type { PersonalityTestRuntimeTime } from "../runtime-time/personality-test-runtime-time-types"
import type { ZiweiDynamicTimeSelection } from "../components/ZiweiDynamicTimeTable"

import { useZiweiDynamicResults } from "./useZiweiDynamicResults"

function buildZiweiSelectionFromRuntimeTime(
  runtimeTime: PersonalityTestRuntimeTime
): ZiweiDynamicTimeSelection {
  return {
    currentAge: runtimeTime.currentAge,
    currentYear: runtimeTime.currentYear,
    currentLunarMonth: runtimeTime.currentLunarMonth,
    currentLunarDay: runtimeTime.currentLunarDay,
    currentTimeBranch: runtimeTime.currentTimeBranch,
  }
}

export function useZiweiDynamicPanelState({
  pattern,
  baseProfile,
  hasBirthHour,
  dynamicGender,
  runtimeTime,
  activeFlow,
  onActiveFlowChange,
  onRuntimeTimeChange,
}: {
  pattern: BirthPattern
  baseProfile: PersonalityProfile | null
  hasBirthHour: boolean
  dynamicGender: DynamicGenderInput
  runtimeTime: PersonalityTestRuntimeTime
  activeFlow: ActiveDynamicFlow
  onActiveFlowChange: (flow: ActiveDynamicFlow) => void
  onRuntimeTimeChange: (selection: ZiweiDynamicTimeSelection) => void
}) {
  const timeSelection = buildZiweiSelectionFromRuntimeTime(runtimeTime)

  const dynamicResults = useZiweiDynamicResults({
    pattern,
    baseProfile,
    hasBirthHour,
    dynamicGender,
    activeFlow,
    timeSelection,
  })

  return {
    activeFlow,
    setActiveFlow: onActiveFlowChange,
    timeSelection,
    setTimeSelection: onRuntimeTimeChange,
    ...dynamicResults,
  }
}