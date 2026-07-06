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
  buildFullZiweiChart,
  buildFullZiweiDynamicChart,
  buildZiweiPageViewModel
} = require("../../src/ai/destiny-core/ziwei-core/public-api/index.ts")
const {
  buildZiweiChartInterpretation
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

function fail(message) {
  console.error(`[check-dynamic-detailed-analysis] ${message}`)
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
const dynamicChart = buildFullZiweiDynamicChart({
  chart,
  input: {
    currentAge: 36,
    currentYear: 2026,
    currentLunarMonth: 5,
    currentLunarDay: 13,
    currentTimeBranch: "si"
  }
})
const interpretation = buildZiweiChartInterpretation({
  chart,
  dynamicChart
})
const viewModel = buildZiweiPageViewModel({
  chart,
  dynamicChart
})
const flows = interpretation.detailedAnalysis.dynamicFlowAnalyses

if (flows.length !== 6) {
  fail(`expected 6 dynamic flow analyses, got ${flows.length}`)
}

if (viewModel.interpretation.detailedAnalysis.dynamicFlowAnalyses.length !== 6) {
  fail("expected page view model interpretation to include dynamic flow analyses")
}

if (interpretation.detailedAnalysis.debug.dynamicFlowCount !== 6) {
  fail("expected detailed analysis debug dynamic flow count")
}

if (interpretation.detailedAnalysis.debug.activeDynamicFlowCount < 1) {
  fail("expected at least one active dynamic flow")
}

if (
  flows.some((flow) => {
    return (
      !flow.typeLabel ||
      !flow.branchLabel ||
      !flow.sectorLabel ||
      !flow.stemLabel ||
      !flow.stemSourceLabel ||
      flow.overviewLines.length < 3 ||
      flow.palaceLines.length < 2 ||
      flow.transformationLines.length < 1 ||
      flow.reviewLines.length < 3 ||
      flow.sourceRuleIds.length < 1
    )
  })
) {
  fail("expected every dynamic flow to include labels, lines and source rules")
}

if (
  flows.some((flow) => {
    return flow.transformations.length !== 4
  })
) {
  fail("expected every dynamic flow to include 4 transformation analyses")
}

if (
  !flows.some((flow) => {
    return flow.reviewLines.some((line) => line.includes("化忌复核"))
  })
) {
  fail("expected dynamic flow analysis to include hua ji review")
}

if (
  !flows.every((flow) => {
    return flow.transformations.every((transformation) => {
      return (
        transformation.summaryLines.length >= 2 &&
        transformation.sourceRuleIds.length === 1
      )
    })
  })
) {
  fail("expected every dynamic transformation to include summary and source rule")
}

console.log(`[check-dynamic-detailed-analysis] ok (${flows.length} flow analysis item(s))`)
