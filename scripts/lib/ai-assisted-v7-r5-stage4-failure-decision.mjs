const DECISION_CODES = new Set([
  "new_actionable_difference",
  "evidence_repeats_existing_failure",
])

const ARCHITECTURE_DIRECTION_IDS = [
  "condition_to_decoded_visual_domain_consistency",
  "object_semantic_projection_and_decoder_alignment",
  "multiscale_route_boundary_topology_supervision",
]

const ARCHITECTURE_COMPARISON_FIELDS = [
  "modificationScope",
  "dependencies",
  "modelStructureImpact",
  "legalSupervisionSources",
  "compatibility",
  "resourceRisk",
  "rollbackPoint",
  "cpuAcceptanceRoute",
  "gpuAcceptanceRoute",
]

const ARCHITECTURE_PROBLEM_DOMAINS = [
  "decoded_visual_route_boundary_consistency",
  "decoded_visual_object_semantic_consistency",
]

const LEGAL_ARCHITECTURE_SUPERVISION_SOURCES = new Set([
  "original_owner_approved_reference_rgb",
  "original_compiled_23_channel_condition_pack",
  "approved_world_facts_region_graph_and_edge_ports",
  "project_generated_game_coordinate_route_geometry",
  "original_object_identity_and_semantic_masks",
  "current_training_prediction_and_frozen_project_autoencoder_decode",
])

export function classifyStage4FailureDecision({ currentAnalysis, baselineAnalysis }) {
  validateAnalysis(currentAnalysis, "current")
  validateAnalysis(baselineAnalysis, "baseline")

  const currentIssueCodes = uniqueSorted(currentAnalysis.issueClusters.map((row) => row.issueCode))
  const baselineIssueCodes = uniqueSorted(baselineAnalysis.issueClusters.map((row) => row.issueCode))
  const currentRootCauseIds = uniqueSorted(currentAnalysis.rootCauseCandidates.map((row) => row.id))
  const baselineRootCauseIds = uniqueSorted(baselineAnalysis.rootCauseCandidates.map((row) => row.id))
  const newIssueCodes = currentIssueCodes.filter((value) => !baselineIssueCodes.includes(value))
  const newRootCauseIds = currentRootCauseIds.filter((value) => !baselineRootCauseIds.includes(value))
  const decisionCode = newIssueCodes.length || newRootCauseIds.length
    ? "new_actionable_difference"
    : "evidence_repeats_existing_failure"

  const actionProposal = decisionCode === "new_actionable_difference"
    ? {
        schemaVersion: "stage4-bounded-inactive-candidate-proposal-v1",
        status: "bounded_candidate_not_selected_not_applied",
        decisionCode,
        newIssueCodes,
        newRootCauseIds,
        sourceRepairContract: currentAnalysis.repairContract,
        activationGate: closedGate(),
      }
    : {
        schemaVersion: "stage4-architecture-decision-upgrade-proposal-v1",
        status: "owner_architecture_review_required_not_activated",
        decisionCode,
        parameterRepairContinuationRecommended: false,
        requiredNextDecision: "owner_architecture_review_before_any_new_candidate_or_training",
        reasonZh: "当前失败未产生超出上一轮成功分析的新问题码或新根因；继续调整同类参数没有新的证据基础。",
        architectureReviewTopics: [
          "condition_to_decoded_visual_domain_consistency",
          "object_semantic_projection_and_decoder_alignment",
          "multiscale_route_boundary_topology_supervision",
        ],
        activationGate: closedGate(),
      }

  const decision = {
    schemaVersion: "local-ai-v7-r5-stage4-binary-failure-decision-v1",
    status: "owner_review_required_not_activated",
    decisionCode,
    comparison: {
      currentIssueCodes,
      baselineIssueCodes,
      newIssueCodes,
      currentRootCauseIds,
      baselineRootCauseIds,
      newRootCauseIds,
    },
    actionProposal,
    analysisAlgorithmModified: false,
    reviewThresholdsModified: false,
    executionValuesSelected: false,
    proposalActivated: false,
  }
  validateStage4FailureDecision(decision)
  return decision
}

export function validateStage4FailureDecision(decision) {
  assert(decision?.schemaVersion === "local-ai-v7-r5-stage4-binary-failure-decision-v1", "stage4_decision_schema_invalid")
  assert(DECISION_CODES.has(decision.decisionCode), "stage4_decision_code_invalid")
  assert(decision.status === "owner_review_required_not_activated", "stage4_decision_status_invalid")
  assert(decision.analysisAlgorithmModified === false, "stage4_decision_analyzer_mutation_open")
  assert(decision.reviewThresholdsModified === false, "stage4_decision_threshold_mutation_open")
  assert(decision.executionValuesSelected === false, "stage4_decision_execution_values_selected")
  assert(decision.proposalActivated === false, "stage4_decision_proposal_activated")
  const gate = decision.actionProposal?.activationGate
  assert(gate?.selectedExecutionValues === false, "stage4_decision_gate_execution_values_selected")
  assert(gate?.applyConfigurationNow === false, "stage4_decision_gate_configuration_open")
  assert(gate?.readCheckpointNow === false, "stage4_decision_gate_checkpoint_open")
  assert(gate?.startGpuNow === false, "stage4_decision_gate_gpu_open")
  assert(gate?.startTrainingNow === false, "stage4_decision_gate_training_open")
  if (decision.decisionCode === "new_actionable_difference") {
    assert(decision.actionProposal.schemaVersion === "stage4-bounded-inactive-candidate-proposal-v1", "stage4_decision_candidate_schema_invalid")
    assert(decision.comparison.newIssueCodes.length + decision.comparison.newRootCauseIds.length > 0, "stage4_decision_new_difference_missing")
  } else {
    assert(decision.actionProposal.schemaVersion === "stage4-architecture-decision-upgrade-proposal-v1", "stage4_decision_architecture_schema_invalid")
    assert(decision.actionProposal.parameterRepairContinuationRecommended === false, "stage4_decision_parameter_repair_not_stopped")
    assert(decision.comparison.newIssueCodes.length === 0 && decision.comparison.newRootCauseIds.length === 0, "stage4_decision_repeat_contains_new_difference")
  }
}

