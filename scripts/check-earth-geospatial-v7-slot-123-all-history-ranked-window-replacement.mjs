import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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
  "owner-authorized-slot-123-expanded-real-measurement-window-scope-20260728";
const BEYOND_NINE_BY_NINE_AUTHORIZATION_ID =
  "owner-authorized-slot-123-thai-measurement-scope-beyond-9x9-no-rgb-20260729";
const WINDOW_PLAN_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json";
const WATER_PROFILE_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json";
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-all-history-window-replacement-checks";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-slot-123-all-history-window-replacement-check-" +
  createdAtUtc.replace(/[:.]/g, "-");

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action:
    "v7_slot_123_all_history_ranked_window_replacement_check_started",
  runId,
  kind: "measurement_window_replacement_check",
  status: "running",
  title:
    "The slot-123 all-history-ranked window replacement check started",
  titleZh: "slot-123 全历史排序窗口替换检查已启动",
  detail:
    "The independent no-RGB check will verify the one-slot replacement, source hashes, anonymous geometry reproduction, all-history selection evidence, SQLite rows, and no-compute boundary.",
  detailZh:
    "独立无RGB检查将核验单槽位替换、来源哈希、匿名几何复现、全历史选择证据、SQLite记录和无算力越界。",
  script: projectPath(import.meta.filename),
  currentStep: "check_slot_123_all_history_ranked_window_replacement",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

