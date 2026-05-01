/**
 * 当前文件负责：根据当前点击的动态层级生成时间表底部说明。
 */

import type { ActiveDynamicFlow } from "../../types"
import type { ZiweiDynamicTimeSelection } from "./ziwei-time-types"

import {
  BRANCH_LABELS,
  DYNAMIC_FLOW_LABELS
} from "../../constants"

import {
  getDayLabel,
  getMonthLabel
} from "./ziwei-time-labels"

export function buildDynamicTimeSummary(params: {
  activeFlow: ActiveDynamicFlow
  birthYear: number
  startAge: number
  selection: ZiweiDynamicTimeSelection
}): string {
  const { activeFlow, birthYear, startAge, selection } = params

  if (activeFlow === "natal") {
    return "当前选择：本命"
  }

  if (activeFlow === "daYun") {
    const age =
      selection.currentAge < startAge
        ? startAge
        : Math.floor((selection.currentAge - startAge) / 10) * 10 + startAge

    const startYear = birthYear + age - 1
    const endYear = startYear + 9

    return `当前选择：${DYNAMIC_FLOW_LABELS[activeFlow] ?? activeFlow}；年龄段 ${age}-${age + 9}；年份 ${startYear}-${endYear}`
  }

  if (activeFlow === "liuNian") {
    return `当前选择：${DYNAMIC_FLOW_LABELS[activeFlow] ?? activeFlow}；年龄 ${selection.currentAge}；年份 ${selection.currentYear}`
  }

  if (activeFlow === "liuYue") {
    return `当前选择：${DYNAMIC_FLOW_LABELS[activeFlow] ?? activeFlow}；年龄 ${selection.currentAge}；年份 ${selection.currentYear}；农历 ${getMonthLabel(selection.currentLunarMonth)}`
  }

  if (activeFlow === "liuRi") {
    return `当前选择：${DYNAMIC_FLOW_LABELS[activeFlow] ?? activeFlow}；年龄 ${selection.currentAge}；年份 ${selection.currentYear}；农历 ${getMonthLabel(selection.currentLunarMonth)} ${getDayLabel(selection.currentLunarDay)}`
  }

  return `当前选择：${DYNAMIC_FLOW_LABELS[activeFlow] ?? activeFlow}；年龄 ${selection.currentAge}；年份 ${selection.currentYear}；农历 ${getMonthLabel(selection.currentLunarMonth)} ${getDayLabel(selection.currentLunarDay)}；${BRANCH_LABELS[selection.currentTimeBranch]}时`
}