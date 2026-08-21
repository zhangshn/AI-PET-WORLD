import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { adjudicateLateConvergence, resolveLateQualificationIdentity, validateBoundTimelineEvidence } from "./lib/ai-painter-stage4-late-convergence-qualification.mjs"

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
const identityInput = structuredClone(input)
const terminalRow = identityInput.manifest.metrics.find((row) => row.epoch === 30)
const terminalReproduction = terminalRow?.validationPreviewReproductionArtifact
assert.ok(terminalReproduction?.sourcePreview && terminalReproduction?.repeatedPreview)
identityInput.manifest.stage4UnifiedTrainingPreviewSampling.bestEpoch = 5
identityInput.manifest.stage4TerminalQualificationIdentity = {
  schemaVersion: "stage4-best-checkpoint-terminal-qualification-identity-separation-evidence-v1",
  status: "terminal_epoch_30_identity_saved_and_preview_reproduced_exactly",
  contractId: "stage4_best_checkpoint_and_terminal_qualification_identity_separation_v1",
  terminalEpoch: 30,
  terminalDenoiserStateSha256: terminalReproduction.sourcePreview.denoiserStateSha256,
  terminalStateArtifactPath: ".runtime/ai-painter/cpu-fixtures/terminal-qualification-identity.pt",
  terminalStateArtifactSha256: "a".repeat(64),
  terminalStateArtifactRole: "non_promotable_late_stability_qualification_evidence_only",
  terminalCheckpointPromotable: false,
  stage0InitializationEligible: false,
  sourcePreview: terminalReproduction.sourcePreview,
  reproducedPreview: terminalReproduction.repeatedPreview,
  denoiserStateIdentityMatches: true,
  previewSha256Matches: true,
  bestCheckpointEpoch: 5,
  bestCheckpointDenoiserStateSha256: identityInput.manifest.stage4UnifiedTrainingPreviewSampling.selectedCheckpointDenoiserStateSha256,
  bestCheckpointSelectionContractUnchanged: true,
  identityRolesSeparated: true,
  crossIdentitySubstitutionAllowed: false,
  mainCheckpointFormatChanged: false,
  machineReviewThresholdsChanged: false,
}
const rejectsIdentity = (mutate) => {
  const value = structuredClone(identityInput)
  mutate(value)
  return !passes(() => resolveLateQualificationIdentity(value.manifest))
}

positive.bound_contract_valid = passes(() => validateBoundTimelineEvidence(input))
const decision = adjudicateLateConvergence(input)
const sustainedZeroInput = structuredClone(input)
const sustainedZeroEpoch10 = sustainedZeroInput.review.reviews.find((row) => row.epoch === 10)
sustainedZeroEpoch10.passed = true
sustainedZeroEpoch10.issueCodes = []
sustainedZeroInput.review.previewPassCount = 3
sustainedZeroInput.review.previewFailCount = 2
const sustainedZeroDecision = adjudicateLateConvergence(sustainedZeroInput)
const legacyStrictDecreaseInput = structuredClone(input)
const legacyEpoch10 = legacyStrictDecreaseInput.review.reviews.find((row) => row.epoch === 10)
legacyEpoch10.passed = false
legacyEpoch10.issueCodes = ["condition_object_vegetation_reference_semantic_mismatch"]
legacyStrictDecreaseInput.review.previewPassCount = 2
legacyStrictDecreaseInput.review.previewFailCount = 3
const legacyStrictDecreaseDecision = adjudicateLateConvergence(legacyStrictDecreaseInput)
positive.exact_late_sequence = decision.exactSequence
positive.supported_late_convergence_route = decision.qualified
  && decision.strictDecreaseThenStableZero
  && !decision.sustainedZeroFromFirstLateEpoch
  && decision.qualificationRoute === "strict_decrease_then_stable_zero"
positive.sustained_zero_from_first_late_epoch = sustainedZeroDecision.qualified
  && !sustainedZeroDecision.strictDecreaseThenStableZero
  && sustainedZeroDecision.sustainedZeroFromFirstLateEpoch
  && sustainedZeroDecision.qualificationRoute === "sustained_zero_from_first_late_epoch"
positive.non_increasing_failure_count = decision.nonIncreasing
positive.stable_zero_after_first_terminal_pass = decision.stableAfterZero
positive.dynamic_preview_counts_match_reviews = input.review.previewPassCount === input.review.reviews.filter((row) => row.passed === true).length
  && input.review.previewFailCount === input.review.reviews.filter((row) => row.passed !== true).length
positive.no_late_regression = decision.noRegression
positive.epoch30_all_conditions_pass = decision.finalConditionsPass
positive.preview_bytes_reproduced = decision.fixedPreviewReproduced
positive.model_state_reproduced = decision.modelStateIdentityReproduced
positive.weights_changed = decision.weightsChanged
positive.thresholds_unchanged = decision.machineReviewThresholdsChanged === false
positive.terminal_qualified = decision.qualified
positive.legacy_strict_decrease_then_stable_zero_supported = legacyStrictDecreaseDecision.qualified
  && legacyStrictDecreaseDecision.strictDecreaseThenStableZero
  && legacyStrictDecreaseDecision.qualificationRoute === "strict_decrease_then_stable_zero"
positive.independent_terminal_identity_accepts_nonterminal_best = passes(() => validateBoundTimelineEvidence(identityInput))
positive.independent_terminal_identity_selected_for_qualification = resolveLateQualificationIdentity(identityInput.manifest).source === "independent_terminal_qualification_identity"

