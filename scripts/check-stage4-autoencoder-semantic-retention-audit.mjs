import assert from "node:assert/strict"
import { CLASS_IDENTITIES, DECISION_A, DECISION_B, DECISION_C, adjudicateAutoencoderSemanticRetention } from "./lib/ai-painter-stage4-autoencoder-semantic-retention-audit.mjs"

function fixture() {
  const rows = Array.from({ length: 64 }, (_, index) => ({
    sourceIndex: index,
    sampleId: `sample-${String(index).padStart(2, "0")}`,
    split: index < 48 ? "train" : index < 56 ? "validation" : index < 60 ? "challenge" : "regression",
    latent: { finite: true },
    featureStages: [{ finite: true }, { finite: true }, { finite: true }],
    classMetrics: CLASS_IDENTITIES.map((classIdentity) => ({ sampleId: `sample-${String(index).padStart(2, "0")}`, classIdentity, metricsFinite: true, referenceResponsePassed: true, latentMaskContrastFiniteNonZero: true })),
  }))
  return {
    status: "frozen_autoencoder_semantic_retention_gpu_audit_completed",
    approvedRecordCount: 64,
    splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
    sourceOrderPreserved: true,
    checkpointSha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
    autoencoderFrozen: true,
    autoencoderStateUnchanged: true,
    denoiserCheckpointRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    rows,
  }
}

const positive = []
const negative = []
const pass = (name, fn) => { fn(); positive.push({ name, passed: true }) }
const reject = (name, mutate, pattern) => { const value = structuredClone(fixture()); mutate(value); assert.throws(() => adjudicateAutoencoderSemanticRetention(value), pattern); negative.push({ name, passed: true }) }

pass("all_256_class_pairs_pass_selects_sufficient", () => assert.equal(adjudicateAutoencoderSemanticRetention(fixture()).selectedDecision, DECISION_B))
pass("one_reference_failure_selects_gap", () => { const value = fixture(); value.rows[3].classMetrics[1].referenceResponsePassed = false; assert.equal(adjudicateAutoencoderSemanticRetention(value).selectedDecision, DECISION_A) })
pass("latent_contrast_indeterminate_selects_evidence_insufficient", () => { const value = fixture(); value.rows[3].classMetrics[1].latentMaskContrastFiniteNonZero = false; assert.equal(adjudicateAutoencoderSemanticRetention(value).selectedDecision, DECISION_C) })
pass("gap_reports_affected_identity", () => { const value = fixture(); value.rows[3].classMetrics[1].referenceResponsePassed = false; const result = adjudicateAutoencoderSemanticRetention(value); assert.deepEqual(result.affectedClasses, ["tree"]); assert.equal(result.affectedSampleCount, 1) })

reject("rejects_record_count_change", (v) => { v.approvedRecordCount = 63 }, /record_count/)
reject("rejects_split_change", (v) => { v.splitCounts.train = 47 }, /split_counts/)
reject("rejects_source_reorder", (v) => { v.sourceOrderPreserved = false }, /source_order/)
reject("rejects_checkpoint_change", (v) => { v.checkpointSha256 = "0".repeat(64) }, /checkpoint_identity/)
reject("rejects_unfrozen_autoencoder", (v) => { v.autoencoderFrozen = false }, /not_frozen/)
reject("rejects_state_change", (v) => { v.autoencoderStateUnchanged = false }, /state_changed/)
reject("rejects_denoiser_checkpoint_read", (v) => { v.denoiserCheckpointRead = true }, /denoiser_checkpoint/)
reject("rejects_optimizer", (v) => { v.optimizerCreated = true }, /optimizer/)
reject("rejects_backward", (v) => { v.backwardExecuted = true }, /backward/)
reject("rejects_training", (v) => { v.trainingStarted = true }, /training/)
reject("rejects_duplicate_sample", (v) => { v.rows[1].sampleId = v.rows[0].sampleId }, /sample_identity/)
reject("rejects_class_order_change", (v) => { v.rows[0].classMetrics.reverse() }, /class_order/)
reject("rejects_nonfinite_latent", (v) => { v.rows[0].latent.finite = false }, /latent_not_finite/)
reject("rejects_insufficient_feature_stages", (v) => { v.rows[0].featureStages = [] }, /feature_stages/)
reject("rejects_nonfinite_metric", (v) => { v.rows[0].classMetrics[0].metricsFinite = false }, /class_metric/)

console.log(JSON.stringify({ schemaVersion: "stage4-autoencoder-semantic-retention-cpu-report-v1", status: "passed", positive: { passed: positive.length, total: positive.length, cases: positive }, negative: { passed: negative.length, total: negative.length, cases: negative }, checkpointRead: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false }, null, 2))
