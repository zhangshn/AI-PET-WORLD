import assert from "node:assert/strict"

export const SOURCE_RUN_ID = "20260823-060300000-condition-fusion-stage0"
export const CONTROLLED_ARM = "condition_fusion_only_final_direct_residual_23_64_12"
export const CAPACITY_ARM = "capacity_only_base_width_64_to_existing_level1_128"
export const REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30, 40])
export const OBJECT_ISSUES = Object.freeze([
  "condition_object_footprints_reference_semantic_mismatch",
  "condition_object_tree_reference_semantic_mismatch",
  "condition_object_rock_reference_semantic_mismatch",
  "condition_object_vegetation_reference_semantic_mismatch",
])

const finite = (value, label) => {
  assert.equal(Number.isFinite(value), true, `${label}_must_be_finite`)
  return value
}

function validateActiveStructure(config) {
  const contract = config.training?.stage4ControlledStructureThreeArm
  assert.equal(config.stage4ControlledStructureArm, CONTROLLED_ARM, "active_arm_identity_invalid")
  assert.equal(contract?.armId, CONTROLLED_ARM, "active_contract_arm_invalid")
  assert.equal(contract?.status, "structure_active_owner_authorized", "active_contract_status_invalid")
  assert.equal(contract?.denoiserBaseChannels, 64, "active_contract_width_invalid")
  const gate = contract?.activationGate ?? {}
  const requiredTrue = ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "stage4FullTrainingNow"]
  const requiredFalse = ["smokeNow", "stage1Now", "stage2Now", "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow"]
  for (const key of requiredTrue) assert.equal(gate[key], true, `active_gate_${key}_invalid`)
  for (const key of requiredFalse) assert.equal(gate[key], false, `inactive_gate_${key}_invalid`)
  return contract
}

function metricTimeline(manifest) {
  return REVIEW_EPOCHS.map((epoch) => {
    const row = manifest.metrics?.find((entry) => entry.epoch === epoch)
    assert.ok(row, `epoch_${epoch}_metric_missing`)
    return {
      epoch,
      trainCompositeLoss: finite(row.trainCompositeLoss, `epoch_${epoch}_train_composite_loss`),
      validationCheckpointSelectionScore: finite(row.validationCheckpointSelectionScore, `epoch_${epoch}_checkpoint_score`),
      bestCheckpointUpdated: row.bestCheckpointUpdated === true,
    }
  })
}

function reviewTimeline(review) {
  assert.equal(review.previewCount, 6, "preview_count_invalid")
  assert.equal(review.previewPassCount, 0, "preview_pass_count_invalid")
  assert.equal(review.previewFailCount, 6, "preview_fail_count_invalid")
  assert.deepEqual(review.reviews?.map((entry) => entry.epoch), REVIEW_EPOCHS, "review_epoch_identity_invalid")
  return review.reviews.map((entry) => ({ epoch: entry.epoch, passed: entry.passed === true, issueCodes: [...entry.issueCodes] }))
}

export function validateConditionFusionStage0Evidence(input) {
  const { terminal, manifest, review, activeConfig, resourceTelemetry, crossArmTerminal, crossArmReport, crossArmDecision, formalCpuReport, failedCheckpointIdentity, capacityQualification } = input
  assert.equal(terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed")
  assert.equal(terminal.runId, SOURCE_RUN_ID, "source_run_identity_invalid")
  assert.equal(terminal.stage, 0)
  assert.deepEqual(terminal.fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 })
  assert.equal(terminal.machineReview?.passCount, 0)
  assert.equal(terminal.machineReview?.failCount, 6)
  assert.equal(terminal.checkpoint?.path, failedCheckpointIdentity.path, "failed_checkpoint_path_invalid")
  assert.equal(terminal.checkpoint?.sha256, failedCheckpointIdentity.sha256, "failed_checkpoint_sha_invalid")
  assert.equal(manifest.status, "conditional_denoiser_training_completed_pending_validation")
  assert.equal(manifest.metrics?.length, 40, "forty_epochs_required")
  assert.deepEqual(manifest.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(manifest.modelStateHashEvidence?.weightsChanged, true, "model_weights_not_changed")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.previewSha256Matches, true, "preview_reproduction_invalid")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.denoiserStateIdentityMatches, true, "preview_model_identity_invalid")
  validateActiveStructure(activeConfig)
  assert.equal(resourceTelemetry.status, "formal_training_resource_telemetry_recorded")
  assert.equal(resourceTelemetry.sampleCount > 0, true, "resource_samples_missing")
  assert.equal(resourceTelemetry.peakGpuMemoryBytes > 0, true, "resource_peak_missing")
  assert.equal(crossArmTerminal.status, "stage4_controlled_structure_cross_arm_adjudication_closed")
  assert.equal(crossArmTerminal.outcome, "condition_fusion_only_priority")
  assert.equal(crossArmDecision.outcome, "condition_fusion_only_priority")
  assert.equal(crossArmReport.facts?.bothSmokesNaturallyCompleted, true)
  assert.equal(crossArmReport.facts?.bothLateStabilityQualified, true)
  assert.equal(crossArmReport.facts?.bothTerminalEpoch30Passed, true)
  assert.equal(formalCpuReport.status, "passed_stage4_semantic_mixture_formal_stage_modes_cpu_regression")
  assert.equal(formalCpuReport.positivePassed, formalCpuReport.positiveTotal)
  assert.equal(formalCpuReport.negativePassed, formalCpuReport.negativeTotal)
  assert.equal(capacityQualification.status, "terminal_pass_with_late_convergence_evidence_qualified_closed")
  assert.equal(capacityQualification.stage0EntryPermitted, true)
  return { metrics: metricTimeline(manifest), reviews: reviewTimeline(review) }
}

