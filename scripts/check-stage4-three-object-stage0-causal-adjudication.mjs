import assert from "node:assert/strict"
import {
  ALL_CLASSES,
  FAILED_CLASSES,
  REVIEW_EPOCHS,
  SOURCE_RUN_ID,
  adjudicateThreeObjectStage0Failure,
} from "./lib/ai-painter-stage4-three-object-stage0-causal-adjudication.mjs"

const title = (value) => `${value[0].toUpperCase()}${value.slice(1)}`
const activeGate = () => ({ configurationActiveNow: true, trainingNow: true, stage4FullTrainingNow: true, smokeNow: false })
const contract = (contractId, extra = {}) => ({ enabled: true, status: "training_loss_active_owner_authorized", contractId, activationGate: activeGate(), ...extra })

function fixture() {
  const factorByIndex = [1, 0.92, 0.84, 0.68, 0.42, 0.26]
  const metrics = REVIEW_EPOCHS.map((epoch, index) => {
    const factor = factorByIndex[index]
    const row = {
      epoch,
      validationCheckpointSelectionScore: 7.3 - index * 0.35,
      validationRolloutPerClassWorstSampleFinalVisibleLuminanceStructureCheckpointObligation: 0.2 - index * 0.01,
      validationRolloutPerClassWorstSampleReferenceFeatureStructureCheckpointObligation: 0.54 - index * 0.04,
      trainStage4PerClassWorstSampleFinalVisibleLuminanceStructureWeightedLoss: 0.15 * factor,
      trainStage4PerClassWorstSampleReferenceFeatureStructureWeightedLoss: 0.45 * factor,
      trainStage4EpochWorstSampleClassReplayReferenceFeatureStructureWeightedLoss: 0.13 * factor,
      trainStage4EpochWorstSampleClassReplayPasses: 2,
      trainStage4EpochWorstSampleClassSelectionScore: 0.17 * factor,
      stage4CheckpointRouteWestBoundaryNonRegressionPassed: index === 0,
      bestCheckpointUpdated: index === 0,
    }
    for (const name of ALL_CLASSES) {
      row[`trainStage4PerClassWorstSample${title(name)}FinalVisibleLuminanceStructureLoss`] = 0.12 * factor
      row[`trainStage4PerClassWorstSample${title(name)}ReferenceFeatureStructureLoss`] = 1.5 * factor
    }
    return row
  })
  const checkpoint = {
    path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/training-output/complete-world-ai-assisted-conditional-denoiser.pt`,
    sha256: "b".repeat(64),
  }
  const objectAudit = (name, epoch) => ({
    channelId: `object_${name}`,
    passed: epoch === 40 ? name === "vegetation" : false,
    localResponsePassed: true,
    referenceResponse: { maskedRgbMae: 0.1, maskedEdgeMae: 0.08, maskedLumaCorrelation: name === "vegetation" && epoch === 40 ? 0.09 : 0.04 },
  })
  return {
    activeConfig: { training: {
      batchSize: 1,
      stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation: contract(
        "stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1",
        {
          selection: { trainingPopulation: "all_48_train_split_records", checkpointPopulation: "all_8_validation_split_records", sampleIdentity: "dataset_sampleId" },
          totalLoss: { entersExistingFullRolloutLossSlot: true },
          checkpointQualification: { entersQualificationScore: true },
        },
      ),
      stage4PerClassFinalVisibleReferenceFeatureStructureObligation: contract("stage4_per_class_final_visible_reference_feature_structure_obligation_v1"),
      stage4PerClassWorstSampleReferenceFeatureStructureObligation: contract("stage4_per_class_worst_sample_reference_feature_structure_obligation_v1"),
      stage4EpochWorstSampleClassReferenceFeatureStructureReplay: contract("stage4_epoch_worst_sample_class_reference_feature_structure_replay_v1"),
    } },
    terminal: { status: "semantic_mixture_stage4_formal_stage_failed_closed", stage: 0, runId: SOURCE_RUN_ID, blockers: ["stage_0_visual_review_failed_0_of_6"], fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, checkpoint: { ...checkpoint } },
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
        issueCodes: epoch === 40
          ? FAILED_CLASSES.map((name) => `condition_object_${name}_reference_semantic_mismatch`)
          : ALL_CLASSES.map((name) => `condition_object_${name}_reference_semantic_mismatch`),
        conditionAlignment: { objectSemanticAudits: ALL_CLASSES.map((name) => objectAudit(name, epoch)) },
      })),
    },
    failedCheckpointIdentity: checkpoint,
    implementationInspection: {
      trainingBatchSize: 1,
      selectionInvokedInsidePrimaryBatchLoop: true,
      selectionReceivesOnlyCurrentBatchSampleIds: true,
      epochWideTrainingSelectionAccumulatorPresent: false,
      validationPerClassMaximumPresent: true,
      validationSelectionIdentityPersisted: false,
    },
    directClassGradientConflictEvidence: false,
  }
}

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => {
  const value = structuredClone(fixture())
  mutate(value)
  assert.throws(() => adjudicateThreeObjectStage0Failure(value), pattern)
  negatives.push(name)
}

positive("selects_B_for_batch_local_selector_identity_defect", () => assert.equal(adjudicateThreeObjectStage0Failure(fixture()).selectedCause, "B"))
positive("preserves_epoch40_road_water_vegetation_pass", () => assert.equal(adjudicateThreeObjectStage0Failure(fixture()).evidence.terminalRoadWaterVegetationPassed, true))
positive("records_all_six_metric_epochs", () => assert.deepEqual(adjudicateThreeObjectStage0Failure(fixture()).metrics.map((row) => row.epoch), REVIEW_EPOCHS))
positive("records_all_six_review_epochs", () => assert.deepEqual(adjudicateThreeObjectStage0Failure(fixture()).reviews.map((row) => row.epoch), REVIEW_EPOCHS))
positive("rejects_A_until_selector_contract_is_real", () => assert.equal(adjudicateThreeObjectStage0Failure(fixture()).alternatives.A.status, "not_selected"))
positive("rejects_C_without_direct_gradient_evidence", () => assert.equal(adjudicateThreeObjectStage0Failure(fixture()).alternatives.C.status, "not_confirmed"))

negative("rejects_historical_run", (v) => { v.terminal.runId = "20260820-214000000" }, /current_run_identity_required/)
negative("rejects_checkpoint_sha_change", (v) => { v.manifest.checkpointSha256 = "c".repeat(64) }, /checkpoint_sha_identity_mismatch/)
negative("rejects_split_change", (v) => { v.manifest.actualLoadedSplitCounts.train = 47 }, /deep-equal/)
negative("rejects_threshold_change", (v) => { v.review.reviewThresholdsChanged = true }, /review_thresholds_changed/)
negative("rejects_epoch40_vegetation_failure", (v) => { v.review.reviews.at(-1).issueCodes.push("condition_object_vegetation_reference_semantic_mismatch") }, /epoch40_business_identity_invalid/)
negative("rejects_epoch40_road_failure", (v) => { v.review.reviews.at(-1).issueCodes.push("condition_terrain_path_ground_required_boundary_contact_missing") }, /epoch40_business_identity_invalid/)
negative("rejects_missing_tree_failure", (v) => { v.review.reviews.at(-1).issueCodes = v.review.reviews.at(-1).issueCodes.filter((x) => !x.includes("tree")) }, /epoch40_business_identity_invalid/)
negative("rejects_local_response_failure", (v) => { v.review.reviews.at(-1).conditionAlignment.objectSemanticAudits[1].localResponsePassed = false }, /terminal_local_response_not_passed/)
negative("rejects_inactive_luminance_contract", (v) => { v.activeConfig.training.stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation.status = "cpu_support_verified_inactive" }, /status_invalid/)
negative("rejects_wrong_training_population", (v) => { v.activeConfig.training.stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation.selection.trainingPopulation = "current_batch" }, /training_population_contract_changed/)
negative("rejects_missing_total_loss_entry", (v) => { v.activeConfig.training.stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation.totalLoss.entersExistingFullRolloutLossSlot = false }, /luminance_not_in_total_loss_contract/)
negative("rejects_missing_checkpoint_entry", (v) => { v.activeConfig.training.stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation.checkpointQualification.entersQualificationScore = false }, /luminance_not_in_checkpoint_contract/)
negative("rejects_selection_outside_batch_loop", (v) => { v.implementationInspection.selectionInvokedInsidePrimaryBatchLoop = false }, /selection_call_location_not_verified/)
negative("rejects_epoch_accumulator_present", (v) => { v.implementationInspection.epochWideTrainingSelectionAccumulatorPresent = true }, /defect_not_confirmed/)
negative("rejects_persisted_validation_identity", (v) => { v.implementationInspection.validationSelectionIdentityPersisted = true }, /defect_not_confirmed/)
negative("rejects_non_improving_footprints_luminance", (v) => { v.manifest.metrics.at(-1).trainStage4PerClassWorstSampleFootprintsFinalVisibleLuminanceStructureLoss = 2 }, /luminance_did_not_improve/)
negative("rejects_non_improving_tree_feature", (v) => { v.manifest.metrics.at(-1).trainStage4PerClassWorstSampleTreeReferenceFeatureStructureLoss = 2 }, /reference_feature_did_not_improve/)
negative("rejects_non_improving_validation_luminance", (v) => { v.manifest.metrics.at(-1).validationRolloutPerClassWorstSampleFinalVisibleLuminanceStructureCheckpointObligation = 1 }, /validation_luminance_did_not_improve/)
negative("rejects_missing_replay", (v) => { v.manifest.metrics[2].trainStage4EpochWorstSampleClassReplayPasses = 0 }, /replay_not_active/)
negative("rejects_direct_class_conflict_for_B", (v) => { v.directClassGradientConflictEvidence = true }, /direct_class_interference_requires_separate_decision/)

console.log(JSON.stringify({
  schemaVersion: "stage4-three-object-stage0-causal-cpu-report-v1",
  status: "passed",
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
}, null, 2))
