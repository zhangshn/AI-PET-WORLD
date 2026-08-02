import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";
import { buildMeasurementDerivedCoarseHydrologyProfile } from "./lib/measurement-derived-coarse-hydrology.mjs";

const ROOT = process.cwd();
const SLOT_ID = "v7-capacity-slot-123";
const EXPECTED_PARENT_CANDIDATE_ID =
  "sakaerat-measurement-window-r01-c06-v1";
const EXPECTED_SELECTED_CANDIDATE_ID =
  "sakaerat-measurement-window-r04-c04-v1";
const BOUNDED_DATA_AUTHORIZATION_ID =
  "owner-authorized-v7-mvp64-gap38-real-geography-bounded-data-build-20260725";
const REPLACEMENT_AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-replace-with-unused-real-measurement-window-20260728";
const WINDOW_PLAN_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans";
const WINDOW_PLAN_LATEST_PATH = `${WINDOW_PLAN_ROOT}/latest.json`;
const FEATURE_KEYS = [
  "anonymousSupportFraction",
  "quantizedWeightedFlowSupportFraction",
  "quantizedPeakFlowSupportFraction",
  "quantizedRelativeSupport",
];

const createdAtUtc = new Date().toISOString();
const createdAtAsiaShanghai = formatShanghai(createdAtUtc);
const runId =
  `earth-geospatial-v7-mvp-window-plan-` +
  createdAtUtc.replace(/[:.]/g, "-");
const runRoot = path.join(ROOT, WINDOW_PLAN_ROOT, runId);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_123_real_measurement_window_replacement_started",
  runId,
  kind: "measurement_window_replacement",
  status: "running",
  title: "The slot-123 unused real-measurement window replacement started",
  titleZh: "slot-123 未使用真实测量窗口替换已启动",
  detail:
    "The program will rank only unused Sakaerat/Wang Nam Khiao measurement windows against every currently selected window using coarse DEM/D8 statistics. It will create no RGB and start no GPU training.",
  detailZh:
    "程序只使用 Sakaerat/Wang Nam Khiao 已下载测量包的粗粒度 DEM/D8 统计，将全部未使用窗口与当前所有已选窗口比较。本轮不生成 RGB、不启动 GPU 训练。",
  script: projectPath(import.meta.filename),
  currentStep: "rank_unused_real_measurement_windows",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

