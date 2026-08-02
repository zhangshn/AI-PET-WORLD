import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";
import { catalogPath } from "./lib/ai-pet-world-storage.mjs";
import {
  COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
  buildMeasurementDerivedAnonymousMainChannel,
  buildMeasurementDerivedCoarseHydrologyProfile,
  buildMeasurementDerivedNetworkHalfWidths,
} from "./lib/measurement-derived-coarse-hydrology.mjs";

const ROOT = process.cwd();
const SLOT_ID = "v7-capacity-slot-123";
const AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-record-right-only-pattern-check-failure-and-read-only-all-history-centroid-diagnosis-20260728";
const START_ACTION =
  "v7_slot_123_coarse_hydrology_main_channel_repair_check_started";
const FAILURE_ACTION =
  "v7_slot_123_coarse_hydrology_main_channel_repair_check_failed";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const INDEX_PATH =
  "data/world-samples/original-image-library/natural-home-v1/index.json";
const CHECK_PATH =
  "scripts/check-earth-geospatial-v7-slot-123-coarse-hydrology-main-channel-repair.mjs";
const HYDROLOGY_LIBRARY_PATH =
  "scripts/lib/measurement-derived-coarse-hydrology.mjs";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-right-only-pattern-diagnostics";
const WATER_COLOR = [43, 112, 156];

const database = new DatabaseSync(catalogPath);
const failedStart = database
  .prepare(
    `SELECT event_id, timestamp_utc, run_id, status
     FROM program_events
     WHERE action = ?
     ORDER BY timestamp_utc DESC
     LIMIT 1`,
  )
  .get(START_ACTION);
const terminal = failedStart
  ? database
      .prepare(
        `SELECT event_id FROM program_events
         WHERE run_id = ? AND status IN ('success', 'failed', 'blocked')
         LIMIT 1`,
      )
      .get(failedStart.run_id)
  : null;
database.close();
assert(
  failedStart?.status === "running",
  "right-only-pattern check start event was not found",
);

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-right-only-pattern-diagnosis-" +
  createdAtUtc.replace(/[:.]/g, "-");
appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_123_right_only_pattern_diagnosis_started",
  runId,
  kind: "read_only_diagnosis",
  status: "running",
  title:
    "The slot-123 right-only water-pattern diagnosis started",
  titleZh: "slot-123 右侧单一河道模式只读诊断已启动",
  detail:
    "The program will save the failed formal check and compare current eight-band water centroids with all available historical complete-map condition guides without reading historical RGB.",
  detailZh:
    "程序将保存正式检查失败，并把当前八带水体质心与全部可用历史完整地图条件引导图比较，不读取历史RGB。",
  script: projectPath(import.meta.filename),
  currentStep: "right_only_pattern_diagnosis",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

const pointer = readJson(WINDOW_PLAN_POINTER_PATH);
const plan = readJson(pointer.runPath);
const assignment = plan.assignments.find(
  (entry) => entry.slotId === SLOT_ID,
);
assert(assignment, "slot-123 assignment is missing");
const waterPointer = readJson(WATER_PROFILE_POINTER_PATH);
const waterProfile = readJson(waterPointer.profilePath);
const profile = buildMeasurementDerivedCoarseHydrologyProfile({
  assignment,
  root: ROOT,
});
const halfWidths = buildMeasurementDerivedNetworkHalfWidths({
  pointCount: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
  startHalfWidth: 76,
  endHalfWidth: 140,
  coarseHydrologyProfile: profile,
});
const mainChannel = buildMeasurementDerivedAnonymousMainChannel({
  start: { x: 948, y: 0 },
  end: { x: 884, y: 768 },
  width: 1024,
  height: 768,
  coarseHydrologyProfile: profile,
  waterNaturalnessProfile: waterProfile,
  corridorHalfWidths: halfWidths,
});
const currentBandCentroids = pointBandCentroids(
  mainChannel.points,
  8,
  1024,
);
const interiorCentroids = currentBandCentroids.slice(2, 7);
const oldAssertionMetrics = {
  minimumInteriorCentroid: Math.min(...interiorCentroids),
  maximumInteriorCentroid: Math.max(...interiorCentroids),
  interiorCentroidRange:
    Math.max(...interiorCentroids) -
    Math.min(...interiorCentroids),
  requiredMinimumAtOrLeftOf: 0.6,
  requiredMinimumRange: 0.1,
  passed:
    Math.min(...interiorCentroids) <= 0.6 &&
    Math.max(...interiorCentroids) -
      Math.min(...interiorCentroids) >=
      0.1,
};
assert(
  oldAssertionMetrics.passed === false,
  "right-only-pattern failure was not reproduced",
);

