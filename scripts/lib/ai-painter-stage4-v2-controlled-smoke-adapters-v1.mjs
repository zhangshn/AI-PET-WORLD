import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../../src/server/ai-painter-current-execution-registry.mjs";
import {
  captureImmutableCurrentRegistryEvidence,
} from "./ai-painter-immutable-current-registry-evidence-v1.mjs";
import {
  executeStage4V2FrozenConditionAlignmentAudit,
  executeStage4V2FrozenProfessionalAestheticAudit,
  executeStage4V2MachineReview,
  validateReviewExecutionBinding,
} from "./ai-painter-stage4-v2-machine-review-execution-v1.mjs";
import {
  bindAbsolute,
  FIXED_EPOCH_COUNT,
  FIXED_PREVIEW_EPOCHS,
  FIXED_RESOLUTION,
  FIXED_SAMPLE_ID,
  FIXED_SEED,
  projectLogicalPath,
  readBoundJson,
  readJsonObject,
  readSmokePayload,
  resolveProjectPath,
  sha256File,
  SMOKE_RUN_ACTION,
  SMOKE_RUN_TASK,
  STAGE4_V2_CAPABILITY,
  validateStage4V2SmokePackagePayload,
  writeExclusiveJson,
  writeJsonAtomic,
} from "./ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
import {
  consumeStage4V2SmokeTicket,
  validateStage4V2SmokeTicket,
} from "./ai-painter-stage4-v2-controlled-smoke-ticket-v1.mjs";
import { runResourcePreflight } from "../run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";

const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe";
const TRAINING_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const PHASE_STATE = Object.freeze({
  preflight: "preflight", execute: "executing", validate: "validating",
  review: "reviewing", adjudicate: "adjudicating", finalize: "finalizing",
});

export async function stage4V2SmokePreflight(context) {
  try {
    const loaded = loadPackage(context);
    await advanceLivePhase(context, loaded.payload, "preflight");
    const target = path.join(loaded.packageRoot, "preflight-report.json");
    const recovered = recoverPreflightOutput({
      projectRoot: context.projectRoot, payload: loaded.payload, target,
    });
    if (recovered) return recovered;
    assert.equal(fs.existsSync(resolveProjectPath(context.projectRoot, loaded.payload.outputDirectory)), false,
      "Smoke output directory reuse is forbidden");
    validateStage4V2SmokeTicket({
      projectRoot: context.projectRoot,
      ticket: loaded.ticket,
      packagePayload: loaded.payload,
      nowUtc: new Date().toISOString(),
      verifyEvidence: true,
    });
    const resource = runResourcePreflight({ root: context.projectRoot, commandRunner: spawnSync });
    const checks = [
      runCheck(context.projectRoot, process.execPath, ["--check", loaded.payload.programLineage.nodeAdapter.path]),
      runCheck(context.projectRoot, resolveProjectPath(context.projectRoot, PYTHON), [
        "-B", "-m", "py_compile", loaded.payload.programLineage.pythonAdapter.path,
        loaded.payload.programLineage.pythonTrainingAdapter.path,
      ]),
      runCheck(context.projectRoot, resolveProjectPath(context.projectRoot, PYTHON), [
        "-B", "-c", "import torch; assert torch.cuda.is_available(); print(torch.version.cuda)",
      ]),
    ];
    const report = {
      schemaVersion: "ai-painter-stage4-v2-controlled-smoke-preflight-v1",
      status: "passed_ticket_not_consumed_training_not_started",
      packageId: loaded.payload.packageId,
      runId: loaded.payload.runId,
      resource,
      checks,
      ticketConsumed: false,
      gpuTrainingStarted: false,
      recordedAtUtc: new Date().toISOString(),
    };
    writeExclusiveJson(target, report);
    return recoverPreflightOutput({
      projectRoot: context.projectRoot, payload: loaded.payload, target,
    });
  } catch (error) { return failed("infrastructure", "stage4_v2_smoke_preflight_failed", error); }
}

export async function stage4V2SmokeExecute(context) {
  let loaded;
  try {
    loaded = loadPackage(context);
    await advanceLivePhase(context, loaded.payload, "execute");
    const consumptionPath = `${projectLogicalPath(context.projectRoot, loaded.packageRoot)}/smoke-ticket-consumption.json`;
    const consumed = consumeStage4V2SmokeTicket({
      projectRoot: context.projectRoot,
      ticket: loaded.ticket,
      packagePayload: loaded.payload,
      ticketBinding: loaded.manifest.smokeTicket,
      packagePayloadBinding: loaded.manifest.packagePayload,
      consumptionPath,
      consumedAtUtc: new Date().toISOString(),
    });
    const activeConfig = path.join(loaded.packageRoot, "active-config.json");
    runCheck(context.projectRoot, resolveProjectPath(context.projectRoot, PYTHON), [
      "-B", loaded.payload.programLineage.pythonAdapter.path,
      "--operation", "materialize",
      "--project-root", context.projectRoot,
      "--active-config", activeConfig,
      "--base-config", resolveProjectPath(context.projectRoot, loaded.payload.baseConfig.path),
      "--signed-ticket", resolveProjectPath(context.projectRoot, loaded.manifest.smokeTicket.path),
      "--signed-ticket-sha256", loaded.manifest.smokeTicket.sha256,
      "--signed-consumption", resolveProjectPath(context.projectRoot, consumed.consumptionBinding.path),
      "--signed-consumption-sha256", consumed.consumptionBinding.sha256,
      "--dataset-package-id", loaded.payload.datasetPackageId,
      "--package-id", loaded.payload.packageId,
      "--run-id", loaded.payload.runId,
      "--output-namespace", loaded.payload.outputDirectory,
      "--derived-ticket-id", loaded.payload.derivedTrainerExecution.ticketId,
      "--derived-config-contract-sha256", loaded.payload.derivedTrainerExecution.configContractSha256,
      "--autoencoder-checkpoint-path", loaded.payload.autoencoderCheckpoint.path,
      "--autoencoder-checkpoint-sha256", loaded.payload.autoencoderCheckpoint.sha256,
      "--dataset-release-path", loaded.payload.datasetRelease.path,
      "--dataset-release-sha256", loaded.payload.datasetRelease.sha256,
    ]);
    const activeConfigBinding = bindAbsolute(context.projectRoot, activeConfig);
    const outputRoot = resolveProjectPath(context.projectRoot, loaded.payload.outputDirectory);
    const materialization = validateTrainerMaterializationCommit({
      projectRoot: context.projectRoot,
      payload: loaded.payload,
      packageRoot: loaded.packageRoot,
      consumptionBinding: consumed.consumptionBinding,
      activeConfigBinding,
    });
    const trainerArgs = [
      "-B", loaded.payload.programLineage.pythonAdapter.path,
      "--operation", "run", "--project-root", context.projectRoot,
      "--config", activeConfig,
      "--expected-config-sha256", activeConfigBinding.sha256,
      "--dataset-package", resolveProjectPath(context.projectRoot, loaded.payload.datasetRelease.path),
      "--autoencoder-checkpoint", resolveProjectPath(context.projectRoot, loaded.payload.autoencoderCheckpoint.path),
      "--output-dir", outputRoot,
    ];
    const trainerProcess = prepareTrainerProcessIntent({
      projectRoot: context.projectRoot, payload: loaded.payload,
      packageRoot: loaded.packageRoot,
      command: resolveProjectPath(context.projectRoot, PYTHON),
      args: trainerArgs, activeConfigBinding,
    });
    const existingTrainer = observeTrainerProcess({
      trainerProcess, projectRoot: context.projectRoot,
    });
    if (existingTrainer.status === "active") {
      await monitorExistingTrainerProcess({
        trainerProcess, observation: existingTrainer,
        progressPath: path.join(outputRoot, "progress.json"), context,
      });
    } else if (existingTrainer.status === "indeterminate") {
      throw new Error("existing Smoke Trainer process identity is indeterminate; concurrent training is forbidden");
    } else if (existingTrainer.status === "dead" && fs.existsSync(outputRoot)) {
      // The process ended while its parent phase evidence was uncommitted.  A
      // fully complete output may be recovered below; a partial output fails.
    } else if (existingTrainer.status === "dead") {
      throw new Error("bound Smoke Trainer died before creating output; automatic retraining is forbidden");
    }
    if (fs.existsSync(outputRoot)) {
      return recoverCompletedSmokeTrainingExecution({
        projectRoot: context.projectRoot,
        payload: loaded.payload,
        outputRoot,
        consumptionBinding: consumed.consumptionBinding,
        activeConfigBinding,
        materialization,
      });
    }
    assert.ok(["absent", "dead"].includes(existingTrainer.status),
      "a second Smoke Trainer cannot start while another process is active");
    const child = runTrainingChild({
      command: resolveProjectPath(context.projectRoot, PYTHON),
      args: trainerArgs,
      cwd: context.projectRoot,
      progressPath: path.join(outputRoot, "progress.json"),
      context,
      trainerProcess,
    });
    const result = await child;
    assert.equal(result.error, null, result.error?.message ?? "Smoke trainer process failed");
    assert.equal(result.status, 0, `Smoke trainer exited ${result.status}: ${tail(
      readOptionalText(trainerProcess.stderrPath),
    )}`);
    return recoverCompletedSmokeTrainingExecution({
      projectRoot: context.projectRoot,
      payload: loaded.payload,
      outputRoot,
      consumptionBinding: consumed.consumptionBinding,
      activeConfigBinding,
      materialization,
    });
  } catch (error) { return failed("program", "stage4_v2_smoke_training_failed", error); }
}

/**
 * Recover the narrow commit window in which the bounded Trainer completed and
 * persisted every immutable output, but the generic execute phase had not yet
 * committed its phase evidence.  This function never starts a process.  Any
 * incomplete or substituted output fails closed and must not be retrained.
 */
