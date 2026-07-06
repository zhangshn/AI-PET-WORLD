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
  getAllPalaceContentDetails,
  getPalaceContentDetail
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

function fail(message) {
  console.error(`[check-palace-content-details] ${message}`)
  process.exit(1)
}

const details = getAllPalaceContentDetails()

if (details.length !== REQUIRED_PALACES.length) {
  fail(`expected 12 palace details, got ${details.length}`)
}

for (const sectorName of REQUIRED_PALACES) {
  const detail = getPalaceContentDetail(sectorName)

  if (!detail) {
    fail(`missing palace detail: ${sectorName}`)
  }

  assertString(sectorName, detail.label, "label", 2)
  assertString(sectorName, detail.corePosition, "corePosition", 6)
  assertString(sectorName, detail.nature, "nature", 40)
  assertList(sectorName, detail.aliases, "aliases", 1)
  assertList(sectorName, detail.primaryQuestions, "primaryQuestions", 4)
  assertList(sectorName, detail.starReadingUsage, "starReadingUsage", 2)
  assertList(sectorName, detail.relationUsage, "relationUsage", 2)
  assertList(sectorName, detail.dynamicUsage, "dynamicUsage", 2)
  assertList(sectorName, detail.commonMisreads, "commonMisreads", 3)
  assertList(sectorName, detail.reportUsage, "reportUsage", 4)
  assertList(sectorName, detail.sections, "sections", 7)
}

console.log("[check-palace-content-details] ok")

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
