import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
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

const ROOT = process.cwd()

const HARD_RULE_SOURCES = [
  {
    sourceId: "project.star-catalog",
    sourceKey: "projectStarCatalog",
    expectedLocation: "src/ai/destiny-core/ziwei-core/star-catalog",
    requiredFiles: ["src/ai/destiny-core/ziwei-core/star-catalog/index.ts"],
    markers: ["ziweiStarCatalog", "ziweiStarCatalogById"]
  },
  {
    sourceId: "project.pattern-catalog",
    sourceKey: "projectPatternCatalog",
    expectedLocation: "src/app/ziwei/_lib/ziwei-pattern-catalog.ts",
    requiredFiles: ["src/app/ziwei/_lib/ziwei-pattern-catalog.ts"],
    markers: ["ZIWEI_PATTERN_DEFINITIONS", "conditionText"]
  },
  {
    sourceId: "project.transformation-rules",
    sourceKey: "projectTransformationRules",
    expectedLocation: "NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM",
    requiredFiles: [
      "src/ai/destiny-core/ziwei-core/star-placement/transformations/transformation-rules.ts"
    ],
    markers: ["NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM", "TransformationKind"]
  },
  {
    sourceId: "project.brightness-table",
    sourceKey: "projectBrightnessTable",
    expectedLocation: "src/ai/destiny-core/ziwei-core/star-catalog/star-brightness.ts",
    requiredFiles: ["src/ai/destiny-core/ziwei-core/star-catalog/star-brightness.ts"],
    markers: ["ZIWEI_STAR_BRIGHTNESS_TABLE", "resolveZiweiStarBrightness"]
  },
  {
    sourceId: "project.dynamic-flow-rules",
    sourceKey: "projectDynamicFlowRules",
    expectedLocation: "dynamic-chart / dynamic-flow modules",
    requiredFiles: [
      "src/ai/destiny-core/ziwei-core/dynamic-chart/dynamic-flow-builder.ts",
      "src/ai/destiny-core/ziwei-core/dynamic-chart/dynamic-flow-palaces.ts",
      "src/ai/destiny-core/ziwei-core/dynamic-chart/dynamic-flow-stems.ts",
      "src/ai/destiny-core/ziwei-core/dynamic-chart/dynamic-flow-stars.ts"
    ],
    markers: [
      "buildDynamicFlow",
      "getDaYunPalace",
      "getLiuNianPalace",
      "getLiuYuePalace",
      "getLiuRiPalace",
      "getLiuShiPalace",
      "buildDynamicFlowingStars"
    ]
  }
]

const DOC_FILES = [
  "docs/ziwei/README.md",
  "data/ziwei/legacy-roadmap-verification-baseline-v1.txt",
  "docs/ziwei/DIRECTORY_STRUCTURE.md",
  "docs/ziwei/ALGORITHM_CONTRACTS.md",
  "docs/ziwei/CONTENT_DATA_DICTIONARY.md",
  "docs/ziwei/SOURCE_STORAGE_BOUNDARY.md",
  "docs/ziwei/PAGE_ACCEPTANCE.md",
  "data/ziwei/legacy-execution-verification-baseline-v1.txt"
]

