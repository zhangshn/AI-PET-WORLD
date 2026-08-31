import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import {
  advanceCurrentExecutionRegistry,
  CURRENT_EXECUTION_REGISTRY_ROOT,
  initializeCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../../src/server/ai-painter-current-execution-registry.mjs";
import {
  V2_ARCHITECTURE_ID,
  V2_MACHINE_REVIEW_EXECUTION_SCHEMA,
  executeStage4V2FrozenProfessionalAestheticAudit,
  executeStage4V2MachineReview,
  validateReviewExecutionBinding,
} from "../lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs";
import {
  revalidateMachineReviewConditionEvidence,
  revalidateMachineReviewProfessionalEvidence,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs";

const REPO = process.cwd();
const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-review-execution-"));
try {
  const fixture = await materializeFixture(root);
  const conditionAudit = async ({ record }) =>
    buildConditionAuditFixture(root, record);
  const professionalAudit = async (input) =>
    buildProfessionalAuditFixture(input);
  const result = await executeStage4V2MachineReview(fixture.binding, {
    projectRoot: root,
    now: () => new Date("2026-09-01T02:00:00.000Z"),
    professionalAudit,
    conditionAudit,
  });
  assert.equal(result.status, "stage4_v2_machine_review_failed");
  assert.equal(result.reviewNodeCount, 5);
  assert.equal(result.previewPassCount, 4);
  assert.equal(result.previewFailCount, 1);
  assert.deepEqual(result.reviews.map((row) => row.epoch), [1, 5, 10, 20, 30]);
  assert.deepEqual(result.reviews.find((row) => row.epoch === 20).issueCodes, ["professional_quiet_region_missing"]);
  assert.equal(JSON.stringify(result).includes("nextTrainingTarget"), false);
  assert.equal(result.reviewTrainingSeparation.reviewResultsUsedAsTrainingTarget, false);
  assert.equal(result.gpuStartedByReview, false);
  assert.equal(result.optimizerCreatedByReview, false);
  assert.equal(result.backwardExecutedByReview, false);
  assert.equal(result.weightsModifiedByReview, false);
  assert.equal(result.trainingStartedByReview, false);

  const validatedBinding = validateReviewExecutionBinding(fixture.binding, root);
  assert.notEqual(
    fixture.registryTransaction.currentStaged.path,
    ".runtime/ai-painter/current-execution-registry/current.json",
    "fixture must preserve a transaction-local staged path",
  );
  assert.equal(fixture.binding.currentRegistrySnapshot.path,
    fixture.registryTransaction.currentStaged.path,
  "review binding did not persist the immutable transaction-local snapshot");
  const realProfessional = await executeStage4V2FrozenProfessionalAestheticAudit(
    validatedBinding,
    validatedBinding.previews[0],
    { projectRoot: root },
  );
  assert.equal(realProfessional.candidate.imageSha256,
    validatedBinding.previews[0].sha256,
  "real frozen professional auditor did not bind the immutable PNG bytes");
  assert.equal(await revalidateMachineReviewConditionEvidence({
    value: result,
    validatedBinding,
    projectRoot: root,
    conditionAudit,
  }), true, "frozen condition evidence did not pass exact recomputation");
  assert.equal(await revalidateMachineReviewProfessionalEvidence({
    value: result,
    validatedBinding,
    projectRoot: root,
    professionalAudit,
  }), true, "frozen professional evidence did not pass exact recomputation");

  const adjudicating = await advanceFixtureRegistryPhase(
    root, fixture.registryPublication, "adjudicating");
  assert.equal(validateReviewExecutionBinding(fixture.binding, root)
    .smokeRunId, fixture.binding.smokeRunId,
  "review binding became invalid after a real adjudicating registry revision");
  const finalizing = await advanceFixtureRegistryPhase(
    root, adjudicating, "finalizing");
  assert.equal(finalizing.registry.executionState, "finalizing");
  assert.equal(validateReviewExecutionBinding(fixture.binding, root)
    .smokeRunId, fixture.binding.smokeRunId,
  "review binding became invalid after a real finalizing registry revision");

  await negativeConditionEvidence("empty issues with missing water/path metrics", result,
    validatedBinding, conditionAudit,
    (value) => { delete value.reviews[0].conditionAlignment.channelAudits; });
  await negativeConditionEvidence("frozen channel threshold tampering", result,
    validatedBinding, conditionAudit,
    (value) => {
      value.reviews[0].conditionAlignment.channelAudits[0]
        .thresholds.minimumSpatialIntersection = 0;
    });
  await negativeConditionEvidence("object mask path tampering", result,
    validatedBinding, conditionAudit,
    (value) => {
      value.reviews[0].conditionAlignment.objectSemanticAudits[0]
        .expectedChannelPath = "fixtures/foreign-object-mask.png";
    });
  await negativeConditionEvidence("object mask hash tampering", result,
    validatedBinding, conditionAudit,
    (value) => {
      value.reviews[0].conditionAlignment.objectSemanticAudits[0]
        .expectedChannelSha256 = "0".repeat(64);
    });
  await negativeConditionEvidence("water/path metric tampering", result,
    validatedBinding, conditionAudit,
    (value) => {
      value.reviews[0].conditionAlignment.channelAudits[1]
        .spatialIntersection = 1;
    });
  await negativeConditionEvidence("hydrology evidence tampering", result,
    validatedBinding, conditionAudit,
    (value) => {
      value.reviews[0].conditionAlignment.hydrologyConnectivityAudit
        .flowingWaterRequired = true;
    });
  await negativeConditionEvidence("condition-pack identity tampering", result,
    validatedBinding, conditionAudit,
    (value) => {
      value.reviews[0].conditionAlignment.conditionPackFileSha256 = "f".repeat(64);
    });
  await negativeConditionEvidence("formal issue-code tampering", result,
    validatedBinding, conditionAudit,
    (value) => {
      value.reviews[0].conditionAlignment.issues = [{
        code: "condition_terrain_path_ground_spatial_distribution_mismatch",
      }];
    });
  await negativeProfessionalEvidence(
    "coherent professional metric forgery",
    result,
    validatedBinding,
    professionalAudit,
    (value) => {
      const row = value.reviews[0];
      row.professionalAesthetic.candidate.multiscaleTextureValues
        .native_edge_density_004 += 0.000001;
    },
  );
  await negativeProfessionalEvidence(
    "coherent professional image identity forgery",
    result,
    validatedBinding,
    professionalAudit,
    (value) => {
      const row = value.reviews[0];
      row.candidatePreview.sha256 = "0".repeat(64);
      row.professionalAesthetic.candidate.imageSha256 = "0".repeat(64);
    },
  );

  negative("preview SHA replacement", fixture.binding, (value) => {
    value.previews[0].sha256 = "0".repeat(64);
  }, /preview_epoch_1 SHA-256 mismatch/u);
  negative("latest selector", fixture.binding, (value) => {
    value.previews[0].path = ".runtime/latest.json";
  }, /latest selector forbidden/u);
  negative("cross-package preview", fixture.binding, (value) => {
    value.previews[0].executionPackageIdentity = "other-package-identity-12345";
  }, /strictly equal/u);
  const snapshotCopyPath = write(
    root,
    "fixtures/current-registry-snapshot-substitution.json",
    fs.readFileSync(path.join(root, fixture.binding.currentRegistrySnapshot.path)),
  );
  negative("immutable current registry snapshot path substitution", fixture.binding, (value) => {
    value.currentRegistrySnapshot.path = bind(root, snapshotCopyPath).path;
  }, /current registry snapshot path mismatch/u);
  negative("immutable current registry snapshot hash tampering", fixture.binding, (value) => {
    value.currentRegistrySnapshot.sha256 = "0".repeat(64);
  }, /currentRegistrySnapshot SHA-256 mismatch/u);
  negativeBoundFile("immutable current registry snapshot content tampering", fixture.binding,
    fixture.binding.currentRegistrySnapshot.path,
    (value) => { value.activity = "tampered-review-activity"; },
    (value, file) => { value.currentRegistrySnapshot.sha256 = sha(file); },
    /current staged SHA-256 differs|transaction SHA-256 does not bind immutable snapshot/u);
  negativeBoundFile("transaction current staged path tampering", fixture.binding,
    fixture.binding.currentRegistryTransaction.path,
    (value) => {
      const stagedSource = path.join(root, value.currentStaged.path);
      const replacement = write(root, "fixtures/substituted-current.staged.json",
        fs.readFileSync(stagedSource));
      value.currentStaged = bind(root, replacement);
    },
    (value, file) => { value.currentRegistryTransaction.sha256 = sha(file); },
    /current staged registry path mismatch/u);
  negativeBoundFile("transaction current staged hash tampering", fixture.binding,
    fixture.binding.currentRegistryTransaction.path,
    (value) => { value.currentStaged.sha256 = "0".repeat(64); },
    (value, file) => { value.currentRegistryTransaction.sha256 = sha(file); },
    /transaction current staged SHA-256 differs|currentRegistryTransaction\.currentStaged SHA-256 mismatch/u);
  negative("old qualification authority", fixture.binding, (value) => {
    const file = path.join(root, value.readonlyGpuQualificationTerminal.path);
    const terminal = JSON.parse(fs.readFileSync(file, "utf8"));
    terminal.status = "stage4_v2_cpu_contract_acceptance_passed_inactive";
    fs.writeFileSync(file, `${JSON.stringify(terminal, null, 2)}\n`);
    value.readonlyGpuQualificationTerminal.sha256 = sha(file);
  }, /qualification.*status|Expected values/u);
  process.stdout.write("Stage4 V2 machine-review execution adapter tests passed.\n");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

async function negativeConditionEvidence(
  name,
  source,
  validatedBinding,
  conditionAudit,
  mutate,
) {
  const value = structuredClone(source);
  mutate(value);
  await assert.rejects(
    revalidateMachineReviewConditionEvidence({
      value,
      validatedBinding,
      projectRoot: root,
      conditionAudit,
    }),
    /condition-alignment evidence differs from frozen auditor recomputation/u,
    name,
  );
}

async function negativeProfessionalEvidence(
  name,
  source,
  validatedBinding,
  professionalAudit,
  mutate,
) {
  const value = structuredClone(source);
  mutate(value);
  await assert.rejects(
    revalidateMachineReviewProfessionalEvidence({
      value,
      validatedBinding,
      projectRoot: root,
      professionalAudit,
    }),
    /professional-aesthetic evidence differs from frozen auditor recomputation|preview binding differs/u,
    name,
  );
}

function buildProfessionalAuditFixture({
  imagePath,
  thresholdContract,
  expectedStyleFingerprintSha256,
}) {
  const thresholds = thresholdContract.professionalAestheticThresholds;
  const failed = imagePath.includes("epoch-020");
  const quietRegionVariance = failed
    ? thresholds.quietRegionUpperEnvelope.value + 0.000001
    : 0;
  const issues = failed ? [{
    code: "professional_quiet_region_missing",
    severity: "error",
    affectedRegion: "whole_frame",
    nextTrainingTarget: "forbidden_hint",
  }] : [];
  return {
    schemaVersion: "ai-painter-stage4-v2-professional-aesthetic-audit-v1",
    status: failed ? "professional_aesthetic_failed" : "professional_aesthetic_passed",
    passed: !failed,
    method: "explicit_frozen_style_fingerprint_multiscale_texture_envelope_v2",
    styleFingerprint: {
      fingerprintId: thresholdContract.styleFingerprint.fingerprintId,
      sha256: expectedStyleFingerprintSha256,
    },
    candidate: {
      imageSha256: sha(imagePath),
      multiscaleTextureValues: Object.fromEntries(
        Object.keys(thresholds.multiscaleTextureUpperEnvelope.axes)
          .map((name) => [name, 0]),
      ),
      quietRegionVariance,
      textureHierarchyRatio: 0,
    },
    textureViolations: [],
    issues,
  };
}

function buildConditionAuditFixture(projectRoot, record) {
  const conditionPackPath = path.join(projectRoot,
    record.conditionBinding.conditionPackPath);
  const pack = JSON.parse(fs.readFileSync(conditionPackPath, "utf8"));
  const channel = (id) => pack.channels.find((item) => item.id === id);
  const channelAudit = (channelId, thresholds) => ({
    channelId,
    expectedChannelPath: channel(channelId).path,
    expectedChannelSha256: channel(channelId).sha256,
    expectedNonZeroRatio: 0.125,
    actualSignalRatio: 0.13,
    rawActualSignalRatio: 0.13,
    classifierMode: `${channelId}_fixture_classifier_v1`,
    signalIsolation: null,
    boundaryContactAudit: channelId === "terrain_path_ground" ? {
      contractVersion: "condition-semantic-boundary-contact-v3",
      bandPixels: 6,
      expectedCounts: { north: 6, east: 0, south: 6, west: 0 },
      actualCounts: { north: 6, east: 0, south: 6, west: 0 },
      rawActualCounts: { north: 6, east: 0, south: 6, west: 0 },
      rawActualMaximumRuns: { north: 6, east: 0, south: 6, west: 0 },
      rawBoundaryComponentStats: {},
      requiredSides: ["north", "south"],
      actualContactSides: ["north", "south"],
      rawActualContactSides: ["north", "south"],
      unexpectedContactSignalMode:
        "full_frame_raw_path_boundary_connected_component_minimum_500_pixels_and_6_contact_pixels_v2",
      missingRequiredSides: [],
      unexpectedContactSides: [],
      passed: true,
    } : null,
    absenceExpected: false,
    coverageRatio: 1.04,
    spatialIntersection: 0.81,
    centroidDistance: 0.02,
    expectedCentroid: { x: 0.5, y: 0.5 },
    actualCentroid: { x: 0.51, y: 0.49 },
    thresholds,
    passed: true,
    issues: [],
  });
  const objectAudit = (channelId) => ({
    channelId,
    expectedChannelPath: channel(channelId).path,
    expectedChannelSha256: channel(channelId).sha256,
    status: "object_semantic_visual_response_passed",
    passed: true,
    expectedNonZeroRatio: 0.01,
    inside: { pixelCount: 25, meanRgb: [80, 100, 60], meanEdge: 4.5 },
    surroundingRing: { pixelCount: 50, meanRgb: [70, 90, 50], meanEdge: 3.5 },
    colorDistance: 17.3205,
    edgeDifference: 1,
    edgeRatio: 1.2857,
    localResponsePassed: true,
    referenceComparisonMode: "post_generation_held_out_masked_rgb_edge_correlation_v1",
    referenceResponse: {
      maskedPixelCount: 25,
      maskedRgbMae: 0.04,
      maskedEdgeMae: 0.03,
      maskedLumaCorrelation: 0.4,
    },
    referenceThresholds: {
      maximumMaskedRgbMae: channelId === "object_rock" ? 0.2 : 0.18,
      maximumMaskedEdgeMae: 0.12,
      minimumMaskedLumaCorrelation: 0.08,
      highFidelityFallbackMaximumRgbMae: 0.08,
      highFidelityFallbackMaximumEdgeMae: 0.06,
    },
    thresholds: {
      minimumColorDistance: 0.8,
      minimumEdgeDifference: 0.035,
      minimumEdgeRatio: 1.002,
      supportRadiusPixels: 12,
    },
    thresholdCalibration:
      "owner_and_machine_approved_mvp64_object_response_p05_baseline_v1",
    priorAcceptanceThresholdChanged: false,
    issues: [],
  });
  return {
    schemaVersion: "ai-assisted-condition-alignment-audit-v1",
    status: "condition_alignment_passed",
    passed: true,
    formalConditionalTrainingEligible: false,
    conditionPackId: pack.conditionPackId,
    conditionPackPath: record.conditionBinding.conditionPackPath,
    conditionPackFileSha256: sha(conditionPackPath),
    canvas: pack.canvas,
    method: "season_aware_water_path_alignment_plus_object_mask_local_visual_response_v6",
    waterClassifier: {
      mode: "condition_presence_aware_water_signal_v3",
      conditionPresentMode: "condition_present_broad_freshwater_color_signal_v1",
      conditionAbsentMode:
        "condition_absent_strong_blue_dominance_plus_16px_dense_surface_v2",
      blockSizePixels: 16,
      minimumBlockSignalRatio: 0.35,
      acceptanceThresholdsChanged: false,
    },
    pathClassifier: {
      mode: "fixture_wet_path_v1",
      season: pack.reviewSubject.monsoonSeason,
      source: "record.classification.monsoonSeason",
      signalIsolationMode: "condition_supported_connected_components_v1",
      supportCorridorRadiusPixels: 48,
      acceptanceThresholdsChanged: false,
    },
    hydrologyConnectivityAudit: {
      contractVersion: "flowing-water-world-connectivity-v1",
      status: "not_applicable_no_flowing_water_contract",
      passed: true,
      landscapeType: pack.reviewSubject.regionalLandscapeType,
      flowingWaterRequired: false,
      connectivityBlueprintPath: null,
      externalWaterPortIds: [],
      upstreamPortId: null,
      downstreamPortId: null,
      expectedBoundarySides: [],
      issues: [],
    },
    channelAudits: [
      channelAudit("terrain_water", {
        minimumSpatialIntersection: 0.5,
        maximumCentroidDistance: 0.12,
        minimumCoverageRatio: 0.35,
        maximumCoverageRatio: 2.5,
        maximumAbsentSignalRatio: 0.005,
      }),
      channelAudit("terrain_path_ground", {
        minimumSpatialIntersection: 0.25,
        maximumCentroidDistance: 0.25,
        minimumCoverageRatio: 0.25,
        maximumCoverageRatio: 3,
        maximumAbsentSignalRatio: 0,
      }),
    ],
    objectSemanticAudits: [
      "object_footprints", "object_tree", "object_rock", "object_vegetation",
      "focal_area",
    ].map((id) => id === "focal_area"
      ? { channelId: id, passed: true, status: "not_applicable_empty_object_semantic_mask", issues: [] }
      : objectAudit(id)),
    issues: [],
  };
}

async function materializeFixture(projectRoot) {
  const copy = (relative) => {
    const target = path.join(projectRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(REPO, relative), target);
    return bind(projectRoot, target);
  };
  const threshold = copy("data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json");
  const thresholdValue = JSON.parse(fs.readFileSync(path.join(projectRoot, threshold.path), "utf8"));
  copy("scripts/lib/ai-assisted-condition-alignment.mjs");
  copy("scripts/lib/ai-assisted-professional-aesthetic.mjs");
  copy("scripts/lib/ai-assisted-style-fingerprint.mjs");
  const styleFingerprint = copy(thresholdValue.styleFingerprint.path);

  const packageId = "stage4-v2-controlled-smoke-package-fixture";
  const runId = "stage4-v2-controlled-smoke-run-fixture";
  const outputDirectory = `.runtime/ai-painter/stage4-v2-controlled-smokes/${runId}`;
  const objectMasks = ["object_footprints", "object_tree", "object_rock", "object_vegetation"].map((role) => {
    const file = write(projectRoot, `fixtures/${role}.png`, Buffer.from(`${role}-mask`));
    return { role, ...bind(projectRoot, file) };
  });
  const conditionPackPath = writeJson(projectRoot, "fixtures/condition-pack.json", {
    conditionPackId: "fixture-condition-pack-194",
    worldId: "fixture-world",
    tick: 1,
    canvas: { width: 256, height: 192 },
    reviewSubject: { rebuild64SequenceSeriesId: "fixture-series", regionalLandscapeType: "fixture-landscape", monsoonSeason: "wet" },
    channels: [
      ...objectMasks.map((mask) => ({ id: mask.role, path: mask.path, sha256: mask.sha256 })),
      ...["terrain_water", "terrain_path_ground", "focal_area"].map((id) => ({
        id, path: objectMasks[0].path, sha256: objectMasks[0].sha256,
      })),
      ...Array.from({ length: 16 }, (_, index) => ({ id: `fixture_channel_${index}`, path: objectMasks[0].path, sha256: objectMasks[0].sha256 })),
    ],
  });
  const conditionPack = { ...bind(projectRoot, conditionPackPath), channelCount: 23 };
  const referencePath = write(projectRoot, "fixtures/reference.png", Buffer.from("reference-rgb"));
  const referenceRgb = bind(projectRoot, referencePath);
  const qualificationPath = writeJson(projectRoot, "fixtures/qualification-terminal.json", {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-terminal-v1",
    status: "stage4_v2_readonly_gpu_qualification_passed",
    executionState: "completed",
    capabilityVersion: V2_ARCHITECTURE_ID,
    runId: "fixture-qualification-run",
  });
  const qualification = bind(projectRoot, qualificationPath);
  const reviewBindingId = "stage4-v2-review-binding-fixture-0001";
  const reviewPrograms = {
    conditionAlignment: thresholdValue.implementationProvenance.conditionAlignment,
    professionalAesthetic: {
      path: thresholdValue.implementationProvenance.professionalAesthetic.path,
      sha256: thresholdValue.implementationProvenance.professionalAesthetic.sha256,
      role: thresholdValue.implementationProvenance.professionalAesthetic.role,
    },
    styleFeatureExtractor: thresholdValue.implementationProvenance.styleFeatureExtractor,
  };
  const thresholdBinding = { schemaVersion: thresholdValue.schemaVersion, ...threshold };
  const smokePackagePath = writeJson(projectRoot, "fixtures/smoke-package.json", {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-package-v1",
    status: "reviewing",
    architectureId: V2_ARCHITECTURE_ID,
    packageId,
    runId,
    outputDirectory,
    reviewExecutionBindingId: reviewBindingId,
    readonlyGpuQualificationTerminal: qualification,
    machineReviewInputs: {
      thresholdContract: thresholdBinding,
      conditionPack,
      referenceRgb,
      objectMasks,
      styleFingerprint,
      reviewPrograms,
    },
  });
  const smokePackage = bind(projectRoot, smokePackagePath);
  const registry = await materializeRealReviewRegistryTransaction(projectRoot, {
    packageId,
    runId,
  });
  const previewBytes = await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: { r: 42, g: 96, b: 64 },
    },
  }).png().toBuffer();
  const previews = [1, 5, 10, 20, 30].map((epoch) => {
    const file = write(projectRoot, `${outputDirectory}/fixed-epoch-previews/epoch-${String(epoch).padStart(3, "0")}.png`, previewBytes);
    return { epoch, executionPackageIdentity: packageId, ...bind(projectRoot, file) };
  });
  return {
    binding: {
      schemaVersion: V2_MACHINE_REVIEW_EXECUTION_SCHEMA,
      status: "active_readonly_machine_review",
      architectureId: V2_ARCHITECTURE_ID,
      stage: "controlled_smoke",
      reviewBindingId,
      executionPackageIdentity: packageId,
      smokeRunId: runId,
      bindingPolicy: {
        explicitArtifactsOnly: true,
        latestPointerAllowed: false,
        historicalRunSelectionAllowed: false,
        crossExecutionPackageEvidenceAllowed: false,
        thresholdOverrideAllowed: false,
        reviewOutputMayBecomeTrainingTarget: false,
      },
      thresholdContract: thresholdBinding,
      reviewPrograms,
      currentRegistryTransaction: registry.currentRegistryTransaction,
      currentRegistrySnapshot: registry.currentRegistrySnapshot,
      smokePackage,
      readonlyGpuQualificationTerminal: qualification,
      conditionPack,
      referenceRgb,
      objectMasks,
      styleFingerprint,
      previews,
    },
    registryTransaction: registry.transaction,
    registryPublication: registry.publication,
  };
}

