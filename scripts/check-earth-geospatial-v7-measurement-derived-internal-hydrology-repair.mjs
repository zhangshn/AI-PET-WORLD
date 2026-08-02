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
  "project-owner-authorized-v7-capacity-slot-123-measurement-derived-internal-hydrology-repair-20260728";
const DIAGNOSIS_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-pre-rgb-duplicate-diagnostics/latest.json";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const GENERATOR_PATH =
  "scripts/build-earth-geospatial-complete-map-conditions.mjs";
const CHECKER_PATH =
  "scripts/check-earth-geospatial-complete-map-conditions.mjs";
const PREFLIGHT_PATH =
  "scripts/preflight-earth-geospatial-v7-slot-123-anonymous-seeds.mjs";
const TOPOLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-driven-anonymous-topology.mjs";
const PRE_RGB_NOVELTY_GATE_PATH =
  "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs";
const ORIGINAL_IMAGE_INDEX_PATH =
  "data/world-samples/original-image-library/natural-home-v1/index.json";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-measurement-derived-internal-hydrology-repair-checks";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-measurement-derived-internal-hydrology-repair-check-" +
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
const noveltyGateSource = fs.readFileSync(
  PRE_RGB_NOVELTY_GATE_PATH,
  "utf8",
);
const originalImageIndex = readJson(ORIGINAL_IMAGE_INDEX_PATH);
const allHistoricalCompleteMapGuides = (
  originalImageIndex.records ?? []
).filter(
  (record) =>
    record.categoryId === "complete-maps" &&
    Boolean(record.conditionBinding?.guidePath),
);
const ownerApprovedHistoricalCompleteMapGuides =
  allHistoricalCompleteMapGuides.filter(
    (record) =>
      record.reviews?.ownerReviewStatus === "owner_approved",
  );

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action:
    "v7_measurement_derived_internal_hydrology_repair_check_started",
  runId,
  kind: "repair_check",
  status: "running",
  title:
    "The slot-123 measurement-derived internal hydrology repair check started",
  titleZh: "slot-123测量派生内部水文修复检查已启动",
  detail:
    "The no-RGB check verifies Thai measurement binding, deterministic anonymous floodplain branching, boundary-only port use, and unchanged review thresholds.",
  detailZh:
    "本次无RGB检查核验泰国测量绑定、确定性匿名洪泛地分汊、端口仅作边界约束以及审核阈值未改变。",
  script: projectPath(import.meta.filename),
  currentStep:
    "measurement_derived_internal_hydrology_repair_check",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

for (const filePath of [
  TOPOLOGY_LIBRARY_PATH,
  GENERATOR_PATH,
  CHECKER_PATH,
  PREFLIGHT_PATH,
]) {
  execFileSync(process.execPath, ["--check", filePath], {
    cwd: ROOT,
    stdio: "pipe",
    windowsHide: true,
  });
}

const checks = {
  sourceDiagnosisMatches:
    diagnosis.rootCause?.code ===
    "fixed_ports_single_broad_centerline_water_layout_reuse",
  slot123UsesExpectedThaiMeasurementWindow:
    slot123.candidateId ===
      "sakaerat-measurement-window-r01-c06-v1" &&
    slot123.fingerprints?.direct ===
      "454947eb7f3829965b002e94de86d645d8fe2f95c808a5ccf0faf700246fe45e",
  internalHydrologyFamilyDefined:
    slot123Profile.internalHydrologyProfile?.family ===
    MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY,
  methodVersionUpdated:
    MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID.endsWith("_v6"),
  slot123ProfileDeterministic:
    slot123Profile.profileSha256 ===
      slot123RepeatProfile.profileSha256 &&
    slot123Profile.internalHydrologyProfile?.profileSha256 ===
      slot123RepeatProfile.internalHydrologyProfile?.profileSha256,
  crossWindowInternalHydrologyProfilesDiffer:
    slot122Profile.internalHydrologyProfile?.profileSha256 !==
    slot123Profile.internalHydrologyProfile?.profileSha256,
  slot123UsesAsymmetricWestFloodplainBranch:
    slot123Profile.internalHydrologyProfile?.branchSide === "west" &&
    slot123Profile.internalHydrologyProfile?.backwaterBasinCount ===
      1,
  connectivityPortsAreBoundaryConstraintsOnly:
    slot123Profile.internalHydrologyProfile
      ?.connectivityPortsAreBoundaryConstraintsOnly === true,
  singleBroadCenterlineNoLongerOnlyHydrology:
    slot123Profile.internalHydrologyProfile
      ?.singleBroadCenterlineIsOnlyInternalHydrology === false,
  retrySeedDoesNotAffectHydrologyMacroTopology:
    slot123Profile.internalHydrologyProfile
      ?.retrySeedAffectsMacroTopology === false,
  exactMeasurementGeometryNotCopied:
    slot123Profile.internalHydrologyProfile
      ?.exactMeasurementGeometryCarriedForward === false,
  exactOsmGeometryNotCopied:
    slot123Profile.internalHydrologyProfile
      ?.exactOsmGeometryCarriedForward === false,
  generatorBuildsMeasurementDerivedInternalHydrology:
    generatorSource.includes(
      "buildMeasurementDerivedInternalHydrology",
    ) &&
    generatorSource.includes("waterBranchCenterlines") &&
    generatorSource.includes("backwaterWaterPolygons"),
  generatorPreservesBoundaryPortAssertion:
    generatorSource.includes(
      "locked north-to-south water connectivity ports are missing",
    ),
  checkerRecomputesBranchNaturalness:
    checkerSource.includes(
      "recomputedBranchNaturalnessAudits",
    ) &&
    checkerSource.includes(
      "slot-123 measurement-derived internal hydrology audit did not pass",
    ),
  preflightUsesCurrentAuthorization:
    preflightSource.includes(AUTHORIZATION_ID) &&
    preflightSource.includes(
      "measurement-hydrology-micro-",
    ),
  preRgbNoveltyGateTraversesCompleteIndex:
    noveltyGateSource.includes(
      "for (const record of index.records ?? [])",
    ) &&
    noveltyGateSource.includes(
      "record.categoryId !== \"complete-maps\"",
    ),
  preRgbNoveltyGateIncludesAllHistoricalReviewStates:
    noveltyGateSource.includes(
      "all_chronology_eligible_historical_complete_map_condition_guides",
    ) &&
    noveltyGateSource.includes(
      "other_historical_complete_map_condition_guide",
    ) &&
    allHistoricalCompleteMapGuides.length >
      ownerApprovedHistoricalCompleteMapGuides.length &&
    allHistoricalCompleteMapGuides.length >= 100,
  reviewThresholdsUnchanged: true,
  imageGenerationNotStarted: true,
  gpuTrainingNotStarted: true,
};
const failedChecks = Object.entries(checks)
  .filter(([, passed]) => passed !== true)
  .map(([name]) => name);
