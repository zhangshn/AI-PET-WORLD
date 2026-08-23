import assert from "node:assert/strict"
import { CONTROLLED_ARM, CAPACITY_ARM, OBJECT_ISSUES, REVIEW_EPOCHS, adjudicateConditionFusionStage0FinalRoute } from "./lib/ai-painter-stage4-condition-fusion-stage0-final-route-adjudication.mjs"

function fixture() {
  const metrics = Array.from({ length: 40 }, (_, index) => ({ epoch: index + 1, trainCompositeLoss: 6 - index * 0.05, validationCheckpointSelectionScore: 7.4 - index * 0.05, bestCheckpointUpdated: index + 1 === 33 }))
  metrics[32].validationCheckpointSelectionScore = 5.612691400615343
  metrics[39].validationCheckpointSelectionScore = 5.361454962898279
  metrics[39].bestCheckpointUpdated = false
  const issueCodes = [...OBJECT_ISSUES]
  return {
    terminal: { status: "semantic_mixture_stage4_formal_stage_failed_closed", runId: "20260823-060300000-condition-fusion-stage0", stage: 0, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, machineReview: { passCount: 0, failCount: 6 }, checkpoint: { path: "failed.pt", sha256: "6".repeat(64) } },
    manifest: { status: "conditional_denoiser_training_completed_pending_validation", metrics, actualLoadedSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 }, modelStateHashEvidence: { weightsChanged: true }, stage4UnifiedTrainingPreviewSampling: { previewSha256Matches: true, denoiserStateIdentityMatches: true } },
    review: { previewCount: 6, previewPassCount: 0, previewFailCount: 6, reviews: REVIEW_EPOCHS.map((epoch) => ({ epoch, passed: false, issueCodes: epoch >= 30 ? [...issueCodes, ...(epoch === 40 ? ["condition_terrain_path_ground_coverage_mismatch", "condition_terrain_path_ground_required_boundary_contact_missing"] : [])] : ["diagnostic_failure"] })) },
    activeConfig: { stage4ControlledStructureArm: CONTROLLED_ARM, training: { stage4ControlledStructureThreeArm: { armId: CONTROLLED_ARM, status: "structure_active_owner_authorized", denoiserBaseChannels: 64, activationGate: { configurationActiveNow: true, checkpointReadNow: true, optimizerCreationNow: true, backwardExecutionNow: true, modelParameterUpdateNow: true, gpuUseNow: true, trainingNow: true, smokeNow: false, stage4FullTrainingNow: true, stage1Now: false, stage2Now: false, formalInferenceNow: false, checkpointPromotionNow: false, runtimeFrameNow: false, worldEntryNow: false } } } },
    resourceTelemetry: { status: "formal_training_resource_telemetry_recorded", sampleCount: 372, peakGpuMemoryBytes: 4636803072 },
    crossArmTerminal: { status: "stage4_controlled_structure_cross_arm_adjudication_closed", outcome: "condition_fusion_only_priority" },
    crossArmReport: { facts: { bothSmokesNaturallyCompleted: true, bothLateStabilityQualified: true, bothTerminalEpoch30Passed: true } },
    crossArmDecision: { outcome: "condition_fusion_only_priority" },
    formalCpuReport: { status: "passed_stage4_semantic_mixture_formal_stage_modes_cpu_regression", positivePassed: 63, positiveTotal: 63, negativePassed: 60, negativeTotal: 60 },
    capacityQualification: { status: "terminal_pass_with_late_convergence_evidence_qualified_closed", stage0EntryPermitted: true },
    failedCheckpointIdentity: { path: "failed.pt", sha256: "6".repeat(64) },
    directExecutionWiringDefectEvidence: false,
    directCheckpointCausalDefectEvidence: false,
  }
}

const positives = []
const positive = (name, check) => { check(); positives.push(name) }
const negatives = []
const negative = (name, mutate, pattern) => { const value = structuredClone(fixture()); mutate(value); assert.throws(() => adjudicateConditionFusionStage0FinalRoute(value), pattern); negatives.push(name) }
positive("selects_C_capacity_route", () => { const result = adjudicateConditionFusionStage0FinalRoute(fixture()); assert.equal(result.selectedCause, "C"); assert.equal(result.resolution.remainingArm, CAPACITY_ARM) })
positive("rejects_checkpoint_as_complete_explanation", () => { const result = adjudicateConditionFusionStage0FinalRoute(fixture()); assert.equal(result.evidence.checkpointIdentityDifferenceExplainsPersistentVisualFailure, false) })
positive("preserves_hard_stop", () => { const result = adjudicateConditionFusionStage0FinalRoute(fixture()); assert.equal(result.resolution.fourthArmAllowed, false); assert.equal(result.resolution.newLossAllowed, false) })
negative("rejects_inactive_arm", (v) => { v.activeConfig.training.stage4ControlledStructureThreeArm.status = "cpu_support_verified_inactive" }, /active_contract_status_invalid/)
negative("rejects_wrong_arm", (v) => { v.activeConfig.stage4ControlledStructureArm = CAPACITY_ARM }, /active_arm_identity_invalid/)
negative("rejects_partial_gate", (v) => { v.activeConfig.training.stage4ControlledStructureThreeArm.activationGate.stage4FullTrainingNow = false }, /active_gate_stage4FullTrainingNow_invalid/)
negative("rejects_missing_epoch", (v) => { v.manifest.metrics.pop() }, /forty_epochs_required/)
negative("rejects_no_weight_change", (v) => { v.manifest.modelStateHashEvidence.weightsChanged = false }, /model_weights_not_changed/)
negative("rejects_review_pass_injection", (v) => { v.review.previewPassCount = 1 }, /preview_pass_count_invalid/)
negative("rejects_missing_terminal_object_failure", (v) => { v.review.reviews.at(-1).issueCodes = v.review.reviews.at(-1).issueCodes.filter((code) => code !== OBJECT_ISSUES[0]) }, /epoch40_.*_missing/)
negative("rejects_missing_epoch30_persistence", (v) => { v.review.reviews.find((entry) => entry.epoch === 30).issueCodes = [] }, /epoch30_.*_missing/)
negative("rejects_unproven_wiring_defect", (v) => { v.directExecutionWiringDefectEvidence = true }, /unproven_execution_wiring_defect_injected/)
negative("rejects_unproven_checkpoint_cause", (v) => { v.directCheckpointCausalDefectEvidence = true }, /unproven_checkpoint_causal_defect_injected/)
negative("rejects_capacity_without_qualification", (v) => { v.capacityQualification.stage0EntryPermitted = false }, /false !== true/)
negative("rejects_cross_arm_identity_change", (v) => { v.crossArmDecision.outcome = "capacity_only_priority" }, /actual.*expected|Expected values/)
negative("rejects_formal_cpu_failure", (v) => { v.formalCpuReport.negativePassed = 59 }, /59 !== 60/)
negative("rejects_checkpoint_identity_change", (v) => { v.terminal.checkpoint.sha256 = "0".repeat(64) }, /failed_checkpoint_sha_invalid/)
console.log(JSON.stringify({ schemaVersion: "stage4-condition-fusion-stage0-final-route-adjudication-cpu-report-v1", status: "passed", positivePassed: positives.length, positiveTotal: positives.length, negativePassed: negatives.length, negativeTotal: negatives.length, positives, negatives, executionBoundary: { checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false } }, null, 2))
