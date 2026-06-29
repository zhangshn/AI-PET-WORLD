import type { BranchPalace } from "./branch-contract"
import type { FullZiweiChart } from "./full-chart-contract"
import type { SectorName } from "./palace-contract"
import type { ZiweiPlacementRuleId } from "./placement-contract"
import type { ZiweiStarCategory, ZiweiStarId } from "./star-contract"

export type ZiweiInterpretationScope =
  | "chart"
  | "palace"
  | "star"
  | "combination"
  | "relation"
  | "dynamic"

export interface ZiweiInterpretationItem {
  itemId: string
  scope: ZiweiInterpretationScope
  title: string
  summary: string
  tags: string[]
  sourceRuleIds: ZiweiPlacementRuleId[]
  palaceBranch?: BranchPalace
  sectorName?: SectorName
  starId?: ZiweiStarId
  category?: ZiweiStarCategory
}

export interface ZiweiPalaceInterpretation {
  branch: BranchPalace
  sectorName: SectorName
  branchLabel: string
  sectorLabel: string
  items: ZiweiInterpretationItem[]
}

export interface ZiweiChartInterpretation {
  chartHighlights: ZiweiInterpretationItem[]
  palaceInterpretations: ZiweiPalaceInterpretation[]
  debug: {
    generatedBy: string
    totalItems: number
  }
}

export interface BuildZiweiInterpretationInput {
  chart: FullZiweiChart
}
