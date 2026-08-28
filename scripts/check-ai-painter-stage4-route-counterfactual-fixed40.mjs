import assert from "node:assert/strict"

import {
  adjudicateRouteCounterfactualSmokeOutcome,
  ROCK_REFERENCE_SEMANTIC_FAILURE,
} from "./lib/ai-painter-route-counterfactual-smoke-outcome-v1.mjs"

function row(epoch, issueCodes) {
  return {
    epoch,
    passed: issueCodes.length === 0,
    issueCodes,
  }
}

const common = [
  row(1, ["water", "route", "tree", "rock"]),
  row(5, ["route", "tree", "rock"]),
]
const bounded = adjudicateRouteCounterfactualSmokeOutcome({
  reviews: [
    ...common,
    row(10, ["route", "tree", ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(20, ["tree", ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(30, [ROCK_REFERENCE_SEMANTIC_FAILURE]),
  ],
  qualification: { qualified: false },
})
assert.equal(bounded.outcome, "bounded_late_convergence_analysis_required")
assert.equal(bounded.lifecycleTarget, null)
assert.equal(
  bounded.nextLegalAction,
  "analyze_route_counterfactual_only_rock_late_convergence_for_fixed_40_qualification",
)

const flat = adjudicateRouteCounterfactualSmokeOutcome({
  reviews: [
    ...common,
    row(10, ["tree", ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(20, ["tree", ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(30, [ROCK_REFERENCE_SEMANTIC_FAILURE]),
  ],
  qualification: { qualified: false },
})
assert.equal(flat.lifecycleTarget, "rejected")

const changedIdentity = adjudicateRouteCounterfactualSmokeOutcome({
  reviews: [
    ...common,
    row(10, ["route", "tree", ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(20, ["new_failure", ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(30, [ROCK_REFERENCE_SEMANTIC_FAILURE]),
  ],
  qualification: { qualified: false },
})
assert.equal(changedIdentity.lifecycleTarget, "rejected")

const fixed40Pass = adjudicateRouteCounterfactualSmokeOutcome({
  reviews: [
    ...common,
    row(10, ["route", "tree", ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(20, ["tree", ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(30, [ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(40, []),
  ],
  qualification: { qualified: true },
  fixed40: true,
})
assert.equal(fixed40Pass.lifecycleTarget, "controlled_smoke_completed")
assert.equal(
  fixed40Pass.nextLegalAction,
  "compile_route_counterfactual_compositor_formal_stage0",
)

const fixed40Fail = adjudicateRouteCounterfactualSmokeOutcome({
  reviews: [
    ...common,
    row(10, ["route", "tree", ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(20, ["tree", ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(30, [ROCK_REFERENCE_SEMANTIC_FAILURE]),
    row(40, [ROCK_REFERENCE_SEMANTIC_FAILURE]),
  ],
  qualification: { qualified: false },
  fixed40: true,
})
assert.equal(fixed40Fail.lifecycleTarget, "rejected")
assert.equal(
  fixed40Fail.nextLegalAction,
  "retire_fixed40_successor_and_escalate_generation_paradigm",
)

process.stdout.write(`${JSON.stringify({
  status: "stage4_route_counterfactual_fixed40_outcome_cpu_regression_passed",
  positiveChecks: 2,
  negativeChecks: 3,
  bounded30EpochRoutePreservedWithoutRejection: true,
  fixed40PassMapsToFormalStage0: true,
  fixed40FailureMapsToGenerationParadigm: true,
  ownerAuthorizationRequired: false,
}, null, 2)}\n`)
