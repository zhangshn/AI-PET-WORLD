import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

const files = {
  snapshot: path.join(
    root,
    "data/ziwei/sample-calibration/priority-sample-snapshot-v1.json"
  ),
  snapshotDoc: path.join(root, "docs/ziwei/SAMPLE_PRIORITY_SNAPSHOTS.md"),
  manualCalibration: path.join(
    root,
    "data/ziwei/sample-calibration/sample-manual-calibration-v1.json"
  ),
  patternGolden: path.join(
    root,
    "data/ziwei/pattern-golden-samples/pattern-golden-v1.json"
  ),
  readme: path.join(root, "docs/ziwei/README.md"),
  pageStructure: path.join(root, "docs/ziwei/PAGE_ACCEPTANCE.md"),
  directoryStructure: path.join(root, "docs/ziwei/DIRECTORY_STRUCTURE.md"),
  executionTable: path.join(root, "docs/ziwei/EXECUTION_TABLE.md"),
  totalClosureCheck: path.join(root, "scripts/ziwei/check-ziwei-content-total-closure.mjs")
}

function fail(message) {
  console.error(`[check-priority-sample-snapshots] ${message}`)
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

function assertJsonEqual(label, actual, expected) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)

  if (actualJson !== expectedJson) {
    fail(`${label} expected ${expectedJson}, got ${actualJson}`)
  }
}

const texts = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, read(file)])
)
const snapshot = JSON.parse(texts.snapshot)
const manualCalibration = JSON.parse(texts.manualCalibration)
const patternGolden = JSON.parse(texts.patternGolden)
const goldenSamples = Object.fromEntries(
  readdirSync(path.join(root, "data/ziwei/golden-samples"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const sample = JSON.parse(
        readFileSync(path.join(root, "data/ziwei/golden-samples", file), "utf8")
      )
      return [sample.sampleId, sample]
    })
)
const patternSamples = Object.fromEntries(
  patternGolden.samples.map((sample) => [sample.sampleId, sample])
)

if (snapshot.schemaVersion !== "ziwei-priority-sample-snapshot-v1") {
  fail(`unexpected schema version: ${snapshot.schemaVersion}`)
}

if (!Array.isArray(snapshot.samples) || snapshot.samples.length !== 7) {
  fail("snapshot must contain exactly 7 samples")
}

const snapshotIds = snapshot.samples.map((sample) => sample.sampleId)
assertJsonEqual(
  "snapshot sample ids",
  snapshotIds.slice().sort(),
  manualCalibration.closedSampleIds.slice().sort()
)

for (const sample of snapshot.samples) {
  const golden = goldenSamples[sample.sampleId]
  const pattern = patternSamples[sample.sampleId]

  if (!golden) {
    fail(`missing golden sample: ${sample.sampleId}`)
  }

  if (!pattern) {
    fail(`missing pattern golden sample: ${sample.sampleId}`)
  }

  if (!Array.isArray(sample.calibrationUse) || sample.calibrationUse.length === 0) {
    fail(`${sample.sampleId} must list calibrationUse`)
  }

  assertJsonEqual(`${sample.sampleId} life palace`, sample.expected.lifePalace, golden.expected.lifePalace)
  assertJsonEqual(`${sample.sampleId} body palace`, sample.expected.bodyPalace, golden.expected.bodyPalace)
  assertJsonEqual(
    `${sample.sampleId} dynamic direction`,
    sample.expected.dynamicDirection,
    golden.expected.dynamicDebug.direction
  )
  assertJsonEqual(
    `${sample.sampleId} xiao xian direction`,
    sample.expected.xiaoXianDirection,
    golden.expected.dynamicDebug.xiaoXianDirection
  )
  assertJsonEqual(
    `${sample.sampleId} xiao xian start`,
    sample.expected.xiaoXianStartPalace,
    golden.expected.dynamicDebug.xiaoXianStartPalace
  )
  assertJsonEqual(
    `${sample.sampleId} xiao xian palace`,
    sample.expected.xiaoXianPalace,
    golden.expected.dynamicDebug.xiaoXianPalace
  )
  assertJsonEqual(
    `${sample.sampleId} dou jun palace`,
    sample.expected.douJunPalace,
    golden.expected.dynamicDebug.douJunPalace
  )
  assertJsonEqual(
    `${sample.sampleId} dynamic flow palaces`,
    sample.expected.dynamicFlowPalaces,
    golden.expected.dynamicFlowPalaces
  )
  assertJsonEqual(
    `${sample.sampleId} pattern totals`,
    sample.expected.patternTotals,
    {
      hitCount: pattern.totals.hitCount,
      enhancedCount: pattern.totals.enhancedCount,
      brokenCount: pattern.totals.brokenCount,
      adverseHitCount: pattern.totals.adverseHitCount
    }
  )
}

if (!Array.isArray(snapshot.openSnapshotGaps) || snapshot.openSnapshotGaps.length < 5) {
  fail("openSnapshotGaps must keep at least 5 gaps")
}

requireIncludes(
  texts.snapshotDoc,
  [
    "紫微斗数重点样例快照",
    "1990-male-solar",
    "1988-male-zi-hour-boundary",
    "锁定字段",
    "仍缺样例"
  ],
  "SAMPLE_PRIORITY_SNAPSHOTS.md"
)

requireIncludes(
  texts.readme,
  ["SAMPLE_PRIORITY_SNAPSHOTS.md", "重点样例快照"],
  "README.md"
)

requireIncludes(
  texts.pageStructure,
  ["重点样例快照", "priority-sample-snapshot-v1.json", "check-priority-sample-snapshots.mjs"],
  "PAGE_ACCEPTANCE.md"
)

requireIncludes(
  texts.directoryStructure,
  ["priority-sample-snapshot-v1.json", "check-priority-sample-snapshots.mjs"],
  "DIRECTORY_STRUCTURE.md"
)

requireIncludes(
  texts.executionTable,
  ["| 142 | P19 | 重点样例补充与快照固化 |", "SAMPLE_PRIORITY_SNAPSHOTS.md", "check-priority-sample-snapshots.mjs"],
  "EXECUTION_TABLE.md"
)

requireIncludes(
  texts.totalClosureCheck,
  ["check-priority-sample-snapshots.mjs", "SAMPLE_PRIORITY_SNAPSHOTS.md"],
  "check-ziwei-content-total-closure.mjs"
)

console.log("[check-priority-sample-snapshots] ok")