export function recoverCompletedSmokeTrainingExecution({
  projectRoot,
  payload,
  outputRoot,
  consumptionBinding,
  activeConfigBinding,
  materialization,
  manifestValidator = validateTrainingManifest,
}) {
  assert.ok(fs.existsSync(outputRoot), "Smoke recovery output directory is absent");
  assert.equal(fs.statSync(outputRoot).isDirectory(), true,
    "Smoke recovery output is not a directory");
  assert.equal(materialization?.status, "committed",
    "Smoke derived Trainer materialization is not committed");
  assert.deepEqual(materialization.parentAtomicConsumption,
    bindingCore(consumptionBinding),
    "Smoke recovery parent ticket consumption differs");
  assert.deepEqual(materialization.activeConfig, bindingCore(activeConfigBinding),
    "Smoke recovery active config differs from materialization commit");
  const manifestPath = path.join(outputRoot, "manifest.json");
  assert.equal(fs.existsSync(manifestPath), true,
    "partial Smoke output has no completed manifest; automatic retraining is forbidden");
  const trainingManifest = manifestValidator({ projectRoot, payload, manifestPath });
  const progressPath = path.join(outputRoot, "progress.json");
  const progress = readJsonObject(progressPath);
  assert.equal(progress.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-progress-v1");
  assert.equal(progress.status, "completed");
  assert.equal(progress.phase, "training_completed");
  assert.equal(progress.packageId, payload.packageId);
  assert.equal(progress.runId, payload.runId);
  assert.equal(progress.sampleId, FIXED_SAMPLE_ID);
  assert.equal(progress.sampleSplit, "validation");
  assert.equal(progress.epoch, FIXED_EPOCH_COUNT);
  assert.equal(progress.epochTarget, FIXED_EPOCH_COUNT);
  assert.equal(progress.optimizerStep, FIXED_EPOCH_COUNT);
  assert.equal(progress.optimizerStepTarget, FIXED_EPOCH_COUNT);
  assert.equal(progress.percent, 100);
  return {
    status: "passed",
    ticketConsumption: consumptionBinding,
    materialization,
    activeConfig: activeConfigBinding,
    trainingManifest: bindAbsolute(projectRoot, manifestPath),
    checkpoint: trainingManifest.checkpoint,
    previewCount: trainingManifest.previews.length,
  };
}

export function validateTrainerMaterializationCommit({
  projectRoot, payload, packageRoot, consumptionBinding, activeConfigBinding,
}) {
  const commitPath = path.join(packageRoot, "trainer-materialization-commit.json");
  const commit = readJsonObject(commitPath);
  assert.equal(commit.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-trainer-materialization-commit-v1");
  assert.equal(commit.status, "committed");
  assert.equal(commit.packageId, payload.packageId);
  assert.equal(commit.runId, payload.runId);
  assert.deepEqual(commit.parentAtomicConsumption, bindingCore(consumptionBinding),
    "derived Trainer materialization binds another parent consumption");
  assert.deepEqual(commit.artifacts?.activeConfig, bindingCore(activeConfigBinding),
    "derived Trainer materialization binds another active config");
  for (const [label, binding] of [
    ["prepare", commit.prepare],
    ["trainerTicket", commit.artifacts?.trainerTicket],
    ["trainerTicketConsumption", commit.artifacts?.trainerTicketConsumption],
    ["activeConfig", commit.artifacts?.activeConfig],
  ]) verifyBinding(projectRoot, binding, `Trainer materialization ${label}`);
  const activeConfig = readBoundJson(projectRoot, commit.artifacts.activeConfig);
  const execution = activeConfig.training?.stage4V2ControlledSmokeExecution;
  assert.equal(execution?.packageId, payload.packageId);
  assert.equal(execution?.runId, payload.runId);
  assert.equal(execution?.derivedTrainerTicketId,
    payload.derivedTrainerExecution.ticketId);
  assert.deepEqual(execution?.signedParentTicketConsumption,
    bindingCore(consumptionBinding));
  return Object.freeze({
    status: commit.status,
    commit: bindAbsolute(projectRoot, commitPath),
    activeConfig: bindingCore(activeConfigBinding),
    parentAtomicConsumption: bindingCore(consumptionBinding),
    trainerTicket: commit.artifacts.trainerTicket,
    trainerTicketConsumption: commit.artifacts.trainerTicketConsumption,
  });
}

export async function stage4V2SmokeValidate(context) {
  try {
    const loaded = loadPackage(context);
    await advanceLivePhase(context, loaded.payload, "validate");
    const outputRoot = resolveProjectPath(context.projectRoot, loaded.payload.outputDirectory, { mustExist: true, kind: "directory" });
    const manifestPath = path.join(outputRoot, "manifest.json");
    const manifest = validateTrainingManifest({ projectRoot: context.projectRoot, payload: loaded.payload, manifestPath });
    const target = path.join(outputRoot, "training-validation.json");
    const recovered = recoverValidationOutput({
      projectRoot: context.projectRoot, payload: loaded.payload, target,
      manifestPath, manifest,
    });
    if (recovered) return recovered;
    const validation = {
      schemaVersion: "ai-painter-stage4-v2-controlled-smoke-training-validation-v1",
      status: "passed",
      packageId: loaded.payload.packageId,
      runId: loaded.payload.runId,
      trainingManifest: bindAbsolute(context.projectRoot, manifestPath),
      sampleId: manifest.sampleId,
      sampleSplit: manifest.sampleSplit,
      epochCount: manifest.epochCount,
      previewEpochs: manifest.previews.map((item) => item.epoch),
      previewByteReproductionPassed: manifest.previews.every((item) => item.reproduction?.byteExact === true),
      historicalDenoiserRead: false,
      recordedAtUtc: new Date().toISOString(),
    };
    writeExclusiveJson(target, validation);
    return recoverValidationOutput({
      projectRoot: context.projectRoot, payload: loaded.payload, target,
      manifestPath, manifest,
    });
  } catch (error) { return failed("evidence", "stage4_v2_smoke_training_evidence_invalid", error); }
}

export async function stage4V2SmokeReview(context) {
  try {
    const loaded = loadPackage(context);
    const current = await advanceLivePhase(context, loaded.payload, "review");
    const currentEvidence = captureImmutableCurrentRegistryEvidence({
      projectRoot: context.projectRoot,
      current,
    });
    const outputRoot = resolveProjectPath(context.projectRoot, loaded.payload.outputDirectory, { mustExist: true, kind: "directory" });
    const manifest = validateTrainingManifest({ projectRoot: context.projectRoot, payload: loaded.payload, manifestPath: path.join(outputRoot, "manifest.json") });
    const reviewBinding = {
      schemaVersion: "ai-painter-stage4-v2-machine-review-execution-binding-v1",
      status: "active_readonly_machine_review",
      reviewBindingId: loaded.payload.reviewExecutionBindingId,
      architectureId: STAGE4_V2_CAPABILITY,
      stage: "controlled_smoke",
      executionPackageIdentity: loaded.payload.packageId,
      smokeRunId: loaded.payload.runId,
      bindingPolicy: {
        explicitArtifactsOnly: true, latestPointerAllowed: false,
        historicalRunSelectionAllowed: false, crossExecutionPackageEvidenceAllowed: false,
        thresholdOverrideAllowed: false, reviewOutputMayBecomeTrainingTarget: false,
      },
      currentRegistryTransaction: currentEvidence.transaction,
      currentRegistrySnapshot: currentEvidence.snapshot,
      smokePackage: loaded.manifest.packagePayload,
      readonlyGpuQualificationTerminal: loaded.payload.readonlyGpuQualificationTerminal,
      ...loaded.payload.machineReviewInputs,
      previews: manifest.previews.map((item) => ({
        epoch: item.epoch,
        executionPackageIdentity: loaded.payload.packageId,
        path: item.path,
        sha256: item.sha256,
      })),
    };
    const bindingPath = path.join(outputRoot, "review-execution-binding.json");
    const resultPath = path.join(outputRoot, "machine-review-result.json");
    const recovery = recoverReviewOutput({
      projectRoot: context.projectRoot, payload: loaded.payload,
      bindingPath, resultPath, expectedBinding: reviewBinding,
    });
    if (recovery.status === "completed") {
      const persisted = readBoundJson(context.projectRoot,
        recovery.result.machineReview);
      const validated = validateReviewExecutionBinding(
        readBoundJson(context.projectRoot, recovery.result.reviewExecutionBinding),
        context.projectRoot,
      );
      await revalidateMachineReviewConditionEvidence({
        value: persisted,
        validatedBinding: validated,
        projectRoot: context.projectRoot,
      });
      await revalidateMachineReviewProfessionalEvidence({
        value: persisted,
        validatedBinding: validated,
        projectRoot: context.projectRoot,
      });
      return recovery.result;
    }
    if (recovery.status === "absent") writeExclusiveJson(bindingPath, reviewBinding);
    const boundReview = readJsonObject(bindingPath);
    assert.deepEqual(boundReview, reviewBinding,
      "persisted review execution binding differs from the current immutable package");
    validateReviewExecutionBinding(boundReview, context.projectRoot);
    const result = await executeStage4V2MachineReview(boundReview, {
      projectRoot: context.projectRoot,
    });
    writeExclusiveJson(resultPath, result);
    const committed = recoverReviewOutput({
      projectRoot: context.projectRoot, payload: loaded.payload,
      bindingPath, resultPath, expectedBinding: reviewBinding,
    }).result;
    const committedReview = readBoundJson(context.projectRoot, committed.machineReview);
    const committedBinding = validateReviewExecutionBinding(
      readBoundJson(context.projectRoot, committed.reviewExecutionBinding),
      context.projectRoot,
    );
    await revalidateMachineReviewConditionEvidence({
      value: committedReview,
      validatedBinding: committedBinding,
      projectRoot: context.projectRoot,
    });
    await revalidateMachineReviewProfessionalEvidence({
      value: committedReview,
      validatedBinding: committedBinding,
      projectRoot: context.projectRoot,
    });
    return committed;
  } catch (error) { return failed("program", "stage4_v2_smoke_machine_review_execution_failed", error); }
}

export async function stage4V2SmokeAdjudicate(context) {
  try {
    const loaded = loadPackage(context);
    await advanceLivePhase(context, loaded.payload, "adjudicate");
    const outputRoot = resolveProjectPath(context.projectRoot, loaded.payload.outputDirectory, { mustExist: true, kind: "directory" });
    const reviewPhase = readPassedPhaseResult(context, "review");
    const reviewBinding = reviewPhase.result.machineReview;
    verifyBinding(context.projectRoot, reviewBinding, "review phase machineReview");
    const reviewPath = resolveProjectPath(context.projectRoot, reviewBinding.path, {
      mustExist: true, kind: "file",
    });
    assert.equal(reviewPath, path.join(outputRoot, "machine-review-result.json"),
      "review phase bound an unexpected machine-review path");
    const review = readBoundJson(context.projectRoot, reviewBinding);
    assert.equal(review.schemaVersion, "ai-painter-stage4-v2-machine-review-execution-result-v1");
    const reviewExecutionBinding = reviewPhase.result.reviewExecutionBinding;
    verifyBinding(context.projectRoot, reviewExecutionBinding,
      "review phase execution binding");
    const validatedReviewBinding = validateReviewExecutionBinding(
      readBoundJson(context.projectRoot, reviewExecutionBinding),
      context.projectRoot,
    );
    validateMachineReviewResult({
      value: review, payload: loaded.payload,
      validatedBinding: validatedReviewBinding,
    });
    await revalidateMachineReviewConditionEvidence({
      value: review,
      validatedBinding: validatedReviewBinding,
      projectRoot: context.projectRoot,
    });
    await revalidateMachineReviewProfessionalEvidence({
      value: review,
      validatedBinding: validatedReviewBinding,
      projectRoot: context.projectRoot,
    });
    const adjudication = {
      ...adjudicateMachineReview(
        review, loaded.payload, new Date().toISOString(),
        validatedReviewBinding.thresholdContractValue,
      ),
      sourceMachineReview: reviewBinding,
      sourceReviewExecutionBinding: reviewExecutionBinding,
      sourceReviewPhaseEvidence: reviewPhase.binding,
    };
    const target = path.join(outputRoot, "causal-adjudication.json");
    const recovered = recoverAdjudicationOutput({
      projectRoot: context.projectRoot, payload: loaded.payload, target,
      review, reviewBinding, reviewExecutionBinding,
      reviewPhaseBinding: reviewPhase.binding,
      thresholdContract: validatedReviewBinding.thresholdContractValue,
    });
    if (recovered) return recovered;
    writeExclusiveJson(target, adjudication);
    return recoverAdjudicationOutput({
      projectRoot: context.projectRoot, payload: loaded.payload, target,
      review, reviewBinding, reviewExecutionBinding,
      reviewPhaseBinding: reviewPhase.binding,
      thresholdContract: validatedReviewBinding.thresholdContractValue,
    });
  } catch (error) { return failed("evidence", "stage4_v2_smoke_causal_adjudication_failed", error); }
}

export async function stage4V2SmokeFinalize(context) {
  try {
    const loaded = loadPackage(context);
    await advanceLivePhase(context, loaded.payload, "finalize");
    const outputRoot = resolveProjectPath(context.projectRoot, loaded.payload.outputDirectory, { mustExist: true, kind: "directory" });
    const adjudicationPhase = readPassedPhaseResult(context, "adjudicate");
    const adjudicationBinding = adjudicationPhase.result.adjudication;
    verifyBinding(context.projectRoot, adjudicationBinding,
      "adjudication phase output");
    const adjudicationPath = resolveProjectPath(
      context.projectRoot, adjudicationBinding.path, { mustExist: true, kind: "file" },
    );
    assert.equal(adjudicationPath, path.join(outputRoot, "causal-adjudication.json"),
      "adjudication phase bound an unexpected path");
    const adjudication = readBoundJson(context.projectRoot, adjudicationBinding);
    verifyBinding(context.projectRoot, adjudication.sourceMachineReview,
      "adjudication source machine review");
    verifyBinding(context.projectRoot, adjudication.sourceReviewExecutionBinding,
      "adjudication source review binding");
    const sourceReview = readBoundJson(
      context.projectRoot, adjudication.sourceMachineReview,
    );
    const sourceReviewBinding = validateReviewExecutionBinding(
      readBoundJson(context.projectRoot, adjudication.sourceReviewExecutionBinding),
      context.projectRoot,
    );
    validateMachineReviewResult({
      value: sourceReview,
      payload: loaded.payload,
      validatedBinding: sourceReviewBinding,
    });
    await revalidateMachineReviewConditionEvidence({
      value: sourceReview,
      validatedBinding: sourceReviewBinding,
      projectRoot: context.projectRoot,
    });
    await revalidateMachineReviewProfessionalEvidence({
      value: sourceReview,
      validatedBinding: sourceReviewBinding,
      projectRoot: context.projectRoot,
    });
    const trainingManifestPath = path.join(outputRoot, "manifest.json");
    validateTrainingManifest({
      projectRoot: context.projectRoot, payload: loaded.payload,
      manifestPath: trainingManifestPath,
    });
    const passed = adjudication.decision === "controlled_smoke_qualified";
    const finalization = {
      schemaVersion: "ai-painter-stage4-v2-controlled-smoke-finalization-v1",
      executionState: passed ? "completed" : "failed_closed",
      status: passed ? "stage4_v2_controlled_smoke_passed" : "stage4_v2_controlled_smoke_real_visual_failure",
      packageId: loaded.payload.packageId,
      runId: loaded.payload.runId,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      trainingManifest: bindAbsolute(context.projectRoot, trainingManifestPath),
      machineReview: adjudication.sourceMachineReview,
      reviewExecutionBinding: adjudication.sourceReviewExecutionBinding,
      reviewPhaseEvidence: adjudication.sourceReviewPhaseEvidence,
      causalAdjudication: adjudicationBinding,
      adjudicationPhaseEvidence: adjudicationPhase.binding,
      resourceTelemetry: readJsonObject(trainingManifestPath).resourceTelemetry,
      checkpointPromotable: false,
      automaticRetryStarted: false,
      stage0Started: false,
      nextMachineAction: null,
      completedAtUtc: new Date().toISOString(),
    };
    const target = path.join(outputRoot, "smoke-finalization.json");
    const recovered = recoverFinalizationOutput({
      projectRoot: context.projectRoot, payload: loaded.payload, target,
      trainingManifestPath, adjudication, adjudicationBinding,
      adjudicationPhaseBinding: adjudicationPhase.binding,
    });
    if (recovered) return recovered;
    writeExclusiveJson(target, finalization);
    return recoverFinalizationOutput({
      projectRoot: context.projectRoot, payload: loaded.payload, target,
      trainingManifestPath, adjudication, adjudicationBinding,
      adjudicationPhaseBinding: adjudicationPhase.binding,
    });
  } catch (error) { return failed("program", "stage4_v2_smoke_finalization_failed", error); }
}

export function recoverPreflightOutput({ projectRoot, payload, target }) {
  const existing = readExistingJson(target, "Smoke preflight report");
  if (!existing) return null;
  const report = existing.value;
  assert.equal(report.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-preflight-v1");
  assert.equal(report.status, "passed_ticket_not_consumed_training_not_started");
  assert.equal(report.packageId, payload.packageId);
  assert.equal(report.runId, payload.runId);
  assert.equal(report.ticketConsumed, false);
  assert.equal(report.gpuTrainingStarted, false);
  assertValidIsoTimestamp(report.recordedAtUtc, "Smoke preflight report");
  assert.equal(report.resource?.schemaVersion,
    "ai-painter-stage4-v2-readonly-gpu-resource-preflight-v1");
  assert.equal(report.resource?.status, "passed");
  assert.deepEqual(report.resource?.blockers, []);
  assert.equal(report.resource?.gpuWorkloadStarted, false);
  assertValidIsoTimestamp(report.resource?.recordedAtUtc, "Smoke resource preflight");
  assert.ok(Array.isArray(report.checks) && report.checks.length === 3,
    "Smoke preflight did not persist all three program checks");
  for (const [index, check] of report.checks.entries()) {
    assert.equal(check?.status, 0, `Smoke preflight check ${index} did not pass`);
    assert.match(check?.command ?? "", /\S/u,
      `Smoke preflight check ${index} command is missing`);
    assert.equal(typeof check?.stdoutTail, "string",
      `Smoke preflight check ${index} output is missing`);
  }
  return {
    status: "passed",
    report: bindAbsolute(projectRoot, target),
  };
}

export function recoverValidationOutput({
  projectRoot, payload, target, manifestPath, manifest,
}) {
  const existing = readExistingJson(target, "Smoke training validation");
  if (!existing) return null;
  assertValidIsoTimestamp(existing.value.recordedAtUtc,
    "Smoke training validation");
  const expected = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-training-validation-v1",
    status: "passed",
    packageId: payload.packageId,
    runId: payload.runId,
    trainingManifest: bindAbsolute(projectRoot, manifestPath),
    sampleId: manifest.sampleId,
    sampleSplit: manifest.sampleSplit,
    epochCount: manifest.epochCount,
    previewEpochs: manifest.previews.map((item) => item.epoch),
    previewByteReproductionPassed: manifest.previews.every(
      (item) => item.reproduction?.byteExact === true,
    ),
    historicalDenoiserRead: false,
    recordedAtUtc: existing.value.recordedAtUtc,
  };
  assert.deepEqual(existing.value, expected,
    "persisted Smoke training validation differs from immutable training evidence");
  return {
    status: "passed",
    validation: bindAbsolute(projectRoot, target),
  };
}

export function recoverReviewOutput({
  projectRoot, payload, bindingPath, resultPath, expectedBinding,
  bindingValidator = validateReviewExecutionBinding,
}) {
  const binding = readExistingJson(bindingPath, "Smoke review execution binding");
  const result = readExistingJson(resultPath, "Smoke machine-review result");
  assert.equal(Boolean(result) && !binding, false,
    "machine-review result exists without its immutable execution binding");
  if (!binding) return { status: "absent", result: null };
  assert.deepEqual(binding.value, expectedBinding,
    "persisted review execution binding differs from the current immutable package");
  const validatedBinding = bindingValidator(
    binding.value, projectRoot,
  );
  if (!result) return { status: "binding_only", result: null };
  validateMachineReviewResult({
    value: result.value, payload, validatedBinding,
  });
  return {
    status: "completed",
    result: {
      status: "passed",
      reviewExecutionBinding: bindAbsolute(projectRoot, bindingPath),
      machineReview: bindAbsolute(projectRoot, resultPath),
      previewPassCount: result.value.previewPassCount,
      previewFailCount: result.value.previewFailCount,
      reviewOutcome: result.value.status,
    },
  };
}

export function recoverAdjudicationOutput({
  projectRoot, payload, target, review, reviewBinding,
  reviewExecutionBinding, reviewPhaseBinding, thresholdContract,
}) {
  const existing = readExistingJson(target, "Smoke causal adjudication");
  if (!existing) return null;
  assertValidIsoTimestamp(existing.value.recordedAtUtc,
    "Smoke causal adjudication");
  const expected = {
    ...adjudicateMachineReview(
      review, payload, existing.value.recordedAtUtc, thresholdContract,
    ),
    sourceMachineReview: reviewBinding,
    sourceReviewExecutionBinding: reviewExecutionBinding,
    sourceReviewPhaseEvidence: reviewPhaseBinding,
  };
  assert.deepEqual(existing.value, expected,
    "persisted causal adjudication differs from its immediately prior review evidence");
  return {
    status: "passed",
    adjudication: bindAbsolute(projectRoot, target),
    decision: existing.value.decision,
  };
}

export function recoverFinalizationOutput({
  projectRoot, payload, target, trainingManifestPath, adjudication,
  adjudicationBinding, adjudicationPhaseBinding,
}) {
  const existing = readExistingJson(target, "Smoke finalization");
  if (!existing) return null;
  assertValidIsoTimestamp(existing.value.completedAtUtc, "Smoke finalization");
  const passed = adjudication.decision === "controlled_smoke_qualified";
  const expected = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-finalization-v1",
    executionState: passed ? "completed" : "failed_closed",
    status: passed
      ? "stage4_v2_controlled_smoke_passed"
      : "stage4_v2_controlled_smoke_real_visual_failure",
    packageId: payload.packageId,
    runId: payload.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    trainingManifest: bindAbsolute(projectRoot, trainingManifestPath),
    machineReview: adjudication.sourceMachineReview,
    reviewExecutionBinding: adjudication.sourceReviewExecutionBinding,
    reviewPhaseEvidence: adjudication.sourceReviewPhaseEvidence,
    causalAdjudication: adjudicationBinding,
    adjudicationPhaseEvidence: adjudicationPhaseBinding,
    resourceTelemetry: readJsonObject(trainingManifestPath).resourceTelemetry,
    checkpointPromotable: false,
    automaticRetryStarted: false,
    stage0Started: false,
    nextMachineAction: null,
    completedAtUtc: existing.value.completedAtUtc,
  };
  assert.deepEqual(existing.value, expected,
    "persisted Smoke finalization differs from its adjudication evidence chain");
  const output = {
    finalization: bindAbsolute(projectRoot, target),
    decision: adjudication.decision,
  };
  if (passed) return { status: "passed", ...output };
  return {
    status: "failed", failureKind: "visual",
    failureCode: adjudication.failureCode, ...output,
  };
}

export function validateMachineReviewResult({ value, payload, validatedBinding }) {
  validateMachineReviewDecisionInputs(
    value, payload, validatedBinding.thresholdContractValue,
  );
  assert.deepEqual(value.immutableBindings, validatedBinding.immutableBindings,
    "machine-review result immutable inputs differ from its execution binding");
  for (const [index, row] of value.reviews.entries()) {
    const preview = validatedBinding.previews[index];
    assert.deepEqual(row.candidatePreview,
      { path: preview.path, sha256: preview.sha256 });
    assert.equal(row.professionalAesthetic?.candidate?.imageSha256,
      row.candidatePreview.sha256,
    `machine-review Epoch ${row.epoch} professional image SHA-256 differs from candidate preview`);
  }
  return true;
}

/**
 * Re-runs the frozen condition-alignment auditor for every immutable preview
 * and requires byte-derived output equivalence.  The persisted issue list,
 * pass flag, thresholds, paths and metrics are evidence to verify, never a
 * decision input that can certify itself.
 */
export async function revalidateMachineReviewConditionEvidence({
  value,
  validatedBinding,
  projectRoot = process.cwd(),
  conditionAudit,
}) {
  assert.ok(Array.isArray(value?.reviews),
    "machine-review condition evidence rows are missing");
  assert.deepEqual(value.reviews.map((row) => row.epoch), FIXED_PREVIEW_EPOCHS,
    "machine-review condition evidence Epoch sequence differs");
  for (const [index, row] of value.reviews.entries()) {
    const preview = validatedBinding.previews[index];
    assert.deepEqual(row.candidatePreview,
      { path: preview.path, sha256: preview.sha256 },
    `machine-review Epoch ${row.epoch} preview binding differs before condition re-audit`);
    const expected = await executeStage4V2FrozenConditionAlignmentAudit(
      validatedBinding,
      preview,
      { projectRoot, ...(conditionAudit ? { conditionAudit } : {}) },
    );
    assert.deepEqual(row.conditionAlignment, expected,
      `machine-review Epoch ${row.epoch} condition-alignment evidence differs from frozen auditor recomputation`);
  }
  return true;
}

/**
 * Re-runs the frozen professional-aesthetic auditor from each immutable PNG.
 * Persisted texture metrics, issue codes and image identity must exactly match
 * the byte-derived result; a coherent caller-supplied metric set is not proof.
 */
export async function revalidateMachineReviewProfessionalEvidence({
  value,
  validatedBinding,
  projectRoot = process.cwd(),
  professionalAudit,
}) {
  assert.ok(Array.isArray(value?.reviews),
    "machine-review professional evidence rows are missing");
  assert.deepEqual(value.reviews.map((row) => row.epoch), FIXED_PREVIEW_EPOCHS,
    "machine-review professional evidence Epoch sequence differs");
  for (const [index, row] of value.reviews.entries()) {
    const preview = validatedBinding.previews[index];
    assert.deepEqual(row.candidatePreview,
      { path: preview.path, sha256: preview.sha256 },
    `machine-review Epoch ${row.epoch} preview binding differs before professional re-audit`);
    assert.equal(row.professionalAesthetic?.candidate?.imageSha256,
      row.candidatePreview.sha256,
    `machine-review Epoch ${row.epoch} professional image SHA-256 differs from candidate preview`);
    const expected = await executeStage4V2FrozenProfessionalAestheticAudit(
      validatedBinding,
      preview,
      { projectRoot, ...(professionalAudit ? { professionalAudit } : {}) },
    );
    assert.deepEqual(row.professionalAesthetic, expected,
      `machine-review Epoch ${row.epoch} professional-aesthetic evidence differs from frozen auditor recomputation`);
  }
  return true;
}

export function validateMachineReviewDecisionInputs(value, payload, thresholdContract) {
  assert.equal(value.schemaVersion,
    "ai-painter-stage4-v2-machine-review-execution-result-v1");
  assert.ok([
    "stage4_v2_machine_review_passed", "stage4_v2_machine_review_failed",
  ].includes(value.status), "machine-review result status is invalid");
  assert.equal(value.architectureId, STAGE4_V2_CAPABILITY);
  assert.equal(value.executionPackageIdentity, payload.packageId,
    "machine-review package identity differs");
  assert.equal(value.smokeRunId, payload.runId,
    "machine-review run identity differs");
  assert.equal(value.reviewNodeCount, FIXED_PREVIEW_EPOCHS.length);
  assert.ok(Number.isInteger(value.previewPassCount) && value.previewPassCount >= 0);
  assert.ok(Number.isInteger(value.previewFailCount) && value.previewFailCount >= 0);
  assert.equal(value.previewPassCount + value.previewFailCount,
    FIXED_PREVIEW_EPOCHS.length);
  assert.ok(Array.isArray(value.reviews));
  assert.deepEqual(value.reviews.map((row) => row.epoch), FIXED_PREVIEW_EPOCHS,
    "machine-review Epoch sequence differs");
  let passCount = 0;
  assert.ok(thresholdContract?.professionalAestheticThresholds,
    "frozen professional-aesthetic threshold contract is missing");
  for (const row of value.reviews) {
    assert.equal(typeof row.passed, "boolean");
    assert.equal(row.status,
      row.passed ? "machine_review_passed" : "machine_review_failed");
    assert.ok(Array.isArray(row.issueCodes));
    assert.deepEqual(row.issueCodes, [...new Set(row.issueCodes)].sort(),
      `machine-review Epoch ${row.epoch} issue codes are not canonical`);
    validateProfessionalAestheticResult(
      row.professionalAesthetic, thresholdContract, row.epoch,
    );
    assert.equal(row.professionalAesthetic.candidate.imageSha256,
      row.candidatePreview?.sha256,
    `machine-review Epoch ${row.epoch} professional image SHA-256 differs from candidate preview`);
    validateConditionAlignmentResult(row.conditionAlignment, row.epoch);
    assert.equal(row.passed,
      row.professionalAesthetic.passed === true
        && row.conditionAlignment.passed === true,
    `machine-review Epoch ${row.epoch} aggregate result is forged`);
    assert.deepEqual(row.issueCodes, [...new Set([
      ...row.professionalAesthetic.issues.map((item) => item.code),
      ...row.conditionAlignment.issues.map((item) => item.code),
    ])].sort(), `machine-review Epoch ${row.epoch} aggregate issues are forged`);
    if (row.passed) passCount += 1;
  }
  assert.equal(value.previewPassCount, passCount,
    "machine-review previewPassCount differs from reviews[]");
  assert.equal(value.previewFailCount, FIXED_PREVIEW_EPOCHS.length - passCount,
    "machine-review previewFailCount differs from reviews[]");
  assert.equal(value.status, passCount === FIXED_PREVIEW_EPOCHS.length
    ? "stage4_v2_machine_review_passed"
    : "stage4_v2_machine_review_failed",
  "machine-review status differs from reviews[]");
  assert.deepEqual(value.reviewTrainingSeparation, {
    reviewResultsUsedAsTrainingTarget: false,
    failureCodesUsedAsLoss: false,
    failedPreviewPixelsUsedAsTrainingTarget: false,
    thresholdAdaptationDuringTraining: false,
    thresholdLoweringAllowed: false,
  });
  for (const field of [
    "gpuStartedByReview", "optimizerCreatedByReview", "backwardExecutedByReview",
    "weightsModifiedByReview", "trainingStartedByReview",
  ]) assert.equal(value[field], false, `machine-review ${field} differs`);
  assertValidIsoTimestamp(value.recordedAtUtc, "Smoke machine-review result");
  return true;
}

function readExistingJson(target, label) {
  if (!fs.existsSync(target)) return null;
  const stat = fs.lstatSync(target);
  assert.equal(stat.isFile(), true, `${label} is not a regular file`);
  assert.equal(stat.isSymbolicLink(), false, `${label} cannot be a symbolic link`);
  const bytes = fs.readFileSync(target);
  let value;
  try { value = JSON.parse(bytes.toString("utf8")); }
  catch (error) { throw new Error(`${label} is not valid JSON: ${error.message}`); }
  assert.ok(value && typeof value === "object" && !Array.isArray(value),
    `${label} root is invalid`);
  return { value, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
}

function assertValidIsoTimestamp(value, label) {
  assert.equal(typeof value, "string", `${label} timestamp is missing`);
  assert.ok(Number.isFinite(Date.parse(value)), `${label} timestamp is invalid`);
}

export function readPassedPhaseResult(context, phase) {
  const evidenceRoot = path.join(context.executionRoot, "phase-evidence");
  const state = readJsonObject(path.join(context.executionRoot, "execution-state.json"));
  assert.equal(state.latestEvidence?.phase, phase,
    `closed-loop latest evidence is not ${phase}`);
  const database = new DatabaseSync(path.join(context.executionRoot, "execution.sqlite"), {
    readOnly: true,
  });
  let rows;
  try {
    rows = database.prepare(
      "SELECT phase,attempt,logical_path,sha256 FROM artifacts WHERE package_identity=? AND phase=?",
    ).all(context.packageIdentity, phase);
  } finally { database.close(); }
  assert.equal(rows.length, 1,
    `${phase} must have exactly one SQLite-bound passed artifact`);
  const artifact = rows[0];
  assert.equal(state.latestEvidence.attempt, artifact.attempt,
    `${phase} state/SQLite attempt differs`);
  assert.equal(state.latestEvidence.path, artifact.logical_path,
    `${phase} state/SQLite path differs`);
  assert.equal(state.latestEvidence.sha256, artifact.sha256,
    `${phase} state/SQLite SHA-256 differs`);
  const absolutePath = path.resolve(context.executionRoot, ...artifact.logical_path.split("/"));
  assert.equal(path.dirname(absolutePath), evidenceRoot,
    `${phase} artifact escapes the phase evidence directory`);
  const bytes = fs.readFileSync(absolutePath);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), artifact.sha256,
    `${phase} phase evidence bytes changed after SQLite commit`);
  const selected = {
    attempt: artifact.attempt,
    absolutePath,
    bytes,
    value: JSON.parse(bytes.toString("utf8")),
  };
  assert.equal(selected.value?.result?.status, "passed",
    `${phase} SQLite artifact is not passed evidence`);
  assert.equal(selected.value.phase, phase);
  return {
    result: selected.value.result,
    binding: Object.freeze({
      path: projectLogicalPath(context.projectRoot, selected.absolutePath),
      sha256: artifact.sha256,
      byteSize: bytes.length,
    }),
  };
}

