import assert from "node:assert/strict"
import test from "node:test"
import { validateV21ReviewClosure } from
  "../close-ai-painter-stage4-mvp-v21-dry-review.mjs"

const runId = "mvp-v21-dry-stage0-123c625425ce959dbc0a8d5065bf158ecf97c164b07aaa4e"
const root = ".runtime/ai-painter/stage4-mvp-object-residual-v21-dry-executions/" +
  `mvp-v21-dry-batch-123c625425ce959dbc0a8d5065bf158ecf97c164/stages/${runId}`
const training = { path: `${root}/training-finalize.json`,
  sha256: "e4d981d2a3c197e878670dbefcc6076ae3bd0f161fbf960ad1cdebf126770e18" }
const worker = { path: `${root}/phase-terminal.json`,
  sha256: "9f6cfecc136a863beb6449dd0179e3924fe9408114f6fc0ca2da809ae567c8fb" }
const checkpoint = { path: `${root}/epochs/epoch-12.pt`,
  sha256: "3ea4bdb543f02310b83bbc292b8324e52c99d77d11144ea911ce41df0c596115" }
const report = { path: `${root}/dry-review/report.json`,
  sha256: "7e5cb08af4be30f47c9a7f46065ecffd7a27af2f54e517cc4f04fed4bd3a164f" }
const auditBinding = { path: `${root}/dry-review/independent-audit.json`,
  sha256: "eef04665b1f92dfae7bcb57f900c8539cfac33ff650d508341414b1297fa29b9" }
const candidate = { path: `${root}/dry-review/generated.png`, sha256: "1".repeat(64),
  width: 256, height: 192, role: "complete_rgb_candidate" }
const original = { path: "synthetic/original.png", sha256: "2".repeat(64) }
const modelSha = "3".repeat(64)
const issueCodes = ["object_footprints", "object_tree", "object_rock", "object_vegetation"]
  .map(role => `condition_${role}_reference_semantic_mismatch`)

function fixture() {
  return {
    registrySha256: "641ed00804bdd4796210fe32c6985cd66dc422e8e92373a0668e94e079e0e27e",
    registry: { registryRevision: 322,
      capabilityVersion: "stage4_mvp_native_rgb_object_residual_v21_support_trial",
      packageId: "mvp-v21-dry-package-123c625425ce959dbc0a8d5065bf158ecf97c164",
      packageSha256: training.sha256,
      taskKind: "dry_single_world_bounded_training", executionState: "completed",
      activity: "training_completed_review_pending", activeExecution: null,
      queueStatus: "completed", nextMachineAction: "v21_dry_materialization_adapter_required",
      taskId: runId, runId,
      latestTrainingTerminal: { ...training, runId, status: "training_completed_review_pending" },
      terminalEvidence: { ...training, status: "training_completed_review_pending" } },
    trainingTerminal: { schemaVersion: "ai-painter-stage4-mvp-v21-dry-training-lifecycle-v1",
      runId, status: "training_completed_review_pending", executionState: "completed",
      formalStage0QualificationGranted: false, runtimePublicationGranted: false,
      workerTerminal: structuredClone(worker), checkpoint: structuredClone(checkpoint) },
    workerTerminal: { schemaVersion:
      "ai-painter-stage4-mvp-object-residual-v21-dry-stage0-training-terminal-v1",
      runId, status: "training_completed_review_pending", executionState: "completed",
      checkpoint: structuredClone(checkpoint), selectedEpoch: 12, selectedRank: [-.14, -.30, -12],
      completedEpochs: 24, optimizerStepsGenerator: 1152, optimizerStepsDiscriminator: 1152,
      checkpointReloadVerified: true, stagePassed: false, stage4QualificationGranted: false,
      modelStateSha256: modelSha },
    materialization: { schemaVersion:
      "ai-painter-stage4-mvp-object-residual-v21-dry-review-materialization-v1",
      status: "dry_review_materialized_pending_independent_audit",
      capabilityVersion: "stage4_mvp_native_rgb_object_residual_v21_support_trial",
      runId, candidateCount: 1, workerTerminal: structuredClone(worker),
      checkpoint: structuredClone(checkpoint), selectedEpoch: 12,
      device: "cuda", precision: "bfloat16", weightsUnmodifiedVerified: true,
      formalStage0QualificationGranted: false, stage4ProgressIncreaseGranted: false,
      runtimePublicationGranted: false, visualQualityGranted: false,
      modelStateSha256: modelSha, modelStateSha256Before: modelSha,
      modelStateSha256After: modelSha,
      candidate: { sampleId: "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2",
        sampleIndex: 0, split: "validation", referenceRgb: structuredClone(original),
        candidateRgb: structuredClone(candidate) },
      sampleIdentity: { image: structuredClone(original) },
      artifacts: { "generated.png": { path: candidate.path, sha256: candidate.sha256 } },
      objectResidualEvidence: { roles: {} }, trainingTerminal: structuredClone(training) },
    audit: { schemaVersion: "ai-painter-stage4-mvp-v21-dry-independent-audit-v1",
      status: "dry_single_world_visual_slice_failed_closed", runId,
      sampleId: "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2",
      materialization: structuredClone(report), candidateRgb: structuredClone(candidate),
      selectedEpoch: 12, selectedRank: [-.14, -.30, -12],
      objectResidualEvidence: { roles: {} },
      detail: { passed: true }, aesthetic: { passed: true }, alignment: { passed: false },
      issueCodes: [...issueCodes], formalStage0QualificationGranted: false,
      stage4ProgressIncreaseGranted: false, runtimePublicationGranted: false,
      visualQualityGranted: false },
    auditBinding: structuredClone(auditBinding),
    materializationBinding: structuredClone(report),
  }
}

