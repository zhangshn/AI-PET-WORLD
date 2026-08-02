import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";

const ROOT = process.cwd();
const AUTHORIZATION_ID =
  "owner-authorized-slot-123-measurement-driven-anonymous-route-structure-repair-20260729";
const FAILURE_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/earth-geospatial-v7-slot-condition-v7-capacity-slot-123-2026-07-28T20-13-29-558Z/failure.json";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const CONNECTIVITY_CONTRACT_PATH =
  "data/world-samples/world-connectivity/world-connectivity-contract-v1.json";
const GENERATOR_PATH =
  "scripts/build-earth-geospatial-complete-map-conditions.mjs";
const TOPOLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-driven-anonymous-topology.mjs";
const ROUTE_LIBRARY_PATH =
  "scripts/lib/anonymous-route-naturalness.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-anonymous-route-structure-repair-authorizations";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-anonymous-route-structure-repair-authorization-" +
  createdAtUtc.replace(/[:.]/g, "-");
const failure = readJson(FAILURE_PATH);
const planPointer = readJson(WINDOW_PLAN_POINTER_PATH);
const plan = readJson(planPointer.runPath);
const assignment = (plan.assignments ?? []).find(
  (entry) => entry.slotId === "v7-capacity-slot-123",
);

assert(
  failure.v7SlotId === "v7-capacity-slot-123" &&
    failure.error ===
      "V7 slot route skeleton is too similar to v7-capacity-slot-123: 1" &&
    failure.imageGenerationStarted === false &&
    failure.gpuTrainingStarted === false,
  "the documented shared-route-skeleton blocker is not current",
);
assert(
  planPointer.runId === plan.runId &&
    assignment?.candidateId ===
      "sakaerat-measurement-window-r06-c11-v3" &&
    assignment.imageGenerationAuthorized === false &&
    assignment.gpuTrainingAuthorized === false,
  "the authorized 11x11 slot-123 assignment is not current",
);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action:
    "record_slot_123_measurement_driven_anonymous_route_structure_repair_authorization",
  runId,
  kind: "owner_authorization_recording_started",
  status: "running",
  title:
    "Slot-123 measurement-driven anonymous route repair authorization recording started",
  titleZh: "slot-123 测量事实驱动匿名道路结构修复授权记录已启动",
  detail:
    "This authorization changes only the Thailand-measurement-to-anonymous-internal-route method. The south path port, world connectivity contract, review thresholds, 11x11 scope, and all no-RGB boundaries remain fixed.",
  detailZh:
    "本授权只修改“泰国测量事实到匿名内部道路”的生成方法；南侧道路连接口、世界连接契约、审核阈值、11×11范围和全部无RGB边界保持不变。",
  script: projectPath(import.meta.filename),
  currentStep: "record_bounded_no_rgb_route_method_repair",
  evidencePath: FAILURE_PATH,
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const authorization = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-anonymous-route-structure-repair-authorization-v1",
  runId,
  authorizationId: AUTHORIZATION_ID,
  ownerCommandRef:
    "project-owner-current-command-20260729-follow-recommended-anonymous-route-method-repair",
  reviewerRole: "project_owner",
  status:
    "owner_authorized_bounded_no_rgb_measurement_driven_anonymous_route_structure_repair",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  slotId: "v7-capacity-slot-123",
  blockerEvidence: {
    runId: failure.runId,
    path: FAILURE_PATH,
    sha256: sha256File(FAILURE_PATH),
    errorCode: failure.errorCode,
    error: failure.error,
    maximumRouteOccupancySimilarity: 1,
  },
  currentMeasurementAssignment: {
    planRunId: plan.runId,
    planPath: planPointer.runPath,
    planSha256: sha256File(planPointer.runPath),
    authorizedGridSize: 11,
    candidateId: assignment.candidateId,
    measurementFingerprint: assignment.fingerprints.direct,
  },
  authorizedChange: {
    statement:
      "Derive independent anonymous internal route macro-structure from the current Thailand measurement facts instead of a fixed shared skeleton.",
    generatorPath: GENERATOR_PATH,
    topologyLibraryPath: TOPOLOGY_LIBRARY_PATH,
    routeLibraryPath: ROUTE_LIBRARY_PATH,
    slotIdentityMayDriveMacroStructure: false,
    retrySeedMayDriveMacroStructure: false,
    historicalGeometryMayDriveMacroStructure: false,
    historicalRgbMayBeRead: false,
    exactRealOrOsmGeometryMayBeCarriedForward: false,
  },
  immutableContracts: {
    worldConnectivityContractPath: CONNECTIVITY_CONTRACT_PATH,
    worldConnectivityContractSha256: sha256File(
      CONNECTIVITY_CONTRACT_PATH,
    ),
    southPathPortUnchanged: true,
    reviewThresholdsUnchanged: true,
    completeMapScopeThresholdsUnchanged: true,
    routeNaturalnessEnvelopeUnchanged: true,
    transformAndSharedSkeletonThresholdsUnchanged: true,
    measurementScopeGridSizeUnchanged: 11,
  },
  requiredNoRgbRegressionGates: [
    "direct_all_history_composition",
    "horizontal_mirror_all_history_composition",
    "vertical_mirror_all_history_composition",
    "rotate_180_all_history_composition",
    "shared_route_skeleton",
    "shared_semantic_skeleton",
    "complete_map_scope",
  ],
  outputBoundary: {
    imageGenerationAuthorized: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingAuthorized: false,
    gpuTrainingStarted: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
    thirteenByThirteenExpansionAuthorized: false,
  },
  nextRequiredAction:
    "repair_and_regress_the_measurement_driven_anonymous_route_method_then_rescreen_only_the_current_11x11_slot_123_condition",
};

