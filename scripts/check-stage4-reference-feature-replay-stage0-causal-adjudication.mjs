import assert from "node:assert/strict"
import {
  OBJECT_CLASSES,
  REVIEW_EPOCHS,
  adjudicateReferenceFeatureReplayStage0Failure,
} from "./lib/ai-painter-stage4-reference-feature-replay-stage0-causal-adjudication.mjs"

const classTitle = (name) => `${name[0].toUpperCase()}${name.slice(1)}`

function fixture() {
  const metrics = REVIEW_EPOCHS.map((epoch, index) => {
    const factor = 1 - index * 0.12
    const row = {
      epoch,
      validationCheckpointSelectionScore: 7 - index * 0.3,
      trainStage4PerClassFinalVisibleReferenceFeatureStructureWeightedLoss: 0.45 * factor,
      trainStage4EpochWorstSampleClassReplayReferenceFeatureStructureWeightedLoss: 0.13 * factor,
      trainStage4EpochWorstSampleClassSelectionScore: 0.16 * factor,
      trainStage4EpochWorstSampleClassReplayPasses: 2,
      trainStage4EpochWorstSampleClassReplayClassIndex: index % 4,
      stage4CheckpointRouteWestBoundaryNonRegressionPassed: index === 0,
      bestCheckpointUpdated: index === 0,
    }
    for (const name of OBJECT_CLASSES) {
      row[`trainStage4PerClassFinalVisible${classTitle(name)}ReferenceFeatureStructureLoss`] = 1.4 * factor
      row[`validationRollout${classTitle(name)}FinalVisibleReferenceFeatureStructureLoss`] = 1.3 * factor
    }
    return row
  })
  const checkpoint = {
    path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260820-214000000/training-output/complete-world-ai-assisted-conditional-denoiser.pt",
    sha256: "5".repeat(64),
  }
  const activeGate = {
    configurationActiveNow: true,
    trainingNow: true,
    stage4FullTrainingNow: true,
    smokeNow: false,
  }
  return {
    activeConfig: {
      training: {
        stage4PerClassFinalVisibleReferenceFeatureStructureObligation: {
          enabled: true,
          status: "training_loss_active_owner_authorized",
          activationGate: { ...activeGate },
        },
        stage4EpochWorstSampleClassReferenceFeatureStructureReplay: {
          enabled: true,
          status: "training_loss_active_owner_authorized",
          sourceContracts: {
            perSampleClassTensorSource: "stage4_per_class_final_visible_reference_feature_structure_obligation_losses.perSampleClassTensors",
          },
          selection: { classIdentities: [...OBJECT_CLASSES] },
          replay: {
            loss: "same_selected_reference_feature_structure_sample_class_tensor",
            recomputeFromSameBoundSampleAndClass: true,
            addsReplayPasses: false,
            addsOptimizerSteps: false,
          },
          activationGate: { ...activeGate },
        },
      },
    },
    terminal: {
      status: "semantic_mixture_stage4_formal_stage_failed_closed",
      stage: 0,
      runId: "20260820-214000000",
      blockers: ["stage_0_visual_review_failed_0_of_6"],
      fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
      checkpoint: { ...checkpoint },
    },
    manifest: {
      status: "conditional_denoiser_training_completed_pending_validation",
      actualLoadedSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
      modelStateHashEvidence: { weightsChanged: true },
      stage4UnifiedTrainingPreviewSampling: { previewSha256Matches: true, denoiserStateIdentityMatches: true },
      checkpointPath: checkpoint.path,
      checkpointSha256: checkpoint.sha256,
      metrics,
    },
    review: {
      reviewThresholdsChanged: false,
      previewCount: 6,
      previewPassCount: 0,
      previewFailCount: 6,
      reviews: REVIEW_EPOCHS.map((epoch) => ({
        epoch,
        passed: false,
        issueCodes: OBJECT_CLASSES.map((name) => `condition_object_${name}_reference_semantic_mismatch`),
      })),
    },
    failedCheckpointIdentity: checkpoint,
    directClassGradientConflictEvidence: false,
  }
}

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => {
  const value = structuredClone(fixture())
  mutate(value)
  assert.throws(() => adjudicateReferenceFeatureReplayStage0Failure(value), pattern)
  negatives.push(name)
}

