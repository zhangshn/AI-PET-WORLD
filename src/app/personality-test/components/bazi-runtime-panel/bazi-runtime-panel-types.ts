/**
 * 当前文件负责：定义八字动态面板展示组件使用的局部类型。
 */

import type {
  BaziRuntimeProfile
} from "../../../../ai/bazi-core/bazi-gateway"

export type BaziRuntimeProfileView = BaziRuntimeProfile

export type BaziRuntimeActiveLevel =
  | "daYun"
  | "liuNian"
  | "liuYue"
  | "liuRi"
  | "liuShi"

export type BaziRuntimeTimeSelection = {
  currentYear: number
  currentMonth: number
  currentDay: number
  currentHour: number | null
}