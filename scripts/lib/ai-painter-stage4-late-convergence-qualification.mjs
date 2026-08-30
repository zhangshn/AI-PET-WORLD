import assert from "node:assert/strict"

export const REQUIRED_EPOCHS = Object.freeze([1, 5, 10, 20, 30])
export const LATE_EPOCHS = Object.freeze([10, 20, 30])

export function resolveLateQualificationIdentity(manifest) {
  const best = manifest.stage4UnifiedTrainingPreviewSampling
  const terminal = manifest.stage4TerminalQualificationIdentity
  assert.equal(best?.status, "checkpoint_bound_preview_reproduced_exactly")
  assert.equal(best?.denoiserStateIdentityMatches, true)
  assert.equal(best?.previewSha256Matches, true)
  assert.equal(best?.machineReviewThresholdsChanged, false)
  if (terminal === undefined) {
    assert.equal(best?.bestEpoch, 30)
    return {
      source: "historical_best_checkpoint_identity",
      epoch: best.bestEpoch,
      previewSha256Matches: best.previewSha256Matches,
      denoiserStateIdentityMatches: best.denoiserStateIdentityMatches,
    }
  }
  assert.equal(
    terminal.status,
    "terminal_epoch_30_identity_saved_and_preview_reproduced_exactly",
  )
  assert.equal(
    terminal.contractId,
    "stage4_best_checkpoint_and_terminal_qualification_identity_separation_v1",
  )
  assert.equal(terminal.terminalEpoch, 30)
  assert.equal(terminal.terminalCheckpointPromotable, false)
  assert.equal(terminal.stage0InitializationEligible, false)
  assert.equal(
    terminal.terminalStateArtifactRole,
    "non_promotable_late_stability_qualification_evidence_only",
  )
  assert.equal(terminal.denoiserStateIdentityMatches, true)
  assert.equal(terminal.previewSha256Matches, true)
  assert.equal(
    terminal.sourcePreview?.denoiserStateSha256,
    terminal.terminalDenoiserStateSha256,
  )
  assert.equal(
    terminal.reproducedPreview?.denoiserStateSha256,
    terminal.terminalDenoiserStateSha256,
  )
  assert.equal(
    terminal.sourcePreview?.previewSha256,
    terminal.reproducedPreview?.previewSha256,
  )
  assert.equal(terminal.bestCheckpointEpoch, best.bestEpoch)
  assert.equal(
    terminal.bestCheckpointDenoiserStateSha256,
    best.selectedCheckpointDenoiserStateSha256,
  )
  assert.equal(terminal.bestCheckpointSelectionContractUnchanged, true)
  assert.equal(terminal.identityRolesSeparated, true)
  assert.equal(terminal.crossIdentitySubstitutionAllowed, false)
  assert.equal(terminal.mainCheckpointFormatChanged, false)
  assert.equal(terminal.machineReviewThresholdsChanged, false)
  return {
    source: "independent_terminal_qualification_identity",
    epoch: terminal.terminalEpoch,
    previewSha256Matches: terminal.previewSha256Matches,
    denoiserStateIdentityMatches: terminal.denoiserStateIdentityMatches,
  }
}

export function validateBoundTimelineEvidence({ terminal, finalization, manifest, review }) {
  assert.equal(terminal.status, "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed")
  assert.ok(terminal.blockers?.includes("fixed_preview_machine_review_failed"))
  assert.equal(finalization.status, "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed")
  assert.equal(manifest.status, "conditional_denoiser_single_sample_overfit_smoke_completed")
  assert.equal(review.status, "machine_reviews_failed_closed")
  assert.deepEqual(review.requiredPreviewEpochs, REQUIRED_EPOCHS)
  assert.equal(review.reviewThresholdsChanged, false)
  assert.equal(review.previewCount, 5)
  assert.ok(Array.isArray(review.reviews))
  const derivedPreviewPassCount = review.reviews.filter((row) => row.passed === true).length
  const derivedPreviewFailCount = review.reviews.filter((row) => row.passed !== true).length
  assert.equal(review.previewPassCount, derivedPreviewPassCount)
  assert.equal(review.previewFailCount, derivedPreviewFailCount)
  assert.equal(review.previewPassCount + review.previewFailCount, review.previewCount)
  assert.equal(manifest.modelStateHashEvidence?.weightsChanged, true)
  assert.notEqual(
    manifest.modelStateHashEvidence?.initialDenoiserStateSha256,
    manifest.modelStateHashEvidence?.finalDenoiserStateSha256,
  )
  resolveLateQualificationIdentity(manifest)
  assert.deepEqual(review.reviews.map((row) => row.epoch), REQUIRED_EPOCHS)
  return true
}

