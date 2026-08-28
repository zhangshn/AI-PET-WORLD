import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  writeJsonAtomic,
} from "./ai-painter-program-event-store.mjs";
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./ai-pet-world-storage.mjs";

export const POST_DECODE_FAILURE_PLANNING_ROOT =
  ".runtime/ai-painter/stage4-post-decode-failure-bounded-candidate-plans";
export const RESPONSIBILITY_IDENTITIES = Object.freeze([
  "terrain_path_ground",
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
]);

export function adjudicatePostDecodeFailureBoundary({
  terminal,
  analysis,
  decision,
  review,
  modelSource,
}) {
  assert.equal(
    terminal.status,
    "stage0_real_visual_failure_adjudicated_closed",
    "failure adjudication terminal status mismatch",
  );
  assert.equal(
    analysis.classification,
    "post_decode_object_rgb_multisample_semantic_capacity_insufficient_confirmed",
    "failure classification mismatch",
  );
  assert.equal(decision.currentCandidateRejected, true);
  assert.equal(
    decision.nextAction,
    "reject_current_model_family_and_return_to_bounded_candidate_planning",
  );
  assert.equal(review.previewCount, 6);
  assert.equal(review.previewPassCount, 0);
  assert.equal(review.previewFailCount, 6);
  assert.equal(review.reviewThresholdsChanged, false);

  const objectIssueCodes = [
    "condition_object_footprints_reference_semantic_mismatch",
    "condition_object_tree_reference_semantic_mismatch",
    "condition_object_rock_reference_semantic_mismatch",
    "condition_object_vegetation_reference_semantic_mismatch",
  ];
  for (const item of review.reviews) {
    assert.equal(item.professionalAesthetic?.passed, true);
    for (const code of objectIssueCodes) {
      assert.ok(item.issueCodes.includes(code), `${code} is not persistent`);
    }
  }
  const routeFailureEpochs = review.reviews
    .filter((item) =>
      item.issueCodes.some((code) => code.includes("terrain_path_ground")),
    )
    .map((item) => item.epoch);
  assert.ok(routeFailureEpochs.length >= 2, "route failure is not persistent");

  assert.ok(
    modelSource.includes("nn.Conv2d(4, 64, 3, padding=1)"),
    "current object head input boundary changed",
  );
  assert.ok(
    modelSource.includes("torch.cat((decoded_rgb, mask), dim=1)"),
    "current object head source boundary changed",
  );
  assert.ok(
    modelSource.includes("stage4_post_decode_object_rgb_heads"),
    "current post-decode head is missing",
  );

  return {
    selectedBoundary:
      "post_decode_object_only_mask_local_head_input_and_responsibility_gap_confirmed",
    failureConcentration: {
      responsibilityBoundary:
        "global_visual_harmonization_and_native_complete_rgb_decode",
      persistentObjectClasses: objectIssueCodes.map((code) =>
        code
          .replace("condition_object_", "object_")
          .replace("_reference_semantic_mismatch", ""),
      ),
      routeFailureEpochs,
      professionalAestheticPassedAtAllFixedNodes: true,
    },
    whyCurrentStructureCannotResolve: [
      "each_object_rgb_head_receives_only_decoded_rgb_3_plus_own_mask_1",
      "full_23_channel_condition_representation_does_not_reach_each_post_decode_head",
      "object_only_heads_cannot_correct_persistent_route_boundary_identity",
      "all_four_object_local_responses_exist_but_reference_structure_remains_mismatched",
      "additional_epochs_or_same_route_retry_not_supported_by_fixed_timeline",
    ],
    selectedCandidate: {
      candidateKind:
        "post_decode_full_condition_route_and_object_responsibility_renderer",
      responsibilityIdentityOrder: RESPONSIBILITY_IDENTITIES,
      perResponsibilityInput: {
        decodedRgbChannels: 3,
        typedConditionChannels: 23,
        totalChannels: 26,
      },
      existingDerivedWidth: 64,
      perResponsibilityOutputChannels: 3,
      authoritativeGate: "same_identity_condition_mask",
      merge: "authoritative_mask_normalized_rgb_responsibility_merge",
    },
    structuralDifferenceFromRejectedCandidate: {
      before:
        "four object-only RGB heads consume decoded RGB plus one local mask",
      after:
        "five responsibility-isolated RGB branches consume decoded RGB plus the complete typed 23-channel condition representation and remain gated by their own authoritative mask",
      unchanged: [
        "64_approved_samples",
        "48_8_4_4_split",
        "frozen_autoencoder",
        "existing_loss_values_and_weights",
        "checkpoint_format",
        "machine_review_thresholds",
        "stage0_1_2_resolution_definitions",
      ],
    },
    viability: {
      worthEnteringCpuInactiveImplementation: true,
      reason:
        "the structural input and responsibility gap directly matches both persistent route and four-class semantic failures, while every dimension is derived from existing contracts",
      gpuOrTrainingAllowedNow: false,
    },
    nextAction:
      "implement_cpu_inactive_post_decode_full_condition_route_object_responsibility_renderer",
  };
}

