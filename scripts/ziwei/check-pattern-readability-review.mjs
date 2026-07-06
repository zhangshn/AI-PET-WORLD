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
  getAllZiweiPatternReadabilityReviewProfiles,
  getZiweiPatternReadabilityReviewProfile,
  ZIWEI_PATTERN_READABILITY_REVIEW_PROFILES
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_PROFILE_IDS = [
  "favorable-literary-assistant",
  "main-structure",
  "wealth-power-resource",
  "malefic-pressure",
  "misc-detail",
  "adverse-breakage",
  "dynamic-trigger",
  "pending-review"
]

const REQUIRED_SECTION_TITLES = [
  "总字典边界",
  "当前盘边界",
  "命中证据",
  "成格解释",
  "破格解释",
  "加吉增强",
  "动态盘层级",
  "当前盘输出",
  "隐藏规则",
  "可读性检查",
  "资料不足处理",
  "下一步复核"
]

function fail(message) {
  console.error(`[check-pattern-readability-review] ${message}`)
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

const profiles = getAllZiweiPatternReadabilityReviewProfiles()
assert(
  profiles === ZIWEI_PATTERN_READABILITY_REVIEW_PROFILES,
  "getter must return the exported profile registry"
)
assert(profiles.length === REQUIRED_PROFILE_IDS.length, `expected 8 profiles, got ${profiles.length}`)

const actualProfileIds = profiles.map((profile) => profile.profileId)
assert(
  JSON.stringify(actualProfileIds) === JSON.stringify(REQUIRED_PROFILE_IDS),
  `profile id order mismatch: ${actualProfileIds.join(", ")}`
)

for (const profile of profiles) {
  const id = profile.profileId
  assert(getZiweiPatternReadabilityReviewProfile(id)?.reviewId === profile.reviewId, `${id}: getter mismatch`)
  assertText(id, profile.label, "label", 2)
  assertList(id, profile.patternCategories, "patternCategories", 1, 3)
  assertText(id, profile.dictionaryPurpose, "dictionaryPurpose", 30)
  assertText(id, profile.currentChartPurpose, "currentChartPurpose", 30)
  assertList(id, profile.requiredHitEvidence, "requiredHitEvidence", 4)
  assertList(id, profile.formationReadingRules, "formationReadingRules", 4)
  assertList(id, profile.breakageReadingRules, "breakageReadingRules", 4)
  assertList(id, profile.enhancementReadingRules, "enhancementReadingRules", 3)
  assertList(id, profile.dynamicLayerRules, "dynamicLayerRules", 4)
  assertList(id, profile.currentChartOutputRules, "currentChartOutputRules", 4)
  assertList(id, profile.hideRules, "hideRules", 3)
  assertList(id, profile.readabilityChecklist, "readabilityChecklist", 5)
  assertList(id, profile.insufficientDataPolicy, "insufficientDataPolicy", 5)
  assertText(id, profile.nextReviewAction, "nextReviewAction", 16)
  assert(profile.sections.length === REQUIRED_SECTION_TITLES.length, `${id}: section count mismatch`)

  const sectionTitles = profile.sections.map((section) => section.title)
  assert(
    JSON.stringify(sectionTitles) === JSON.stringify(REQUIRED_SECTION_TITLES),
    `${id}: section titles mismatch`
  )
  for (const section of profile.sections) {
    assertList(id, section.items, `section.${section.title}`, 1)
  }

  assertContains(profile, "总字典", id, "profile")
  assertContains(profile, "当前盘", id, "profile")
  assertContains(profile, "patternId", id, "profile")
  assertContains(profile, "sourceRuleIds", id, "profile")
  assertContains(profile, "成格", id, "profile")
  assertContains(profile, "破格", id, "profile")
  assertContains(profile, "动态盘", id, "profile")
  assertContains(profile, "资料不足", id, "profile")
  assertContains(profile, "隐藏", id, "profile")
}

assertContains(getZiweiPatternReadabilityReviewProfile("favorable-literary-assistant"), "文曜", "favorable-literary-assistant", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("favorable-literary-assistant"), "辅佐", "favorable-literary-assistant", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("main-structure"), "主星", "main-structure", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("wealth-power-resource"), "禄", "wealth-power-resource", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("wealth-power-resource"), "资源", "wealth-power-resource", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("malefic-pressure"), "煞曜", "malefic-pressure", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("malefic-pressure"), "压力", "malefic-pressure", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("misc-detail"), "杂曜", "misc-detail", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("adverse-breakage"), "凶格", "adverse-breakage", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("adverse-breakage"), "破格", "adverse-breakage", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("dynamic-trigger"), "大限", "dynamic-trigger", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("dynamic-trigger"), "流年", "dynamic-trigger", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("dynamic-trigger"), "流月", "dynamic-trigger", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("pending-review"), "待复核", "pending-review", "profile")
assertContains(getZiweiPatternReadabilityReviewProfile("pending-review"), "不输出", "pending-review", "profile")

console.log(`[check-pattern-readability-review] ok profiles=${profiles.length} sections=${profiles.length * REQUIRED_SECTION_TITLES.length}`)
