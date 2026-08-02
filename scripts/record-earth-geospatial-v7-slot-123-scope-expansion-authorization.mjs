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
  "owner-authorized-slot-123-thai-measurement-scope-beyond-9x9-no-rgb-20260729";
const PRIOR_SELECTION_POINTER =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-all-history-window-selections/latest.json";
const PRIOR_OBSERVATION_EXTENT_PATH =
  "data/world-samples/earth-geospatial/regions/sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1/observation-extent.json";
const SOURCE_REGISTRY_PATH =
  "data/world-samples/earth-geospatial/source-registry/earth-geospatial-source-registry-v1.json";
const CONNECTIVITY_CONTRACT_PATH =
  "data/world-samples/world-connectivity/world-connectivity-contract-v1.json";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-scope-expansion-authorizations";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-scope-expansion-authorization-" +
  createdAtUtc.replace(/[:.]/g, "-");

const priorSelectionPointer = readJson(PRIOR_SELECTION_POINTER);
const priorSelection = readJson(priorSelectionPointer.runPath);
const priorExtent = readJson(PRIOR_OBSERVATION_EXTENT_PATH);
const sourceRegistry = readJson(SOURCE_REGISTRY_PATH);

assert(
  priorSelection.status ===
    "blocked_no_unused_real_measurement_window_ready_for_full_composition_audit" &&
    priorSelection.counts?.unusedWindowsRanked === 58 &&
    priorSelection.counts?.candidatesReadyForFullCompositionAudit === 0,
  "the documented 9x9 slot-123 exhaustion evidence is not current",
);
assert(
  priorExtent.derivation?.scopeGridSize === 9 ||
    priorExtent.extentId ===
      "sakaerat-wang-nam-khiao-owner-authorized-nine-by-nine-observation-envelope-v2",
  "the current observation extent is not the documented 9x9 envelope",
);

const requiredSourceIds = [
  "copernicus-dem-glo30-2021-n14e101",
  "esa-worldcover-2021-v200-n12e099",
  "nasa-power-climatology-sakaerat-point-v1",
  "isric-soilgrids-v2-0",
  "openstreetmap-overpass-engineered-feature-removal-v1",
];
const sourceIds = new Set(
  (sourceRegistry.sources ?? sourceRegistry.entries ?? []).map(
    (entry) => entry.sourceId,
  ),
);
for (const sourceId of requiredSourceIds) {
  assert(sourceIds.has(sourceId), `formal source is missing: ${sourceId}`);
}

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "record_slot_123_beyond_9x9_scope_authorization",
  runId,
  kind: "owner_authorization_recording_started",
  status: "running",
  title: "Slot-123 beyond-9x9 measurement authorization recording started",
  titleZh: "slot-123 超出9×9测量范围授权记录已启动",
  detail:
    "The program will record only the owner-authorized minimum next Thailand measurement ring for no-RGB condition screening. Connectivity, review thresholds, RGB, GPU, RuntimeFrame, and world entry remain unchanged or blocked.",
  detailZh:
    "程序只记录项目所有者授权的泰国测量最小下一圈，用于无RGB条件筛选；连接契约、审核阈值保持不变，RGB、GPU、RuntimeFrame和世界进入继续阻断。",
  script: projectPath(import.meta.filename),
  currentStep: "record_bounded_no_rgb_scope_authorization",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  evidencePath: priorSelectionPointer.runPath,
});

const authorization = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-scope-expansion-authorization-v1",
  runId,
  authorizationId: AUTHORIZATION_ID,
  ownerCommandRef:
    "project-owner-current-command-20260729-allow-same-thailand-source-beyond-9x9-no-rgb-first-passing-condition-only",
  reviewerRole: "project_owner",
  status: "owner_authorized_bounded_no_rgb_measurement_scope_expansion",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  slotId: "v7-capacity-slot-123",
  priorExhaustionEvidence: {
    runId: priorSelection.runId,
    path: priorSelectionPointer.runPath,
    sha256: sha256File(priorSelectionPointer.runPath),
    priorGridSize: 9,
    unusedWindowsAudited: priorSelection.counts.unusedWindowsRanked,
    passingConditions: 0,
  },
  scope: {
    sameFormalThailandDataSourceOnly: true,
    sourceRegistryPath: SOURCE_REGISTRY_PATH,
    sourceRegistrySha256: sha256File(SOURCE_REGISTRY_PATH),
    requiredSourceIds,
    minimumNextOuterRingOnly: true,
    priorGridSize: 9,
    authorizedGridSize: 11,
    conditionOnlyNoRgb: true,
    stopAfterFirstFullyPassingCondition: true,
    worldConnectivityContractUnchanged: true,
    reviewThresholdsUnchanged: true,
    historicalRgbGenerationReferenceAllowed: false,
    exactRealOrOsmGeometryCarryForwardAllowed: false,
  },
  immutableContracts: {
    worldConnectivityContractPath: CONNECTIVITY_CONTRACT_PATH,
    worldConnectivityContractSha256: sha256File(
      CONNECTIVITY_CONTRACT_PATH,
    ),
    priorObservationExtentPath: PRIOR_OBSERVATION_EXTENT_PATH,
    priorObservationExtentSha256: sha256File(
      PRIOR_OBSERVATION_EXTENT_PATH,
    ),
  },
  requiredGates: [
    "complete_map_scope",
    "direct_all_history_composition",
    "horizontal_mirror_all_history_composition",
    "vertical_mirror_all_history_composition",
    "rotate_180_all_history_composition",
    "shared_semantic_skeleton",
  ],
  outputBoundary: {
    imageGenerationAuthorized: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingAuthorized: false,
    gpuTrainingStarted: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  },
  nextRequiredAction:
    "compile_only_the_minimum_11x11_same_source_measurement_envelope_then_stop_after_the_first_full_pre_rgb_gate_pass_or_request_new_owner_direction",
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
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
  },
});
indexFile(immutable.runPath);

appendAiPainterProgramEvent({
  timestamp: new Date().toISOString(),
  action: "record_slot_123_beyond_9x9_scope_authorization",
  runId,
  kind: "owner_authorization_recorded",
  status: "success",
  title: "Slot-123 bounded beyond-9x9 measurement authorization recorded",
  titleZh: "slot-123 有界超出9×9测量授权已记录",
  detail:
    `authorizationId=${AUTHORIZATION_ID}; grid=11x11; sameThailandSources=true; RGB=false; GPU=false`,
  detailZh:
    `授权ID=${AUTHORIZATION_ID}；范围=11×11；同一泰国来源=true；RGB=false；GPU=false`,
  script: projectPath(import.meta.filename),
  currentStep: "bounded_no_rgb_scope_authorization_recorded",
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