export function materializePostDecodeFailureBoundedPlan({
  root = process.cwd(),
  sourceRunRoot,
  planningRunId,
  recordedAtUtc = new Date().toISOString(),
}) {
  assert.match(planningRunId ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/);
  const sourceRoot = resolveInside(root, sourceRunRoot);
  const required = {
    terminal: "failure-adjudication-terminal.json",
    analysis: "failure-analysis.json",
    decision: "failure-decision.json",
    review: "machine-review.json",
  };
  const evidence = {};
  const bindings = {};
  for (const [role, name] of Object.entries(required)) {
    const file = path.join(sourceRoot, name);
    assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), `${role} missing`);
    evidence[role] = readJson(file);
    bindings[role] = bind(root, file);
  }
  const terminal = evidence.terminal;
  assert.deepEqual(terminal.analysis, bindings.analysis);
  assert.deepEqual(terminal.decision, bindings.decision);

  const modelSourcePath = resolveInside(
    root,
    "ml/ai-painter/src/ai_painter/complete_world/model.py",
  );
  const modelSource = fs.readFileSync(modelSourcePath, "utf8");
  const adjudication = adjudicatePostDecodeFailureBoundary({
    ...evidence,
    modelSource,
  });
  const outputRoot = resolveInside(
    root,
    `${POST_DECODE_FAILURE_PLANNING_ROOT}/${planningRunId}`,
  );
  assert.equal(fs.existsSync(outputRoot), false, "planning output already exists");
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: false });
  const files = {
    problem: path.join(outputRoot, "problem-report.json"),
    boundary: path.join(outputRoot, "responsibility-boundary-analysis.json"),
    candidate: path.join(outputRoot, "bounded-candidate.json"),
    viability: path.join(outputRoot, "cpu-implementation-viability.json"),
    cpu: path.join(outputRoot, "cpu-report.json"),
    terminal: path.join(outputRoot, "phase-terminal.json"),
    capsule: path.join(outputRoot, "local-task-capsule.json"),
  };
  writeJsonAtomic(files.problem, {
    schemaVersion: "stage4-post-decode-failure-problem-v1",
    status: "current_candidate_rejected_after_0_of_6_fixed_reviews",
    sourceRunRoot,
    sourceEvidence: bindings,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.boundary, {
    schemaVersion: "stage4-post-decode-responsibility-boundary-analysis-v1",
    status: "uniquely_adjudicated",
    selectedBoundary: adjudication.selectedBoundary,
    failureConcentration: adjudication.failureConcentration,
    whyCurrentStructureCannotResolve:
      adjudication.whyCurrentStructureCannotResolve,
    modelSource: bind(root, modelSourcePath),
    recordedAtUtc,
  });
  writeJsonAtomic(files.candidate, {
    schemaVersion: "stage4-post-decode-bounded-candidate-v1",
    status: "cpu_inactive_candidate_planned_not_implemented",
    selectedCandidate: adjudication.selectedCandidate,
    structuralDifferenceFromRejectedCandidate:
      adjudication.structuralDifferenceFromRejectedCandidate,
    freeArchitectureParameterChosen: false,
    lossChanged: false,
    dataChanged: false,
    thresholdChanged: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.viability, {
    schemaVersion: "stage4-post-decode-candidate-viability-v1",
    status: adjudication.viability.worthEnteringCpuInactiveImplementation
      ? "worth_cpu_inactive_implementation"
      : "not_eligible",
    ...adjudication.viability,
    nextAction: adjudication.nextAction,
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.cpu, {
    schemaVersion: "stage4-post-decode-failure-bounded-planner-cpu-report-v1",
    status: "passed",
    sourceEvidenceVerified: true,
    currentModelSourceVerified: true,
    exactResponsibilityIdentityCount: RESPONSIBILITY_IDENTITIES.length,
    derivedInputChannels: 26,
    freeParameterChosen: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.terminal, {
    schemaVersion: "stage4-post-decode-failure-bounded-planning-terminal-v1",
    executionState: "completed",
    status: "bounded_candidate_planning_completed",
    planningRunId,
    sourceFailureTerminal: bindings.terminal,
    problem: bind(root, files.problem),
    responsibilityBoundary: bind(root, files.boundary),
    candidate: bind(root, files.candidate),
    viability: bind(root, files.viability),
    cpuReport: bind(root, files.cpu),
    nextAction: adjudication.nextAction,
    ownerAuthorizationRequired: false,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    recordedAtUtc,
  });
  writeJsonAtomic(files.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v2",
    module: "AI Painter R5 / Stage4",
    status: "bounded_candidate_planning_completed",
    planningRunId,
    latestTerminal: bind(root, files.terminal),
    nextLocalAction: adjudication.nextAction,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  });
  for (const file of Object.values(files)) index(file, root, planningRunId);
  appendAiPainterProgramEvent({
    id: `stage4-post-decode-bounded-plan-${planningRunId}`,
    timestamp: recordedAtUtc,
    action: "stage4_post_decode_failure_bounded_candidate_planning",
    runId: planningRunId,
    kind: "cpu_autonomous_candidate_planning",
    status: "success",
    title: "Stage4 bounded candidate planning completed",
    titleZh: "Stage4有界候选规划已由本地程序完成",
    detailZh:
      "已定位责任边界、形成唯一结构差异并裁决值得进入CPU未激活实现；未启动GPU或训练。",
    evidencePath: relative(root, files.terminal),
    evidenceSha256: sha256File(files.terminal),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  });
  return {
    status: "bounded_candidate_planning_completed",
    planningRunId,
    selectedBoundary: adjudication.selectedBoundary,
    selectedCandidate: adjudication.selectedCandidate.candidateKind,
    worthEnteringCpuInactiveImplementation:
      adjudication.viability.worthEnteringCpuInactiveImplementation,
    nextAction: adjudication.nextAction,
    terminal: bind(root, files.terminal),
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function resolveInside(root, relativePath) {
  assert.ok(
    typeof relativePath === "string" &&
      relativePath &&
      !path.isAbsolute(relativePath) &&
      !/^[A-Za-z]:[\\/]/.test(relativePath) &&
      !relativePath.split(/[\\/]/).includes(".."),
    "path must be project-relative",
  );
  const base = path.resolve(root);
  const absolute = path.resolve(base, relativePath);
  assert.ok(absolute.startsWith(`${base}${path.sep}`), "path escapes project root");
  return absolute;
}
function relative(root, file) {
  return path.relative(path.resolve(root), file).replaceAll("\\", "/");
}
function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function bind(root, file) {
  return { path: relative(root, file), sha256: sha256File(file) };
}
function index(file, root, runId) {
  const stat = fs.statSync(file);
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: "stage4_post_decode_failure_bounded_planning_v1",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha256File(file),
  });
}
