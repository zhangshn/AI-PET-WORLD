export const CAPABILITY_VERSION =
  "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"
export const SOURCE_RUN_ID =
  "20260830-004449978-joint-condition-local-transport-smoke"
export const DECISION =
  "controlled_smoke_training_coverage_insufficient_for_model_family_rejection"
export const NEXT_LEGAL_ACTION =
  "compile_joint_condition_local_transport_24_epoch_full_data_screen"

const SAMPLE_ID =
  "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function exactSmokeCoverage(training) {
  const totals = training?.trainingTokenAccounting?.runTotals
  const coverage = training?.timestepCoverage
  return (
    training?.status ===
      "stage4_joint_condition_local_transport_controlled_smoke_training_completed_awaiting_automatic_machine_review"
    && training?.seed === 20263722
    && training?.singleSampleOverfitSmoke?.sampleId === SAMPLE_ID
    && totals?.epochCount === 30
    && totals?.trainingSamplePresentations === 30
    && totals?.optimizerSteps === 30
    && coverage?.samplingContract === "deterministic_full_schedule_cover_v2"
    && coverage?.diffusionStepCount === 1000
    && coverage?.trainingPresentationCount === 30
    && coverage?.uniqueTrainingTimestepCount === 30
    && coverage?.coverageRatio === 0.03
    && coverage?.minimumTimestep === 635
    && coverage?.maximumTimestep === 722
    && coverage?.inferenceTimestepCount === 50
    && coverage?.exactInferenceOverlapCount === 0
    && coverage?.fullScheduleCovered === false
  )
}

function exactFullDataReference(training) {
  const totals = training?.trainingTokenAccounting?.runTotals
  const coverage = training?.timestepCoverage
  return (
    totals?.epochCount === 24
    && totals?.trainingSamplePresentations === 1152
    && totals?.optimizerSteps === 1152
    && training?.seed === 20263722
    && training?.splitMetrics?.train?.sampleCount === 48
    && training?.splitMetrics?.validation?.sampleCount === 8
    && coverage?.diffusionStepCount === 1000
    && coverage?.trainingPresentationCount === 1152
    && coverage?.uniqueTrainingTimestepCount === 1000
    && coverage?.coverageRatio === 1
    && coverage?.minimumTimestep === 0
    && coverage?.maximumTimestep === 999
    && coverage?.inferenceTimestepCount === 50
    && coverage?.exactInferenceOverlapCount === 50
    && coverage?.fullScheduleCovered === true
  )
}

function exactFormalStage0Reference(training) {
  const totals = training?.trainingTokenAccounting?.runTotals
  const coverage = training?.timestepCoverage
  return (
    totals?.epochCount === 40
    && totals?.optimizerSteps === 5760
    && training?.splitMetrics?.train?.sampleCount === 48
    && training?.splitMetrics?.validation?.sampleCount === 8
    && coverage?.diffusionStepCount === 1000
    && coverage?.uniqueTrainingTimestepCount === 1000
    && coverage?.exactInferenceOverlapCount === 50
    && coverage?.fullScheduleCovered === true
  )
}

function exactSourceClosure(input) {
  const { terminal, manifest, machineReview, lateStability } = input
  return (
    terminal?.schemaVersion === "ai-painter-autonomous-closed-loop-terminal-v1"
    && terminal?.status === "failed_closed"
    && terminal?.failureCode === "joint_transport_smoke_real_visual_failure"
    && terminal?.ownerAuthorizationRequired === false
    && terminal?.ownerResponseRequired === false
    && manifest?.status === "real_visual_failure"
    && manifest?.runId === SOURCE_RUN_ID
    && manifest?.capabilityVersion === CAPABILITY_VERSION
    && manifest?.stage0Started === false
    && manifest?.trainingRetryStarted === false
    && machineReview?.status === "machine_reviews_failed"
    && machineReview?.runId === SOURCE_RUN_ID
    && machineReview?.completedReviewCount === 5
    && machineReview?.targetReviewCount === 5
    && machineReview?.previewPassCount === 0
    && machineReview?.previewFailCount === 5
    && machineReview?.reviewThresholdsChanged === false
    && machineReview?.machineReviewResultsUsedAsTrainingTarget === false
    && machineReview?.failedPreviewPixelsUsedAsTrainingTarget === false
    && lateStability?.status === "real_visual_failure"
    && lateStability?.runId === SOURCE_RUN_ID
    && lateStability?.qualified === false
    && lateStability?.thresholdsChanged === false
    && lateStability?.trainingRetryAllowed === false
  )
}