export function runStage4DecisionContractRegression({ realEvidenceDecision, baselineAnalysis }) {
  validateStage4FailureDecision(realEvidenceDecision)
  validateAnalysis(baselineAnalysis, "baseline")

  const repeatFixtureDecision = classifyStage4FailureDecision({
    currentAnalysis: baselineAnalysis,
    baselineAnalysis,
  })
  const newDifferenceFixtureAnalysis = structuredClone(baselineAnalysis)
  newDifferenceFixtureAnalysis.issueClusters.push({ issueCode: "synthetic_new_stage4_issue" })
  const newDifferenceFixtureDecision = classifyStage4FailureDecision({
    currentAnalysis: newDifferenceFixtureAnalysis,
    baselineAnalysis,
  })

  const positive = {
    realEvidenceDecisionAllowedAndInactive: isAllowedInactiveDecision(realEvidenceDecision),
    repeatFixtureEscalatesArchitecture: repeatFixtureDecision.decisionCode === "evidence_repeats_existing_failure"
      && repeatFixtureDecision.actionProposal.parameterRepairContinuationRecommended === false
      && isClosedDecision(repeatFixtureDecision),
    newDifferenceFixtureCreatesInactiveCandidate: newDifferenceFixtureDecision.decisionCode === "new_actionable_difference"
      && newDifferenceFixtureDecision.actionProposal.schemaVersion === "stage4-bounded-inactive-candidate-proposal-v1"
      && isClosedDecision(newDifferenceFixtureDecision),
    fixturesCoverExactlyTwoDecisionCodes: new Set([
      repeatFixtureDecision.decisionCode,
      newDifferenceFixtureDecision.decisionCode,
    ]).size === 2,
    realEvidenceNotUsedAsRepeatFixture: realEvidenceDecision !== repeatFixtureDecision
      && repeatFixtureDecision.comparison.newIssueCodes.length === 0
      && repeatFixtureDecision.comparison.newRootCauseIds.length === 0,
  }
  const negative = {
    activatedDecisionProposalRejected: expectDecisionRejected(
      realEvidenceDecision,
      (value) => { value.actionProposal.activationGate.applyConfigurationNow = true },
      "stage4_decision_gate_configuration_open",
    ),
    selectedExecutionValueRejected: expectDecisionRejected(
      realEvidenceDecision,
      (value) => { value.executionValuesSelected = true },
      "stage4_decision_execution_values_selected",
    ),
    invalidDecisionCodeRejected: expectDecisionRejected(
      realEvidenceDecision,
      (value) => { value.decisionCode = "invalid" },
      "stage4_decision_code_invalid",
    ),
    repeatFixtureWithNewIssueRejected: expectDecisionRejected(
      repeatFixtureDecision,
      (value) => { value.comparison.newIssueCodes.push("uncontracted_issue") },
      "stage4_decision_repeat_contains_new_difference",
    ),
    malformedAnalysisRejected: expectClassificationRejected(
      () => classifyStage4FailureDecision({ currentAnalysis: {}, baselineAnalysis }),
      "stage4_decision_current_issues_invalid",
    ),
  }
  const failedPositiveKeys = failedKeys(positive)
  const failedNegativeKeys = failedKeys(negative)
  return {
    schemaVersion: "stage4-shared-binary-decision-contract-regression-v1",
    realEvidenceDecisionCode: realEvidenceDecision.decisionCode,
    fixtureDecisionCodes: {
      repeat: repeatFixtureDecision.decisionCode,
      newDifference: newDifferenceFixtureDecision.decisionCode,
    },
    positive,
    negative,
    failedPositiveKeys,
    failedNegativeKeys,
  }
}

