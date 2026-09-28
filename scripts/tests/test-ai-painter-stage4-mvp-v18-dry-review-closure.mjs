import assert from "node:assert/strict"
import test from "node:test"
import { validateV18ReviewClosure } from
  "../close-ai-painter-stage4-mvp-v18-dry-review.mjs"

const training = { runId: "v18-run", path: "runs/v18/training-finalize.json", sha256: "a".repeat(64),
  status: "training_completed_review_pending" }
const materializationBinding = { path: "runs/v18/dry-review/report.json", sha256: "b".repeat(64) }
const auditBinding = { path: "runs/v18/dry-review/independent-audit.json", sha256: "c".repeat(64) }

function fixture() {
  return {
    registry: { capabilityVersion: "stage4_mvp_native_rgb_structured_object_v18",
      taskKind: "dry_single_world_bounded_training", executionState: "completed",
      activity: "training_completed_review_pending", activeExecution: null,
      taskId: "v18-run", runId: "v18-run", latestTrainingTerminal: structuredClone(training),
      terminalEvidence: { path: training.path, sha256: training.sha256, status: training.status } },
    audit: { schemaVersion: "ai-painter-stage4-mvp-v18-dry-independent-audit-v1",
      status: "dry_single_world_visual_slice_failed_closed", runId: "v18-run",
      materialization: structuredClone(materializationBinding),
      detail: { passed: true }, aesthetic: { passed: true }, alignment: { passed: false },
      issueCodes: ["condition_object_tree_reference_semantic_mismatch"],
      formalStage0QualificationGranted: false, stage4ProgressIncreaseGranted: false,
      runtimePublicationGranted: false, visualQualityGranted: false },
    materialization: { schemaVersion:
      "ai-painter-stage4-mvp-structured-object-v18-dry-review-materialization-v1",
      status: "dry_review_materialized_pending_independent_audit",
      capabilityVersion: "stage4_mvp_native_rgb_structured_object_v18",
      runId: "v18-run", candidateCount: 1,
      trainingTerminal: { path: training.path, sha256: training.sha256 } },
    trainingTerminal: { runId: "v18-run", status: training.status, executionState: "completed" },
    auditBinding: structuredClone(auditBinding),
    materializationBinding: structuredClone(materializationBinding),
  }
}

test("dry review terminal is distinct from the immutable training terminal", () => {
  const input = fixture()
  const terminal = validateV18ReviewClosure(input)
  assert.equal(terminal.executionState, "failed_closed")
  assert.equal(terminal.machineReviewStatus, "review_failed")
  assert.equal(terminal.taskKind, "dry_single_world_independent_review")
  assert.deepEqual(terminal.sourceTrainingTerminal,
    { path: training.path, sha256: training.sha256, status: training.status })
  assert.equal(terminal.formalStage0QualificationGranted, false)
  assert.equal(input.registry.terminalEvidence.status, "training_completed_review_pending")
})

test("foreign or falsely approved dry review fails closed", () => {
  for (const alter of [
    x => { x.registry.capabilityVersion = "stage4_mvp_native_rgb_structured_object_v17" },
    x => { x.registry.activeExecution = { processId: 1 } },
    x => { x.registry.latestTrainingTerminal.sha256 = "d".repeat(64) },
    x => { x.materialization.trainingTerminal.sha256 = "d".repeat(64) },
    x => { x.audit.runId = "foreign-run" },
    x => { x.audit.materialization.sha256 = "d".repeat(64) },
    x => { x.audit.alignment.passed = true },
    x => { x.audit.visualQualityGranted = true },
    x => { x.audit.issueCodes = [] },
    x => { x.audit.status = "dry_single_world_numeric_audit_passed_visual_approval_pending" },
  ]) {
    const input = fixture()
    alter(input)
    assert.throws(() => validateV18ReviewClosure(input))
  }
})