function exactActiveBoundary(activeConfig) {
  const smoke = activeConfig?.training?.stage4JointConditionLocalTransportSmokeContract
  const model = activeConfig?.jointConditionLocalTransportContract
  return (
    activeConfig?.denoiserArchitecture === CAPABILITY_VERSION
    && activeConfig?.architectureVersion ===
      "joint-condition-local-transport-denoiser-v1"
    && model?.architectureId === CAPABILITY_VERSION
    && model?.capabilityVersion === CAPABILITY_VERSION
    && model?.conditionChannels === 23
    && model?.latentChannels === 12
    && model?.siteCount === 12
    && model?.parameterTensorCount === 24
    && model?.parameterCount === 22464
    && model?.objectiveReviewAlignmentClaimed === false
    && smoke?.sampleId === SAMPLE_ID
    && smoke?.sampleSplit === "validation"
    && smoke?.seed === 20263722
    && smoke?.epochCount === 30
    && smoke?.optimizerStepCount === 30
    && smoke?.denoiserCheckpointPath === null
    && smoke?.denoiserCheckpointReadAllowed === false
    && smoke?.historicalCheckpointAllowed === false
    && smoke?.failedCheckpointAllowed === false
    && smoke?.automaticTrainingRetryAllowed === false
    && smoke?.formalMachineReviewRemainsAuthoritative === true
    && activeConfig?.evidenceBindings?.approvedDataset?.splitCounts?.train === 48
    && activeConfig?.evidenceBindings?.approvedDataset?.splitCounts?.validation === 8
  )
}

function exactCrossBindings(input) {
  return (
    input?.manifest?.trainingManifest?.sha256 === input?.bindings?.trainingManifest?.sha256
    && input?.manifest?.machineReviewTimeline?.sha256 === input?.bindings?.machineReview?.sha256
    && input?.manifest?.lateStabilityQualification?.sha256 === input?.bindings?.lateStability?.sha256
    && input?.manifest?.runId === input?.activeConfig?.executionIdentity?.runId
    && input?.activeConfig?.executionIdentity?.runId === SOURCE_RUN_ID
    && input?.activeConfig?.training?.localAiCapabilityTicket?.runId === SOURCE_RUN_ID
  )
}

export function adjudicateJointTransportSmokeTrainingCoverage(input) {
  const checks = {
    immutableBindingsVerified:
      input?.bindingsVerified === true
      && Object.keys(input?.bindings ?? {}).length === 8,
    sourceClosureExact: exactSourceClosure(input),
    activeCandidateBoundaryExact: exactActiveBoundary(input?.activeConfig),
    sourceCrossBindingsExact: exactCrossBindings(input),
    smokeCoverageExact: exactSmokeCoverage(input?.trainingManifest),
    fullDataReferenceExact: exactFullDataReference(input?.fullDataReferenceManifest),
    formalStage0ReferenceExact: exactFormalStage0Reference(input?.formalStage0Manifest),
    noCheckpointWeightsRead: input?.executionBoundary?.checkpointWeightsRead === false,
    noGpuOrTrainingStarted:
      input?.executionBoundary?.gpuStarted === false
      && input?.executionBoundary?.trainingStarted === false,
  }
  const evidenceQualified = Object.values(checks).every(Boolean)
  const comparison = {
    controlledSmoke: {
      epochCount: 30,
      optimizerSteps: 30,
      uniqueTrainingTimesteps: 30,
      diffusionSteps: 1000,
      coverageRatio: 0.03,
      inferenceTimestepCount: 50,
      exactInferenceOverlapCount: 0,
      minimumTimestep: 635,
      maximumTimestep: 722,
      trainSampleCount: 0,
      boundValidationSampleCount: 1,
    },
    existingTwentyFourEpochFullDataScreen: {
      epochCount: 24,
      optimizerSteps: 1152,
      uniqueTrainingTimesteps: 1000,
      diffusionSteps: 1000,
      coverageRatio: 1,
      inferenceTimestepCount: 50,
      exactInferenceOverlapCount: 50,
      trainSampleCount: 48,
      validationSampleCount: 8,
    },
    formalStage0: {
      epochCount: 40,
      optimizerSteps: 5760,
      uniqueTrainingTimesteps: 1000,
      diffusionSteps: 1000,
      exactInferenceOverlapCount: 50,
      trainSampleCount: 48,
      validationSampleCount: 8,
    },
    smokeOptimizerStepFractionOfFullDataScreen: 30 / 1152,
    smokeOptimizerStepFractionOfFormalStage0: 30 / 5760,
  }
  return {
    schemaVersion:
      "stage4-joint-condition-local-transport-smoke-training-coverage-adjudication-v1",
    status: evidenceQualified ? "uniquely_adjudicated" : "failed_closed_evidence_mismatch",
    checks,
    comparison,
    decision: evidenceQualified ? DECISION : "pause_evidence_mismatch",
    candidateRejected: false,
    sameThirtyStepSmokeRerunAllowed: false,
    nextLegalAction: evidenceQualified ? NEXT_LEGAL_ACTION : null,
    rationale: evidenceQualified
      ? "A one-sample 30-step Smoke observed only 3% of the diffusion schedule and no formal inference timestep; it can falsify Smoke qualification but cannot reject this model family before a frozen full-data screen."
      : "The immutable evidence boundary is incomplete or changed; no model-family decision is legal.",
  }
}

