import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";

const ROOT = process.cwd();
const SLOT_ID = "v7-capacity-slot-123";
const EXPECTED_MATCH_IDS = new Set([
  "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v1",
  "ai-cold-start-v7-v7-capacity-slot-122-river-floodplain-v2",
]);
const NOVELTY_POINTER_PATH =
  ".runtime/ai-painter/ai-assisted-pre-rgb-condition-guide-novelty-audits/latest.json";
const CONDITION_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/latest.json";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-pre-rgb-duplicate-diagnostics";

const noveltyPointer = readJson(NOVELTY_POINTER_PATH);
const audit = readJson(noveltyPointer.runPath);
const conditionPointer = readJson(CONDITION_POINTER_PATH);
const conditionManifest = readJson(conditionPointer.runPath);
const currentBlueprint = readJson(conditionManifest.blueprintPath);
const matches = audit.approvedMacroCompositionMatches ?? [];
assert(
  audit.sourceRecordId === SLOT_ID &&
    audit.status ===
      "blocked_before_rgb_approved_macro_composition_duplicate",
  "latest pre-RGB novelty audit is not the blocked slot-123 audit",
);
assert(
  matches.length === EXPECTED_MATCH_IDS.size &&
    matches.every((entry) => EXPECTED_MATCH_IDS.has(entry.recordId)),
  "slot-123 duplicate match identities differ from the recorded blocker",
);
assert(
  conditionPointer.v7SlotId === SLOT_ID &&
    conditionManifest.runId === conditionPointer.runId &&
    conditionManifest.conditionId === conditionPointer.conditionId,
  "current slot-123 condition pointer identity mismatch",
);

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-pre-rgb-duplicate-diagnosis-" +
  createdAtUtc.replace(/[:.]/g, "-");
appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_123_pre_rgb_duplicate_diagnosis_started",
  runId,
  kind: "topology_diagnosis",
  status: "running",
  title: "The slot-123 pre-RGB duplicate diagnosis started",
  titleZh: "slot-123生成前重复命中诊断已启动",
  detail:
    `conditionRunId=${conditionManifest.runId}; matchedReferences=${matches.length}; imageGenerationStarted=false`,
  detailZh:
    `条件runId=${conditionManifest.runId}；命中参考=${matches.length}；启动图片生成=false`,
  script: projectPath(import.meta.filename),
  currentStep: "slot_123_pre_rgb_duplicate_diagnosis",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const comparisonDiagnostics = matches.map((comparison) => {
  const historicalRunManifestPath = findAncestorFile(
    comparison.guidePath,
    "complete-map-condition-run.json",
  );
  const historicalRunManifest = readJson(historicalRunManifestPath);
  const historicalBlueprint = readJson(
    historicalRunManifest.blueprintPath,
  );
  return {
    recordId: comparison.recordId,
    referenceClass: comparison.compositionReferenceClass,
    historicalConditionRunId: historicalRunManifest.runId,
    historicalConditionId: historicalRunManifest.conditionId,
    historicalConditionManifestPath: projectPath(
      path.resolve(ROOT, historicalRunManifestPath),
    ),
    historicalConditionManifestSha256: sha256File(
      historicalRunManifestPath,
    ),
    metrics: {
      waterLayoutIntersection:
        comparison.waterLayoutIntersection,
      routeLayoutIntersection:
        comparison.routeLayoutIntersection,
      routeCentroidNormalizedDistance:
        comparison.routeCentroidNormalizedDistance,
      waterSharedBandRatio:
        comparison.topologyMetrics.waterSharedBandRatio,
      waterBandCentroidDistance:
        comparison.topologyMetrics.waterBandCentroidDistance,
      routeSharedBandRatio:
        comparison.topologyMetrics.routeSharedBandRatio,
      routeBandCentroidDistance:
        comparison.topologyMetrics.routeBandCentroidDistance,
      routeWaterRelationAgreement:
        comparison.topologyMetrics.routeWaterRelationAgreement,
      sameWaterAxis: comparison.topologyMetrics.sameWaterAxis,
      sameWaterSide: comparison.topologyMetrics.sameWaterSide,
      sameRouteAxis: comparison.topologyMetrics.sameRouteAxis,
      sameRouteSide: comparison.topologyMetrics.sameRouteSide,
      macroTopologyDuplicate:
        comparison.macroTopologyDuplicate,
    },
    currentMacroTopology: comparison.candidateMacroTopology,
    historicalMacroTopology:
      comparison.historicalMacroTopology,
    currentGeometry: summarizeGeometry(currentBlueprint.geometry),
    historicalGeometry: summarizeGeometry(
      historicalBlueprint.geometry,
    ),
    identicalConnectivityPorts:
      canonicalJson(
        currentBlueprint.geometry.waterConnectivityPorts,
      ) ===
      canonicalJson(
        historicalBlueprint.geometry.waterConnectivityPorts,
      ),
  };
});

