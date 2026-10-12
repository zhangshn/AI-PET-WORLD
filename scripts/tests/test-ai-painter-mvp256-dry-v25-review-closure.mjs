import assert from "node:assert/strict"
import test from "node:test"
import { closeDecision } from "../reconcile-ai-painter-mvp256-dry-v25-review.mjs"

function fixture() {
  const comparison = { runId: "v25", selectedCheckpoint: { path: "epoch-24" }, measurements: {
    v24: { selectionCpu: { meanValidationRgbMae: 0.06, worstApplicableObjectCorrelation: -0.08 } },
    v25: { selectionCpu: { meanValidationRgbMae: 0.07, worstApplicableObjectCorrelation: -0.06 } },
  } }
  const audit = { status: "dry_single_world_review_failed_closed", runId: "v25",
    selectedCheckpoint: comparison.selectedCheckpoint, objectSemanticsPassed: false,
    issueCodes: ["object_failure"], visualApprovalGranted: false,
    formalStage4QualificationGranted: false, runtimePublicationGranted: false }
  return [comparison, audit, { issueCodes: ["prior_failure"] }]
}
test("better worst correlation cannot erase failed semantics or worse RGB", () => {
  const result = closeDecision(...fixture())
  assert.equal(result.routeDecision, "close_regularization_route_no_automatic_retry")
  assert.ok(result.validation.meanRgbMaeDeltaV25MinusV24 > 0)
  assert.ok(result.validation.worstObjectCorrelationDeltaV25MinusV24 > 0)
  assert.equal(result.formalStage4QualificationGranted, false)
})
test("mismatched checkpoint, fake success and nonfinite metrics cannot close as authentic failure", () => {
  for (const mutate of [
    values => { values[1].selectedCheckpoint = { path: "other" } },
    values => { values[1].formalStage4QualificationGranted = true },
    values => { values[1].objectSemanticsPassed = true },
    values => { values[0].measurements.v25.selectionCpu.meanValidationRgbMae = NaN },
  ]) {
    const value = fixture()
    mutate(value)
    assert.throws(() => closeDecision(...value))
  }
})
