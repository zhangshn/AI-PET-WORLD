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
  "project-owner-authorized-v7-capacity-slot-123-measurement-derived-internal-hydrology-repair-20260728";
const FAILED_ACTION =
  "v7_measurement_derived_internal_hydrology_repair_check_started";
const FAILURE_ACTION =
  "v7_measurement_derived_internal_hydrology_repair_check_failed";
const ERROR_MESSAGE =
  "measurement-derived internal hydrology repair checks failed: reviewThresholdsModified, imageGenerationStarted, gpuTrainingStarted";
const REPAIR_CHECK_PATH =
  "scripts/check-earth-geospatial-v7-measurement-derived-internal-hydrology-repair.mjs";
const GENERATOR_PATH =
  "scripts/build-earth-geospatial-complete-map-conditions.mjs";
const CHECKER_PATH =
  "scripts/check-earth-geospatial-complete-map-conditions.mjs";
const TOPOLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-driven-anonymous-topology.mjs";
const PREFLIGHT_PATH =
  "scripts/preflight-earth-geospatial-v7-slot-123-anonymous-seeds.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-measurement-derived-internal-hydrology-repair-check-failures";

const database = new DatabaseSync(catalogPath);
const failedStartEvent = database
  .prepare(
    `SELECT event_id, timestamp_utc, action, run_id, status
     FROM program_events
     WHERE action = ?
     ORDER BY timestamp_utc DESC
     LIMIT 1`,
  )
  .get(FAILED_ACTION);
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
  "the failed internal-hydrology repair-check start event was not found",
);
assert(
  !terminalEvent,
  "the failed internal-hydrology repair check already has a terminal event",
);

const createdAtUtc = new Date().toISOString();
const recorderRunId =
  "earth-geospatial-v7-measurement-derived-internal-hydrology-repair-check-failure-record-" +
  createdAtUtc.replace(/[:.]/g, "-");
const report = {
  schemaVersion:
    "earth-geospatial-v7-measurement-derived-internal-hydrology-repair-check-failure-v1",
  runId: recorderRunId,
  status:
    "repair_check_failed_negative_safety_states_treated_as_positive_pass_flags",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  authorizationId: AUTHORIZATION_ID,
  failedCheck: {
    runId: failedStartEvent.run_id,
    startEventId: failedStartEvent.event_id,
    startedAtUtc: failedStartEvent.timestamp_utc,
    errorMessage: ERROR_MESSAGE,
    processExitCode: 1,
    failedFields: [
      "reviewThresholdsModified",
      "imageGenerationStarted",
      "gpuTrainingStarted",
    ],
  },
  diagnosis: {
    code:
      "negative_safety_state_keys_evaluated_as_positive_pass_flags",
    algorithmFailure: false,
    detail:
      "The repair check correctly stored three safety states as false, but its generic pass collector required every check value to equal true. The hydrology implementation was not executed by this failed check.",
    detailZh:
      "修复检查正确地把三个安全状态保存为false，但通用通过收集器错误地要求每个检查值都等于true。本次失败检查没有执行水文条件包重建。",
    authorizedCorrection: [
      "rename reviewThresholdsModified to reviewThresholdsUnchanged and set it to true",
      "rename imageGenerationStarted to imageGenerationNotStarted and set it to true",
      "rename gpuTrainingStarted to gpuTrainingNotStarted and set it to true",
      "assert that the pre-RGB novelty audit traverses the complete eligible historical composition-reference set",
    ],
  },
  sourceEvidence: {
    repairCheckPath: REPAIR_CHECK_PATH,
    repairCheckSha256AtFailure: sha256File(REPAIR_CHECK_PATH),
    generatorPath: GENERATOR_PATH,
    generatorSha256AtFailure: sha256File(GENERATOR_PATH),
    checkerPath: CHECKER_PATH,
    checkerSha256AtFailure: sha256File(CHECKER_PATH),
    topologyLibraryPath: TOPOLOGY_LIBRARY_PATH,
    topologyLibrarySha256AtFailure:
      sha256File(TOPOLOGY_LIBRARY_PATH),
    preflightPath: PREFLIGHT_PATH,
    preflightSha256AtFailure: sha256File(PREFLIGHT_PATH),
    recorderPath: projectPath(import.meta.filename),
    recorderSha256: sha256File(import.meta.filename),
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
  runId: recorderRunId,
  fileName: "failure-record.json",
  record: report,
  latest: {
    failedCheckRunId: failedStartEvent.run_id,
    failureCode: report.diagnosis.code,
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
    "The internal-hydrology repair check boolean-state failure was recorded",
  titleZh: "内部水文修复检查的布尔状态错误已记录",
  detail:
    `failureCode=${report.diagnosis.code}; failureRecordRunId=${recorderRunId}; reportSha256=${reportSha256}`,
  detailZh:
    `失败码=${report.diagnosis.code}；失败记录runId=${recorderRunId}；报告SHA-256=${reportSha256}`,
  script: projectPath(import.meta.filename),
  currentStep:
    "measurement_derived_internal_hydrology_repair_check_failure_recorded",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    REPAIR_CHECK_PATH,
    GENERATOR_PATH,
    CHECKER_PATH,
    TOPOLOGY_LIBRARY_PATH,
    PREFLIGHT_PATH,
  ],
  errorCode: report.diagnosis.code,
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
      imageGenerationStarted: false,
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
  if (!condition) {
    throw new Error(message);
  }
}
