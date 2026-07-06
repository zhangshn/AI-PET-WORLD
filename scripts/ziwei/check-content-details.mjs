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
  getAllAssistantStarContentDetails,
  getAllBranchContentDetails,
  getAllBranchGroupContentDetails,
  getAllElementGateContentDetails,
  getAllMaleficStarContentDetails,
  getAllMainStarContentDetails,
  getAllMainStarPalaceCombinationContentDetails,
  getAllMiscStarContentDetails,
  getAllPalaceContentDetails,
  getAllPeriodicStarContentDetails,
  getAllStemContentDetails,
  getAllTransformationContentDetails,
  getAssistantStarContentDetail,
  getBranchContentDetail,
  getBranchGroupContentDetail,
  getElementGateContentDetail,
  getMaleficStarContentDetail,
  getMainStarContentDetail,
  getMainStarPalaceCombinationContentDetail,
  getMiscStarContentDetail,
  getPalaceContentDetail,
  getPeriodicStarContentDetail,
  getStemContentDetail,
  getTransformationContentDetail
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")
const {
  ASSISTANT_STAR_IDS,
  MALEFIC_STAR_IDS,
  MAIN_STAR_IDS,
  MISC_STAR_IDS,
  LIFECYCLE_STAR_IDS,
  YEARLY_STAR_IDS,
  MONTHLY_STAR_IDS,
  DAILY_HOURLY_STAR_IDS,
  TRANSFORMATION_STAR_IDS
} = require("../../src/ai/destiny-core/ziwei-core/star-catalog/index.ts")

function fail(message) {
  console.error(`[check-content-details] ${message}`)
  process.exit(1)
}

