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
  getAllZiweiStarDictionarySampleReviewProfiles,
  getZiweiStarDictionarySampleReviewProfile,
  ZIWEI_STAR_DICTIONARY_SAMPLE_REVIEW_PROFILES
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_STAR_LABELS = ["紫微", "贪狼", "巨门", "廉贞", "武曲", "破军"]
const REQUIRED_DIMENSIONS = [
  "star-body",
  "twelve-palaces",
  "same-palace-combination",
  "opposite-trine-square",
  "transformation-trigger",
  "dynamic-flow-boundary",
  "current-chart-output"
]

function fail(message) {
  console.error(`[check-star-dictionary-sample-review] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function assertText(id, value, field, minLength = 8) {
  assert(typeof value === "string" && value.length >= minLength, `${id}: ${field} too short`)
}

function assertList(id, value, field, minLength, minEntryLength = 4) {
  assert(Array.isArray(value), `${id}: ${field} must be a list`)
  assert(value.length >= minLength, `${id}: ${field} needs at least ${minLength} item(s)`)
  for (const entry of value) {
    assertText(id, entry, field, minEntryLength)
  }
}

function assertContains(value, marker, id, field) {
  assert(JSON.stringify(value).includes(marker), `${id}: ${field} missing marker ${marker}`)
}

const profiles = getAllZiweiStarDictionarySampleReviewProfiles()
assert(
  profiles === ZIWEI_STAR_DICTIONARY_SAMPLE_REVIEW_PROFILES,
  "getter must return the exported profile registry"
)
assert(profiles.length === REQUIRED_STAR_LABELS.length, `expected 6 profiles, got ${profiles.length}`)

const byLabel = new Map(profiles.map((profile) => [profile.starLabel, profile]))

for (const starLabel of REQUIRED_STAR_LABELS) {
  const profile = byLabel.get(starLabel)
  assert(profile, `missing reviewed star ${starLabel}`)
  assert(getZiweiStarDictionarySampleReviewProfile(profile.starId)?.reviewId === profile.reviewId, `${starLabel}: getter mismatch`)
  assertText(starLabel, profile.reason, "reason", 18)
  assertList(starLabel, profile.referenceMethod, "referenceMethod", 5)
  assertList(starLabel, profile.currentChartUseRules, "currentChartUseRules", 5)
  assertList(starLabel, profile.sourceBoundary, "sourceBoundary", 4)
  assertList(starLabel, profile.nextSupplementOrder, "nextSupplementOrder", 5)
  assertContains(profile.referenceMethod, "星曜入十二宫", starLabel, "referenceMethod")
  assertContains(profile.referenceMethod, "三方四正", starLabel, "referenceMethod")
  assertContains(profile.referenceMethod, "大限", starLabel, "referenceMethod")
  assertContains(profile.sourceBoundary, "现代网站只作为解释结构", starLabel, "sourceBoundary")
  assertContains(profile.currentChartUseRules, "当前盘真实出现", starLabel, "currentChartUseRules")

  assert(profile.dimensions.length === REQUIRED_DIMENSIONS.length, `${starLabel}: dimension count mismatch`)
  const dimensionById = new Map(profile.dimensions.map((dimension) => [dimension.dimensionId, dimension]))
  for (const dimensionId of REQUIRED_DIMENSIONS) {
    const dimension = dimensionById.get(dimensionId)
    assert(dimension, `${starLabel}: missing dimension ${dimensionId}`)
    assertText(`${starLabel}.${dimensionId}`, dimension.label, "label", 2)
    assert(["ready", "needs-more-detail", "needs-source-review"].includes(dimension.status), `${starLabel}.${dimensionId}: invalid status`)
    assertList(`${starLabel}.${dimensionId}`, dimension.existingEvidenceRefs, "existingEvidenceRefs", 2, 4)
    assertList(`${starLabel}.${dimensionId}`, dimension.requiredReadingFields, "requiredReadingFields", 2, 8)
    assertList(`${starLabel}.${dimensionId}`, dimension.missingDetailNotes, "missingDetailNotes", 1, 8)
    assertText(`${starLabel}.${dimensionId}`, dimension.nextAction, "nextAction", 8)
  }
  assert(profile.dimensions.some((dimension) => dimension.status === "ready"), `${starLabel}: needs ready dimension`)
  assert(profile.dimensions.some((dimension) => dimension.status === "needs-more-detail"), `${starLabel}: needs gap dimension`)
}

assertContains(byLabel.get("紫微"), "帝座", "紫微", "profile")
assertContains(byLabel.get("贪狼"), "桃花", "贪狼", "profile")
assertContains(byLabel.get("巨门"), "是非", "巨门", "profile")
assertContains(byLabel.get("廉贞"), "边界", "廉贞", "profile")
assertContains(byLabel.get("武曲"), "财务", "武曲", "profile")
assertContains(byLabel.get("破军"), "破旧立新", "破军", "profile")

console.log(
  `[check-star-dictionary-sample-review] ok stars=${profiles.length} dimensions=${profiles.length * REQUIRED_DIMENSIONS.length}`
)
