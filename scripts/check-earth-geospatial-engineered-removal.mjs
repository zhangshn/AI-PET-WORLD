import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { projectPath } from "./lib/ai-painter-program-event-store.mjs";
import { catalogPath } from "./lib/ai-pet-world-storage.mjs";

const ROOT = process.cwd();
const SOURCE_ID = "openstreetmap-overpass-engineered-feature-removal-v1";
const LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-engineered-removal-runs",
  "latest.json",
);
const SOURCE_REGISTRY_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "source-registry",
  "earth-geospatial-source-registry-v1.json",
);
const REGION_CONTRACT_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "regions",
  "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1",
  "region-contract.json",
);

const latest = readJson(LATEST_PATH);
const manifestPath = path.join(ROOT, latest.runPath);
const manifest = readJson(manifestPath);
const sourceRegistry = readJson(SOURCE_REGISTRY_PATH);
const regionContract = readJson(REGION_CONTRACT_PATH);

assert(
  manifest.schemaVersion === "earth-geospatial-engineered-removal-manifest-v1",
  "engineered-removal manifest schema mismatch",
);
assert(
  manifest.status === "engineered_feature_removal_evidence_compiled",
  "engineered-removal run is incomplete",
);
assert(
  manifest.source.sourceId === SOURCE_ID,
  "approved OSM source identity mismatch",
);
assert(
  manifest.source.license === "Open Database License (ODbL) 1.0",
  "OSM licence is missing",
);
assert(
  manifest.source.attribution === "© OpenStreetMap contributors",
  "OSM attribution is missing",
);
assertHash(manifest.source.queryPath, manifest.source.querySha256);
assertHash(manifest.source.rawResponsePath, manifest.source.rawResponseSha256);
assertHash(manifest.inventory.path, manifest.inventory.sha256);
assertHash(manifest.attemptsPath, manifest.attemptsSha256);

assert(manifest.masks.length === 7, "seven classified masks are required");
for (const mask of manifest.masks) {
  assert(
    mask.width === 1024 && mask.height === 768,
    "mask dimensions mismatch",
  );
  assert(mask.exactSourceGeometryOnly === true, "mask geometry was altered");
  assert(
    mask.bufferApplied === false,
    "unapproved geometry buffer was applied",
  );
  assertHash(mask.path, mask.sha256);
  const bytes = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, mask.path)));
  assert(
    bytes.length === 1024 * 768,
    `mask payload mismatch: ${mask.category}`,
  );
}
assert(
  manifest.masks.find((item) => item.category === "all_engineered")
    ?.nonZeroPixelCount > 0,
  "combined engineered removal mask is empty",
);
assert(
  manifest.evidenceContract.prohibitedUses.includes("rgb_training_target") &&
    manifest.evidenceContract.prohibitedUses.includes(
      "final_world_fact_geometry",
    ),
  "OSM use boundary is incomplete",
);
assert(
  manifest.outputBoundary.imageGenerationStarted === false &&
    manifest.outputBoundary.gpuTrainingStarted === false &&
    manifest.outputBoundary.rgbCreated === false &&
    manifest.outputBoundary.derivedWorldFactsCreated === false,
  "output boundary was violated",
);
assert(
  !manifest.remainingBlockers.includes(
    "engineered_linear_feature_removal_evidence_missing",
  ),
  "engineered-removal blocker was not closed",
);
assert(
  manifest.remainingBlockers.includes("derived_world_facts_missing") &&
    manifest.remainingBlockers.includes("complete_map_23_channels_missing"),
  "downstream blockers were closed too early",
);

const source = sourceRegistry.sources.find(
  (item) => item.sourceId === SOURCE_ID,
);
assert(source, "OSM source is absent from the source registry");
assert(
  source.visualTrainingTargetEligible === false &&
    source.finalWorldFactGeometryEligible === false,
  "OSM source eligibility boundary is invalid",
);
assert(
  regionContract.inputs.some((item) => item.sourceId === SOURCE_ID),
  "region contract does not reference the OSM source",
);
assert(
  regionContract.humanRemovalRules?.evidence?.sourceId === SOURCE_ID,
  "region contract removal evidence is missing",
);
assert(
  !regionContract.blockers.includes(
    "engineered_linear_feature_removal_evidence_missing",
  ),
  "region contract retained the closed engineered-removal blocker",
);

const database = new DatabaseSync(catalogPath, { readOnly: true });
const indexedArtifacts = database
  .prepare("SELECT COUNT(*) AS count FROM artifacts WHERE run_id = ?")
  .get(manifest.runId).count;
const indexedEvents = database
  .prepare("SELECT COUNT(*) AS count FROM program_events WHERE run_id = ?")
  .get(manifest.runId).count;
database.close();
assert(indexedArtifacts >= 13, "SQLite artifact index is incomplete");
assert(indexedEvents >= 2, "SQLite program-event index is incomplete");

console.log(
  JSON.stringify(
    {
      status: "earth_geospatial_engineered_removal_passed",
      runId: manifest.runId,
      manifestPath: projectPath(manifestPath),
      featureCount: manifest.inventory.featureCount,
      categoryCounts: manifest.inventory.categoryCounts,
      maskCounts: Object.fromEntries(
        manifest.masks.map((item) => [item.category, item.nonZeroPixelCount]),
      ),
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

function assertHash(relativePath, expected) {
  const absolutePath = path.join(ROOT, relativePath);
  assert(fs.existsSync(absolutePath), `artifact missing: ${relativePath}`);
  assert(
    sha256File(absolutePath) === expected,
    `hash mismatch: ${relativePath}`,
  );
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
