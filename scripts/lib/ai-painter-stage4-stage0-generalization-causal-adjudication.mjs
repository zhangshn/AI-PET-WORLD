import assert from "node:assert/strict"

export const SMOKE_EPOCHS = Object.freeze([1, 5, 10, 20, 30])
export const STAGE0_REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30, 40])
export const REAL_FAILURE_OBJECT_CHANNELS = Object.freeze([
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
])
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

function exactBinding(actual, expected) {
  return actual?.path === expected?.path && actual?.sha256 === expected?.sha256
}

function collectRealFailureContract(input) {
  const {
    expectedRunId,
    sourceEvidence,
    stage0Terminal,
    stage0Manifest,
    stage0Review,
    previewBindings,
  } = input
  const terminalEpochs = stage0Review.reviews?.map((row) => row.epoch) ?? []
  const terminalReview = stage0Review.reviews?.at(-1)
  const terminalObjects = Object.fromEntries((terminalReview?.conditionAlignment?.objectSemanticAudits ?? [])
    .filter((row) => REAL_FAILURE_OBJECT_CHANNELS.includes(row.channelId))
    .map((row) => [row.channelId, row]))
  const bindingChecks = {
    terminal_run_identity: stage0Terminal.runId === expectedRunId,
    review_run_identity: stage0Review.runId === expectedRunId,
    terminal_manifest_binding: exactBinding(stage0Terminal.manifest, sourceEvidence.stage0Manifest),
    terminal_review_binding: exactBinding(stage0Terminal.machineReview, sourceEvidence.stage0MachineReview),
    terminal_checkpoint_binding: exactBinding(stage0Terminal.checkpoint, sourceEvidence.failedCheckpointIdentityOnly),
    manifest_checkpoint_binding: stage0Manifest.checkpointPath === sourceEvidence.failedCheckpointIdentityOnly.path
      && stage0Manifest.checkpointSha256 === sourceEvidence.failedCheckpointIdentityOnly.sha256,
    preview_count_and_hash_binding: Array.isArray(previewBindings)
      && previewBindings.length === STAGE0_REVIEW_EPOCHS.length
      && previewBindings.every((row) => row.previewManifestMatch === true
        && row.normalizedManifestMatch === true
        && row.reproductionByteMatch === true),
    checkpoint_bound_terminal_reproduction: stage0Manifest.stage4UnifiedTrainingPreviewSampling?.previewSha256Matches === true
      && stage0Manifest.stage4UnifiedTrainingPreviewSampling?.denoiserStateIdentityMatches === true,
  }
  const auditContractChecks = {
    exact_review_epochs: JSON.stringify(terminalEpochs) === JSON.stringify(STAGE0_REVIEW_EPOCHS),
    thresholds_unchanged: stage0Review.reviewThresholdsChanged === false,
    review_counts_consistent: stage0Review.previewCount === 6
      && stage0Review.previewPassCount === 0
      && stage0Review.previewFailCount === 6,
    professional_aesthetic_contract_present: stage0Review.reviews?.every((row) => (
      row.professionalAesthetic?.schemaVersion === "ai-assisted-professional-aesthetic-audit-v2"
      && row.professionalAesthetic?.passed === true
    )) === true,
    condition_alignment_contract_present: stage0Review.reviews?.every((row) => (
      row.conditionAlignment?.schemaVersion === "ai-assisted-condition-alignment-audit-v1"
      && row.conditionAlignment?.passed === false
    )) === true,
    object_thresholds_unchanged: stage0Review.reviews?.every((row) => (
      row.conditionAlignment?.objectSemanticAudits
        ?.filter((item) => REAL_FAILURE_OBJECT_CHANNELS.includes(item.channelId))
        .every((item) => item.priorAcceptanceThresholdChanged === false)
    )) === true,
  }
  const modelFailureChecks = {
    formal_stage_failed_closed: stage0Terminal.status === "semantic_mixture_stage4_formal_stage_failed_closed"
      && stage0Terminal.stage === 0
      && JSON.stringify(stage0Terminal.blockers) === JSON.stringify(["stage_0_visual_review_failed_0_of_6"]),
    weights_changed: stage0Manifest.modelStateHashEvidence?.weightsChanged === true,
    forty_epochs_recorded: stage0Manifest.metrics?.some((row) => row.epoch === 40) === true,
    all_fixed_previews_failed: stage0Review.reviews?.every((row) => row.passed === false) === true,
    terminal_water_passed: terminalReview?.conditionAlignment?.channelAudits
      ?.find((row) => row.channelId === "terrain_water")?.passed === true,
    terminal_path_passed: terminalReview?.conditionAlignment?.channelAudits
      ?.find((row) => row.channelId === "terrain_path_ground")?.passed === true,
    terminal_four_object_semantics_failed: REAL_FAILURE_OBJECT_CHANNELS.every((channelId) => (
      terminalObjects[channelId]?.passed === false
      && terminalObjects[channelId]?.localResponsePassed === true
      && terminalObjects[channelId]?.referenceResponse?.maskedLumaCorrelation
        < terminalObjects[channelId]?.referenceThresholds?.minimumMaskedLumaCorrelation
    )),
  }
  return { bindingChecks, auditContractChecks, modelFailureChecks, terminalObjects }
}

export function adjudicateStage0RealFailure(input) {
  const contract = collectRealFailureContract(input)
  const bindingPassed = Object.values(contract.bindingChecks).every(Boolean)
  const auditContractPassed = Object.values(contract.auditContractChecks).every(Boolean)
  const modelFailurePassed = Object.values(contract.modelFailureChecks).every(Boolean)
  const classification = !bindingPassed
    ? "evidence_binding_error"
    : !auditContractPassed
      ? "audit_program_or_contract_error"
      : modelFailurePassed
        ? "real_model_visual_failure"
        : "insufficient_evidence_for_failure_classification"
  const terminalObjectMetrics = Object.fromEntries(REAL_FAILURE_OBJECT_CHANNELS.map((channelId) => {
    const row = contract.terminalObjects[channelId]
    return [channelId, row ? {
      localResponsePassed: row.localResponsePassed,
      maskedRgbMae: row.referenceResponse?.maskedRgbMae,
      maximumMaskedRgbMae: row.referenceThresholds?.maximumMaskedRgbMae,
      maskedEdgeMae: row.referenceResponse?.maskedEdgeMae,
      maximumMaskedEdgeMae: row.referenceThresholds?.maximumMaskedEdgeMae,
      maskedLumaCorrelation: row.referenceResponse?.maskedLumaCorrelation,
      minimumMaskedLumaCorrelation: row.referenceThresholds?.minimumMaskedLumaCorrelation,
    } : null]
  }))
  return {
    schemaVersion: "ai-painter-stage4-semantic-mixture-real-failure-adjudication-v1",
    status: classification === "real_model_visual_failure"
      ? "stage0_real_model_visual_failure_confirmed"
      : "stage0_failure_classification_blocked",
    classification,
    bindingChecks: contract.bindingChecks,
    auditContractChecks: contract.auditContractChecks,
    modelFailureChecks: contract.modelFailureChecks,
    terminalObjectMetrics,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    nextLegalAction: classification === "real_model_visual_failure"
      ? "owner_review_bounded_object_visible_structure_supervision_or_candidate_exit"
      : "owner_review_of_adjudication_blocker",
    automaticRetryAllowed: false,
    stage1EntryPermitted: false,
    stage2EntryPermitted: false,
  }
}
