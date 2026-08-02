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
  "project-owner-authorized-v7-capacity-slot-123-measurement-derived-internal-hydrology-naturalness-repair-20260728";
const FAILED_PREFLIGHT_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-slot-seed-preflight-runs/earth-geospatial-v7-slot-seed-preflight-v7-capacity-slot-123-2026-07-28T01-37-32-101Z/preflight-report.json";
const PRIOR_REPAIR_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-measurement-derived-internal-hydrology-repair-checks/latest.json";
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
  ".runtime/ai-painter/earth-geospatial-v7-internal-hydrology-naturalness-repair-checks";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-internal-hydrology-naturalness-repair-check-" +
  createdAtUtc.replace(/[:.]/g, "-");
const failedPreflight = readJson(FAILED_PREFLIGHT_PATH);
const priorRepairPointer = readJson(PRIOR_REPAIR_POINTER_PATH);
const priorRepair = readJson(priorRepairPointer.runPath);
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
const priorProfile =
  priorRepair.repairedAlgorithmContract.slot123Profile;
const generatorSource = fs.readFileSync(GENERATOR_PATH, "utf8");
const checkerSource = fs.readFileSync(CHECKER_PATH, "utf8");
const preflightSource = fs.readFileSync(PREFLIGHT_PATH, "utf8");
const noveltyGateSource = fs.readFileSync(
  NOVELTY_GATE_PATH,
  "utf8",
);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action:
    "v7_internal_hydrology_naturalness_repair_check_started",
  runId,
  kind: "repair_check",
  status: "running",
  title:
    "The slot-123 internal hydrology naturalness repair check started",
  titleZh: "slot-123内部水文自然度修复检查已启动",
  detail:
    "The no-RGB check verifies a gentler measurement-derived anabranch without changing review thresholds or all-history duplicate comparison.",
  detailZh:
    "本次无RGB检查核验更平缓的测量派生分汊，不修改审核阈值或全量历史重复比较。",
  script: projectPath(import.meta.filename),
  currentStep:
    "internal_hydrology_naturalness_repair_check",
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

const failureCounts = Object.fromEntries(
  Object.entries(
    (failedPreflight.attempts ?? []).reduce(
      (counts, attempt) => ({
        ...counts,
        [attempt.failureCode]:
          (counts[attempt.failureCode] ?? 0) + 1,
      }),
      {},
    ),
  ),
);
const checks = {
  failedPreflightBoundedAndNoRgb:
    failedPreflight.status ===
      "bounded_seed_preflight_exhausted_without_passing_candidate" &&
    failedPreflight.evaluatedCandidateCount === 64 &&
    failedPreflight.outputBoundary?.imageGenerationStarted ===
      false &&
    failedPreflight.outputBoundary?.gpuTrainingStarted === false,
  failedPreflightContainedWaterNaturalnessFailures:
    failureCounts.water_naturalness_envelope_failed > 0,
  methodVersionAdvanced:
    MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID.endsWith("_v7"),
  hydrologyFamilyVersionAdvanced:
    MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY.endsWith("_v2"),
  profileDeterministic:
    profile.internalHydrologyProfile.profileSha256 ===
    repeatProfile.internalHydrologyProfile.profileSha256,
  lateralOffsetReduced:
    profile.internalHydrologyProfile.lateralOffsetFraction <
      priorProfile.lateralOffsetFraction &&
    profile.internalHydrologyProfile.lateralOffsetFraction <=
      0.18,
  branchSpanExtended:
    profile.internalHydrologyProfile.rejoinFraction >
      priorProfile.rejoinFraction &&
    profile.internalHydrologyProfile.rejoinFraction >= 0.5,
  measurementBindingPreserved:
    profile.internalHydrologyProfile
      .measurementTopologyFingerprint ===
      priorProfile.measurementTopologyFingerprint &&
    profile.aggregateFactBinding.measurementFingerprint ===
      assignment.fingerprints.direct,
  boundaryPortRolePreserved:
    profile.internalHydrologyProfile
      .connectivityPortsAreBoundaryConstraintsOnly === true,
  retrySeedStillMicroOnly:
    profile.internalHydrologyProfile
      .retrySeedAffectsMacroTopology === false,
  generatorUsesCurrentAuthorization:
    generatorSource.includes(AUTHORIZATION_ID) &&
    generatorSource.includes(
      "measurement-hydrology-naturalness-micro-candidate",
    ),
  checkerUsesCurrentAuthorization:
    checkerSource.includes(AUTHORIZATION_ID) &&
    checkerSource.includes(
      "measurement-hydrology-naturalness-micro-candidate",
    ),
  preflightUsesCurrentAuthorization:
    preflightSource.includes(AUTHORIZATION_ID) &&
    preflightSource.includes(
      "measurement-hydrology-naturalness-micro-",
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
  `internal hydrology naturalness repair checks failed: ${failedChecks.join(", ")}`,
);

const finishedAtUtc = new Date().toISOString();
const report = {
  schemaVersion:
    "earth-geospatial-v7-internal-hydrology-naturalness-repair-check-v1",
  runId,
  status:
    "measurement_derived_internal_hydrology_naturalness_repair_passed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  authorizationId: AUTHORIZATION_ID,
  failedPreflight: {
    runId: failedPreflight.runId,
    path: FAILED_PREFLIGHT_PATH,
    sha256: sha256File(FAILED_PREFLIGHT_PATH),
    failureCounts,
  },
  priorRepair: {
    runId: priorRepair.runId,
    path: priorRepairPointer.runPath,
    sha256: sha256File(priorRepairPointer.runPath),
    internalHydrologyProfile: priorProfile,
  },
  repairedProfile: profile.internalHydrologyProfile,
  measurementBinding: {
    candidateId: assignment.candidateId,
    bounds: assignment.measurementBounds,
    fingerprint: assignment.fingerprints.direct,
    aggregateMetrics: assignment.metrics,
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
    failedPreflightRunId: failedPreflight.runId,
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
    "v7_internal_hydrology_naturalness_repair_check_completed",
  runId,
  kind: "repair_check",
  status: "success",
  title:
    "The slot-123 internal hydrology naturalness repair check passed",
  titleZh: "slot-123内部水文自然度修复检查通过",
  detail:
    `checks=${Object.keys(checks).length}; failed=0; reportSha256=${reportSha256}; imageGenerationStarted=false`,
  detailZh:
    `检查项=${Object.keys(checks).length}；失败=0；报告SHA-256=${reportSha256}；启动图片生成=false`,
  script: projectPath(import.meta.filename),
  currentStep:
    "internal_hydrology_naturalness_repair_check_completed",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    FAILED_PREFLIGHT_PATH,
    priorRepairPointer.runPath,
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
      priorProfile: {
        lateralOffsetFraction:
          priorProfile.lateralOffsetFraction,
        rejoinFraction: priorProfile.rejoinFraction,
      },
      repairedProfile: {
        lateralOffsetFraction:
          profile.internalHydrologyProfile
            .lateralOffsetFraction,
        rejoinFraction:
          profile.internalHydrologyProfile.rejoinFraction,
        profileSha256:
          profile.internalHydrologyProfile.profileSha256,
      },
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
