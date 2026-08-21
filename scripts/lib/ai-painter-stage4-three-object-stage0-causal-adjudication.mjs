import assert from "node:assert/strict"

export const SOURCE_RUN_ID = "20260821-064100000"
export const REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30, 40])
export const FAILED_CLASSES = Object.freeze(["footprints", "tree", "rock"])
export const ALL_CLASSES = Object.freeze(["footprints", "tree", "rock", "vegetation"])

const title = (value) => `${value[0].toUpperCase()}${value.slice(1)}`
const issue = (value) => `condition_object_${value}_reference_semantic_mismatch`

function finite(value, label) {
  assert.equal(Number.isFinite(value), true, `${label}_must_be_finite`)
  return value
}

function activeContract(contract, contractId, label) {
  assert.equal(contract?.enabled, true, `${label}_not_enabled`)
  assert.equal(contract?.status, "training_loss_active_owner_authorized", `${label}_status_invalid`)
  assert.equal(contract?.contractId, contractId, `${label}_contract_id_invalid`)
  assert.equal(contract?.activationGate?.configurationActiveNow, true, `${label}_configuration_inactive`)
  assert.equal(contract?.activationGate?.trainingNow, true, `${label}_training_inactive`)
  assert.equal(contract?.activationGate?.stage4FullTrainingNow, true, `${label}_stage0_inactive`)
  assert.equal(contract?.activationGate?.smokeNow, false, `${label}_smoke_residue`)
}

function metricTimeline(manifest) {
  const rows = REVIEW_EPOCHS.map((epoch) => manifest.metrics?.find((row) => row.epoch === epoch))
  assert.equal(rows.every(Boolean), true, "required_metric_epoch_missing")
  return rows.map((row) => ({
    epoch: row.epoch,
    checkpointSelectionScore: finite(row.validationCheckpointSelectionScore, `epoch_${row.epoch}_checkpoint_score`),
    validationWorstLuminance: finite(row.validationRolloutPerClassWorstSampleFinalVisibleLuminanceStructureCheckpointObligation, `epoch_${row.epoch}_validation_worst_luminance`),
    validationWorstReferenceFeature: finite(row.validationRolloutPerClassWorstSampleReferenceFeatureStructureCheckpointObligation, `epoch_${row.epoch}_validation_worst_reference_feature`),
    trainWorstLuminanceWeighted: finite(row.trainStage4PerClassWorstSampleFinalVisibleLuminanceStructureWeightedLoss, `epoch_${row.epoch}_train_worst_luminance`),
    trainWorstReferenceFeatureWeighted: finite(row.trainStage4PerClassWorstSampleReferenceFeatureStructureWeightedLoss, `epoch_${row.epoch}_train_worst_reference_feature`),
    replayReferenceFeatureWeighted: finite(row.trainStage4EpochWorstSampleClassReplayReferenceFeatureStructureWeightedLoss, `epoch_${row.epoch}_replay_reference_feature`),
    replayPasses: finite(row.trainStage4EpochWorstSampleClassReplayPasses, `epoch_${row.epoch}_replay_passes`),
    selectionScore: finite(row.trainStage4EpochWorstSampleClassSelectionScore, `epoch_${row.epoch}_selection_score`),
    westBoundaryGate: row.stage4CheckpointRouteWestBoundaryNonRegressionPassed === true,
    bestCheckpointUpdated: row.bestCheckpointUpdated === true,
    perClassLuminance: Object.fromEntries(ALL_CLASSES.map((name) => [name, finite(
      row[`trainStage4PerClassWorstSample${title(name)}FinalVisibleLuminanceStructureLoss`],
      `epoch_${row.epoch}_${name}_luminance`,
    )])),
    perClassReferenceFeature: Object.fromEntries(ALL_CLASSES.map((name) => [name, finite(
      row[`trainStage4PerClassWorstSample${title(name)}ReferenceFeatureStructureLoss`],
      `epoch_${row.epoch}_${name}_reference_feature`,
    )])),
  }))
}

function reviewTimeline(review) {
  assert.deepEqual(review.reviews?.map((row) => row.epoch), REVIEW_EPOCHS, "review_epoch_timeline_invalid")
  assert.equal(review.reviewThresholdsChanged, false, "review_thresholds_changed")
  assert.equal(review.previewCount, 6, "preview_count_invalid")
  assert.equal(review.previewPassCount, 0, "preview_pass_count_invalid")
  assert.equal(review.previewFailCount, 6, "preview_fail_count_invalid")
  return review.reviews.map((row) => {
    const objectAudits = Object.fromEntries(
      (row.conditionAlignment?.objectSemanticAudits ?? [])
        .filter((entry) => ALL_CLASSES.includes(entry.channelId?.replace("object_", "")))
        .map((entry) => [entry.channelId.replace("object_", ""), {
          passed: entry.passed === true,
          localResponsePassed: entry.localResponsePassed === true,
          maskedRgbMae: finite(entry.referenceResponse?.maskedRgbMae, `epoch_${row.epoch}_${entry.channelId}_rgb_mae`),
          maskedEdgeMae: finite(entry.referenceResponse?.maskedEdgeMae, `epoch_${row.epoch}_${entry.channelId}_edge_mae`),
          maskedLumaCorrelation: finite(entry.referenceResponse?.maskedLumaCorrelation, `epoch_${row.epoch}_${entry.channelId}_luma_correlation`),
        }]),
    )
    assert.deepEqual(Object.keys(objectAudits), ALL_CLASSES, `epoch_${row.epoch}_object_audits_incomplete`)
    return { epoch: row.epoch, passed: row.passed === true, issueCodes: [...row.issueCodes], objectAudits }
  })
}

