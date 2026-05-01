/**
 * 当前文件负责：定义八字动力系统的核心类型。
 */

export type HeavenlyStem =
  | "甲" | "乙" | "丙" | "丁" | "戊"
  | "己" | "庚" | "辛" | "壬" | "癸"

export type EarthlyBranch =
  | "子" | "丑" | "寅" | "卯" | "辰" | "巳"
  | "午" | "未" | "申" | "酉" | "戌" | "亥"

export type WuXingElement = "wood" | "fire" | "earth" | "metal" | "water"

export type YinYang = "yin" | "yang"

export type BaziMode = "FOUR_PILLARS" | "THREE_PILLARS"

export type BaziPrecision = "high" | "medium"

export type BaziInput = {
  year: number
  month: number
  day: number
  hour?: number | null
  minute?: number | null
}

export type BaziPillar = {
  stem: HeavenlyStem
  branch: EarthlyBranch
  label: string
  stemElement: WuXingElement
  branchElement: WuXingElement
  hiddenStems: HeavenlyStem[]
  yinYang: YinYang
}

export type BaziChart = {
  input: BaziInput
  mode: BaziMode
  hasHour: boolean

  yearPillar: BaziPillar
  monthPillar: BaziPillar
  dayPillar: BaziPillar
  hourPillar: BaziPillar | null

  dayMaster: HeavenlyStem
  pillars: BaziPillar[]
}

export type WuXingScore = Record<WuXingElement, number>
export type WuXingDistribution = Record<WuXingElement, number>
export type YinYangScore = Record<YinYang, number>

export type BaziElementDetail = {
  pillarLabel: string
  source:
    | "yearStem"
    | "yearBranch"
    | "monthStem"
    | "monthBranch"
    | "dayStem"
    | "dayBranch"
    | "hourStem"
    | "hourBranch"
    | "hiddenStem"
  element: WuXingElement
  yinYang: YinYang
  weight: number
  note: string
}

export type BaziElementAnalysis = {
  rawScore: WuXingScore
  elementScores: WuXingScore
  yinYangScores: YinYangScore
  dominantElements: WuXingElement[]
  weakElements: WuXingElement[]
  details: BaziElementDetail[]
}

export type BaziDynamicVector = {
  growthDrive: number
  expressionDrive: number
  stabilityDrive: number
  boundaryDrive: number
  perceptionDrive: number
}

export type BaziBehaviorBias = {
  activity: number
  restPreference: number
  emotionalSensitivity: number
  explorationDrive: number
  caution: number
  adaptability: number
}

export type BaziDynamicsVector = {
  actionIntensity: number
  reactionSpeed: number
  sensoryDepth: number
  consistency: number
  explorationDrive: number
  stability: number
  persistence: number
  adaptability: number
}

export type BaziBehaviorTag =
  | "high_action_release"
  | "fast_reaction"
  | "deep_observer"
  | "stable_state"
  | "consistent_pattern"
  | "strong_exploration"
  | "persistent_behavior"
  | "adaptive_response"
  | "balanced_dynamics"

export type BaziDynamicsInterpretation = {
  title: string
  summary: string
  behaviorDescription: string[]
  newbornTendency: string[]
  butlerTendency: string[]
  constructionTendency: string[]
}

export type BaziProfile = {
  chart: BaziChart

  mode: BaziMode
  precision: BaziPrecision
  hasHour: boolean

  dayMaster: HeavenlyStem

  elementScores: WuXingScore
  yinYangScores: YinYangScore
  dominantElements: WuXingElement[]
  weakElements: WuXingElement[]

  dynamicVector: BaziDynamicVector
  behaviorBias: BaziBehaviorBias

  /**
   * 兼容旧版 personality-vector 使用字段。
   */
  rawScore: WuXingScore
  distribution: WuXingDistribution
  dynamics: BaziDynamicsVector
  behaviorTags: BaziBehaviorTag[]
  interpretation: BaziDynamicsInterpretation

  summary: string

  debug: {
    usedPillars: string[]
    missingHour: boolean
    elementDetails: BaziElementDetail[]
    note: string
  }
}