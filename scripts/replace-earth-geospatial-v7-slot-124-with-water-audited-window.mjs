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
  buildMeasurementDerivedAnonymousAnabranch,
  buildMeasurementDerivedAnonymousMainChannel,
  buildMeasurementDerivedCoarseHydrologyProfile,
  buildMeasurementDerivedNetworkHalfWidths,
} from "./lib/measurement-derived-coarse-hydrology.mjs";
import {
  buildMeasurementDrivenAnonymousLayoutProfile,
} from "./lib/measurement-driven-anonymous-topology.mjs";
import { buildNaturalWaterHalfWidths } from "./lib/anonymous-water-naturalness.mjs";

const ROOT = process.cwd();
const SLOT_ID = "v7-capacity-slot-124";
const SELECTED_CANDIDATE_ID =
  valueFor("--candidate-id") ??
  "sakaerat-measurement-window-r02-c07-v3";
const AUTHORIZATION_ID =
  "owner-authorized-slot-124-unused-thai-measurement-window-screening-and-replacement-20260729";
const BOUNDED_DATA_AUTHORIZATION_ID =
  "owner-authorized-v7-mvp64-gap38-real-geography-bounded-data-build-20260725";
const WINDOW_PLAN_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans";
const CAPACITY_PLAN_PATH =
  ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/ai-assisted-v7-data-capacity-plan-2026-07-28T22-37-20-637Z/capacity-plan.json";
const CAPACITY_GAP_LIST_PATH =
  ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/ai-assisted-v7-data-capacity-plan-2026-07-28T22-37-20-637Z/gap-list.json";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const CONNECTIVITY_CONTRACT_PATH =
  "data/world-samples/world-connectivity/world-connectivity-contract-v1.json";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-mvp-window-plan-" +
  createdAtUtc.replace(/[:.]/g, "-");

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_124_water_audited_window_replacement_started",
  runId,
  kind: "measurement_window_replacement",
  status: "running",
  title: "The no-RGB slot-124 water-audited window replacement started",
  titleZh: "slot-124 无 RGB 水体审核窗口替换已启动",
  detail:
    `candidate=${SELECTED_CANDIDATE_ID}; only the approved Thailand measurement package, current water audits, and the latest bounded capacity plan may be read; RGB and GPU remain disabled.`,
  detailZh:
    `候选=${SELECTED_CANDIDATE_ID}；只读取已批准的泰国测量包、现行水体审核和最新有界容量计划；RGB 与 GPU 保持关闭。`,
  script: projectPath(import.meta.filename),
  currentStep: "screen_and_replace_slot_124_measurement_window",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