negative.missing_epoch_rejected = rejects((v) => v.review.reviews = v.review.reviews.filter((r) => r.epoch !== 20))
negative.duplicate_epoch_rejected = rejects((v) => v.review.reviews[3].epoch = 10)
negative.reordered_epoch_rejected = rejects((v) => [v.review.reviews[2], v.review.reviews[3]] = [v.review.reviews[3], v.review.reviews[2]])
negative.late_regression_rejected = rejects((v) => v.review.reviews[3].issueCodes.push(
  "condition_object_rock_reference_semantic_mismatch",
  "condition_object_vegetation_reference_semantic_mismatch",
))
negative.epoch30_failure_rejected = rejects((v) => { v.review.reviews[4].passed = false; v.review.reviews[4].issueCodes = ["condition_object_rock_reference_semantic_mismatch"] })
negative.preview_reproduction_mismatch_rejected = rejects((v) => v.manifest.stage4UnifiedTrainingPreviewSampling.previewSha256Matches = false)
negative.state_reproduction_mismatch_rejected = rejects((v) => v.manifest.stage4UnifiedTrainingPreviewSampling.denoiserStateIdentityMatches = false)
negative.unchanged_weights_rejected = rejects((v) => v.manifest.modelStateHashEvidence.weightsChanged = false)
negative.threshold_change_rejected = rejects((v) => v.review.reviewThresholdsChanged = true)
negative.source_status_change_rejected = rejects((v) => v.terminal.status = "passed")
negative.all_five_pass_rewrite_rejected = rejects((v) => { v.review.previewPassCount = 5; v.review.previewFailCount = 0 })
negative.inconsistent_dynamic_pass_count_rejected = rejects((v) => v.review.previewPassCount += 1)
negative.inconsistent_dynamic_fail_count_rejected = rejects((v) => v.review.previewFailCount -= 1)
negative.flat_nonzero_late_trajectory_rejected = rejects((v) => {
  for (const row of v.review.reviews.filter((item) => [10, 20, 30].includes(item.epoch))) {
    row.passed = false
    row.issueCodes = ["condition_object_vegetation_reference_semantic_mismatch"]
  }
  v.review.previewPassCount = 0
  v.review.previewFailCount = 5
})
negative.sustained_zero_route_requires_all_three_zero = rejects((v) => {
  const row = v.review.reviews.find((item) => item.epoch === 10)
  row.passed = false
  row.issueCodes = ["condition_object_vegetation_reference_semantic_mismatch"]
  v.review.previewPassCount = 2
  v.review.previewFailCount = 3
  const terminalRow = v.review.reviews.find((item) => item.epoch === 30)
  terminalRow.passed = false
  terminalRow.issueCodes = ["condition_object_vegetation_reference_semantic_mismatch"]
  v.review.previewPassCount = 1
  v.review.previewFailCount = 4
})
negative.zero_then_regression_rejected = rejects((v) => {
  v.review.reviews[4].passed = false
  v.review.reviews[4].issueCodes = ["condition_object_vegetation_reference_semantic_mismatch"]
  v.review.previewPassCount = 1
  v.review.previewFailCount = 4
})
negative.new_late_issue_rejected = rejects((v) => v.review.reviews[3].issueCodes.push("condition_object_rock_reference_semantic_mismatch"))
negative.duplicate_late_issue_rejected = rejects((v) => v.review.reviews[2].issueCodes.push(v.review.reviews[2].issueCodes[0]))
negative.terminal_identity_missing_rejected_when_best_is_not_terminal = rejectsIdentity((v) => delete v.manifest.stage4TerminalQualificationIdentity)
negative.terminal_epoch_changed_rejected = rejectsIdentity((v) => v.manifest.stage4TerminalQualificationIdentity.terminalEpoch = 20)
negative.terminal_state_substitution_rejected = rejectsIdentity((v) => v.manifest.stage4TerminalQualificationIdentity.reproducedPreview.denoiserStateSha256 = "b".repeat(64))
negative.terminal_preview_substitution_rejected = rejectsIdentity((v) => v.manifest.stage4TerminalQualificationIdentity.reproducedPreview.previewSha256 = "b".repeat(64))
negative.terminal_promotion_rejected = rejectsIdentity((v) => v.manifest.stage4TerminalQualificationIdentity.terminalCheckpointPromotable = true)
negative.stage0_terminal_identity_use_rejected = rejectsIdentity((v) => v.manifest.stage4TerminalQualificationIdentity.stage0InitializationEligible = true)
negative.cross_identity_substitution_rejected = rejectsIdentity((v) => v.manifest.stage4TerminalQualificationIdentity.crossIdentitySubstitutionAllowed = true)
negative.best_checkpoint_identity_substitution_rejected = rejectsIdentity((v) => v.manifest.stage4TerminalQualificationIdentity.bestCheckpointDenoiserStateSha256 = "b".repeat(64))
negative.identity_threshold_change_rejected = rejectsIdentity((v) => v.manifest.stage4TerminalQualificationIdentity.machineReviewThresholdsChanged = true)

assert.ok(Object.values(positive).every(Boolean), `failedPositiveKeys=${Object.entries(positive).filter(([, value]) => !value).map(([key]) => key).join(",")}`)
assert.ok(Object.values(negative).every(Boolean), `failedNegativeKeys=${Object.entries(negative).filter(([, value]) => !value).map(([key]) => key).join(",")}`)
const report = {
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
}
const serialized = `${JSON.stringify(report, null, 2)}\n`
const reportArgument = argument("--report", null)
if (reportArgument) {
  const reportPath = path.resolve(root, reportArgument)
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, serialized, { encoding: "utf8", flag: "wx" })
}
console.log(serialized.trimEnd())
