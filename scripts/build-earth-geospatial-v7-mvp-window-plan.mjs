import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";

const ROOT = process.cwd();
const WIDTH = 1024;
const HEIGHT = 768;
const HYDROLOGY_WIDTH = 256;
const HYDROLOGY_HEIGHT = 192;
const EXPANDED_SLOT_123_SCOPE = process.argv.includes(
  "--expanded-slot-123-scope",
);
const BEYOND_NINE_BY_NINE_SLOT_123_SCOPE = process.argv.includes(
  "--beyond-nine-by-nine-slot-123-scope",
);
const GRID_COLUMNS = BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
  ? 11
  : EXPANDED_SLOT_123_SCOPE
    ? 9
    : 7;
const GRID_ROWS = GRID_COLUMNS;
const EXPECTED_CANDIDATES = GRID_COLUMNS * GRID_ROWS;
const AUTHORIZED_SELECTION_LIMIT = 38;
const CONTRACT_ID =
  "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1";
const AUTHORIZATION_ID =
  "owner-authorized-v7-mvp64-gap38-real-geography-bounded-data-build-20260725";
const EXPANDED_SCOPE_AUTHORIZATION_ID =
  "owner-authorized-slot-123-expanded-real-measurement-window-scope-20260728";
const BEYOND_NINE_BY_NINE_AUTHORIZATION_ID =
  "owner-authorized-slot-123-thai-measurement-scope-beyond-9x9-no-rgb-20260729";
const OWNER_TAKEOVER_AUTHORIZATION_PATH =
  ".runtime/ai-painter/ai-assisted-v7-owner-takeover-authorizations/latest.json";
const BEYOND_NINE_BY_NINE_AUTHORIZATION_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-scope-expansion-authorizations/latest.json";
const PRIOR_WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const CONFIG_PATH =
  "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json";
const CAPACITY_LATEST_PATH =
  ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json";
const MEASUREMENT_LATEST_PATH =
  ".runtime/ai-painter/earth-geospatial-naturalization-runs/latest.json";
const WORLD_FACT_LATEST_PATH =
  ".runtime/ai-painter/earth-geospatial-naturalized-world-fact-runs/latest.json";
const SOIL_HYDROLOGY_LATEST_PATH =
  ".runtime/ai-painter/earth-geospatial-soil-hydrology-runs/latest.json";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans";

const createdAtUtc = new Date().toISOString();
const createdAtAsiaShanghai = formatShanghai(createdAtUtc);
const runId = `earth-geospatial-v7-mvp-window-plan-${createdAtUtc.replace(
  /[:.]/g,
  "-",
)}`;
const runRoot = path.join(ROOT, OUTPUT_ROOT, runId);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  status: "running",
  type: "earth_geospatial_v7_mvp_window_plan_started",
  title: "V7 MVP real-geography window planning started",
  titleZh: "V7 MVP真实地理窗口规划已启动",
  titleEn: "V7 MVP real-geography window planning started",
  summary:
    `程序开始从已批准的Sakaerat测量证据中建立${EXPECTED_CANDIDATES}个互不重叠候选窗口，并为原38槽有界授权范围内的当前剩余V7 MVP缺口编制测量支持计划。本轮不生成RGB、不启动GPU训练。`,
  summaryEn:
    `The program started building ${EXPECTED_CANDIDATES} non-overlapping candidates from the approved Sakaerat measurements and planning measurement support for the current remaining V7 MVP gaps within the bounded 38-slot authorization. This run creates no RGB and starts no GPU training.`,
  command: "npm run build:earth-geospatial-v7-mvp-window-plan",
  runId,
});

