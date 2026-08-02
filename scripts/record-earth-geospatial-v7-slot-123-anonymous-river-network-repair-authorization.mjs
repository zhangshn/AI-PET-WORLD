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
  "owner-authorized-slot-123-measurement-driven-anonymous-river-network-repair-20260729";
const ROUTE_REPAIR_POINTER =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-anonymous-route-structure-repair-checks/latest.json";
const COMPOSITION_AUDIT_POINTER =
  ".runtime/ai-painter/ai-assisted-pre-rgb-condition-guide-novelty-audits/latest.json";
const CONNECTIVITY_CONTRACT_PATH =
  "data/world-samples/world-connectivity/world-connectivity-contract-v1.json";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-anonymous-river-network-repair-authorizations";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-anonymous-river-network-repair-authorization-" +
  createdAtUtc.replace(/[:.]/g, "-");
const routeRepairPointer = readJson(ROUTE_REPAIR_POINTER);
const routeRepair = readJson(routeRepairPointer.runPath);
const compositionPointer = readJson(COMPOSITION_AUDIT_POINTER);
const compositionAudit = readJson(compositionPointer.runPath);

assert(
  routeRepair.status ===
    "anonymous_route_structure_repair_passed_full_water_route_composition_still_blocked" &&
    routeRepair.repairedRouteNovelty?.sharedRouteSkeletonDetected ===
      false &&
    routeRepair.outputBoundary?.imageGenerationStarted === false &&
    routeRepair.outputBoundary?.gpuTrainingStarted === false,
  "the documented route-only repair result is not current",
);
assert(
  compositionAudit.status ===
    "blocked_before_rgb_approved_macro_composition_duplicate" &&
    compositionAudit.approvedMacroCompositionMatches?.[0]
      ?.recordId ===
      "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v5",
  "the documented full water/route composition blocker is not current",
);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action:
    "record_slot_123_measurement_driven_anonymous_river_network_repair_authorization",
  runId,
  kind: "owner_authorization_recording_started",
  status: "running",
  title:
    "Slot-123 measurement-driven anonymous river-network repair authorization recording started",
  titleZh: "slot-123 测量事实驱动匿名内部河网修复授权记录已启动",
  detail:
    "The owner authorized extending the current route-only repair to the anonymous internal river network while keeping the 11x11 Thailand scope, connectivity contract, ports, and review thresholds unchanged.",
  detailZh:
    "项目所有者已授权把当前只修复道路的范围扩展到匿名内部河网；11×11泰国范围、连接契约、端口和审核阈值全部保持不变。",
  script: projectPath(import.meta.filename),
  currentStep: "record_bounded_no_rgb_river_network_repair",
  evidencePath: compositionPointer.runPath,
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const authorization = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-anonymous-river-network-repair-authorization-v1",
  runId,
  authorizationId: AUTHORIZATION_ID,
  ownerCommandRef:
    "project-owner-current-command-20260729-allow-expand-route-only-repair-to-anonymous-internal-river-network",
  reviewerRole: "project_owner",
  status:
    "owner_authorized_bounded_no_rgb_measurement_driven_anonymous_river_network_repair",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  slotId: "v7-capacity-slot-123",
  priorRouteRepairEvidence: {
    runId: routeRepair.runId,
    path: routeRepairPointer.runPath,
    sha256: sha256File(routeRepairPointer.runPath),
    routeSkeletonGatePassed: true,
    fullCompositionGatePassed: false,
  },
  currentCompositionBlocker: {
    runId: compositionAudit.runId,
    path: compositionPointer.runPath,
    sha256: sha256File(compositionPointer.runPath),
    matchedRecordId:
      compositionAudit.approvedMacroCompositionMatches[0].recordId,
    candidateWaterSide:
      compositionAudit.approvedMacroCompositionMatches[0]
        .candidateMacroTopology.water.side,
    candidateRouteSide:
      compositionAudit.approvedMacroCompositionMatches[0]
        .candidateMacroTopology.route.side,
  },
  authorizedChange: {
    statement:
      "Continuously derive an independent anonymous internal river-network macro-structure from the current Thailand measurement facts without reading historical geometry or RGB.",
    targetLibraryPath:
      "scripts/lib/measurement-derived-coarse-hydrology.mjs",
    routeMethodMayRemainAtCurrentPassedV20: true,
    slotIdentityMayDriveMacroStructure: false,
    retrySeedMayDriveMacroStructure: false,
    historicalGeometryMayDriveMacroStructure: false,
    historicalRgbMayBeRead: false,
    exactD8OrOsmGeometryMayBeCarriedForward: false,
  },
  immutableContracts: {
    measurementScopeGridSize: 11,
    worldConnectivityContractPath: CONNECTIVITY_CONTRACT_PATH,
    worldConnectivityContractSha256: sha256File(
      CONNECTIVITY_CONTRACT_PATH,
    ),
    northWaterInletUnchanged: true,
    southWaterOutletUnchanged: true,
    eastSharedWaterBoundaryUnchanged: true,
    southPathPortUnchanged: true,
    reviewThresholdsUnchanged: true,
    completeMapScopeThresholdsUnchanged: true,
    waterNaturalnessThresholdsUnchanged: true,
    transformAndSharedSkeletonThresholdsUnchanged: true,
  },
  requiredNoRgbRegressionGates: [
    "water_naturalness",
    "water_corridor_shape",
    "complete_map_scope",
    "direct_all_history_composition",
    "horizontal_mirror_all_history_composition",
    "vertical_mirror_all_history_composition",
    "rotate_180_all_history_composition",
    "shared_route_skeleton",
    "shared_semantic_skeleton",
  ],
  outputBoundary: {
    thirteenByThirteenExpansionAuthorized: false,
    imageGenerationAuthorized: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingAuthorized: false,
    gpuTrainingStarted: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  },
  nextRequiredAction:
    "repair_and_regress_the_measurement_driven_anonymous_internal_river_network_then_rescreen_only_the_current_11x11_slot_123_condition",
};

const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "authorization.json",
  record: authorization,
  latest: {
    authorizationId: AUTHORIZATION_ID,
    slotId: authorization.slotId,
    measurementScopeGridSize: 11,
    reviewThresholdsUnchanged: true,
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
  },
});
indexFile(stored.runPath);
const authorizationSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: new Date().toISOString(),
  action:
    "record_slot_123_measurement_driven_anonymous_river_network_repair_authorization",
  runId,
  kind: "owner_authorization_recorded",
  status: "success",
  title:
    "Slot-123 measurement-driven anonymous river-network repair authorization recorded",
  titleZh: "slot-123 测量事实驱动匿名内部河网修复授权已记录",
  detail:
    `authorizationId=${AUTHORIZATION_ID}; grid=11x11; portsUnchanged=true; reviewThresholdsUnchanged=true; RGB=false; GPU=false`,
  detailZh:
    `授权ID=${AUTHORIZATION_ID}；范围=11×11；端口不变=true；审核阈值不变=true；RGB=false；GPU=false`,
  script: projectPath(import.meta.filename),
  currentStep:
    "bounded_no_rgb_river_network_repair_authorization_recorded",
  evidencePath: stored.runPath,
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      runId,
      authorizationId: AUTHORIZATION_ID,
      authorizationPath: stored.runPath,
      authorizationSha256,
      measurementScopeGridSize: 11,
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
