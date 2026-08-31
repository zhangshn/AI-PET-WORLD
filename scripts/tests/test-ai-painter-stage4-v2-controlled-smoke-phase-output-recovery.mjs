import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  adjudicateMachineReview,
  recoverAdjudicationOutput,
  recoverFinalizationOutput,
  recoverPreflightOutput,
  recoverReviewOutput,
  recoverValidationOutput,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs";
import { bindAbsolute } from "../lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-phase-output-recovery-"));
const output = path.join(root, "output");
fs.mkdirSync(output, { recursive: true });
const payload = {
  packageId: "stage4-v2-controlled-smoke-package-fixture",
  runId: "stage4-v2-controlled-smoke-run-fixture",
};
const timestamp = "2026-09-01T00:00:00.000Z";
const write = (target, value) => {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return bindAbsolute(root, target);
};

try {
  const preflightPath = path.join(root, "package", "preflight-report.json");
  const preflight = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-preflight-v1",
    status: "passed_ticket_not_consumed_training_not_started",
    packageId: payload.packageId, runId: payload.runId,
    resource: {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-resource-preflight-v1",
      status: "passed", blockers: [], gpuWorkloadStarted: false,
      recordedAtUtc: timestamp,
    },
    checks: ["node", "python_compile", "python_cuda"].map((command) => ({
      command, status: 0, stdoutTail: "passed",
    })),
    ticketConsumed: false, gpuTrainingStarted: false,
    recordedAtUtc: timestamp,
  };
  write(preflightPath, preflight);
  assert.equal(recoverPreflightOutput({
    projectRoot: root, payload, target: preflightPath,
  }).status, "passed");
  const badPreflight = structuredClone(preflight);
  badPreflight.checks.pop();
  write(path.join(root, "bad-preflight.json"), badPreflight);
  assert.throws(() => recoverPreflightOutput({
    projectRoot: root, payload, target: path.join(root, "bad-preflight.json"),
  }), /all three program checks/u);

  const manifestPath = path.join(output, "manifest.json");
  write(manifestPath, { resourceTelemetry: { path: "output/telemetry.json", sha256: "a".repeat(64) } });
  const manifest = {
    sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
    sampleSplit: "validation", epochCount: 30,
    previews: [1, 5, 10, 20, 30].map((epoch) => ({
      epoch, reproduction: { byteExact: true },
    })),
  };
  const validationPath = path.join(output, "training-validation.json");
  const validation = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-training-validation-v1",
    status: "passed", packageId: payload.packageId, runId: payload.runId,
    trainingManifest: bindAbsolute(root, manifestPath),
    sampleId: manifest.sampleId, sampleSplit: "validation", epochCount: 30,
    previewEpochs: [1, 5, 10, 20, 30],
    previewByteReproductionPassed: true, historicalDenoiserRead: false,
    recordedAtUtc: timestamp,
  };
  write(validationPath, validation);
  assert.equal(recoverValidationOutput({
    projectRoot: root, payload, target: validationPath, manifestPath, manifest,
  }).status, "passed");
  const badValidationPath = path.join(output, "bad-training-validation.json");
  write(badValidationPath, { ...validation, sampleSplit: "train" });
  assert.throws(() => recoverValidationOutput({
    projectRoot: root, payload, target: badValidationPath, manifestPath, manifest,
  }), /differs from immutable training evidence/u);

  const epochs = [1, 5, 10, 20, 30];
  const expectedBinding = { schemaVersion: "fixture-review-binding-v1", id: "binding" };
  const bindingPath = path.join(output, "review-execution-binding.json");
  const resultPath = path.join(output, "machine-review-result.json");
  write(bindingPath, expectedBinding);
  const thresholdContract = {
    professionalAestheticThresholds: {
      multiscaleTextureUpperEnvelope: {
        axes: { texture_axis: 0.5 },
        failureViolationCount: { value: 1 },
      },
      quietRegionUpperEnvelope: { value: 0.2 },
      textureHierarchyUpperEnvelope: { value: 0.8 },
    },
  };
  const validatedBinding = {
    previews: epochs.map((epoch) => ({
      epoch, path: `output/preview-${epoch}.png`, sha256: String(epoch).padStart(64, "0"),
    })),
    immutableBindings: { frozen: true },
    thresholdContractValue: thresholdContract,
  };
  const bindingValidator = () => validatedBinding;
  assert.equal(recoverReviewOutput({
    projectRoot: root, payload, bindingPath, resultPath, expectedBinding,
    bindingValidator,
  }).status, "binding_only", "binding-only review recovery did not resume safely");
  const review = {
    schemaVersion: "ai-painter-stage4-v2-machine-review-execution-result-v1",
    status: "stage4_v2_machine_review_passed",
    architectureId: "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2",
    executionPackageIdentity: payload.packageId, smokeRunId: payload.runId,
    reviewNodeCount: 5, previewPassCount: 5, previewFailCount: 0,
    reviews: validatedBinding.previews.map((preview) => ({
      epoch: preview.epoch,
      candidatePreview: { path: preview.path, sha256: preview.sha256 },
      passed: true, status: "machine_review_passed", issueCodes: [],
      professionalAesthetic: {
        passed: true, status: "professional_aesthetic_passed",
        candidate: {
          imageSha256: preview.sha256,
          multiscaleTextureValues: { texture_axis: 0.2 },
          quietRegionVariance: 0.1, textureHierarchyRatio: 0.5,
        },
        textureViolations: [], issues: [],
      },
      conditionAlignment: {
        passed: true, status: "condition_alignment_passed", issues: [],
      },
    })),
    immutableBindings: validatedBinding.immutableBindings,
    reviewTrainingSeparation: {
      reviewResultsUsedAsTrainingTarget: false,
      failureCodesUsedAsLoss: false,
      failedPreviewPixelsUsedAsTrainingTarget: false,
      thresholdAdaptationDuringTraining: false,
      thresholdLoweringAllowed: false,
    },
    gpuStartedByReview: false, optimizerCreatedByReview: false,
    backwardExecutedByReview: false, weightsModifiedByReview: false,
    trainingStartedByReview: false, recordedAtUtc: timestamp,
  };
  write(resultPath, review);
  assert.equal(recoverReviewOutput({
    projectRoot: root, payload, bindingPath, resultPath, expectedBinding,
    bindingValidator,
  }).status, "completed");
  const resultOnly = path.join(output, "orphan-machine-review-result.json");
  write(resultOnly, review);
  assert.throws(() => recoverReviewOutput({
    projectRoot: root, payload,
    bindingPath: path.join(output, "missing-review-binding.json"),
    resultPath: resultOnly, expectedBinding, bindingValidator,
  }), /without its immutable execution binding/u);
  const badReviewPath = path.join(output, "bad-machine-review-result.json");
  write(badReviewPath, { ...review, previewPassCount: 4, previewFailCount: 1 });
  assert.throws(() => recoverReviewOutput({
    projectRoot: root, payload, bindingPath, resultPath: badReviewPath,
    expectedBinding, bindingValidator,
  }), /previewPassCount/u);
  const forgedStatus = structuredClone(review);
  forgedStatus.status = "stage4_v2_machine_review_failed";
  assert.throws(() => adjudicateMachineReview(
    forgedStatus, payload, timestamp, thresholdContract,
  ),
    /status/u);
  const forgedEpoch = structuredClone(review);
  forgedEpoch.reviews[2].epoch = 6;
  assert.throws(() => adjudicateMachineReview(
    forgedEpoch, payload, timestamp, thresholdContract,
  ),
    /Epoch sequence differs/u);
  const forgedIdentity = structuredClone(review);
  forgedIdentity.executionPackageIdentity = "cross-package";
  assert.throws(() => adjudicateMachineReview(
    forgedIdentity, payload, timestamp, thresholdContract,
  ),
    /package identity differs/u);
  const forgedAggregate = structuredClone(review);
  forgedAggregate.reviews[0].conditionAlignment.passed = false;
  assert.throws(() => adjudicateMachineReview(
    forgedAggregate, payload, timestamp, thresholdContract,
  ), /condition passed flag is forged/u);
  const forgedProfessional = structuredClone(review);
  forgedProfessional.reviews[0].professionalAesthetic.candidate
    .multiscaleTextureValues.texture_axis = 0.8;
  assert.throws(() => adjudicateMachineReview(
    forgedProfessional, payload, timestamp, thresholdContract,
  ), /texture violations are forged/u);
  const forgedProfessionalImage = structuredClone(review);
  forgedProfessionalImage.reviews[0].professionalAesthetic.candidate.imageSha256 =
    "f".repeat(64);
  assert.throws(() => adjudicateMachineReview(
    forgedProfessionalImage, payload, timestamp, thresholdContract,
  ), /professional image SHA-256 differs from candidate preview/u);
  const forgedConditionIssues = structuredClone(review);
  forgedConditionIssues.reviews[0].conditionAlignment.issues = [{ code: "condition_failure" }];
  assert.throws(() => adjudicateMachineReview(
    forgedConditionIssues, payload, timestamp, thresholdContract,
  ), /condition passed flag is forged/u);

  const reviewBinding = bindAbsolute(root, resultPath);
  const reviewExecutionBinding = bindAbsolute(root, bindingPath);
  const reviewPhasePath = path.join(root, "closed", "phase-evidence", "review-attempt-1.json");
  const reviewPhaseBinding = write(reviewPhasePath, { phase: "review", result: { status: "passed" } });
  const adjudicationPath = path.join(output, "causal-adjudication.json");
  const adjudication = {
    ...adjudicateMachineReview(review, payload, timestamp, thresholdContract),
    sourceMachineReview: reviewBinding,
    sourceReviewExecutionBinding: reviewExecutionBinding,
    sourceReviewPhaseEvidence: reviewPhaseBinding,
  };
  write(adjudicationPath, adjudication);
  assert.equal(recoverAdjudicationOutput({
    projectRoot: root, payload, target: adjudicationPath, review,
    reviewBinding, reviewExecutionBinding, reviewPhaseBinding, thresholdContract,
  }).status, "passed");
  const badAdjudicationPath = path.join(output, "bad-causal-adjudication.json");
  write(badAdjudicationPath, { ...adjudication, previewPassCount: 4 });
  assert.throws(() => recoverAdjudicationOutput({
    projectRoot: root, payload, target: badAdjudicationPath, review,
    reviewBinding, reviewExecutionBinding, reviewPhaseBinding, thresholdContract,
  }), /differs from its immediately prior review evidence/u);

  const adjudicationBinding = bindAbsolute(root, adjudicationPath);
  const adjudicationPhasePath = path.join(root, "closed", "phase-evidence", "adjudicate-attempt-1.json");
  const adjudicationPhaseBinding = write(adjudicationPhasePath, {
    phase: "adjudicate", result: { status: "passed" },
  });
  const finalizationPath = path.join(output, "smoke-finalization.json");
  const finalization = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-finalization-v1",
    executionState: "completed", status: "stage4_v2_controlled_smoke_passed",
    packageId: payload.packageId, runId: payload.runId,
    capabilityVersion: "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2",
    trainingManifest: bindAbsolute(root, manifestPath),
    machineReview: reviewBinding, reviewExecutionBinding,
    reviewPhaseEvidence: reviewPhaseBinding,
    causalAdjudication: adjudicationBinding,
    adjudicationPhaseEvidence: adjudicationPhaseBinding,
    resourceTelemetry: { path: "output/telemetry.json", sha256: "a".repeat(64) },
    checkpointPromotable: false, automaticRetryStarted: false,
    stage0Started: false, nextMachineAction: null, completedAtUtc: timestamp,
  };
  write(finalizationPath, finalization);
  assert.equal(recoverFinalizationOutput({
    projectRoot: root, payload, target: finalizationPath,
    trainingManifestPath: manifestPath, adjudication, adjudicationBinding,
    adjudicationPhaseBinding,
  }).status, "passed");
  const badFinalizationPath = path.join(output, "bad-smoke-finalization.json");
  write(badFinalizationPath, { ...finalization, stage0Started: true });
  assert.throws(() => recoverFinalizationOutput({
    projectRoot: root, payload, target: badFinalizationPath,
    trainingManifestPath: manifestPath, adjudication, adjudicationBinding,
    adjudicationPhaseBinding,
  }), /differs from its adjudication evidence chain/u);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

process.stdout.write("Stage4 V2 Smoke phase-output recovery/review derivation: 6 recovery windows + 13 conflict/forgery negatives passed.\n");
