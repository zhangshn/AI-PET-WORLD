import type {
  ElementGate,
  HeavenlyStem,
  SectorName,
  ZiweiStarId
} from "../../contracts"

export type ZiweiKnowledgeEntityKind =
  | "chart"
  | "branch"
  | "element-gate"
  | "stem"
  | "star"
  | "pattern"
  | "palace"
  | "brightness"
  | "dynamic-flow"
  | "term"
  | "sample"
  | "source"
  | "calibration"
  | "combination"
  | "non-main-combination"
  | "periodic-combination"
  | "star-pair-combination"
  | "pattern-combination-relation"
  | "relationship"
  | "palace-theme-chain"
  | "palace-theme-template"
  | "palace-theme-hit-rule"
  | "palace-theme-result-threshold"
  | "palace-theme-paragraph-template"
  | "palace-theme-evidence-field"
  | "palace-theme-field-paragraph-matrix"
  | "palace-theme-evidence-domain-cross-reference"
  | "theory-source-reference"
  | "transformation-topic"
  | "transformation-target"

export type ZiweiKnowledgeSourceKind =
  | "internal-contract"
  | "internal-original-note"
  | "manual-calibration"
  | "golden-sample"
  | "public-domain-reference"
  | "modern-reference-metadata"
  | "derived-analysis"

export type ZiweiKnowledgeCopyrightPolicy =
  | "original-content"
  | "metadata-only"
  | "short-attribution-only"
  | "public-domain-summary"
  | "no-direct-copy"

export type ZiweiKnowledgeReviewStatus =
  | "ready"
  | "needs-human-review"
  | "needs-source-check"
  | "deprecated"

export type ZiweiKnowledgeConfidence = "high" | "medium" | "low"

export interface ZiweiKnowledgeSource {
  id: string
  label: string
  kind: ZiweiKnowledgeSourceKind
  copyrightPolicy: ZiweiKnowledgeCopyrightPolicy
  usageBoundary: string
  storageRule: string
  reviewStatus: ZiweiKnowledgeReviewStatus
}

export interface ZiweiKnowledgeEntityRef {
  kind: ZiweiKnowledgeEntityKind
  id: string
  label: string
}

export interface ZiweiKnowledgeFacet {
  facetId: string
  label: string
  summary: string
  keywords: string[]
}

export interface ZiweiKnowledgeRecord {
  id: string
  entity: ZiweiKnowledgeEntityRef
  sourceIds: string[]
  copyrightPolicy: ZiweiKnowledgeCopyrightPolicy
  confidence: ZiweiKnowledgeConfidence
  reviewStatus: ZiweiKnowledgeReviewStatus
  analysisTags: string[]
  facets: ZiweiKnowledgeFacet[]
  storageBuckets: string[]
  applicableScopes: string[]
  relatedEntityIds: string[]
  cautionFlags: string[]
}

export interface ZiweiStarKnowledgeRecord extends ZiweiKnowledgeRecord {
  entity: {
    kind: "star"
    id: ZiweiStarId
    label: string
  }
  starCategory: string
}

export interface ZiweiPatternKnowledgeRecord extends ZiweiKnowledgeRecord {
  entity: {
    kind: "pattern"
    id: string
    label: string
  }
  patternCategory: string
}

export interface ZiweiBranchKnowledgeRecord extends ZiweiKnowledgeRecord {
  entity: {
    kind: "branch"
    id: string
    label: string
  }
  branchGroups: string[]
}

export interface ZiweiStemKnowledgeRecord extends ZiweiKnowledgeRecord {
  entity: {
    kind: "stem"
    id: HeavenlyStem
    label: string
  }
  pairGroup: string
}

export interface ZiweiElementGateKnowledgeRecord extends ZiweiKnowledgeRecord {
  entity: {
    kind: "element-gate"
    id: ElementGate
    label: string
  }
  baseNumber: 2 | 3 | 4 | 5 | 6
}

export interface ZiweiPalaceKnowledgeRecord extends ZiweiKnowledgeRecord {
  entity: {
    kind: "palace"
    id: SectorName
    label: string
  }
  corePosition: string
}

export interface ZiweiMainStarPalaceCombinationKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "combination"
    id: string
    label: string
  }
  starId: ZiweiStarId
  sectorName: SectorName
}

