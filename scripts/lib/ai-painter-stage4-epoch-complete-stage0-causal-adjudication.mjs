import assert from "node:assert/strict"

export const SOURCE_RUN_ID = "20260822-044700000"
export const REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30, 40])
export const ALL_CLASSES = Object.freeze(["footprints", "tree", "rock", "vegetation"])
export const FAILED_CLASSES = Object.freeze(["footprints", "tree", "vegetation"])
export const PASSING_CLASSES = Object.freeze(["rock"])
export const LUMA_THRESHOLD = 0.08

const issue = (name) => `condition_object_${name}_reference_semantic_mismatch`
const finite = (value, label) => {
  assert.equal(Number.isFinite(value), true, `${label}_must_be_finite`)
  return value
}

function activeContract(config) {
  const contract = config.training?.stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity
  assert.equal(contract?.enabled, true, "epoch_complete_contract_not_enabled")
  assert.equal(contract?.status, "training_loss_active_owner_authorized", "epoch_complete_contract_status_invalid")
  assert.equal(contract?.contractId, "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1", "epoch_complete_contract_id_invalid")
  assert.equal(contract?.trainingSelection?.population, "all_48_train_split_records_in_one_completed_epoch", "train_population_invalid")
  assert.equal(contract?.trainingSelection?.additionalOptimizerSteps, 0, "optimizer_step_budget_changed")
  assert.equal(contract?.checkpointQualification?.population, "all_8_validation_records_all_existing_rollout_seeds", "validation_population_invalid")
  assert.equal(contract?.checkpointQualification?.entersQualificationScore, true, "checkpoint_qualification_not_active")
  assert.equal(contract?.activationGate?.trainingNow, true, "training_gate_inactive")
  assert.equal(contract?.activationGate?.stage4FullTrainingNow, true, "stage0_gate_inactive")
  assert.equal(contract?.activationGate?.smokeNow, false, "smoke_gate_residue")
  return contract
}

function validateSelections(row) {
  assert.equal(row.trainStage4EpochCompletePerClassSelectionIdentityCount, 48, `epoch_${row.epoch}_train_coverage_invalid`)
  assert.equal(row.trainStage4EpochWorstSampleClassReplayPasses, 2, `epoch_${row.epoch}_replay_passes_invalid`)
  assert.equal(row.validationRolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointIdentityCount, 16, `epoch_${row.epoch}_validation_coverage_invalid`)
  const train = row.trainEpochCompletePerClassWorstSampleFinalVisibleLuminanceSelections
  const validation = row.validationRolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointSelections
  assert.equal(Array.isArray(train), true, `epoch_${row.epoch}_train_selections_missing`)
  assert.equal(Array.isArray(validation), true, `epoch_${row.epoch}_validation_selections_missing`)
  assert.deepEqual(train.map((entry) => entry.classIdentity), ALL_CLASSES, `epoch_${row.epoch}_train_class_order_invalid`)
  assert.deepEqual(validation.map((entry) => entry.classIdentity), ALL_CLASSES, `epoch_${row.epoch}_validation_class_order_invalid`)
  for (const [kind, entries] of [["train", train], ["validation", validation]]) {
    for (const entry of entries) {
      assert.equal(typeof entry.sampleId, "string", `epoch_${row.epoch}_${kind}_sample_id_missing`)
      finite(entry.rawScore, `epoch_${row.epoch}_${kind}_raw_score`)
      finite(entry.weightedScore, `epoch_${row.epoch}_${kind}_weighted_score`)
      if (kind === "train") assert.equal(entry.seedIndex, null, `epoch_${row.epoch}_train_seed_must_be_null`)
      else assert.equal(Number.isInteger(entry.seedIndex), true, `epoch_${row.epoch}_validation_seed_missing`)
    }
  }
  return { train, validation }
}

function metricTimeline(manifest) {
  return REVIEW_EPOCHS.map((epoch) => {
    const row = manifest.metrics?.find((entry) => entry.epoch === epoch)
    assert.ok(row, `epoch_${epoch}_metric_missing`)
    const selections = validateSelections(row)
    return {
      epoch,
      checkpointSelectionScore: finite(row.validationCheckpointSelectionScore, `epoch_${epoch}_checkpoint_score`),
      trainCompositeLoss: finite(row.trainCompositeLoss, `epoch_${epoch}_train_composite_loss`),
      validationVelocityLoss: finite(row.validationFixedGridVelocityLoss, `epoch_${epoch}_validation_velocity_loss`),
      fullRolloutLuminanceWeightedLoss: finite(row.trainStage4FullRolloutPerClassFinalVisibleLuminanceStructureWeightedLoss, `epoch_${epoch}_full_rollout_luminance`),
      selectedReplayLoss: epoch === 1 ? row.trainStage4EpochCompletePerClassSelectedLuminanceReplayLoss : finite(row.trainStage4EpochCompletePerClassSelectedLuminanceReplayLoss, `epoch_${epoch}_selected_replay_loss`),
      westBoundaryPassed: row.stage4CheckpointRouteWestBoundaryNonRegressionPassed === true,
      bestCheckpointUpdated: row.bestCheckpointUpdated === true,
      ...selections,
    }
  })
}

