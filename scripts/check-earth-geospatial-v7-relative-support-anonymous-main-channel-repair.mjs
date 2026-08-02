import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";
import {
  COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
  COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY,
  COARSE_HYDROLOGY_PROFILE_SCHEMA,
  buildMeasurementDerivedAnonymousMainChannel,
  buildMeasurementDerivedCoarseHydrologyProfile,
  buildMeasurementDerivedNetworkHalfWidths,
} from "./lib/measurement-derived-coarse-hydrology.mjs";
import {
  MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
  buildMeasurementDrivenAnonymousLayoutProfile,
} from "./lib/measurement-driven-anonymous-topology.mjs";

const ROOT = process.cwd();
const SLOT_ID = "v7-capacity-slot-124";
const AUTHORIZATION_ID =
  "project-owner-authorized-fixed-shared-skeleton-removal-and-future-output-repair-20260729";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const CONNECTIVITY_BLUEPRINT_PATH =
  "data/world-samples/world-connectivity/blueprints/mainland-southeast-asia-tropical-monsoon-natural-home-v1/mainland-southeast-asia-earth-reference-natural-home-region-0001-v1/blueprint.json";
const HYDROLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const TOPOLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-driven-anonymous-topology.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-relative-support-main-channel-repair-checks";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-relative-support-main-channel-repair-check-" +
  createdAtUtc.replace(/[:.]/g, "-");

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action:
    "v7_relative_support_anonymous_main_channel_repair_check_started",
  runId,
  kind: "repair_check",
  status: "running",
  title:
    "The V7 relative-support anonymous main-channel repair check started",
  titleZh: "V7 相对水文支撑匿名主河道修复检查已启动",
  detail:
    "This no-RGB check verifies that the approved Thai DEM/D8 lateral and relative support bands continuously derive independent internal river geometry without a fixed family table and without reading historical RGB or geometry.",
  detailZh:
    "本次无 RGB 检查验证：已批准泰国 DEM/D8 横向与相对支撑分带共同选择四个固定匿名映射族之一，且不读取历史 RGB 或历史几何。",
  script: projectPath(import.meta.filename),
  currentStep: "relative_support_main_channel_repair_check_started",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const pointer = readJson(WINDOW_PLAN_POINTER_PATH);
const plan = readJson(pointer.runPath);
const waterPointer = readJson(WATER_PROFILE_POINTER_PATH);
const waterNaturalnessProfile = readJson(waterPointer.profilePath);
const connectivityBlueprint = readJson(CONNECTIVITY_BLUEPRINT_PATH);
const boundaryWaterPorts = readBoundaryWaterPorts(
  connectivityBlueprint,
);
const currentAssignment = plan.assignments.find(
  (entry) => entry.slotId === SLOT_ID,
);
assert(currentAssignment, "slot-123 measurement assignment is missing");

const measurementAssignments = [
  ...new Map(
    plan.assignments.map((assignment) => [
      assignment.fingerprints.direct,
      assignment,
    ]),
  ).values(),
];
const probeResults = measurementAssignments.map((assignment) =>
  buildProbeResult({
    assignment,
    waterNaturalnessProfile,
    boundaryWaterPorts,
  }),
);
const probes = probeResults
  .filter((entry) => entry.ok)
  .map((entry) => entry.probe);
const currentProbe = probes.find(
  (entry) => entry.slotId === SLOT_ID,
);
assert(currentProbe, "slot-123 repair probe is missing");

const repeatedCurrentProbeResult = buildProbeResult({
  assignment: structuredClone(currentAssignment),
  waterNaturalnessProfile,
  boundaryWaterPorts,
});
assert(
  repeatedCurrentProbeResult.ok,
  "repeated slot-123 repair probe is blocked",
);
const repeatedCurrentProbe = repeatedCurrentProbeResult.probe;
const librarySource = fs.readFileSync(
  path.resolve(ROOT, HYDROLOGY_LIBRARY_PATH),
  "utf8",
);
const topologySource = fs.readFileSync(
  path.resolve(ROOT, TOPOLOGY_LIBRARY_PATH),
  "utf8",
);
const macroSignatures = probes.map((entry) =>
  entry.bandCentroids
    .slice(1, -1)
    .map((value) =>
      value < 0.42 ? "L" : value < 0.62 ? "C" : "R",
    )
    .join(""),
);
const maximumPairwiseInteriorCentroidDistance =
  maximumPairwiseDistance(
    probes.map((entry) => entry.bandCentroids.slice(1, -1)),
  );