export function adjudicateLateConvergence({ terminal, finalization, manifest, review }) {
  validateBoundTimelineEvidence({ terminal, finalization, manifest, review })
  const qualificationIdentity = resolveLateQualificationIdentity(manifest)
  const trajectory = adjudicateLateReviewRows(review.reviews)
  const passed = trajectory.qualified
  return {
    schemaVersion: "ai-painter-stage4-terminal-pass-late-convergence-adjudication-v1",
    status: passed
      ? "terminal_pass_with_late_convergence_evidence_qualified"
      : "late_convergence_evidence_not_qualified",
    ...trajectory,
    qualificationIdentitySource: qualificationIdentity.source,
    fixedPreviewReproduced: qualificationIdentity.previewSha256Matches === true,
    modelStateIdentityReproduced: qualificationIdentity.denoiserStateIdentityMatches === true,
    weightsChanged: manifest.modelStateHashEvidence.weightsChanged === true,
    machineReviewThresholdsChanged: review.reviewThresholdsChanged,
    interpretation: passed
      ? trajectory.sustainedZeroFromFirstLateEpoch
        ? "Epochs 1 and 5 remain immutable diagnostics; Epochs 10, 20 and 30 each have exactly zero failures and preserve that stable terminal pass without regression."
        : "Epochs 1 and 5 remain immutable diagnostics; Epochs 10, 20 and 30 provide a non-increasing late trajectory with a real decrease and stable zero failures through the fully reproduced terminal pass."
      : "The immutable evidence does not prove the required late convergence trajectory.",
  }
}

export function adjudicateLateReviewRows(reviews, {
  requiredEpochs = REQUIRED_EPOCHS,
  lateEpochs = LATE_EPOCHS,
} = {}) {
  assert.ok(Array.isArray(reviews), "review rows are required")
  assert.ok(Array.isArray(requiredEpochs) && requiredEpochs.length > 0, "required epochs are required")
  assert.ok(Array.isArray(lateEpochs) && lateEpochs.length > 0, "late epochs are required")
  assert.equal(new Set(requiredEpochs).size, requiredEpochs.length, "required epochs must be unique")
  assert.equal(new Set(lateEpochs).size, lateEpochs.length, "late epochs must be unique")
  assert.ok(lateEpochs.every((epoch) => requiredEpochs.includes(epoch)), "late epochs must be a subset of required epochs")
  assert.deepEqual(reviews.map((row) => row.epoch), requiredEpochs)
  const diagnosticEpochs = requiredEpochs.filter((epoch) => !lateEpochs.includes(epoch))
  const lateReviews = lateEpochs.map((epoch) => reviews.find((row) => row.epoch === epoch))
  assert.ok(lateReviews.every(Boolean))
  // Qualification is result-neutral: the exact issue identities may differ by
  // candidate, but late failures must only disappear, never be introduced.
  const exactSequence = lateReviews.every((row) => (
    Array.isArray(row.issueCodes)
    && row.issueCodes.length === new Set(row.issueCodes).size
    && row.issueCodes.every((code) => typeof code === "string" && code.length > 0)
  ))
  const failureCounts = lateReviews.map((row) => row.issueCodes.length)
  const nonIncreasing = failureCounts.every((count, index) => index === 0 || count <= failureCounts[index - 1])
  const hasStrictDecrease = failureCounts.some((count, index) => index > 0 && count < failureCounts[index - 1])
  const firstZeroIndex = failureCounts.indexOf(0)
  const stableAfterZero = firstZeroIndex >= 0 && failureCounts.slice(firstZeroIndex).every((count) => count === 0)
  const sustainedZeroFromFirstLateEpoch = failureCounts.every((count) => count === 0)
  // Preserve the historical decrease-then-zero route while also accepting a
  // candidate that already has no failures at the first late epoch and keeps
  // that exact zero-failure state through the terminal epoch.
  const strictDecreaseThenStableZero = nonIncreasing && hasStrictDecrease && stableAfterZero
  const supportedLateConvergenceRoute = strictDecreaseThenStableZero || sustainedZeroFromFirstLateEpoch
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
  const qualified = exactSequence && supportedLateConvergenceRoute && noRegression && finalConditionsPass
  return {
    qualified,
    sourceEpochs: requiredEpochs,
    diagnosticEpochs,
    qualificationEpochs: lateEpochs,
    issueSequence: lateReviews.map((row) => ({ epoch: row.epoch, passed: row.passed, issueCodes: row.issueCodes })),
    failureCounts,
    exactSequence,
    strictlyConverging: supportedLateConvergenceRoute,
    strictDecreaseThenStableZero,
    sustainedZeroFromFirstLateEpoch,
    qualificationRoute: sustainedZeroFromFirstLateEpoch
      ? "sustained_zero_from_first_late_epoch"
      : strictDecreaseThenStableZero
        ? "strict_decrease_then_stable_zero"
        : "none",
    nonIncreasing,
    hasStrictDecrease,
    stableAfterZero,
    noRegression,
    finalConditionsPass,
  }
}
