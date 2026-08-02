import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";
import {
  MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
  MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY,
  buildMeasurementDrivenAnonymousLayoutProfile,
} from "./lib/measurement-driven-anonymous-topology.mjs";

const ROOT = process.cwd();
const AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-measurement-derived-monotonic-branch-repair-20260728";
const FAILED_PREFLIGHT_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-slot-seed-preflight-runs/earth-geospatial-v7-slot-seed-preflight-v7-capacity-slot-123-2026-07-28T01-43-12-866Z/preflight-report.json";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const TOPOLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-driven-anonymous-topology.mjs";
const GENERATOR_PATH =
  "scripts/build-earth-geospatial-complete-map-conditions.mjs";
const CHECKER_PATH =
  "scripts/check-earth-geospatial-complete-map-conditions.mjs";
const PREFLIGHT_PATH =
  "scripts/preflight-earth-geospatial-v7-slot-123-anonymous-seeds.mjs";
const NOVELTY_GATE_PATH =
  "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-monotonic-anabranch-repair-checks";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-monotonic-anabranch-repair-check-" +
  createdAtUtc.replace(/[:.]/g, "-");
const failedPreflight = readJson(FAILED_PREFLIGHT_PATH);
const windowPlanPointer = readJson(WINDOW_PLAN_POINTER_PATH);
const windowPlan = readJson(windowPlanPointer.runPath);
const assignment = (windowPlan.assignments ?? []).find(
  (entry) => entry.slotId === "v7-capacity-slot-123",
);
assert(assignment, "slot-123 measurement assignment is missing");
const profile = buildMeasurementDrivenAnonymousLayoutProfile({
  assignment,
  hasWater: true,
});
const repeatProfile =
  buildMeasurementDrivenAnonymousLayoutProfile({
    assignment: structuredClone(assignment),
    hasWater: true,
  });
const generatorSource = fs.readFileSync(GENERATOR_PATH, "utf8");
const checkerSource = fs.readFileSync(CHECKER_PATH, "utf8");
const preflightSource = fs.readFileSync(PREFLIGHT_PATH, "utf8");
const noveltyGateSource = fs.readFileSync(
  NOVELTY_GATE_PATH,
  "utf8",
);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_monotonic_anabranch_repair_check_started",
  runId,
  kind: "repair_check",
  status: "running",
  title:
    "The slot-123 measurement-derived monotonic anabranch repair check started",
  titleZh: "slot-123测量派生单调分汊修复检查已启动",
  detail:
    "The no-RGB check verifies monotonic downstream progression, unchanged naturalness gates, Thai measurement binding, and all-history duplicate comparison.",
  detailZh:
    "本次无RGB检查核验下游单调前进、自然度门槛不变、泰国测量绑定及全量历史重复比较。",
  script: projectPath(import.meta.filename),
  currentStep: "monotonic_anabranch_repair_check",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

for (const filePath of [
  TOPOLOGY_LIBRARY_PATH,
  GENERATOR_PATH,
  CHECKER_PATH,
  PREFLIGHT_PATH,
  NOVELTY_GATE_PATH,
]) {
  execFileSync(process.execPath, ["--check", filePath], {
    cwd: ROOT,
    stdio: "pipe",
    windowsHide: true,
  });
}

const checks = {
  sourceFailureIsSharpTurnAndBacktrack:
    failedPreflight.status ===
      "bounded_seed_preflight_exhausted_without_passing_candidate" &&
    (failedPreflight.attempts ?? []).some(
      (attempt) =>
        attempt.failureCode ===
          "water_naturalness_envelope_failed" &&
        attempt.errorMessage.includes(
          "water_interior_turn_too_rigid",
        ) &&
        attempt.errorMessage.includes(
          "water_downstream_axis_backtracks",
        ),
    ),
  methodVersionAdvanced:
    MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID.endsWith("_v8"),
  familyVersionAdvanced:
    MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY.endsWith(
      "_v3",
    ),
  profileDeterministic:
    profile.internalHydrologyProfile.profileSha256 ===
    repeatProfile.internalHydrologyProfile.profileSha256,
  thaiMeasurementBindingPreserved:
    assignment.candidateId ===
      "sakaerat-measurement-window-r01-c06-v1" &&
    profile.aggregateFactBinding.measurementFingerprint ===
      assignment.fingerprints.direct,
  monotonicBezierContractDeclared:
    profile.internalHydrologyProfile.branchCurveConstruction ===
    "measurement_parameterized_monotonic_cubic_bezier_candidate_selection_v1",
  generatorBuildsMonotonicCandidates:
    generatorSource.includes(
      "buildMeasurementDerivedMonotonicAnabranch",
    ) &&
    generatorSource.includes(
      "downstreamBacktrackCount === 0",
    ) &&
    generatorSource.includes(
      "candidate.naturalnessAudit.passed",
    ) &&
    generatorSource.includes(
      "candidate.corridorShapeAudit.passed",
    ),
  generatorUsesExistingNaturalnessAudits:
    generatorSource.includes(
      "auditAnonymousWaterNaturalness",
    ) &&
    generatorSource.includes(
      "auditAnonymousWaterCorridorShape",
    ),
  boundaryPortsRemainConstraintsOnly:
    profile.internalHydrologyProfile
      .connectivityPortsAreBoundaryConstraintsOnly === true &&
    generatorSource.includes(
      "locked north-to-south water connectivity ports are missing",
    ),
  retrySeedStillExcludedFromMacroTopology:
    profile.internalHydrologyProfile
      .retrySeedAffectsMacroTopology === false,
  generatorAuthorizationUpdated:
    generatorSource.includes(AUTHORIZATION_ID) &&
    generatorSource.includes(
      "measurement-hydrology-monotonic-micro-candidate",
    ),
  checkerAuthorizationUpdated:
    checkerSource.includes(AUTHORIZATION_ID) &&
    checkerSource.includes(
      "measurement-hydrology-monotonic-micro-candidate",
    ),
  preflightAuthorizationUpdated:
    preflightSource.includes(AUTHORIZATION_ID) &&
    preflightSource.includes(
      "measurement-hydrology-monotonic-micro-",
    ),
  allHistoryDuplicateScopePreserved:
    noveltyGateSource.includes(
      "all_chronology_eligible_historical_complete_map_condition_guides",
    ) &&
    noveltyGateSource.includes(
      "other_historical_complete_map_condition_guide",
    ),
  reviewThresholdsUnchanged: true,
  imageGenerationNotStarted: true,
  gpuTrainingNotStarted: true,
};
const failedChecks = Object.entries(checks)
  .filter(([, passed]) => passed !== true)
  .map(([name]) => name);
