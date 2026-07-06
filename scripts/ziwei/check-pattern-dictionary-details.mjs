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
  buildZiweiPatternContentDictionaryDetail
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")
const {
  ZIWEI_PATTERN_DEFINITIONS
} = require("../../src/app/ziwei/_lib/ziwei-pattern-catalog.ts")

const REQUIRED_SECTION_TITLES = [
  "格局本体",
  "核心主题",
  "成格条件",
  "成格逻辑",
  "命中证据",
  "加吉增强",
  "加煞破格",
  "宫位关系",
  "三方四正",
  "四化与庙旺",
  "动态盘层级",
  "当前盘解释边界",
  "复核路径",
  "误读边界"
]

function fail(message) {
  console.error(`[check-pattern-dictionary-details] ${message}`)
  process.exit(1)
}

if (ZIWEI_PATTERN_DEFINITIONS.length !== 195) {
  fail(`expected 195 pattern definitions, got ${ZIWEI_PATTERN_DEFINITIONS.length}`)
}

for (const definition of ZIWEI_PATTERN_DEFINITIONS) {
  const detail = buildZiweiPatternContentDictionaryDetail({
    id: definition.id,
    label: definition.label,
    category: definition.category,
    conditionText: definition.conditionText
  })

  assertList(detail.patternId, detail.identity, "identity", 4)
  assertList(detail.patternId, detail.formationLogic, "formationLogic", 5)
  assertList(detail.patternId, detail.evidenceChecklist, "evidenceChecklist", 8)
  assertList(detail.patternId, detail.strengthChecklist, "strengthChecklist", 8)
  assertList(detail.patternId, detail.breakageChecklist, "breakageChecklist", 8)
  assertList(detail.patternId, detail.interpretationSteps, "interpretationSteps", 7)
  assertList(detail.patternId, detail.cautions, "cautions", 7)
  assertList(detail.patternId, detail.reusableScenes, "reusableScenes", 8)
  assertList(detail.patternId, detail.sections, "sections", 14)
  assertSectionTitles(detail.patternId, detail.sections, REQUIRED_SECTION_TITLES)

  if (!detail.sections.some((section) => {
    return section.items.some((item) => item.includes("未命中"))
  })) {
    fail(`${detail.patternId}: missing unhit display boundary`)
  }

  if (!detail.sections.some((section) => {
    return section.items.some((item) => item.includes("四化") && item.includes("庙旺"))
  })) {
    fail(`${detail.patternId}: missing transformation and brightness boundary`)
  }
}

console.log("[check-pattern-dictionary-details] ok")

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