try {
  const parentPointer = readJson(`${WINDOW_PLAN_ROOT}/latest.json`);
  const parentPlan = readJson(parentPointer.runPath);
  const candidates = readJson(parentPlan.candidateWindowsPath);
  const capacityPlan = readJson(CAPACITY_PLAN_PATH);
  const capacityGapList = readJson(CAPACITY_GAP_LIST_PATH);
  const plannedSlots = capacityGapList.plannedSlots.filter(
    (entry) => typeof entry.slotId === "string",
  );
  const slot = plannedSlots.find((entry) => entry.slotId === SLOT_ID);
  const selectedCandidate = candidates.candidates.find(
    (entry) => entry.candidateId === SELECTED_CANDIDATE_ID,
  );
  const parentAssignment = parentPlan.assignments.find(
    (entry) => entry.slotId === SLOT_ID,
  );

  assert(
    parentPlan.authorizationId === BOUNDED_DATA_AUTHORIZATION_ID &&
      capacityPlan.fixedSlotIdentityAuthority?.authorizationId ===
        BOUNDED_DATA_AUTHORIZATION_ID &&
      capacityGapList.fixedSlotIdentityAuthority?.authorizationId ===
        BOUNDED_DATA_AUTHORIZATION_ID &&
      capacityGapList.runId === capacityPlan.runId,
    "bounded data-build authorization mismatch",
  );
  assert(
    capacityPlan.runId ===
      "ai-assisted-v7-data-capacity-plan-2026-07-28T22-37-20-637Z" &&
      capacityGapList.requiredNewRecordCount === 24 &&
      capacityGapList.qualifiedExistingRecordCount === 40,
    "latest owner-authorized 40/64 capacity state is not active",
  );
  assert(
    slot && parentAssignment && selectedCandidate,
    "slot-124 replacement inputs are incomplete",
  );
  assert(
    candidates.grid?.columns === 11 &&
      candidates.grid?.rows === 11 &&
      selectedCandidate.measurementScopeGridSize === 11,
    "selected window is outside the approved 11x11 Thailand measurement package",
  );
  assert(
    !parentPlan.assignments.some(
      (entry) =>
        entry.slotId !== SLOT_ID &&
        entry.candidateId === selectedCandidate.candidateId,
    ),
    "selected slot-124 replacement window is assigned to another slot",
  );
  assert(
    sha256File(parentPlan.candidateWindowsPath) ===
      parentPlan.candidateWindowsSha256 &&
      sha256File(CAPACITY_GAP_LIST_PATH) ===
        capacityPlan.evidenceFiles?.gapListSha256,
    "window or capacity evidence hash mismatch",
  );

  const selectedAssignment = buildAssignment({
    currentAssignment: parentAssignment,
    slot,
    candidate: selectedCandidate,
  });
  const waterAudit = runUnchangedWaterPreflight(selectedAssignment);
  assert(
    waterAudit.mainChannelPassed === true &&
      waterAudit.mainCorridorPassed === true &&
      waterAudit.branchNaturalnessPassed === true &&
      waterAudit.branchCorridorPassed === true,
    "selected window did not pass every unchanged water audit",
  );

  const parentAssignmentsBySlot = new Map(
    parentPlan.assignments.map((entry) => [entry.slotId, entry]),
  );
  const assignments = plannedSlots.map((plannedSlot) => {
    const current = parentAssignmentsBySlot.get(plannedSlot.slotId);
    assert(current, `existing fixed assignment is missing: ${plannedSlot.slotId}`);
    return plannedSlot.slotId === SLOT_ID
      ? selectedAssignment
      : reconcileAssignment(current, plannedSlot);
  });
  assert(
    assignments[0]?.slotId === SLOT_ID &&
      assignments.at(-1)?.slotId === "v7-capacity-slot-145" &&
      assignments.length === 22,
    "latest fixed pending slot order is not slot-124 through slot-145",
  );
  assertUnique(assignments.map((entry) => entry.slotId), "slot identities");
  assertUnique(
    assignments.map((entry) => entry.candidateId),
    "measurement window identities",
  );
  assertUnique(
    assignments.map((entry) => entry.fingerprints.transformCanonical),
    "measurement transform fingerprints",
  );
  assertNoOverlap(assignments);

  const rankedUnused = candidates.candidates
    .filter(
      (candidate) =>
        !parentPlan.assignments.some(
          (entry) =>
            entry.slotId !== SLOT_ID &&
            entry.candidateId === candidate.candidateId,
        ),
    )
    .map((candidate) => ({
      candidateId: candidate.candidateId,
      measurementSupportScore: round(scoreCandidate(candidate, slot)),
    }))
    .sort(
      (left, right) =>
        right.measurementSupportScore - left.measurementSupportScore ||
        left.candidateId.localeCompare(right.candidateId),
    );
  const measurementScoreRank =
    rankedUnused.findIndex(
      (entry) => entry.candidateId === selectedCandidate.candidateId,
    ) + 1;
  assert(measurementScoreRank > 0, "selected candidate screening rank is missing");

  const plan = {
    ...structuredClone(parentPlan),
    runId,
    createdAtUtc,
    createdAtAsiaShanghai: formatShanghai(createdAtUtc),
    capacityPlanRunId: capacityPlan.runId,
    capacityGapListPath: CAPACITY_GAP_LIST_PATH,
    capacityGapListSha256: sha256File(CAPACITY_GAP_LIST_PATH),
    parentWindowPlanRunId: parentPlan.runId,
    parentWindowPlanPath: parentPointer.runPath,
    parentWindowPlanSha256: sha256File(parentPointer.runPath),
    replacementAuthorizationId: AUTHORIZATION_ID,
    selectionMethod: {
      ...structuredClone(parentPlan.selectionMethod),
      priorPhysicalAssignmentsPreserved: true,
      slot123ScreeningCandidateScope: "new_11x11_outer_ring_only",
      slot124ReplacementCandidateScope:
        "all_unused_windows_inside_owner_authorized_11x11_thailand_measurement_package",
      slot124WaterAuditAppliedBeforeConditionBuild: true,
      historicalRgbRead: false,
      mirroredOrRotatedWindowAccepted: false,
      presetHomeSiteCreated: false,
    },
    assignments,
    counts: {
      ...structuredClone(parentPlan.counts),
      candidateWindows: candidates.candidates.length,
      selectedWindows: assignments.length,
      remainingUnselectedWindows:
        candidates.grid.eligibleNewOuterRingCandidateCount,
      totalCurrentlyUnusedWindows:
        candidates.candidates.length - assignments.length,
      rgbCreated: 0,
      gpuTrainingRuns: 0,
    },
    slot124ReplacementEvidence: {
      schemaVersion:
        "earth-geospatial-v7-slot-124-water-audited-window-replacement-v1",
      status: "unused_thailand_window_passed_unchanged_water_preflight",
      authorizationId: AUTHORIZATION_ID,
      previousCandidateId:
        parentPlan.slot124ReplacementEvidence?.previousCandidateId ??
        parentAssignment.candidateId,
      selectedCandidateId: selectedCandidate.candidateId,
      measurementScoreRankAmongPreviouslyUnusedWindows: measurementScoreRank,
      previouslyUnusedWindowsScreened: rankedUnused.length,
      waterAudit,
      sourceBoundary: {
        approvedThailandMeasurementPackageOnly: true,
        historicalRgbRead: false,
        historicalConditionGuideRead: false,
        historicalGeometryRead: false,
        exactMeasurementGeometryCarriedIntoGameCoordinates: false,
        mirrorOrRotationTransformApplied: false,
      },
      immutableRules: {
        worldConnectivityContractChanged: false,
        hydrologyAlgorithmChanged: false,
        waterReviewThresholdsChanged: false,
        completeMapScopeGateChanged: false,
        allHistoryNoveltyGateStillRequiredBeforeRgb: true,
      },
    },
    outputBoundary: {
      ...structuredClone(parentPlan.outputBoundary),
      imageGenerationStarted: false,
      rgbCreated: false,
      gpuTrainingStarted: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
    nextRequiredAction:
      "independently_check_the_window_plan_then_build_only_slot_124_world_facts_world_director_complete_map_task_and_23_channels_and_run_all_pre_rgb_gates",
  };

  const immutable = writeImmutableProgramRun({
    root: WINDOW_PLAN_ROOT,
    runId,
    fileName: "window-plan.json",
    record: plan,
    latest: {
      contractId: plan.contractId,
      authorizationId: BOUNDED_DATA_AUTHORIZATION_ID,
      replacementAuthorizationId: AUTHORIZATION_ID,
      candidateWindowsPath: plan.candidateWindowsPath,
      candidateWindowsSha256: plan.candidateWindowsSha256,
      capacityPlanRunId: plan.capacityPlanRunId,
      selectedWindowCount: assignments.length,
      replacementSlotId: SLOT_ID,
      replacementCandidateId: selectedCandidate.candidateId,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  });
  indexExistingFile(parentPlan.candidateWindowsPath, runId);

  const finishedAtUtc = new Date().toISOString();
  appendAiPainterProgramEvent({
    timestamp: finishedAtUtc,
    action: "v7_slot_124_water_audited_window_replacement_completed",
    runId,
    kind: "measurement_window_replacement",
    status: "success",
    title: "The no-RGB slot-124 water-audited window replacement completed",
    titleZh: "slot-124 无 RGB 水体审核窗口替换已完成",
    detail:
      `previous=${parentAssignment.candidateId}; selected=${selectedCandidate.candidateId}; mainWater=true; branchWater=true; pendingSlots=22; imageGenerationStarted=false; gpuTrainingStarted=false`,
    detailZh:
      `原窗口=${parentAssignment.candidateId}；新窗口=${selectedCandidate.candidateId}；主河道通过；支流通过；待建设固定槽位=22；未启动图像生成；未启动 GPU 训练。`,
    script: projectPath(import.meta.filename),
    currentStep: "slot_124_measurement_window_replaced",
    evidencePath: immutable.runPath,
    evidence: [
      immutable.runPath,
      parentPointer.runPath,
      CAPACITY_PLAN_PATH,
      CAPACITY_GAP_LIST_PATH,
    ],
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });

  console.log(JSON.stringify({
    ok: true,
    runId,
    planPath: immutable.runPath,
    previousCandidateId: parentAssignment.candidateId,
    selectedCandidateId: selectedCandidate.candidateId,
    measurementScoreRank,
    waterAudit,
    pendingFixedSlots: assignments.length,
    imageGenerationStarted: false,
    rgbCreated: 0,
    gpuTrainingStarted: false,
    nextRequiredAction: plan.nextRequiredAction,
  }, null, 2));
} catch (error) {
  const failedAtUtc = new Date().toISOString();
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    action: "v7_slot_124_water_audited_window_replacement_failed",
    runId,
    kind: "measurement_window_replacement",
    status: "failed",
    title: "The no-RGB slot-124 water-audited window replacement failed",
    titleZh: "slot-124 无 RGB 水体审核窗口替换失败",
    detail: `${error instanceof Error ? error.message : String(error)}; RGB and GPU were not started.`,
    detailZh: `${error instanceof Error ? error.message : String(error)}；未启动 RGB 或 GPU。`,
    script: projectPath(import.meta.filename),
    currentStep: "slot_124_measurement_window_replacement_failed",
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });
  throw error;
}

