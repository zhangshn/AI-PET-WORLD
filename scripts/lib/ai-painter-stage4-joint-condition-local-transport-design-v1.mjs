export const CANDIDATE_CAPABILITY =
  "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"

export const CANDIDATE_AXIS = "joint_condition_local_spatial_transport"

export const DESIGN_DECISION =
  "joint_condition_local_transport_is_unique_bounded_non_repeated_hypothesis_under_current_evidence"

export const NEXT_LEGAL_ACTION =
  "implement_stage4_joint_condition_local_transport_cpu_inactive_support"

const BLOCK_LAYOUT = Object.freeze([
  Object.freeze({ id: "block0", channels: 64, width: 64, height: 48 }),
  Object.freeze({ id: "block1", channels: 128, width: 32, height: 24 }),
  Object.freeze({ id: "middle1", channels: 256, width: 16, height: 12 }),
  Object.freeze({ id: "middle2", channels: 256, width: 16, height: 12 }),
  Object.freeze({ id: "up_block1", channels: 128, width: 32, height: 24 }),
  Object.freeze({ id: "up_block0", channels: 64, width: 64, height: 48 }),
])

const ROW_MAJOR_OFFSETS = Object.freeze([
  Object.freeze([-1, -1]),
  Object.freeze([-1, 0]),
  Object.freeze([-1, 1]),
  Object.freeze([0, -1]),
  Object.freeze([0, 0]),
  Object.freeze([0, 1]),
  Object.freeze([1, -1]),
  Object.freeze([1, 0]),
  Object.freeze([1, 1]),
])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function evidencePasses(input) {
  return (
    input?.evidence?.sourceClassification
      === "full_backbone_spatial_affine_frozen_smoke_capability_insufficient_confirmed"
    && input.evidence.sourceCandidateDisposition === "rejected_failed_closed"
    && input.evidence.boundedThreeAxisUniverseExhausted === true
    && input.evidence.allMathematicalArchitecturesExhausted === false
    && input.evidence.routeCounterfactualRetired === true
    && input.evidence.routeCounterfactualSmokePassCount === 0
    && input.evidence.routeCounterfactualFixed40PassCount === 0
  )
}

function nonDuplicationPasses(input) {
  const audit = input?.nonDuplicationAudit
  return (
    audit?.candidateSignaturePreviouslyRegistered === false
    && audit.candidateOperatorSourceHits === 0
    && audit.counterfactualHardOwnershipEquivalent === false
    && audit.finalOutputModulationEquivalent === false
    && audit.perClassIsolationEquivalent === false
    && audit.spatialAffineEquivalent === false
    && audit.fixedConvolutionEquivalent === false
    && audit.renamedRetiredRouteAllowed === false
  )
}

function structurePasses(input) {
  const model = input?.modelBoundary
  const transport = input?.transportBoundary
  return (
    model?.conditionChannels === 23
    && model.latentChannels === 12
    && model.timeEmbeddingChannels === 256
    && model.baseChannels === 64
    && sameJson(model.widthHierarchy, [64, 128, 256])
    && sameJson(model.blocks, BLOCK_LAYOUT)
    && transport?.sitePlacement === "replace_group_norm_output_before_existing_silu_and_convolution"
    && transport.sitesPerBlock === 2
    && transport.siteCount === 12
    && transport.projectionInputChannels === 23
    && transport.projectionOutputChannels === 9
    && transport.kernelSize === 3
    && transport.padding === 1
    && transport.bias === true
    && transport.featureChannelSharedStencil === true
    && transport.siteProjectionSharingAllowed === false
    && transport.neighborOrder === "row_major_top_left_to_bottom_right"
    && sameJson(transport.neighborOffsets, ROW_MAJOR_OFFSETS)
    && transport.offCanvasPolicy === "mask_invalid_then_renormalize_valid_neighbors"
    && transport.zeroPaddingAllowed === false
    && transport.circularPaddingAllowed === false
    && transport.reflectionPaddingAllowed === false
    && transport.softmaxAxis === "nine_neighbor_offsets"
    && transport.softmaxTemperature === 1
    && transport.learnableTemperatureAllowed === false
    && transport.residualTransportBlendAllowed === false
    && transport.spatialAffineCoexistenceAllowed === false
  )
}

function frozenBoundaryPasses(input) {
  const frozen = input?.frozenBoundary
  return (
    frozen?.datasetCount === 64
    && sameJson(frozen.split, [48, 8, 4, 4])
    && frozen.seed === 20263722
    && frozen.autoencoderFrozen === true
    && frozen.existingLossValuesAndWeightsUnchanged === true
    && frozen.conditionChannelOrderUnchanged === true
    && frozen.checkpointFormatUnchanged === true
    && frozen.machineReviewThresholdsUnchanged === true
    && frozen.failedCheckpointReadAllowed === false
    && frozen.failedCheckpointInitializationAllowed === false
  )
}

function riskBoundaryPasses(input) {
  const risk = input?.riskBoundary
  return (
    risk?.trainingObjectiveEqualsFormalReviewStatistic === false
    && risk.auditAlignmentClaimed === false
    && risk.topologyGuaranteeClaimed === false
    && risk.objectSemanticGuaranteeClaimed === false
    && risk.smokeSuccessGuaranteed === false
    && risk.boundedFalsifiableHypothesisOnly === true
  )
}