const checks = {
  approvedThaiMeasurementPlanBound:
    pointer.runId === plan.runId &&
    plan.contractId ===
      "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1" &&
    plan.authorizationId ===
      "owner-authorized-v7-mvp64-gap38-real-geography-bounded-data-build-20260725" &&
    measurementAssignments.length > 1 &&
    currentAssignment.fingerprints?.direct?.length === 64,
  versionedRelativeSupportContract:
    COARSE_HYDROLOGY_PROFILE_SCHEMA.endsWith("-v14") &&
    COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY.endsWith("_v17") &&
    MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID.endsWith("_v44"),
  continuousMeasurementMappingsAreNotSharedFamilyRows:
    new Set(
      probes.map((entry) => entry.mappingSelection.familyId),
    ).size > 1 &&
    new Set(
      probes.map((entry) =>
        sha256Json(entry.mappingSelection.familyParameters),
      ),
    ).size > 1,
  unchangedWaterAuditsEitherPassOrBlockEachMeasurement:
    probeResults.every(
      (entry) =>
        entry.ok ||
        [
          "unchanged_water_naturalness_audit_blocked",
          "measurement_support_incomplete_blocked",
        ].includes(entry.blockerCode),
    ) &&
    probes.every(
      (entry) =>
        entry.waterNaturalnessPassed &&
        entry.waterCorridorShapePassed &&
        entry.minimumBendRadiusToHalfWidthRatio >=
          entry.minimumRequiredBendRadiusToHalfWidthRatio,
    ),
  allEightLateralAndRelativeBandsPropagated:
    probes.every(
      (entry) =>
        entry.directEightBandSupportFractions.length === 8 &&
        entry.relativeEightBandSupportFractions.length === 8 &&
        entry.relativeSupportVariation > 0 &&
        entry.anonymousBandAnchors.length === 8 &&
        entry.anonymousBandAnchors.every(
          (anchor) =>
            Number.isFinite(
              anchor.relativeAnonymousSupportFraction,
            ) &&
            Number.isFinite(anchor.anonymousTargetFraction),
        ),
    ),
  thaiMeasurementsDriveContinuousInternalMapping:
    probes.every(
      (entry) =>
        entry.mappingSelection.method ===
          "thai_measurement_eight_band_support_and_digest_projection_to_independent_internal_river_mapping_without_fixed_family_table_v8" &&
        entry.mappingSelection.fixedFamilyTableUsed === false &&
        entry.mappingSelection.continuousMeasurementParametersUsed ===
          true &&
        entry.mappingSelection.familyIndex === null &&
        entry.mappingSelection.familyCount === null &&
        entry.mappingSelection.appliesToEveryCoarseHydrologyProfile ===
          true &&
        entry.mappingSelection.slotIdentityRead === false &&
        entry.mappingSelection.retrySeedRead === false,
    ),
  noHistoricalOrTransformShortcut:
    probes.every(
      (entry) =>
        entry.mappingSelection.historicalGeometryRead === false &&
        entry.mappingSelection.historicalRgbRead === false &&
        entry.mappingSelection.mirrorOrRotationTransformApplied ===
          false &&
        entry.identityBoundary.historicalLayoutRead === false &&
        entry.identityBoundary.historicalRgbRead === false &&
        entry.identityBoundary.exactD8GeometryCarriedForward ===
          false &&
        entry.identityBoundary.exactOsmGeometryCarriedForward ===
          false,
    ),
  fixedConnectivityPortsPreserved:
    probes.every(
      (entry) =>
        entry.firstPoint.x === boundaryWaterPorts.upstream.x &&
        entry.firstPoint.y === boundaryWaterPorts.upstream.y &&
        entry.lastPoint.x === boundaryWaterPorts.downstream.x &&
        entry.lastPoint.y === boundaryWaterPorts.downstream.y,
    ),
  completeMapRoutePlanUsesIndependentFullFreeSpaceOrigins:
    probes.every(
      (entry) =>
        entry.waterAvoidingRoutePlan.schemaVersion ===
          "measurement-driven-full-free-space-route-plan-v8" &&
        entry.waterAvoidingRoutePlan.routeTopology ===
          entry.routeTopology &&
        entry.waterAvoidingRoutePlan.method ===
          "measurement_selected_anonymous_origin_candidates_then_full_canvas_water_collision_rejection" &&
        entry.waterAvoidingRoutePlan
          .candidateOriginFractions?.length === 16 &&
        Math.min(
          ...entry.waterAvoidingRoutePlan.candidateOriginFractions.map(
            (origin) => origin.x,
          ),
        ) <= 0.25 &&
        Math.max(
          ...entry.waterAvoidingRoutePlan.candidateOriginFractions.map(
            (origin) => origin.x,
          ),
        ) >= 0.7 &&
        entry.waterAvoidingRoutePlan.fixedSharedSkeletonUsed ===
          false &&
        entry.waterAvoidingRoutePlan
          .connectivityPortsAreBoundaryConstraintsOnly === true &&
        entry.waterAvoidingRoutePlan
          .retrySeedAffectsMacroTopology === false,
    ),
  currentSlotDeterministic:
    currentProbe.coarseHydrologyProfileSha256 ===
      repeatedCurrentProbe.coarseHydrologyProfileSha256 &&
    currentProbe.mainChannelGeometrySha256 ===
      repeatedCurrentProbe.mainChannelGeometrySha256 &&
    currentProbe.layoutProfileSha256 ===
      repeatedCurrentProbe.layoutProfileSha256,
  measuredInternalGeometryVariesAcrossRealWindows:
    new Set(
      probes.map((entry) => entry.mainChannelGeometrySha256),
    ).size > 1 &&
    new Set(
      probes.map((entry) => JSON.stringify(entry.bandCentroids)),
    ).size > 1,
  rasterMacroTopologyDoesNotCollapseToOneSharedSkeleton:
    new Set(macroSignatures).size >= 3 &&
    maximumPairwiseInteriorCentroidDistance >= 0.08,
  sourceCodeContainsNoHistoryInput:
    !librarySource.includes("original-image-library") &&
    !librarySource.includes("condition-guide-novelty") &&
    !topologySource.includes("original-image-library"),
  outputBoundaryPreserved:
    probeResults.every(
      (entry) =>
        entry.imageGenerationStarted === false &&
        entry.gpuTrainingStarted === false,
    ),
};

