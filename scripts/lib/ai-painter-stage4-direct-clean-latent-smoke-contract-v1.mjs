import assert from "node:assert/strict";

export const CAPABILITY_VERSION = "stage4-direct-condition-clean-latent-generator-change-candidate-v1";
export const ARCHITECTURE = "stage4_direct_condition_clean_latent_generator_v1";
export const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6";
export const PREVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30]);
export const SPLIT_COUNTS = Object.freeze({ train: 48, validation: 8, challenge: 4, regression: 4 });

export function buildDirectCleanLatentControlledSmokeContract({
  compilationRunId,
  reservedSmokeRunId,
  sourceEvidence,
}) {
  assert.match(compilationRunId ?? "", /^stage4-direct-clean-latent-smoke-contract-[a-z0-9-]+$/);
  assert.match(reservedSmokeRunId ?? "", /^stage4-direct-clean-latent-controlled-smoke-[a-z0-9-]+$/);
  assert.notEqual(compilationRunId, reservedSmokeRunId);
  const outputDirectory = `.runtime/ai-painter/stage4-direct-clean-latent-controlled-smokes/${reservedSmokeRunId}`;
  const contract = {
    schemaVersion: "stage4-direct-clean-latent-controlled-smoke-contract-v1",
    status: "compiled_not_started",
    authority: "local_ai_pet_world_program",
    capabilityVersion: CAPABILITY_VERSION,
    architecture: ARCHITECTURE,
    compilationRunId,
    executionIdentity: {
      runId: reservedSmokeRunId,
      kind: "controlled_single_sample_model_smoke",
      sampleId: SAMPLE_ID,
      sampleSplit: "validation",
      seed: 20263722,
      topology: "west",
      resolutionStage: 0,
      resolution: { width: 256, height: 192 },
      epochCount: 30,
      previewEpochs: [...PREVIEW_EPOCHS],
      initialization: "fixed_random_denoiser_initialization_only",
      autoencoderFrozen: true,
    },
    modelBoundary: {
      conditionChannels: 23,
      cleanLatentChannels: 12,
      latentDownsampleFactor: 4,
      widths: [64, 128, 256],
      forwardPath: "typed_conditions_to_clean_latent_single_forward",
      decodedRgbPath: "clean_latent_to_frozen_project_autoencoder_decode",
      randomNoisyLatentInputAllowed: false,
      diffusionTimestepAllowed: false,
      timeEmbeddingAllowed: false,
      velocityPredictionAllowed: false,
      diffusionRolloutAllowed: false,
    },
    frozenBoundaries: {
      approvedSampleCount: 64,
      splitCounts: { ...SPLIT_COUNTS },
      conditionChannelOrderFrozen: true,
      autoencoderIdentityFrozen: true,
      lossValuesAndWeightsUnchanged: true,
      checkpointFormatUnchanged: true,
      machineReviewThresholdsUnchanged: true,
      failedPreviewPixelsUsedAsTrainingTarget: false,
      machineReviewThresholdsUsedAsTrainingTarget: false,
      machineReviewResultsUsedAsTrainingTarget: false,
    },
    closedLoop: [
      "cpu_positive_negative_gate",
      "active_config_audit",
      "node_trainer_readonly_preflight",
      "python_cuda_disk_resource_preflight",
      "internal_capability_ticket_atomic_consumption",
      "controlled_training",
      "fixed_preview_byte_reproduction",
      "automatic_machine_review",
      "late_stability_qualification",
      "terminal_recording",
      "plan_capsule_event_sqlite_sync",
    ],
    internalCapability: {
      issueAuthority: "local_ai_pet_world_program",
      singleUse: true,
      persistedReplayProtection: true,
      cannotExpandContract: true,
      ownerAuthorizationRequired: false,
      ownerResponseRequired: false,
      issueOnlyAfterAllPreflightChecksPass: true,
    },
    futureEvidenceNamespace: {
      outputDirectory,
      activeConfig: `${outputDirectory}/active-config.json`,
      internalTicket: `${outputDirectory}/internal-ticket.json`,
      ticketConsumption: `${outputDirectory}/internal-ticket-consumption.json`,
      trainingOutput: `${outputDirectory}/training-output`,
      progress: `${outputDirectory}/training-output/progress.json`,
      machineReview: `${outputDirectory}/machine-review.json`,
      lateStabilityQualification: `${outputDirectory}/late-stability-qualification.json`,
      manifest: `${outputDirectory}/manifest.json`,
      finalization: `${outputDirectory}/finalization/finalization.json`,
      phaseTerminal: `${outputDirectory}/phase-terminal.json`,
    },
    evidenceIsolation: {
      outputDirectoryMustNotExistBeforeExecution: true,
      historicalDenoiserAccepted: false,
      historicalCheckpointAccepted: false,
      failedCheckpointAccepted: false,
      historicalRunAccepted: false,
      historicalOutputDirectoryAccepted: false,
      partialTrainingArtifactAccepted: false,
      crossCapabilityArtifactAccepted: false,
      sourceEvidenceHashesRecomputedBeforeExecution: true,
    },
    stopConditions: [
      "identity_or_evidence_conflict",
      "resource_preflight_failure",
      "trainer_or_artifact_failure",
      "real_visual_failure",
      "late_stability_not_qualified",
    ],
    nextActionMapping: {
      qualified: "compile_direct_condition_clean_latent_stage0",
      realVisualFailure: "record_direct_condition_clean_latent_smoke_failure_and_close",
      infrastructureFailure: "record_failure_and_close_without_automatic_retry",
      stage0AutomaticStart: false,
    },
    prohibited: [
      "automatic_retry",
      "free_hyperparameter_search",
      "loss_data_or_threshold_change",
      "stage0_stage1_stage2",
      "formal_inference_checkpoint_promotion_runtime_frame_or_world_entry",
    ],
    sourceEvidence,
  };
  validateDirectCleanLatentControlledSmokeContract(contract);
  return contract;
}

