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
  buildZiweiPatternContentDictionaryDetail,
  buildZiweiStarContentDictionaryDetail,
  getAllBranchContentDetails,
  getAllBranchGroupContentDetails,
  getAllMainStarPalaceCombinationContentDetails,
  getAllNonMainStarPalaceCombinationContentDetails,
  getAllPalaceContentDetails,
  getAllPeriodicStarPalaceCombinationContentDetails,
  getAllRelationshipStructureContentDetails,
  getAllStarPairCombinationContentDetails,
  getAllTransformationContentDetails,
  getAllTransformationTargetCombinationContentDetails,
  getAllTransformationTopicContentDetails
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")
const {
  buildFullZiweiChart,
  buildFullZiweiDynamicChart,
  buildZiweiInterpretation
} = require("../../src/ai/destiny-core/ziwei-core/public-api/index.ts")
const {
  ziweiStarCatalog
} = require("../../src/ai/destiny-core/ziwei-core/star-catalog/index.ts")
const {
  ZIWEI_PATTERN_DEFINITIONS
} = require("../../src/app/ziwei/_lib/ziwei-pattern-catalog.ts")

const REQUIRED_STAR_SECTIONS = [
  "本质定位",
  "象义展开",
  "入十二宫前置原则",
  "十二宫逐宫细则",
  "庙旺落陷与状态判断",
  "同宫会照与组合原则",
  "对宫与三方四正细则",
  "动态盘层解释",
  "资料来源与复核边界",
  "常见误读"
]

const REQUIRED_RELATION_MARKERS = [
  "同宫",
  "对宫",
  "三方四正",
  "夹宫",
  "会照",
  "四化",
  "庙旺",
  "动态"
]

const REQUIRED_EVIDENCE_CHAIN_KINDS = [
  "natal-palace",
  "star",
  "same-palace-combination",
  "palace-relation",
  "dynamic-flow",
  "pattern-boundary"
]