try {
  assert(
    !(EXPANDED_SLOT_123_SCOPE && BEYOND_NINE_BY_NINE_SLOT_123_SCOPE),
    "window-plan scope flags are mutually exclusive",
  );
  if (EXPANDED_SLOT_123_SCOPE) {
    const ownerTakeover = readJson(OWNER_TAKEOVER_AUTHORIZATION_PATH);
    assert(
      ownerTakeover.windowScopeAuthorizationId ===
        EXPANDED_SCOPE_AUTHORIZATION_ID &&
        ownerTakeover.scope?.expandRealMeasurementWindowScopeForSlot123 ===
          true &&
        ownerTakeover.currentExecutionBoundary?.gpuTrainingStarted === false,
      "expanded real-measurement window planning is not owner-authorized",
    );
  }
  let beyondNineByNineAuthorization = null;
  let priorWindowPlan = null;
  if (BEYOND_NINE_BY_NINE_SLOT_123_SCOPE) {
    const beyondNineByNineAuthorizationPointer = readJson(
      BEYOND_NINE_BY_NINE_AUTHORIZATION_PATH,
    );
    beyondNineByNineAuthorization = readJson(
      beyondNineByNineAuthorizationPointer.runPath,
    );
    assert(
      beyondNineByNineAuthorizationPointer.authorizationId ===
        BEYOND_NINE_BY_NINE_AUTHORIZATION_ID &&
      beyondNineByNineAuthorization.authorizationId ===
        BEYOND_NINE_BY_NINE_AUTHORIZATION_ID &&
        beyondNineByNineAuthorization.scope?.authorizedGridSize === 11 &&
        beyondNineByNineAuthorization.scope?.minimumNextOuterRingOnly ===
          true &&
        beyondNineByNineAuthorization.scope?.conditionOnlyNoRgb === true &&
        beyondNineByNineAuthorization.outputBoundary
          ?.imageGenerationAuthorized === false &&
        beyondNineByNineAuthorization.outputBoundary
          ?.gpuTrainingAuthorized === false,
      "beyond-9x9 real-measurement window planning is not owner-authorized",
    );
    const priorWindowPlanPointer = readJson(
      PRIOR_WINDOW_PLAN_POINTER_PATH,
    );
    priorWindowPlan = readJson(priorWindowPlanPointer.runPath);
    const priorCandidates = readJson(
      priorWindowPlan.candidateWindowsPath,
    );
    assert(
      priorCandidates.grid?.columns === 9 &&
        priorCandidates.grid?.rows === 9 &&
        priorCandidates.candidates?.length === 81,
      "the immediately prior window plan is not the exhausted 9x9 plan",
    );
  }
  const config = readJson(CONFIG_PATH);
  const decision = config.training?.dataCapacityDecision;
  const authorization = decision?.boundedDataBuildAuthorization;
  assert(
    authorization?.authorizationId === AUTHORIZATION_ID,
    "bounded data-build authorization identity mismatch",
  );
  assert(
    authorization.status === "authorized_data_preparation_only" &&
      authorization.authorizedRecordCount === AUTHORIZED_SELECTION_LIMIT,
    "bounded authorization scope mismatch",
  );
  assert(
    authorization.measurementWindowPlanningAuthorized === true &&
      authorization.conditionPackagePreparationAuthorized === true,
    "data preparation is not authorized",
  );
  assert(
    authorization.imageGenerationAuthorized === false &&
      authorization.gpuTrainingAuthorized === false &&
      authorization.runtimeFrameAuthorized === false &&
      authorization.worldEntryAuthorized === false,
    "bounded authorization crossed the RGB, GPU, Runtime, or world gate",
  );

  const capacityLatest = readJson(CAPACITY_LATEST_PATH);
  const gapList = readJson(capacityLatest.gapListPath);
  const assignedPlannedSlots = (gapList.plannedSlots ?? []).filter(
    (slot) => typeof slot.slotId === "string",
  );
  const unassignedReplacementCount =
    (gapList.plannedSlots ?? []).length - assignedPlannedSlots.length;
  const expectedSelections = assignedPlannedSlots.length;
  assert(
    Number.isInteger(expectedSelections) &&
      expectedSelections > 0 &&
      expectedSelections <= authorization.authorizedRecordCount &&
      gapList.requiredNewRecordCount ===
        expectedSelections + unassignedReplacementCount,
    "capacity gap list must contain the current remaining slots within the authorized 38-slot scope",
  );
  assert(
    assignedPlannedSlots.every((slot) =>
      /^v7-capacity-slot-(10[8-9]|1[1-3][0-9]|14[0-5])$/.test(slot.slotId),
    ),
    "capacity gap list contains a slot outside the authorized 108-145 range",
  );
  assert(
    assignedPlannedSlots.every(
      (slot) =>
        slot.imageGenerationAuthorized === false &&
        slot.gpuTrainingAuthorized === false,
    ),
    "capacity gap plan unexpectedly authorizes RGB or GPU",
  );

  const measurementLatest = readJson(MEASUREMENT_LATEST_PATH);
  const measurement = readJson(measurementLatest.runPath);
  const worldFactLatest = readJson(WORLD_FACT_LATEST_PATH);
  const worldFactRun = readJson(worldFactLatest.runPath);
  const soilHydrologyLatest = readJson(SOIL_HYDROLOGY_LATEST_PATH);
  const soilHydrology = readJson(soilHydrologyLatest.runPath);
  assert(
    measurement.contractId === CONTRACT_ID &&
      worldFactRun.contractId === CONTRACT_ID &&
      soilHydrology.contractId === CONTRACT_ID,
    "real-geography source contract mismatch",
  );

  const elevationRecord = measurement.rasterWindows?.elevation;
  const landCoverRecord = {
    path: worldFactRun.reconstructedNaturalLandCoverPath,
    sha256: worldFactRun.reconstructedNaturalLandCoverSha256,
  };
  const humanRemovalRecord = {
    path: worldFactRun.combinedHumanRemovalMaskPath,
    sha256: worldFactRun.combinedHumanRemovalMaskSha256,
  };
  const hydrologyRecord = soilHydrology.naturalHydrology;
  for (const evidence of [
    [elevationRecord.outputPath, elevationRecord.outputSha256],
    [landCoverRecord.path, landCoverRecord.sha256],
    [humanRemovalRecord.path, humanRemovalRecord.sha256],
    [hydrologyRecord.slopePath, hydrologyRecord.slopeSha256],
    [
      hydrologyRecord.drainageLikelihoodPath,
      hydrologyRecord.drainageLikelihoodSha256,
    ],
  ]) {
    verifyHash(...evidence);
  }

  const elevation = readFloat32Gzip(
    elevationRecord.outputPath,
    WIDTH * HEIGHT,
  );
  const landCover = readUint8Gzip(
    landCoverRecord.path,
    WIDTH * HEIGHT,
  );
  const humanRemoval = readUint8Gzip(
    humanRemovalRecord.path,
    WIDTH * HEIGHT,
  );
  const slope = readFloat32Gzip(
    hydrologyRecord.slopePath,
    HYDROLOGY_WIDTH * HYDROLOGY_HEIGHT,
  );
  const drainage = readUint8Gzip(
    hydrologyRecord.drainageLikelihoodPath,
    HYDROLOGY_WIDTH * HYDROLOGY_HEIGHT,
  );

  const bounds = measurement.observationExtent.bounds;
  const globalElevation = describeFloat(elevation);
  const candidates = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      candidates.push(
        buildCandidate({
          row,
          column,
          bounds,
          globalElevation,
          elevation,
          landCover,
          humanRemoval,
          slope,
          drainage,
        }),
      );
    }
  }
  assert(
    candidates.length === EXPECTED_CANDIDATES,
    "candidate count mismatch",
  );
  assertUnique(candidates.map((entry) => entry.candidateId), "candidate id");
  assertUnique(
    candidates.map((entry) => entry.fingerprints.direct),
    "direct measurement fingerprint",
  );
  assertUnique(
    candidates.map((entry) => entry.fingerprints.transformCanonical),
    "mirror/rotation canonical fingerprint",
  );

  const available = new Map(
    candidates
      .filter(
        (candidate) =>
          (!EXPANDED_SLOT_123_SCOPE &&
            !BEYOND_NINE_BY_NINE_SLOT_123_SCOPE) ||
          candidate.row === 0 ||
          candidate.row === GRID_ROWS - 1 ||
          candidate.column === 0 ||
          candidate.column === GRID_COLUMNS - 1,
      )
      .map((candidate) => [candidate.candidateId, candidate]),
  );
  const assignments = [];
  for (const slot of assignedPlannedSlots) {
    if (BEYOND_NINE_BY_NINE_SLOT_123_SCOPE) {
      const priorAssignment = priorWindowPlan.assignments.find(
        (entry) => entry.slotId === slot.slotId,
      );
      assert(
        priorAssignment,
        `prior 9x9 assignment is missing for ${slot.slotId}`,
      );
      const selected = candidates.find((candidate) =>
        sameMeasurementBounds(
          candidate.measurementBounds,
          priorAssignment.measurementBounds,
        ),
      );
      assert(
        selected,
        `prior 9x9 physical measurement window was not preserved for ${slot.slotId}`,
      );
      available.delete(selected.candidateId);
      assignments.push(
        buildAssignment({ slot, selected, score: scoreCandidate(selected, slot) }),
      );
      continue;
    }
    const ranked = [...available.values()]
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(candidate, slot),
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.candidate.candidateId.localeCompare(right.candidate.candidateId),
    );
    const selected = ranked[0];
    assert(selected, `no measurement window remains for ${slot.slotId}`);
    available.delete(selected.candidate.candidateId);
    assignments.push(
      buildAssignment({
        slot,
        selected: selected.candidate,
        score: selected.score,
      }),
    );
  }

  assert(
    assignments.length === expectedSelections,
    "selection count mismatch",
  );
  assertUnique(assignments.map((entry) => entry.slotId), "selected slot");
  assertUnique(
    assignments.map((entry) => entry.candidateId),
    "selected measurement window",
  );
  assertNoOverlap(assignments);

  const candidatePath = path.join(runRoot, "candidate-windows.json");
  const candidateRecord = {
    schemaVersion: "earth-geospatial-v7-mvp-candidate-windows-v1",
    runId,
    status: "candidate_measurement_windows_compiled",
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    authorizationId: AUTHORIZATION_ID,
    scopeExpansionAuthorizationId:
      BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
        ? BEYOND_NINE_BY_NINE_AUTHORIZATION_ID
        : EXPANDED_SLOT_123_SCOPE
          ? EXPANDED_SCOPE_AUTHORIZATION_ID
          : null,
    grid: {
      columns: GRID_COLUMNS,
      rows: GRID_ROWS,
      candidateCount: candidates.length,
      eligibleNewOuterRingCandidateCount:
        BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
          ? 40
          : EXPANDED_SLOT_123_SCOPE
            ? 32
            : candidates.length,
      priorSevenBySevenEnvelopePreservedInside:
        EXPANDED_SLOT_123_SCOPE ||
        BEYOND_NINE_BY_NINE_SLOT_123_SCOPE,
      priorNineByNineEnvelopePreservedInside:
        BEYOND_NINE_BY_NINE_SLOT_123_SCOPE,
      newlyAuthorizedOuterRingOnly:
        BEYOND_NINE_BY_NINE_SLOT_123_SCOPE,
      selectedCount: assignments.length,
      overlapAllowed: false,
    },
    sourceBoundary: sourceBoundary(),
    candidates,
  };
  writeJsonAtomic(candidatePath, candidateRecord);
  indexFile(candidatePath, runId);

  const plan = {
    schemaVersion: "earth-geospatial-v7-mvp-window-plan-v1",
    runId,
    status: "real_geography_window_plan_ready_condition_build_required",
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    authorizationId: AUTHORIZATION_ID,
    scopeExpansionAuthorizationId:
      BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
        ? BEYOND_NINE_BY_NINE_AUTHORIZATION_ID
        : EXPANDED_SLOT_123_SCOPE
          ? EXPANDED_SCOPE_AUTHORIZATION_ID
          : null,
    capacityPlanRunId: capacityLatest.runId,
    capacityGapListPath: capacityLatest.gapListPath,
    capacityGapListSha256: sha256File(
      path.join(ROOT, capacityLatest.gapListPath),
    ),
    candidateWindowsPath: projectPath(candidatePath),
    candidateWindowsSha256: sha256File(candidatePath),
    counts: {
      candidateWindows: candidates.length,
      selectedWindows: assignments.length,
      remainingUnselectedWindows: available.size,
      rgbCreated: 0,
      gpuTrainingRuns: 0,
    },
    sourceEvidence: {
      measurementRunId: measurement.runId,
      naturalizedWorldFactRunId: worldFactRun.runId,
      soilHydrologyRunId: soilHydrology.runId,
      elevationPath: elevationRecord.outputPath,
      elevationSha256: elevationRecord.outputSha256,
      reconstructedNaturalLandCoverPath: landCoverRecord.path,
      reconstructedNaturalLandCoverSha256: landCoverRecord.sha256,
      combinedHumanRemovalMaskPath: humanRemovalRecord.path,
      combinedHumanRemovalMaskSha256: humanRemovalRecord.sha256,
      slopePath: hydrologyRecord.slopePath,
      slopeSha256: hydrologyRecord.slopeSha256,
      drainageLikelihoodPath: hydrologyRecord.drainageLikelihoodPath,
      drainageLikelihoodSha256: hydrologyRecord.drainageLikelihoodSha256,
    },
    sourceBoundary: sourceBoundary(),
    selectionMethod: {
      methodId:
        BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
          ? "owner_authorized_minimum_next_outer_ring_preserve_prior_physical_assignments_v3"
          : EXPANDED_SLOT_123_SCOPE
            ? "owner_authorized_adjacent_outer_ring_non_overlapping_real_measurement_windows_greedy_landscape_fit_v2"
            : "non_overlapping_real_measurement_windows_greedy_landscape_fit_v1",
      statement:
        BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
          ? "The owner-authorized minimum next Thailand envelope is partitioned into 121 non-overlapping 4:3 measurement windows. The prior nine-by-nine physical assignments are preserved by exact bounds, and only the new 40-cell outer ring is eligible for slot-123 no-RGB screening."
          : EXPANDED_SLOT_123_SCOPE
            ? "The owner-authorized adjacent Wang Nam Khiao envelope is partitioned into 81 non-overlapping 4:3 measurement windows. Only the 32-cell outer ring, which does not overlap the prior seven-by-seven envelope, is eligible for the remaining fixed V7 slots."
            : "The approved observation envelope is partitioned into 49 non-overlapping 4:3 measurement windows. Each V7 gap slot receives one unique window using measured relief, slope, drainage, land cover, and human-removal metrics. Selection does not itself claim the requested ecological identity.",
      exactRealWorldGeometryCarriedForward: false,
      historicalRgbRead: false,
      mirroredOrRotatedWindowAccepted: false,
      presetHomeSiteCreated: false,
      priorPhysicalAssignmentsPreserved:
        BEYOND_NINE_BY_NINE_SLOT_123_SCOPE,
      slot123ScreeningCandidateScope:
        BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
          ? "new_11x11_outer_ring_only"
          : null,
    },
    assignments,
    outputBoundary: {
      worldFactsCreatedForSelectedWindows: false,
      worldDirectorCreatedForSelectedWindows: false,
      completeMap23ChannelsCreatedForSelectedWindows: false,
      imageGenerationStarted: false,
      rgbCreated: false,
      gpuTrainingStarted: false,
      ownerApprovalAutomatic: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
    nextRequiredAction:
      "program_build_and_independently_check_per_slot_world_facts_world_director_and_complete_map_23_channels_before_any_rgb_authorization",
  };
  const immutable = writeImmutableProgramRun({
    root: OUTPUT_ROOT,
    runId,
    fileName: "window-plan.json",
    record: plan,
    latest: {
      contractId: CONTRACT_ID,
      authorizationId: AUTHORIZATION_ID,
      scopeExpansionAuthorizationId:
        plan.scopeExpansionAuthorizationId,
      measurementGridSize: GRID_COLUMNS,
      candidateWindowsPath: plan.candidateWindowsPath,
      candidateWindowsSha256: plan.candidateWindowsSha256,
      capacityPlanRunId: capacityLatest.runId,
      selectedWindowCount: assignments.length,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  });

  appendAiPainterProgramEvent({
    timestamp: new Date().toISOString(),
    status: "success",
    type: "earth_geospatial_v7_mvp_window_plan_completed",
    title: "V7 MVP real-geography window planning completed",
    titleZh: "V7 MVP真实地理窗口规划已完成",
    titleEn: "V7 MVP real-geography window planning completed",
    summary:
      `程序已从${candidates.length}个互不重叠真实测量窗口中保持${assignments.length}个当前V7缺口槽位的唯一物理绑定，并保存指标、来源、哈希和后续证据门禁。本轮未生成RGB、未启动GPU训练。`,
    summaryEn:
      `The program preserved one unique physical real-measurement binding for each of the ${assignments.length} current V7 gap slots across ${candidates.length} non-overlapping candidates and stored metrics, provenance, hashes, and downstream evidence gates. No RGB was created and no GPU training started.`,
    command: "npm run build:earth-geospatial-v7-mvp-window-plan",
    runId,
    evidencePath: immutable.runPath,
  });

  console.log(
    JSON.stringify(
      {
        status: plan.status,
        runId,
        planPath: immutable.runPath,
        candidateWindows: candidates.length,
        selectedWindows: assignments.length,
        remainingUnselectedWindows: available.size,
        firstSlot: assignments[0].slotId,
        lastSlot: assignments.at(-1).slotId,
        imageGenerationStarted: false,
        gpuTrainingStarted: false,
        nextRequiredAction: plan.nextRequiredAction,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const failedAtUtc = new Date().toISOString();
  const failurePath = path.join(runRoot, "failure.json");
  const failure = {
    schemaVersion: "earth-geospatial-v7-mvp-window-plan-failure-v1",
    runId,
    status: "failed",
    createdAtUtc,
    createdAtAsiaShanghai,
    failedAtUtc,
    failedAtAsiaShanghai: formatShanghai(failedAtUtc),
    errorCode: "earth_geospatial_v7_mvp_window_plan_failed",
    errorMessage: error instanceof Error ? error.message : String(error),
    outputBoundary: {
      imageGenerationStarted: false,
      rgbCreated: false,
      gpuTrainingStarted: false,
    },
  };
  writeJsonAtomic(failurePath, failure);
  indexFile(failurePath, runId);
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    status: "failed",
    type: failure.errorCode,
    title: "V7 MVP real-geography window planning failed",
    titleZh: "V7 MVP真实地理窗口规划失败",
    titleEn: "V7 MVP real-geography window planning failed",
    summary: `窗口规划已阻断：${failure.errorMessage}。未生成RGB，未启动GPU训练。`,
    summaryEn: `Window planning was blocked: ${failure.errorMessage}. No RGB was created and no GPU training started.`,
    command: "npm run build:earth-geospatial-v7-mvp-window-plan",
    runId,
    evidencePath: projectPath(failurePath),
  });
  throw error;
}

function buildCandidate({
  row,
  column,
  bounds,
  globalElevation,
  elevation,
  landCover,
  humanRemoval,
  slope,
  drainage,
}) {
  const left = Math.round((column * WIDTH) / GRID_COLUMNS);
  const right = Math.round(((column + 1) * WIDTH) / GRID_COLUMNS);
  const top = Math.round((row * HEIGHT) / GRID_ROWS);
  const bottom = Math.round(((row + 1) * HEIGHT) / GRID_ROWS);
  const hydroLeft = Math.round((column * HYDROLOGY_WIDTH) / GRID_COLUMNS);
  const hydroRight = Math.round(
    ((column + 1) * HYDROLOGY_WIDTH) / GRID_COLUMNS,
  );
  const hydroTop = Math.round((row * HYDROLOGY_HEIGHT) / GRID_ROWS);
  const hydroBottom = Math.round(
    ((row + 1) * HYDROLOGY_HEIGHT) / GRID_ROWS,
  );
  const elevationValues = extractWindow(
    elevation,
    WIDTH,
    left,
    top,
    right,
    bottom,
  );
  const coverValues = extractWindow(
    landCover,
    WIDTH,
    left,
    top,
    right,
    bottom,
  );
  const removalValues = extractWindow(
    humanRemoval,
    WIDTH,
    left,
    top,
    right,
    bottom,
  );
  const slopeValues = extractWindow(
    slope,
    HYDROLOGY_WIDTH,
    hydroLeft,
    hydroTop,
    hydroRight,
    hydroBottom,
  );
  const drainageValues = extractWindow(
    drainage,
    HYDROLOGY_WIDTH,
    hydroLeft,
    hydroTop,
    hydroRight,
    hydroBottom,
  );
  const elevationStats = describeFloat(elevationValues);
  const slopeStats = describeFloat(slopeValues);
  const histogram = histogramValues(coverValues);
  const total = coverValues.length;
  const metrics = {
    elevationMetres: elevationStats,
    relativeElevation:
      (elevationStats.mean - globalElevation.minimum) /
      Math.max(1, globalElevation.maximum - globalElevation.minimum),
    relativeRelief:
      (elevationStats.maximum - elevationStats.minimum) /
      Math.max(1, globalElevation.maximum - globalElevation.minimum),
    normalizedSlope: slopeStats,
    drainageLikelihoodRatio: ratioNonZero(drainageValues),
    reconstructedLandCoverRatio: {
      treeCover: (histogram["10"] ?? 0) / total,
      shrubland: (histogram["20"] ?? 0) / total,
      grassland: (histogram["30"] ?? 0) / total,
      bareOrSparse: (histogram["60"] ?? 0) / total,
    },
    humanRemovalRatio: ratioNonZero(removalValues),
  };
  const signatures = buildSignatures({
    elevation,
    landCover,
    drainage,
    left,
    top,
    right,
    bottom,
  });
  const west =
    bounds.west + (column / GRID_COLUMNS) * (bounds.east - bounds.west);
  const east =
    bounds.west +
    ((column + 1) / GRID_COLUMNS) * (bounds.east - bounds.west);
  const north =
    bounds.north - (row / GRID_ROWS) * (bounds.north - bounds.south);
  const south =
    bounds.north -
    ((row + 1) / GRID_ROWS) * (bounds.north - bounds.south);
  return {
    candidateId: `sakaerat-measurement-window-r${String(row + 1).padStart(
      2,
      "0",
    )}-c${String(column + 1).padStart(2, "0")}-${
      BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
        ? "v3"
        : EXPANDED_SLOT_123_SCOPE
          ? "v2"
          : "v1"
    }`,
    row,
    column,
    measurementScopeGridSize: GRID_COLUMNS,
    newlyAuthorizedBeyondNineByNineOuterRing:
      BEYOND_NINE_BY_NINE_SLOT_123_SCOPE &&
      (row === 0 ||
        row === GRID_ROWS - 1 ||
        column === 0 ||
        column === GRID_COLUMNS - 1),
    sourcePixelWindow: {
      left,
      top,
      width: right - left,
      height: bottom - top,
    },
    measurementBounds: { west, south, east, north },
    metrics: roundDeep(metrics),
    fingerprints: signatures,
    exactRealWorldGeometryDisplayAllowed: false,
    completeGameMapGeometryCreated: false,
    rgbCreated: false,
  };
}

function buildAssignment({ slot, selected, score }) {
  return {
    slotId: slot.slotId,
    split: slot.split,
    regionalLandscapeType: slot.regionalLandscapeType,
    monsoonSeason: slot.monsoonSeason,
    coverageRole: slot.coverageRole,
    candidateId: selected.candidateId,
    measurementSupportScore: round(score),
    measurementBounds: selected.measurementBounds,
    sourcePixelWindow: selected.sourcePixelWindow,
    metrics: selected.metrics,
    fingerprints: selected.fingerprints,
    targetEcologyIsDirectlyClaimedByWindowSelection: false,
    additionalEvidenceRequirements: additionalEvidenceRequirements(
      slot.regionalLandscapeType,
    ),
    nextConditionBuildRules: [
      "derive_new_anonymous_game_coordinate_geometry",
      "do_not_copy_exact_real_world_geometry",
      "do_not_read_historical_rgb",
      "compile_world_facts_world_director_and_23_channels",
      "keep_focal_area_all_zero",
      "prove_complete_map_scope_before_any_rgb_authorization",
    ],
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
  };
}

function sameMeasurementBounds(left, right) {
  const tolerance = 1e-10;
  return ["west", "south", "east", "north"].every(
    (key) => Math.abs(left[key] - right[key]) <= tolerance,
  );
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
    score += drainage * 2 + flatness * 0.45 + (1 - elevation) * 0.25;
  }
  if (/swamp|marsh|pond|creek/.test(type)) {
    score += drainage * 2.5 + flatness * 0.6 + (1 - elevation) * 0.35;
  }
  if (/grassland|glade|transition/.test(type)) {
    score += grass * 5 + flatness * 0.45 + (1 - forest) * 0.2;
  }
  if (/forest|woodland|bamboo|teak/.test(type)) {
    score += forest * 0.8 + relief * 0.25;
  }
  if (slot.monsoonSeason === "wet_season") score += drainage * 0.4;
  if (slot.monsoonSeason === "dry_season") {
    score += metrics.reconstructedLandCoverRatio.bareOrSparse * 2;
  }
  score -= metrics.humanRemovalRatio * 0.5;
  return score;
}

function additionalEvidenceRequirements(type) {
  const requirements = [
    "regional_profile_identity",
    "seasonal_environment_snapshot",
  ];
  if (/limestone/.test(type)) requirements.push("lithology_or_geology_evidence");
  if (/rocky/.test(type)) requirements.push("surface_rock_evidence");
  if (/swamp|marsh|pond|creek|river|stream|drainage|floodplain/.test(type)) {
    requirements.push("audited_natural_hydrology_and_soil_moisture_derivation");
  }
  if (/bamboo|teak|forest|woodland|grassland|glade/.test(type)) {
    requirements.push("regional_ecology_composition_evidence");
  }
  return [...new Set(requirements)];
}

function buildSignatures({
  elevation,
  landCover,
  drainage,
  left,
  top,
  right,
  bottom,
}) {
  const sampleWidth = 16;
  const sampleHeight = 12;
  const cells = [];
  for (let row = 0; row < sampleHeight; row += 1) {
    const y = Math.min(
      bottom - 1,
      Math.floor(top + ((row + 0.5) / sampleHeight) * (bottom - top)),
    );
    for (let column = 0; column < sampleWidth; column += 1) {
      const x = Math.min(
        right - 1,
        Math.floor(left + ((column + 0.5) / sampleWidth) * (right - left)),
      );
      const hydroX = Math.min(
        HYDROLOGY_WIDTH - 1,
        Math.floor((x / WIDTH) * HYDROLOGY_WIDTH),
      );
      const hydroY = Math.min(
        HYDROLOGY_HEIGHT - 1,
        Math.floor((y / HEIGHT) * HYDROLOGY_HEIGHT),
      );
      cells.push(
        `${Math.round(elevation[y * WIDTH + x] / 5)}:${
          landCover[y * WIDTH + x]
        }:${drainage[hydroY * HYDROLOGY_WIDTH + hydroX] > 0 ? 1 : 0}`,
      );
    }
  }
  const variants = [
    cells,
    transformCells(cells, sampleWidth, sampleHeight, "horizontal"),
    transformCells(cells, sampleWidth, sampleHeight, "vertical"),
    transformCells(cells, sampleWidth, sampleHeight, "rotate180"),
  ].map((variant) => sha256Text(variant.join("|")));
  return {
    direct: variants[0],
    horizontalMirror: variants[1],
    verticalMirror: variants[2],
    rotate180: variants[3],
    transformCanonical: [...variants].sort()[0],
  };
}

function transformCells(cells, width, height, transform) {
  const output = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      let sourceRow = row;
      let sourceColumn = column;
      if (transform === "horizontal") sourceColumn = width - 1 - column;
      if (transform === "vertical") sourceRow = height - 1 - row;
      if (transform === "rotate180") {
        sourceRow = height - 1 - row;
        sourceColumn = width - 1 - column;
      }
      output.push(cells[sourceRow * width + sourceColumn]);
    }
  }
  return output;
}