export interface ZiweiNonMainStarPalaceCombinationKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "non-main-combination"
    id: string
    label: string
  }
  starId: ZiweiStarId
  sectorName: SectorName
  starCategory: string
}

export interface ZiweiPeriodicStarPalaceCombinationKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "periodic-combination"
    id: string
    label: string
  }
  starId: ZiweiStarId
  sectorName: SectorName
  periodicGroup: string
}

export interface ZiweiStarPairCombinationKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "star-pair-combination"
    id: string
    label: string
  }
  starAId: ZiweiStarId
  starBId: ZiweiStarId
  combinationGroup: string
}

export interface ZiweiPatternCombinationRelationKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "pattern-combination-relation"
    id: string
    label: string
  }
  starPairGroup: string
  patternCategory: string
  relationRole: string
}

export interface ZiweiRelationshipStructureKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "relationship"
    id: string
    label: string
  }
  relationScope: string
}

export interface ZiweiPalaceThemeChainKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "palace-theme-chain"
    id: string
    label: string
  }
  chainCategory: string
  primaryPalace: SectorName
  palaceSequence: SectorName[]
}

export interface ZiweiPalaceThemeChainSynthesisTemplateKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "palace-theme-template"
    id: string
    label: string
  }
  chainId: string
  templateCategory: string
  primaryPalace: SectorName
}

export interface ZiweiPalaceThemeChainEvidenceHitRuleKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "palace-theme-hit-rule"
    id: string
    label: string
  }
  chainId: string
  templateId: string
  ruleCategory: string
  primaryPalace: SectorName
}

export interface ZiweiPalaceThemeChainResultThresholdKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "palace-theme-result-threshold"
    id: string
    label: string
  }
  chainId: string
  ruleId: string
  templateId: string
  thresholdCategory: string
  primaryPalace: SectorName
}

export interface ZiweiPalaceThemeChainOutputParagraphTemplateKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "palace-theme-paragraph-template"
    id: string
    label: string
  }
  chainId: string
  thresholdId: string
  ruleId: string
  templateId: string
  paragraphCategory: string
  primaryPalace: SectorName
}

export interface ZiweiPalaceThemeChainEvidenceFieldStandardKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "palace-theme-evidence-field"
    id: string
    label: string
  }
  fieldName: string
  fieldCategory: string
}

export interface ZiweiPalaceThemeChainFieldParagraphReviewMatrixKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "palace-theme-field-paragraph-matrix"
    id: string
    label: string
  }
  fieldName: string
  paragraphType: string
  requirementLevel: string
}

export interface ZiweiPalaceThemeChainEvidenceDomainCrossReferenceKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "palace-theme-evidence-domain-cross-reference"
    id: string
    label: string
  }
  fieldName: string
  evidenceDomain: string
  relationRole: string
}

export interface ZiweiTheorySourceReferenceKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "theory-source-reference"
    id: string
    label: string
  }
  sourceKind: string
  sourceReliability: string
}

export interface ZiweiTransformationTopicKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "transformation-topic"
    id: string
    label: string
  }
  topicKind: string
}

export interface ZiweiTransformationTargetCombinationKnowledgeRecord
  extends ZiweiKnowledgeRecord {
  entity: {
    kind: "transformation-target"
    id: string
    label: string
  }
  transformationStarId: ZiweiStarId
  targetStarId: ZiweiStarId
}

export interface ZiweiKnowledgeTerm {
  id: string
  label: string
  entityKind: ZiweiKnowledgeEntityKind
  aliases: string[]
  definition: string
  analysisUsage: string[]
  sourceIds: string[]
  copyrightPolicy: ZiweiKnowledgeCopyrightPolicy
}

export interface ZiweiKnowledgeIntakePack {
  id: string
  label: string
  purpose: string
  acceptedData: string[]
  rejectedData: string[]
  sourceIds: string[]
  copyrightPolicy: ZiweiKnowledgeCopyrightPolicy
  reviewStatus: ZiweiKnowledgeReviewStatus
  storageBuckets: string[]
  analysisTags: string[]
}

export interface ZiweiKnowledgeAnalysisDimension {
  id: string
  label: string
  scope: ZiweiKnowledgeEntityKind
  description: string
  inputBuckets: string[]
  outputTags: string[]
  reviewQuestions: string[]
}

export interface ZiweiKnowledgeCalibrationField {
  id: string
  label: string
  scope: ZiweiKnowledgeEntityKind
  description: string
  required: boolean
  sourceIds: string[]
  reviewStatus: ZiweiKnowledgeReviewStatus
}

