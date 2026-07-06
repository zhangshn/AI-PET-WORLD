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
  getPatternContentDetail
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")
const {
  ZIWEI_PATTERN_DEFINITIONS
} = require("../../src/app/ziwei/_lib/ziwei-pattern-catalog.ts")

function fail(message) {
  console.error(`[check-pattern-content-details] ${message}`)
  process.exit(1)
}

const requiredListFields = [
  "coreThemes",
  "strengths",
  "risks",
  "enhancementSignals",
  "breakSignals",
  "readingNotes"
]
const requiredStringFields = [
  "nature",
  "personalityTendency",
  "worldBehaviorHint"
]
const validTones = new Set(["favorable", "adverse", "mixed", "pending"])

if (ZIWEI_PATTERN_DEFINITIONS.length < 150) {
  fail(`expected a full pattern catalog, got ${ZIWEI_PATTERN_DEFINITIONS.length}`)
}

for (const definition of ZIWEI_PATTERN_DEFINITIONS) {
  const detail = getPatternContentDetail({
    id: definition.id,
    label: definition.label,
    category: definition.category,
    conditionText: definition.conditionText
  })

  if (detail.patternId !== definition.id) {
    fail(`${definition.id}: patternId mismatch`)
  }

  if (!validTones.has(detail.tone)) {
    fail(`${definition.id}: invalid tone`)
  }

  if (detail.label !== definition.label || detail.category !== definition.category) {
    fail(`${definition.id}: label or category mismatch`)
  }

  for (const field of requiredStringFields) {
    if (typeof detail[field] !== "string" || detail[field].length < 8) {
      fail(`${definition.id}: ${field} is too short`)
    }
  }

  for (const field of requiredListFields) {
    if (!Array.isArray(detail[field]) || detail[field].length < 2) {
      fail(`${definition.id}: ${field} needs at least 2 items`)
    }
  }

  if (!detail.readingNotes.some((line) => line.includes(definition.conditionText))) {
    fail(`${definition.id}: missing original condition text`)
  }
}

console.log(
  `[check-pattern-content-details] ok (${ZIWEI_PATTERN_DEFINITIONS.length} pattern detail(s))`
)
