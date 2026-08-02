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
import {
  MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
  MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY,
} from "./lib/measurement-driven-anonymous-topology.mjs";

const ROOT = process.cwd();
const AUTHORIZATION_POINTER =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-anonymous-route-structure-repair-authorizations/latest.json";
const CONDITION_POINTER =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/latest.json";
const COMPOSITION_AUDIT_POINTER =
  ".runtime/ai-painter/ai-assisted-pre-rgb-condition-guide-novelty-audits/latest.json";
const CONNECTIVITY_CONTRACT_PATH =
  "data/world-samples/world-connectivity/world-connectivity-contract-v1.json";
const GENERATOR_PATH =
  "scripts/build-earth-geospatial-complete-map-conditions.mjs";
const TOPOLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-driven-anonymous-topology.mjs";
const ROUTE_LIBRARY_PATH =
  "scripts/lib/anonymous-route-naturalness.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-anonymous-route-structure-repair-checks";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-anonymous-route-structure-repair-check-" +
  createdAtUtc.replace(/[:.]/g, "-");
const authorizationPointer = readJson(AUTHORIZATION_POINTER);
const authorization = readJson(authorizationPointer.runPath);
const conditionPointer = readJson(CONDITION_POINTER);
const condition = readJson(conditionPointer.runPath);
const blueprint = readJson(condition.blueprintPath);
const compositionPointer = readJson(COMPOSITION_AUDIT_POINTER);
const compositionAudit = readJson(compositionPointer.runPath);
const novelty = blueprint.geometry.geometryNoveltyAudit;
const matched = compositionAudit.approvedMacroCompositionMatches?.[0];
const generatorSource = fs.readFileSync(GENERATOR_PATH, "utf8");

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_123_anonymous_route_structure_repair_check_started",
  runId,
  kind: "repair_check",
  status: "running",
  title:
    "Slot-123 measurement-driven anonymous route repair check started",
  titleZh: "slot-123 测量事实驱动匿名道路结构修复检查已启动",
  detail:
    "This no-RGB check separates the repaired route-skeleton result from the unchanged full historical water/route composition result.",
  detailZh:
    "本次无RGB检查分别核验已修复的道路骨架结果和保持原阈值的全历史水体/道路组合结果。",
  script: projectPath(import.meta.filename),
  currentStep: "route_structure_repair_check",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const checks = {
  exactOwnerAuthorizationBound:
    authorization.authorizationId ===
      "owner-authorized-slot-123-measurement-driven-anonymous-route-structure-repair-20260729" &&
    authorization.outputBoundary?.imageGenerationAuthorized === false &&
    authorization.outputBoundary?.gpuTrainingAuthorized === false,
  currentElevenByElevenAssignmentPreserved:
    authorization.currentMeasurementAssignment
      ?.authorizedGridSize === 11 &&
    authorization.currentMeasurementAssignment?.candidateId ===
      "sakaerat-measurement-window-r06-c11-v3",
  connectivityContractUnchanged:
    authorization.immutableContracts
      ?.worldConnectivityContractSha256 ===
    sha256File(CONNECTIVITY_CONTRACT_PATH),
  reviewThresholdsUnchanged:
    authorization.immutableContracts?.reviewThresholdsUnchanged ===
      true &&
    novelty.maximumAllowedRouteOccupancySimilarity === 0.92 &&
    compositionAudit.thresholds
      ?.approvedWaterLayoutDuplicateMinimumIoU === 0.75 &&
    compositionAudit.thresholds
      ?.approvedRouteLayoutDuplicateMinimumIoU === 0.65 &&
    compositionAudit.thresholds
      ?.strongCompositeSkeletonMinimumEqualityRatio === 0.985 &&
    generatorSource.includes(
      "const maximumAllowedRouteOccupancySimilarity = 0.92",
    ),
  measurementDrivenRouteMethodActive:
    blueprint.geometry.geometryDerivation?.methodId ===
      MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID &&
    blueprint.geometry.geometryDerivation?.routeTopologyFamily ===
      MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY &&
    blueprint.geometry.routeWaterAvoidanceAudit
      ?.quantizedHydrologyRoutePlan?.routeMacroProfile
      ?.fixedSharedSkeletonUsed === false &&
    blueprint.geometry.routeWaterAvoidanceAudit
      ?.quantizedHydrologyRoutePlan?.routeMacroProfile
      ?.slotIdentityRead === false &&
    blueprint.geometry.routeWaterAvoidanceAudit
      ?.quantizedHydrologyRoutePlan?.routeMacroProfile
      ?.historicalGeometryRead === false,
  sharedRouteSkeletonBlockerRemoved:
    novelty.status === "passed" &&
    novelty.sharedRouteSkeletonDetected === false &&
    novelty.exactTransformDuplicateFound === false &&
    novelty.mostSimilarPreviousSlot
      ?.maximumRouteOccupancySimilarity === 0.608696 &&
    novelty.mostSimilarPreviousSlot
      ?.maximumRouteOccupancySimilarity <
      novelty.maximumAllowedRouteOccupancySimilarity,
  completeNoRgbConditionPassed:
    condition.v7SlotId === "v7-capacity-slot-123" &&
    condition.channelCount === 23 &&
    condition.completeMapScopePassed === true &&
    condition.focalAreaNonZeroCount === 0 &&
    condition.outputBoundary?.imageGenerationStarted === false &&
    condition.outputBoundary?.gpuTrainingStarted === false &&
    condition.outputBoundary?.rgbCreated === false,
  unchangedFullCompositionGateStillBlocks:
    compositionAudit.status ===
      "blocked_before_rgb_approved_macro_composition_duplicate" &&
    compositionAudit.passed === false &&
    compositionAudit.evidenceBoundary?.historicalRgbRead === false &&
    compositionAudit.evidenceBoundary?.imageGenerationStarted ===
      false &&
    compositionAudit.evidenceBoundary?.gpuTrainingStarted === false &&
    matched?.recordId ===
      "ai-cold-start-v7-v7-capacity-slot-123-river-floodplain-v5" &&
    matched?.matchedTransform === "direct" &&
    matched?.strongCompositeSkeletonDuplicate === false &&
    matched?.topologyMetrics?.routeAndWaterTopologyDuplicate ===
      true &&
    matched?.candidateMacroTopology?.water?.side === "right" &&
    matched?.candidateMacroTopology?.route?.side === "left" &&
    matched?.historicalMacroTopology?.water?.side === "right" &&
    matched?.historicalMacroTopology?.route?.side === "left",
};
const failedChecks = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
assert(
  failedChecks.length === 0,
  `slot-123 anonymous route repair checks failed: ${failedChecks.join(", ")}`,
);