const failedChecks = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
const finishedAtUtc = new Date().toISOString();
const status =
  failedChecks.length === 0
    ? "relative_support_anonymous_main_channel_repair_check_passed"
    : "relative_support_anonymous_main_channel_repair_check_failed";
const report = {
  schemaVersion:
    "earth-geospatial-v7-relative-support-anonymous-main-channel-repair-check-v2",
  runId,
  status,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  authorizationId: AUTHORIZATION_ID,
  slotId: SLOT_ID,
  repairScope: {
    statement:
      "Derive continuous independent internal river geometry from all eight already-derived Thai DEM/D8 lateral and relative-support bands without a fixed family table; keep the approved Thailand package, connectivity ports, and review thresholds unchanged.",
    businessFactsChanged: false,
    connectivityPortsChanged: false,
    reviewThresholdsChanged: false,
    historicalGeometryRead: false,
    historicalRgbRead: false,
    retrySeedAffectsMacroTopology: false,
  },
  sourcePlan: {
    runId: plan.runId,
    path: pointer.runPath,
    sha256: sha256File(pointer.runPath),
    candidateId: currentAssignment.candidateId,
    measurementFingerprint:
      currentAssignment.fingerprints.direct,
  },
  programFiles: [
    artifactDescriptor(HYDROLOGY_LIBRARY_PATH),
    artifactDescriptor(TOPOLOGY_LIBRARY_PATH),
  ],
  probes,
  macroTopologyEvidence: {
    macroSignatures,
    uniqueMacroSignatureCount: new Set(macroSignatures).size,
    maximumPairwiseInteriorCentroidDistance,
    minimumRequiredUniqueMacroSignatures: 3,
    minimumRequiredPairwiseInteriorCentroidDistance: 0.08,
  },
  blockedMeasurementProbes: probeResults
    .filter((entry) => !entry.ok)
    .map((entry) => ({
      slotId: entry.slotId,
      candidateId: entry.candidateId,
      measurementFingerprint: entry.measurementFingerprint,
      blockerCode: entry.blockerCode,
      errorSha256: entry.errorSha256,
      errorSummary: entry.errorSummary,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    })),
  currentProbe,
  checks,
  failedChecks,
  outputBoundary: {
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    runtimeFrameCreated: false,
    worldEntryStarted: false,
  },
  nextRequiredAction:
    failedChecks.length === 0
      ? "preserve_no_rgb_boundary_and_obey_latest_all_history_window_selection_result"
      : "stop_and_report_repair_check_failure",
};

