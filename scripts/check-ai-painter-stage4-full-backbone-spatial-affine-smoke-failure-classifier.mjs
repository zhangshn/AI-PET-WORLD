import assert from "node:assert/strict"

import {
  CLASSIFICATION,
  NEXT_LEGAL_ACTION,
  PERSISTENT_FAILURES,
  classifyFullBackboneSpatialAffineSmokeFailure,
} from "./lib/ai-painter-stage4-full-backbone-spatial-affine-smoke-failure-classifier-v1.mjs"

const valid = () => ({
  terminal: {
    executionState: "completed",
    status: "stage4_full_backbone_spatial_affine_controlled_smoke_real_visual_failure",
    capabilityVersion: "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1",
    checkpointPromotable: false,
    modelWeightsModified: true,
    trainingStarted: true,
    automaticRetryStarted: false,
    stage0Started: false,
  },
  trainingProgress: {
    status: "completed",
    currentEpoch: 30,
    currentStage: "completed",
    liveProgress: {
      epoch: 30,
      epochTarget: 30,
      optimizerStep: 30,
      optimizerStepTarget: 30,
      percentage: 100,
    },
    formalInferenceEligible: false,
    metrics: [
      { epoch: 1, trainCompositeLoss: 4.087, validationFixedGridCompositeConditionQualityScore: 3.483 },
      { epoch: 30, trainCompositeLoss: 2.698, validationFixedGridCompositeConditionQualityScore: 2.847 },
    ],
  },
  trainingManifest: {
    modelStateHashEvidence: {
      weightsChanged: true,
      initialDenoiserStateSha256: "a".repeat(64),
      finalDenoiserStateSha256: "b".repeat(64),
    },
    formalInferenceEligible: false,
  },
  machineReview: {
    status: "machine_reviews_failed",
    completedReviewCount: 5,
    targetReviewCount: 5,
    previewPassCount: 0,
    previewFailCount: 5,
    reviewThresholdsChanged: false,
    failedPreviewPixelsUsedAsTrainingTarget: false,
    machineReviewResultsUsedAsTrainingTarget: false,
    reviews: [1, 5, 10, 20, 30].map((epoch, index) => ({
      epoch,
      passed: false,
      byteExactReproduced: true,
      previewSha256: "c".repeat(64),
      reproductionSha256: "c".repeat(64),
      professionalAesthetic: { passed: true },
      issueCodes: index === 0 ? [...PERSISTENT_FAILURES, "a", "b", "c"] : [...PERSISTENT_FAILURES],
      conditionAlignment: index === 4 ? {
        channelAudits: [
          { channelId: "terrain_water", passed: true },
          {
            channelId: "terrain_path_ground",
            passed: false,
            boundaryContactAudit: { unexpectedContactSides: ["south"] },
          },
        ],
        objectSemanticAudits: ["footprints", "tree", "rock", "vegetation"].map((name) => ({
          channelId: `object_${name}`,
          localResponsePassed: true,
          passed: false,
          priorAcceptanceThresholdChanged: false,
          referenceThresholds: { minimumMaskedLumaCorrelation: 0.08 },
          referenceResponse: { maskedLumaCorrelation: 0.02 },
        })),
      } : {},
    })),
  },
  lateQualification: {
    status: "late_stability_not_qualified",
    lateEpochs: [10, 20, 30].map((epoch) => ({ epoch, failureCount: 5, failureItems: [...PERSISTENT_FAILURES] })),
    sustainedZeroFromFirstLateEpoch: false,
    strictDecreaseThenStableZero: false,
    consecutiveTerminalPasses: false,
    noTerminalRegression: true,
    conditionAndObjectEvidencePassed: false,
    finalPreviewByteReproductionValid: true,
    qualified: false,
    thresholdsChanged: false,
  },
  gpuReport: { status: "passed", conditionChannels: 23, latentChannels: 12 },
  gradientEvidence: {
    status: "passed",
    samples: ["train", "validation"].map(() => ({
      conditionGradient: { all23ChannelsFiniteNonzero: true },
      affineParameterTensorCount: 24,
      affineParameterObjectIdentityCount: 24,
      affineParameterCount: 745472,
      affineParameterGradients: Array.from({ length: 24 }, () => ({ finite: true, nonzero: true })),
    })),
  },
  priorAxisAudit: {
    universeBoundary: "only_the_three_axes_recorded_by_the_bound_source_causal_decision",
    doesNotClaimAllMathematicallyPossibleArchitecturesAreExhausted: true,
    axes: [
      { axis: "final_output_condition_modulation", disposition: "formally_covered_and_failed_not_a_new_candidate" },
      { axis: "per_class_isolated_semantic_representation", disposition: "formally_implemented_qualified_trained_and_failed_no_unique_successor" },
      { axis: "whole_backbone_spatial_affine_modulation", disposition: "unique_untried_mechanically_derived_bounded_successor_axis" },
    ],
  },
  priorAxisDecision: { selectedDecision: "full_backbone_spatial_affine_is_unique_bounded_successor_axis" },
})

const result = classifyFullBackboneSpatialAffineSmokeFailure(valid())
assert.equal(result.classification, CLASSIFICATION)
assert.equal(result.nextLegalAction, NEXT_LEGAL_ACTION)
assert.equal(result.scope.boundedThreeAxisUniverseExhausted, true)
assert.equal(result.scope.allMathematicallyPossibleArchitecturesExhaustedClaimed, false)

const negativeCases = [
  ["promotable checkpoint", (x) => { x.terminal.checkpointPromotable = true }],
  ["incomplete optimizer", (x) => { x.trainingProgress.liveProgress.optimizerStep = 29 }],
  ["weights unchanged", (x) => { x.trainingManifest.modelStateHashEvidence.weightsChanged = false }],
  ["review threshold changed", (x) => { x.machineReview.reviewThresholdsChanged = true }],
  ["review bytes mismatch", (x) => { x.machineReview.reviews[2].reproductionSha256 = "d".repeat(64) }],
  ["professional review failed", (x) => { x.machineReview.reviews[3].professionalAesthetic.passed = false }],
  ["late issue missing", (x) => { x.lateQualification.lateEpochs[1].failureItems.pop() }],
  ["terminal regression", (x) => { x.lateQualification.noTerminalRegression = false }],
  ["condition gradient absent", (x) => { x.gradientEvidence.samples[0].conditionGradient.all23ChannelsFiniteNonzero = false }],
  ["affine gradient zero", (x) => { x.gradientEvidence.samples[1].affineParameterGradients[4].nonzero = false }],
  ["object local response absent", (x) => { x.machineReview.reviews[4].conditionAlignment.objectSemanticAudits[0].localResponsePassed = false }],
  ["object threshold changed", (x) => { x.machineReview.reviews[4].conditionAlignment.objectSemanticAudits[1].priorAcceptanceThresholdChanged = true }],
  ["bounded axis universe replaced", (x) => { x.priorAxisAudit.universeBoundary = "all_possible_architectures" }],
  ["global exhaustion overclaim", (x) => { x.priorAxisAudit.doesNotClaimAllMathematicallyPossibleArchitecturesAreExhausted = false }],
]

for (const [name, mutate] of negativeCases) {
  const fixture = valid()
  mutate(fixture)
  assert.throws(() => classifyFullBackboneSpatialAffineSmokeFailure(fixture), undefined, name)
}

process.stdout.write(`${JSON.stringify({
  status: "passed",
  positiveCases: 1,
  negativeCases: negativeCases.length,
  totalCases: 1 + negativeCases.length,
  classification: result.classification,
  nextLegalAction: result.nextLegalAction,
}, null, 2)}\n`)
