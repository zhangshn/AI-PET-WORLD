import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { projectPath } from "./lib/ai-painter-program-event-store.mjs";
import { catalogPath } from "./lib/ai-pet-world-storage.mjs";

const ROOT = process.cwd();
const CONTRACT_ID =
  "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1";
const LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-naturalized-world-fact-runs",
  "latest.json",
);
const REGION_CONTRACT_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "regions",
  CONTRACT_ID,
  "region-contract.json",
);

const latest = readJson(LATEST_PATH);
const manifest = readJson(path.join(ROOT, latest.runPath));
const worldFacts = readJson(path.join(ROOT, manifest.worldFactsPath));
const lineage = readJson(path.join(ROOT, manifest.lineagePath));
const regionContract = readJson(REGION_CONTRACT_PATH);

assert(
  manifest.schemaVersion === "earth-reference-naturalized-world-fact-run-v1",
  "manifest schema mismatch",
);
assert(
  manifest.status === "naturalized_world_facts_compiled_conditions_pending",
  "WorldFacts run is incomplete",
);
assert(
  manifest.contractId === CONTRACT_ID &&
    worldFacts.contractId === CONTRACT_ID &&
    lineage.contractId === CONTRACT_ID,
  "contract identity mismatch",
);
assertHash(manifest.worldFactsPath, manifest.worldFactsSha256);
assertHash(manifest.lineagePath, manifest.lineageSha256);
assertHash(
  manifest.combinedHumanRemovalMaskPath,
  manifest.combinedHumanRemovalMaskSha256,
);
assertHash(
  manifest.reconstructedNaturalLandCoverPath,
  manifest.reconstructedNaturalLandCoverSha256,
);

const removalMask = readGzip(manifest.combinedHumanRemovalMaskPath);
const landCover = readGzip(manifest.reconstructedNaturalLandCoverPath);
assert(removalMask.length === 1024 * 768, "removal mask dimensions mismatch");
assert(landCover.length === 1024 * 768, "land-cover dimensions mismatch");
assert(
  countNonZero(removalMask) ===
    manifest.statistics.combinedHumanRemovalPixelCount,
  "combined human-removal pixel count mismatch",
);
assert(
  manifest.statistics.reconstructedPixelCount === countNonZero(removalMask),
  "not every human-influenced pixel was reconstructed",
);
assert(
  worldFacts.identityBoundary.exactRealWorldGeometryCarriedForward === false &&
    worldFacts.identityBoundary.exactRealWorldNavigationGeometryCreated ===
      false &&
    worldFacts.identityBoundary.exactOsmGeometryCarriedForward === false &&
    worldFacts.identityBoundary.finalGameCoordinateGeometryCreated === false,
  "real-world geometry boundary was violated",
);
assert(
  worldFacts.autonomyFacts.presetHomeSite === false &&
    worldFacts.autonomyFacts.presetActivityCenter === false &&
    worldFacts.autonomyFacts.presetConstructionClearing === false &&
    worldFacts.autonomyFacts.focalAreaActive === false &&
    worldFacts.autonomyFacts.focalAreaRequiredValue === "all_zero",
  "initial-world autonomy contract was violated",
);
assert(
  worldFacts.downstreamContract.completeMapScopeRequired === true &&
    worldFacts.downstreamContract.localCropAllowed === false,
  "complete-map boundary is missing",
);
assert(
  manifest.outputBoundary.derivedWorldFactsCreated === true &&
    manifest.outputBoundary.finalGameCoordinateGeometryCreated === false &&
    manifest.outputBoundary.worldDirectorOutputCreated === false &&
    manifest.outputBoundary.completeMap23ChannelsCreated === false &&
    manifest.outputBoundary.imageGenerationStarted === false &&
    manifest.outputBoundary.gpuTrainingStarted === false &&
    manifest.outputBoundary.rgbCreated === false,
  "output boundary was violated",
);
assert(
  manifest.remainingBlockers.length === 1 &&
    manifest.remainingBlockers[0] === "complete_map_23_channels_missing",
  "remaining blocker set is invalid",
);
const regionAtWorldFactsStage =
  regionContract.status ===
    "naturalized_world_facts_compiled_complete_map_conditions_pending" &&
  regionContract.blockers.length === 1 &&
  regionContract.blockers[0] === "complete_map_23_channels_missing";
const regionAtCompleteMapStage =
  regionContract.status ===
    "complete_map_conditions_ready_rgb_authorization_required" &&
  regionContract.blockers.length === 0 &&
  regionContract.outputBoundary?.naturalizedWorldFactsCompiled === true &&
  regionContract.outputBoundary?.completeMap23ChannelsCreated === true &&
  regionContract.measurementEvidence?.worldDirectorOutputCreated === true &&
  regionContract.measurementEvidence?.completeMap23ChannelsCreated === true &&
  regionContract.measurementEvidence?.completeMapScopePassed === true &&
  regionContract.measurementEvidence?.focalAreaNonZeroCount === 0 &&
  regionContract.measurementEvidence?.exactOsmGeometryCarriedForward === false;
assert(
  regionAtWorldFactsStage || regionAtCompleteMapStage,
  "region contract is neither at the WorldFacts stage nor a valid later complete-map stage",
);
assert(
  regionContract.measurementEvidence?.naturalizedWorldFactRunId ===
    manifest.runId,
  "region contract does not point to this WorldFacts run",
);

const database = new DatabaseSync(catalogPath, { readOnly: true });
const indexedArtifacts = database
  .prepare("SELECT COUNT(*) AS count FROM artifacts WHERE run_id = ?")
  .get(manifest.runId).count;
const indexedEvents = database
  .prepare("SELECT COUNT(*) AS count FROM program_events WHERE run_id = ?")
  .get(manifest.runId).count;
database.close();
assert(indexedArtifacts >= 6, "SQLite artifact index is incomplete");
assert(indexedEvents >= 2, "SQLite event index is incomplete");

console.log(
  JSON.stringify(
    {
      status: "earth_geospatial_naturalized_world_facts_passed",
      runId: manifest.runId,
      manifestPath: projectPath(path.join(ROOT, latest.runPath)),
      worldFactsPath: manifest.worldFactsPath,
      combinedHumanRemovalPixelCount:
        manifest.statistics.combinedHumanRemovalPixelCount,
      reconstructedPixelCount: manifest.statistics.reconstructedPixelCount,
      reliefClass:
        worldFacts.measuredNaturalFacts.relief.derivedClass,
      exactRealWorldGeometryCarriedForward: false,
      focalAreaActive: false,
      indexedArtifacts,
      indexedEvents,
      remainingBlockers: manifest.remainingBlockers,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function assertHash(relativePath, expectedHash) {
  const absolutePath = path.join(ROOT, relativePath);
  assert(fs.existsSync(absolutePath), `artifact missing: ${relativePath}`);
  assert(
    sha256File(absolutePath) === expectedHash,
    `artifact hash mismatch: ${relativePath}`,
  );
}

function readGzip(relativePath) {
  return zlib.gunzipSync(fs.readFileSync(path.join(ROOT, relativePath)));
}

function countNonZero(values) {
  let count = 0;
  for (const value of values) {
    if (value) count += 1;
  }
  return count;
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
