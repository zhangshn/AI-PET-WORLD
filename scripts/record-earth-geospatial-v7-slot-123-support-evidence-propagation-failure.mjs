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

const ROOT = process.cwd();
const AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-record-support-evidence-propagation-failure-and-forward-three-computed-arrays-20260728";
const START_ACTION =
  "v7_slot_123_coarse_hydrology_main_channel_repair_check_started";
const FAILURE_ACTION =
  "v7_slot_123_coarse_hydrology_main_channel_repair_check_failed";
const FAILURE_CODE =
  "selected_candidate_missing_computed_support_evidence_arrays";
const CHECK_PATH =
  "scripts/check-earth-geospatial-v7-slot-123-coarse-hydrology-main-channel-repair.mjs";
const LIBRARY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-support-evidence-propagation-failures";

const database = new DatabaseSync(catalogPath);
const startEvent = database
  .prepare(
    `SELECT event_id, timestamp_utc, run_id, status
     FROM program_events
     WHERE action = ?
     ORDER BY timestamp_utc DESC
     LIMIT 1`,
  )
  .get(START_ACTION);
const terminalEvent = startEvent
  ? database
      .prepare(
        `SELECT event_id FROM program_events
         WHERE run_id = ? AND status IN ('success', 'failed', 'blocked')
         LIMIT 1`,
      )
      .get(startEvent.run_id)
  : null;
database.close();
assert(
  startEvent?.status === "running" && !terminalEvent,
  "open failed formal-check event was not found",
);

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-support-evidence-propagation-failure-" +
  createdAtUtc.replace(/[:.]/g, "-");
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-support-evidence-propagation-failure-v1",
  runId,
  status: "support_evidence_propagation_failure_recorded",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  authorizationId: AUTHORIZATION_ID,
  failedCheck: {
    runId: startEvent.run_id,
    startEventId: startEvent.event_id,
    startedAtUtc: startEvent.timestamp_utc,
    errorCode: FAILURE_CODE,
    errorType: "TypeError",
    errorMessage:
      "Cannot read properties of undefined (reading 'slice')",
    failedExpression:
      "maximumAdjacentDelta(mainChannel.selection.supportTransitionLimiter.transitionLimitedSupportFractions)",
  },
  diagnosis: {
    geometryNumericalAuditPassedBeforeBookkeepingFailure: true,
    algorithmFailure: false,
    reviewThresholdFailure: false,
    missingFields: [
      "originalSupportFractions",
      "contrastRemappedSupportFractions",
      "transitionLimitedSupportFractions",
    ],
    authorizedCorrection:
      "forward_the_three_already_computed_arrays_from_the_spline_result_to_the_selected_candidate_evidence_object_only",
  },
  sourceEvidence: {
    checkPath: CHECK_PATH,
    checkSha256AtFailure: sha256File(CHECK_PATH),
    libraryPath: LIBRARY_PATH,
    librarySha256AtFailure: sha256File(LIBRARY_PATH),
    recorderPath: projectPath(import.meta.filename),
    recorderSha256: sha256File(import.meta.filename),
  },
  outputBoundary: {
    geometryChangedByRecorder: false,
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
  fileName: "failure-record.json",
  record: report,
  latest: {
    failedCheckRunId: startEvent.run_id,
    failureCode: FAILURE_CODE,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);
appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: FAILURE_ACTION,
  runId: startEvent.run_id,
  kind: "repair_check_failure",
  status: "failed",
  title:
    "The slot-123 support-evidence propagation failure was recorded",
  titleZh: "slot-123 支持度证据传递失败已记录",
  detail:
    `failureCode=${FAILURE_CODE}; reportSha256=${reportSha256}; geometryChanged=false; imageGenerationStarted=false`,
  detailZh:
    `失败码=${FAILURE_CODE}；报告SHA-256=${reportSha256}；未改变几何；未启动图像生成。`,
  script: projectPath(import.meta.filename),
  currentStep: "support_evidence_propagation_failure_recorded",
  evidencePath: stored.runPath,
  evidence: [stored.runPath, CHECK_PATH, LIBRARY_PATH],
  errorCode: FAILURE_CODE,
  finalGameMapSuccess: false,
  canEnterWorld: false,
});
console.log(
  JSON.stringify(
    {
      ok: true,
      runId,
      failedCheckRunId: startEvent.run_id,
      status: report.status,
      reportPath: stored.runPath,
      reportSha256,
      geometryChanged: false,
      imageGenerationStarted: false,
      rgbCreated: 0,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.resolve(ROOT, filePath)))
    .digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
