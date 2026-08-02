import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
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
  buildMeasurementDerivedAnonymousMainChannel,
  buildMeasurementDerivedCoarseHydrologyProfile,
  buildMeasurementDerivedNetworkHalfWidths,
} from "./lib/measurement-derived-coarse-hydrology.mjs";
import { buildMeasurementDrivenAnonymousLayoutProfile } from "./lib/measurement-driven-anonymous-topology.mjs";

const ROOT = process.cwd();
const SLOT_ID = "v7-capacity-slot-123";
const AUTHORIZATION_ID =
  "owner-authorized-slot-123-expanded-real-measurement-window-scope-20260728";
const BEYOND_NINE_BY_NINE_AUTHORIZATION_ID =
  "owner-authorized-slot-123-thai-measurement-scope-beyond-9x9-no-rgb-20260729";
const CONNECTIVITY_BLUEPRINT_PATH =
  "data/world-samples/world-connectivity/blueprints/mainland-southeast-asia-tropical-monsoon-natural-home-v1/mainland-southeast-asia-earth-reference-natural-home-region-0001-v1/blueprint.json";
const INDEX_PATH =
  "data/world-samples/original-image-library/natural-home-v1/index.json";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const DIAGNOSIS_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-right-only-pattern-diagnostics/latest.json";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-all-history-window-selections";
const BAND_COUNT = 8;
const MINIMUM_SHARED_WATER_BAND_RATIO = 0.875;
const MAXIMUM_DUPLICATE_WATER_BAND_CENTROID_DISTANCE = 0.05;
const REQUIRED_MINIMUM_INTERIOR_CENTROID = 0.6;
const REQUIRED_MINIMUM_INTERIOR_RANGE = 0.1;
const WATER_COLOR = [43, 112, 156];

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-all-history-window-selection-" +
  createdAtUtc.replace(/[:.]/g, "-");

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_123_all_history_window_selection_started",
  runId,
  kind: "measurement_window_selection",
  status: "running",
  title:
    "The slot-123 all-history real-measurement window selection started",
  titleZh: "slot-123 全历史真实测量窗口选择已启动",
  detail:
    "The program will compare every currently unused Sakaerat/Wang Nam Khiao measurement window with all currently recorded historical complete-map condition-guide water corridors. It will not read historical RGB, generate RGB, or start GPU training.",
  detailZh:
    "程序将把每个当前未使用的 Sakaerat/Wang Nam Khiao 测量窗口与当前已记录的全部历史完整地图条件引导图水体走廊比较；不读取历史RGB、不生成RGB、不启动GPU训练。",
  script: projectPath(import.meta.filename),
  currentStep: "rank_unused_windows_against_all_history",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

