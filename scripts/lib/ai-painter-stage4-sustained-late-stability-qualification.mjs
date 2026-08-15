import assert from "node:assert/strict"

export const FIXED_EPOCHS = Object.freeze([1, 5, 10, 20, 30])
export const QUALIFICATION_EPOCHS = Object.freeze([10, 20, 30])

export function validateSustainedLateStabilityEvidence({ terminal, finalization, manifest, review }) {
  assert.equal(terminal.status, "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed")
  assert.ok(terminal.blockers?.includes("fixed_preview_machine_review_failed"))
  assert.equal(finalization.status, "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed")
  assert.equal(manifest.status, "conditional_denoiser_single_sample_overfit_smoke_completed")
  assert.equal(review.status, "machine_reviews_failed_closed")
  assert.deepEqual(review.requiredPreviewEpochs, FIXED_EPOCHS)
  assert.equal(review.reviewThresholdsChanged, false)
  assert.equal(review.previewCount, 5)
  assert.equal(review.previewPassCount, 3)
  assert.equal(review.previewFailCount, 2)
  assert.deepEqual(review.reviews.map((row) => row.epoch), FIXED_EPOCHS)
  assert.equal(manifest.modelStateHashEvidence?.weightsChanged, true)
  assert.notEqual(manifest.modelStateHashEvidence?.initialDenoiserStateSha256, manifest.modelStateHashEvidence?.finalDenoiserStateSha256)
  const reproduction = manifest.stage4UnifiedTrainingPreviewSampling
  assert.equal(reproduction?.status, "checkpoint_bound_preview_reproduced_exactly")
  assert.equal(reproduction?.bestEpoch, 30)
  assert.equal(reproduction?.denoiserStateIdentityMatches, true)
  assert.equal(reproduction?.previewSha256Matches, true)
  assert.equal(reproduction?.machineReviewThresholdsChanged, false)
  return true
}

export function adjudicateSustainedLateStability(input) {
  validateSustainedLateStabilityEvidence(input)
  const rows = QUALIFICATION_EPOCHS.map((epoch) => input.review.reviews.find((row) => row.epoch === epoch))
  assert.ok(rows.every(Boolean))
  const rowPasses = rows.map((row) => (
    row.passed === true
    && Array.isArray(row.issueCodes)
    && row.issueCodes.length === 0
    && row.conditionAlignment?.passed === true
    && row.conditionAlignment?.channelAudits?.every((item) => item.passed === true)
    && row.conditionAlignment?.objectSemanticAudits?.every((item) => item.passed === true)
    && row.professionalAesthetic?.passed === true
  ))
  const consecutiveLatePassCount = rowPasses.reduce((count, passed) => passed ? count + 1 : 0, 0)
  const qualified = rowPasses.every(Boolean) && consecutiveLatePassCount === 3
  return {
    schemaVersion: "ai-painter-stage4-object-visible-structure-sustained-late-stability-adjudication-v1",
    status: qualified ? "three_consecutive_late_previews_qualified" : "sustained_late_stability_not_qualified",
    qualified,
    fixedEpochs: FIXED_EPOCHS,
    diagnosticEpochs: [1, 5],
    qualificationEpochs: QUALIFICATION_EPOCHS,
    rowPasses,
    consecutiveLatePassCount,
    minimumConsecutiveLatePasses: 3,
    finalEpochPassed: rowPasses.at(-1) === true,
    previewBytesReproduced: input.manifest.stage4UnifiedTrainingPreviewSampling.previewSha256Matches === true,
    modelStateIdentityReproduced: input.manifest.stage4UnifiedTrainingPreviewSampling.denoiserStateIdentityMatches === true,
    weightsChanged: input.manifest.modelStateHashEvidence.weightsChanged === true,
    machineReviewThresholdsChanged: input.review.reviewThresholdsChanged,
    sourceEvidenceModified: false,
  }
}
