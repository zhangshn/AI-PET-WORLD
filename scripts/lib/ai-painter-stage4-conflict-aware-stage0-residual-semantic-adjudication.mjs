import assert from "node:assert/strict"

export const SOURCE_RUN_ID = "20260822-145717731"
export const REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30, 40])
export const ALL_OBJECT_CLASSES = Object.freeze(["footprints", "tree", "rock", "vegetation"])
export const RESIDUAL_CLASSES = Object.freeze(["footprints", "tree", "rock"])
export const LUMA_THRESHOLD = 0.08
export const FINAL_LUMA = Object.freeze({ footprints: 0.0488, tree: -0.0862, rock: 0.0614, vegetation: 0.0871 })
export const CONTRACT_ID = "stage4_conflict_aware_existing_gradient_aggregation_v1"

const finite = (value, label) => {
  assert.equal(Number.isFinite(value), true, `${label}_must_be_finite`)
  return value
}

function validateActiveConflictContract(config) {
  const contract = config.training?.stage4ConflictAwareExistingGradientAggregation
  assert.equal(contract?.enabled, true, "conflict_aggregation_not_enabled")
  assert.equal(contract?.status, "training_paradigm_active_owner_authorized", "conflict_aggregation_status_invalid")
  assert.equal(contract?.contractId, CONTRACT_ID, "conflict_aggregation_contract_invalid")
  assert.deepEqual(contract?.classOrder, ALL_OBJECT_CLASSES, "conflict_class_order_invalid")
  assert.equal(contract?.gradientBoundary?.scope, "shared_parameters_only", "shared_gradient_scope_invalid")
  assert.equal(contract?.gradientBoundary?.nonSharedParametersUseExistingGradient, true, "non_shared_gradient_changed")
  assert.equal(contract?.projection?.condition, "strict_dot_product_less_than_zero", "projection_condition_invalid")
  assert.equal(contract?.projection?.numericTolerance, null, "free_projection_tolerance_forbidden")
  assert.equal(contract?.projection?.nonNegativeDotProductBehavior, "bitwise_unchanged", "non_conflict_gradient_changed")
  assert.equal(contract?.optimizerBudget?.additionalOptimizerSteps, 0, "optimizer_steps_added")
  assert.equal(contract?.optimizerBudget?.additionalReplayPasses, 0, "replay_passes_added")
  assert.equal(contract?.checkpointQualification?.selectionContractChanged, false, "checkpoint_contract_changed")
  assert.equal(contract?.legalTargets?.failedPreviewPixelsUsedAsTargets, false, "failed_preview_target_forbidden")
  assert.equal(contract?.legalTargets?.machineReviewThresholdsUsedAsTargets, false, "review_threshold_target_forbidden")
  assert.equal(contract?.legalTargets?.machineReviewResultsUsedAsTargets, false, "review_result_target_forbidden")
  assert.equal(contract?.activationGate?.trainingNow, true, "training_gate_inactive")
  assert.equal(contract?.activationGate?.stage4FullTrainingNow, true, "stage0_gate_inactive")
  assert.equal(contract?.activationGate?.smokeNow, false, "smoke_gate_residue")
  return contract
}

function metricTimeline(manifest) {
  assert.equal(manifest.metrics?.length, 40, "forty_epoch_metrics_required")
  const allEpochs = Array.from({ length: 40 }, (_, index) => index + 1)
  const validated = allEpochs.map((epoch) => {
    const row = manifest.metrics.find((entry) => entry.epoch === epoch)
    assert.ok(row, `epoch_${epoch}_metric_missing`)
    assert.equal(row.trainStage4ConflictAwareApplied, 1, `epoch_${epoch}_conflict_aggregation_inactive`)
    const negativeProjectionCount = finite(row.trainStage4ConflictAwareNegativeProjectionCount, `epoch_${epoch}_negative_projection_count`)
    const nonNegativeUnchangedCount = finite(row.trainStage4ConflictAwareNonNegativeUnchangedCount, `epoch_${epoch}_non_conflict_count`)
    assert.equal(Math.abs((negativeProjectionCount + nonNegativeUnchangedCount) - 12) < 1e-10, true, `epoch_${epoch}_pair_count_invalid`)
    return {
      epoch,
      trainCompositeLoss: finite(row.trainCompositeLoss, `epoch_${epoch}_train_loss`),
      validationCheckpointSelectionScore: finite(row.validationCheckpointSelectionScore, `epoch_${epoch}_checkpoint_score`),
      conflictAggregationApplied: true,
      negativeProjectionCount,
      nonNegativeUnchangedCount,
      westBoundaryNonRegressionPassed: row.stage4CheckpointRouteWestBoundaryNonRegressionPassed === true,
      bestCheckpointUpdated: row.bestCheckpointUpdated === true,
    }
  })
  return validated.filter((entry) => REVIEW_EPOCHS.includes(entry.epoch))
}

