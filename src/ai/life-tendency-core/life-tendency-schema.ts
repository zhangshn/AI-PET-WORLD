/**
 * 当前文件负责：定义当前生命趋向核心的数据结构。
 */

import type {
  CurrentDynamicProfile
} from "../destiny-core/ziwei-core/ziwei-gateway"

import type {
  PersonalityTraits
} from "../destiny-core/ziwei-core/schema"

import type {
  BaziCurrentTendencyProfile
} from "../destiny-core/bazi-core/bazi-gateway"

export type LifeTendencyKey =
  | "explore"
  | "observe"
  | "approach"
  | "recover"
  | "care"
  | "protect"
  | "boundary"
  | "routine"
  | "action"
  | "perception"

export type LifeTendencyLevel =
  | "strong"
  | "medium_high"
  | "medium"
  | "medium_low"
  | "low"

export interface LifeTendencyScoreInputs {
  ziwei: number | null
  bazi: number
  fiveDimension: number
}

export interface LifeTendencyScoreItem {
  key: LifeTendencyKey
  label: string
  score: number
  level: LifeTendencyLevel
  source: string
  inputs: LifeTendencyScoreInputs
}

export interface LifeTendencyScores {
  explore: number
  observe: number
  approach: number
  recover: number
  care: number
  protect: number
  boundary: number
  routine: number
  action: number
  perception: number
}

export interface LifeTendencyFiveDimensionScores {
  explore: number
  observe: number
  approach: number
  recover: number
  care: number
  protect: number
  boundary: number
  routine: number
  action: number
  perception: number
  stability: number
}

export interface LifeTendencySourceProfile {
  ziweiSummary: string
  baziSummary: string
  fiveDimensionSummary: string
}

export interface LifeTendencyLabels {
  title: string
  summary: string
  topSummary: string
  gameUsage: string
}

export interface CurrentLifeTendencyProfile {
  scores: LifeTendencyScores
  scoreItems: LifeTendencyScoreItem[]
  topTendencies: LifeTendencyScoreItem[]

  fiveDimensionScores: LifeTendencyFiveDimensionScores
  sourceProfile: LifeTendencySourceProfile

  labels: LifeTendencyLabels

  debug: {
    hasZiweiProfile: boolean
    usedZiweiDynamicTraits: boolean
    baziEnergyTone: string
    baziDominantElements: string[]
    baziUsedRuntimePillars: string[]
  }
}

export interface BuildCurrentLifeTendencyProfileInput {
  /**
   * 紫微当前动态人格。
   * 紫微是主系统；如果出生时间未知，这里可以为 null。
   */
  ziweiProfile: CurrentDynamicProfile | null

  /**
   * 八字当前动态趋向。
   * 八字是辅助系统。
   */
  baziTendencyProfile: BaziCurrentTendencyProfile

  /**
   * 当紫微动态人格不可用时，用原盘 traits 作为五维解释的降级输入。
   */
  fallbackTraits?: PersonalityTraits | null
}