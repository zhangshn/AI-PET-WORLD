import assert from "node:assert/strict"

export const SOURCE_RUN_ID = "20260822-094629682"
export const REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30, 40])
export const OBJECT_CLASSES = Object.freeze(["footprints", "tree", "rock", "vegetation"])
export const LUMA_THRESHOLD = 0.08
export const FINAL_LUMA = Object.freeze({ footprints: 0.0437, tree: -0.0345, rock: 0.036, vegetation: 0.0674 })
export const CONTRACT_ID = "stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_selection_and_shared_replay_v1"

const issue = (name) => `condition_object_${name}_reference_semantic_mismatch`
const finite = (value, label) => {
  assert.equal(Number.isFinite(value), true, `${label}_must_be_finite`)
  return value
}

function activeContract(config) {
  const contract = config.training?.stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay
  assert.equal(contract?.enabled, true, "reference_feature_shared_replay_not_enabled")
  assert.equal(contract?.status, "training_loss_active_owner_authorized", "reference_feature_shared_replay_status_invalid")
  assert.equal(contract?.contractId, CONTRACT_ID, "reference_feature_shared_replay_contract_id_invalid")
  assert.equal(contract?.epochSelection?.population, "all_48_train_records_in_one_completed_epoch", "train_population_invalid")
  assert.deepEqual(contract?.epochSelection?.classIdentities, OBJECT_CLASSES, "class_order_invalid")
  assert.deepEqual(contract?.sharedReplay?.objectiveOrder, ["luminance", "reference_feature_structure"], "objective_order_invalid")
  assert.equal(contract?.sharedReplay?.addsOptimizerSteps, false, "optimizer_step_budget_changed")
  assert.equal(contract?.sharedReplay?.addsReplayPasses, false, "replay_budget_changed")
  assert.equal(contract?.checkpointQualification?.population, "all_8_validation_records_all_existing_rollout_seeds", "validation_population_invalid")
  assert.equal(contract?.checkpointQualification?.entersQualificationScore, true, "checkpoint_qualification_inactive")
  assert.equal(contract?.legalSupervision?.failedPreviewPixelsUsedAsTargets, false, "failed_preview_target_forbidden")
  assert.equal(contract?.legalSupervision?.machineReviewThresholdsUsedAsTargets, false, "review_threshold_target_forbidden")
  assert.equal(contract?.legalSupervision?.machineReviewResultsUsedAsTargets, false, "review_result_target_forbidden")
  assert.equal(contract?.activationGate?.trainingNow, true, "training_gate_inactive")
  assert.equal(contract?.activationGate?.stage4FullTrainingNow, true, "stage0_gate_inactive")
  assert.equal(contract?.activationGate?.smokeNow, false, "smoke_gate_residue")
  return contract
}

function validateSelections(row) {
  assert.equal(row.trainStage4EpochCompletePerClassSelectionIdentityCount, 48, `epoch_${row.epoch}_luminance_train_coverage_invalid`)
  assert.equal(row.trainStage4EpochCompletePerClassReferenceFeatureSelectionIdentityCount, 48, `epoch_${row.epoch}_reference_train_coverage_invalid`)
  assert.equal(row.trainStage4EpochWorstSampleClassReplayPasses, 2, `epoch_${row.epoch}_replay_passes_invalid`)
  assert.equal(row.validationRolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointIdentityCount, 16, `epoch_${row.epoch}_luminance_validation_coverage_invalid`)
  assert.equal(row.validationRolloutEpochCompletePerClassWorstSampleReferenceFeatureStructureCheckpointIdentityCount, 16, `epoch_${row.epoch}_reference_validation_coverage_invalid`)
  const trainReference = row.trainEpochCompletePerClassWorstSampleReferenceFeatureStructureSelections
  const validationReference = row.validationRolloutEpochCompletePerClassWorstSampleReferenceFeatureStructureCheckpointSelections
  assert.deepEqual(trainReference?.map((entry) => entry.classIdentity), OBJECT_CLASSES, `epoch_${row.epoch}_train_reference_class_order_invalid`)
  assert.deepEqual(validationReference?.map((entry) => entry.classIdentity), OBJECT_CLASSES, `epoch_${row.epoch}_validation_reference_class_order_invalid`)
  for (const [kind, entries] of [["train", trainReference], ["validation", validationReference]]) {
    for (const entry of entries) {
      assert.equal(typeof entry.sampleId, "string", `epoch_${row.epoch}_${kind}_sample_id_missing`)
      finite(entry.rawScore, `epoch_${row.epoch}_${kind}_raw_score`)
      finite(entry.weightedScore, `epoch_${row.epoch}_${kind}_weighted_score`)
      if (kind === "train") assert.equal(entry.seedIndex, null, `epoch_${row.epoch}_train_seed_must_be_null`)
      else assert.equal(Number.isInteger(entry.seedIndex), true, `epoch_${row.epoch}_validation_seed_missing`)
    }
  }
  return { trainReference, validationReference }
}

