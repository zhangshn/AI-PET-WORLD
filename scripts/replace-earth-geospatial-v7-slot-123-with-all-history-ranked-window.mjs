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
const requestedCandidateId = valueFor("--candidate-id");
const AUTHORIZATION_ID =
  "owner-authorized-slot-123-expanded-real-measurement-window-scope-20260728";
const BEYOND_NINE_BY_NINE_AUTHORIZATION_ID =
  "owner-authorized-slot-123-thai-measurement-scope-beyond-9x9-no-rgb-20260729";
const BOUNDED_DATA_AUTHORIZATION_ID =
  "owner-authorized-v7-mvp64-gap38-real-geography-bounded-data-build-20260725";
const WINDOW_PLAN_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans";
const WINDOW_PLAN_POINTER_PATH = `${WINDOW_PLAN_ROOT}/latest.json`;
const SELECTION_POINTER_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-all-history-window-selections/latest.json";
const FAILURE_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-all-history-window-replacement-failures";

const createdAtUtc = new Date().toISOString();
const runId =
  "earth-geospatial-v7-mvp-window-plan-" +
  createdAtUtc.replace(/[:.]/g, "-");

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "v7_slot_123_all_history_ranked_window_replacement_started",
  runId,
  kind: "measurement_window_replacement",
  status: "running",
  title:
    "The slot-123 all-history-ranked real-measurement window replacement started",
  titleZh: "slot-123 全历史排序真实测量窗口替换已启动",
  detail:
    "The program will replace only the slot-123 binding with the selected unused Sakaerat/Wang Nam Khiao measurement window. It will not build RGB, start GPU training, or change any other slot.",
  detailZh:
    "程序只把slot-123绑定替换为已选择的未使用Sakaerat/Wang Nam Khiao测量窗口；不生成RGB、不启动GPU训练、不修改其他槽位。",
  script: projectPath(import.meta.filename),
  currentStep: "replace_only_slot_123_measurement_binding",
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

