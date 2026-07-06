import type { BranchPalace, TimeBranch, ZiweiCycleDirection } from "./branch-contract"
import type { SectorName } from "./palace-contract"
import type { HeavenlyStem } from "./stem-contract"
import type { ZiweiPlacedStar } from "./placement-contract"
import type { ZiweiStarId } from "./star-contract"

export type ZiweiDynamicFlowType =
  | "natal"
  | "daYun"
  | "liuNian"
  | "liuYue"
  | "liuRi"
  | "liuShi"

export type ZiweiDynamicStemSource =
  | "birthYearStem"
  | "currentYearStem"
  | "currentMonthStem"
  | "currentDayStem"
  | "currentTimeStem"
  | "dynamicPalaceStem"

export interface FullZiweiDynamicTransformation {
  transformationStarId: ZiweiStarId
  transformationLabel: string
  targetStarId: ZiweiStarId
  targetStarLabel: string
  branch: BranchPalace
  sectorName: SectorName
  placementRuleId: string
}

export interface FullZiweiDynamicFlow {
  type: ZiweiDynamicFlowType
  palace: BranchPalace
  sectorName: SectorName
  stem: HeavenlyStem
  stemSource: ZiweiDynamicStemSource
  dynamicBranchToSectorMap: Record<BranchPalace, SectorName>
  dynamicSectorToBranchMap: Record<SectorName, BranchPalace>
  stars: ZiweiPlacedStar[]
  flowingStars: ZiweiPlacedStar[]
  annualCycleStars: ZiweiPlacedStar[]
  transformations: FullZiweiDynamicTransformation[]
  influence: number
  isActive: boolean
  inactiveReason?: string
}

export interface FullZiweiDynamicChartInput {
  currentAge: number
  currentYear: number
  currentLunarMonth: number
  currentLunarDay: number
  currentTimeBranch: TimeBranch
}

export interface FullZiweiDynamicChart {
  flows: FullZiweiDynamicFlow[]
  debug: {
    direction: ZiweiCycleDirection
    startAge: number
    currentAge: number
    isDaYunStarted: boolean
    xiaoXianDirection: ZiweiCycleDirection
    xiaoXianStartPalace: BranchPalace
    xiaoXianPalace: BranchPalace
    douJunPalace: BranchPalace
  }
}
