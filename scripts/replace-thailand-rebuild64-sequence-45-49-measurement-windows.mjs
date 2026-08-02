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
  COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
  buildMeasurementDerivedAnonymousAnabranch,
  buildMeasurementDerivedAnonymousMainChannel,
  buildMeasurementDerivedCoarseHydrologyProfile,
  buildMeasurementDerivedNetworkHalfWidths,
} from "./lib/measurement-derived-coarse-hydrology.mjs";
import { buildNaturalWaterHalfWidths } from "./lib/anonymous-water-naturalness.mjs";
import { buildMeasurementDrivenAnonymousLayoutProfile } from "./lib/measurement-driven-anonymous-topology.mjs";
import { buildIndependentTrainingRegionConnectivity } from "./lib/real-earth-region-governance.mjs";

const ROOT = process.cwd();
const AUTHORIZATION_ID = valueFor("--authorization-id") ??
  "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-20260801";
const AUTHORIZATION_PATH =
  `.runtime/ai-painter/owner-action-requests/${AUTHORIZATION_ID}/request.json`;
const WINDOW_PLAN_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans";
const WINDOW_PLAN_POINTER_PATH = `${WINDOW_PLAN_ROOT}/latest.json`;
const SELECTION_ROOT =
  ".runtime/ai-painter/thailand-rebuild64-sequence-45-49-measurement-window-selections";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const CONDITION_RUN_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs";
const OWNER_REJECTED_WATER_BLUEPRINTS = {
  "v7-capacity-slot-190":
    ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/earth-geospatial-v7-slot-condition-v7-capacity-slot-190-2026-07-29T05-29-15-762Z/complete-map-condition-task/world-fact-blueprint.json",
  "v7-capacity-slot-194":
    ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/earth-geospatial-v7-slot-condition-v7-capacity-slot-194-2026-07-29T06-34-12-308Z/complete-map-condition-task/world-fact-blueprint.json",
};
const MINIMUM_REJECTED_MAIN_CHANNEL_BAND_CENTROID_DISTANCE = 0.05;
const FULL_CONDITION_BUILD_REJECTIONS = new Map([
  [
    "sakaerat-measurement-window-r06-c10-v3",
    {
      slotId: "v7-capacity-slot-190",
      code: "water_sinuosity_below_public_reference_envelope",
      evidencePath:
        ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/earth-geospatial-v7-slot-condition-v7-capacity-slot-190-2026-08-01T03-31-15-228Z/failure.json",
    },
  ],
  [
    "sakaerat-measurement-window-r02-c07-v3",
    {
      slotId: "v7-capacity-slot-190",
      code: "water_sinuosity_below_public_reference_envelope",
      evidencePath:
        ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/earth-geospatial-v7-slot-condition-v7-capacity-slot-190-2026-08-01T03-40-16-869Z/failure.json",
    },
  ],
]);
const TARGETS = [
  {
    sequenceCode: "45",
    slotId: "v7-capacity-slot-190",
    compositionRevision:
      "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-v6-20260801",
  },
  {
    sequenceCode: "49",
    slotId: "v7-capacity-slot-194",
    compositionRevision:
      "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-v6-20260801",
  },
];
const PREFLIGHT_SEQUENCE_45_CANDIDATE_ID = valueFor(
  "--sequence-45-candidate-id",
);
const PREFLIGHT_SEQUENCE_49_CANDIDATE_ID = valueFor(
  "--sequence-49-candidate-id",
);

const createdAtUtc = new Date().toISOString();
const selectionRunId =
  "thailand-rebuild64-sequence-45-49-measurement-window-selection-" +
  createdAtUtc.replace(/[:.]/g, "-");

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "thailand_rebuild64_sequence_45_49_measurement_window_replacement_started",
  runId: selectionRunId,
  kind: "measurement_window_replacement",
  status: "running",
  title: "The authorized Thailand measurement-window replacement for rebuild64 sequences 45 and 49 started",
  titleZh: "新64组第45、49张获批的泰国测量窗口替换已启动",
  detail: "Only slot-190 and slot-194 are ranked against unused windows from the existing formal Thailand candidate package; no RGB or historical RGB is read.",
  detailZh: "程序只在既有正式泰国候选包中为slot-190和slot-194排序未使用窗口；不生成RGB，也不读取历史RGB。",
  script: projectPath(import.meta.filename),
  currentStep: "rank_two_unused_thailand_measurement_windows",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

