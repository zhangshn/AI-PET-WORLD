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
  getAllPeriodicStarContentDetails,
  getAllPeriodicStarPalaceCombinationContentDetails,
  getPeriodicStarPalaceCombinationContentDetail
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_PALACES = [
  "life",
  "siblings",
  "spouse",
  "children",
  "wealth",
  "health",
  "travel",
  "friends",
  "career",
  "property",
  "fortune",
  "parents"
]

const REQUIRED_SECTION_TITLES = [
  "组合本体",
  "时间层级",
  "落宫转换",
  "分析重点",
  "助力信号",
  "压力信号",
  "同宫与对宫",
  "三方四正",
  "四化与庙旺",
  "宫位关系",
  "动态盘层级",
  "当前盘证据",
  "误读边界"
]

function fail(message) {
  console.error(`[check-periodic-star-palace-combinations] ${message}`)
  process.exit(1)
}

const stars = getAllPeriodicStarContentDetails()
const details = getAllPeriodicStarPalaceCombinationContentDetails()
const expectedCount = stars.length * REQUIRED_PALACES.length

if (details.length !== expectedCount) {
  fail(`expected ${expectedCount} periodic star palace combinations, got ${details.length}`)
}

for (const star of stars) {
  for (const sectorName of REQUIRED_PALACES) {
    const detail = getPeriodicStarPalaceCombinationContentDetail(star.starId, sectorName)

    if (!detail) {
      fail(`missing combination: ${star.starId} ${sectorName}`)
    }

    assertString(detail.combinationId, detail.coreReading, "coreReading", 120)
    assertString(detail.combinationId, detail.groupRole, "groupRole", 20)
    assertString(detail.combinationId, detail.starLabel, "starLabel", 1)
    assertString(detail.combinationId, detail.palaceLabel, "palaceLabel", 2)
    assertList(detail.combinationId, detail.timingUsage, "timingUsage", 4)
    assertList(detail.combinationId, detail.analysisFocus, "analysisFocus", 7)
    assertList(detail.combinationId, detail.supportiveSignals, "supportiveSignals", 4)
    assertList(detail.combinationId, detail.pressureSignals, "pressureSignals", 3)
    assertList(detail.combinationId, detail.relationUsage, "relationUsage", 5)
    assertList(detail.combinationId, detail.dynamicUsage, "dynamicUsage", 5)
    assertList(detail.combinationId, detail.evidenceFields, "evidenceFields", 10)
    assertList(detail.combinationId, detail.cautions, "cautions", 7)
    assertList(detail.combinationId, detail.sections, "sections", 13)
    assertSectionTitles(detail.combinationId, detail.sections, REQUIRED_SECTION_TITLES)
  }
}

const groupCounts = details.reduce((counts, detail) => {
  counts.set(detail.group, (counts.get(detail.group) ?? 0) + 1)
  return counts
}, new Map())

assertGroupCount(groupCounts, "lifecycle", 144)
assertGroupCount(groupCounts, "boshi", 144)
assertGroupCount(groupCounts, "suiqian", 144)
assertGroupCount(groupCounts, "jiangqian", 144)
assertGroupCount(groupCounts, "monthly", 48)
assertGroupCount(groupCounts, "dailyHourly", 48)

console.log("[check-periodic-star-palace-combinations] ok")

function assertString(id, value, field, minLength) {
  if (typeof value !== "string" || value.length < minLength) {
    fail(`${id}: ${field} is too short`)
  }
}

function assertList(id, value, field, minLength) {
  if (!Array.isArray(value) || value.length < minLength) {
    fail(`${id}: ${field} needs at least ${minLength} item(s)`)
  }
}

function assertSectionTitles(id, sections, expectedTitles) {
  const availableTitles = new Set(sections.map((section) => section.title))

  for (const title of expectedTitles) {
    if (!availableTitles.has(title)) {
      fail(`${id}: missing section title ${title}`)
    }
  }
}

function assertGroupCount(groupCounts, group, expectedCount) {
  const actualCount = groupCounts.get(group) ?? 0

  if (actualCount !== expectedCount) {
    fail(`expected ${expectedCount} ${group} combinations, got ${actualCount}`)
  }
}