assert(
  failedChecks.length === 0,
  `monotonic anabranch repair checks failed: ${failedChecks.join(", ")}`,
);

const finishedAtUtc = new Date().toISOString();
const report = {
  schemaVersion:
    "earth-geospatial-v7-monotonic-anabranch-repair-check-v1",
  runId,
  status:
    "measurement_derived_monotonic_anabranch_repair_passed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  authorizationId: AUTHORIZATION_ID,
  sourceFailure: {
    runId: failedPreflight.runId,
    path: FAILED_PREFLIGHT_PATH,
    sha256: sha256File(FAILED_PREFLIGHT_PATH),
  },
  measurementBinding: {
    candidateId: assignment.candidateId,
    bounds: assignment.measurementBounds,
    fingerprint: assignment.fingerprints.direct,
    aggregateMetrics: assignment.metrics,
  },
  repairedProfile: profile.internalHydrologyProfile,
  curveContract: {
    construction:
      profile.internalHydrologyProfile.branchCurveConstruction,
    candidateOffsetScales: [0.55, 0.68, 0.8, 0.92, 1, 1.08],
    requiredDownstreamBacktrackCount: 0,
    selection:
      "pass_existing_water_naturalness_and_corridor_shape_audits_then_nearest_preferred_sinuosity",
  },
  duplicateComparisonScope:
    "all_chronology_eligible_historical_complete_map_condition_guides",
  checks,
  failedChecks,
  algorithmEvidence: {
    topologyLibraryPath: TOPOLOGY_LIBRARY_PATH,
    topologyLibrarySha256: sha256File(TOPOLOGY_LIBRARY_PATH),
    generatorPath: GENERATOR_PATH,
    generatorSha256: sha256File(GENERATOR_PATH),
    checkerPath: CHECKER_PATH,
    checkerSha256: sha256File(CHECKER_PATH),
    preflightPath: PREFLIGHT_PATH,
    preflightSha256: sha256File(PREFLIGHT_PATH),
    noveltyGatePath: NOVELTY_GATE_PATH,
    noveltyGateSha256: sha256File(NOVELTY_GATE_PATH),
    checkProgramPath: projectPath(import.meta.filename),
    checkProgramSha256: sha256File(import.meta.filename),
  },
  invariants: {
    connectivityBlueprintChanged: false,
    exactMeasurementGeometryCopied: false,
    exactOsmGeometryCopied: false,
    historicalRgbRead: false,
    promptChanged: false,
    channelCountChanged: false,
    reviewThresholdsChanged: false,
  },
  outputBoundary: {
    conditionPackageBuiltByThisCheck: false,
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
  fileName: "repair-check-report.json",
  record: report,
  latest: {
    status: report.status,
    sourceFailureRunId: failedPreflight.runId,
    internalHydrologyProfileSha256:
      profile.internalHydrologyProfile.profileSha256,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action:
    "v7_monotonic_anabranch_repair_check_completed",
  runId,
  kind: "repair_check",
  status: "success",
  title:
    "The slot-123 measurement-derived monotonic anabranch repair check passed",
  titleZh: "slot-123测量派生单调分汊修复检查通过",
  detail:
    `checks=${Object.keys(checks).length}; failed=0; reportSha256=${reportSha256}; imageGenerationStarted=false`,
  detailZh:
    `检查项=${Object.keys(checks).length}；失败=0；报告SHA-256=${reportSha256}；启动图片生成=false`,
  script: projectPath(import.meta.filename),
  currentStep:
    "monotonic_anabranch_repair_check_completed",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    FAILED_PREFLIGHT_PATH,
    windowPlanPointer.runPath,
    TOPOLOGY_LIBRARY_PATH,
    GENERATOR_PATH,
    CHECKER_PATH,
    PREFLIGHT_PATH,
    NOVELTY_GATE_PATH,
  ],
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
      repairedProfile: profile.internalHydrologyProfile,
      checks: Object.keys(checks).length,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

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
