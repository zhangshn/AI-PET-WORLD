import assert from "node:assert/strict"
import { OBJECT_CLASSES, EXPECTED_SPLITS, SELECTED_DECISION, adjudicateProjectLevelRedesign } from "./lib/ai-painter-stage4-project-level-data-supervision-resource-redesign.mjs"

function fixture() {
  return {
    sourceDecision: { status: "current_candidate_route_exit_proposed", automaticRetryAllowed: false, newModelOrObjectiveAutoGenerationAllowed: false },
    audit: {
      approvedRecordCount: 64,
      splitCounts: { ...EXPECTED_SPLITS },
      objectClasses: [...OBJECT_CLASSES],
      allReferenceRgbHashBound: true,
      allConditionPacksHashBound: true,
      allConditionOrdersExact: true,
      allObjectMasksHashBound: true,
      allObjectMasksNonEmpty: true,
      allSpatialDimensionsAligned: true,
      allTypedMasksWithinFootprints: true,
      uniqueReferenceRgbCount: 64,
      uniqueConditionPackCount: 64,
      exactConditionReplicateCount: 0,
      validationScenarioCount: 8,
      validationScenariosWithoutTrainCounterpart: ["seasonal-evergreen-semi-evergreen-forest|wet_to_dry_transition|no_water"],
      sample194: { split: "validation", isOnlyValidationWaterScenario: true, totalMatchingBusinessScenarioRecords: 2, matchingTrainRecords: 1, representsAllValidationBusinessScenarios: false },
    },
    executionEvidence: {
      allRegisteredObjectivesActive: true,
      allRegisteredObjectivesImproved: true,
      directWiringDefectEvidence: false,
      terminalFourObjectFailure: true,
      frozenAutoencoderFeaturesQualifiedAsBusinessSemanticLabels: false,
      stage0Resolution: "256x192",
      formalMapResolution: "1024x768",
      stage1OrStage2EvidenceAvailable: false,
    },
  }
}

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push({ name, passed: true }) }
const negative = (name, mutate, pattern) => {
  const value = structuredClone(fixture())
  mutate(value)
  assert.throws(() => adjudicateProjectLevelRedesign(value), pattern)
  negatives.push({ name, passed: true })
}

positive("selects_exactly_data_supervision_redesign_required", () => {
  const result = adjudicateProjectLevelRedesign(fixture())
  assert.equal(result.selectedDecision, SELECTED_DECISION)
  assert.equal(result.buildContract.contractId, "stage4_data_supervision_product_redesign_v1")
  assert.equal(result.buildContract.currentDatasetTreatment.preserveCurrent64Immutable, true)
  assert.equal(result.buildContract.activationGate.training, false)
})
positive("owner_material_actions_are_bounded", () => assert.equal(adjudicateProjectLevelRedesign(fixture()).buildContract.ownerMaterialActions.length, 5))
positive("does_not_generate_model_or_free_hyperparameter", () => {
  const contract = adjudicateProjectLevelRedesign(fixture()).buildContract
  assert.equal(contract.forbiddenActions.includes("invent_model_architecture"), true)
  assert.equal(contract.forbiddenActions.includes("select_free_hyperparameters"), true)
})
positive("keeps_failed_outputs_out_of_targets", () => assert.equal(adjudicateProjectLevelRedesign(fixture()).buildContract.acceptanceGates.failedPreviewOrReviewTargetUse, false))

negative("rejects_wrong_source_route", (v) => { v.sourceDecision.status = "active" }, /source_route/)
negative("rejects_retry_permission", (v) => { v.sourceDecision.automaticRetryAllowed = true }, /retry/)
negative("rejects_record_count_change", (v) => { v.audit.approvedRecordCount = 63 }, /record_count/)
negative("rejects_split_change", (v) => { v.audit.splitCounts.train = 47 }, /split_identity/)
negative("rejects_class_order_change", (v) => { v.audit.objectClasses.reverse() }, /object_class_order/)
negative("rejects_reference_hash_gap", (v) => { v.audit.allReferenceRgbHashBound = false }, /reference_rgb/)
negative("rejects_condition_hash_gap", (v) => { v.audit.allConditionPacksHashBound = false }, /condition_pack/)
negative("rejects_condition_order_change", (v) => { v.audit.allConditionOrdersExact = false }, /condition_channel/)
negative("rejects_empty_mask", (v) => { v.audit.allObjectMasksNonEmpty = false }, /mask_support/)
negative("rejects_spatial_misalignment", (v) => { v.audit.allSpatialDimensionsAligned = false }, /spatial_alignment/)
negative("rejects_typed_mask_outside_footprints", (v) => { v.audit.allTypedMasksWithinFootprints = false }, /typed_mask/)
negative("rejects_reference_identity_reuse", (v) => { v.audit.uniqueReferenceRgbCount = 63 }, /reference_rgb_identity/)
negative("rejects_unproven_distribution_gap", (v) => { v.audit.validationScenariosWithoutTrainCounterpart = [] }, /distribution_gap/)
negative("rejects_sample194_split_change", (v) => { v.audit.sample194.split = "train" }, /sample194_split/)
negative("rejects_sample194_representative_claim", (v) => { v.audit.sample194.representsAllValidationBusinessScenarios = true }, /sample194/)
negative("rejects_inactive_objectives", (v) => { v.executionEvidence.allRegisteredObjectivesActive = false }, /objectives_not_proven_active/)
negative("rejects_unproven_improvement", (v) => { v.executionEvidence.allRegisteredObjectivesImproved = false }, /improvement/)
negative("rejects_hidden_wiring_defect", (v) => { v.executionEvidence.directWiringDefectEvidence = true }, /wiring_defect/)
negative("rejects_missing_terminal_failure", (v) => { v.executionEvidence.terminalFourObjectFailure = false }, /terminal_four/)
negative("rejects_autoencoder_semantic_authority_claim", (v) => { v.executionEvidence.frozenAutoencoderFeaturesQualifiedAsBusinessSemanticLabels = true }, /business_semantic/)
negative("rejects_higher_resolution_evidence_claim", (v) => { v.executionEvidence.stage1OrStage2EvidenceAvailable = true }, /higher_resolution/)

console.log(JSON.stringify({
  schemaVersion: "stage4-project-level-data-supervision-resource-redesign-cpu-report-v1",
  status: "passed",
  selectedDecision: SELECTED_DECISION,
  positive: { passed: positives.length, total: positives.length, cases: positives },
  negative: { passed: negatives.length, total: negatives.length, cases: negatives },
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2))
