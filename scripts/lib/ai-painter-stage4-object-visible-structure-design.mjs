import assert from "node:assert/strict"

export const OBJECT_CHANNELS = Object.freeze([
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
])
export const DESIGN_INVARIANTS = Object.freeze([
  "preserve_current_review_thresholds",
  "use_only_existing_approved_reference_rgb_conditions_worldfacts_and_object_masks",
  "do_not_use_failed_preview_pixels_as_targets",
  "do_not_load_failed_checkpoint_weights",
])
export const FAILED_SINGLE_SCALE_CONTRACT_ID = "stage4_four_typed_object_visible_structure_supervision_v1"
export const FAILED_SINGLE_SCALE_LOSS = "one_minus_masked_zero_mean_normalized_luminance_correlation"
export const PROJECT_EXISTING_MULTISCALE_PYRAMID = Object.freeze([1, 0.5, 0.25])
export const MULTISCALE_CANDIDATE_ID = "typed_object_multiscale_luminance_structure_correlation_supervision_v1"

const allTrue = (value) => value && Object.values(value).every((item) => item === true)
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

export function validateObjectVisibleStructureDesignSource({
  terminal,
  report,
  decision,
  recommendation,
  capsule,
  failedStage0ActiveConfig,
  failedPriorDesign,
}, expectedRunId) {
  assert.match(expectedRunId, /^\d{8}-\d{9}-stage0$/, "expected_run_id_invalid")
  assert.equal(terminal.schemaVersion, "ai-painter-stage4-semantic-mixture-real-failure-adjudication-terminal-v1")
  assert.equal(terminal.status, "stage0_real_model_visual_failure_adjudicated_closed")
  assert.equal(terminal.runId, expectedRunId)
  assert.deepEqual(terminal.fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 })
  assert.equal(terminal.classification, "real_model_visual_failure")
  assert.equal(terminal.nextLegalAction, "owner_review_bounded_object_visible_structure_supervision_or_candidate_exit")
  assert.equal(terminal.automaticRetryStarted, false)
  assert.equal(terminal.stage1Started, false)
  assert.equal(terminal.stage2Started, false)

  assert.equal(report.status, "real_model_visual_failure_confirmed")
  assert.equal(report.runId, expectedRunId)
  assert.equal(decision.status, "stage0_real_model_visual_failure_confirmed")
  assert.equal(decision.classification, "real_model_visual_failure")
  assert.equal(allTrue(decision.bindingChecks), true, "source_binding_checks_not_closed")
  assert.equal(allTrue(decision.auditContractChecks), true, "source_audit_contract_not_closed")
  assert.equal(allTrue(decision.modelFailureChecks), true, "source_model_failure_not_closed")
  assert.equal(decision.modelFailureChecks.terminal_water_passed, true)
  assert.equal(decision.modelFailureChecks.terminal_path_passed, true)
  assert.equal(decision.modelFailureChecks.terminal_four_object_semantics_failed, true)
  assert.equal(decision.automaticRetryAllowed, false)
  assert.equal(decision.stage1EntryPermitted, false)
  assert.equal(decision.stage2EntryPermitted, false)
  assert.equal(same(Object.keys(decision.terminalObjectMetrics), OBJECT_CHANNELS), true, "object_identity_or_order_changed")
  for (const channel of OBJECT_CHANNELS) {
    const metric = decision.terminalObjectMetrics[channel]
    assert.equal(metric.localResponsePassed, true, `${channel}_local_response_not_passed`)
    assert.ok(metric.maskedRgbMae <= metric.maximumMaskedRgbMae, `${channel}_rgb_contract_changed`)
    assert.ok(metric.maskedEdgeMae <= metric.maximumMaskedEdgeMae, `${channel}_edge_contract_changed`)
    assert.ok(metric.maskedLumaCorrelation < metric.minimumMaskedLumaCorrelation, `${channel}_luma_failure_missing`)
    assert.equal(metric.minimumMaskedLumaCorrelation, 0.08, `${channel}_review_threshold_changed`)
  }

  assert.equal(recommendation.status, "bounded_inactive_owner_decision_required")
  assert.equal(recommendation.recommendation, "design_one_bounded_object_visible_structure_supervision_contract_or_exit_current_candidate")
  assert.equal(same(recommendation.invariants, DESIGN_INVARIANTS), true, "design_invariants_changed")
  assert.equal(recommendation.freeHyperparametersSelected, false)
  assert.equal(recommendation.executionAuthorized, false)
  assert.equal(capsule.latestBlocker, "four_object_visible_structure_semantics_failed_at_epoch_40")
  assert.equal(capsule.nextLegalAction, terminal.nextLegalAction)
  assert.deepEqual(capsule.fixedTotalProgress, terminal.fixedTotalProgress)

  const failedSupervision = failedStage0ActiveConfig?.training?.stage4ObjectVisibleStructureSupervision
  assert.equal(failedSupervision?.enabled, true, "failed_single_scale_supervision_not_active")
  assert.equal(failedSupervision?.contractId, FAILED_SINGLE_SCALE_CONTRACT_ID, "failed_single_scale_contract_identity_changed")
  assert.equal(failedSupervision?.lossFunction, FAILED_SINGLE_SCALE_LOSS, "failed_single_scale_loss_identity_changed")
  assert.deepEqual(
    failedStage0ActiveConfig?.training?.textureHierarchyScales,
    PROJECT_EXISTING_MULTISCALE_PYRAMID,
    "project_existing_multiscale_pyramid_changed",
  )
  assert.equal(failedSupervision?.compatibility?.reviewThresholdsChanged, false)
  assert.equal(failedSupervision?.legalSupervision?.failedPreviewPixelsUsedAsTargets, false)
  assert.equal(failedSupervision?.legalSupervision?.failedCheckpointWeightsReadOrLoaded, false)
  assert.equal(failedPriorDesign?.schemaVersion, "stage4-object-visible-structure-supervision-design-v1")
  assert.equal(failedPriorDesign?.designDecision, "propose_one_reference_derived_typed_object_visible_structure_supervision_contract")
  assert.equal(
    failedPriorDesign?.derivedReferenceSignals?.includes("typed_mask_supported_reference_luminance_spatial_pattern"),
    true,
    "failed_prior_design_identity_changed",
  )
  assert.equal(
    failedPriorDesign?.derivedReferenceSignals?.some((item) => item.includes("multiscale")),
    false,
    "failed_prior_design_was_not_single_scale",
  )
  return {
    status: "bounded_object_visible_structure_design_source_valid",
    runId: expectedRunId,
    objectChannels: [...OBJECT_CHANNELS],
    terminalObjectMetrics: structuredClone(decision.terminalObjectMetrics),
    failedCandidate: {
      contractId: FAILED_SINGLE_SCALE_CONTRACT_ID,
      lossFunction: FAILED_SINGLE_SCALE_LOSS,
      designSchemaVersion: failedPriorDesign.schemaVersion,
    },
    projectExistingMultiscalePyramid: [...PROJECT_EXISTING_MULTISCALE_PYRAMID],
  }
}

