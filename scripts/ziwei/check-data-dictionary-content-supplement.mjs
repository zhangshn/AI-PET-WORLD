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
  getAllZiweiDynamicFlowInheritanceProfiles,
  getAllZiweiMiscStarThemeDepthProfiles,
  getAllZiweiPeriodicStarFlowLayerProfiles,
  getZiweiDynamicFlowInheritanceProfile,
  getZiweiMiscStarThemeDepthProfile,
  getZiweiPeriodicStarFlowLayerProfile
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_MISC_THEMES = [
  "celebration-relationship",
  "attraction-aesthetic",
  "platform-title",
  "appearance-reputation",
  "sensing-healing",
  "solitude-distance",
  "discipline-breakage",
  "grief-emptiness"
]

const REQUIRED_PERIODIC_GROUPS = [
  "lifecycle",
  "boshi",
  "suiqian",
  "jiangqian",
  "monthly",
  "daily-hourly"
]

const REQUIRED_DYNAMIC_LAYERS = ["natal", "da-yun", "liu-nian", "liu-yue", "liu-ri", "liu-shi"]

function fail(message) {
  console.error(`[check-data-dictionary-content-supplement] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function assertText(id, value, field, minLength = 20) {
  assert(typeof value === "string" && value.length >= minLength, `${id}: ${field} too short`)
}

function assertList(id, value, field, minLength, minEntryLength = 8) {
  assert(Array.isArray(value), `${id}: ${field} must be a list`)
  assert(value.length >= minLength, `${id}: ${field} needs at least ${minLength} item(s)`)
  for (const entry of value) {
    assertText(id, entry, field, minEntryLength)
  }
}

const miscThemes = getAllZiweiMiscStarThemeDepthProfiles()
assert(miscThemes.length === 8, `expected 8 misc star themes, got ${miscThemes.length}`)
for (const themeId of REQUIRED_MISC_THEMES) {
  const profile = getZiweiMiscStarThemeDepthProfile(themeId)
  assert(profile?.themeId === themeId, `missing misc theme ${themeId}`)
  assertList(themeId, profile.starIds, "starIds", 1)
  assertText(themeId, profile.coreMeaning, "coreMeaning")
  assertList(themeId, profile.palaceUsage, "palaceUsage", 3)
  assertList(themeId, profile.samePalaceUsage, "samePalaceUsage", 3)
  assertList(themeId, profile.triadUsage, "triadUsage", 3)
  assertList(themeId, profile.dynamicUsage, "dynamicUsage", 3)
  assertList(themeId, profile.combinationWeightRules, "combinationWeightRules", 3)
  assertList(themeId, profile.currentChartUsage, "currentChartUsage", 2)
  assertList(themeId, profile.cautions, "cautions", 2)
  assertList(themeId, profile.sourceBoundary, "sourceBoundary", 2)
}

const coveredMiscStars = new Set(miscThemes.flatMap((profile) => profile.starIds))
assert(coveredMiscStars.size >= 15, `expected at least 15 covered misc stars, got ${coveredMiscStars.size}`)

const periodicGroups = getAllZiweiPeriodicStarFlowLayerProfiles()
assert(periodicGroups.length === 6, `expected 6 periodic groups, got ${periodicGroups.length}`)
for (const groupId of REQUIRED_PERIODIC_GROUPS) {
  const profile = getZiweiPeriodicStarFlowLayerProfile(groupId)
  assert(profile?.groupId === groupId, `missing periodic group ${groupId}`)
  assertList(groupId, profile.allowedLayers, "allowedLayers", 2, 5)
  assertText(groupId, profile.layerNature, "layerNature")
  assertList(groupId, profile.inheritanceRules, "inheritanceRules", 4)
  assertList(groupId, profile.evidenceWeight, "evidenceWeight", 3)
  assertList(groupId, profile.palaceUsage, "palaceUsage", 3)
  assertList(groupId, profile.transformationUsage, "transformationUsage", 3)
  assertList(groupId, profile.patternUsage, "patternUsage", 3)
  assertList(groupId, profile.currentChartUsage, "currentChartUsage", 2)
  assertList(groupId, profile.forbiddenUsage, "forbiddenUsage", 3)
}

const dynamicLayers = getAllZiweiDynamicFlowInheritanceProfiles()
assert(dynamicLayers.length === 6, `expected 6 dynamic layers, got ${dynamicLayers.length}`)
for (const layerId of REQUIRED_DYNAMIC_LAYERS) {
  const profile = getZiweiDynamicFlowInheritanceProfile(layerId)
  assert(profile?.layerId === layerId, `missing dynamic layer ${layerId}`)
  assertText(layerId, profile.role, "role")
  assert(Array.isArray(profile.inheritedLayers), `${layerId}: inheritedLayers must be a list`)
  assertList(layerId, profile.visibleMarkers, "visibleMarkers", layerId === "natal" ? 4 : 5, 2)
  assertList(layerId, profile.palaceUsage, "palaceUsage", 3)
  assertList(layerId, profile.patternUsage, "patternUsage", 3)
  assertList(layerId, profile.transformationUsage, "transformationUsage", 3)
  assertList(layerId, profile.paragraphEvidenceOrder, "paragraphEvidenceOrder", 4, 6)
  assertList(layerId, profile.resetRules, "resetRules", 3)
  assertList(layerId, profile.cautions, "cautions", 2)
}

assert(
  getZiweiDynamicFlowInheritanceProfile("liu-nian").inheritedLayers.includes("da-yun"),
  "liu-nian must inherit da-yun"
)
assert(
  getZiweiDynamicFlowInheritanceProfile("liu-shi").inheritedLayers.includes("liu-ri"),
  "liu-shi must inherit liu-ri"
)

console.log(
  `[check-data-dictionary-content-supplement] ok miscThemes=${miscThemes.length} periodicGroups=${periodicGroups.length} dynamicLayers=${dynamicLayers.length}`
)