export function deriveJointTransportTwentyFourEpochFullDataScreenContract(input) {
  const adjudication = adjudicateJointTransportSmokeTrainingCoverage(input)
  if (adjudication.decision !== DECISION) {
    return {
      schemaVersion:
        "stage4-joint-condition-local-transport-24-epoch-full-data-screen-contract-v1",
      status: "ineligible_evidence_mismatch",
      activationAuthorized: false,
    }
  }
  const active = input.activeConfig
  return {
    schemaVersion:
      "stage4-joint-condition-local-transport-24-epoch-full-data-screen-contract-v1",
    status: "cpu_compiled_inactive_not_authorized_for_gpu_or_training",
    authority: "local_ai_pet_world_program",
    capabilityVersion: CAPABILITY_VERSION,
    architectureId: CAPABILITY_VERSION,
    sourceSmokeRunId: SOURCE_RUN_ID,
    purpose: "bounded_full_data_model_family_screen_after_coverage_insufficient_smoke",
    fixedExecutionIdentity: {
      seed: 20263722,
      epochCount: 24,
      trainSampleCountPerEpoch: 48,
      optimizerStepsPerEpoch: 48,
      optimizerStepCount: 1152,
      diffusionStepCount: 1000,
      requiredUniqueTrainingTimestepCount: 1000,
      inferenceTimestepCount: 50,
      requiredExactInferenceOverlapCount: 50,
      initialization: "fixed_random_denoiser_initialization_without_checkpoint",
      previewEpochs: [5, 10, 15, 20, 24],
    },
    frozenModelBoundary: {
      conditionChannels: 23,
      latentChannels: 12,
      timeEmbeddingChannels: 256,
      widths: [64, 128, 256],
      transportSiteCount: 12,
      transportParameterTensorCount: 24,
      transportParameterCount: 22464,
      contract: clone(active.jointConditionLocalTransportContract),
      modelChangedFromSmoke: false,
    },
    frozenDataBoundary: clone(active.evidenceBindings.approvedDataset),
    frozenObjectiveBoundary: {
      formalObjectiveContract: clone(active.evidenceBindings.formalObjectiveContract),
      lossValuesChanged: false,
      lossWeightsChanged: false,
      objectiveReviewAlignmentClaimed: false,
    },
    frozenReviewBoundary: {
      formalMachineReviewRemainsAuthoritative: true,
      thresholdsChanged: false,
      failedPreviewPixelsUsedAsTrainingTarget: false,
      machineReviewResultsUsedAsTrainingTarget: false,
    },
    checkpointBoundary: {
      parentDenoiserCheckpoint: null,
      sourceSmokeCheckpointReadAllowed: false,
      historicalCheckpointReadAllowed: false,
      failedCheckpointReadAllowed: false,
      checkpointWeightsReadByCompilation: false,
      checkpointPromotionAllowed: false,
    },
    retryBoundary: {
      sameThirtyStepSmokeRerunAllowed: false,
      automaticRetryAllowed: false,
      onlyNextExecutionKind: "joint_condition_local_transport_24_epoch_full_data_screen",
    },
    activationGates: {
      gpuNow: false,
      optimizerNow: false,
      backwardNow: false,
      weightModificationNow: false,
      trainingNow: false,
      fullDataScreenNow: false,
      stage0Now: false,
      inferenceNow: false,
      checkpointPromotionNow: false,
      runtimeFrameNow: false,
      worldEntryNow: false,
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    activationAuthorized: false,
  }
}

export function sameJson(left, right) {
  return same(left, right)
}
