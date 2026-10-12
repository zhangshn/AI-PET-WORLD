import assert from "node:assert/strict"
import test from "node:test"
import { closeDecision } from "../reconcile-ai-painter-mvp256-dry-appearance-regime-review.mjs"

function fixture() {
  const comparison = { runId: "v28", selectedCheckpoint: { path: "epoch-24" }, measurements: {
    v24: { selectionCpu: { meanValidationRgbMae: 0.06140733743086457, worstApplicableObjectCorrelation: -0.08459185063838959, } },
    v28: { selectionCpu: { meanValidationRgbMae: 0.07, worstApplicableObjectCorrelation: -0.06 } },
  } }
  const audit = { status: "dry_single_world_review_failed_closed", runId: "v28",
    selectedCheckpoint: comparison.selectedCheckpoint, objectSemanticsPassed: false,
    issueCodes: ["object_failure"], visualApprovalGranted: false,
    formalStage4QualificationGranted: false, runtimePublicationGranted: false }
  return [comparison, audit, { issueCodes: ["prior_failure"] }]
}
test("better worst correlation cannot erase failed semantics or worse RGB", () => {
  const result = closeDecision(...fixture())
  assert.equal(result.routeDecision, "close_appearance_regime_route_no_automatic_retry")
  assert.ok(result.validation.meanRgbMaeDeltaV28MinusV24 > 0)
  assert.ok(result.validation.worstObjectCorrelationDeltaV28MinusV24 > 0)
  assert.equal(result.formalStage4QualificationGranted, false)
})
test("mismatched checkpoint, fake success and nonfinite metrics cannot close as authentic failure", () => {
  for (const mutate of [
    values => { values[1].selectedCheckpoint = { path: "other" } },
    values => { values[1].formalStage4QualificationGranted = true },
    values => { values[1].status = "dry_single_world_numeric_passed_visual_approval_pending" },
    values => { values[0].measurements.v28.selectionCpu.meanValidationRgbMae = NaN },
  ]) {
    const value = fixture()
    mutate(value)
    assert.throws(() => closeDecision(...value))
  }
})


test("numeric success with RGB regression closes, not promoted", () => {
  const values = fixture()
  values[1].status = "dry_single_world_numeric_passed_visual_approval_pending"
  values[1].objectSemanticsPassed = true
  values[1].issueCodes = []
  assert.equal(closeDecision(...values).status, "dry_single_world_review_failed_closed")
  values[0].measurements.v28.selectionCpu.meanValidationRgbMae = 0.05
  const result = closeDecision(...values)
  assert.equal(result.status, values[1].status)
  assert.equal(result.visualApprovalGranted, false)
  assert.equal(result.formalStage4QualificationGranted, false)
})
