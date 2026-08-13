import assert from "node:assert/strict"

export const SMOKE_EPOCHS = Object.freeze([1, 5, 10, 20, 30])
export const STAGE0_REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30, 40])
export const FINAL_VISIBLE_CLASSES = Object.freeze([
  "Route",
  "Footprints",
  "Tree",
  "Rock",
  "Vegetation",
])

const metricField = (prefix, name) => `${prefix}Stage4SemanticMixture${name}FinalTypedRgbMae`

function requireFinite(value, label) {
  assert.equal(Number.isFinite(value), true, `${label}_must_be_finite`)
  return value
}

function reviewTimeline(review, epochs) {
  assert.deepEqual(review.reviews?.map((row) => row.epoch), epochs)
  assert.equal(review.reviewThresholdsChanged, false)
  return review.reviews.map((row) => ({
    epoch: row.epoch,
    passed: row.passed === true,
    issueCodes: [...row.issueCodes],
  }))
}

function metricTimeline(manifest, epochs) {
  assert.equal(manifest.metrics?.length >= epochs.length, true)
  const rows = epochs.map((epoch) => manifest.metrics.find((row) => row.epoch === epoch))
  assert.equal(rows.every(Boolean), true, "required_metric_epoch_missing")
  return rows.map((row) => ({
    epoch: row.epoch,
    trainCompositeLoss: requireFinite(row.trainCompositeLoss, `epoch_${row.epoch}_train_composite_loss`),
    validationCompositeScore: requireFinite(
      row.validationFixedGridCompositeConditionQualityScore,
      `epoch_${row.epoch}_validation_composite_score`,
    ),
    checkpointSelectionScore: requireFinite(
      row.validationCheckpointSelectionScore,
      `epoch_${row.epoch}_checkpoint_selection_score`,
    ),
    trainFinalVisibleRgb: Object.fromEntries(FINAL_VISIBLE_CLASSES.map((name) => [
      name.toLowerCase(),
      requireFinite(row[metricField("train", name)], `epoch_${row.epoch}_train_${name}`),
    ])),
    validationFinalVisibleRgb: Object.fromEntries(FINAL_VISIBLE_CLASSES.map((name) => [
      name.toLowerCase(),
      requireFinite(row[metricField("validationFixedGrid", name)], `epoch_${row.epoch}_validation_${name}`),
    ])),
    validationRolloutPathInteriorRgbMae: requireFinite(
      row.validationRolloutPathInteriorRgbMae,
      `epoch_${row.epoch}_rollout_path_interior`,
    ),
    validationRolloutPathBoundaryRgbMae: requireFinite(
      row.validationRolloutPathBoundaryRgbMae,
      `epoch_${row.epoch}_rollout_path_boundary`,
    ),
    validationRolloutObjectSemanticRgbMae: requireFinite(
      row.validationRolloutObjectSemanticRgbMae,
      `epoch_${row.epoch}_rollout_object_semantic`,
    ),
  }))
}

