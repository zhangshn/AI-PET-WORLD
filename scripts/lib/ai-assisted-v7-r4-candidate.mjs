export const R4_CANDIDATE_VERSION = "v7_bounded_repair_r4_candidate_proposal"
export const R4_TAIL_EPOCHS = Object.freeze([100, 110, 120])

export function compileR4CandidateProposal({ r3Candidate, failureLearningReport, sourceEvidence }) {
  assert(r3Candidate?.patch?.training?.boundedRepairVersion === "v7_bounded_repair_r3_candidate", "r4_candidate_base_is_not_r3")
  assert(failureLearningReport?.repairContract?.configurationPatchProposal?.status === "proposal_only_not_applied", "r4_repair_contract_not_proposal_only")
  assert(failureLearningReport?.repairContract?.configurationPatchProposal?.proposedBoundedRepairVersion === R4_CANDIDATE_VERSION, "r4_repair_contract_version_invalid")
  assert(failureLearningReport?.closure?.configurationPatchApplied === false, "r4_source_configuration_was_applied")
  assert(failureLearningReport?.closure?.trainingStarted === false, "r4_source_training_started")

  const training = r3Candidate.patch.training
  const clusters = new Map(failureLearningReport.issueClusters.map((row) => [row.issueCode, row]))
  const boundary = clusters.get("condition_terrain_path_ground_uncontracted_boundary_contact")
  const coverage = clusters.get("condition_terrain_path_ground_coverage_mismatch")
  const objectCodes = failureLearningReport.issueClusters
    .filter((row) => row.family === "object_semantic_alignment")
    .map((row) => row.issueCode)
  assert(boundary?.occurrenceEpochs?.includes(110), "r4_boundary_tail_recurrence_evidence_missing")
  assert(coverage?.occurrenceCount > 0, "r4_path_coverage_evidence_missing")
  assert(objectCodes.length > 0, "r4_object_semantic_evidence_missing")

  const pathInteriorCurrent = Number(training.denoiserLossWeights.pathInteriorRgb)
  const pathForbiddenCurrent = Number(training.denoiserLossWeights.pathForbiddenBoundaryRgb)
  const objectWeights = structuredClone(training.objectSemanticChannelWeights)
  const proposal = {
    boundedRepairVersion: R4_CANDIDATE_VERSION,
    baseBoundedRepairVersion: training.boundedRepairVersion,
    implementationStatus: "proposal_only_requires_separate_owner_authorization",
    trainingAuthorizationStatus: "not_authorized_proposal_only",
    repairContractId: "local-ai-v7-r4-road-boundary-object-semantic-stability-proposal-20260804",
    pathStabilityWeightSearch: {
      pathInteriorRgb: {
        current: pathInteriorCurrent,
        minimum: pathInteriorCurrent,
        maximum: 2.0,
        selectedValue: null,
        evidenceIssueCode: coverage.issueCode,
        occurrenceEpochs: coverage.occurrenceEpochs,
      },
      pathForbiddenBoundaryRgb: {
        current: pathForbiddenCurrent,
        minimum: pathForbiddenCurrent,
        maximum: 2.0,
        selectedValue: null,
        evidenceIssueCode: boundary.issueCode,
        occurrenceEpochs: boundary.occurrenceEpochs,
        tailRecurrenceEpoch: 110,
      },
    },
    objectSemanticStabilityProposal: {
      preserveIndependentChannels: true,
      currentChannelWeights: objectWeights,
      selectedWeightChanges: null,
      requireZeroTailIssueCodes: objectCodes,
      rationale: "object_semantic_issues_resolved_before_tail_so_weights_are_not_blindly_increased",
    },
    smokeStabilityGate: {
      requiredConsecutiveTailPasses: 3,
      tailEpochs: [...R4_TAIL_EPOCHS],
      requireAllMachineReviewsPassed: true,
      requireZeroPathBoundaryIssues: true,
      requireZeroObjectSemanticIssues: true,
      preserveReviewThresholds: true,
      thresholdSource: "unchanged_existing_machine_review_contract",
    },
    ownerTrainingAuthorization: {
      status: "not_authorized_proposal_only",
      trainerImplementationAuthorized: false,
      gpuTrainingAuthorizedNow: false,
      fullTrainingAuthorized: false,
      validationAuthorized: false,
      formalInferenceAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
    },
  }
  return {
    schemaVersion: "ai-assisted-v7-bounded-repair-r4-candidate-proposal-v1",
    status: "isolated_candidate_proposal_cpu_regression_pending_not_implemented_not_active",
    generatedBy: "local_ai_failure_learning_r4_candidate_proposal_compiler",
    sourceR3Candidate: sourceEvidence.r3Candidate,
    sourceFailureLearningReport: sourceEvidence.failureLearningReport,
    sourceOfflineClosure: sourceEvidence.offlineClosure,
    sourcePreviewReview: sourceEvidence.previewReview,
    reviewThresholdPolicy: "preserved_unchanged",
    proposal,
    promotionBoundary: {
      formalConfigActive: false,
      trainerImplementationComplete: false,
      modelWeightsModified: false,
      gpuTrainingAuthorized: false,
      validationAuthorized: false,
      formalInferenceAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
      nextIndependentAuthorization: "r4_candidate_trainer_implementation_and_non_training_regression_only",
    },
  }
}

export function evaluateR4TailStability(reviews, proposal) {
  const tailEpochs = proposal?.smokeStabilityGate?.tailEpochs ?? []
  const rows = new Map((reviews ?? []).map((row) => [Number(row.epoch), row]))
  const evaluated = tailEpochs.map((epoch) => {
    const row = rows.get(Number(epoch))
    const issueCodes = Array.isArray(row?.issueCodes) ? row.issueCodes : []
    return {
      epoch: Number(epoch),
      recorded: Boolean(row),
      passed: row?.passed === true && issueCodes.length === 0,
      pathBoundaryIssueFree: !issueCodes.some((code) => code.includes("terrain_path_ground")),
      objectSemanticIssueFree: !issueCodes.some((code) => code.includes("condition_object_")),
      issueCodes,
    }
  })
  const passed = evaluated.length === 3 && evaluated.every((row) => row.recorded && row.passed && row.pathBoundaryIssueFree && row.objectSemanticIssueFree)
  return {
    status: passed ? "r4_tail_stability_gate_passed" : "r4_tail_stability_gate_failed_closed",
    passed,
    requiredConsecutiveTailPasses: 3,
    evaluated,
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
