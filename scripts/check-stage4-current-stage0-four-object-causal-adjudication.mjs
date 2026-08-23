import assert from "node:assert/strict"
import { CONTRACT_ID, FINAL_LUMA, OBJECT_CLASSES, REVIEW_EPOCHS, SOURCE_RUN_ID, adjudicateCurrentStage0Failure } from "./lib/ai-painter-stage4-current-stage0-four-object-causal-adjudication.mjs"

const selection = (kind, epoch) => OBJECT_CLASSES.map((classIdentity, index) => ({ classIdentity, sampleId: `${kind}-${classIdentity}-${epoch}`, seedIndex: kind === "train" ? null : index % 2, rawScore: 2 - epoch / 100 + index / 10, weightedScore: 0.5 - epoch / 1000 + index / 100 }))
function fixture() {
  const checkpoint = { path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/training-output/complete-world-ai-assisted-conditional-denoiser.pt`, sha256: "3".repeat(64) }
  const metrics = REVIEW_EPOCHS.map((epoch, index) => ({
    epoch,
    trainCompositeLoss: 6 - index * 0.4,
    validationCheckpointSelectionScore: 7.2 - index * 0.3,
    trainStage4PerClassFinalVisibleReferenceFeatureStructureWeightedLoss: 0.45 - index * 0.05,
    trainStage4PerClassWorstSampleReferenceFeatureStructureWeightedLoss: 0.45 - index * 0.05,
    trainStage4EpochCompletePerClassSelectedReferenceFeatureReplayLoss: index === 0 ? null : 0.06 - index * 0.008,
    trainStage4EpochCompletePerClassSelectedLuminanceReplayLoss: index === 0 ? null : 0.025 - index * 0.003,
    trainStage4EpochCompletePerClassSelectionIdentityCount: 48,
    trainStage4EpochCompletePerClassReferenceFeatureSelectionIdentityCount: 48,
    trainStage4EpochWorstSampleClassReplayPasses: 2,
    validationRolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointIdentityCount: 16,
    validationRolloutEpochCompletePerClassWorstSampleReferenceFeatureStructureCheckpointIdentityCount: 16,
    trainEpochCompletePerClassWorstSampleReferenceFeatureStructureSelections: selection("train", epoch),
    validationRolloutEpochCompletePerClassWorstSampleReferenceFeatureStructureCheckpointSelections: selection("validation", epoch),
  }))
  const contract = {
    enabled: true,
    status: "training_loss_active_owner_authorized",
    contractId: CONTRACT_ID,
    epochSelection: { population: "all_48_train_records_in_one_completed_epoch", classIdentities: [...OBJECT_CLASSES] },
    sharedReplay: { objectiveOrder: ["luminance", "reference_feature_structure"], addsOptimizerSteps: false, addsReplayPasses: false },
    checkpointQualification: { population: "all_8_validation_records_all_existing_rollout_seeds", entersQualificationScore: true },
    legalSupervision: { failedPreviewPixelsUsedAsTargets: false, machineReviewThresholdsUsedAsTargets: false, machineReviewResultsUsedAsTargets: false },
    activationGate: { trainingNow: true, stage4FullTrainingNow: true, smokeNow: false },
  }
  return {
    terminal: { status: "semantic_mixture_stage4_formal_stage_failed_closed", runId: SOURCE_RUN_ID, stage: 0, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, checkpoint },
    manifest: { status: "conditional_denoiser_training_completed_pending_validation", actualLoadedSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 }, modelStateHashEvidence: { weightsChanged: true }, stage4UnifiedTrainingPreviewSampling: { previewSha256Matches: true, denoiserStateIdentityMatches: true }, checkpointPath: checkpoint.path, checkpointSha256: checkpoint.sha256, metrics },
    review: { reviewThresholdsChanged: false, previewCount: 6, previewPassCount: 0, previewFailCount: 6, reviews: REVIEW_EPOCHS.map((epoch) => ({ epoch, passed: false, issueCodes: OBJECT_CLASSES.map((name) => `condition_object_${name}_reference_semantic_mismatch`), conditionAlignment: { objectSemanticAudits: OBJECT_CLASSES.map((name) => ({ channelId: `object_${name}`, passed: false, localResponsePassed: true, referenceResponse: { maskedRgbMae: 0.1, maskedEdgeMae: 0.08, maskedLumaCorrelation: epoch === 40 ? FINAL_LUMA[name] : -0.05 }, referenceThresholds: { minimumMaskedLumaCorrelation: 0.08 } })) } })) },
    activeConfig: { training: { stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay: contract } },
    failedCheckpointIdentity: checkpoint,
    telemetryInspection: { luminanceStepIdentity: "epoch_complete_per_class_selected_luminance_replay", referenceStepIdentity: "epoch_complete_per_class_selected_reference_feature_replay", luminanceEventCount: 1872, referenceEventCount: 1872, epochsComplete: true, batchCoverageComplete: true, objectivePassIdentityCorrect: true, classRotationCorrect: true, matchesPriorEpochSelections: true, unknownOrMalformedEvents: 0 },
    sourceIndexInspection: { trainCount: 48, validationCount: 8, challengeCount: 4, regressionCount: 4, rolloutSeedCount: 2, allTrainSelectionsBound: true, allValidationSelectionsBound: true },
    directWiringDefectEvidence: false,
    directFeatureRgbBoundaryDefectEvidence: false,
  }
}

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => { const value = structuredClone(fixture()); mutate(value); assert.throws(() => adjudicateCurrentStage0Failure(value), pattern); negatives.push(name) }

positive("selects_A_after_complete_activation_and_improving_losses", () => assert.equal(adjudicateCurrentStage0Failure(fixture()).selectedCause, "A"))
positive("preserves_exact_four_class_terminal_luma", () => assert.deepEqual(adjudicateCurrentStage0Failure(fixture()).evidence.terminalMaskedLumaCorrelation, FINAL_LUMA))
positive("rejects_B_without_direct_wiring_evidence", () => assert.equal(adjudicateCurrentStage0Failure(fixture()).alternatives.B.status, "not_selected"))
positive("does_not_infer_C_from_visual_failure_alone", () => assert.equal(adjudicateCurrentStage0Failure(fixture()).alternatives.C.status, "not_confirmed"))
positive("exits_current_candidate_without_auto_generated_target", () => assert.equal(adjudicateCurrentStage0Failure(fixture()).resolution.newTrainingObjectiveMayBeAutoGenerated, false))

negative("rejects_historical_run", (v) => { v.terminal.runId = "20260821-000000000" }, /current_run_identity_required/)
negative("rejects_checkpoint_identity_substitution", (v) => { v.manifest.checkpointSha256 = "4".repeat(64) }, /checkpoint_sha_identity_mismatch/)
negative("rejects_split_change", (v) => { v.manifest.actualLoadedSplitCounts.train = 47 }, /deep-equal/)
negative("rejects_threshold_change", (v) => { v.review.reviewThresholdsChanged = true }, /review_thresholds_changed/)
negative("rejects_missing_epoch", (v) => { v.manifest.metrics.splice(2, 1) }, /metric_missing/)
negative("rejects_inactive_reference_contract", (v) => { v.activeConfig.training.stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay.status = "cpu_support_verified_inactive" }, /status_invalid/)
negative("rejects_missing_train_identity", (v) => { v.manifest.metrics[0].trainStage4EpochCompletePerClassReferenceFeatureSelectionIdentityCount = 47 }, /reference_train_coverage_invalid/)
negative("rejects_wrong_class_order", (v) => { v.manifest.metrics[0].trainEpochCompletePerClassWorstSampleReferenceFeatureStructureSelections.reverse() }, /train_reference_class_order_invalid/)
negative("rejects_validation_identity_gap", (v) => { v.manifest.metrics[0].validationRolloutEpochCompletePerClassWorstSampleReferenceFeatureStructureCheckpointIdentityCount = 15 }, /reference_validation_coverage_invalid/)
negative("rejects_luminance_replay_count_change", (v) => { v.telemetryInspection.luminanceEventCount = 1871 }, /luminance_replay_count_invalid/)
negative("rejects_reference_replay_count_change", (v) => { v.telemetryInspection.referenceEventCount = 1871 }, /reference_replay_count_invalid/)
negative("rejects_replay_identity_mismatch", (v) => { v.telemetryInspection.matchesPriorEpochSelections = false }, /selection_identity_mismatch/)
negative("rejects_failed_preview_target", (v) => { v.activeConfig.training.stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay.legalSupervision.failedPreviewPixelsUsedAsTargets = true }, /failed_preview_target_forbidden/)
negative("rejects_review_result_target", (v) => { v.activeConfig.training.stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay.legalSupervision.machineReviewResultsUsedAsTargets = true }, /review_result_target_forbidden/)
negative("rejects_epoch40_road_failure", (v) => { v.review.reviews.at(-1).issueCodes.unshift("condition_terrain_path_ground_required_boundary_contact_missing") }, /epoch40_issue_identity_invalid/)
negative("rejects_epoch40_luma_change", (v) => { v.review.reviews.at(-1).conditionAlignment.objectSemanticAudits[0].referenceResponse.maskedLumaCorrelation = 0.0438 }, /luma_identity_changed/)
negative("rejects_unproven_B_injection", (v) => { v.directWiringDefectEvidence = true }, /direct_wiring_defect_requires_separate_evidence/)
negative("rejects_unproven_C_injection", (v) => { v.directFeatureRgbBoundaryDefectEvidence = true }, /feature_rgb_boundary_defect_requires_separate_evidence/)

console.log(JSON.stringify({ schemaVersion: "stage4-current-stage0-four-object-causal-cpu-report-v1", status: "passed", positivePassed: positives.length, positiveTotal: positives.length, negativePassed: negatives.length, negativeTotal: negatives.length, positives, negatives }, null, 2))