function metricTimeline(manifest) {
  return REVIEW_EPOCHS.map((epoch) => {
    const row = manifest.metrics?.find((entry) => entry.epoch === epoch)
    assert.ok(row, `epoch_${epoch}_metric_missing`)
    const selections = validateSelections(row)
    return {
      epoch,
      trainCompositeLoss: finite(row.trainCompositeLoss, `epoch_${epoch}_train_loss`),
      validationCheckpointSelectionScore: finite(row.validationCheckpointSelectionScore, `epoch_${epoch}_checkpoint_score`),
      referenceFeatureWeightedLoss: finite(row.trainStage4PerClassFinalVisibleReferenceFeatureStructureWeightedLoss, `epoch_${epoch}_reference_weighted_loss`),
      worstReferenceFeatureWeightedLoss: finite(row.trainStage4PerClassWorstSampleReferenceFeatureStructureWeightedLoss, `epoch_${epoch}_reference_worst_weighted_loss`),
      selectedReferenceFeatureReplayLoss: epoch === 1 ? row.trainStage4EpochCompletePerClassSelectedReferenceFeatureReplayLoss : finite(row.trainStage4EpochCompletePerClassSelectedReferenceFeatureReplayLoss, `epoch_${epoch}_selected_reference_replay`),
      selectedLuminanceReplayLoss: epoch === 1 ? row.trainStage4EpochCompletePerClassSelectedLuminanceReplayLoss : finite(row.trainStage4EpochCompletePerClassSelectedLuminanceReplayLoss, `epoch_${epoch}_selected_luminance_replay`),
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
      .filter((audit) => OBJECT_CLASSES.includes(audit.channelId?.replace("object_", "")))
      .map((audit) => {
        const name = audit.channelId.replace("object_", "")
        assert.equal(audit.referenceThresholds?.minimumMaskedLumaCorrelation, LUMA_THRESHOLD, `epoch_${entry.epoch}_${name}_threshold_changed`)
        return [name, {
          passed: audit.passed === true,
          localResponsePassed: audit.localResponsePassed === true,
          maskedRgbMae: finite(audit.referenceResponse?.maskedRgbMae, `epoch_${entry.epoch}_${name}_rgb_mae`),
          maskedEdgeMae: finite(audit.referenceResponse?.maskedEdgeMae, `epoch_${entry.epoch}_${name}_edge_mae`),
          maskedLumaCorrelation: finite(audit.referenceResponse?.maskedLumaCorrelation, `epoch_${entry.epoch}_${name}_luma_correlation`),
        }]
      }))
    assert.deepEqual(Object.keys(audits), OBJECT_CLASSES, `epoch_${entry.epoch}_object_audits_incomplete`)
    return { epoch: entry.epoch, passed: entry.passed === true, issueCodes: [...entry.issueCodes], audits }
  })
}

export function validateCurrentStage0Evidence(input) {
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
  assert.deepEqual(sourceIndexInspection, { trainCount: 48, validationCount: 8, challengeCount: 4, regressionCount: 4, rolloutSeedCount: 2, allTrainSelectionsBound: true, allValidationSelectionsBound: true }, "source_index_identity_invalid")
  assert.equal(telemetryInspection.luminanceStepIdentity, "epoch_complete_per_class_selected_luminance_replay")
  assert.equal(telemetryInspection.referenceStepIdentity, "epoch_complete_per_class_selected_reference_feature_replay")
  assert.equal(telemetryInspection.luminanceEventCount, 1872, "luminance_replay_count_invalid")
  assert.equal(telemetryInspection.referenceEventCount, 1872, "reference_replay_count_invalid")
  assert.equal(telemetryInspection.epochsComplete, true, "replay_epoch_coverage_invalid")
  assert.equal(telemetryInspection.batchCoverageComplete, true, "replay_batch_coverage_invalid")
  assert.equal(telemetryInspection.objectivePassIdentityCorrect, true, "replay_objective_pass_invalid")
  assert.equal(telemetryInspection.classRotationCorrect, true, "replay_class_rotation_invalid")
  assert.equal(telemetryInspection.matchesPriorEpochSelections, true, "replay_selection_identity_mismatch")
  assert.equal(telemetryInspection.unknownOrMalformedEvents, 0, "replay_telemetry_malformed")
  return { metrics, reviews }
}