try {
  const authorization = readJson(AUTHORIZATION_PATH);
  assert(
    authorization.requestId === AUTHORIZATION_ID &&
      authorization.status === "owner_authorized_pending_execution" &&
      authorization.ownerDecision?.decision === "authorized",
    "owner authorization for the two measurement-window replacements is missing",
  );
  assert(
    (
      authorization.invariants?.includes(
        "unique_measurement_window_is_necessary_but_not_sufficient",
      ) ||
      authorization.invariants?.includes(
        "historical_rgb_audit_only_never_generation_reference",
      )
    ) &&
      authorization.invariants?.includes(
        "same_formal_thailand_measurement_source_scope",
      ),
    "owner authorization invariants are incomplete",
  );

  const parentPointer = readJson(WINDOW_PLAN_POINTER_PATH);
  const pointedPlan = readJson(parentPointer.runPath);
  const parentPlanPath = parentPointer.runPath;
  const parentPlan = readJson(parentPlanPath);
  const candidatePackage = readJson(parentPlan.candidateWindowsPath);
  assert(
    sha256File(parentPlan.candidateWindowsPath) ===
      parentPlan.candidateWindowsSha256,
    "candidate-window package hash mismatch",
  );
  assert(
    candidatePackage.grid?.columns === 11 &&
      candidatePackage.grid?.rows === 11,
    "formal Thailand 11x11 measurement candidate package is missing",
  );

  const currentAssignments = new Map(
    TARGETS.map((target) => {
      const raw = parentPlan.assignments.find(
        (entry) => entry.slotId === target.slotId,
      );
      assert(raw, `missing assignment: ${target.slotId}`);
      assert(
        raw.regionalLandscapeType === "wet-season-drainage-hollow" &&
          raw.monsoonSeason === "wet_season",
        `fixed landscape or season changed: ${target.slotId}`,
      );
      return [target.slotId, normalizeAssignment(raw)];
    }),
  );
  const occupiedWindowIds = new Set(
    parentPlan.assignments
      .filter((entry) => !TARGETS.some((target) => target.slotId === entry.slotId))
      .map(
      (entry) => entry.measurementWindowId ?? entry.candidateId,
      ),
  );
  const currentFeatures = new Map(
    [...currentAssignments].map(([slotId, assignment]) => [
      slotId,
      buildTopologyFeatures(assignment),
    ]),
  );
  const rejectedWaterProfiles = new Map(
    TARGETS.map((target) => {
      const geometry = readJson(
        OWNER_REJECTED_WATER_BLUEPRINTS[target.slotId],
      ).geometry;
      return [target.slotId, {
        internalNetworkConnectionMode:
          geometry.internalHydrologyProfile?.internalNetworkConnectionMode,
        mainChannelBandCentroidX: verticalBandCentroidX(
          geometry.waterCenterline ?? [],
        ),
      }];
    }),
  );

  const eligibleCandidates = candidatePackage.candidates
    .filter((candidate) => !occupiedWindowIds.has(candidate.candidateId))
    .filter(supportsWetSeasonDrainageHollow)
    .map((candidate) => {
      const assignment = candidateAssignment(candidate);
      return {
        candidate,
        features: buildTopologyFeatures(assignment),
      };
    });
  assert(
    eligibleCandidates.length >= 2,
    "fewer than two unused Thailand windows support the fixed wet-season drainage-hollow definition",
  );

  const rankings = [];
  for (const left of eligibleCandidates) {
    for (const right of eligibleCandidates) {
      if (
        PREFLIGHT_SEQUENCE_45_CANDIDATE_ID &&
        left.candidate.candidateId !== PREFLIGHT_SEQUENCE_45_CANDIDATE_ID
      ) continue;
      if (
        PREFLIGHT_SEQUENCE_49_CANDIDATE_ID &&
        right.candidate.candidateId !== PREFLIGHT_SEQUENCE_49_CANDIDATE_ID
      ) continue;
      if (left.candidate.candidateId === right.candidate.candidateId) continue;
      if (
        left.features.internalNetworkConnectionMode ===
        right.features.internalNetworkConnectionMode
      ) {
        continue;
      }
      const leftScore = slotChangeScore(
        left.features,
        currentFeatures.get(TARGETS[0].slotId),
      );
      const rightScore = slotChangeScore(
        right.features,
        currentFeatures.get(TARGETS[1].slotId),
      );
      const pairDiversityScore = pairChangeScore(
        left.features,
        right.features,
      );
      rankings.push({
        sequence45CandidateId: left.candidate.candidateId,
        sequence49CandidateId: right.candidate.candidateId,
        sequence45ChangeScore: round(leftScore),
        sequence49ChangeScore: round(rightScore),
        pairDiversityScore: round(pairDiversityScore),
        totalScore: round(leftScore + rightScore + pairDiversityScore),
        sequence45Features: summarizeFeatures(left.features),
        sequence49Features: summarizeFeatures(right.features),
      });
    }
  }
  assert(
    rankings.length > 0,
    "no two eligible real Thailand measurement windows produce different semantic water-network connection modes",
  );
  rankings.sort(
    (left, right) =>
      right.totalScore - left.totalScore ||
      left.sequence45CandidateId.localeCompare(right.sequence45CandidateId) ||
      left.sequence49CandidateId.localeCompare(right.sequence49CandidateId),
  );
  const waterProfilePointer = readJson(WATER_PROFILE_POINTER_PATH);
  const waterNaturalnessProfile = readJson(waterProfilePointer.profilePath);
  const candidateConnectivityContextBySlot = new Map(
    TARGETS.map((target) => {
      const manifest = currentSuccessfulConditionManifest(target.slotId);
      const connectivity = readJson(manifest.connectivityBlueprintPath);
      return [
        target.slotId,
        {
          sourcePackage: readJson(manifest.realEarthRegionSourcePackagePath),
          worldProfileId: connectivity.worldProfileId,
          compositionRevision: target.compositionRevision,
        },
      ];
    }),
  );
  const candidateById = new Map(
    eligibleCandidates.map((entry) => [entry.candidate.candidateId, entry]),
  );
  const waterAuditCache = new Map();
  let selected = null;
  for (const ranking of rankings) {
    const sequence45WaterAudit = waterAuditForCandidate(
      candidateById.get(ranking.sequence45CandidateId),
      waterNaturalnessProfile,
      TARGETS[0],
      candidateConnectivityContextBySlot.get(TARGETS[0].slotId),
      waterAuditCache,
    );
    const sequence49WaterAudit = waterAuditForCandidate(
      candidateById.get(ranking.sequence49CandidateId),
      waterNaturalnessProfile,
      TARGETS[1],
      candidateConnectivityContextBySlot.get(TARGETS[1].slotId),
      waterAuditCache,
    );
    const sequence45RejectedDistance = bandCentroidDistance(
      sequence45WaterAudit.mainChannelBandCentroidX,
      rejectedWaterProfiles.get(TARGETS[0].slotId)
        .mainChannelBandCentroidX,
    );
    const sequence49RejectedDistance = bandCentroidDistance(
      sequence49WaterAudit.mainChannelBandCentroidX,
      rejectedWaterProfiles.get(TARGETS[1].slotId)
        .mainChannelBandCentroidX,
    );
    if (
      sequence45WaterAudit.passed &&
      sequence49WaterAudit.passed &&
      sequence45RejectedDistance >=
        MINIMUM_REJECTED_MAIN_CHANNEL_BAND_CENTROID_DISTANCE &&
      sequence49RejectedDistance >=
        MINIMUM_REJECTED_MAIN_CHANNEL_BAND_CENTROID_DISTANCE
    ) {
      selected = {
        ...ranking,
        sequence45WaterAudit,
        sequence49WaterAudit,
        sequence45RejectedMainChannelBandCentroidDistance:
          round(sequence45RejectedDistance),
        sequence49RejectedMainChannelBandCentroidDistance:
          round(sequence49RejectedDistance),
      };
      break;
    }
  }
  assert(
    selected,
    `measurement-window pair ranking is empty; evaluated=${waterAuditCache.size}; passed=${[...waterAuditCache.values()].filter((entry) => entry.passed).length}; sampleFailure=${JSON.stringify([...waterAuditCache.values()].find((entry) => !entry.passed) ?? null)}`,
  );
  assert(
    selected.sequence45Features.internalNetworkConnectionMode !==
      selected.sequence49Features.internalNetworkConnectionMode,
    "selected water maps still share the same semantic network connection mode",
  );

  const selectedBySlot = new Map([
    [
      TARGETS[0].slotId,
      candidatePackage.candidates.find(
        (entry) => entry.candidateId === selected.sequence45CandidateId,
      ),
    ],
    [
      TARGETS[1].slotId,
      candidatePackage.candidates.find(
        (entry) => entry.candidateId === selected.sequence49CandidateId,
      ),
    ],
  ]);
  const selection = {
    schemaVersion:
      "thailand-rebuild64-two-measurement-window-selection-v1",
    runId: selectionRunId,
    status: "two_unused_measurement_windows_selected",
    createdAtUtc,
    createdAtAsiaShanghai: formatShanghai(createdAtUtc),
    authorizationId: AUTHORIZATION_ID,
    sourceDataset:
      "approved_sakaerat_wang_nam_khiao_measurement_package",
    sourceCandidatePackage: {
      path: parentPlan.candidateWindowsPath,
      sha256: parentPlan.candidateWindowsSha256,
      grid: structuredClone(candidatePackage.grid),
    },
    parentWindowPlan: {
      runId: parentPlan.runId,
      path: parentPlanPath,
      sha256: sha256File(parentPlanPath),
    },
    fixedDefinitions: TARGETS.map((target) => {
      const assignment = currentAssignments.get(target.slotId);
      return {
        ...target,
        landscape: assignment.regionalLandscapeType,
        season: assignment.monsoonSeason,
        hydrology: "inland_hydrology",
        entrySide: target.slotId.endsWith("190") ? "east" : "west",
        previousMeasurementWindowId: assignment.candidateId,
        compositionRevision: target.compositionRevision,
      };
    }),
    selectionRule: {
      methodId:
        "unused_thailand_window_distinct_semantic_water_network_type_hard_gate_v2",
      ecologyEligibility:
        "relativeElevation<=0.38; relativeRelief<=0.32; normalizedSlopeMean<=0.22; treeCover>=0.75; drainageLikelihoodRatio>=0.95",
      slotChangeScore:
        "mean absolute distance across 8 direct and 8 relative hydrology supports plus route/mode/branch-side/backwater changes",
      pairDiversityScore:
        "hard-require different internal network connection modes, then rank hydrology-support, route and branch differences between sequence45 and sequence49",
      sameInternalNetworkConnectionModeAllowed: false,
      sameNetworkModeAsOwnOwnerRejectedHistoryAllowedOnlyWhenMainChannelAndCompleteSkeletonPassAllHistoryGate:
        true,
      minimumOwnOwnerRejectedMainChannelBandCentroidDistance:
        MINIMUM_REJECTED_MAIN_CHANNEL_BAND_CENTROID_DISTANCE,
      thresholdsChanged: false,
      historicalRgbRead: false,
      exactRealWorldGeometryCarriedIntoGameCoordinates: false,
      fullCurrent64AndAllHistoryAuditsStillRequired: true,
      fullWaterNaturalnessAndCorridorShapeAuditsRequiredBeforeSelection:
        true,
      candidateSpecificConnectivityAndHalfWidthsRequiredBeforeSelection:
        true,
      fullConditionBuildRejectionsAppliedPerTargetSlotNotGlobally: true,
    },
    counts: {
      totalCandidates: candidatePackage.candidates.length,
      occupiedByOther62: occupiedWindowIds.size,
      ecologyEligibleUnusedCandidates: eligibleCandidates.length,
      rankedOrderedPairs: rankings.length,
      waterAuditCandidatesEvaluated: waterAuditCache.size,
      fullConditionBuildRejectedCandidates:
        FULL_CONDITION_BUILD_REJECTIONS.size,
      rgbCreated: 0,
    },
    fullConditionBuildRejections: [
      ...FULL_CONDITION_BUILD_REJECTIONS.entries(),
    ].map(([candidateId, evidence]) => ({
      candidateId,
      ...evidence,
      evidenceSha256: sha256File(evidence.evidencePath),
    })),
    selected,
    waterAuditEvaluations: [...waterAuditCache.values()],
    topRankings: rankings.slice(0, 20),
    outputBoundary: noComputeBoundary(),
  };
  const immutableSelection = writeImmutableProgramRun({
    root: SELECTION_ROOT,
    runId: selectionRunId,
    fileName: "selection-report.json",
    record: selection,
    latest: {
      schemaVersion:
        "thailand-rebuild64-two-measurement-window-selection-v1-latest-pointer",
      status: selection.status,
      authorizationId: AUTHORIZATION_ID,
      sequence45CandidateId: selected.sequence45CandidateId,
      sequence49CandidateId: selected.sequence49CandidateId,
      rgbCreated: 0,
    },
  });

  const assignments = parentPlan.assignments.map((raw) => {
    const candidate = selectedBySlot.get(raw.slotId);
    if (!candidate) return structuredClone(raw);
    return replaceAssignment(raw, candidate);
  });
  assertNoOverlap(assignments);
  assertUnique(
    assignments.map((entry) => entry.measurementWindowId ?? entry.candidateId),
    "measurement-window identities",
  );
  assertUnique(
    assignments.map(
      (entry) =>
        (entry.measurementFingerprints ?? entry.fingerprints)
          .transformCanonical,
    ),
    "measurement transform fingerprints",
  );
  const changedSlots = assignments
    .filter(
      (entry, index) =>
        JSON.stringify(entry) !== JSON.stringify(parentPlan.assignments[index]),
    )
    .map((entry) => entry.slotId);
  assert(
    changedSlots.length >= 1 &&
      changedSlots.every((slotId) =>
        TARGETS.some((target) => target.slotId === slotId),
      ),
    `unexpected changed slots: ${changedSlots.join(",")}`,
  );

  const planCreatedAtUtc = new Date().toISOString();
  const planRunId =
    "earth-geospatial-v7-mvp-window-plan-rebuild64-two-window-replacement-" +
    planCreatedAtUtc.replace(/[:.]/g, "-");
  const plan = {
    ...structuredClone(parentPlan),
    runId: planRunId,
    createdAtUtc: planCreatedAtUtc,
    createdAtAsiaShanghai: formatShanghai(planCreatedAtUtc),
    parentWindowPlanRunId: parentPlan.runId,
    parentWindowPlanPath: parentPlanPath,
    parentWindowPlanSha256: sha256File(parentPlanPath),
    replacementAuthorizationId: AUTHORIZATION_ID,
    replacementEvidence: {
      path: immutableSelection.runPath,
      sha256: sha256File(immutableSelection.runPath),
      selectionRunId,
      changedSlots,
      historicalRgbRead: false,
      exactMeasurementGeometryCarriedIntoGameCoordinates: false,
    },
    assignments,
    counts: {
      ...structuredClone(parentPlan.counts),
      selectedWindowCount: assignments.length,
      uniqueDirectFingerprintCount: new Set(
        assignments.map(
          (entry) =>
            (entry.measurementFingerprints ?? entry.fingerprints).direct,
        ),
      ).size,
      uniqueTransformCanonicalFingerprintCount: new Set(
        assignments.map(
          (entry) =>
            (entry.measurementFingerprints ?? entry.fingerprints)
              .transformCanonical,
        ),
      ).size,
      overlappingSelectedWindowPairCount: 0,
    },
    outputBoundary: noComputeBoundary(),
    nextRequiredAction:
      "rebuild_only_slot_190_and_slot_194_then_run_current64_framework_dynamic_readiness_and_all_history_pre_rgb_novelty_audits",
  };
  const immutablePlan = writeImmutableProgramRun({
    root: WINDOW_PLAN_ROOT,
    runId: planRunId,
    fileName: "window-plan.json",
    record: plan,
    latest: {
      contractId: plan.contractId,
      authorizationId: plan.authorizationId,
      replacementAuthorizationId: AUTHORIZATION_ID,
      candidateWindowsPath: plan.candidateWindowsPath,
      candidateWindowsSha256: plan.candidateWindowsSha256,
      capacityPlanRunId: plan.capacityPlanRunId,
      selectedWindowCount: assignments.length,
      replacementSlotIds: changedSlots,
      replacementEvidencePath: immutableSelection.runPath,
      replacementEvidenceSha256: sha256File(immutableSelection.runPath),
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  });

  const finishedAtUtc = new Date().toISOString();
  appendAiPainterProgramEvent({
    timestamp: finishedAtUtc,
    action: "thailand_rebuild64_sequence_45_49_measurement_window_replacement_completed",
    runId: planRunId,
    kind: "measurement_window_replacement",
    status: "success",
    title: "The two authorized Thailand measurement-window bindings were replaced",
    titleZh: "获批的两个泰国测量窗口绑定已完成替换",
    detail: `slot-190=${selected.sequence45CandidateId}; slot-194=${selected.sequence49CandidateId}; changedSlots=2; rgbCreated=0`,
    detailZh: `slot-190=${selected.sequence45CandidateId}；slot-194=${selected.sequence49CandidateId}；只修改2个槽位；尚未生成RGB。`,
    script: projectPath(import.meta.filename),
    currentStep: "two_measurement_bindings_replaced_waiting_full_audits",
    evidencePath: immutablePlan.runPath,
    evidence: [immutablePlan.runPath, immutableSelection.runPath],
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        authorizationId: AUTHORIZATION_ID,
        selectionPath: immutableSelection.runPath,
        selectionSha256: sha256File(immutableSelection.runPath),
        planPath: immutablePlan.runPath,
        planSha256: sha256File(immutablePlan.runPath),
        selected,
        changedSlots,
        rgbCreated: 0,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const failedAtUtc = new Date().toISOString();
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    action: "thailand_rebuild64_sequence_45_49_measurement_window_replacement_failed",
    runId: selectionRunId,
    kind: "measurement_window_replacement",
    status: "failed",
    title: "The authorized two-window replacement failed",
    titleZh: "获批的两个测量窗口替换失败",
    detail: `${error instanceof Error ? error.message : String(error)}; rgbCreated=0`,
    detailZh: `${error instanceof Error ? error.message : String(error)}；未生成RGB。`,
    script: projectPath(import.meta.filename),
    currentStep: "two_measurement_window_replacement_failed",
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });
  throw error;
}

function normalizeAssignment(raw) {
  return {
    ...structuredClone(raw),
    candidateId: raw.candidateId ?? raw.measurementWindowId,
    metrics: raw.metrics ?? raw.measurementMetrics,
    fingerprints: raw.fingerprints ?? raw.measurementFingerprints,
  };
}

function candidateAssignment(candidate) {
  return {
    slotId: "candidate-thailand-rebuild64-wet-season-drainage-hollow",
    candidateId: candidate.candidateId,
    regionalLandscapeType: "wet-season-drainage-hollow",
    monsoonSeason: "wet_season",
    sourcePixelWindow: structuredClone(candidate.sourcePixelWindow),
    metrics: structuredClone(candidate.metrics),
    fingerprints: structuredClone(candidate.fingerprints),
  };
}

function supportsWetSeasonDrainageHollow(candidate) {
  const metrics = candidate.metrics;
  return (
    metrics.relativeElevation <= 0.38 &&
    metrics.relativeRelief <= 0.32 &&
    metrics.normalizedSlope.mean <= 0.22 &&
    metrics.drainageLikelihoodRatio >= 0.95 &&
    metrics.reconstructedLandCoverRatio.treeCover >= 0.75
  );
}

function buildTopologyFeatures(assignment) {
  const coarse = buildMeasurementDerivedCoarseHydrologyProfile({
    assignment,
    root: ROOT,
  });
  const layout = buildMeasurementDrivenAnonymousLayoutProfile({
    assignment,
    hasWater: true,
    coarseHydrologyProfile: coarse,
  });
  return {
    supportVector: coarse.coarseBands.flatMap((band) => [
      band.anonymousSupportFraction,
      band.quantizedRelativeSupport,
    ]),
    routeTopology: layout.routeTopology,
    internalNetworkConnectionMode:
      layout.internalHydrologyProfile.internalNetworkConnectionMode,
    branchSide: layout.internalHydrologyProfile.branchSide,
    backwaterBasinCount:
      layout.internalHydrologyProfile.backwaterBasinCount,
    coarseHydrologyProfileSha256: coarse.profileSha256,
    layoutProfileSha256: layout.profileSha256,
  };
}

function slotChangeScore(candidate, current) {
  return (
    meanAbsoluteDistance(candidate.supportVector, current.supportVector) +
    (candidate.routeTopology !== current.routeTopology ? 0.2 : 0) +
    (candidate.internalNetworkConnectionMode !==
    current.internalNetworkConnectionMode
      ? 0.1
      : 0) +
    (candidate.branchSide !== current.branchSide ? 0.05 : 0) +
    (candidate.backwaterBasinCount !== current.backwaterBasinCount
      ? 0.05
      : 0)
  );
}

function pairChangeScore(left, right) {
  return (
    meanAbsoluteDistance(left.supportVector, right.supportVector) +
    (left.routeTopology !== right.routeTopology ? 0.2 : 0) +
    (left.internalNetworkConnectionMode !==
    right.internalNetworkConnectionMode
      ? 0.1
      : 0) +
    (left.branchSide !== right.branchSide ? 0.05 : 0)
  );
}

function summarizeFeatures(features) {
  return {
    supportVector: features.supportVector,
    routeTopology: features.routeTopology,
    internalNetworkConnectionMode:
      features.internalNetworkConnectionMode,
    branchSide: features.branchSide,
    backwaterBasinCount: features.backwaterBasinCount,
    coarseHydrologyProfileSha256:
      features.coarseHydrologyProfileSha256,
    layoutProfileSha256: features.layoutProfileSha256,
  };
}

function waterAuditForCandidate(
  rankedCandidate,
  waterNaturalnessProfile,
  target,
  connectivityContext,
  cache,
) {
  assert(rankedCandidate, "ranked measurement candidate is missing");
  const candidateId = rankedCandidate.candidate.candidateId;
  const cacheKey = `${target.slotId}:${target.compositionRevision}:${candidateId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const assignment = candidateAssignment(rankedCandidate.candidate);
  assignment.slotId = target.slotId;
  try {
    const connectivity = buildIndependentTrainingRegionConnectivity({
      slotId: target.slotId,
      assignment,
      worldProfileId: connectivityContext.worldProfileId,
      sourcePackage: connectivityContext.sourcePackage,
      width: 1024,
      height: 768,
      hasWater: true,
      anonymousCompositionArchitectureRevision:
        connectivityContext.compositionRevision,
    });
    const waterPlan =
      connectivity.anonymousTrainingCoordinateProjection?.waterPlan;
    assert(
      waterPlan?.start && waterPlan?.end,
      "candidate-specific water plan is missing",
    );
    const coarseHydrologyProfile =
      buildMeasurementDerivedCoarseHydrologyProfile({
        assignment,
        root: ROOT,
      });
    const corridorHalfWidths =
      buildMeasurementDerivedNetworkHalfWidths({
        pointCount: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
        startHalfWidth: waterPlan.startHalfWidth,
        endHalfWidth: waterPlan.endHalfWidth,
        coarseHydrologyProfile,
      });
    const mainChannel = buildMeasurementDerivedAnonymousMainChannel({
      start: structuredClone(waterPlan.start),
      end: structuredClone(waterPlan.end),
      width: 1024,
      height: 768,
      coarseHydrologyProfile,
      waterNaturalnessProfile,
      corridorHalfWidths,
    });
    const layoutProfile = buildMeasurementDrivenAnonymousLayoutProfile({
      assignment,
      hasWater: true,
      coarseHydrologyProfile,
      routeSearchExpansionRevision:
        connectivityContext.compositionRevision,
    });
    const branch = buildCandidateInternalHydrology({
      centerline: mainChannel.points,
      waterHalfWidths: corridorHalfWidths,
      waterNaturalnessProfile,
      internalHydrologyProfile:
        layoutProfile.internalHydrologyProfile,
      coarseHydrologyProfile,
    });
    const result = {
      candidateId,
      slotId: target.slotId,
      compositionRevision: connectivityContext.compositionRevision,
      passed: true,
      candidateWaterPlan: structuredClone(waterPlan),
      internalHydrologyAudit: {
        internalNetworkConnectionMode:
          layoutProfile.internalHydrologyProfile
            .internalNetworkConnectionMode,
        branchSide:
          layoutProfile.internalHydrologyProfile.branchSide,
        geometrySha256: branch.geometrySha256,
        waterSinuosity:
          branch.naturalnessAudit?.sinuosity ?? null,
        minimumBendRadiusToHalfWidthRatio:
          branch.corridorShapeAudit
            ?.minimumBendRadiusToHalfWidthRatio ?? null,
      },
      mainChannelBandCentroidX: verticalBandCentroidX(
        mainChannel.points,
      ),
      geometrySha256: mainChannel.geometrySha256,
      dataInfluenceScale: mainChannel.selection?.dataInfluenceScale ?? null,
      directEightBandInfluence:
        mainChannel.selection?.directEightBandInfluence ?? null,
      supportTransitionMaximum:
        mainChannel.selection?.supportTransitionMaximum ?? null,
      waterSinuosity:
        mainChannel.naturalnessAudit?.sinuosity ?? null,
      minimumBendRadiusToHalfWidthRatio:
        mainChannel.corridorShapeAudit
          ?.minimumBendRadiusToHalfWidthRatio ?? null,
      reviewThresholdsChanged: false,
    };
    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result = {
      candidateId,
      passed: false,
      errorCode: message.includes(
        "water_sinuosity_below_public_reference_envelope",
      )
        ? "water_sinuosity_below_public_reference_envelope"
        : "unchanged_water_audit_failed",
      errorSummary: message.slice(0, 240),
      reviewThresholdsChanged: false,
    };
    cache.set(cacheKey, result);
    return result;
  }
}

function buildCandidateInternalHydrology({
  centerline,
  waterHalfWidths,
  waterNaturalnessProfile,
  internalHydrologyProfile,
  coarseHydrologyProfile,
}) {
  const finalIndex = centerline.length - 1;
  const divergenceIndex = clamp(
    Math.round(finalIndex * internalHydrologyProfile.divergenceFraction),
    1,
    finalIndex - 2,
  );
  const rejoinIndex = clamp(
    Math.round(finalIndex * internalHydrologyProfile.rejoinFraction),
    divergenceIndex + 2,
    finalIndex - 1,
  );
  const branchRandom = mulberry32(
    Number.parseInt(
      internalHydrologyProfile.measurementTopologyFingerprint.slice(0, 8),
      16,
    ),
  );
  const branchStartHalfWidth = Math.max(
    22,
    Math.round(
      waterHalfWidths[divergenceIndex] *
        internalHydrologyProfile.branchWidthScale,
    ),
  );
  const branchEndHalfWidth = Math.max(
    branchStartHalfWidth,
    Math.round(
      waterHalfWidths[rejoinIndex] *
        internalHydrologyProfile.branchWidthScale,
    ),
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
    internalHydrologyProfile.internalNetworkConnectionMode ===
    "interior_headwater_tributary_to_main_channel"
      ? {
          x:
            1024 *
            internalHydrologyProfile.tributaryHeadwaterXFraction,
          y: centerline[divergenceIndex].y,
        }
      : structuredClone(centerline[divergenceIndex]);
  const branchEnd =
    internalHydrologyProfile.internalNetworkConnectionMode ===
    "main_channel_connected_floodplain_backwater_finger"
      ? {
          x:
            1024 *
            (centerline[rejoinIndex].x < 512
              ? 0.86
              : 0.14),
          y: Math.min(
            767,
            centerline[divergenceIndex].y +
              768 *
                clamp(
                  0.3 +
                    (internalHydrologyProfile
                      .measurementSupportStatistics
                      ?.relativeSupportRange ?? 0) *
                      0.2,
                  0.3,
                  0.42,
                ),
          ),
        }
      : structuredClone(centerline[rejoinIndex]);
  return buildMeasurementDerivedAnonymousAnabranch({
    start: branchStart,
    end: branchEnd,
    width: 1024,
    coarseHydrologyProfile,
    internalHydrologyProfile,
    waterNaturalnessProfile,
    corridorHalfWidths: branchHalfWidths,
  });
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function readBoundaryWaterPorts(connectivityBlueprint) {
  const internalWaterPlan =
    connectivityBlueprint.anonymousTrainingCoordinateProjection?.waterPlan;
  if (
    internalWaterPlan?.start &&
    internalWaterPlan?.end &&
    Array.isArray(internalWaterPlan.externalWaterPorts) &&
    internalWaterPlan.externalWaterPorts.length === 0
  ) {
    return {
      upstream: structuredClone(internalWaterPlan.start),
      downstream: structuredClone(internalWaterPlan.end),
    };
  }
  const currentRegionId = connectivityBlueprint.currentRegion?.regionId;
  const waterPorts = (connectivityBlueprint.edgePorts ?? []).filter(
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
  assert(upstream && downstream, "water boundary constraints are missing");
  return {
    upstream: structuredClone(upstream.boundaryPosition),
    downstream: structuredClone(downstream.boundaryPosition),
  };
}

function currentSuccessfulConditionManifest(slotId) {
  const root = path.resolve(ROOT, CONDITION_RUN_ROOT);
  const manifests = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, "complete-map-condition-run.json"))
    .filter((entry) => fs.existsSync(entry))
    .map((entry) => readJson(entry))
    .filter(
      (entry) =>
        entry.v7SlotId === slotId &&
        entry.status === "complete_map_conditions_ready_rgb_authorization_required",
    )
    .sort((left, right) =>
      String(right.createdAtUtc).localeCompare(String(left.createdAtUtc)),
    );
  assert(manifests.length > 0, `current successful condition manifest missing: ${slotId}`);
  return manifests[0];
}

function replaceAssignment(raw, candidate) {
  const metrics = structuredClone(candidate.metrics);
  return {
    ...structuredClone(raw),
    measurementWindowId: candidate.candidateId,
    measurementBounds: structuredClone(candidate.measurementBounds),
    sourcePixelWindow: structuredClone(candidate.sourcePixelWindow),
    measurementMetrics: metrics,
    measurementFingerprints: structuredClone(candidate.fingerprints),
    regionalLandscapeType: "wet-season-drainage-hollow",
    regionalLandscapeTypeStatus:
      "derived_from_current_window_world_facts_and_ecology",
    landscapeDerivation: {
      ...structuredClone(raw.landscapeDerivation),
      ruleId: "measured_low_relief_drainage_position_in_wet_phase",
      quotaAssignmentUsed: false,
      currentWindowFactsUsed: true,
      measuredEvidence: {
        relativeElevation: metrics.relativeElevation,
        relativeRelief: metrics.relativeRelief,
        meanSlope: metrics.normalizedSlope.mean,
        treeCover: metrics.reconstructedLandCoverRatio.treeCover,
        grassland: metrics.reconstructedLandCoverRatio.grassland,
        monsoonSeason: "wet_season",
      },
      exactRealWorldGeometryCarriedForward: false,
      historicalRgbRead: false,
    },
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
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

function assertUnique(values, label) {
  assert(new Set(values).size === values.length, `${label} are not unique`);
}

function meanAbsoluteDistance(left, right) {
  assert(left.length === right.length, "topology vector length mismatch");
  return (
    left.reduce((total, value, index) => {
      return total + Math.abs(value - right[index]);
    }, 0) / left.length
  );
}

function verticalBandCentroidX(points) {
  return Array.from({ length: 8 }, (_, bandIndex) => {
    const minimumY = bandIndex * (768 / 8);
    const maximumY = (bandIndex + 1) * (768 / 8);
    const selected = points.filter(
      (point) => point.y >= minimumY && point.y < maximumY,
    );
    return selected.length === 0
      ? null
      : round(
          selected.reduce((total, point) => total + point.x, 0) /
            selected.length /
            1024,
        );
  });
}

function bandCentroidDistance(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return 0;
  let total = 0;
  let count = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] === null || right[index] === null) continue;
    total += Math.abs(left[index] - right[index]);
    count += 1;
  }
  return count === 0 ? 0 : total / count;
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

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, relativePath), "utf8"));
}

function sha256File(relativePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.resolve(ROOT, relativePath)))
    .digest("hex");
}

function round(value) {
  return Number(value.toFixed(8));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function valueFor(flag) {
  const inline = process.argv.find((entry) => entry.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}
