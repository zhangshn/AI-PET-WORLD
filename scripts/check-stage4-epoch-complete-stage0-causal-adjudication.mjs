import assert from "node:assert/strict"
import { ALL_CLASSES, FAILED_CLASSES, REVIEW_EPOCHS, SOURCE_RUN_ID, adjudicateEpochCompleteStage0Failure } from "./lib/ai-painter-stage4-epoch-complete-stage0-causal-adjudication.mjs"

const contract = {
  enabled: true,
  status: "training_loss_active_owner_authorized",
  contractId: "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1",
  trainingSelection: { population: "all_48_train_split_records_in_one_completed_epoch", additionalOptimizerSteps: 0 },
  checkpointQualification: { population: "all_8_validation_records_all_existing_rollout_seeds", entersQualificationScore: true },
  activationGate: { trainingNow: true, stage4FullTrainingNow: true, smokeNow: false },
}
const selection = (kind, epoch) => ALL_CLASSES.map((classIdentity, index) => ({ classIdentity, sampleId: `${kind}-${classIdentity}-${epoch}`, seedIndex: kind === "train" ? null : index % 2, rawScore: 1 - epoch / 100 + index / 100, weightedScore: 0.2 - epoch / 1000 + index / 1000 }))
function fixture() {
  const checkpoint = { path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/training-output/complete-world-ai-assisted-conditional-denoiser.pt`, sha256: "f".repeat(64) }
  const metrics = REVIEW_EPOCHS.map((epoch, index) => ({
    epoch,
    validationCheckpointSelectionScore: 8 - index * 0.5,
    trainCompositeLoss: 5 - index * 0.4,
    validationFixedGridVelocityLoss: 2 - index * 0.1,
    trainStage4FullRolloutPerClassFinalVisibleLuminanceStructureWeightedLoss: 0.15 - index * 0.02,
    trainStage4EpochCompletePerClassSelectedLuminanceReplayLoss: index === 0 ? null : 0.05 - index * 0.006,
    trainStage4EpochCompletePerClassSelectionIdentityCount: 48,
    trainStage4EpochWorstSampleClassReplayPasses: 2,
    validationRolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointIdentityCount: 16,
    trainEpochCompletePerClassWorstSampleFinalVisibleLuminanceSelections: selection("train", epoch),
    validationRolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointSelections: selection("validation", epoch),
    stage4CheckpointRouteWestBoundaryNonRegressionPassed: index % 2 === 0,
    bestCheckpointUpdated: index % 2 === 0,
  }))
  const finalLuma = { footprints: 0.0694, tree: 0.0225, rock: 0.0934, vegetation: 0.0716 }
  return {
    terminal: { status: "semantic_mixture_stage4_formal_stage_failed_closed", runId: SOURCE_RUN_ID, stage: 0, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, checkpoint },
    manifest: { status: "conditional_denoiser_training_completed_pending_validation", actualLoadedSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 }, modelStateHashEvidence: { weightsChanged: true }, stage4UnifiedTrainingPreviewSampling: { previewSha256Matches: true, denoiserStateIdentityMatches: true }, checkpointPath: checkpoint.path, checkpointSha256: checkpoint.sha256, metrics },
    review: { reviewThresholdsChanged: false, previewCount: 6, previewPassCount: 0, previewFailCount: 6, reviews: REVIEW_EPOCHS.map((epoch) => ({ epoch, passed: false, issueCodes: epoch === 40 ? FAILED_CLASSES.map((name) => `condition_object_${name}_reference_semantic_mismatch`) : ALL_CLASSES.map((name) => `condition_object_${name}_reference_semantic_mismatch`), conditionAlignment: { objectSemanticAudits: ALL_CLASSES.map((name) => ({ channelId: `object_${name}`, passed: epoch === 40 && name === "rock", localResponsePassed: true, referenceResponse: { maskedRgbMae: 0.1, maskedEdgeMae: 0.08, maskedLumaCorrelation: epoch === 40 ? finalLuma[name] : -0.05 }, referenceThresholds: { minimumMaskedLumaCorrelation: 0.08 } })) } })) },
    activeConfig: { training: { stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity: contract } },
    failedCheckpointIdentity: checkpoint,
    telemetryInspection: { stepIdentity: "epoch_complete_per_class_selected_luminance_replay", totalEvents: 3744, epochs: Array.from({ length: 39 }, (_, i) => i + 2), eachEpochHas48BatchesAnd96Events: true, eachEpochHasTwoPasses: true, eachEpochHas24EventsPerClass: true, matchesPreviousEpochSelections: true, unknownOrMalformedEvents: 0 },
    sourceIndexInspection: { trainCount: 48, validationCount: 8, rolloutSeedCount: 2, allTrainSelectionsBelongToTrain: true, allValidationSelectionsBelongToValidation: true },
    directClassInterferenceEvidence: false,
  }
}

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => { const value = structuredClone(fixture()); mutate(value); assert.throws(() => adjudicateEpochCompleteStage0Failure(value), pattern); negatives.push(name) }

positive("selects_A_after_complete_epoch_wiring_is_proven", () => assert.equal(adjudicateEpochCompleteStage0Failure(fixture()).selectedCause, "A"))
positive("preserves_exact_epoch40_luma_identity", () => assert.deepEqual(adjudicateEpochCompleteStage0Failure(fixture()).evidence.terminalMaskedLumaCorrelation, { footprints: 0.0694, tree: 0.0225, vegetation: 0.0716 }))
positive("rejects_B_after_population_identity_is_complete", () => assert.equal(adjudicateEpochCompleteStage0Failure(fixture()).alternatives.B.status, "not_selected"))
positive("does_not_infer_C_without_direct_evidence", () => assert.equal(adjudicateEpochCompleteStage0Failure(fixture()).alternatives.C.status, "not_confirmed"))
positive("preserves_six_epoch_timeline", () => assert.deepEqual(adjudicateEpochCompleteStage0Failure(fixture()).metrics.map((row) => row.epoch), REVIEW_EPOCHS))

negative("rejects_historical_run", (v) => { v.terminal.runId = "20260821-064100000" }, /current_run_identity_required/)
negative("rejects_checkpoint_substitution", (v) => { v.manifest.checkpointSha256 = "e".repeat(64) }, /checkpoint_sha_identity_mismatch/)
negative("rejects_split_change", (v) => { v.manifest.actualLoadedSplitCounts.train = 47 }, /deep-equal/)
negative("rejects_threshold_change", (v) => { v.review.reviewThresholdsChanged = true }, /review_thresholds_changed/)
negative("rejects_missing_epoch", (v) => { v.manifest.metrics.splice(2, 1) }, /metric_missing/)
negative("rejects_incomplete_train_population", (v) => { v.manifest.metrics[0].trainStage4EpochCompletePerClassSelectionIdentityCount = 47 }, /train_coverage_invalid/)
negative("rejects_replay_pass_change", (v) => { v.manifest.metrics[1].trainStage4EpochWorstSampleClassReplayPasses = 1 }, /replay_passes_invalid/)
negative("rejects_validation_population_change", (v) => { v.manifest.metrics[0].validationRolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointIdentityCount = 15 }, /validation_coverage_invalid/)
negative("rejects_missing_class_identity", (v) => { v.manifest.metrics[0].trainEpochCompletePerClassWorstSampleFinalVisibleLuminanceSelections.pop() }, /train_class_order_invalid/)
negative("rejects_wrong_class_order", (v) => { v.manifest.metrics[0].validationRolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointSelections.reverse() }, /validation_class_order_invalid/)
negative("rejects_train_selection_outside_split", (v) => { v.sourceIndexInspection.allTrainSelectionsBelongToTrain = false }, /outside_train_split/)
negative("rejects_validation_selection_outside_split", (v) => { v.sourceIndexInspection.allValidationSelectionsBelongToValidation = false }, /outside_validation_split/)
negative("rejects_incomplete_telemetry", (v) => { v.telemetryInspection.totalEvents = 3743 }, /telemetry_total_invalid/)
negative("rejects_wrong_replay_schedule", (v) => { v.telemetryInspection.eachEpochHas24EventsPerClass = false }, /class_schedule_invalid/)
negative("rejects_replay_identity_mismatch", (v) => { v.telemetryInspection.matchesPreviousEpochSelections = false }, /selection_identity_mismatch/)
negative("rejects_epoch40_rock_failure", (v) => { v.review.reviews.at(-1).conditionAlignment.objectSemanticAudits[2].passed = false }, /rock_must_pass/)
negative("rejects_epoch40_footprints_identity_change", (v) => { v.review.reviews.at(-1).conditionAlignment.objectSemanticAudits[0].referenceResponse.maskedLumaCorrelation = 0.07 }, /luma_identity_changed/)
negative("rejects_direct_interference_without_separate_contract", (v) => { v.directClassInterferenceEvidence = true }, /direct_formal_evidence/)

console.log(JSON.stringify({ schemaVersion: "stage4-epoch-complete-stage0-causal-cpu-report-v1", status: "passed", positivePassed: positives.length, positiveTotal: positives.length, negativePassed: negatives.length, negativeTotal: negatives.length, positives, negatives }, null, 2))
