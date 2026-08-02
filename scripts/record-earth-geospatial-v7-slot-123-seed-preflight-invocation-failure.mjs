import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";

const ROOT = process.cwd();
const SLOT_ID = "v7-capacity-slot-123";
const AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-thai-dem-d8-coarse-main-channel-repair-20260728";
const FAILURE_CODE =
  "slot_123_seed_preflight_invocation_missing_required_slot_argument";
const ERROR_MESSAGE =
  "preflight is restricted to v7-capacity-slot-123";
const PREFLIGHT_PATH =
  "scripts/preflight-earth-geospatial-v7-slot-123-anonymous-seeds.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-seed-preflight-invocation-failures";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-seed-preflight-invocation-failure-" +
  createdAtUtc.replace(/[:.]/g, "-");
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-seed-preflight-invocation-failure-v1",
  runId,
  status: "seed_preflight_invocation_failed_before_run_initialization",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  authorizationId: AUTHORIZATION_ID,
  slotId: SLOT_ID,
  failure: {
    code: FAILURE_CODE,
    errorName: "Error",
    errorMessage: ERROR_MESSAGE,
    processExitCode: 1,
    failedInvocation:
      "node scripts/preflight-earth-geospatial-v7-slot-123-anonymous-seeds.mjs",
    missingRequiredArguments: [
      "--v7-slot-id v7-capacity-slot-123",
      `--owner-authorization-id ${AUTHORIZATION_ID}`,
    ],
    parserChanged: false,
    algorithmFailure: false,
    dataFailure: false,
  },
  correctionBoundary: {
    useSpaceSeparatedArguments: true,
    parserModificationAuthorized: false,
    algorithmModificationAuthorized: false,
    rerunOnlyCurrentSlot: true,
  },
  sourceEvidence: {
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
  runId,
  fileName: "failure-record.json",
  record: report,
  latest: {
    status: report.status,
    slotId: SLOT_ID,
    failureCode: FAILURE_CODE,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_123_seed_preflight_invocation_failed",
  runId,
  kind: "bounded_seed_preflight_invocation_failure",
  status: "failed",
  title:
    "The slot-123 no-RGB seed preflight invocation failure was recorded",
  titleZh: "slot-123 无RGB种子预检调用失败已记录",
  detail:
    `failureCode=${FAILURE_CODE}; missingArgument=--v7-slot-id; reportSha256=${reportSha256}`,
  detailZh:
    `失败代码=${FAILURE_CODE}；缺少参数=--v7-slot-id；报告SHA-256=${reportSha256}`,
  script: projectPath(import.meta.filename),
  currentStep:
    "slot_123_seed_preflight_invocation_failure_recorded",
  evidencePath: stored.runPath,
  evidence: [stored.runPath, PREFLIGHT_PATH],
  errorCode: FAILURE_CODE,
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
