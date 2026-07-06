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
  getAllZiweiDataDictionaryGapReviewItems,
  getZiweiDataDictionaryGapReviewItem
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_GAP_IDS = [
  "ziwei.gap.misc-star-detail-depth",
  "ziwei.gap.periodic-star-layer-boundary",
  "ziwei.gap.current-pattern-synthesis",
  "ziwei.gap.palace-topic-paragraph-depth",
  "ziwei.gap.transformation-source-layer",
  "ziwei.gap.branch-spatial-combination",
  "ziwei.gap.source-reference-manual-review",
  "ziwei.gap.manual-calibration-samples",
  "ziwei.gap.star-palace-text-quality",
  "ziwei.gap.dynamic-flow-inheritance-narrative"
]

const REQUIRED_LIST_FIELDS = [
  ["affectedLayers", 2],
  ["currentEvidence", 2],
  ["missingDetail", 2],
  ["nextDataWork", 2],
  ["acceptanceCriteria", 2],
  ["reviewBoundary", 1]
]

function fail(message) {
  console.error(`[check-data-dictionary-gap-review] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function assertList(item, field, minLength) {
  const value = item[field]
  assert(Array.isArray(value), `${item.gapId}: ${field} must be a list`)
  assert(value.length >= minLength, `${item.gapId}: ${field} needs at least ${minLength} item(s)`)
  const minEntryLength = field === "affectedLayers" ? 2 : 6
  for (const entry of value) {
    assert(
      typeof entry === "string" && entry.trim().length >= minEntryLength,
      `${item.gapId}: ${field} has weak entry`
    )
  }
}

const items = getAllZiweiDataDictionaryGapReviewItems()
assert(Array.isArray(items), "gap review items must be a list")
assert(items.length >= 10, `expected at least 10 gap review items, got ${items.length}`)

const ids = new Set()
const priorities = new Set()
const statuses = new Set()

for (const item of items) {
  assert(typeof item.gapId === "string" && item.gapId.startsWith("ziwei.gap."), "invalid gapId")
  assert(!ids.has(item.gapId), `duplicate gapId ${item.gapId}`)
  ids.add(item.gapId)

  assert(typeof item.title === "string" && item.title.length >= 8, `${item.gapId}: title too short`)
  assert(["P0", "P1", "P2"].includes(item.priority), `${item.gapId}: invalid priority`)
  assert(
    ["ready-for-next-batch", "watching", "blocked-by-source-review"].includes(item.status),
    `${item.gapId}: invalid status`
  )
  priorities.add(item.priority)
  statuses.add(item.status)

  for (const [field, minLength] of REQUIRED_LIST_FIELDS) {
    assertList(item, field, minLength)
  }
}

for (const id of REQUIRED_GAP_IDS) {
  assert(ids.has(id), `missing required gap ${id}`)
  assert(getZiweiDataDictionaryGapReviewItem(id)?.gapId === id, `lookup failed for ${id}`)
}

for (const priority of ["P0", "P1", "P2"]) {
  assert(priorities.has(priority), `missing priority ${priority}`)
}

for (const status of ["ready-for-next-batch", "watching", "blocked-by-source-review"]) {
  assert(statuses.has(status), `missing status ${status}`)
}

console.log(`[check-data-dictionary-gap-review] ok gaps=${items.length}`)
