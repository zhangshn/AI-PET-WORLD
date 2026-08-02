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
  "project-owner-authorized-v7-capacity-slot-123-record-support-transition-regression-failure-and-add-generic-tangent-curvature-limiter-20260728";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const COARSE_HYDROLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const WATER_NATURALNESS_LIBRARY_PATH =
  "scripts/lib/anonymous-water-naturalness.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-support-transition-regression-failures";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-support-transition-regression-failure-" +
  createdAtUtc.replace(/[:.]/g, "-");

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_123_support_transition_regression_started",
  runId,
  kind: "no_rgb_regression",
  status: "running",
  title:
    "The slot-123 generic support-transition regression started",
  titleZh: "slot-123 通用支持度过渡回归已启动",
  detail:
    "The program will reproduce and save the first generic transition-limiter result without generating RGB or starting GPU training.",
  detailZh:
    "程序将复现并保存首轮通用过渡限制器结果，不生成RGB、不启动GPU训练。",
  script: projectPath(import.meta.filename),
  currentStep: "support_transition_regression",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const windowPlanPointer = readJson(WINDOW_PLAN_POINTER_PATH);
const windowPlan = readJson(windowPlanPointer.runPath);
const assignment = windowPlan.assignments.find(
  (entry) => entry.slotId === SLOT_ID,
);
assert(
  assignment?.candidateId === EXPECTED_CANDIDATE_ID,
  "slot-123 measurement-window binding mismatch",
);
const waterProfilePointer = readJson(WATER_PROFILE_POINTER_PATH);
const waterNaturalnessProfile = readJson(
  waterProfilePointer.profilePath,
);
const coarseProfile =
  buildMeasurementDerivedCoarseHydrologyProfile({
    assignment,
    root: ROOT,
  });
const corridorHalfWidths =
  buildMeasurementDerivedNetworkHalfWidths({
    pointCount: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
    startHalfWidth: 76,
    endHalfWidth: 140,
    coarseHydrologyProfile: coarseProfile,
  });

let reproducedError = null;
try {
  buildMeasurementDerivedAnonymousMainChannel({
    start: { x: 948, y: 0 },
    end: { x: 884, y: 768 },
    width: 1024,
    height: 768,
    coarseHydrologyProfile: coarseProfile,
    waterNaturalnessProfile,
    corridorHalfWidths,
  });
} catch (error) {
  reproducedError = error instanceof Error ? error.message : String(error);
}
assert(
  reproducedError?.startsWith(
    "coarse hydrology main-channel candidates failed unchanged water audits:",
  ),
  "the first transition-limiter regression failure was not reproduced",
);
const candidateFailures = parseCandidateFailures(reproducedError);
assert(candidateFailures.length === 108, "candidate count mismatch");
const naturalnessFailureCounts = countFailureCodes(
  candidateFailures,
  "naturalnessFailures",
);
const corridorFailureCounts = countFailureCodes(
  candidateFailures,
  "corridorFailures",
);
assert(
  corridorFailureCounts.water_inner_bank_bend_radius_too_tight ===
    108,
  "the expected exhaustive inner-bank bend-radius failure is missing",
);

