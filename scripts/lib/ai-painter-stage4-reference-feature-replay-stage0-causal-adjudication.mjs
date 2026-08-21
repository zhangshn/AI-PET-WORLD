import assert from "node:assert/strict"

export const REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30, 40])
export const OBJECT_CLASSES = Object.freeze(["footprints", "tree", "rock", "vegetation"])

const trainFeatureField = (name) => `trainStage4PerClassFinalVisible${name[0].toUpperCase()}${name.slice(1)}ReferenceFeatureStructureLoss`
const validationFeatureField = (name) => `validationRollout${name[0].toUpperCase()}${name.slice(1)}FinalVisibleReferenceFeatureStructureLoss`

function finite(value, label) {
  assert.equal(Number.isFinite(value), true, `${label}_must_be_finite`)
  return value
}

function exactActiveGate(contract, label) {
  assert.equal(contract?.enabled, true, `${label}_not_enabled`)
  assert.equal(contract?.status, "training_loss_active_owner_authorized", `${label}_status_invalid`)
  assert.equal(contract?.activationGate?.configurationActiveNow, true, `${label}_configuration_not_active`)
  assert.equal(contract?.activationGate?.trainingNow, true, `${label}_training_not_active`)
  assert.equal(contract?.activationGate?.stage4FullTrainingNow, true, `${label}_stage4_training_not_active`)
  assert.equal(contract?.activationGate?.smokeNow, false, `${label}_smoke_residue_present`)
}

function reviewTimeline(review) {
  assert.deepEqual(review.reviews?.map((row) => row.epoch), REVIEW_EPOCHS, "review_epoch_timeline_invalid")
  assert.equal(review.reviewThresholdsChanged, false, "review_thresholds_changed")
  assert.equal(review.previewCount, REVIEW_EPOCHS.length, "review_preview_count_invalid")
  assert.equal(review.previewPassCount, 0, "unexpected_review_pass")
  assert.equal(review.previewFailCount, REVIEW_EPOCHS.length, "review_fail_count_invalid")
  return review.reviews.map((row) => ({
    epoch: row.epoch,
    passed: row.passed === true,
    issueCodes: [...row.issueCodes],
  }))
}

function metricTimeline(manifest) {
  const rows = REVIEW_EPOCHS.map((epoch) => manifest.metrics?.find((row) => row.epoch === epoch))
  assert.equal(rows.every(Boolean), true, "required_metric_epoch_missing")
  return rows.map((row) => ({
    epoch: row.epoch,
    checkpointSelectionScore: finite(row.validationCheckpointSelectionScore, `epoch_${row.epoch}_checkpoint_score`),
    trainWeightedFeatureLoss: finite(row.trainStage4PerClassFinalVisibleReferenceFeatureStructureWeightedLoss, `epoch_${row.epoch}_train_weighted_feature`),
    replayWeightedFeatureLoss: finite(row.trainStage4EpochWorstSampleClassReplayReferenceFeatureStructureWeightedLoss, `epoch_${row.epoch}_replay_weighted_feature`),
    replaySelectionScore: finite(row.trainStage4EpochWorstSampleClassSelectionScore, `epoch_${row.epoch}_replay_selection_score`),
    replayPasses: finite(row.trainStage4EpochWorstSampleClassReplayPasses, `epoch_${row.epoch}_replay_passes`),
    replayClassIndex: finite(row.trainStage4EpochWorstSampleClassReplayClassIndex, `epoch_${row.epoch}_replay_class_index`),
    trainPerClass: Object.fromEntries(OBJECT_CLASSES.map((name) => [name, finite(row[trainFeatureField(name)], `epoch_${row.epoch}_train_${name}`)])),
    validationPerClass: Object.fromEntries(OBJECT_CLASSES.map((name) => [name, finite(row[validationFeatureField(name)], `epoch_${row.epoch}_validation_${name}`)])),
    routeWestBoundaryNonRegressionPassed: row.stage4CheckpointRouteWestBoundaryNonRegressionPassed === true,
    bestCheckpointUpdated: row.bestCheckpointUpdated === true,
  }))
}

