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
const AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-record-shape-preserving-curvature-regression-failure-and-add-audit-driven-minimum-curvature-smoothing-20260728";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const LIBRARY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-shape-preserving-curvature-regression-failures";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-shape-preserving-curvature-regression-failure-" +
  createdAtUtc.replace(/[:.]/g, "-");
appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_123_shape_preserving_curvature_regression_started",
  runId,
  kind: "no_rgb_regression",
  status: "running",
  title:
    "The slot-123 shape-preserving curvature regression started",
  titleZh: "slot-123 形状保持曲率回归已启动",
  detail:
    "The program will reproduce the second no-RGB regression before the authorized audit-driven minimum-curvature smoothing repair.",
  detailZh:
    "程序将在已授权的审核驱动最小曲率平滑修复前复现第二次无RGB回归。",
  script: projectPath(import.meta.filename),
  currentStep: "shape_preserving_curvature_regression",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const pointer = readJson(WINDOW_PLAN_POINTER_PATH);
const plan = readJson(pointer.runPath);
const assignment = plan.assignments.find(
  (entry) => entry.slotId === SLOT_ID,
);
assert(
  assignment?.candidateId ===
    "sakaerat-measurement-window-r04-c04-v1",
  "slot-123 window binding mismatch",
);
const waterPointer = readJson(WATER_PROFILE_POINTER_PATH);
const waterProfile = readJson(waterPointer.profilePath);
const profile = buildMeasurementDerivedCoarseHydrologyProfile({
  assignment,
  root: ROOT,
});
const halfWidths = buildMeasurementDerivedNetworkHalfWidths({
  pointCount: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
  startHalfWidth: 76,
  endHalfWidth: 140,
  coarseHydrologyProfile: profile,
});
let errorMessage = null;
try {
  buildMeasurementDerivedAnonymousMainChannel({
    start: { x: 948, y: 0 },
    end: { x: 884, y: 768 },
    width: 1024,
    height: 768,
    coarseHydrologyProfile: profile,
    waterNaturalnessProfile: waterProfile,
    corridorHalfWidths: halfWidths,
  });
} catch (error) {
  errorMessage = error instanceof Error ? error.message : String(error);
}
assert(
  errorMessage?.startsWith(
    "coarse hydrology main-channel candidates failed unchanged water audits:",
  ),
  "second curvature regression failure was not reproduced",
);
const candidates = JSON.parse(
  errorMessage.slice(errorMessage.indexOf("[")),
);
assert(candidates.length === 108, "candidate count mismatch");
const naturalnessPassing = candidates.filter(
  (entry) => entry.naturalnessFailures.length === 0,
).length;
const corridorPassing = candidates.filter(
  (entry) => entry.corridorFailures.length === 0,
).length;
assert(
  corridorPassing === 0 &&
    candidates.every((entry) =>
      entry.corridorFailures.includes(
        "water_inner_bank_bend_radius_too_tight",
      ),
    ),
  "expected exhaustive inner-bank curvature failure is missing",
);

const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-shape-preserving-curvature-regression-failure-v1",
  runId,
  status:
    "shape_preserving_tangents_pass_centerline_but_not_inner_bank_curvature",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  authorizationId: AUTHORIZATION_ID,
  slotId: SLOT_ID,
  candidateId: assignment.candidateId,
  coarseHydrologyProfileSha256: profile.profileSha256,
  regressionResult: {
    candidateCount: candidates.length,
    naturalnessPassing,
    corridorPassing,
    innerBankCurvatureFailureCount: candidates.length,
    errorMessage,
    errorMessageSha256: sha256Text(errorMessage),
  },
  diagnosis: {
    code:
      "shape_preserving_tangents_still_leave_local_inner_bank_curvature_below_unchanged_gate",
    reviewThresholdFailure: false,
    detail:
      "Boundary fading and shape-preserving tangents removed centerline failures for nearly all candidates, but local discrete curvature still keeps every wide-river corridor below the unchanged 1.15 inner-bank radius ratio.",
    detailZh:
      "边界渐进衰减与形状保持切线已使几乎全部候选消除中心线失败，但局部离散曲率仍使所有宽河廊道低于未修改的1.15内岸半径比例。",
    authorizedNextAction:
      "apply_the_minimum_number_of_laplacian_centerline_smoothing_passes_and_reaudit_after_every_pass",
  },
  sourceEvidence: {
    windowPlanPath: pointer.runPath,
    windowPlanSha256: sha256File(pointer.runPath),
    waterProfilePath: waterPointer.profilePath,
    waterProfileSha256: sha256File(waterPointer.profilePath),
    libraryPath: LIBRARY_PATH,
    librarySha256AtFailure: sha256File(LIBRARY_PATH),
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
    failureCode: report.diagnosis.code,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);
const finishedAtUtc = new Date().toISOString();
appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action: "v7_slot_123_shape_preserving_curvature_regression_failed",
  runId,
  kind: "no_rgb_regression",
  status: "failed",
  title:
    "The slot-123 shape-preserving curvature regression failure was recorded",
  titleZh: "slot-123 形状保持曲率回归失败已记录",
  detail:
    `naturalnessPassing=${naturalnessPassing}; corridorPassing=${corridorPassing}; reportSha256=${reportSha256}; imageGenerationStarted=false`,
  detailZh:
    `中心线通过=${naturalnessPassing}；廊道通过=${corridorPassing}；报告SHA-256=${reportSha256}；未启动图像生成。`,
  script: projectPath(import.meta.filename),
  currentStep: "shape_preserving_curvature_regression_failure_recorded",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    pointer.runPath,
    waterPointer.profilePath,
    LIBRARY_PATH,
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
      candidateCount: candidates.length,
      naturalnessPassing,
      corridorPassing,
      imageGenerationStarted: false,
      rgbCreated: 0,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

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