function reviewTimeline(review) {
  assert.equal(review.reviewThresholdsChanged, false, "review_thresholds_changed")
  assert.equal(review.previewCount, 6, "preview_count_invalid")
  assert.equal(review.previewPassCount, 0, "preview_pass_count_invalid")
  assert.equal(review.previewFailCount, 6, "preview_fail_count_invalid")
  assert.deepEqual(review.reviews?.map((entry) => entry.epoch), REVIEW_EPOCHS, "review_timeline_invalid")
  return review.reviews.map((entry) => {
    const audits = {}
    for (const audit of entry.conditionAlignment?.objectSemanticAudits ?? []) {
      const name = audit.channelId?.replace("object_", "")
      if (!ALL_OBJECT_CLASSES.includes(name)) continue
      assert.equal(audit.referenceThresholds?.minimumMaskedLumaCorrelation, LUMA_THRESHOLD, `epoch_${entry.epoch}_${name}_threshold_changed`)
      audits[name] = {
        passed: audit.passed === true,
        localResponsePassed: audit.localResponsePassed === true,
        maskedRgbMae: finite(audit.referenceResponse?.maskedRgbMae, `epoch_${entry.epoch}_${name}_rgb`),
        maskedEdgeMae: finite(audit.referenceResponse?.maskedEdgeMae, `epoch_${entry.epoch}_${name}_edge`),
        maskedLumaCorrelation: finite(audit.referenceResponse?.maskedLumaCorrelation, `epoch_${entry.epoch}_${name}_luma`),
      }
    }
    assert.deepEqual(Object.keys(audits), ALL_OBJECT_CLASSES, `epoch_${entry.epoch}_object_audits_incomplete`)
    const water = entry.conditionAlignment.channelAudits.find((audit) => audit.channelId === "terrain_water")
    const path = entry.conditionAlignment.channelAudits.find((audit) => audit.channelId === "terrain_path_ground")
    assert.ok(water && path, `epoch_${entry.epoch}_terrain_audits_missing`)
    return { epoch: entry.epoch, passed: entry.passed === true, issueCodes: [...entry.issueCodes], waterPassed: water.passed === true, pathPassed: path.passed === true, audits }
  })
}

export function validateConflictAwareStage0Evidence(input) {
  const { terminal, manifest, review, activeConfig, failedCheckpointIdentity } = input
  assert.equal(terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed")
  assert.equal(terminal.runId, SOURCE_RUN_ID, "current_run_identity_required")
  assert.equal(terminal.stage, 0)
  assert.deepEqual(terminal.fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 })
  assert.equal(terminal.machineReview?.passCount, 0, "terminal_preview_pass_count_invalid")
  assert.equal(terminal.machineReview?.failCount, 6, "terminal_preview_fail_count_invalid")
  assert.equal(manifest.status, "conditional_denoiser_training_completed_pending_validation")
  assert.deepEqual(manifest.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(manifest.modelStateHashEvidence?.weightsChanged, true, "model_weights_not_changed")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.previewSha256Matches, true, "preview_bytes_not_reproduced")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.denoiserStateIdentityMatches, true, "preview_model_identity_mismatch")
  assert.equal(manifest.bestEpoch, 30, "best_epoch_identity_changed")
  assert.equal(manifest.checkpointPath, failedCheckpointIdentity.path, "checkpoint_path_identity_mismatch")
  assert.equal(manifest.checkpointSha256, failedCheckpointIdentity.sha256, "checkpoint_sha_identity_mismatch")
  assert.equal(terminal.checkpoint?.path, failedCheckpointIdentity.path, "terminal_checkpoint_path_mismatch")
  assert.equal(terminal.checkpoint?.sha256, failedCheckpointIdentity.sha256, "terminal_checkpoint_sha_mismatch")
  validateActiveConflictContract(activeConfig)
  return { metrics: metricTimeline(manifest), reviews: reviewTimeline(review) }
}

