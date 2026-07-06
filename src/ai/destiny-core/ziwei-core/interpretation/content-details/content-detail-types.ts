import type {
  BranchPalace,
  ElementGate,
  HeavenlyStem,
  SectorName,
  ZiweiStarId
} from "../../contracts"

export type ZiweiContentYinYang = "yang" | "yin" | "mixed"

export type ZiweiContentElement =
  | "wood"
  | "fire"
  | "earth"
  | "metal"
  | "water"
  | "mixed"

export interface ZiweiStarContentDetail {
  starId: ZiweiStarId
  label: string
  yinYang: ZiweiContentYinYang
  element: ZiweiContentElement
  nature: string
  coreThemes: string[]
  strengths: string[]
  risks: string[]
  favorableSignals: string[]
  unfavorableSignals: string[]
  palaceFocus: string
  personalityTendency: string
  worldBehaviorHint: string
  readingNotes: string[]
}

export type ZiweiContentDictionarySource = "manual" | "category-fallback"

export interface ZiweiContentDictionarySection {
  title: string
  items: string[]
}

export type ZiweiTheorySourceReferenceRole =
  | "classic-lineage"
  | "project-algorithm"
  | "project-dictionary"
  | "internal-synthesis"
  | "manual-calibration"
  | "copyright-boundary"

export interface ZiweiContentSourceReference {
  sourceId: string
  role: ZiweiTheorySourceReferenceRole
  usage: string
  confidence: "high" | "medium" | "low"
}

export interface ZiweiStarContentDictionaryDetail extends ZiweiStarContentDetail {
  source: ZiweiContentDictionarySource
  sourceReferences: ZiweiContentSourceReference[]
  aliases: string[]
  extendedOverview: string
  identity: string[]
  symbolicMeanings: string[]
  functionalRole: string[]
  palaceUsage: string[]
  brightnessUsage: string[]
  combinationUsage: string[]
  interpretationSteps: string[]
  cautions: string[]
  reusableScenes: string[]
  extendedSections: ZiweiContentDictionarySection[]
  sections: ZiweiContentDictionarySection[]
}

export type ZiweiMainStarContentDetail = ZiweiStarContentDetail

export type ZiweiAssistantStarContentDetail = ZiweiStarContentDetail

export type ZiweiMaleficStarContentDetail = ZiweiStarContentDetail

export type ZiweiMiscStarContentDetail = ZiweiStarContentDetail

export type ZiweiTransformationContentDetail = ZiweiStarContentDetail

export type ZiweiPatternContentTone =
  | "favorable"
  | "adverse"
  | "mixed"
  | "pending"

export interface ZiweiPatternContentDetailInput {
  id: string
  label: string
  category: string
  conditionText: string
}

export interface ZiweiPatternContentDetail {
  patternId: string
  label: string
  category: string
  tone: ZiweiPatternContentTone
  nature: string
  coreThemes: string[]
  strengths: string[]
  risks: string[]
  enhancementSignals: string[]
  breakSignals: string[]
  personalityTendency: string
  worldBehaviorHint: string
  readingNotes: string[]
}

export interface ZiweiPatternContentDictionaryDetail
  extends ZiweiPatternContentDetail {
  source: "category-derived"
  sourceReferences: ZiweiContentSourceReference[]
  identity: string[]
  formationLogic: string[]
  evidenceChecklist: string[]
  strengthChecklist: string[]
  breakageChecklist: string[]
  interpretationSteps: string[]
  cautions: string[]
  reusableScenes: string[]
  sections: ZiweiContentDictionarySection[]
}

export interface ZiweiBranchGroupContentDetail {
  groupId: string
  label: string
  branches: BranchPalace[]
  aliases: string[]
  nature: string
  analysisUsage: string[]
  cautions: string[]
}

export interface ZiweiBranchContentDetail {
  branch: BranchPalace
  label: string
  sourceReferences: ZiweiContentSourceReference[]
  yinYang: ZiweiContentYinYang
  element: Exclude<ZiweiContentElement, "mixed">
  direction: string
  season: string
  monthHint: string
  timeHint: string
  groupIds: string[]
  hiddenStems: string[]
  nature: string
  symbolicMeanings: string[]
  palaceUsage: string[]
  starInteraction: string[]
  dynamicUsage: string[]
  relationshipUsage: string[]
  cautions: string[]
  sections: ZiweiContentDictionarySection[]
}

export interface ZiweiStemContentDetail {
  stem: HeavenlyStem
  label: string
  sourceReferences: ZiweiContentSourceReference[]
  yinYang: Exclude<ZiweiContentYinYang, "mixed">
  element: Exclude<ZiweiContentElement, "mixed">
  pairGroup: string
  nature: string
  symbolicMeanings: string[]
  transformationUsage: string[]
  palaceStemUsage: string[]
  dynamicUsage: string[]
  combinationUsage: string[]
  cautions: string[]
  sections: ZiweiContentDictionarySection[]
}

