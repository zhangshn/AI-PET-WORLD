import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
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
  "earth-geospatial-complete-map-condition-runs",
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
const regionContract = readJson(REGION_CONTRACT_PATH);
const blueprint = readJson(path.join(ROOT, manifest.blueprintPath));
const director = readJson(path.join(ROOT, manifest.directorPath));
const visualFacts = readJson(
  path.join(ROOT, manifest.visualFactManifestPath),
);
const task = readJson(path.join(ROOT, manifest.taskPath));
const conditionManifest = readJson(
  path.join(ROOT, manifest.conditionManifestPath),
);
const conditionPack = readJson(path.join(ROOT, manifest.conditionPackPath));
const scopeAudit = readJson(path.join(ROOT, manifest.scopeAuditPath));
const lineage = readJson(path.join(ROOT, manifest.lineagePath));

assert(
  manifest.schemaVersion ===
    "earth-reference-complete-map-condition-run-v1",
  "manifest schema mismatch",
);
assert(
  manifest.status ===
    "complete_map_conditions_ready_rgb_authorization_required",
  "condition run is incomplete",
);
assert(
  manifest.contractId === CONTRACT_ID &&
    regionContract.contractId === CONTRACT_ID,
  "contract identity mismatch",
);
for (const [filePath, expectedHash] of [
  [manifest.blueprintPath, manifest.blueprintSha256],
  [manifest.directorPath, manifest.directorSha256],
  [manifest.visualFactManifestPath, manifest.visualFactManifestSha256],
  [manifest.taskPath, manifest.taskSha256],
  [manifest.taskManifestPath, manifest.taskManifestSha256],
  [manifest.conditionManifestPath, manifest.conditionManifestSha256],
  [manifest.conditionPackPath, manifest.conditionPackSha256],
  [manifest.scopeAuditPath, manifest.scopeAuditSha256],
  [manifest.lineagePath, manifest.lineageSha256],
]) {
  assertHash(filePath, expectedHash);
}

assert(
  blueprint.canvas.width === 1024 &&
    blueprint.canvas.height === 768 &&
    blueprint.canvas.frameScope === "complete_runtime_frame" &&
    blueprint.completeMapScopeRequired === true,
  "blueprint is not a native complete-map contract",
);
assert(
  blueprint.sourceRgbRead === false &&
    blueprint.sourceImageGeometryRead === false &&
    blueprint.sourceBlueprintReuse === false &&
    blueprint.sourceTransformReuse === false,
  "blueprint reused forbidden image or layout evidence",
);
assert(
  blueprint.geometry.focalBounds == null &&
    blueprint.semanticRules.siteSelectionPolicy ===
      "initial_natural_world_no_preset_home_site",
  "preset home-site semantics were detected",
);
assert(
  director.autonomyContract.presetHomeSite === false &&
    director.autonomyContract.presetActivityCenter === false &&
    director.autonomyContract.constructionClearing === false &&
    director.autonomyContract.focalAreaActive === false,
  "World Director autonomy contract mismatch",
);
assert(
  !JSON.stringify({ blueprint, director, task }).includes("home_center"),
  "stale home_center semantics entered the new condition package",
);
assert(
  task.drawingProcess.sourceImageGeometryRead === false &&
    task.drawingProcess.realMapGeometryRead === false,
  "task reads forbidden source geometry",
);
assert(
  conditionManifest.channelCount === 23 &&
    conditionPack.channels.length === 23 &&
    new Set(conditionPack.channels.map((entry) => entry.id)).size === 23,
  "condition package does not contain exactly 23 unique channels",
);
assert(
  scopeAudit.status === "complete_map_scope_passed" &&
    scopeAudit.passed === true &&
    scopeAudit.generatedImageCreated === false &&
    scopeAudit.computeStarted === false,
  "complete-map scope audit did not pass",
);
assert(
  manifest.completeMapScopePassed === true &&
    manifest.focalAreaNonZeroCount === 0,
  "complete-map or focal-area result mismatch",
);
assert(
  lineage.normalizationAlgorithm.copiesRealMapGeometry === false &&
    lineage.normalizationAlgorithm.copiesOsmGeometry === false &&
    lineage.normalizationAlgorithm.readsHistoricalRgb === false &&
    lineage.normalizationAlgorithm.usesHistoricalLayout === false &&
    lineage.normalizationAlgorithm.createsNewGameCoordinateGeometry === true,
  "condition lineage crossed the source-geometry boundary",
);
assert(
  manifest.outputBoundary.imageGenerationStarted === false &&
    manifest.outputBoundary.gpuTrainingStarted === false &&
    manifest.outputBoundary.rgbCreated === false &&
    manifest.outputBoundary.formalCandidateEligible === false &&
    manifest.outputBoundary.runtimeFrameEligible === false &&
    manifest.outputBoundary.canEnterWorld === false,
  "output boundary was violated",
);
assert(
  manifest.remainingBlockers.length === 0 &&
    manifest.nextRequiredAuthorization ===
      "owner_authorization_required_before_any_rgb_generation",
  "next authorization boundary is invalid",
);
assert(
  regionContract.status ===
    "complete_map_conditions_ready_rgb_authorization_required" &&
    regionContract.blockers.length === 0 &&
    regionContract.outputBoundary.completeMap23ChannelsCreated === true &&
    regionContract.outputBoundary.imageGenerationAuthorized === false,
  "region contract was not advanced correctly",
);

