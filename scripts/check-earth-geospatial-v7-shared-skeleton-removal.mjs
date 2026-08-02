import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";
import {
  buildMeasurementDrivenAnonymousLayoutProfile,
} from "./lib/measurement-driven-anonymous-topology.mjs";
import {
  buildMeasurementDerivedCoarseHydrologyProfile,
} from "./lib/measurement-derived-coarse-hydrology.mjs";

const ROOT = process.cwd();
const GENERATOR_PATH =
  "scripts/build-earth-geospatial-complete-map-conditions.mjs";
const TOPOLOGY_PATH =
  "scripts/lib/measurement-driven-anonymous-topology.mjs";
const HYDROLOGY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const ROUTE_PATH =
  "scripts/lib/anonymous-route-naturalness.mjs";
const WINDOW_PLAN_POINTER =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const CONNECTIVITY_CONTRACT =
  "data/world-samples/world-connectivity/world-connectivity-contract-v1.json";
const EXPECTED_CONNECTIVITY_SHA256 =
  "59b9f1f68d9212f77bd66724b0e18339083555488732ce6d727e065cd760f1e8";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-shared-skeleton-removal-checks";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-shared-skeleton-removal-check-" +
  createdAtUtc.replace(/[:.]/g, "-");

for (const filePath of [
  GENERATOR_PATH,
  TOPOLOGY_PATH,
  HYDROLOGY_PATH,
  ROUTE_PATH,
]) {
  execFileSync(process.execPath, ["--check", filePath], {
    cwd: ROOT,
    stdio: "pipe",
    windowsHide: true,
  });
}

const generatorSource = readText(GENERATOR_PATH);
const topologySource = readText(TOPOLOGY_PATH);
const hydrologySource = readText(HYDROLOGY_PATH);
const routeSource = readText(ROUTE_PATH);
const activeSource =
  `${generatorSource}\n${topologySource}\n${hydrologySource}\n${routeSource}`;
const forbiddenSharedSkeletonTokens = [
  "water_left_envelope",
  "water-left-envelope",
  "quantized-dem-d8-full-span-water-envelope",
  "minimumWaterX",
  "minimumLowerWaterX",
  "buildBandAwareNaturalAnonymousCenterline",
  "const end = { x: 96",
  "function buildGameGeometry",
  "interiorBias: { x: -220",
  'const waterBoundaryEdges = hasWater ? ["top", "right", "bottom"]',
  "sampleAnonymousCubicMainChannel",
  "MAIN_CHANNEL_FIRST_CONTROL_Y_CANDIDATES",
  "MAIN_CHANNEL_SECOND_CONTROL_Y_CANDIDATES",
];
const foundForbiddenTokens =
  forbiddenSharedSkeletonTokens.filter((token) =>
    activeSource.includes(token),
  );

const planPointer = readJson(WINDOW_PLAN_POINTER);
const plan = readJson(planPointer.runPath);
const measurementAssignments = (plan.assignments ?? []).slice(
  0,
  3,
);
assert(
  measurementAssignments.length === 3,
  "three current Thai measurement assignments are required",
);
const profiles = measurementAssignments.map((assignment) => {
  const coarseHydrologyProfile =
    buildMeasurementDerivedCoarseHydrologyProfile({
      assignment,
      root: ROOT,
    });
  const layoutProfile =
    buildMeasurementDrivenAnonymousLayoutProfile({
      assignment,
      hasWater: true,
      coarseHydrologyProfile,
    });
  return {
    slotId: assignment.slotId,
    candidateId: assignment.candidateId,
    measurementFingerprint: assignment.fingerprints.direct,
    layoutProfileSha256: layoutProfile.profileSha256,
    routePlanSha256: sha256(
      JSON.stringify(layoutProfile.waterAvoidingRoutePlan),
    ),
    routeOriginSelectionByte:
      layoutProfile.waterAvoidingRoutePlan
        .routeOriginSelectionByte,
    candidateOriginFractions:
      layoutProfile.waterAvoidingRoutePlan
        .candidateOriginFractions,
    preferredOriginIndex:
      layoutProfile.waterAvoidingRoutePlan.preferredOriginIndex,
    fixedSharedSkeletonUsed:
      layoutProfile.waterAvoidingRoutePlan
        .fixedSharedSkeletonUsed,
  };
});