try {
  const parentPointer = readJson(WINDOW_PLAN_LATEST_PATH);
  const parentPlan = readJson(parentPointer.runPath);
  const parentCandidates = readJson(parentPlan.candidateWindowsPath);
  const capacityGapList = readJson(parentPlan.capacityGapListPath);

  assert(
    parentPlan.authorizationId === BOUNDED_DATA_AUTHORIZATION_ID &&
      parentPointer.authorizationId === BOUNDED_DATA_AUTHORIZATION_ID,
    "bounded data-build authorization mismatch",
  );
  assert(
    parentPlan.schemaVersion ===
      "earth-geospatial-v7-mvp-window-plan-v1" &&
      parentCandidates.schemaVersion ===
        "earth-geospatial-v7-mvp-candidate-windows-v1",
    "parent window-plan schema mismatch",
  );
  verifyHash(
    parentPlan.candidateWindowsPath,
    parentPlan.candidateWindowsSha256,
  );
  verifyHash(
    parentPlan.capacityGapListPath,
    parentPlan.capacityGapListSha256,
  );

  const slot = capacityGapList.plannedSlots?.find(
    (entry) => entry.slotId === SLOT_ID,
  );
  const parentAssignment = parentPlan.assignments?.find(
    (entry) => entry.slotId === SLOT_ID,
  );
  assert(slot && parentAssignment, "slot-123 is missing from the current plan");
  assert(
    parentAssignment.candidateId === EXPECTED_PARENT_CANDIDATE_ID,
    `unexpected slot-123 parent candidate: ${parentAssignment.candidateId}`,
  );
  assert(
    parentPlan.outputBoundary?.imageGenerationStarted === false &&
      parentPlan.outputBoundary?.rgbCreated === false &&
      parentPlan.outputBoundary?.gpuTrainingStarted === false,
    "parent window plan crossed the RGB or GPU boundary",
  );

  const candidatesById = new Map(
    parentCandidates.candidates.map((entry) => [
      entry.candidateId,
      entry,
    ]),
  );
  assert(candidatesById.size === 49, "candidate window count mismatch");
  const selectedIds = new Set(
    parentPlan.assignments.map((entry) => entry.candidateId),
  );
  const unusedCandidates = parentCandidates.candidates.filter(
    (entry) => !selectedIds.has(entry.candidateId),
  );
  assert(
    unusedCandidates.length ===
      parentPlan.counts.remainingUnselectedWindows,
    "unused measurement-window count mismatch",
  );

  const selectedProfiles = parentPlan.assignments.map((assignment) => ({
    candidateId: assignment.candidateId,
    slotId: assignment.slotId,
    profile: buildMeasurementDerivedCoarseHydrologyProfile({
      assignment,
      root: ROOT,
    }),
  }));
  const currentProfile = selectedProfiles.find(
    (entry) => entry.slotId === SLOT_ID,
  );
  assert(currentProfile, "slot-123 coarse hydrology profile is missing");

  const rankings = unusedCandidates
    .map((candidate) => {
      const assignment = buildReplacementAssignment({
        parentAssignment,
        slot,
        candidate,
      });
      const profile = buildMeasurementDerivedCoarseHydrologyProfile({
        assignment,
        root: ROOT,
      });
      const distances = selectedProfiles
        .map((selected) => ({
          candidateId: selected.candidateId,
          slotId: selected.slotId,
          distance: profileDistance(profile, selected.profile),
        }))
        .sort(
          (left, right) =>
            left.distance - right.distance ||
            left.candidateId.localeCompare(right.candidateId),
        );
      return {
        candidateId: candidate.candidateId,
        directFingerprint: candidate.fingerprints.direct,
        transformCanonicalFingerprint:
          candidate.fingerprints.transformCanonical,
        minimumDistanceFromAnySelected: distances[0].distance,
        nearestSelectedCandidateId: distances[0].candidateId,
        nearestSelectedSlotId: distances[0].slotId,
        distanceFromCurrentSlot123Window: profileDistance(
          profile,
          currentProfile.profile,
        ),
        riverFloodplainFit: round(scoreCandidate(candidate, slot)),
        coarseHydrologyProfileSha256: profile.profileSha256,
        coarseBands: profile.coarseBands.map((entry) => ({
          anonymousBandIndex: entry.anonymousBandIndex,
          anonymousSupportFraction: entry.anonymousSupportFraction,
          quantizedWeightedFlowSupportFraction:
            entry.quantizedWeightedFlowSupportFraction,
          quantizedPeakFlowSupportFraction:
            entry.quantizedPeakFlowSupportFraction,
          quantizedRelativeSupport: entry.quantizedRelativeSupport,
        })),
      };
    })
    .sort(compareRankings)
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  const selectedRanking = rankings[0];
  assert(
    selectedRanking?.candidateId === EXPECTED_SELECTED_CANDIDATE_ID,
    `authorized ranking selected an unexpected window: ${selectedRanking?.candidateId ?? "none"}`,
  );
  const selectedCandidate = candidatesById.get(
    selectedRanking.candidateId,
  );
  assert(selectedCandidate, "selected replacement candidate is missing");

  const assignments = parentPlan.assignments.map((assignment) =>
    assignment.slotId === SLOT_ID
      ? buildReplacementAssignment({
          parentAssignment,
          slot,
          candidate: selectedCandidate,
        })
      : structuredClone(assignment),
  );
  assertUnique(
    assignments.map((entry) => entry.candidateId),
    "selected candidate identities",
  );
  assertUnique(
    assignments.map((entry) => entry.fingerprints.transformCanonical),
    "selected transform fingerprints",
  );
  assertNoOverlap(assignments);

  const candidateWindowsPath = path.join(
    runRoot,
    "candidate-windows.json",
  );
  const candidateWindowsRecord = {
    ...structuredClone(parentCandidates),
    runId,
    createdAtUtc,
    createdAtAsiaShanghai,
    parentCandidateWindowsPath: parentPlan.candidateWindowsPath,
    parentCandidateWindowsSha256: parentPlan.candidateWindowsSha256,
    replacementAuthorizationId: REPLACEMENT_AUTHORIZATION_ID,
    grid: {
      ...structuredClone(parentCandidates.grid),
      selectedCount: assignments.length,
    },
  };
  writeJsonAtomic(candidateWindowsPath, candidateWindowsRecord);
  indexFile(candidateWindowsPath, runId);

  const rankingPath = path.join(
    runRoot,
    "hydrology-replacement-ranking.json",
  );
  const rankingRecord = {
    schemaVersion:
      "earth-geospatial-v7-unused-measurement-window-hydrology-ranking-v1",
    runId,
    status: "unused_real_measurement_window_ranked_and_selected",
    createdAtUtc,
    createdAtAsiaShanghai,
    slotId: SLOT_ID,
    authorizationId: REPLACEMENT_AUTHORIZATION_ID,
    parentWindowPlanRunId: parentPlan.runId,
    parentWindowPlanPath: parentPointer.runPath,
    parentWindowPlanSha256: sha256File(parentPointer.runPath),
    sourceDataset:
      "approved_sakaerat_wang_nam_khiao_measurement_package",
    selectionRule: {
      methodId:
        "all_selected_windows_coarse_dem_d8_maximin_then_current_distance_then_landscape_fit_v1",
      comparisonScope:
        "every_currently_selected_real_measurement_window",
      featureKeys: FEATURE_KEYS,
      featureCount: FEATURE_KEYS.length * 8,
      primarySort:
        "maximum_minimum_mean_absolute_feature_distance_from_any_selected_window",
      secondarySort:
        "maximum_mean_absolute_feature_distance_from_current_slot_123_window",
      tertiarySort: "maximum_river_floodplain_measurement_fit",
      finalTieBreak: "candidate_id_ascending",
      historicalRgbRead: false,
      historicalConditionGeometryRead: false,
      exactRealWorldGeometryCarriedIntoGameCoordinates: false,
      slotIdentityUsedToAlterHydrologyProfile: false,
    },
    counts: {
      totalCandidateWindows: parentCandidates.candidates.length,
      currentlySelectedWindows: parentPlan.assignments.length,
      unusedWindowsRanked: rankings.length,
      replacementCount: 1,
      rgbCreated: 0,
      gpuTrainingRuns: 0,
    },
    previousBinding: {
      candidateId: parentAssignment.candidateId,
      directFingerprint: parentAssignment.fingerprints.direct,
      coarseHydrologyProfileSha256:
        currentProfile.profile.profileSha256,
    },
    selectedBinding: selectedRanking,
    rankings,
    outputBoundary: noComputeBoundary(),
  };
  writeJsonAtomic(rankingPath, rankingRecord);
  indexFile(rankingPath, runId);

  const plan = {
    ...structuredClone(parentPlan),
    runId,
    createdAtUtc,
    createdAtAsiaShanghai,
    parentWindowPlanRunId: parentPlan.runId,
    parentWindowPlanPath: parentPointer.runPath,
    parentWindowPlanSha256: sha256File(parentPointer.runPath),
    replacementAuthorizationId: REPLACEMENT_AUTHORIZATION_ID,
    candidateWindowsPath: projectPath(candidateWindowsPath),
    candidateWindowsSha256: sha256File(candidateWindowsPath),
    selectionMethod: {
      methodId:
        "unused_real_measurement_window_all_selected_coarse_hydrology_maximin_replacement_v1",
      statement:
        "For the owner-rejected slot-123 composition, the program selected one previously unused Sakaerat/Wang Nam Khiao measurement window by maximizing its minimum coarse DEM/D8 feature distance from every currently selected window, then its distance from the current slot-123 window, then its river/floodplain measurement fit.",
      exactRealWorldGeometryCarriedForward: false,
      historicalRgbRead: false,
      historicalConditionGeometryRead: false,
      mirroredOrRotatedWindowAccepted: false,
      presetHomeSiteCreated: false,
    },
    replacementEvidence: {
      path: projectPath(rankingPath),
      sha256: sha256File(rankingPath),
      previousCandidateId: parentAssignment.candidateId,
      selectedCandidateId: selectedRanking.candidateId,
      selectedByProgrammaticRanking: true,
      historicalRgbRead: false,
      exactMeasurementGeometryCarriedIntoGameCoordinates: false,
    },
    assignments,
    counts: {
      candidateWindows: parentCandidates.candidates.length,
      selectedWindows: assignments.length,
      remainingUnselectedWindows:
        parentCandidates.candidates.length - assignments.length,
      rgbCreated: 0,
      gpuTrainingRuns: 0,
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
      "independently_check_the_replacement_plan_then_rebuild_slot_123_world_facts_world_director_complete_map_task_and_23_channels_before_all_history_pre_rgb_novelty_audit",
  };

  const immutable = writeImmutableProgramRun({
    root: WINDOW_PLAN_ROOT,
    runId,
    fileName: "window-plan.json",
    record: plan,
    latest: {
      contractId: plan.contractId,
      authorizationId: BOUNDED_DATA_AUTHORIZATION_ID,
      replacementAuthorizationId: REPLACEMENT_AUTHORIZATION_ID,
      candidateWindowsPath: plan.candidateWindowsPath,
      candidateWindowsSha256: plan.candidateWindowsSha256,
      capacityPlanRunId: plan.capacityPlanRunId,
      selectedWindowCount: assignments.length,
      replacementSlotId: SLOT_ID,
      replacementCandidateId: selectedRanking.candidateId,
      replacementEvidencePath: plan.replacementEvidence.path,
      replacementEvidenceSha256: plan.replacementEvidence.sha256,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  });

  const finishedAtUtc = new Date().toISOString();
  appendAiPainterProgramEvent({
    timestamp: finishedAtUtc,
    action: "v7_slot_123_real_measurement_window_replacement_completed",
    runId,
    kind: "measurement_window_replacement",
    status: "success",
    title:
      "The slot-123 unused real-measurement window replacement completed",
    titleZh: "slot-123 未使用真实测量窗口替换已完成",
    detail:
      `previous=${parentAssignment.candidateId}; selected=${selectedRanking.candidateId}; unusedCompared=${rankings.length}; selectedWindowsCompared=${selectedProfiles.length}; imageGenerationStarted=false; gpuTrainingStarted=false`,
    detailZh:
      `原窗口=${parentAssignment.candidateId}；新窗口=${selectedRanking.candidateId}；比较未使用窗口=${rankings.length}；对照全部已选窗口=${selectedProfiles.length}；未启动图像生成；未启动 GPU 训练。`,
    script: projectPath(import.meta.filename),
    currentStep: "real_measurement_window_replacement_completed",
    evidencePath: immutable.runPath,
    evidence: [
      immutable.runPath,
      plan.candidateWindowsPath,
      plan.replacementEvidence.path,
      parentPointer.runPath,
    ],
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        status: plan.status,
        planPath: immutable.runPath,
        rankingPath: plan.replacementEvidence.path,
        previousCandidateId: parentAssignment.candidateId,
        selectedCandidateId: selectedRanking.candidateId,
        selectedDirectFingerprint:
          selectedRanking.directFingerprint,
        unusedWindowsCompared: rankings.length,
        selectedWindowsCompared: selectedProfiles.length,
        minimumDistanceFromAnySelected:
          selectedRanking.minimumDistanceFromAnySelected,
        distanceFromCurrentSlot123Window:
          selectedRanking.distanceFromCurrentSlot123Window,
        riverFloodplainFit: selectedRanking.riverFloodplainFit,
        imageGenerationStarted: false,
        rgbCreated: 0,
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
    schemaVersion:
      "earth-geospatial-v7-slot-measurement-window-replacement-failure-v1",
    runId,
    status: "failed",
    createdAtUtc,
    createdAtAsiaShanghai,
    failedAtUtc,
    failedAtAsiaShanghai: formatShanghai(failedAtUtc),
    slotId: SLOT_ID,
    authorizationId: REPLACEMENT_AUTHORIZATION_ID,
    errorCode: "slot_123_real_measurement_window_replacement_failed",
    errorMessage: error instanceof Error ? error.message : String(error),
    outputBoundary: noComputeBoundary(),
  };
  writeJsonAtomic(failurePath, failure);
  indexFile(failurePath, runId);
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    action: failure.errorCode,
    runId,
    kind: "measurement_window_replacement",
    status: "failed",
    title: "The slot-123 real-measurement window replacement failed",
    titleZh: "slot-123 真实测量窗口替换失败",
    detail: `${failure.errorMessage}; imageGenerationStarted=false; gpuTrainingStarted=false`,
    detailZh: `${failure.errorMessage}；未启动图像生成；未启动 GPU 训练。`,
    script: projectPath(import.meta.filename),
    currentStep: "real_measurement_window_replacement_failed",
    evidencePath: projectPath(failurePath),
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });
  throw error;
}

function buildReplacementAssignment({
  parentAssignment,
  slot,
  candidate,
}) {
  return {
    ...structuredClone(parentAssignment),
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

function profileDistance(left, right) {
  const leftFeatures = profileFeatures(left);
  const rightFeatures = profileFeatures(right);
  assert(
    leftFeatures.length === rightFeatures.length,
    "coarse hydrology feature length mismatch",
  );
  return round(
    leftFeatures.reduce(
      (total, value, index) =>
        total + Math.abs(value - rightFeatures[index]),
      0,
    ) / leftFeatures.length,
  );
}

function profileFeatures(profile) {
  assert(
    profile.coarseBands?.length === 8,
    "coarse hydrology profile must contain eight bands",
  );
  return profile.coarseBands.flatMap((band) =>
    FEATURE_KEYS.map((key) => {
      const value = band[key];
      assert(Number.isFinite(value), `coarse feature missing: ${key}`);
      return value;
    }),
  );
}

function compareRankings(left, right) {
  return (
    right.minimumDistanceFromAnySelected -
      left.minimumDistanceFromAnySelected ||
    right.distanceFromCurrentSlot123Window -
      left.distanceFromCurrentSlot123Window ||
    right.riverFloodplainFit - left.riverFloodplainFit ||
    left.candidateId.localeCompare(right.candidateId)
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

function round(value) {
  return Number(value.toFixed(8));
}

function assertUnique(values, label) {
  assert(new Set(values).size === values.length, `${label} are not unique`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
