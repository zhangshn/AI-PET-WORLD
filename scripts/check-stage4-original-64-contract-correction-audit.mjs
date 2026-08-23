import assert from "node:assert/strict"
import { DECISION_C, EXPECTED_SPLITS, adjudicateOriginal64Contract } from "./lib/ai-painter-stage4-original-64-contract-correction-audit.mjs"

function fixture() {
  return {
    priorRedesignDecision: { status: "data_supervision_redesign_required" },
    planAudit: {
      decisionId: "owner-approved-v7-mvp-first-training-capacity-64-20260725",
      requiredCompliantRecordCount: 64,
      plannedSlotCount: 64,
      plannedSplitCounts: { ...EXPECTED_SPLITS },
      firstPlannedSlotId: "v7-capacity-slot-146",
      lastPlannedSlotId: "v7-capacity-slot-209",
      themeArchitectureIdentityRequired: true,
      instanceDetailIdentityRequired: true,
      gpuTrainingAuthorized: false,
    },
    realizationAudit: {
      actualRecordCount: 64,
      actualSplitCounts: { ...EXPECTED_SPLITS },
      allPlannedSlotsRealizedExactlyOnce: true,
      allSplitsMatchPlan: true,
      allSeasonsMatchPlan: true,
      allLandscapeTypesMatchPlan: true,
      allContributionHashesMatch: true,
      allReferenceRgbHashesMatch: true,
      allConditionPackHashesMatch: true,
      allMachineReviewHashesMatch: true,
      allOwnerReviewHashesMatch: true,
      uniqueReferenceRgbCount: 64,
      uniqueConditionPackCount: 64,
      unplannedSlotCount: 0,
      missingPlannedSlotCount: 0,
    },
    sufficiencyAudit: {
      validationScenarioMustExistInTrainRequired: false,
      exactConditionReplicationRequired: false,
      sample194RepresentsAllValidationRequired: false,
      explicitStage4SuccessGuarantee: false,
      explicitCompleteMapGeneralizationSufficiencyGuarantee: false,
      originalScope: "first_training_capacity_and_split_construction",
    },
  }
}

const positiveCases = []
const negativeCases = []
const positive = (name, fn) => { fn(); positiveCases.push({ name, passed: true }) }
const negative = (name, mutate, pattern) => {
  const value = structuredClone(fixture())
  mutate(value)
  assert.throws(() => adjudicateOriginal64Contract(value), pattern)
  negativeCases.push({ name, passed: true })
}

positive("selects_contract_did_not_define_stage4_sufficiency", () => {
  const result = adjudicateOriginal64Contract(fixture())
  assert.equal(result.selectedDecision, DECISION_C)
  assert.equal(result.originalContractSatisfied, true)
  assert.equal(result.dataDefectProven, false)
})
positive("supersedes_prior_executable_redesign_conclusion", () => assert.equal(adjudicateOriginal64Contract(fixture()).priorExecutableConclusion.status, "superseded_not_actionable"))
positive("does_not_reclassify_validation_novelty_as_defect", () => assert.match(adjudicateOriginal64Contract(fixture()).priorExecutableConclusion.reason, /validation novelty/))

negative("rejects_wrong_prior_decision", (v) => { v.priorRedesignDecision.status = "other" }, /prior_redesign/)
negative("rejects_owner_decision_change", (v) => { v.planAudit.decisionId = "other" }, /owner_decision/)
negative("rejects_original_count_change", (v) => { v.planAudit.requiredCompliantRecordCount = 63 }, /capacity_count/)
negative("rejects_slot_count_change", (v) => { v.planAudit.plannedSlotCount = 63 }, /slot_count/)
negative("rejects_original_split_change", (v) => { v.planAudit.plannedSplitCounts.validation = 7 }, /split_contract/)
negative("rejects_first_slot_change", (v) => { v.planAudit.firstPlannedSlotId = "v7-capacity-slot-145" }, /first_slot/)
negative("rejects_training_authorized_claim", (v) => { v.planAudit.gpuTrainingAuthorized = true }, /must_not_authorize/)
negative("rejects_actual_count_change", (v) => { v.realizationAudit.actualRecordCount = 63 }, /realized_record/)
negative("rejects_actual_split_change", (v) => { v.realizationAudit.actualSplitCounts.train = 47 }, /realized_split/)
negative("rejects_missing_slot", (v) => { v.realizationAudit.allPlannedSlotsRealizedExactlyOnce = false }, /slot_realization/)
negative("rejects_split_mismatch", (v) => { v.realizationAudit.allSplitsMatchPlan = false }, /slot_split/)
negative("rejects_season_mismatch", (v) => { v.realizationAudit.allSeasonsMatchPlan = false }, /slot_season/)
negative("rejects_landscape_mismatch", (v) => { v.realizationAudit.allLandscapeTypesMatchPlan = false }, /slot_landscape/)
negative("rejects_reference_hash_mismatch", (v) => { v.realizationAudit.allReferenceRgbHashesMatch = false }, /reference_rgb/)
negative("rejects_condition_hash_mismatch", (v) => { v.realizationAudit.allConditionPackHashesMatch = false }, /condition_pack/)
negative("rejects_reference_reuse", (v) => { v.realizationAudit.uniqueReferenceRgbCount = 63 }, /uniqueness/)
negative("rejects_invented_validation_overlap_rule", (v) => { v.sufficiencyAudit.validationScenarioMustExistInTrainRequired = true }, /invented_validation/)
negative("rejects_invented_replication_rule", (v) => { v.sufficiencyAudit.exactConditionReplicationRequired = true }, /invented_exact/)
negative("rejects_invented_sample194_rule", (v) => { v.sufficiencyAudit.sample194RepresentsAllValidationRequired = true }, /invented_sample194/)
negative("rejects_unproven_stage4_guarantee", (v) => { v.sufficiencyAudit.explicitStage4SuccessGuarantee = true }, /stage4_success/)
negative("rejects_unproven_generalization_guarantee", (v) => { v.sufficiencyAudit.explicitCompleteMapGeneralizationSufficiencyGuarantee = true }, /generalization/)

console.log(JSON.stringify({
  schemaVersion: "stage4-original-64-contract-correction-cpu-report-v1",
  status: "passed",
  selectedDecision: DECISION_C,
  positive: { passed: positiveCases.length, total: positiveCases.length, cases: positiveCases },
  negative: { passed: negativeCases.length, total: negativeCases.length, cases: negativeCases },
  dataModified: false,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2))
