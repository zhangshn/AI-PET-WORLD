import assert from "node:assert/strict"

import {
  CANDIDATE_CAPABILITY,
  DESIGN_DECISION,
  NEXT_LEGAL_ACTION,
  deriveJointConditionLocalTransportDesign,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-design-v1.mjs"

const baseline = Object.freeze({
  evidence: {
    sourceClassification:
      "full_backbone_spatial_affine_frozen_smoke_capability_insufficient_confirmed",
    sourceCandidateDisposition: "rejected_failed_closed",
    boundedThreeAxisUniverseExhausted: true,
    allMathematicalArchitecturesExhausted: false,
    routeCounterfactualRetired: true,
    routeCounterfactualSmokePassCount: 0,
    routeCounterfactualFixed40PassCount: 0,
  },
  nonDuplicationAudit: {
    candidateSignaturePreviouslyRegistered: false,
    candidateOperatorSourceHits: 0,
    counterfactualHardOwnershipEquivalent: false,
    finalOutputModulationEquivalent: false,
    perClassIsolationEquivalent: false,
    spatialAffineEquivalent: false,
    fixedConvolutionEquivalent: false,
    renamedRetiredRouteAllowed: false,
  },
  modelBoundary: {
    conditionChannels: 23,
    latentChannels: 12,
    timeEmbeddingChannels: 256,
    baseChannels: 64,
    widthHierarchy: [64, 128, 256],
    blocks: [
      { id: "block0", channels: 64, width: 64, height: 48 },
      { id: "block1", channels: 128, width: 32, height: 24 },
      { id: "middle1", channels: 256, width: 16, height: 12 },
      { id: "middle2", channels: 256, width: 16, height: 12 },
      { id: "up_block1", channels: 128, width: 32, height: 24 },
      { id: "up_block0", channels: 64, width: 64, height: 48 },
    ],
  },
  transportBoundary: {
    sitePlacement: "replace_group_norm_output_before_existing_silu_and_convolution",
    sitesPerBlock: 2,
    siteCount: 12,
    projectionInputChannels: 23,
    projectionOutputChannels: 9,
    kernelSize: 3,
    padding: 1,
    bias: true,
    featureChannelSharedStencil: true,
    siteProjectionSharingAllowed: false,
    neighborOrder: "row_major_top_left_to_bottom_right",
    neighborOffsets: [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 0], [0, 1],
      [1, -1], [1, 0], [1, 1],
    ],
    offCanvasPolicy: "mask_invalid_then_renormalize_valid_neighbors",
    zeroPaddingAllowed: false,
    circularPaddingAllowed: false,
    reflectionPaddingAllowed: false,
    softmaxAxis: "nine_neighbor_offsets",
    softmaxTemperature: 1,
    learnableTemperatureAllowed: false,
    residualTransportBlendAllowed: false,
    spatialAffineCoexistenceAllowed: false,
  },
  frozenBoundary: {
    datasetCount: 64,
    split: [48, 8, 4, 4],
    seed: 20263722,
    autoencoderFrozen: true,
    existingLossValuesAndWeightsUnchanged: true,
    conditionChannelOrderUnchanged: true,
    checkpointFormatUnchanged: true,
    machineReviewThresholdsUnchanged: true,
    failedCheckpointReadAllowed: false,
    failedCheckpointInitializationAllowed: false,
  },
  riskBoundary: {
    trainingObjectiveEqualsFormalReviewStatistic: false,
    auditAlignmentClaimed: false,
    topologyGuaranteeClaimed: false,
    objectSemanticGuaranteeClaimed: false,
    smokeSuccessGuaranteed: false,
    boundedFalsifiableHypothesisOnly: true,
  },
  freeParameterAudit: {
    freeParameterChosen: false,
    freeParameterFields: [],
    forbiddenFields: [
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
    ],
  },
})

const copy = () => JSON.parse(JSON.stringify(baseline))

const positive = deriveJointConditionLocalTransportDesign(copy())
assert.equal(positive.status, "uniquely_derived_inactive_bounded_hypothesis")
assert.equal(positive.candidateCapabilityVersion, CANDIDATE_CAPABILITY)
assert.equal(positive.decision, DESIGN_DECISION)
assert.equal(positive.nextLegalAction, NEXT_LEGAL_ACTION)
assert.equal(positive.siteCount, 12)
assert.equal(positive.parameterTensorCount, 24)
assert.equal(positive.parametersPerSite, 1872)
assert.equal(positive.parameterCount, 22464)
assert.equal(positive.netParameterChangeFromFailedAffine, -723008)
assert.equal(positive.candidateTotalParameters, 8329714)
assert.equal(positive.candidateDenoiserParameters, 5801827)
assert.equal(positive.activationBoundary.smokeReady, false)
assert.equal(positive.claimBoundary.globalMathematicalUniquenessClaimed, false)

const negativeMutations = [
  (value) => { value.evidence.routeCounterfactualRetired = false },
  (value) => { value.nonDuplicationAudit.candidateSignaturePreviouslyRegistered = true },
  (value) => { value.nonDuplicationAudit.counterfactualHardOwnershipEquivalent = true },
  (value) => { value.modelBoundary.conditionChannels = 24 },
  (value) => { value.modelBoundary.blocks[5].channels = 96 },
  (value) => { value.transportBoundary.siteCount = 10 },
  (value) => { value.transportBoundary.projectionOutputChannels = 18 },
  (value) => { value.transportBoundary.kernelSize = 5 },
  (value) => { value.transportBoundary.siteProjectionSharingAllowed = true },
  (value) => { value.transportBoundary.offCanvasPolicy = "zero_pad" },
  (value) => { value.transportBoundary.residualTransportBlendAllowed = true },
  (value) => { value.transportBoundary.spatialAffineCoexistenceAllowed = true },
  (value) => { value.frozenBoundary.existingLossValuesAndWeightsUnchanged = false },
  (value) => { value.riskBoundary.auditAlignmentClaimed = true },
  (value) => { value.riskBoundary.smokeSuccessGuaranteed = true },
  (value) => { value.freeParameterAudit.freeParameterChosen = true },
]

for (const mutate of negativeMutations) {
  const input = copy()
  mutate(input)
  assert.equal(
    deriveJointConditionLocalTransportDesign(input).status,
    "ineligible_failed_closed",
  )
}

process.stdout.write(`${JSON.stringify({
  status: "passed",
  positiveCases: 1,
  negativeCases: negativeMutations.length,
  totalCases: negativeMutations.length + 1,
  candidateCapabilityVersion: CANDIDATE_CAPABILITY,
  decision: DESIGN_DECISION,
  parameterCount: positive.parameterCount,
}, null, 2)}\n`)
