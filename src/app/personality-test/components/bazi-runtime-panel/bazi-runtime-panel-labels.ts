/**
 * 当前文件负责：集中管理八字动态运势面板展示标签。
 */

import type { BaziRuntimeActiveLevel } from "./bazi-runtime-panel-types"

export const BAZI_RUNTIME_ELEMENT_LABELS: Record<string, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
}

export const BAZI_RUNTIME_MODIFIER_LABELS: Record<string, string> = {
  activityModifier: "行动修正",
  emotionModifier: "情绪修正",
  recoveryModifier: "恢复修正",
  cautionModifier: "谨慎修正",
  explorationModifier: "探索修正",
  perceptionModifier: "感知修正",
}

export const BAZI_RUNTIME_LEVEL_ORDER: BaziRuntimeActiveLevel[] = [
  "daYun",
  "liuNian",
  "liuYue",
  "liuRi",
  "liuShi",
]

export const BAZI_RUNTIME_LEVEL_LABELS: Record<BaziRuntimeActiveLevel, string> = {
  daYun: "大运",
  liuNian: "流年",
  liuYue: "流月",
  liuRi: "流日",
  liuShi: "流时",
}

export const BAZI_MONTH_LABELS = [
  "正月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "冬月",
  "腊月",
]

export const BAZI_DAY_LABELS = [
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十",
]

export const BAZI_HOUR_OPTIONS = [
  { label: "子时", branch: "zi", hour: 0 },
  { label: "丑时", branch: "chou", hour: 2 },
  { label: "寅时", branch: "yin", hour: 4 },
  { label: "卯时", branch: "mao", hour: 6 },
  { label: "辰时", branch: "chen", hour: 8 },
  { label: "巳时", branch: "si", hour: 10 },
  { label: "午时", branch: "wu", hour: 12 },
  { label: "未时", branch: "wei", hour: 14 },
  { label: "申时", branch: "shen", hour: 16 },
  { label: "酉时", branch: "you", hour: 18 },
  { label: "戌时", branch: "xu", hour: 20 },
  { label: "亥时", branch: "hai", hour: 22 },
]

export function isRuntimeLevelActive(params: {
  activeLevel: BaziRuntimeActiveLevel
  targetLevel: BaziRuntimeActiveLevel
}): boolean {
  return (
    BAZI_RUNTIME_LEVEL_ORDER.indexOf(params.activeLevel) >=
    BAZI_RUNTIME_LEVEL_ORDER.indexOf(params.targetLevel)
  )
}

export function getBaziRuntimeDirectionLabel(direction: string): string {
  if (direction === "forward") return "顺行"
  if (direction === "backward") return "逆行"
  return direction
}

export function getBaziRuntimeGenderLabel(gender: string): string {
  if (gender === "male") return "男"
  if (gender === "female") return "女"
  return "未知"
}

export function formatRuntimeScore(value?: number): string {
  if (typeof value !== "number") {
    return "-"
  }

  return String(Math.round(value))
}