import { readdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import Module from "node:module"
import path from "node:path"
import ts from "typescript"

const require = createRequire(import.meta.url)
const originalResolveFilename = Module._resolveFilename

Module._resolveFilename = function resolveZiweiPatternAlias(
  request,
  parent,
  isMain,
  options
) {
  if (request.startsWith("@/")) {
    return originalResolveFilename(
      path.join(process.cwd(), "src", request.slice(2)),
      parent,
      isMain,
      options
    )
  }

  return originalResolveFilename(request, parent, isMain, options)
}

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
const {
  buildZiweiPatternMatches
} = require("../../src/app/ziwei/_lib/ziwei-pattern-catalog.ts")
const {
  buildZiweiPatternStatistics
} = require("../../src/app/ziwei/_lib/ziwei-pattern-statistics.ts")

const goldenPath = path.join(
  process.cwd(),
  "data",
  "ziwei",
  "pattern-golden-samples",
  "pattern-golden-v1.json"
)
const sampleDir = path.join(process.cwd(), "data", "ziwei", "golden-samples")
const golden = JSON.parse(readFileSync(goldenPath, "utf8"))
const sampleFiles = Object.fromEntries(
  readdirSync(sampleDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const sample = JSON.parse(readFileSync(path.join(sampleDir, file), "utf8"))
      return [sample.sampleId, sample]
    })
)

function fail(message) {
  console.error(`[check-pattern-golden-samples] ${message}`)
  process.exit(1)
}

if (golden.schemaVersion !== "ziwei-pattern-golden-v1") {
  fail(`unexpected schema version: ${golden.schemaVersion}`)
}

if (!Array.isArray(golden.samples) || golden.samples.length === 0) {
  fail("pattern golden sample list is empty")
}

for (const expected of golden.samples) {
  const sample = sampleFiles[expected.sampleId]

  if (!sample) {
    fail(`missing source sample: ${expected.sampleId}`)
  }

  const chart = buildFullZiweiChart(sample.birthInput)
  const dynamicChart = buildFullZiweiDynamicChart({
    chart,
    input: sample.dynamicInput
  })
  const viewModel = buildZiweiPageViewModel({
    chart,
    dynamicChart
  })
  const matches = buildZiweiPatternMatches(viewModel.palaceDetails)
  const statistics = buildZiweiPatternStatistics(matches)
  const categoryTotals = Object.fromEntries(
    statistics.categoryStats.map((row) => [row.category, row.totalCount])
  )
  const categoryHitCounts = Object.fromEntries(
    statistics.categoryStats.map((row) => [row.category, row.hitCount])
  )
  const actual = {
    lifePalace: chart.summary.lifePalace,
    bodyPalace: chart.summary.bodyPalace,
    totals: {
      hitCount: statistics.hitCount,
      missCount: statistics.missCount,
      enhancedCount: statistics.enhancedCount,
      brokenCount: statistics.brokenCount,
      adverseHitCount: statistics.adverseHitCount
    },
    categoryHitCounts,
    hitPatternIds: matches
      .filter((match) => match.status === "hit")
      .map((match) => match.id),
    brokenPatternIds: matches
      .filter((match) => match.strength === "broken")
      .map((match) => match.id),
    enhancedPatternIds: matches
      .filter((match) => match.strength === "enhanced")
      .map((match) => match.id)
  }

  assertEqual(
    expected,
    "patternTotalCount",
    statistics.totalCount,
    golden.expectedPatternTotalCount
  )
  assertJsonEqual(
    expected,
    "categoryTotals",
    categoryTotals,
    golden.expectedCategoryTotals
  )
  assertJsonEqual(expected, "lifePalace", actual.lifePalace, expected.lifePalace)
  assertJsonEqual(expected, "bodyPalace", actual.bodyPalace, expected.bodyPalace)
  assertJsonEqual(expected, "totals", actual.totals, expected.totals)
  assertJsonEqual(
    expected,
    "categoryHitCounts",
    actual.categoryHitCounts,
    expected.categoryHitCounts
  )
  assertJsonEqual(
    expected,
    "hitPatternIds",
    actual.hitPatternIds,
    expected.hitPatternIds
  )
  assertJsonEqual(
    expected,
    "brokenPatternIds",
    actual.brokenPatternIds,
    expected.brokenPatternIds
  )
  assertJsonEqual(
    expected,
    "enhancedPatternIds",
    actual.enhancedPatternIds,
    expected.enhancedPatternIds
  )
}

console.log(
  `[check-pattern-golden-samples] ok (${golden.samples.length} sample(s))`
)

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
