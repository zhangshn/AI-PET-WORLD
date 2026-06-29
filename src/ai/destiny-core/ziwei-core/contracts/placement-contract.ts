import type { BranchPalace } from "./branch-contract"
import type { NormalizedZiweiBirthInput } from "./birth-contract"
import type { ZiweiNatalFoundation } from "./foundation-contract"
import type { LunarBirthInfo } from "./lunar-contract"
import type { SectorName } from "./palace-contract"
import type { ZiweiStarCategory, ZiweiStarId } from "./star-contract"

export type ZiweiPlacementSource =
  | "natal"
  | "daYun"
  | "liuNian"
  | "liuYue"
  | "liuRi"
  | "liuShi"

export type ZiweiPlacementRuleId = string

export interface ZiweiPlacementContext {
  ruleSetVersion: string
  input: NormalizedZiweiBirthInput
  lunarInfo: LunarBirthInfo
  foundation: ZiweiNatalFoundation
}

export interface ZiweiPlacedStar {
  starId: ZiweiStarId
  label: string
  category: ZiweiStarCategory
  branch: BranchPalace
  sectorName: SectorName
  source: ZiweiPlacementSource
  placementRuleId: ZiweiPlacementRuleId
  targetStarId?: ZiweiStarId
  debug?: Record<string, unknown>
}

export interface ZiweiPlacementResult {
  stars: ZiweiPlacedStar[]
  warnings: string[]
}
