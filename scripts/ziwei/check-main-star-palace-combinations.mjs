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
  getAllMainStarPalaceCombinationContentDetails,
  getMainStarPalaceCombinationContentDetail
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")
const {
  MAIN_STAR_IDS
} = require("../../src/ai/destiny-core/ziwei-core/star-catalog/index.ts")

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

function fail(message) {
  console.error(`[check-main-star-palace-combinations] ${message}`)
  process.exit(1)
}

const starIds = Object.values(MAIN_STAR_IDS)
const details = getAllMainStarPalaceCombinationContentDetails()
const expectedCount = starIds.length * REQUIRED_PALACES.length

if (details.length !== expectedCount) {
  fail(`expected ${expectedCount} main star palace combinations, got ${details.length}`)
}

for (const starId of starIds) {
  for (const sectorName of REQUIRED_PALACES) {
    const detail = getMainStarPalaceCombinationContentDetail(starId, sectorName)

    if (!detail) {
      fail(`missing combination: ${starId} ${sectorName}`)
    }

    assertString(detail.combinationId, detail.coreReading, "coreReading", 80)
    assertString(detail.combinationId, detail.starLabel, "starLabel", 2)
    assertString(detail.combinationId, detail.palaceLabel, "palaceLabel", 2)
    assertList(detail.combinationId, detail.analysisFocus, "analysisFocus", 4)
    assertList(detail.combinationId, detail.favorableSignals, "favorableSignals", 4)
    assertList(detail.combinationId, detail.riskSignals, "riskSignals", 4)
    assertList(detail.combinationId, detail.relationUsage, "relationUsage", 2)
    assertList(detail.combinationId, detail.dynamicUsage, "dynamicUsage", 2)
    assertList(detail.combinationId, detail.cautions, "cautions", 4)
    assertList(detail.combinationId, detail.sections, "sections", 12)
    assertSectionTitles(detail.combinationId, detail.sections, [
      "组合本体",
      "落宫转换",
      "同宫与对宫",
      "三方四正",
      "四化与庙旺",
      "动态盘层级",
      "当前盘证据",
      "误读边界"
    ])
  }
}

console.log("[check-main-star-palace-combinations] ok")

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