export function compileStage4ArchitectureDesignConvergence({
  architectureDecisionTerminal,
  architectureUpgradeProposal,
  sourceBindings,
}) {
  validateArchitectureDesignSources(architectureDecisionTerminal, architectureUpgradeProposal, sourceBindings)

  const directions = [
    {
      id: "condition_to_decoded_visual_domain_consistency",
      modificationScope: [
        "add_typed_condition_projection_adapters_to_the_denoiser_decoder_path_at_existing_up1_and_up0_scales",
        "add_one_shared_decoder_aligned_semantic_topology_readout_from_existing_decoder_features",
        "bind_the_shared_readout_to_decoded_rgb_consistency_without_changing_the_23_channel_input_or_latent_output_shapes",
      ],
      dependencies: [
        "frozen_project_autoencoder_decode_remains_the_only_rgb_projection_path",
        "object_semantic_projection_contract_and_route_topology_contract_become_acceptance_facets_of_one_shared_bridge",
        "stage4_formal_stage0_must_restart_from_project_random_initialization_under_a_future_independent_authorization",
      ],
      modelStructureImpact: {
        level: "bounded_new_denoiser_architecture_version",
        proposedArchitectureId: "multiscale_condition_unet_v8_stage4_decoded_alignment",
        changesCheckpointSchema: true,
        changesConditionInputShape: false,
        changesLatentOutputShape: false,
        autoencoderWeightsChanged: false,
      },
      legalSupervisionSources: [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "approved_world_facts_region_graph_and_edge_ports",
        "project_generated_game_coordinate_route_geometry",
        "original_object_identity_and_semantic_masks",
        "current_training_prediction_and_frozen_project_autoencoder_decode",
      ],
      compatibility: {
        legacyStage3AndStage4ModesRemainAvailable: true,
        existingDenoiserCheckpointLoadIntoProposedArchitecture: false,
        compatibilityReason: "the_proposed_decoder_adapters_and_shared_readout_add_new_parameters",
        formalStage4Compatibility: "stage0_already_requires_project_random_initialization_and_stage1_2_only_inherit_the_current_run_parent",
      },
      resourceRisk: {
        level: "medium",
        drivers: [
          "two_decoder_scale_condition_adapters",
          "one_shared_semantic_topology_readout",
          "decoded_domain_gradient_path_through_the_frozen_autoencoder_decoder",
        ],
        boundedBy: [
          "no_second_generator_or_parallel_backend",
          "no_autoencoder_parameter_training",
          "no_change_to_formal_stage_resolutions_or_dataset_split",
        ],
      },
      rollbackPoint: {
        codeBoundary: "remove_only_the_v8_architecture_branch_and_its_trainer_support_before_any_checkpoint_promotion",
        evidenceBoundary: "preserve_all_v7_and_failed_stage4_evidence_unchanged",
        checkpointBoundary: "proposed_v8_checkpoints_never_load_into_v7_and_are_not_formally_promoted_by_implementation",
      },
      cpuAcceptanceRoute: [
        "shape_contract_for_23_condition_channels_and_unchanged_latent_output",
        "typed_condition_adapter_scale_and_channel_order_regression",
        "shared_readout_route_and_object_gradient_isolation_regression",
        "forbidden_training_target_and_legacy_checkpoint_rejection_regression",
        "legacy_stage3_and_stage4_compatibility_regression",
      ],
      gpuAcceptanceRoute: [
        "separately_authorized_single_sample_forward_and_gradient_routing_diagnostic",
        "separately_authorized_fixed_single_sample_30_epoch_architecture_smoke_with_existing_review_thresholds",
        "only_after_smoke_qualification_restart_stage4_formal_stage0_from_project_random_initialization",
      ],
      problemDomainCoverage: [...ARCHITECTURE_PROBLEM_DOMAINS],
      eligibleAsSingleRecommendation: true,
      rejectionReason: null,
    },
    {
      id: "object_semantic_projection_and_decoder_alignment",
      modificationScope: [
        "add_object_specific_decoder_aligned_projection_heads_for_footprints_tree_rock_and_vegetation",
        "align_object_logits_with_original_object_identity_and_semantic_masks",
      ],
      dependencies: [
        "decoded_visual_feature_access_from_the_project_autoencoder_path",
        "object_identity_and_semantic_mask_provenance",
      ],
      modelStructureImpact: {
        level: "object_specific_new_projection_parameters",
        proposedArchitectureId: "object_semantic_decoder_projection_only",
        changesCheckpointSchema: true,
        changesConditionInputShape: false,
        changesLatentOutputShape: false,
        autoencoderWeightsChanged: false,
      },
      legalSupervisionSources: [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "original_object_identity_and_semantic_masks",
        "current_training_prediction_and_frozen_project_autoencoder_decode",
      ],
      compatibility: {
        legacyStage3AndStage4ModesRemainAvailable: true,
        existingDenoiserCheckpointLoadIntoProposedArchitecture: false,
        compatibilityReason: "new_object_projection_parameters_change_the_denoiser_checkpoint_schema",
        formalStage4Compatibility: "requires_a_new_randomly_initialized_stage0_run",
      },
      resourceRisk: {
        level: "low_to_medium",
        drivers: ["four_object_projection_outputs", "decoded_domain_object_gradient_path"],
        boundedBy: ["no_route_head", "no_autoencoder_parameter_training"],
      },
      rollbackPoint: {
        codeBoundary: "remove_the_object_projection_architecture_branch",
        evidenceBoundary: "preserve_existing_object_diagnostics_and_reviews",
        checkpointBoundary: "do_not_promote_object_projection_checkpoints",
      },
      cpuAcceptanceRoute: [
        "four_object_channel_projection_shape_regression",
        "object_identity_mask_provenance_and_gradient_isolation_regression",
        "legacy_mode_compatibility_regression",
      ],
      gpuAcceptanceRoute: [
        "separately_authorized_object_projection_gradient_diagnostic",
        "separately_authorized_single_sample_object_semantic_smoke",
      ],
      problemDomainCoverage: ["decoded_visual_object_semantic_consistency"],
      eligibleAsSingleRecommendation: false,
      rejectionReason: "does_not_cover_the_repeated_route_boundary_failure_domain",
    },
    {
      id: "multiscale_route_boundary_topology_supervision",
      modificationScope: [
        "add_route_interior_and_required_boundary_topology_readouts_at_existing_decoder_scales",
        "validate_each_scale_against_current_sample_world_facts_route_geometry_and_condition_mask_consistency",
      ],
      dependencies: [
        "approved_region_graph_edge_ports_and_project_route_geometry",
        "typed_nearest_resize_for_discrete_route_masks",
      ],
      modelStructureImpact: {
        level: "route_specific_multiscale_readout_parameters",
        proposedArchitectureId: "multiscale_route_topology_supervision_only",
        changesCheckpointSchema: true,
        changesConditionInputShape: false,
        changesLatentOutputShape: false,
        autoencoderWeightsChanged: false,
      },
      legalSupervisionSources: [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "approved_world_facts_region_graph_and_edge_ports",
        "project_generated_game_coordinate_route_geometry",
        "current_training_prediction_and_frozen_project_autoencoder_decode",
      ],
      compatibility: {
        legacyStage3AndStage4ModesRemainAvailable: true,
        existingDenoiserCheckpointLoadIntoProposedArchitecture: false,
        compatibilityReason: "new_multiscale_route_readouts_change_the_denoiser_checkpoint_schema",
        formalStage4Compatibility: "requires_a_new_randomly_initialized_stage0_run",
      },
      resourceRisk: {
        level: "medium",
        drivers: ["route_readouts_at_multiple_decoder_scales", "resolution_specific_topology_validation"],
        boundedBy: ["current_sample_topology_only", "no_autoencoder_parameter_training"],
      },
      rollbackPoint: {
        codeBoundary: "remove_the_route_topology_architecture_branch",
        evidenceBoundary: "preserve_current_sample_topology_provenance",
        checkpointBoundary: "do_not_promote_route_topology_checkpoints",
      },
      cpuAcceptanceRoute: [
        "multiscale_route_mask_and_boundary_contact_shape_regression",
        "current_sample_topology_source_and_cross_sample_rejection_regression",
        "legacy_mode_compatibility_regression",
      ],
      gpuAcceptanceRoute: [
        "separately_authorized_multiscale_route_gradient_diagnostic",
        "separately_authorized_single_sample_route_topology_smoke",
      ],
      problemDomainCoverage: ["decoded_visual_route_boundary_consistency"],
      eligibleAsSingleRecommendation: false,
      rejectionReason: "does_not_cover_the_repeated_object_semantic_failure_domain",
    },
  ]

  const eligible = directions.filter((direction) =>
    direction.eligibleAsSingleRecommendation
    && ARCHITECTURE_PROBLEM_DOMAINS.every((domain) => direction.problemDomainCoverage.includes(domain)),
  )
  assert(eligible.length === 1, "stage4_architecture_design_single_recommendation_not_converged")
  const selected = eligible[0]
  const report = {
    schemaVersion: "local-ai-v7-r5-stage4-architecture-design-convergence-v1",
    status: "stage4_architecture_design_converged_single_bounded_contract_inactive",
    sourceDecision: {
      terminalStatus: architectureDecisionTerminal.status,
      terminalSha256: sourceBindings.architectureDecisionTerminal.sha256,
      decisionCode: architectureDecisionTerminal.decisionCode,
      proposalStatus: architectureUpgradeProposal.status,
      proposalSha256: sourceBindings.architectureUpgradeProposal.sha256,
      parameterRepairContinuationRecommended: architectureUpgradeProposal.parameterRepairContinuationRecommended,
    },
    selectionRule: {
      requiredProblemDomains: [...ARCHITECTURE_PROBLEM_DOMAINS],
      requiredCoverage: "all_required_problem_domains_by_one_bounded_direction",
      legalSupervisionOnly: true,
      legacyCompatibilityRequired: true,
      hyperparameterSelectionForbidden: true,
    },
    directions,
    outcome: {
      decision: "recommend_bounded_architecture_implementation",
      recommendedDirectionId: selected.id,
      recommendedContractId: "stage4_decoded_domain_alignment_bridge_v1",
      exitCurrentCandidateRoute: false,
      rationale: [
        "the_repeated_evidence_contains_both_route_boundary_and_object_semantic_visual_domain_failures",
        "the_object_only_and_route_only_directions_each_leave_one_repeated_failure_domain_uncovered",
        "the_shared_decoded_domain_bridge_is_the_only_bounded_direction_that_covers_both_without_using_failure_previews_or_review_thresholds_as_training_targets",
      ],
    },
    trainingTargetPolicy: {
      allowedSources: [...LEGAL_ARCHITECTURE_SUPERVISION_SOURCES],
      failedPreviewPixelsUsedAsTrainingTargets: false,
      machineReviewThresholdsUsedAsTrainingTargets: false,
    },
    hyperparameterCandidateGenerated: false,
    trainingConfigurationModified: false,
    checkpointRead: false,
    gpuUsed: false,
    trainingStarted: false,
  }
  validateStage4ArchitectureDesignConvergence(report)
  return report
}