const focalChannel = conditionPack.channels.find(
  (entry) => entry.id === "focal_area",
);
assert(focalChannel, "focal_area channel missing");
const focal = await sharp(path.join(ROOT, focalChannel.path))
  .greyscale()
  .raw()
  .toBuffer();
assert(countNonZero(focal) === 0, "focal_area channel is not all-zero");

for (const channel of conditionPack.channels) {
  assertHash(channel.path, channel.sha256);
}

const database = new DatabaseSync(catalogPath, { readOnly: true });
const indexedArtifactRows = database
  .prepare("SELECT logical_path FROM artifacts WHERE run_id = ?")
  .all(manifest.runId);
const indexedEvents = database
  .prepare("SELECT COUNT(*) AS count FROM program_events WHERE run_id = ?")
  .get(manifest.runId).count;
database.close();
const indexedArtifactPaths = new Set(
  indexedArtifactRows.map((entry) => entry.logical_path),
);
const requiredIndexedPaths = [
  latest.runPath,
  manifest.blueprintPath,
  manifest.directorPath,
  manifest.visualFactManifestPath,
  manifest.taskPath,
  manifest.taskManifestPath,
  manifest.conditionManifestPath,
  manifest.conditionPackPath,
  manifest.scopeAuditPath,
  manifest.lineagePath,
  ...conditionPack.channels.map((entry) => entry.path),
];
for (const requiredPath of requiredIndexedPaths) {
  assert(
    indexedArtifactPaths.has(requiredPath),
    `SQLite artifact index is missing: ${requiredPath}`,
  );
}
assert(indexedEvents >= 2, "SQLite event index is incomplete");

console.log(
  JSON.stringify(
    {
      status: "earth_geospatial_complete_map_conditions_passed",
      runId: manifest.runId,
      manifestPath: projectPath(path.join(ROOT, latest.runPath)),
      conditionId: manifest.conditionId,
      channelCount: manifest.channelCount,
      completeMapScopePassed: manifest.completeMapScopePassed,
      focalAreaNonZeroCount: countNonZero(focal),
      exactRealWorldGeometryCarriedForward:
        manifest.exactRealWorldGeometryCarriedForward,
      historicalRgbRead: manifest.historicalRgbRead,
      indexedArtifacts: indexedArtifactPaths.size,
      requiredIndexedArtifacts: requiredIndexedPaths.length,
      indexedEvents,
      remainingBlockers: manifest.remainingBlockers,
      nextRequiredAuthorization: manifest.nextRequiredAuthorization,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function countNonZero(values) {
  let count = 0;
  for (const value of values) {
    if (value !== 0) count += 1;
  }
  return count;
}

function assertHash(relativePath, expectedHash) {
  const absolutePath = path.join(ROOT, relativePath);
  assert(fs.existsSync(absolutePath), `artifact missing: ${relativePath}`);
  assert(
    sha256File(absolutePath) === expectedHash,
    `artifact hash mismatch: ${relativePath}`,
  );
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
