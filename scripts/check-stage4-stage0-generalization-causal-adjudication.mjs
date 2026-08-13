import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  adjudicateStage0GeneralizationFailure,
  validateBoundGeneralizationEvidence,
} from "./lib/ai-painter-stage4-stage0-generalization-causal-adjudication.mjs"

const root = process.cwd()
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const smokeRoot = path.join(root, ".runtime", "ai-painter", "stage4-fact-conditioned-semantic-mixture-smoke-executions", "20260813-041600000")
const stage0Root = path.join(root, ".runtime", "ai-painter", "stage4-semantic-mixture-formal-training", "20260813-050000000-stage0")
const qualificationRoot = path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260813-042808433")
const input = {
  smokeQualification: read(path.join(qualificationRoot, "phase-terminal.json")),
  smokeManifest: read(path.join(smokeRoot, "training-output", "manifest.json")),
  smokeReview: read(path.join(smokeRoot, "training-output", "fixed-preview-reviews.json")),
  stage0Terminal: read(path.join(stage0Root, "finalization", "phase-terminal.json")),
  stage0Manifest: read(path.join(stage0Root, "training-output", "manifest.json")),
  stage0Review: read(path.join(stage0Root, "training-output", "fixed-preview-reviews.json")),
  directGradientConflictEvidence: false,
  perSampleGradientEvidence: false,
}
const adjudicationSource = fs.readFileSync(
  path.join(root, "scripts", "lib", "ai-painter-stage4-stage0-generalization-causal-adjudication.mjs"),
  "utf8",
)
const passes = (fn) => { try { fn(); return true } catch { return false } }
const rejects = (mutate) => {
  const value = structuredClone(input)
  mutate(value)
  return !passes(() => validateBoundGeneralizationEvidence(value))
    || !passes(() => adjudicateStage0GeneralizationFailure(value))
}
const decision = adjudicateStage0GeneralizationFailure(input)
const positive = {
  bound_evidence_valid: passes(() => validateBoundGeneralizationEvidence(input)),
  single_sample_terminal_pass_read: decision.evidence.smokeTerminalPass,
  stage0_split_48_8_4_4_read: input.stage0Manifest.actualLoadedSplitCounts.train === 48
    && input.stage0Manifest.actualLoadedSplitCounts.validation === 8
    && input.stage0Manifest.actualLoadedSplitCounts.challenge === 4
    && input.stage0Manifest.actualLoadedSplitCounts.regression === 4,
  six_stage0_reviews_read: decision.stage0ReviewTimeline.length === 6,
  stage0_zero_of_six_read: decision.evidence.stage0ReviewedCheckpointPassCount === 0,
  five_train_obligations_improve: decision.evidence.allTrainClassLossesImprove,
  validation_object_semantic_improves: decision.evidence.validationObjectSemanticImproves,
  checkpoint_only_not_unique_root: decision.alternatives.B.status === "secondary_gap_not_unique_root_cause",
  gradient_interference_not_invented: decision.alternatives.A.status === "not_confirmed",
  objective_gap_selected: decision.selectedCause === "C",
  owner_choice_not_required: decision.alternatives.D.status === "not_selected",
}
const negative = {
  wrong_smoke_status_rejected: rejects((v) => v.smokeQualification.status = "failed"),
  smoke_terminal_failure_rejected: rejects((v) => { v.smokeReview.reviews[4].passed = false; v.smokeReview.reviews[4].issueCodes = ["x"] }),
  wrong_stage0_status_rejected: rejects((v) => v.stage0Terminal.status = "passed"),
  wrong_split_rejected: rejects((v) => v.stage0Manifest.actualLoadedSplitCounts.train = 47),
  missing_review_epoch_rejected: rejects((v) => v.stage0Review.reviews.splice(3, 1)),
  reordered_review_epoch_rejected: rejects((v) => [v.stage0Review.reviews[1], v.stage0Review.reviews[2]] = [v.stage0Review.reviews[2], v.stage0Review.reviews[1]]),
  threshold_change_rejected: rejects((v) => v.stage0Review.reviewThresholdsChanged = true),
  missing_metric_rejected: rejects((v) => v.stage0Manifest.metrics = v.stage0Manifest.metrics.filter((row) => row.epoch !== 20)),
  missing_class_metric_rejected: rejects((v) => delete v.stage0Manifest.metrics[0].trainStage4SemanticMixtureTreeFinalTypedRgbMae),
  preview_reproduction_mismatch_rejected: rejects((v) => v.stage0Manifest.stage4UnifiedTrainingPreviewSampling.previewSha256Matches = false),
  unchanged_weights_rejected: rejects((v) => v.stage0Manifest.modelStateHashEvidence.weightsChanged = false),
  invented_gradient_conflict_rejected: rejects((v) => v.directGradientConflictEvidence = true),
  checkpoint_read_action_absent: !/\b(?:torch\.)?load\s*\(/.test(adjudicationSource),
  optimizer_action_absent: !/\b(?:create_optimizer|AdamW?|SGD)\s*\(/.test(adjudicationSource),
  gpu_action_absent: !/\b(?:torch\.)?cuda(?:\.|\s*\()/.test(adjudicationSource),
  training_action_absent: !/\.backward\s*\(/.test(adjudicationSource),
}
assert.ok(Object.values(positive).every(Boolean), `failedPositiveKeys=${Object.entries(positive).filter(([, value]) => !value).map(([key]) => key).join(",")}`)
assert.ok(Object.values(negative).every(Boolean), `failedNegativeKeys=${Object.entries(negative).filter(([, value]) => !value).map(([key]) => key).join(",")}`)
console.log(JSON.stringify({
  schemaVersion: "ai-painter-stage4-stage0-generalization-causal-cpu-report-v1",
  status: "stage4_stage0_generalization_causal_cpu_contract_passed",
  positive,
  negative,
  positivePassed: Object.values(positive).filter(Boolean).length,
  positiveTotal: Object.keys(positive).length,
  negativePassed: Object.values(negative).filter(Boolean).length,
  negativeTotal: Object.keys(negative).length,
  decision,
  executionBoundary: {
    checkpointFileIdentityVerified: true,
    checkpointWeightsRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    gpuStarted: false,
    trainingStarted: false,
  },
}, null, 2))
