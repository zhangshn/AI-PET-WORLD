import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()
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
} = require(path.join(root, "src/ai/destiny-core/ziwei-core/public-api"))

const files = {
  clientPage: path.join(
    root,
    "src/app/ziwei/_components/ziwei-client-page.tsx"
  ),
  chartGrid: path.join(
    root,
    "src/app/ziwei/_components/ziwei-chart-grid.tsx"
  ),
  overviewPanel: path.join(
    root,
    "src/app/ziwei/_components/dynamic-flow-overview-panel.tsx"
  ),
  focusPanel: path.join(
    root,
    "src/app/ziwei/_components/dynamic-flow-focus-panel.tsx"
  ),
  matrixPanel: path.join(
    root,
    "src/app/ziwei/_components/dynamic-flow-matrix-panel.tsx"
  ),
  patternOverview: path.join(
    root,
    "src/app/ziwei/_components/pattern-overview-panel.tsx"
  ),
  pageStructure: path.join(root, "docs/ziwei/PAGE_ACCEPTANCE.md"),
  executionTable: path.join(root, "docs/ziwei/EXECUTION_TABLE.md")
}

function fail(message) {
  console.error(`[check-dynamic-page-data-consistency] ${message}`)
  process.exit(1)
}

function read(file) {
  return readFileSync(file, "utf8")
}

function requireIncludes(text, markers, label) {
  const missing = markers.filter((marker) => !text.includes(marker))

  if (missing.length > 0) {
    fail(`${label} missing markers: ${missing.join(", ")}`)
  }
}

const texts = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, read(file)])
)

requireIncludes(
  texts.clientPage,
  [
    "selectedDynamicFlowDetail",
    "viewModel.dynamicFlowDetails.find",
    "buildCurrentFlowPatternPalaces",
    "selectedFlow: selectedDynamicFlowDetail",
    "matches: buildZiweiPatternMatches(patternPalaces)",
    "dynamicFlows={viewModel.dynamicFlowDetails}",
    "flows={viewModel.dynamicFlowDetails}",
    "flow={selectedDynamicFlowDetail}",
    "palaces={patternPalaces}",
    "scopeLabel={selectedDynamicFlowDetail.label}",
    "setSelectedFlowType(params.selectedFlowTypeAfterRefresh)",
    "response.data.viewModel.dynamicFlowDetails.find"
  ],
  "ziwei-client-page.tsx"
)

if (texts.clientPage.includes("buildZiweiPatternMatches(viewModel.palaceDetails)")) {
  fail("pattern modules must not read natal palace details directly")
}

requireIncludes(
  texts.chartGrid,
  [
    "buildRelationLines",
    "sourceBranch: props.selectedBranch",
    "sourceFlowType: props.selectedFlowType",
    "buildDynamicMarkersByBranch",
    "isZiweiDynamicFlowWithinSelectedDepth",
    "buildSelectedDynamicStarsByBranch",
    "selectedDynamicStars = params.flows.flatMap",
    "...flow.flowingStars",
    "...flow.annualCycleStars",
    "sourceFlowType: flow.type",
    "selectedDynamicStarsByBranch"
  ],
  "ziwei-chart-grid.tsx"
)

requireIncludes(
  texts.overviewPanel,
  ["flow.flowingStars.map", "flow.annualCycleStars.map", "flow.annualCycleStarCount"],
  "dynamic-flow-overview-panel.tsx"
)
requireIncludes(
  texts.focusPanel,
  ["flow.flowingStars.map", "flow.annualCycleStars.map", "flow.annualCycleStarCount"],
  "dynamic-flow-focus-panel.tsx"
)
requireIncludes(
  texts.matrixPanel,
  ["flow.flowingStars.map", "flow.annualCycleStars.map", "flow.annualCycleStarCount"],
  "dynamic-flow-matrix-panel.tsx"
)
requireIncludes(
  texts.patternOverview,
  ["scopeLabel", "formatPatternScopeLabel", "props.scopeLabel"],
  "pattern-overview-panel.tsx"
)
requireIncludes(
  texts.pageStructure,
  ["动态盘页面数据一致性复核", "check-dynamic-page-data-consistency.mjs"],
  "PAGE_ACCEPTANCE.md"
)
requireIncludes(
  texts.executionTable,
  ["| 138 | P18 | 动态盘页面数据一致性复核 |", "check-dynamic-page-data-consistency.mjs"],
  "EXECUTION_TABLE.md"
)

const chart = buildFullZiweiChart({
  name: "dynamic-page-consistency",
  gender: "male",
  calendar: "solar",
  year: 1990,
  month: 5,
  day: 17,
  hour: 9
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
const viewModel = buildZiweiPageViewModel({
  chart,
  dynamicChart
})
const flowsByType = Object.fromEntries(
  viewModel.dynamicFlowDetails.map((flow) => [flow.type, flow])
)
const liuNian = flowsByType.liuNian
const liuYue = flowsByType.liuYue

assertEqual("flow count", viewModel.dynamicFlowDetails.length, 6)
assertEqual("tab count", viewModel.dynamicTabs.length, 6)
assertEqual("liu nian flowing stars", liuNian.flowingStars.length, 6)
assertEqual("liu nian annual cycle stars", liuNian.annualCycleStars.length, 36)
assertEqual("liu nian annual cycle star count", liuNian.annualCycleStarCount, 36)
assertEqual("liu yue annual cycle stars", liuYue.annualCycleStars.length, 0)
assertEqual(
  "liu nian star count",
  liuNian.starCount,
  liuNian.palaceDetail.starGroups.reduce((total, group) => {
    return total + group.stars.length
  }, 0) +
    liuNian.flowingStars.length +
    liuNian.annualCycleStars.length
)

const liuNianDynamicStarBranches = new Set(
  [...liuNian.flowingStars, ...liuNian.annualCycleStars].map((star) => {
    return star.branch
  })
)

if (liuNianDynamicStarBranches.size < 6) {
  fail("liu nian dynamic stars should cover multiple palaces")
}

console.log("[check-dynamic-page-data-consistency] ok")

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    fail(`${label} expected ${expected}, got ${actual}`)
  }
}
