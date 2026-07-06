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
  getAllBranchContentDetails,
  getAllBranchGroupContentDetails,
  getBranchContentDetail,
  getBranchGroupContentDetail
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_BRANCHES = [
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai",
  "zi",
  "chou"
]

const REQUIRED_GROUPS = [
  "siMa",
  "siBai",
  "siMu",
  "sanHeWater",
  "sanHeWood",
  "sanHeFire",
  "sanHeMetal"
]

function fail(message) {
  console.error(`[check-branch-content-details] ${message}`)
  process.exit(1)
}

const details = getAllBranchContentDetails()
const groups = getAllBranchGroupContentDetails()

if (details.length !== REQUIRED_BRANCHES.length) {
  fail(`expected 12 branch details, got ${details.length}`)
}

if (groups.length < REQUIRED_GROUPS.length) {
  fail(`expected at least ${REQUIRED_GROUPS.length} branch groups, got ${groups.length}`)
}

for (const branch of REQUIRED_BRANCHES) {
  const detail = getBranchContentDetail(branch)

  if (!detail) {
    fail(`missing branch detail: ${branch}`)
  }

  assertString(branch, detail.label, "label", 1)
  assertString(branch, detail.direction, "direction", 2)
  assertString(branch, detail.season, "season", 2)
  assertString(branch, detail.monthHint, "monthHint", 4)
  assertString(branch, detail.timeHint, "timeHint", 8)
  assertString(branch, detail.nature, "nature", 30)
  assertList(branch, detail.groupIds, "groupIds", 2)
  assertList(branch, detail.hiddenStems, "hiddenStems", 1)
  assertList(branch, detail.symbolicMeanings, "symbolicMeanings", 5)
  assertList(branch, detail.palaceUsage, "palaceUsage", 2)
  assertList(branch, detail.starInteraction, "starInteraction", 2)
  assertList(branch, detail.dynamicUsage, "dynamicUsage", 1)
  assertList(branch, detail.relationshipUsage, "relationshipUsage", 1)
  assertList(branch, detail.cautions, "cautions", 2)
  assertList(branch, detail.sections, "sections", 6)
}

for (const groupId of REQUIRED_GROUPS) {
  const detail = getBranchGroupContentDetail(groupId)

  if (!detail) {
    fail(`missing branch group: ${groupId}`)
  }

  assertString(groupId, detail.label, "label", 2)
  assertString(groupId, detail.nature, "nature", 20)
  assertList(groupId, detail.branches, "branches", 3)
  assertList(groupId, detail.aliases, "aliases", 1)
  assertList(groupId, detail.analysisUsage, "analysisUsage", 2)
  assertList(groupId, detail.cautions, "cautions", 1)
}

const siMa = getBranchGroupContentDetail("siMa")
if (siMa.branches.join(",") !== "yin,shen,si,hai") {
  fail(`siMa branches mismatch: ${siMa.branches.join(",")}`)
}

const siBai = getBranchGroupContentDetail("siBai")
if (siBai.branches.join(",") !== "zi,wu,mao,you") {
  fail(`siBai branches mismatch: ${siBai.branches.join(",")}`)
}

const siMu = getBranchGroupContentDetail("siMu")
if (siMu.branches.join(",") !== "chen,xu,chou,wei") {
  fail(`siMu branches mismatch: ${siMu.branches.join(",")}`)
}

console.log("[check-branch-content-details] ok")

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