test("V21 dry review terminal preserves training identity and closes only the failed review", () => {
  const input = fixture()
  const terminal = validateV21ReviewClosure(input)
  assert.equal(terminal.executionState, "failed_closed")
  assert.equal(terminal.machineReviewStatus, "review_failed")
  assert.equal(terminal.taskKind, "dry_single_world_independent_review")
  assert.deepEqual(terminal.sourceTrainingTerminal,
    { ...training, status: "training_completed_review_pending" })
  assert.deepEqual(terminal.issueCodes, issueCodes)
  assert.equal(terminal.automaticRetryStarted, false)
  assert.equal(terminal.optimizerSteps, 0)
  assert.equal(terminal.nextMachineAction, null)
  for (const key of ["formalStage0QualificationGranted", "stage4ProgressIncreaseGranted",
    "runtimePublicationGranted", "visualQualityGranted"])
    assert.equal(terminal[key], false)
  assert.equal(input.registry.terminalEvidence.status, "training_completed_review_pending")
})

test("stale registry, foreign evidence, incomplete run, or false approval fails closed", () => {
  const changes = [
    x => { x.registrySha256 = "0".repeat(64) },
    x => { x.registry.registryRevision = 323 },
    x => { x.registry.capabilityVersion = "other" },
    x => { x.registry.activeExecution = { processId: 1 } },
    x => { x.registry.latestTrainingTerminal.sha256 = "0".repeat(64) },
    x => { x.trainingTerminal.checkpoint.sha256 = "0".repeat(64) },
    x => { x.workerTerminal.completedEpochs = 23 },
    x => { x.workerTerminal.checkpointReloadVerified = false },
    x => { x.materialization.trainingTerminal.sha256 = "0".repeat(64) },
    x => { x.materialization.candidate.split = "challenge" },
    x => { x.materialization.candidate.referenceRgb.sha256 = "0".repeat(64) },
    x => { x.audit.runId = "foreign" },
    x => { x.audit.materialization.sha256 = "0".repeat(64) },
    x => { x.audit.candidateRgb.sha256 = "0".repeat(64) },
    x => { x.audit.alignment.passed = true },
    x => { x.audit.issueCodes = [] },
    x => { x.audit.visualQualityGranted = true },
    x => { x.audit.status = "dry_single_world_numeric_audit_passed_visual_approval_pending" },
  ]
  for (const change of changes) {
    const input = fixture(); change(input)
    assert.throws(() => validateV21ReviewClosure(input))
  }
})
