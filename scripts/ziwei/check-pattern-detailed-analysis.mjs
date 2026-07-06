import { readFileSync } from "node:fs"
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
  buildZiweiPageViewModel
} = require("../../src/ai/destiny-core/ziwei-core/public-api")
const {
  buildZiweiPatternMatches
} = require("../../src/app/ziwei/_lib/ziwei-pattern-catalog.ts")
const {
  buildZiweiPatternDetailedAnalyses
} = require("../../src/app/ziwei/_lib/ziwei-pattern-detailed-analysis.ts")

function fail(message) {
  console.error(`[check-pattern-detailed-analysis] ${message}`)
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
const viewModel = buildZiweiPageViewModel({
  chart
})
const matches = buildZiweiPatternMatches(viewModel.palaceDetails)
const analyses = buildZiweiPatternDetailedAnalyses(matches)

if (matches.length !== 195) {
  fail(`expected 195 pattern matches, got ${matches.length}`)
}

if (analyses.length !== matches.length) {
  fail("expected one detailed analysis per pattern match")
}

if (
  analyses.some((analysis) => {
    return (
      !analysis.patternId ||
      !analysis.label ||
      !analysis.statusLine ||
      analysis.structureLines.length < 3 ||
      analysis.effectLines.length < 2 ||
      analysis.breakLines.length < 1 ||
      analysis.reviewLines.length < 2
    )
  })
) {
  fail("expected every pattern analysis to include status, structure, effect, break and review lines")
}

if (!analyses.some((analysis) => analysis.statusLine.includes("已命中"))) {
  fail("expected at least one hit pattern analysis")
}

if (!analyses.some((analysis) => analysis.statusLine.includes("未成格"))) {
  fail("expected at least one miss pattern analysis")
}

if (!analyses.some((analysis) => analysis.tone === "adverse")) {
  fail("expected adverse pattern details")
}

if (
  !analyses.some((analysis) => {
    return analysis.breakLines.some((line) => line.includes("不良结构复核"))
  })
) {
  fail("expected adverse or malefic pattern review lines")
}

const brokenMatchIds = new Set(
  matches
    .filter((match) => match.strength === "broken")
    .map((match) => match.id)
)

if (
  brokenMatchIds.size > 0 &&
  !analyses.some((analysis) => {
    return (
      brokenMatchIds.has(analysis.patternId) &&
      analysis.breakLines.some((line) => line.includes("破格依据"))
    )
  })
) {
  fail("expected broken pattern analysis to expose break evidence")
}

if (
  !analyses.every((analysis) => {
    return analysis.reviewLines.some((line) => line.includes("来源规则"))
  })
) {
  fail("expected every pattern analysis to include source rule line")
}

console.log(`[check-pattern-detailed-analysis] ok (${analyses.length} pattern analysis item(s))`)