export function validateTrainingManifest({ projectRoot, payload, manifestPath }) {
  const manifest = readJsonObject(manifestPath);
  assert.equal(manifest.schemaVersion, "ai-painter-stage4-v2-controlled-smoke-training-manifest-v1");
  assert.equal(manifest.status, "training_completed");
  assert.equal(manifest.packageId, payload.packageId);
  assert.equal(manifest.runId, payload.runId);
  assert.equal(manifest.architectureId, STAGE4_V2_CAPABILITY);
  assert.equal(manifest.sampleId, FIXED_SAMPLE_ID);
  assert.equal(manifest.sampleSplit, "validation");
  assert.equal(manifest.seed, FIXED_SEED);
  assert.deepEqual(manifest.resolution, FIXED_RESOLUTION);
  assert.equal(manifest.epochCount, FIXED_EPOCH_COUNT);
  assert.deepEqual(manifest.previews.map((item) => item.epoch), FIXED_PREVIEW_EPOCHS);
  assert.equal(manifest.historicalDenoiserCheckpointRead, false);
  assert.equal(manifest.parentDenoiserCheckpoint, null);
  assert.equal(manifest.modelState?.changedByTraining, true);
  assert.equal(manifest.autoencoderState?.frozen, true);
  assert.equal(manifest.autoencoderState?.beforeSha256, manifest.autoencoderState?.afterSha256);
  assert.match(manifest.modelState?.initialSha256 ?? "", /^[a-f0-9]{64}$/u,
    "initial Denoiser state hash is invalid");
  assert.match(manifest.modelState?.finalSha256 ?? "", /^[a-f0-9]{64}$/u,
    "final Denoiser state hash is invalid");
  assert.match(manifest.modelState?.terminalEpochStateSha256 ?? "", /^[a-f0-9]{64}$/u,
    "terminal-Epoch Denoiser state hash is invalid");
  assert.notEqual(manifest.modelState.initialSha256, manifest.modelState.finalSha256,
    "Denoiser state did not change during controlled Smoke training");
  assert.match(manifest.autoencoderState?.beforeSha256 ?? "", /^[a-f0-9]{64}$/u,
    "Autoencoder state hash is invalid");
  const expectedCheckpointPath = normalizeLogicalPath(
    `${payload.outputDirectory}/best-smoke-checkpoint.pt`,
  );
  const expectedCheckpointMetadataPath = normalizeLogicalPath(
    `${payload.outputDirectory}/best-smoke-checkpoint.metadata.json`,
  );
  assert.equal(normalizeLogicalPath(manifest.checkpoint?.path), expectedCheckpointPath,
    "Smoke checkpoint is outside the exact current-run checkpoint identity");
  assert.equal(normalizeLogicalPath(manifest.checkpointMetadata?.path),
    expectedCheckpointMetadataPath,
  "Smoke checkpoint metadata is outside the exact current-run identity");
  verifyBinding(projectRoot, manifest.checkpoint, "checkpoint");
  verifyBinding(projectRoot, manifest.checkpointMetadata, "checkpointMetadata");
  verifyBinding(projectRoot, manifest.metrics, "metrics");
  verifyBinding(projectRoot, manifest.resourceTelemetry, "resourceTelemetry");
  const baseConfig = readBoundJson(projectRoot, payload.baseConfig);
  const expectedAccounting = buildExpectedTrainingTokenAccounting(baseConfig);
  assert.deepEqual(manifest.trainingTokenAccounting, expectedAccounting,
    "Manifest Token accounting differs from the frozen controlled-Smoke loop");
  validateTrainingTokenAccounting(manifest.trainingTokenAccounting, "manifest");
  assert.equal(manifest.checkpoint.trainingTokenAccountingSha256,
    canonicalSha256(manifest.trainingTokenAccounting),
    "checkpoint Token-accounting identity differs from Manifest");
  const metricsEvidence = readBoundJson(projectRoot, manifest.metrics);
  assert.equal(metricsEvidence.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-epoch-metrics-v1");
  assert.equal(metricsEvidence.packageId, payload.packageId);
  assert.equal(metricsEvidence.runId, payload.runId);
  assert.equal(metricsEvidence.records.length, FIXED_EPOCH_COUNT);
  const datasetRelease = readBoundJson(projectRoot, payload.datasetRelease);
  const fixedSamples = (datasetRelease.samples ?? [])
    .filter((item) => item.sampleId === FIXED_SAMPLE_ID);
  assert.equal(fixedSamples.length, 1,
    "fixed sample194 is missing or duplicated in the bound dataset release");
  assert.equal(fixedSamples[0].split, "validation",
    "fixed sample194 split differs in the bound dataset release");
  const fixedConditionIdentity = manifest.fixedSampleConditionTensorIdentity;
  assert.deepEqual(fixedConditionIdentity, {
    schemaVersion:
      "ai-painter-stage4-v2-fixed-sample-condition-tensor-identity-v1",
    sampleId: FIXED_SAMPLE_ID,
    sampleSplit: "validation",
    conditionPack: fixedSamples[0].conditionPack,
    conditionTensorSha256: fixedConditionIdentity?.conditionTensorSha256,
  }, "fixed sample194 condition-tensor identity is incomplete or crosses the dataset release");
  assert.match(fixedConditionIdentity.conditionTensorSha256, /^[a-f0-9]{64}$/u,
    "fixed sample194 condition-tensor SHA-256 is invalid");
  verifyBinding(projectRoot, fixedConditionIdentity.conditionPack,
    "fixed_sample194_condition_pack");
  const previewsByEpoch = new Map(
    manifest.previews.map((preview) => [preview.epoch, preview]),
  );
  const selectionWeight = Number(baseConfig.training?.checkpointRolloutWeight ?? 1);
  assert.ok(Number.isFinite(selectionWeight) && selectionWeight >= 0,
    "frozen checkpoint rollout weight is invalid");
  let derivedBestScore = Number.POSITIVE_INFINITY;
  let derivedBestEpoch = 0;
  for (const [index, record] of metricsEvidence.records.entries()) {
    assert.equal(record.epoch, index + 1, "Smoke Epoch metrics are not contiguous");
    validateTrainingTokenAccounting(record.trainingTokenAccounting,
      `epoch_${record.epoch}`, { singleEpoch: true });
    assert.deepEqual(record.trainingTokenAccounting,
      manifest.trainingTokenAccounting.perEpoch[String(record.epoch)],
    `Epoch ${record.epoch} Token accounting differs from Manifest`);
    for (const [group, key] of [
      ["trainMetrics", "compositeLoss"],
      ["validationMetrics", "compositeConditionQualityScore"],
      ["rolloutMetrics", "rolloutRgbQualityScore"],
    ]) assert.ok(Number.isFinite(record[group]?.[key]),
      `Epoch ${record.epoch} ${group}.${key} is missing or non-finite`);
    const derivedScore = record.validationMetrics.compositeConditionQualityScore
      + record.rolloutMetrics.rolloutRgbQualityScore * selectionWeight;
    assert.equal(record.checkpointSelectionScore, derivedScore,
      `Epoch ${record.epoch} checkpoint selection score is forged`);
    const expectedBestUpdate = derivedScore < derivedBestScore;
    assert.equal(record.bestCheckpointUpdated, expectedBestUpdate,
      `Epoch ${record.epoch} best-Checkpoint trace is forged`);
    if (expectedBestUpdate) {
      derivedBestScore = derivedScore;
      derivedBestEpoch = record.epoch;
    }
    const scheduledPreview = previewsByEpoch.get(record.epoch);
    if (scheduledPreview) {
      validateFixedEpochPreviewReproduction({
        projectRoot,
        preview: scheduledPreview,
        metricsRecord: record,
        fixedConditionIdentity,
      });
    } else {
      assert.equal(Object.hasOwn(record, "previewReproduction"), false,
        `unscheduled Epoch ${record.epoch} contains preview reproduction evidence`);
      assert.equal(Object.hasOwn(record, "modelStateSha256"), false,
        `unscheduled Epoch ${record.epoch} contains preview model-state evidence`);
    }
  }
  assert.equal(manifest.bestEpoch, derivedBestEpoch,
    "Manifest bestEpoch differs from the recomputed selection trace");
  assert.equal(manifest.bestValidationScore, derivedBestScore,
    "Manifest bestValidationScore differs from the recomputed selection trace");
  const qualifiedStates = readQualifiedStateIdentities(projectRoot, payload);
  assert.equal(manifest.modelState.initialSha256, qualifiedStates.denoiser,
    "Smoke Denoiser initialization differs from readonly qualification");
  const metadata = readBoundJson(projectRoot, manifest.checkpointMetadata);
  validateCheckpointMetadata({
    metadata, payload, manifest, expectedCheckpointPath,
    expectedAutoencoderStateSha256: qualifiedStates.autoencoder,
  });
  const telemetry = readBoundJson(projectRoot, manifest.resourceTelemetry);
  validateResourceTelemetryEvidence({ telemetry, payload });
  assert.equal(manifest.autoencoderState.beforeSha256,
    metadata.autoencoderStateSha256,
  "training Autoencoder state differs from checkpoint metadata");
  assert.equal(manifest.autoencoderState.beforeSha256, qualifiedStates.autoencoder,
    "training Autoencoder state differs from readonly qualification");
  assert.equal(manifest.checkpoint.promotable, false);
  const terminalPreview = previewsByEpoch.get(FIXED_EPOCH_COUNT);
  assert.equal(terminalPreview.modelStateSha256,
    manifest.modelState.terminalEpochStateSha256,
  "terminal preview model-state identity differs from terminal Epoch state");
  const bestPreview = previewsByEpoch.get(manifest.bestEpoch);
  if (bestPreview) assert.equal(bestPreview.modelStateSha256,
    metadata.denoiserStateSha256,
  "best-Epoch preview model-state identity differs from Checkpoint metadata");
  return manifest;
}

function validateFixedEpochPreviewReproduction({
  projectRoot,
  preview,
  metricsRecord,
  fixedConditionIdentity,
}) {
  const epoch = preview.epoch;
  verifyBinding(projectRoot, preview, `preview_${epoch}`);
  verifyBinding(projectRoot, preview.reproduction,
    `preview_reproduction_${epoch}`);
  assert.equal(preview.byteSize,
    fs.statSync(resolveProjectPath(projectRoot, preview.path, {
      mustExist: true, kind: "file",
    })).size,
  `preview Epoch ${epoch} byteSize differs`);
  assert.equal(preview.reproduction.byteSize,
    fs.statSync(resolveProjectPath(projectRoot, preview.reproduction.path, {
      mustExist: true, kind: "file",
    })).size,
  `preview Epoch ${epoch} reproduction byteSize differs`);
  const evidence = preview.previewReproduction;
  assert.ok(evidence && typeof evidence === "object" && !Array.isArray(evidence),
    `preview Epoch ${epoch} full reproduction evidence is missing`);
  assert.equal(evidence.schemaVersion,
    "stage4-fixed-epoch-preview-reproduction-v1",
  `preview Epoch ${epoch} reproduction schema differs`);
  assert.equal(evidence.status, "fixed_epoch_preview_reproduced_exactly",
    `preview Epoch ${epoch} reproduction status differs`);
  assert.equal(evidence.epoch, epoch,
    `preview Epoch ${epoch} reproduction Epoch differs`);
  assert.equal(evidence.scheduled, true,
    `preview Epoch ${epoch} reproduction is not scheduled`);
  assert.deepEqual(metricsRecord.previewReproduction, evidence,
    `Epoch ${epoch} metrics preview reproduction differs from Manifest`);
  assert.match(metricsRecord.modelStateSha256 ?? "", /^[a-f0-9]{64}$/u,
    `Epoch ${epoch} metrics model-state identity is missing`);

  const source = evidence.sourcePreview;
  const repeated = evidence.repeatedPreview;
  validateFixedPreviewArtifact(source, epoch, "source");
  validateFixedPreviewArtifact(repeated, epoch, "repeated");
  assert.equal(source.previewPath, preview.path,
    `preview Epoch ${epoch} source path differs from Manifest`);
  assert.equal(source.previewSha256, preview.sha256,
    `preview Epoch ${epoch} source PNG SHA-256 differs from Manifest`);
  assert.equal(repeated.previewPath, preview.reproduction.path,
    `preview Epoch ${epoch} repeated path differs from Manifest`);
  assert.equal(repeated.previewSha256, preview.reproduction.sha256,
    `preview Epoch ${epoch} repeated PNG SHA-256 differs from Manifest`);
  assert.notEqual(source.previewPath, repeated.previewPath,
    `preview Epoch ${epoch} source and repeated paths are not independent`);

  const exactMatches = {
    modelStateSha256Matches:
      source.denoiserStateSha256 === repeated.denoiserStateSha256,
    conditionTensorSha256Matches:
      source.conditionTensorSha256 === repeated.conditionTensorSha256,
    rgbTensorSha256Matches:
      source.rgbTensorSha256 === repeated.rgbTensorSha256,
    pngByteSha256Matches:
      source.previewSha256 === repeated.previewSha256,
  };
  for (const [field, expected] of Object.entries(exactMatches)) {
    assert.equal(evidence[field], expected,
      `preview Epoch ${epoch} ${field} is forged`);
    assert.equal(evidence[field], true,
      `preview Epoch ${epoch} ${field} did not pass`);
  }
  assert.equal(preview.reproduction.byteExact,
    exactMatches.pngByteSha256Matches,
  `preview Epoch ${epoch} byteExact is forged`);
  assert.equal(preview.modelStateSha256, source.denoiserStateSha256,
    `preview Epoch ${epoch} model-state identity differs from source evidence`);
  assert.equal(metricsRecord.modelStateSha256, source.denoiserStateSha256,
    `preview Epoch ${epoch} model-state identity differs from Epoch metrics`);
  assert.equal(preview.conditionTensorSha256, source.conditionTensorSha256,
    `preview Epoch ${epoch} condition identity differs from source evidence`);
  assert.equal(source.conditionTensorSha256,
    fixedConditionIdentity.conditionTensorSha256,
  `preview Epoch ${epoch} condition identity differs from fixed sample194 tensor`);
  assert.equal(preview.rgbTensorSha256, source.rgbTensorSha256,
    `preview Epoch ${epoch} RGB tensor identity differs from source evidence`);
  assert.equal(source.latentNormalizationSha256,
    repeated.latentNormalizationSha256,
  `preview Epoch ${epoch} latent normalization identity differs`);
}

function validateFixedPreviewArtifact(value, epoch, role) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value),
    `preview Epoch ${epoch} ${role} artifact is missing`);
  assert.equal(value.schemaVersion,
    "stage4-unified-training-preview-artifact-v1",
  `preview Epoch ${epoch} ${role} artifact schema differs`);
  assert.equal(value.epoch, epoch,
    `preview Epoch ${epoch} ${role} artifact Epoch differs`);
  assert.equal(value.sampleId, FIXED_SAMPLE_ID,
    `preview Epoch ${epoch} ${role} sample identity differs`);
  assert.equal(value.seed, FIXED_SEED + 3000,
    `preview Epoch ${epoch} ${role} seed differs`);
  assert.equal(value.seedIndex, 0,
    `preview Epoch ${epoch} ${role} seed index differs`);
  assert.equal(value.sampleIndex, 0,
    `preview Epoch ${epoch} ${role} sample index differs`);
  assert.equal(value.samplingFunction,
    "evaluate_deterministic_rollout_rgb_quality_v7",
  `preview Epoch ${epoch} ${role} sampling function differs`);
  assert.equal(value.deterministicAlgorithmsEnabled, true,
    `preview Epoch ${epoch} ${role} strict deterministic scope was not active`);
  assert.equal(value.cudnnDeterministic, true,
    `preview Epoch ${epoch} ${role} cuDNN deterministic mode was not active`);
  assert.equal(value.cudnnBenchmark, false,
    `preview Epoch ${epoch} ${role} cuDNN benchmark mode was active`);
  assert.equal(value.cublasWorkspaceConfig, ":4096:8",
    `preview Epoch ${epoch} ${role} CUBLAS deterministic workspace differs`);
  assert.equal(typeof value.conditionLabel, "string",
    `preview Epoch ${epoch} ${role} condition label is missing`);
  assert.equal(typeof value.previewPath, "string",
    `preview Epoch ${epoch} ${role} path is missing`);
  for (const field of [
    "denoiserStateSha256", "conditionTensorSha256", "rgbTensorSha256",
    "latentNormalizationSha256", "previewSha256",
  ]) assert.match(value[field] ?? "", /^[a-f0-9]{64}$/u,
  `preview Epoch ${epoch} ${role} ${field} is invalid`);
}

