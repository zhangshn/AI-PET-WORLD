import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"

const root = process.cwd()

const files = {
  finalReport: path.join(root, "docs/ziwei/DYNAMIC_PHASE_FINAL_CLOSURE_REPORT.md"),
  algorithmReport: path.join(root, "docs/ziwei/DYNAMIC_ALGORITHM_CLOSURE_REPORT.md"),
  flowReport: path.join(root, "docs/ziwei/DYNAMIC_FLOW_CLOSURE_REPORT.md"),
  readme: path.join(root, "docs/ziwei/README.md"),
  pageStructure: path.join(root, "docs/ziwei/PAGE_ACCEPTANCE.md"),
  executionTable: path.join(root, "docs/ziwei/EXECUTION_TABLE.md"),
  finalCheck: path.join(root, "scripts/ziwei/check-dynamic-phase-final-closure.mjs"),
  algorithmCheck: path.join(root, "scripts/ziwei/check-dynamic-algorithm-closure.mjs"),
  boundaryCheck: path.join(root, "scripts/ziwei/check-dynamic-boundary-samples.mjs"),
  pageConsistencyCheck: path.join(root, "scripts/ziwei/check-dynamic-page-data-consistency.mjs"),
  chartGrid: path.join(root, "src/app/ziwei/_components/ziwei-chart-grid.tsx"),
  dynamicFlowStems: path.join(
    root,
    "src/ai/destiny-core/ziwei-core/dynamic-chart/dynamic-flow-stems.ts"
  )
}

function fail(message) {
  console.error(`[check-dynamic-phase-final-closure] ${message}`)
  process.exit(1)
}

function read(file) {
  if (!existsSync(file)) {
    fail(`missing file: ${path.relative(root, file)}`)
  }

  return readFileSync(file, "utf8")
}

function requireIncludes(text, markers, label) {
  const missing = markers.filter((marker) => !text.includes(marker))

  if (missing.length > 0) {
    fail(`${label} missing markers: ${missing.join(", ")}`)
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe"
  })

  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`)
  }
}

const texts = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, read(file)])
)

requireIncludes(
  texts.finalReport,
  [
    "P18-130",
    "P18-131",
    "P18-132",
    "P18-133",
    "P18-134",
    "P18-135",
    "P18-136",
    "P18-137",
    "P18-138",
    "P18-139",
    "dynamic-flow-palaces.ts",
    "dynamic-flow-stems.ts",
    "dynamic-flow-stars.ts",
    "dynamic-annual-cycle-stars.ts",
    "check-dynamic-phase-final-closure.mjs",
    "行为映射仍不做"
  ],
  "DYNAMIC_PHASE_FINAL_CLOSURE_REPORT.md"
)

requireIncludes(
  texts.algorithmReport,
  ["P18-139", "DYNAMIC_PHASE_FINAL_CLOSURE_REPORT.md", "check-dynamic-phase-final-closure.mjs"],
  "DYNAMIC_ALGORITHM_CLOSURE_REPORT.md"
)

requireIncludes(
  texts.readme,
  ["DYNAMIC_PHASE_FINAL_CLOSURE_REPORT.md", "动态盘阶段最终闭合报告"],
  "README.md"
)

requireIncludes(
  texts.pageStructure,
  ["动态盘阶段最终闭合检查", "DYNAMIC_PHASE_FINAL_CLOSURE_REPORT.md", "check-dynamic-phase-final-closure.mjs"],
  "PAGE_ACCEPTANCE.md"
)

requireIncludes(
  texts.executionTable,
  ["| 139 | P18 | 动态盘阶段最终闭合检查 |", "DYNAMIC_PHASE_FINAL_CLOSURE_REPORT.md", "check-dynamic-phase-final-closure.mjs"],
  "EXECUTION_TABLE.md"
)

requireIncludes(
  texts.chartGrid,
  [
    "buildSelectedDynamicStarsByBranch",
    "selectedDynamicStars = params.flows.flatMap",
    "...flow.flowingStars",
    "...flow.annualCycleStars",
    "sourceFlowType: flow.type"
  ],
  "ziwei-chart-grid.tsx"
)

requireIncludes(
  texts.dynamicFlowStems,
  ["findSolarByBaziLunarDate", "includeLeapMonth: false"],
  "dynamic-flow-stems.ts"
)

const checks = [
  ["node", ["scripts/ziwei/check-dynamic-chart.mjs"]],
  ["node", ["scripts/ziwei/check-dynamic-boundary-samples.mjs"]],
  ["node", ["scripts/ziwei/check-dynamic-page-data-consistency.mjs"]],
  ["node", ["scripts/ziwei/check-dynamic-detailed-analysis.mjs"]],
  ["node", ["scripts/ziwei/check-dynamic-flow-closure.mjs"]],
  ["node", ["scripts/ziwei/check-dynamic-algorithm-closure.mjs"]],
  ["node", ["scripts/ziwei/inspect-full-chart.mjs"]],
  ["node", ["scripts/check-source-encoding.mjs"]]
]

for (const [command, args] of checks) {
  run(command, args)
}

console.log("[check-dynamic-phase-final-closure] ok")
