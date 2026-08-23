import assert from "node:assert/strict"
import { adjudicateCapacityStage0CheckpointVisualIdentity, BEST_EPOCH, CAPACITY_ARM, REVIEW_EPOCHS } from "./lib/ai-painter-stage4-capacity-stage0-checkpoint-visual-identity-adjudication.mjs"

const objectAudit = (channelId, passed, luma) => ({
  channelId, passed, localResponsePassed: true,
  referenceResponse: { maskedRgbMae: 0.09, maskedEdgeMae: 0.07, maskedLumaCorrelation: luma },
})
const reviewRow = (epoch) => {
  const epoch30 = epoch === 30
  const epoch40 = epoch === 40
  return {
    epoch, passed: false,
    issueCodes: ["condition_terrain_path_ground_required_boundary_contact_missing"],
    conditionAlignment: { objectSemanticAudits: [
      objectAudit("object_footprints", epoch30, epoch30 ? 0.1 : epoch40 ? 0.074 : 0),
      objectAudit("object_tree", epoch30, epoch30 ? 0.12 : epoch40 ? 0.033 : 0),
      objectAudit("object_rock", epoch30 || epoch40, 0.15),
      objectAudit("object_vegetation", false, epoch30 ? 0.055 : epoch40 ? 0.043 : 0),
      { channelId: "object_visual_density", passed: true },
    ] },
  }
}
function fixture() {
  const metrics = Array.from({ length: 40 }, (_, index) => ({
    epoch: index + 1, validationCheckpointSelectionScore: 7 - index * 0.04,
    bestCheckpointUpdated: index + 1 === BEST_EPOCH,
    stage4CheckpointRouteWestBoundaryNonRegressionPassed: index + 1 === BEST_EPOCH,
  }))
  return {
    terminal: { status: "semantic_mixture_stage4_formal_stage_failed_closed", runId: "20260823-110753367-capacity-stage0", stage: 0, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, blockers: ["stage_0_visual_review_failed_0_of_6"], machineReview: { passCount: 0, failCount: 6 }, checkpoint: { sha256: "a".repeat(64) } },
    manifest: { status: "conditional_denoiser_training_completed_pending_validation", bestEpoch: BEST_EPOCH, metrics, actualLoadedSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 }, modelStateHashEvidence: { weightsChanged: true }, stage4UnifiedTrainingPreviewSampling: { status: "checkpoint_bound_preview_reproduced_exactly", bestEpoch: BEST_EPOCH, sourcePreview: { epoch: BEST_EPOCH, previewSha256: "b".repeat(64) }, reproducedPreview: { epoch: BEST_EPOCH, previewSha256: "b".repeat(64) }, previewSha256Matches: true, denoiserStateIdentityMatches: true, machineReviewThresholdsChanged: false } },
    review: { previewCount: 6, previewPassCount: 0, previewFailCount: 6, reviews: REVIEW_EPOCHS.map(reviewRow) },
    activeConfig: { stage4ControlledStructureArm: CAPACITY_ARM, training: { stage4ControlledStructureThreeArm: { armId: CAPACITY_ARM, status: "structure_active_owner_authorized", denoiserBaseChannels: 128, activationGate: { configurationActiveNow: true, checkpointReadNow: true, optimizerCreationNow: true, backwardExecutionNow: true, modelParameterUpdateNow: true, gpuUseNow: true, trainingNow: true, stage4FullTrainingNow: true, smokeNow: false, stage1Now: false, stage2Now: false, formalInferenceNow: false, checkpointPromotionNow: false, runtimeFrameNow: false, worldEntryNow: false } } } },
    checkpointPreview: { sha256: "b".repeat(64) }, failedCheckpointSha256: "a".repeat(64),
    directExecutionWiringDefectEvidence: false, bestEpochMachineReviewExists: false, capacityInsufficiencyProvenWithoutBestEpochReview: false,
  }
}

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => { const value = structuredClone(fixture()); mutate(value); assert.throws(() => adjudicateCapacityStage0CheckpointVisualIdentity(value), pattern); negatives.push(name) }
positive("selects_B_identity_gap", () => assert.equal(adjudicateCapacityStage0CheckpointVisualIdentity(fixture()).selectedCause, "B"))
positive("requests_existing_preview_review_only", () => assert.equal(adjudicateCapacityStage0CheckpointVisualIdentity(fixture()).resolution.previewRegenerationAllowed, false))
positive("keeps_stage1_closed", () => assert.equal(adjudicateCapacityStage0CheckpointVisualIdentity(fixture()).resolution.stage1AllowedBeforeReview, false))
negative("rejects_wrong_run", (v) => { v.terminal.runId = "historical-run" }, /source_run_identity_invalid/)
negative("rejects_wrong_arm", (v) => { v.activeConfig.stage4ControlledStructureArm = "baseline" }, /active_arm_identity_invalid/)
negative("rejects_wrong_width", (v) => { v.activeConfig.training.stage4ControlledStructureThreeArm.denoiserBaseChannels = 64 }, /capacity_width_invalid/)
negative("rejects_partial_activation", (v) => { v.activeConfig.training.stage4ControlledStructureThreeArm.activationGate.trainingNow = false }, /active_gate_trainingNow_invalid/)
negative("rejects_checkpoint_identity_change", (v) => { v.failedCheckpointSha256 = "0".repeat(64) }, /failed_checkpoint_identity_invalid/)
negative("rejects_missing_epoch", (v) => { v.manifest.metrics.pop() }, /forty_epochs_required/)
negative("rejects_best_epoch_change", (v) => { v.manifest.bestEpoch = 36 }, /best_epoch_identity_invalid/)
negative("rejects_review_epoch_injection", (v) => { v.review.reviews[0].epoch = 37 }, /fixed_review_epoch_identity_invalid/)
negative("rejects_preview_hash_change", (v) => { v.checkpointPreview.sha256 = "c".repeat(64) }, /best_preview_source_sha_invalid/)
negative("rejects_nonreproducible_preview", (v) => { v.manifest.stage4UnifiedTrainingPreviewSampling.previewSha256Matches = false }, /best_preview_not_reproduced/)
negative("rejects_threshold_change", (v) => { v.manifest.stage4UnifiedTrainingPreviewSampling.machineReviewThresholdsChanged = true }, /review_threshold_change_detected/)
negative("rejects_epoch30_fact_change", (v) => { v.review.reviews.find((row) => row.epoch === 30).conditionAlignment.objectSemanticAudits[0].passed = false }, /epoch30_footprints_fact_invalid/)
negative("rejects_unproven_wiring", (v) => { v.directExecutionWiringDefectEvidence = true }, /unproven_execution_wiring_defect_injected/)
negative("rejects_unproven_capacity_exit", (v) => { v.capacityInsufficiencyProvenWithoutBestEpochReview = true }, /unproven_capacity_exit_injected/)
console.log(JSON.stringify({ schemaVersion: "stage4-capacity-stage0-checkpoint-visual-identity-adjudication-cpu-report-v1", status: "passed", positivePassed: positives.length, positiveTotal: positives.length, negativePassed: negatives.length, negativeTotal: negatives.length, positives, negatives, executionBoundary: { checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false } }, null, 2))