export function buildStage4InactiveArchitectureImplementationContract(report) {
  validateStage4ArchitectureDesignConvergence(report)
  const selected = report.directions.find((direction) => direction.id === report.outcome.recommendedDirectionId)
  const contract = {
    schemaVersion: "stage4-bounded-inactive-architecture-implementation-contract-v1",
    status: "recommended_bounded_architecture_implementation_not_activated",
    contractId: report.outcome.recommendedContractId,
    selectedDirectionId: selected.id,
    proposedArchitectureId: selected.modelStructureImpact.proposedArchitectureId,
    problemDomainCoverage: [...selected.problemDomainCoverage],
    structuralChanges: [
      {
        id: "typed_condition_decoder_adapters",
        boundary: "inject_existing_typed_condition_features_only_at_existing_up1_and_up0_decoder_scales",
        createsNewParameters: true,
      },
      {
        id: "shared_decoder_aligned_semantic_topology_readout",
        boundary: "one_shared_readout_exposes_route_and_object_semantic_outputs_without_changing_the_latent_output_shape",
        createsNewParameters: true,
      },
      {
        id: "frozen_autoencoder_decoded_consistency_path",
        boundary: "gradients_may_flow_to_the_denoiser_input_of_the_decoder_but_autoencoder_parameters_remain_frozen",
        createsNewParameters: false,
      },
    ],
    futureImplementationTargets: [
      "ml/ai-painter/src/ai_painter/complete_world/model.py",
      "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
      "existing_stage4_inactive_config_compiler",
      "existing_stage4_cpu_contract_checker",
    ],
    supervisionContract: {
      allowedSources: [...report.trainingTargetPolicy.allowedSources],
      failedPreviewPixelsUsedAsTrainingTargets: false,
      machineReviewThresholdsUsedAsTrainingTargets: false,
      currentSampleRouteTopologyMustComeFromWorldFactsAndProjectGeometry: true,
      conditionMaskRoleForBoundaryTopology: "consistency_validation_and_supervision_projection_only_not_world_fact_authority",
    },
    compatibilityContract: {
      preserveLegacyStage3AndStage4Modes: true,
      preserve23ChannelOrderAndTypes: true,
      preserveLatentOutputShape: true,
      loadExistingDenoiserCheckpointIntoProposedArchitecture: false,
      stage0InitializationIfLaterAuthorized: "project_random_initialization_only",
      stage1AndStage2InitializationIfLaterAuthorized: "current_run_immediate_parent_checkpoint_only",
      autoencoderCheckpointIdentityMayOnlyBeReadUnderSeparateFutureAuthorization: true,
    },
    cpuAcceptanceRoute: [...selected.cpuAcceptanceRoute],
    gpuAcceptanceRoute: [...selected.gpuAcceptanceRoute],
    rollbackContract: selected.rollbackPoint,
    resourceRisk: selected.resourceRisk,
    hyperparameterSelections: [],
    activationGate: architectureDesignClosedGate(),
  }
  validateStage4InactiveArchitectureImplementationContract(contract)
  return contract
}

