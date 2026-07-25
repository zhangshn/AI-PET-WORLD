import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { projectPath } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-naturalization-runs",
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
  manifest.schemaVersion ===
    "earth-geospatial-measurement-window-manifest-v1",
  "measurement manifest schema mismatch",
)
assert(manifest.status === "measurement_window_compiled", "run not complete")
assert(
  manifest.canvasNormalization.width === 1024 &&
    manifest.canvasNormalization.height === 768,
  "normalized canvas mismatch",
)
assert(
  manifest.canvasNormalization.runtimeMetresPerPixelDefined === false,
  "runtime metres-per-pixel must remain undefined",
)
assert(
  manifest.outputBoundary.imageGenerationStarted === false &&
    manifest.outputBoundary.gpuTrainingStarted === false &&
    manifest.outputBoundary.rgbCreated === false,
  "RGB or GPU boundary violated",
)
assert(
  manifest.outputBoundary.derivedWorldFactsCreated === false,
  "measurement window must not claim derived WorldFacts",
)
assert(
  manifest.humanRemoval.removedPixelCount > 0,
  "human-removal mask is empty",
)
assert(
  manifest.humanRemoval.engineeredLinearFeaturesCovered === false,
  "linear-feature coverage must remain blocked",
)
assert(
  regionContract.observationArea.status === "compiled",
  "region observation extent was not persisted",
)
assert(
  regionContract.blockers.includes(
    "engineered_linear_feature_removal_evidence_missing",
  ),
  "required human linear-feature blocker missing",
)

const paths = [
  manifest.rasterWindows.elevation.outputPath,
  manifest.rasterWindows.landCover.outputPath,
  manifest.humanRemoval.naturalizedLandCoverPath,
  manifest.humanRemoval.removalMaskPath,
]
for (const relativePath of paths) {
  const absolutePath = path.join(ROOT, relativePath)
  assert(fs.existsSync(absolutePath), `artifact missing: ${relativePath}`)
}
assertHash(
  manifest.rasterWindows.elevation.outputPath,
  manifest.rasterWindows.elevation.outputSha256,
)
assertHash(
  manifest.rasterWindows.landCover.outputPath,
  manifest.rasterWindows.landCover.outputSha256,
)
assertHash(
  manifest.humanRemoval.naturalizedLandCoverPath,
  manifest.humanRemoval.naturalizedLandCoverSha256,
)
assertHash(
  manifest.humanRemoval.removalMaskPath,
  manifest.humanRemoval.removalMaskSha256,
)

console.log(
  JSON.stringify(
    {
      status: "earth_geospatial_measurement_window_passed",
      runId: manifest.runId,
      manifestPath: projectPath(path.join(ROOT, latest.runPath)),
      bounds: manifest.observationExtent.bounds,
      elevation: manifest.rasterWindows.elevation.statistics,
      removedPixelCount: manifest.humanRemoval.removedPixelCount,
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
  const actual = sha256File(absolutePath)
  assert(actual === expected, `hash mismatch: ${relativePath}`)
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