const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "repair-check-report.json",
  record: report,
  latest: {
    schemaVersion:
      "earth-geospatial-v7-relative-support-anonymous-main-channel-repair-check-v2-latest-pointer",
    status,
    slotId: SLOT_ID,
    candidateId: currentAssignment.candidateId,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
indexFile(path.resolve(ROOT, stored.runPath), runId);
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action:
    failedChecks.length === 0
      ? "v7_relative_support_anonymous_main_channel_repair_check_completed"
      : "v7_relative_support_anonymous_main_channel_repair_check_failed",
  runId,
  kind: "repair_check",
  status: failedChecks.length === 0 ? "success" : "failed",
  title:
    failedChecks.length === 0
      ? "The V7 relative-support anonymous main-channel repair check passed"
      : "The V7 relative-support anonymous main-channel repair check failed",
  titleZh:
    failedChecks.length === 0
      ? "V7 相对水文支撑匿名主河道修复检查通过"
      : "V7 相对水文支撑匿名主河道修复检查失败",
  detail:
    `checks=${Object.keys(checks).length}; failed=${failedChecks.length}; reportSha256=${reportSha256}; imageGenerationStarted=false; gpuTrainingStarted=false`,
  detailZh:
    `检查项=${Object.keys(checks).length}；失败=${failedChecks.length}；报告SHA-256=${reportSha256}；未启动图像生成；未启动GPU训练。`,
  script: projectPath(import.meta.filename),
  currentStep:
    failedChecks.length === 0
      ? "relative_support_main_channel_repair_check_completed"
      : "relative_support_main_channel_repair_check_failed",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    pointer.runPath,
    HYDROLOGY_LIBRARY_PATH,
    TOPOLOGY_LIBRARY_PATH,
  ],
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