export function buildStage4ArchitectureOwnerActionRequestPreview(report, contract) {
  validateStage4ArchitectureDesignConvergence(report)
  validateStage4InactiveArchitectureImplementationContract(contract)
  const request = {
    schemaVersion: "stage4-architecture-implementation-owner-action-request-preview-v1",
    status: "preview_not_approved_not_consumed_not_executed",
    requestedAction: "owner_may_authorize_bounded_stage4_decoded_domain_alignment_bridge_implementation",
    boundDesignContractId: contract.contractId,
    selectedDirectionId: contract.selectedDirectionId,
    requiresNewImmutableOwnerAuthorization: true,
    requestedFutureScope: [
      "implement_the_new_bounded_model_architecture_branch",
      "implement_trainer_support_and_cpu_contract_checks",
      "compile_an_inactive_configuration_without_hyperparameter_selection",
    ],
    explicitlyNotRequested: [
      "checkpoint_read_or_load",
      "optimizer_creation",
      "backward_execution",
      "gpu_use",
      "training",
      "validation",
      "formal_inference",
      "checkpoint_promotion",
      "runtime_frame",
      "world_entry",
    ],
    automaticallyApproved: false,
    authorizationConsumed: false,
    executionStarted: false,
  }
  validateStage4ArchitectureOwnerActionRequestPreview(request)
  return request
}