const index = readJson(INDEX_PATH);
const historicalComparisons = [];
let skipped = 0;
const skippedErrors = [];
for (const record of index.records ?? []) {
  const guidePath = record.conditionBinding?.guidePath;
  if (record.categoryId !== "complete-maps" || !guidePath) continue;
  const absoluteGuidePath = path.resolve(ROOT, guidePath);
  if (!fs.existsSync(absoluteGuidePath)) {
    skipped += 1;
    continue;
  }
  try {
    const historicalBandCentroids =
      await guideWaterBandCentroids(absoluteGuidePath, 8);
    historicalComparisons.push({
      recordId: record.recordId,
      status: record.status,
      ownerReviewStatus:
        record.reviews?.ownerReviewStatus ?? null,
      guidePath: projectPath(absoluteGuidePath),
      guideSha256: sha256File(absoluteGuidePath),
      historicalWaterBandCentroids: historicalBandCentroids,
      meanAbsoluteWaterBandCentroidDistance:
        meanNullableDistance(
          currentBandCentroids,
          historicalBandCentroids,
        ),
    });
  } catch (error) {
    skipped += 1;
    if (skippedErrors.length < 20) {
      skippedErrors.push({
        recordId: record.recordId,
        guidePath,
        errorMessage:
          error instanceof Error ? error.message : String(error),
      });
    }
  }
}
historicalComparisons.sort(
  (left, right) =>
    left.meanAbsoluteWaterBandCentroidDistance -
      right.meanAbsoluteWaterBandCentroidDistance ||
    left.recordId.localeCompare(right.recordId),
);

