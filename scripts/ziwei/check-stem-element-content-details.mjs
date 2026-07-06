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
  getAllElementGateContentDetails,
  getAllStemContentDetails,
  getElementGateContentDetail,
  getStemContentDetail
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_STEMS = [
  "jia",
  "yi",
  "bing",
  "ding",
  "wu",
  "ji",
  "geng",
  "xin",
  "ren",
  "gui"
]

const REQUIRED_ELEMENT_GATES = [
  "water_2",
  "wood_3",
  "metal_4",
  "earth_5",
  "fire_6"
]

function fail(message) {
  console.error(`[check-stem-element-content-details] ${message}`)
  process.exit(1)
}

const stemDetails = getAllStemContentDetails()
const gateDetails = getAllElementGateContentDetails()

if (stemDetails.length !== REQUIRED_STEMS.length) {
  fail(`expected 10 stem details, got ${stemDetails.length}`)
}

if (gateDetails.length !== REQUIRED_ELEMENT_GATES.length) {
  fail(`expected 5 element gate details, got ${gateDetails.length}`)
}

for (const stem of REQUIRED_STEMS) {
  const detail = getStemContentDetail(stem)

  if (!detail) {
    fail(`missing stem detail: ${stem}`)
  }

  assertString(stem, detail.label, "label", 1)
  assertString(stem, detail.pairGroup, "pairGroup", 3)
  assertString(stem, detail.nature, "nature", 30)
  assertList(stem, detail.symbolicMeanings, "symbolicMeanings", 5)
  assertList(stem, detail.transformationUsage, "transformationUsage", 2)
  assertList(stem, detail.palaceStemUsage, "palaceStemUsage", 2)
  assertList(stem, detail.dynamicUsage, "dynamicUsage", 2)
  assertList(stem, detail.combinationUsage, "combinationUsage", 2)
  assertList(stem, detail.cautions, "cautions", 2)
  assertList(stem, detail.sections, "sections", 6)
}

for (const gate of REQUIRED_ELEMENT_GATES) {
  const detail = getElementGateContentDetail(gate)

  if (!detail) {
    fail(`missing element gate detail: ${gate}`)
  }

  assertString(gate, detail.label, "label", 3)
  assertString(gate, detail.nature, "nature", 30)
  assertList(gate, detail.symbolicMeanings, "symbolicMeanings", 5)
  assertList(gate, detail.ziweiPlacementUsage, "ziweiPlacementUsage", 2)
  assertList(gate, detail.daYunUsage, "daYunUsage", 2)
  assertList(gate, detail.starInteraction, "starInteraction", 2)
  assertList(gate, detail.cautions, "cautions", 2)
  assertList(gate, detail.sections, "sections", 5)
}

const expectedGateBase = {
  water_2: 2,
  wood_3: 3,
  metal_4: 4,
  earth_5: 5,
  fire_6: 6
}

for (const [gate, baseNumber] of Object.entries(expectedGateBase)) {
  const detail = getElementGateContentDetail(gate)

  if (detail.baseNumber !== baseNumber) {
    fail(`${gate}: expected baseNumber ${baseNumber}, got ${detail.baseNumber}`)
  }
}

console.log("[check-stem-element-content-details] ok")

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