try {
  const planPointer = readJson(WINDOW_PLAN_POINTER_PATH);
  const plan = readJson(planPointer.runPath);
  const candidates = readJson(plan.candidateWindowsPath);
  const beyondNineByNineScope =
    candidates.grid?.columns === 11 &&
    candidates.grid?.rows === 11 &&
    plan.scopeExpansionAuthorizationId ===
      BEYOND_NINE_BY_NINE_AUTHORIZATION_ID;
  const capacityGapList = readJson(plan.capacityGapListPath);
  const diagnosisPointer = readJson(DIAGNOSIS_POINTER_PATH);
  const diagnosis = readJson(diagnosisPointer.runPath);
  const waterProfilePointer = readJson(WATER_PROFILE_POINTER_PATH);
  const waterNaturalnessProfile = readJson(
    waterProfilePointer.profilePath,
  );
  const connectivityBlueprint = readJson(
    CONNECTIVITY_BLUEPRINT_PATH,
  );
  const boundaryWaterPorts = readBoundaryWaterPorts(
    connectivityBlueprint,
  );

  verifyHash(
    planPointer.runPath,
    sha256File(planPointer.runPath),
  );
  verifyHash(
    plan.candidateWindowsPath,
    plan.candidateWindowsSha256,
  );
  assert(
    diagnosisPointer.status ===
      "right_only_assertion_failed_current_centerline_and_all_history_centroids_recorded",
    "latest all-history diagnosis status mismatch",
  );
  assert(
    diagnosis.outputBoundary?.imageGenerationStarted === false &&
      diagnosis.outputBoundary?.rgbCreated === false &&
      diagnosis.outputBoundary?.gpuTrainingStarted === false,
    "all-history diagnosis crossed the RGB or GPU boundary",
  );

  const currentAssignment = plan.assignments.find(
    (entry) => entry.slotId === SLOT_ID,
  );
  const slot = capacityGapList.plannedSlots.find(
    (entry) => entry.slotId === SLOT_ID,
  );
  assert(currentAssignment && slot, "slot-123 plan binding is missing");
  const currentHistoricalSnapshot =
    await readAllHistoricalWaterCorridors();
  assert(
    currentHistoricalSnapshot.skippedCount === 0,
    "current all-history condition-guide snapshot contains unreadable entries",
  );
  const historicalComparisons =
    currentHistoricalSnapshot.comparisons;
  const historicalComparisonCount =
    historicalComparisons.length;
  assert(
    Array.isArray(historicalComparisons) &&
      historicalComparisons.length === historicalComparisonCount,
    "all-history comparison list is incomplete",
  );

  const assignedCandidateIds = new Set(
    plan.assignments.map((entry) => entry.candidateId),
  );
  const unusedCandidates = candidates.candidates.filter(
    (entry) =>
      !assignedCandidateIds.has(entry.candidateId) &&
      (!beyondNineByNineScope ||
        entry.newlyAuthorizedBeyondNineByNineOuterRing === true),
  );
  assert(
    unusedCandidates.length > 0,
    beyondNineByNineScope
      ? "no candidate remains in the newly authorized 11x11 outer ring"
      : "no globally unused authorized 9x9 measurement window remains",
  );

  let currentGeometry = null;
  try {
    currentGeometry = buildCandidateGeometry({
      assignment: currentAssignment,
      waterNaturalnessProfile,
      boundaryWaterPorts,
    });
  } catch {
    currentGeometry = null;
  }
  const rankings = unusedCandidates
    .map((candidate) =>
      rankCandidate({
        candidate,
        slot,
        currentAssignment,
        currentGeometry,
        historicalComparisons,
        waterNaturalnessProfile,
        boundaryWaterPorts,
      }),
    )
    .sort(compareRankings)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
  const auditReadyCandidates = rankings.filter(
    (entry) => entry.readyForFullCompositionAudit,
  );
  const selectedCandidate = auditReadyCandidates[0] ?? null;
  const finishedAtUtc = new Date().toISOString();
  const status = selectedCandidate
    ? "unused_real_measurement_window_selected_for_full_all_history_composition_audit"
    : "blocked_no_unused_real_measurement_window_ready_for_full_composition_audit";
  const report = {
    schemaVersion:
      "earth-geospatial-v7-slot-123-all-history-window-selection-v5",
    runId,
    status,
    createdAtUtc,
    createdAtAsiaShanghai: formatShanghai(createdAtUtc),
    finishedAtUtc,
    finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
    authorizationId: beyondNineByNineScope
      ? BEYOND_NINE_BY_NINE_AUTHORIZATION_ID
      : AUTHORIZATION_ID,
    slotId: SLOT_ID,
    sourceDataset:
      "approved_sakaerat_wang_nam_khiao_measurement_package",
    parentWindowPlan: {
      runId: plan.runId,
      path: planPointer.runPath,
      sha256: sha256File(planPointer.runPath),
      currentCandidateId: currentAssignment.candidateId,
      currentCandidateFingerprint:
        currentAssignment.fingerprints.direct,
    },
    currentDuplicateFailureEvidence: {
      runId: diagnosis.runId,
      path: diagnosisPointer.runPath,
      sha256: sha256File(diagnosisPointer.runPath),
      historicalConditionGuidesCompared:
        diagnosis.allHistoryConditionGuideComparison.comparedCount,
      historicalConditionGuidesSkipped:
        diagnosis.allHistoryConditionGuideComparison.skippedCount,
      currentBandCentroids:
        diagnosis.currentGeometry.bandCentroids,
      nearestFullCoverageHistoricalComparisons:
        fullCoverageComparisons(
          diagnosis.currentGeometry.bandCentroids,
          historicalComparisons,
        ).slice(0, 12),
    },
    selectionRule: {
      methodId:
        "unused_real_measurement_window_dominant_water_and_route_macro_topology_hard_gate_v5",
      statement:
        beyondNineByNineScope
          ? "Use only the 40 newly authorized cells in the minimum 11x11 outer ring from the same formal Thailand sources to select anonymous route topology and internal river networks while the approved ports remain boundary constraints only; require water naturalness, departure from rejected shared skeletons, and zero dominant-water corridor duplicates before a candidate can reach the unchanged full condition-guide audit."
          : "Use each globally unassigned Thai measurement digest inside the owner-approved 9x9 scope to select its anonymous route topology and internal river network while the approved north-in, south-out and east-side ports remain boundary constraints only; require water naturalness, departure from the rejected shared skeleton, and zero dominant-water corridor duplicates before a candidate can reach the full condition-guide audit.",
      measurementCandidateScope: beyondNineByNineScope
        ? "new_11x11_outer_ring_only"
        : "unused_9x9_scope",
      newlyAuthorizedCandidateCount: beyondNineByNineScope
        ? 40
        : null,
      allHistoricalConditionGuidesCompared:
        historicalComparisonCount,
      currentHistoricalIndexPath: INDEX_PATH,
      currentHistoricalIndexSha256: sha256File(INDEX_PATH),
      minimumSharedWaterBandRatio:
        MINIMUM_SHARED_WATER_BAND_RATIO,
      duplicateMaximumWaterBandCentroidDistance:
        MAXIMUM_DUPLICATE_WATER_BAND_CENTROID_DISTANCE,
      requiredMinimumInteriorCentroidAtOrLeftOf:
        REQUIRED_MINIMUM_INTERIOR_CENTROID,
      requiredMinimumInteriorCentroidRange:
        REQUIRED_MINIMUM_INTERIOR_RANGE,
      historicalRgbRead: false,
      historicalConditionGuidesReadForAuditOnly: true,
      historicalGeometryCopied: false,
      exactRealWorldGeometryCarriedIntoGameCoordinates: false,
      routeAndFullCompositionStillRequireFinalConditionGuideAudit:
        true,
      routeTopologySelection:
        "measurement_fact_selected_without_forced_direction_family",
      connectivityPortPolicy:
        "approved_ports_are_boundary_constraints_only",
      dominantWaterTopologyCanBlockBeforeRgb: true,
    },
    counts: {
      totalCandidateWindows: candidates.candidates.length,
      currentlySelectedWindows: plan.assignments.length,
      unusedWindowsRanked: rankings.length,
      candidatesPassingNaturalness:
        rankings.filter((entry) => entry.waterNaturalnessPassed)
          .length,
      candidatesLeavingOldRightOnlyPattern:
        rankings.filter((entry) => entry.rightOnlyPatternGatePassed)
          .length,
      candidatesPassingAllHistoryWaterCorridorGate:
        rankings.filter(
          (entry) => entry.allHistoryWaterCorridorGatePassed,
        ).length,
      candidatesReadyForFullCompositionAudit:
        auditReadyCandidates.length,
      rgbCreated: 0,
      gpuTrainingRuns: 0,
    },
    selectedCandidate,
    rankings,
    nextRequiredAction: selectedCandidate
      ? "replace_only_slot_123_binding_with_the_selected_unused_real_measurement_window_then_rebuild_and_run_the_full_all_history_water_and_route_condition_guide_novelty_gate"
      : "stop_and_request_owner_direction_because_no_unused_authorized_measurement_window_satisfies_the_repaired_macro_topology_gate",
    outputBoundary: noComputeBoundary(),
    automaticStorage: {
      sqliteIndexed: true,
      bilingualProgramEvents: true,
      utcAndAsiaShanghaiTimestamps: true,
      sha256Recorded: true,
    },
  };

  const immutable = writeImmutableProgramRun({
    root: OUTPUT_ROOT,
    runId,
    fileName: "selection-report.json",
    record: report,
    latest: {
      schemaVersion:
        "earth-geospatial-v7-slot-123-all-history-window-selection-v5-latest-pointer",
      status,
      authorizationId: beyondNineByNineScope
        ? BEYOND_NINE_BY_NINE_AUTHORIZATION_ID
        : AUTHORIZATION_ID,
      slotId: SLOT_ID,
      selectedCandidateId:
        selectedCandidate?.candidateId ?? null,
      unusedWindowsRanked: rankings.length,
      historicalConditionGuidesCompared:
        historicalComparisonCount,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  });
  indexFile(path.resolve(ROOT, immutable.runPath), runId);

  appendAiPainterProgramEvent({
    timestamp: finishedAtUtc,
    action: selectedCandidate
      ? "v7_slot_123_all_history_window_selection_completed"
      : "v7_slot_123_all_history_window_selection_blocked",
    runId,
    kind: "measurement_window_selection",
    status: selectedCandidate ? "success" : "blocked",
    title: selectedCandidate
      ? "An unused real-measurement window was selected for the slot-123 full all-history composition audit"
      : "No unused real-measurement window was ready for the slot-123 full composition audit",
    titleZh: selectedCandidate
      ? "已为slot-123完整全历史构图审核选择未使用真实测量窗口"
      : "没有未使用真实测量窗口可进入slot-123完整构图审核",
    detail: selectedCandidate
      ? `selected=${selectedCandidate.candidateId}; unusedCompared=${rankings.length}; historicalGuidesCompared=${historicalComparisonCount}; minimumHistoricalDistance=${selectedCandidate.minimumHistoricalWaterBandCentroidDistance}; imageGenerationStarted=false; gpuTrainingStarted=false`
      : `unusedCompared=${rankings.length}; historicalGuidesCompared=${historicalComparisonCount}; passing=0; imageGenerationStarted=false; gpuTrainingStarted=false`,
    detailZh: selectedCandidate
      ? `已选择=${selectedCandidate.candidateId}；比较未使用窗口=${rankings.length}；比较历史引导图=${historicalComparisonCount}；最小历史距离=${selectedCandidate.minimumHistoricalWaterBandCentroidDistance}；未启动图像生成；未启动GPU训练。`
      : `比较未使用窗口=${rankings.length}；比较历史引导图=${historicalComparisonCount}；通过=0；未启动图像生成；未启动GPU训练。`,
    script: projectPath(import.meta.filename),
    currentStep: selectedCandidate
      ? "all_history_novel_window_selected"
      : "all_history_window_selection_blocked",
    evidencePath: immutable.runPath,
    evidence: [
      immutable.runPath,
      diagnosisPointer.runPath,
      planPointer.runPath,
    ],
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });

  console.log(
    JSON.stringify(
      {
        ok: Boolean(selectedCandidate),
        runId,
        status,
        reportPath: immutable.runPath,
        reportSha256: sha256File(immutable.runPath),
        unusedWindowsRanked: rankings.length,
        historicalConditionGuidesCompared:
          historicalComparisonCount,
        candidatesReadyForFullCompositionAudit:
          auditReadyCandidates.length,
        selectedCandidate,
        topRankings: rankings.slice(0, 5),
        imageGenerationStarted: false,
        rgbCreated: 0,
        gpuTrainingStarted: false,
      },
      null,
      2,
    ),
  );
  if (!selectedCandidate) process.exitCode = 2;
} catch (error) {
  const failedAtUtc = new Date().toISOString();
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    action: "v7_slot_123_all_history_window_selection_failed",
    runId,
    kind: "measurement_window_selection",
    status: "failed",
    title:
      "The slot-123 all-history real-measurement window selection failed",
    titleZh: "slot-123 全历史真实测量窗口选择失败",
    detail: `${error instanceof Error ? error.message : String(error)}; imageGenerationStarted=false; gpuTrainingStarted=false`,
    detailZh: `${error instanceof Error ? error.message : String(error)}；未启动图像生成；未启动GPU训练。`,
    script: projectPath(import.meta.filename),
    currentStep: "all_history_window_selection_failed",
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });
  throw error;
}

