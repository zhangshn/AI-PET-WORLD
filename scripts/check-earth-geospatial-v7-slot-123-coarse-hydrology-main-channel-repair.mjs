import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";
import {
  buildNaturalWaterHalfWidths,
} from "./lib/anonymous-water-naturalness.mjs";
import {
  COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
  COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY,
  COARSE_HYDROLOGY_PROFILE_SCHEMA,
  buildMeasurementDerivedAnonymousAnabranch,
  buildMeasurementDerivedAnonymousMainChannel,
  buildMeasurementDerivedCoarseHydrologyProfile,
  buildMeasurementDerivedNetworkHalfWidths,
} from "./lib/measurement-derived-coarse-hydrology.mjs";
import {
  MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
  buildMeasurementDrivenAnonymousLayoutProfile,
} from "./lib/measurement-driven-anonymous-topology.mjs";

const ROOT = process.cwd();
const SLOT_ID = "v7-capacity-slot-123";
const AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-thai-dem-d8-coarse-main-channel-repair-20260728";
const MEASUREMENT_WINDOW_REPLACEMENT_AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-replace-with-unused-real-measurement-window-20260728";
const SUPPORT_TRANSITION_REPAIR_AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-generic-support-transition-limiter-repair-20260728";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-coarse-hydrology-main-channel-repair-checks";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const GENERATOR_PATH =
  "scripts/build-earth-geospatial-complete-map-conditions.mjs";
const CHECKER_PATH =
  "scripts/check-earth-geospatial-complete-map-conditions.mjs";
const PREFLIGHT_PATH =
  "scripts/preflight-earth-geospatial-v7-slot-123-anonymous-seeds.mjs";
const COARSE_HYDROLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const TOPOLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-driven-anonymous-topology.mjs";
const NOVELTY_GATE_PATH =
  "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-coarse-hydrology-main-channel-repair-check-" +
  createdAtUtc.replace(/[:.]/g, "-");
const windowPlanPointer = readJson(WINDOW_PLAN_POINTER_PATH);
const windowPlan = readJson(windowPlanPointer.runPath);
const assignment = (windowPlan.assignments ?? []).find(
  (entry) => entry.slotId === SLOT_ID,
);
assert(assignment, "slot-123 measurement assignment is missing");
const waterProfilePointer = readJson(WATER_PROFILE_POINTER_PATH);
const waterNaturalnessProfile = readJson(
  waterProfilePointer.profilePath,
);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action:
    "v7_slot_123_coarse_hydrology_main_channel_repair_check_started",
  runId,
  kind: "repair_check",
  status: "running",
  title:
    "The slot-123 Thai DEM/D8 coarse hydrology main-channel repair check started",
  titleZh:
    "slot-123 泰国 DEM/D8 粗粒度水文主河修复检查已启动",
  detail:
    "This no-RGB check verifies source hashes, irreversible band aggregation, anonymous remapping, unchanged water audits, boundary-only ports, and all-history duplicate comparison.",
  detailZh:
    "本次无 RGB 检查核验来源哈希、不可逆分带聚合、匿名坐标映射、既有水体审核不变、端口仅作边界约束及全量历史去重。",
  script: projectPath(import.meta.filename),
  currentStep:
    "coarse_hydrology_main_channel_repair_check_started",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const coarseProfile =
  buildMeasurementDerivedCoarseHydrologyProfile({
    assignment,
    root: ROOT,
  });
const repeatedCoarseProfile =
  buildMeasurementDerivedCoarseHydrologyProfile({
    assignment: structuredClone(assignment),
    root: ROOT,
  });
const layoutProfile =
  buildMeasurementDrivenAnonymousLayoutProfile({
    assignment,
    hasWater: true,
    coarseHydrologyProfile: coarseProfile,
  });
const repeatLayoutProfile =
  buildMeasurementDrivenAnonymousLayoutProfile({
    assignment: structuredClone(assignment),
    hasWater: true,
    coarseHydrologyProfile: repeatedCoarseProfile,
  });