function runUnchangedWaterPreflight(assignment) {
  const waterPointer = readJson(WATER_PROFILE_POINTER_PATH);
  const waterManifest = readJson(waterPointer.runPath);
  assert(
    waterPointer.profilePath === waterManifest.profilePath &&
      waterPointer.profileSha256 === waterManifest.profileSha256 &&
      sha256File(waterManifest.profilePath) === waterManifest.profileSha256,
    "water naturalness profile hash mismatch",
  );
  const waterNaturalnessProfile = readJson(waterManifest.profilePath);
  const coarseHydrologyProfile =
    buildMeasurementDerivedCoarseHydrologyProfile({
      assignment,
      root: ROOT,
    });
  const layoutProfile = buildMeasurementDrivenAnonymousLayoutProfile({
    assignment,
    hasWater: true,
    coarseHydrologyProfile,
  });
  const connectivityContract = readJson(CONNECTIVITY_CONTRACT_PATH);
  const blueprint = readJson(
    connectivityContract.scope.firstMvpRegionConnectivityBlueprintPath,
  );
  const currentRegionId = blueprint.currentRegion.regionId;
  const currentWaterPorts = blueprint.edgePorts.filter(
    (entry) =>
      entry.regionId === currentRegionId &&
      entry.kind === "watercourse" &&
      entry.boundaryPosition,
  );
  const upstreamPort = currentWaterPorts.find(
    (entry) => entry.role === "upstream_inlet",
  );
  const downstreamPort = currentWaterPorts.find(
    (entry) => entry.role === "downstream_outlet",
  );
  assert(
    upstreamPort?.boundarySide === "north" &&
      downstreamPort?.boundarySide === "south",
    "locked water connectivity ports are missing",
  );
  const mainHalfWidths = buildMeasurementDerivedNetworkHalfWidths({
    pointCount: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
    startHalfWidth: upstreamPort.width / 2,
    endHalfWidth: downstreamPort.width / 2,
    coarseHydrologyProfile,
  });
  const main = buildMeasurementDerivedAnonymousMainChannel({
    start: structuredClone(upstreamPort.boundaryPosition),
    end: structuredClone(downstreamPort.boundaryPosition),
    width: 1024,
    height: 768,
    coarseHydrologyProfile,
    waterNaturalnessProfile,
    corridorHalfWidths: mainHalfWidths,
  });
  const internal = layoutProfile.internalHydrologyProfile;
  const finalIndex = main.points.length - 1;
  const divergenceIndex = clamp(
    Math.round(finalIndex * internal.divergenceFraction),
    1,
    finalIndex - 2,
  );
  const rejoinIndex = clamp(
    Math.round(finalIndex * internal.rejoinFraction),
    divergenceIndex + 2,
    finalIndex - 1,
  );
  const branchRandom = mulberry32(
    Number.parseInt(internal.profileSha256.slice(0, 8), 16),
  );
  const branchStartHalfWidth = Math.max(
    22,
    Math.round(
      mainHalfWidths[divergenceIndex] * internal.branchWidthScale,
    ),
  );
  const branchEndHalfWidth = Math.max(
    branchStartHalfWidth,
    Math.round(mainHalfWidths[rejoinIndex] * internal.branchWidthScale),
  );
  const branchHalfWidths = buildNaturalWaterHalfWidths(
    COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
    branchRandom,
    {
      startHalfWidth: branchStartHalfWidth,
      endHalfWidth: branchEndHalfWidth,
    },
  );
  const branchStart =
    internal.internalNetworkConnectionMode ===
    "interior_headwater_tributary_to_main_channel"
      ? {
          x: 1024 * internal.tributaryHeadwaterXFraction,
          y: main.points[divergenceIndex].y,
        }
      : structuredClone(main.points[divergenceIndex]);
  const branch = buildMeasurementDerivedAnonymousAnabranch({
    start: branchStart,
    end: structuredClone(main.points[rejoinIndex]),
    width: 1024,
    coarseHydrologyProfile,
    internalHydrologyProfile: internal,
    waterNaturalnessProfile,
    corridorHalfWidths: branchHalfWidths,
  });
  return {
    waterProfileId: waterNaturalnessProfile.profileId,
    waterProfileSha256: waterManifest.profileSha256,
    connectivityContractId: connectivityContract.contractId,
    connectivityBlueprintId:
      connectivityContract.scope.firstMvpRegionConnectivityBlueprintId,
    coarseHydrologyProfileSha256: coarseHydrologyProfile.profileSha256,
    layoutProfileSha256: layoutProfile.profileSha256,
    mainChannelPassed: main.audit.passed === true,
    mainCorridorPassed: main.corridorAudit.passed === true,
    branchNaturalnessPassed: branch.naturalnessAudit.passed === true,
    branchCorridorPassed: branch.corridorShapeAudit.passed === true,
    mainPointCount: main.points.length,
    branchPointCount: branch.points.length,
    mainSinuosity: main.audit.sinuosity,
    branchSinuosity: branch.naturalnessAudit.sinuosity,
    mainSelection: main.selection,
    branchSelection: branch.selection,
    reviewThresholdsChanged: false,
    hydrologyAlgorithmChanged: false,
  };
}

function buildAssignment({ currentAssignment, slot, candidate }) {
  return {
    ...reconcileAssignment(currentAssignment, slot),
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

function reconcileAssignment(current, slot) {
  return {
    ...structuredClone(current),
    slotId: slot.slotId,
    split: slot.split,
    regionalLandscapeType: slot.regionalLandscapeType,
    monsoonSeason: slot.monsoonSeason,
    coverageRole: slot.coverageRole,
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
        `selected windows overlap: ${assignments[left].slotId} and ${assignments[right].slotId}`,
      );
    }
  }
}

function indexExistingFile(relativePath, sourceRunId) {
  const filePath = path.resolve(ROOT, relativePath);
  const info = fs.statSync(filePath);
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId: sourceRunId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
    sha256: sha256File(relativePath),
  });
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value) {
  return Number(value.toFixed(8));
}

function assertUnique(values, label) {
  assert(new Set(values).size === values.length, `${label} are not unique`);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, relativePath), "utf8"));
}

function sha256File(relativePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.resolve(ROOT, relativePath)))
    .digest("hex");
}

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
