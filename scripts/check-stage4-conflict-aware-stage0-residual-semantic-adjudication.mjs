import assert from "node:assert/strict"
import { ALL_OBJECT_CLASSES, CONTRACT_ID, FINAL_LUMA, RESIDUAL_CLASSES, REVIEW_EPOCHS, SOURCE_RUN_ID, adjudicateConflictAwareStage0Failure } from "./lib/ai-painter-stage4-conflict-aware-stage0-residual-semantic-adjudication.mjs"

function fixture() {
  const checkpoint = { path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/training-output/complete-world-ai-assisted-conditional-denoiser.pt`, sha256: "c".repeat(64) }
  const metrics = Array.from({ length: 40 }, (_, index) => {
    const epoch = index + 1
    const specialScores = { 1: 7.252712216589134, 5: 7.824399532719205, 10: 6.639776231740447, 20: 6.345526323209439, 30: 5.8695371518571235, 40: 5.372003858235742 }
    const negative = epoch === 40 ? 0.3125 : 1.5
    return {
      epoch,
      trainCompositeLoss: 8 - epoch / 20,
      validationCheckpointSelectionScore: specialScores[epoch] ?? 7 - epoch / 25,
      trainStage4ConflictAwareApplied: 1,
      trainStage4ConflictAwareNegativeProjectionCount: negative,
      trainStage4ConflictAwareNonNegativeUnchangedCount: 12 - negative,
      stage4CheckpointRouteWestBoundaryNonRegressionPassed: epoch !== 40,
      bestCheckpointUpdated: epoch === 1 || epoch === 30,
    }
  })
  const reviews = REVIEW_EPOCHS.map((epoch) => {
    const final = epoch === 40
    const issueCodes = final
      ? RESIDUAL_CLASSES.map((name) => `condition_object_${name}_reference_semantic_mismatch`)
      : [...ALL_OBJECT_CLASSES.map((name) => `condition_object_${name}_reference_semantic_mismatch`), ...(epoch === 30 ? ["condition_terrain_path_ground_required_boundary_contact_missing"] : [])]
    return {
      epoch,
      passed: false,
      issueCodes,
      conditionAlignment: {
        channelAudits: [
          { channelId: "terrain_water", passed: final || epoch >= 30 },
          { channelId: "terrain_path_ground", passed: final },
        ],
        objectSemanticAudits: ALL_OBJECT_CLASSES.map((name) => ({
          channelId: `object_${name}`,
          passed: final && name === "vegetation",
          localResponsePassed: true,
          referenceResponse: { maskedRgbMae: 0.1, maskedEdgeMae: 0.075, maskedLumaCorrelation: final ? FINAL_LUMA[name] : -0.05 },
          referenceThresholds: { minimumMaskedLumaCorrelation: 0.08 },
        })),
      },
    }
  })
  const contract = {
    enabled: true,
    status: "training_paradigm_active_owner_authorized",
    contractId: CONTRACT_ID,
    classOrder: [...ALL_OBJECT_CLASSES],
    gradientBoundary: { scope: "shared_parameters_only", nonSharedParametersUseExistingGradient: true },
    projection: { condition: "strict_dot_product_less_than_zero", numericTolerance: null, nonNegativeDotProductBehavior: "bitwise_unchanged" },
    optimizerBudget: { additionalOptimizerSteps: 0, additionalReplayPasses: 0 },
    checkpointQualification: { selectionContractChanged: false },
    legalTargets: { failedPreviewPixelsUsedAsTargets: false, machineReviewThresholdsUsedAsTargets: false, machineReviewResultsUsedAsTargets: false },
    activationGate: { trainingNow: true, stage4FullTrainingNow: true, smokeNow: false },
  }
  return {
    terminal: { status: "semantic_mixture_stage4_formal_stage_failed_closed", runId: SOURCE_RUN_ID, stage: 0, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, machineReview: { passCount: 0, failCount: 6 }, checkpoint },
    manifest: { status: "conditional_denoiser_training_completed_pending_validation", actualLoadedSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 }, modelStateHashEvidence: { weightsChanged: true }, stage4UnifiedTrainingPreviewSampling: { previewSha256Matches: true, denoiserStateIdentityMatches: true }, bestEpoch: 30, checkpointPath: checkpoint.path, checkpointSha256: checkpoint.sha256, metrics },
    review: { reviewThresholdsChanged: false, previewCount: 6, previewPassCount: 0, previewFailCount: 6, reviews },
    activeConfig: { training: { stage4ConflictAwareExistingGradientAggregation: contract } },
    failedCheckpointIdentity: checkpoint,
    directConflictWiringDefectEvidence: false,
    directResidualCapacityEvidence: false,
  }
}

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => { const value = structuredClone(fixture()); mutate(value); assert.throws(() => adjudicateConflictAwareStage0Failure(value), pattern); negatives.push(name) }

positive("selects_A_for_active_but_insufficient_paradigm", () => assert.equal(adjudicateConflictAwareStage0Failure(fixture()).selectedCause, "A"))
positive("preserves_three_residual_class_identity", () => assert.deepEqual(adjudicateConflictAwareStage0Failure(fixture()).evidence.terminalResidualClasses, RESIDUAL_CLASSES))
positive("records_checkpoint_identity_as_secondary", () => assert.equal(adjudicateConflictAwareStage0Failure(fixture()).evidence.checkpointIdentityDifference.sufficientToExplainTerminalFailure, false))
positive("forbids_same_stage0_rerun", () => assert.equal(adjudicateConflictAwareStage0Failure(fixture()).resolution.currentStage0MayBeRerun, false))
positive("requests_model_structure_review_without_claiming_capacity", () => assert.equal(adjudicateConflictAwareStage0Failure(fixture()).resolution.nextLegalAction, "cpu_readonly_substantive_model_structure_review"))

negative("rejects_historical_run", (v) => { v.terminal.runId = "20260821-000000000" }, /current_run_identity_required/)
negative("rejects_checkpoint_substitution", (v) => { v.manifest.checkpointSha256 = "d".repeat(64) }, /checkpoint_sha_identity_mismatch/)
negative("rejects_split_change", (v) => { v.manifest.actualLoadedSplitCounts.train = 47 }, /deep-equal/)
negative("rejects_threshold_change", (v) => { v.review.reviewThresholdsChanged = true }, /review_thresholds_changed/)
negative("rejects_missing_epoch_metric", (v) => { v.manifest.metrics.pop() }, /forty_epoch_metrics_required/)
negative("rejects_inactive_conflict_contract", (v) => { v.activeConfig.training.stage4ConflictAwareExistingGradientAggregation.status = "cpu_support_verified_inactive" }, /status_invalid/)
negative("rejects_class_order_change", (v) => { v.activeConfig.training.stage4ConflictAwareExistingGradientAggregation.classOrder.reverse() }, /class_order_invalid/)
negative("rejects_free_tolerance", (v) => { v.activeConfig.training.stage4ConflictAwareExistingGradientAggregation.projection.numericTolerance = 1e-4 }, /free_projection_tolerance_forbidden/)
negative("rejects_added_optimizer_step", (v) => { v.activeConfig.training.stage4ConflictAwareExistingGradientAggregation.optimizerBudget.additionalOptimizerSteps = 1 }, /optimizer_steps_added/)
negative("rejects_failed_preview_target", (v) => { v.activeConfig.training.stage4ConflictAwareExistingGradientAggregation.legalTargets.failedPreviewPixelsUsedAsTargets = true }, /failed_preview_target_forbidden/)
negative("rejects_review_result_target", (v) => { v.activeConfig.training.stage4ConflictAwareExistingGradientAggregation.legalTargets.machineReviewResultsUsedAsTargets = true }, /review_result_target_forbidden/)
negative("rejects_epoch_without_conflict_application", (v) => { v.manifest.metrics[10].trainStage4ConflictAwareApplied = 0 }, /conflict_aggregation_inactive/)
negative("rejects_projection_count_change", (v) => { v.manifest.metrics[10].trainStage4ConflictAwareNonNegativeUnchangedCount = 9 }, /pair_count_invalid/)
negative("rejects_epoch40_water_failure", (v) => { v.review.reviews.at(-1).conditionAlignment.channelAudits[0].passed = false }, /epoch40_water_must_pass/)
negative("rejects_epoch40_vegetation_failure", (v) => { v.review.reviews.at(-1).conditionAlignment.objectSemanticAudits[3].passed = false }, /epoch40_vegetation_must_pass/)
negative("rejects_epoch40_luma_change", (v) => { v.review.reviews.at(-1).conditionAlignment.objectSemanticAudits[0].referenceResponse.maskedLumaCorrelation = 0.0489 }, /luma_changed/)
negative("rejects_west_gate_identity_change", (v) => { v.manifest.metrics[39].stage4CheckpointRouteWestBoundaryNonRegressionPassed = true }, /west_gate_identity_changed/)
negative("rejects_unproven_wiring_defect", (v) => { v.directConflictWiringDefectEvidence = true }, /unproven_conflict_wiring_defect/)
negative("rejects_unproven_capacity_claim", (v) => { v.directResidualCapacityEvidence = true }, /unproven_capacity_gap/)

console.log(JSON.stringify({ schemaVersion: "stage4-conflict-aware-stage0-residual-semantic-cpu-report-v1", status: "passed", positivePassed: positives.length, positiveTotal: positives.length, negativePassed: negatives.length, negativeTotal: negatives.length, positives, negatives }, null, 2))
