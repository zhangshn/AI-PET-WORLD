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
  "project-owner-authorized-v7-capacity-slot-123-record-diagnosis-parser-failure-and-fix-empty-array-token-20260728";
const START_ACTION =
  "v7_slot_123_replacement_window_naturalness_diagnosis_started";
const FAILURE_ACTION =
  "v7_slot_123_replacement_window_naturalness_diagnosis_failed";
const FAILURE_CODE =
  "diagnostic_array_parser_counted_trailing_empty_token_as_zero";
const ERROR_MESSAGE =
  "source-code candidate sweep does not match the saved failure record";
const DIAGNOSTIC_PATH =
  "scripts/diagnose-earth-geospatial-v7-slot-123-replacement-window-naturalness.mjs";
const PRODUCTION_LIBRARY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-replacement-window-naturalness-diagnosis-failures";

const database = new DatabaseSync(catalogPath);
const failedStartEvent = database
  .prepare(
    `SELECT event_id, timestamp_utc, run_id, status
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
  "failed diagnosis start event was not found",
);
assert(!terminalEvent, "latest diagnosis already has a terminal event");

const source = fs.readFileSync(
  path.join(ROOT, PRODUCTION_LIBRARY_PATH),
  "utf8",
);
const parserEvidence = {
  secondControlYRaw: extractRaw(
    source,
    "for (const secondControlYFraction of [",
    "])",
  ),
  directInfluenceRaw: extractRaw(
    source,
    "for (const directEightBandInfluence of [",
    "])",
  ),
};
parserEvidence.secondControlYTokens =
  parserEvidence.secondControlYRaw.split(",").map((entry) => entry.trim());
parserEvidence.directInfluenceTokens =
  parserEvidence.directInfluenceRaw.split(",").map((entry) => entry.trim());
assert(
  parserEvidence.secondControlYTokens.at(-1) === "" &&
    parserEvidence.directInfluenceTokens.at(-1) === "" &&
    Number("") === 0,
  "diagnostic trailing-empty-token failure was not reproduced",
);

const createdAtUtc = new Date().toISOString();
const recorderRunId =
  "earth-geospatial-v7-slot-123-replacement-window-naturalness-diagnosis-failure-record-" +
  createdAtUtc.replace(/[:.]/g, "-");
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-replacement-window-naturalness-diagnosis-failure-v1",
  runId: recorderRunId,
  status: "diagnostic_parser_failure_recorded",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  authorizationId: AUTHORIZATION_ID,
  failedDiagnosis: {
    runId: failedStartEvent.run_id,
    startEventId: failedStartEvent.event_id,
    startedAtUtc: failedStartEvent.timestamp_utc,
    processExitCode: 1,
    errorCode: FAILURE_CODE,
    errorMessage: ERROR_MESSAGE,
  },
  diagnosis: {
    code: FAILURE_CODE,
    productionAlgorithmFailure: false,
    measurementDataFailure: false,
    detail:
      "The read-only diagnostic parser split source arrays on commas, converted the trailing empty token with Number(''), and incorrectly added a zero-valued variant to two multiline arrays. The production candidate sweep and saved count of 108 are consistent.",
    detailZh:
      "只读诊断解析器按逗号切分源代码数组后，将末尾空字符串通过 Number('') 错误转换为数值0，导致两个多行数组各多出一个伪参数。生产候选扫描与已保存的108组数量本身一致。",
    parserEvidence,
    authorizedCorrection: [
      "filter empty trimmed tokens before numeric conversion",
      "modify only the read-only diagnostic program",
      "do not modify the production hydrology algorithm, window binding, review thresholds, conditions, prompts, or world facts",
    ],
  },
  sourceEvidence: {
    diagnosticPath: DIAGNOSTIC_PATH,
    diagnosticSha256AtFailure: sha256File(DIAGNOSTIC_PATH),
    productionLibraryPath: PRODUCTION_LIBRARY_PATH,
    productionLibrarySha256AtFailure: sha256File(
      PRODUCTION_LIBRARY_PATH,
    ),
    recorderPath: projectPath(import.meta.filename),
    recorderSha256: sha256File(import.meta.filename),
  },
  outputBoundary: {
    productionAlgorithmModified: false,
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
  runId: recorderRunId,
  fileName: "failure-record.json",
  record: report,
  latest: {
    failedDiagnosisRunId: failedStartEvent.run_id,
    failureCode: FAILURE_CODE,
    productionAlgorithmModified: false,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: FAILURE_ACTION,
  runId: failedStartEvent.run_id,
  kind: "diagnosis_failure",
  status: "failed",
  title:
    "The slot-123 read-only diagnosis parser failure was recorded",
  titleZh: "slot-123 只读诊断解析器失败已记录",
  detail:
    `failureCode=${FAILURE_CODE}; failureRecordRunId=${recorderRunId}; reportSha256=${reportSha256}; productionAlgorithmModified=false; imageGenerationStarted=false`,
  detailZh:
    `失败码=${FAILURE_CODE}；失败记录runId=${recorderRunId}；报告SHA-256=${reportSha256}；未修改生产算法；未启动图像生成。`,
  script: projectPath(import.meta.filename),
  currentStep: "diagnostic_parser_failure_recorded",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    DIAGNOSTIC_PATH,
    PRODUCTION_LIBRARY_PATH,
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
      failedDiagnosisRunId: failedStartEvent.run_id,
      status: report.status,
      reportPath: stored.runPath,
      reportSha256,
      failureCode: FAILURE_CODE,
      productionAlgorithmModified: false,
      imageGenerationStarted: false,
      rgbCreated: 0,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function extractRaw(sourceText, startMarker, endMarker) {
  const start = sourceText.indexOf(startMarker);
  assert(start >= 0, `source marker missing: ${startMarker}`);
  const valueStart = start + startMarker.length;
  const end = sourceText.indexOf(endMarker, valueStart);
  assert(end >= 0, `source marker end missing: ${startMarker}`);
  return sourceText.slice(valueStart, end);
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
