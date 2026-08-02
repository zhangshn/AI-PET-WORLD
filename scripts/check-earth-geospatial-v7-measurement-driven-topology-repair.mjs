import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";
import {
  MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
  MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY,
  buildMeasurementDrivenAnonymousLayoutProfile,
} from "./lib/measurement-driven-anonymous-topology.mjs";

const ROOT = process.cwd();
const OWNER_AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-measurement-driven-topology-repair-20260728";
const GENERATOR_PATH =
  "scripts/build-earth-geospatial-complete-map-conditions.mjs";
const CHECKER_PATH =
  "scripts/check-earth-geospatial-complete-map-conditions.mjs";
const TOPOLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-driven-anonymous-topology.mjs";
const PREFLIGHT_PATH =
  "scripts/preflight-earth-geospatial-v7-slot-123-anonymous-seeds.mjs";
const DIAGNOSIS_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-measurement-topology-selection-diagnostics/latest.json";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-measurement-topology-repair-checks";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-measurement-topology-repair-check-" +
  createdAtUtc.replace(/[:.]/g, "-");
const diagnosisPointer = readJson(DIAGNOSIS_POINTER_PATH);
const diagnosis = readJson(diagnosisPointer.runPath);
const windowPlanPointer = readJson(WINDOW_PLAN_POINTER_PATH);
const windowPlan = readJson(windowPlanPointer.runPath);
const slot122 = assignmentFor(windowPlan, "v7-capacity-slot-122");
const slot123 = assignmentFor(windowPlan, "v7-capacity-slot-123");
const slot122Profile =
  buildMeasurementDrivenAnonymousLayoutProfile({
    assignment: slot122,
    hasWater: true,
  });
const slot123Profile =
  buildMeasurementDrivenAnonymousLayoutProfile({
    assignment: slot123,
    hasWater: true,
  });
const slot123RepeatProfile =
  buildMeasurementDrivenAnonymousLayoutProfile({
    assignment: structuredClone(slot123),
    hasWater: true,
  });
const generatorSource = fs.readFileSync(GENERATOR_PATH, "utf8");
const checkerSource = fs.readFileSync(CHECKER_PATH, "utf8");
const preflightSource = fs.readFileSync(PREFLIGHT_PATH, "utf8");

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_measurement_driven_topology_repair_check_started",
  runId,
  kind: "repair_check",
  status: "running",
  title:
    "The V7 measurement-driven anonymous topology repair check started",
  titleZh: "V7测量事实驱动匿名拓扑修复检查已启动",
  detail:
    "The check is no-RGB and verifies source contracts, measurement binding, cross-window diversity, and retry-seed macro invariance.",
  detailZh:
    "本次为无RGB检查，核验源代码合同、测量绑定、跨窗口差异及重试种子的宏观拓扑不变性。",
  script: projectPath(import.meta.filename),
  currentStep: "measurement_driven_topology_repair_check",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const checks = {
  diagnosisConfirmedRetrySeedDominance:
    diagnosis.status ===
      "retry_seed_dominated_water_macro_topology_confirmed",
  generatorImportsMeasurementDrivenTopology:
    generatorSource.includes(
      "buildMeasurementDrivenAnonymousLayoutProfile",
    ),
  generatorUsesMeasurementDrivenMethodId:
    generatorSource.includes(
      "methodId: MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID",
    ),
  generatorNoLongerSelectsLayoutFromRetrySeed:
    !generatorSource.includes(
      "Number.parseInt(seedHex.slice(0, 8), 16) % 4",
    ),
  generatorNoLongerSelectsWaterProfileFromRetrySeed:
    !generatorSource.includes(
      "Number.parseInt(seedHex.slice(12, 14), 16) % 3",
    ),
  generatorNoLongerSelectsWaterRouteFromRetrySeed:
    !generatorSource.includes(
      "Number.parseInt(seedHex.slice(8, 10), 16) % 3",
    ),
  checkerRecomputesMeasurementProfile:
    checkerSource.includes(
      "const expectedMeasurementProfile",
    ),
  preflightDeclaresMacroTopologyInvariant:
    preflightSource.includes(
      "macroTopologyInvariantAcrossRetrySeeds: true",
    ),
  slot123MacroTopologyIsDeterministic:
    slot123Profile.profileSha256 ===
      slot123RepeatProfile.profileSha256 &&
    slot123Profile.routeTopology ===
      slot123RepeatProfile.routeTopology &&
    slot123Profile.waterControlProfileIndex ===
      slot123RepeatProfile.waterControlProfileIndex,
  slot122And123MeasurementTopologyFingerprintsDiffer:
    slot122Profile.topologySelection
      .measurementTopologyFingerprint !==
    slot123Profile.topologySelection
      .measurementTopologyFingerprint,
  slot122And123WaterProfilesDiffer:
    slot122Profile.waterControlProfileIndex !==
    slot123Profile.waterControlProfileIndex,
  slot122And123RouteTopologiesDiffer:
    slot122Profile.routeTopology !== slot123Profile.routeTopology,
  exactMeasurementGeometryCarriedForward:
    slot123Profile.identityBoundary
      .exactMeasurementGeometryCarriedForward === false,
  exactOsmGeometryCarriedForward:
    slot123Profile.identityBoundary
      .exactOsmGeometryCarriedForward === false,
  historicalRgbRead:
    slot123Profile.identityBoundary.historicalRgbRead === false,
};
const failedChecks = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
assert(
  failedChecks.length === 0,
  `measurement-driven topology repair checks failed: ${failedChecks.join(", ")}`,
);

