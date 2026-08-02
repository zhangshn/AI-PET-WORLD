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
  buildMeasurementDrivenAnonymousLayoutProfile,
} from "./lib/measurement-driven-anonymous-topology.mjs";

const ROOT = process.cwd();
const OWNER_AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-measurement-driven-topology-repair-20260728";
const ERROR_MESSAGE =
  "measurement-driven topology repair checks failed: slot122And123RouteTopologiesDiffer";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-measurement-topology-repair-check-failures";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const GENERATOR_PATH =
  "scripts/build-earth-geospatial-complete-map-conditions.mjs";
const CHECKER_PATH =
  "scripts/check-earth-geospatial-complete-map-conditions.mjs";
const TOPOLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-driven-anonymous-topology.mjs";
const REPAIR_CHECK_PATH =
  "scripts/check-earth-geospatial-v7-measurement-driven-topology-repair.mjs";

const database = new DatabaseSync(catalogPath);
const failedStartEvent = database
  .prepare(
    `SELECT event_id, timestamp_utc, action, run_id, status, evidence_path
     FROM program_events
     WHERE action = ?
     ORDER BY timestamp_utc DESC
     LIMIT 1`,
  )
  .get("v7_measurement_driven_topology_repair_check_started");
database.close();
assert(
  failedStartEvent?.status === "running",
  "the failed repair-check start event was not found",
);

const windowPlanPointer = readJson(WINDOW_PLAN_POINTER_PATH);
const windowPlan = readJson(windowPlanPointer.runPath);
const slot122Profile = profileFor(windowPlan, "v7-capacity-slot-122");
const slot123Profile = profileFor(windowPlan, "v7-capacity-slot-123");
assert(
  slot122Profile.routeTopology === slot123Profile.routeTopology,
  "the expected route-topology collision is no longer reproducible",
);

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-measurement-topology-repair-check-failure-record-" +
  createdAtUtc.replace(/[:.]/g, "-");
const report = {
  schemaVersion:
    "earth-geospatial-v7-measurement-topology-repair-check-failure-v1",
  runId,
  status: "repair_check_failed_route_topology_digest_collision",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ownerAuthorizationId: OWNER_AUTHORIZATION_ID,
  failedCheck: {
    runId: failedStartEvent.run_id,
    startEventId: failedStartEvent.event_id,
    startedAtUtc: failedStartEvent.timestamp_utc,
    errorMessage: ERROR_MESSAGE,
    processExitCode: 1,
  },
  reproducedEvidence: {
    slot122: summarizeProfile(slot122Profile),
    slot123: summarizeProfile(slot123Profile),
    collidingSelectionByte:
      slot123Profile.topologySelection.routeTopologySelectionByte,
    collidingRouteTopology: slot123Profile.routeTopology,
  },
  diagnosis: {
    code: "measurement_digest_route_selection_byte_collision",
    detail:
      "The measurement-driven digest was valid and the water-control profiles differed, but the selected digest byte mapped both adjacent measurement windows to the same route-topology family.",
    detailZh:
      "测量事实摘要有效且水体控制档案不同，但当前选取的摘要字节把两个相邻测量窗口映射到了同一道路拓扑族。",
    nextAction:
      "Use a different fixed byte from the same measurement-fact digest that maps slot-122 and slot-123 to different route families; retry seeds must remain excluded from macro topology.",
    nextActionZh:
      "改用同一测量事实摘要中的另一个固定字节，使slot-122与slot-123映射到不同道路族；重试种子仍不得参与宏观拓扑。",
  },
  sourceEvidence: {
    generatorPath: GENERATOR_PATH,
    generatorSha256AtFailure: sha256File(GENERATOR_PATH),
    checkerPath: CHECKER_PATH,
    checkerSha256AtFailure: sha256File(CHECKER_PATH),
    topologyLibraryPath: TOPOLOGY_LIBRARY_PATH,
    topologyLibrarySha256AtFailure:
      sha256File(TOPOLOGY_LIBRARY_PATH),
    repairCheckPath: REPAIR_CHECK_PATH,
    repairCheckSha256AtFailure: sha256File(REPAIR_CHECK_PATH),
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
    failedCheckRunId: failedStartEvent.run_id,
    failureCode: report.diagnosis.code,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action:
    "v7_measurement_driven_topology_repair_check_failure_recorded",
  runId,
  kind: "repair_check_failure",
  status: "failed",
  title:
    "The measurement-digest route-topology collision failure was recorded",
  titleZh: "测量摘要道路拓扑碰撞失败已记录",
  detail:
    `failedCheckRunId=${failedStartEvent.run_id}; failureCode=${report.diagnosis.code}; reportSha256=${reportSha256}`,
  detailZh:
    `失败检查runId=${failedStartEvent.run_id}；失败码=${report.diagnosis.code}；报告SHA-256=${reportSha256}`,
  script: projectPath(import.meta.filename),
  currentStep: "measurement_topology_repair_check_failure_recorded",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    windowPlanPointer.runPath,
    GENERATOR_PATH,
    CHECKER_PATH,
    TOPOLOGY_LIBRARY_PATH,
    REPAIR_CHECK_PATH,
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
      failedCheckRunId: failedStartEvent.run_id,
      reportPath: stored.runPath,
      reportSha256,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function profileFor(plan, slotId) {
  const assignment = (plan.assignments ?? []).find(
    (entry) => entry.slotId === slotId,
  );
  assert(assignment, `measurement assignment is missing: ${slotId}`);
  return buildMeasurementDrivenAnonymousLayoutProfile({
    assignment,
    hasWater: true,
  });
}

function summarizeProfile(profile) {
  return {
    measurementTopologyFingerprint:
      profile.topologySelection.measurementTopologyFingerprint,
    routeTopologySelectionByte:
      profile.topologySelection.routeTopologySelectionByte,
    routeTopology: profile.routeTopology,
    waterControlProfileIndex: profile.waterControlProfileIndex,
    profileSha256: profile.profileSha256,
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