export function adjudicateConditionFusionStage0FinalRoute(input) {
  const { metrics, reviews } = validateConditionFusionStage0Evidence(input)
  const epoch30Review = reviews.find((entry) => entry.epoch === 30)
  const epoch40Review = reviews.at(-1)
  const epoch33 = input.manifest.metrics.find((entry) => entry.epoch === 33)
  const epoch40 = input.manifest.metrics.find((entry) => entry.epoch === 40)
  assert.equal(input.directExecutionWiringDefectEvidence, false, "unproven_execution_wiring_defect_injected")
  assert.equal(input.directCheckpointCausalDefectEvidence, false, "unproven_checkpoint_causal_defect_injected")
  assert.equal(epoch30Review.passed, false)
  assert.equal(epoch40Review.passed, false)
  for (const code of OBJECT_ISSUES) {
    assert.equal(epoch30Review.issueCodes.includes(code), true, `epoch30_${code}_missing`)
    assert.equal(epoch40Review.issueCodes.includes(code), true, `epoch40_${code}_missing`)
  }
  assert.equal(epoch40Review.issueCodes.includes("condition_terrain_path_ground_coverage_mismatch"), true, "epoch40_path_coverage_fact_missing")
  assert.equal(epoch40Review.issueCodes.includes("condition_terrain_path_ground_required_boundary_contact_missing"), true, "epoch40_west_boundary_fact_missing")
  assert.equal(epoch40.validationCheckpointSelectionScore < epoch33.validationCheckpointSelectionScore, true, "terminal_checkpoint_score_not_improved")
  assert.equal(epoch33.bestCheckpointUpdated, true, "best_epoch_identity_changed")
  assert.equal(epoch40.bestCheckpointUpdated, false, "terminal_best_update_identity_changed")
  return {
    schemaVersion: "stage4-condition-fusion-stage0-final-route-adjudication-v1",
    status: "condition_fusion_multisample_semantic_capacity_insufficient_confirmed",
    selectedCause: "C",
    problem: "The final direct condition residual is correctly active and trainable, but its fixed-width multi-sample Stage 0 still fails all six visual checkpoints and all four terminal reference-semantic obligations.",
    evidence: {
      conditionFusionFormallyActive: true,
      formalCpuContractPassed: true,
      epochsCompleted: 40,
      optimizerStepsCompleted: 5760,
      modelWeightsChanged: true,
      fixedReviewPassCount: 0,
      fixedReviewFailCount: 6,
      persistentObjectFailuresAtEpoch30And40: OBJECT_ISSUES,
      checkpointIdentityDifferencePresent: true,
      checkpointIdentityDifferenceExplainsPersistentVisualFailure: false,
      directExecutionWiringDefectEvidence: false,
      directCheckpointCausalDefectEvidence: false,
      capacityArmSmokeAndLateStabilityQualified: true,
    },
    alternatives: {
      A: { status: "not_selected", reason: "The active config, formal CPU contract, model state change, and complete 40-epoch execution prove the controlled arm is wired and trained." },
      B: { status: "not_selected", reason: "Best/terminal identity differs, but both Epoch 30 and Epoch 40 fail the same four object semantics and all six fixed reviews fail; checkpoint identity cannot explain the persistent route failure." },
      D: { status: "not_selected", reason: "The immutable active-config, metric, review, controlled-Smoke, late-stability, and resource evidence is sufficient to select the only remaining controlled structural route." },
    },
    resolution: {
      exitedArm: CONTROLLED_ARM,
      exitedArmMayBeRerun: false,
      remainingArm: CAPACITY_ARM,
      remainingArmStage0EntryQualified: true,
      newLossAllowed: false,
      fourthArmAllowed: false,
      freeHyperparametersAllowed: false,
      automaticRetryAllowed: false,
    },
    metrics,
    reviews,
  }
}
