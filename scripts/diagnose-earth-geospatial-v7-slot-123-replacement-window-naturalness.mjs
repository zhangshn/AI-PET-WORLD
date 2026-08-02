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
  buildMeasurementDerivedAnonymousMainChannel,
  buildMeasurementDerivedCoarseHydrologyProfile,
  buildMeasurementDerivedNetworkHalfWidths,
} from "./lib/measurement-derived-coarse-hydrology.mjs";

const ROOT = process.cwd();
const SLOT_ID = "v7-capacity-slot-123";
const EXPECTED_CANDIDATE_ID =
  "sakaerat-measurement-window-r04-c04-v1";
const AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-record-replacement-window-naturalness-failure-and-read-only-diagnosis-20260728";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const FAILURE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-replacement-window-naturalness-failures/latest.json";
const COARSE_HYDROLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const WATER_NATURALNESS_LIBRARY_PATH =
  "scripts/lib/anonymous-water-naturalness.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-replacement-window-naturalness-diagnostics";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-replacement-window-naturalness-diagnosis-" +
  createdAtUtc.replace(/[:.]/g, "-");

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_123_replacement_window_naturalness_diagnosis_started",
  runId,
  kind: "read_only_diagnosis",
  status: "running",
  title:
    "The slot-123 replacement-window water-naturalness diagnosis started",
  titleZh: "slot-123 替换窗口河道自然性只读诊断已启动",
  detail:
    "The diagnosis reads immutable measurement, hydrology, failure, and source-code evidence only. It will not modify the production algorithm, replace the window, build conditions, or generate RGB.",
  detailZh:
    "诊断只读取不可变测量、水文、失败记录和源代码证据，不修改生产算法、不更换窗口、不构建条件包、不生成RGB。",
  script: projectPath(import.meta.filename),
  currentStep: "read_only_naturalness_diagnosis",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const windowPlanPointer = readJson(WINDOW_PLAN_POINTER_PATH);
const windowPlan = readJson(windowPlanPointer.runPath);
const currentAssignment = windowPlan.assignments.find(
  (entry) => entry.slotId === SLOT_ID,
);
assert(
  currentAssignment?.candidateId === EXPECTED_CANDIDATE_ID,
  "current slot-123 replacement binding mismatch",
);
const parentPlan = readJson(windowPlan.parentWindowPlanPath);
const previousAssignment = parentPlan.assignments.find(
  (entry) => entry.slotId === SLOT_ID,
);
assert(previousAssignment, "previous slot-123 binding is missing");
const failurePointer = readJson(FAILURE_POINTER_PATH);
const failureRecord = readJson(failurePointer.runPath);
const waterProfilePointer = readJson(WATER_PROFILE_POINTER_PATH);
const waterNaturalnessProfile = readJson(
  waterProfilePointer.profilePath,
);

const currentProfile =
  buildMeasurementDerivedCoarseHydrologyProfile({
    assignment: currentAssignment,
    root: ROOT,
  });
const previousProfile =
  buildMeasurementDerivedCoarseHydrologyProfile({
    assignment: previousAssignment,
    root: ROOT,
  });
const currentSupport = describeSupport(currentProfile);
const previousSupport = describeSupport(previousProfile);

const previousHalfWidths =
  buildMeasurementDerivedNetworkHalfWidths({
    pointCount: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
    startHalfWidth: 76,
    endHalfWidth: 140,
    coarseHydrologyProfile: previousProfile,
  });
const previousMainChannel =
  buildMeasurementDerivedAnonymousMainChannel({
    start: { x: 948, y: 0 },
    end: { x: 884, y: 768 },
    width: 1024,
    height: 768,
    coarseHydrologyProfile: previousProfile,
    waterNaturalnessProfile,
    corridorHalfWidths: previousHalfWidths,
  });

const failureCounts = failureRecord.failureSummary;
assert(
  failureCounts.candidateCount === 108 &&
    failureCounts.naturalnessFailureCounts
      .water_centerline_segment_too_long === 108 &&
    failureCounts.naturalnessFailureCounts
      .water_interior_turn_too_rigid === 108 &&
    failureCounts.corridorFailureCounts
      .water_inner_bank_bend_radius_too_tight === 108,
  "failure record does not contain the expected exhaustive rejection",
);
const generatorSource = fs.readFileSync(
  path.join(ROOT, COARSE_HYDROLOGY_LIBRARY_PATH),
  "utf8",
);
const candidateSweepEvidence = {
  dataInfluenceScaleVariants:
    extractArrayValues(
      generatorSource,
      "for (const dataInfluenceScale of [",
      "])",
    ),
  firstControlYVariants:
    extractArrayValues(
      generatorSource,
      "for (const firstControlYFraction of [",
      "])",
    ),
  secondControlYVariants:
    extractArrayValues(
      generatorSource,
      "for (const secondControlYFraction of [",
      "])",
    ),
  directEightBandInfluenceVariants:
    extractArrayValues(
      generatorSource,
      "for (const directEightBandInfluence of [",
      "])",
    ),
};
const expectedSweepCount =
  candidateSweepEvidence.dataInfluenceScaleVariants.length *
  candidateSweepEvidence.firstControlYVariants.length *
  candidateSweepEvidence.secondControlYVariants.length *
  candidateSweepEvidence.directEightBandInfluenceVariants.length;