async function materializeRealReviewRegistryTransaction(projectRoot, { packageId, runId }) {
  const baselineRoot = ".runtime/fixture/review-registry-baseline";
  const candidatePath = writeJson(projectRoot, `${baselineRoot}/bounded-candidate.json`, {
    schemaVersion: "stage4-post-decode-bounded-candidate-v1",
    status: "cpu_inactive_candidate_planned_not_implemented",
    selectedCandidate: { candidateKind: "fixture_review_registry_baseline" },
  });
  const candidateBinding = bind(projectRoot, candidatePath);
  const initialTerminalPath = writeJson(projectRoot, `${baselineRoot}/phase-terminal.json`, {
    schemaVersion: "stage4-post-decode-failure-bounded-planning-terminal-v1",
    executionState: "completed",
    status: "bounded_candidate_planning_completed",
    planningRunId: "fixture-review-registry-baseline",
    nextAction: "fixture-review-registry-baseline-action",
    candidate: candidateBinding,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  });
  const initialTerminalBinding = bind(projectRoot, initialTerminalPath);
  const initialCapsulePath = writeJson(projectRoot, `${baselineRoot}/local-task-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v2",
    latestTerminal: initialTerminalBinding,
  });
  const formalRoot = `${baselineRoot}/latest-training`;
  const latestTrainingTerminalPath = writeJson(projectRoot, `${formalRoot}/phase-terminal.json`, {
    schemaVersion: "stage4-post-decode-object-rgb-stage0-terminal-v1",
    executionState: "completed",
    status: "post_decode_object_rgb_stage0_real_visual_failure",
    runId: "fixture-review-registry-baseline-training",
  });
  writeJson(projectRoot, `${formalRoot}/execution-state.json`, {
    status: "completed",
    phase: "machine_review_completed",
  });
  writeJson(projectRoot, `${formalRoot}/machine-review.json`, {
    previewCount: 6,
    previewPassCount: 0,
    previewFailCount: 6,
  });
  writeJson(projectRoot, `${formalRoot}/training-output/progress.json`, {
    phase: "training_completed",
    epoch: 40,
    epochTarget: 40,
  });
  const initial = await initializeCurrentExecutionRegistry({
    projectRoot,
    currentTaskCapsulePath: bind(projectRoot, initialCapsulePath).path,
    currentTaskTerminalPath: initialTerminalBinding.path,
    currentCandidatePath: candidateBinding.path,
    latestTrainingTerminalPath: bind(projectRoot, latestTrainingTerminalPath).path,
    archivedEvidenceNamespaces: [".runtime/fixture/archived"],
  });

  const reviewRoot = ".runtime/fixture/review-registry-active";
  const evidencePath = writeJson(projectRoot, `${reviewRoot}/evidence.json`, {
    schemaVersion: "fixture-review-registry-evidence-v1",
    status: "verified",
  });
  const evidenceBinding = bind(projectRoot, evidencePath);
  const terminalPath = writeJson(projectRoot, `${reviewRoot}/phase-terminal.json`, {
    schemaVersion: "fixture-review-registry-source-terminal-v1",
    executionState: "completed",
    status: "controlled_smoke_training_and_validation_completed",
  });
  const capsulePath = writeJson(projectRoot, `${reviewRoot}/local-task-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    integrity: { status: "verified" },
    evidence: [{
      kind: "review_registry_fixture_evidence",
      ...evidenceBinding,
      sha256Verified: true,
    }],
  });
  const processStartIdentity = currentProcessStartIdentity();
  const programPath = write(projectRoot, `${reviewRoot}/programs/review-runner.mjs`,
    Buffer.from("export const fixtureReviewRunner = true;\n"));
  const lockPath = writeJson(projectRoot, `${reviewRoot}/execution.lock.json`, {
    schemaVersion: "ai-painter-current-active-execution-lock-v1",
    capabilityVersion: V2_ARCHITECTURE_ID,
    packageId,
    runId,
    processId: process.pid,
    processStartIdentity,
  });
  const heartbeatPath = writeJson(projectRoot, `${reviewRoot}/heartbeat.json`, {
    schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
    capabilityVersion: V2_ARCHITECTURE_ID,
    packageId,
    runId,
    executionState: "reviewing",
    processId: process.pid,
    processStartIdentity,
    heartbeatAtUtc: new Date().toISOString(),
    ttlSeconds: 3600,
  });
  const activeExecution = {
    schemaVersion: "ai-painter-current-active-execution-v1",
    capabilityVersion: V2_ARCHITECTURE_ID,
    packageId,
    runId,
    executionState: "reviewing",
    processId: process.pid,
    processStartIdentity,
    programLineage: { reviewRunner: bind(projectRoot, programPath) },
    lock: bind(projectRoot, lockPath),
    heartbeat: { path: bind(projectRoot, heartbeatPath).path, ttlSeconds: 3600 },
  };
  const published = await advanceCurrentExecutionRegistry({
    projectRoot,
    capabilityVersion: V2_ARCHITECTURE_ID,
    packageId,
    taskId: `${runId}-machine-review`,
    taskKind: "controlled_smoke",
    taskGoal: "Execute the immutable Stage4 V2 controlled Smoke machine review.",
    priority: 1,
    queueStatus: "running",
    nextMachineAction: null,
    queuedAtUtc: new Date().toISOString(),
    runId,
    lifecycleStage: "controlled_smoke",
    executionState: "reviewing",
    activity: "machine_review",
    taskCapsulePath: bind(projectRoot, capsulePath).path,
    terminalEvidencePath: bind(projectRoot, terminalPath).path,
    activeExecution,
    expectedPreviousRegistryRevision: initial.registry.registryRevision,
    expectedPreviousRegistrySha256: initial.registrySha256,
    _testHooks: { currentProcessIdentity: "fixture-review-registry-writer-process" },
  });
  const transactionPath = `${CURRENT_EXECUTION_REGISTRY_ROOT}/transactions/`+
    `${published.registry.transactionId}/transaction.json`;
  const transaction = JSON.parse(fs.readFileSync(path.join(projectRoot, transactionPath), "utf8"));
  return {
    currentRegistryTransaction: bind(projectRoot, path.join(projectRoot, transactionPath)),
    currentRegistrySnapshot: bind(projectRoot,
      path.join(projectRoot, transaction.currentStaged.path)),
    transaction,
    publication: published,
  };
}