function fail(message) {
  console.error(`[check-data-dictionary-reading-readiness] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function hasMarker(value, marker) {
  return JSON.stringify(value).includes(marker)
}

function assertList(id, value, field, minLength) {
  assert(Array.isArray(value), `${id}: ${field} must be a list`)
  assert(value.length >= minLength, `${id}: ${field} needs at least ${minLength} item(s)`)
}

function assertHasMarkers(id, value, field, markers) {
  for (const marker of markers) {
    assert(hasMarker(value, marker), `${id}: ${field} missing marker ${marker}`)
  }
}

function assertSourceReferences(id, value) {
  assertList(id, value, "sourceReferences", 1)
  for (const source of value) {
    assert(typeof source.sourceId === "string" && source.sourceId.length > 0, `${id}: sourceId missing`)
    assert(typeof source.usage === "string" && source.usage.length >= 4, `${id}: source usage too short`)
  }
}

const starDetails = ziweiStarCatalog.map((star) => {
  return buildZiweiStarContentDictionaryDetail(star)
})

assert(starDetails.length === 103, `expected 103 star dictionary details, got ${starDetails.length}`)

const fallbackStars = starDetails.filter((detail) => detail.source !== "manual")
assert(fallbackStars.length === 0, `expected no fallback star detail, got ${fallbackStars.length}`)

const sampledStarLabels = ["紫微", "贪狼", "巨门", "廉贞", "武曲", "七杀", "破军"]
for (const label of sampledStarLabels) {
  const detail = starDetails.find((item) => item.label === label)
  assert(detail, `missing sampled star detail: ${label}`)
  assertSourceReferences(detail.starId, detail.sourceReferences)
  assertList(detail.starId, detail.extendedSections, "extendedSections", 10)

  const sectionTitles = detail.extendedSections.map((section) => section.title)
  for (const title of REQUIRED_STAR_SECTIONS) {
    assert(sectionTitles.includes(title), `${detail.starId}: missing extended section ${title}`)
  }

  assertHasMarkers(detail.starId, detail.extendedSections, "extendedSections", [
    "十二宫",
    "庙旺",
    "同宫",
    "三方四正",
    "动态盘",
    "复核"
  ])
}

const palaces = getAllPalaceContentDetails()
assert(palaces.length === 12, `expected 12 palace details, got ${palaces.length}`)
for (const palace of palaces) {
  assertSourceReferences(`palace.${palace.sectorName}`, palace.sourceReferences)
  assertList(`palace.${palace.sectorName}`, palace.primaryQuestions, "primaryQuestions", 2)
  assertList(`palace.${palace.sectorName}`, palace.starReadingUsage, "starReadingUsage", 2)
  assertList(`palace.${palace.sectorName}`, palace.relationUsage, "relationUsage", 2)
  assertList(`palace.${palace.sectorName}`, palace.dynamicUsage, "dynamicUsage", 2)
}

const branchGroups = getAllBranchGroupContentDetails()
for (const label of ["四马地", "四败地", "四墓库地"]) {
  assert(branchGroups.some((group) => group.label === label), `missing branch group ${label}`)
}

const branchDetails = getAllBranchContentDetails()
assert(branchDetails.length === 12, `expected 12 branch details, got ${branchDetails.length}`)
for (const branch of branchDetails) {
  assertList(`branch.${branch.branch}`, branch.palaceUsage, "palaceUsage", 2)
  assertList(`branch.${branch.branch}`, branch.starInteraction, "starInteraction", 2)
  assertList(`branch.${branch.branch}`, branch.dynamicUsage, "dynamicUsage", 2)
}

const mainPalace = getAllMainStarPalaceCombinationContentDetails()
const nonMainPalace = getAllNonMainStarPalaceCombinationContentDetails()
const periodicPalace = getAllPeriodicStarPalaceCombinationContentDetails()
assert(mainPalace.length === 168, `expected 168 main star palace combinations, got ${mainPalace.length}`)
assert(nonMainPalace.length === 348, `expected 348 non-main star palace combinations, got ${nonMainPalace.length}`)
assert(periodicPalace.length === 672, `expected 672 periodic star palace combinations, got ${periodicPalace.length}`)

for (const detail of [...mainPalace.slice(0, 24), ...nonMainPalace.slice(0, 24), ...periodicPalace.slice(0, 24)]) {
  assertSourceReferences(detail.combinationId, detail.sourceReferences)
  assertHasMarkers(detail.combinationId, detail, "combination detail", ["同宫", "对宫", "三方", "动态"])
}

const pairDetails = getAllStarPairCombinationContentDetails()
assert(pairDetails.length === 903, `expected 903 star pair combinations, got ${pairDetails.length}`)
for (const detail of pairDetails.slice(0, 36)) {
  assertSourceReferences(detail.combinationId, detail.sourceReferences)
  assertList(detail.combinationId, detail.readingOrder, "readingOrder", 5)
  assertList(detail.combinationId, detail.evidenceFields, "evidenceFields", 10)
  assertHasMarkers(detail.combinationId, detail, "pair detail", REQUIRED_RELATION_MARKERS)
}

const relationshipDetails = getAllRelationshipStructureContentDetails()
assert(relationshipDetails.length >= 10, `expected at least 10 relationship structures, got ${relationshipDetails.length}`)
for (const detail of relationshipDetails) {
  assertSourceReferences(detail.relationId, detail.sourceReferences)
  assertList(detail.relationId, detail.evidenceUsage, "evidenceUsage", 2)
  assertList(detail.relationId, detail.dynamicUsage, "dynamicUsage", 2)
  assertList(detail.relationId, detail.patternUsage, "patternUsage", 2)
}

const transformationDetails = getAllTransformationContentDetails()
const transformationTopics = getAllTransformationTopicContentDetails()
const transformationTargets = getAllTransformationTargetCombinationContentDetails()
assert(transformationDetails.length >= 4, `expected transformation details, got ${transformationDetails.length}`)
assert(transformationTopics.length >= 20, `expected transformation topics, got ${transformationTopics.length}`)
assert(transformationTargets.length >= 40, `expected transformation target combinations, got ${transformationTargets.length}`)
assertHasMarkers("transformation", transformationDetails, "transformation details", ["目标星", "来源天干"])

const patternDetails = ZIWEI_PATTERN_DEFINITIONS.map((definition) => {
  return buildZiweiPatternContentDictionaryDetail({
    id: definition.id,
    label: definition.label,
    category: definition.category,
    conditionText: definition.conditionText
  })
})
assert(patternDetails.length === 195, `expected 195 patterns, got ${patternDetails.length}`)
for (const detail of patternDetails.slice(0, 40)) {
  assertSourceReferences(detail.patternId, detail.sourceReferences)
  assertList(detail.patternId, detail.evidenceChecklist, "evidenceChecklist", 2)
  assertList(detail.patternId, detail.breakageChecklist, "breakageChecklist", 2)
  assertHasMarkers(detail.patternId, detail, "pattern detail", ["成格", "破格", "三方四正", "动态盘"])
}

const chart = buildFullZiweiChart({
  calendarType: "solar",
  year: 1990,
  month: 5,
  day: 17,
  hour: 9,
  gender: "male",
  timezone: "Asia/Shanghai"
})
const dynamicChart = buildFullZiweiDynamicChart({
  chart,
  input: {
    currentAge: 36,
    currentYear: 2026,
    currentLunarMonth: 5,
    currentLunarDay: 13,
    currentTimeBranch: "si"
  }
})
const interpretation = buildZiweiInterpretation({ chart, dynamicChart })
const chains = interpretation.detailedAnalysis.currentEvidenceChains
assert(chains.length >= 60, `expected at least 60 current evidence chains, got ${chains.length}`)
for (const kind of REQUIRED_EVIDENCE_CHAIN_KINDS) {
  assert(chains.some((chain) => chain.kind === kind), `missing current evidence chain kind ${kind}`)
}
assertList("current.evidenceSummaryLines", interpretation.detailedAnalysis.evidenceSummaryLines, "evidenceSummaryLines", 10)

console.log(
  "[check-data-dictionary-reading-readiness] ok " +
    `stars=${starDetails.length} palaces=${palaces.length} ` +
    `mainPalace=${mainPalace.length} nonMainPalace=${nonMainPalace.length} ` +
    `periodicPalace=${periodicPalace.length} pairs=${pairDetails.length} ` +
    `patterns=${patternDetails.length} chains=${chains.length}`
)
