import assert from "node:assert/strict"

export const CAPABILITY_VERSION = "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
export const ARCHITECTURE_ID = CAPABILITY_VERSION
export const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
export const PREVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30])
export const SPLIT_COUNTS = Object.freeze({ train: 48, validation: 8, challenge: 4, regression: 4 })
export const CONDITION_CHANNEL_ORDER = Object.freeze([
  "terrain_grass",
  "terrain_water",
  "terrain_path_ground",
  "terrain_shoreline",
  "terrain_natural_boundary",
  "terrain_mud_patch",
  "terrain_tall_grass",
  "walkable",
  "collision",
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
  "focal_area",
  "object_instance",
  "coordinate_x",
  "coordinate_y",
  "signed_distance_path",
  "signed_distance_water",
  "signed_distance_shoreline",
  "signed_distance_object_ground",
  "signed_distance_boundary",
  "moisture_proximity",
])

export const REQUIRED_SOURCE_EVIDENCE_ROLES = Object.freeze([
  "post-wddm-readonly-gpu-terminal",
  "readonly-gpu-terminal",
  "readonly-gpu-report",
  "gradient-evidence",
  "model-state-hashes",
  "cuda-telemetry",
  "readonly-active-config",
  "cpu-support-terminal",
  "architecture-support-contract",
  "source-index",
  "dataset-manifest",
  "frozen-autoencoder",
  "formal-objective-contract",
  "model-factory",
  "mode-registry",
  "trainer",
  "professional-aesthetic-program",
  "condition-alignment-program",
])

export function buildFullBackboneSpatialAffineControlledSmokeContract({
  compilationRunId,
  reservedSmokeRunId,
  sourceEvidence,
}) {
  validateCompilationRunId(compilationRunId)
  validateSmokeRunId(reservedSmokeRunId)
  assert.notEqual(compilationRunId, reservedSmokeRunId)
  const root = `.runtime/ai-painter/stage4-full-backbone-spatial-affine-controlled-smokes/${reservedSmokeRunId}`
  const contract = {
    schemaVersion: "stage4-full-backbone-spatial-affine-controlled-smoke-contract-v1",
    status: "compiled_not_started",
    authority: "local_ai_pet_world_program",
    capabilityVersion: CAPABILITY_VERSION,
    architectureId: ARCHITECTURE_ID,
    compilationRunId,
    executionIdentity: {
      runId: reservedSmokeRunId,
      kind: "controlled_single_validation_sample_model_smoke",
      sampleId: SAMPLE_ID,
      sampleSplit: "validation",
      seed: 20263722,
      topology: "west",
      resolutionStage: 0,
      resolution: { width: 256, height: 192 },
      latentResolution: { width: 64, height: 48 },
      epochCount: 30,
      previewEpochs: [...PREVIEW_EPOCHS],
      initialization: "fixed_random_denoiser_initialization_without_checkpoint",
      autoencoderFrozen: true,
    },
    modelBoundary: {
      conditionChannels: 23,
      conditionChannelOrder: [...CONDITION_CHANNEL_ORDER],
      conditionResizeContract: "discrete_nearest_continuous_bilinear_v1",
      latentChannels: 12,
      latentDownsampleFactor: 4,
      widths: [64, 128, 256],
      timeEmbeddingChannels: 256,
      fullBackboneSpatialAffine: {
        blockIds: ["block0", "block1", "middle1", "middle2", "up_block1", "up_block0"],
        normalizationPointsPerBlock: 2,
        projectionCount: 12,
        parameterTensorCount: 24,
        parameterCount: 745472,
        formula: "normalized * (1 + gamma) + beta",
      },
      forwardPath: "noisy_latent_timestep_and_typed_conditions_to_existing_velocity_prediction",
      existingConditionFusionPreserved: true,
      existingDiffusionObjectivePreserved: true,
      newLossTermAdded: false,
      freeArchitectureParameterChosen: false,
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
      "manifest_and_finalization",
      "terminal_recording",
      "plan_capsule_event_sqlite_registry_sync",
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
      outputDirectory: root,
      activeConfig: `${root}/active-config.json`,
      internalTicket: `${root}/internal-ticket.json`,
      ticketConsumption: `${root}/internal-ticket-consumption.json`,
      preflightReport: `${root}/preflight-report.json`,
      trainingOutput: `${root}/training-output`,
      progress: `${root}/training-output/progress.json`,
      resourceTelemetry: `${root}/training-output/resource-telemetry.json`,
      fixedPreviews: `${root}/training-output/fixed-epoch-previews`,
      machineReviewTimeline: `${root}/machine-review-timeline.json`,
      lateStabilityQualification: `${root}/late-stability-qualification.json`,
      manifest: `${root}/manifest.json`,
      finalization: `${root}/finalization/finalization.json`,
      phaseTerminal: `${root}/phase-terminal.json`,
    },
    outputOwnership: {
      preflightCreatesRootAndPreflightOnly: true,
      preflightMustNotCreateTrainingOutput: true,
      trainerCreatesTrainingOutputExactlyOnce: true,
      trainingOutputMustBeAbsentBeforeTrainerStart: true,
      originalTrainerArtifactsAreImmutable: true,
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
      qualified: "compile_full_backbone_spatial_affine_stage0_execution_contract",
      realVisualFailure: "classify_full_backbone_spatial_affine_smoke_failure_and_close",
      infrastructureFailure: "record_failure_and_close_without_training_retry",
      stage0AutomaticStartInsideSmokePackage: false,
    },
    recoveryBoundary: {
      transactionResumeAllowed: true,
      readOnlyProgramRecoveryAllowed: true,
      trainingRestartAllowed: false,
      automaticSecondTrainingRunAllowed: false,
    },
    prohibited: [
      "automatic_training_retry",
      "free_hyperparameter_search",
      "loss_data_or_threshold_change",
      "historical_or_failed_checkpoint_read",
      "cross_run_or_cross_capability_artifact_reuse",
      "stage0_stage1_stage2_inside_smoke_package",
      "formal_inference_checkpoint_promotion_runtime_frame_or_world_entry",
    ],
    sourceEvidence,
  }
  validateFullBackboneSpatialAffineControlledSmokeContract(contract)
  return contract
}

