/**
 * 当前文件负责：定义八字动态运行层类型。
 */

import type {
  BaziChart,
  BaziPillar,
  WuXingScore
} from "../bazi-schema"

export type BaziRuntimeGender = "male" | "female" | "unknown"

export type BaziDaYunDirection = "forward" | "backward"

export type BaziRuntimeFlowLevel =
  | "daYun"
  | "liuNian"
  | "liuYue"
  | "liuRi"
  | "liuShi"

export type BaziRuntimeInput = {
  birthChart: BaziChart
  gender: BaziRuntimeGender

  currentYear: number
  currentMonth: number
  currentDay: number
  currentHour?: number | null
}

export type BaziRuntimeTimeSelection = {
  currentYear: number
  currentMonth: number
  currentDay: number
  currentHour: number | null
}

export type BaziDaYunItem = {
  index: number
  startAge: number
  endAge: number
  startYear: number
  endYear: number
  pillar: BaziPillar
  active: boolean
}

export type BaziDaYunResult = {
  direction: BaziDaYunDirection
  startAge: number
  isStarted: boolean
  currentAge: number
  currentDaYun: BaziDaYunItem | null
  daYunList: BaziDaYunItem[]
}

export type BaziFlowResult = {
  liuNian: BaziPillar
  liuYue: BaziPillar
  liuRi: BaziPillar
  liuShi: BaziPillar | null
}

export type BaziDaYunTimeOption = {
  level: "daYun"
  index: number
  title: string
  subtitle: string
  startAge: number
  endAge: number
  startYear: number
  endYear: number
  pillarLabel: string
  active: boolean
}

export type BaziLiuNianTimeOption = {
  level: "liuNian"
  year: number
  age: number
  title: string
  subtitle: string
  active: boolean
}

export type BaziSimpleTimeOption = {
  level: "liuYue" | "liuRi"
  value: number
  title: string
  subtitle?: string
  active: boolean
}

export type BaziHourTimeOption = {
  level: "liuShi"
  hour: number
  branch: string
  title: string
  subtitle: string
  active: boolean
}

export type BaziRuntimeTimeTable = {
  daYunOptions: BaziDaYunTimeOption[]
  liuNianOptions: BaziLiuNianTimeOption[]
  liuYueOptions: BaziSimpleTimeOption[]
  liuRiOptions: BaziSimpleTimeOption[]
  liuShiOptions: BaziHourTimeOption[]
  selectedSummary: string
  activeDaYunIndex: number | null
}

export type BaziRuntimeElementField = {
  rawScore: WuXingScore
  elementScores: WuXingScore
}

export type BaziRuntimeModifiers = {
  activityModifier: number
  emotionModifier: number
  recoveryModifier: number
  cautionModifier: number
  explorationModifier: number
  perceptionModifier: number
}

export type BaziRuntimeProfile = {
  birthChart: BaziChart

  gender: BaziRuntimeGender
  currentAge: number

  daYun: BaziDaYunResult
  flows: BaziFlowResult
  timeTable: BaziRuntimeTimeTable

  runtimeElementField: BaziRuntimeElementField
  modifiers: BaziRuntimeModifiers

  debug: {
    usedRuntimePillars: string[]
    note: string
  }
}