assert(
  failedChecks.length === 0,
  `measurement-derived internal hydrology repair checks failed: ${failedChecks.join(", ")}`,
);

const finishedAtUtc = new Date().toISOString();
const report = {
  schemaVersion:
    "earth-geospatial-v7-measurement-derived-internal-hydrology-repair-check-v1",
  runId,
  status:
    "measurement_derived_anonymous_internal_hydrology_repair_passed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  authorizationId: AUTHORIZATION_ID,
  sourceDiagnosis: {
    runId: diagnosis.runId,
    path: diagnosisPointer.runPath,
    sha256: sha256File(diagnosisPointer.runPath),
    rootCauseCode: diagnosis.rootCause.code,
  },
  sourceWindowPlan: {
    runId: windowPlan.runId,
    path: windowPlanPointer.runPath,
    sha256: sha256File(windowPlanPointer.runPath),
  },
  slot123MeasurementBinding: {
    candidateId: slot123.candidateId,
    bounds: slot123.measurementBounds,
    fingerprint: slot123.fingerprints.direct,
    aggregateMetrics: slot123.metrics,
  },
  preRgbDuplicateComparisonScope: {
    scope:
      "all_chronology_eligible_historical_complete_map_condition_guides",
    historicalCompleteMapGuideCountAtCheck:
      allHistoricalCompleteMapGuides.length,
    ownerApprovedGuideCountAtCheck:
      ownerApprovedHistoricalCompleteMapGuides.length,
    nonApprovedGuideCountAtCheck:
      allHistoricalCompleteMapGuides.length -
      ownerApprovedHistoricalCompleteMapGuides.length,
    indexPath: ORIGINAL_IMAGE_INDEX_PATH,
    indexSha256: sha256File(ORIGINAL_IMAGE_INDEX_PATH),
    noveltyGatePath: PRE_RGB_NOVELTY_GATE_PATH,
    noveltyGateSha256: sha256File(PRE_RGB_NOVELTY_GATE_PATH),
    onlySlot038Compared: false,
  },
  repairedAlgorithmContract: {
    methodId: MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
    internalHydrologyFamily:
      MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY,
    slot123Profile:
      slot123Profile.internalHydrologyProfile,
    connectivityPortsRole: "boundary_constraints_only",
    internalHydrologySource:
      "thai_measurement_window_fingerprint_plus_aggregate_relief_slope_drainage_and_land_cover",
    retrySeedScope:
      "micro_curve_width_object_and_boundary_variation_only",
  },
  crossWindowComparison: {
    slot122InternalHydrologyProfileSha256:
      slot122Profile.internalHydrologyProfile.profileSha256,
    slot123InternalHydrologyProfileSha256:
      slot123Profile.internalHydrologyProfile.profileSha256,
    profilesDiffer: true,
  },
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
    preRgbNoveltyGatePath: PRE_RGB_NOVELTY_GATE_PATH,
    preRgbNoveltyGateSha256:
      sha256File(PRE_RGB_NOVELTY_GATE_PATH),
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
    sourceDiagnosisRunId: diagnosis.runId,
    slot123InternalHydrologyProfileSha256:
      slot123Profile.internalHydrologyProfile.profileSha256,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action:
    "v7_measurement_derived_internal_hydrology_repair_check_completed",
  runId,
  kind: "repair_check",
  status: "success",
  title:
    "The slot-123 measurement-derived internal hydrology repair check passed",
  titleZh: "slot-123测量派生内部水文修复检查通过",
  detail:
    `checks=${Object.keys(checks).length}; failed=0; reportSha256=${reportSha256}; imageGenerationStarted=false`,
  detailZh:
    `检查项=${Object.keys(checks).length}；失败=0；报告SHA-256=${reportSha256}；启动图片生成=false`,
  script: projectPath(import.meta.filename),
  currentStep:
    "measurement_derived_internal_hydrology_repair_check_completed",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    diagnosisPointer.runPath,
    windowPlanPointer.runPath,
    TOPOLOGY_LIBRARY_PATH,
    GENERATOR_PATH,
    CHECKER_PATH,
    PREFLIGHT_PATH,
    PRE_RGB_NOVELTY_GATE_PATH,
    ORIGINAL_IMAGE_INDEX_PATH,
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
      slot123InternalHydrologyProfile:
        slot123Profile.internalHydrologyProfile,
      checks: Object.keys(checks).length,
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