async function advanceFixtureRegistryPhase(projectRoot, previous, executionState) {
  const activeExecution = structuredClone(previous.registry.activeExecution);
  activeExecution.executionState = executionState;
  const lockPath = path.join(projectRoot, ...activeExecution.lock.path.split("/"));
  const attemptStem = path.basename(lockPath).replace(/-lock\.json$/u, "");
  const heartbeatPath = path.join(path.dirname(lockPath),
    `${attemptStem}-heartbeat-${executionState}.json`);
  writeJson(projectRoot, path.relative(projectRoot, heartbeatPath).replaceAll("\\", "/"), {
    schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
    capabilityVersion: activeExecution.capabilityVersion,
    packageId: activeExecution.packageId,
    runId: activeExecution.runId,
    executionState,
    processId: activeExecution.processId,
    processStartIdentity: activeExecution.processStartIdentity,
    heartbeatAtUtc: new Date().toISOString(),
    ttlSeconds: activeExecution.heartbeat.ttlSeconds,
  });
  activeExecution.heartbeat = {
    path: path.relative(projectRoot, heartbeatPath).replaceAll("\\", "/"),
    ttlSeconds: activeExecution.heartbeat.ttlSeconds,
  };
  const observed = await readCurrentExecutionRegistry(projectRoot);
  assert.equal(observed.ok, true,
    `fixture current registry invalid before ${executionState}: ${observed.errorCode}`);
  return advanceCurrentExecutionRegistry({
    projectRoot,
    capabilityVersion: V2_ARCHITECTURE_ID,
    packageId: previous.registry.packageId,
    taskId: previous.registry.taskId,
    taskKind: previous.registry.taskKind,
    taskGoal: previous.registry.taskGoal,
    priority: previous.registry.priority,
    queueStatus: "running",
    nextMachineAction: null,
    queuedAtUtc: previous.registry.queuedAtUtc,
    runId: previous.registry.runId,
    lifecycleStage: previous.registry.lifecycleStage,
    executionState,
    activity: `fixture_${executionState}`,
    taskCapsulePath: previous.registry.taskCapsule.path,
    terminalEvidencePath: previous.registry.terminalEvidence.path,
    activeExecution,
    expectedPreviousRegistryRevision: previous.registry.registryRevision,
    expectedPreviousRegistrySha256: previous.registrySha256,
    _testHooks: {
      currentProcessIdentity: `fixture-review-registry-${executionState}`,
    },
  });
}