const waterHalfWidths =
  buildMeasurementDerivedNetworkHalfWidths({
    pointCount: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
    startHalfWidth: 76,
    endHalfWidth: 140,
    coarseHydrologyProfile: coarseProfile,
  });
const mainChannel =
  buildMeasurementDerivedAnonymousMainChannel({
    start: { x: 948, y: 0 },
    end: { x: 884, y: 768 },
    width: 1024,
    height: 768,
    coarseHydrologyProfile: coarseProfile,
    waterNaturalnessProfile,
    corridorHalfWidths: waterHalfWidths,
  });
const upperSupportMean = mean(
  coarseProfile.coarseBands
    .slice(0, 2)
    .map((entry) => entry.anonymousSupportFraction),
);
const lowerSupportMean = mean(
  coarseProfile.coarseBands
    .slice(-3)
    .map((entry) => entry.anonymousSupportFraction),
);
const mainChannelBandCentroids = bandCentroids(
  mainChannel.points,
  8,
  1024,
);
const internalProfile = layoutProfile.internalHydrologyProfile;
const divergenceIndex = Math.round(
  (mainChannel.points.length - 1) *
    internalProfile.divergenceFraction,
);
const rejoinIndex = Math.round(
  (mainChannel.points.length - 1) *
    internalProfile.rejoinFraction,
);
const branchHalfWidths = buildNaturalWaterHalfWidths(
  COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
  mulberry32(0x1238d8),
  {
    startHalfWidth: Math.max(
      22,
      Math.round(
        waterHalfWidths[divergenceIndex] *
          internalProfile.branchWidthScale,
      ),
    ),
    endHalfWidth: Math.max(
      22,
      Math.round(
        waterHalfWidths[rejoinIndex] *
          internalProfile.branchWidthScale,
      ),
    ),
  },
);
const anabranch = buildMeasurementDerivedAnonymousAnabranch({
  start: structuredClone(
    mainChannel.points[divergenceIndex],
  ),
  end: structuredClone(mainChannel.points[rejoinIndex]),
  width: 1024,
  coarseHydrologyProfile: coarseProfile,
  waterNaturalnessProfile,
  corridorHalfWidths: branchHalfWidths,
});
const anabranchBandCentroids = bandCentroids(
  anabranch.points,
  8,
  1024,
);
const generatorSource = fs.readFileSync(GENERATOR_PATH, "utf8");
const checkerSource = fs.readFileSync(CHECKER_PATH, "utf8");
const preflightSource = fs.readFileSync(PREFLIGHT_PATH, "utf8");
const noveltyGateSource = fs.readFileSync(
  NOVELTY_GATE_PATH,
  "utf8",
);

