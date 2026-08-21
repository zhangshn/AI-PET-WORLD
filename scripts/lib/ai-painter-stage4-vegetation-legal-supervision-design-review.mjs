import assert from "node:assert/strict"

export const OBJECT_CLASSES = Object.freeze(["footprints", "tree", "rock", "vegetation"])
export const EXPECTED_SPLITS = Object.freeze({ train: 48, validation: 8, challenge: 4, regression: 4 })
export const CONTRACT_ID = "stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1"

const exact = (actual, expected, label) => assert.deepEqual(actual, expected, `${label}_mismatch`)

export function reviewLegalVegetationSupervision({ audit, coverage }) {
  assert.equal(audit.approvedRecordCount, 64, "approved_record_count_mismatch")
  exact(audit.splitCounts, EXPECTED_SPLITS, "split_counts")
  assert.equal(audit.exactConditionChannelCount, 23, "condition_channel_count_mismatch")
  assert.equal(audit.allConditionOrdersExact, true, "condition_channel_order_mismatch")
  assert.equal(audit.allReferenceRgbPresentAndHashBound, true, "reference_rgb_binding_incomplete")
  assert.equal(audit.allConditionPacksPresentAndHashBound, true, "condition_pack_binding_incomplete")
  assert.equal(audit.allVegetationMasksPresentAndHashBound, true, "vegetation_mask_binding_incomplete")
  assert.equal(audit.allVegetationMasksNonEmpty, true, "vegetation_mask_empty")
  assert.equal(audit.allTrainingEligibilityBound, true, "training_eligibility_incomplete")
  assert.equal(audit.failedPreviewPixelsUsedAsTargets, false, "failed_preview_target_forbidden")
  assert.equal(audit.machineReviewUsedAsTarget, false, "machine_review_target_forbidden")

  exact(coverage.objectClasses, OBJECT_CLASSES, "object_class_order")
  assert.equal(coverage.finalVisibleColorCovered, true, "final_visible_color_not_covered")
  assert.equal(coverage.finalVisibleEdgeCovered, true, "final_visible_edge_not_covered")
  assert.equal(coverage.perClassLuminanceStructureCovered, true, "per_class_luminance_not_covered")
  assert.equal(coverage.referenceFeatureStructureCovered, true, "reference_feature_not_covered")
  assert.equal(coverage.perClassWorstSampleReferenceFeatureCovered, true, "per_class_worst_reference_feature_not_covered")
  assert.equal(coverage.globalWorstSampleClassLuminanceCovered, true, "global_worst_luminance_not_covered")
  assert.equal(coverage.globalWorstSampleClassLuminanceReduction, "maximum_over_sample_and_class", "global_worst_luminance_reduction_changed")
  assert.equal(coverage.perClassWorstSampleLuminanceCovered, false, "claimed_gap_already_covered")
  assert.equal(coverage.newModelRequired, false, "new_model_forbidden")
  assert.equal(coverage.freeWeightRequired, false, "free_weight_forbidden")

  return {
    schemaVersion: "stage4-vegetation-legal-supervision-design-review-v1",
    status: "new_unique_legal_vegetation_supervision_expression_confirmed",
    selectedDecision: "bounded_inactive_training_objective_contract",
    contractId: CONTRACT_ID,
    evidenceFinding: {
      dataSupervisionQualified: true,
      uncoveredBoundary: "per_class_worst_sample_final_visible_luminance_structure",
      existingGlobalReduction: "one_global_maximum_can_hide_a_vegetation_worst_sample_behind_another_class",
      existingReferenceFeaturePrecedent: "per_class_worst_sample_reference_feature_structure_is_already_derived_and_supported",
    },
    contract: {
      schemaVersion: "stage4-per-class-worst-sample-final-visible-luminance-structure-obligation-contract-v1",
      contractId: CONTRACT_ID,
      status: "cpu_support_not_implemented_inactive",
      legalSources: {
        predictedRgb: "existing_50_step_final_decoded_rgb",
        referenceRgb: "original_owner_approved_reference_rgb",
        maskChannels: OBJECT_CLASSES.map((name) => `object_${name}`),
        conditions: "formal_23_channel_condition_pack_in_existing_order",
      },
      derivation: {
        sourceTensors: "existing_weighted_per_sample_class_final_visible_luminance_structure_tensors",
        reduction: "maximum_over_training_samples_separately_for_each_object_class",
        classAggregation: "existing_derived_object_semantic_class_weights",
        rolloutWeight: "existing_formal_full_rollout_weight",
        replaces: "global_maximum_over_sample_and_class_in_the_existing_loss_slot",
        addsIndependentLossWeight: false,
      },
      checkpointQualification: "same_per_class_maximum_reduction_over_validation_records_with_existing_derived_weights",
      invariants: {
        modelArchitectureChanged: false,
        freeHyperparameterSelected: false,
        dataChanged: false,
        reviewThresholdChanged: false,
        failedPreviewPixelsUsedAsTargets: false,
        reviewResultsUsedAsTargets: false,
        validationRecordsUsedForWeightUpdates: false,
      },
      activationGate: {
        cpuSupportOnly: true,
        checkpointRead: false,
        optimizer: false,
        backward: false,
        weightMutation: false,
        gpu: false,
        training: false,
      },
    },
  }
}