export interface ZiweiKnowledgeRepositorySnapshot {
  sources: ZiweiKnowledgeSource[]
  terms: ZiweiKnowledgeTerm[]
  intakePacks: ZiweiKnowledgeIntakePack[]
  analysisDimensions: ZiweiKnowledgeAnalysisDimension[]
  calibrationFields: ZiweiKnowledgeCalibrationField[]
  starRecords: ZiweiStarKnowledgeRecord[]
  patternRecords: ZiweiPatternKnowledgeRecord[]
  branchRecords: ZiweiBranchKnowledgeRecord[]
  stemRecords: ZiweiStemKnowledgeRecord[]
  elementGateRecords: ZiweiElementGateKnowledgeRecord[]
  palaceRecords: ZiweiPalaceKnowledgeRecord[]
  mainStarPalaceCombinationRecords: ZiweiMainStarPalaceCombinationKnowledgeRecord[]
  nonMainStarPalaceCombinationRecords: ZiweiNonMainStarPalaceCombinationKnowledgeRecord[]
  periodicStarPalaceCombinationRecords: ZiweiPeriodicStarPalaceCombinationKnowledgeRecord[]
  starPairCombinationRecords: ZiweiStarPairCombinationKnowledgeRecord[]
  patternCombinationRelationRecords: ZiweiPatternCombinationRelationKnowledgeRecord[]
  relationshipStructureRecords: ZiweiRelationshipStructureKnowledgeRecord[]
  palaceThemeChainRecords: ZiweiPalaceThemeChainKnowledgeRecord[]
  palaceThemeChainSynthesisTemplateRecords: ZiweiPalaceThemeChainSynthesisTemplateKnowledgeRecord[]
  palaceThemeChainEvidenceHitRuleRecords: ZiweiPalaceThemeChainEvidenceHitRuleKnowledgeRecord[]
  palaceThemeChainResultThresholdRecords: ZiweiPalaceThemeChainResultThresholdKnowledgeRecord[]
  palaceThemeChainOutputParagraphTemplateRecords: ZiweiPalaceThemeChainOutputParagraphTemplateKnowledgeRecord[]
  palaceThemeChainEvidenceFieldStandardRecords: ZiweiPalaceThemeChainEvidenceFieldStandardKnowledgeRecord[]
  palaceThemeChainFieldParagraphReviewMatrixRecords: ZiweiPalaceThemeChainFieldParagraphReviewMatrixKnowledgeRecord[]
  palaceThemeChainEvidenceDomainCrossReferenceRecords: ZiweiPalaceThemeChainEvidenceDomainCrossReferenceKnowledgeRecord[]
  theorySourceReferenceRecords: ZiweiTheorySourceReferenceKnowledgeRecord[]
  transformationTopicRecords: ZiweiTransformationTopicKnowledgeRecord[]
  transformationTargetCombinationRecords: ZiweiTransformationTargetCombinationKnowledgeRecord[]
  stats: {
    sourceCount: number
    termCount: number
    intakePackCount: number
    analysisDimensionCount: number
    calibrationFieldCount: number
    starRecordCount: number
    patternRecordCount: number
    branchRecordCount: number
    stemRecordCount: number
    elementGateRecordCount: number
    palaceRecordCount: number
    mainStarPalaceCombinationRecordCount: number
    nonMainStarPalaceCombinationRecordCount: number
    periodicStarPalaceCombinationRecordCount: number
    starPairCombinationRecordCount: number
    patternCombinationRelationRecordCount: number
    relationshipStructureRecordCount: number
    palaceThemeChainRecordCount: number
    palaceThemeChainSynthesisTemplateRecordCount: number
    palaceThemeChainEvidenceHitRuleRecordCount: number
    palaceThemeChainResultThresholdRecordCount: number
    palaceThemeChainOutputParagraphTemplateRecordCount: number
    palaceThemeChainEvidenceFieldStandardRecordCount: number
    palaceThemeChainFieldParagraphReviewMatrixRecordCount: number
    palaceThemeChainEvidenceDomainCrossReferenceRecordCount: number
    theorySourceReferenceRecordCount: number
    transformationTopicRecordCount: number
    transformationTargetCombinationRecordCount: number
    recordCount: number
  }
}
