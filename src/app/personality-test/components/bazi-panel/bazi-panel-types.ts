/**
 * 当前文件负责：定义八字动力底盘展示组件使用的局部类型。
 */

export type BaziPillarView = {
  stem?: string
  branch?: string
  label: string
  stemElement?: string
  branchElement?: string
  hiddenStems?: string[]
  yinYang?: string
}

export type BaziScoreMap = Record<string, number>

export type BaziProfileView = {
  chart: {
    yearPillar: BaziPillarView
    monthPillar: BaziPillarView
    dayPillar: BaziPillarView
    hourPillar?: BaziPillarView | null
    hasHour: boolean
  }

  mode?: "FOUR_PILLARS" | "THREE_PILLARS"
  precision?: "high" | "medium"
  hasHour?: boolean
  dayMaster?: string

  elementScores?: BaziScoreMap
  yinYangScores?: BaziScoreMap
  dynamicVector?: BaziScoreMap
  behaviorBias?: BaziScoreMap

  dominantElements: string[]
  weakElements?: string[]

  summary?: string

  debug?: {
    usedPillars?: string[]
    missingHour?: boolean
    note?: string
  }
}