function sourceBoundary() {
  return {
    externalRgbUsed: false,
    historicalGameRgbRead: false,
    exactRealWorldGeometryCarriedForward: false,
    exactOsmGeometryCarriedForward: false,
    measurementMetricsOnly: true,
    outputGameGeometryMustBeNewAndAnonymous: true,
    targetEcologyMustBeProvenByDownstreamEvidence: true,
    localOrPartialMapEligible: false,
    presetHomeSiteAllowed: false,
  };
}

function assertNoOverlap(assignments) {
  for (let left = 0; left < assignments.length; left += 1) {
    const a = assignments[left].sourcePixelWindow;
    for (let right = left + 1; right < assignments.length; right += 1) {
      const b = assignments[right].sourcePixelWindow;
      const overlaps =
        a.left < b.left + b.width &&
        a.left + a.width > b.left &&
        a.top < b.top + b.height &&
        a.top + a.height > b.top;
      assert(
        !overlaps,
        `selected measurement windows overlap: ${assignments[left].slotId} and ${assignments[right].slotId}`,
      );
    }
  }
}

function extractWindow(values, width, left, top, right, bottom) {
  const output = [];
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      output.push(values[y * width + x]);
    }
  }
  return output;
}

function describeFloat(values) {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let count = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
    sum += value;
    count += 1;
  }
  return { minimum, maximum, mean: sum / count, count };
}