assert(
  expectedSweepCount === failureCounts.candidateCount,
  "source-code candidate sweep does not match the saved failure record",
);

const finishedAtUtc = new Date().toISOString();
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-replacement-window-naturalness-diagnosis-v1",
  runId,
  status:
    "replacement_window_coarse_support_discontinuity_incompatible_with_current_anonymous_spline_confirmed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  authorizationId: AUTHORIZATION_ID,
  slotId: SLOT_ID,
  comparison: {
    currentReplacementWindow: {
      candidateId: currentAssignment.candidateId,
      directFingerprint: currentAssignment.fingerprints.direct,
      profileSha256: currentProfile.profileSha256,
      ...currentSupport,
    },
    previousWindow: {
      candidateId: previousAssignment.candidateId,
      directFingerprint: previousAssignment.fingerprints.direct,
      profileSha256: previousProfile.profileSha256,
      ...previousSupport,
      acceptedMainChannelAudit: previousMainChannel.audit,
      acceptedCorridorAudit: previousMainChannel.corridorAudit,
    },
  },
  exhaustiveCandidateEvidence: {
    sourceCandidateSweep: candidateSweepEvidence,
    expectedCandidateCount: expectedSweepCount,
    savedRejectedCandidateCount: failureCounts.candidateCount,
    naturalnessFailureCounts:
      failureCounts.naturalnessFailureCounts,
    corridorFailureCounts:
      failureCounts.corridorFailureCounts,
    candidateSinuosityRange: {
      minimum: failureCounts.minimumCandidateSinuosity,
      maximum: failureCounts.maximumCandidateSinuosity,
    },
  },
  diagnosis: {
    confirmedFacts: [
      "the replacement window was selected from the approved Sakaerat/Wang Nam Khiao measurement package",
      "the replacement profile contains eight quantized Priority-Flood plus D8 support bands",
      "all 108 existing anonymous main-channel parameter combinations were rejected by unchanged naturalness and corridor audits",
      "the failure occurred before condition-package construction and before any RGB generation",
      "the previous window still passes the same production main-channel builder and unchanged audits",
    ],
    rootCauseCode:
      "replacement_window_high_low_band_transition_exceeds_current_anonymous_spline_naturalness_capacity",
    rootCause:
      "The new measured support profile begins at 0.2 and rises to 0.8 in the next band. The generic high-support remap expands that adjacent transition from 0.6 to 0.75. The current eight-band anonymous spline applies this evidence directly at 70%, 75%, or 78% influence. Every existing control-point sweep therefore produces at least one overlong segment, an overly rigid interior turn, and an inner-bank bend-radius violation.",
    rootCauseZh:
      "新测量窗口的第一带支持度为0.2，下一带升至0.8；通用高支持度映射把相邻跃迁从0.6扩大到0.75。当前八带匿名样条又以70%、75%或78%的强度直接使用该证据，因此现有全部控制点组合都产生了至少一个过长线段、过于僵硬的内部转弯和内岸转弯半径违规。",
    classification:
      "new_measurement_profile_exposes_unhandled_generic_input_shape",
    measurementDataInvalid: false,
    replacementSelectionInvalidatedByDiagnosis: false,
    reviewThresholdFailure: false,
    promptFailure: false,
    historicalRgbOrGeometryRead: false,
  },
  possibleNextActionsRequiringOwnerChoice: [
    {
      action:
        "add_a_generic_evidence_preserving_transition_limiter_or_more_dense_intermediate_anchors_then_rerun_unchanged_audits",
      effect:
        "keeps the selected real window while making the anonymous mapping handle abrupt but valid measured band transitions",
      changesProductionAlgorithm: true,
      changesReviewThresholds: false,
    },
    {
      action:
        "reject_this_window_for_slot_123_and_programmatically_rank_the_next_unused_window",
      effect:
        "keeps the current algorithm but changes the measurement-window binding",
      changesProductionAlgorithm: false,
      changesMeasurementWindow: true,
    },
  ],
  sourceEvidence: {
    failureRecordPath: failurePointer.runPath,
    failureRecordSha256: sha256File(failurePointer.runPath),
    windowPlanPath: windowPlanPointer.runPath,
    windowPlanSha256: sha256File(windowPlanPointer.runPath),
    parentWindowPlanPath: windowPlan.parentWindowPlanPath,
    parentWindowPlanSha256: sha256File(
      windowPlan.parentWindowPlanPath,
    ),
    waterNaturalnessProfilePath: waterProfilePointer.profilePath,
    waterNaturalnessProfileSha256: sha256File(
      waterProfilePointer.profilePath,
    ),
    coarseHydrologyLibraryPath: COARSE_HYDROLOGY_LIBRARY_PATH,
    coarseHydrologyLibrarySha256: sha256File(
      COARSE_HYDROLOGY_LIBRARY_PATH,
    ),
    waterNaturalnessLibraryPath:
      WATER_NATURALNESS_LIBRARY_PATH,
    waterNaturalnessLibrarySha256: sha256File(
      WATER_NATURALNESS_LIBRARY_PATH,
    ),
    diagnosticProgramPath: projectPath(import.meta.filename),
    diagnosticProgramSha256: sha256File(import.meta.filename),
  },
  changesMadeByDiagnosis: {
    productionAlgorithmModified: false,
    measurementWindowChanged: false,
    reviewThresholdChanged: false,
    conditionPackageBuilt: false,
  },
  outputBoundary: {
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
    status: report.status,
    rootCauseCode: report.diagnosis.rootCauseCode,
    candidateId: currentAssignment.candidateId,
    productionAlgorithmModified: false,
    measurementWindowChanged: false,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action: "v7_slot_123_replacement_window_naturalness_diagnosis_completed",
  runId,
  kind: "read_only_diagnosis",
  status: "success",
  title:
    "The slot-123 replacement-window water-naturalness diagnosis completed",
  titleZh: "slot-123 替换窗口河道自然性只读诊断已完成",
  detail:
    `rootCause=${report.diagnosis.rootCauseCode}; replacementSupportJump=${currentSupport.maximumAdjacentRemappedSupportDelta}; rejectedCandidates=${failureCounts.candidateCount}; reportSha256=${reportSha256}; productionAlgorithmModified=false; imageGenerationStarted=false`,
  detailZh:
    `根因=${report.diagnosis.rootCauseCode}；替换窗口映射后最大相邻支持度跃迁=${currentSupport.maximumAdjacentRemappedSupportDelta}；被拒候选=${failureCounts.candidateCount}；报告SHA-256=${reportSha256}；未修改生产算法；未启动图像生成。`,
  script: projectPath(import.meta.filename),
  currentStep: "read_only_naturalness_diagnosis_completed",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    failurePointer.runPath,
    windowPlanPointer.runPath,
    windowPlan.parentWindowPlanPath,
    waterProfilePointer.profilePath,
    COARSE_HYDROLOGY_LIBRARY_PATH,
    WATER_NATURALNESS_LIBRARY_PATH,
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
      currentCandidateId: currentAssignment.candidateId,
      currentSupports: currentSupport.supportFractions,
      currentRemappedSupports: currentSupport.remappedSupportFractions,
      currentMaximumAdjacentSupportDelta:
        currentSupport.maximumAdjacentSupportDelta,
      currentMaximumAdjacentRemappedSupportDelta:
        currentSupport.maximumAdjacentRemappedSupportDelta,
      previousCandidateId: previousAssignment.candidateId,
      previousMaximumAdjacentRemappedSupportDelta:
        previousSupport.maximumAdjacentRemappedSupportDelta,
      rejectedCandidateCount: failureCounts.candidateCount,
      productionAlgorithmModified: false,
      measurementWindowChanged: false,
      imageGenerationStarted: false,
      rgbCreated: 0,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function describeSupport(profile) {
  const supportFractions = profile.coarseBands.map(
    (entry) => entry.anonymousSupportFraction,
  );
  const remappedSupportFractions = supportFractions.map((support) =>
    support > 0.5
      ? round(Math.min(0.95, support + (support - 0.5) * 0.75))
      : support,
  );
  return {
    supportFractions,
    remappedSupportFractions,
    maximumAdjacentSupportDelta: maximumAdjacentDelta(
      supportFractions,
    ),
    maximumAdjacentRemappedSupportDelta: maximumAdjacentDelta(
      remappedSupportFractions,
    ),
  };
}

function maximumAdjacentDelta(values) {
  return round(
    Math.max(
      ...values.slice(1).map((value, index) =>
        Math.abs(value - values[index]),
      ),
    ),
  );
}

function extractArrayValues(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert(start >= 0, `source marker missing: ${startMarker}`);
  const valueStart = start + startMarker.length;
  const end = source.indexOf(endMarker, valueStart);
  assert(end >= 0, `source marker end missing: ${startMarker}`);
  return source
    .slice(valueStart, end)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map(Number)
    .filter(Number.isFinite);
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
