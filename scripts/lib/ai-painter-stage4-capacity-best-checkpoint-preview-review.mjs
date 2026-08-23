import assert from "node:assert/strict"

export const SOURCE_RUN_ID = "20260823-110753367-capacity-stage0"
export const BEST_EPOCH = 37
export const PREVIEW_SHA256 = "bd9590ee477e2775f089d69cc64fda3e292c18d7f1958b796ff0f19a2dbec15f"
export const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
export const CONDITION_LABEL = "v7-complete-map-194"
const REVIEW_OBJECT_CHANNELS = Object.freeze(["object_footprints", "object_tree", "object_rock", "object_vegetation"])
const REVIEW_OBJECT_CHANNEL_SET = new Set(REVIEW_OBJECT_CHANNELS)

export function validateCapacityBestCheckpointReviewEvidence(input) {
  const { identityTerminal, identityDecision, identityCpuReport, ownerRequest, manifest, priorReview, sourceIndex, sourcePreview, reproducedPreview } = input
  assert.equal(identityTerminal.status, "best_checkpoint_and_fixed_visual_review_identity_gap_confirmed")
  assert.equal(identityTerminal.selectedCause, "B")
  assert.equal(identityDecision.status, "best_checkpoint_and_fixed_visual_review_identity_gap_confirmed")
  assert.equal(identityDecision.selectedCause, "B")
  assert.equal(identityCpuReport.status, "stage4_capacity_stage0_checkpoint_visual_identity_cpu_passed")
  assert.equal(identityCpuReport.positivePassed, identityCpuReport.positiveTotal)
  assert.equal(identityCpuReport.negativePassed, identityCpuReport.negativeTotal)
  assert.equal(ownerRequest.requestedAction, "machine_review_existing_immutable_epoch37_checkpoint_bound_preview_once")
  assert.equal(manifest.bestEpoch, BEST_EPOCH, "best_epoch_identity_invalid")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling.bestEpoch, BEST_EPOCH, "preview_best_epoch_invalid")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling.previewSha256Matches, true, "preview_reproduction_invalid")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling.denoiserStateIdentityMatches, true, "preview_state_identity_invalid")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling.machineReviewThresholdsChanged, false, "review_threshold_change_detected")
  assert.equal(sourcePreview.sha256, PREVIEW_SHA256, "source_preview_sha_invalid")
  assert.equal(reproducedPreview.sha256, PREVIEW_SHA256, "reproduced_preview_sha_invalid")
  assert.equal(priorReview.runId, SOURCE_RUN_ID, "prior_review_run_invalid")
  assert.deepEqual(priorReview.reviews.map((row) => row.epoch), [1, 5, 10, 20, 30, 40], "prior_review_schedule_invalid")
  assert.equal(priorReview.reviewThresholdsChanged, false, "prior_review_threshold_change_detected")
  const row = sourceIndex.samples.find((entry) => entry.recordId === SAMPLE_ID)
  assert.ok(row, "sample_194_missing")
  assert.equal(row.conditionLabel, CONDITION_LABEL, "sample_194_condition_identity_invalid")
  assert.equal(row.trainingRoles.includes("conditional_denoiser"), true, "sample_194_training_role_invalid")
  assert.equal(row.ownerReviewStatus, "owner_approved", "sample_194_owner_status_invalid")
  assert.equal(row.machineReviewStatus, "passed", "sample_194_source_review_invalid")
  return row
}

export function evaluateCapacityBestCheckpointMachineReview({ aesthetic, alignment }) {
  assert.equal(aesthetic?.passed === true || aesthetic?.passed === false, true, "aesthetic_verdict_missing")
  assert.equal(alignment?.passed === true || alignment?.passed === false, true, "alignment_verdict_missing")
  assert.equal(alignment?.method, "season_aware_water_path_alignment_plus_object_mask_local_visual_response_v6", "alignment_method_changed")
  assert.equal(alignment?.waterClassifier?.acceptanceThresholdsChanged, false, "water_threshold_changed")
  assert.equal(alignment?.pathClassifier?.acceptanceThresholdsChanged, false, "path_threshold_changed")
  const objectSemanticAudits = alignment.objectSemanticAudits ?? []
  const formalObjectCounts = new Map(REVIEW_OBJECT_CHANNELS.map((channelId) => [channelId, 0]))
  for (const row of objectSemanticAudits) {
    if (typeof row.channelId === "string" && row.channelId.startsWith("object_") && !REVIEW_OBJECT_CHANNEL_SET.has(row.channelId)) {
      assert.fail(`unknown_reference_semantic_object:${row.channelId}`)
    }
    if (REVIEW_OBJECT_CHANNEL_SET.has(row.channelId)) {
      formalObjectCounts.set(row.channelId, formalObjectCounts.get(row.channelId) + 1)
      assert.equal(row.priorAcceptanceThresholdChanged, false, `object_threshold_changed:${row.channelId}`)
    }
  }
  for (const channelId of REVIEW_OBJECT_CHANNELS) {
    assert.equal(formalObjectCounts.get(channelId), 1, `formal_object_identity_count_invalid:${channelId}`)
  }
  const issueCodes = [...(aesthetic.issues ?? []), ...(alignment.issues ?? [])].map((entry) => entry.code)
  const passed = aesthetic.passed === true && alignment.passed === true && issueCodes.length === 0
  return {
    status: passed ? "capacity_best_checkpoint_epoch37_machine_review_passed" : "capacity_best_checkpoint_epoch37_machine_review_failed_closed",
    passed,
    issueCodes,
    nextLegalAction: passed ? "cpu_readonly_stage0_qualification_identity_final_adjudication" : "capacity_route_exit_and_project_level_model_route_decision",
  }
}
