import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

const files = {
  calibrationJson: path.join(
    root,
    "data/ziwei/sample-calibration/sample-manual-calibration-v1.json"
  ),
  sampleDoc: path.join(root, "docs/ziwei/SAMPLE_MANUAL_CALIBRATION.md"),
  readme: path.join(root, "docs/ziwei/README.md"),
  pageStructure: path.join(root, "docs/ziwei/PAGE_ACCEPTANCE.md"),
  directoryStructure: path.join(root, "docs/ziwei/DIRECTORY_STRUCTURE.md"),
  executionTable: path.join(root, "data/ziwei/legacy-execution-verification-baseline-v1.txt"),
  totalClosureCheck: path.join(root, "scripts/ziwei/check-ziwei-content-total-closure.mjs")
}

function fail(message) {
  console.error(`[check-sample-manual-calibration] ${message}`)
  process.exit(1)
}

function read(file) {
  if (!existsSync(file)) {
    fail(`missing file: ${path.relative(root, file)}`)
  }

  return readFileSync(file, "utf8")
}

function requireIncludes(text, markers, label) {
  const missing = markers.filter((marker) => !text.includes(marker))

  if (missing.length > 0) {
    fail(`${label} missing markers: ${missing.join(", ")}`)
  }
}

const texts = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, read(file)])
)
const calibration = JSON.parse(texts.calibrationJson)

if (calibration.schemaVersion !== "ziwei-sample-manual-calibration-v1") {
  fail(`unexpected schema version: ${calibration.schemaVersion}`)
}

if (!Array.isArray(calibration.closedSampleIds) || calibration.closedSampleIds.length !== 7) {
  fail("closedSampleIds must contain exactly 7 samples")
}

const duplicateSampleIds = calibration.closedSampleIds.filter((sampleId, index) => {
  return calibration.closedSampleIds.indexOf(sampleId) !== index
})

if (duplicateSampleIds.length > 0) {
  fail(`duplicate sample ids: ${duplicateSampleIds.join(", ")}`)
}

const existingSampleIds = new Set(
  readdirSync(path.join(root, "data/ziwei/golden-samples"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      return JSON.parse(
        readFileSync(path.join(root, "data/ziwei/golden-samples", file), "utf8")
      ).sampleId
    })
)
const missingSampleIds = calibration.closedSampleIds.filter((sampleId) => {
  return !existingSampleIds.has(sampleId)
})

if (missingSampleIds.length > 0) {
  fail(`closed samples missing from golden samples: ${missingSampleIds.join(", ")}`)
}

const requiredGroups = [
  "base-star-placement",
  "brightness-and-star-catalog",
  "pattern-and-malefic-rules",
  "dynamic-flow",
  "page-and-analysis"
]
const groupIds = new Set(
  calibration.manualCalibrationGroups.map((group) => group.groupId)
)
const missingGroups = requiredGroups.filter((groupId) => !groupIds.has(groupId))

if (missingGroups.length > 0) {
  fail(`missing calibration groups: ${missingGroups.join(", ")}`)
}

for (const group of calibration.manualCalibrationGroups) {
  if (!Array.isArray(group.openItems) || group.openItems.length === 0) {
    fail(`${group.groupId} must keep openItems for manual calibration`)
  }

  if (!Array.isArray(group.coveredBy) || group.coveredBy.length === 0) {
    fail(`${group.groupId} must list coveredBy scripts`)
  }
}

if (!Array.isArray(calibration.nextSampleRequests) || calibration.nextSampleRequests.length < 5) {
  fail("nextSampleRequests must contain at least 5 requests")
}

requireIncludes(
  texts.sampleDoc,
  [
    "紫微斗数样例人工校准清单",
    "闰月出生样例",
    "文星类格局命中样例",
    "凶格破格强样例",
    "侵权边界"
  ],
  "SAMPLE_MANUAL_CALIBRATION.md"
)

requireIncludes(
  texts.readme,
  ["SAMPLE_MANUAL_CALIBRATION.md", "样例人工校准清单"],
  "README.md"
)

requireIncludes(
  texts.pageStructure,
  ["样例人工校准清单", "sample-manual-calibration-v1.json", "check-sample-manual-calibration.mjs"],
  "PAGE_ACCEPTANCE.md"
)

requireIncludes(
  texts.directoryStructure,
  ["sample-calibration", "sample-manual-calibration-v1.json", "check-sample-manual-calibration.mjs"],
  "DIRECTORY_STRUCTURE.md"
)

requireIncludes(
  texts.executionTable,
  ["| 141 | P19 | 样例人工校准清单与缺口表 |", "SAMPLE_MANUAL_CALIBRATION.md", "check-sample-manual-calibration.mjs"],
  "EXECUTION_TABLE.md"
)

requireIncludes(
  texts.totalClosureCheck,
  ["check-sample-manual-calibration.mjs", "SAMPLE_MANUAL_CALIBRATION.md"],
  "check-ziwei-content-total-closure.mjs"
)

console.log("[check-sample-manual-calibration] ok")