export function adjudicateCurrentStage0Failure(input) {
  const { metrics, reviews } = validateCurrentStage0Evidence(input)
  const first = metrics[0]
  const fifth = metrics.find((entry) => entry.epoch === 5)
  const last = metrics.at(-1)
  const finalReview = reviews.at(-1)
  assert.deepEqual(finalReview.issueCodes, OBJECT_CLASSES.map(issue), "epoch40_issue_identity_invalid")
  for (const name of OBJECT_CLASSES) {
    assert.equal(finalReview.audits[name].localResponsePassed, true, `epoch40_${name}_local_response_missing`)
    assert.equal(finalReview.audits[name].maskedLumaCorrelation, FINAL_LUMA[name], `epoch40_${name}_luma_identity_changed`)
    assert.equal(FINAL_LUMA[name] < LUMA_THRESHOLD, true)
  }
  assert.equal(finalReview.issueCodes.some((value) => value.includes("terrain_water") || value.includes("terrain_path_ground")), false, "epoch40_road_or_water_failed")
  const trends = {
    trainLossImproved: last.trainCompositeLoss < first.trainCompositeLoss,
    checkpointScoreImproved: last.validationCheckpointSelectionScore < first.validationCheckpointSelectionScore,
    referenceFeatureWeightedLossImproved: last.referenceFeatureWeightedLoss < first.referenceFeatureWeightedLoss,
    worstReferenceFeatureWeightedLossImproved: last.worstReferenceFeatureWeightedLoss < first.worstReferenceFeatureWeightedLoss,
    selectedReferenceFeatureReplayImproved: last.selectedReferenceFeatureReplayLoss < fifth.selectedReferenceFeatureReplayLoss,
    selectedLuminanceReplayImproved: last.selectedLuminanceReplayLoss < fifth.selectedLuminanceReplayLoss,
  }
  assert.equal(Object.values(trends).every(Boolean), true, "optimization_trends_not_improved")
  assert.equal(input.directWiringDefectEvidence, false, "direct_wiring_defect_requires_separate_evidence")
  assert.equal(input.directFeatureRgbBoundaryDefectEvidence, false, "feature_rgb_boundary_defect_requires_separate_evidence")
  return {
    schemaVersion: "stage4-current-stage0-four-object-causal-adjudication-v1",
    status: "A_active_legal_objectives_insufficient_for_multisample_final_visible_reference_semantics",
    selectedCause: "A",
    problem: "The formal Stage 0 completes and optimizes its registered legal objectives, but all four object classes remain below the frozen final-visible reference luminance requirement.",
    evidence: {
      contractsActive: true,
      completeEpochSelectionAndSharedReplayCorrect: true,
      validationCheckpointIdentityCorrect: true,
      optimizationTrends: trends,
      terminalRoadAndWaterPassed: true,
      terminalFailedClasses: OBJECT_CLASSES,
      terminalMaskedLumaCorrelation: FINAL_LUMA,
      directWiringDefectEvidence: false,
      directFeatureRgbBoundaryDefectEvidence: false,
    },
    alternatives: {
      B: { status: "not_selected", reason: "The 48-record train identities, both shared replay objectives, 8-record validation identities, rollout seeds, total-loss metrics, and checkpoint metrics are present and internally consistent." },
      C: { status: "not_confirmed", reason: "The run proves an optimization-to-visual-outcome gap, but it does not prove a broken Autoencoder-feature-to-decoded-RGB computation boundary; the objective is measured and improves on the final decoded path." },
      D: { status: "not_selected", reason: "The immutable execution, metric, review, telemetry, and identity evidence is sufficient to rule out a missing activation or population identity defect and select A." },
    },
    resolution: {
      action: "exit_current_candidate_and_request_project_level_owner_decision",
      currentCandidateMayBeRerun: false,
      newTrainingObjectiveMayBeAutoGenerated: false,
      newModelMayBeAutoGenerated: false,
      freeHyperparametersAllowed: false,
    },
    metrics,
    reviews,
  }
}
