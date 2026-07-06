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
  getAllZiweiDictionaryExplanationLayerProfiles,
  getAllZiweiExternalExplanationReferenceSourceProfiles,
  getZiweiDictionaryExplanationLayerProfile,
  ZIWEI_DICTIONARY_REFERENCE_METHOD_CHECKLIST
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_LAYERS = [
  "foundation",
  "star-body",
  "star-palace",
  "palace-system",
  "relation-structure",
  "transformation-flow",
  "dynamic-flow",
  "chart-synthesis"
]

function fail(message) {
  console.error(`[check-data-dictionary-explanation-reference-method] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function assertText(id, value, field, minLength = 10) {
  assert(typeof value === "string" && value.length >= minLength, `${id}: ${field} too short`)
}

function assertList(id, value, field, minLength, minEntryLength = 6) {
  assert(Array.isArray(value), `${id}: ${field} must be a list`)
  assert(value.length >= minLength, `${id}: ${field} needs at least ${minLength} item(s)`)
  for (const entry of value) {
    assertText(id, entry, field, minEntryLength)
  }
}

function assertContains(value, marker, id, field) {
  assert(JSON.stringify(value).includes(marker), `${id}: ${field} missing marker ${marker}`)
}

const sources = getAllZiweiExternalExplanationReferenceSourceProfiles()
assert(sources.length >= 1, "expected at least one external explanation reference source")

const ziweiMy = sources.find((source) => source.sourceId === "p36.reference-method.ziwei-my")
assert(ziweiMy, "missing ziwei.my reference method source")
assert(ziweiMy.locator === "https://www.ziwei.my/", "ziwei.my locator mismatch")
assertList(ziweiMy.sourceId, ziweiMy.storageBoundary, "storageBoundary", 4)
assertList(ziweiMy.sourceId, ziweiMy.observedExplanationLayers, "observedExplanationLayers", 8, 4)
assertList(ziweiMy.sourceId, ziweiMy.adoptedMethodRules, "adoptedMethodRules", 6)
assertList(ziweiMy.sourceId, ziweiMy.forbiddenUse, "forbiddenUse", 4)
assertContains(ziweiMy, "不复制现代网站正文", ziweiMy.sourceId, "storageBoundary")
assertContains(ziweiMy, "星曜入十二宫", ziweiMy.sourceId, "adoptedMethodRules")
assertContains(ziweiMy, "三方四正", ziweiMy.sourceId, "adoptedMethodRules")
assertContains(ziweiMy, "四化", ziweiMy.sourceId, "adoptedMethodRules")

const layers = getAllZiweiDictionaryExplanationLayerProfiles()
assert(layers.length === REQUIRED_LAYERS.length, `expected ${REQUIRED_LAYERS.length} layers, got ${layers.length}`)

for (const layerId of REQUIRED_LAYERS) {
  const profile = getZiweiDictionaryExplanationLayerProfile(layerId)
  assert(profile?.layerId === layerId, `missing layer ${layerId}`)
  assertText(layerId, profile.label, "label", 2)
  assertText(layerId, profile.sourceObservation, "sourceObservation", 16)
  assertText(layerId, profile.dictionaryTargetLayer, "dictionaryTargetLayer", 6)
  assertList(layerId, profile.requiredFields, "requiredFields", 5, 2)
  assertList(layerId, profile.outputRules, "outputRules", 4)
  assertList(layerId, profile.currentChartBoundary, "currentChartBoundary", 3)
}

assertContains(getZiweiDictionaryExplanationLayerProfile("star-body"), "星曜本体", "star-body", "profile")
assertContains(getZiweiDictionaryExplanationLayerProfile("star-palace"), "入十二宫", "star-palace", "profile")
assertContains(getZiweiDictionaryExplanationLayerProfile("relation-structure"), "三方四正", "relation-structure", "profile")
assertContains(getZiweiDictionaryExplanationLayerProfile("transformation-flow"), "谁的四化", "transformation-flow", "profile")
assertContains(getZiweiDictionaryExplanationLayerProfile("chart-synthesis"), "当前盘只显示命中的内容", "chart-synthesis", "profile")

assertList("reference-method-checklist", ZIWEI_DICTIONARY_REFERENCE_METHOD_CHECKLIST, "checklist", 10)
assertContains(ZIWEI_DICTIONARY_REFERENCE_METHOD_CHECKLIST, "避免复制现代网站正文", "reference-method-checklist", "checklist")
assertContains(ZIWEI_DICTIONARY_REFERENCE_METHOD_CHECKLIST, "资料不足", "reference-method-checklist", "checklist")

console.log(
  `[check-data-dictionary-explanation-reference-method] ok sources=${sources.length} layers=${layers.length}`
)