export function adjudicateConflictAwareStage0Failure(input) {
  const { metrics, reviews } = validateConflictAwareStage0Evidence(input)
  const firstMetric = metrics[0]
  const epoch30Metric = metrics.find((entry) => entry.epoch === 30)
  const finalMetric = metrics.at(-1)
  const epoch30Review = reviews.find((entry) => entry.epoch === 30)
  const finalReview = reviews.at(-1)
  assert.equal(finalReview.waterPassed, true, "epoch40_water_must_pass")
  assert.equal(finalReview.pathPassed, true, "epoch40_path_must_pass")
  assert.equal(finalReview.audits.vegetation.passed, true, "epoch40_vegetation_must_pass")
  assert.equal(finalReview.audits.vegetation.maskedLumaCorrelation, FINAL_LUMA.vegetation, "epoch40_vegetation_luma_changed")
  for (const name of RESIDUAL_CLASSES) {
    assert.equal(finalReview.audits[name].localResponsePassed, true, `epoch40_${name}_local_response_missing`)
    assert.equal(finalReview.audits[name].passed, false, `epoch40_${name}_unexpected_pass`)
    assert.equal(finalReview.audits[name].maskedLumaCorrelation, FINAL_LUMA[name], `epoch40_${name}_luma_changed`)
    assert.equal(FINAL_LUMA[name] < LUMA_THRESHOLD, true)
  }
  assert.deepEqual(finalReview.issueCodes, RESIDUAL_CLASSES.map((name) => `condition_object_${name}_reference_semantic_mismatch`), "epoch40_issue_identity_invalid")
  assert.equal(firstMetric.validationCheckpointSelectionScore, 7.252712216589134, "epoch1_checkpoint_score_changed")
  assert.equal(epoch30Metric.validationCheckpointSelectionScore, 5.8695371518571235, "epoch30_checkpoint_score_changed")
  assert.equal(finalMetric.validationCheckpointSelectionScore, 5.372003858235742, "epoch40_checkpoint_score_changed")
  assert.equal(finalMetric.validationCheckpointSelectionScore < firstMetric.validationCheckpointSelectionScore, true, "checkpoint_score_not_improved")
  assert.equal(epoch30Metric.bestCheckpointUpdated, true, "epoch30_best_checkpoint_identity_missing")
  assert.equal(epoch30Metric.westBoundaryNonRegressionPassed, true, "epoch30_west_gate_changed")
  assert.equal(finalMetric.bestCheckpointUpdated, false, "epoch40_best_checkpoint_unexpectedly_updated")
  assert.equal(finalMetric.westBoundaryNonRegressionPassed, false, "epoch40_west_gate_identity_changed")
  assert.equal(epoch30Review.pathPassed, false, "epoch30_review_path_identity_changed")
  assert.equal(input.directConflictWiringDefectEvidence, false, "unproven_conflict_wiring_defect")
  assert.equal(input.directResidualCapacityEvidence, false, "unproven_capacity_gap")
  return {
    schemaVersion: "stage4-conflict-aware-stage0-residual-semantic-adjudication-v1",
    status: "conflict_aware_training_paradigm_active_but_semantically_insufficient",
    selectedCause: "A",
    problem: "Conflict-aware aggregation is active and the final-visible trajectory improves, but the frozen Stage 0 terminal still fails footprints, tree, and rock reference semantics.",
    evidence: {
      conflictAggregationActiveAcrossAllEpochs: true,
      optimizerAndReplayBudgetsUnchanged: true,
      checkpointSelectionScoreImproved: true,
      terminalRoadWaterVegetationPassed: true,
      terminalResidualClasses: RESIDUAL_CLASSES,
      terminalMaskedLumaCorrelation: FINAL_LUMA,
      checkpointIdentityDifference: {
        bestEpoch: 30,
        terminalEpoch: 40,
        reason: "epoch40_full_validation_west_boundary_non_regression_gate_failed",
        sufficientToExplainTerminalFailure: false,
      },
      directConflictWiringDefectEvidence: false,
      directResidualCapacityEvidence: false,
    },
    alternatives: {
      B: { status: "not_selected", reason: "The active contract and all 40 metric rows prove the conflict replacement ran; the best/terminal identity difference follows the unchanged west non-regression gate and cannot explain the three terminal semantic failures." },
      C: { status: "not_confirmed", reason: "Autoencoder retention is sufficient and conflict handling is active, but this CPU evidence does not isolate model capacity from condition representation with a controlled structural comparison." },
      D: { status: "not_selected", reason: "The current immutable run is sufficient to select A without inventing a wiring or capacity conclusion." },
    },
    resolution: {
      action: "exit_current_conflict_aware_training_paradigm_and_request_model_structure_review",
      currentStage0MayBeRerun: false,
      additionalSameTypeLossAllowed: false,
      freeHyperparametersAllowed: false,
      failedCheckpointReuseAllowed: false,
      nextLegalAction: "cpu_readonly_substantive_model_structure_review",
    },
    metrics,
    reviews,
  }
}
