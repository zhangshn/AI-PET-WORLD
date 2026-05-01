/**
 * 当前文件负责：定义紫微动态时间表使用的局部类型。
 */

import type { BranchPalace } from "../../../../ai/ziwei-core/schema"

export interface ZiweiDynamicTimeSelection {
  currentAge: number
  currentYear: number
  currentLunarMonth: number
  currentLunarDay: number
  currentTimeBranch: BranchPalace
}