function reviewTimeline(review) {
  assert.equal(review.reviewThresholdsChanged, false, "review_thresholds_changed")
  assert.equal(review.previewCount, 6, "preview_count_invalid")
  assert.equal(review.previewPassCount, 0, "preview_pass_count_invalid")
  assert.equal(review.previewFailCount, 6, "preview_fail_count_invalid")
  assert.deepEqual(review.reviews?.map((entry) => entry.epoch), REVIEW_EPOCHS, "review_timeline_invalid")
  return review.reviews.map((entry) => {
    const audits = Object.fromEntries((entry.conditionAlignment?.objectSemanticAudits ?? [])
      .filter((audit) => ALL_CLASSES.includes(audit.channelId?.replace("object_", "")))
      .map((audit) => {
        const name = audit.channelId.replace("object_", "")
        const threshold = audit.referenceThresholds?.minimumMaskedLumaCorrelation
        assert.equal(threshold, LUMA_THRESHOLD, `epoch_${entry.epoch}_${name}_threshold_changed`)
        return [name, {
          passed: audit.passed === true,
          localResponsePassed: audit.localResponsePassed === true,
          maskedRgbMae: finite(audit.referenceResponse?.maskedRgbMae, `epoch_${entry.epoch}_${name}_rgb_mae`),
          maskedEdgeMae: finite(audit.referenceResponse?.maskedEdgeMae, `epoch_${entry.epoch}_${name}_edge_mae`),
          maskedLumaCorrelation: finite(audit.referenceResponse?.maskedLumaCorrelation, `epoch_${entry.epoch}_${name}_luma_correlation`),
        }]
      }))
    assert.deepEqual(Object.keys(audits), ALL_CLASSES, `epoch_${entry.epoch}_object_audits_incomplete`)
    return { epoch: entry.epoch, passed: entry.passed === true, issueCodes: [...entry.issueCodes], audits }
  })
}

export function validateEpochCompleteStage0Evidence(input) {
  const { terminal, manifest, review, activeConfig, failedCheckpointIdentity, telemetryInspection, sourceIndexInspection } = input
  assert.equal(terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed")
  assert.equal(terminal.runId, SOURCE_RUN_ID, "current_run_identity_required")
  assert.equal(terminal.stage, 0)
  assert.deepEqual(terminal.fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 })
  assert.equal(manifest.status, "conditional_denoiser_training_completed_pending_validation")
  assert.deepEqual(manifest.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(manifest.modelStateHashEvidence?.weightsChanged, true, "model_weights_not_changed")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.previewSha256Matches, true, "preview_bytes_not_reproduced")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.denoiserStateIdentityMatches, true, "preview_model_identity_mismatch")
  assert.equal(manifest.checkpointPath, failedCheckpointIdentity.path, "checkpoint_path_identity_mismatch")
  assert.equal(manifest.checkpointSha256, failedCheckpointIdentity.sha256, "checkpoint_sha_identity_mismatch")
  assert.equal(terminal.checkpoint?.path, failedCheckpointIdentity.path, "terminal_checkpoint_path_mismatch")
  assert.equal(terminal.checkpoint?.sha256, failedCheckpointIdentity.sha256, "terminal_checkpoint_sha_mismatch")
  activeContract(activeConfig)
  const metrics = metricTimeline(manifest)
  const reviews = reviewTimeline(review)

  assert.equal(sourceIndexInspection.trainCount, 48, "source_index_train_count_invalid")
  assert.equal(sourceIndexInspection.validationCount, 8, "source_index_validation_count_invalid")
  assert.equal(sourceIndexInspection.allTrainSelectionsBelongToTrain, true, "train_selection_outside_train_split")
  assert.equal(sourceIndexInspection.allValidationSelectionsBelongToValidation, true, "validation_selection_outside_validation_split")
  assert.equal(sourceIndexInspection.rolloutSeedCount, 2, "rollout_seed_count_invalid")

  assert.equal(telemetryInspection.stepIdentity, "epoch_complete_per_class_selected_luminance_replay")
  assert.equal(telemetryInspection.totalEvents, 3744, "replay_telemetry_total_invalid")
  assert.deepEqual(telemetryInspection.epochs, Array.from({ length: 39 }, (_, index) => index + 2), "replay_epoch_coverage_invalid")
  assert.equal(telemetryInspection.eachEpochHas48BatchesAnd96Events, true, "replay_epoch_batch_coverage_invalid")
  assert.equal(telemetryInspection.eachEpochHasTwoPasses, true, "replay_pass_identity_invalid")
  assert.equal(telemetryInspection.eachEpochHas24EventsPerClass, true, "replay_class_schedule_invalid")
  assert.equal(telemetryInspection.matchesPreviousEpochSelections, true, "replay_selection_identity_mismatch")
  assert.equal(telemetryInspection.unknownOrMalformedEvents, 0, "replay_telemetry_malformed")

  return { metrics, reviews }
}

