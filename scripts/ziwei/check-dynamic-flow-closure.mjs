import fs from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..", "..")

const files = {
  closureReport: path.join(root, "docs", "ziwei", "DYNAMIC_FLOW_CLOSURE_REPORT.md"),
  pageStructure: path.join(root, "docs", "ziwei", "PAGE_ACCEPTANCE.md"),
  directoryStructure: path.join(root, "docs", "ziwei", "DIRECTORY_STRUCTURE.md"),
  executionTable: path.join(root, "docs", "ziwei", "EXECUTION_TABLE.md"),
  ziweiReadme: path.join(root, "docs", "ziwei", "README.md"),
  moduleRegistry: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-module-registry.ts"
  ),
  dynamicImpact: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-dynamic-flow-impact.ts"
  ),
  dynamicPriority: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-dynamic-flow-priority.ts"
  )
}

const checks = [
  ["node", ["scripts/ziwei/check-flow-time-selector.mjs"]],
  ["node", ["scripts/ziwei/check-flow-time-palace-sync.mjs"]],
  ["node", ["scripts/ziwei/check-dynamic-flow-focus-panel.mjs"]],
  ["node", ["scripts/ziwei/check-dynamic-flow-matrix-panel.mjs"]],
  ["node", ["scripts/ziwei/check-dynamic-flow-impact-panel.mjs"]],
  ["node", ["scripts/ziwei/check-dynamic-flow-priority-panel.mjs"]],
  ["node", ["scripts/ziwei/check-dynamic-flow-overview-panel.mjs"]],
  ["node", ["scripts/ziwei/check-dynamic-pattern-scope.mjs"]],
  ["node", ["scripts/ziwei/check-module-navigation.mjs"]],
  ["node", ["scripts/ziwei/check-page-layout.mjs"]]
]

function fail(message) {
  console.error(`[check-dynamic-flow-closure] ${message}`)
  process.exit(1)
}

const texts = Object.fromEntries(
  Object.entries(files).map(([key, file]) => {
    if (!fs.existsSync(file)) {
      fail(`missing file: ${path.relative(root, file)}`)
    }

    return [key, fs.readFileSync(file, "utf8")]
  })
)

function requireIncludes(text, marker, label) {
  if (!text.includes(marker)) {
    fail(`${label} is missing marker: ${marker}`)
  }
}

for (const [command, args] of checks) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false
  })

  if (result.status !== 0) {
    fail(`command failed: ${command} ${args.join(" ")}`)
  }
}

const closureMarkers = [
  "状态：流动盘页面与分析模块闭合",
  "P17-110",
  "P17-111",
  "P17-112",
  "P17-113",
  "P17-114",
  "P17-115",
  "流动时间点击选择器",
  "当前流动盘焦点",
  "流动盘总览矩阵",
  "流动盘叠加影响分析",
  "流动盘重点宫位排序",
  "行为映射暂停",
  "不复制外部软件文案",
  "check-dynamic-flow-closure.mjs"
]

for (const marker of closureMarkers) {
  requireIncludes(texts.closureReport, marker, "DYNAMIC_FLOW_CLOSURE_REPORT.md")
}

const pageMarkers = [
  "流动时间点击选择器",
  "当前流动盘焦点",
  "流动盘总览矩阵",
  "流动盘叠加影响",
  "流动盘重点宫位排序",
  "DYNAMIC_FLOW_CLOSURE_REPORT.md",
  "check-dynamic-flow-closure.mjs"
]

for (const marker of pageMarkers) {
  requireIncludes(texts.pageStructure, marker, "PAGE_ACCEPTANCE.md")
}

const directoryMarkers = [
  "DYNAMIC_FLOW_CLOSURE_REPORT.md",
  "dynamic-flow-focus-panel.tsx",
  "dynamic-flow-matrix-panel.tsx",
  "dynamic-flow-impact-panel.tsx",
  "dynamic-flow-priority-panel.tsx",
  "ziwei-dynamic-flow-impact.ts",
  "ziwei-dynamic-flow-priority.ts",
  "check-dynamic-flow-closure.mjs"
]

for (const marker of directoryMarkers) {
  requireIncludes(texts.directoryStructure, marker, "DIRECTORY_STRUCTURE.md")
}

const executionMarkers = [
  "| 110 | P17 | 流动时间点击选择器",
  "| 111 | P17 | 流动时间盘下移与宫格紧缩",
  "| 112 | P17 | 当前流动盘焦点模块",
  "| 113 | P17 | 流动盘总览矩阵",
  "| 114 | P17 | 流动盘叠加影响分析",
  "| 115 | P17 | 流动盘重点宫位排序",
  "| 116 | P17 | 流动盘闭合报告",
  "check-dynamic-flow-closure.mjs",
  "已完成"
]

for (const marker of executionMarkers) {
  requireIncludes(texts.executionTable, marker, "EXECUTION_TABLE.md")
}

const readmeMarkers = [
  "DYNAMIC_FLOW_CLOSURE_REPORT.md",
  "流动盘闭合报告"
]

for (const marker of readmeMarkers) {
  requireIncludes(texts.ziweiReadme, marker, "docs/ziwei/README.md")
}

const moduleMarkers = [
  'id: "dynamic-focus"',
  'id: "dynamic-matrix"',
  'id: "dynamic-impact"',
  'id: "dynamic-priority"',
  'label: "当前流动盘"',
  'label: "流动盘总览矩阵"',
  'label: "流动盘叠加影响"',
  'label: "流动盘重点宫位"'
]

for (const marker of moduleMarkers) {
  requireIncludes(texts.moduleRegistry, marker, "ziwei-module-registry.ts")
}

const impactMarkers = [
  "buildDynamicFlowImpactSummary",
  "samePalaceOverlayCount",
  "jiPressureCount",
  "selectedBranchImpactCount"
]

for (const marker of impactMarkers) {
  requireIncludes(texts.dynamicImpact, marker, "ziwei-dynamic-flow-impact.ts")
}

const priorityMarkers = [
  "buildDynamicFlowPrioritySummary",
  "landingFlowLabels",
  "jiPressureLabels",
  "topRows: rows.slice(0, 5)"
]

for (const marker of priorityMarkers) {
  requireIncludes(texts.dynamicPriority, marker, "ziwei-dynamic-flow-priority.ts")
}

console.log("[check-dynamic-flow-closure] ok")
