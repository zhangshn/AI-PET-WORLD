import assert from "node:assert/strict"

export const EXPECTED_SPLITS = Object.freeze({ train: 48, validation: 8, challenge: 4, regression: 4 })
export const DECISION_A = "original_64_contract_satisfied_no_data_defect_proven"
export const DECISION_B = "original_64_contract_violated"
export const DECISION_C = "original_64_contract_did_not_define_stage4_sufficiency"

export function adjudicateOriginal64Contract({ priorRedesignDecision, planAudit, realizationAudit, sufficiencyAudit }) {
  assert.equal(priorRedesignDecision.status, "data_supervision_redesign_required", "prior_redesign_decision_not_bound")
  assert.equal(planAudit.decisionId, "owner-approved-v7-mvp-first-training-capacity-64-20260725", "original_owner_decision_identity_mismatch")
  assert.equal(planAudit.requiredCompliantRecordCount, 64, "original_capacity_count_mismatch")
  assert.equal(planAudit.plannedSlotCount, 64, "original_slot_count_mismatch")
  assert.deepEqual(planAudit.plannedSplitCounts, EXPECTED_SPLITS, "original_split_contract_mismatch")
  assert.equal(planAudit.firstPlannedSlotId, "v7-capacity-slot-146", "first_slot_identity_mismatch")
  assert.equal(planAudit.lastPlannedSlotId, "v7-capacity-slot-209", "last_slot_identity_mismatch")
  assert.equal(planAudit.themeArchitectureIdentityRequired, true, "theme_architecture_identity_requirement_missing")
  assert.equal(planAudit.instanceDetailIdentityRequired, true, "instance_detail_identity_requirement_missing")
  assert.equal(planAudit.gpuTrainingAuthorized, false, "original_plan_must_not_authorize_training")

  assert.equal(realizationAudit.actualRecordCount, 64, "realized_record_count_mismatch")
  assert.deepEqual(realizationAudit.actualSplitCounts, EXPECTED_SPLITS, "realized_split_mismatch")
  assert.equal(realizationAudit.allPlannedSlotsRealizedExactlyOnce, true, "slot_realization_mismatch")
  assert.equal(realizationAudit.allSplitsMatchPlan, true, "slot_split_mismatch")
  assert.equal(realizationAudit.allSeasonsMatchPlan, true, "slot_season_mismatch")
  assert.equal(realizationAudit.allLandscapeTypesMatchPlan, true, "slot_landscape_mismatch")
  assert.equal(realizationAudit.allContributionHashesMatch, true, "contribution_hash_mismatch")
  assert.equal(realizationAudit.allReferenceRgbHashesMatch, true, "reference_rgb_hash_mismatch")
  assert.equal(realizationAudit.allConditionPackHashesMatch, true, "condition_pack_hash_mismatch")
  assert.equal(realizationAudit.allMachineReviewHashesMatch, true, "machine_review_hash_mismatch")
  assert.equal(realizationAudit.allOwnerReviewHashesMatch, true, "owner_review_hash_mismatch")
  assert.equal(realizationAudit.uniqueReferenceRgbCount, 64, "reference_rgb_uniqueness_mismatch")
  assert.equal(realizationAudit.uniqueConditionPackCount, 64, "condition_pack_uniqueness_mismatch")
  assert.equal(realizationAudit.unplannedSlotCount, 0, "unplanned_slots_present")
  assert.equal(realizationAudit.missingPlannedSlotCount, 0, "planned_slots_missing")

  assert.equal(sufficiencyAudit.validationScenarioMustExistInTrainRequired, false, "invented_validation_train_overlap_requirement")
  assert.equal(sufficiencyAudit.exactConditionReplicationRequired, false, "invented_exact_condition_replication_requirement")
  assert.equal(sufficiencyAudit.sample194RepresentsAllValidationRequired, false, "invented_sample194_representativeness_requirement")
  assert.equal(sufficiencyAudit.explicitStage4SuccessGuarantee, false, "unproven_stage4_success_guarantee")
  assert.equal(sufficiencyAudit.explicitCompleteMapGeneralizationSufficiencyGuarantee, false, "unproven_generalization_sufficiency_guarantee")
  assert.equal(sufficiencyAudit.originalScope, "first_training_capacity_and_split_construction", "original_scope_changed")

  return {
    schemaVersion: "stage4-original-64-contract-correction-decision-v1",
    status: "original_64_contract_correction_succeeded",
    selectedDecision: DECISION_C,
    originalContractSatisfied: true,
    dataDefectProven: false,
    stage4SufficiencyDefinedByOriginalContract: false,
    priorExecutableConclusion: {
      conclusion: "data_supervision_redesign_required",
      status: "superseded_not_actionable",
      reason: "It treated validation novelty, exact-condition uniqueness and sample194 rarity as defects even though the original 64-record contract did not define those as defects and explicitly required independent structure identities.",
    },
    rejectedDecisions: {
      [DECISION_A]: "The realized package satisfies the original construction contract, but A alone would incorrectly imply that the original contract answered the separate Stage4 sufficiency question.",
      [DECISION_B]: "All 64 planned slots, splits, seasons, landscape identities and immutable artifact bindings match the original plan.",
    },
    businessConclusion: "The 64-record product was built as approved. The original decision established a first-training capacity and split, not a guarantee that any particular Stage4 model would pass full visual generalization.",
  }
}
