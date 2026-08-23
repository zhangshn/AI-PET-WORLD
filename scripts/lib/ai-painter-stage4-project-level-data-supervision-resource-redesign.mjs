import assert from "node:assert/strict"

export const OBJECT_CLASSES = Object.freeze(["footprints", "tree", "rock", "vegetation"])
export const EXPECTED_SPLITS = Object.freeze({ train: 48, validation: 8, challenge: 4, regression: 4 })
export const SELECTED_DECISION = "data_supervision_redesign_required"

export function adjudicateProjectLevelRedesign(input) {
  const { sourceDecision, audit, executionEvidence } = input

  assert.equal(sourceDecision.status, "current_candidate_route_exit_proposed", "source_route_exit_not_bound")
  assert.equal(sourceDecision.automaticRetryAllowed, false, "same_stage0_retry_must_remain_forbidden")
  assert.equal(sourceDecision.newModelOrObjectiveAutoGenerationAllowed, false, "automatic_model_or_objective_generation_forbidden")

  assert.equal(audit.approvedRecordCount, 64, "approved_record_count_mismatch")
  assert.deepEqual(audit.splitCounts, EXPECTED_SPLITS, "split_identity_mismatch")
  assert.deepEqual(audit.objectClasses, OBJECT_CLASSES, "object_class_order_mismatch")
  assert.equal(audit.allReferenceRgbHashBound, true, "reference_rgb_binding_incomplete")
  assert.equal(audit.allConditionPacksHashBound, true, "condition_pack_binding_incomplete")
  assert.equal(audit.allConditionOrdersExact, true, "condition_channel_order_mismatch")
  assert.equal(audit.allObjectMasksHashBound, true, "object_mask_binding_incomplete")
  assert.equal(audit.allObjectMasksNonEmpty, true, "object_mask_support_incomplete")
  assert.equal(audit.allSpatialDimensionsAligned, true, "reference_mask_spatial_alignment_incomplete")
  assert.equal(audit.allTypedMasksWithinFootprints, true, "typed_mask_footprint_alignment_incomplete")
  assert.equal(audit.uniqueReferenceRgbCount, 64, "reference_rgb_identity_not_unique")
  assert.equal(audit.uniqueConditionPackCount, 64, "condition_pack_identity_not_unique")
  assert.equal(audit.exactConditionReplicateCount, 0, "unexpected_exact_condition_replication")
  assert.equal(audit.validationScenarioCount, 8, "validation_scenario_count_mismatch")
  assert.equal(audit.validationScenariosWithoutTrainCounterpart.length > 0, true, "claimed_distribution_gap_not_proven")
  assert.equal(audit.sample194.split, "validation", "sample194_split_changed")
  assert.equal(audit.sample194.isOnlyValidationWaterScenario, true, "sample194_water_identity_not_proven")
  assert.equal(audit.sample194.totalMatchingBusinessScenarioRecords, 2, "sample194_scenario_population_changed")
  assert.equal(audit.sample194.matchingTrainRecords, 1, "sample194_train_counterpart_count_changed")
  assert.equal(audit.sample194.representsAllValidationBusinessScenarios, false, "sample194_must_not_be_claimed_representative")

  assert.equal(executionEvidence.allRegisteredObjectivesActive, true, "current_objectives_not_proven_active")
  assert.equal(executionEvidence.allRegisteredObjectivesImproved, true, "objective_improvement_not_proven")
  assert.equal(executionEvidence.directWiringDefectEvidence, false, "unexpected_wiring_defect")
  assert.equal(executionEvidence.terminalFourObjectFailure, true, "terminal_four_object_failure_not_bound")
  assert.equal(executionEvidence.frozenAutoencoderFeaturesQualifiedAsBusinessSemanticLabels, false, "autoencoder_feature_business_semantic_qualification_not_proven")
  assert.equal(executionEvidence.stage0Resolution, "256x192", "stage0_resolution_changed")
  assert.equal(executionEvidence.formalMapResolution, "1024x768", "formal_map_resolution_changed")
  assert.equal(executionEvidence.stage1OrStage2EvidenceAvailable, false, "unavailable_higher_resolution_evidence_claimed")

  return {
    schemaVersion: "stage4-project-level-data-supervision-resource-redesign-decision-v1",
    status: "project_level_redesign_succeeded",
    selectedDecision: SELECTED_DECISION,
    rejectedDecisions: {
      resource_validation_redesign_required: "Resource and scale evidence is incomplete, but it is not the sole blocker: a concrete train/validation coverage and supervision-product gap is already proven.",
      current_complete_map_generation_route_not_executable: "The evidence does not prove the complete-map business route impossible; it proves the current 64-record data/supervision product cannot validate it.",
      evidence_insufficient_for_project_level_redesign: "The immutable 64-record identities, split coverage, source masks/reference RGB and completed Stage 0 evidence are sufficient to select the data/supervision redesign boundary.",
    },
    findings: {
      dataIntegrity: "All 64 records are immutable, hash-bound and spatially aligned; the problem is not missing files or corrupted masks.",
      coverageGap: "The split does not close every validation business scenario against train, and fixed sample 194 represents a rare two-record water scenario with only one train counterpart.",
      identifiabilityGap: "Every exact 23-channel condition identity occurs once, so the current package cannot demonstrate repeatable appearance semantics for equivalent conditions across independent approved references.",
      supervisionProductGap: "Binary object masks localize four classes, while current final-RGB, luminance and frozen-Autoencoder-feature objectives improved without producing auditable object semantics across the multi-sample Stage 0 distribution.",
      autoencoderBoundary: "Frozen Autoencoder features are a legal derived signal but are not independently qualified as a business-semantic label; improvement in that feature objective cannot substitute for reference-visible object semantics.",
      resourceBoundary: "Only 256x192 Stage 0 has executable evidence. This cannot by itself validate native 1024x768 complete-map generation, but higher-resolution validation should not proceed before the data/supervision coverage gate closes.",
    },
    buildContract: buildDataSupervisionContract(),
  }
}

