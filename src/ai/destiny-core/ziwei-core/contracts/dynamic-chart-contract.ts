import type { BranchPalace, TimeBranch, ZiweiCycleDirection } from "./branch-contract"
import type { SectorName } from "./palace-contract"
import type { ZiweiPlacedStar } from "./placement-contract"

export type ZiweiDynamicFlowType =
  | "natal"
  | "daYun"
  | "liuNian"
  | "liuYue"
  | "liuRi"
  | "liuShi"

export interface FullZiweiDynamicFlow {
  type: ZiweiDynamicFlowType
  palace: BranchPalace
  sectorName: SectorName
  dynamicBranchToSectorMap: Record<BranchPalace, SectorName>
  dynamicSectorToBranchMap: Record<SectorName, BranchPalace>
  stars: ZiweiPlacedStar[]
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
  }
}
