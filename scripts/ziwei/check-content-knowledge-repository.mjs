import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import ts from "typescript"

const require = createRequire(import.meta.url)

require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText

  module._compile(output, filename)
}

const {
  buildZiweiKnowledgeRepositorySnapshot,
  buildZiweiPatternContentDictionaryDetail,
  buildZiweiStarContentDictionaryDetail,
  ZIWEI_KNOWLEDGE_ANALYSIS_DIMENSIONS,
  ZIWEI_KNOWLEDGE_CALIBRATION_FIELDS,
  ZIWEI_KNOWLEDGE_INTAKE_PACKS,
  ZIWEI_KNOWLEDGE_SOURCES,
  ZIWEI_KNOWLEDGE_TERMS,
  getAllBranchContentDetails,
  getAllBranchGroupContentDetails,
  getAllElementGateContentDetails,
  getAllMainStarPalaceCombinationContentDetails,
  getAllNonMainStarPalaceCombinationContentDetails,
  getAllPalaceContentDetails,
  getAllPalaceThemeChainEvidenceDomainCrossReferenceContentDetails,
  getAllPalaceThemeChainEvidenceFieldStandardContentDetails,
  getAllPalaceThemeChainEvidenceHitRuleContentDetails,
  getAllPalaceThemeChainFieldParagraphReviewMatrixContentDetails,
  getAllPalaceThemeChainOutputParagraphTemplateContentDetails,
  getAllPalaceThemeChainResultThresholdContentDetails,
  getAllPalaceThemeChainContentDetails,
  getAllPalaceThemeChainSynthesisTemplateContentDetails,
  getAllPatternCombinationRelationContentDetails,
  getAllPeriodicStarPalaceCombinationContentDetails,
  getAllRelationshipStructureContentDetails,
  getAllStarPairCombinationContentDetails,
  getAllTheorySourceReferenceContentDetails,
  getAllZiweiContentExpansionPriorityItems,
  getAllZiweiSourceReferenceLayerIndexItems,
  getAllZiweiSourceReferenceReviewQueueItems,
  getAllTransformationTargetCombinationContentDetails,
  getAllTransformationTopicContentDetails,
  getAllStemContentDetails,
  ZIWEI_SOURCE_REFERENCE_INDEX_TOTAL_RECORD_COUNT
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")
const {
  ziweiStarCatalog
} = require("../../src/ai/destiny-core/ziwei-core/star-catalog/index.ts")
const {
  ZIWEI_PATTERN_DEFINITIONS
} = require("../../src/app/ziwei/_lib/ziwei-pattern-catalog.ts")

function fail(message) {
  console.error(`[check-content-knowledge-repository] ${message}`)
  process.exit(1)
}

const patternInputs = ZIWEI_PATTERN_DEFINITIONS.map((definition) => {
  return {
    id: definition.id,
    label: definition.label,
    category: definition.category,
    conditionText: definition.conditionText
  }
})

const snapshot = buildZiweiKnowledgeRepositorySnapshot({
  stars: ziweiStarCatalog,
  patterns: patternInputs
})

if (ZIWEI_KNOWLEDGE_SOURCES.length < 33) {
  fail(`expected at least 33 source slots, got ${ZIWEI_KNOWLEDGE_SOURCES.length}`)
}

if (ZIWEI_KNOWLEDGE_TERMS.length < 167) {
  fail(`expected at least 167 knowledge terms, got ${ZIWEI_KNOWLEDGE_TERMS.length}`)
}

if (ZIWEI_KNOWLEDGE_INTAKE_PACKS.length < 36) {
  fail(`expected at least 36 intake packs, got ${ZIWEI_KNOWLEDGE_INTAKE_PACKS.length}`)
}

if (ZIWEI_KNOWLEDGE_ANALYSIS_DIMENSIONS.length < 44) {
  fail(
    `expected at least 44 analysis dimensions, got ${ZIWEI_KNOWLEDGE_ANALYSIS_DIMENSIONS.length}`
  )
}

if (ZIWEI_KNOWLEDGE_CALIBRATION_FIELDS.length < 44) {
  fail(
    `expected at least 44 calibration fields, got ${ZIWEI_KNOWLEDGE_CALIBRATION_FIELDS.length}`
  )
}

if (snapshot.starRecords.length !== ziweiStarCatalog.length) {
  fail(`star record count mismatch: ${snapshot.starRecords.length} !== ${ziweiStarCatalog.length}`)
}

if (snapshot.patternRecords.length !== ZIWEI_PATTERN_DEFINITIONS.length) {
  fail(
    `pattern record count mismatch: ${snapshot.patternRecords.length} !== ${ZIWEI_PATTERN_DEFINITIONS.length}`
  )
}

const branchDetails = getAllBranchContentDetails()
const branchGroups = getAllBranchGroupContentDetails()
const stemDetails = getAllStemContentDetails()
const elementGateDetails = getAllElementGateContentDetails()
const palaceDetails = getAllPalaceContentDetails()
const mainStarPalaceCombinationDetails = getAllMainStarPalaceCombinationContentDetails()
const nonMainStarPalaceCombinationDetails =
  getAllNonMainStarPalaceCombinationContentDetails()
const periodicStarPalaceCombinationDetails =
  getAllPeriodicStarPalaceCombinationContentDetails()
const starPairCombinationDetails = getAllStarPairCombinationContentDetails()
const patternCombinationRelationDetails = getAllPatternCombinationRelationContentDetails()
const relationshipStructureDetails = getAllRelationshipStructureContentDetails()
const palaceThemeChainDetails = getAllPalaceThemeChainContentDetails()
const palaceThemeChainEvidenceHitRuleDetails =
  getAllPalaceThemeChainEvidenceHitRuleContentDetails()
const palaceThemeChainResultThresholdDetails =
  getAllPalaceThemeChainResultThresholdContentDetails()
const palaceThemeChainOutputParagraphTemplateDetails =
  getAllPalaceThemeChainOutputParagraphTemplateContentDetails()
const palaceThemeChainEvidenceFieldStandardDetails =
  getAllPalaceThemeChainEvidenceFieldStandardContentDetails()
const palaceThemeChainFieldParagraphReviewMatrixDetails =
  getAllPalaceThemeChainFieldParagraphReviewMatrixContentDetails()
const palaceThemeChainEvidenceDomainCrossReferenceDetails =
  getAllPalaceThemeChainEvidenceDomainCrossReferenceContentDetails()
const palaceThemeChainSynthesisTemplateDetails =
  getAllPalaceThemeChainSynthesisTemplateContentDetails()
const theorySourceReferenceDetails = getAllTheorySourceReferenceContentDetails()
const theorySourceReferenceIds = new Set(
  theorySourceReferenceDetails.map((detail) => detail.sourceId)
)
const sourceReferenceLayerIndex = getAllZiweiSourceReferenceLayerIndexItems()
const sourceReferenceReviewQueue = getAllZiweiSourceReferenceReviewQueueItems()
const contentExpansionPriorityQueue = getAllZiweiContentExpansionPriorityItems()
const starDictionaryDetails = ziweiStarCatalog.map((star) => {
  return buildZiweiStarContentDictionaryDetail(star)
})
const patternDictionaryDetails = patternInputs.map((input) => {
  return buildZiweiPatternContentDictionaryDetail(input)
})
const transformationTopicDetails = getAllTransformationTopicContentDetails()
const transformationTargetCombinationDetails =
  getAllTransformationTargetCombinationContentDetails()

if (branchDetails.length !== 12) {
  fail(`expected 12 branch detail records, got ${branchDetails.length}`)
}

if (branchGroups.length < 7) {
  fail(`expected at least 7 branch group records, got ${branchGroups.length}`)
}

if (snapshot.branchRecords.length !== branchDetails.length) {
  fail(`branch record count mismatch: ${snapshot.branchRecords.length} !== ${branchDetails.length}`)
}

if (snapshot.stats.branchRecordCount !== 12) {
  fail(`branch stats count mismatch: ${snapshot.stats.branchRecordCount} !== 12`)
}

if (stemDetails.length !== 10) {
  fail(`expected 10 stem detail records, got ${stemDetails.length}`)
}

if (elementGateDetails.length !== 5) {
  fail(`expected 5 element gate detail records, got ${elementGateDetails.length}`)
}

if (snapshot.stemRecords.length !== stemDetails.length) {
  fail(`stem record count mismatch: ${snapshot.stemRecords.length} !== ${stemDetails.length}`)
}

if (snapshot.elementGateRecords.length !== elementGateDetails.length) {
  fail(
    `element gate record count mismatch: ${snapshot.elementGateRecords.length} !== ${elementGateDetails.length}`
  )
}

if (snapshot.stats.stemRecordCount !== 10) {
  fail(`stem stats count mismatch: ${snapshot.stats.stemRecordCount} !== 10`)
}

if (snapshot.stats.elementGateRecordCount !== 5) {
  fail(`element gate stats count mismatch: ${snapshot.stats.elementGateRecordCount} !== 5`)
}

if (palaceDetails.length !== 12) {
  fail(`expected 12 palace detail records, got ${palaceDetails.length}`)
}

if (snapshot.palaceRecords.length !== palaceDetails.length) {
  fail(`palace record count mismatch: ${snapshot.palaceRecords.length} !== ${palaceDetails.length}`)
}

if (snapshot.stats.palaceRecordCount !== 12) {
  fail(`palace stats count mismatch: ${snapshot.stats.palaceRecordCount} !== 12`)
}

if (mainStarPalaceCombinationDetails.length !== 168) {
  fail(
    `expected 168 main star palace combination detail records, got ${mainStarPalaceCombinationDetails.length}`
  )
}

if (
  snapshot.mainStarPalaceCombinationRecords.length !==
  mainStarPalaceCombinationDetails.length
) {
  fail(
    `main star palace combination record count mismatch: ${snapshot.mainStarPalaceCombinationRecords.length} !== ${mainStarPalaceCombinationDetails.length}`
  )
}

if (snapshot.stats.mainStarPalaceCombinationRecordCount !== 168) {
  fail(
    `main star palace combination stats count mismatch: ${snapshot.stats.mainStarPalaceCombinationRecordCount} !== 168`
  )
}

if (nonMainStarPalaceCombinationDetails.length !== 348) {
  fail(
    `expected 348 non-main star palace combination detail records, got ${nonMainStarPalaceCombinationDetails.length}`
  )
}

if (
  snapshot.nonMainStarPalaceCombinationRecords.length !==
  nonMainStarPalaceCombinationDetails.length
) {
  fail(
    `non-main star palace combination record count mismatch: ${snapshot.nonMainStarPalaceCombinationRecords.length} !== ${nonMainStarPalaceCombinationDetails.length}`
  )
}

if (snapshot.stats.nonMainStarPalaceCombinationRecordCount !== 348) {
  fail(
    `non-main star palace combination stats count mismatch: ${snapshot.stats.nonMainStarPalaceCombinationRecordCount} !== 348`
  )
}

if (periodicStarPalaceCombinationDetails.length !== 672) {
  fail(
    `expected 672 periodic star palace combination detail records, got ${periodicStarPalaceCombinationDetails.length}`
  )
}

if (
  snapshot.periodicStarPalaceCombinationRecords.length !==
  periodicStarPalaceCombinationDetails.length
) {
  fail(
    `periodic star palace combination record count mismatch: ${snapshot.periodicStarPalaceCombinationRecords.length} !== ${periodicStarPalaceCombinationDetails.length}`
  )
}

if (snapshot.stats.periodicStarPalaceCombinationRecordCount !== 672) {
  fail(
    `periodic star palace combination stats count mismatch: ${snapshot.stats.periodicStarPalaceCombinationRecordCount} !== 672`
  )
}

if (starPairCombinationDetails.length !== 903) {
  fail(
    `expected 903 star pair combination detail records, got ${starPairCombinationDetails.length}`
  )
}

if (
  snapshot.starPairCombinationRecords.length !==
  starPairCombinationDetails.length
) {
  fail(
    `star pair combination record count mismatch: ${snapshot.starPairCombinationRecords.length} !== ${starPairCombinationDetails.length}`
  )
}

if (snapshot.stats.starPairCombinationRecordCount !== 903) {
  fail(
    `star pair combination stats count mismatch: ${snapshot.stats.starPairCombinationRecordCount} !== 903`
  )
}

if (patternCombinationRelationDetails.length !== 80) {
  fail(
    `expected 80 pattern combination relation detail records, got ${patternCombinationRelationDetails.length}`
  )
}

if (
  snapshot.patternCombinationRelationRecords.length !==
  patternCombinationRelationDetails.length
) {
  fail(
    `pattern combination relation record count mismatch: ${snapshot.patternCombinationRelationRecords.length} !== ${patternCombinationRelationDetails.length}`
  )
}

if (snapshot.stats.patternCombinationRelationRecordCount !== 80) {
  fail(
    `pattern combination relation stats count mismatch: ${snapshot.stats.patternCombinationRelationRecordCount} !== 80`
  )
}

if (relationshipStructureDetails.length !== 10) {
  fail(
    `expected 10 relationship structure detail records, got ${relationshipStructureDetails.length}`
  )
}

if (
  snapshot.relationshipStructureRecords.length !== relationshipStructureDetails.length
) {
  fail(
    `relationship structure record count mismatch: ${snapshot.relationshipStructureRecords.length} !== ${relationshipStructureDetails.length}`
  )
}

if (snapshot.stats.relationshipStructureRecordCount !== 10) {
  fail(
    `relationship structure stats count mismatch: ${snapshot.stats.relationshipStructureRecordCount} !== 10`
  )
}

if (palaceThemeChainDetails.length !== 24) {
  fail(`expected 24 palace theme chain detail records, got ${palaceThemeChainDetails.length}`)
}

if (snapshot.palaceThemeChainRecords.length !== palaceThemeChainDetails.length) {
  fail(
    `palace theme chain record count mismatch: ${snapshot.palaceThemeChainRecords.length} !== ${palaceThemeChainDetails.length}`
  )
}

if (snapshot.stats.palaceThemeChainRecordCount !== 24) {
  fail(
    `palace theme chain stats count mismatch: ${snapshot.stats.palaceThemeChainRecordCount} !== 24`
  )
}

if (palaceThemeChainEvidenceHitRuleDetails.length !== 24) {
  fail(
    `expected 24 palace theme chain evidence hit rule detail records, got ${palaceThemeChainEvidenceHitRuleDetails.length}`
  )
}

if (
  snapshot.palaceThemeChainEvidenceHitRuleRecords.length !==
  palaceThemeChainEvidenceHitRuleDetails.length
) {
  fail(
    `palace theme chain evidence hit rule record count mismatch: ${snapshot.palaceThemeChainEvidenceHitRuleRecords.length} !== ${palaceThemeChainEvidenceHitRuleDetails.length}`
  )
}

if (snapshot.stats.palaceThemeChainEvidenceHitRuleRecordCount !== 24) {
  fail(
    `palace theme chain evidence hit rule stats count mismatch: ${snapshot.stats.palaceThemeChainEvidenceHitRuleRecordCount} !== 24`
  )
}

if (palaceThemeChainResultThresholdDetails.length !== 24) {
  fail(
    `expected 24 palace theme chain result threshold detail records, got ${palaceThemeChainResultThresholdDetails.length}`
  )
}

if (
  snapshot.palaceThemeChainResultThresholdRecords.length !==
  palaceThemeChainResultThresholdDetails.length
) {
  fail(
    `palace theme chain result threshold record count mismatch: ${snapshot.palaceThemeChainResultThresholdRecords.length} !== ${palaceThemeChainResultThresholdDetails.length}`
  )
}

if (snapshot.stats.palaceThemeChainResultThresholdRecordCount !== 24) {
  fail(
    `palace theme chain result threshold stats count mismatch: ${snapshot.stats.palaceThemeChainResultThresholdRecordCount} !== 24`
  )
}

if (palaceThemeChainOutputParagraphTemplateDetails.length !== 24) {
  fail(
    `expected 24 palace theme chain output paragraph template detail records, got ${palaceThemeChainOutputParagraphTemplateDetails.length}`
  )
}

if (
  snapshot.palaceThemeChainOutputParagraphTemplateRecords.length !==
  palaceThemeChainOutputParagraphTemplateDetails.length
) {
  fail(
    `palace theme chain output paragraph template record count mismatch: ${snapshot.palaceThemeChainOutputParagraphTemplateRecords.length} !== ${palaceThemeChainOutputParagraphTemplateDetails.length}`
  )
}

if (snapshot.stats.palaceThemeChainOutputParagraphTemplateRecordCount !== 24) {
  fail(
    `palace theme chain output paragraph template stats count mismatch: ${snapshot.stats.palaceThemeChainOutputParagraphTemplateRecordCount} !== 24`
  )
}

if (palaceThemeChainEvidenceFieldStandardDetails.length !== 24) {
  fail(
    `expected 24 palace theme chain evidence field standard detail records, got ${palaceThemeChainEvidenceFieldStandardDetails.length}`
  )
}

if (
  snapshot.palaceThemeChainEvidenceFieldStandardRecords.length !==
  palaceThemeChainEvidenceFieldStandardDetails.length
) {
  fail(
    `palace theme chain evidence field standard record count mismatch: ${snapshot.palaceThemeChainEvidenceFieldStandardRecords.length} !== ${palaceThemeChainEvidenceFieldStandardDetails.length}`
  )
}

if (snapshot.stats.palaceThemeChainEvidenceFieldStandardRecordCount !== 24) {
  fail(
    `palace theme chain evidence field standard stats count mismatch: ${snapshot.stats.palaceThemeChainEvidenceFieldStandardRecordCount} !== 24`
  )
}

if (palaceThemeChainFieldParagraphReviewMatrixDetails.length !== 144) {
  fail(
    `expected 144 palace theme chain field paragraph review matrix detail records, got ${palaceThemeChainFieldParagraphReviewMatrixDetails.length}`
  )
}

if (
  snapshot.palaceThemeChainFieldParagraphReviewMatrixRecords.length !==
  palaceThemeChainFieldParagraphReviewMatrixDetails.length
) {
  fail(
    `palace theme chain field paragraph review matrix record count mismatch: ${snapshot.palaceThemeChainFieldParagraphReviewMatrixRecords.length} !== ${palaceThemeChainFieldParagraphReviewMatrixDetails.length}`
  )
}

if (snapshot.stats.palaceThemeChainFieldParagraphReviewMatrixRecordCount !== 144) {
  fail(
    `palace theme chain field paragraph review matrix stats count mismatch: ${snapshot.stats.palaceThemeChainFieldParagraphReviewMatrixRecordCount} !== 144`
  )
}

if (palaceThemeChainEvidenceDomainCrossReferenceDetails.length !== 72) {
  fail(
    `expected 72 palace theme chain evidence domain cross reference detail records, got ${palaceThemeChainEvidenceDomainCrossReferenceDetails.length}`
  )
}

if (
  snapshot.palaceThemeChainEvidenceDomainCrossReferenceRecords.length !==
  palaceThemeChainEvidenceDomainCrossReferenceDetails.length
) {
  fail(
    `palace theme chain evidence domain cross reference record count mismatch: ${snapshot.palaceThemeChainEvidenceDomainCrossReferenceRecords.length} !== ${palaceThemeChainEvidenceDomainCrossReferenceDetails.length}`
  )
}

if (snapshot.stats.palaceThemeChainEvidenceDomainCrossReferenceRecordCount !== 72) {
  fail(
    `palace theme chain evidence domain cross reference stats count mismatch: ${snapshot.stats.palaceThemeChainEvidenceDomainCrossReferenceRecordCount} !== 72`
  )
}

if (theorySourceReferenceDetails.length < 13) {
  fail(
    `expected at least 13 theory source reference detail records, got ${theorySourceReferenceDetails.length}`
  )
}

if (
  snapshot.theorySourceReferenceRecords.length !==
  theorySourceReferenceDetails.length
) {
  fail(
    `theory source reference record count mismatch: ${snapshot.theorySourceReferenceRecords.length} !== ${theorySourceReferenceDetails.length}`
  )
}

if (snapshot.stats.theorySourceReferenceRecordCount < 13) {
  fail(
    `expected at least 13 theory source reference stats records, got ${snapshot.stats.theorySourceReferenceRecordCount}`
  )
}

const sourceReferenceLayerRecordCounts = new Map([
  ["star.dictionary", starDictionaryDetails.length],
  ["pattern.dictionary", patternDictionaryDetails.length],
  ["branch.dictionary", branchDetails.length],
  ["stem.dictionary", stemDetails.length],
  ["element-gate.dictionary", elementGateDetails.length],
  ["palace.dictionary", palaceDetails.length],
  ["main-star.palace-combination", mainStarPalaceCombinationDetails.length],
  ["non-main-star.palace-combination", nonMainStarPalaceCombinationDetails.length],
  ["periodic-star.palace-combination", periodicStarPalaceCombinationDetails.length],
  ["star-pair.combination", starPairCombinationDetails.length],
  ["pattern-combination.relation", patternCombinationRelationDetails.length],
  ["relationship.structure", relationshipStructureDetails.length],
  ["palace-theme.chain", palaceThemeChainDetails.length],
  ["palace-theme.synthesis-template", palaceThemeChainSynthesisTemplateDetails.length],
  ["palace-theme.evidence-hit-rule", palaceThemeChainEvidenceHitRuleDetails.length],
  ["palace-theme.result-threshold", palaceThemeChainResultThresholdDetails.length],
  ["palace-theme.output-paragraph-template", palaceThemeChainOutputParagraphTemplateDetails.length],
  ["palace-theme.evidence-field-standard", palaceThemeChainEvidenceFieldStandardDetails.length],
  ["palace-theme.field-paragraph-matrix", palaceThemeChainFieldParagraphReviewMatrixDetails.length],
  [
    "palace-theme.evidence-domain-cross-reference",
    palaceThemeChainEvidenceDomainCrossReferenceDetails.length
  ],
  ["transformation.topic", transformationTopicDetails.length],
  ["transformation.target-combination", transformationTargetCombinationDetails.length]
])

assertSourceReferenceLayerIndex(sourceReferenceLayerIndex, sourceReferenceLayerRecordCounts)
assertSourceReferenceReviewQueue(sourceReferenceReviewQueue, sourceReferenceLayerIndex)
assertContentExpansionPriorityQueue(contentExpansionPriorityQueue, sourceReferenceLayerIndex)

starDictionaryDetails.forEach((detail) => {
  assertSourceReferences(detail.starId, detail.sourceReferences, 5)
  assertSourceReferenceIncludes(detail.starId, detail.sourceReferences, [
    "project.star-catalog",
    "project.content-dictionary",
    "project.brightness-table"
  ])
})

patternDictionaryDetails.forEach((detail) => {
  assertSourceReferences(detail.patternId, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.patternId, detail.sourceReferences, [
    "project.pattern-catalog",
    "project.content-dictionary"
  ])
})

palaceDetails.forEach((detail) => {
  assertSourceReferences(detail.sectorName, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.sectorName, detail.sourceReferences, [
    "project.content-dictionary",
    "project.dynamic-flow-rules"
  ])
})

palaceThemeChainDetails.forEach((detail) => {
  assertSourceReferences(detail.chainId, detail.sourceReferences, 5)
  assertSourceReferenceIncludes(detail.chainId, detail.sourceReferences, [
    "project.pattern-catalog",
    "project.transformation-rules",
    "project.dynamic-flow-rules"
  ])
})

branchDetails.forEach((detail) => {
  assertSourceReferences(detail.branch, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.branch, detail.sourceReferences, [
    "project.content-dictionary",
    "project.dynamic-flow-rules"
  ])
})

stemDetails.forEach((detail) => {
  assertSourceReferences(detail.stem, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.stem, detail.sourceReferences, [
    "project.content-dictionary",
    "project.transformation-rules"
  ])
})

elementGateDetails.forEach((detail) => {
  assertSourceReferences(detail.gate, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.gate, detail.sourceReferences, [
    "project.content-dictionary",
    "project.dynamic-flow-rules"
  ])
})

mainStarPalaceCombinationDetails.forEach((detail) => {
  assertSourceReferences(detail.combinationId, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.combinationId, detail.sourceReferences, [
    "project.star-catalog",
    "project.content-dictionary",
    "project.dynamic-flow-rules"
  ])
})

nonMainStarPalaceCombinationDetails.forEach((detail) => {
  assertSourceReferences(detail.combinationId, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.combinationId, detail.sourceReferences, [
    "project.star-catalog",
    "project.content-dictionary",
    "project.dynamic-flow-rules"
  ])
})

periodicStarPalaceCombinationDetails.forEach((detail) => {
  assertSourceReferences(detail.combinationId, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.combinationId, detail.sourceReferences, [
    "project.star-catalog",
    "project.content-dictionary",
    "project.dynamic-flow-rules"
  ])
})

starPairCombinationDetails.forEach((detail) => {
  assertSourceReferences(detail.combinationId, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.combinationId, detail.sourceReferences, [
    "project.star-catalog",
    "project.content-dictionary",
    "project.pattern-catalog"
  ])
})

patternCombinationRelationDetails.forEach((detail) => {
  assertSourceReferences(detail.relationId, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.relationId, detail.sourceReferences, [
    "project.star-catalog",
    "project.pattern-catalog",
    "project.content-dictionary"
  ])
})

relationshipStructureDetails.forEach((detail) => {
  assertSourceReferences(detail.relationId, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.relationId, detail.sourceReferences, [
    "project.content-dictionary",
    "project.dynamic-flow-rules",
    "project.pattern-catalog"
  ])
})

transformationTopicDetails.forEach((detail) => {
  assertSourceReferences(detail.topicId, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.topicId, detail.sourceReferences, [
    "project.transformation-rules",
    "project.star-catalog",
    "project.content-dictionary"
  ])
})

transformationTargetCombinationDetails.forEach((detail) => {
  assertSourceReferences(detail.combinationId, detail.sourceReferences, 4)
  assertSourceReferenceIncludes(detail.combinationId, detail.sourceReferences, [
    "project.transformation-rules",
    "project.star-catalog",
    "project.content-dictionary"
  ])
})

palaceThemeChainSynthesisTemplateDetails.forEach((detail) => {
  assertPalaceThemeRuleSourceReferences(detail.templateId, detail.sourceReferences)
})

palaceThemeChainEvidenceHitRuleDetails.forEach((detail) => {
  assertPalaceThemeRuleSourceReferences(detail.ruleId, detail.sourceReferences)
})

palaceThemeChainResultThresholdDetails.forEach((detail) => {
  assertPalaceThemeRuleSourceReferences(detail.thresholdId, detail.sourceReferences)
})

palaceThemeChainOutputParagraphTemplateDetails.forEach((detail) => {
  assertPalaceThemeRuleSourceReferences(detail.paragraphTemplateId, detail.sourceReferences)
})

palaceThemeChainEvidenceFieldStandardDetails.forEach((detail) => {
  assertPalaceThemeRuleSourceReferences(detail.fieldId, detail.sourceReferences)
})

palaceThemeChainFieldParagraphReviewMatrixDetails.forEach((detail) => {
  assertPalaceThemeRuleSourceReferences(detail.matrixId, detail.sourceReferences)
})

palaceThemeChainEvidenceDomainCrossReferenceDetails.forEach((detail) => {
  assertPalaceThemeRuleSourceReferences(detail.crossRefId, detail.sourceReferences)
})

if (palaceThemeChainSynthesisTemplateDetails.length !== 24) {
  fail(
    `expected 24 palace theme chain synthesis template detail records, got ${palaceThemeChainSynthesisTemplateDetails.length}`
  )
}

if (
  snapshot.palaceThemeChainSynthesisTemplateRecords.length !==
  palaceThemeChainSynthesisTemplateDetails.length
) {
  fail(
    `palace theme chain synthesis template record count mismatch: ${snapshot.palaceThemeChainSynthesisTemplateRecords.length} !== ${palaceThemeChainSynthesisTemplateDetails.length}`
  )
}

if (snapshot.stats.palaceThemeChainSynthesisTemplateRecordCount !== 24) {
  fail(
    `palace theme chain synthesis template stats count mismatch: ${snapshot.stats.palaceThemeChainSynthesisTemplateRecordCount} !== 24`
  )
}

if (transformationTopicDetails.length !== 20) {
  fail(`expected 20 transformation topic detail records, got ${transformationTopicDetails.length}`)
}

if (snapshot.transformationTopicRecords.length !== transformationTopicDetails.length) {
  fail(
    `transformation topic record count mismatch: ${snapshot.transformationTopicRecords.length} !== ${transformationTopicDetails.length}`
  )
}

if (snapshot.stats.transformationTopicRecordCount !== 20) {
  fail(
    `transformation topic stats count mismatch: ${snapshot.stats.transformationTopicRecordCount} !== 20`
  )
}

if (transformationTargetCombinationDetails.length !== 40) {
  fail(
    `expected 40 transformation target combination detail records, got ${transformationTargetCombinationDetails.length}`
  )
}

if (
  snapshot.transformationTargetCombinationRecords.length !==
  transformationTargetCombinationDetails.length
) {
  fail(
    `transformation target combination record count mismatch: ${snapshot.transformationTargetCombinationRecords.length} !== ${transformationTargetCombinationDetails.length}`
  )
}

if (snapshot.stats.transformationTargetCombinationRecordCount !== 40) {
  fail(
    `transformation target combination stats count mismatch: ${snapshot.stats.transformationTargetCombinationRecordCount} !== 40`
  )
}

if (
  snapshot.stats.recordCount !==
  snapshot.starRecords.length +
    snapshot.patternRecords.length +
    snapshot.branchRecords.length +
    snapshot.stemRecords.length +
    snapshot.elementGateRecords.length +
    snapshot.palaceRecords.length +
    snapshot.mainStarPalaceCombinationRecords.length +
    snapshot.nonMainStarPalaceCombinationRecords.length +
    snapshot.periodicStarPalaceCombinationRecords.length +
    snapshot.starPairCombinationRecords.length +
    snapshot.patternCombinationRelationRecords.length +
    snapshot.relationshipStructureRecords.length +
    snapshot.palaceThemeChainRecords.length +
    snapshot.palaceThemeChainEvidenceHitRuleRecords.length +
    snapshot.palaceThemeChainResultThresholdRecords.length +
    snapshot.palaceThemeChainOutputParagraphTemplateRecords.length +
    snapshot.palaceThemeChainEvidenceFieldStandardRecords.length +
    snapshot.palaceThemeChainFieldParagraphReviewMatrixRecords.length +
    snapshot.palaceThemeChainEvidenceDomainCrossReferenceRecords.length +
    snapshot.theorySourceReferenceRecords.length +
    snapshot.palaceThemeChainSynthesisTemplateRecords.length +
    snapshot.transformationTopicRecords.length +
    snapshot.transformationTargetCombinationRecords.length
) {
  fail("recordCount must include star, pattern, branch, stem, element gate, palace, main star combination, non-main star combination, periodic star combination, star pair combination, pattern combination relation, relationship structure, palace theme chain, palace theme evidence hit rule, palace theme result threshold, palace theme output paragraph template, palace theme evidence field standard, palace theme field paragraph review matrix, palace theme evidence domain cross reference, theory source reference, palace theme synthesis template, transformation topic and transformation target records")
}

const branchTermLabels = ["四马地", "四败地", "四墓库地", "申子辰水局", "亥卯未木局", "寅午戌火局", "巳酉丑金局"]
const stemAndGateTermLabels = ["十天干", "甲乙木", "丙丁火", "戊己土", "庚辛金", "壬癸水", "五行局", "水二局", "木三局", "金四局", "土五局", "火六局", "十二宫位", "主星入十二宫"]
const nonMainStarPalaceCombinationTermLabels = ["辅煞杂入十二宫", "辅曜入十二宫", "煞曜入十二宫", "杂曜入十二宫"]
const periodicStarPalaceCombinationTermLabels = ["周期流系星曜入十二宫", "长生十二神入十二宫", "年系星曜入十二宫", "月日时系星曜入十二宫", "周期流系盘层"]
const starPairCombinationTermLabels = ["星曜两两组合", "主星双星组合", "主星辅煞杂组合", "辅煞组合", "杂曜组合"]
const patternCombinationRelationTermLabels = ["星曜组合与格局关系", "组合成格证据", "组合加吉增强", "组合加煞破格", "组合弱承接"]
const relationshipTermLabels = ["冲照", "借宫", "动态叠盘", "宫位链", "证据追踪"]
const palaceThemeChainTermLabels = ["宫位主题链", "命财官迁链", "夫妻福德链", "田宅父母链", "疾厄福德链"]
const palaceThemeTemplateTermLabels = ["主题链综合解释模板", "主题链证据顺序", "主题链强弱规则", "主题链隐藏规则", "主题链动态模板"]
const palaceThemeHitRuleTermLabels = ["主题链命中规则", "主题链强命中", "主题链弱命中", "主题链破格命中", "主题链隐藏未命中"]
const palaceThemeResultThresholdTermLabels = ["主题链展示门槛", "主题链结果层级", "主题链排序规则", "主题链盘层继承", "主题链隐藏抑制"]
const palaceThemeOutputParagraphTermLabels = ["主题链段落模板", "主题链总论段", "主题链证据段", "主题链受压段", "主题链修复段", "主题链动态盘段", "主题链复核缺口段"]
const palaceThemeEvidenceFieldTermLabels = ["主题链证据字段标准", "主题链证据宫位", "主题链证据星曜", "主题链来源规则", "主题链展示层级字段", "主题链段落类型字段", "主题链盘层字段", "主题链复核标记"]
const palaceThemeFieldParagraphMatrixTermLabels = ["主题链字段段落矩阵", "总论段字段规则", "证据段字段规则", "受压段字段规则", "修复段字段规则", "动态盘段字段规则", "复核缺口段字段规则", "字段要求等级"]
const palaceThemeEvidenceDomainCrossReferenceTermLabels = ["主题链证据域对照", "主题链格局证据域", "主题链四化证据域", "主题链宫位关系证据域", "直接证据角色", "辅助证据角色", "抑制证据角色", "复核证据角色"]
const theorySourceReferenceTermLabels = ["理论来源索引", "古籍来源", "项目算法来源", "项目字典来源", "项目归纳来源", "人工校验来源", "现代资料元信息", "引用边界"]
const transformationTopicTermLabels = ["四化专题", "四化来源天干", "四化目标星", "四化目标宫", "四化盘层"]
const transformationTargetTermLabels = ["四化目标星组合", "目标星承接", "十干目标映射"]
const termLabels = new Set(ZIWEI_KNOWLEDGE_TERMS.map((term) => term.label))
;[
  ...branchTermLabels,
  ...stemAndGateTermLabels,
  ...nonMainStarPalaceCombinationTermLabels,
  ...periodicStarPalaceCombinationTermLabels,
  ...starPairCombinationTermLabels,
  ...patternCombinationRelationTermLabels,
  ...relationshipTermLabels,
  ...palaceThemeChainTermLabels,
  ...palaceThemeTemplateTermLabels,
  ...palaceThemeHitRuleTermLabels,
  ...palaceThemeResultThresholdTermLabels,
  ...palaceThemeOutputParagraphTermLabels,
  ...palaceThemeEvidenceFieldTermLabels,
  ...palaceThemeFieldParagraphMatrixTermLabels,
  ...palaceThemeEvidenceDomainCrossReferenceTermLabels,
  ...theorySourceReferenceTermLabels,
  ...transformationTopicTermLabels,
  ...transformationTargetTermLabels
].forEach((label) => {
  if (!termLabels.has(label)) {
    fail(`missing term label: ${label}`)
  }
})

const records = [
  ...snapshot.starRecords,
  ...snapshot.patternRecords,
  ...snapshot.branchRecords,
  ...snapshot.stemRecords,
  ...snapshot.elementGateRecords,
  ...snapshot.palaceRecords,
  ...snapshot.mainStarPalaceCombinationRecords,
  ...snapshot.nonMainStarPalaceCombinationRecords,
  ...snapshot.periodicStarPalaceCombinationRecords,
  ...snapshot.starPairCombinationRecords,
  ...snapshot.patternCombinationRelationRecords,
  ...snapshot.relationshipStructureRecords,
  ...snapshot.palaceThemeChainRecords,
  ...snapshot.palaceThemeChainEvidenceHitRuleRecords,
  ...snapshot.palaceThemeChainResultThresholdRecords,
  ...snapshot.palaceThemeChainOutputParagraphTemplateRecords,
  ...snapshot.palaceThemeChainEvidenceFieldStandardRecords,
  ...snapshot.palaceThemeChainFieldParagraphReviewMatrixRecords,
  ...snapshot.palaceThemeChainEvidenceDomainCrossReferenceRecords,
  ...snapshot.theorySourceReferenceRecords,
  ...snapshot.palaceThemeChainSynthesisTemplateRecords,
  ...snapshot.transformationTopicRecords,
  ...snapshot.transformationTargetCombinationRecords
]

const expectedRelationshipIds = new Set([
  "same-palace",
  "opposite-palace",
  "trine-square",
  "adjacent-palace",
  "sandwich-palace",
  "meeting",
  "borrowed-palace",
  "dynamic-overlay",
  "palace-chain",
  "source-trace"
])

const nonMainCategories = new Set(
  nonMainStarPalaceCombinationDetails.map((detail) => detail.category)
)
;["assistant", "malefic", "misc"].forEach((category) => {
  if (!nonMainCategories.has(category)) {
    fail(`missing non-main star palace combination category: ${category}`)
  }
})

nonMainStarPalaceCombinationDetails.forEach((detail) => {
  assertString(detail.combinationId, detail.categoryRole, "categoryRole", 6)
  assertList(detail.combinationId, detail.analysisFocus, "analysisFocus", 4)
  assertList(detail.combinationId, detail.supportiveSignals, "supportiveSignals", 2)
  assertList(detail.combinationId, detail.pressureSignals, "pressureSignals", 2)
  assertList(detail.combinationId, detail.relationUsage, "relationUsage", 3)
  assertList(detail.combinationId, detail.dynamicUsage, "dynamicUsage", 3)
  assertList(detail.combinationId, detail.evidenceFields, "evidenceFields", 8)
  assertList(detail.combinationId, detail.sections, "sections", 8)
})

const periodicGroups = new Set(
  periodicStarPalaceCombinationDetails.map((detail) => detail.group)
)
;["lifecycle", "boshi", "suiqian", "jiangqian", "monthly", "dailyHourly"].forEach((group) => {
  if (!periodicGroups.has(group)) {
    fail(`missing periodic star palace combination group: ${group}`)
  }
})

periodicStarPalaceCombinationDetails.forEach((detail) => {
  assertString(detail.combinationId, detail.groupRole, "groupRole", 6)
  assertList(detail.combinationId, detail.timingUsage, "timingUsage", 3)
  assertList(detail.combinationId, detail.analysisFocus, "analysisFocus", 4)
  assertList(detail.combinationId, detail.supportiveSignals, "supportiveSignals", 2)
  assertList(detail.combinationId, detail.pressureSignals, "pressureSignals", 2)
  assertList(detail.combinationId, detail.relationUsage, "relationUsage", 3)
  assertList(detail.combinationId, detail.dynamicUsage, "dynamicUsage", 3)
  assertList(detail.combinationId, detail.evidenceFields, "evidenceFields", 9)
  assertList(detail.combinationId, detail.sections, "sections", 9)
})

const starPairGroups = new Set(
  starPairCombinationDetails.map((detail) => detail.group)
)
;[
  "main-main",
  "main-assistant",
  "main-malefic",
  "main-misc",
  "assistant-assistant",
  "assistant-malefic",
  "assistant-misc",
  "malefic-malefic",
  "malefic-misc",
  "misc-misc"
].forEach((group) => {
  if (!starPairGroups.has(group)) {
    fail(`missing star pair combination group: ${group}`)
  }
})

starPairCombinationDetails.forEach((detail) => {
  assertString(detail.combinationId, detail.groupRole, "groupRole", 6)
  assertString(detail.combinationId, detail.interactionMode, "interactionMode", 12)
  assertList(detail.combinationId, detail.readingOrder, "readingOrder", 4)
  assertList(detail.combinationId, detail.supportiveSignals, "supportiveSignals", 4)
  assertList(detail.combinationId, detail.pressureSignals, "pressureSignals", 4)
  assertList(detail.combinationId, detail.palaceRelationUsage, "palaceRelationUsage", 4)
  assertList(detail.combinationId, detail.dynamicUsage, "dynamicUsage", 4)
  assertList(detail.combinationId, detail.evidenceFields, "evidenceFields", 10)
  assertList(detail.combinationId, detail.sections, "sections", 8)
})

const patternCombinationRelationRoles = new Set(
  patternCombinationRelationDetails.map((detail) => detail.role)
)
;["formation", "enhancement", "breakage", "weak-bearing"].forEach((role) => {
  if (!patternCombinationRelationRoles.has(role)) {
    fail(`missing pattern combination relation role: ${role}`)
  }
})

patternCombinationRelationDetails.forEach((detail) => {
  assertString(detail.relationId, detail.coreReading, "coreReading", 12)
  assertList(detail.relationId, detail.formationUsage, "formationUsage", 3)
  assertList(detail.relationId, detail.enhancementUsage, "enhancementUsage", 3)
  assertList(detail.relationId, detail.breakageUsage, "breakageUsage", 3)
  assertList(detail.relationId, detail.weakBearingUsage, "weakBearingUsage", 3)
  assertList(detail.relationId, detail.evidenceFields, "evidenceFields", 10)
  assertList(detail.relationId, detail.reviewQuestions, "reviewQuestions", 4)
  assertList(detail.relationId, detail.sections, "sections", 8)
})

relationshipStructureDetails.forEach((detail) => {
  if (!expectedRelationshipIds.has(detail.relationId)) {
    fail(`unexpected relationship structure id: ${detail.relationId}`)
  }

  assertList(detail.relationId, detail.calculationBoundary, "calculationBoundary", 3)
  assertList(detail.relationId, detail.evidenceUsage, "evidenceUsage", 3)
  assertList(detail.relationId, detail.dynamicUsage, "dynamicUsage", 3)
  assertList(detail.relationId, detail.patternUsage, "patternUsage", 3)
  assertList(detail.relationId, detail.sections, "sections", 8)
})

const palaceThemeChainCategories = new Set(
  palaceThemeChainDetails.map((detail) => detail.category)
)
;[
  "self",
  "career",
  "relationship",
  "family",
  "health",
  "wealth",
  "social",
  "review"
].forEach((category) => {
  if (!palaceThemeChainCategories.has(category)) {
    fail(`missing palace theme chain category: ${category}`)
  }
})

palaceThemeChainDetails.forEach((detail) => {
  assertString(detail.chainId, detail.coreQuestion, "coreQuestion", 8)
  assertString(detail.chainId, detail.chainReading, "chainReading", 16)
  assertList(detail.chainId, detail.palaceSequence, "palaceSequence", 3)
  assertList(detail.chainId, detail.supportingPalaces, "supportingPalaces", 2)
  assertList(detail.chainId, detail.palaceRoles, "palaceRoles", 3)
  assertList(detail.chainId, detail.starUsage, "starUsage", 4)
  assertList(detail.chainId, detail.transformationUsage, "transformationUsage", 4)
  assertList(detail.chainId, detail.dynamicUsage, "dynamicUsage", 3)
  assertList(detail.chainId, detail.evidenceFields, "evidenceFields", 10)
  assertList(detail.chainId, detail.reviewQuestions, "reviewQuestions", 3)
  assertList(detail.chainId, detail.cautions, "cautions", 3)
  assertList(detail.chainId, detail.sections, "sections", 9)
})

palaceThemeChainEvidenceHitRuleDetails.forEach((detail) => {
  assertString(detail.ruleId, detail.chainId, "chainId", 6)
  assertString(detail.ruleId, detail.templateId, "templateId", 6)
  assertList(detail.ruleId, detail.requiredEvidence, "requiredEvidence", 10)
  assertList(detail.ruleId, detail.strongHitRules, "strongHitRules", 3)
  assertList(detail.ruleId, detail.weakHitRules, "weakHitRules", 3)
  assertList(detail.ruleId, detail.breakageHitRules, "breakageHitRules", 3)
  assertList(detail.ruleId, detail.repairHitRules, "repairHitRules", 3)
  assertList(detail.ruleId, detail.hiddenWhen, "hiddenWhen", 5)
  assertList(detail.ruleId, detail.dynamicLayerHitRules, "dynamicLayerHitRules", 5)
  assertList(detail.ruleId, detail.scoringNotes, "scoringNotes", 3)
  assertList(detail.ruleId, detail.sourceFields, "sourceFields", 12)
  assertList(detail.ruleId, detail.sections, "sections", 10)
})

palaceThemeChainResultThresholdDetails.forEach((detail) => {
  assertString(detail.thresholdId, detail.ruleId, "ruleId", 6)
  assertString(detail.thresholdId, detail.chainId, "chainId", 6)
  assertString(detail.thresholdId, detail.templateId, "templateId", 6)
  assertList(detail.thresholdId, detail.displayTiers, "displayTiers", 5)
  assertList(detail.thresholdId, detail.visibilityThresholds, "visibilityThresholds", 8)
  assertList(detail.thresholdId, detail.rankingRules, "rankingRules", 3)
  assertList(detail.thresholdId, detail.sectionOutputRules, "sectionOutputRules", 3)
  assertList(detail.thresholdId, detail.evidenceMergeRules, "evidenceMergeRules", 5)
  assertList(detail.thresholdId, detail.layerInheritanceRules, "layerInheritanceRules", 5)
  assertList(detail.thresholdId, detail.suppressionRules, "suppressionRules", 5)
  assertList(detail.thresholdId, detail.reviewEscalationRules, "reviewEscalationRules", 3)
  assertList(detail.thresholdId, detail.sourceFields, "sourceFields", 14)
  assertList(detail.thresholdId, detail.sections, "sections", 10)
})

palaceThemeChainOutputParagraphTemplateDetails.forEach((detail) => {
  assertString(detail.paragraphTemplateId, detail.thresholdId, "thresholdId", 6)
  assertString(detail.paragraphTemplateId, detail.ruleId, "ruleId", 6)
  assertString(detail.paragraphTemplateId, detail.chainId, "chainId", 6)
  assertString(detail.paragraphTemplateId, detail.templateId, "templateId", 6)
  assertList(detail.paragraphTemplateId, detail.paragraphTypes, "paragraphTypes", 6)
  assertList(detail.paragraphTemplateId, detail.summaryParagraphRules, "summaryParagraphRules", 3)
  assertList(detail.paragraphTemplateId, detail.evidenceParagraphRules, "evidenceParagraphRules", 3)
  assertList(detail.paragraphTemplateId, detail.pressureParagraphRules, "pressureParagraphRules", 3)
  assertList(detail.paragraphTemplateId, detail.repairParagraphRules, "repairParagraphRules", 3)
  assertList(detail.paragraphTemplateId, detail.dynamicParagraphRules, "dynamicParagraphRules", 3)
  assertList(detail.paragraphTemplateId, detail.reviewParagraphRules, "reviewParagraphRules", 3)
  assertList(detail.paragraphTemplateId, detail.toneRules, "toneRules", 5)
  assertList(detail.paragraphTemplateId, detail.sourceFields, "sourceFields", 14)
  assertList(detail.paragraphTemplateId, detail.sections, "sections", 10)
})

palaceThemeChainEvidenceFieldStandardDetails.forEach((detail) => {
  assertString(detail.fieldId, detail.fieldName, "fieldName", 2)
  assertString(detail.fieldId, detail.label, "label", 2)
  assertString(detail.fieldId, detail.category, "category", 2)
  assertString(detail.fieldId, detail.valueShape, "valueShape", 8)
  assertList(detail.fieldId, detail.requiredScopes, "requiredScopes", 2)
  assertList(detail.fieldId, detail.normalizationRules, "normalizationRules", 3)
  assertList(detail.fieldId, detail.validationRules, "validationRules", 3)
  assertList(detail.fieldId, detail.mergeRules, "mergeRules", 3)
  assertList(detail.fieldId, detail.displayUsage, "displayUsage", 3)
  assertList(detail.fieldId, detail.sourceLineage, "sourceLineage", 2)
  assertList(detail.fieldId, detail.hiddenWhen, "hiddenWhen", 3)
  assertList(detail.fieldId, detail.sections, "sections", 8)
})

const matrixParagraphTypes = new Set(
  palaceThemeChainFieldParagraphReviewMatrixDetails.map((detail) => detail.paragraphType)
)
;["summary", "evidence", "pressure", "repair", "dynamic", "review"].forEach((paragraphType) => {
  if (!matrixParagraphTypes.has(paragraphType)) {
    fail(`missing palace theme field paragraph matrix paragraph type: ${paragraphType}`)
  }
})

const matrixRequirementLevels = new Set(
  palaceThemeChainFieldParagraphReviewMatrixDetails.map((detail) => detail.requirementLevel)
)
;["required", "conditional", "optional", "hidden", "review"].forEach((level) => {
  if (!matrixRequirementLevels.has(level)) {
    fail(`missing palace theme field paragraph matrix requirement level: ${level}`)
  }
})

palaceThemeChainFieldParagraphReviewMatrixDetails.forEach((detail) => {
  assertString(detail.matrixId, detail.fieldName, "fieldName", 2)
  assertString(detail.matrixId, detail.fieldLabel, "fieldLabel", 2)
  assertString(detail.matrixId, detail.fieldCategory, "fieldCategory", 2)
  assertString(detail.matrixId, detail.paragraphType, "paragraphType", 4)
  assertString(detail.matrixId, detail.paragraphLabel, "paragraphLabel", 2)
  assertString(detail.matrixId, detail.requirementLevel, "requirementLevel", 5)
  assertList(detail.matrixId, detail.requiredWhen, "requiredWhen", 2)
  assertList(detail.matrixId, detail.optionalWhen, "optionalWhen", 3)
  assertList(detail.matrixId, detail.hiddenWhen, "hiddenWhen", 3)
  assertList(detail.matrixId, detail.reviewTriggers, "reviewTriggers", 3)
  assertList(detail.matrixId, detail.mergeRules, "mergeRules", 3)
  assertList(detail.matrixId, detail.displayRules, "displayRules", 3)
  assertList(detail.matrixId, detail.sourceLineage, "sourceLineage", 4)
  assertList(detail.matrixId, detail.sections, "sections", 8)
})

const evidenceDomains = new Set(
  palaceThemeChainEvidenceDomainCrossReferenceDetails.map((detail) => detail.evidenceDomain)
)
;["pattern", "transformation", "palaceRelation"].forEach((domain) => {
  if (!evidenceDomains.has(domain)) {
    fail(`missing palace theme evidence domain cross reference domain: ${domain}`)
  }
})

const evidenceRelationRoles = new Set(
  palaceThemeChainEvidenceDomainCrossReferenceDetails.map((detail) => detail.relationRole)
)
;["direct", "context", "support", "suppression", "review"].forEach((role) => {
  if (!evidenceRelationRoles.has(role)) {
    fail(`missing palace theme evidence domain cross reference role: ${role}`)
  }
})

palaceThemeChainEvidenceDomainCrossReferenceDetails.forEach((detail) => {
  assertString(detail.crossRefId, detail.fieldName, "fieldName", 2)
  assertString(detail.crossRefId, detail.fieldLabel, "fieldLabel", 2)
  assertString(detail.crossRefId, detail.fieldCategory, "fieldCategory", 2)
  assertString(detail.crossRefId, detail.evidenceDomain, "evidenceDomain", 6)
  assertString(detail.crossRefId, detail.domainLabel, "domainLabel", 2)
  assertString(detail.crossRefId, detail.relationRole, "relationRole", 5)
  assertList(detail.crossRefId, detail.evidenceUsage, "evidenceUsage", 3)
  assertList(detail.crossRefId, detail.requiredEvidence, "requiredEvidence", 2)
  assertList(detail.crossRefId, detail.excludedWhen, "excludedWhen", 3)
  assertList(detail.crossRefId, detail.conflictTriggers, "conflictTriggers", 3)
  assertList(detail.crossRefId, detail.mergeRules, "mergeRules", 3)
  assertList(detail.crossRefId, detail.displayRules, "displayRules", 3)
  assertList(detail.crossRefId, detail.sourceLineage, "sourceLineage", 4)
  assertList(detail.crossRefId, detail.sections, "sections", 8)
})

const theorySourceKinds = new Set(
  theorySourceReferenceDetails.map((detail) => detail.sourceKind)
)
;[
  "classic",
  "public-domain-index",
  "project-algorithm",
  "project-dictionary",
  "internal-synthesis",
  "manual-calibration",
  "modern-reference-metadata"
].forEach((kind) => {
  if (!theorySourceKinds.has(kind)) {
    fail(`missing theory source kind: ${kind}`)
  }
})

theorySourceReferenceDetails.forEach((detail) => {
  assertString(detail.sourceId, detail.title, "title", 2)
  assertString(detail.sourceId, detail.sourceKind, "sourceKind", 5)
  assertString(detail.sourceId, detail.authorOrCompiler, "authorOrCompiler", 2)
  assertString(detail.sourceId, detail.eraOrVersion, "eraOrVersion", 2)
  assertString(detail.sourceId, detail.editionOrLocation, "editionOrLocation", 2)
  assertString(detail.sourceId, detail.sourceReliability, "sourceReliability", 3)
  assertString(detail.sourceId, detail.copyrightPolicy, "copyrightPolicy", 8)
  assertList(detail.sourceId, detail.usedFor, "usedFor", 3)
  assertList(detail.sourceId, detail.citationUsageRules, "citationUsageRules", 3)
  assertList(detail.sourceId, detail.storageBoundary, "storageBoundary", 3)
  assertList(detail.sourceId, detail.relatedDataModules, "relatedDataModules", 2)
  assertList(detail.sourceId, detail.verificationNotes, "verificationNotes", 1)
  assertList(detail.sourceId, detail.sections, "sections", 6)
})

palaceThemeChainSynthesisTemplateDetails.forEach((detail) => {
  assertString(detail.templateId, detail.summaryTemplate, "summaryTemplate", 24)
  assertString(detail.templateId, detail.chainId, "chainId", 6)
  assertList(detail.templateId, detail.outputStructure, "outputStructure", 5)
  assertList(detail.templateId, detail.evidenceOrder, "evidenceOrder", 5)
  assertList(detail.templateId, detail.strengthRules, "strengthRules", 3)
  assertList(detail.templateId, detail.breakageRules, "breakageRules", 3)
  assertList(detail.templateId, detail.repairRules, "repairRules", 3)
  assertList(detail.templateId, detail.dynamicLayerRules, "dynamicLayerRules", 5)
  assertList(detail.templateId, detail.hiddenResultRules, "hiddenResultRules", 5)
  assertList(detail.templateId, detail.riskBoundaries, "riskBoundaries", 3)
  assertList(detail.templateId, detail.sourceFields, "sourceFields", 10)
  assertList(detail.templateId, detail.sections, "sections", 10)
})

const transformationTopicKinds = new Set(transformationTopicDetails.map((detail) => detail.kind))
;["transformation-kind", "stem-trigger", "flow-layer"].forEach((kind) => {
  if (!transformationTopicKinds.has(kind)) {
    fail(`missing transformation topic kind: ${kind}`)
  }
})

transformationTopicDetails.forEach((detail) => {
  assertList(detail.topicId, detail.sourceUsage, "sourceUsage", 3)
  assertList(detail.topicId, detail.targetUsage, "targetUsage", 3)
  assertList(detail.topicId, detail.flowUsage, "flowUsage", 3)
  assertList(detail.topicId, detail.combinationUsage, "combinationUsage", 3)
  assertList(detail.topicId, detail.evidenceFields, "evidenceFields", 5)
  assertList(detail.topicId, detail.sections, "sections", 8)
})

transformationTargetCombinationDetails.forEach((detail) => {
  assertList(detail.combinationId, detail.sourceStems, "sourceStems", 1)
  assertList(detail.combinationId, detail.sourceUsage, "sourceUsage", 3)
  assertList(detail.combinationId, detail.transformationEffect, "transformationEffect", 3)
  assertList(detail.combinationId, detail.palaceReading, "palaceReading", 3)
  assertList(detail.combinationId, detail.flowReading, "flowReading", 3)
  assertList(detail.combinationId, detail.relationReading, "relationReading", 3)
  assertList(detail.combinationId, detail.patternReading, "patternReading", 3)
  assertList(detail.combinationId, detail.evidenceFields, "evidenceFields", 8)
  assertList(detail.combinationId, detail.sections, "sections", 8)
})

records.forEach((record) => {
  assertString(record.id, record.entity.label, "entity.label", 1)
  assertList(record.id, record.sourceIds, "sourceIds", 2)
  assertList(record.id, record.analysisTags, "analysisTags", 4)
  assertList(record.id, record.facets, "facets", 5)
  assertList(record.id, record.storageBuckets, "storageBuckets", 3)
  assertList(record.id, record.applicableScopes, "applicableScopes", 2)
  assertList(record.id, record.cautionFlags, "cautionFlags", 1)

  if (!record.copyrightPolicy) {
    fail(`${record.id}: missing copyrightPolicy`)
  }

  if (!record.reviewStatus) {
    fail(`${record.id}: missing reviewStatus`)
  }

  record.facets.forEach((facet) => {
    assertString(record.id, facet.facetId, "facet.facetId", 2)
    assertString(record.id, facet.summary, `facet.${facet.facetId}.summary`, 6)
    assertList(record.id, facet.keywords, `facet.${facet.facetId}.keywords`, 1)
  })
})

const sourceIds = new Set(snapshot.sources.map((source) => source.id))
records.forEach((record) => {
  record.sourceIds.forEach((sourceId) => {
    if (!sourceIds.has(sourceId)) {
      fail(`${record.id}: unknown source id ${sourceId}`)
    }
  })
})

snapshot.intakePacks.forEach((pack) => {
  assertString(pack.id, pack.label, "intakePack.label", 2)
  assertList(pack.id, pack.acceptedData, "acceptedData", 2)
  assertList(pack.id, pack.rejectedData, "rejectedData", 1)
  assertList(pack.id, pack.sourceIds, "sourceIds", 1)
  assertList(pack.id, pack.storageBuckets, "storageBuckets", 1)
  assertList(pack.id, pack.analysisTags, "analysisTags", 2)

  pack.sourceIds.forEach((sourceId) => {
    if (!sourceIds.has(sourceId)) {
      fail(`${pack.id}: unknown source id ${sourceId}`)
    }
  })
})

snapshot.analysisDimensions.forEach((dimension) => {
  assertString(dimension.id, dimension.label, "analysisDimension.label", 2)
  assertString(dimension.id, dimension.description, "analysisDimension.description", 8)
  assertList(dimension.id, dimension.inputBuckets, "inputBuckets", 1)
  assertList(dimension.id, dimension.outputTags, "outputTags", 1)
  assertList(dimension.id, dimension.reviewQuestions, "reviewQuestions", 1)
})

snapshot.calibrationFields.forEach((field) => {
  assertString(field.id, field.label, "calibrationField.label", 2)
  assertString(field.id, field.description, "calibrationField.description", 8)
  assertList(field.id, field.sourceIds, "sourceIds", 1)

  field.sourceIds.forEach((sourceId) => {
    if (!sourceIds.has(sourceId)) {
      fail(`${field.id}: unknown source id ${sourceId}`)
    }
  })
})

const forbiddenKeys = ["verbatim", "excerpt", "quote", "screenshot"]
const serialized = JSON.stringify(snapshot)
for (const key of forbiddenKeys) {
  if (serialized.includes(`"${key}"`)) {
    fail(`repository snapshot must not store raw external ${key} fields`)
  }
}

console.log(
  `[check-content-knowledge-repository] ok (${snapshot.stats.sourceCount} source(s), ${snapshot.stats.termCount} term(s), ${snapshot.stats.intakePackCount} intake pack(s), ${snapshot.stats.analysisDimensionCount} dimension(s), ${snapshot.stats.calibrationFieldCount} calibration field(s), ${snapshot.stats.recordCount} record(s))`
)

function assertString(id, value, field, minLength) {
  if (typeof value !== "string" || value.length < minLength) {
    fail(`${id}: ${field} is too short`)
  }
}

function assertList(id, value, field, minLength) {
  if (!Array.isArray(value) || value.length < minLength) {
    fail(`${id}: ${field} needs at least ${minLength} item(s)`)
  }
}

function assertSourceReferenceLayerIndex(index, recordCounts) {
  assertList("source-reference-layer-index", index, "items", 22)

  if (index.length !== recordCounts.size) {
    fail(
      `source reference layer index count mismatch: ${index.length} !== ${recordCounts.size}`
    )
  }

  if (ZIWEI_SOURCE_REFERENCE_INDEX_TOTAL_RECORD_COUNT !== 2938) {
    fail(
      `source reference layer index total mismatch: ${ZIWEI_SOURCE_REFERENCE_INDEX_TOTAL_RECORD_COUNT} !== 2938`
    )
  }

  const layerIds = new Set()
  let summedRecordCount = 0

  index.forEach((item, indexPosition) => {
    assertString(item.layerId, item.layerId, "layerId", 5)
    assertString(item.layerId, item.label, "label", 2)
    assertString(item.layerId, item.layerKind, "layerKind", 5)
    assertString(item.layerId, item.recordKind, "recordKind", 3)
    assertString(item.layerId, item.theoryBoundary, "theoryBoundary", 12)
    assertString(item.layerId, item.verificationEntry, "verificationEntry", 12)
    assertList(item.layerId, item.notes, "notes", 1)
    assertSourceReferences(item.layerId, item.sourceReferences, 4)
    assertList(item.layerId, item.sourceIds, "sourceIds", 4)

    if (layerIds.has(item.layerId)) {
      fail(`duplicated source reference layer id: ${item.layerId}`)
    }
    layerIds.add(item.layerId)

    if (!recordCounts.has(item.layerId)) {
      fail(`source reference layer index contains unknown layer id ${item.layerId}`)
    }

    const expectedRecordCount = recordCounts.get(item.layerId)
    if (item.recordCount !== expectedRecordCount) {
      fail(
        `${item.layerId}: source reference layer record count mismatch ${item.recordCount} !== ${expectedRecordCount}`
      )
    }

    const sourceIds = item.sourceReferences.map((reference) => reference.sourceId)
    if (item.sourceIds.join("|") !== sourceIds.join("|")) {
      fail(`${item.layerId}: sourceIds must mirror sourceReferences order`)
    }

    sourceIds.forEach((sourceId) => {
      if (!theorySourceReferenceIds.has(sourceId)) {
        fail(
          `${item.layerId}: source reference index item ${indexPosition} points to unknown theory source ${sourceId}`
        )
      }
    })

    summedRecordCount += item.recordCount
  })

  recordCounts.forEach((_value, layerId) => {
    if (!layerIds.has(layerId)) {
      fail(`source reference layer index missing layer id ${layerId}`)
    }
  })

  if (summedRecordCount !== ZIWEI_SOURCE_REFERENCE_INDEX_TOTAL_RECORD_COUNT) {
    fail(
      `source reference layer index summed count mismatch: ${summedRecordCount} !== ${ZIWEI_SOURCE_REFERENCE_INDEX_TOTAL_RECORD_COUNT}`
    )
  }
}

function assertSourceReferenceReviewQueue(queue, layerIndex) {
  assertList("source-reference-review-queue", queue, "items", 12)

  if (queue.length !== theorySourceReferenceDetails.length) {
    fail(
      `source reference review queue count mismatch: ${queue.length} !== ${theorySourceReferenceDetails.length}`
    )
  }

  const queueSourceIds = new Set()
  const layerRecordCountBySourceId = new Map()
  const layerIdsBySourceId = new Map()

  layerIndex.forEach((layer) => {
    layer.sourceIds.forEach((sourceId) => {
      layerRecordCountBySourceId.set(
        sourceId,
        (layerRecordCountBySourceId.get(sourceId) ?? 0) + layer.recordCount
      )

      const layerIds = layerIdsBySourceId.get(sourceId) ?? []
      layerIds.push(layer.layerId)
      layerIdsBySourceId.set(sourceId, layerIds)
    })
  })

  queue.forEach((item) => {
    assertString(item.queueId, item.queueId, "queueId", 12)
    assertString(item.queueId, item.sourceId, "sourceId", 5)
    assertString(item.queueId, item.sourceTitle, "sourceTitle", 2)
    assertString(item.queueId, item.sourceKind, "sourceKind", 5)
    assertString(item.queueId, item.sourceReliability, "sourceReliability", 3)
    assertString(item.queueId, item.reviewTier, "reviewTier", 5)
    assertString(item.queueId, item.priority, "priority", 2)
    assertList(item.queueId, item.reviewFocus, "reviewFocus", 2)
    assertList(item.queueId, item.downgradeBoundary, "downgradeBoundary", 2)
    assertString(item.queueId, item.nextAction, "nextAction", 8)

    if (!theorySourceReferenceIds.has(item.sourceId)) {
      fail(`${item.queueId}: review queue points to unknown source ${item.sourceId}`)
    }

    if (queueSourceIds.has(item.sourceId)) {
      fail(`duplicated source reference review queue source id: ${item.sourceId}`)
    }
    queueSourceIds.add(item.sourceId)

    const expectedLayerIds = layerIdsBySourceId.get(item.sourceId) ?? []
    if (item.citedByLayerIds.join("|") !== expectedLayerIds.join("|")) {
      fail(`${item.queueId}: citedByLayerIds mismatch`)
    }

    const expectedRecordCount = layerRecordCountBySourceId.get(item.sourceId) ?? 0
    if (item.citedRecordCount !== expectedRecordCount) {
      fail(
        `${item.queueId}: citedRecordCount mismatch ${item.citedRecordCount} !== ${expectedRecordCount}`
      )
    }
  })

  theorySourceReferenceIds.forEach((sourceId) => {
    if (!queueSourceIds.has(sourceId)) {
      fail(`source reference review queue missing ${sourceId}`)
    }
  })

  assertReviewQueueItem(queue, "project.star-catalog", {
    tier: "hard-rule",
    priority: "P0",
    hardRule: true,
    minCitedRecordCount: 1
  })
  assertReviewQueueItem(queue, "project.pattern-catalog", {
    tier: "hard-rule",
    priority: "P0",
    hardRule: true,
    minCitedRecordCount: 1
  })
  assertReviewQueueItem(queue, "project.transformation-rules", {
    tier: "hard-rule",
    priority: "P0",
    hardRule: true,
    minCitedRecordCount: 1
  })
  assertReviewQueueItem(queue, "project.brightness-table", {
    tier: "hard-rule",
    priority: "P0",
    hardRule: true,
    minCitedRecordCount: 1
  })
  assertReviewQueueItem(queue, "project.dynamic-flow-rules", {
    tier: "hard-rule",
    priority: "P0",
    hardRule: true,
    minCitedRecordCount: 1
  })
  assertReviewQueueItem(queue, "project.content-dictionary", {
    tier: "dictionary-baseline",
    priority: "P1",
    hardRule: false,
    minCitedRecordCount: 1
  })
  assertReviewQueueItem(queue, "internal.synthesis-reading-order", {
    tier: "synthesis-boundary",
    priority: "P1",
    hardRule: false,
    minCitedRecordCount: 1
  })
  assertReviewQueueItem(queue, "classic.ziwei-doushu-quanshu", {
    tier: "lineage-reference",
    priority: "P2",
    hardRule: false,
    minCitedRecordCount: 1
  })
  assertReviewQueueItem(queue, "human.calibration-notes", {
    tier: "manual-review",
    priority: "P3",
    hardRule: false,
    minCitedRecordCount: 0
  })
  assertReviewQueueItem(queue, "external.modern-reference-metadata", {
    tier: "metadata-only",
    priority: "P3",
    hardRule: false,
    minCitedRecordCount: 0
  })
}

function assertContentExpansionPriorityQueue(queue, layerIndex) {
  assertList("content-expansion-priority-queue", queue, "items", 12)

  const layerIds = new Set(layerIndex.map((layer) => layer.layerId))
  const itemIds = new Set()
  const priorityCounts = new Map()

  queue.forEach((item) => {
    assertString(item.itemId, item.itemId, "itemId", 12)
    assertString(item.itemId, item.title, "title", 4)
    assertString(item.itemId, item.priority, "priority", 2)
    assertString(item.itemId, item.domain, "domain", 5)
    assertString(item.itemId, item.goal, "goal", 12)
    assertList(item.itemId, item.relatedSourceIds, "relatedSourceIds", 1)
    assertList(item.itemId, item.deliverables, "deliverables", 2)
    assertList(item.itemId, item.acceptanceChecks, "acceptanceChecks", 2)
    assertList(item.itemId, item.copyrightBoundary, "copyrightBoundary", 1)

    if (itemIds.has(item.itemId)) {
      fail(`duplicated content expansion priority item id: ${item.itemId}`)
    }
    itemIds.add(item.itemId)
    priorityCounts.set(item.priority, (priorityCounts.get(item.priority) ?? 0) + 1)

    item.relatedLayerIds.forEach((layerId) => {
      if (!layerIds.has(layerId)) {
        fail(`${item.itemId}: unknown related layer id ${layerId}`)
      }
    })

    item.relatedSourceIds.forEach((sourceId) => {
      if (!theorySourceReferenceIds.has(sourceId)) {
        fail(`${item.itemId}: unknown related source id ${sourceId}`)
      }
    })
  })

  queue.forEach((item) => {
    item.blockedBy.forEach((blockedByItemId) => {
      if (!itemIds.has(blockedByItemId)) {
        fail(`${item.itemId}: blockedBy points to unknown item ${blockedByItemId}`)
      }
    })
  })

  assertPriorityCount(priorityCounts, "P0", 3)
  assertPriorityCount(priorityCounts, "P1", 4)
  assertPriorityCount(priorityCounts, "P2", 4)
  assertPriorityCount(priorityCounts, "P3", 1)

  assertPriorityItem(queue, "content-expansion.p0.algorithm-source-drift-audit", "P0")
  assertPriorityItem(queue, "content-expansion.p0.pattern-breakage-detail", "P0")
  assertPriorityItem(queue, "content-expansion.p0.dynamic-flow-inheritance", "P0")
  assertPriorityItem(queue, "content-expansion.p1-star-detail-deepening", "P1")
  assertPriorityItem(queue, "content-expansion.p2-classic-term-index", "P2")
  assertPriorityItem(queue, "content-expansion.p3-human-calibration-samples", "P3")
}

function assertPriorityCount(priorityCounts, priority, expectedCount) {
  const actualCount = priorityCounts.get(priority) ?? 0
  if (actualCount !== expectedCount) {
    fail(`content expansion ${priority} count mismatch ${actualCount} !== ${expectedCount}`)
  }
}

function assertPriorityItem(queue, itemId, priority) {
  const item = queue.find((entry) => {
    return entry.itemId === itemId
  })

  if (!item) {
    fail(`content expansion priority queue missing ${itemId}`)
  }

  if (item.priority !== priority) {
    fail(`${itemId}: priority mismatch ${item.priority} !== ${priority}`)
  }
}

function assertReviewQueueItem(queue, sourceId, expected) {
  const item = queue.find((entry) => {
    return entry.sourceId === sourceId
  })

  if (!item) {
    fail(`source reference review queue missing expected source ${sourceId}`)
  }

  if (item.reviewTier !== expected.tier) {
    fail(`${sourceId}: review tier mismatch ${item.reviewTier} !== ${expected.tier}`)
  }

  if (item.priority !== expected.priority) {
    fail(`${sourceId}: priority mismatch ${item.priority} !== ${expected.priority}`)
  }

  if (item.canActAsHardRule !== expected.hardRule) {
    fail(`${sourceId}: hard rule flag mismatch`)
  }

  if (item.citedRecordCount < expected.minCitedRecordCount) {
    fail(
      `${sourceId}: citedRecordCount ${item.citedRecordCount} is below ${expected.minCitedRecordCount}`
    )
  }
}

function assertSourceReferences(id, value, minLength) {
  assertList(id, value, "sourceReferences", minLength)

  value.forEach((reference, index) => {
    assertString(id, reference.sourceId, `sourceReferences[${index}].sourceId`, 5)
    assertString(id, reference.role, `sourceReferences[${index}].role`, 5)
    assertString(id, reference.usage, `sourceReferences[${index}].usage`, 12)
    assertString(id, reference.confidence, `sourceReferences[${index}].confidence`, 3)

    if (!theorySourceReferenceIds.has(reference.sourceId)) {
      fail(`${id}: sourceReferences[${index}] points to unknown theory source ${reference.sourceId}`)
    }
  })
}

function assertSourceReferenceIncludes(id, value, requiredSourceIds) {
  const availableSourceIds = new Set(value.map((reference) => reference.sourceId))

  requiredSourceIds.forEach((sourceId) => {
    if (!availableSourceIds.has(sourceId)) {
      fail(`${id}: sourceReferences missing ${sourceId}`)
    }
  })
}

function assertPalaceThemeRuleSourceReferences(id, value) {
  assertSourceReferences(id, value, 5)
  assertSourceReferenceIncludes(id, value, [
    "project.content-dictionary",
    "project.pattern-catalog",
    "project.transformation-rules",
    "project.dynamic-flow-rules"
  ])
}
