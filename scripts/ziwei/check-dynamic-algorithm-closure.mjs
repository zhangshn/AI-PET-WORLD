import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

function read(path) {
  return readFileSync(path, "utf8")
}

function assertIncludes(content, markers, label) {
  const missing = markers.filter((marker) => !content.includes(marker))
  if (missing.length > 0) {
    throw new Error(`${label} missing markers: ${missing.join(", ")}`)
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe"
  })

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`
    )
  }
}

const report = read("docs/ziwei/DYNAMIC_ALGORITHM_CLOSURE_REPORT.md")
assertIncludes(
  report,
  [
    "P18-130",
    "P18-131",
    "P18-132",
    "P18-133",
    "P18-134",
    "P18-135",
    "P18-137",
    "P18-138",
    "P18-139",
    "dynamic-flow-palaces.ts",
    "dynamic-flow-stems.ts",
    "dynamic-flow-stars.ts",
    "dynamic-annual-cycle-stars.ts",
    "check-dynamic-boundary-samples.mjs",
    "check-dynamic-page-data-consistency.mjs",
    "DYNAMIC_PHASE_FINAL_CLOSURE_REPORT.md",
    "check-dynamic-phase-final-closure.mjs",
    "flowingStars",
    "annualCycleStars",
    "currentMonthStem",
    "currentDayStem",
    "currentTimeStem",
    "行为映射暂不做"
  ],
  "dynamic algorithm closure report"
)

const executionTable = read("docs/ziwei/EXECUTION_TABLE.md")
assertIncludes(
  executionTable,
  [
    "| 136 | P18 | 动态盘算法闭合报告 |",
    "| 137 | P18 | 动态盘边界样例校准 |",
    "| 138 | P18 | 动态盘页面数据一致性复核 |",
    "| 139 | P18 | 动态盘阶段最终闭合检查 |",
    "DYNAMIC_ALGORITHM_CLOSURE_REPORT.md",
    "check-dynamic-algorithm-closure.mjs",
    "check-dynamic-boundary-samples.mjs",
    "check-dynamic-page-data-consistency.mjs",
    "check-dynamic-phase-final-closure.mjs"
  ],
  "execution table"
)

const pageStructure = read("docs/ziwei/PAGE_ACCEPTANCE.md")
assertIncludes(
  pageStructure,
  [
    "动态盘算法闭合报告",
    "动态盘边界样例校准",
    "动态盘页面数据一致性复核",
    "动态盘阶段最终闭合检查",
    "DYNAMIC_ALGORITHM_CLOSURE_REPORT.md",
    "check-dynamic-algorithm-closure.mjs",
    "check-dynamic-boundary-samples.mjs",
    "check-dynamic-page-data-consistency.mjs",
    "check-dynamic-phase-final-closure.mjs"
  ],
  "page structure"
)

const readme = read("docs/ziwei/README.md")
assertIncludes(
  readme,
  [
    "DYNAMIC_ALGORITHM_CLOSURE_REPORT.md",
    "动态盘算法闭合报告",
    "DYNAMIC_PHASE_FINAL_CLOSURE_REPORT.md",
    "动态盘阶段最终闭合报告"
  ],
  "ziwei readme"
)

assertIncludes(
  read("src/ai/destiny-core/ziwei-core/dynamic-chart/dynamic-flow-palaces.ts"),
  ["getDouJunPalace", "getXiaoXianPalace", "getDaYunPalace"],
  "dynamic-flow-palaces"
)

assertIncludes(
  read("src/ai/destiny-core/ziwei-core/dynamic-chart/dynamic-flow-stems.ts"),
  ["getLiuYueStem", "getLiuRiStem", "getLiuShiStem", "findSolarByBaziLunarDate", "includeLeapMonth: false"],
  "dynamic-flow-stems"
)

assertIncludes(
  read("src/ai/destiny-core/ziwei-core/dynamic-chart/dynamic-flow-stars.ts"),
  ["getLucunBranch", "getTianmaBranch", "getKuiYueBranches"],
  "dynamic-flow-stars"
)

assertIncludes(
  read("src/ai/destiny-core/ziwei-core/dynamic-chart/dynamic-annual-cycle-stars.ts"),
  ["BOSHI_SEQUENCE", "SUIQIAN_SEQUENCE", "JIANGQIAN_SEQUENCE", "flowType !== \"liuNian\""],
  "dynamic-annual-cycle-stars"
)

assertIncludes(
  read("src/ai/destiny-core/ziwei-core/contracts/dynamic-chart-contract.ts"),
  ["flowingStars", "annualCycleStars", "currentMonthStem", "currentDayStem", "currentTimeStem"],
  "dynamic chart contract"
)

run("node", ["scripts/ziwei/check-dynamic-chart.mjs"])
run("node", ["scripts/ziwei/check-dynamic-boundary-samples.mjs"])
run("node", ["scripts/ziwei/check-dynamic-page-data-consistency.mjs"])
run("node", ["scripts/ziwei/check-dynamic-detailed-analysis.mjs"])
run("node", ["scripts/ziwei/check-dynamic-flow-closure.mjs"])

console.log("dynamic algorithm closure ok")
