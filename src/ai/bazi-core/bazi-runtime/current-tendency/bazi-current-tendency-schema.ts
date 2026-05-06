/**
 * 当前文件负责：定义八字当前流动气质与行动趋向的数据结构。
 */

import type {
  BaziProfile,
  WuXingElement,
  WuXingScore
} from "../../bazi-schema"

import type {
  BaziRuntimeModifiers,
  BaziRuntimeProfile
} from "../bazi-runtime-schema"

export type BaziCurrentEnergyTone =
  | "active"
  | "warm"
  | "stable"
  | "sharp"
  | "deep"
  | "balanced"

export interface BaziCurrentTendencies {
  actionTendency: number
  reactionTendency: number
  explorationTendency: number
  recoveryTendency: number
  cautionTendency: number
  perceptionTendency: number
  stabilityTendency: number
  adaptabilityTendency: number
}

export interface BaziCurrentDynamicTemperament {
  dominantRuntimeElements: WuXingElement[]
  weakRuntimeElements: WuXingElement[]
  energyTone: BaziCurrentEnergyTone
  elementField: WuXingScore
  modifiers: BaziRuntimeModifiers
}

export interface BaziCurrentTendencyProfile {
  baseProfile: BaziProfile
  runtimeProfile: BaziRuntimeProfile

  currentTemperament: BaziCurrentDynamicTemperament
  currentTendencies: BaziCurrentTendencies

  labels: {
    title: string
    summary: string
    modeLabel: string
    precisionLabel: string
  }

  debug: {
    usedRuntimePillars: string[]
    note: string
  }
}