import type { BranchPalace } from "./branch-contract"
import type { LunarBirthInfo } from "./lunar-contract"
import type {
  BranchToSectorMap,
  SectorName,
  SectorToBranchMap
} from "./palace-contract"
import type { HeavenlyStem } from "./stem-contract"

export type ElementGate =
  | "water_2"
  | "wood_3"
  | "metal_4"
  | "earth_5"
  | "fire_6"

export type ElementBase = 2 | 3 | 4 | 5 | 6

export interface ZiweiBorrowedPalace {
  targetPalace: BranchPalace
  sourcePalace: BranchPalace
  weight: number
}

export interface ZiweiNatalFoundation {
  lunarInfo: LunarBirthInfo
  lifePalace: BranchPalace
  bodyPalace: BranchPalace
  palaceSequence: BranchPalace[]
  branchToSectorMap: BranchToSectorMap
  sectorToBranchMap: SectorToBranchMap
  palaceStemMap: Record<BranchPalace, HeavenlyStem>
  elementGate: ElementGate
  elementBase: ElementBase
  borrowedPalaces?: ZiweiBorrowedPalace[]
  emptyPalaceCount?: number
}

export interface ZiweiPalaceRelation {
  branch: BranchPalace
  sectorName: SectorName
  oppositeBranch: BranchPalace
  trineBranches: BranchPalace[]
}
