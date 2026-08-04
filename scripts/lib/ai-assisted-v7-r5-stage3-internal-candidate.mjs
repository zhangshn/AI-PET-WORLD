export const R5_STAGE3_INTERNAL_CANDIDATE_VERSION = "v7_r5_stage3_internal_path_coverage_boundary_candidate_v1"
export const R5_STAGE3_COVERAGE_CONVERGENCE_CANDIDATE_VERSION = "v7_r5_stage3_internal_path_coverage_convergence_candidate_v2"

export function compileR5Stage3CoverageConvergenceCandidate({ review, finalization, manifest, terminal, parentCandidate, selectionContract, sourceEvidence }) {
  assert(review?.status === "failed" && review.reviewCount === 4 && review.passCount === 1 && review.failCount === 3, "r5_stage3_convergence_review_contract_invalid")
  assert(finalization?.status === "r5_stage3_checkpoint_continuation_single_sample_overfit_smoke_failed_stopped", "r5_stage3_convergence_finalization_invalid")
  assert(manifest?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "r5_stage3_convergence_manifest_incomplete")
  assert(terminal?.status === finalization.status, "r5_stage3_convergence_terminal_mismatch")
  assert(manifest.checkpointSha256 === finalization.checkpointSha256 && terminal.checkpointSha256 === finalization.checkpointSha256, "r5_stage3_convergence_checkpoint_identity_mismatch")
  assert(parentCandidate?.proposal?.boundedRepairVersion === R5_STAGE3_INTERNAL_CANDIDATE_VERSION, "r5_stage3_convergence_parent_candidate_invalid")
  assert(selectionContract?.status === "r5_stage3_isolated_config_compiled_not_active_checkpoint_not_read_or_loaded_training_not_authorized", "r5_stage3_convergence_selection_contract_invalid")

  const rows = [...review.reviews].sort((left, right) => Number(left.epoch) - Number(right.epoch))
  const pathRows = rows.map(extractPathEvidence)
  const baseline = pathRows.find((row) => row.epoch === 1)
  const rejected = pathRows.filter((row) => [10, 20, 30].includes(row.epoch))
  assert(baseline?.issueCodes.length === 0 && baseline.coverageRatio <= baseline.maximumCoverageRatio, "r5_stage3_convergence_baseline_not_passed")
  assert(rejected.length === 3 && rejected.every((row) => row.issueCodes.length === 1 && row.issueCodes[0] === "condition_terrain_path_ground_coverage_mismatch"), "r5_stage3_convergence_rejection_identity_invalid")
  assert(rejected.every((row) => row.coverageRatio > row.maximumCoverageRatio), "r5_stage3_convergence_rejection_not_over_coverage")
  assert(pathRows.every((row) => row.unexpectedBoundarySides.length === 0), "r5_stage3_convergence_boundary_regression_present")
  assert(rows.every((row) => (row.conditionAlignment?.objectSemanticAudits ?? []).every((audit) => audit.passed === true)), "r5_stage3_convergence_object_semantics_regressed")
  const expectedRatios = [...new Set(pathRows.map((row) => row.expectedNonZeroRatio))]
  const maximumRatios = [...new Set(pathRows.map((row) => row.maximumCoverageRatio))]
  assert(expectedRatios.length === 1 && expectedRatios[0] > 0, "r5_stage3_convergence_expected_ratio_invalid")
  assert(maximumRatios.length === 1 && maximumRatios[0] === 3, "r5_stage3_convergence_review_threshold_changed")

  const rejectedCoverageRatios = rejected.map((row) => row.coverageRatio)
  const rejectedExcess = rejectedCoverageRatios.map((value) => value - maximumRatios[0])
  return {
    schemaVersion: "ai-assisted-v7-r5-stage3-coverage-convergence-candidate-v1",
    status: "isolated_stage3_coverage_convergence_candidate_cpu_regression_pending_not_implemented_not_active",
    generatedBy: "local_ai_v7_r5_stage3_coverage_convergence_failure_learning_program",
    sourceEvidence,
    failureAnalysis: {
      previewCount: rows.length,
      passedBaselineEpoch: baseline.epoch,
      rejectedEpochs: rejected.map((row) => row.epoch),
      issueCode: "condition_terrain_path_ground_coverage_mismatch",
      expectedNonZeroRatio: expectedRatios[0],
      unchangedMaximumCoverageRatio: maximumRatios[0],
      coverageRatios: pathRows.map((row) => ({ epoch: row.epoch, coverageRatio: row.coverageRatio, passed: row.issueCodes.length === 0 })),
      rejectedCoverageExcess: rejected.map((row, index) => ({ epoch: row.epoch, excessAboveUnchangedGate: rejectedExcess[index] })),
      minimumRejectedCoverageRatio: Math.min(...rejectedCoverageRatios),
      maximumRejectedCoverageRatio: Math.max(...rejectedCoverageRatios),
      finalRejectedCoverageRatio: rejectedCoverageRatios.at(-1),
      monotonicConvergenceObserved: rejectedCoverageRatios.every((value, index) => index === 0 || value <= rejectedCoverageRatios[index - 1]),
      authorizedBoundaryStable: true,
      objectSemanticsStable: true,
      conclusion: "path_visual_activation_mass_passes_initially_then_drifts_and_oscillates_above_the_unchanged_gate",
    },
    proposal: {
      boundedRepairVersion: R5_STAGE3_COVERAGE_CONVERGENCE_CANDIDATE_VERSION,
      parentBoundedRepairVersion: R5_STAGE3_INTERNAL_CANDIDATE_VERSION,
      implementationStatus: "proposal_only_requires_separate_owner_authorization",
      trainingAuthorizationStatus: "not_authorized_proposal_only",
      repairContractId: "local-ai-v7-r5-stage3-path-coverage-convergence-proposal-20260804",
      repairMode: "bounded_original_target_activation_mass_calibration_and_short_trajectory_drift_damping",
      checkpointContinuationProposal: {
        sourceCheckpointPath: finalization.checkpointPath,
        sourceCheckpointSha256: finalization.checkpointSha256,
        loadingAuthorizedNow: false,
        continuationEpochs: { minimum: 10, maximum: 30, selectedValue: null },
        evaluationInterval: 10,
      },
      pathActivationMassCalibrationProposal: {
        conditionChannel: "terrain_path_ground",
        targetSource: "original_owner_approved_rgb_activation_mass_with_original_condition_mask_only",
        failedPreviewPixelsUsedAsTrainingTargets: false,
        machineReviewThresholdUsedAsTrainingTarget: false,
        lossForm: "symmetric_log_activation_mass_ratio_plus_outside_support_leakage",
        weight: { minimum: 0.25, maximum: 0.75, selectedValue: null },
      },
      shortTrajectoryCoverageDriftProposal: {
        source: "current_training_prediction_steps_against_original_target_activation_mass_only",
        failedPreviewTrajectoryUsedAsTrainingTarget: false,
        objective: "damp_path_activation_mass_drift_across_denoising_steps_without_learning_review_outputs",
        weight: { minimum: 0.1, maximum: 0.35, selectedValue: null },
      },
      preserveExistingTrainingContract: {
        originalApprovedTargetReplayPassesPerEpoch: 2,
        pathInteriorRgbWeight: 2,
        pathForbiddenBoundaryRgbWeight: 2,
        pathCoverageCalibrationWeight: 0.75,
        authorizedBoundaryTopologyWeight: 0.5,
        objectSemanticWeightChanges: null,
        boundaryTopologyChanges: null,
      },
      smokeStabilityGate: {
        tailEpochs: [10, 20, 30],
        requiredConsecutiveTailPasses: 3,
        requireAllMachineReviewsPassed: true,
        requireZeroPathCoverageIssues: true,
        requireZeroUnauthorizedBoundaryContacts: true,
        requireZeroObjectSemanticIssues: true,
        preserveReviewThresholds: true,
      },
      ownerTrainingAuthorization: {
        status: "not_authorized_proposal_only",
        trainerImplementationAuthorized: false,
        checkpointLoadingAuthorized: false,
        optimizerCreationAuthorized: false,
        modelWeightMutationAuthorized: false,
        gpuTrainingAuthorizedNow: false,
        fullTrainingAuthorized: false,
        strictRevalidationAuthorized: false,
        formalInferenceAuthorized: false,
        runtimeFrameAuthorized: false,
        worldEntryAuthorized: false,
      },
    },
    reviewThresholdPolicy: "preserved_unchanged_not_used_as_training_target",
    promotionBoundary: {
      fixedStageNumber: 3,
      addsNewFixedStage: false,
      candidateActive: false,
      selectedExecutionValuesPresent: false,
      checkpointDeserialized: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      validationStarted: false,
      formalInferenceStarted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextIndependentAuthorization: "r5_stage3_coverage_convergence_candidate_trainer_support_and_cpu_regression_only",
    },
  }
}