try {
  const parentPointer = readJson(WINDOW_PLAN_POINTER_PATH);
  const parentPlan = readJson(parentPointer.runPath);
  const candidates = readJson(parentPlan.candidateWindowsPath);
  const capacityGapList = readJson(parentPlan.capacityGapListPath);
  const selectionPointer = readJson(SELECTION_POINTER_PATH);
  const selection = readJson(selectionPointer.runPath);
  const replacementAuthorizationId = selection.authorizationId;
  assert(
    [AUTHORIZATION_ID, BEYOND_NINE_BY_NINE_AUTHORIZATION_ID].includes(
      replacementAuthorizationId,
    ),
    "selection authorization is outside the documented slot-123 scope",
  );
  const selectionCandidate = selection.rankings?.find(
    (entry) => entry.candidateId === requestedCandidateId,
  );

  assert(
    parentPlan.authorizationId === BOUNDED_DATA_AUTHORIZATION_ID &&
      parentPointer.authorizationId === BOUNDED_DATA_AUTHORIZATION_ID,
    "bounded data-build authorization mismatch",
  );
  assert(
    sha256File(parentPlan.candidateWindowsPath) ===
      parentPlan.candidateWindowsSha256,
    "candidate-window artifact hash mismatch",
  );
  assert(
    selectionPointer.status ===
      "unused_real_measurement_window_selected_for_full_all_history_composition_audit" &&
      selection.status === selectionPointer.status,
    "latest all-history window selection is not ready",
  );
  assert(
    /^sakaerat-measurement-window-r\d{2}-c\d{2}-v[23]$/.test(
      requestedCandidateId ?? "",
    ) &&
      selectionCandidate?.candidateId === requestedCandidateId,
    "requested candidate is not present in the all-history ranking",
  );
  assert(
    selectionCandidate?.waterNaturalnessPassed === true &&
      (selectionCandidate?.rightOnlyPatternGatePassed === true ||
        selectionCandidate?.routeTopologyDiversityGatePassed === true) &&
      selectionCandidate?.readyForFullCompositionAudit ===
        true,
    "selected candidate is not ready for the full composition audit",
  );
  assert(
    selection.selectionRule
      ?.routeAndFullCompositionStillRequireFinalConditionGuideAudit ===
      true,
    "selection does not require the final water-plus-route gate",
  );
  assert(
    selection.outputBoundary?.imageGenerationStarted === false &&
      selection.outputBoundary?.rgbCreated === false &&
      selection.outputBoundary?.gpuTrainingStarted === false,
    "selection crossed the RGB or GPU boundary",
  );

  const parentAssignment = parentPlan.assignments.find(
    (entry) => entry.slotId === SLOT_ID,
  );
  const slot = capacityGapList.plannedSlots.find(
    (entry) => entry.slotId === SLOT_ID,
  );
  const selectedCandidate = candidates.candidates.find(
    (entry) =>
      entry.candidateId === requestedCandidateId,
  );
  assert(
    parentAssignment && slot && selectedCandidate,
    "slot-123 replacement inputs are incomplete",
  );
  const previouslySelectedIds = new Set(
    parentPlan.assignments.map((entry) => entry.candidateId),
  );
  assert(
    !previouslySelectedIds.has(selectedCandidate.candidateId),
    "selected replacement window is not unused",
  );

  const assignments = parentPlan.assignments.map((assignment) =>
    assignment.slotId === SLOT_ID
      ? buildReplacementAssignment({
          parentAssignment,
          slot,
          candidate: selectedCandidate,
          measurementSupportScore:
            selectionCandidate.measurementSupportScore,
        })
      : structuredClone(assignment),
  );
  assertUnique(
    assignments.map((entry) => entry.candidateId),
    "selected candidate identities",
  );
  assertUnique(
    assignments.map(
      (entry) => entry.fingerprints.transformCanonical,
    ),
    "selected transform fingerprints",
  );
  assertNoOverlap(assignments);
  const changedSlots = assignments
    .filter(
      (assignment, index) =>
        JSON.stringify(assignment) !==
        JSON.stringify(parentPlan.assignments[index]),
    )
    .map((entry) => entry.slotId);
  assert(
    changedSlots.length === 1 && changedSlots[0] === SLOT_ID,
    `replacement changed unexpected slots: ${changedSlots.join(",")}`,
  );

  const plan = {
    ...structuredClone(parentPlan),
    runId,
    createdAtUtc,
    createdAtAsiaShanghai: formatShanghai(createdAtUtc),
    parentWindowPlanRunId: parentPlan.runId,
    parentWindowPlanPath: parentPointer.runPath,
    parentWindowPlanSha256: sha256File(parentPointer.runPath),
    replacementAuthorizationId,
    selectionMethod: {
      methodId:
        "all_history_condition_guide_water_corridor_risk_ranked_then_full_composition_gate_v1",
      statement:
        `Replace only slot-123 with a globally unused Thai measurement window inside ${selection.selectionRule.measurementCandidateScope ?? "the owner-authorized 9x9 scope"}, selected by the immutable ${selection.counts.unusedWindowsRanked}-window by ${selection.selectionRule.allHistoricalConditionGuidesCompared}-history risk ranking; water-only matches remain risk evidence and the unchanged full condition-guide transform and shared-skeleton gate remains mandatory before RGB.`,
      sourceDataset:
        "approved_sakaerat_wang_nam_khiao_measurement_package",
      historicalRgbRead: false,
      historicalConditionGuidesReadForAuditOnly: true,
      historicalGeometryCopied: false,
      exactRealWorldGeometryCarriedForward: false,
      finalWaterAndRouteCompositionAuditRequired: true,
      mirroredOrRotatedWindowAccepted: false,
      presetHomeSiteCreated: false,
    },
    replacementEvidence: {
      path: selectionPointer.runPath,
      sha256: sha256File(selectionPointer.runPath),
      selectionRunId: selection.runId,
      previousCandidateId: parentAssignment.candidateId,
      selectedCandidateId: selectedCandidate.candidateId,
      selectedByProgrammaticRanking: true,
      unusedWindowsCompared: selection.counts.unusedWindowsRanked,
      historicalConditionGuidesCompared:
        selection.selectionRule
          .allHistoricalConditionGuidesCompared,
      selectedBandCentroids:
        selectionCandidate.bandCentroids,
      selectedRouteTopology:
        selectionCandidate.routeTopology,
      routeTopologyDiversityGatePassed:
        selectionCandidate.routeTopologyDiversityGatePassed === true,
      historicalRgbRead: false,
      exactMeasurementGeometryCarriedIntoGameCoordinates: false,
    },
    assignments,
    counts: {
      ...structuredClone(parentPlan.counts),
      selectedWindows: assignments.length,
      remainingUnselectedWindows:
        candidates.candidates.length - assignments.length,
      rgbCreated: 0,
      gpuTrainingRuns: 0,
    },
    outputBoundary: {
      ...structuredClone(parentPlan.outputBoundary),
      imageGenerationStarted: false,
      rgbCreated: false,
      gpuTrainingStarted: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
    nextRequiredAction:
      "independently_check_the_replacement_then_rebuild_slot_123_world_facts_world_director_complete_map_task_and_23_channels_and_run_the_full_current_history_transform_and_shared_skeleton_composition_gate",
  };

  const immutable = writeImmutableProgramRun({
    root: WINDOW_PLAN_ROOT,
    runId,
    fileName: "window-plan.json",
    record: plan,
    latest: {
      contractId: plan.contractId,
      authorizationId: BOUNDED_DATA_AUTHORIZATION_ID,
      replacementAuthorizationId,
      candidateWindowsPath: plan.candidateWindowsPath,
      candidateWindowsSha256: plan.candidateWindowsSha256,
      capacityPlanRunId: plan.capacityPlanRunId,
      selectedWindowCount: assignments.length,
      replacementSlotId: SLOT_ID,
      replacementCandidateId: selectedCandidate.candidateId,
      replacementEvidencePath: plan.replacementEvidence.path,
      replacementEvidenceSha256: plan.replacementEvidence.sha256,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  });

  const finishedAtUtc = new Date().toISOString();
  appendAiPainterProgramEvent({
    timestamp: finishedAtUtc,
    action:
      "v7_slot_123_all_history_ranked_window_replacement_completed",
    runId,
    kind: "measurement_window_replacement",
    status: "success",
    title:
      "The slot-123 all-history-ranked real-measurement window replacement completed",
    titleZh: "slot-123 全历史排序真实测量窗口替换已完成",
    detail:
      `previous=${parentAssignment.candidateId}; selected=${selectedCandidate.candidateId}; changedSlots=1; historicalGuidesCompared=${selection.selectionRule.allHistoricalConditionGuidesCompared}; imageGenerationStarted=false; gpuTrainingStarted=false`,
    detailZh:
      `原窗口=${parentAssignment.candidateId}；新窗口=${selectedCandidate.candidateId}；修改槽位=1；比较历史引导图=${selection.selectionRule.allHistoricalConditionGuidesCompared}；未启动图像生成；未启动GPU训练。`,
    script: projectPath(import.meta.filename),
    currentStep: "slot_123_measurement_binding_replaced",
    evidencePath: immutable.runPath,
    evidence: [
      immutable.runPath,
      selectionPointer.runPath,
      parentPointer.runPath,
    ],
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        planPath: immutable.runPath,
        planSha256: sha256File(immutable.runPath),
        previousCandidateId: parentAssignment.candidateId,
        selectedCandidateId: selectedCandidate.candidateId,
        changedSlots,
        historicalConditionGuidesCompared:
          selection.selectionRule
            .allHistoricalConditionGuidesCompared,
        imageGenerationStarted: false,
        rgbCreated: 0,
        gpuTrainingStarted: false,
        nextRequiredAction: plan.nextRequiredAction,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const failedAtUtc = new Date().toISOString();
  const failureRunId =
    "earth-geospatial-v7-slot-123-all-history-window-replacement-failure-" +
    failedAtUtc.replace(/[:.]/g, "-");
  const failure = {
    schemaVersion:
      "earth-geospatial-v7-slot-123-all-history-window-replacement-failure-v1",
    runId: failureRunId,
    status: "failed",
    createdAtUtc,
    createdAtAsiaShanghai: formatShanghai(createdAtUtc),
    failedAtUtc,
    failedAtAsiaShanghai: formatShanghai(failedAtUtc),
    authorizationId: AUTHORIZATION_ID,
    slotId: SLOT_ID,
    errorCode:
      "slot_123_all_history_ranked_window_replacement_failed",
    errorMessage:
      error instanceof Error ? error.message : String(error),
    outputBoundary: noComputeBoundary(),
  };
  const immutableFailure = writeImmutableProgramRun({
    root: FAILURE_ROOT,
    runId: failureRunId,
    fileName: "failure.json",
    record: failure,
  });
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    action: failure.errorCode,
    runId: failureRunId,
    kind: "measurement_window_replacement",
    status: "failed",
    title:
      "The slot-123 all-history-ranked real-measurement window replacement failed",
    titleZh: "slot-123 全历史排序真实测量窗口替换失败",
    detail: `${failure.errorMessage}; imageGenerationStarted=false; gpuTrainingStarted=false`,
    detailZh: `${failure.errorMessage}；未启动图像生成；未启动GPU训练。`,
    script: projectPath(import.meta.filename),
    currentStep: "slot_123_measurement_binding_replacement_failed",
    evidencePath: immutableFailure.runPath,
    finalGameMapSuccess: false,
    canEnterWorld: false,
  });
  throw error;
}

function buildReplacementAssignment({
  parentAssignment,
  slot,
  candidate,
  measurementSupportScore,
}) {
  return {
    ...structuredClone(parentAssignment),
    slotId: slot.slotId,
    split: slot.split,
    regionalLandscapeType: slot.regionalLandscapeType,
    monsoonSeason: slot.monsoonSeason,
    coverageRole: slot.coverageRole,
    candidateId: candidate.candidateId,
    measurementSupportScore,
    measurementBounds: structuredClone(candidate.measurementBounds),
    sourcePixelWindow: structuredClone(candidate.sourcePixelWindow),
    metrics: structuredClone(candidate.metrics),
    fingerprints: structuredClone(candidate.fingerprints),
    targetEcologyIsDirectlyClaimedByWindowSelection: false,
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
  };
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
    conditionPackageBuilt: false,
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

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