export function validateDirectCleanLatentControlledSmokeContract(value) {
  assert.equal(value.schemaVersion, "stage4-direct-clean-latent-controlled-smoke-contract-v1");
  assert.equal(value.status, "compiled_not_started");
  assert.equal(value.authority, "local_ai_pet_world_program");
  assert.equal(value.capabilityVersion, CAPABILITY_VERSION);
  assert.equal(value.architecture, ARCHITECTURE);
  assert.deepEqual(value.executionIdentity, {
    runId: value.executionIdentity.runId,
    kind: "controlled_single_sample_model_smoke",
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    seed: 20263722,
    topology: "west",
    resolutionStage: 0,
    resolution: { width: 256, height: 192 },
    epochCount: 30,
    previewEpochs: [...PREVIEW_EPOCHS],
    initialization: "fixed_random_denoiser_initialization_only",
    autoencoderFrozen: true,
  });
  assert.match(value.executionIdentity.runId, /^stage4-direct-clean-latent-controlled-smoke-[a-z0-9-]+$/);
  assert.deepEqual(value.modelBoundary.widths, [64, 128, 256]);
  assert.equal(value.modelBoundary.conditionChannels, 23);
  assert.equal(value.modelBoundary.cleanLatentChannels, 12);
  assert.equal(value.modelBoundary.latentDownsampleFactor, 4);
  for (const key of [
    "randomNoisyLatentInputAllowed",
    "diffusionTimestepAllowed",
    "timeEmbeddingAllowed",
    "velocityPredictionAllowed",
    "diffusionRolloutAllowed",
  ]) assert.equal(value.modelBoundary[key], false);
  assert.equal(value.frozenBoundaries.approvedSampleCount, 64);
  assert.deepEqual(value.frozenBoundaries.splitCounts, SPLIT_COUNTS);
  for (const key of [
    "conditionChannelOrderFrozen",
    "autoencoderIdentityFrozen",
    "lossValuesAndWeightsUnchanged",
    "checkpointFormatUnchanged",
    "machineReviewThresholdsUnchanged",
  ]) assert.equal(value.frozenBoundaries[key], true);
  for (const key of [
    "failedPreviewPixelsUsedAsTrainingTarget",
    "machineReviewThresholdsUsedAsTrainingTarget",
    "machineReviewResultsUsedAsTrainingTarget",
  ]) assert.equal(value.frozenBoundaries[key], false);
  for (const required of [
    "controlled_training",
    "automatic_machine_review",
    "late_stability_qualification",
    "terminal_recording",
  ]) assert.ok(value.closedLoop.includes(required));
  assert.equal(value.internalCapability.ownerAuthorizationRequired, false);
  assert.equal(value.internalCapability.ownerResponseRequired, false);
  assert.equal(value.internalCapability.singleUse, true);
  assert.equal(value.internalCapability.persistedReplayProtection, true);
  assert.equal(value.internalCapability.cannotExpandContract, true);
  assert.equal(value.evidenceIsolation.historicalDenoiserAccepted, false);
  assert.equal(value.evidenceIsolation.historicalCheckpointAccepted, false);
  assert.equal(value.evidenceIsolation.failedCheckpointAccepted, false);
  assert.equal(value.evidenceIsolation.historicalRunAccepted, false);
  assert.equal(value.evidenceIsolation.partialTrainingArtifactAccepted, false);
  assert.equal(value.nextActionMapping.stage0AutomaticStart, false);
  assert.equal(value.prohibited.includes("automatic_retry"), true);
  assert.equal(value.prohibited.includes("stage0_stage1_stage2"), true);
  const expectedRoot = `.runtime/ai-painter/stage4-direct-clean-latent-controlled-smokes/${value.executionIdentity.runId}`;
  assert.equal(value.futureEvidenceNamespace.outputDirectory, expectedRoot);
  assert.equal(value.futureEvidenceNamespace.trainingOutput, `${expectedRoot}/training-output`);
  assert.ok(Array.isArray(value.sourceEvidence) && value.sourceEvidence.length >= 8);
  const roles = new Set();
  for (const binding of value.sourceEvidence) {
    assert.match(binding.role, /^[a-z][a-z0-9-]{2,63}$/);
    assert.equal(roles.has(binding.role), false);
    roles.add(binding.role);
    assert.match(binding.path, /^(?![A-Za-z]:)(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+$/);
    assert.match(binding.sha256, /^[a-f0-9]{64}$/);
  }
  for (const role of [
    "readonly-gpu-terminal",
    "readonly-gpu-report",
    "cuda-telemetry",
    "qualified-inactive-config",
    "cpu-support-terminal",
    "source-index",
    "frozen-autoencoder",
    "machine-review-program",
  ]) assert.equal(roles.has(role), true, `missing source evidence role: ${role}`);
  return true;
}