const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-support-transition-regression-failure-v1",
  runId,
  status:
    "support_transition_limiter_improved_centerline_but_all_candidates_failed_inner_bank_curvature",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  authorizationId: AUTHORIZATION_ID,
  slotId: SLOT_ID,
  measurementBinding: {
    windowPlanRunId: windowPlan.runId,
    candidateId: assignment.candidateId,
    directFingerprint: assignment.fingerprints.direct,
    coarseHydrologyProfileSha256: coarseProfile.profileSha256,
  },
  regressionResult: {
    candidateCount: candidateFailures.length,
    naturalnessFailureCounts,
    corridorFailureCounts,
    candidatesPassingCenterlineNaturalness:
      candidateFailures.filter(
        (entry) => entry.naturalnessFailures.length === 0,
      ).length,
    candidatesPassingCorridorShape:
      candidateFailures.filter(
        (entry) => entry.corridorFailures.length === 0,
      ).length,
    minimumCandidateSinuosity: Math.min(
      ...candidateFailures.map((entry) => entry.sinuosity),
    ),
    maximumCandidateSinuosity: Math.max(
      ...candidateFailures.map((entry) => entry.sinuosity),
    ),
    errorMessage: reproducedError,
    errorMessageSha256: sha256Text(reproducedError),
  },
  diagnosis: {
    code:
      "c1_hermite_tangent_overshoot_keeps_inner_bank_bend_radius_below_unchanged_minimum",
    supportTransitionLimiterImprovedCenterline: true,
    supportTransitionLimiterAloneSufficient: false,
    reviewThresholdFailure: false,
    detail:
      "Limiting adjacent measurement-support transitions removed all centerline naturalness failures for part of the unchanged 108-candidate sweep, but every candidate still failed the unchanged minimum inner-bank bend-radius ratio. The remaining failure is isolated to C1 Hermite tangent curvature rather than the measurement window, review threshold, prompt, or channel data.",
    detailZh:
      "限制相邻测量支持度跃迁后，既有108组候选中已有部分消除了全部中心线自然性失败，但所有候选仍未达到未修改的内岸最小转弯半径比例。剩余问题已隔离为C1 Hermite切线曲率，而不是测量窗口、审核阈值、提示词或通道数据。",
    authorizedNextAction:
      "add_generic_shape_preserving_tangent_and_curvature_limiting_without_changing_review_thresholds",
  },
  sourceEvidence: {
    windowPlanPath: windowPlanPointer.runPath,
    windowPlanSha256: sha256File(windowPlanPointer.runPath),
    waterNaturalnessProfilePath: waterProfilePointer.profilePath,
    waterNaturalnessProfileSha256: sha256File(
      waterProfilePointer.profilePath,
    ),
    coarseHydrologyLibraryPath: COARSE_HYDROLOGY_LIBRARY_PATH,
    coarseHydrologyLibrarySha256AtFailure: sha256File(
      COARSE_HYDROLOGY_LIBRARY_PATH,
    ),
    waterNaturalnessLibraryPath:
      WATER_NATURALNESS_LIBRARY_PATH,
    waterNaturalnessLibrarySha256AtFailure: sha256File(
      WATER_NATURALNESS_LIBRARY_PATH,
    ),
    recorderPath: projectPath(import.meta.filename),
    recorderSha256: sha256File(import.meta.filename),
  },
  outputBoundary: {
    measurementWindowChanged: false,
    reviewThresholdChanged: false,
    conditionPackageBuilt: false,
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
  fileName: "regression-failure.json",
  record: report,
  latest: {
    status: report.status,
    slotId: SLOT_ID,
    candidateId: assignment.candidateId,
    failureCode: report.diagnosis.code,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);
const finishedAtUtc = new Date().toISOString();

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action: "v7_slot_123_support_transition_regression_failed",
  runId,
  kind: "no_rgb_regression",
  status: "failed",
  title:
    "The slot-123 support-transition regression failure was recorded",
  titleZh: "slot-123 支持度过渡回归失败已记录",
  detail:
    `rejectedCandidates=108; innerBankFailures=108; centerlinePassingCandidates=${report.regressionResult.candidatesPassingCenterlineNaturalness}; reportSha256=${reportSha256}; imageGenerationStarted=false`,
  detailZh:
    `被拒候选=108；内岸曲率失败=108；中心线通过候选=${report.regressionResult.candidatesPassingCenterlineNaturalness}；报告SHA-256=${reportSha256}；未启动图像生成。`,
  script: projectPath(import.meta.filename),
  currentStep: "support_transition_regression_failure_recorded",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    windowPlanPointer.runPath,
    waterProfilePointer.profilePath,
    COARSE_HYDROLOGY_LIBRARY_PATH,
    WATER_NATURALNESS_LIBRARY_PATH,
  ],
  errorCode: report.diagnosis.code,
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
      candidateCount: candidateFailures.length,
      candidatesPassingCenterlineNaturalness:
        report.regressionResult.candidatesPassingCenterlineNaturalness,
      candidatesPassingCorridorShape:
        report.regressionResult.candidatesPassingCorridorShape,
      naturalnessFailureCounts,
      corridorFailureCounts,
      imageGenerationStarted: false,
      rgbCreated: 0,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function parseCandidateFailures(message) {
  const marker =
    "coarse hydrology main-channel candidates failed unchanged water audits: ";
  return JSON.parse(message.slice(marker.length));
}

function countFailureCodes(candidates, field) {
  const counts = {};
  for (const candidate of candidates) {
    for (const code of candidate[field] ?? []) {
      counts[code] = (counts[code] ?? 0) + 1;
    }
  }
  return counts;
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

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