function buildDataSupervisionContract() {
  return {
    schemaVersion: "stage4-data-supervision-product-redesign-contract-v1",
    contractId: "stage4_data_supervision_product_redesign_v1",
    status: "bounded_inactive_owner_materials_required",
    purpose: "Build a versioned, auditable data/supervision product capable of testing whether WorldFacts, VisualFactManifest and the formal 23-channel condition pack determine visible complete-map object semantics.",
    currentDatasetTreatment: {
      preserveCurrent64Immutable: true,
      current64RemainHistoricalApprovedEvidence: true,
      mutateOrRelabelInPlace: false,
      failedStage0OutputsEligibleAsTargets: false,
    },
    requiredProducts: [
      {
        id: "business_scenario_coverage_matrix",
        source: "current approved WorldFacts, VisualFactManifest, contribution records and condition packs",
        completionRule: "Every validation business-scenario signature must have an independently approved train counterpart; challenge and regression identities remain isolated.",
      },
      {
        id: "object_visibility_and_reference_alignment_manifest",
        source: "original approved reference RGB plus original footprints/tree/rock/vegetation masks and object instance facts",
        completionRule: "For every record and class, record visible, occluded and not-visually-identifiable regions without deriving labels from failed model previews or machine-review outcomes.",
      },
      {
        id: "condition_to_appearance_identifiability_pairs",
        source: "independently approved references with equivalent business-condition signatures",
        completionRule: "Provide independent evidence that equivalent WorldFacts and condition semantics yield a stable auditable appearance class, or explicitly mark the appearance as underdetermined and add the missing approved conditioning fact.",
      },
      {
        id: "frozen_autoencoder_semantic_retention_qualification",
        source: "original approved reference RGB and object masks only",
        completionRule: "Separately qualify which frozen Autoencoder spatial stages retain each audit-required object structure; unqualified feature stages cannot serve as semantic supervision authority.",
      },
      {
        id: "representative_fixed_validation_panel",
        source: "the versioned approved validation split and its business-scenario coverage matrix",
        completionRule: "Replace sole reliance on sample 194 with a fixed panel covering every validation business-scenario signature while retaining sample 194 as the rare water-scenario member.",
      },
      {
        id: "phased_resolution_validation_matrix",
        source: "the existing 256x192, 512x384 and 1024x768 formal Stage contract",
        completionRule: "Define evidence required at each existing resolution without changing model hyperparameters or audit thresholds; native 1024x768 remains the formal complete-map qualification target.",
      },
    ],
    ownerMaterialActions: [
      "Approve the business-scenario signature fields that must be balanced across train and validation.",
      "Provide or approve new original complete-map references for every uncovered validation-to-train scenario cell; the required quantity is determined by closing the matrix, not by a freely chosen sample count.",
      "Approve per-object visible/occluded/not-identifiable annotations derived only from original references, masks and WorldFacts.",
      "Approve the fixed multi-sample validation panel and confirm sample 194 is a rare water case rather than the sole generalization proxy.",
      "Authorize a separate read-only Autoencoder semantic-retention qualification only after its exact evidence and execution scope are compiled.",
    ],
    acceptanceGates: {
      everyValidationScenarioCoveredByTrain: true,
      objectVisibilityManifestComplete: true,
      underdeterminedAppearanceFactsExplicit: true,
      fixedValidationPanelCoversAllValidationScenarios: true,
      frozenAutoencoderSemanticStagesQualified: true,
      splitLeakage: false,
      failedPreviewOrReviewTargetUse: false,
    },
    forbiddenActions: [
      "invent_model_architecture",
      "add_same_kind_loss",
      "select_free_hyperparameters",
      "rerun_current_stage0",
      "reuse_failed_checkpoint",
      "use_failed_preview_pixels_as_targets",
      "use_machine_review_thresholds_or_results_as_targets",
      "lower_review_thresholds",
    ],
    activationGate: {
      dataMutation: false,
      checkpointRead: false,
      gpu: false,
      optimizer: false,
      backward: false,
      training: false,
      smoke: false,
      stage0: false,
      stage1: false,
      stage2: false,
    },
  }
}
