import assert from "node:assert/strict"

export const BASELINE_ARM = "baseline_current_formal_structure"
export const FUSION_ARM = "condition_fusion_only_final_direct_residual_23_64_12"
export const CAPACITY_ARM = "capacity_only_base_width_64_to_existing_level1_128"
export const SMOKE_ARMS = [FUSION_ARM, CAPACITY_ARM]
export const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
export const PREVIEW_EPOCHS = [1, 5, 10, 20, 30]
export const OUTCOMES = [
  "condition_fusion_only_priority",
  "capacity_only_priority",
  "both_arms_not_qualified_for_stage0",
  "controlled_arm_evidence_conflict",
]

export function compileSmokeContract({ arm, reservedRunId, sourceConfig, sourceConfigBinding, qualification, frozen }) {
  assert(SMOKE_ARMS.includes(arm), "unknown_controlled_structure_arm")
  assert(/^\d{8}-\d{9}$/.test(reservedRunId), "reserved_run_id_invalid")
  assert.equal(sourceConfig.stage4ControlledStructureArm, arm, "source_config_arm_mismatch")
  assert.equal(sourceConfig.status, "stage4_controlled_structure_arm_cpu_supported_inactive", "source_config_not_inactive")
  const outputDirectory = `.runtime/ai-painter/stage4-controlled-structure-controlled-smokes/${reservedRunId}-${arm}`
  const requestId = `owner-authorized-stage4-controlled-structure-smoke-${arm}-${reservedRunId}`
  return {
    schemaVersion: "stage4-controlled-structure-independent-30-epoch-smoke-contract-v1",
    status: "compiled_unsigned_unexecuted_not_authorized",
    arm,
    architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
    structuralDifference: arm === FUSION_ARM
      ? { axis: "condition_fusion_only", finalConditionResidual: [23, 64, 12], addedParameterCount: 20236, baseWidth: 64 }
      : { axis: "capacity_only", baseWidthBefore: 64, baseWidthAfter: 128, derivedWidths: [128, 256, 512], timeEmbeddingChannels: 512 },
    fixedExecutionIdentity: {
      sampleId: SAMPLE_ID,
      sampleSplit: "validation",
      seed: 20263722,
      topology: "west",
      resolution: { width: 256, height: 192 },
      epochCount: 30,
      previewEpochs: [...PREVIEW_EPOCHS],
      autoencoderFrozen: true,
      denoiserInitialization: "fixed_random_initialization_only",
    },
    frozen,
    sourceConfig: sourceConfigBinding,
    readonlyGpuQualification: qualification,
    futureAuthorizationTemplate: {
      schemaVersion: "owner-authorized-stage4-controlled-structure-independent-smoke-v1",
      status: "unsigned_not_authorized_not_consumed",
      requestId,
      commandRef: requestId,
      reservedRunId,
      scope: `one_30_epoch_controlled_smoke_for_${arm}`,
      oneTimeConsumption: true,
      ownerSignatureRequired: true,
      gpuAuthorized: false,
      checkpointWeightsReadAuthorized: false,
      optimizerAuthorized: false,
      backwardAuthorized: false,
      trainingAuthorized: false,
      smokeAuthorized: false,
    },
    futureEvidenceNamespace: {
      outputDirectory,
      checkpointIdentity: `${outputDirectory}/checkpoints/non-promotable-smoke-checkpoint.pt`,
      terminalModelIdentity: `${outputDirectory}/checkpoints/non-promotable-epoch-30-terminal-model.pt`,
      manifest: `${outputDirectory}/manifest.json`,
      finalization: `${outputDirectory}/finalization/finalization.json`,
      machineReviewTimeline: `${outputDirectory}/machine-review-timeline.json`,
      progress: `${outputDirectory}/progress.json`,
      phaseTerminal: `${outputDirectory}/phase-terminal.json`,
    },
    isolation: {
      independentRunId: true,
      independentAuthorization: true,
      independentOutputDirectory: true,
      independentCheckpointIdentity: true,
      independentManifestAndFinalization: true,
      historicalRunAccepted: false,
      failedCheckpointAccepted: false,
      crossArmArtifactAccepted: false,
      baselineExecutedByThisContract: false,
    },
    trainingTargetBoundary: {
      failedPreviewPixelsUsedAsTarget: false,
      machineReviewThresholdUsedAsTarget: false,
      machineReviewResultUsedAsTarget: false,
      existingLossValuesAndWeightsChanged: false,
    },
  }
}