export function validateThreeObjectStage0Evidence(input) {
  const { activeConfig, terminal, manifest, review, failedCheckpointIdentity, implementationInspection } = input
  assert.equal(terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed")
  assert.equal(terminal.stage, 0)
  assert.equal(terminal.runId, SOURCE_RUN_ID, "current_run_identity_required")
  assert.deepEqual(terminal.blockers, ["stage_0_visual_review_failed_0_of_6"])
  assert.deepEqual(terminal.fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 })
  assert.equal(manifest.status, "conditional_denoiser_training_completed_pending_validation")
  assert.deepEqual(manifest.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(manifest.modelStateHashEvidence?.weightsChanged, true, "model_weights_did_not_change")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.previewSha256Matches, true, "preview_reproduction_mismatch")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.denoiserStateIdentityMatches, true, "preview_model_identity_mismatch")
  assert.equal(manifest.checkpointPath, failedCheckpointIdentity.path, "checkpoint_path_identity_mismatch")
  assert.equal(manifest.checkpointSha256, failedCheckpointIdentity.sha256, "checkpoint_sha_identity_mismatch")
  assert.equal(terminal.checkpoint?.path, failedCheckpointIdentity.path, "terminal_checkpoint_path_mismatch")
  assert.equal(terminal.checkpoint?.sha256, failedCheckpointIdentity.sha256, "terminal_checkpoint_sha_mismatch")

  const training = activeConfig.training ?? {}
  activeContract(training.stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation, "stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1", "worst_luminance")
  activeContract(training.stage4PerClassFinalVisibleReferenceFeatureStructureObligation, "stage4_per_class_final_visible_reference_feature_structure_obligation_v1", "reference_feature")
  activeContract(training.stage4PerClassWorstSampleReferenceFeatureStructureObligation, "stage4_per_class_worst_sample_reference_feature_structure_obligation_v1", "worst_reference_feature")
  activeContract(training.stage4EpochWorstSampleClassReferenceFeatureStructureReplay, "stage4_epoch_worst_sample_class_reference_feature_structure_replay_v1", "reference_feature_replay")
  const luminance = training.stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation
  assert.equal(luminance.selection?.trainingPopulation, "all_48_train_split_records", "training_population_contract_changed")
  assert.equal(luminance.selection?.checkpointPopulation, "all_8_validation_split_records", "validation_population_contract_changed")
  assert.equal(luminance.selection?.sampleIdentity, "dataset_sampleId", "selection_identity_contract_changed")
  assert.equal(luminance.totalLoss?.entersExistingFullRolloutLossSlot, true, "luminance_not_in_total_loss_contract")
  assert.equal(luminance.checkpointQualification?.entersQualificationScore, true, "luminance_not_in_checkpoint_contract")

  assert.equal(implementationInspection.trainingBatchSize, 1, "current_batch_size_identity_changed")
  assert.equal(implementationInspection.selectionInvokedInsidePrimaryBatchLoop, true, "selection_call_location_not_verified")
  assert.equal(implementationInspection.selectionReceivesOnlyCurrentBatchSampleIds, true, "selection_input_identity_not_verified")
  assert.equal(implementationInspection.epochWideTrainingSelectionAccumulatorPresent, false, "epoch_wide_selection_defect_not_confirmed")
  assert.equal(implementationInspection.validationPerClassMaximumPresent, true, "validation_per_class_maximum_missing")
  assert.equal(implementationInspection.validationSelectionIdentityPersisted, false, "validation_identity_defect_not_confirmed")

  return {
    metrics: metricTimeline(manifest),
    reviews: reviewTimeline(review),
    implementationInspection,
  }
}

