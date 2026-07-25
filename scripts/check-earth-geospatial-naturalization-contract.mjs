import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const DATA_ROOT = path.join(ROOT, "data", "world-samples", "earth-geospatial")
const SOURCE_REGISTRY_PATH = path.join(DATA_ROOT, "source-registry", "earth-geospatial-source-registry-v1.json")
const REGION_CONTRACT_PATH = path.join(
  DATA_ROOT,
  "regions",
  "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1",
  "region-contract.json",
)
const NASA_POWER_RAW_PATH = path.join(path.dirname(REGION_CONTRACT_PATH), "sources", "nasa-power-climatology.json")
const LATEST_PATH = path.join(ROOT, ".runtime", "ai-painter", "earth-geospatial-naturalization-preflights", "latest.json")

const sourceRegistry = readJson(SOURCE_REGISTRY_PATH)
const regionContract = readJson(REGION_CONTRACT_PATH)
const latest = readJson(LATEST_PATH)
const rawClimateBytes = fs.readFileSync(NASA_POWER_RAW_PATH)

assert(sourceRegistry.sourceRegistryId === "earth-geospatial-source-registry-v1", "source registry identity mismatch")
assert(sourceRegistry.sources.length === 4, "expected four source classes")
assert(sourceRegistry.sources.every((source) => source.visualTrainingTargetEligible === false), "external measurement cannot be RGB target")
assert(sourceRegistry.policy.measurementsMayDeriveWorldFacts === true, "measurement derivation policy missing")
assert(sourceRegistry.policy.externalRgbMayBecomeTrainingTarget === false, "external RGB boundary missing")
assert(regionContract.contractId === "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1", "region contract identity mismatch")
assert(regionContract.outputBoundary.imageGenerationAuthorized === false, "image generation must remain blocked")
assert(regionContract.outputBoundary.gpuTrainingAuthorized === false, "GPU training must remain blocked")
assert(regionContract.outputBoundary.derivedNaturalFactRequiresAudit === true, "derived fact audit gate missing")
assert(regionContract.humanRemovalRules.remove.includes("buildings"), "building removal rule missing")
assert(regionContract.humanRemovalRules.remove.includes("engineered_roads"), "engineered road removal rule missing")
assert(regionContract.humanRemovalRules.remove.includes("cropland_geometry"), "cropland removal rule missing")
if (regionContract.observationArea.status === "compiled") {
  assert(
    !regionContract.blockers.includes("geotiff_window_reader_not_implemented"),
    "completed GeoTIFF reader must not remain blocked",
  )
  assert(
    regionContract.blockers.includes(
      "engineered_linear_feature_removal_evidence_missing",
    ),
    "engineered linear-feature blocker missing",
  )
  assert(
    regionContract.blockers.includes("derived_world_facts_missing"),
    "derived WorldFacts blocker missing",
  )
} else {
  assert(
    regionContract.blockers.includes("geotiff_window_reader_not_implemented"),
    "GeoTIFF reader blocker must remain explicit during preflight",
  )
}
assert(latest.status === "source_preflight_passed", "latest preflight did not pass")

const climateSource = sourceRegistry.sources.find((source) => source.sourceId === "nasa-power-climatology-sakaerat-point-v1")
assert(climateSource, "NASA POWER source missing")
assert(climateSource.rawResponseSha256 === sha256(rawClimateBytes), "NASA POWER raw response hash mismatch")
const climate = JSON.parse(rawClimateBytes.toString("utf8"))
assert(climate.geometry?.coordinates?.length >= 2, "NASA POWER coordinate missing")
assert(climate.properties?.parameter?.PRECTOTCORR, "NASA POWER precipitation data missing")
assert(climate.properties?.parameter?.T2M, "NASA POWER temperature data missing")
const acquiredSourceCount = sourceRegistry.sources.filter((source) =>
  source.acquisitionStatus.includes("acquired"),
).length
if (regionContract.observationArea.status === "compiled") {
  assert(acquiredSourceCount === 4, "compiled stage requires all four sources")
  assert(
    regionContract.inputs.every((input) =>
      input.acquisitionStatus.includes("acquired"),
    ),
    "region input acquisition statuses are stale",
  )
}

console.log(
  JSON.stringify(
    {
      status: "earth_geospatial_naturalization_contract_passed",
      sourceRegistryId: sourceRegistry.sourceRegistryId,
      contractId: regionContract.contractId,
      verifiedSourceCount: sourceRegistry.sources.length,
      acquiredRawSourceCount: acquiredSourceCount,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
      derivedWorldFactsCreated: false,
      blockers: regionContract.blockers,
    },
    null,
    2,
  ),
)

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
