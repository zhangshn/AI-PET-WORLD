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
  getAllStarPairCombinationContentDetails,
  getStarPairCombinationContentDetail
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const { MAIN_STAR_IDS, ASSISTANT_STAR_IDS, MALEFIC_STAR_IDS, MISC_STAR_IDS } =
  require("../../src/ai/destiny-core/ziwei-core/star-catalog/index.ts")

const REQUIRED_SECTION_TITLES = [
  "组合本体",
  "主次与分工",
  "读盘顺序",
  "同宫解释",
  "对宫解释",
  "三方四正",
  "夹宫与会照",
  "四化牵动",
  "庙旺落陷",
  "动态盘层级",
  "助力信号",
  "压力信号",
  "宫位关系",
  "当前盘证据",
  "误读边界"
]

const REQUIRED_GROUP_COUNTS = new Map([
  ["main-main", 91],
  ["main-assistant", 112],
  ["main-malefic", 84],
  ["main-misc", 210],
  ["assistant-assistant", 28],
  ["assistant-malefic", 48],
  ["assistant-misc", 120],
  ["malefic-malefic", 15],
  ["malefic-misc", 90],
  ["misc-misc", 105]
])

const SAMPLE_PAIRS = [
  [MAIN_STAR_IDS.ziwei, MAIN_STAR_IDS.qisha],
  [MAIN_STAR_IDS.lianzhen, MAIN_STAR_IDS.tanlang],
  [ASSISTANT_STAR_IDS.wenchang, ASSISTANT_STAR_IDS.wenqu],
  [MALEFIC_STAR_IDS.qingyang, MALEFIC_STAR_IDS.tuoluo],
  [MISC_STAR_IDS.hongluan, MISC_STAR_IDS.tianxi]
]

function fail(message) {
  console.error(`[check-star-pair-combinations] ${message}`)
  process.exit(1)
}

const details = getAllStarPairCombinationContentDetails()

if (details.length !== 903) {
  fail(`expected 903 star pair combinations, got ${details.length}`)
}

for (const detail of details) {
  assertString(detail.combinationId, detail.coreReading, "coreReading", 120)
  assertString(detail.combinationId, detail.groupRole, "groupRole", 20)
  assertString(detail.combinationId, detail.interactionMode, "interactionMode", 80)
  assertList(detail.combinationId, detail.readingOrder, "readingOrder", 6)
  assertList(detail.combinationId, detail.supportiveSignals, "supportiveSignals", 5)
  assertList(detail.combinationId, detail.pressureSignals, "pressureSignals", 5)
  assertList(detail.combinationId, detail.palaceRelationUsage, "palaceRelationUsage", 8)
  assertList(detail.combinationId, detail.dynamicUsage, "dynamicUsage", 7)
  assertList(detail.combinationId, detail.evidenceFields, "evidenceFields", 20)
  assertList(detail.combinationId, detail.cautions, "cautions", 8)
  assertList(detail.combinationId, detail.sections, "sections", 15)
  assertSectionTitles(detail.combinationId, detail.sections, REQUIRED_SECTION_TITLES)
}

const groupCounts = details.reduce((counts, detail) => {
  counts.set(detail.group, (counts.get(detail.group) ?? 0) + 1)
  return counts
}, new Map())

for (const [group, expectedCount] of REQUIRED_GROUP_COUNTS) {
  const actualCount = groupCounts.get(group) ?? 0

  if (actualCount !== expectedCount) {
    fail(`expected ${expectedCount} ${group} combinations, got ${actualCount}`)
  }
}

for (const [starAId, starBId] of SAMPLE_PAIRS) {
  const detail = getStarPairCombinationContentDetail(starAId, starBId)

  if (!detail) {
    fail(`missing sample pair ${starAId} ${starBId}`)
  }

  assertSectionTitles(detail.combinationId, detail.sections, REQUIRED_SECTION_TITLES)
}

console.log("[check-star-pair-combinations] ok")

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
