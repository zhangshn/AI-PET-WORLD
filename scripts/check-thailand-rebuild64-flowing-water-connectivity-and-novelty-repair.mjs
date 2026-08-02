import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SLOT_IDS = ["v7-capacity-slot-190", "v7-capacity-slot-194"];
const EXPECTED_CONDITION_IDS = new Map([
  ["v7-capacity-slot-190", "earth-reference-v7-v7-capacity-slot-190-bf401ca67784"],
  ["v7-capacity-slot-194", "earth-reference-v7-v7-capacity-slot-194-1e94c6f96b41"],
]);
const EXPECTED_PATH_ENTRANCE_SIDES = new Map([
  ["v7-capacity-slot-190", "east"],
  ["v7-capacity-slot-194", "west"],
]);
const SUPERSEDED_RECORD_IDS = [
  "ai-cold-start-v7-v7-capacity-slot-190-wet-season-drainage-hollow-v3",
  "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v3",
  "ai-cold-start-v7-v7-capacity-slot-190-wet-season-drainage-hollow-v4",
  "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v4",
];

const results = [];
for (const slotId of SLOT_IDS) {
  const manifest = latestSuccessfulManifest(slotId);
  assert(
    manifest.conditionId === EXPECTED_CONDITION_IDS.get(slotId),
    `${slotId} latest condition identity mismatch`,
  );
  const connectivity = readJson(manifest.connectivityBlueprintPath);
  const currentRegionId = connectivity.currentRegion.regionId;
  const pathPorts = connectivity.edgePorts.filter(
    (entry) => entry.regionId === currentRegionId && entry.kind === "path",
  );
  assert(pathPorts.length === 1, `${slotId} must have exactly one path entrance`);
  assert(
    pathPorts[0].boundarySide === EXPECTED_PATH_ENTRANCE_SIDES.get(slotId),
    `${slotId} path entrance does not match the canonical 64-image definition`,
  );
  const waterPorts = connectivity.edgePorts.filter(
    (entry) => entry.regionId === currentRegionId && entry.kind === "water",
  );
  assert(waterPorts.length === 2, `${slotId} must have exactly two current-region water ports`);
  const upstream = waterPorts.find(
    (entry) => entry.boundarySide === "north" && entry.flowRole === "inlet",
  );
  const downstream = waterPorts.find(
    (entry) => entry.boundarySide === "south" && entry.flowRole === "outlet",
  );
  assert(upstream && downstream, `${slotId} upstream/downstream water ports are incomplete`);
  assert(
    upstream.connectsToRegionId && upstream.connectsToEdgePortId &&
      downstream.connectsToRegionId && downstream.connectsToEdgePortId,
    `${slotId} water ports are not paired to neighbor regions`,
  );
  assert(
    connectivity.hydrologyGraph.upstreamPortId === upstream.edgePortId &&
      connectivity.hydrologyGraph.downstreamPortId === downstream.edgePortId &&
      connectivity.hydrologyGraph.flowAxis === "north_to_south",
    `${slotId} hydrology graph flow contract mismatch`,
  );

  const conditionPack = readJson(manifest.conditionPackPath);
  const waterChannel = conditionPack.channels.find((entry) => entry.id === "terrain_water");
  assert(waterChannel, `${slotId} terrain_water channel is missing`);
  const boundary = await boundaryContacts(waterChannel.path);
  assert(
    boundary.north > 0 && boundary.south > 0 &&
      boundary.east === 0 && boundary.west === 0,
    `${slotId} water raster does not satisfy the north-in/south-out boundary contract`,
  );

  const novelty = latestPassedNoveltyAudit(
    slotId,
    projectPath(path.join(
      path.dirname(resolveProjectPath(manifest.conditionPackPath)),
      "condition-guide.png",
    )),
  );
  const task = readJson(manifest.taskPath);
  results.push({
    slotId,
    conditionId: manifest.conditionId,
    measurementWindowId: task.v7SlotBinding?.candidateId ?? null,
    pathEntranceSide: pathPorts[0].boundarySide,
    waterBoundaryContacts: boundary,
    preRgbNoveltyAuditPath: novelty.path,
    preRgbMatchedRecordCount: novelty.report.matchedRecordIds?.length ?? 0,
  });
}

