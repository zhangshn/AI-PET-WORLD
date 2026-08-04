export const R5_CANDIDATE_VERSION = "v7_bounded_repair_r5_candidate_proposal"

export function compileR5CandidateProposal({ finalization, review, manifest, derivedConfig, sourceEvidence }) {
  assert(finalization?.status === "r4_random_init_single_sample_overfit_smoke_failed_stopped", "r5_source_finalization_not_failed_closed")
  assert(review?.status === "failed" && review?.reviewCount === 10, "r5_source_review_contract_invalid")
  assert(review?.failCount === 9 && review?.passCount === 1, "r5_source_review_counts_invalid")
  assert(manifest?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "r5_source_manifest_incomplete")
  assert(derivedConfig?.training?.boundedRepairVersion === "v7_bounded_repair_r4_candidate", "r5_source_config_not_r4")
  const rows = [...review.reviews].sort((left, right) => Number(left.epoch) - Number(right.epoch))
  const issueClusters = clusterIssues(rows)
  const pathClusters = issueClusters.filter((row) => row.family === "terrain_path_topology")
  const objectClusters = issueClusters.filter((row) => row.family === "object_semantic_alignment")
  const tailRows = rows.filter((row) => [100, 110, 120].includes(Number(row.epoch)))
  const scoreFirst = Number(finalization.metrics?.firstValidationCheckpointSelectionScore)
  const scoreFinal = Number(finalization.metrics?.finalValidationCheckpointSelectionScore)
  assert(Number.isFinite(scoreFirst) && Number.isFinite(scoreFinal) && scoreFinal < scoreFirst, "r5_source_quality_did_not_improve")
  assert(tailRows.length === 3 && tailRows[2].passed === true && tailRows.slice(0, 2).every((row) => row.passed !== true), "r5_source_tail_pattern_invalid")
  assert(pathClusters.some((cluster) => cluster.occurrenceEpochs.includes(100)), "r5_path_epoch_100_evidence_missing")
  assert(pathClusters.some((cluster) => cluster.occurrenceEpochs.includes(110)), "r5_path_epoch_110_evidence_missing")
  assert(objectClusters.every((cluster) => cluster.lastSeenEpoch < 100), "r5_object_semantics_not_resolved_before_tail")
  const training = derivedConfig.training
  assert(Number(training.denoiserLossWeights.pathInteriorRgb) === 2, "r5_source_path_interior_not_at_r4_bound")
  assert(Number(training.denoiserLossWeights.pathForbiddenBoundaryRgb) === 2, "r5_source_path_forbidden_not_at_r4_bound")
  const pathFailureEpochs = [...new Set(pathClusters.flatMap((cluster) => cluster.occurrenceEpochs))].sort((a, b) => a - b)
  const objectWeights = structuredClone(training.objectSemanticChannelWeights)
  return {
    schemaVersion: "ai-assisted-v7-bounded-repair-r5-candidate-proposal-v1",
    status: "isolated_candidate_proposal_cpu_regression_pending_not_implemented_not_active",
    generatedBy: "local_ai_v7_r5_failure_learning_candidate_compiler",
    sourceEvidence,
    failureAnalysis: {
      previewCount: rows.length,
      failedPreviewCount: rows.filter((row) => row.passed !== true).length,
      passedPreviewCount: rows.filter((row) => row.passed === true).length,
      firstCheckpointSelectionScore: scoreFirst,
      finalCheckpointSelectionScore: scoreFinal,
      checkpointSelectionScoreImproved: true,
      finalEpochPassed: rows.at(-1).passed === true,
      finalPassingStreak: trailingPassCount(rows),
      requiredTailPassed: false,
      issueClusters,
      conclusion: "model_is_learnable_but_path_topology_is_not_stable_across_the_required_tail",
    },
    proposal: {
      boundedRepairVersion: R5_CANDIDATE_VERSION,
      baseBoundedRepairVersion: training.boundedRepairVersion,
      implementationStatus: "proposal_only_requires_separate_owner_authorization",
      trainingAuthorizationStatus: "not_authorized_proposal_only",
      repairContractId: "local-ai-v7-r5-checkpoint-continuation-path-trajectory-stability-proposal-20260804",
      repairMode: "bounded_checkpoint_continuation_with_original_target_path_hard_example_replay",
      preserveR4PathLossWeights: {
        pathInteriorRgb: 2,
        pathForbiddenBoundaryRgb: 2,
        increaseBeyondR4BoundSelected: false,
      },
      checkpointContinuationProposal: {
        sourceCheckpointPath: finalization.checkpointPath,
        sourceCheckpointSha256: finalization.checkpointSha256,
        loadingAuthorizedNow: false,
        continuationEpochs: { minimum: 30, maximum: 60, selectedValue: null },
        evaluationInterval: 10,
      },
      pathHardExampleReplayProposal: {
        targetSource: "original_owner_approved_rgb_and_condition_pack_only",
        failedPreviewPixelsUsedAsTrainingTargets: false,
        evidenceEpochs: pathFailureEpochs,
        replayPassesPerEpoch: { minimum: 1, maximum: 2, selectedValue: null },
        requiresTrainerSupport: true,
      },
      pathShortTrajectoryConsistencyProposal: {
        conditionChannel: "terrain_path_ground",
        objective: "preserve_authorized_path_coverage_and_forbid_uncontracted_boundary_contact_across_short_trajectory_steps",
        weight: { minimum: 0.25, maximum: 0.5, selectedValue: null },
        requiresTrainerSupport: true,
      },
      objectSemanticStabilityProposal: {
        currentChannelWeights: objectWeights,
        selectedWeightChanges: null,
        preserveIndependentChannels: true,
        rationale: "all_object_semantic_issues_resolved_before_epoch_100_so_no_blind_weight_increase_is_proposed",
      },
      smokeStabilityGate: {
        requiredConsecutiveTailPasses: 3,
        evaluationInterval: 10,
        requireAllMachineReviewsPassed: true,
        requireZeroPathBoundaryIssues: true,
        requireZeroObjectSemanticIssues: true,
        preserveReviewThresholds: true,
      },
      ownerTrainingAuthorization: {
        status: "not_authorized_proposal_only",
        trainerImplementationAuthorized: false,
        checkpointLoadingAuthorized: false,
        gpuTrainingAuthorizedNow: false,
        validationAuthorized: false,
        formalInferenceAuthorized: false,
        runtimeFrameAuthorized: false,
        worldEntryAuthorized: false,
      },
    },
    reviewThresholdPolicy: "preserved_unchanged",
    promotionBoundary: {
      trainerImplementationComplete: false,
      candidateActive: false,
      selectedExecutionValuesPresent: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      validationStarted: false,
      formalInferenceStarted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextIndependentAuthorization: "r5_trainer_support_and_cpu_regression_only",
    },
  }
}