function rankCandidate({
  candidate,
  slot,
  currentAssignment,
  currentGeometry,
  historicalComparisons,
  waterNaturalnessProfile,
  boundaryWaterPorts,
}) {
  const assignment = buildReplacementAssignment({
    currentAssignment,
    slot,
    candidate,
  });
  try {
    const coarseProfile =
      buildMeasurementDerivedCoarseHydrologyProfile({
        assignment,
        root: ROOT,
      });
    const layoutProfile =
      buildMeasurementDrivenAnonymousLayoutProfile({
        assignment,
        hasWater: true,
        coarseHydrologyProfile: coarseProfile,
      });
    const routeTopologyDiversityGatePassed = [
      "seeded_interior_to_south_port_passage",
      "lower_interior_to_south_port_passage",
      "lower_transverse_to_south_port_passage",
      "west_interior_to_south_port_passage",
    ].includes(layoutProfile.routeTopology);
    if (!routeTopologyDiversityGatePassed) {
      return {
        candidateId: candidate.candidateId,
        directFingerprint: candidate.fingerprints.direct,
        transformCanonicalFingerprint:
          candidate.fingerprints.transformCanonical,
        measurementSupportScore: assignment.measurementSupportScore,
        routeTopology: layoutProfile.routeTopology,
        routeTopologyDiversityGatePassed: false,
        waterNaturalnessPassed: null,
        waterNaturalnessError:
          "measurement digest did not select a documented water-route topology",
        bandCentroids: null,
        minimumInteriorCentroid: null,
        interiorCentroidRange: null,
        rightOnlyPatternGatePassed: false,
        historicalGuidesWithSufficientSharedCoverage: 0,
        minimumHistoricalWaterBandCentroidDistance: null,
        nearestHistoricalComparisons: [],
        allHistoryDuplicateMatchCount: null,
        allHistoryDuplicateMatches: [],
        allHistoryWaterCorridorGatePassed: false,
        distanceFromCurrentRejectedCandidate: null,
        coarseHydrologyProfileSha256: coarseProfile.profileSha256,
        mainChannelGeometrySha256: null,
        readyForFullCompositionAudit: false,
      };
    }
    const geometry = buildCandidateGeometry({
      assignment,
      waterNaturalnessProfile,
      coarseProfile,
      boundaryWaterPorts,
    });
    const comparisons = fullCoverageComparisons(
      geometry.bandCentroids,
      historicalComparisons,
    );
    assert(
      comparisons.length > 0,
      "no historical guide has sufficient shared water-band coverage",
    );
    const duplicateMatches = comparisons.filter(
      (entry) =>
        entry.meanAbsoluteWaterBandCentroidDistance <=
        MAXIMUM_DUPLICATE_WATER_BAND_CENTROID_DISTANCE,
    );
    const interior = geometry.bandCentroids.slice(2, 7);
    const minimumInteriorCentroid = Math.min(...interior);
    const interiorCentroidRange =
      Math.max(...interior) - Math.min(...interior);
    const rightOnlyPatternGatePassed =
      minimumInteriorCentroid <=
        REQUIRED_MINIMUM_INTERIOR_CENTROID &&
      interiorCentroidRange >= REQUIRED_MINIMUM_INTERIOR_RANGE;
    const allHistoryWaterCorridorGatePassed =
      duplicateMatches.length === 0;
    return {
      candidateId: candidate.candidateId,
      directFingerprint: candidate.fingerprints.direct,
      transformCanonicalFingerprint:
        candidate.fingerprints.transformCanonical,
      measurementSupportScore: assignment.measurementSupportScore,
      routeTopology: layoutProfile.routeTopology,
      routeTopologyDiversityGatePassed,
      waterNaturalnessPassed: true,
      waterNaturalnessError: null,
      bandCentroids: geometry.bandCentroids,
      minimumInteriorCentroid: round(minimumInteriorCentroid),
      interiorCentroidRange: round(interiorCentroidRange),
      rightOnlyPatternGatePassed,
      historicalGuidesWithSufficientSharedCoverage:
        comparisons.length,
      minimumHistoricalWaterBandCentroidDistance:
        comparisons[0].meanAbsoluteWaterBandCentroidDistance,
      nearestHistoricalComparisons: comparisons.slice(0, 12),
      allHistoryDuplicateMatchCount: duplicateMatches.length,
      allHistoryDuplicateMatches: duplicateMatches.slice(0, 20),
      allHistoryWaterCorridorGatePassed,
      distanceFromCurrentRejectedCandidate:
        currentGeometry
          ? meanDistance(
              geometry.bandCentroids,
              currentGeometry.bandCentroids,
            )
          : null,
      coarseHydrologyProfileSha256:
        geometry.coarseProfile.profileSha256,
      mainChannelGeometrySha256:
        geometry.mainChannel.geometrySha256,
      readyForFullCompositionAudit:
        routeTopologyDiversityGatePassed &&
        rightOnlyPatternGatePassed &&
        allHistoryWaterCorridorGatePassed,
    };
  } catch (error) {
    return {
      candidateId: candidate.candidateId,
      directFingerprint: candidate.fingerprints.direct,
      transformCanonicalFingerprint:
        candidate.fingerprints.transformCanonical,
      measurementSupportScore: assignment.measurementSupportScore,
      routeTopology: null,
      routeTopologyDiversityGatePassed: false,
      waterNaturalnessPassed: false,
      waterNaturalnessError:
        error instanceof Error ? error.message : String(error),
      bandCentroids: null,
      minimumInteriorCentroid: null,
      interiorCentroidRange: null,
      rightOnlyPatternGatePassed: false,
      historicalGuidesWithSufficientSharedCoverage: 0,
      minimumHistoricalWaterBandCentroidDistance: null,
      nearestHistoricalComparisons: [],
      allHistoryDuplicateMatchCount: null,
      allHistoryDuplicateMatches: [],
      allHistoryWaterCorridorGatePassed: false,
      distanceFromCurrentRejectedCandidate: null,
      coarseHydrologyProfileSha256: null,
      mainChannelGeometrySha256: null,
      readyForFullCompositionAudit: false,
    };
  }
}