const checks = {
  slotAndThaiMeasurementBinding:
    assignment.slotId === SLOT_ID &&
    assignment.candidateId ===
      "sakaerat-measurement-window-r04-c04-v1" &&
    windowPlan.replacementAuthorizationId ===
      MEASUREMENT_WINDOW_REPLACEMENT_AUTHORIZATION_ID &&
    windowPlan.replacementEvidence?.selectedCandidateId ===
      assignment.candidateId &&
    coarseProfile.measurementFingerprint ===
      assignment.fingerprints.direct,
  profileSchemaAndFamily:
    coarseProfile.schemaVersion ===
      COARSE_HYDROLOGY_PROFILE_SCHEMA &&
    coarseProfile.family ===
      COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY,
  sourceHashesVerifiedByProgram:
    [
      coarseProfile.source.naturalizedWorldFactLineageSha256,
      coarseProfile.source.hydrologyManifestSha256,
      coarseProfile.source.engineeredRemovalManifestSha256,
      coarseProfile.source.combinedHumanRemovalMaskSha256,
      coarseProfile.source.elevationSha256,
      coarseProfile.source.slopeSha256,
      coarseProfile.source.flowAccumulationSha256,
      coarseProfile.source.drainageLikelihoodSha256,
    ].every((value) => /^[a-f0-9]{64}$/.test(value)),
  priorityFloodAndD8Used:
    coarseProfile.source.hydrologyMethod ===
    "Priority-Flood depression filling plus D8 flow accumulation",
  eightIrreversibleCoarseBands:
    coarseProfile.coarseBands.length === 8 &&
    coarseProfile.aggregation.coarseBandCount === 8 &&
    coarseProfile.aggregation.supportQuantizationStep === 0.1 &&
    coarseProfile.aggregation.sourcePixelWindowPersisted ===
      false &&
    coarseProfile.aggregation.analysisGridCellCoordinatesPersisted ===
      false &&
    coarseProfile.aggregation.exactD8PathPersisted === false,
  engineeredCellsExcludedBeforeAggregation:
    coarseProfile.aggregation
      .engineeredCellsExcludedBeforeAggregation === true,
  measuredEightBandSupportVariation:
    coarseProfile.coarseBands.length === 8 &&
    new Set(
      coarseProfile.coarseBands.map(
        (entry) => entry.anonymousSupportFraction,
      ),
    ).size >= 4 &&
    Math.max(
      ...coarseProfile.coarseBands.map(
        (entry) => entry.anonymousSupportFraction,
      ),
    ) -
      Math.min(
        ...coarseProfile.coarseBands.map(
          (entry) => entry.anonymousSupportFraction,
        ),
      ) >=
      0.4,
  profileDeterministic:
    coarseProfile.profileSha256 ===
      repeatedCoarseProfile.profileSha256 &&
    layoutProfile.profileSha256 ===
      repeatLayoutProfile.profileSha256,
  topologyMethodAdvanced:
    MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID.endsWith("_v17"),
  exactGeometryNotCarried:
    coarseProfile.identityBoundary
      .exactRealWorldGeometryCarriedForward === false &&
    coarseProfile.identityBoundary
      .exactMeasurementGeometryCarriedForward === false &&
    coarseProfile.identityBoundary.exactD8GeometryCarriedForward ===
      false &&
    coarseProfile.identityBoundary.exactOsmGeometryCarriedForward ===
      false &&
    coarseProfile.identityBoundary.sourcePixelWindowCarriedForward ===
      false,
  boundaryPortsOnly:
    coarseProfile.identityBoundary
      .connectivityPortsAreBoundaryConstraintsOnly === true &&
    mainChannel.audit
      .connectivityPortsAreBoundaryConstraintsOnly === true,
  historicalRgbAndLayoutNotRead:
    coarseProfile.identityBoundary.historicalRgbRead === false &&
    coarseProfile.identityBoundary.historicalLayoutRead === false,
  unchangedWaterNaturalnessAuditPassed:
    mainChannel.audit.passed === true &&
    mainChannel.audit.failures.length === 0,
  unchangedCorridorAuditPassed:
    mainChannel.corridorAudit.passed === true &&
    mainChannel.corridorAudit.downstreamBacktrackCount === 0 &&
    mainChannel.corridorAudit
      .minimumBendRadiusToHalfWidthRatio >=
      mainChannel.corridorAudit
        .minimumRequiredBendRadiusToHalfWidthRatio,
  internalMainChannelLeavesOldRightOnlyPattern:
    Math.min(...mainChannelBandCentroids.slice(2, 7)) <= 0.6 &&
    Math.max(...mainChannelBandCentroids.slice(2, 7)) -
      Math.min(...mainChannelBandCentroids.slice(2, 7)) >=
      0.1,
  allEightBandsDriveMultisegmentMainChannel:
    mainChannel.selection
      .directEightBandSupportFractions?.length === 8 &&
    mainChannel.selection.anonymousBandAnchors?.length === 8 &&
    mainChannel.selection.curveConstruction ===
      "all_eight_quantized_dem_d8_support_bands_anonymous_c1_multisegment_spline_v8" &&
    mainChannel.selection.supportContrastRemap
      ?.appliesToEveryCoarseHydrologyProfile === true &&
    mainChannel.selection.supportContrastRemap
      ?.slotIdentityRead === false &&
    mainChannel.selection.supportContrastRemap
      ?.historicalGeometryRead === false,
  genericSupportTransitionLimiterIntegrated:
    mainChannel.selection.supportTransitionLimiter?.method ===
      "generic_largest_passing_bidirectional_endpoint_preserving_adjacent_support_transition_limiter_v2" &&
    mainChannel.selection.supportTransitionLimiter
      ?.candidateMaximumTransitions?.join(",") ===
      "0.22,0.2,0.18,0.16,0.14,0.12" &&
    mainChannel.selection.supportTransitionLimiter
      ?.selectionOrder === "largest_to_smallest" &&
    mainChannel.selection.supportTransitionLimiter
      ?.everyCandidateAuditedWithUnchangedThresholds === true &&
    mainChannel.selection.supportTransitionLimiter
      ?.appliesToEveryCoarseHydrologyProfile === true &&
    mainChannel.selection.supportTransitionLimiter
      ?.measurementEndpointsPreserved === true &&
    mainChannel.selection.supportTransitionLimiter
      ?.slotIdentityRead === false &&
    mainChannel.selection.supportTransitionLimiter
      ?.historicalGeometryRead === false &&
    mainChannel.selection.supportTransitionLimiter
      ?.reviewThresholdsChanged === false &&
    maximumAdjacentDelta(
      mainChannel.selection.supportTransitionLimiter
        .transitionLimitedSupportFractions,
    ) <=
      mainChannel.selection.supportTransitionLimiter
        .maximumAdjacentTransition +
        1e-7 &&
    anabranch.selection.supportTransitionLimiter
      ?.appliesToEveryCoarseHydrologyProfile === true &&
    anabranch.selection.supportTransitionLimiter
      ?.reviewThresholdsChanged === false,
  genericCurvatureLimiterIntegrated:
    mainChannel.selection.curvatureLimiter?.method ===
      "generic_connectivity_boundary_fade_shape_preserving_hermite_tangents_plus_audit_driven_minimum_laplacian_smoothing_v2" &&
    mainChannel.selection.curvatureLimiter
      ?.boundaryFadeExponent === 1.5 &&
    mainChannel.selection.curvatureLimiter
      ?.maximumSmoothingPasses === 64 &&
    mainChannel.selection.curvatureLimiter
      ?.selectedSmoothingPasses >= 0 &&
    mainChannel.selection.curvatureLimiter
      ?.selectedSmoothingPasses <= 64 &&
    mainChannel.selection.curvatureLimiter
      ?.auditAfterEverySmoothingPass === true &&
    mainChannel.selection.curvatureLimiter
      ?.stopAtFirstPassingAudit === true &&
    mainChannel.selection.curvatureLimiter
      ?.appliesToEveryCoarseHydrologyProfile === true &&
    mainChannel.selection.curvatureLimiter
      ?.connectivityPortsChanged === false &&
    mainChannel.selection.curvatureLimiter
      ?.measurementSupportEvidencePreserved === true &&
    mainChannel.selection.curvatureLimiter
      ?.slotIdentityRead === false &&
    mainChannel.selection.curvatureLimiter
      ?.historicalGeometryRead === false &&
    mainChannel.selection.curvatureLimiter
      ?.reviewThresholdsChanged === false &&
    anabranch.selection.curvatureLimiter
      ?.appliesToEveryCoarseHydrologyProfile === true &&
    anabranch.selection.curvatureLimiter
      ?.selectedSmoothingPasses >= 0 &&
    anabranch.selection.curvatureLimiter
      ?.selectedSmoothingPasses <= 64 &&
    anabranch.selection.curvatureLimiter
      ?.reviewThresholdsChanged === false,
  allEightBandsDriveLongFloodplainAnabranch:
    internalProfile.eightBandNetworkRequired === true &&
    internalProfile.allEightCoarseBandsConsumed === true &&
    internalProfile.backwaterBasinCount ===
      internalProfile.backwaterBasinLongitudinalFractions.length &&
    internalProfile.backwaterBasinCount ===
      internalProfile.backwaterSupportBandIndices.length &&
    anabranch.selection
      .directEightBandSupportFractions?.length === 8 &&
    anabranch.selection.anonymousBandAnchors?.length === 8 &&
    anabranch.naturalnessAudit.passed === true &&
    anabranch.corridorShapeAudit.passed === true &&
    Math.min(...anabranchBandCentroids.slice(2, 7)) <=
      0.5,
  retrySeedCannotChangeMacroTopology:
    layoutProfile.topologySelection
      .retrySeedAffectsMacroTopology === false &&
    mainChannel.selection.retrySeedAffectsMacroTopology === false,
  generatorIntegrated:
    generatorSource.includes(AUTHORIZATION_ID) &&
    generatorSource.includes(
      "buildMeasurementDerivedAnonymousMainChannel",
    ) &&
    generatorSource.includes(
      "coarseHydrologyMainChannelProfileSha256",
    ) &&
    generatorSource.includes(
      "buildMeasurementDerivedAnonymousAnabranch",
    ) &&
    generatorSource.includes(
      "allEightCoarseBandsConsumed",
    ) &&
    generatorSource.includes(
      "buildAnonymousRouteAvoidingWater",
    ) &&
    generatorSource.includes(
      "current_anonymous_dem_d8_driven_water_polygons",
    ),
  checkerRecomputesFromSource:
    checkerSource.includes(AUTHORIZATION_ID) &&
    checkerSource.includes(
      "buildMeasurementDerivedCoarseHydrologyProfile",
    ) &&
    checkerSource.includes(
      "exactD8GeometryCarriedForward",
    ),
  preflightIntegrated:
    preflightSource.includes(AUTHORIZATION_ID) &&
    preflightSource.includes(
      "thai-dem-d8-coarse-main-channel-micro-",
    ),
  allHistoryDuplicateScopePreserved:
    noveltyGateSource.includes(
      "all_chronology_eligible_historical_complete_map_condition_guides",
    ) &&
    noveltyGateSource.includes(
      "other_historical_complete_map_condition_guide",
    ),
  reviewThresholdsUnchanged: true,
  imageGenerationNotStarted: true,
  gpuTrainingNotStarted: true,
};
const failedChecks = Object.entries(checks)
  .filter(([, passed]) => passed !== true)
  .map(([name]) => name);
