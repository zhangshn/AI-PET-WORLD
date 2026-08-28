import assert from "node:assert/strict"

export const ROCK_REFERENCE_SEMANTIC_FAILURE =
  "condition_object_rock_reference_semantic_mismatch"

export function adjudicateRouteCounterfactualSmokeOutcome({
  reviews,
  qualification,
  fixed40 = false,
}) {
  assert.ok(Array.isArray(reviews), "route counterfactual review rows are required")
  assert.equal(typeof qualification?.qualified, "boolean")
  const expectedEpochs = fixed40
    ? [1, 5, 10, 20, 30, 40]
    : [1, 5, 10, 20, 30]
  assert.deepEqual(reviews.map((row) => row.epoch), expectedEpochs)
  if (qualification.qualified) {
    return {
      outcome: "qualified_for_formal_stage0",
      lifecycleTarget: "controlled_smoke_completed",
      nextLegalAction: fixed40
        ? "compile_route_counterfactual_compositor_formal_stage0"
        : "compile_route_counterfactual_compositor_stage0",
      taskKind: "formal_stage_training",
      terminalStatus: fixed40
        ? "route_counterfactual_compositor_fixed_40_epoch_qualification_succeeded"
        : "route_counterfactual_compositor_controlled_smoke_succeeded",
    }
  }
  if (fixed40) {
    return {
      outcome: "fixed_40_upper_bound_real_visual_failure",
      lifecycleTarget: "rejected",
      nextLegalAction:
        "retire_fixed40_successor_and_escalate_generation_paradigm",
      taskKind: "project_level_route_decision",
      terminalStatus:
        "route_counterfactual_compositor_fixed_40_epoch_qualification_real_visual_failure",
    }
  }
  const lateRows = [10, 20, 30].map((epoch) =>
    reviews.find((row) => row.epoch === epoch),
  )
  assert.ok(lateRows.every(Boolean), "route counterfactual late review rows are missing")
  const failureCounts = lateRows.map((row) => row.issueCodes.length)
  const strictlyDecreasing = failureCounts.every(
    (count, index) => index === 0 || count < failureCounts[index - 1],
  )
  const terminalIssues = [...lateRows.at(-1).issueCodes]
  const onlyRockAtTerminal =
    terminalIssues.length === 1
    && terminalIssues[0] === ROCK_REFERENCE_SEMANTIC_FAILURE
  const noIntroducedFailure = lateRows.every((row, index) => {
    if (index === 0) return true
    const previous = new Set(lateRows[index - 1].issueCodes)
    return row.issueCodes.every((code) => previous.has(code))
  })
  if (strictlyDecreasing && onlyRockAtTerminal && noIntroducedFailure) {
    return {
      outcome: "bounded_late_convergence_analysis_required",
      lifecycleTarget: null,
      nextLegalAction:
        "analyze_route_counterfactual_only_rock_late_convergence_for_fixed_40_qualification",
      taskKind: "cpu_readonly_analysis",
      terminalStatus:
        "route_counterfactual_compositor_controlled_smoke_late_convergence_analysis_required",
      failureCounts,
      terminalIssues,
    }
  }
  return {
    outcome: "route_failure_without_bounded_late_convergence",
    lifecycleTarget: "rejected",
    nextLegalAction:
      "retire_route_counterfactual_compositor_and_escalate_generation_paradigm",
    taskKind: "project_level_route_decision",
    terminalStatus:
      "route_counterfactual_compositor_controlled_smoke_real_visual_failure",
    failureCounts,
    terminalIssues,
  }
}