export function validateFullBackboneSpatialAffineControlledSmokeContract(value) {
  assert.equal(value.schemaVersion, "stage4-full-backbone-spatial-affine-controlled-smoke-contract-v1")
  assert.equal(value.status, "compiled_not_started")
  assert.equal(value.authority, "local_ai_pet_world_program")
  assert.equal(value.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(value.architectureId, ARCHITECTURE_ID)
  validateCompilationRunId(value.compilationRunId)
  validateSmokeRunId(value.executionIdentity.runId)
  assert.notEqual(value.compilationRunId, value.executionIdentity.runId)
  assert.deepEqual(value.executionIdentity, {
    runId: value.executionIdentity.runId,
    kind: "controlled_single_validation_sample_model_smoke",
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    seed: 20263722,
    topology: "west",
    resolutionStage: 0,
    resolution: { width: 256, height: 192 },
    latentResolution: { width: 64, height: 48 },
    epochCount: 30,
    previewEpochs: [...PREVIEW_EPOCHS],
    initialization: "fixed_random_denoiser_initialization_without_checkpoint",
    autoencoderFrozen: true,
  })
  assert.equal(value.modelBoundary.conditionChannels, 23)
  assert.deepEqual(value.modelBoundary.conditionChannelOrder, CONDITION_CHANNEL_ORDER)
  assert.equal(value.modelBoundary.conditionResizeContract, "discrete_nearest_continuous_bilinear_v1")
  assert.equal(value.modelBoundary.latentChannels, 12)
  assert.equal(value.modelBoundary.latentDownsampleFactor, 4)
  assert.deepEqual(value.modelBoundary.widths, [64, 128, 256])
  assert.equal(value.modelBoundary.timeEmbeddingChannels, 256)
  assert.deepEqual(value.modelBoundary.fullBackboneSpatialAffine.blockIds, ["block0", "block1", "middle1", "middle2", "up_block1", "up_block0"])
  assert.equal(value.modelBoundary.fullBackboneSpatialAffine.normalizationPointsPerBlock, 2)
  assert.equal(value.modelBoundary.fullBackboneSpatialAffine.projectionCount, 12)
  assert.equal(value.modelBoundary.fullBackboneSpatialAffine.parameterTensorCount, 24)
  assert.equal(value.modelBoundary.fullBackboneSpatialAffine.parameterCount, 745472)
  assert.equal(value.modelBoundary.existingConditionFusionPreserved, true)
  assert.equal(value.modelBoundary.existingDiffusionObjectivePreserved, true)
  assert.equal(value.modelBoundary.newLossTermAdded, false)
  assert.equal(value.modelBoundary.freeArchitectureParameterChosen, false)
  assert.equal(value.frozenBoundaries.approvedSampleCount, 64)
  assert.deepEqual(value.frozenBoundaries.splitCounts, SPLIT_COUNTS)
  for (const key of ["conditionChannelOrderFrozen", "autoencoderIdentityFrozen", "lossValuesAndWeightsUnchanged", "checkpointFormatUnchanged", "machineReviewThresholdsUnchanged"]) {
    assert.equal(value.frozenBoundaries[key], true)
  }
  for (const key of ["failedPreviewPixelsUsedAsTrainingTarget", "machineReviewThresholdsUsedAsTrainingTarget", "machineReviewResultsUsedAsTrainingTarget"]) {
    assert.equal(value.frozenBoundaries[key], false)
  }
  for (const required of ["controlled_training", "fixed_preview_byte_reproduction", "automatic_machine_review", "late_stability_qualification", "terminal_recording", "plan_capsule_event_sqlite_registry_sync"]) {
    assert.ok(value.closedLoop.includes(required), `missing closed-loop step: ${required}`)
  }
  assert.equal(value.internalCapability.ownerAuthorizationRequired, false)
  assert.equal(value.internalCapability.ownerResponseRequired, false)
  assert.equal(value.internalCapability.singleUse, true)
  assert.equal(value.internalCapability.persistedReplayProtection, true)
  assert.equal(value.internalCapability.cannotExpandContract, true)
  const expectedRoot = `.runtime/ai-painter/stage4-full-backbone-spatial-affine-controlled-smokes/${value.executionIdentity.runId}`
  assert.equal(value.futureEvidenceNamespace.outputDirectory, expectedRoot)
  assert.equal(value.futureEvidenceNamespace.trainingOutput, `${expectedRoot}/training-output`)
  assert.equal(value.outputOwnership.preflightCreatesRootAndPreflightOnly, true)
  assert.equal(value.outputOwnership.preflightMustNotCreateTrainingOutput, true)
  assert.equal(value.outputOwnership.trainerCreatesTrainingOutputExactlyOnce, true)
  assert.equal(value.outputOwnership.trainingOutputMustBeAbsentBeforeTrainerStart, true)
  assert.equal(value.outputOwnership.originalTrainerArtifactsAreImmutable, true)
  for (const key of ["historicalDenoiserAccepted", "historicalCheckpointAccepted", "failedCheckpointAccepted", "historicalRunAccepted", "historicalOutputDirectoryAccepted", "partialTrainingArtifactAccepted", "crossCapabilityArtifactAccepted"]) {
    assert.equal(value.evidenceIsolation[key], false)
  }
  assert.equal(value.evidenceIsolation.outputDirectoryMustNotExistBeforeExecution, true)
  assert.equal(value.evidenceIsolation.sourceEvidenceHashesRecomputedBeforeExecution, true)
  assert.equal(value.nextActionMapping.stage0AutomaticStartInsideSmokePackage, false)
  assert.equal(value.recoveryBoundary.transactionResumeAllowed, true)
  assert.equal(value.recoveryBoundary.trainingRestartAllowed, false)
  assert.equal(value.recoveryBoundary.automaticSecondTrainingRunAllowed, false)
  assert.ok(value.prohibited.includes("automatic_training_retry"))
  assert.ok(value.prohibited.includes("stage0_stage1_stage2_inside_smoke_package"))
  assert.ok(Array.isArray(value.sourceEvidence) && value.sourceEvidence.length >= REQUIRED_SOURCE_EVIDENCE_ROLES.length)
  const roles = new Set()
  for (const binding of value.sourceEvidence) {
    assert.match(binding.role, /^[a-z][a-z0-9-]{2,79}$/u)
    assert.equal(roles.has(binding.role), false, `duplicate source evidence role: ${binding.role}`)
    roles.add(binding.role)
    assert.match(binding.path, /^(?![A-Za-z]:)(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+$/u)
    assert.match(binding.sha256, /^[a-f0-9]{64}$/u)
  }
  for (const role of REQUIRED_SOURCE_EVIDENCE_ROLES) assert.equal(roles.has(role), true, `missing source evidence role: ${role}`)
  return true
}

export function validateCompilationRunId(value) {
  assert.match(value ?? "", /^stage4-full-backbone-spatial-affine-smoke-contract-[0-9]{8}-[0-9]{9}-[0-9a-f]{8}$/u)
  return value
}

export function validateSmokeRunId(value) {
  assert.match(value ?? "", /^stage4-full-backbone-spatial-affine-controlled-smoke-[0-9]{8}-[0-9]{9}-[0-9a-f]{8}$/u)
  return value
}