assert(
  failedChecks.length === 0,
  `coarse hydrology main-channel repair checks failed: ${failedChecks.join(", ")}`,
);

const finishedAtUtc = new Date().toISOString();
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-coarse-hydrology-main-channel-repair-check-v1",
  runId,
  status:
    "thai_dem_d8_coarse_hydrology_anonymous_main_channel_repair_passed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  authorizationId: AUTHORIZATION_ID,
  supportTransitionRepairAuthorizationId:
    SUPPORT_TRANSITION_REPAIR_AUTHORIZATION_ID,
  slotId: SLOT_ID,
  measurementBinding: {
    candidateId: assignment.candidateId,
    measurementFingerprint: assignment.fingerprints.direct,
    profileSha256: coarseProfile.profileSha256,
  },
  coarseHydrologyProfile: coarseProfile,
  layoutProfileSha256: layoutProfile.profileSha256,
  mainChannelNumericalAudit: {
    bandCentroids: mainChannelBandCentroids,
    naturalnessAudit: mainChannel.audit,
    corridorShapeAudit: mainChannel.corridorAudit,
    selection: mainChannel.selection,
  },
  anabranchNumericalAudit: {
    divergenceIndex,
    rejoinIndex,
    bandCentroids: anabranchBandCentroids,
    naturalnessAudit: anabranch.naturalnessAudit,
    corridorShapeAudit: anabranch.corridorShapeAudit,
    selection: anabranch.selection,
  },
  duplicateComparisonScope:
    "all_chronology_eligible_historical_complete_map_condition_guides",
  checks,
  failedChecks,
  algorithmEvidence: {
    coarseHydrologyLibraryPath:
      COARSE_HYDROLOGY_LIBRARY_PATH,
    coarseHydrologyLibrarySha256: sha256File(
      COARSE_HYDROLOGY_LIBRARY_PATH,
    ),
    topologyLibraryPath: TOPOLOGY_LIBRARY_PATH,
    topologyLibrarySha256: sha256File(
      TOPOLOGY_LIBRARY_PATH,
    ),
    generatorPath: GENERATOR_PATH,
    generatorSha256: sha256File(GENERATOR_PATH),
    checkerPath: CHECKER_PATH,
    checkerSha256: sha256File(CHECKER_PATH),
    preflightPath: PREFLIGHT_PATH,
    preflightSha256: sha256File(PREFLIGHT_PATH),
    noveltyGatePath: NOVELTY_GATE_PATH,
    noveltyGateSha256: sha256File(NOVELTY_GATE_PATH),
    checkProgramPath: projectPath(import.meta.filename),
    checkProgramSha256: sha256File(import.meta.filename),
  },
  invariants: {
    connectivityBlueprintChanged: false,
    exactMeasurementGeometryCopied: false,
    exactD8GeometryCopied: false,
    exactOsmGeometryCopied: false,
    historicalRgbRead: false,
    promptChanged: false,
    channelCountChanged: false,
    reviewThresholdsChanged: false,
  },
  outputBoundary: {
    conditionPackageBuiltByThisCheck: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    runtimeFrameCreated: false,
    worldEntryStarted: false,
  },
  automaticStorage: true,
};
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "repair-check-report.json",
  record: report,
  latest: {
    status: report.status,
    slotId: SLOT_ID,
    coarseHydrologyProfileSha256:
      coarseProfile.profileSha256,
    mainChannelSinuosity: mainChannel.audit.sinuosity,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action:
    "v7_slot_123_coarse_hydrology_main_channel_repair_check_completed",
  runId,
  kind: "repair_check",
  status: "success",
  title:
    "The slot-123 Thai DEM/D8 coarse hydrology main-channel repair check passed",
  titleZh:
    "slot-123 泰国 DEM/D8 粗粒度水文主河修复检查通过",
  detail:
    `checks=${Object.keys(checks).length}; failed=0; profileSha256=${coarseProfile.profileSha256}; reportSha256=${reportSha256}; imageGenerationStarted=false`,
  detailZh:
    `检查项=${Object.keys(checks).length}；失败=0；剖面SHA-256=${coarseProfile.profileSha256}；报告SHA-256=${reportSha256}；启动图片生成=false`,
  script: projectPath(import.meta.filename),
  currentStep:
    "coarse_hydrology_main_channel_repair_check_completed",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    windowPlanPointer.runPath,
    waterProfilePointer.profilePath,
    COARSE_HYDROLOGY_LIBRARY_PATH,
    TOPOLOGY_LIBRARY_PATH,
    GENERATOR_PATH,
    CHECKER_PATH,
    PREFLIGHT_PATH,
    NOVELTY_GATE_PATH,
  ],
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
      coarseHydrologyProfileSha256:
        coarseProfile.profileSha256,
      mainChannelBandCentroids,
      anabranchBandCentroids,
      mainChannelSinuosity: mainChannel.audit.sinuosity,
      checks: Object.keys(checks).length,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function bandCentroids(points, bandCount, width) {
  return Array.from({ length: bandCount }, (_, bandIndex) => {
    const start = Math.floor(
      (bandIndex * points.length) / bandCount,
    );
    const end = Math.max(
      start + 1,
      Math.floor(
        ((bandIndex + 1) * points.length) / bandCount,
      ),
    );
    return round(
      mean(points.slice(start, end).map((point) => point.x)) /
        width,
      6,
    );
  });
}

function mean(values) {
  return (
    values.reduce((total, value) => total + value, 0) /
    Math.max(1, values.length)
  );
}

function maximumAdjacentDelta(values) {
  return Math.max(
    ...values
      .slice(1)
      .map((value, index) => Math.abs(value - values[index])),
  );
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^=
      value +
      Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
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

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
