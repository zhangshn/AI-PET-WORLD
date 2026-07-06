import type { BranchPalace } from "./branch-contract"
import type {
  FullZiweiDynamicChart,
  ZiweiDynamicFlowType,
  ZiweiDynamicStemSource
} from "./dynamic-chart-contract"
import type { FullZiweiChart } from "./full-chart-contract"
import type { SectorName } from "./palace-contract"
import type { HeavenlyStem } from "./stem-contract"
import type {
  ZiweiPlacementRuleId,
  ZiweiStarBrightnessLevel
} from "./placement-contract"
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

export interface ZiweiContentDetailInsight {
  sourceType: "star" | "pattern"
  sourceId: string
  label: string
  category: string
  palaceBranch?: BranchPalace
  sectorName?: SectorName
  personalityTendency: string
  worldBehaviorHint: string
  tags: string[]
}

export interface ZiweiChartContentDetails {
  starInsights: ZiweiContentDetailInsight[]
  personalityTendencies: string[]
  worldBehaviorHints: string[]
  debug: {
    starInsightCount: number
    supportedCategories: string[]
  }
}

export type ZiweiDetailedAnalysisTone =
  | "core"
  | "support"
  | "pressure"
  | "dynamic"
  | "detail"
  | "neutral"

export type ZiweiCurrentChartEvidenceKind =
  | "natal-palace"
  | "star"
  | "same-palace-combination"
  | "palace-relation"
  | "transformation"
  | "dynamic-flow"
  | "pattern-boundary"

export interface ZiweiCurrentChartEvidenceChain {
  chainId: string
  kind: ZiweiCurrentChartEvidenceKind
  title: string
  summary: string
  flowType: ZiweiDynamicFlowType
  palaceBranch?: BranchPalace
  sectorName?: SectorName
  relationKind?: ZiweiDetailedPalaceRelationKind
  starIds: ZiweiStarId[]
  starLabels: string[]
  sourceRuleIds: string[]
  dictionaryRefs: string[]
  evidenceLines: string[]
  interpretationBoundary: string[]
}

export interface ZiweiDetailedStarAnalysis {
  starId: ZiweiStarId
  label: string
  category: ZiweiStarCategory
  categoryLabel: string
  tone: ZiweiDetailedAnalysisTone
  brightnessLevel?: ZiweiStarBrightnessLevel
  brightnessLabel?: string
  targetStarId?: ZiweiStarId
  targetStarLabel?: string
  coreThemes: string[]
  strengths: string[]
  risks: string[]
  analysisLines: string[]
  sourceRuleIds: ZiweiPlacementRuleId[]
}

export type ZiweiDetailedPalaceRelationKind =
  | "self"
  | "opposite"
  | "trine"
  | "adjacent"

export interface ZiweiDetailedPalaceRelationAnalysis {
  kind: ZiweiDetailedPalaceRelationKind
  kindLabel: string
  branch: BranchPalace
  branchLabel: string
  sectorName: SectorName
  sectorLabel: string
  starCount: number
  mainStarLabels: string[]
  assistantStarLabels: string[]
  pressureStarLabels: string[]
  transformationLabels: string[]
  summaryLines: string[]
  sourceRuleIds: ZiweiPlacementRuleId[]
}

export interface ZiweiDetailedPalaceAnalysis {
  branch: BranchPalace
  sectorName: SectorName
  branchLabel: string
  sectorLabel: string
  palaceRoles: string[]
  starCount: number
  palaceThemeLines: string[]
  categorySummaryLines: string[]
  combinationLines: string[]
  trineSquareCombinationLines: string[]
  mainAxisLines: string[]
  supportLines: string[]
  pressureLines: string[]
  dynamicLines: string[]
  detailLines: string[]
  brightnessLines: string[]
  relationLines: string[]
  reviewGapLines: string[]
  relationAnalyses: ZiweiDetailedPalaceRelationAnalysis[]
  starAnalyses: ZiweiDetailedStarAnalysis[]
}

export interface ZiweiDetailedDynamicTransformationAnalysis {
  transformationStarId: ZiweiStarId
  transformationLabel: string
  targetStarId: ZiweiStarId
  targetStarLabel: string
  branch: BranchPalace
  branchLabel: string
  sectorName: SectorName
  sectorLabel: string
  summaryLines: string[]
  sourceRuleIds: string[]
}

export interface ZiweiDetailedDynamicFlowingStarAnalysis {
  starId: ZiweiStarId
  label: string
  branch: BranchPalace
  branchLabel: string
  sectorName: SectorName
  sectorLabel: string
  category: string
  sourceRuleId: string
}

export interface ZiweiDetailedDynamicAnnualCycleStarAnalysis
  extends ZiweiDetailedDynamicFlowingStarAnalysis {
  cycleLabel: string
}

export interface ZiweiDetailedDynamicFlowAnalysis {
  type: ZiweiDynamicFlowType
  typeLabel: string
  palace: BranchPalace
  branchLabel: string
  sectorName: SectorName
  sectorLabel: string
  stem: HeavenlyStem
  stemLabel: string
  stemSource: ZiweiDynamicStemSource
  stemSourceLabel: string
  influence: number
  isActive: boolean
  inactiveReason?: string
  starCount: number
  flowingStarCount: number
  annualCycleStarCount: number
  transformationCount: number
  sourceRuleIds: string[]
  overviewLines: string[]
  palaceLines: string[]
  flowingStarLines: string[]
  annualCycleLines: string[]
  transformationLines: string[]
  reviewLines: string[]
  flowingStars: ZiweiDetailedDynamicFlowingStarAnalysis[]
  annualCycleStars: ZiweiDetailedDynamicAnnualCycleStarAnalysis[]
  transformations: ZiweiDetailedDynamicTransformationAnalysis[]
}

export interface ZiweiChartDetailedAnalysis {
  overviewLines: string[]
  lifePalaceLines: string[]
  bodyPalaceLines: string[]
  evidenceSummaryLines: string[]
  currentEvidenceChains: ZiweiCurrentChartEvidenceChain[]
  palaceAnalyses: ZiweiDetailedPalaceAnalysis[]
  dynamicFlowAnalyses: ZiweiDetailedDynamicFlowAnalysis[]
  debug: {
    palaceCount: number
    analyzedStarCount: number
    unsupportedStarCount: number
    evidenceChainCount: number
    dynamicFlowCount: number
    activeDynamicFlowCount: number
    supportedCategories: string[]
  }
}

export interface ZiweiChartInterpretation {
  chartHighlights: ZiweiInterpretationItem[]
  palaceInterpretations: ZiweiPalaceInterpretation[]
  contentDetails: ZiweiChartContentDetails
  detailedAnalysis: ZiweiChartDetailedAnalysis
  debug: {
    generatedBy: string
    totalItems: number
  }
}

export interface BuildZiweiInterpretationInput {
  chart: FullZiweiChart
  dynamicChart?: FullZiweiDynamicChart
}
