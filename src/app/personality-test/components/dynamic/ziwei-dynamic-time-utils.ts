/**
 * 当前文件负责：构建紫微动态测试面板的初始时间选择状态。
 */

import type { BranchPalace } from "../../../../ai/ziwei-core/schema"
import type { ZiweiDynamicTimeSelection } from "../ZiweiDynamicTimeTable"

export function buildInitialTimeSelection(params: {
  currentAge: number
  currentYear: number
  lunarMonth: number
  lunarDay: number
  currentTimeBranch: BranchPalace
}): ZiweiDynamicTimeSelection {
  return {
    currentAge: Math.max(1, params.currentAge),
    currentYear: params.currentYear,
    currentLunarMonth: params.lunarMonth,
    currentLunarDay: params.lunarDay,
    currentTimeBranch: params.currentTimeBranch
  }
}