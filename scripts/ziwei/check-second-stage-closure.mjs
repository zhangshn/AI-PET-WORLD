import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..", "..")

const files = {
  closureReport: path.join(
    root,
    "docs",
    "ziwei",
    "SECOND_STAGE_CLOSURE_REPORT.md"
  ),
  pageStructure: path.join(root, "docs", "ziwei", "PAGE_ACCEPTANCE.md"),
  directoryStructure: path.join(root, "docs", "ziwei", "DIRECTORY_STRUCTURE.md"),
  executionTable: path.join(root, "docs", "ziwei", "EXECUTION_TABLE.md"),
  ziweiReadme: path.join(root, "docs", "ziwei", "README.md"),
  patternCatalog: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-catalog.ts"
  ),
  patternGolden: path.join(
    root,
    "data",
    "ziwei",
    "pattern-golden-samples",
    "pattern-golden-v1.json"
  ),
  patternGoldenCheck: path.join(
    root,
    "scripts",
    "ziwei",
    "check-pattern-golden-samples.mjs"
  ),
  expansionCheck: path.join(
    root,
    "scripts",
    "ziwei",
    "check-pattern-expansion-consistency.mjs"
  )
}

function fail(message) {
  console.error(`[check-second-stage-closure] ${message}`)
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

const closureMarkers = [
  "状态：第二阶段闭合",
  "格局目录扩库到 195 条",
  "扩库批次一",
  "扩库批次二",
  "扩库批次三",
  "扩库批次四",
  "扩库批次五",
  "格局黄金样例第一批",
  "check-second-stage-closure.mjs",
  "check-pattern-golden-samples.mjs",
  "check-pattern-expansion-consistency.mjs",
  "Invoke-WebRequest -Uri http://localhost:3000/ziwei",
  "外部参考只能用于人工校准方向"
]

for (const marker of closureMarkers) {
  requireIncludes(texts.closureReport, marker, "SECOND_STAGE_CLOSURE_REPORT.md")
}

const pageMarkers = [
  "pattern-golden-v1.json",
  "check-pattern-golden-samples.mjs",
  "check-second-stage-closure.mjs",
  "第二阶段闭合报告"
]

for (const marker of pageMarkers) {
  requireIncludes(texts.pageStructure, marker, "PAGE_ACCEPTANCE.md")
}

const directoryMarkers = [
  "SECOND_STAGE_CLOSURE_REPORT.md",
  "pattern-golden-samples",
  "check-pattern-golden-samples.mjs",
  "check-second-stage-closure.mjs"
]

for (const marker of directoryMarkers) {
  requireIncludes(texts.directoryStructure, marker, "DIRECTORY_STRUCTURE.md")
}

const executionMarkers = [
  "| 94 | P14 | 第二阶段闭合报告",
  "SECOND_STAGE_CLOSURE_REPORT.md",
  "check-second-stage-closure.mjs",
  "已完成"
]

for (const marker of executionMarkers) {
  requireIncludes(texts.executionTable, marker, "EXECUTION_TABLE.md")
}

const readmeMarkers = [
  "SECOND_STAGE_CLOSURE_REPORT.md",
  "第二阶段闭合报告"
]

for (const marker of readmeMarkers) {
  requireIncludes(texts.ziweiReadme, marker, "docs/ziwei/README.md")
}

const catalogMarkers = [
  "SIX_AUSPICIOUS_STAR_IDS",
  "ROMANCE_STAR_IDS",
  "SOLITARY_STAR_IDS",
  "TRANSFORMATION_STAR_IDS",
  "AUSPICIOUS_TRANSFORMATION_STAR_IDS",
  "ZIWEI_PATTERN_DEFINITIONS"
]

for (const marker of catalogMarkers) {
  requireIncludes(texts.patternCatalog, marker, "ziwei-pattern-catalog.ts")
}

const goldenMarkers = [
  '"schemaVersion": "ziwei-pattern-golden-v1"',
  '"expectedPatternTotalCount": 195',
  '"1990-male-solar"',
  '"1995-female-not-started"',
  '"pattern.misc.tai-fu-feng-gao-life"',
  '"pattern.adverse.gu-chen-gua-su-life-scope"'
]

for (const marker of goldenMarkers) {
  requireIncludes(texts.patternGolden, marker, "pattern-golden-v1.json")
}

const checkMarkers = [
  "buildZiweiPatternMatches",
  "buildZiweiPatternStatistics",
  "expectedPatternTotalCount",
  "hitPatternIds",
  "brokenPatternIds",
  "enhancedPatternIds"
]

for (const marker of checkMarkers) {
  requireIncludes(texts.patternGoldenCheck, marker, "check-pattern-golden-samples.mjs")
}

const expansionMarkers = [
  "pattern.adverse.three-transformations-with-ji-life",
  "不能用“至少 N 项”冒充必含化忌条件",
  "| 92 | P14 | 格局扩库一致性二次校准"
]

for (const marker of expansionMarkers) {
  requireIncludes(texts.expansionCheck, marker, "check-pattern-expansion-consistency.mjs")
}

console.log("[check-second-stage-closure] ok")