console.log(
  JSON.stringify(
    {
      ok: failedChecks.length === 0,
      runId,
      status,
      reportPath: stored.runPath,
      reportSha256,
      checks: Object.keys(checks).length,
      failedChecks,
      currentProbe,
      measurementProbes: probes.map((entry) => ({
        slotId: entry.slotId,
        candidateId: entry.candidateId,
        continuousMappingId: entry.mappingSelection.familyId,
        bandCentroids: entry.bandCentroids,
        minimumBendRadiusToHalfWidthRatio:
          entry.minimumBendRadiusToHalfWidthRatio,
      })),
      blockedMeasurementProbeCount: probeResults.filter(
        (entry) => !entry.ok,
      ).length,
      imageGenerationStarted: false,
      rgbCreated: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);
if (failedChecks.length > 0) process.exitCode = 2;

function buildProbeResult(args) {
  try {
    return {
      ok: true,
      probe: buildProbe(args),
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      slotId: args.assignment.slotId,
      candidateId: args.assignment.candidateId,
      measurementFingerprint:
        args.assignment.fingerprints.direct,
      blockerCode: message.includes(
        "failed unchanged water audits",
      )
        ? "unchanged_water_naturalness_audit_blocked"
        : message.includes(
              "coarse D8 support band has no usable cells",
            )
          ? "measurement_support_incomplete_blocked"
        : "unexpected_probe_failure",
      errorSha256: crypto
        .createHash("sha256")
        .update(message)
        .digest("hex"),
      errorSummary: message.slice(0, 500),
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    };
  }
}

function buildProbe({
  assignment,
  waterNaturalnessProfile,
  boundaryWaterPorts,
}) {
  const profile = buildMeasurementDerivedCoarseHydrologyProfile({
    assignment,
    root: ROOT,
  });
  const layout = buildMeasurementDrivenAnonymousLayoutProfile({
    assignment,
    hasWater: true,
    coarseHydrologyProfile: profile,
  });
  const halfWidths = buildMeasurementDerivedNetworkHalfWidths({
    pointCount: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
    startHalfWidth: 76,
    endHalfWidth: 140,
    coarseHydrologyProfile: profile,
  });
  const channel = buildMeasurementDerivedAnonymousMainChannel({
    start: boundaryWaterPorts.upstream,
    end: boundaryWaterPorts.downstream,
    width: 1024,
    height: 768,
    coarseHydrologyProfile: profile,
    waterNaturalnessProfile,
    corridorHalfWidths: halfWidths,
  });
  const relativeSupports = profile.coarseBands.map(
    (entry) => entry.quantizedRelativeSupport,
  );
  return {
    slotId: assignment.slotId,
    candidateId: assignment.candidateId,
    measurementFingerprint: assignment.fingerprints.direct,
    coarseHydrologyProfileSha256: profile.profileSha256,
    layoutProfileSha256: layout.profileSha256,
    mainChannelGeometrySha256: sha256Json(channel.points),
    directEightBandSupportFractions:
      channel.selection.directEightBandSupportFractions,
    relativeEightBandSupportFractions:
      channel.selection.relativeEightBandSupportFractions,
    relativeSupportVariation:
      Math.max(...relativeSupports) - Math.min(...relativeSupports),
    anonymousBandAnchors:
      channel.selection.anonymousBandAnchors,
    mappingSelection:
      channel.selection.anonymousMappingFamilySelection,
    bandCentroids: pointBandCentroids(channel.points, 8, 1024),
    firstPoint: channel.points[0],
    lastPoint: channel.points.at(-1),
    waterNaturalnessPassed: channel.audit.passed,
    waterCorridorShapePassed: channel.corridorAudit.passed,
    minimumBendRadiusToHalfWidthRatio:
      channel.corridorAudit.minimumBendRadiusToHalfWidthRatio,
    minimumRequiredBendRadiusToHalfWidthRatio:
      channel.corridorAudit
        .minimumRequiredBendRadiusToHalfWidthRatio,
    identityBoundary: profile.identityBoundary,
    waterAvoidingRoutePlan: layout.waterAvoidingRoutePlan,
    routeTopology: layout.routeTopology,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  };
}

function maximumPairwiseDistance(vectors) {
  let maximum = 0;
  for (let leftIndex = 0; leftIndex < vectors.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < vectors.length;
      rightIndex += 1
    ) {
      const distance =
        vectors[leftIndex].reduce(
          (total, value, index) =>
            total +
            Math.abs(value - vectors[rightIndex][index]),
          0,
        ) / vectors[leftIndex].length;
      maximum = Math.max(maximum, distance);
    }
  }
  return Number(maximum.toFixed(6));
}

function readBoundaryWaterPorts(connectivityBlueprint) {
  const currentRegionId =
    connectivityBlueprint.currentRegion?.regionId;
  const waterPorts = (
    connectivityBlueprint.edgePorts ?? []
  ).filter(
    (entry) =>
      entry.regionId === currentRegionId &&
      entry.kind === "watercourse" &&
      entry.boundaryPosition,
  );
  const upstream = waterPorts.find(
    (entry) => entry.role === "upstream_inlet",
  );
  const downstream = waterPorts.find(
    (entry) => entry.role === "downstream_outlet",
  );
  const lateral = waterPorts.find(
    (entry) => entry.role === "shared_channel_side",
  );
  assert(
    upstream?.boundarySide === "north" &&
      downstream?.boundarySide === "south" &&
      lateral?.boundarySide === "east",
    "approved water connectivity boundary ports are missing",
  );
  return {
    upstream: structuredClone(upstream.boundaryPosition),
    downstream: structuredClone(downstream.boundaryPosition),
    lateral: structuredClone(lateral.boundaryPosition),
  };
}

function pointBandCentroids(points, bandCount, width) {
  return Array.from({ length: bandCount }, (_, bandIndex) => {
    const values = points
      .filter((_, pointIndex) => {
        const fraction = pointIndex / (points.length - 1);
        return (
          fraction >= bandIndex / bandCount &&
          (bandIndex === bandCount - 1
            ? fraction <= (bandIndex + 1) / bandCount
            : fraction < (bandIndex + 1) / bandCount)
        );
      })
      .map((point) => point.x / width);
    return round(
      values.reduce((total, value) => total + value, 0) /
        values.length,
    );
  });
}

function artifactDescriptor(relativePath) {
  return {
    path: relativePath,
    sha256: sha256File(relativePath),
  };
}

function indexFile(filePath, artifactRunId) {
  const stats = fs.statSync(filePath);
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId: artifactRunId,
    byteSize: stats.size,
    modifiedAtUtc: stats.mtime.toISOString(),
    sha256: sha256File(filePath),
  });
}

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.resolve(ROOT, relativePath), "utf8"),
  );
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.resolve(ROOT, filePath)))
    .digest("hex");
}

function sha256Json(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function round(value) {
  return Number(value.toFixed(8));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