function freeParameterBoundaryPasses(input) {
  return (
    input?.freeParameterAudit?.freeParameterChosen === false
    && sameJson(input.freeParameterAudit.freeParameterFields, [])
    && sameJson(input.freeParameterAudit.forbiddenFields, [
      "temperature",
      "gate",
      "head_count",
      "group_count",
      "hidden_width",
      "extra_depth",
      "per_class_branch",
      "output_residual",
      "counterfactual_render_branch",
      "new_loss_or_weight",
    ])
  )
}

export function deriveJointConditionLocalTransportDesign(input) {
  const checks = {
    failureEvidenceBound: evidencePasses(input),
    historyNonDuplicationVerified: nonDuplicationPasses(input),
    exactFrozenModelBoundary: structurePasses(input),
    frozenTrainingAndReviewBoundary: frozenBoundaryPasses(input),
    unresolvedObjectiveReviewRiskRecorded: riskBoundaryPasses(input),
    noFreeParameterChosen: freeParameterBoundaryPasses(input),
  }
  const eligible = Object.values(checks).every(Boolean)
  if (!eligible) {
    return {
      schemaVersion: "stage4-joint-condition-local-transport-derived-design-v1",
      status: "ineligible_failed_closed",
      candidateCapabilityVersion: CANDIDATE_CAPABILITY,
      candidateAxis: CANDIDATE_AXIS,
      checks,
      siteCount: 0,
      parameterTensorCount: 0,
      parameterCount: 0,
    }
  }

  const projectionInputChannels = input.transportBoundary.projectionInputChannels
  const projectionOutputChannels = input.transportBoundary.projectionOutputChannels
  const kernelSize = input.transportBoundary.kernelSize
  const siteCount = input.transportBoundary.siteCount
  const parametersPerSite = (
    projectionOutputChannels
    * projectionInputChannels
    * kernelSize
    * kernelSize
    + projectionOutputChannels
  )
  const parameterCount = parametersPerSite * siteCount
  const parameterTensorCount = siteCount * 2
  const removedSpatialAffineParameters = 745472
  const priorFullBackboneTotalParameters = 9052722
  const frozenAutoencoderParameters = 2527887
  const baselineWithoutAffineParameters = (
    priorFullBackboneTotalParameters - removedSpatialAffineParameters
  )
  const candidateTotalParameters = baselineWithoutAffineParameters + parameterCount
  const candidateDenoiserParameters = candidateTotalParameters - frozenAutoencoderParameters
  const netParameterChangeFromFailedAffine = parameterCount - removedSpatialAffineParameters
  const exactDerivedIdentity = (
    parametersPerSite === 1872
    && siteCount === 12
    && parameterTensorCount === 24
    && parameterCount === 22464
    && baselineWithoutAffineParameters === 8307250
    && candidateTotalParameters === 8329714
    && candidateDenoiserParameters === 5801827
    && netParameterChangeFromFailedAffine === -723008
  )

  return {
    schemaVersion: "stage4-joint-condition-local-transport-derived-design-v1",
    status: exactDerivedIdentity
      ? "uniquely_derived_inactive_bounded_hypothesis"
      : "ineligible_failed_closed",
    candidateCapabilityVersion: CANDIDATE_CAPABILITY,
    candidateAxis: CANDIDATE_AXIS,
    decision: exactDerivedIdentity ? DESIGN_DECISION : "pause_evidence_or_derivation_mismatch",
    checks: { ...checks, exactDerivedIdentity },
    operatorSignature: {
      placement: input.transportBoundary.sitePlacement,
      transportedValue: "normalized_backbone_feature_neighbor_values",
      conditionLogits: "joint_all_23_typed_condition_channels",
      support: "three_by_three_chebyshev_radius_one",
      neighborOffsets: clone(ROW_MAJOR_OFFSETS),
      normalization: "off_canvas_masked_softmax_temperature_one",
      featureChannelSharing: "one_stencil_shared_by_all_feature_channels_at_each_site",
      siteIdentity: "six_existing_time_residual_blocks_times_two_group_norm_sites",
      outputBoundary: "unchanged_12_channel_velocity",
    },
    blockLayout: clone(BLOCK_LAYOUT),
    siteCount,
    projectionCount: siteCount,
    parameterTensorCount,
    parametersPerSite,
    parameterCount,
    removedSpatialAffineParameters,
    netParameterChangeFromFailedAffine,
    priorFullBackboneTotalParameters,
    baselineWithoutAffineParameters,
    candidateTotalParameters,
    frozenAutoencoderParameters,
    candidateDenoiserParameters,
    resourceEstimate: {
      stage0LatentWidth: 64,
      stage0LatentHeight: 48,
      projectionMacsPerForward: 30053376,
      transportMacsPerForward: 12386304,
      totalAddedMacsPerForward: 42439680,
      explicitUnfoldFeaturePatchMiBPerForward: 47.25,
      newParameterStorageMiBFloat32: 0.086,
      readonlyGpuQualificationRequiresMeasuredTelemetry: true,
      smokeRequiresMeasuredTelemetry: true,
    },
    activationBoundary: {
      cpuDesignComplete: true,
      cpuImplementationAllowedNext: true,
      readonlyGpuQualified: false,
      smokeReady: false,
      stage0Ready: false,
      formalInferenceReady: false,
      runtimeFrameReady: false,
    },
    claimBoundary: {
      currentAuditedMechanismSetNonRepeated: true,
      globalMathematicalUniquenessClaimed: false,
      sufficientSemanticRepairClaimed: false,
      sufficientTopologyRepairClaimed: false,
      futureSmokeIsFalsificationNotProofByDesign: true,
    },
    nextLegalAction: NEXT_LEGAL_ACTION,
  }
}