export interface ZiweiElementGateContentDetail {
  gate: ElementGate
  label: string
  sourceReferences: ZiweiContentSourceReference[]
  element: Exclude<ZiweiContentElement, "mixed">
  baseNumber: 2 | 3 | 4 | 5 | 6
  nature: string
  symbolicMeanings: string[]
  ziweiPlacementUsage: string[]
  daYunUsage: string[]
  starInteraction: string[]
  cautions: string[]
  sections: ZiweiContentDictionarySection[]
}

export interface ZiweiPalaceContentDetail {
  sectorName: SectorName
  label: string
  sourceReferences: ZiweiContentSourceReference[]
  aliases: string[]
  corePosition: string
  nature: string
  primaryQuestions: string[]
  starReadingUsage: string[]
  relationUsage: string[]
  dynamicUsage: string[]
  commonMisreads: string[]
  reportUsage: string[]
  sections: ZiweiContentDictionarySection[]
}

export type ZiweiPalaceThemeChainCategory =
  | "self"
  | "career"
  | "relationship"
  | "family"
  | "health"
  | "wealth"
  | "social"
  | "review"

export interface ZiweiPalaceThemeChainContentDetail {
  chainId: string
  label: string
  category: ZiweiPalaceThemeChainCategory
  sourceReferences: ZiweiContentSourceReference[]
  palaceSequence: SectorName[]
  primaryPalace: SectorName
  supportingPalaces: SectorName[]
  coreQuestion: string
  chainReading: string
  palaceRoles: string[]
  starUsage: string[]
  transformationUsage: string[]
  dynamicUsage: string[]
  evidenceFields: string[]
  reviewQuestions: string[]
  cautions: string[]
  sections: ZiweiContentDictionarySection[]
}

export interface ZiweiPalaceThemeChainSynthesisTemplateContentDetail {
  templateId: string
  chainId: string
  label: string
  sourceReferences: ZiweiContentSourceReference[]
  category: ZiweiPalaceThemeChainCategory
  primaryPalace: SectorName
  palaceSequence: SectorName[]
  summaryTemplate: string
  outputStructure: string[]
  evidenceOrder: string[]
  strengthRules: string[]
  breakageRules: string[]
  repairRules: string[]
  dynamicLayerRules: string[]
  hiddenResultRules: string[]
  riskBoundaries: string[]
  sourceFields: string[]
  sections: ZiweiContentDictionarySection[]
}

export interface ZiweiPalaceThemeChainEvidenceHitRuleContentDetail {
  ruleId: string
  chainId: string
  templateId: string
  label: string
  sourceReferences: ZiweiContentSourceReference[]
  category: ZiweiPalaceThemeChainCategory
  primaryPalace: SectorName
  palaceSequence: SectorName[]
  requiredEvidence: string[]
  strongHitRules: string[]
  weakHitRules: string[]
  breakageHitRules: string[]
  repairHitRules: string[]
  hiddenWhen: string[]
  dynamicLayerHitRules: string[]
  scoringNotes: string[]
  sourceFields: string[]
  sections: ZiweiContentDictionarySection[]
}

export interface ZiweiPalaceThemeChainResultThresholdContentDetail {
  thresholdId: string
  ruleId: string
  chainId: string
  templateId: string
  label: string
  sourceReferences: ZiweiContentSourceReference[]
  category: ZiweiPalaceThemeChainCategory
  primaryPalace: SectorName
  displayTiers: string[]
  visibilityThresholds: string[]
  rankingRules: string[]
  sectionOutputRules: string[]
  evidenceMergeRules: string[]
  layerInheritanceRules: string[]
  suppressionRules: string[]
  reviewEscalationRules: string[]
  sourceFields: string[]
  sections: ZiweiContentDictionarySection[]
}

export interface ZiweiPalaceThemeChainOutputParagraphTemplateContentDetail {
  paragraphTemplateId: string
  thresholdId: string
  ruleId: string
  chainId: string
  templateId: string
  label: string
  sourceReferences: ZiweiContentSourceReference[]
  category: ZiweiPalaceThemeChainCategory
  primaryPalace: SectorName
  paragraphTypes: string[]
  summaryParagraphRules: string[]
  evidenceParagraphRules: string[]
  pressureParagraphRules: string[]
  repairParagraphRules: string[]
  dynamicParagraphRules: string[]
  reviewParagraphRules: string[]
  toneRules: string[]
  sourceFields: string[]
  sections: ZiweiContentDictionarySection[]
}

