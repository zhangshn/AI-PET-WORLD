import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { projectPath } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-soil-hydrology-runs",
  "latest.json",
)
const REGION_CONTRACT_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "regions",
  "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1",
  "region-contract.json",
)

const latest = readJson(LATEST_PATH)
const manifest = readJson(path.join(ROOT, latest.runPath))
const regionContract = readJson(REGION_CONTRACT_PATH)

assert(
  manifest.schemaVersion === "earth-geospatial-soil-hydrology-manifest-v1",
  "soil-hydrology manifest schema mismatch",
)
assert(
  manifest.status ===
    "soil_measurement_and_provisional_natural_hydrology_compiled",
  "soil-hydrology run is incomplete",
)
assert(
  manifest.soil.measurements.length === 4,
  "four soil properties are required",
)
assert(
  manifest.naturalHydrology.status ===
    "provisional_dem_derived_pending_engineered_linear_removal",
  "hydrology must remain provisional",
)
assert(
  manifest.naturalHydrology.finalWorldFactEligible === false,
  "provisional hydrology cannot become a WorldFact",
)
assert(
  manifest.outputBoundary.imageGenerationStarted === false &&
    manifest.outputBoundary.gpuTrainingStarted === false &&
    manifest.outputBoundary.rgbCreated === false &&
    manifest.outputBoundary.derivedWorldFactsCreated === false,
  "output boundary was violated",
)
assert(
  manifest.remainingBlockers.includes(
    "engineered_linear_feature_removal_evidence_missing",
  ),
  "engineered linear-feature blocker is missing",
)
assert(
  !manifest.remainingBlockers.includes("soil_measurement_not_acquired"),
  "soil blocker was not closed",
)
assert(
  !manifest.remainingBlockers.includes(
    "natural_hydrology_derivation_missing",
  ),
  "hydrology derivation blocker was not closed",
)
assert(
  regionContract.blockers.includes(
    "engineered_linear_feature_removal_evidence_missing",
  ),
  "region contract lost the road-removal blocker",
)

for (const measurement of manifest.soil.measurements) {
  assert(measurement.width > 0 && measurement.height > 0, "soil grid is empty")
  assert(measurement.noDataValue === 0, "soil no-data value is not recorded")
  assert(measurement.validValueCount > 0, "soil grid has no valid values")
  assert(
    measurement.noDataCount + measurement.validValueCount ===
      measurement.width * measurement.height,
    "soil valid/no-data accounting mismatch",
  )
  assert(
    measurement.rawUnitStatistics.minimum > 0,
    "soil statistics include the no-data sentinel",
  )
  assertHash(measurement.sourcePath, measurement.sourceSha256)
  assertHash(measurement.outputPath, measurement.outputSha256)
}
for (const [pathKey, hashKey] of [
  ["elevationPath", "elevationSha256"],
  ["filledElevationPath", "filledElevationSha256"],
  ["slopePath", "slopeSha256"],
  ["accumulationPath", "accumulationSha256"],
  ["drainageLikelihoodPath", "drainageLikelihoodSha256"],
]) {
  assertHash(
    manifest.naturalHydrology[pathKey],
    manifest.naturalHydrology[hashKey],
  )
}
assert(
  manifest.naturalHydrology.statistics.maximumFlowAccumulation > 1,
  "flow accumulation did not form a drainage network",
)
assert(
  manifest.naturalHydrology.statistics.drainagePixelCount > 0,
  "drainage likelihood is empty",
)

console.log(
  JSON.stringify(
    {
      status: "earth_geospatial_soil_hydrology_passed",
      runId: manifest.runId,
      manifestPath: projectPath(path.join(ROOT, latest.runPath)),
      soilProperties: manifest.soil.measurements.map((item) => ({
        propertyId: item.propertyId,
        dimensions: `${item.width}x${item.height}`,
        conventionalStatistics: item.conventionalStatistics,
      })),
      hydrology: manifest.naturalHydrology.statistics,
      remainingBlockers: manifest.remainingBlockers,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
)

function assertHash(relativePath, expected) {
  const absolutePath = path.join(ROOT, relativePath)
  assert(fs.existsSync(absolutePath), `artifact missing: ${relativePath}`)
  assert(sha256File(absolutePath) === expected, `hash mismatch: ${relativePath}`)
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256")
  hash.update(fs.readFileSync(filePath))
  return hash.digest("hex")
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
