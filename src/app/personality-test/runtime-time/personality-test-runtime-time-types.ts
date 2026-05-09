/**
 * 当前文件负责：定义 personality-test 页面统一动态时间结构。
 */

import type { BranchPalace } from "../../../ai/destiny-core/ziwei-core/schema"

export interface PersonalityTestRuntimeTime {
  /**
   * 公历时间，用于八字动态运行层。
   */
  currentYear: number
  currentMonth: number
  currentDay: number
  currentHour: number | null

  /**
   * 当前年龄，用于紫微 / 八字各自判断当前运段。
   */
  currentAge: number

  /**
   * 农历时间，用于紫微动态运行层。
   */
  currentLunarMonth: number
  currentLunarDay: number
  currentTimeBranch: BranchPalace
}