export function compileAdjudicationContract({ fusionContractBinding, capacityContractBinding, baselineConfigBinding, frozen }) {
  return {
    schemaVersion: "stage4-controlled-structure-cross-arm-result-adjudication-contract-v1",
    status: "compiled_inactive_waiting_two_new_smoke_terminals",
    allowedOutcomes: [...OUTCOMES],
    arms: [...SMOKE_ARMS],
    baseline: {
      role: "immutable_structural_difference_reference_only",
      config: baselineConfigBinding,
      executionAuthorized: false,
      historicalPerformanceEvidenceAccepted: false,
    },
    smokeContracts: { fusion: fusionContractBinding, capacity: capacityContractBinding },
    activationPrerequisites: {
      bothFutureSmokeAuthorizationsSignedAndConsumedIndependently: true,
      bothFutureSmokeRunsNaturallyCompleted: true,
      bothFutureTerminalIdentitiesMatchCompiledContracts: true,
      bothFixedPreviewByteReproductionsPresent: true,
      bothMachineReviewTimelinesPresent: true,
      bothModelBeforeAfterHashesPresent: true,
      bothResourceTelemetryPresent: true,
      bothLateStabilityResultsPresent: true,
    },
    comparisonDimensions: [
      "fixed_preview_byte_reproduction",
      "formal_machine_review_timeline",
      "model_weight_change",
      "bound_condition_reachability",
      "resource_consumption",
      "terminal_late_stability",
    ],
    deterministicDecisionOrder: [
      "reject_any_arm_with_invalid_identity_reproduction_or_missing_evidence",
      "prefer_the_only_arm_with_formal_terminal_late_stability_qualification",
      "if_neither_arm_qualifies_return_both_arms_not_qualified_for_stage0",
      "if_both_qualify_prefer_lower_terminal_machine_review_failure_count",
      "if_still_tied_prefer_lower_peak_gpu_memory_bytes",
      "if_still_tied_prefer_lower_denoiser_parameter_count",
      "if_any_comparison_identity_conflicts_return_controlled_arm_evidence_conflict",
    ],
    noFreeScoreWeights: true,
    frozen,
    forbidden: {
      historicalRunEvidence: true,
      failedCheckpointAsInput: true,
      crossArmCheckpointSubstitution: true,
      failedPreviewPixelsAsTrainingTarget: true,
      machineReviewThresholdOrResultAsTrainingTarget: true,
      thresholdReduction: true,
      automaticStage0Start: true,
    },
  }
}

export function validateSmokeContract(contract, expected) {
  assert.equal(contract.schemaVersion, "stage4-controlled-structure-independent-30-epoch-smoke-contract-v1")
  assert.equal(contract.status, "compiled_unsigned_unexecuted_not_authorized")
  assert.equal(contract.arm, expected.arm)
  assert.deepEqual(contract.fixedExecutionIdentity, {
    sampleId: SAMPLE_ID, sampleSplit: "validation", seed: 20263722, topology: "west",
    resolution: { width: 256, height: 192 }, epochCount: 30, previewEpochs: PREVIEW_EPOCHS,
    autoencoderFrozen: true, denoiserInitialization: "fixed_random_initialization_only",
  })
  assert.equal(contract.sourceConfig.sha256, expected.sourceConfigSha256)
  assert.equal(contract.readonlyGpuQualification.terminal.sha256, expected.terminalSha256)
  assert.equal(contract.readonlyGpuQualification.report.sha256, expected.reportSha256)
  assert.equal(contract.readonlyGpuQualification.cudaTelemetry.sha256, expected.cudaSha256)
  assert.equal(contract.readonlyGpuQualification.conditionGradientEvidence.sha256, expected.gradientSha256)
  assert.equal(contract.futureAuthorizationTemplate.status, "unsigned_not_authorized_not_consumed")
  for (const key of ["gpuAuthorized", "checkpointWeightsReadAuthorized", "optimizerAuthorized", "backwardAuthorized", "trainingAuthorized", "smokeAuthorized"]) assert.equal(contract.futureAuthorizationTemplate[key], false)
  assert.equal(contract.isolation.historicalRunAccepted, false)
  assert.equal(contract.isolation.failedCheckpointAccepted, false)
  assert.equal(contract.isolation.crossArmArtifactAccepted, false)
  assert.equal(contract.trainingTargetBoundary.existingLossValuesAndWeightsChanged, false)
}

export function validateAdjudicationContract(contract, expected) {
  assert.equal(contract.schemaVersion, "stage4-controlled-structure-cross-arm-result-adjudication-contract-v1")
  assert.equal(contract.status, "compiled_inactive_waiting_two_new_smoke_terminals")
  assert.deepEqual(contract.allowedOutcomes, OUTCOMES)
  assert.deepEqual(contract.arms, SMOKE_ARMS)
  assert.equal(contract.baseline.config.sha256, expected.baselineConfigSha256)
  assert.equal(contract.baseline.executionAuthorized, false)
  assert.equal(contract.smokeContracts.fusion.sha256, expected.fusionContractSha256)
  assert.equal(contract.smokeContracts.capacity.sha256, expected.capacityContractSha256)
  assert.equal(contract.noFreeScoreWeights, true)
  assert.equal(contract.forbidden.historicalRunEvidence, true)
  assert.equal(contract.forbidden.failedPreviewPixelsAsTrainingTarget, true)
  assert.equal(contract.forbidden.machineReviewThresholdOrResultAsTrainingTarget, true)
  assert.equal(contract.forbidden.automaticStage0Start, true)
}
