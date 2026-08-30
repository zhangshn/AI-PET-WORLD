import assert from "node:assert/strict"

export const CAPABILITY_VERSION = "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
export const CLASSIFICATION = "full_backbone_spatial_affine_frozen_smoke_capability_insufficient_confirmed"
export const AXIS_DISPOSITION = "bounded_three_axis_universe_exhausted_without_stage0_qualified_candidate"
export const NEXT_LEGAL_ACTION = "design_stage4_new_bounded_model_family_outside_exhausted_three_axis_universe"
export const REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30])
export const LATE_EPOCHS = Object.freeze([10, 20, 30])
export const OBJECT_CLASSES = Object.freeze(["footprints", "tree", "rock", "vegetation"])
export const PERSISTENT_FAILURES = Object.freeze([
  ...OBJECT_CLASSES.map((name) => `condition_object_${name}_reference_semantic_mismatch`),
  "condition_terrain_path_ground_uncontracted_boundary_contact",
].sort())

export function classifyFullBackboneSpatialAffineSmokeFailure(evidence) {
  assert.equal(evidence?.terminal?.executionState, "completed")
  assert.equal(
    evidence.terminal.status,
    "stage4_full_backbone_spatial_affine_controlled_smoke_real_visual_failure",
  )
  assert.equal(evidence.terminal.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(evidence.terminal.checkpointPromotable, false)
  assert.equal(evidence.terminal.modelWeightsModified, true)
  assert.equal(evidence.terminal.trainingStarted, true)
  assert.equal(evidence.terminal.automaticRetryStarted, false)
  assert.equal(evidence.terminal.stage0Started, false)

  const progress = evidence.trainingProgress
  assert.equal(progress.status, "completed")
  assert.equal(progress.currentEpoch, 30)
  assert.equal(progress.currentStage, "completed")
  assert.equal(progress.liveProgress?.epoch, 30)
  assert.equal(progress.liveProgress?.epochTarget, 30)
  assert.equal(progress.liveProgress?.optimizerStep, 30)
  assert.equal(progress.liveProgress?.optimizerStepTarget, 30)
  assert.equal(progress.liveProgress?.percentage, 100)
  assert.equal(progress.formalInferenceEligible, false)
  assert.ok(Array.isArray(progress.metrics) && progress.metrics.length >= 2)
  const firstMetric = progress.metrics[0]
  const finalMetric = progress.metrics.at(-1)
  assert.equal(firstMetric.epoch, 1)
  assert.equal(finalMetric.epoch, 30)
  assert.ok(finalMetric.trainCompositeLoss < firstMetric.trainCompositeLoss)
  assert.ok(
    finalMetric.validationFixedGridCompositeConditionQualityScore
      < firstMetric.validationFixedGridCompositeConditionQualityScore,
  )

  assert.equal(evidence.trainingManifest?.modelStateHashEvidence?.weightsChanged, true)
  assert.notEqual(
    evidence.trainingManifest.modelStateHashEvidence.initialDenoiserStateSha256,
    evidence.trainingManifest.modelStateHashEvidence.finalDenoiserStateSha256,
  )
  assert.equal(evidence.trainingManifest.formalInferenceEligible, false)

  const review = evidence.machineReview
  assert.equal(review.status, "machine_reviews_failed")
  assert.equal(review.completedReviewCount, 5)
  assert.equal(review.targetReviewCount, 5)
  assert.equal(review.previewPassCount, 0)
  assert.equal(review.previewFailCount, 5)
  assert.equal(review.reviewThresholdsChanged, false)
  assert.equal(review.failedPreviewPixelsUsedAsTrainingTarget, false)
  assert.equal(review.machineReviewResultsUsedAsTrainingTarget, false)
  assert.deepEqual(review.reviews.map((row) => row.epoch), REVIEW_EPOCHS)
  assert.deepEqual(review.reviews.map((row) => row.issueCodes.length), [8, 5, 5, 5, 5])
  for (const row of review.reviews) {
    assert.equal(row.passed, false)
    assert.equal(row.byteExactReproduced, true)
    assert.equal(row.previewSha256, row.reproductionSha256)
    assert.equal(row.professionalAesthetic?.passed, true)
  }
  for (const row of review.reviews.slice(1)) {
    assert.deepEqual([...row.issueCodes].sort(), PERSISTENT_FAILURES)
  }

  const finalReview = review.reviews.at(-1)
  const water = finalReview.conditionAlignment?.channelAudits?.find((item) => item.channelId === "terrain_water")
  const route = finalReview.conditionAlignment?.channelAudits?.find((item) => item.channelId === "terrain_path_ground")
  assert.equal(water?.passed, true)
  assert.equal(route?.passed, false)
  assert.deepEqual(route.boundaryContactAudit?.unexpectedContactSides, ["south"])
  const finalObjectCorrelations = {}
  for (const objectClass of OBJECT_CLASSES) {
    const audit = finalReview.conditionAlignment?.objectSemanticAudits?.find(
      (item) => item.channelId === `object_${objectClass}`,
    )
    assert.equal(audit?.localResponsePassed, true)
    assert.equal(audit?.passed, false)
    assert.equal(audit?.priorAcceptanceThresholdChanged, false)
    assert.equal(audit?.referenceThresholds?.minimumMaskedLumaCorrelation, 0.08)
    const correlation = audit?.referenceResponse?.maskedLumaCorrelation
    assert.ok(Number.isFinite(correlation) && correlation < 0.08)
    finalObjectCorrelations[objectClass] = correlation
  }

  const late = evidence.lateQualification
  assert.equal(late.status, "late_stability_not_qualified")
  assert.deepEqual(late.lateEpochs.map((row) => row.epoch), LATE_EPOCHS)
  assert.deepEqual(late.lateEpochs.map((row) => row.failureCount), [5, 5, 5])
  for (const row of late.lateEpochs) assert.deepEqual([...row.failureItems].sort(), PERSISTENT_FAILURES)
  assert.equal(late.sustainedZeroFromFirstLateEpoch, false)
  assert.equal(late.strictDecreaseThenStableZero, false)
  assert.equal(late.consecutiveTerminalPasses, false)
  assert.equal(late.noTerminalRegression, true)
  assert.equal(late.conditionAndObjectEvidencePassed, false)
  assert.equal(late.finalPreviewByteReproductionValid, true)
  assert.equal(late.qualified, false)
  assert.equal(late.thresholdsChanged, false)

  assert.equal(evidence.gpuReport?.status, "passed")
  assert.equal(evidence.gpuReport.conditionChannels, 23)
  assert.equal(evidence.gpuReport.latentChannels, 12)
  assert.equal(evidence.gradientEvidence?.status, "passed")
  assert.equal(evidence.gradientEvidence.samples.length, 2)
  for (const sample of evidence.gradientEvidence.samples) {
    assert.equal(sample.conditionGradient?.all23ChannelsFiniteNonzero, true)
    assert.equal(sample.affineParameterTensorCount, 24)
    assert.equal(sample.affineParameterObjectIdentityCount, 24)
    assert.equal(sample.affineParameterCount, 745472)
    assert.equal(sample.affineParameterGradients.length, 24)
    assert.ok(sample.affineParameterGradients.every((row) => row.finite === true && row.nonzero === true))
  }

  const axes = evidence.priorAxisAudit
  assert.equal(
    axes?.universeBoundary,
    "only_the_three_axes_recorded_by_the_bound_source_causal_decision",
  )
  assert.equal(axes.doesNotClaimAllMathematicallyPossibleArchitecturesAreExhausted, true)
  assert.deepEqual(
    axes.axes.map((row) => row.axis),
    [
      "final_output_condition_modulation",
      "per_class_isolated_semantic_representation",
      "whole_backbone_spatial_affine_modulation",
    ],
  )
  assert.equal(
    axes.axes[0].disposition,
    "formally_covered_and_failed_not_a_new_candidate",
  )
  assert.equal(
    axes.axes[1].disposition,
    "formally_implemented_qualified_trained_and_failed_no_unique_successor",
  )
  assert.equal(
    axes.axes[2].disposition,
    "unique_untried_mechanically_derived_bounded_successor_axis",
  )
  assert.equal(
    evidence.priorAxisDecision?.selectedDecision,
    "full_backbone_spatial_affine_is_unique_bounded_successor_axis",
  )

  return {
    classification: CLASSIFICATION,
    axisDisposition: AXIS_DISPOSITION,
    nextLegalAction: NEXT_LEGAL_ACTION,
    executionWiringDefectConfirmed: false,
    dataOrReviewIdentityDefectConfirmed: false,
    checkpointOrTerminalIdentityDefectConfirmed: false,
    finalCoordinationRegressionConfirmed: false,
    frozenSmokeCapabilityInsufficientConfirmed: true,
    trainingWasEffectiveButInsufficient: true,
    finalObjectCorrelations,
    persistentLateFailures: PERSISTENT_FAILURES,
    scope: {
      appliesTo: "frozen_30_step_single_validation_sample_controlled_smoke_contract",
      globalArchitecturalImpossibilityClaimed: false,
      allMathematicallyPossibleArchitecturesExhaustedClaimed: false,
      boundedThreeAxisUniverseExhausted: true,
    },
  }
}
