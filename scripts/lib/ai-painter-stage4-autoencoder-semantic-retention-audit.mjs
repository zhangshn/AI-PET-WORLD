import assert from "node:assert/strict"

export const DECISION_A = "frozen_autoencoder_semantic_retention_gap_confirmed"
export const DECISION_B = "frozen_autoencoder_semantic_retention_sufficient"
export const DECISION_C = "evidence_insufficient_for_autoencoder_boundary_decision"
export const CLASS_IDENTITIES = Object.freeze(["footprints", "tree", "rock", "vegetation"])

export function adjudicateAutoencoderSemanticRetention(report) {
  assert.equal(report.status, "frozen_autoencoder_semantic_retention_gpu_audit_completed", "gpu_report_status_invalid")
  assert.equal(report.approvedRecordCount, 64, "approved_record_count_changed")
  assert.deepEqual(report.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 }, "split_counts_changed")
  assert.equal(report.sourceOrderPreserved, true, "source_order_changed")
  assert.equal(report.checkpointSha256, "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba", "autoencoder_checkpoint_identity_changed")
  assert.equal(report.autoencoderFrozen, true, "autoencoder_not_frozen")
  assert.equal(report.autoencoderStateUnchanged, true, "autoencoder_state_changed")
  assert.equal(report.denoiserCheckpointRead, false, "denoiser_checkpoint_read")
  assert.equal(report.optimizerCreated, false, "optimizer_created")
  assert.equal(report.backwardExecuted, false, "backward_executed")
  assert.equal(report.trainingStarted, false, "training_started")
  assert.equal(report.rows.length, 64, "row_count_changed")
  assert.equal(new Set(report.rows.map((row) => row.sampleId)).size, 64, "sample_identity_not_unique")
  for (const row of report.rows) {
    assert.equal(row.classMetrics.length, 4, `class_count_changed:${row.sampleId}`)
    assert.deepEqual(row.classMetrics.map((item) => item.classIdentity), CLASS_IDENTITIES, `class_order_changed:${row.sampleId}`)
    assert.equal(row.latent.finite, true, `latent_not_finite:${row.sampleId}`)
    assert.equal(row.featureStages.length >= 3, true, `feature_stages_insufficient:${row.sampleId}`)
    assert.equal(row.featureStages.every((stage) => stage.finite === true), true, `feature_stage_not_finite:${row.sampleId}`)
    assert.equal(row.classMetrics.every((item) => item.metricsFinite === true), true, `class_metric_not_finite:${row.sampleId}`)
  }
  const allClassMetrics = report.rows.flatMap((row) => row.classMetrics)
  const failed = allClassMetrics.filter((item) => item.referenceResponsePassed !== true)
  const latentIndeterminate = allClassMetrics.filter((item) => item.latentMaskContrastFiniteNonZero !== true)
  if (failed.length > 0) {
    return {
      schemaVersion: "stage4-frozen-autoencoder-semantic-retention-adjudication-v1",
      status: DECISION_A,
      selectedDecision: DECISION_A,
      failedClassAuditCount: failed.length,
      affectedSampleCount: new Set(failed.map((item) => item.sampleId)).size,
      affectedClasses: [...new Set(failed.map((item) => item.classIdentity))],
      reason: "The frozen Autoencoder roundtrip causes one or more approved sample/class pairs to fail the unchanged final-visible reference-response contract.",
    }
  }
  if (latentIndeterminate.length > 0) {
    return {
      schemaVersion: "stage4-frozen-autoencoder-semantic-retention-adjudication-v1",
      status: DECISION_C,
      selectedDecision: DECISION_C,
      indeterminateClassAuditCount: latentIndeterminate.length,
      reason: "Decoded RGB passes the frozen reference-response contract, but one or more class masks have no finite nonzero latent contrast evidence.",
    }
  }
  return {
    schemaVersion: "stage4-frozen-autoencoder-semantic-retention-adjudication-v1",
    status: DECISION_B,
    selectedDecision: DECISION_B,
    passedClassAuditCount: allClassMetrics.length,
    affectedSampleCount: 0,
    reason: "All 64 approved references and all four object classes preserve the unchanged RGB, edge and luminance-correlation qualification through the frozen Autoencoder roundtrip, with finite nonzero latent mask contrast evidence.",
  }
}
