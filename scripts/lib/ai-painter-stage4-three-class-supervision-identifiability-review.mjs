import assert from "node:assert/strict"

export const TARGET_CLASSES = Object.freeze(["footprints", "tree", "vegetation"])
export const ALL_CLASSES = Object.freeze(["footprints", "tree", "rock", "vegetation"])
export const EXPECTED_SPLITS = Object.freeze({ train: 48, validation: 8, challenge: 4, regression: 4 })
export const NEXT_CONTRACT_ID = "stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_selection_and_shared_replay_v1"

export function reviewThreeClassSupervisionIdentifiability({ audit, coverage }) {
  assert.equal(audit.approvedRecordCount, 64, "approved_record_count_mismatch")
  assert.deepEqual(audit.splitCounts, EXPECTED_SPLITS, "split_counts_mismatch")
  assert.equal(audit.conditionChannelCount, 23, "condition_channel_count_mismatch")
  assert.equal(audit.allConditionOrdersExact, true, "condition_channel_order_mismatch")
  assert.equal(audit.allReferenceRgbHashBound, true, "reference_rgb_binding_incomplete")
  assert.equal(audit.allConditionPacksHashBound, true, "condition_pack_binding_incomplete")
  assert.deepEqual(audit.maskClasses, TARGET_CLASSES, "target_class_order_mismatch")
  assert.equal(audit.allTargetMasksHashBound, true, "target_mask_binding_incomplete")
  assert.equal(audit.allTargetMasksNonEmpty, true, "target_mask_empty")
  assert.equal(audit.allTrainingEligibilityBound, true, "training_eligibility_incomplete")
  assert.equal(audit.failedPreviewPixelsUsedAsTargets, false, "failed_preview_target_forbidden")
  assert.equal(audit.machineReviewThresholdsOrResultsUsedAsTargets, false, "machine_review_target_forbidden")

  assert.equal(coverage.batchSize, 1, "batch_size_identity_changed")
  assert.equal(coverage.finalVisibleRgbCovered, true, "final_visible_rgb_not_covered")
  assert.equal(coverage.multiscaleLuminanceStructureCovered, true, "luminance_structure_not_covered")
  assert.equal(coverage.referenceFeatureStructureCovered, true, "reference_feature_structure_not_covered")
  assert.equal(coverage.frozenAutoencoderFeatureSourceCovered, true, "frozen_autoencoder_feature_source_not_covered")
  assert.equal(coverage.completeEpochPerClassLuminanceSelectionCovered, true, "complete_epoch_luminance_not_covered")
  assert.equal(coverage.completeEpochPerClassLuminanceReplayActive, true, "complete_epoch_luminance_replay_not_active")
  assert.equal(coverage.referenceFeaturePerClassWorstPopulation, "observed_current_train_split_samples", "reference_feature_population_changed")
  assert.equal(coverage.referenceFeaturePerClassWorstCalledWithCurrentBatchIds, true, "reference_feature_batch_identity_not_proven")
  assert.equal(coverage.completeEpochPerClassReferenceFeatureSelectionCovered, false, "claimed_reference_feature_gap_already_covered")
  assert.equal(coverage.completeEpochLuminanceBypassesLegacyReferenceFeatureReplay, true, "reference_feature_replay_bypass_not_proven")
  assert.equal(coverage.validationReferenceFeatureSelectedIdentityPersisted, false, "validation_reference_feature_identity_gap_not_proven")
  assert.equal(coverage.existingReplayPasses, 2, "existing_replay_budget_changed")
  assert.equal(coverage.existingDerivedWeightsAvailable, true, "derived_weight_source_missing")
  assert.equal(coverage.newModelRequired, false, "new_model_forbidden")
  assert.equal(coverage.freeWeightRequired, false, "free_weight_forbidden")

  return {
    schemaVersion: "stage4-three-class-supervision-identifiability-review-v1",
    status: "unique_uncovered_legal_reference_feature_hard_example_expression_confirmed",
    selectedDecision: "bounded_inactive_training_objective_contract",
    contractId: NEXT_CONTRACT_ID,
    evidenceFinding: {
      dataSupervisionQualified: true,
      alreadyCovered: ["final_visible_rgb", "multiscale_luminance_structure", "frozen_autoencoder_reference_feature_structure", "complete_epoch_per_class_worst_luminance_selection_and_replay"],
      uncoveredBoundary: "complete_epoch_per_class_worst_reference_feature_structure_selection_shared_replay_and_checkpoint_identity",
      reason: "The reference-feature objective is legal and differentiable, but its per-class worst selector sees only the current batch when batchSize=1. The older global reference-feature replay lane is bypassed whenever the complete-epoch luminance replay is active, and validation does not persist the selected reference-feature sample/seed/class identities.",
    },
    contract: {
      schemaVersion: "stage4-epoch-complete-per-class-worst-reference-feature-structure-selection-and-shared-replay-contract-v1",
      contractId: NEXT_CONTRACT_ID,
      status: "cpu_support_not_implemented_inactive",
      legalSources: {
        predictedRgb: "existing_50_step_final_decoded_rgb",
        referenceRgb: "original_owner_approved_reference_rgb",
        maskChannels: ALL_CLASSES.map((name) => `object_${name}`),
        conditions: "formal_23_channel_condition_pack_in_existing_order",
        featureSource: "existing_frozen_project_autoencoder_unique_spatial_feature_stages",
      },
      epochSelection: {
        trainingPopulation: "all_48_train_records_in_one_completed_epoch",
        sourceTensor: "existing_per_sample_per_class_reference_feature_structure_tensor",
        selection: "one_maximum_per_class_with_lexicographic_sample_id_tie_break",
        storedIdentityFields: ["classIdentity", "sampleId", "rawScore", "weightedScore"],
      },
      sharedReplay: {
        optimizerStepBudget: "reuse_existing_two_replay_passes_per_primary_batch",
        schedule: "deterministic_round_robin_over_formal_object_class_order_and_existing_luminance_reference_feature_objective_order",
        addsOptimizerSteps: false,
        addsReplayPasses: false,
        selectedLoss: "existing_derived_weighted_selected_reference_feature_structure_tensor",
        existingCompleteEpochLuminanceReplayPreserved: true,
      },
      checkpointQualification: {
        population: "all_8_validation_records_all_existing_rollout_seeds",
        selection: "one_reference_feature_maximum_per_class_with_sample_id_then_seed_index_tie_break",
        requiredIdentityFields: ["classIdentity", "sampleId", "seedIndex", "rawScore", "weightedScore"],
        aggregation: "existing_derived_class_weights_and_existing_rollout_weight_only",
        entersExistingValidationCheckpointSelectionScore: true,
      },
      invariants: {
        modelArchitectureChanged: false,
        existingLossWeightsChanged: false,
        freeHyperparameterSelected: false,
        optimizerStepBudgetChanged: false,
        dataOrSplitChanged: false,
        checkpointFormatChanged: false,
        reviewThresholdChanged: false,
        failedPreviewPixelsUsedAsTargets: false,
        reviewThresholdsOrResultsUsedAsTargets: false,
      },
      activationGate: { cpuSupportOnly: true, checkpointRead: false, optimizer: false, backward: false, weightMutation: false, gpu: false, training: false },
    },
  }
}