export function buildBoundedObjectVisibleStructureDesign(source, expectedRunId) {
  const validated = validateObjectVisibleStructureDesignSource(source, expectedRunId)
  return {
    schemaVersion: "stage4-object-reference-multiscale-luminance-structure-correlation-supervision-design-v1",
    status: "bounded_novel_multiscale_design_converged_inactive",
    runId: expectedRunId,
    evidenceFinding: {
      classification: "four_object_reference_visible_structure_alignment_failure",
      waterAndPathRemainQualified: true,
      objectChannels: validated.objectChannels,
      terminalObjectMetrics: validated.terminalObjectMetrics,
      failedSingleScaleCandidate: validated.failedCandidate,
    },
    designDecision: "propose_one_reference_derived_typed_object_multiscale_luminance_structure_correlation_supervision_contract",
    candidateId: MULTISCALE_CANDIDATE_ID,
    noveltyBoundary: {
      rejectedCandidateContractId: validated.failedCandidate.contractId,
      rejectedCandidateLossFunction: validated.failedCandidate.lossFunction,
      rejectedCandidateDesignSchemaVersion: validated.failedCandidate.designSchemaVersion,
      failedSingleScaleContractReuseAllowed: false,
      distinctMechanism: "per_scale_masked_luminance_correlation_plus_cross_scale_structure_consistency",
      noveltyRequiredByCpuContract: true,
    },
    scope: {
      appliesOnlyTo: validated.objectChannels,
      preservesWaterAndPathBehavior: true,
      changesReviewContract: false,
      changesDatasetOrSplit: false,
      changesConditionPack: false,
      changesModelOrTrainerNow: false,
      selectsNumericalWeightsNow: false,
    },
    legalInputs: [
      "owner_approved_reference_rgb",
      "existing_compiled_condition_pack",
      "approved_world_facts",
      "original_typed_object_masks",
    ],
    derivedReferenceSignals: [
      "typed_mask_supported_reference_luminance_native_half_quarter_pyramid",
      "typed_mask_supported_reference_edge_structure_native_half_quarter_pyramid",
      "typed_mask_support_geometry_native_half_quarter_pyramid",
      "typed_mask_supported_per_scale_zero_mean_normalized_luminance_correlation",
      "typed_mask_supported_cross_scale_luminance_structure_consistency",
    ],
    multiscaleContract: {
      pyramidAuthority: "failed_stage0_active_config.training.textureHierarchyScales",
      inheritedPyramidScales: validated.projectExistingMultiscalePyramid,
      newScaleSelectionAllowed: false,
      perScaleCorrelationRequired: true,
      crossScaleStructureConsistencyRequired: true,
      aggregationWeightAuthority: "future_cpu_implementation_must_derive_from_existing_project_authority",
      freeAggregationWeightSelectionAllowed: false,
    },
    typedObjectObligations: validated.objectChannels.map((channel) => ({
      channel,
      targetAuthority: "matching_original_typed_object_mask_and_owner_approved_reference_rgb_only",
      visibleStructureObligation: "preserve matching masked reference luminance ordering and edge structure at the inherited native, half, and quarter scales while retaining the already-qualified RGB and edge bounds",
      inheritedPyramidScales: validated.projectExistingMultiscalePyramid,
      perScaleCorrelationRequired: true,
      crossScaleStructureConsistencyRequired: true,
      independentAccountingRequired: true,
      crossObjectTargetSubstitutionForbidden: true,
    })),
    implementationBoundary: {
      oneVersionedBranchOnly: true,
      requiredCpuContracts: [
        "typed_object_identity_and_order",
        "failed_single_scale_candidate_identity_and_activation",
        "failed_single_scale_candidate_reuse_rejection",
        "project_existing_multiscale_pyramid_exact_inheritance",
        "per_scale_mask_bounded_correlation_obligations",
        "cross_scale_structure_consistency_obligation",
        "reference_signal_derivation_is_mask_bounded",
        "failed_preview_target_rejection",
        "failed_checkpoint_weight_read_rejection",
        "review_threshold_immutability",
        "water_and_path_behavior_preservation",
        "no_free_numerical_weight_selection",
      ],
      implementationAuthorizedNow: false,
      trainingAuthorizedNow: false,
      gpuAuthorizedNow: false,
    },
    acceptanceBoundary: {
      existingMachineReviewThresholdsRemainAuthoritative: true,
      exactMinimumMaskedLumaCorrelation: 0.08,
      failedSingleScaleCandidateMayBeReused: false,
      multiscalePyramidMustEqualProjectExistingDefinition: true,
      failedPreviewPixelsMayBecomeTargets: false,
      failedCheckpointWeightsMayBeLoaded: false,
      futureCpuImplementationRequiresSeparateOwnerAuthorization: true,
      futureGpuOrTrainingRequiresSeparateOwnerAuthorization: true,
    },
    invariants: [...DESIGN_INVARIANTS],
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    nextLegalAction: "owner_review_multiscale_object_luminance_structure_design_and_choose_cpu_implementation_or_candidate_exit",
  }
}
