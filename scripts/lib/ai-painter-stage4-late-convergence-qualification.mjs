import assert from "node:assert/strict"

export const REQUIRED_EPOCHS = Object.freeze([1, 5, 10, 20, 30])
export const LATE_EPOCHS = Object.freeze([10, 20, 30])

export function validateBoundTimelineEvidence({ terminal, finalization, manifest, review }) {
  assert.equal(terminal.status, "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed")
  assert.ok(terminal.blockers?.includes("fixed_preview_machine_review_failed"))
  assert.equal(finalization.status, "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed")
  assert.equal(manifest.status, "conditional_denoiser_single_sample_overfit_smoke_completed")
  assert.equal(review.status, "machine_reviews_failed_closed")
  assert.deepEqual(review.requiredPreviewEpochs, REQUIRED_EPOCHS)
  assert.equal(review.reviewThresholdsChanged, false)
  assert.equal(review.previewCount, 5)
  assert.equal(review.previewPassCount, 1)
  assert.equal(review.previewFailCount, 4)
  assert.equal(manifest.modelStateHashEvidence?.weightsChanged, true)
  assert.notEqual(
    manifest.modelStateHashEvidence?.initialDenoiserStateSha256,
    manifest.modelStateHashEvidence?.finalDenoiserStateSha256,
  )
  const reproduction = manifest.stage4UnifiedTrainingPreviewSampling
  assert.equal(reproduction?.status, "checkpoint_bound_preview_reproduced_exactly")
  assert.equal(reproduction?.bestEpoch, 30)
  assert.equal(reproduction?.denoiserStateIdentityMatches, true)
  assert.equal(reproduction?.previewSha256Matches, true)
  assert.equal(reproduction?.machineReviewThresholdsChanged, false)
  assert.deepEqual(review.reviews.map((row) => row.epoch), REQUIRED_EPOCHS)
  return true
}

export function adjudicateLateConvergence({ terminal, finalization, manifest, review }) {
  validateBoundTimelineEvidence({ terminal, finalization, manifest, review })
  const lateReviews = LATE_EPOCHS.map((epoch) => review.reviews.find((row) => row.epoch === epoch))
  assert.ok(lateReviews.every(Boolean))
  // Qualification is result-neutral: the exact issue identities may differ by
  // candidate, but late failures must only disappear, never be introduced.
  const exactSequence = lateReviews.every((row) => (
    Array.isArray(row.issueCodes)
    && row.issueCodes.length === new Set(row.issueCodes).size
    && row.issueCodes.every((code) => typeof code === "string" && code.length > 0)
  ))
  const failureCounts = lateReviews.map((row) => row.issueCodes.length)
  const strictlyConverging = failureCounts.every((count, index) => index === 0 || count < failureCounts[index - 1])
  const noRegression = lateReviews.every((row, index) => {
    if (index === 0) return true
    const previous = new Set(lateReviews[index - 1].issueCodes)
    return row.issueCodes.every((code) => previous.has(code))
  })
  const finalReview = lateReviews.at(-1)
  const finalConditionsPass = finalReview.passed === true
    && finalReview.issueCodes.length === 0
    && finalReview.conditionAlignment?.passed === true
    && finalReview.conditionAlignment?.channelAudits?.every((item) => item.passed === true)
    && finalReview.conditionAlignment?.objectSemanticAudits?.every((item) => item.passed === true)
  const passed = exactSequence && strictlyConverging && noRegression && finalConditionsPass
  return {
    schemaVersion: "ai-painter-stage4-terminal-pass-late-convergence-adjudication-v1",
    status: passed
      ? "terminal_pass_with_late_convergence_evidence_qualified"
      : "late_convergence_evidence_not_qualified",
    qualified: passed,
    sourceEpochs: REQUIRED_EPOCHS,
    diagnosticEpochs: [1, 5],
    qualificationEpochs: LATE_EPOCHS,
    issueSequence: lateReviews.map((row) => ({ epoch: row.epoch, passed: row.passed, issueCodes: row.issueCodes })),
    failureCounts,
    exactSequence,
    strictlyConverging,
    noRegression,
    finalConditionsPass,
    fixedPreviewReproduced: manifest.stage4UnifiedTrainingPreviewSampling.previewSha256Matches === true,
    modelStateIdentityReproduced: manifest.stage4UnifiedTrainingPreviewSampling.denoiserStateIdentityMatches === true,
    weightsChanged: manifest.modelStateHashEvidence.weightsChanged === true,
    machineReviewThresholdsChanged: review.reviewThresholdsChanged,
    interpretation: passed
      ? "Epochs 1 and 5 remain immutable diagnostics; Epochs 10, 20 and 30 provide a strictly converging late trajectory ending in a fully reproduced terminal pass."
      : "The immutable evidence does not prove the required late convergence trajectory.",
  }
}
