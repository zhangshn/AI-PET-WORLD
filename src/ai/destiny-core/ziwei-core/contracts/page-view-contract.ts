import type { BranchPalace, ZiweiCycleDirection } from "./branch-contract"
import type {
  FullZiweiDynamicChart,
  ZiweiDynamicFlowType
} from "./dynamic-chart-contract"
import type { FullZiweiChart } from "./full-chart-contract"
import type { ZiweiChartInterpretation } from "./interpretation-contract"
import type { SectorName } from "./palace-contract"
import type { ZiweiPlacementRuleId } from "./placement-contract"
import type { ZiweiStarCategory, ZiweiStarId } from "./star-contract"

export interface ZiweiChartMetaView {
  title: string
  inputSummary: string
  ruleSetVersion: string
}

export interface ZiweiStarView {
  starId: ZiweiStarId
  label: string
  category: ZiweiStarCategory
  categoryLabel: string
  placementRuleId: ZiweiPlacementRuleId
  displayOrder: number
}

export interface ZiweiStarGroupView {
  category: ZiweiStarCategory
  label: string
  stars: ZiweiStarView[]
}

export type ZiweiPalaceRelationKind =
  | "self"
  | "opposite"
  | "trine"
  | "adjacent"

export interface ZiweiPalaceRelationView {
  kind: ZiweiPalaceRelationKind
  kindLabel: string
  branch: BranchPalace
  branchLabel: string
  sectorName: SectorName
  sectorLabel: string
  note: string
}

export interface ZiweiPalaceCellView {
  branch: BranchPalace
  sectorName: SectorName
  sectorLabel: string
  branchLabel: string
  palaceStemLabel: string
  isLifePalace: boolean
  isBodyPalace: boolean
  starGroups: ZiweiStarGroupView[]
}

export interface ZiweiPalaceDetailView extends ZiweiPalaceCellView {
  oppositeBranchLabel: string
  trineBranchLabels: string[]
  relations: ZiweiPalaceRelationView[]
  detailLines: string[]
}

export interface ZiweiDynamicTabView {
  type: ZiweiDynamicFlowType
  label: string
  palace: BranchPalace
  isActive: boolean
  palaceLabel: string
  inactiveReason?: string
}

export interface ZiweiDynamicDebugView {
  direction: ZiweiCycleDirection
  directionLabel: string
  startAge: number
  currentAge: number
  isDaYunStarted: boolean
  activeFlowCount: number
  totalFlowCount: number
}

export interface ZiweiDynamicFlowDetailView extends ZiweiDynamicTabView {
  sectorName: SectorName
  sectorLabel: string
  branchLabel: string
  influence: number
  starCount: number
  sourceRuleCount: number
  palaceDetail?: ZiweiPalaceDetailView
}

export interface ZiweiStarCatalogRowView {
  starId: ZiweiStarId
  label: string
  category: ZiweiStarCategory
  categoryLabel: string
  palaceLabel?: string
  sectorLabel?: string
  placementRuleId?: string
}

export interface ZiweiPageViewModel {
  chartMeta: ZiweiChartMetaView
  palaceGrid: ZiweiPalaceCellView[]
  palaceDetails: ZiweiPalaceDetailView[]
  selectedPalace?: ZiweiPalaceDetailView
  dynamicTabs: ZiweiDynamicTabView[]
  dynamicFlowDetails: ZiweiDynamicFlowDetailView[]
  dynamicDebug?: ZiweiDynamicDebugView
  starCatalogRows: ZiweiStarCatalogRowView[]
  interpretation: ZiweiChartInterpretation
  debugJson: unknown
}

export interface BuildZiweiPageViewModelInput {
  chart: FullZiweiChart
  dynamicChart?: FullZiweiDynamicChart
  selectedBranch?: BranchPalace
}
