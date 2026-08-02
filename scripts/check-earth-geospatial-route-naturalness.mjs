import fs from "node:fs";
import path from "node:path";
import {
  auditAnonymousRouteNaturalness,
  buildAnonymousRouteNaturalnessProfile,
  buildNaturalAnonymousCenterline,
} from "./lib/anonymous-route-naturalness.mjs";

const ROOT = process.cwd();
const REJECTED_RECORD_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "original-image-library",
  "natural-home-v1",
  "complete-maps",
  "ai-cold-start-v7-v7-capacity-slot-119-monsoon-grassland-v1",
  "record.json",
);
const ENGINEERED_REMOVAL_LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-engineered-removal-runs",
  "latest.json",
);

const rejectedRecord = readJson(REJECTED_RECORD_PATH);
assert(
  rejectedRecord.reviews?.ownerReviewStatus === "owner_rejected",
  "slot-119 owner rejection evidence is missing",
);
const rejectedTask = readJson(
  path.join(ROOT, rejectedRecord.conditionBinding.taskPackagePath),
);
const rejectedBlueprint = readJson(
  path.join(ROOT, rejectedTask.sourceBindings.trainingBlueprintPath),
);

const removalLatest = readJson(ENGINEERED_REMOVAL_LATEST_PATH);
const removalManifest = readJson(path.join(ROOT, removalLatest.runPath));
const rawOsm = readJson(
  path.join(ROOT, removalManifest.source.rawResponsePath),
);
const profile = buildAnonymousRouteNaturalnessProfile({
  rawOsm,
  createdAtUtc: "regression-check",
  createdAtAsiaShanghai: "regression-check",
  source: {
    provider: removalManifest.source.provider,
    license: removalManifest.source.license,
    rawResponsePath: removalManifest.source.rawResponsePath,
    rawResponseSha256: removalManifest.source.rawResponseSha256,
  },
});

const rejectedAudit = auditAnonymousRouteNaturalness(
  rejectedBlueprint.geometry.pathCenterline,
  profile,
);
assert(
  rejectedAudit.passed === false &&
    rejectedAudit.failures.includes(
      "route_centerline_point_density_insufficient",
    ) &&
    rejectedAudit.failures.includes("route_centerline_segment_too_long"),
  "the owner-rejected rigid slot-119 route was not caught",
);

const random = mulberry32(0x119_2026);
const repairedRoute = buildNaturalAnonymousCenterline({
  start: rejectedBlueprint.geometry.pathCenterline[0],
  end: rejectedBlueprint.geometry.pathCenterline.at(-1),
  random,
  width: 1024,
  height: 768,
  profile,
});
assert(
  repairedRoute.audit.passed === true &&
    repairedRoute.audit.failures.length === 0,
  "the repaired anonymous route did not pass naturalness review",
);
assert(
  profile.source.coordinatesPersistedInProfile === false &&
    profile.source.exactGeometryCopied === false &&
    profile.identityBoundary.exactOsmGeometryCarriedForward === false,
  "the aggregate route profile crossed the OSM geometry boundary",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      status: "earth_geospatial_route_naturalness_regression_passed",
      publicEvidence: {
        provider: profile.source.provider,
        license: profile.source.license,
        sourceWayCount: profile.selection.sourceWayCount,
        measurableWayCount: profile.selection.measurableWayCount,
        aggregateStatistics: profile.aggregateStatistics,
        coordinatesPersistedInProfile:
          profile.source.coordinatesPersistedInProfile,
        exactGeometryCopied: profile.source.exactGeometryCopied,
      },
      rejectedSlot119Audit: rejectedAudit,
      repairedAnonymousRouteAudit: repairedRoute.audit,
      rgbCreated: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function mulberry32(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
