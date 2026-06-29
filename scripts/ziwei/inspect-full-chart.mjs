import { readdirSync, readFileSync } from "node:fs"
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
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText

  module._compile(output, filename)
}

const {
  buildFullZiweiChart,
  buildFullZiweiDynamicChart,
  buildZiweiPageViewModel
} = require("../../src/ai/destiny-core/ziwei-core/public-api")

const sampleDir = path.join(process.cwd(), "data", "ziwei", "golden-samples")
const samplePaths = readdirSync(sampleDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => path.join(sampleDir, file))
const requiredSampleIds = [
  "1990-male-solar",
  "1991-male-yin-year-backward",
  "1990-female-yang-year-backward",
  "1991-female-yin-year-forward",
  "1995-female-not-started",
  "1988-male-hai-hour-boundary",
  "1988-male-zi-hour-boundary"
]

function fail(message) {
  console.error(`Ziwei full chart inspection failed: ${message}`)
  process.exit(1)
}

if (samplePaths.length === 0) {
  fail("no golden samples found")
}

const samples = samplePaths.map((samplePath) => {
  return JSON.parse(readFileSync(samplePath, "utf8"))
})
const sampleIds = new Set(samples.map((sample) => sample.sampleId))
const missingSampleIds = requiredSampleIds.filter((sampleId) => {
  return !sampleIds.has(sampleId)
})

if (missingSampleIds.length > 0) {
  fail(`missing required sample ids: ${missingSampleIds.join(", ")}`)
}

samples.forEach((sample) => {
  const chart = buildFullZiweiChart(sample.birthInput)
  const dynamicChart = buildFullZiweiDynamicChart({
    chart,
    input: sample.dynamicInput
  })
  const viewModel = buildZiweiPageViewModel({
    chart,
    dynamicChart
  })
  const expected = sample.expected

  assertEqual(sample, "palaceCount", chart.palaces.length, expected.palaceCount)
  assertEqual(sample, "lifePalace", chart.summary.lifePalace, expected.lifePalace)
  assertEqual(sample, "bodyPalace", chart.summary.bodyPalace, expected.bodyPalace)
  assertEqual(sample, "elementGate", chart.summary.elementGate, expected.elementGate)
  assertEqual(
    sample,
    "totalStarCount",
    chart.summary.totalStarCount,
    expected.totalStarCount
  )
  assertJsonEqual(
    sample,
    "starCountsByCategory",
    chart.summary.starCountsByCategory,
    expected.starCountsByCategory
  )
  assertJsonEqual(
    sample,
    "dynamicDebug",
    dynamicChart.debug,
    expected.dynamicDebug
  )
  assertJsonEqual(
    sample,
    "dynamicFlowPalaces",
    Object.fromEntries(dynamicChart.flows.map((flow) => [flow.type, flow.palace])),
    expected.dynamicFlowPalaces
  )
  assertEqual(
    sample,
    "viewModel.palaceGridCount",
    viewModel.palaceGrid.length,
    expected.viewModel.palaceGridCount
  )
  assertEqual(
    sample,
    "viewModel.palaceDetailCount",
    viewModel.palaceDetails.length,
    expected.viewModel.palaceDetailCount
  )
  assertEqual(
    sample,
    "viewModel.dynamicTabCount",
    viewModel.dynamicTabs.length,
    expected.viewModel.dynamicTabCount
  )
  assertEqual(
    sample,
    "viewModel.starCatalogRowCount",
    viewModel.starCatalogRows.length,
    expected.viewModel.starCatalogRowCount
  )
})

console.log(`Ziwei full chart inspection passed for ${samplePaths.length} sample(s).`)

function assertEqual(sample, key, actual, expected) {
  if (actual !== expected) {
    fail(`${sample.sampleId}: ${key} expected ${expected}, got ${actual}`)
  }
}

function assertJsonEqual(sample, key, actual, expected) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)

  if (actualJson !== expectedJson) {
    fail(`${sample.sampleId}: ${key} expected ${expectedJson}, got ${actualJson}`)
  }
}
