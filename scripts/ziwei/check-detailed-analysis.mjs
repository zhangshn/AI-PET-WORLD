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
  buildZiweiChartInterpretation
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")
const {
  buildFullZiweiChart
} = require("../../src/ai/destiny-core/ziwei-core/public-api/build-full-ziwei-chart.ts")

function fail(message) {
  console.error(`[check-detailed-analysis] ${message}`)
  process.exit(1)
}

const chart = buildFullZiweiChart({
  calendarType: "solar",
  year: 1990,
  month: 5,
  day: 17,
  hour: 9,
  gender: "male",
  timezone: "Asia/Shanghai"
})
const interpretation = buildZiweiChartInterpretation({ chart })
const analysis = interpretation.detailedAnalysis

if (!analysis) {
  fail("missing detailedAnalysis")
}

if (analysis.palaceAnalyses.length !== 12) {
  fail(`expected 12 palace analyses, got ${analysis.palaceAnalyses.length}`)
}

if (analysis.overviewLines.length < 3) {
  fail("expected overview lines")
}

if (analysis.lifePalaceLines.length < 2 || analysis.bodyPalaceLines.length < 2) {
  fail("expected life/body palace focus lines")
}

if (analysis.debug.analyzedStarCount < 40) {
  fail(`expected at least 40 analyzed stars, got ${analysis.debug.analyzedStarCount}`)
}

if (analysis.debug.unsupportedStarCount !== 0) {
  fail(`expected no unsupported stars in detailed analysis categories, got ${analysis.debug.unsupportedStarCount}`)
}

const allPalaceLines = analysis.palaceAnalyses.flatMap((palace) => {
  return [
    ...palace.mainAxisLines,
    ...palace.supportLines,
    ...palace.pressureLines,
    ...palace.dynamicLines,
    ...palace.detailLines,
    ...palace.brightnessLines
  ]
})

if (!analysis.palaceAnalyses.some((palace) => palace.mainAxisLines.length > 0)) {
  fail("expected at least one palace with main axis lines")
}

if (!analysis.palaceAnalyses.some((palace) => palace.pressureLines.length > 0)) {
  fail("expected at least one palace with pressure lines")
}

if (!analysis.palaceAnalyses.some((palace) => palace.dynamicLines.length > 0)) {
  fail("expected at least one palace with dynamic transformation lines")
}

if (!analysis.palaceAnalyses.some((palace) => palace.brightnessLines.length > 0)) {
  fail("expected brightness analysis lines")
}

if (
  analysis.palaceAnalyses.some((palace) => {
    return palace.palaceThemeLines.length < 2
  })
) {
  fail("expected every palace to include palace theme lines")
}

if (
  analysis.palaceAnalyses.some((palace) => {
    return palace.categorySummaryLines.length < 5
  })
) {
  fail("expected every palace to include category summary lines")
}

if (
  analysis.palaceAnalyses.some((palace) => {
    return palace.reviewGapLines.length < 5
  })
) {
  fail("expected every palace to include review gap lines")
}

if (
  analysis.palaceAnalyses.some((palace) => {
    return palace.relationAnalyses.length < 6
  })
) {
  fail("expected every palace to include self, opposite, trine and adjacent relation analyses")
}

if (
  analysis.palaceAnalyses.some((palace) => {
    return palace.relationLines.length < 6
  })
) {
  fail("expected every palace to include detailed relation lines")
}

if (!analysis.palaceAnalyses.every((palace) => {
  const relationKinds = new Set(palace.relationAnalyses.map((relation) => relation.kind))

  return (
    relationKinds.has("self") &&
    relationKinds.has("opposite") &&
    relationKinds.has("trine") &&
    relationKinds.has("adjacent")
  )
})) {
  fail("expected each palace relation analysis to include self/opposite/trine/adjacent kinds")
}

if (!analysis.palaceAnalyses.some((palace) => {
  return palace.reviewGapLines.some((line) => line.includes("主星缺口"))
})) {
  fail("expected detailed analysis to expose no-main-star review gaps")
}

if (!allPalaceLines.some((line) => line.includes("化忌") || line.includes("压力"))) {
  fail("expected detailed analysis to mention pressure or hua ji")
}

console.log(
  `[check-detailed-analysis] ok (${analysis.debug.analyzedStarCount} analyzed star(s))`
)