export function validateResourceTelemetryEvidence({ telemetry, payload }) {
  assert.equal(telemetry.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-resource-telemetry-v1");
  assert.equal(telemetry.status, "completed");
  assert.equal(telemetry.packageId, payload.packageId,
    "resource telemetry crosses the immutable Smoke package boundary");
  assert.equal(telemetry.runId, payload.runId,
    "resource telemetry crosses the immutable Smoke run boundary");
  assert.equal(telemetry.samplingIntervalSeconds, 10);
  assert.equal(telemetry.preflightMemoryClaimedAsTrainingPeak, false);
  assert.ok(Array.isArray(telemetry.records) && telemetry.records.length >= 2,
    "resource telemetry requires at least two in-program samples");

  const allowedPhases = new Set([
    "initializing", "training", "epoch_completed", "training_completed",
  ]);
  let previousTimestamp = -1;
  let hasTrainingSample = false;
  let hasCompletedSample = false;
  let observedPeakGpuMemoryBytes = 0;
  for (const [index, record] of telemetry.records.entries()) {
    const label = `resource telemetry record ${index}`;
    assert.ok(record && typeof record === "object" && !Array.isArray(record),
      `${label} is invalid`);
    assert.equal(Object.hasOwn(record, "telemetryError"), false,
      `${label} is an error sample and cannot prove training resource use`);
    const timestamp = Date.parse(record.recordedAtUtc);
    assert.ok(Number.isFinite(timestamp), `${label} timestamp is invalid`);
    assert.ok(timestamp >= previousTimestamp,
      `${label} timestamp is not monotonic`);
    previousTimestamp = timestamp;
    assert.ok(allowedPhases.has(record.phase), `${label} phase is invalid`);
    assert.ok(Number.isInteger(record.epoch)
      && record.epoch >= 0 && record.epoch <= FIXED_EPOCH_COUNT,
    `${label} epoch is invalid`);
    assert.ok(Number.isInteger(record.optimizerStep)
      && record.optimizerStep >= 0 && record.optimizerStep <= FIXED_EPOCH_COUNT,
    `${label} optimizerStep is invalid`);
    assert.ok(Number.isInteger(record.gpuUtilizationPercent)
      && record.gpuUtilizationPercent >= 0 && record.gpuUtilizationPercent <= 100,
    `${label} GPU utilization is invalid`);
    assert.ok(Number.isSafeInteger(record.deviceMemoryUsedMiB)
      && record.deviceMemoryUsedMiB >= 0,
    `${label} device GPU memory is invalid`);
    assert.equal(record.deviceMemoryUsedBytes,
      record.deviceMemoryUsedMiB * 1024 * 1024,
    `${label} device GPU byte conversion differs`);
    for (const field of [
      "processMemoryAllocatedBytes", "processMemoryReservedBytes",
      "processPeakGpuMemoryBytes",
    ]) assert.ok(Number.isSafeInteger(record[field]) && record[field] >= 0,
    `${label} ${field} is invalid`);
    assert.ok(record.processMemoryAllocatedBytes <= record.processMemoryReservedBytes,
      `${label} allocated GPU memory exceeds reserved memory`);
    assert.ok(record.processMemoryAllocatedBytes <= record.processPeakGpuMemoryBytes,
      `${label} allocated GPU memory exceeds the program peak`);
    observedPeakGpuMemoryBytes = Math.max(
      observedPeakGpuMemoryBytes, record.processPeakGpuMemoryBytes,
    );

    if (record.phase === "initializing") {
      assert.equal(record.epoch, 0, `${label} initializing epoch differs`);
      assert.equal(record.optimizerStep, 0,
        `${label} initializing optimizerStep differs`);
    } else {
      assert.ok(record.epoch > 0, `${label} training phase has no Epoch`);
      hasTrainingSample = true;
    }
    if (record.phase === "training") {
      assert.equal(record.optimizerStep, record.epoch - 1,
        `${label} training optimizerStep differs`);
    } else if (record.phase === "epoch_completed") {
      assert.equal(record.optimizerStep, record.epoch,
        `${label} completed Epoch optimizerStep differs`);
    } else if (record.phase === "training_completed") {
      assert.equal(record.epoch, FIXED_EPOCH_COUNT,
        `${label} training completion Epoch differs`);
      assert.equal(record.optimizerStep, FIXED_EPOCH_COUNT,
        `${label} training completion optimizerStep differs`);
      hasCompletedSample = true;
    }
  }
  assert.equal(hasTrainingSample, true,
    "resource telemetry contains only initialization/preflight evidence");
  assert.equal(hasCompletedSample, true,
    "resource telemetry has no completed in-program training sample");
  assert.ok(observedPeakGpuMemoryBytes > 0,
    "resource telemetry did not observe positive program GPU memory");
  assert.equal(telemetry.peakGpuMemoryBytes, observedPeakGpuMemoryBytes,
    "resource telemetry peakGpuMemoryBytes is forged or stale");
  assert.equal(telemetry.programPeakGpuMemoryBytes, observedPeakGpuMemoryBytes,
    "resource telemetry programPeakGpuMemoryBytes is forged or stale");
  return true;
}

export function buildExpectedTrainingTokenAccounting(config) {
  const width = FIXED_RESOLUTION.width;
  const height = FIXED_RESOLUTION.height;
  const downsample = Number(config.latentDownsampleFactor);
  const latentChannels = Number(config.latentChannels);
  const conditionChannels = Number(config.conditionChannels);
  assert.ok(Number.isInteger(downsample) && downsample > 0
    && width % downsample === 0 && height % downsample === 0,
  "frozen latent downsample factor is invalid");
  assert.equal(latentChannels, 12, "frozen V2 latent channel count differs");
  assert.equal(conditionChannels, 23, "frozen V2 condition channel count differs");
  const fixedValidationTimesteps = config.training?.fixedValidationTimesteps;
  assert.ok(Array.isArray(fixedValidationTimesteps)
    && fixedValidationTimesteps.length > 0,
  "frozen validation timesteps are missing");
  const short = config.training?.shortTrajectorySupervision ?? {};
  const shortSteps = short.enabled === true ? Number(short.steps) : 0;
  const cross = config.training?.stage4CrossDomainVisualConsistency ?? {};
  const crossSteps = cross.enabled === true ? Number(config.inferenceSteps) : 0;
  const rolloutSeeds = Number(config.training?.checkpointRolloutSeedsPerSample ?? 2);
  const inferenceSteps = Number(config.inferenceSteps);
  for (const [label, value] of [
    ["short trajectory steps", shortSteps], ["cross-domain steps", crossSteps],
    ["rollout seed count", rolloutSeeds], ["inference steps", inferenceSteps],
  ]) assert.ok(Number.isInteger(value) && value >= 0,
  `frozen ${label} is invalid`);
  const latentWidth = width / downsample;
  const latentHeight = height / downsample;
  const latentPositions = latentWidth * latentHeight;
  const rolloutSteps = rolloutSeeds * inferenceSteps;
  const trainingForwards = 1 + shortSteps + crossSteps;
  const numericKeys = [
    "latentSpatialTokens", "latentChannelValues", "conditionScalars",
    "rgbPredictionPixels", "samplePresentations", "optimizerSteps",
    "modelForwardPasses", "validationTrajectories",
  ];
  const perEpoch = {};
  for (let epoch = 1; epoch <= FIXED_EPOCH_COUNT; epoch += 1) {
    const reproductionRollout = FIXED_PREVIEW_EPOCHS.includes(epoch)
      ? rolloutSteps : 0;
    const modelForwards = trainingForwards + fixedValidationTimesteps.length
      + rolloutSteps + reproductionRollout;
    const decodedFrames = 1 + shortSteps + (crossSteps ? 1 : 0)
      + fixedValidationTimesteps.length + rolloutSeeds
      + (FIXED_PREVIEW_EPOCHS.includes(epoch) ? rolloutSeeds : 0);
    perEpoch[String(epoch)] = {
      latentSpatialTokens: modelForwards * latentPositions,
      latentChannelValues: modelForwards * latentPositions * latentChannels,
      conditionScalars: modelForwards * width * height * conditionChannels,
      rgbPredictionPixels: decodedFrames * width * height,
      samplePresentations: 1,
      optimizerSteps: 1,
      modelForwardPasses: modelForwards,
      validationTrajectories: 1 + rolloutSeeds
        + (FIXED_PREVIEW_EPOCHS.includes(epoch) ? rolloutSeeds : 0),
      calculationVersion: "stage4_v2_controlled_smoke_exact_loop_v1",
    };
  }
  const runTotals = Object.fromEntries(numericKeys.map((key) => [
    key,
    Object.values(perEpoch).reduce((sum, row) => sum + row[key], 0),
  ]));
  runTotals.calculationVersion = "stage4_v2_controlled_smoke_exact_loop_v1";
  return {
    schemaVersion: "ai-assisted-local-training-token-accounting-v1",
    source: "stage4_v2_controlled_smoke_exact_program_loop",
    localTrainingTokenUnit:
      "one_latent_spatial_position_processed_by_one_model_sample_forward_pass",
    isNlpToken: false,
    externalApiUsageMeasured: false,
    geometry: {
      imageWidth: width, imageHeight: height,
      latentWidth, latentHeight, latentChannels, conditionChannels,
    },
    perEpoch,
    runTotals,
  };
}

function validateCheckpointMetadata({
  metadata, payload, manifest, expectedCheckpointPath,
  expectedAutoencoderStateSha256,
}) {
  assert.equal(metadata.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-checkpoint-metadata-v1");
  assert.equal(metadata.status, "controlled_smoke_non_promotable");
  assert.equal(metadata.packageId, payload.packageId);
  assert.equal(metadata.runId, payload.runId);
  assert.equal(metadata.architectureId, STAGE4_V2_CAPABILITY);
  assert.equal(metadata.sampleId, FIXED_SAMPLE_ID);
  assert.equal(metadata.sampleSplit, "validation");
  assert.equal(metadata.seed, FIXED_SEED);
  assert.deepEqual(metadata.resolution, FIXED_RESOLUTION);
  assert.equal(metadata.bestEpoch, manifest.bestEpoch);
  assert.equal(metadata.bestValidationScore, manifest.bestValidationScore);
  assert.equal(normalizeLogicalPath(metadata.checkpoint?.path), expectedCheckpointPath);
  assert.deepEqual(bindingCore(metadata.checkpoint), bindingCore(manifest.checkpoint));
  assert.match(metadata.denoiserStateSha256 ?? "", /^[a-f0-9]{64}$/u,
    "checkpoint Denoiser state hash is invalid");
  assert.equal(metadata.denoiserStateSha256, manifest.modelState.finalSha256,
    "checkpoint metadata Denoiser state differs from Manifest final state");
  assert.deepEqual(bindingCore(metadata.autoencoderCheckpoint),
    bindingCore(payload.autoencoderCheckpoint),
  "checkpoint metadata binds another Autoencoder checkpoint");
  assert.equal(metadata.autoencoderStateSha256, expectedAutoencoderStateSha256,
    "checkpoint metadata Autoencoder state differs from qualification");
  assert.equal(metadata.parentDenoiserCheckpoint, null);
  assert.equal(metadata.trainingTokenAccountingSha256,
    canonicalSha256(manifest.trainingTokenAccounting));
  assert.equal(metadata.promotable, false);
  assertValidIsoTimestamp(metadata.createdAtUtc, "checkpoint metadata");
  return true;
}

function readQualifiedStateIdentities(projectRoot, payload) {
  verifyBinding(projectRoot, payload.readonlyGpuQualificationTerminal,
    "readonly GPU qualification terminal");
  const terminal = readBoundJson(
    projectRoot, payload.readonlyGpuQualificationTerminal,
  );
  assert.equal(terminal.status, "stage4_v2_readonly_gpu_qualification_passed");
  assert.equal(terminal.packageId !== payload.packageId, true,
    "Smoke package cannot reuse the qualification package identity");
  verifyBinding(projectRoot, terminal.stateIntegrity,
    "readonly GPU qualification state integrity");
  const state = readBoundJson(projectRoot, terminal.stateIntegrity);
  assert.equal(state.status, "verified_unchanged");
  assert.equal(state.autoencoderUnchanged, true);
  const hashes = Object.values(state.autoencoder ?? {});
  assert.ok(hashes.length >= 3,
    "qualification Autoencoder state identity is incomplete");
  for (const hash of hashes) assert.match(hash, /^[a-f0-9]{64}$/u,
    "qualification Autoencoder state hash is invalid");
  assert.equal(new Set(hashes).size, 1,
    "qualification Autoencoder state identity changed");
  const denoiserHashes = Object.values(state.denoiser ?? {});
  assert.ok(denoiserHashes.length >= 3,
    "qualification Denoiser state identity is incomplete");
  for (const hash of denoiserHashes) assert.match(hash, /^[a-f0-9]{64}$/u,
    "qualification Denoiser state hash is invalid");
  assert.equal(new Set(denoiserHashes).size, 1,
    "qualification Denoiser state identity changed");
  return { autoencoder: hashes[0], denoiser: denoiserHashes[0] };
}

function normalizeLogicalPath(value) {
  assert.equal(typeof value, "string", "logical path is missing");
  return value.replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/{2,}/gu, "/");
}

export function validateTrainingTokenAccounting(value, label, { singleEpoch = false } = {}) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value),
    `${label} trainingTokenAccounting is missing`);
  const required = [
    "latentSpatialTokens", "latentChannelValues", "conditionScalars",
    "rgbPredictionPixels", "samplePresentations", "optimizerSteps",
    "modelForwardPasses", "validationTrajectories",
  ];
  const totals = singleEpoch ? value : value.runTotals;
  assert.ok(totals && typeof totals === "object", `${label} Token totals are missing`);
  for (const key of required) assert.ok(Number.isSafeInteger(totals[key]) && totals[key] > 0,
    `${label} Token field ${key} is invalid`);
  assert.equal(totals.calculationVersion,
    "stage4_v2_controlled_smoke_exact_loop_v1",
    `${label} Token calculation version differs`);
  if (!singleEpoch) {
    assert.equal(value.schemaVersion, "ai-assisted-local-training-token-accounting-v1");
    assert.equal(value.isNlpToken, false);
    assert.equal(Object.keys(value.perEpoch ?? {}).length, FIXED_EPOCH_COUNT);
    for (let epoch = 1; epoch <= FIXED_EPOCH_COUNT; epoch += 1) {
      validateTrainingTokenAccounting(value.perEpoch[String(epoch)],
        `${label}.perEpoch.${epoch}`, { singleEpoch: true });
    }
  }
  return true;
}