export function validateBoundGeneralizationEvidence(input) {
  const { smokeQualification, smokeManifest, smokeReview, stage0Terminal, stage0Manifest, stage0Review } = input
  assert.equal(smokeQualification.status, "terminal_pass_with_late_convergence_evidence_qualified_closed")
  assert.equal(smokeQualification.stage0EntryPermitted, true)
  assert.equal(smokeManifest.status, "conditional_denoiser_single_sample_overfit_smoke_completed")
  assert.equal(smokeManifest.singleSampleOverfitSmoke?.enabled, true)
  assert.equal(smokeManifest.singleSampleOverfitSmoke?.selectedSplit, "validation")
  assert.equal(smokeManifest.singleSampleOverfitSmoke?.sampleId, "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6")
  assert.equal(smokeManifest.modelStateHashEvidence?.weightsChanged, true)
  assert.equal(smokeManifest.stage4UnifiedTrainingPreviewSampling?.previewSha256Matches, true)
  assert.equal(smokeManifest.stage4UnifiedTrainingPreviewSampling?.denoiserStateIdentityMatches, true)
  reviewTimeline(smokeReview, SMOKE_EPOCHS)
  assert.equal(smokeReview.reviews.at(-1).passed, true)
  assert.deepEqual(smokeReview.reviews.at(-1).issueCodes, [])

  assert.equal(stage0Terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed")
  assert.equal(stage0Terminal.stage, 0)
  assert.deepEqual(stage0Terminal.blockers, ["stage_0_visual_review_failed_0_of_6"])
  assert.equal(stage0Manifest.status, "conditional_denoiser_training_completed_pending_validation")
  assert.equal(stage0Manifest.singleSampleOverfitSmoke?.enabled, false)
  assert.equal(stage0Manifest.actualLoadedSplitCounts?.train, 48)
  assert.equal(stage0Manifest.actualLoadedSplitCounts?.validation, 8)
  assert.equal(stage0Manifest.actualLoadedSplitCounts?.challenge, 4)
  assert.equal(stage0Manifest.actualLoadedSplitCounts?.regression, 4)
  assert.equal(stage0Manifest.modelStateHashEvidence?.weightsChanged, true)
  assert.equal(stage0Manifest.stage4UnifiedTrainingPreviewSampling?.previewSha256Matches, true)
  assert.equal(stage0Manifest.stage4UnifiedTrainingPreviewSampling?.denoiserStateIdentityMatches, true)
  const stageReviews = reviewTimeline(stage0Review, STAGE0_REVIEW_EPOCHS)
  assert.equal(stageReviews.every((row) => row.passed === false), true)
  assert.equal(stageReviews.every((row) => row.issueCodes.length > 0), true)
  metricTimeline(smokeManifest, SMOKE_EPOCHS)
  metricTimeline(stage0Manifest, STAGE0_REVIEW_EPOCHS)
  return true
}

function decreased(first, last) {
  return Number.isFinite(first) && Number.isFinite(last) && last < first
}

export function adjudicateStage0GeneralizationFailure(input) {
  validateBoundGeneralizationEvidence(input)
  const smokeMetrics = metricTimeline(input.smokeManifest, SMOKE_EPOCHS)
  const stage0Metrics = metricTimeline(input.stage0Manifest, STAGE0_REVIEW_EPOCHS)
  const smokeReviews = reviewTimeline(input.smokeReview, SMOKE_EPOCHS)
  const stage0Reviews = reviewTimeline(input.stage0Review, STAGE0_REVIEW_EPOCHS)
  const stage0First = stage0Metrics[0]
  const stage0Last = stage0Metrics.at(-1)

  const allTrainClassLossesImprove = FINAL_VISIBLE_CLASSES.every((name) => decreased(
    stage0First.trainFinalVisibleRgb[name.toLowerCase()],
    stage0Last.trainFinalVisibleRgb[name.toLowerCase()],
  ))
  const validationObjectSemanticImproves = decreased(
    stage0First.validationRolloutObjectSemanticRgbMae,
    stage0Last.validationRolloutObjectSemanticRgbMae,
  )
  const validationCompositeImproves = decreased(
    stage0First.validationCompositeScore,
    stage0Last.validationCompositeScore,
  )
  const visualQualificationNeverPasses = stage0Reviews.every((row) => row.passed === false)
  const terminalVisibleSemanticFailures = stage0Reviews.at(-1).issueCodes.filter((code) => (
    code.includes("terrain_") || code.includes("object_")
  ))
  const everyClassStillFailsAtTerminal = ["footprints", "tree", "rock", "vegetation"].every((name) => (
    stage0Reviews.at(-1).issueCodes.includes(`condition_object_${name}_reference_semantic_mismatch`)
  ))
  const noReviewedAlternativeCheckpointPasses = stage0Reviews.every((row) => row.passed === false)
  const checkpointSelectionIsNonMonotonic = stage0Metrics.some((row, index) => (
    index > 0 && row.checkpointSelectionScore > stage0Metrics[index - 1].checkpointSelectionScore
  ))
  const hasDirectGradientConflictEvidence = input.directGradientConflictEvidence === true
  const hasPerSampleGradientEvidence = input.perSampleGradientEvidence === true

  const evidence = {
    smokeTerminalPass: smokeReviews.at(-1).passed === true,
    smokeTerminalIssueCount: smokeReviews.at(-1).issueCodes.length,
    stage0VisualQualificationNeverPasses: visualQualificationNeverPasses,
    stage0ReviewedCheckpointPassCount: stage0Reviews.filter((row) => row.passed).length,
    noReviewedAlternativeCheckpointPasses,
    allTrainClassLossesImprove,
    validationObjectSemanticImproves,
    validationCompositeImproves,
    everyClassStillFailsAtTerminal,
    terminalVisibleSemanticFailures,
    checkpointSelectionIsNonMonotonic,
    directGradientConflictEvidence: hasDirectGradientConflictEvidence,
    perSampleGradientEvidence: hasPerSampleGradientEvidence,
  }

  const alternatives = {
    A: {
      status: "not_confirmed",
      reason: "The evidence contains multi-sample metric oscillation, but no per-sample or per-class gradient conflict measurement. Interference cannot be asserted from aggregate loss alone.",
    },
    B: {
      status: "secondary_gap_not_unique_root_cause",
      reason: "Checkpoint selection is non-monotonic, but all six reviewed Stage 0 checkpoints fail. A different already-reviewed checkpoint cannot close the visual gate.",
    },
    C: {
      status: "confirmed",
      reason: "All five train-side final-visible RGB obligations and aggregate validation measures improve while every reviewed Stage 0 preview fails and all four object semantics still fail at Epoch 40. The current objective does not sufficiently constrain visible spatial-semantic correctness over the full data distribution.",
    },
    D: {
      status: "not_selected",
      reason: "The bound manifests and reviews provide a complete executable contrast between a passing single-sample terminal and a failing 48-sample Stage 0 trajectory.",
    },
  }
  assert.equal(allTrainClassLossesImprove, true)
  assert.equal(validationObjectSemanticImproves, true)
  assert.equal(validationCompositeImproves, true)
  assert.equal(visualQualificationNeverPasses, true)
  assert.equal(everyClassStillFailsAtTerminal, true)
  assert.equal(hasDirectGradientConflictEvidence, false)
  assert.equal(hasPerSampleGradientEvidence, false)
  return {
    schemaVersion: "ai-painter-stage4-stage0-generalization-causal-adjudication-v1",
    status: "C_training_objective_insufficient_over_full_data_distribution_confirmed",
    selectedCause: "C",
    alternatives,
    evidence,
    smokeTimeline: smokeMetrics,
    stage0Timeline: stage0Metrics,
    smokeReviewTimeline: smokeReviews,
    stage0ReviewTimeline: stage0Reviews,
    nextContractId: "stage4_distribution_aware_visible_spatial_semantic_obligation_v1",
  }
}