export function evaluateR5TailGate(rows) {
  const normalized = [...rows].sort((left, right) => Number(left.epoch) - Number(right.epoch)).slice(-3)
  const evaluated = normalized.map((row) => {
    const issueCodes = Array.isArray(row.issueCodes) ? row.issueCodes : []
    return {
      epoch: Number(row.epoch),
      passed: row.passed === true && issueCodes.length === 0,
      pathIssueFree: !issueCodes.some((code) => code.includes("terrain_path_ground")),
      objectIssueFree: !issueCodes.some((code) => code.startsWith("condition_object_")),
      issueCodes,
    }
  })
  const passed = evaluated.length === 3 && evaluated.every((row) => row.passed && row.pathIssueFree && row.objectIssueFree)
  return { status: passed ? "r5_tail_gate_passed" : "r5_tail_gate_failed_closed", passed, evaluated }
}

export function validateR5CandidateProposal(candidate) {
  assert(candidate?.status?.includes("not_implemented_not_active"), "r5_candidate_status_invalid")
  const proposal = candidate?.proposal ?? {}
  assert(proposal.boundedRepairVersion === R5_CANDIDATE_VERSION, "r5_candidate_version_invalid")
  assert(proposal.trainingAuthorizationStatus === "not_authorized_proposal_only", "r5_candidate_training_status_invalid")
  assert(proposal.preserveR4PathLossWeights?.pathInteriorRgb === 2, "r5_path_interior_weight_changed")
  assert(proposal.preserveR4PathLossWeights?.pathForbiddenBoundaryRgb === 2, "r5_path_forbidden_weight_changed")
  assert(proposal.preserveR4PathLossWeights?.increaseBeyondR4BoundSelected === false, "r5_path_bound_increase_selected")
  assert(proposal.checkpointContinuationProposal?.continuationEpochs?.selectedValue == null, "r5_continuation_epochs_selected_without_authorization")
  assert(proposal.pathHardExampleReplayProposal?.replayPassesPerEpoch?.selectedValue == null, "r5_replay_count_selected_without_authorization")
  assert(proposal.pathShortTrajectoryConsistencyProposal?.weight?.selectedValue == null, "r5_path_consistency_weight_selected_without_authorization")
  assert(proposal.pathHardExampleReplayProposal?.failedPreviewPixelsUsedAsTrainingTargets === false, "r5_failed_preview_used_as_training_target")
  assert(proposal.objectSemanticStabilityProposal?.selectedWeightChanges == null, "r5_object_weight_change_selected")
  assert(proposal.smokeStabilityGate?.preserveReviewThresholds === true, "r5_review_thresholds_changed")
  const authorization = proposal.ownerTrainingAuthorization ?? {}
  for (const key of ["trainerImplementationAuthorized", "checkpointLoadingAuthorized", "gpuTrainingAuthorizedNow", "validationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) {
    assert(authorization[key] === false, `r5_candidate_improperly_authorizes_${key}`)
  }
  return {
    status: "r5_candidate_contract_valid_proposal_only",
    selectedExecutionValuesPresent: false,
    reviewThresholdsPreserved: true,
    failedPreviewsUsedAsTrainingTargets: false,
  }
}

function clusterIssues(rows) {
  const codes = [...new Set(rows.flatMap((row) => row.issueCodes ?? []))].sort()
  return codes.map((issueCode) => {
    const matched = rows.filter((row) => (row.issueCodes ?? []).includes(issueCode))
    return {
      issueCode,
      family: issueCode.startsWith("condition_object_") ? "object_semantic_alignment" : "terrain_path_topology",
      occurrenceCount: matched.length,
      occurrenceEpochs: matched.map((row) => Number(row.epoch)),
      firstSeenEpoch: Number(matched[0].epoch),
      lastSeenEpoch: Number(matched.at(-1).epoch),
      resolvedByFinal: !(rows.at(-1).issueCodes ?? []).includes(issueCode),
    }
  })
}

function trailingPassCount(rows) {
  let count = 0
  for (let index = rows.length - 1; index >= 0 && rows[index].passed === true; index -= 1) count += 1
  return count
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
