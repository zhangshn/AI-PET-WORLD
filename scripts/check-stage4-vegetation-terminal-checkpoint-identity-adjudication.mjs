import assert from "node:assert/strict"
import {
  REVIEW_EPOCHS,
  SOURCE_RUN_ID,
  VEGETATION_ISSUE,
  adjudicateVegetationTerminalCheckpointIdentityFailure,
} from "./lib/ai-painter-stage4-vegetation-terminal-checkpoint-identity-adjudication.mjs"

const contracts = [
  "stage4VegetationFinalVisibleSemanticRepair",
  "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation",
  "stage4PerClassFinalVisibleReferenceFeatureStructureObligation",
  "stage4EpochWorstSampleClassReferenceFeatureStructureReplay",
  "stage4PerClassWorstSampleReferenceFeatureStructureObligation",
]
const gate = { trainingNow: true, stage4FullTrainingNow: true, smokeNow: false }

function fixture() {
  const checkpoint = { path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/training-output/complete-world-ai-assisted-conditional-denoiser.pt`, sha256: "7".repeat(64) }
  const activeConfig = { training: {} }
  for (const name of contracts) activeConfig.training[name] = { enabled: true, status: "training_loss_active_owner_authorized", activationGate: { ...gate } }
  activeConfig.training.stage4VegetationFinalVisibleSemanticRepair.legalSupervision = {
    reference: "original_owner_approved_reference_rgb",
    maskChannel: "object_vegetation",
    failedPreviewPixelsUsedAsTargets: false,
    machineReviewResultsUsedAsTargets: false,
  }
  const metrics = Array.from({ length: 40 }, (_, index) => {
    const epoch = index + 1
    const factor = 1 - index * 0.01
    return {
      epoch,
      validationCheckpointSelectionScore: 7 - index * 0.04,
      validationFixedGridStage4SemanticMixtureVegetationFinalTypedRgbMae: 0.07 * factor,
      validationFixedGridStage4SemanticMixtureVegetationFinalTypedEdgeMae: 0.05 * factor,
      validationFixedGridStage4SemanticMixtureVegetationFinalTypedMultiscaleLuminanceStructureLoss: 0.2 * factor,
      validationRolloutVegetationFinalVisibleMultiscaleLuminanceStructureLoss: 0.4 * factor,
      validationRolloutVegetationFinalVisibleReferenceFeatureStructureLoss: 1.2 * factor,
      trainStage4PerClassWorstSampleVegetationReferenceFeatureStructureLoss: 1.1 * factor,
      trainStage4EpochWorstSampleClassReplayReferenceFeatureStructureWeightedLoss: 0.15 * factor,
      trainStage4EpochWorstSampleClassReplayClassIndex: index % 4,
      validationFixedGridStage4DiagnosticRouteRequiredBoundaryContactMinimum: epoch <= 33 ? 0.2 + epoch * 0.001 : 0.22,
      stage4CheckpointRouteWestBoundaryNonRegressionPassed: epoch <= 33,
      bestCheckpointUpdated: epoch === 33,
    }
  })
  metrics[32].validationCheckpointSelectionScore = 5.6
  metrics[32].validationFixedGridStage4DiagnosticRouteRequiredBoundaryContactMinimum = 0.28
  metrics[39].validationCheckpointSelectionScore = 5.2
  const reviews = REVIEW_EPOCHS.map((epoch, index) => {
    const terminal = epoch === 40
    const objectSemanticAudits = ["footprints", "tree", "rock", "vegetation"].map((name) => ({
      channelId: `object_${name}`,
      passed: terminal ? name !== "vegetation" : false,
      localResponsePassed: true,
      referenceResponse: {
        maskedRgbMae: 0.13 - index * 0.007,
        maskedEdgeMae: 0.085 - index * 0.0015,
        maskedLumaCorrelation: terminal && name === "vegetation" ? 0.0626 : -0.01 + index * 0.01,
      },
      referenceThresholds: { minimumMaskedLumaCorrelation: 0.08 },
    }))
    return {
      epoch,
      passed: false,
      issueCodes: terminal ? [VEGETATION_ISSUE] : ["condition_terrain_water_coverage_mismatch", VEGETATION_ISSUE],
      conditionAlignment: {
        objectSemanticAudits,
        channelAudits: [{ channelId: "terrain_path_ground", passed: terminal, boundaryContactAudit: { passed: terminal } }],
      },
    }
  })
  return {
    activeConfig,
    terminal: { status: "semantic_mixture_stage4_formal_stage_failed_closed", stage: 0, runId: SOURCE_RUN_ID, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } },
    manifest: {
      actualLoadedSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
      modelStateHashEvidence: { weightsChanged: true },
      stage4UnifiedTrainingPreviewSampling: { previewSha256Matches: true, denoiserStateIdentityMatches: true },
      checkpointPath: checkpoint.path,
      checkpointSha256: checkpoint.sha256,
      bestEpoch: 33,
      metrics,
    },
    review: { reviewThresholdsChanged: false, previewCount: 6, previewPassCount: 0, previewFailCount: 6, reviews },
    failedCheckpointIdentity: checkpoint,
  }
}

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => {
  const value = structuredClone(fixture())
  mutate(value)
  assert.throws(() => adjudicateVegetationTerminalCheckpointIdentityFailure(value), pattern)
  negatives.push(name)
}

positive("selects_A_for_active_but_insufficient_vegetation_supervision", () => {
  const result = adjudicateVegetationTerminalCheckpointIdentityFailure(fixture())
  assert.equal(result.selectedCause, "A")
  assert.equal(result.ownerDecisionRequired, true)
})
positive("keeps_checkpoint_scope_difference_secondary", () => assert.equal(adjudicateVegetationTerminalCheckpointIdentityFailure(fixture()).alternatives.B.status, "not_confirmed"))
positive("records_complete_metric_timeline", () => assert.deepEqual(adjudicateVegetationTerminalCheckpointIdentityFailure(fixture()).metricTimeline.map((row) => row.epoch), REVIEW_EPOCHS))
positive("records_complete_review_timeline", () => assert.deepEqual(adjudicateVegetationTerminalCheckpointIdentityFailure(fixture()).reviewTimeline.map((row) => row.epoch), REVIEW_EPOCHS))
positive("records_epoch40_relative_and_absolute_boundary_identity", () => assert.equal(adjudicateVegetationTerminalCheckpointIdentityFailure(fixture()).checkpointIdentityFinding.epoch40AbsoluteMachinePathAuditPassed, true))

negative("rejects_historical_run", (v) => { v.terminal.runId = "20260820-214000000" }, /current_run_identity_required/)
negative("rejects_terminal_alias", (v) => { v.terminal.status = "failed" }, /terminal_status_invalid/)
negative("rejects_split_change", (v) => { v.manifest.actualLoadedSplitCounts.train = 47 }, /dataset_split_changed/)
negative("rejects_checkpoint_identity_replacement", (v) => { v.manifest.checkpointSha256 = "6".repeat(64) }, /failed_checkpoint_sha_identity_mismatch/)
negative("rejects_missing_weight_change", (v) => { v.manifest.modelStateHashEvidence.weightsChanged = false }, /model_weights_did_not_change/)
negative("rejects_preview_reproduction_mismatch", (v) => { v.manifest.stage4UnifiedTrainingPreviewSampling.previewSha256Matches = false }, /preview_reproduction_mismatch/)
negative("rejects_missing_vegetation_contract", (v) => { delete v.activeConfig.training.stage4VegetationFinalVisibleSemanticRepair }, /stage4VegetationFinalVisibleSemanticRepair_missing/)
negative("rejects_inactive_contract", (v) => { v.activeConfig.training.stage4PerClassWorstSampleReferenceFeatureStructureObligation.status = "cpu_support_verified_inactive" }, /status_invalid/)
negative("rejects_smoke_residue", (v) => { v.activeConfig.training.stage4EpochWorstSampleClassReferenceFeatureStructureReplay.activationGate.smokeNow = true }, /smoke_residue_present/)
negative("rejects_failed_preview_target", (v) => { v.activeConfig.training.stage4VegetationFinalVisibleSemanticRepair.legalSupervision.failedPreviewPixelsUsedAsTargets = true }, /failed_preview_target_forbidden/)
negative("rejects_threshold_change", (v) => { v.review.reviewThresholdsChanged = true }, /review_thresholds_changed/)
negative("rejects_epoch40_other_object_failure", (v) => { v.review.reviews.at(-1).issueCodes.unshift("condition_object_tree_reference_semantic_mismatch") }, /epoch40_issue_identity_invalid/)
negative("rejects_epoch40_vegetation_pass", (v) => { v.review.reviews.at(-1).conditionAlignment.objectSemanticAudits.at(-1).passed = true }, /epoch40_issue_identity_invalid|epoch40_vegetation/)
negative("rejects_luma_threshold_change", (v) => { v.review.reviews.at(-1).conditionAlignment.objectSemanticAudits.at(-1).referenceThresholds.minimumMaskedLumaCorrelation = 0.07 }, /threshold_identity_invalid/)
negative("rejects_luma_identity_change", (v) => { v.review.reviews.at(-1).conditionAlignment.objectSemanticAudits.at(-1).referenceResponse.maskedLumaCorrelation = 0.07 }, /luma_identity_invalid/)
negative("rejects_no_vegetation_improvement", (v) => { v.manifest.metrics.at(-1).validationRolloutVegetationFinalVisibleReferenceFeatureStructureLoss = 2 }, /rollout_feature_did_not_improve/)
negative("rejects_missing_replay_loss", (v) => { v.manifest.metrics[19].trainStage4EpochWorstSampleClassReplayReferenceFeatureStructureWeightedLoss = 0 }, /replay_inactive/)
negative("rejects_best_epoch_change", (v) => { v.manifest.bestEpoch = 40 }, /best_epoch_identity_invalid/)
negative("rejects_epoch40_west_gate_pass", (v) => { v.manifest.metrics.at(-1).stage4CheckpointRouteWestBoundaryNonRegressionPassed = true }, /epoch34_40_west_gate_identity_changed/)
negative("rejects_epoch40_score_not_improved", (v) => { v.manifest.metrics.at(-1).validationCheckpointSelectionScore = 6 }, /epoch40_checkpoint_score_not_improved/)
negative("rejects_epoch40_path_audit_failure", (v) => { v.review.reviews.at(-1).conditionAlignment.channelAudits[0].passed = false }, /epoch40_path_not_passed/)

console.log(JSON.stringify({
  schemaVersion: "stage4-vegetation-terminal-checkpoint-identity-adjudication-cpu-report-v1",
  status: "passed",
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
}, null, 2))