const waterDominated =
  comparisonDiagnostics.every(
    (entry) =>
      entry.metrics.waterLayoutIntersection >= 0.9 &&
      entry.metrics.waterSharedBandRatio === 1 &&
      entry.metrics.waterBandCentroidDistance <= 0.01 &&
      entry.metrics.routeLayoutIntersection < 0.2,
  );
const identicalConnectivityPorts =
  comparisonDiagnostics.every(
    (entry) => entry.identicalConnectivityPorts,
  );
assert(
  waterDominated && identicalConnectivityPorts,
  "the recorded duplicate is not the expected fixed-port water-corridor-dominated case",
);

const finishedAtUtc = new Date().toISOString();
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-pre-rgb-duplicate-diagnosis-v1",
  runId,
  status:
    "fixed_connectivity_ports_and_single_broad_water_corridor_dominate_macro_duplicate",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  slotId: SLOT_ID,
  sourceAudit: {
    runId: audit.runId,
    path: noveltyPointer.runPath,
    sha256: sha256File(noveltyPointer.runPath),
    thresholds: audit.thresholds,
    thresholdsModified: false,
  },
  currentCondition: {
    runId: conditionManifest.runId,
    conditionId: conditionManifest.conditionId,
    manifestPath: conditionPointer.runPath,
    manifestSha256: sha256File(conditionPointer.runPath),
    guidePath: audit.candidateGuidePath,
    guideSha256: audit.candidateGuideSha256,
    geometry: summarizeGeometry(currentBlueprint.geometry),
  },
  comparisonDiagnostics,
  rootCause: {
    code:
      "fixed_ports_single_broad_centerline_water_layout_reuse",
    waterDominated,
    identicalConnectivityPorts,
    detail:
      "The route changed and has low pixel overlap, but the candidate and both matched references use the same north inlet, east shared-channel, and south outlet ports. A single optimized broad centerline between those ports occupies all eight vertical bands on the right with nearly identical centroids, so water dominates the macro duplicate.",
    detailZh:
      "道路已经改变且像素重合较低，但候选与两条命中参考使用相同的北侧入口、东侧共享水道和南侧出口。固定端口之间仅生成一条经自然性优化的宽河中心线，导致右侧8个垂直带全部占用且带中心几乎一致，水体因此主导宏观重复。",
  },
  ruledOut: {
    retrySeedAsMacroFix:
      "ruled_out_because_macro_topology_must_remain_measurement_driven",
    routeOnlyAdjustment:
      "ruled_out_because_route_iou_is_below_0_2_for_both_matches",
    noveltyThresholdRelaxation:
      "forbidden_and_not_needed",
    historicalRgbReference:
      "not_used_and_forbidden",
    exactRealGeometryCopy:
      "not_used_and_forbidden",
  },
  nextRepairBoundary: {
    requiredLayer:
      "measurement_derived_anonymous_internal_hydrology_world_facts_and_condition_geometry",
    preserve:
      [
        "approved_north_inlet_east_shared_channel_and_south_outlet_connectivity_facts",
        "measurement_source_and_license_lineage",
        "anonymous_game_coordinates",
        "23_channel_identity_and_order",
        "focal_area_all_zero",
        "existing_review_thresholds",
      ],
    mustChange:
      [
        "single_broad_centerline_as_the_only_river_floodplain_internal_hydrology_representation",
        "internal_water_band_occupancy_and_centroid_profile",
      ],
    examplesRequiringSeparateImplementationAuthorization:
      [
        "measurement_supported_floodplain_side_channel_or_wetland_branch",
        "measurement_supported_asymmetric_floodplain_water_and_shoreline_zones",
        "non_single_centerline_internal_hydrology_while_preserving_edge_ports",
      ],
  },
  algorithmEvidence: {
    conditionGeneratorPath:
      "scripts/build-earth-geospatial-complete-map-conditions.mjs",
    conditionGeneratorSha256: sha256File(
      "scripts/build-earth-geospatial-complete-map-conditions.mjs",
    ),
    waterGeneratorPath:
      "scripts/lib/anonymous-water-naturalness.mjs",
    waterGeneratorSha256: sha256File(
      "scripts/lib/anonymous-water-naturalness.mjs",
    ),
    noveltyAuditPath:
      "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs",
    noveltyAuditSha256: sha256File(
      "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs",
    ),
    diagnosisProgramPath: projectPath(import.meta.filename),
    diagnosisProgramSha256: sha256File(import.meta.filename),
  },
  outputBoundary: {
    sourceFilesModifiedByDiagnosis: false,
    worldFactsModified: false,
    conditionGeometryModified: false,
    reviewThresholdsModified: false,
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
  fileName: "diagnosis-report.json",
  record: report,
  latest: {
    slotId: SLOT_ID,
    sourceAuditRunId: audit.runId,
    rootCauseCode: report.rootCause.code,
    waterDominated: true,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action: "v7_slot_123_pre_rgb_duplicate_diagnosis_completed",
  runId,
  kind: "topology_diagnosis",
  status: "blocked",
  title:
    "The slot-123 duplicate was diagnosed as fixed-port single-water-corridor reuse",
  titleZh: "slot-123重复命中已诊断为固定端口单一水体走廊复用",
  detail:
    `waterDominated=true; identicalConnectivityPorts=true; matchedReferences=${comparisonDiagnostics.length}; reportSha256=${reportSha256}`,
  detailZh:
    `水体主导=true；连接端口相同=true；命中参考=${comparisonDiagnostics.length}；报告SHA-256=${reportSha256}`,
  script: projectPath(import.meta.filename),
  currentStep:
    "slot_123_pre_rgb_duplicate_diagnosed_waiting_owner_authorization",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    noveltyPointer.runPath,
    conditionPointer.runPath,
    ...comparisonDiagnostics.map(
      (entry) => entry.historicalConditionManifestPath,
    ),
  ],
  errorCode: report.rootCause.code,
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
      rootCause: report.rootCause,
      comparisons: comparisonDiagnostics.map((entry) => ({
        recordId: entry.recordId,
        waterLayoutIntersection:
          entry.metrics.waterLayoutIntersection,
        routeLayoutIntersection:
          entry.metrics.routeLayoutIntersection,
        waterBandCentroidDistance:
          entry.metrics.waterBandCentroidDistance,
        identicalConnectivityPorts:
          entry.identicalConnectivityPorts,
      })),
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function findAncestorFile(startPath, fileName) {
  let current = path.dirname(path.resolve(ROOT, startPath));
  while (
    current === ROOT ||
    current.startsWith(`${ROOT}${path.sep}`)
  ) {
    const candidate = path.join(current, fileName);
    if (fs.existsSync(candidate)) {
      return projectPath(candidate);
    }
    if (current === ROOT) break;
    current = path.dirname(current);
  }
  throw new Error(
    `unable to locate ${fileName} above ${startPath}`,
  );
}

function summarizeGeometry(geometry) {
  return {
    methodId: geometry.geometryDerivation?.methodId ?? null,
    seedRevision: geometry.geometryDerivation?.seedRevision ?? null,
    measurementSupportFingerprint:
      geometry.geometryDerivation?.measurementSupportFingerprint ??
      null,
    measurementTopologyFingerprint:
      geometry.geometryDerivation?.measurementTopologyFingerprint ??
      null,
    waterControlProfileIndex:
      geometry.geometryDerivation?.waterControlProfileIndex ?? null,
    routeTopology: geometry.routeTopology,
    waterConnectivityPorts: geometry.waterConnectivityPorts,
    waterSinuosity:
      geometry.waterNaturalnessAudit?.sinuosity ?? null,
    waterControlFractions:
      geometry.waterNaturalnessAudit
        ?.broadRiverControlFractions ?? null,
  };
}

function canonicalJson(value) {
  return JSON.stringify(value, Object.keys(value ?? {}).sort());
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
