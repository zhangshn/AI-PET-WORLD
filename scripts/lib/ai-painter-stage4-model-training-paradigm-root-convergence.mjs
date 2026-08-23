import assert from "node:assert/strict"

export const DECISION_A = "current_model_architecture_capacity_gap_confirmed"
export const DECISION_B = "current_training_paradigm_or_resource_gap_confirmed"
export const DECISION_C = "current_model_and_training_paradigm_joint_gap_confirmed"
export const DECISION_D = "evidence_insufficient_owner_decision_required"

export function adjudicateModelTrainingRootConvergence(input) {
  assert.equal(input.original64.contractSatisfied, true, "original_64_contract_not_satisfied")
  assert.equal(input.original64.dataDefectProven, false, "data_defect_must_not_be_reintroduced")
  assert.equal(input.ownerSelection, "retain_original_64_and_authorize_new_model_or_training_paradigm_design", "owner_selection_mismatch")
  assert.equal(input.history.length, 5, "five_exited_candidate_families_required")
  assert.equal(input.history.every((item) => item.failedVisualQualification === true), true, "historical_failure_evidence_incomplete")
  assert.equal(input.history.every((item) => item.materialMechanismChanged === true), true, "historical_mechanism_comparison_incomplete")

  assert.equal(input.smoke.singleSampleQualified, true, "single_sample_smoke_qualification_missing")
  assert.equal(input.smoke.fixedPreviewReproduced, true, "single_sample_reproduction_missing")
  assert.equal(input.stage0.epochs, 40, "stage0_epoch_count_mismatch")
  assert.equal(input.stage0.optimizerSteps, 5760, "stage0_optimizer_step_count_mismatch")
  assert.equal(input.stage0.sampleCount, 64, "stage0_sample_count_mismatch")
  assert.deepEqual(input.stage0.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 }, "stage0_split_mismatch")
  assert.equal(input.stage0.weightsChanged, true, "stage0_weight_change_missing")
  assert.equal(input.stage0.machineReviewPassCount, 0, "stage0_visual_result_changed")
  assert.deepEqual(input.stage0.failedObjectClasses, ["footprints", "tree", "rock", "vegetation"], "stage0_failed_classes_changed")
  assert.equal(input.stage0.objectivesActiveAndImproving, true, "stage0_objective_evidence_missing")

  assert.equal(input.model.conditionChannels, 23, "condition_channel_count_changed")
  assert.equal(input.model.typedContributionsReachFinalVelocity, true, "condition_to_velocity_path_missing")
  assert.equal(input.model.finalRgbPassesFrozenAutoencoder, true, "frozen_autoencoder_boundary_missing")
  assert.equal(input.model.latentChannels, 12, "latent_channel_identity_changed")
  assert.equal(input.model.latentDownsampleFactor, 4, "latent_downsample_identity_changed")
  assert.equal(input.training.rolloutSteps, 50, "rollout_step_identity_changed")
  assert.equal(input.training.gradientTailSteps, 5, "gradient_tail_identity_changed")
  assert.equal(input.training.stage0CompletedWithoutResourceFailure, true, "stage0_resource_completion_missing")

  assert.equal(input.discriminatingEvidence.architectureCapacityControlledComparison, false, "unexpected_architecture_capacity_control")
  assert.equal(input.discriminatingEvidence.trainingParadigmControlledComparison, false, "unexpected_training_paradigm_control")
  assert.equal(input.discriminatingEvidence.autoencoderSemanticRetentionAuditAcross64, false, "unexpected_autoencoder_retention_audit")
  assert.equal(input.discriminatingEvidence.stage1OrStage2ResourceEvidence, false, "unexpected_high_resolution_resource_evidence")

  return {
    schemaVersion: "stage4-model-training-paradigm-root-convergence-adjudication-v1",
    status: "evidence_insufficient_owner_decision_required",
    selectedDecision: DECISION_D,
    rejectedDecisions: {
      [DECISION_A]: "Single-sample success and multi-sample failure are compatible with a capacity gap, but no controlled architecture-capacity comparison isolates it.",
      [DECISION_B]: "Stage 0 completed without a resource failure, but no controlled training-paradigm comparison and no Stage 1/2 resource evidence isolate training or resources.",
      [DECISION_C]: "Both mechanisms remain plausible, but absence of either controlled comparison prevents a confirmed joint causal finding.",
    },
    provenFacts: {
      original64ProductRetained: true,
      singleSampleExpressivityProven: true,
      multiSampleStage0GeneralizationFailed: true,
      legalObjectivesActiveAndImproving: true,
      typedConditionsReachFinalVelocity: true,
      frozenAutoencoderIsFinalRgbBoundary: true,
      stage0ExecutionResourceFailureObserved: false,
    },
    businessConclusion: "The current system can learn one approved map but has not demonstrated reliable learning across the approved 64-map product. Existing evidence does not uniquely identify model capacity, training method/resources, or both as the root cause.",
    nextEvidenceDependencyOrder: [
      "frozen_autoencoder_semantic_retention_audit_across_64",
      "current_model_multisample_capacity_and_gradient_interference_readonly_diagnostic",
      "bounded_controlled_training_paradigm_comparison_only_if_first_two_are_inconclusive",
    ],
  }
}
