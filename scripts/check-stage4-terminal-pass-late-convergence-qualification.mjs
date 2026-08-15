import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { adjudicateLateConvergence, validateBoundTimelineEvidence } from "./lib/ai-painter-stage4-late-convergence-qualification.mjs"

const root = process.cwd()
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}
const runRoot = path.resolve(root, argument(
  "--smoke-root",
  ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260813-073000000",
))
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const input = {
  terminal: read(path.join(runRoot, "finalization", "phase-terminal.json")),
  finalization: read(path.join(runRoot, "finalization", "finalization-report.json")),
  manifest: read(path.join(runRoot, "training-output", "manifest.json")),
  review: read(path.join(runRoot, "training-output", "fixed-preview-reviews.json")),
}
const positive = {}
const negative = {}
const passes = (fn) => { try { fn(); return true } catch { return false } }
const rejects = (mutate) => {
  const value = structuredClone(input)
  mutate(value)
  return !passes(() => adjudicateLateConvergence(value))
    || adjudicateLateConvergence(value).qualified === false
}

positive.bound_contract_valid = passes(() => validateBoundTimelineEvidence(input))
const decision = adjudicateLateConvergence(input)
positive.exact_late_sequence = decision.exactSequence
positive.strict_failure_count_convergence = decision.strictlyConverging
positive.no_late_regression = decision.noRegression
positive.epoch30_all_conditions_pass = decision.finalConditionsPass
positive.preview_bytes_reproduced = decision.fixedPreviewReproduced
positive.model_state_reproduced = decision.modelStateIdentityReproduced
positive.weights_changed = decision.weightsChanged
positive.thresholds_unchanged = decision.machineReviewThresholdsChanged === false
positive.terminal_qualified = decision.qualified

negative.missing_epoch_rejected = rejects((v) => v.review.reviews = v.review.reviews.filter((r) => r.epoch !== 20))
negative.duplicate_epoch_rejected = rejects((v) => v.review.reviews[3].epoch = 10)
negative.reordered_epoch_rejected = rejects((v) => [v.review.reviews[2], v.review.reviews[3]] = [v.review.reviews[3], v.review.reviews[2]])
negative.late_regression_rejected = rejects((v) => v.review.reviews[3].issueCodes.push("condition_object_vegetation_reference_semantic_mismatch"))
negative.epoch30_failure_rejected = rejects((v) => { v.review.reviews[4].passed = false; v.review.reviews[4].issueCodes = ["condition_object_rock_reference_semantic_mismatch"] })
negative.preview_reproduction_mismatch_rejected = rejects((v) => v.manifest.stage4UnifiedTrainingPreviewSampling.previewSha256Matches = false)
negative.state_reproduction_mismatch_rejected = rejects((v) => v.manifest.stage4UnifiedTrainingPreviewSampling.denoiserStateIdentityMatches = false)
negative.unchanged_weights_rejected = rejects((v) => v.manifest.modelStateHashEvidence.weightsChanged = false)
negative.threshold_change_rejected = rejects((v) => v.review.reviewThresholdsChanged = true)
negative.source_status_change_rejected = rejects((v) => v.terminal.status = "passed")
negative.all_five_pass_rewrite_rejected = rejects((v) => { v.review.previewPassCount = 5; v.review.previewFailCount = 0 })
negative.new_late_issue_rejected = rejects((v) => v.review.reviews[3].issueCodes.push("condition_object_vegetation_reference_semantic_mismatch"))
negative.duplicate_late_issue_rejected = rejects((v) => v.review.reviews[2].issueCodes.push(v.review.reviews[2].issueCodes[0]))

assert.ok(Object.values(positive).every(Boolean), `failedPositiveKeys=${Object.entries(positive).filter(([, value]) => !value).map(([key]) => key).join(",")}`)
assert.ok(Object.values(negative).every(Boolean), `failedNegativeKeys=${Object.entries(negative).filter(([, value]) => !value).map(([key]) => key).join(",")}`)
console.log(JSON.stringify({
  schemaVersion: "ai-painter-stage4-terminal-pass-late-convergence-cpu-report-v1",
  status: "stage4_terminal_pass_late_convergence_cpu_contract_passed",
  positive,
  negative,
  positivePassed: Object.values(positive).filter(Boolean).length,
  positiveTotal: Object.keys(positive).length,
  negativePassed: Object.values(negative).filter(Boolean).length,
  negativeTotal: Object.keys(negative).length,
  decision,
  executionBoundary: {
    checkpointWeightsRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    gpuStarted: false,
    trainingStarted: false,
    sourceEvidenceModified: false,
  },
}, null, 2))