export function validateStage4ArchitectureDesignConvergence(report) {
  assert(report?.schemaVersion === "local-ai-v7-r5-stage4-architecture-design-convergence-v1", "stage4_architecture_design_schema_invalid")
  assert(report.status === "stage4_architecture_design_converged_single_bounded_contract_inactive", "stage4_architecture_design_status_invalid")
  assert(report.sourceDecision?.terminalStatus === "r5_stage4_architecture_upgrade_decision_completed_closed", "stage4_architecture_design_terminal_status_invalid")
  assert(report.sourceDecision?.decisionCode === "evidence_repeats_existing_failure", "stage4_architecture_design_source_decision_invalid")
  assert(report.sourceDecision?.proposalStatus === "owner_architecture_review_required_not_activated", "stage4_architecture_design_proposal_status_invalid")
  assert(report.sourceDecision?.parameterRepairContinuationRecommended === false, "stage4_architecture_design_parameter_repair_not_stopped")
  assert(Array.isArray(report.directions) && report.directions.length === 3, "stage4_architecture_design_direction_count_invalid")
  assert(sameSequence(report.directions.map((value) => value.id), ARCHITECTURE_DIRECTION_IDS), "stage4_architecture_design_direction_identity_invalid")
  for (const direction of report.directions) {
    for (const field of ARCHITECTURE_COMPARISON_FIELDS) {
      assert(direction[field] && (typeof direction[field] === "object"), `stage4_architecture_design_${field}_missing`)
    }
    assert(Array.isArray(direction.problemDomainCoverage), "stage4_architecture_design_problem_coverage_invalid")
    assert(direction.legalSupervisionSources.every((source) => LEGAL_ARCHITECTURE_SUPERVISION_SOURCES.has(source)), "stage4_architecture_design_illegal_supervision_source")
    assert(!direction.legalSupervisionSources.some((source) => /failed_preview|machine_review_threshold/i.test(source)), "stage4_architecture_design_forbidden_training_target")
    assert(direction.modelStructureImpact.autoencoderWeightsChanged === false, "stage4_architecture_design_autoencoder_weight_mutation_open")
  }
  const eligible = report.directions.filter((direction) => direction.eligibleAsSingleRecommendation)
  assert(eligible.length === 1, "stage4_architecture_design_recommendation_count_invalid")
  assert(report.outcome?.decision === "recommend_bounded_architecture_implementation", "stage4_architecture_design_outcome_invalid")
  assert(report.outcome?.recommendedDirectionId === eligible[0].id, "stage4_architecture_design_recommended_direction_invalid")
  assert(report.outcome?.recommendedContractId === "stage4_decoded_domain_alignment_bridge_v1", "stage4_architecture_design_contract_identity_invalid")
  assert(report.outcome?.exitCurrentCandidateRoute === false, "stage4_architecture_design_exit_conflicts_with_recommendation")
  assert(ARCHITECTURE_PROBLEM_DOMAINS.every((domain) => eligible[0].problemDomainCoverage.includes(domain)), "stage4_architecture_design_recommendation_coverage_incomplete")
  assert(report.trainingTargetPolicy?.failedPreviewPixelsUsedAsTrainingTargets === false, "stage4_architecture_design_failed_preview_target_open")
  assert(report.trainingTargetPolicy?.machineReviewThresholdsUsedAsTrainingTargets === false, "stage4_architecture_design_review_threshold_target_open")
  assert(report.hyperparameterCandidateGenerated === false, "stage4_architecture_design_hyperparameter_candidate_open")
  assert(report.trainingConfigurationModified === false, "stage4_architecture_design_training_config_mutated")
  assert(report.checkpointRead === false && report.gpuUsed === false && report.trainingStarted === false, "stage4_architecture_design_execution_boundary_open")
}

export function validateStage4InactiveArchitectureImplementationContract(contract) {
  assert(contract?.schemaVersion === "stage4-bounded-inactive-architecture-implementation-contract-v1", "stage4_architecture_contract_schema_invalid")
  assert(contract.status === "recommended_bounded_architecture_implementation_not_activated", "stage4_architecture_contract_status_invalid")
  assert(contract.contractId === "stage4_decoded_domain_alignment_bridge_v1", "stage4_architecture_contract_id_invalid")
  assert(contract.selectedDirectionId === "condition_to_decoded_visual_domain_consistency", "stage4_architecture_contract_direction_invalid")
  assert(sameSequence(contract.problemDomainCoverage, ARCHITECTURE_PROBLEM_DOMAINS), "stage4_architecture_contract_coverage_invalid")
  assert(Array.isArray(contract.structuralChanges) && contract.structuralChanges.length === 3, "stage4_architecture_contract_structure_invalid")
  assert(contract.supervisionContract?.failedPreviewPixelsUsedAsTrainingTargets === false, "stage4_architecture_contract_failed_preview_target_open")
  assert(contract.supervisionContract?.machineReviewThresholdsUsedAsTrainingTargets === false, "stage4_architecture_contract_review_threshold_target_open")
  assert(contract.supervisionContract?.allowedSources.every((source) => LEGAL_ARCHITECTURE_SUPERVISION_SOURCES.has(source)), "stage4_architecture_contract_supervision_source_invalid")
  assert(Array.isArray(contract.hyperparameterSelections) && contract.hyperparameterSelections.length === 0, "stage4_architecture_contract_hyperparameter_selection_open")
  assert(contract.compatibilityContract?.loadExistingDenoiserCheckpointIntoProposedArchitecture === false, "stage4_architecture_contract_legacy_checkpoint_load_open")
  const gate = contract.activationGate
  const expectedGateKeys = Object.keys(architectureDesignClosedGate()).sort()
  assert(gate && typeof gate === "object" && !Array.isArray(gate), "stage4_architecture_contract_gate_invalid")
  assert(sameSequence(Object.keys(gate).sort(), expectedGateKeys), "stage4_architecture_contract_gate_keys_invalid")
  for (const key of expectedGateKeys) assert(gate[key] === false, `stage4_architecture_contract_gate_${key}_open`)
}

export function validateStage4ArchitectureOwnerActionRequestPreview(request) {
  assert(request?.schemaVersion === "stage4-architecture-implementation-owner-action-request-preview-v1", "stage4_architecture_owner_request_schema_invalid")
  assert(request.status === "preview_not_approved_not_consumed_not_executed", "stage4_architecture_owner_request_status_invalid")
  assert(request.requiresNewImmutableOwnerAuthorization === true, "stage4_architecture_owner_request_new_authorization_missing")
  assert(request.automaticallyApproved === false, "stage4_architecture_owner_request_auto_approval_open")
  assert(request.authorizationConsumed === false, "stage4_architecture_owner_request_consumption_open")
  assert(request.executionStarted === false, "stage4_architecture_owner_request_execution_open")
}