export interface ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail {
  fieldId: string
  fieldName: string
  label: string
  sourceReferences: ZiweiContentSourceReference[]
  category: string
  valueShape: string
  requiredScopes: string[]
  normalizationRules: string[]
  validationRules: string[]
  mergeRules: string[]
  displayUsage: string[]
  sourceLineage: string[]
  hiddenWhen: string[]
  sections: ZiweiContentDictionarySection[]
}

export type ZiweiPalaceThemeChainParagraphType =
  | "summary"
  | "evidence"
  | "pressure"
  | "repair"
  | "dynamic"
  | "review"

export type ZiweiPalaceThemeChainFieldParagraphRequirementLevel =
  | "required"
  | "conditional"
  | "optional"
  | "hidden"
  | "review"

export interface ZiweiPalaceThemeChainFieldParagraphReviewMatrixContentDetail {
  matrixId: string
  fieldId: string
  fieldName: string
  fieldLabel: string
  sourceReferences: ZiweiContentSourceReference[]
  fieldCategory: string
  paragraphType: ZiweiPalaceThemeChainParagraphType
  paragraphLabel: string
  requirementLevel: ZiweiPalaceThemeChainFieldParagraphRequirementLevel
  requiredWhen: string[]
  optionalWhen: string[]
  hiddenWhen: string[]
  reviewTriggers: string[]
  mergeRules: string[]
  displayRules: string[]
  sourceLineage: string[]
  sections: ZiweiContentDictionarySection[]
}

export type ZiweiPalaceThemeChainEvidenceRelationDomain =
  | "pattern"
  | "transformation"
  | "palaceRelation"

export type ZiweiPalaceThemeChainEvidenceRelationRole =
  | "direct"
  | "context"
  | "support"
  | "suppression"
  | "review"

export interface ZiweiPalaceThemeChainEvidenceDomainCrossReferenceContentDetail {
  crossRefId: string
  fieldId: string
  fieldName: string
  fieldLabel: string
  sourceReferences: ZiweiContentSourceReference[]
  fieldCategory: string
  evidenceDomain: ZiweiPalaceThemeChainEvidenceRelationDomain
  domainLabel: string
  relationRole: ZiweiPalaceThemeChainEvidenceRelationRole
  evidenceUsage: string[]
  requiredEvidence: string[]
  excludedWhen: string[]
  conflictTriggers: string[]
  mergeRules: string[]
  displayRules: string[]
  sourceLineage: string[]
  sections: ZiweiContentDictionarySection[]
}

export type ZiweiTheorySourceKind =
  | "classic"
  | "public-domain-index"
  | "project-algorithm"
  | "project-dictionary"
  | "internal-synthesis"
  | "manual-calibration"
  | "modern-reference-metadata"

export interface ZiweiTheorySourceReferenceContentDetail {
  sourceId: string
  title: string
  sourceKind: ZiweiTheorySourceKind
  authorOrCompiler: string
  eraOrVersion: string
  editionOrLocation: string
  accessUrl: string | null
  sourceReliability: "high" | "medium" | "low"
  copyrightPolicy: string
  usedFor: string[]
  citationUsageRules: string[]
  storageBoundary: string[]
  relatedDataModules: string[]
  verificationNotes: string[]
  sections: ZiweiContentDictionarySection[]
}

export interface ZiweiMainStarPalaceCombinationContentDetail {
  combinationId: string
  sourceReferences: ZiweiContentSourceReference[]
  starId: ZiweiStarId
  starLabel: string
  sectorName: SectorName
  palaceLabel: string
  coreReading: string
  analysisFocus: string[]
  favorableSignals: string[]
  riskSignals: string[]
  relationUsage: string[]
  dynamicUsage: string[]
  cautions: string[]
  sections: ZiweiContentDictionarySection[]
}

export type ZiweiNonMainStarPalaceCombinationCategory =
  | "assistant"
  | "malefic"
  | "misc"

export interface ZiweiNonMainStarPalaceCombinationContentDetail {
  combinationId: string
  sourceReferences: ZiweiContentSourceReference[]
  category: ZiweiNonMainStarPalaceCombinationCategory
  starId: ZiweiStarId
  starLabel: string
  sectorName: SectorName
  palaceLabel: string
  coreReading: string
  categoryRole: string
  analysisFocus: string[]
  supportiveSignals: string[]
  pressureSignals: string[]
  relationUsage: string[]
  dynamicUsage: string[]
  evidenceFields: string[]
  cautions: string[]
  sections: ZiweiContentDictionarySection[]
}

export type ZiweiPeriodicStarPalaceCombinationGroup =
  | "lifecycle"
  | "boshi"
  | "suiqian"
  | "jiangqian"
  | "monthly"
  | "dailyHourly"

