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
  "project-owner-authorized-v7-capacity-slot-123-read-only-minimum-curvature-location-diagnosis-20260728";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const HYDROLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const AUDIT_LIBRARY_PATH =
  "scripts/lib/anonymous-water-naturalness.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-minimum-curvature-location-diagnostics";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-minimum-curvature-location-diagnosis-" +
  createdAtUtc.replace(/[:.]/g, "-");
appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_123_minimum_curvature_location_diagnosis_started",
  runId,
  kind: "read_only_diagnosis",
  status: "running",
  title:
    "The slot-123 minimum-curvature location diagnosis started",
  titleZh: "slot-123 最小曲率位置只读诊断已启动",
  detail:
    "The program will record the exact failing point index, local half width, radius, and ratio for all 108 candidates without changing geometry or thresholds.",
  detailZh:
    "程序将记录108组候选的确切失败点索引、当地半宽、半径和比例，不改变几何或阈值。",
  script: projectPath(import.meta.filename),
  currentStep: "minimum_curvature_location_diagnosis",
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
  "slot-123 measurement-window binding mismatch",
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
  "minimum-curvature failure was not reproduced",
);
const candidates = JSON.parse(
  errorMessage.slice(errorMessage.indexOf("[")),
);
assert(candidates.length === 108, "candidate count mismatch");
assert(
  candidates.every(
    (entry) =>
      Number.isInteger(entry.minimumBendRadiusPointIndex) &&
      Number.isFinite(entry.minimumBendRadiusPixels) &&
      Number.isFinite(entry.minimumBendRadiusHalfWidthPixels) &&
      Number.isFinite(
        entry.minimumBendRadiusToHalfWidthRatio,
      ),
  ),
  "minimum-curvature diagnostic fields are incomplete",
);
const indexHistogram = histogram(
  candidates.map((entry) => entry.minimumBendRadiusPointIndex),
);
const globalMinimum = [...candidates].sort(
  (left, right) =>
    left.minimumBendRadiusToHalfWidthRatio -
      right.minimumBendRadiusToHalfWidthRatio ||
    left.minimumBendRadiusPointIndex -
      right.minimumBendRadiusPointIndex,
)[0];
const nearestToPassing = [...candidates].sort(
  (left, right) =>
    right.minimumBendRadiusToHalfWidthRatio -
      left.minimumBendRadiusToHalfWidthRatio ||
    left.minimumBendRadiusPointIndex -
      right.minimumBendRadiusPointIndex,
)[0];
const boundaryLocationCounts = {
  northBoundaryFirstTenPoints: candidates.filter(
    (entry) => entry.minimumBendRadiusPointIndex <= 10,
  ).length,
  interiorPoints: candidates.filter(
    (entry) =>
      entry.minimumBendRadiusPointIndex > 10 &&
      entry.minimumBendRadiusPointIndex <
        COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT - 11,
  ).length,
  southBoundaryLastTenPoints: candidates.filter(
    (entry) =>
      entry.minimumBendRadiusPointIndex >=
      COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT - 11,
  ).length,
};

const finishedAtUtc = new Date().toISOString();
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-minimum-curvature-location-diagnosis-v1",
  runId,
  status:
    "minimum_inner_bank_curvature_location_measured_without_geometry_change",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  authorizationId: AUTHORIZATION_ID,
  slotId: SLOT_ID,
  candidateId: assignment.candidateId,
  coarseHydrologyProfileSha256: profile.profileSha256,
  auditThreshold: {
    minimumBendRadiusToHalfWidthRatio: 1.15,
    changedByDiagnosis: false,
  },
  result: {
    candidateCount: candidates.length,
    smoothingPassesAppliedToEveryFailedCandidate:
      [...new Set(
        candidates.map(
          (entry) => entry.curvatureSmoothingPasses,
        ),
      )],
    indexHistogram,
    boundaryLocationCounts,
    globalMinimum,
    nearestToPassing,
    minimumObservedRatio: globalMinimum.minimumBendRadiusToHalfWidthRatio,
    maximumObservedRatio:
      nearestToPassing.minimumBendRadiusToHalfWidthRatio,
  },
  candidateDiagnostics: candidates,
  sourceEvidence: {
    windowPlanPath: pointer.runPath,
    windowPlanSha256: sha256File(pointer.runPath),
    waterProfilePath: waterPointer.profilePath,
    waterProfileSha256: sha256File(waterPointer.profilePath),
    hydrologyLibraryPath: HYDROLOGY_LIBRARY_PATH,
    hydrologyLibrarySha256: sha256File(HYDROLOGY_LIBRARY_PATH),
    auditLibraryPath: AUDIT_LIBRARY_PATH,
    auditLibrarySha256: sha256File(AUDIT_LIBRARY_PATH),
    diagnosticProgramPath: projectPath(import.meta.filename),
    diagnosticProgramSha256: sha256File(import.meta.filename),
  },
  changesMadeByDiagnosis: {
    geometryAlgorithmChanged: false,
    generatedCoordinatesChanged: false,
    measurementWindowChanged: false,
    reviewThresholdChanged: false,
    promptChanged: false,
    channelChanged: false,
  },
  outputBoundary: {
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
  fileName: "diagnosis-report.json",
  record: report,
  latest: {
    status: report.status,
    slotId: SLOT_ID,
    minimumObservedRatio: report.result.minimumObservedRatio,
    maximumObservedRatio: report.result.maximumObservedRatio,
    geometryAlgorithmChanged: false,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);
appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action: "v7_slot_123_minimum_curvature_location_diagnosis_completed",
  runId,
  kind: "read_only_diagnosis",
  status: "success",
  title:
    "The slot-123 minimum-curvature location diagnosis completed",
  titleZh: "slot-123 最小曲率位置只读诊断已完成",
  detail:
    `minimumRatio=${report.result.minimumObservedRatio}; maximumRatio=${report.result.maximumObservedRatio}; locationCounts=${JSON.stringify(boundaryLocationCounts)}; reportSha256=${reportSha256}; geometryAlgorithmChanged=false`,
  detailZh:
    `最小比例=${report.result.minimumObservedRatio}；最大比例=${report.result.maximumObservedRatio}；位置计数=${JSON.stringify(boundaryLocationCounts)}；报告SHA-256=${reportSha256}；未修改几何算法。`,
  script: projectPath(import.meta.filename),
  currentStep: "minimum_curvature_location_diagnosis_completed",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    pointer.runPath,
    waterPointer.profilePath,
    HYDROLOGY_LIBRARY_PATH,
    AUDIT_LIBRARY_PATH,
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
      candidateCount: candidates.length,
      smoothingPasses:
        report.result.smoothingPassesAppliedToEveryFailedCandidate,
      indexHistogram,
      boundaryLocationCounts,
      globalMinimum,
      nearestToPassing,
      geometryAlgorithmChanged: false,
      imageGenerationStarted: false,
      rgbCreated: 0,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function histogram(values) {
  const result = {};
  for (const value of values) {
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
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
  if (!condition) throw new Error(message);
}