function validateConditionAlignmentResult(value, epoch) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value),
    `machine-review Epoch ${epoch} condition result is invalid`);
  assert.ok(Array.isArray(value.issues),
    `machine-review Epoch ${epoch} condition issues are missing`);
  const passed = value.issues.length === 0;
  assert.equal(value.passed, passed,
    `machine-review Epoch ${epoch} condition passed flag is forged`);
  assert.equal(value.status,
    passed ? "condition_alignment_passed" : "condition_alignment_failed",
  `machine-review Epoch ${epoch} condition status is forged`);
}

function validateProfessionalAestheticResult(value, thresholdContract, epoch) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value),
    `machine-review Epoch ${epoch} professional result is invalid`);
  const thresholds = thresholdContract.professionalAestheticThresholds;
  const axes = thresholds.multiscaleTextureUpperEnvelope.axes;
  const candidate = value.candidate;
  assert.ok(candidate && typeof candidate === "object",
    `machine-review Epoch ${epoch} professional candidate metrics are missing`);
  const multiscale = candidate.multiscaleTextureValues;
  assert.deepEqual(Object.keys(multiscale ?? {}), Object.keys(axes),
    `machine-review Epoch ${epoch} professional texture axes differ`);
  const expectedViolations = Object.entries(axes)
    .filter(([name, maximum]) => {
      assert.ok(Number.isFinite(multiscale[name]),
        `machine-review Epoch ${epoch} professional texture value is invalid`);
      return multiscale[name] > maximum;
    })
    .map(([name, maximum]) => ({
      feature: name, candidate: roundSix(multiscale[name]),
      frozenMaximum: maximum,
    }));
  assert.deepEqual(value.textureViolations, expectedViolations,
    `machine-review Epoch ${epoch} professional texture violations are forged`);
  assert.ok(Number.isFinite(candidate.quietRegionVariance),
    `machine-review Epoch ${epoch} quiet-region variance is invalid`);
  assert.ok(Number.isFinite(candidate.textureHierarchyRatio),
    `machine-review Epoch ${epoch} texture-hierarchy ratio is invalid`);
  const expectedIssueCodes = [];
  if (expectedViolations.length
    >= thresholds.multiscaleTextureUpperEnvelope.failureViolationCount.value) {
    expectedIssueCodes.push("professional_multiscale_texture_noise_overload");
  }
  if (candidate.quietRegionVariance > thresholds.quietRegionUpperEnvelope.value) {
    expectedIssueCodes.push("professional_quiet_region_missing");
  }
  if (candidate.textureHierarchyRatio
    > thresholds.textureHierarchyUpperEnvelope.value) {
    expectedIssueCodes.push("professional_texture_hierarchy_collapsed");
  }
  assert.ok(Array.isArray(value.issues),
    `machine-review Epoch ${epoch} professional issues are missing`);
  assert.deepEqual(value.issues.map((item) => item.code), expectedIssueCodes,
    `machine-review Epoch ${epoch} professional issues are forged`);
  const passed = expectedIssueCodes.length === 0;
  assert.equal(value.passed, passed,
    `machine-review Epoch ${epoch} professional passed flag is forged`);
  assert.equal(value.status,
    passed ? "professional_aesthetic_passed" : "professional_aesthetic_failed",
  `machine-review Epoch ${epoch} professional status is forged`);
}

