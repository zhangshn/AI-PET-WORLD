/**
 * Derive validation counts from one selected training run. A global task capsule
 * may describe a different (usually older) run, so it is only a fallback when
 * no concrete stage record is selected.
 *
 * @param {{
 *   stage: null | {
 *     runId: string,
 *     previews: Array<{ machineReviewPassed: boolean | null }>
 *   },
 *   candidateTerminal: {
 *     runId: string | null,
 *     previewCount: number | null,
 *     previewPassCount: number | null,
 *     previewFailCount: number | null
 *   }
 * }} input
 */
export function deriveSelectedRunValidationSummary({
  stage,
  candidateTerminal,
}) {
  if (stage) {
    const reviewedPreviews = stage.previews.filter(
      (preview) => preview.machineReviewPassed !== null,
    );
    const passedPreviewCount = reviewedPreviews.filter(
      (preview) => preview.machineReviewPassed === true,
    ).length;
    const failedPreviewCount = reviewedPreviews.filter(
      (preview) => preview.machineReviewPassed === false,
    ).length;
    return {
      reviewedPreviews,
      expectedPreviewCount: stage.previews.length,
      completedPreviewCount: reviewedPreviews.length,
      passedPreviewCount,
      failedPreviewCount,
      selectedRunMatchesCapsule: stage.runId === candidateTerminal.runId,
      source: "selected_training_run",
    };
  }

  const passedPreviewCount = candidateTerminal.previewPassCount ?? 0;
  const failedPreviewCount = candidateTerminal.previewFailCount ?? 0;
  return {
    reviewedPreviews: [],
    expectedPreviewCount:
      candidateTerminal.previewCount ??
      passedPreviewCount + failedPreviewCount,
    completedPreviewCount: passedPreviewCount + failedPreviewCount,
    passedPreviewCount,
    failedPreviewCount,
    selectedRunMatchesCapsule: true,
    source: "current_task_capsule_fallback",
  };
}
