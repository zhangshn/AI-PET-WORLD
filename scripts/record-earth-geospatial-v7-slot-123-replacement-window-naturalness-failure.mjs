import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";
import { catalogPath } from "./lib/ai-pet-world-storage.mjs";
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
const START_ACTION =
  "v7_slot_123_coarse_hydrology_main_channel_repair_check_started";
const FAILURE_ACTION =
  "v7_slot_123_coarse_hydrology_main_channel_repair_check_failed";
const FAILURE_CODE =
  "replacement_window_anonymous_main_channel_naturalness_gate_failed";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const REPAIR_CHECK_PATH =
  "scripts/check-earth-geospatial-v7-slot-123-coarse-hydrology-main-channel-repair.mjs";
const COARSE_HYDROLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const WATER_NATURALNESS_LIBRARY_PATH =
  "scripts/lib/anonymous-water-naturalness.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-replacement-window-naturalness-failures";

const database = new DatabaseSync(catalogPath);
const failedStartEvent = database
  .prepare(
    `SELECT event_id, timestamp_utc, action, run_id, status
     FROM program_events
     WHERE action = ?
     ORDER BY timestamp_utc DESC
     LIMIT 1`,
  )
  .get(START_ACTION);
const terminalEvent = failedStartEvent
  ? database
      .prepare(
        `SELECT event_id
         FROM program_events
         WHERE run_id = ? AND status IN ('success', 'failed', 'blocked')
         LIMIT 1`,
      )
      .get(failedStartEvent.run_id)
  : null;
database.close();
assert(
  failedStartEvent?.status === "running",
  "failed naturalness-check start event was not found",
);
assert(
  !terminalEvent,
  "the latest naturalness check already has a terminal event",
);

const windowPlanPointer = readJson(WINDOW_PLAN_POINTER_PATH);
const windowPlan = readJson(windowPlanPointer.runPath);
const assignment = windowPlan.assignments.find(
  (entry) => entry.slotId === SLOT_ID,
);
assert(
  assignment?.candidateId === EXPECTED_CANDIDATE_ID,
  "latest slot-123 replacement-window binding mismatch",
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
  "the recorded failure could not be reproduced from the current immutable inputs",
);
const candidateFailures = parseCandidateFailures(reproducedError);
assert(candidateFailures.length === 108, "candidate failure count mismatch");

const createdAtUtc = new Date().toISOString();
const recorderRunId =
  "earth-geospatial-v7-slot-123-replacement-window-naturalness-failure-record-" +
  createdAtUtc.replace(/[:.]/g, "-");
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-replacement-window-naturalness-failure-v1",
  runId: recorderRunId,
  status: "replacement_window_naturalness_check_failed_and_recorded",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  authorizationId: AUTHORIZATION_ID,
  slotId: SLOT_ID,
  failedCheck: {
    runId: failedStartEvent.run_id,
    startEventId: failedStartEvent.event_id,
    startedAtUtc: failedStartEvent.timestamp_utc,
    processExitCode: 1,
    errorCode: FAILURE_CODE,
    errorMessage: reproducedError,
    errorMessageSha256: sha256Text(reproducedError),
  },
  measurementBinding: {
    windowPlanRunId: windowPlan.runId,
    windowPlanPath: windowPlanPointer.runPath,
    windowPlanSha256: sha256File(windowPlanPointer.runPath),
    candidateId: assignment.candidateId,
    directFingerprint: assignment.fingerprints.direct,
    coarseHydrologyProfileSha256: coarseProfile.profileSha256,
  },
  failureSummary: {
    candidateCount: candidateFailures.length,
    naturalnessFailureCounts:
      countFailureCodes(candidateFailures, "naturalnessFailures"),
    corridorFailureCounts:
      countFailureCodes(candidateFailures, "corridorFailures"),
    minimumCandidateSinuosity: Math.min(
      ...candidateFailures.map((entry) => entry.sinuosity),
    ),
    maximumCandidateSinuosity: Math.max(
      ...candidateFailures.map((entry) => entry.sinuosity),
    ),
    allCandidatesRejectedBeforeConditionBuild: true,
  },
  candidateFailures,
  sourceEvidence: {
    waterNaturalnessProfilePath: waterProfilePointer.profilePath,
    waterNaturalnessProfileSha256: sha256File(
      waterProfilePointer.profilePath,
    ),
    repairCheckPath: REPAIR_CHECK_PATH,
    repairCheckSha256AtFailure: sha256File(REPAIR_CHECK_PATH),
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
  changesMadeByRecorder: {
    productionAlgorithmModified: false,
    measurementWindowChanged: false,
    reviewThresholdChanged: false,
    worldFactChanged: false,
    channelChanged: false,
    promptChanged: false,
  },
  outputBoundary: noComputeBoundary(),
  automaticStorage: true,
};
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: recorderRunId,
  fileName: "failure-record.json",
  record: report,
  latest: {
    failedCheckRunId: failedStartEvent.run_id,
    failureCode: FAILURE_CODE,
    candidateId: assignment.candidateId,
    candidateFailureCount: candidateFailures.length,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: FAILURE_ACTION,
  runId: failedStartEvent.run_id,
  kind: "repair_check_failure",
  status: "failed",
  title:
    "The slot-123 replacement-window water-naturalness failure was recorded",
  titleZh: "slot-123 替换窗口河道自然性失败已记录",
  detail:
    `failureCode=${FAILURE_CODE}; candidateId=${assignment.candidateId}; rejectedCandidates=${candidateFailures.length}; failureRecordRunId=${recorderRunId}; reportSha256=${reportSha256}; imageGenerationStarted=false`,
  detailZh:
    `失败码=${FAILURE_CODE}；窗口=${assignment.candidateId}；被拒候选=${candidateFailures.length}；失败记录runId=${recorderRunId}；报告SHA-256=${reportSha256}；未启动图像生成。`,
  script: projectPath(import.meta.filename),
  currentStep: "replacement_window_naturalness_failure_recorded",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    windowPlanPointer.runPath,
    waterProfilePointer.profilePath,
    REPAIR_CHECK_PATH,
    COARSE_HYDROLOGY_LIBRARY_PATH,
    WATER_NATURALNESS_LIBRARY_PATH,
  ],
  errorCode: FAILURE_CODE,
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      recorderRunId,
      failedCheckRunId: failedStartEvent.run_id,
      status: report.status,
      reportPath: stored.runPath,
      reportSha256,
      candidateId: assignment.candidateId,
      candidateFailureCount: candidateFailures.length,
      naturalnessFailureCounts:
        report.failureSummary.naturalnessFailureCounts,
      corridorFailureCounts:
        report.failureSummary.corridorFailureCounts,
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
  assert(message.startsWith(marker), "unexpected naturalness error message");
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