export function validateReferenceFeatureReplayStage0Evidence(input) {
  const { activeConfig, terminal, manifest, review, failedCheckpointIdentity } = input
  assert.equal(terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed")
  assert.equal(terminal.stage, 0)
  assert.equal(terminal.runId, "20260820-214000000", "current_run_identity_required")
  assert.deepEqual(terminal.blockers, ["stage_0_visual_review_failed_0_of_6"])
  assert.deepEqual(terminal.fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 })
  assert.equal(manifest.status, "conditional_denoiser_training_completed_pending_validation")
  assert.deepEqual(manifest.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(manifest.modelStateHashEvidence?.weightsChanged, true)
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.previewSha256Matches, true)
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.denoiserStateIdentityMatches, true)
  assert.equal(manifest.checkpointPath, failedCheckpointIdentity.path)
  assert.equal(manifest.checkpointSha256, failedCheckpointIdentity.sha256)
  assert.equal(terminal.checkpoint?.path, failedCheckpointIdentity.path)
  assert.equal(terminal.checkpoint?.sha256, failedCheckpointIdentity.sha256)
  exactActiveGate(activeConfig.training?.stage4PerClassFinalVisibleReferenceFeatureStructureObligation, "reference_feature_obligation")
  exactActiveGate(activeConfig.training?.stage4EpochWorstSampleClassReferenceFeatureStructureReplay, "reference_feature_replay")
  const replay = activeConfig.training.stage4EpochWorstSampleClassReferenceFeatureStructureReplay
  assert.equal(replay.sourceContracts?.perSampleClassTensorSource, "stage4_per_class_final_visible_reference_feature_structure_obligation_losses.perSampleClassTensors")
  assert.equal(replay.replay?.loss, "same_selected_reference_feature_structure_sample_class_tensor")
  assert.equal(replay.replay?.recomputeFromSameBoundSampleAndClass, true)
  assert.equal(replay.replay?.addsReplayPasses, false)
  assert.equal(replay.replay?.addsOptimizerSteps, false)
  assert.deepEqual(replay.selection?.classIdentities, OBJECT_CLASSES)
  const reviews = reviewTimeline(review)
  const metrics = metricTimeline(manifest)
  return { reviews, metrics, replay }
}

const decreased = (first, last) => last < first

export function adjudicateReferenceFeatureReplayStage0Failure(input) {
  const { reviews, metrics } = validateReferenceFeatureReplayStage0Evidence(input)
  const first = metrics[0]
  const last = metrics.at(-1)
  const replayActiveEveryEpoch = metrics.every((row) => row.replayWeightedFeatureLoss > 0 && row.replayPasses === 2)
  const allTrainClassesImprove = OBJECT_CLASSES.every((name) => decreased(first.trainPerClass[name], last.trainPerClass[name]))
  const allValidationClassesImprove = OBJECT_CLASSES.every((name) => decreased(first.validationPerClass[name], last.validationPerClass[name]))
  const weightedFeatureImproves = decreased(first.trainWeightedFeatureLoss, last.trainWeightedFeatureLoss)
  const replaySelectionImproves = decreased(first.replaySelectionScore, last.replaySelectionScore)
  const checkpointScoreImproves = decreased(first.checkpointSelectionScore, last.checkpointSelectionScore)
  const allReviewedEpochsFail = reviews.every((row) => row.passed === false)
  const fourObjectFailuresPersist = reviews.every((row) => OBJECT_CLASSES.every((name) => (
    row.issueCodes.includes(`condition_object_${name}_reference_semantic_mismatch`)
  )))
  const terminalRoadAndWaterPass = reviews.at(-1).issueCodes.every((code) => (
    !code.includes("terrain_path_ground") && !code.includes("terrain_water")
  ))
  const noReviewedCheckpointPasses = reviews.every((row) => row.passed === false)
  const directClassGradientConflictEvidence = input.directClassGradientConflictEvidence === true

  assert.equal(replayActiveEveryEpoch, true, "replay_not_active_every_review_epoch")
  assert.equal(allTrainClassesImprove, true, "train_class_feature_losses_do_not_all_improve")
  assert.equal(allValidationClassesImprove, true, "validation_class_feature_losses_do_not_all_improve")
  assert.equal(weightedFeatureImproves, true, "weighted_feature_loss_does_not_improve")
  assert.equal(replaySelectionImproves, true, "replay_selection_does_not_improve")
  assert.equal(checkpointScoreImproves, true, "checkpoint_score_does_not_improve")
  assert.equal(allReviewedEpochsFail, true)
  assert.equal(fourObjectFailuresPersist, true)
  assert.equal(terminalRoadAndWaterPass, true)
  assert.equal(directClassGradientConflictEvidence, false)

  return {
    schemaVersion: "stage4-reference-feature-replay-stage0-causal-adjudication-v1",
    status: "A_reference_feature_replay_active_but_insufficient_for_multisample_visible_semantics_confirmed",
    selectedCause: "A",
    evidence: {
      replayActiveEveryEpoch,
      allTrainClassesImprove,
      allValidationClassesImprove,
      weightedFeatureImproves,
      replaySelectionImproves,
      checkpointScoreImproves,
      allReviewedEpochsFail,
      fourObjectFailuresPersist,
      terminalRoadAndWaterPass,
      noReviewedCheckpointPasses,
      directClassGradientConflictEvidence,
    },
    alternatives: {
      B: {
        status: "not_confirmed",
        reason: "The active config binds perSampleClassTensors to the same selected sample-class replay loss, and every reviewed epoch records two finite non-zero replay passes. No execution identity or wiring break is present.",
      },
      C: {
        status: "not_confirmed",
        reason: "The bound Stage 0 evidence contains no direct cross-class gradient-conflict measurement. Aggregate or classwise failure cannot establish gradient interference.",
      },
      D: {
        status: "not_selected",
        reason: "The active configuration, complete 40-Epoch metric trajectory, six machine reviews, checkpoint identity, and reproduction evidence are sufficient for an executable A/B/C/D decision.",
      },
    },
    metricTimeline: metrics,
    reviewTimeline: reviews,
    nextContractId: "stage4_per_class_worst_sample_reference_feature_structure_obligation_v1",
  }
}
