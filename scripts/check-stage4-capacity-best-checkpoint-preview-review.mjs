import assert from "node:assert/strict"
import { evaluateCapacityBestCheckpointMachineReview, validateCapacityBestCheckpointReviewEvidence, PREVIEW_SHA256 } from "./lib/ai-painter-stage4-capacity-best-checkpoint-preview-review.mjs"

function evidenceFixture() {
  const preview = { bestEpoch: 37, previewSha256Matches: true, denoiserStateIdentityMatches: true, machineReviewThresholdsChanged: false }
  return {
    identityTerminal: { status: "best_checkpoint_and_fixed_visual_review_identity_gap_confirmed", selectedCause: "B" },
    identityDecision: { status: "best_checkpoint_and_fixed_visual_review_identity_gap_confirmed", selectedCause: "B" },
    identityCpuReport: { status: "stage4_capacity_stage0_checkpoint_visual_identity_cpu_passed", positivePassed: 3, positiveTotal: 3, negativePassed: 14, negativeTotal: 14 },
    ownerRequest: { requestedAction: "machine_review_existing_immutable_epoch37_checkpoint_bound_preview_once" },
    manifest: { bestEpoch: 37, stage4UnifiedTrainingPreviewSampling: preview },
    priorReview: { runId: "20260823-110753367-capacity-stage0", reviewThresholdsChanged: false, reviews: [1, 5, 10, 20, 30, 40].map((epoch) => ({ epoch })) },
    sourceIndex: { samples: [{ recordId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6", conditionLabel: "v7-complete-map-194", trainingRoles: ["conditional_denoiser"], ownerReviewStatus: "owner_approved", machineReviewStatus: "passed" }] },
    sourcePreview: { sha256: PREVIEW_SHA256 }, reproducedPreview: { sha256: PREVIEW_SHA256 },
  }
}
const auditFixture = (passed) => ({
  aesthetic: { passed, issues: passed ? [] : [{ code: "professional_aesthetic_failed" }] },
  alignment: { passed, method: "season_aware_water_path_alignment_plus_object_mask_local_visual_response_v6", waterClassifier: { acceptanceThresholdsChanged: false }, pathClassifier: { acceptanceThresholdsChanged: false }, objectSemanticAudits: [...["footprints", "tree", "rock", "vegetation"].map((name) => ({ channelId: `object_${name}`, priorAcceptanceThresholdChanged: false })), { channelId: "focal_area" }], issues: passed ? [] : [{ code: "condition_object_tree_reference_semantic_mismatch" }] },
})
const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => { const value = structuredClone(evidenceFixture()); mutate(value); assert.throws(() => validateCapacityBestCheckpointReviewEvidence(value), pattern); negatives.push(name) }
const reviewNegative = (name, mutate, pattern) => { const value = structuredClone(auditFixture(true)); mutate(value); assert.throws(() => evaluateCapacityBestCheckpointMachineReview(value), pattern); negatives.push(name) }
positive("accepts_exact_epoch37_identity", () => validateCapacityBestCheckpointReviewEvidence(evidenceFixture()))
positive("accepts_pass_verdict", () => assert.equal(evaluateCapacityBestCheckpointMachineReview(auditFixture(true)).passed, true))
positive("preserves_real_failure", () => assert.equal(evaluateCapacityBestCheckpointMachineReview(auditFixture(false)).passed, false))
negative("rejects_wrong_decision", (v) => { v.identityDecision.selectedCause = "C" }, /'C' !== 'B'/)
negative("rejects_failed_cpu", (v) => { v.identityCpuReport.negativePassed = 13 }, /13 !== 14/)
negative("rejects_wrong_action", (v) => { v.ownerRequest.requestedAction = "train" }, /actual.*expected|Expected values/)
negative("rejects_best_epoch_change", (v) => { v.manifest.bestEpoch = 36 }, /best_epoch_identity_invalid/)
negative("rejects_preview_reproduction_change", (v) => { v.manifest.stage4UnifiedTrainingPreviewSampling.previewSha256Matches = false }, /preview_reproduction_invalid/)
negative("rejects_source_preview_change", (v) => { v.sourcePreview.sha256 = "0".repeat(64) }, /source_preview_sha_invalid/)
negative("rejects_reproduction_preview_change", (v) => { v.reproducedPreview.sha256 = "0".repeat(64) }, /reproduced_preview_sha_invalid/)
negative("rejects_prior_schedule_change", (v) => { v.priorReview.reviews[0].epoch = 37 }, /prior_review_schedule_invalid/)
negative("rejects_sample_identity_change", (v) => { v.sourceIndex.samples[0].conditionLabel = "other" }, /sample_194_condition_identity_invalid/)
negative("rejects_unapproved_source", (v) => { v.sourceIndex.samples[0].ownerReviewStatus = "pending" }, /sample_194_owner_status_invalid/)
assert.throws(() => evaluateCapacityBestCheckpointMachineReview({ ...auditFixture(true), alignment: { ...auditFixture(true).alignment, method: "changed" } }), /alignment_method_changed/); negatives.push("rejects_alignment_method_change")
assert.throws(() => evaluateCapacityBestCheckpointMachineReview({ ...auditFixture(true), alignment: { ...auditFixture(true).alignment, pathClassifier: { acceptanceThresholdsChanged: true } } }), /path_threshold_changed/); negatives.push("rejects_threshold_change")
reviewNegative("rejects_missing_formal_object", (v) => { v.alignment.objectSemanticAudits = v.alignment.objectSemanticAudits.filter((row) => row.channelId !== "object_tree") }, /formal_object_identity_count_invalid:object_tree/)
reviewNegative("rejects_duplicate_formal_object", (v) => { v.alignment.objectSemanticAudits.push({ channelId: "object_tree", priorAcceptanceThresholdChanged: false }) }, /formal_object_identity_count_invalid:object_tree/)
reviewNegative("rejects_renamed_formal_object", (v) => { v.alignment.objectSemanticAudits.find((row) => row.channelId === "object_tree").channelId = "tree" }, /formal_object_identity_count_invalid:object_tree/)
reviewNegative("rejects_unknown_reference_semantic_object", (v) => { v.alignment.objectSemanticAudits.push({ channelId: "object_bush", priorAcceptanceThresholdChanged: false }) }, /unknown_reference_semantic_object:object_bush/)
reviewNegative("rejects_formal_object_threshold_change", (v) => { v.alignment.objectSemanticAudits.find((row) => row.channelId === "object_tree").priorAcceptanceThresholdChanged = true }, /object_threshold_changed:object_tree/)
console.log(JSON.stringify({ schemaVersion: "stage4-capacity-best-checkpoint-preview-review-cpu-report-v1", status: "passed", positivePassed: positives.length, positiveTotal: positives.length, negativePassed: negatives.length, negativeTotal: negatives.length, positives, negatives, executionBoundary: { checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, sourcePreviewModified: false } }, null, 2))