const details = getAllMainStarContentDetails()
const requiredStarIds = Object.values(MAIN_STAR_IDS)
const assistantDetails = getAllAssistantStarContentDetails()
const requiredAssistantStarIds = Object.values(ASSISTANT_STAR_IDS)
const maleficDetails = getAllMaleficStarContentDetails()
const requiredMaleficStarIds = Object.values(MALEFIC_STAR_IDS)
const miscDetails = getAllMiscStarContentDetails()
const requiredMiscStarIds = Object.values(MISC_STAR_IDS)
const transformationDetails = getAllTransformationContentDetails()
const requiredTransformationStarIds = Object.values(TRANSFORMATION_STAR_IDS)
const periodicDetails = getAllPeriodicStarContentDetails()
const branchDetails = getAllBranchContentDetails()
const branchGroupDetails = getAllBranchGroupContentDetails()
const stemDetails = getAllStemContentDetails()
const elementGateDetails = getAllElementGateContentDetails()
const palaceDetails = getAllPalaceContentDetails()
const mainStarPalaceCombinationDetails = getAllMainStarPalaceCombinationContentDetails()
const requiredPeriodicStarIds = [
  ...Object.values(LIFECYCLE_STAR_IDS),
  ...Object.values(YEARLY_STAR_IDS),
  ...Object.values(MONTHLY_STAR_IDS),
  ...Object.values(DAILY_HOURLY_STAR_IDS)
]
const requiredBranches = [
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
const requiredBranchGroups = [
  "siMa",
  "siBai",
  "siMu",
  "sanHeWater",
  "sanHeWood",
  "sanHeFire",
  "sanHeMetal"
]
const requiredStems = [
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
const requiredElementGates = [
  "water_2",
  "wood_3",
  "metal_4",
  "earth_5",
  "fire_6"
]
const requiredPalaces = [
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
const expectedMainStarPalaceCombinationCount = requiredStarIds.length * requiredPalaces.length

if (details.length !== requiredStarIds.length) {
  fail(`expected ${requiredStarIds.length} main star details, got ${details.length}`)
}

for (const starId of requiredStarIds) {
  const detail = getMainStarContentDetail(starId)

  if (!detail) {
    fail(`missing main star content detail: ${starId}`)
  }

  assertStarContentDetail(starId, detail)
}

if (assistantDetails.length !== requiredAssistantStarIds.length) {
  fail(
    `expected ${requiredAssistantStarIds.length} assistant star details, got ${assistantDetails.length}`
  )
}

for (const starId of requiredAssistantStarIds) {
  const detail = getAssistantStarContentDetail(starId)

  if (!detail) {
    fail(`missing assistant star content detail: ${starId}`)
  }

  assertStarContentDetail(starId, detail)
}

if (maleficDetails.length !== requiredMaleficStarIds.length) {
  fail(
    `expected ${requiredMaleficStarIds.length} malefic star details, got ${maleficDetails.length}`
  )
}

for (const starId of requiredMaleficStarIds) {
  const detail = getMaleficStarContentDetail(starId)

  if (!detail) {
    fail(`missing malefic star content detail: ${starId}`)
  }

  assertStarContentDetail(starId, detail)
}

if (miscDetails.length !== requiredMiscStarIds.length) {
  fail(`expected ${requiredMiscStarIds.length} misc star details, got ${miscDetails.length}`)
}

for (const starId of requiredMiscStarIds) {
  const detail = getMiscStarContentDetail(starId)

  if (!detail) {
    fail(`missing misc star content detail: ${starId}`)
  }

  assertStarContentDetail(starId, detail)
}

if (transformationDetails.length !== requiredTransformationStarIds.length) {
  fail(
    `expected ${requiredTransformationStarIds.length} transformation details, got ${transformationDetails.length}`
  )
}

for (const starId of requiredTransformationStarIds) {
  const detail = getTransformationContentDetail(starId)

  if (!detail) {
    fail(`missing transformation content detail: ${starId}`)
  }

  assertStarContentDetail(starId, detail)
}

if (periodicDetails.length !== requiredPeriodicStarIds.length) {
  fail(
    `expected ${requiredPeriodicStarIds.length} periodic details, got ${periodicDetails.length}`
  )
}

for (const starId of requiredPeriodicStarIds) {
  const detail = getPeriodicStarContentDetail(starId)

  if (!detail) {
    fail(`missing periodic content detail: ${starId}`)
  }

  assertStarContentDetail(starId, detail)
}

if (branchDetails.length !== requiredBranches.length) {
  fail(`expected ${requiredBranches.length} branch details, got ${branchDetails.length}`)
}

for (const branch of requiredBranches) {
  const detail = getBranchContentDetail(branch)

  if (!detail) {
    fail(`missing branch content detail: ${branch}`)
  }

  assertBranchContentDetail(branch, detail)
}

if (branchGroupDetails.length < 7) {
  fail(`expected at least 7 branch group details, got ${branchGroupDetails.length}`)
}

for (const groupId of requiredBranchGroups) {
  const detail = getBranchGroupContentDetail(groupId)

  if (!detail) {
    fail(`missing branch group detail: ${groupId}`)
  }

  assertList(groupId, detail.branches, "branches", 3)
  assertList(groupId, detail.analysisUsage, "analysisUsage", 2)
}

if (stemDetails.length !== requiredStems.length) {
  fail(`expected ${requiredStems.length} stem details, got ${stemDetails.length}`)
}

for (const stem of requiredStems) {
  const detail = getStemContentDetail(stem)

  if (!detail) {
    fail(`missing stem content detail: ${stem}`)
  }

  assertStemContentDetail(stem, detail)
}

if (elementGateDetails.length !== requiredElementGates.length) {
  fail(
    `expected ${requiredElementGates.length} element gate details, got ${elementGateDetails.length}`
  )
}

for (const gate of requiredElementGates) {
  const detail = getElementGateContentDetail(gate)

  if (!detail) {
    fail(`missing element gate content detail: ${gate}`)
  }

  assertElementGateContentDetail(gate, detail)
}

if (palaceDetails.length !== requiredPalaces.length) {
  fail(`expected ${requiredPalaces.length} palace details, got ${palaceDetails.length}`)
}

for (const sectorName of requiredPalaces) {
  const detail = getPalaceContentDetail(sectorName)

  if (!detail) {
    fail(`missing palace content detail: ${sectorName}`)
  }

  assertPalaceContentDetail(sectorName, detail)
}

if (mainStarPalaceCombinationDetails.length !== expectedMainStarPalaceCombinationCount) {
  fail(
    `expected ${expectedMainStarPalaceCombinationCount} main star palace combinations, got ${mainStarPalaceCombinationDetails.length}`
  )
}

for (const starId of requiredStarIds) {
  for (const sectorName of requiredPalaces) {
    const detail = getMainStarPalaceCombinationContentDetail(starId, sectorName)

    if (!detail) {
      fail(`missing main star palace combination: ${starId} ${sectorName}`)
    }

    assertMainStarPalaceCombinationDetail(detail.combinationId, detail)
  }
}

console.log("[check-content-details] ok")

function assertStarContentDetail(starId, detail) {
  const stringFields = [
    "nature",
    "palaceFocus",
    "personalityTendency",
    "worldBehaviorHint"
  ]
  const listFields = [
    "coreThemes",
    "strengths",
    "risks",
    "favorableSignals",
    "unfavorableSignals",
    "readingNotes"
  ]

  if (!["yang", "yin", "mixed"].includes(detail.yinYang)) {
    fail(`${starId}: invalid yinYang`)
  }

  if (!["wood", "fire", "earth", "metal", "water", "mixed"].includes(detail.element)) {
    fail(`${starId}: invalid element`)
  }

  if (typeof detail.label !== "string" || detail.label.length === 0) {
    fail(`${starId}: missing label`)
  }

  for (const field of stringFields) {
    if (typeof detail[field] !== "string" || detail[field].length < 6) {
      fail(`${starId}: ${field} is too short`)
    }
  }

  for (const field of listFields) {
    if (!Array.isArray(detail[field]) || detail[field].length < 2) {
      fail(`${starId}: ${field} needs at least 2 items`)
    }
  }
}

function assertBranchContentDetail(branch, detail) {
  const stringFields = [
    "label",
    "direction",
    "season",
    "monthHint",
    "timeHint",
    "nature"
  ]
  const listFields = [
    "groupIds",
    "hiddenStems",
    "symbolicMeanings",
    "palaceUsage",
    "starInteraction",
    "dynamicUsage",
    "relationshipUsage",
    "cautions",
    "sections"
  ]

  if (!["yang", "yin", "mixed"].includes(detail.yinYang)) {
    fail(`${branch}: invalid yinYang`)
  }

  if (!["wood", "fire", "earth", "metal", "water"].includes(detail.element)) {
    fail(`${branch}: invalid element`)
  }

  if (typeof detail.label !== "string" || detail.label.length < 1) {
    fail(`${branch}: label is too short`)
  }

  for (const field of stringFields) {
    if (field === "label") {
      continue
    }

    if (typeof detail[field] !== "string" || detail[field].length < 2) {
      fail(`${branch}: ${field} is too short`)
    }
  }

  for (const field of listFields) {
    if (!Array.isArray(detail[field]) || detail[field].length < 1) {
      fail(`${branch}: ${field} needs at least 1 item`)
    }
  }
}

function assertStemContentDetail(stem, detail) {
  assertString(stem, detail.label, "label", 1)
  assertString(stem, detail.pairGroup, "pairGroup", 3)
  assertString(stem, detail.nature, "nature", 20)
  assertList(stem, detail.symbolicMeanings, "symbolicMeanings", 5)
  assertList(stem, detail.transformationUsage, "transformationUsage", 2)
  assertList(stem, detail.palaceStemUsage, "palaceStemUsage", 2)
  assertList(stem, detail.dynamicUsage, "dynamicUsage", 2)
  assertList(stem, detail.combinationUsage, "combinationUsage", 2)
  assertList(stem, detail.cautions, "cautions", 2)
  assertList(stem, detail.sections, "sections", 6)
}

function assertElementGateContentDetail(gate, detail) {
  assertString(gate, detail.label, "label", 3)
  assertString(gate, detail.nature, "nature", 20)
  assertList(gate, detail.symbolicMeanings, "symbolicMeanings", 5)
  assertList(gate, detail.ziweiPlacementUsage, "ziweiPlacementUsage", 2)
  assertList(gate, detail.daYunUsage, "daYunUsage", 2)
  assertList(gate, detail.starInteraction, "starInteraction", 2)
  assertList(gate, detail.cautions, "cautions", 2)
  assertList(gate, detail.sections, "sections", 5)
}

function assertPalaceContentDetail(sectorName, detail) {
  assertString(sectorName, detail.label, "label", 2)
  assertString(sectorName, detail.corePosition, "corePosition", 6)
  assertString(sectorName, detail.nature, "nature", 30)
  assertList(sectorName, detail.aliases, "aliases", 1)
  assertList(sectorName, detail.primaryQuestions, "primaryQuestions", 4)
  assertList(sectorName, detail.starReadingUsage, "starReadingUsage", 2)
  assertList(sectorName, detail.relationUsage, "relationUsage", 2)
  assertList(sectorName, detail.dynamicUsage, "dynamicUsage", 2)
  assertList(sectorName, detail.commonMisreads, "commonMisreads", 3)
  assertList(sectorName, detail.reportUsage, "reportUsage", 4)
  assertList(sectorName, detail.sections, "sections", 7)
}

function assertMainStarPalaceCombinationDetail(id, detail) {
  assertString(id, detail.coreReading, "coreReading", 80)
  assertList(id, detail.analysisFocus, "analysisFocus", 4)
  assertList(id, detail.favorableSignals, "favorableSignals", 4)
  assertList(id, detail.riskSignals, "riskSignals", 4)
  assertList(id, detail.relationUsage, "relationUsage", 2)
  assertList(id, detail.dynamicUsage, "dynamicUsage", 2)
  assertList(id, detail.cautions, "cautions", 4)
  assertList(id, detail.sections, "sections", 7)
}

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
