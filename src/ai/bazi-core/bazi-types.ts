/**
 * 当前文件负责：定义八字动力系统的基础类型。
 */

export type HeavenlyStem =
  | "甲" | "乙" | "丙" | "丁" | "戊"
  | "己" | "庚" | "辛" | "壬" | "癸"

export type EarthlyBranch =
  | "子" | "丑" | "寅" | "卯" | "辰" | "巳"
  | "午" | "未" | "申" | "酉" | "戌" | "亥"

export type WuXingElement = "wood" | "fire" | "earth" | "metal" | "water"

export type BaziPillar = {
  stem: HeavenlyStem
  branch: EarthlyBranch
  label: string
  stemElement: WuXingElement
  branchElement: WuXingElement
}

export type BaziInput = {
  year: number
  month: number
  day: number
  hour?: number | null
  minute?: number | null
}

export type BaziChart = {
  input: BaziInput
  yearPillar: BaziPillar
  monthPillar: BaziPillar
  dayPillar: BaziPillar
  hourPillar?: BaziPillar | null
  hasHour: boolean
}

export type WuXingScore = Record<WuXingElement, number>
export type WuXingDistribution = Record<WuXingElement, number>

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
  rawScore: WuXingScore
  distribution: WuXingDistribution
  dynamics: BaziDynamicsVector
  dominantElements: WuXingElement[]
  behaviorTags: BaziBehaviorTag[]
  interpretation: BaziDynamicsInterpretation
  summary: string
  debug: {
    usedPillars: string[]
    note: string
  }
}