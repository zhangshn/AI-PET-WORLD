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
  getAllZiweiCurrentPatternSynthesisDepthProfiles,
  getAllZiweiPalaceTopicSynthesisDepthProfiles,
  getZiweiCurrentPatternSynthesisDepthProfile,
  getZiweiPalaceTopicSynthesisDepthProfile
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_SECTORS = [
  "life",
  "siblings",
  "spouse",
  "children",
  "wealth",
  "health",
  "travel",
  "friends",
  "career",
  "property",
  "fortune",
  "parents"
]

const REQUIRED_PATTERN_PROFILES = [
  "favorable-literary-assistant",
  "main-structure",
  "wealth-power-resource",
  "malefic-pressure",
  "misc-detail",
  "adverse-breakage",
  "dynamic-trigger",
  "pending-review"
]

function fail(message) {
  console.error(`[check-data-dictionary-synthesis-depth] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function assertText(id, value, field, minLength = 16) {
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

const palaceProfiles = getAllZiweiPalaceTopicSynthesisDepthProfiles()
assert(palaceProfiles.length === 12, `expected 12 palace topic profiles, got ${palaceProfiles.length}`)
for (const sectorName of REQUIRED_SECTORS) {
  const profile = getZiweiPalaceTopicSynthesisDepthProfile(sectorName)
  assert(profile?.sectorName === sectorName, `missing palace topic profile ${sectorName}`)
  assertText(sectorName, profile.topicScope, "topicScope")
  assertList(sectorName, profile.primaryQuestions, "primaryQuestions", 3, 6)
  assertList(sectorName, profile.baseEvidenceOrder, "baseEvidenceOrder", 5)
  assertList(sectorName, profile.oppositePalaceUsage, "oppositePalaceUsage", 3)
  assertList(sectorName, profile.triadSquareUsage, "triadSquareUsage", 5, 6)
  assertList(sectorName, profile.samePalaceStarUsage, "samePalaceStarUsage", 5, 6)
  assertList(sectorName, profile.transformationUsage, "transformationUsage", 5, 5)
  assertList(sectorName, profile.dynamicLayerUsage, "dynamicLayerUsage", 5, 5)
  assertList(sectorName, profile.paragraphOutputRules, "paragraphOutputRules", 4)
  assertList(sectorName, profile.hideRules, "hideRules", 4)
  assertList(sectorName, profile.cautions, "cautions", 2)
  assertContains(profile, "三方四正", sectorName, "profile")
  assertContains(profile, "四化", sectorName, "profile")
  assertContains(profile, "动态", sectorName, "profile")
}

const patternProfiles = getAllZiweiCurrentPatternSynthesisDepthProfiles()
assert(patternProfiles.length === 8, `expected 8 current pattern profiles, got ${patternProfiles.length}`)
for (const profileId of REQUIRED_PATTERN_PROFILES) {
  const profile = getZiweiCurrentPatternSynthesisDepthProfile(profileId)
  assert(profile?.profileId === profileId, `missing current pattern synthesis profile ${profileId}`)
  assertList(profileId, profile.patternCategories, "patternCategories", 1, 4)
  assertList(profileId, profile.dictionaryBoundary, "dictionaryBoundary", 3)
  assertList(profileId, profile.hitEvidenceRules, "hitEvidenceRules", 3)
  assertList(profileId, profile.strengthRules, "strengthRules", 3)
  assertList(profileId, profile.breakageRules, "breakageRules", 3)
  assertList(profileId, profile.dynamicLayerRules, "dynamicLayerRules", 4)
  assertList(profileId, profile.multiPatternPriorityRules, "multiPatternPriorityRules", 3)
  assertList(profileId, profile.paragraphOutputRules, "paragraphOutputRules", 4, 6)
  assertList(profileId, profile.hideRules, "hideRules", 3)
  assertList(profileId, profile.cautions, "cautions", 2, 6)
  assertContains(profile, "当前盘", profileId, "profile")
  assertContains(profile, "命中", profileId, "profile")
}

assertContains(
  getZiweiCurrentPatternSynthesisDepthProfile("dynamic-trigger"),
  "大限",
  "dynamic-trigger",
  "dynamic profile"
)
assertContains(
  getZiweiCurrentPatternSynthesisDepthProfile("dynamic-trigger"),
  "流年",
  "dynamic-trigger",
  "dynamic profile"
)
assertContains(
  getZiweiCurrentPatternSynthesisDepthProfile("pending-review"),
  "待复核",
  "pending-review",
  "pending profile"
)

console.log(
  `[check-data-dictionary-synthesis-depth] ok palaceProfiles=${palaceProfiles.length} patternProfiles=${patternProfiles.length}`
)
