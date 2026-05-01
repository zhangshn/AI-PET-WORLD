/**
 * 当前文件负责：定义紫微动态层切换按钮配置。
 */

import type { ActiveDynamicFlow } from "../../types"

export type ZiweiDynamicTabConfig = {
  flow: ActiveDynamicFlow
  label: string
  description: string
}

export const ZIWEI_DYNAMIC_TAB_CONFIGS: ZiweiDynamicTabConfig[] = [
  {
    flow: "natal",
    label: "本命",
    description: "出生时固定命盘"
  },
  {
    flow: "daYun",
    label: "大运",
    description: "十年阶段命宫"
  },
  {
    flow: "liuNian",
    label: "流年",
    description: "年份命宫"
  },
  {
    flow: "liuYue",
    label: "流月",
    description: "月份命宫"
  },
  {
    flow: "liuRi",
    label: "流日",
    description: "日期命宫"
  },
  {
    flow: "liuShi",
    label: "流时",
    description: "时辰命宫"
  }
]