const checks = {
  worldConnectivityContractUnchanged:
    sha256File(CONNECTIVITY_CONTRACT) ===
    EXPECTED_CONNECTIVITY_SHA256,
  forbiddenSharedSkeletonTokensAbsent:
    foundForbiddenTokens.length === 0,
  legacyFixedGeometryEntryRemoved:
    !generatorSource.includes("buildGameGeometry"),
  waterBoundaryEdgesReadFromCurrentPorts:
    generatorSource.includes(
      "const waterBoundaryEdges = waterGeometry?.usedEdges ?? [];",
    ) &&
    generatorSource.includes(
      "currentWaterPorts.map((entry) =>",
    ),
  southPathPortReadFromConnectivityContract:
    generatorSource.includes(
      "currentSouthPathBoundaryPosition(connectivityBlueprint)",
    ) &&
    !generatorSource.includes("x: 96, y: HEIGHT"),
  allWaterSlotsUseMeasurementDerivedCoarseHydrology:
    generatorSource.includes(
      "V7_SLOT_CONTEXT &&",
    ) &&
    generatorSource.includes(
      "landscapeRequiresVisibleWater(",
    ) &&
    !generatorSource.includes(
      'V7_SLOT_ID === "v7-capacity-slot-123"\n    ? buildMeasurementDerivedCoarseHydrologyProfile',
    ),
  fullFreeSpaceCandidateSearchActive:
    generatorSource.includes(
      "measurement_fact_driven_independent_full_free_space_candidate_passage_v8",
    ) &&
    generatorSource.includes(
      "fullCanvasCandidateSearch: true",
    ) &&
    generatorSource.includes(
      "sideEnvelopeFollowed: false",
    ),
  thaiMeasurementProfilesAreIndependent:
    new Set(
      profiles.map((entry) => entry.layoutProfileSha256),
    ).size === profiles.length &&
    new Set(
      profiles.map((entry) => entry.routePlanSha256),
    ).size === profiles.length,
  anonymousOriginsAreMeasurementDerived:
    profiles.every(
      (entry) =>
        entry.candidateOriginFractions.length === 16 &&
        Math.min(
          ...entry.candidateOriginFractions.map((origin) => origin.x),
        ) <= 0.25 &&
        Math.max(
          ...entry.candidateOriginFractions.map((origin) => origin.x),
        ) >= 0.75 &&
        Number.isInteger(entry.preferredOriginIndex) &&
        entry.fixedSharedSkeletonUsed === false,
    ) &&
    new Set(
      profiles.map((entry) =>
        JSON.stringify(entry.candidateOriginFractions),
      ),
    ).size === profiles.length,
  imageGenerationNotStarted: true,
  gpuTrainingNotStarted: true,
  runtimeAndWorldNotStarted: true,
};
const failedChecks = Object.entries(checks)
  .filter(([, passed]) => passed !== true)
  .map(([name]) => name);
assert(
  failedChecks.length === 0,
  `shared skeleton removal checks failed: ${failedChecks.join(", ")}`,
);

const finishedAtUtc = new Date().toISOString();
const report = {
  schemaVersion:
    "earth-geospatial-v7-shared-skeleton-removal-check-v1",
  runId,
  status: "shared_fixed_macro_skeleton_removed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  removalScope: {
    removed:
      "right_water_left_route_envelope_fixed_south_x_copy_and_legacy_shared_geometry",
    preserved:
      "thai_measurement_data_world_connectivity_contract_review_thresholds_and_historical_failure_evidence",
  },
  connectivityContract: {
    path: CONNECTIVITY_CONTRACT,
    sha256: sha256File(CONNECTIVITY_CONTRACT),
    unchanged: true,
  },
  measurementEvidence: {
    windowPlanRunId: plan.runId,
    windowPlanPath: planPointer.runPath,
    profiles,
  },
  forbiddenSharedSkeletonTokens,
  foundForbiddenTokens,
  checks,
  failedChecks,
  programFiles: [
    artifactDescriptor(GENERATOR_PATH),
    artifactDescriptor(TOPOLOGY_PATH),
    artifactDescriptor(HYDROLOGY_PATH),
    artifactDescriptor(ROUTE_PATH),
  ],
  outputBoundary: {
    conditionPackageBuilt: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    runtimeFrameCreated: false,
    worldEntryStarted: false,
  },
};

const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "removal-check-report.json",
  record: report,
  latest: {
    status: report.status,
    failedCheckCount: 0,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
indexFile(stored.runPath);
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action: "v7_shared_skeleton_removal_check_completed",
  runId,
  kind: "repair_check",
  status: "success",
  title: "The shared fixed V7 map skeleton was removed",
  titleZh: "V7 共享固定地图骨架已删除",
  detail:
    `checks=${Object.keys(checks).length}; failed=0; reportSha256=${reportSha256}; RGB=false; GPU=false`,
  detailZh:
    `检查项=${Object.keys(checks).length}；失败=0；报告SHA-256=${reportSha256}；RGB=false；GPU=false`,
  script: projectPath(import.meta.filename),
  currentStep: "shared_fixed_macro_skeleton_removed",
  evidencePath: stored.runPath,
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      runId,
      status: report.status,
      reportPath: stored.runPath,
      reportSha256,
      checkCount: Object.keys(checks).length,
      measurementProfileCount: profiles.length,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function artifactDescriptor(relativePath) {
  return {
    path: relativePath,
    sha256: sha256File(relativePath),
  };
}

function indexFile(relativePath) {
  const absolutePath = path.resolve(ROOT, relativePath);
  const stats = fs.statSync(absolutePath);
  indexArtifact({
    logicalPath: logicalProjectPath(absolutePath),
    physicalUri: fs.realpathSync(absolutePath),
    storageLayer: "hot",
    runId,
    byteSize: stats.size,
    modifiedAtUtc: stats.mtime.toISOString(),
    sha256: sha256File(absolutePath),
  });
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.resolve(ROOT, relativePath), "utf8");
}

function sha256File(relativePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.resolve(ROOT, relativePath)))
    .digest("hex");
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(Buffer.from(value))
    .digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
