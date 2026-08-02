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
  "project-owner-authorized-v7-capacity-slot-123-thai-dem-d8-coarse-main-channel-repair-20260728";
const START_ACTION =
  "v7_slot_123_coarse_hydrology_main_channel_repair_check_started";
const FAILURE_ACTION =
  "v7_slot_123_coarse_hydrology_main_channel_repair_check_failed";
const ERROR_MESSAGE =
  "coarse hydrology main-channel repair checks failed: reviewThresholdsModified";
const FAILURE_CODE =
  "negative_review_threshold_state_evaluated_as_positive_pass_flag";
const REPAIR_CHECK_PATH =
  "scripts/check-earth-geospatial-v7-slot-123-coarse-hydrology-main-channel-repair.mjs";
const COARSE_HYDROLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const TOPOLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-driven-anonymous-topology.mjs";
const GENERATOR_PATH =
  "scripts/build-earth-geospatial-complete-map-conditions.mjs";
const CHECKER_PATH =
  "scripts/check-earth-geospatial-complete-map-conditions.mjs";
const PREFLIGHT_PATH =
  "scripts/preflight-earth-geospatial-v7-slot-123-anonymous-seeds.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-coarse-hydrology-main-channel-repair-check-failures";

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
  "failed coarse-hydrology repair-check start event was not found",
);
assert(
  !terminalEvent,
  "coarse-hydrology repair check already has a terminal event",
);

const createdAtUtc = new Date().toISOString();
const recorderRunId =
  "earth-geospatial-v7-slot-123-coarse-hydrology-main-channel-repair-check-boolean-failure-record-" +
  createdAtUtc.replace(/[:.]/g, "-");
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-coarse-hydrology-main-channel-repair-check-boolean-failure-v1",
  runId: recorderRunId,
  status:
    "repair_check_failed_negative_review_threshold_state_treated_as_positive_pass_flag",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  authorizationId: AUTHORIZATION_ID,
  failedCheck: {
    runId: failedStartEvent.run_id,
    startEventId: failedStartEvent.event_id,
    startedAtUtc: failedStartEvent.timestamp_utc,
    errorMessage: ERROR_MESSAGE,
    processExitCode: 1,
    failedFields: ["reviewThresholdsModified"],
  },
  diagnosis: {
    code: FAILURE_CODE,
    algorithmFailure: false,
    dataFailure: false,
    reviewThresholdsActuallyModified: false,
    detail:
      "The repair check correctly recorded reviewThresholdsModified=false, but its generic pass collector requires every check entry to equal true. The hydrology profile, anonymous main channel, and unchanged production audits passed before this bookkeeping failure.",
    detailZh:
      "修复检查正确记录了 reviewThresholdsModified=false，但通用通过收集器要求每个检查项都等于 true。水文剖面、匿名主河和未改变的正式审核在此次记账错误前均已通过。",
    authorizedCorrection: [
      "rename reviewThresholdsModified to reviewThresholdsUnchanged",
      "set reviewThresholdsUnchanged=true",
      "do not change any production review threshold or hydrology algorithm",
      "rerun the no-RGB repair check",
    ],
  },
  sourceEvidence: {
    repairCheckPath: REPAIR_CHECK_PATH,
    repairCheckSha256AtFailure:
      sha256File(REPAIR_CHECK_PATH),
    coarseHydrologyLibraryPath:
      COARSE_HYDROLOGY_LIBRARY_PATH,
    coarseHydrologyLibrarySha256AtFailure: sha256File(
      COARSE_HYDROLOGY_LIBRARY_PATH,
    ),
    topologyLibraryPath: TOPOLOGY_LIBRARY_PATH,
    topologyLibrarySha256AtFailure:
      sha256File(TOPOLOGY_LIBRARY_PATH),
    generatorPath: GENERATOR_PATH,
    generatorSha256AtFailure: sha256File(GENERATOR_PATH),
    checkerPath: CHECKER_PATH,
    checkerSha256AtFailure: sha256File(CHECKER_PATH),
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
    failureCode: FAILURE_CODE,
    reviewThresholdsActuallyModified: false,
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
    "The slot-123 coarse-hydrology review-threshold boolean failure was recorded",
  titleZh:
    "slot-123 粗粒度水文审核阈值布尔语义失败已记录",
  detail:
    `failureCode=${FAILURE_CODE}; reviewThresholdsActuallyModified=false; failureRecordRunId=${recorderRunId}; reportSha256=${reportSha256}`,
  detailZh:
    `失败码=${FAILURE_CODE}；审核阈值实际修改=false；失败记录runId=${recorderRunId}；报告SHA-256=${reportSha256}`,
  script: projectPath(import.meta.filename),
  currentStep:
    "coarse_hydrology_review_threshold_boolean_failure_recorded",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    REPAIR_CHECK_PATH,
    COARSE_HYDROLOGY_LIBRARY_PATH,
    TOPOLOGY_LIBRARY_PATH,
    GENERATOR_PATH,
    CHECKER_PATH,
    PREFLIGHT_PATH,
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
      reviewThresholdsActuallyModified: false,
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
  if (!condition) throw new Error(message);
}