const finishedAtUtc = new Date().toISOString();
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-anonymous-route-structure-repair-check-v1",
  runId,
  status:
    "anonymous_route_structure_repair_passed_full_water_route_composition_still_blocked",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  authorization: {
    authorizationId: authorization.authorizationId,
    path: authorizationPointer.runPath,
    sha256: sha256File(authorizationPointer.runPath),
  },
  condition: {
    runId: condition.runId,
    conditionId: condition.conditionId,
    path: conditionPointer.runPath,
    sha256: sha256File(conditionPointer.runPath),
    channelCount: condition.channelCount,
    completeMapScopePassed: condition.completeMapScopePassed,
  },
  repairedRouteNovelty: {
    comparedSlotCount: novelty.comparedSlotCount,
    maximumAllowedRouteOccupancySimilarity:
      novelty.maximumAllowedRouteOccupancySimilarity,
    mostSimilarPreviousSlot:
      novelty.mostSimilarPreviousSlot,
    exactTransformDuplicateFound:
      novelty.exactTransformDuplicateFound,
    sharedRouteSkeletonDetected:
      novelty.sharedRouteSkeletonDetected,
  },
  remainingFullCompositionBlocker: {
    auditRunId: compositionAudit.runId,
    auditPath: compositionPointer.runPath,
    auditSha256: sha256File(compositionPointer.runPath),
    matchedRecordId: matched.recordId,
    matchedTransform: matched.matchedTransform,
    strongCompositeSkeletonDuplicate:
      matched.strongCompositeSkeletonDuplicate,
    waterLayoutIntersection:
      matched.waterLayoutIntersection,
    routeLayoutIntersection:
      matched.routeLayoutIntersection,
    routeCentroidNormalizedDistance:
      matched.routeCentroidNormalizedDistance,
    candidateWaterSide:
      matched.candidateMacroTopology.water.side,
    candidateRouteSide:
      matched.candidateMacroTopology.route.side,
    historicalWaterSide:
      matched.historicalMacroTopology.water.side,
    historicalRouteSide:
      matched.historicalMacroTopology.route.side,
    reason:
      "the_unchanged_right_vertical_water_system_plus_left_route_relation_matches_historical_v5_even_after_the_shared_route_skeleton_is_removed",
  },
  checks,
  failedChecks,
  programFiles: [
    artifactDescriptor(GENERATOR_PATH),
    artifactDescriptor(TOPOLOGY_LIBRARY_PATH),
    artifactDescriptor(ROUTE_LIBRARY_PATH),
  ],
  outputBoundary: {
    thirteenByThirteenExpansionStarted: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    runtimeFrameCreated: false,
    worldEntryStarted: false,
  },
  nextRequiredOwnerDecision:
    "authorize_or_reject_expanding_the_same_measurement_driven_structure_repair_from_route_only_to_the_internal_anonymous_river_network_while_connectivity_and_review_thresholds_remain_unchanged",
};

const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "repair-check-report.json",
  record: report,
  latest: {
    status: report.status,
    conditionRunId: condition.runId,
    conditionId: condition.conditionId,
    routeSkeletonGatePassed: true,
    fullCompositionGatePassed: false,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
indexFile(stored.runPath);
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action:
    "v7_slot_123_anonymous_route_structure_repair_check_completed",
  runId,
  kind: "repair_check",
  status: "success",
  title:
    "Slot-123 anonymous route repair passed; full water/route composition remains blocked",
  titleZh:
    "slot-123 匿名道路修复通过；完整水体/道路组合仍被生成前门禁阻断",
  detail:
    `routeSimilarity=0.608696<0.92; matchedFullComposition=${matched.recordId}; RGB=false; GPU=false; reportSha256=${reportSha256}`,
  detailZh:
    `道路相似度=0.608696<0.92；完整组合匹配=${matched.recordId}；RGB=false；GPU=false；报告SHA-256=${reportSha256}`,
  script: projectPath(import.meta.filename),
  currentStep:
    "route_repaired_full_composition_owner_decision_required",
  evidencePath: stored.runPath,
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
      routeSkeletonSimilarity: 0.608696,
      routeSkeletonThreshold: 0.92,
      fullCompositionMatchedRecordId: matched.recordId,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function artifactDescriptor(relativePath) {
  return {
    path: relativePath,
    sha256: sha256File(relativePath),
  };
}

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