function buildCandidateGeometry({
  assignment,
  waterNaturalnessProfile,
  coarseProfile = null,
  boundaryWaterPorts,
}) {
  const effectiveCoarseProfile =
    coarseProfile ??
    buildMeasurementDerivedCoarseHydrologyProfile({
      assignment,
      root: ROOT,
    });
  const halfWidths = buildMeasurementDerivedNetworkHalfWidths({
    pointCount: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
    startHalfWidth: 76,
    endHalfWidth: 140,
    coarseHydrologyProfile: effectiveCoarseProfile,
  });
  const mainChannel =
    buildMeasurementDerivedAnonymousMainChannel({
      start: structuredClone(boundaryWaterPorts.upstream),
      end: structuredClone(boundaryWaterPorts.downstream),
      width: 1024,
      height: 768,
      coarseHydrologyProfile: effectiveCoarseProfile,
      waterNaturalnessProfile,
      corridorHalfWidths: halfWidths,
    });
  return {
    coarseProfile: effectiveCoarseProfile,
    mainChannel,
    bandCentroids: pointBandCentroids(
      mainChannel.points,
      BAND_COUNT,
      1024,
    ),
  };
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

async function readAllHistoricalWaterCorridors() {
  const index = readJson(INDEX_PATH);
  const comparisons = [];
  let skippedCount = 0;
  for (const record of index.records ?? []) {
    const guidePath = record.conditionBinding?.guidePath;
    if (
      record.categoryId !== "complete-maps" ||
      !guidePath
    ) {
      continue;
    }
    const absoluteGuidePath = path.resolve(ROOT, guidePath);
    if (!fs.existsSync(absoluteGuidePath)) {
      skippedCount += 1;
      continue;
    }
    try {
      comparisons.push({
        recordId: record.recordId,
        status: record.status,
        ownerReviewStatus:
          record.reviews?.ownerReviewStatus ?? null,
        guidePath: projectPath(absoluteGuidePath),
        guideSha256: sha256File(absoluteGuidePath),
        historicalWaterBandCentroids:
          await guideWaterBandCentroids(
            absoluteGuidePath,
            BAND_COUNT,
          ),
      });
    } catch {
      skippedCount += 1;
    }
  }
  comparisons.sort((left, right) =>
    left.recordId.localeCompare(right.recordId),
  );
  return {
    indexSha256: sha256File(INDEX_PATH),
    comparisons,
    skippedCount,
  };
}

async function guideWaterBandCentroids(filePath, bandCount) {
  const { data, info } = await sharp(filePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Array.from({ length: bandCount }, (_, bandIndex) => {
    const top = Math.floor(
      (bandIndex * info.height) / bandCount,
    );
    const bottom = Math.max(
      top + 1,
      Math.floor(
        ((bandIndex + 1) * info.height) / bandCount,
      ),
    );
    let totalX = 0;
    let count = 0;
    for (let y = top; y < bottom; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const offset =
          (y * info.width + x) * info.channels;
        if (
          data[offset] !== WATER_COLOR[0] ||
          data[offset + 1] !== WATER_COLOR[1] ||
          data[offset + 2] !== WATER_COLOR[2]
        ) {
          continue;
        }
        totalX += x / info.width;
        count += 1;
      }
    }
    return count > 0 ? round(totalX / count) : null;
  });
}

function fullCoverageComparisons(
  candidateBandCentroids,
  historicalComparisons,
) {
  return historicalComparisons
    .map((entry) => {
      const metrics = corridorDistance(
        candidateBandCentroids,
        entry.historicalWaterBandCentroids,
      );
      return {
        recordId: entry.recordId,
        status: entry.status,
        ownerReviewStatus: entry.ownerReviewStatus,
        guidePath: entry.guidePath,
        guideSha256: entry.guideSha256,
        historicalWaterBandCentroids:
          entry.historicalWaterBandCentroids,
        ...metrics,
      };
    })
    .filter(
      (entry) =>
        entry.sharedBandRatio >=
        MINIMUM_SHARED_WATER_BAND_RATIO,
    )
    .sort(
      (left, right) =>
        left.meanAbsoluteWaterBandCentroidDistance -
          right.meanAbsoluteWaterBandCentroidDistance ||
        left.recordId.localeCompare(right.recordId),
    );
}

function corridorDistance(left, right) {
  let sharedBandCount = 0;
  let distanceTotal = 0;
  const leftOccupied = left.filter(Number.isFinite).length;
  const rightOccupied = right.filter(Number.isFinite).length;
  for (let index = 0; index < BAND_COUNT; index += 1) {
    if (
      !Number.isFinite(left[index]) ||
      !Number.isFinite(right[index])
    ) {
      continue;
    }
    sharedBandCount += 1;
    distanceTotal += Math.abs(left[index] - right[index]);
  }
  return {
    sharedBandCount,
    sharedBandRatio: round(
      sharedBandCount /
        Math.max(1, leftOccupied, rightOccupied),
    ),
    meanAbsoluteWaterBandCentroidDistance: round(
      distanceTotal / Math.max(1, sharedBandCount),
    ),
  };
}

function buildReplacementAssignment({
  currentAssignment,
  slot,
  candidate,
}) {
  return {
    ...structuredClone(currentAssignment),
    slotId: slot.slotId,
    split: slot.split,
    regionalLandscapeType: slot.regionalLandscapeType,
    monsoonSeason: slot.monsoonSeason,
    coverageRole: slot.coverageRole,
    candidateId: candidate.candidateId,
    measurementSupportScore: round(scoreCandidate(candidate, slot)),
    measurementBounds: structuredClone(candidate.measurementBounds),
    sourcePixelWindow: structuredClone(candidate.sourcePixelWindow),
    metrics: structuredClone(candidate.metrics),
    fingerprints: structuredClone(candidate.fingerprints),
    targetEcologyIsDirectlyClaimedByWindowSelection: false,
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
  };
}

function scoreCandidate(candidate, slot) {
  const metrics = candidate.metrics;
  const relief = metrics.relativeRelief;
  const elevation = metrics.relativeElevation;
  const slope = metrics.normalizedSlope.mean;
  const drainage = metrics.drainageLikelihoodRatio;
  const forest = metrics.reconstructedLandCoverRatio.treeCover;
  const grass = metrics.reconstructedLandCoverRatio.grassland;
  const flatness = 1 - Math.min(1, slope);
  const type = slot.regionalLandscapeType;
  let score = forest * 0.25 + relief * 0.2 + drainage * 0.1;
  if (/mountain|foothill|rocky|low-hill/.test(type)) {
    score += relief * 1.5 + slope * 1.1 + elevation * 0.5;
  }
  if (/valley|floodplain|drainage|riverbank|stream/.test(type)) {
    score +=
      drainage * 2 + flatness * 0.45 + (1 - elevation) * 0.25;
  }
  if (/swamp|marsh|pond|creek/.test(type)) {
    score +=
      drainage * 2.5 + flatness * 0.6 + (1 - elevation) * 0.35;
  }
  if (/grassland|glade|transition/.test(type)) {
    score += grass * 5 + flatness * 0.45 + (1 - forest) * 0.2;
  }
  if (/forest|woodland|bamboo|teak/.test(type)) {
    score += forest * 0.8 + relief * 0.25;
  }
  if (slot.monsoonSeason === "wet_season") {
    score += drainage * 0.4;
  }
  if (slot.monsoonSeason === "dry_season") {
    score += metrics.reconstructedLandCoverRatio.bareOrSparse * 2;
  }
  score -= metrics.humanRemovalRatio * 0.5;
  return score;
}

function compareRankings(left, right) {
  return (
    Number(right.readyForFullCompositionAudit) -
      Number(left.readyForFullCompositionAudit) ||
    nullableDescending(
      left.minimumHistoricalWaterBandCentroidDistance,
      right.minimumHistoricalWaterBandCentroidDistance,
    ) ||
    nullableDescending(
      left.distanceFromCurrentRejectedCandidate,
      right.distanceFromCurrentRejectedCandidate,
    ) ||
    right.measurementSupportScore - left.measurementSupportScore ||
    left.candidateId.localeCompare(right.candidateId)
  );
}

function nullableDescending(left, right) {
  const leftValue = Number.isFinite(left)
    ? left
    : Number.NEGATIVE_INFINITY;
  const rightValue = Number.isFinite(right)
    ? right
    : Number.NEGATIVE_INFINITY;
  return rightValue - leftValue;
}

function pointBandCentroids(points, bandCount, width) {
  return Array.from({ length: bandCount }, (_, bandIndex) => {
    const minimumY = (bandIndex / bandCount) * 768;
    const maximumY = ((bandIndex + 1) / bandCount) * 768;
    const selected = points.filter(
      (point, pointIndex) =>
        point.y >= minimumY &&
        (bandIndex === bandCount - 1
          ? point.y <= maximumY
          : point.y < maximumY) &&
        (pointIndex > 0 || bandIndex === 0),
    );
    assert(
      selected.length > 0,
      `anonymous main channel has no points in band ${bandIndex}`,
    );
    return round(
      mean(selected.map((point) => point.x)) / width,
    );
  });
}

function meanDistance(left, right) {
  assert(left.length === right.length, "band centroid count mismatch");
  return round(
    mean(
      left.map((value, index) =>
        Math.abs(value - right[index]),
      ),
    ),
  );
}

function noComputeBoundary() {
  return {
    conditionPackageBuilt: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    runtimeFrameCreated: false,
    worldEntryStarted: false,
  };
}

function verifyHash(relativePath, expectedHash) {
  assert(
    sha256File(relativePath) === expectedHash,
    `artifact hash mismatch: ${relativePath}`,
  );
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

function mean(values) {
  assert(values.length > 0, "cannot calculate an empty mean");
  return (
    values.reduce((total, value) => total + value, 0) /
    values.length
  );
}

function round(value) {
  return Number(value.toFixed(8));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