export function runStage4ArchitectureDesignContractRegression({
  architectureDecisionTerminal,
  architectureUpgradeProposal,
  sourceBindings,
}) {
  const report = compileStage4ArchitectureDesignConvergence({ architectureDecisionTerminal, architectureUpgradeProposal, sourceBindings })
  const contract = buildStage4InactiveArchitectureImplementationContract(report)
  const ownerRequestPreview = buildStage4ArchitectureOwnerActionRequestPreview(report, contract)
  const positive = {
    threeArchitectureDirectionsCompared: report.directions.length === 3,
    everyRequiredComparisonFieldPresent: report.directions.every((direction) => ARCHITECTURE_COMPARISON_FIELDS.every((field) => direction[field])),
    exactlyOneBoundedRecommendation: report.directions.filter((direction) => direction.eligibleAsSingleRecommendation).length === 1,
    recommendationCoversBothRepeatedDomains: ARCHITECTURE_PROBLEM_DOMAINS.every((domain) => contract.problemDomainCoverage.includes(domain)),
    objectOnlyDirectionRejectedAsIncomplete: report.directions[1].eligibleAsSingleRecommendation === false,
    routeOnlyDirectionRejectedAsIncomplete: report.directions[2].eligibleAsSingleRecommendation === false,
    legalSupervisionSourcesOnly: contract.supervisionContract.allowedSources.every((source) => LEGAL_ARCHITECTURE_SUPERVISION_SOURCES.has(source)),
    noFailedPreviewTrainingTarget: contract.supervisionContract.failedPreviewPixelsUsedAsTrainingTargets === false,
    noReviewThresholdTrainingTarget: contract.supervisionContract.machineReviewThresholdsUsedAsTrainingTargets === false,
    noHyperparameterCandidate: report.hyperparameterCandidateGenerated === false && contract.hyperparameterSelections.length === 0,
    inactiveContractClosed: Object.values(contract.activationGate).every((value) => value === false),
    ownerRequestRemainsPreview: ownerRequestPreview.automaticallyApproved === false && ownerRequestPreview.authorizationConsumed === false,
    legacyStageCompatibilityPreserved: contract.compatibilityContract.preserveLegacyStage3AndStage4Modes === true,
    oldDenoiserCheckpointRejectedForNewArchitecture: contract.compatibilityContract.loadExistingDenoiserCheckpointIntoProposedArchitecture === false,
    checkpointGpuTrainingBoundariesClosed: report.checkpointRead === false && report.gpuUsed === false && report.trainingStarted === false,
  }
  const negative = {
    formalTrainingActivationRejected: expectArchitectureContractRejected(contract, (value) => { value.activationGate.trainingNow = true }, "stage4_architecture_contract_gate_trainingNow_open"),
    unknownTrainingActionFieldRejected: expectArchitectureContractRejected(contract, (value) => { value.activationGate.startTrainingNow = true }, "stage4_architecture_contract_gate_keys_invalid"),
    hyperparameterSelectionRejected: expectArchitectureContractRejected(contract, (value) => { value.hyperparameterSelections.push({ name: "lossWeight", value: 1 }) }, "stage4_architecture_contract_hyperparameter_selection_open"),
    failedPreviewTargetRejected: expectArchitectureContractRejected(contract, (value) => { value.supervisionContract.failedPreviewPixelsUsedAsTrainingTargets = true }, "stage4_architecture_contract_failed_preview_target_open"),
    reviewThresholdTargetRejected: expectArchitectureContractRejected(contract, (value) => { value.supervisionContract.machineReviewThresholdsUsedAsTrainingTargets = true }, "stage4_architecture_contract_review_threshold_target_open"),
    incompleteRecommendationRejected: expectArchitectureReportRejected(report, (value) => { value.directions[0].problemDomainCoverage.pop() }, "stage4_architecture_design_recommendation_coverage_incomplete"),
    secondRecommendationRejected: expectArchitectureReportRejected(report, (value) => { value.directions[1].eligibleAsSingleRecommendation = true }, "stage4_architecture_design_recommendation_count_invalid"),
    illegalSupervisionRejected: expectArchitectureReportRejected(report, (value) => { value.directions[0].legalSupervisionSources.push("failed_preview_pixels") }, "stage4_architecture_design_illegal_supervision_source"),
    checkpointReadRejected: expectArchitectureReportRejected(report, (value) => { value.checkpointRead = true }, "stage4_architecture_design_execution_boundary_open"),
    autoApprovedOwnerRequestRejected: expectOwnerRequestRejected(ownerRequestPreview, (value) => { value.automaticallyApproved = true }, "stage4_architecture_owner_request_auto_approval_open"),
    wrongSourceDecisionRejected: expectArchitectureCompilationRejected(
      () => compileStage4ArchitectureDesignConvergence({
        architectureDecisionTerminal: { ...architectureDecisionTerminal, decisionCode: "new_actionable_difference" },
        architectureUpgradeProposal,
        sourceBindings,
      }),
      "stage4_architecture_design_source_decision_invalid",
    ),
  }
  return {
    schemaVersion: "stage4-architecture-design-convergence-contract-regression-v1",
    positive,
    negative,
    failedPositiveKeys: failedKeys(positive),
    failedNegativeKeys: failedKeys(negative),
    report,
    contract,
    ownerRequestPreview,
  }
}