export function validateR5Stage3CoverageConvergenceCandidate(candidate) {
  assert(candidate?.status?.includes("not_implemented_not_active"), "r5_stage3_convergence_candidate_status_invalid")
  const proposal = candidate?.proposal ?? {}
  assert(proposal.boundedRepairVersion === R5_STAGE3_COVERAGE_CONVERGENCE_CANDIDATE_VERSION, "r5_stage3_convergence_candidate_version_invalid")
  assert(proposal.parentBoundedRepairVersion === R5_STAGE3_INTERNAL_CANDIDATE_VERSION, "r5_stage3_convergence_parent_version_invalid")
  assert(proposal.trainingAuthorizationStatus === "not_authorized_proposal_only", "r5_stage3_convergence_training_status_invalid")
  const mass = proposal.pathActivationMassCalibrationProposal ?? {}
  const drift = proposal.shortTrajectoryCoverageDriftProposal ?? {}
  assert(mass.targetSource === "original_owner_approved_rgb_activation_mass_with_original_condition_mask_only", "r5_stage3_convergence_target_source_invalid")
  assert(mass.failedPreviewPixelsUsedAsTrainingTargets === false && drift.failedPreviewTrajectoryUsedAsTrainingTarget === false, "r5_stage3_convergence_failed_preview_used_as_target")
  assert(mass.machineReviewThresholdUsedAsTrainingTarget === false, "r5_stage3_convergence_review_threshold_used_as_target")
  assert(drift.source === "current_training_prediction_steps_against_original_target_activation_mass_only", "r5_stage3_convergence_drift_source_invalid")
  for (const selection of [proposal.checkpointContinuationProposal?.continuationEpochs, mass.weight, drift.weight]) {
    assert(selection?.selectedValue == null, "r5_stage3_convergence_execution_value_selected_without_authorization")
    assert(Number.isFinite(Number(selection?.minimum)) && Number.isFinite(Number(selection?.maximum)) && Number(selection.minimum) <= Number(selection.maximum), "r5_stage3_convergence_bounded_range_invalid")
  }
  const preserved = proposal.preserveExistingTrainingContract ?? {}
  assert(preserved.originalApprovedTargetReplayPassesPerEpoch === 2, "r5_stage3_convergence_replay_contract_changed")
  assert(preserved.pathInteriorRgbWeight === 2 && preserved.pathForbiddenBoundaryRgbWeight === 2, "r5_stage3_convergence_base_path_weights_changed")
  assert(preserved.pathCoverageCalibrationWeight === 0.75 && preserved.authorizedBoundaryTopologyWeight === 0.5, "r5_stage3_convergence_selected_stage3_weights_changed")
  assert(preserved.objectSemanticWeightChanges == null && preserved.boundaryTopologyChanges == null, "r5_stage3_convergence_unrelated_semantics_changed")
  assert(proposal.smokeStabilityGate?.preserveReviewThresholds === true, "r5_stage3_convergence_review_thresholds_changed")
  assert(JSON.stringify(proposal.smokeStabilityGate?.tailEpochs) === JSON.stringify([10, 20, 30]), "r5_stage3_convergence_tail_gate_changed")
  const authorization = proposal.ownerTrainingAuthorization ?? {}
  for (const key of ["trainerImplementationAuthorized", "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "modelWeightMutationAuthorized", "gpuTrainingAuthorizedNow", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) assert(authorization[key] === false, `r5_stage3_convergence_candidate_improperly_authorizes_${key}`)
  assert(candidate.promotionBoundary?.fixedStageNumber === 3 && candidate.promotionBoundary?.addsNewFixedStage === false, "r5_stage3_convergence_fixed_plan_boundary_invalid")
  return {
    status: "r5_stage3_coverage_convergence_candidate_contract_valid_proposal_only",
    reviewThresholdsPreserved: true,
    machineReviewThresholdUsedAsTrainingTarget: false,
    failedPreviewsUsedAsTrainingTargets: false,
    fixedStageNumber: 3,
    addsNewFixedStage: false,
  }
}

export function runCoverageConvergenceCpuRegression({ targetActivationMass, predictedActivationMass, outsideSupportActivationMass = 0, previousPredictedActivationMass = null }) {
  const target = Number(targetActivationMass)
  const predicted = Number(predictedActivationMass)
  const outside = Number(outsideSupportActivationMass)
  assert(Number.isFinite(target) && target > 0, "r5_stage3_convergence_target_activation_invalid")
  assert(Number.isFinite(predicted) && predicted >= 0, "r5_stage3_convergence_predicted_activation_invalid")
  assert(Number.isFinite(outside) && outside >= 0, "r5_stage3_convergence_outside_support_activation_invalid")
  const epsilon = 1e-6
  const activationMassRatio = predicted / target
  const symmetricActivationMassLoss = Math.abs(Math.log(Math.max(activationMassRatio, epsilon)))
  const outsideSupportLeakageLoss = outside / target
  const shortTrajectoryDriftLoss = previousPredictedActivationMass == null
    ? 0
    : Math.abs(predicted - Number(previousPredictedActivationMass)) / target
  return {
    targetActivationMass: target,
    predictedActivationMass: predicted,
    activationMassRatio,
    symmetricActivationMassLoss,
    outsideSupportLeakageLoss,
    shortTrajectoryDriftLoss,
    totalLoss: symmetricActivationMassLoss + outsideSupportLeakageLoss + shortTrajectoryDriftLoss,
  }
}

export function compileR5Stage3InternalCandidate({ review, closure, manifest, baseProposal, selectionContract, sourceEvidence }) {
  assert(review?.status === "failed" && review.reviewCount === 4 && review.failCount === 4, "r5_stage3_review_contract_invalid")
  assert(closure?.status === "r5_existing_smoke_review_failed_stopped", "r5_stage3_closure_not_failed_closed")
  assert(manifest?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "r5_stage3_training_manifest_incomplete")
  assert(manifest?.metrics?.at(-1)?.epoch === 30, "r5_stage3_epoch_contract_invalid")
  assert(baseProposal?.proposal?.boundedRepairVersion === "v7_bounded_repair_r5_candidate_proposal", "r5_stage3_base_proposal_invalid")
  assert(selectionContract?.selectedValues?.continuationEpochs === 30, "r5_stage3_selection_identity_invalid")
  const rows = [...review.reviews].sort((left, right) => Number(left.epoch) - Number(right.epoch))
  const pathRows = rows.map(extractPathEvidence)
  const expectedRatios = [...new Set(pathRows.map((row) => row.expectedNonZeroRatio))]
  assert(expectedRatios.length === 1 && expectedRatios[0] > 0, "r5_stage3_expected_path_ratio_invalid")
  assert(pathRows.every((row) => row.issueCodes.includes("condition_terrain_path_ground_coverage_mismatch")), "r5_stage3_coverage_failure_not_persistent")
  assert(pathRows.some((row) => row.issueCodes.includes("condition_terrain_path_ground_uncontracted_boundary_contact")), "r5_stage3_boundary_recurrence_missing")
  assert(pathRows.every((row) => row.coverageRatio > row.maximumCoverageRatio), "r5_stage3_coverage_not_above_unchanged_gate")
  assert(rows.every((row) => (row.conditionAlignment?.objectSemanticAudits ?? []).every((audit) => audit.passed === true)), "r5_stage3_object_semantics_regressed")
  const coverageRatios = pathRows.map((row) => row.coverageRatio)
  const boundaryFailureEpochs = pathRows.filter((row) => row.unexpectedBoundarySides.length > 0).map((row) => row.epoch)
  const requiredBoundarySides = [...new Set(pathRows.flatMap((row) => row.requiredBoundarySides))]
  assert(requiredBoundarySides.length === 1 && requiredBoundarySides[0] === "south", "r5_stage3_required_boundary_identity_invalid")
  return {
    schemaVersion: "ai-assisted-v7-r5-stage3-internal-candidate-v1",
    status: "isolated_stage3_internal_candidate_cpu_regression_pending_not_implemented_not_active",
    generatedBy: "local_ai_v7_r5_stage3_internal_failure_learning_program",
    sourceEvidence,
    failureAnalysis: {
      previewCount: rows.length,
      failedPreviewCount: rows.length,
      issueClusters: [
        {
          issueCode: "condition_terrain_path_ground_coverage_mismatch",
          occurrenceCount: pathRows.length,
          occurrenceEpochs: pathRows.map((row) => row.epoch),
          expectedNonZeroRatio: expectedRatios[0],
          actualSignalRatios: pathRows.map((row) => row.actualSignalRatio),
          coverageRatios,
          unchangedMaximumCoverageRatio: pathRows[0].maximumCoverageRatio,
          minimumObservedCoverageRatio: Math.min(...coverageRatios),
          maximumObservedCoverageRatio: Math.max(...coverageRatios),
          finalObservedCoverageRatio: coverageRatios.at(-1),
          conclusion: "decoded_path_signal_remains_systematically_over_covered",
        },
        {
          issueCode: "condition_terrain_path_ground_uncontracted_boundary_contact",
          occurrenceCount: boundaryFailureEpochs.length,
          occurrenceEpochs: boundaryFailureEpochs,
          requiredBoundarySides,
          unexpectedBoundarySidesByEpoch: Object.fromEntries(pathRows.filter((row) => row.unexpectedBoundarySides.length > 0).map((row) => [String(row.epoch), row.unexpectedBoundarySides])),
          conclusion: "unauthorized_boundary_contact_recurs_after_temporary_recovery",
        },
      ],
      objectSemanticRegressionCount: 0,
      modelResponse: {
        coverageImprovedFromEpoch1: coverageRatios.at(-1) < coverageRatios[0],
        finalCoverageStillRejected: coverageRatios.at(-1) > pathRows.at(-1).maximumCoverageRatio,
        boundaryContactTemporarilyRecoveredAtEpoch20: pathRows.find((row) => row.epoch === 20)?.unexpectedBoundarySides.length === 0,
        boundaryContactRecurredAtEpoch30: pathRows.find((row) => row.epoch === 30)?.unexpectedBoundarySides.length > 0,
      },
      conclusion: "r5_is_learnable_but_coverage_scale_and_authorized_boundary_topology_are_not_stable",
    },
    proposal: {
      boundedRepairVersion: R5_STAGE3_INTERNAL_CANDIDATE_VERSION,
      baseBoundedRepairVersion: "v7_bounded_repair_r5_candidate",
      implementationStatus: "proposal_only_requires_separate_owner_authorization",
      trainingAuthorizationStatus: "not_authorized_proposal_only",
      repairContractId: "local-ai-v7-r5-stage3-internal-path-coverage-boundary-stability-proposal-20260804",
      repairMode: "bounded_r5_checkpoint_continuation_with_original_target_coverage_and_authorized_boundary_topology",
      checkpointContinuationProposal: {
        sourceCheckpointPath: closure.checkpointPath,
        sourceCheckpointSha256: closure.checkpointSha256,
        loadingAuthorizedNow: false,
        continuationEpochs: { minimum: 30, maximum: 50, selectedValue: null },
        evaluationInterval: 10,
      },
      preserveExistingPathLossWeights: {
        pathInteriorRgb: 2,
        pathForbiddenBoundaryRgb: 2,
        increaseBeyondExistingBoundSelected: false,
      },
      pathHardExampleReplayProposal: {
        targetSource: "original_owner_approved_rgb_and_condition_pack_only",
        failedPreviewPixelsUsedAsTrainingTargets: false,
        evidenceEpochs: pathRows.map((row) => row.epoch),
        replayPassesPerEpoch: { minimum: 2, maximum: 2, selectedValue: null },
      },
      pathCoverageCalibrationProposal: {
        conditionChannel: "terrain_path_ground",
        targetSource: "original_condition_mask_support_only",
        machineReviewThresholdUsedAsTrainingTarget: false,
        objective: "penalize_excess_decoded_path_activation_relative_to_original_condition_mask_support",
        weight: { minimum: 0.25, maximum: 0.75, selectedValue: null },
      },
      authorizedBoundaryTopologyProposal: {
        conditionChannel: "terrain_path_ground",
        allowedSidesSource: "original_condition_channel_boundary_contact_only",
        requiredBoundarySides,
        objective: "penalize_decoded_path_contact_on_sides_absent_from_original_condition_channel",
        weight: { minimum: 0.25, maximum: 0.75, selectedValue: null },
      },
      pathShortTrajectoryConsistencyProposal: {
        currentWeight: 0.25,
        weight: { minimum: 0.25, maximum: 0.5, selectedValue: null },
        preserveCoverageAndBoundaryAcrossSteps: true,
      },
      objectSemanticStabilityProposal: {
        selectedWeightChanges: null,
        preserveExistingIndependentChannelWeights: true,
        rationale: "all_four_r5_previews_passed_every_object_semantic_audit",
      },
      smokeStabilityGate: {
        requiredConsecutiveTailPasses: 3,
        evaluationInterval: 10,
        requireAllMachineReviewsPassed: true,
        requireZeroPathCoverageIssues: true,
        requireZeroUnauthorizedBoundaryContacts: true,
        requireZeroObjectSemanticIssues: true,
        preserveReviewThresholds: true,
      },
      ownerTrainingAuthorization: {
        status: "not_authorized_proposal_only",
        trainerImplementationAuthorized: false,
        checkpointLoadingAuthorized: false,
        optimizerCreationAuthorized: false,
        gpuTrainingAuthorizedNow: false,
        fullTrainingAuthorized: false,
        strictRevalidationAuthorized: false,
        formalInferenceAuthorized: false,
        runtimeFrameAuthorized: false,
        worldEntryAuthorized: false,
      },
    },
    reviewThresholdPolicy: "preserved_unchanged",
    promotionBoundary: {
      fixedStageNumber: 3,
      addsNewFixedStage: false,
      candidateActive: false,
      selectedExecutionValuesPresent: false,
      checkpointDeserialized: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      validationStarted: false,
      formalInferenceStarted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextIndependentAuthorization: "r5_stage3_internal_candidate_trainer_support_and_cpu_regression_only",
    },
  }
}

export function validateR5Stage3InternalCandidate(candidate) {
  assert(candidate?.status?.includes("not_implemented_not_active"), "r5_stage3_candidate_status_invalid")
  const proposal = candidate?.proposal ?? {}
  assert(proposal.boundedRepairVersion === R5_STAGE3_INTERNAL_CANDIDATE_VERSION, "r5_stage3_candidate_version_invalid")
  assert(proposal.trainingAuthorizationStatus === "not_authorized_proposal_only", "r5_stage3_candidate_training_status_invalid")
  assert(proposal.preserveExistingPathLossWeights?.pathInteriorRgb === 2 && proposal.preserveExistingPathLossWeights?.pathForbiddenBoundaryRgb === 2, "r5_stage3_base_path_weights_changed")
  assert(proposal.preserveExistingPathLossWeights?.increaseBeyondExistingBoundSelected === false, "r5_stage3_path_bound_increase_selected")
  for (const selection of [proposal.checkpointContinuationProposal?.continuationEpochs, proposal.pathHardExampleReplayProposal?.replayPassesPerEpoch, proposal.pathCoverageCalibrationProposal?.weight, proposal.authorizedBoundaryTopologyProposal?.weight, proposal.pathShortTrajectoryConsistencyProposal?.weight]) {
    assert(selection?.selectedValue == null, "r5_stage3_execution_value_selected_without_authorization")
    assert(Number.isFinite(Number(selection?.minimum)) && Number.isFinite(Number(selection?.maximum)) && Number(selection.minimum) <= Number(selection.maximum), "r5_stage3_bounded_range_invalid")
  }
  assert(proposal.pathHardExampleReplayProposal?.targetSource === "original_owner_approved_rgb_and_condition_pack_only", "r5_stage3_replay_target_invalid")
  assert(proposal.pathHardExampleReplayProposal?.failedPreviewPixelsUsedAsTrainingTargets === false, "r5_stage3_failed_preview_used_as_target")
  assert(proposal.pathCoverageCalibrationProposal?.targetSource === "original_condition_mask_support_only", "r5_stage3_coverage_target_invalid")
  assert(proposal.pathCoverageCalibrationProposal?.machineReviewThresholdUsedAsTrainingTarget === false, "r5_stage3_review_threshold_used_as_target")
  assert(proposal.authorizedBoundaryTopologyProposal?.allowedSidesSource === "original_condition_channel_boundary_contact_only", "r5_stage3_boundary_target_invalid")
  assert(proposal.objectSemanticStabilityProposal?.selectedWeightChanges == null, "r5_stage3_object_weights_changed")
  assert(proposal.smokeStabilityGate?.preserveReviewThresholds === true, "r5_stage3_review_thresholds_changed")
  const authorization = proposal.ownerTrainingAuthorization ?? {}
  for (const key of ["trainerImplementationAuthorized", "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "gpuTrainingAuthorizedNow", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) assert(authorization[key] === false, `r5_stage3_candidate_improperly_authorizes_${key}`)
  assert(candidate.promotionBoundary?.fixedStageNumber === 3 && candidate.promotionBoundary?.addsNewFixedStage === false, "r5_stage3_fixed_plan_boundary_invalid")
  return { status: "r5_stage3_internal_candidate_contract_valid_proposal_only", reviewThresholdsPreserved: true, failedPreviewsUsedAsTrainingTargets: false, fixedStageNumber: 3, addsNewFixedStage: false }
}

export function runCoverageBoundaryCpuRegression({ expectedMask, predictedMask, boundary }) {
  assert(Array.isArray(expectedMask) && expectedMask.length > 0 && expectedMask.length === predictedMask.length, "r5_stage3_regression_mask_shape_invalid")
  const expectedArea = expectedMask.reduce((sum, value) => sum + Number(value), 0)
  const predictedArea = predictedMask.reduce((sum, value) => sum + Number(value), 0)
  assert(expectedArea > 0, "r5_stage3_regression_expected_mask_empty")
  const excessArea = Math.max(0, predictedArea - expectedArea)
  const coverageExcessLoss = excessArea / expectedArea
  const allowed = new Set(boundary.allowedSides)
  const unauthorizedValues = Object.entries(boundary.predictedSideSignals).filter(([side]) => !allowed.has(side)).map(([, value]) => Number(value))
  const unauthorizedBoundaryLoss = unauthorizedValues.reduce((sum, value) => sum + Math.max(0, value), 0)
  return { expectedArea, predictedArea, coverageRatio: predictedArea / expectedArea, coverageExcessLoss, unauthorizedBoundaryLoss, totalLoss: coverageExcessLoss + unauthorizedBoundaryLoss }
}

function extractPathEvidence(row) {
  const audit = (row.conditionAlignment?.channelAudits ?? []).find((value) => value.channelId === "terrain_path_ground")
  assert(audit, `r5_stage3_path_audit_missing_epoch_${row.epoch}`)
  return {
    epoch: Number(row.epoch),
    issueCodes: [...(row.issueCodes ?? [])],
    expectedNonZeroRatio: Number(audit.expectedNonZeroRatio),
    actualSignalRatio: Number(audit.actualSignalRatio),
    coverageRatio: Number(audit.coverageRatio),
    maximumCoverageRatio: Number(audit.thresholds?.maximumCoverageRatio),
    requiredBoundarySides: [...(audit.boundaryContactAudit?.requiredSides ?? [])],
    unexpectedBoundarySides: [...(audit.boundaryContactAudit?.unexpectedContactSides ?? [])],
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