function roundSix(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function adjudicateMachineReview(
  review, payload, recordedAtUtc = new Date().toISOString(), thresholdContract,
) {
  validateMachineReviewDecisionInputs(review, payload, thresholdContract);
  const allIssues = review.reviews.flatMap((row) => row.issueCodes ?? []);
  const previewPassCount = review.reviews.filter((row) => row.passed === true).length;
  const previewFailCount = review.reviews.length - previewPassCount;
  const passed = previewPassCount === FIXED_PREVIEW_EPOCHS.length
    && previewFailCount === 0;
  const terrain = allIssues.filter((code) => /water|path|route|shore|hydrolog|boundary/u.test(code));
  const objects = allIssues.filter((code) => /footprint|tree|rock|vegetation|object/u.test(code));
  const aesthetic = allIssues.filter((code) => /professional|texture|aesthetic|quiet_region/u.test(code));
  let responsibility = "none";
  if (!passed) {
    const groups = [terrain.length > 0, objects.length > 0, aesthetic.length > 0].filter(Boolean).length;
    responsibility = groups > 1 ? "cross_responsibility_visual_failure"
      : terrain.length > 0 ? "terrain_route_hydrology_responsibility"
      : objects.length > 0 ? "per_class_object_semantic_responsibility"
      : aesthetic.length > 0 ? "global_visual_harmonization_responsibility"
      : "machine_review_evidence_boundary";
  }
  return {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-causal-adjudication-v1",
    status: "completed_deterministic_adjudication",
    packageId: payload.packageId,
    runId: payload.runId,
    decision: passed ? "controlled_smoke_qualified" : "controlled_smoke_real_visual_failure",
    failureCode: passed ? null : `stage4_v2_${responsibility}`,
    responsibilityBoundary: responsibility,
    previewPassCount,
    previewFailCount,
    issueCodes: [...new Set(allIssues)].sort(),
    thresholdMutationAllowed: false,
    automaticRetryAllowed: false,
    recordedAtUtc,
  };
}

function loadPackage(context) {
  const { value: payload, binding } = readSmokePayload(context.projectRoot, context.packageIdentity);
  assert.equal(context.outputRoot, payload.outputDirectory);
  const packageRoot = resolveProjectPath(context.projectRoot, projectLogicalPath(
    context.projectRoot,
    path.dirname(resolveProjectPath(context.projectRoot, binding.path)),
  ));
  const manifest = readJsonObject(path.join(packageRoot, "smoke-package-manifest.json"));
  assert.equal(manifest.schemaVersion, "ai-painter-stage4-v2-controlled-smoke-package-manifest-v1");
  assert.deepEqual(manifest.packagePayload, binding);
  const ticket = readBoundJson(context.projectRoot, manifest.smokeTicket);
  validateStage4V2SmokePackagePayload(payload, { projectRoot: context.projectRoot, verifyEvidence: true });
  return { payload, packageBinding: binding, packageRoot, manifest, ticket };
}

async function advanceLivePhase(context, payload, phase) {
  const executionState = PHASE_STATE[phase];
  assert.ok(executionState, `unknown Smoke phase: ${phase}`);
  const current = await readCurrentExecutionRegistry(context.projectRoot);
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid");
  assert.equal(current.registry.packageId, payload.packageId);
  assert.equal(current.registry.runId, payload.runId);
  const active = current.registry.activeExecution;
  assert.ok(active, "Smoke active execution is absent");
  assert.equal(active.packageId, payload.packageId);
  const recordedAtUtc = new Date().toISOString();
  if (current.registry.executionState === executionState) {
    const heartbeatPath = resolveProjectPath(context.projectRoot, active.heartbeat.path);
    const heartbeat = readJsonObject(heartbeatPath);
    assert.equal(heartbeat.executionState, executionState,
      "current Smoke heartbeat state differs from the registry");
    writeJsonAtomic(heartbeatPath, { ...heartbeat, heartbeatAtUtc: recordedAtUtc });
    return current;
  }

  // A heartbeat is part of the immutable registry transaction identity.  Do
  // not mutate the heartbeat referenced by the previous registry revision
  // before that revision has been verified.  Each state gets its own file;
  // the registry transaction atomically switches the active binding.
  const lockPath = resolveProjectPath(context.projectRoot, active.lock.path, {
    mustExist: true, kind: "file",
  });
  const lockName = path.basename(lockPath);
  assert.match(lockName, /-lock\.json$/u, "Smoke active lock name is invalid");
  const attemptStem = lockName.replace(/-lock\.json$/u, "");
  const heartbeatPath = path.join(
    path.dirname(lockPath), `${attemptStem}-heartbeat-${executionState}.json`,
  );
  const nextHeartbeat = {
    schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
    capabilityVersion: active.capabilityVersion,
    packageId: active.packageId,
    runId: active.runId,
    executionState,
    processId: active.processId,
    processStartIdentity: active.processStartIdentity,
    heartbeatAtUtc: recordedAtUtc,
    ttlSeconds: active.heartbeat.ttlSeconds,
  };
  if (fs.existsSync(heartbeatPath)) {
    const existing = readJsonObject(heartbeatPath);
    for (const key of [
      "schemaVersion", "capabilityVersion", "packageId", "runId",
      "executionState", "processId", "processStartIdentity", "ttlSeconds",
    ]) assert.equal(existing[key], nextHeartbeat[key],
      `prepared Smoke heartbeat ${key} differs`);
    writeJsonAtomic(heartbeatPath, { ...existing, heartbeatAtUtc: recordedAtUtc });
  } else {
    writeExclusiveJson(heartbeatPath, nextHeartbeat);
  }
  const nextActive = {
    ...active,
    executionState,
    heartbeat: {
      path: projectLogicalPath(context.projectRoot, heartbeatPath),
      ttlSeconds: active.heartbeat.ttlSeconds,
    },
  };
  return advanceCurrentExecutionRegistry({
    projectRoot: context.projectRoot,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: payload.packageId,
    taskId: SMOKE_RUN_TASK,
    taskKind: "controlled_smoke",
    taskGoal: "Execute the fixed Stage4 V2 controlled Smoke, automatic review, causal adjudication and finalization.",
    priority: 1,
    queueStatus: "running",
    nextMachineAction: null,
    queuedAtUtc: current.registry.queuedAtUtc,
    runId: payload.runId,
    lifecycleStage: "readonly_gpu_qualified",
    executionState,
    activity: `stage4_v2_controlled_smoke_${executionState}`,
    taskCapsulePath: current.registry.taskCapsule.path,
    terminalEvidencePath: current.registry.terminalEvidence.path,
    activeExecution: nextActive,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  });
}

function runCheck(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} failed: ${tail(result.stderr)}`);
  return { command: path.basename(command), status: result.status, stdoutTail: tail(result.stdout) };
}

export function prepareTrainerProcessIntent({
  projectRoot, payload, packageRoot, command, args, activeConfigBinding,
}) {
  const intentPath = path.join(packageRoot, "trainer-process-intent.json");
  const processRecordPath = path.join(packageRoot, "trainer-process.json");
  const spawnInvocationPath = path.join(packageRoot, "trainer-spawn-invocation.json");
  const stdoutPath = path.join(packageRoot, "trainer.stdout.log");
  const stderrPath = path.join(packageRoot, "trainer.stderr.log");
  const intent = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-trainer-process-intent-v1",
    status: "prepared_not_proof_of_spawn",
    packageId: payload.packageId,
    runId: payload.runId,
    command: projectLogicalPath(projectRoot, command),
    args,
    processDiscoveryMarker: activeConfigBinding.sha256,
    activeConfig: bindingCore(activeConfigBinding),
    outputDirectory: payload.outputDirectory,
    stdoutPath: projectLogicalPath(projectRoot, stdoutPath),
    stderrPath: projectLogicalPath(projectRoot, stderrPath),
  };
  if (fs.existsSync(intentPath)) {
    assert.deepEqual(readJsonObject(intentPath), intent,
      "persisted Smoke Trainer process intent differs");
  } else writeExclusiveJson(intentPath, intent);
  return Object.freeze({
    intent, intentPath, processRecordPath, spawnInvocationPath,
    stdoutPath, stderrPath,
  });
}

export function observeTrainerProcess({
  trainerProcess, projectRoot,
  processProbe = queryTrainerProcessStartIdentity,
  processDiscovery = discoverTrainerProcessesByMarker,
}) {
  let processRecord = fs.existsSync(trainerProcess.processRecordPath)
    ? readJsonObject(trainerProcess.processRecordPath) : null;
  if (processRecord !== null) {
    validateTrainerProcessRecord(processRecord, trainerProcess.intent);
    if (!["running", "running_recovered_by_marker"].includes(processRecord.state)) {
      return { status: "dead", reason: "trainer_record_is_terminal", processRecord };
    }
    const observation = processProbe(processRecord.processId);
    if (observation.status === "active") {
      if (observation.processStartIdentity !== processRecord.processStartIdentity) {
        return { status: "indeterminate", reason: "trainer_pid_reused", processRecord };
      }
      return { status: "active", processRecord, observation };
    }
    if (observation.status === "indeterminate") {
      return { status: "indeterminate", reason: "trainer_identity_probe_failed", processRecord };
    }
    return { status: "dead", reason: "bound_trainer_process_exited", processRecord };
  }
  const discovered = processDiscovery(trainerProcess.intent.processDiscoveryMarker);
  if (discovered.status === "indeterminate") return discovered;
  if (discovered.rows.length > 1) {
    return { status: "indeterminate", reason: "multiple_matching_trainers" };
  }
  if (discovered.rows.length === 0) {
    if (fs.existsSync(trainerProcess.spawnInvocationPath)) {
      const invocation = readJsonObject(trainerProcess.spawnInvocationPath);
      validateTrainerSpawnInvocation(invocation, trainerProcess.intent);
      return {
        status: "dead", reason: "spawn_invoked_but_no_live_trainer",
        processRecord: null,
      };
    }
    return { status: "absent", reason: "no_trainer_process", processRecord: null };
  }
  const row = discovered.rows[0];
  processRecord = trainerProcessRecord({
    intent: trainerProcess.intent,
    processId: row.processId,
    processStartIdentity: row.processStartIdentity,
    state: "running_recovered_by_marker",
  });
  if (fs.existsSync(trainerProcess.processRecordPath)) {
    assert.deepEqual(readJsonObject(trainerProcess.processRecordPath), processRecord,
      "discovered Trainer process conflicts with persisted identity");
  } else writeExclusiveJson(trainerProcess.processRecordPath, processRecord);
  return { status: "active", processRecord, observation: row };
}

export async function monitorExistingTrainerProcess({
  trainerProcess, observation, progressPath, context,
  processProbe = queryTrainerProcessStartIdentity,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = TRAINING_TIMEOUT_MS,
}) {
  const started = Date.now();
  const record = observation.processRecord;
  while (Date.now() - started <= timeoutMs) {
    const current = processProbe(record.processId);
    if (current.status === "dead") {
      writeTrainerProcessTerminal(trainerProcess, record, null, "exited_observed_by_recovery");
      return { status: "dead" };
    }
    assert.equal(current.status, "active",
      "recovered Smoke Trainer identity became indeterminate");
    assert.equal(current.processStartIdentity, record.processStartIdentity,
      "recovered Smoke Trainer PID was reused");
    reportTrainerProgress(progressPath, context);
    refreshTrainerProcessHeartbeat(trainerProcess, record);
    await wait(10_000);
  }
  const finalProbe = processProbe(record.processId);
  assert.equal(finalProbe.status, "active",
    "Smoke Trainer timeout identity cannot be verified");
  assert.equal(finalProbe.processStartIdentity, record.processStartIdentity,
    "Smoke Trainer timeout PID was reused");
  terminateExactTrainerProcess(record.processId);
  throw new Error("recovered Smoke Trainer exceeded the bounded training timeout and was stopped");
}

function runTrainingChild({ command, args, cwd, progressPath, context, trainerProcess }) {
  for (const logPath of [trainerProcess.stdoutPath, trainerProcess.stderrPath]) {
    if (fs.existsSync(logPath)) {
      assert.equal(fs.statSync(logPath).size, 0,
        "pre-spawn Smoke Trainer log is not empty");
    } else fs.writeFileSync(logPath, "", { flag: "wx" });
  }
  const stdoutFd = fs.openSync(trainerProcess.stdoutPath, "a");
  const stderrFd = fs.openSync(trainerProcess.stderrPath, "a");
  let child;
  try {
    writeExclusiveJson(trainerProcess.spawnInvocationPath, {
      schemaVersion: "ai-painter-stage4-v2-controlled-smoke-trainer-spawn-invocation-v1",
      status: "spawn_invoked_no_retry",
      packageId: trainerProcess.intent.packageId,
      runId: trainerProcess.intent.runId,
      processDiscoveryMarker: trainerProcess.intent.processDiscoveryMarker,
      outputDirectory: trainerProcess.intent.outputDirectory,
      invokedAtUtc: new Date().toISOString(),
    });
    child = spawn(command, args, {
      cwd, windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", stdoutFd, stderrFd],
    });
  } finally {
    fs.closeSync(stdoutFd); fs.closeSync(stderrFd);
  }
  let processRecord;
  try {
    const observed = queryTrainerProcessStartIdentity(child.pid);
    assert.equal(observed.status, "active",
      "new Smoke Trainer process identity could not be established");
    processRecord = trainerProcessRecord({
      intent: trainerProcess.intent,
      processId: child.pid,
      processStartIdentity: observed.processStartIdentity,
      state: "running",
    });
    writeExclusiveJson(trainerProcess.processRecordPath, processRecord);
  } catch (error) {
    child.kill();
    throw error;
  }
  return new Promise((resolve) => {
    let forcedError = null; let complete = false;
    const interval = setInterval(() => {
      try {
        const logBytes = fs.statSync(trainerProcess.stdoutPath).size
          + fs.statSync(trainerProcess.stderrPath).size;
        if (logBytes > MAX_OUTPUT_BYTES) {
          forcedError = new Error("bounded Smoke output exceeded limit");
          child.kill(); return;
        }
        reportTrainerProgress(progressPath, context);
        refreshTrainerProcessHeartbeat(trainerProcess, processRecord);
      } catch (error) { forcedError = error; child.kill(); }
    }, 10_000);
    const timeout = setTimeout(() => { forcedError = new Error("Stage4 V2 Smoke training timed out"); child.kill(); }, TRAINING_TIMEOUT_MS);
    const finish = (status, error = null) => {
      if (complete) return; complete = true; clearInterval(interval); clearTimeout(timeout);
      writeTrainerProcessTerminal(
        trainerProcess, processRecord, status,
        (forcedError ?? error) ? "failed" : "exited",
      );
      resolve({ status, error: forcedError ?? error });
    };
    child.on("error", (error) => finish(null, error)); child.on("close", (status) => finish(status));
  });
}

function validateTrainerSpawnInvocation(value, intent) {
  assert.equal(value.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-trainer-spawn-invocation-v1");
  assert.equal(value.status, "spawn_invoked_no_retry");
  assert.equal(value.packageId, intent.packageId);
  assert.equal(value.runId, intent.runId);
  assert.equal(value.processDiscoveryMarker, intent.processDiscoveryMarker);
  assert.equal(value.outputDirectory, intent.outputDirectory);
  assertValidIsoTimestamp(value.invokedAtUtc, "Smoke Trainer spawn invocation");
  return true;
}

function trainerProcessRecord({ intent, processId, processStartIdentity, state }) {
  return {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-trainer-process-v1",
    state, packageId: intent.packageId, runId: intent.runId,
    processId, processStartIdentity,
    processDiscoveryMarker: intent.processDiscoveryMarker,
    outputDirectory: intent.outputDirectory,
    startedAtUtc: new Date().toISOString(),
    heartbeatAtUtc: new Date().toISOString(),
    exitCode: null, completedAtUtc: null,
  };
}

function validateTrainerProcessRecord(record, intent) {
  assert.equal(record.schemaVersion,
    "ai-painter-stage4-v2-controlled-smoke-trainer-process-v1");
  assert.equal(record.packageId, intent.packageId);
  assert.equal(record.runId, intent.runId);
  assert.equal(record.processDiscoveryMarker, intent.processDiscoveryMarker);
  assert.equal(record.outputDirectory, intent.outputDirectory);
  assert.ok(Number.isInteger(record.processId) && record.processId > 0);
  assert.match(record.processStartIdentity ?? "", /^\d+:.+/u);
  return true;
}

function refreshTrainerProcessHeartbeat(trainerProcess, record) {
  const current = readJsonObject(trainerProcess.processRecordPath);
  validateTrainerProcessRecord(current, trainerProcess.intent);
  assert.equal(current.processStartIdentity, record.processStartIdentity);
  writeJsonAtomic(trainerProcess.processRecordPath, {
    ...current, heartbeatAtUtc: new Date().toISOString(),
  });
}

function writeTrainerProcessTerminal(trainerProcess, record, exitCode, state) {
  const current = readJsonObject(trainerProcess.processRecordPath);
  validateTrainerProcessRecord(current, trainerProcess.intent);
  assert.equal(current.processStartIdentity, record.processStartIdentity);
  writeJsonAtomic(trainerProcess.processRecordPath, {
    ...current, state, exitCode,
    heartbeatAtUtc: new Date().toISOString(),
    completedAtUtc: new Date().toISOString(),
  });
}

function reportTrainerProgress(progressPath, context) {
  if (!fs.existsSync(progressPath)) { context.heartbeat(); return; }
  const value = readJsonObject(progressPath);
  context.reportProgress({
    phasePercent: Number(value.percent ?? 0), epoch: Number(value.epoch ?? 0),
    epochTarget: FIXED_EPOCH_COUNT, optimizerStep: Number(value.optimizerStep ?? 0),
    optimizerStepTarget: Number(value.optimizerStepTarget ?? 0),
    etaSeconds: Number(value.etaSeconds ?? 0),
    message: "Stage4 V2 controlled Smoke training",
  });
}

function queryTrainerProcessStartIdentity(processId) {
  if (!Number.isInteger(processId) || processId <= 0) return { status: "dead" };
  if (process.platform !== "win32") {
    try { process.kill(processId, 0); return {
      status: "active", processId,
      processStartIdentity: `${processId}:non_windows_process`,
    }; } catch { return { status: "dead", processId }; }
  }
  const script = [
    `$p=Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = ${processId}" -ErrorAction SilentlyContinue`,
    "if ($null -eq $p) { exit 3 }",
    "$p.CreationDate.ToUniversalTime().ToString('o')",
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8", windowsHide: true, timeout: 15_000,
  });
  if (result.status === 3) return { status: "dead", processId };
  if (result.error || result.status !== 0) return { status: "indeterminate", processId };
  const creationDate = String(result.stdout ?? "").trim();
  if (!Number.isFinite(Date.parse(creationDate))) return { status: "indeterminate", processId };
  return { status: "active", processId, processStartIdentity: `${processId}:${creationDate}` };
}