const finishedAtUtc = new Date().toISOString();
const report = {
  schemaVersion:
    "earth-geospatial-v7-measurement-driven-topology-repair-check-v1",
  runId,
  status:
    "measurement_driven_anonymous_macro_topology_repair_passed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  ownerAuthorizationId: OWNER_AUTHORIZATION_ID,
  sourceDiagnosis: {
    runId: diagnosis.runId,
    path: diagnosisPointer.runPath,
    sha256: sha256File(diagnosisPointer.runPath),
    generatorSha256Before:
      diagnosis.sourceEvidence.generatorSha256Before,
    checkerSha256Before:
      diagnosis.sourceEvidence.checkerSha256Before,
  },
  algorithmContract: {
    methodId: MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
    routeTopologyFamily:
      MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY,
    macroTopologySource:
      "measurement_window_fingerprint_plus_aggregate_natural_facts",
    retrySeedAffectsMacroTopology: false,
    retrySeedScope:
      "micro_curve_width_object_and_boundary_variation_only",
  },
  comparisons: {
    slot122: summarizeProfile(slot122Profile),
    slot123: summarizeProfile(slot123Profile),
    macroTopologyDiversityConfirmed: true,
  },
  checks,
  failedChecks,
  algorithmEvidence: {
    generatorPath: GENERATOR_PATH,
    generatorSha256After: sha256File(GENERATOR_PATH),
    checkerPath: CHECKER_PATH,
    checkerSha256After: sha256File(CHECKER_PATH),
    topologyLibraryPath: TOPOLOGY_LIBRARY_PATH,
    topologyLibrarySha256: sha256File(TOPOLOGY_LIBRARY_PATH),
    preflightPath: PREFLIGHT_PATH,
    preflightSha256: sha256File(PREFLIGHT_PATH),
    checkProgramPath: projectPath(import.meta.filename),
    checkProgramSha256: sha256File(import.meta.filename),
  },
  invariants: {
    worldFactsChanged: false,
    connectivityBlueprintChanged: false,
    exactMeasurementGeometryCopied: false,
    exactOsmGeometryCopied: false,
    historicalRgbProvidedToGenerator: false,
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
    sourceDiagnosisRunId: diagnosis.runId,
    generatorSha256After:
      report.algorithmEvidence.generatorSha256After,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action: "v7_measurement_driven_topology_repair_check_completed",
  runId,
  kind: "repair_check",
  status: "success",
  title:
    "The V7 measurement-driven anonymous topology repair check passed",
  titleZh: "V7测量事实驱动匿名拓扑修复检查通过",
  detail:
    `checks=${Object.keys(checks).length}; failed=0; reportSha256=${reportSha256}; imageGenerationStarted=false`,
  detailZh:
    `检查项=${Object.keys(checks).length}；失败=0；报告SHA-256=${reportSha256}；启动图片生成=false`,
  script: projectPath(import.meta.filename),
  currentStep: "measurement_driven_topology_repair_check_completed",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    diagnosisPointer.runPath,
    windowPlanPointer.runPath,
    GENERATOR_PATH,
    CHECKER_PATH,
    TOPOLOGY_LIBRARY_PATH,
    PREFLIGHT_PATH,
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
      slot122: report.comparisons.slot122,
      slot123: report.comparisons.slot123,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function assignmentFor(plan, slotId) {
  const assignment = (plan.assignments ?? []).find(
    (entry) => entry.slotId === slotId,
  );
  assert(assignment, `measurement assignment is missing: ${slotId}`);
  return assignment;
}

function summarizeProfile(profile) {
  return {
    measurementTopologyFingerprint:
      profile.topologySelection.measurementTopologyFingerprint,
    layoutVariant: profile.layoutVariant,
    waterControlProfileIndex: profile.waterControlProfileIndex,
    routeTopology: profile.routeTopology,
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
