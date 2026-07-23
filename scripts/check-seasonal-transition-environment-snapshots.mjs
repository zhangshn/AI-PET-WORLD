import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const RAW_PATH = path.join(LIBRARY_ROOT, "earth-parameter-snapshots", "mainland-southeast-asia-reference-v1", "nasa-power-climatology-2001-2020.json")
const MANIFEST_PATH = path.join(LIBRARY_ROOT, "earth-parameter-snapshots", "mainland-southeast-asia-reference-v1", "manifest.json")
const COVERAGE_PATH = path.join(LIBRARY_ROOT, "coverage-blueprint.json")
const EXPECTED = [
  {
    season: "wet_to_dry_transition",
    snapshotId: "mainland-southeast-asia-tropical-monsoon-provisional-wet-to-dry-transition-v1",
    fileName: "provisional-visual-snapshot-wet-to-dry-transition-v1.json",
    months: ["OCT", "NOV"],
  },
  {
    season: "dry_to_wet_transition",
    snapshotId: "mainland-southeast-asia-tropical-monsoon-provisional-dry-to-wet-transition-v1",
    fileName: "provisional-visual-snapshot-dry-to-wet-transition-v1.json",
    months: ["APR", "MAY"],
  },
]

const raw = readJson(RAW_PATH)
const manifest = readJson(MANIFEST_PATH)
const coverage = readJson(COVERAGE_PATH)
const rawHash = sha256(fs.readFileSync(RAW_PATH))

assert(rawHash === manifest.source.rawResponseSha256, "raw climate hash mismatch")
assert(coverage.seasonalTransitionSnapshotAuthorizationRef === "project-owner-authorization-2026-07-22-seasonal-transition-environment-snapshots", "owner authorization reference missing")

const results = EXPECTED.map((expected) => {
  const snapshotPath = path.join(LIBRARY_ROOT, expected.fileName)
  const snapshot = readJson(snapshotPath)
  assert(snapshot.snapshotId === expected.snapshotId, `${expected.season}: snapshot id mismatch`)
  assert(snapshot.environment?.season === expected.season, `${expected.season}: environment season mismatch`)
  assert(snapshot.earthParameterRawResponseSha256 === rawHash, `${expected.season}: source hash mismatch`)
  assert(sameJson(snapshot.derivation?.sourceMonths, expected.months), `${expected.season}: source months mismatch`)
  assert(snapshot.usage?.imageGenerationAuthorized === false, `${expected.season}: image generation must remain false`)
  assert(snapshot.usage?.gpuTrainingAuthorized === false, `${expected.season}: GPU training must remain false`)
  assert(snapshot.visualStyle?.nativeWidth === 1024 && snapshot.visualStyle?.nativeHeight === 768, `${expected.season}: visual size mismatch`)
  assert(snapshot.visualStyle?.completeMapRequired === true, `${expected.season}: complete-map requirement missing`)
  const expectedSummary = summarize(expected.months)
  assert(sameJson(snapshot.derivation?.climateSummary, expectedSummary), `${expected.season}: climate summary mismatch`)
  const coverageEntry = coverage.availableVisualSnapshots?.find((entry) => entry.season === expected.season)
  assert(coverageEntry?.snapshotId === expected.snapshotId, `${expected.season}: coverage registration missing`)
  assert(coverageEntry?.path === projectPath(snapshotPath), `${expected.season}: coverage path mismatch`)
  return {
    season: expected.season,
    snapshotId: snapshot.snapshotId,
    path: projectPath(snapshotPath),
    sha256: sha256(fs.readFileSync(snapshotPath)),
    climateSummary: expectedSummary,
  }
})

const seasonSet = new Set((coverage.availableVisualSnapshots ?? []).map((entry) => entry.season))
for (const season of coverage.requiredStateFramework.monsoonSeasons) {
  assert(seasonSet.has(season), `coverage snapshot missing for ${season}`)
}

console.log(JSON.stringify({
  status: "passed",
  checkedSnapshotCount: results.length,
  availableSeasonCount: seasonSet.size,
  rawResponseSha256: rawHash,
  results,
  imageGenerationStarted: false,
  gpuTrainingStarted: false,
}, null, 2))

function summarize(months) {
  const parameters = raw.properties.parameter
  return {
    meanDailyPrecipitationMmPerDay: mean(months.map((month) => parameters.PRECTOTCORR[month])),
    meanRelativeHumidityPercent: mean(months.map((month) => parameters.RH2M[month])),
    meanTemperatureC: mean(months.map((month) => parameters.T2M[month])),
    meanWindSpeedMps: mean(months.map((month) => parameters.WS2M[month])),
  }
}

function mean(values) {
  assert(values.every(Number.isFinite), "climate month value missing")
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function projectPath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/")
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