export interface ZiweiPeriodicStarPalaceCombinationContentDetail {
  combinationId: string
  sourceReferences: ZiweiContentSourceReference[]
  group: ZiweiPeriodicStarPalaceCombinationGroup
  starId: ZiweiStarId
  starLabel: string
  sectorName: SectorName
  palaceLabel: string
  coreReading: string
  groupRole: string
  timingUsage: string[]
  analysisFocus: string[]
  supportiveSignals: string[]
  pressureSignals: string[]
  relationUsage: string[]
  dynamicUsage: string[]
  evidenceFields: string[]
  cautions: string[]
  sections: ZiweiContentDictionarySection[]
}

export type ZiweiStarPairCombinationCategory =
  | "main"
  | "assistant"
  | "malefic"
  | "misc"

export type ZiweiStarPairCombinationGroup =
  | "main-main"
  | "main-assistant"
  | "main-malefic"
  | "main-misc"
  | "assistant-assistant"
  | "assistant-malefic"
  | "assistant-misc"
  | "malefic-malefic"
  | "malefic-misc"
  | "misc-misc"

export interface ZiweiStarPairCombinationContentDetail {
  combinationId: string
  sourceReferences: ZiweiContentSourceReference[]
  group: ZiweiStarPairCombinationGroup
  starAId: ZiweiStarId
  starALabel: string
  starACategory: ZiweiStarPairCombinationCategory
  starBId: ZiweiStarId
  starBLabel: string
  starBCategory: ZiweiStarPairCombinationCategory
  coreReading: string
  groupRole: string
  interactionMode: string
  readingOrder: string[]
  supportiveSignals: string[]
  pressureSignals: string[]
  palaceRelationUsage: string[]
  dynamicUsage: string[]
  evidenceFields: string[]
  cautions: string[]
  sections: ZiweiContentDictionarySection[]
}

export type ZiweiPatternCombinationRelationRole =
  | "formation"
  | "enhancement"
  | "breakage"
  | "weak-bearing"

export interface ZiweiPatternCombinationRelationContentDetail {
  relationId: string
  sourceReferences: ZiweiContentSourceReference[]
  starPairGroup: ZiweiStarPairCombinationGroup
  patternCategory: string
  patternCategoryLabel: string
  role: ZiweiPatternCombinationRelationRole
  coreReading: string
  formationUsage: string[]
  enhancementUsage: string[]
  breakageUsage: string[]
  weakBearingUsage: string[]
  evidenceFields: string[]
  reviewQuestions: string[]
  cautions: string[]
  sections: ZiweiContentDictionarySection[]
}

export type ZiweiRelationshipStructureId =
  | "same-palace"
  | "opposite-palace"
  | "trine-square"
  | "adjacent-palace"
  | "sandwich-palace"
  | "meeting"
  | "borrowed-palace"
  | "dynamic-overlay"
  | "palace-chain"
  | "source-trace"

export interface ZiweiRelationshipStructureContentDetail {
  relationId: ZiweiRelationshipStructureId
  label: string
  sourceReferences: ZiweiContentSourceReference[]
  aliases: string[]
  scope: string
  nature: string
  calculationBoundary: string[]
  evidenceUsage: string[]
  starUsage: string[]
  palaceUsage: string[]
  dynamicUsage: string[]
  patternUsage: string[]
  cautions: string[]
  sections: ZiweiContentDictionarySection[]
}

export type ZiweiTransformationTopicKind =
  | "transformation-kind"
  | "stem-trigger"
  | "flow-layer"

export interface ZiweiTransformationTopicContentDetail {
  topicId: string
  sourceReferences: ZiweiContentSourceReference[]
  kind: ZiweiTransformationTopicKind
  label: string
  aliases: string[]
  scope: string
  nature: string
  sourceUsage: string[]
  targetUsage: string[]
  palaceUsage: string[]
  flowUsage: string[]
  combinationUsage: string[]
  evidenceFields: string[]
  cautions: string[]
  relatedTransformationStarIds: ZiweiStarId[]
  relatedStem?: HeavenlyStem
  relatedFlowType?: string
  sections: ZiweiContentDictionarySection[]
}

export interface ZiweiTransformationTargetCombinationContentDetail {
  combinationId: string
  sourceReferences: ZiweiContentSourceReference[]
  transformationStarId: ZiweiStarId
  targetStarId: ZiweiStarId
  label: string
  sourceStems: HeavenlyStem[]
  sourceUsage: string[]
  targetRole: string
  transformationEffect: string[]
  palaceReading: string[]
  flowReading: string[]
  relationReading: string[]
  patternReading: string[]
  evidenceFields: string[]
  cautions: string[]
  sections: ZiweiContentDictionarySection[]
}