const finishedAtUtc = new Date().toISOString();
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-123-right-only-pattern-diagnosis-v1",
  runId,
  status:
    "right_only_assertion_failed_current_centerline_and_all_history_centroids_recorded",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  authorizationId: AUTHORIZATION_ID,
  slotId: SLOT_ID,
  failedFormalCheck: {
    runId: failedStart.run_id,
    startEventId: failedStart.event_id,
    startedAtUtc: failedStart.timestamp_utc,
    errorCode: "internal_main_channel_leaves_old_right_only_pattern_failed",
    errorMessage:
      "coarse hydrology main-channel repair checks failed: internalMainChannelLeavesOldRightOnlyPattern",
  },
  measurementBinding: {
    windowPlanRunId: plan.runId,
    candidateId: assignment.candidateId,
    directFingerprint: assignment.fingerprints.direct,
    coarseHydrologyProfileSha256: profile.profileSha256,
  },
  currentGeometry: {
    bandCentroids: currentBandCentroids,
    oldAssertionMetrics,
    naturalnessAudit: mainChannel.audit,
    corridorAudit: mainChannel.corridorAudit,
    supportTransitionLimiter:
      mainChannel.selection.supportTransitionLimiter,
    curvatureLimiter: mainChannel.selection.curvatureLimiter,
  },
  allHistoryConditionGuideComparison: {
    comparisonScope:
      "all_available_historical_complete_map_condition_guides",
    historicalRgbRead: false,
    historicalConditionGuidesReadForAuditOnly: true,
    comparedCount: historicalComparisons.length,
    skippedCount: skipped,
    skippedErrors,
    nearestComparisons: historicalComparisons.slice(0, 20),
    fullComparisons: historicalComparisons,
    limitation:
      "This centerline-only diagnosis does not replace the formal post-condition-guide water-plus-route macro-topology audit.",
  },
  diagnosisBoundary: {
    oldAssertionRemovedOrRelaxed: false,
    geometryAlgorithmChanged: false,
    measurementWindowChanged: false,
    reviewThresholdChanged: false,
    historicalGeometryCopied: false,
  },
  sourceEvidence: {
    windowPlanPath: pointer.runPath,
    windowPlanSha256: sha256File(pointer.runPath),
    waterProfilePath: waterPointer.profilePath,
    waterProfileSha256: sha256File(waterPointer.profilePath),
    indexPath: INDEX_PATH,
    indexSha256: sha256File(INDEX_PATH),
    checkPath: CHECK_PATH,
    checkSha256: sha256File(CHECK_PATH),
    hydrologyLibraryPath: HYDROLOGY_LIBRARY_PATH,
    hydrologyLibrarySha256: sha256File(
      HYDROLOGY_LIBRARY_PATH,
    ),
    diagnosticProgramPath: projectPath(import.meta.filename),
    diagnosticProgramSha256: sha256File(import.meta.filename),
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
  fileName: "diagnosis-report.json",
  record: report,
  latest: {
    status: report.status,
    slotId: SLOT_ID,
    minimumInteriorCentroid:
      oldAssertionMetrics.minimumInteriorCentroid,
    interiorCentroidRange:
      oldAssertionMetrics.interiorCentroidRange,
    comparedCount: historicalComparisons.length,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);
if (!terminal) {
  appendAiPainterProgramEvent({
    timestamp: finishedAtUtc,
    action: FAILURE_ACTION,
    runId: failedStart.run_id,
    kind: "repair_check_failure",
    status: "failed",
    title:
      "The slot-123 right-only-pattern formal-check failure was recorded",
    titleZh: "slot-123 右侧单一河道模式正式检查失败已记录",
    detail:
      `failure=internalMainChannelLeavesOldRightOnlyPattern; diagnosisRunId=${runId}; reportSha256=${reportSha256}; imageGenerationStarted=false`,
    detailZh:
      `失败项=internalMainChannelLeavesOldRightOnlyPattern；诊断runId=${runId}；报告SHA-256=${reportSha256}；未启动图像生成。`,
    script: projectPath(import.meta.filename),
    currentStep: "right_only_pattern_formal_check_failure_recorded",
    evidencePath: stored.runPath,
    evidence: [stored.runPath, CHECK_PATH, HYDROLOGY_LIBRARY_PATH],
    errorCode:
      "internal_main_channel_leaves_old_right_only_pattern_failed",
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });
}
appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action: "v7_slot_123_right_only_pattern_diagnosis_completed",
  runId,
  kind: "read_only_diagnosis",
  status: "success",
  title:
    "The slot-123 right-only water-pattern diagnosis completed",
  titleZh: "slot-123 右侧单一河道模式只读诊断已完成",
  detail:
    `bandCentroids=${currentBandCentroids.join(",")}; compared=${historicalComparisons.length}; nearest=${historicalComparisons[0]?.recordId ?? "none"}; reportSha256=${reportSha256}; geometryAlgorithmChanged=false`,
  detailZh:
    `八带质心=${currentBandCentroids.join(",")}；已比较=${historicalComparisons.length}；最近记录=${historicalComparisons[0]?.recordId ?? "无"}；报告SHA-256=${reportSha256}；未修改几何算法。`,
  script: projectPath(import.meta.filename),
  currentStep: "right_only_pattern_diagnosis_completed",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    pointer.runPath,
    INDEX_PATH,
    ...historicalComparisons
      .slice(0, 12)
      .map((entry) => entry.guidePath),
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
      currentBandCentroids,
      oldAssertionMetrics,
      historicalConditionGuidesCompared:
        historicalComparisons.length,
      skipped,
      skippedErrors,
      nearestComparisons: historicalComparisons.slice(0, 5),
      geometryAlgorithmChanged: false,
      imageGenerationStarted: false,
      rgbCreated: 0,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function pointBandCentroids(points, bandCount, width) {
  return Array.from({ length: bandCount }, (_, bandIndex) => {
    const start = Math.floor(
      (bandIndex * points.length) / bandCount,
    );
    const end = Math.max(
      start + 1,
      Math.floor(
        ((bandIndex + 1) * points.length) / bandCount,
      ),
    );
    return round(
      mean(points.slice(start, end).map((point) => point.x)) /
        width,
    );
  });
}

async function guideWaterBandCentroids(filePath, bandCount) {
  const { data, info } = await sharp(filePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Array.from({ length: bandCount }, (_, bandIndex) => {
    const top = Math.floor(
      (bandIndex * info.height) / bandCount,
    );
    const bottom = Math.max(
      top + 1,
      Math.floor(
        ((bandIndex + 1) * info.height) / bandCount,
      ),
    );
    let totalX = 0;
    let count = 0;
    for (let y = top; y < bottom; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const offset = (y * info.width + x) * info.channels;
        if (
          data[offset] === WATER_COLOR[0] &&
          data[offset + 1] === WATER_COLOR[1] &&
          data[offset + 2] === WATER_COLOR[2]
        ) {
          totalX += x / info.width;
          count += 1;
        }
      }
    }
    return count > 0 ? round(totalX / count) : null;
  });
}

function meanNullableDistance(left, right) {
  const distances = left
    .map((value, index) =>
      Number.isFinite(value) && Number.isFinite(right[index])
        ? Math.abs(value - right[index])
        : null,
    )
    .filter(Number.isFinite);
  return distances.length > 0
    ? round(mean(distances))
    : Number.POSITIVE_INFINITY;
}

function mean(values) {
  return (
    values.reduce((total, value) => total + value, 0) /
    Math.max(1, values.length)
  );
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

function round(value) {
  return Number(value.toFixed(6));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
