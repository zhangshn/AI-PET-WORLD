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
  getAllZiweiBranchSpatialRelationDepthProfiles,
  getAllZiweiTransformationLayerDepthProfiles,
  getZiweiBranchSpatialRelationDepthProfile,
  getZiweiTransformationLayerDepthProfile
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_TRANSFORMATION_LAYERS = ["natal", "da-yun", "liu-nian", "liu-yue", "liu-ri", "liu-shi"]
const REQUIRED_BRANCH_RELATIONS = [
  "four-horse",
  "four-cardinal",
  "four-storehouse",
  "water-triad",
  "wood-triad",
  "fire-triad",
  "metal-triad",
  "six-clash",
  "six-harmony",
  "punishment-harm"
]

function fail(message) {
  console.error(`[check-data-dictionary-transformation-branch-depth] ${message}`)
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

const transformationLayers = getAllZiweiTransformationLayerDepthProfiles()
assert(transformationLayers.length === 6, `expected 6 transformation layer profiles, got ${transformationLayers.length}`)

for (const layerId of REQUIRED_TRANSFORMATION_LAYERS) {
  const profile = getZiweiTransformationLayerDepthProfile(layerId)
  assert(profile?.layerId === layerId, `missing transformation layer ${layerId}`)
  assertText(layerId, profile.sourceStemRule, "sourceStemRule", 10)
  assertText(layerId, profile.layerScope, "layerScope", 8)
  assertList(layerId, profile.inheritanceRules, "inheritanceRules", 4)
  assertList(layerId, profile.targetStarRules, "targetStarRules", 4)
  assertList(layerId, profile.targetPalaceRules, "targetPalaceRules", 4)
  assertList(layerId, profile.relationRules, "relationRules", 4)
  assertList(layerId, profile.patternRules, "patternRules", 4)
  assertList(layerId, profile.paragraphRules, "paragraphRules", 4)
  assertList(layerId, profile.hideRules, "hideRules", 4)
  assertList(layerId, profile.forbiddenRules, "forbiddenRules", 3)
  assertContains(profile, "目标星", layerId, "profile")
  assertContains(profile, "目标宫", layerId, "profile")
  assertContains(profile, "来源", layerId, "profile")
}

assertContains(getZiweiTransformationLayerDepthProfile("natal"), "不得给四化显示庙旺落陷", "natal", "forbiddenRules")
assertContains(getZiweiTransformationLayerDepthProfile("liu-nian"), "大限", "liu-nian", "inheritanceRules")
assertContains(getZiweiTransformationLayerDepthProfile("liu-shi"), "不可放大", "liu-shi", "paragraphRules")

const branchRelations = getAllZiweiBranchSpatialRelationDepthProfiles()
assert(branchRelations.length === 10, `expected 10 branch spatial relation profiles, got ${branchRelations.length}`)

for (const relationId of REQUIRED_BRANCH_RELATIONS) {
  const profile = getZiweiBranchSpatialRelationDepthProfile(relationId)
  assert(profile?.relationId === relationId, `missing branch spatial relation ${relationId}`)
  assertList(relationId, profile.branches, "branches", relationId.includes("triad") ? 3 : 2, 2)
  assertText(relationId, profile.nature, "nature")
  assertList(relationId, profile.palaceUsage, "palaceUsage", 3)
  assertList(relationId, profile.starCombinationUsage, "starCombinationUsage", 3)
  assertList(relationId, profile.dynamicUsage, "dynamicUsage", 3)
  assertList(relationId, profile.patternUsage, "patternUsage", 3)
  assertList(relationId, profile.evidenceRules, "evidenceRules", 4)
  assertList(relationId, profile.cautions, "cautions", 3, 5)
  assertContains(profile, "宫", relationId, "profile")
}

assertContains(getZiweiBranchSpatialRelationDepthProfile("four-horse"), "天马", "four-horse", "starCombinationUsage")
assertContains(getZiweiBranchSpatialRelationDepthProfile("four-storehouse"), "墓库", "four-storehouse", "profile")
assertContains(getZiweiBranchSpatialRelationDepthProfile("six-clash"), "冲不是一定坏", "six-clash", "cautions")
assertContains(getZiweiBranchSpatialRelationDepthProfile("six-harmony"), "合不等于一定好", "six-harmony", "cautions")
assertContains(getZiweiBranchSpatialRelationDepthProfile("punishment-harm"), "刑害不等于必然灾祸", "punishment-harm", "cautions")

console.log(
  `[check-data-dictionary-transformation-branch-depth] ok transformationLayers=${transformationLayers.length} branchRelations=${branchRelations.length}`
)