export function adjudicateEpochCompleteStage0Failure(input) {
  const { metrics, reviews } = validateEpochCompleteStage0Evidence(input)
  const firstMetric = metrics[0]
  const lastMetric = metrics.at(-1)
  const finalReview = reviews.at(-1)
  const expectedIssues = FAILED_CLASSES.map(issue)
  assert.deepEqual(finalReview.issueCodes, expectedIssues, "epoch40_issue_identity_invalid")
  assert.equal(finalReview.audits.rock.passed, true, "epoch40_rock_must_pass")
  assert.equal(FAILED_CLASSES.every((name) => finalReview.audits[name].localResponsePassed), true, "epoch40_failed_class_local_response_missing")
  const exactLuma = { footprints: 0.0694, tree: 0.0225, vegetation: 0.0716 }
  for (const [name, value] of Object.entries(exactLuma)) {
    assert.equal(finalReview.audits[name].maskedLumaCorrelation, value, `epoch40_${name}_luma_identity_changed`)
    assert.equal(value < LUMA_THRESHOLD, true)
  }
  const roadWaterPassed = !finalReview.issueCodes.some((value) => value.includes("terrain_path_ground") || value.includes("terrain_water"))
  const checkpointScoreImproved = lastMetric.checkpointSelectionScore < firstMetric.checkpointSelectionScore
  const fullRolloutLuminanceImproved = lastMetric.fullRolloutLuminanceWeightedLoss < firstMetric.fullRolloutLuminanceWeightedLoss
  const replayLossImproved = lastMetric.selectedReplayLoss < metrics.find((row) => row.epoch === 5).selectedReplayLoss
  assert.equal(roadWaterPassed, true, "epoch40_road_or_water_failed")
  assert.equal(checkpointScoreImproved, true, "checkpoint_score_not_improved")
  assert.equal(fullRolloutLuminanceImproved, true, "full_rollout_luminance_not_improved")
  assert.equal(replayLossImproved, true, "selected_replay_loss_not_improved")
  assert.equal(input.directClassInterferenceEvidence, false, "class_interference_requires_direct_formal_evidence")

  return {
    schemaVersion: "stage4-epoch-complete-stage0-causal-adjudication-v1",
    status: "A_active_legal_objectives_insufficient_for_multisample_final_visible_reference_semantics",
    selectedCause: "A",
    finding: {
      engineering: "The complete-epoch selector, the two authorized replay passes, and validation checkpoint identities are present and internally consistent; the previous batch-local identity defect is not present in this run.",
      optimization: "The legal full-rollout luminance obligation, selected replay loss, and validation checkpoint score improve materially across the run.",
      visual: "At Epoch 40 road, water, and rock pass. Footprints, tree, and vegetation respond locally and satisfy RGB/edge limits, but their held-out masked luminance correlations remain below 0.08.",
    },
    evidence: {
      completeEpochSelectionAndReplayCorrect: true,
      validationCheckpointIdentityCorrect: true,
      checkpointScoreImproved,
      fullRolloutLuminanceImproved,
      replayLossImproved,
      roadWaterRockPassed: true,
      terminalFailedClasses: FAILED_CLASSES,
      terminalMaskedLumaCorrelation: exactLuma,
      directClassInterferenceEvidence: false,
    },
    alternatives: {
      B: { status: "not_selected", reason: "All 48 train identities, two replay passes, all 8 validation records across two rollout seeds, and selected checkpoint identities are present and consistent." },
      C: { status: "not_confirmed", reason: "This immutable run contains no direct cross-class gradient-conflict or counterfactual interference evidence; simultaneous failure alone is not proof." },
      D: { status: "not_selected", reason: "The active contracts, full execution telemetry, metric timeline, review timeline, and checkpoint identity trajectory are sufficient to select A." },
    },
    metrics,
    reviews,
    nextContractId: "stage4_footprints_tree_vegetation_final_visible_reference_semantic_supervision_identifiability_review_v1",
  }
}
