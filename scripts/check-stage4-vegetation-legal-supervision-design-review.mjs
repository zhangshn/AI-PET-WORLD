import assert from "node:assert/strict"
import { CONTRACT_ID, EXPECTED_SPLITS, OBJECT_CLASSES, reviewLegalVegetationSupervision } from "./lib/ai-painter-stage4-vegetation-legal-supervision-design-review.mjs"

const fixture = () => ({
  audit: {
    approvedRecordCount: 64,
    splitCounts: { ...EXPECTED_SPLITS },
    exactConditionChannelCount: 23,
    allConditionOrdersExact: true,
    allReferenceRgbPresentAndHashBound: true,
    allConditionPacksPresentAndHashBound: true,
    allVegetationMasksPresentAndHashBound: true,
    allVegetationMasksNonEmpty: true,
    allTrainingEligibilityBound: true,
    failedPreviewPixelsUsedAsTargets: false,
    machineReviewUsedAsTarget: false,
  },
  coverage: {
    objectClasses: [...OBJECT_CLASSES],
    finalVisibleColorCovered: true,
    finalVisibleEdgeCovered: true,
    perClassLuminanceStructureCovered: true,
    referenceFeatureStructureCovered: true,
    perClassWorstSampleReferenceFeatureCovered: true,
    globalWorstSampleClassLuminanceCovered: true,
    globalWorstSampleClassLuminanceReduction: "maximum_over_sample_and_class",
    perClassWorstSampleLuminanceCovered: false,
    newModelRequired: false,
    freeWeightRequired: false,
  },
})

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => {
  const value = structuredClone(fixture())
  mutate(value)
  assert.throws(() => reviewLegalVegetationSupervision(value), pattern)
  negatives.push(name)
}

positive("selects_unique_per_class_worst_luminance_gap", () => {
  const result = reviewLegalVegetationSupervision(fixture())
  assert.equal(result.contractId, CONTRACT_ID)
  assert.equal(result.selectedDecision, "bounded_inactive_training_objective_contract")
})
positive("derives_without_new_weight", () => {
  const result = reviewLegalVegetationSupervision(fixture())
  assert.equal(result.contract.derivation.addsIndependentLossWeight, false)
  assert.equal(result.contract.invariants.freeHyperparameterSelected, false)
})
positive("keeps_training_and_validation_roles_separate", () => {
  const result = reviewLegalVegetationSupervision(fixture())
  assert.equal(result.contract.invariants.validationRecordsUsedForWeightUpdates, false)
  assert.match(result.contract.checkpointQualification, /validation/)
})
positive("remains_cpu_inactive", () => {
  assert.deepEqual(reviewLegalVegetationSupervision(fixture()).contract.activationGate, {
    cpuSupportOnly: true, checkpointRead: false, optimizer: false, backward: false,
    weightMutation: false, gpu: false, training: false,
  })
})

negative("rejects_record_count_change", (v) => { v.audit.approvedRecordCount = 63 }, /approved_record_count/)
negative("rejects_split_change", (v) => { v.audit.splitCounts.train = 47 }, /split_counts/)
negative("rejects_channel_count_change", (v) => { v.audit.exactConditionChannelCount = 22 }, /condition_channel_count/)
negative("rejects_channel_order_change", (v) => { v.audit.allConditionOrdersExact = false }, /channel_order/)
negative("rejects_missing_reference_rgb", (v) => { v.audit.allReferenceRgbPresentAndHashBound = false }, /reference_rgb/)
negative("rejects_missing_condition_pack", (v) => { v.audit.allConditionPacksPresentAndHashBound = false }, /condition_pack/)
negative("rejects_missing_vegetation_mask", (v) => { v.audit.allVegetationMasksPresentAndHashBound = false }, /vegetation_mask_binding/)
negative("rejects_empty_vegetation_mask", (v) => { v.audit.allVegetationMasksNonEmpty = false }, /vegetation_mask_empty/)
negative("rejects_ineligible_record", (v) => { v.audit.allTrainingEligibilityBound = false }, /training_eligibility/)
negative("rejects_failed_preview_target", (v) => { v.audit.failedPreviewPixelsUsedAsTargets = true }, /failed_preview/)
negative("rejects_review_target", (v) => { v.audit.machineReviewUsedAsTarget = true }, /machine_review/)
negative("rejects_class_order_change", (v) => { v.coverage.objectClasses.reverse() }, /object_class_order/)
negative("rejects_missing_color_coverage", (v) => { v.coverage.finalVisibleColorCovered = false }, /final_visible_color/)
negative("rejects_missing_edge_coverage", (v) => { v.coverage.finalVisibleEdgeCovered = false }, /final_visible_edge/)
negative("rejects_missing_luminance_coverage", (v) => { v.coverage.perClassLuminanceStructureCovered = false }, /per_class_luminance/)
negative("rejects_missing_reference_feature_coverage", (v) => { v.coverage.referenceFeatureStructureCovered = false }, /reference_feature/)
negative("rejects_missing_per_class_reference_precedent", (v) => { v.coverage.perClassWorstSampleReferenceFeatureCovered = false }, /per_class_worst_reference/)
negative("rejects_wrong_existing_reduction", (v) => { v.coverage.globalWorstSampleClassLuminanceReduction = "average" }, /global_worst_luminance_reduction/)
negative("rejects_already_covered_claim", (v) => { v.coverage.perClassWorstSampleLuminanceCovered = true }, /claimed_gap_already_covered/)
negative("rejects_new_model", (v) => { v.coverage.newModelRequired = true }, /new_model/)
negative("rejects_free_weight", (v) => { v.coverage.freeWeightRequired = true }, /free_weight/)

console.log(JSON.stringify({
  schemaVersion: "stage4-vegetation-legal-supervision-design-review-cpu-report-v1",
  status: "passed",
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
}, null, 2))
