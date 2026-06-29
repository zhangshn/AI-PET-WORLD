import type { BranchPalace } from "./branch-contract"
import type { NormalizedZiweiBirthInput } from "./birth-contract"
import type { ZiweiNatalFoundation } from "./foundation-contract"
import type { LunarBirthInfo } from "./lunar-contract"
import type { SectorName } from "./palace-contract"
import type { HeavenlyStem } from "./stem-contract"
import type { ZiweiStarCategory } from "./star-contract"
import type { ZiweiPlacedStar } from "./placement-contract"

export interface ZiweiPalaceStarsByCategory {
  main: ZiweiPlacedStar[]
  assistant: ZiweiPlacedStar[]
  malefic: ZiweiPlacedStar[]
  transformation: ZiweiPlacedStar[]
  misc: ZiweiPlacedStar[]
  lifecycle: ZiweiPlacedStar[]
  yearly: ZiweiPlacedStar[]
  monthly: ZiweiPlacedStar[]
  dailyHourly: ZiweiPlacedStar[]
}

export interface FullZiweiPalace {
  branch: BranchPalace
  sectorName: SectorName
  palaceStem: HeavenlyStem
  isLifePalace: boolean
  isBodyPalace: boolean
  oppositeBranch: BranchPalace
  trineBranches: BranchPalace[]
  stars: ZiweiPalaceStarsByCategory
  borrowedFrom?: BranchPalace
  detailLines: string[]
}

export type FullZiweiChartStarCounts = Record<
  Exclude<ZiweiStarCategory, "empty">,
  number
>

export interface FullZiweiChartSummary {
  lifePalace: BranchPalace
  bodyPalace: BranchPalace
  elementGate: ZiweiNatalFoundation["elementGate"]
  totalStarCount: number
  starCountsByCategory: FullZiweiChartStarCounts
  enabledCategories: string[]
}

export interface FullZiweiChartDebug {
  ruleSetVersion: string
  placementWarnings: string[]
  validationWarnings: string[]
  raw?: Record<string, unknown>
}

export interface FullZiweiChart {
  ruleSetVersion: string
  input: NormalizedZiweiBirthInput
  lunarInfo: LunarBirthInfo
  foundation: ZiweiNatalFoundation
  palaces: FullZiweiPalace[]
  summary: FullZiweiChartSummary
  debug: FullZiweiChartDebug
}