function discoverTrainerProcessesByMarker(marker) {
  assert.match(marker ?? "", /^[a-f0-9]{64}$/u,
    "Smoke Trainer discovery marker is invalid");
  if (process.platform !== "win32") return { status: "ok", rows: [] };
  const script = [
    `$m='${marker}'`,
    "$rows=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^python(.exe)?$' -and $_.CommandLine -and $_.CommandLine.Contains($m) } | ForEach-Object { [ordered]@{ processId=[int]$_.ProcessId; creationDateUtc=$_.CreationDate.ToUniversalTime().ToString('o') } })",
    "$rows | ConvertTo-Json -Compress",
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8", windowsHide: true, timeout: 30_000,
  });
  if (result.error || result.status !== 0) {
    return { status: "indeterminate", reason: "trainer_discovery_failed", rows: [] };
  }
  const text = String(result.stdout ?? "").trim();
  const values = text ? JSON.parse(text) : [];
  const rows = (Array.isArray(values) ? values : [values]).map((row) => ({
    status: "active", processId: Number(row.processId),
    processStartIdentity: `${Number(row.processId)}:${row.creationDateUtc}`,
  }));
  return { status: "ok", rows };
}

function terminateExactTrainerProcess(processId) {
  if (process.platform === "win32") {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      `Stop-Process -Id ${processId} -Force -ErrorAction Stop`,
    ], { encoding: "utf8", windowsHide: true, timeout: 15_000 });
    if (result.error || result.status !== 0) throw result.error
      ?? new Error(`failed to stop timed-out Smoke Trainer ${processId}`);
  } else process.kill(processId, "SIGTERM");
}

function readOptionalText(target) {
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
}

function verifyBinding(root, binding, label) {
  assert.match(binding?.sha256 ?? "", /^[a-f0-9]{64}$/u, `${label} SHA invalid`);
  const absolute = resolveProjectPath(root, binding.path, { mustExist: true, kind: "file" });
  assert.equal(sha256File(absolute), binding.sha256, `${label} SHA mismatch`);
}
function bindingCore(binding) {
  assert.equal(typeof binding?.path, "string", "binding path is missing");
  assert.match(binding?.sha256 ?? "", /^[a-f0-9]{64}$/u,
    "binding SHA-256 is invalid");
  return { path: binding.path, sha256: binding.sha256 };
}
function canonicalSha256(value) {
  const canonical = (item) => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object") return Object.fromEntries(
      Object.keys(item).sort().map((key) => [key, canonical(item[key])]),
    );
    return item;
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
function writeExclusiveText(target, value) { fs.writeFileSync(target, String(value ?? ""), { flag: "wx" }); }
function tail(value, length = 1500) { return String(value ?? "").slice(-length); }
function failed(kind, code, error) { return { status: "failed", failureKind: kind, failureCode: code, detail: String(error?.stack ?? error) }; }