function histogramValues(values) {
  const histogram = {};
  for (const value of values) histogram[value] = (histogram[value] ?? 0) + 1;
  return histogram;
}

function ratioNonZero(values) {
  let count = 0;
  for (const value of values) if (value !== 0) count += 1;
  return count / values.length;
}

function readFloat32Gzip(relativePath, expectedCount) {
  const buffer = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, relativePath)));
  assert(
    buffer.byteLength === expectedCount * Float32Array.BYTES_PER_ELEMENT,
    `float32 evidence size mismatch: ${relativePath}`,
  );
  return new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
}

function readUint8Gzip(relativePath, expectedCount) {
  const buffer = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, relativePath)));
  assert(
    buffer.byteLength === expectedCount,
    `uint8 evidence size mismatch: ${relativePath}`,
  );
  return new Uint8Array(buffer);
}

function verifyHash(relativePath, expectedHash) {
  const absolutePath = path.join(ROOT, relativePath);
  assert(fs.existsSync(absolutePath), `evidence missing: ${relativePath}`);
  assert(
    sha256File(absolutePath) === expectedHash,
    `evidence hash mismatch: ${relativePath}`,
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

function round(value) {
  return Number(value.toFixed(8));
}

function roundDeep(value) {
  if (typeof value === "number") return round(value);
  if (Array.isArray(value)) return value.map(roundDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, roundDeep(entry)]),
    );
  }
  return value;
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function assertUnique(values, label) {
  assert(new Set(values).size === values.length, `${label} is not unique`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
