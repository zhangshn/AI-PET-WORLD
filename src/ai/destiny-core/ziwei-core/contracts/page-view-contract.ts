import type { BranchPalace, ZiweiCycleDirection } from "./branch-contract"
import type {
  FullZiweiDynamicChart,
  ZiweiDynamicStemSource,
  ZiweiDynamicFlowType
} from "./dynamic-chart-contract"
import type { FullZiweiChart } from "./full-chart-contract"
import type { ZiweiChartInterpretation } from "./interpretation-contract"
import type { SectorName } from "./palace-contract"
import type { HeavenlyStem } from "./stem-contract"
import type {
  ZiweiPlacementSource,
  ZiweiPlacementRuleId,
  ZiweiStarBrightness
} from "./placement-contract"
import type { ZiweiStarCategory, ZiweiStarId } from "./star-contract"

export interface ZiweiChartMetaView {
  title: string
  inputSummary: string
  ruleSetVersion: string
}

export interface ZiweiStarView {
  starId: ZiweiStarId
  label: string
  displayLabel: string
  category: ZiweiStarCategory
  categoryLabel: string
  source: ZiweiPlacementSource
  sourceLabel: string
  placementRuleId: ZiweiPlacementRuleId
  brightness?: ZiweiStarBrightness
  targetStarId?: ZiweiStarId
  targetStarLabel?: string
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
  xiaoXianDirection: ZiweiCycleDirection
  xiaoXianDirectionLabel: string
  xiaoXianStartPalace: BranchPalace
  xiaoXianStartPalaceLabel: string
  xiaoXianPalace: BranchPalace
  xiaoXianPalaceLabel: string
  douJunPalace: BranchPalace
  douJunPalaceLabel: string
  activeFlowCount: number
  totalFlowCount: number
}

export interface ZiweiDynamicTransformationView {
  transformationStarId: ZiweiStarId
  transformationLabel: string
  displayLabel: string
  sourceLabel: string
  targetStarId: ZiweiStarId
  targetStarLabel: string
  branch: BranchPalace
  branchLabel: string
  sectorName: SectorName
  sectorLabel: string
  placementRuleId: ZiweiPlacementRuleId
}

export interface ZiweiDynamicFlowingStarView {
  starId: ZiweiStarId
  label: string
  displayLabel: string
  category: ZiweiStarCategory
  categoryLabel: string
  branch: BranchPalace
  branchLabel: string
  sectorName: SectorName
  sectorLabel: string
  placementRuleId: ZiweiPlacementRuleId
}

export interface ZiweiDynamicAnnualCycleStarView
  extends ZiweiDynamicFlowingStarView {
  cycleLabel: string
}

export interface ZiweiDynamicFlowDetailView extends ZiweiDynamicTabView {
  sectorName: SectorName
  sectorLabel: string
  branchLabel: string
  stem: HeavenlyStem
  stemLabel: string
  stemSource: ZiweiDynamicStemSource
  stemSourceLabel: string
  influence: number
  starCount: number
  flowingStarCount: number
  annualCycleStarCount: number
  sourceRuleCount: number
  flowingStars: ZiweiDynamicFlowingStarView[]
  annualCycleStars: ZiweiDynamicAnnualCycleStarView[]
  transformations: ZiweiDynamicTransformationView[]
  palaceDetail?: ZiweiPalaceDetailView
}

export interface ZiweiStarCatalogRowView {
  starId: ZiweiStarId
  label: string
  displayLabel: string
  category: ZiweiStarCategory
  categoryLabel: string
  sourceLabel: string
  palaceLabel?: string
  sectorLabel?: string
  placementRuleId?: string
  brightness?: ZiweiStarBrightness
  targetStarId?: ZiweiStarId
  targetStarLabel?: string
}

export interface ZiweiStarDictionaryPlacementView {
  palaceLabel: string
  sectorLabel: string
  brightnessLabel?: string
  placementRuleId?: string
  palaceMeaning: string
  starMeaning: string
  samePalaceStarLabels: string[]
  oppositePalaceStarLabels: string[]
  trineSquareStarLabels: string[]
  combinationMeaning: string
  relationMeaning: string
  readingBoundary: string
}

export interface ZiweiStarDictionaryDetailView {
  sourceLabel: string
  aliases: string[]
  extendedOverview: string
  yinYangLabel: string
  elementLabel: string
  nature: string
  identity: string[]
  symbolicMeanings: string[]
  functionalRole: string[]
  coreThemes: string[]
  strengths: string[]
  risks: string[]
  favorableSignals: string[]
  unfavorableSignals: string[]
  palaceFocus: string
  palaceUsage: string[]
  brightnessUsage: string[]
  combinationUsage: string[]
  interpretationSteps: string[]
  cautions: string[]
  reusableScenes: string[]
  extendedSections: {
    title: string
    items: string[]
  }[]
  personalityTendency: string
  worldBehaviorHint: string
  readingNotes: string[]
}

export interface ZiweiStarDictionaryEntryView {
  starId: ZiweiStarId
  label: string
  category: ZiweiStarCategory
  categoryLabel: string
  summary: string
  tags: string[]
  placements: ZiweiStarDictionaryPlacementView[]
  detail?: ZiweiStarDictionaryDetailView
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
  starDictionaryEntries: ZiweiStarDictionaryEntryView[]
  interpretation: ZiweiChartInterpretation
  debugJson: unknown
}

export interface BuildZiweiPageViewModelInput {
  chart: FullZiweiChart
  dynamicChart?: FullZiweiDynamicChart
  selectedBranch?: BranchPalace
}
