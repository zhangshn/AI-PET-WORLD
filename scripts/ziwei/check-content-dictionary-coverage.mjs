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
  buildZiweiStarContentDictionaryDetail
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")
const {
  ziweiStarCatalog
} = require("../../src/ai/destiny-core/ziwei-core/star-catalog/index.ts")
const {
  ZIWEI_PATTERN_DEFINITIONS
} = require("../../src/app/ziwei/_lib/ziwei-pattern-catalog.ts")

function fail(message) {
  console.error(`[check-content-dictionary-coverage] ${message}`)
  process.exit(1)
}

const starDetails = ziweiStarCatalog.map((star) => {
  return buildZiweiStarContentDictionaryDetail(star)
})
const manualStarCount = starDetails.filter((detail) => {
  return detail.source === "manual"
}).length
const fallbackStarCount = starDetails.filter((detail) => {
  return detail.source === "category-fallback"
}).length

if (starDetails.length !== ziweiStarCatalog.length) {
  fail(`star dictionary count mismatch: ${starDetails.length} !== ${ziweiStarCatalog.length}`)
}

if (manualStarCount !== ziweiStarCatalog.length) {
  fail(`expected all stars to use manual dictionary content, got ${manualStarCount}`)
}

if (fallbackStarCount !== 0) {
  fail(`expected no category fallback content after periodic refinement, got ${fallbackStarCount}`)
}

starDetails.forEach((detail) => {
  assertString(detail.starId, detail.label, "label", 1)
  assertString(detail.starId, detail.nature, "nature", 8)
  assertString(detail.starId, detail.extendedOverview, "extendedOverview", 80)
  assertList(detail.starId, detail.identity, "identity", 2)
  assertList(detail.starId, detail.symbolicMeanings, "symbolicMeanings", 2)
  assertList(detail.starId, detail.functionalRole, "functionalRole", 2)
  assertList(detail.starId, detail.palaceUsage, "palaceUsage", 1)
  assertList(detail.starId, detail.brightnessUsage, "brightnessUsage", 1)
  assertList(detail.starId, detail.combinationUsage, "combinationUsage", 1)
  assertList(detail.starId, detail.interpretationSteps, "interpretationSteps", 2)
  assertList(detail.starId, detail.cautions, "cautions", 1)
  assertList(detail.starId, detail.reusableScenes, "reusableScenes", 2)
  assertList(detail.starId, detail.extendedSections, "extendedSections", 10)

  if (detail.sections.length < 5) {
    fail(`${detail.starId}: sections need at least 5 blocks`)
  }

  detail.extendedSections.forEach((section) => {
    assertString(detail.starId, section.title, "extendedSection.title", 2)
    assertList(detail.starId, section.items, `extendedSection.${section.title}.items`, 2)

    section.items.forEach((item) => {
      assertString(detail.starId, item, `extendedSection.${section.title}.item`, 40)
    })
  })
})

const patternDetails = ZIWEI_PATTERN_DEFINITIONS.map((definition) => {
  return buildZiweiPatternContentDictionaryDetail({
    id: definition.id,
    label: definition.label,
    category: definition.category,
    conditionText: definition.conditionText
  })
})

if (patternDetails.length < 150) {
  fail(`expected full pattern dictionary, got ${patternDetails.length}`)
}

patternDetails.forEach((detail) => {
  assertString(detail.patternId, detail.label, "label", 1)
  assertString(detail.patternId, detail.nature, "nature", 8)
  assertList(detail.patternId, detail.identity, "identity", 2)
  assertList(detail.patternId, detail.formationLogic, "formationLogic", 2)
  assertList(detail.patternId, detail.evidenceChecklist, "evidenceChecklist", 2)
  assertList(detail.patternId, detail.strengthChecklist, "strengthChecklist", 2)
  assertList(detail.patternId, detail.breakageChecklist, "breakageChecklist", 2)
  assertList(detail.patternId, detail.interpretationSteps, "interpretationSteps", 3)
  assertList(detail.patternId, detail.cautions, "cautions", 2)
  assertList(detail.patternId, detail.reusableScenes, "reusableScenes", 3)

  if (!detail.formationLogic.some((line) => line.includes("原始判定条件"))) {
    fail(`${detail.patternId}: missing original condition in formation logic`)
  }
})

console.log(
  `[check-content-dictionary-coverage] ok (${starDetails.length} star detail(s), ${patternDetails.length} pattern detail(s), ${fallbackStarCount} fallback star detail(s))`
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