const {
  getAllTheorySourceReferenceContentDetails,
  getAllZiweiContentExpansionPriorityItems,
  getAllZiweiSourceReferenceReviewQueueItems,
  ZIWEI_CONTENT_SOURCE_REFERENCE_IDS
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")
const {
  ziweiStarCatalog,
  ZIWEI_STAR_BRIGHTNESS_TABLE
} = require("../../src/ai/destiny-core/ziwei-core/star-catalog/index.ts")
const {
  NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM
} = require("../../src/ai/destiny-core/ziwei-core/star-placement/transformations/transformation-rules.ts")
const {
  ZIWEI_PATTERN_DEFINITIONS
} = require("../../src/app/ziwei/_lib/ziwei-pattern-catalog.ts")

function fail(message) {
  console.error(`[check-hard-rule-source-drift] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function readWorkspaceFile(relativePath) {
  const absolutePath = path.join(ROOT, relativePath)
  assert(existsSync(absolutePath), `missing workspace file: ${relativePath}`)
  return readFileSync(absolutePath, "utf8")
}

function assertContains(haystack, needle, label) {
  assert(haystack.includes(needle), `${label} missing marker: ${needle}`)
}

const theorySourceDetails = getAllTheorySourceReferenceContentDetails()
const theorySourceById = new Map(
  theorySourceDetails.map((source) => [source.sourceId, source])
)
const reviewQueue = getAllZiweiSourceReferenceReviewQueueItems()
const reviewQueueBySourceId = new Map(
  reviewQueue.map((item) => [item.sourceId, item])
)
const expansionQueue = getAllZiweiContentExpansionPriorityItems()
const driftAuditItem = expansionQueue.find(
  (item) => item.itemId === "content-expansion.p0.algorithm-source-drift-audit"
)

assert(driftAuditItem, "missing P23 algorithm source drift audit queue item")
assert(driftAuditItem.priority === "P0", "P23 drift audit queue item must be P0")
assert(driftAuditItem.domain === "algorithm-source", "P23 drift audit queue item domain mismatch")

for (const source of HARD_RULE_SOURCES) {
  assert(
    ZIWEI_CONTENT_SOURCE_REFERENCE_IDS[source.sourceKey] === source.sourceId,
    `source id map drifted for ${source.sourceKey}`
  )

  const theorySource = theorySourceById.get(source.sourceId)
  assert(theorySource, `missing theory source detail: ${source.sourceId}`)
  assert(
    theorySource.sourceKind === "project-algorithm",
    `${source.sourceId} must remain project-algorithm`
  )
  assert(theorySource.sourceReliability === "high", `${source.sourceId} must remain high reliability`)
  assert(
    theorySource.copyrightPolicy === "original-content",
    `${source.sourceId} must remain original-content`
  )
  assertContains(theorySource.editionOrLocation, source.expectedLocation, source.sourceId)

  const reviewItem = reviewQueueBySourceId.get(source.sourceId)
  assert(reviewItem, `missing review queue item: ${source.sourceId}`)
  assert(reviewItem.priority === "P0", `${source.sourceId} review priority must remain P0`)
  assert(reviewItem.canActAsHardRule === true, `${source.sourceId} must remain hard rule source`)
  assert(
    driftAuditItem.relatedSourceIds.includes(source.sourceId),
    `P23 drift audit item missing related source: ${source.sourceId}`
  )

  const combinedFileContent = source.requiredFiles
    .map((relativePath) => readWorkspaceFile(relativePath))
    .join("\n")
  for (const marker of source.markers) {
    assertContains(combinedFileContent, marker, source.sourceId)
  }
}

assert(Array.isArray(ziweiStarCatalog), "ziweiStarCatalog must be an array")
assert(ziweiStarCatalog.length >= 100, `expected at least 100 stars, got ${ziweiStarCatalog.length}`)
assert(
  new Set(ziweiStarCatalog.map((star) => star.starId)).size === ziweiStarCatalog.length,
  "star catalog contains duplicate star ids"
)

assert(
  Array.isArray(ZIWEI_PATTERN_DEFINITIONS),
  "ZIWEI_PATTERN_DEFINITIONS must be an array"
)
assert(
  ZIWEI_PATTERN_DEFINITIONS.length >= 190,
  `expected at least 190 patterns, got ${ZIWEI_PATTERN_DEFINITIONS.length}`
)
assert(
  new Set(ZIWEI_PATTERN_DEFINITIONS.map((pattern) => pattern.id)).size ===
    ZIWEI_PATTERN_DEFINITIONS.length,
  "pattern catalog contains duplicate pattern ids"
)

const transformationStems = Object.keys(NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM)
assert(transformationStems.length === 10, `expected 10 transformation stems, got ${transformationStems.length}`)
for (const stem of transformationStems) {
  const rules = NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM[stem]
  assert(Array.isArray(rules), `transformation rules for ${stem} must be an array`)
  assert(rules.length === 4, `transformation rules for ${stem} must contain 4 targets`)
}

const brightnessStarIds = Object.keys(ZIWEI_STAR_BRIGHTNESS_TABLE)
assert(
  brightnessStarIds.length >= 20,
  `expected at least 20 brightness stars, got ${brightnessStarIds.length}`
)
for (const starId of brightnessStarIds) {
  const branchTable = ZIWEI_STAR_BRIGHTNESS_TABLE[starId]
  assert(Object.keys(branchTable).length === 12, `brightness table for ${starId} must cover 12 branches`)
}

for (const docPath of DOC_FILES) {
  const content = readWorkspaceFile(docPath)
  assertContains(content, "紫微斗数", docPath)
}

const algorithmContracts = readWorkspaceFile("docs/ziwei/ALGORITHM_CONTRACTS.md")
for (const source of HARD_RULE_SOURCES) {
  assertContains(algorithmContracts, source.sourceId, "docs/ziwei/ALGORITHM_CONTRACTS.md")
}
assertContains(
  algorithmContracts,
  "check-hard-rule-source-drift.mjs",
  "docs/ziwei/ALGORITHM_CONTRACTS.md"
)

const sourceCopyright = readWorkspaceFile("docs/ziwei/SOURCE_STORAGE_BOUNDARY.md")
for (const source of HARD_RULE_SOURCES) {
  assertContains(sourceCopyright, source.sourceId, "docs/ziwei/SOURCE_STORAGE_BOUNDARY.md")
}

console.log(
  [
    "[check-hard-rule-source-drift] passed",
    `hardRuleSources=${HARD_RULE_SOURCES.length}`,
    `stars=${ziweiStarCatalog.length}`,
    `patterns=${ZIWEI_PATTERN_DEFINITIONS.length}`,
    `brightnessStars=${brightnessStarIds.length}`
  ].join(" ")
)