try {
  const latest = readJson(WINDOW_PLAN_POINTER_PATH);
  const plan = readJson(latest.runPath);
  const parentPlan = readJson(plan.parentWindowPlanPath);
  const selection = readJson(plan.replacementEvidence.path);
  const waterPointer = readJson(WATER_PROFILE_POINTER_PATH);
  const waterNaturalnessProfile = readJson(
    waterPointer.profilePath,
  );
  const currentAssignment = plan.assignments.find(
    (entry) => entry.slotId === SLOT_ID,
  );
  const parentAssignment = parentPlan.assignments.find(
    (entry) => entry.slotId === SLOT_ID,
  );
  const selectionCandidate = selection.rankings?.find(
    (entry) =>
      entry.candidateId === currentAssignment?.candidateId,
  );

  assert(
    [AUTHORIZATION_ID, BEYOND_NINE_BY_NINE_AUTHORIZATION_ID].includes(
      plan.replacementAuthorizationId,
    ) &&
      latest.replacementAuthorizationId ===
        plan.replacementAuthorizationId,
    "replacement authorization mismatch",
  );
  assertHash(
    plan.parentWindowPlanPath,
    plan.parentWindowPlanSha256,
  );
  assertHash(
    plan.replacementEvidence.path,
    plan.replacementEvidence.sha256,
  );
  assertHash(
    plan.candidateWindowsPath,
    plan.candidateWindowsSha256,
  );
  assert(
    currentAssignment?.candidateId ===
      latest.replacementCandidateId &&
      parentAssignment?.candidateId !==
        currentAssignment?.candidateId,
    "slot-123 replacement binding mismatch",
  );
  assert(
      selectionCandidate?.candidateId ===
      currentAssignment.candidateId &&
      selectionCandidate?.waterNaturalnessPassed === true &&
      (selectionCandidate?.rightOnlyPatternGatePassed === true ||
        selectionCandidate?.routeTopologyDiversityGatePassed === true) &&
      selectionCandidate?.readyForFullCompositionAudit ===
        true &&
      selection.selectionRule
        ?.routeAndFullCompositionStillRequireFinalConditionGuideAudit ===
        true,
    "all-history selection evidence mismatch",
  );

  const changedSlots = plan.assignments
    .filter((assignment) => {
      const parent = parentPlan.assignments.find(
        (entry) => entry.slotId === assignment.slotId,
      );
      return JSON.stringify(assignment) !== JSON.stringify(parent);
    })
    .map((entry) => entry.slotId);
  assert(
    changedSlots.length === 1 && changedSlots[0] === SLOT_ID,
    `unexpected changed slots: ${changedSlots.join(",")}`,
  );
  assertUnique(
    plan.assignments.map((entry) => entry.candidateId),
    "candidate identities",
  );
  assertUnique(
    plan.assignments.map(
      (entry) => entry.fingerprints.transformCanonical,
    ),
    "transform fingerprints",
  );
  assertNoOverlap(plan.assignments);

  const coarseProfile =
    buildMeasurementDerivedCoarseHydrologyProfile({
      assignment: currentAssignment,
      root: ROOT,
    });
  const halfWidths = buildMeasurementDerivedNetworkHalfWidths({
    pointCount: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
    startHalfWidth: 76,
    endHalfWidth: 140,
    coarseHydrologyProfile: coarseProfile,
  });
  const mainChannel =
    buildMeasurementDerivedAnonymousMainChannel({
      start: { x: 948, y: 0 },
      end: { x: 884, y: 768 },
      width: 1024,
      height: 768,
      coarseHydrologyProfile: coarseProfile,
      waterNaturalnessProfile,
      corridorHalfWidths: halfWidths,
    });
  const bandCentroids = pointBandCentroids(
    mainChannel.points,
    8,
    1024,
  );
  assert(
    JSON.stringify(bandCentroids) ===
      JSON.stringify(
        selectionCandidate.bandCentroids,
      ),
    "selected anonymous water corridor was not reproduced",
  );
  const interior = bandCentroids.slice(2, 7);
  assert(
    selectionCandidate.routeTopologyDiversityGatePassed === true ||
      (Math.min(...interior) <= 0.6 &&
        Math.max(...interior) - Math.min(...interior) >= 0.1),
    "selected window has neither water-corridor nor route-topology diversity",
  );
  assert(
    coarseProfile.measurementFingerprint ===
      currentAssignment.fingerprints.direct &&
      coarseProfile.identityBoundary?.historicalRgbRead === false &&
      coarseProfile.identityBoundary?.historicalLayoutRead === false,
    "measurement source or historical-read boundary mismatch",
  );
  assert(
    plan.selectionMethod
      ?.finalWaterAndRouteCompositionAuditRequired === true &&
      plan.selectionMethod?.historicalRgbRead === false &&
      plan.selectionMethod
        ?.exactRealWorldGeometryCarriedForward === false,
    "plan selection boundary mismatch",
  );
  assert(
    plan.outputBoundary?.imageGenerationStarted === false &&
      plan.outputBoundary?.rgbCreated === false &&
      plan.outputBoundary?.gpuTrainingStarted === false &&
      plan.outputBoundary?.runtimeFrameEligible === false &&
      plan.outputBoundary?.canEnterWorld === false,
    "replacement crossed the no-compute boundary",
  );

  const runRoot = path.dirname(path.resolve(ROOT, latest.runPath));
  const forbiddenFiles = fs
    .readdirSync(runRoot, { recursive: true })
    .filter((entry) =>
      /\.(png|jpe?g|webp|pt|pth|ckpt|safetensors)$/i.test(entry),
    );
  assert(
    forbiddenFiles.length === 0,
    `replacement run contains forbidden artifacts: ${forbiddenFiles.join(",")}`,
  );

  const database = new DatabaseSync(catalogPath, {
    readOnly: true,
  });
  const planArtifact = database
    .prepare(
      "SELECT logical_path, byte_size, sha256 FROM artifacts WHERE logical_path = ? ORDER BY modified_at_utc DESC LIMIT 1",
    )
    .get(latest.runPath);
  const selectionArtifact = database
    .prepare(
      "SELECT logical_path, byte_size, sha256 FROM artifacts WHERE logical_path = ? ORDER BY modified_at_utc DESC LIMIT 1",
    )
    .get(plan.replacementEvidence.path);
  const replacementEvents = database
    .prepare(
      "SELECT COUNT(*) AS count FROM program_events WHERE run_id = ?",
    )
    .get(plan.runId).count;
  database.close();
  assert(
    planArtifact?.sha256 === sha256File(latest.runPath) &&
      selectionArtifact?.sha256 ===
        sha256File(plan.replacementEvidence.path),
    "SQLite replacement artifact hashes are incomplete",
  );
  assert(
    replacementEvents >= 2,
    "SQLite bilingual replacement events are incomplete",
  );

  const finishedAtUtc = new Date().toISOString();
  const report = {
    schemaVersion:
      "earth-geospatial-v7-slot-123-all-history-window-replacement-check-v1",
    runId,
    status: "slot_123_all_history_ranked_window_replacement_passed",
    createdAtUtc,
    createdAtAsiaShanghai: formatShanghai(createdAtUtc),
    finishedAtUtc,
    finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
    authorizationId: plan.replacementAuthorizationId,
    slotId: SLOT_ID,
    replacementPlan: {
      runId: plan.runId,
      path: latest.runPath,
      sha256: sha256File(latest.runPath),
      parentCandidateId: parentAssignment.candidateId,
      selectedCandidateId: currentAssignment.candidateId,
      changedSlots,
    },
    allHistorySelection: {
      runId: selection.runId,
      path: plan.replacementEvidence.path,
      sha256: sha256File(plan.replacementEvidence.path),
      historicalConditionGuidesCompared:
        selection.selectionRule
          .allHistoricalConditionGuidesCompared,
      selectedBandCentroids: bandCentroids,
      minimumInteriorCentroid: Math.min(...interior),
      interiorCentroidRange:
        Math.max(...interior) - Math.min(...interior),
      finalWaterAndRouteCompositionAuditRequired: true,
    },
    sourceVerification: {
      measurementFingerprint:
        coarseProfile.measurementFingerprint,
      coarseHydrologyProfileSha256:
        coarseProfile.profileSha256,
      mainChannelGeometrySha256: mainChannel.geometrySha256,
      historicalRgbRead: false,
      historicalGeometryCopied: false,
      exactRealWorldGeometryCarriedForward: false,
    },
    sqliteVerification: {
      replacementPlanArtifactHashMatched: true,
      selectionArtifactHashMatched: true,
      replacementEvents,
    },
    outputBoundary: noComputeBoundary(),
  };
  const immutable = writeImmutableProgramRun({
    root: OUTPUT_ROOT,
    runId,
    fileName: "check-report.json",
    record: report,
    latest: {
      slotId: SLOT_ID,
      replacementPlanRunId: plan.runId,
      selectedCandidateId: currentAssignment.candidateId,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  });
  appendAiPainterProgramEvent({
    timestamp: finishedAtUtc,
    action:
      "v7_slot_123_all_history_ranked_window_replacement_check_completed",
    runId,
    kind: "measurement_window_replacement_check",
    status: "success",
    title:
      "The slot-123 all-history-ranked window replacement check passed",
    titleZh: "slot-123 全历史排序窗口替换检查通过",
    detail:
      `selected=${currentAssignment.candidateId}; changedSlots=1; historicalGuidesCompared=${plan.replacementEvidence.historicalConditionGuidesCompared}; SQLiteHashesMatched=true; imageGenerationStarted=false; gpuTrainingStarted=false`,
    detailZh:
      `已选择=${currentAssignment.candidateId}；修改槽位=1；比较历史引导图=${plan.replacementEvidence.historicalConditionGuidesCompared}；SQLite哈希一致=true；未启动图像生成；未启动GPU训练。`,
    script: projectPath(import.meta.filename),
    currentStep: "slot_123_window_replacement_check_passed",
    evidencePath: immutable.runPath,
    evidence: [
      immutable.runPath,
      latest.runPath,
      plan.replacementEvidence.path,
    ],
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        status: report.status,
        runId,
        reportPath: immutable.runPath,
        reportSha256: sha256File(immutable.runPath),
        selectedCandidateId: currentAssignment.candidateId,
        bandCentroids,
        minimumInteriorCentroid:
          report.allHistorySelection.minimumInteriorCentroid,
        interiorCentroidRange:
          report.allHistorySelection.interiorCentroidRange,
        historicalConditionGuidesCompared:
          plan.replacementEvidence
            .historicalConditionGuidesCompared,
        replacementEvents,
        imageGenerationStarted: false,
        rgbCreated: 0,
        gpuTrainingStarted: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const failedAtUtc = new Date().toISOString();
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    action:
      "v7_slot_123_all_history_ranked_window_replacement_check_failed",
    runId,
    kind: "measurement_window_replacement_check",
    status: "failed",
    title:
      "The slot-123 all-history-ranked window replacement check failed",
    titleZh: "slot-123 全历史排序窗口替换检查失败",
    detail: `${error instanceof Error ? error.message : String(error)}; imageGenerationStarted=false; gpuTrainingStarted=false`,
    detailZh: `${error instanceof Error ? error.message : String(error)}；未启动图像生成；未启动GPU训练。`,
    script: projectPath(import.meta.filename),
    currentStep: "slot_123_window_replacement_check_failed",
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });
  throw error;
}

function pointBandCentroids(points, bandCount, width) {
  return Array.from({ length: bandCount }, (_, bandIndex) => {
    const minimumY = (bandIndex / bandCount) * 768;
    const maximumY = ((bandIndex + 1) / bandCount) * 768;
    const selected = points.filter(
      (point, pointIndex) =>
        point.y >= minimumY &&
        (bandIndex === bandCount - 1
          ? point.y <= maximumY
          : point.y < maximumY) &&
        (pointIndex > 0 || bandIndex === 0),
    );
    assert(
      selected.length > 0,
      `main channel has no points in band ${bandIndex}`,
    );
    return round(
      selected.reduce((sum, point) => sum + point.x, 0) /
        selected.length /
        width,
    );
  });
}

function assertNoOverlap(assignments) {
  for (let left = 0; left < assignments.length; left += 1) {
    const a = assignments[left].sourcePixelWindow;
    for (
      let right = left + 1;
      right < assignments.length;
      right += 1
    ) {
      const b = assignments[right].sourcePixelWindow;
      const overlaps =
        a.left < b.left + b.width &&
        a.left + a.width > b.left &&
        a.top < b.top + b.height &&
        a.top + a.height > b.top;
      assert(
        !overlaps,
        `selected windows overlap: ${assignments[left].slotId} and ${assignments[right].slotId}`,
      );
    }
  }
}

function noComputeBoundary() {
  return {
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    runtimeFrameCreated: false,
    worldEntryStarted: false,
  };
}

function assertUnique(values, label) {
  assert(
    new Set(values).size === values.length,
    `${label} are not unique`,
  );
}

function assertHash(relativePath, expectedHash) {
  assert(
    sha256File(relativePath) === expectedHash,
    `artifact hash mismatch: ${relativePath}`,
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
  return Number(value.toFixed(8));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