const frameworkPointer = readJson(
  ".runtime/ai-painter/earth-geospatial-v7-capacity-146-209-complete-framework-audits/latest.json",
);
const framework = readJson(frameworkPointer.runPath);
assert(
  framework.status === "all_64_packages_passed_full_world_dynamic_readiness_framework_standard" &&
    framework.summary?.auditedTargetPackageCount === 64 &&
    framework.summary?.distinctPairCount === 2016 &&
    framework.summary?.hardFailurePairCount === 0 &&
    framework.summary?.waterVisualTrainingMotifDuplicatePairCount === 0,
  "current64 framework regression failed",
);

for (const recordId of SUPERSEDED_RECORD_IDS) {
  const record = readJson(
    `data/world-samples/original-image-library/natural-home-v1/complete-maps/${recordId}/record.json`,
  );
  assert(record.status === "rejected", `${recordId} is not in the failed group`);
  assert(
    record.reviews?.machineReviewStatus === "machine_rejected" &&
      record.reviews?.ownerReviewStatus === "not_reached_machine_failed",
    `${recordId} rejection evidence is incomplete`,
  );
}

console.log(JSON.stringify({
  ok: true,
  status: "flowing_water_connectivity_and_all_history_novelty_repair_passed",
  current64DistinctPairCount: framework.summary.distinctPairCount,
  current64HardFailurePairCount: framework.summary.hardFailurePairCount,
  supersededRejectedRecordCount: SUPERSEDED_RECORD_IDS.length,
  rgbGeneratedByRepairCheck: 0,
  results,
}, null, 2));

function latestSuccessfulManifest(slotId) {
  const root = resolveProjectPath(
    ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs",
  );
  const prefix = `earth-geospatial-v7-slot-condition-${slotId}-`;
  const candidates = fs.readdirSync(root)
    .filter((entry) => entry.startsWith(prefix))
    .map((entry) => path.join(root, entry, "complete-map-condition-run.json"))
    .filter((entry) => fs.existsSync(entry))
    .map((entry) => readJson(entry))
    .filter((entry) => entry.status === "complete_map_conditions_ready_rgb_authorization_required")
    .sort((left, right) => right.createdAtUtc.localeCompare(left.createdAtUtc));
  assert(candidates.length > 0, `no successful condition manifest found for ${slotId}`);
  return candidates[0];
}

function latestPassedNoveltyAudit(slotId, guidePath) {
  const root = resolveProjectPath(
    ".runtime/ai-painter/ai-assisted-pre-rgb-condition-guide-novelty-audits",
  );
  const prefix = `ai-assisted-pre-rgb-condition-guide-novelty-${slotId}-`;
  const candidates = fs.readdirSync(root)
    .filter((entry) => entry.startsWith(prefix))
    .map((entry) => ({
      path: projectPath(path.join(root, entry, "audit-report.json")),
      report: readJson(path.join(root, entry, "audit-report.json")),
    }))
    .filter(({ report }) =>
      report.passed === true &&
      report.sourceRecordId === slotId &&
      report.candidateGuidePath === guidePath,
    )
    .sort((left, right) => right.report.createdAtUtc.localeCompare(left.report.createdAtUtc));
  assert(candidates.length > 0, `${slotId} has no passing all-history pre-RGB novelty audit`);
  return candidates[0];
}

async function boundaryContacts(imagePath) {
  const { data, info } = await sharp(resolveProjectPath(imagePath))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const countRow = (y) => {
    let count = 0;
    for (let x = 0; x < info.width; x += 1) count += data[y * info.width + x] > 0 ? 1 : 0;
    return count;
  };
  const countColumn = (x) => {
    let count = 0;
    for (let y = 0; y < info.height; y += 1) count += data[y * info.width + x] > 0 ? 1 : 0;
    return count;
  };
  return {
    north: countRow(0),
    east: countColumn(info.width - 1),
    south: countRow(info.height - 1),
    west: countColumn(0),
  };
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"));
}
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value);
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`);
  return resolved;
}
function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/");
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