export function adjudicateThreeObjectStage0Failure(input) {
  const { metrics, reviews, implementationInspection } = validateThreeObjectStage0Evidence(input)
  const first = metrics[0]
  const last = metrics.at(-1)
  const threeClassTrainLuminanceImproved = FAILED_CLASSES.every((name) => last.perClassLuminance[name] < first.perClassLuminance[name])
  const threeClassTrainReferenceFeatureImproved = FAILED_CLASSES.every((name) => last.perClassReferenceFeature[name] < first.perClassReferenceFeature[name])
  const validationLuminanceImproved = last.validationWorstLuminance < first.validationWorstLuminance
  const validationReferenceFeatureImproved = last.validationWorstReferenceFeature < first.validationWorstReferenceFeature
  const checkpointScoreImproved = last.checkpointSelectionScore < first.checkpointSelectionScore
  const replayActive = metrics.every((row) => row.replayReferenceFeatureWeighted > 0 && row.replayPasses === 2)
  const finalReview = reviews.at(-1)
  const exactTerminalIssues = finalReview.issueCodes.length === FAILED_CLASSES.length
    && FAILED_CLASSES.every((name) => finalReview.issueCodes.includes(issue(name)))
  const terminalRoadWaterVegetationPassed = exactTerminalIssues
    && !finalReview.issueCodes.some((value) => value.includes("terrain_path_ground") || value.includes("terrain_water"))
    && !finalReview.issueCodes.includes(issue("vegetation"))
    && finalReview.objectAudits.vegetation.passed === true
  const threeLocalResponsesPass = FAILED_CLASSES.every((name) => finalReview.objectAudits[name].localResponsePassed)
  const perBatchSelectionCannotRepresentAll48 = implementationInspection.trainingBatchSize === 1
    && implementationInspection.selectionInvokedInsidePrimaryBatchLoop
    && implementationInspection.selectionReceivesOnlyCurrentBatchSampleIds
    && !implementationInspection.epochWideTrainingSelectionAccumulatorPresent
  const validationValueWithoutIdentity = implementationInspection.validationPerClassMaximumPresent
    && !implementationInspection.validationSelectionIdentityPersisted
  const directClassGradientConflictEvidence = input.directClassGradientConflictEvidence === true

  assert.equal(threeClassTrainLuminanceImproved, true, "three_class_luminance_did_not_improve")
  assert.equal(threeClassTrainReferenceFeatureImproved, true, "three_class_reference_feature_did_not_improve")
  assert.equal(validationLuminanceImproved, true, "validation_luminance_did_not_improve")
  assert.equal(validationReferenceFeatureImproved, true, "validation_reference_feature_did_not_improve")
  assert.equal(checkpointScoreImproved, true, "checkpoint_score_did_not_improve")
  assert.equal(replayActive, true, "reference_feature_replay_not_active")
  assert.equal(terminalRoadWaterVegetationPassed, true, "epoch40_business_identity_invalid")
  assert.equal(threeLocalResponsesPass, true, "terminal_local_response_not_passed")
  assert.equal(perBatchSelectionCannotRepresentAll48, true, "training_selection_identity_defect_not_confirmed")
  assert.equal(validationValueWithoutIdentity, true, "validation_selection_identity_defect_not_confirmed")
  assert.equal(directClassGradientConflictEvidence, false, "direct_class_interference_requires_separate_decision")

  return {
    schemaVersion: "stage4-three-object-stage0-causal-adjudication-v1",
    status: "B_per_class_worst_sample_selection_loss_and_checkpoint_identity_defect_confirmed",
    selectedCause: "B",
    finding: {
      training: "The active contract requires one maximum over all 48 train records for each object class, but batchSize is 1 and the selector receives only the current batch sampleId inside the primary batch loop. The operation therefore degenerates to the current sample rather than an epoch-wide per-class worst-sample identity.",
      checkpoint: "Validation computes one numeric maximum per class over all validation trajectories, but the selected sampleId, seed and class identity are not persisted. The numeric obligation enters the checkpoint score without an auditable selected identity.",
      visual: "Road, water and vegetation pass at Epoch 40. Footprints, tree and rock retain local response but fail held-out reference semantics despite improving legal objectives.",
    },
    evidence: {
      threeClassTrainLuminanceImproved,
      threeClassTrainReferenceFeatureImproved,
      validationLuminanceImproved,
      validationReferenceFeatureImproved,
      checkpointScoreImproved,
      replayActive,
      terminalRoadWaterVegetationPassed,
      threeLocalResponsesPass,
      perBatchSelectionCannotRepresentAll48,
      validationValueWithoutIdentity,
      directClassGradientConflictEvidence,
    },
    alternatives: {
      A: { status: "not_selected", reason: "A cannot be isolated while the formally claimed all-48 per-class worst selector is not what the training implementation executes." },
      C: { status: "not_confirmed", reason: "The immutable run contains no direct cross-class gradient-conflict evidence; correlated three-class failure is insufficient." },
      D: { status: "not_selected", reason: "The active configuration, trainer call site, batch-size identity, complete metric timeline and terminal reviews are sufficient to prove B." },
    },
    metrics,
    reviews,
    nextContractId: "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1",
  }
}