function validateArchitectureDesignSources(terminal, proposal, sourceBindings) {
  assert(terminal?.status === "r5_stage4_architecture_upgrade_decision_completed_closed", "stage4_architecture_design_terminal_status_invalid")
  assert(terminal?.decisionCode === "evidence_repeats_existing_failure", "stage4_architecture_design_source_decision_invalid")
  assert(proposal?.schemaVersion === "stage4-architecture-decision-upgrade-proposal-v1", "stage4_architecture_design_source_proposal_schema_invalid")
  assert(proposal?.status === "owner_architecture_review_required_not_activated", "stage4_architecture_design_proposal_status_invalid")
  assert(proposal?.parameterRepairContinuationRecommended === false, "stage4_architecture_design_parameter_repair_not_stopped")
  assert(sameSequence(proposal?.architectureReviewTopics, ARCHITECTURE_DIRECTION_IDS), "stage4_architecture_design_source_topics_invalid")
  assert(sourceBindings?.architectureDecisionTerminal?.sha256 === terminalSha(terminal, sourceBindings), "stage4_architecture_design_terminal_binding_invalid")
  assert(sourceBindings?.architectureUpgradeProposal?.sha256 === proposalSha(proposal, sourceBindings), "stage4_architecture_design_proposal_binding_invalid")
}

function terminalSha(_terminal, sourceBindings) {
  return sourceBindings?.architectureDecisionTerminal?.actualSha256
}

function proposalSha(_proposal, sourceBindings) {
  return sourceBindings?.architectureUpgradeProposal?.actualSha256
}

function architectureDesignClosedGate() {
  return {
    implementationAuthorizedNow: false,
    configurationCompilationAuthorizedNow: false,
    checkpointReadNow: false,
    optimizerCreationNow: false,
    backwardExecutionNow: false,
    gpuUseNow: false,
    trainingNow: false,
    validationNow: false,
    formalInferenceNow: false,
    checkpointPromotionNow: false,
    runtimeFrameNow: false,
    worldEntryNow: false,
  }
}

function expectArchitectureReportRejected(report, mutate, expected) {
  const copy = structuredClone(report)
  mutate(copy)
  try { validateStage4ArchitectureDesignConvergence(copy) } catch (error) { return String(error.message).includes(expected) }
  return false
}

function expectArchitectureContractRejected(contract, mutate, expected) {
  const copy = structuredClone(contract)
  mutate(copy)
  try { validateStage4InactiveArchitectureImplementationContract(copy) } catch (error) { return String(error.message).includes(expected) }
  return false
}

function expectOwnerRequestRejected(request, mutate, expected) {
  const copy = structuredClone(request)
  mutate(copy)
  try { validateStage4ArchitectureOwnerActionRequestPreview(copy) } catch (error) { return String(error.message).includes(expected) }
  return false
}

function expectArchitectureCompilationRejected(run, expected) {
  try { run() } catch (error) { return String(error.message).includes(expected) }
  return false
}

function sameSequence(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index])
}

function validateAnalysis(value, label) {
  assert(value && Array.isArray(value.issueClusters), `stage4_decision_${label}_issues_invalid`)
  assert(Array.isArray(value.rootCauseCandidates), `stage4_decision_${label}_roots_invalid`)
  assert(value.repairContract && typeof value.repairContract === "object", `stage4_decision_${label}_repair_contract_invalid`)
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))].sort()
}

function closedGate() {
  return {
    selectedExecutionValues: false,
    applyConfigurationNow: false,
    readCheckpointNow: false,
    startGpuNow: false,
    startTrainingNow: false,
  }
}

function isAllowedInactiveDecision(decision) {
  try { validateStage4FailureDecision(decision) } catch { return false }
  const outcomeContractValid = decision.decisionCode === "new_actionable_difference"
    ? decision.actionProposal.schemaVersion === "stage4-bounded-inactive-candidate-proposal-v1"
    : decision.decisionCode === "evidence_repeats_existing_failure"
      && decision.actionProposal.schemaVersion === "stage4-architecture-decision-upgrade-proposal-v1"
      && decision.actionProposal.parameterRepairContinuationRecommended === false
  return outcomeContractValid && isClosedDecision(decision)
}

function isClosedDecision(decision) {
  const gate = decision.actionProposal?.activationGate
  return decision.status === "owner_review_required_not_activated"
    && decision.executionValuesSelected === false
    && decision.proposalActivated === false
    && gate?.selectedExecutionValues === false
    && gate?.applyConfigurationNow === false
    && gate?.readCheckpointNow === false
    && gate?.startGpuNow === false
    && gate?.startTrainingNow === false
}

function expectDecisionRejected(decision, mutate, expected) {
  const copy = structuredClone(decision)
  mutate(copy)
  try { validateStage4FailureDecision(copy) } catch (error) { return String(error.message).includes(expected) }
  return false
}

function expectClassificationRejected(run, expected) {
  try { run() } catch (error) { return String(error.message).includes(expected) }
  return false
}

function failedKeys(assertions) {
  return Object.entries(assertions).filter(([, passed]) => !passed).map(([key]) => key)
}

function assert(condition, code) {
  if (!condition) throw new Error(code)
}