positive("selects_A_for_active_but_insufficient_replay", () => {
  const decision = adjudicateReferenceFeatureReplayStage0Failure(fixture())
  assert.equal(decision.selectedCause, "A")
  assert.equal(decision.nextContractId, "stage4_per_class_worst_sample_reference_feature_structure_obligation_v1")
})
positive("rejects_B_as_wiring_defect", () => assert.equal(adjudicateReferenceFeatureReplayStage0Failure(fixture()).alternatives.B.status, "not_confirmed"))
positive("rejects_C_without_direct_gradient_evidence", () => assert.equal(adjudicateReferenceFeatureReplayStage0Failure(fixture()).alternatives.C.status, "not_confirmed"))
positive("records_complete_review_timeline", () => assert.deepEqual(adjudicateReferenceFeatureReplayStage0Failure(fixture()).reviewTimeline.map((row) => row.epoch), REVIEW_EPOCHS))
positive("records_complete_metric_timeline", () => assert.equal(adjudicateReferenceFeatureReplayStage0Failure(fixture()).metricTimeline.length, 6))

negative("rejects_historical_run", (v) => { v.terminal.runId = "20260817-144141271" }, /current_run_identity_required/)
negative("rejects_checkpoint_identity_replacement", (v) => { v.manifest.checkpointSha256 = "6".repeat(64) }, /Expected values to be strictly equal/)
negative("rejects_missing_replay_contract", (v) => { delete v.activeConfig.training.stage4EpochWorstSampleClassReferenceFeatureStructureReplay }, /replay_not_enabled/)
negative("rejects_inactive_reference_feature_obligation", (v) => { v.activeConfig.training.stage4PerClassFinalVisibleReferenceFeatureStructureObligation.status = "cpu_support_verified_inactive" }, /status_invalid/)
negative("rejects_smoke_residue", (v) => { v.activeConfig.training.stage4EpochWorstSampleClassReferenceFeatureStructureReplay.activationGate.smokeNow = true }, /smoke_residue_present/)
negative("rejects_wrong_tensor_source", (v) => { v.activeConfig.training.stage4EpochWorstSampleClassReferenceFeatureStructureReplay.sourceContracts.perSampleClassTensorSource = "historical_tensor" }, /Expected values to be strictly equal/)
negative("rejects_wrong_replay_loss", (v) => { v.activeConfig.training.stage4EpochWorstSampleClassReferenceFeatureStructureReplay.replay.loss = "legacy_loss" }, /Expected values to be strictly equal/)
negative("rejects_added_optimizer_steps", (v) => { v.activeConfig.training.stage4EpochWorstSampleClassReferenceFeatureStructureReplay.replay.addsOptimizerSteps = true }, /Expected values to be strictly equal/)
negative("rejects_review_epoch_change", (v) => { v.review.reviews[1].epoch = 6 }, /review_epoch_timeline_invalid/)
negative("rejects_threshold_change", (v) => { v.review.reviewThresholdsChanged = true }, /review_thresholds_changed/)
negative("rejects_unexpected_review_pass", (v) => { v.review.previewPassCount = 1 }, /unexpected_review_pass/)
negative("rejects_missing_terminal_object_failure", (v) => { v.review.reviews.at(-1).issueCodes.pop() }, /Expected values to be strictly equal/)
negative("rejects_zero_replay_loss", (v) => { v.manifest.metrics[2].trainStage4EpochWorstSampleClassReplayReferenceFeatureStructureWeightedLoss = 0 }, /replay_not_active_every_review_epoch/)
negative("rejects_wrong_replay_pass_count", (v) => { v.manifest.metrics[4].trainStage4EpochWorstSampleClassReplayPasses = 1 }, /replay_not_active_every_review_epoch/)
negative("rejects_non_improving_train_class", (v) => { v.manifest.metrics.at(-1).trainStage4PerClassFinalVisibleTreeReferenceFeatureStructureLoss = 2 }, /train_class_feature_losses_do_not_all_improve/)
negative("rejects_non_improving_validation_class", (v) => { v.manifest.metrics.at(-1).validationRolloutRockFinalVisibleReferenceFeatureStructureLoss = 2 }, /validation_class_feature_losses_do_not_all_improve/)
negative("rejects_direct_gradient_conflict_for_A", (v) => { v.directClassGradientConflictEvidence = true }, /Expected values to be strictly equal/)
negative("rejects_split_change", (v) => { v.manifest.actualLoadedSplitCounts.train = 47 }, /Expected values to be strictly deep-equal/)
negative("rejects_missing_weight_change", (v) => { v.manifest.modelStateHashEvidence.weightsChanged = false }, /Expected values to be strictly equal/)
negative("rejects_preview_reproduction_mismatch", (v) => { v.manifest.stage4UnifiedTrainingPreviewSampling.previewSha256Matches = false }, /Expected values to be strictly equal/)

console.log(JSON.stringify({
  schemaVersion: "stage4-reference-feature-replay-stage0-causal-cpu-report-v1",
  status: "passed",
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
}, null, 2))