const immutable = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "authorization.json",
  record: authorization,
  latest: {
    authorizationId: AUTHORIZATION_ID,
    slotId: authorization.slotId,
    authorizedGridSize: 11,
    reviewThresholdsUnchanged: true,
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
  },
});
indexFile(immutable.runPath);

appendAiPainterProgramEvent({
  timestamp: new Date().toISOString(),
  action:
    "record_slot_123_measurement_driven_anonymous_route_structure_repair_authorization",
  runId,
  kind: "owner_authorization_recorded",
  status: "success",
  title:
    "Slot-123 measurement-driven anonymous route repair authorization recorded",
  titleZh: "slot-123 测量事实驱动匿名道路结构修复授权已记录",
  detail:
    `authorizationId=${AUTHORIZATION_ID}; grid=11x11; connectivityUnchanged=true; reviewThresholdsUnchanged=true; RGB=false; GPU=false`,
  detailZh:
    `授权ID=${AUTHORIZATION_ID}；范围=11×11；连接契约不变=true；审核阈值不变=true；RGB=false；GPU=false`,
  script: projectPath(import.meta.filename),
  currentStep: "bounded_no_rgb_route_method_repair_authorization_recorded",
  evidencePath: immutable.runPath,
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      runId,
      authorizationId: AUTHORIZATION_ID,
      authorizationPath: immutable.runPath,
      authorizationSha256: sha256File(immutable.runPath),
      authorizedGridSize: 11,
      reviewThresholdsUnchanged: true,
      imageGenerationAuthorized: false,
      gpuTrainingAuthorized: false,
    },
    null,
    2,
  ),
);

function indexFile(relativePath) {
  const absolutePath = path.resolve(ROOT, relativePath);
  const stats = fs.statSync(absolutePath);
  indexArtifact({
    logicalPath: logicalProjectPath(absolutePath),
    physicalUri: fs.realpathSync(absolutePath),
    storageLayer: "hot",
    runId,
    byteSize: stats.size,
    modifiedAtUtc: stats.mtime.toISOString(),
    sha256: sha256File(absolutePath),
  });
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
