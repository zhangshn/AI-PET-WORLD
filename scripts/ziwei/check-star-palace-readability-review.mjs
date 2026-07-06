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
  getAllZiweiStarPalaceReadabilityReviewProfiles,
  getZiweiStarPalaceReadabilityReviewProfile,
  getZiweiStarPalaceReadabilityReviewProfilesByPalace,
  getZiweiStarPalaceReadabilityReviewProfilesByStar,
  ZIWEI_STAR_PALACE_READABILITY_REVIEW_PALACES,
  ZIWEI_STAR_PALACE_READABILITY_REVIEW_PROFILES
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_STAR_LABELS = ["紫微", "贪狼", "巨门", "廉贞", "武曲", "破军"]
const REQUIRED_PALACES = ["life", "spouse", "wealth", "career", "travel", "health"]
const REQUIRED_SECTION_TITLES = [
  "核心问题",
  "本体转宫位",
  "同宫解释",
  "对宫与三方四正",
  "四化解释",
  "动态盘边界",
  "当前盘证据",
  "可读性检查",
  "资料不足处理",
  "下一步复核"
]

function fail(message) {
  console.error(`[check-star-palace-readability-review] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function assertText(id, value, field, minLength = 12) {
  assert(typeof value === "string" && value.length >= minLength, `${id}: ${field} too short`)
}

function assertList(id, value, field, minLength, minEntryLength = 8) {
  assert(Array.isArray(value), `${id}: ${field} must be a list`)
  assert(value.length >= minLength, `${id}: ${field} needs at least ${minLength} item(s)`)
  for (const entry of value) {
    assertText(id, entry, field, minEntryLength)
  }
}

function assertContains(value, marker, id, field) {
  assert(JSON.stringify(value).includes(marker), `${id}: ${field} missing marker ${marker}`)
}

const profiles = getAllZiweiStarPalaceReadabilityReviewProfiles()
assert(
  profiles === ZIWEI_STAR_PALACE_READABILITY_REVIEW_PROFILES,
  "getter must return the exported profile registry"
)
assert(profiles.length === 36, `expected 36 profiles, got ${profiles.length}`)
assert(
  JSON.stringify(ZIWEI_STAR_PALACE_READABILITY_REVIEW_PALACES) === JSON.stringify(REQUIRED_PALACES),
  "review palace order mismatch"
)

const byLabel = new Map(REQUIRED_STAR_LABELS.map((label) => [label, []]))
const byPalace = new Map(REQUIRED_PALACES.map((palaceId) => [palaceId, []]))

for (const profile of profiles) {
  assert(byLabel.has(profile.starLabel), `unexpected star label ${profile.starLabel}`)
  assert(byPalace.has(profile.palaceId), `unexpected palace ${profile.palaceId}`)
  byLabel.get(profile.starLabel).push(profile)
  byPalace.get(profile.palaceId).push(profile)

  const id = `${profile.starLabel}.${profile.palaceLabel}`
  assert(getZiweiStarPalaceReadabilityReviewProfile(profile.starId, profile.palaceId)?.reviewId === profile.reviewId, `${id}: getter mismatch`)
  assertText(id, profile.coreQuestion, "coreQuestion", 20)
  assertText(id, profile.bodyToPalaceConversion, "bodyToPalaceConversion", 40)
  assertText(id, profile.samePalaceReading, "samePalaceReading", 40)
  assertText(id, profile.oppositeTrineSquareReading, "oppositeTrineSquareReading", 40)
  assertText(id, profile.transformationReading, "transformationReading", 40)
  assertText(id, profile.dynamicLayerReading, "dynamicLayerReading", 40)
  assertList(id, profile.currentChartEvidenceRules, "currentChartEvidenceRules", 5)
  assertList(id, profile.readabilityChecklist, "readabilityChecklist", 5)
  assertList(id, profile.insufficientDataPolicy, "insufficientDataPolicy", 5)
  assertText(id, profile.nextReviewAction, "nextReviewAction", 30)
  assert(profile.sections.length === REQUIRED_SECTION_TITLES.length, `${id}: section count mismatch`)

  const sectionTitles = profile.sections.map((section) => section.title)
  assert(
    JSON.stringify(sectionTitles) === JSON.stringify(REQUIRED_SECTION_TITLES),
    `${id}: section titles mismatch`
  )
  for (const section of profile.sections) {
    assertList(id, section.items, `section.${section.title}`, 1)
  }

  assertContains(profile, "同宫", id, "profile")
  assertContains(profile, "三方四正", id, "profile")
  assertContains(profile, "四化", id, "profile")
  assertContains(profile, "动态盘", id, "profile")
  assertContains(profile, "当前盘", id, "profile")
  assertContains(profile.insufficientDataPolicy, "资料不足", id, "insufficientDataPolicy")
}

for (const starLabel of REQUIRED_STAR_LABELS) {
  const list = byLabel.get(starLabel)
  assert(list.length === 6, `${starLabel}: expected 6 palace samples, got ${list.length}`)
  assert(getZiweiStarPalaceReadabilityReviewProfilesByStar(list[0].starId).length === 6, `${starLabel}: byStar getter mismatch`)
}

for (const palaceId of REQUIRED_PALACES) {
  const list = byPalace.get(palaceId)
  assert(list.length === 6, `${palaceId}: expected 6 star samples, got ${list.length}`)
  assert(getZiweiStarPalaceReadabilityReviewProfilesByPalace(palaceId).length === 6, `${palaceId}: byPalace getter mismatch`)
}

assertContains(byLabel.get("紫微"), "帝座", "紫微", "samples")
assertContains(byLabel.get("贪狼"), "桃花", "贪狼", "samples")
assertContains(byLabel.get("巨门"), "口舌", "巨门", "samples")
assertContains(byLabel.get("廉贞"), "边界", "廉贞", "samples")
assertContains(byLabel.get("武曲"), "财务", "武曲", "samples")
assertContains(byLabel.get("破军"), "破旧立新", "破军", "samples")
assertContains(byPalace.get("health"), "不做医学诊断", "health", "samples")

console.log(`[check-star-palace-readability-review] ok profiles=${profiles.length}`)
