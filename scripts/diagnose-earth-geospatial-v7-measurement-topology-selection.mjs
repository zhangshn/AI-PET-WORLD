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
const OWNER_AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-measurement-driven-topology-repair-20260728";
const GENERATOR_PATH =
  "scripts/build-earth-geospatial-complete-map-conditions.mjs";
const CHECKER_PATH =
  "scripts/check-earth-geospatial-complete-map-conditions.mjs";
const LATEST_CONDITION_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/latest.json";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-measurement-topology-selection-diagnostics";

const createdAtUtc = new Date().toISOString();
const runId =
  `earth-geospatial-v7-measurement-topology-selection-diagnosis-` +
  `${SLOT_ID}-${createdAtUtc.replace(/[:.]/g, "-")}`;
const generatorSource = fs.readFileSync(
  path.join(ROOT, GENERATOR_PATH),
  "utf8",
);
const latestConditionPointer = readJson(
  LATEST_CONDITION_POINTER_PATH,
);

assert(
  latestConditionPointer.v7SlotId === SLOT_ID,
  "latest condition pointer is not slot-123",
);

const sourcePatternEvidence = {
  layoutIndexSelectedFromRetrySeed:
    generatorSource.includes(
      "Number.parseInt(seedHex.slice(0, 8), 16) % 4",
    ),
  waterControlProfileSelectedFromRetrySeed:
    generatorSource.includes(
      "Number.parseInt(seedHex.slice(12, 14), 16) % 3",
    ),
  waterRouteTopologySelectedFromRetrySeed:
    generatorSource.includes(
      "Number.parseInt(seedHex.slice(8, 10), 16) % 3",
    ),
  measurementFingerprintStoredAsSupportEvidence:
    generatorSource.includes(
      "measurementSupportFingerprint: assignment.fingerprints.direct",
    ),
  measurementFingerprintControlsNonWaterTopologyOnly:
    generatorSource.includes(
      "Number.parseInt(assignment.fingerprints.direct.slice(0, 2), 16) % 4",
    ),
};
assert(
  sourcePatternEvidence.layoutIndexSelectedFromRetrySeed &&
    sourcePatternEvidence.waterControlProfileSelectedFromRetrySeed &&
    sourcePatternEvidence.waterRouteTopologySelectedFromRetrySeed &&
    sourcePatternEvidence.measurementFingerprintStoredAsSupportEvidence &&
    sourcePatternEvidence.measurementFingerprintControlsNonWaterTopologyOnly,
  "the expected pre-repair topology-selection source patterns were not found",
);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_measurement_topology_selection_diagnosis_started",
  runId,
  kind: "topology_diagnosis",
  status: "running",
  title:
    "The V7 measurement-to-anonymous-topology selection diagnosis started",
  titleZh: "V7测量事实到匿名拓扑的选择诊断已启动",
  detail:
    `slotId=${SLOT_ID}; imageGenerationStarted=false; gpuTrainingStarted=false`,
  detailZh:
    `槽位=${SLOT_ID}；启动图片生成=false；启动GPU训练=false`,
  script: projectPath(import.meta.filename),
  currentStep: "measurement_topology_selection_diagnosis",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const report = {
  schemaVersion:
    "earth-geospatial-v7-measurement-topology-selection-diagnosis-v1",
  runId,
  status:
    "retry_seed_dominated_water_macro_topology_confirmed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ownerAuthorizationId: OWNER_AUTHORIZATION_ID,
  slotId: SLOT_ID,
  latestCondition: {
    runId: latestConditionPointer.runId,
    conditionId: latestConditionPointer.conditionId,
    runPath: latestConditionPointer.runPath,
    runSha256: sha256File(latestConditionPointer.runPath),
  },
  sourceEvidence: {
    generatorPath: GENERATOR_PATH,
    generatorSha256Before: sha256File(GENERATOR_PATH),
    checkerPath: CHECKER_PATH,
    checkerSha256Before: sha256File(CHECKER_PATH),
    diagnosticProgramPath: projectPath(import.meta.filename),
    diagnosticProgramSha256: sha256File(import.meta.filename),
    sourcePatternEvidence,
  },
  rootCause: {
    code: "retry_seed_dominated_water_macro_topology",
    detail:
      "The real measurement window fingerprint and aggregate metrics were bound as provenance, but water-map layout index, water control profile, and water-route topology family were selected from the retry seed.",
    detailZh:
      "真实测量窗口指纹和聚合指标虽已绑定为来源证据，但有水地图的布局索引、水体控制档案和道路拓扑族仍由重试种子选择。",
    consequence:
      "Changing the retry seed could repeatedly select a previously approved right-river/left-road macro skeleton while only changing local details.",
    consequenceZh:
      "更换重试种子可能反复选中已有的右河左路宏观骨架，只改变局部细节。",
  },
  requiredRepair: {
    macroTopologySource:
      "measurement_window_fingerprint_plus_aggregate_natural_facts",
    retrySeedScope:
      "micro_variation_only_after_macro_topology_is_fixed",
    exactMeasurementGeometryCarriedForward: false,
    exactOsmGeometryCarriedForward: false,
    historicalRgbProvidedToGenerator: false,
    reviewThresholdsModified: false,
  },
  outputBoundary: {
    sourceFilesModifiedByDiagnosis: false,
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
  fileName: "diagnosis-report.json",
  record: report,
  latest: {
    slotId: SLOT_ID,
    status: report.status,
    generatorSha256Before:
      report.sourceEvidence.generatorSha256Before,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);
const finishedAtUtc = new Date().toISOString();

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action: "v7_measurement_topology_selection_diagnosis_completed",
  runId,
  kind: "topology_diagnosis",
  status: "success",
  title:
    "The retry-seed-dominated water macro-topology root cause was recorded",
  titleZh: "有水地图宏观拓扑受重试种子主导的根因已记录",
  detail:
    `rootCause=${report.rootCause.code}; reportSha256=${reportSha256}; imageGenerationStarted=false`,
  detailZh:
    `根因=${report.rootCause.code}；报告SHA-256=${reportSha256}；启动图片生成=false`,
  script: projectPath(import.meta.filename),
  currentStep: "measurement_topology_selection_diagnosis_completed",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    latestConditionPointer.runPath,
    GENERATOR_PATH,
    CHECKER_PATH,
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
      generatorSha256Before:
        report.sourceEvidence.generatorSha256Before,
      checkerSha256Before:
        report.sourceEvidence.checkerSha256Before,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), "utf8"),
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