function currentProcessStartIdentity() {
  if (process.platform === "win32") {
    const script = [
      "$ErrorActionPreference='Stop'",
      `$p=Get-CimInstance -ClassName Win32_Process -Filter \"ProcessId = ${process.pid}\" -ErrorAction Stop`,
      "if ($null -eq $p) { exit 3 }",
      "$p.CreationDate.ToUniversalTime().ToString('o')",
    ].join("; ");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    assert.equal(result.status, 0, String(result.stderr));
    return `${process.pid}:${String(result.stdout).replace(/^\uFEFF/u, "").trim()}`;
  }
  const result = spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)], {
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 0, String(result.stderr));
  return `${process.pid}:${String(result.stdout).trim()}`;
}

function negative(name, source, mutate, pattern) {
  const value = structuredClone(source);
  mutate(value);
  assert.throws(() => validateReviewExecutionBinding(value, root), pattern, name);
}

function negativeBoundFile(name, source, logicalPath, mutateFile, mutateBinding, pattern) {
  const file = path.join(root, ...logicalPath.split("/"));
  const original = fs.readFileSync(file);
  try {
    const value = JSON.parse(original.toString("utf8"));
    mutateFile(value);
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    const binding = structuredClone(source);
    mutateBinding(binding, file);
    assert.throws(() => validateReviewExecutionBinding(binding, root), pattern, name);
  } finally {
    fs.writeFileSync(file, original);
  }
}

function writeJson(projectRoot, relative, value) {
  return write(projectRoot, relative, Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
}

function write(projectRoot, relative, bytes) {
  const file = path.join(projectRoot, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return file;
}

function bind(projectRoot, file) {
  return { path: path.relative(projectRoot, file).replaceAll("\\", "/"), sha256: sha(file) };
}

function sha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
