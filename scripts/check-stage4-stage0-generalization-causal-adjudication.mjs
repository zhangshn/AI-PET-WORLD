import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  adjudicateStage0GeneralizationFailure,
  adjudicateStage0RealFailure,
  validateBoundGeneralizationEvidence,
} from "./lib/ai-painter-stage4-stage0-generalization-causal-adjudication.mjs"

const root = process.cwd()
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const argumentValue = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(root, value)
  assert.ok(resolved.startsWith(`${root}${path.sep}`), `path_outside_project:${value}`)
  return resolved
}
const shaFile = (value) => {
  const hash = crypto.createHash("sha256")
  const descriptor = fs.openSync(value, "r")
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    let count
    while ((count = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, count))
    }
  } finally {
    fs.closeSync(descriptor)
  }
  return hash.digest("hex")
}

if (process.argv.includes("--real-failure-contract")) {
  runRealFailureContract()
  process.exit(0)
}

function runRealFailureContract() {
  const authorizationArg = argumentValue("--authorization")
  const authorizationSha256 = argumentValue("--authorization-sha256")
  assert.ok(authorizationArg && authorizationSha256, "real_failure_authorization_arguments_required")
  const authorizationPath = projectFile(authorizationArg)
  assert.equal(shaFile(authorizationPath), authorizationSha256, "real_failure_authorization_sha256_mismatch")
  const authorization = read(authorizationPath)
  assert.match(authorization.runId, /^\d{8}-\d{9}-stage0$/, "real_failure_authorization_run_id_invalid")
  assert.equal(authorization.sourceEvidence?.failedCheckpointIdentityOnly?.weightsReadAuthorized, false)
  const expectedRunRoot = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${authorization.runId}/`
  for (const name of ["stage0Terminal", "stage0Manifest", "stage0MachineReview", "failedCheckpointIdentityOnly"]) {
    assert.equal(
      authorization.sourceEvidence?.[name]?.path?.replaceAll("\\", "/").startsWith(expectedRunRoot),
      true,
      `${name}_run_path_mismatch`,
    )
  }
  for (const [name, binding] of Object.entries(authorization.sourceEvidence)) {
    const sourcePath = projectFile(binding.path)
    assert.equal(fs.existsSync(sourcePath), true, `${name}_missing`)
    assert.equal(shaFile(sourcePath), binding.sha256, `${name}_sha256_mismatch`)
  }
  const stage0Terminal = read(projectFile(authorization.sourceEvidence.stage0Terminal.path))
  const stage0Manifest = read(projectFile(authorization.sourceEvidence.stage0Manifest.path))
  const stage0Review = read(projectFile(authorization.sourceEvidence.stage0MachineReview.path))
  const previewBindings = stage0Review.reviews.map((row) => {
    const preview = projectFile(row.previewPath)
    const normalized = projectFile(row.normalizedPath)
    const reproduction = projectFile(row.previewPath.replace("fixed-epoch-previews", "fixed-epoch-preview-reproductions"))
    const previewSha256 = shaFile(preview)
    return {
      epoch: row.epoch,
      previewManifestMatch: previewSha256 === row.previewSha256,
      normalizedManifestMatch: shaFile(normalized) === row.normalizedSha256,
      reproductionByteMatch: previewSha256 === shaFile(reproduction),
    }
  })
  const input = {
    expectedRunId: authorization.runId,
    sourceEvidence: authorization.sourceEvidence,
    stage0Terminal,
    stage0Manifest,
    stage0Review,
    previewBindings,
  }
  const decision = adjudicateStage0RealFailure(input)
  const classify = (mutate) => {
    const value = structuredClone(input)
    mutate(value)
    return adjudicateStage0RealFailure(value).classification
  }
  const implementationSources = [
    path.join(root, "scripts", "lib", "ai-painter-stage4-stage0-generalization-causal-adjudication.mjs"),
    path.join(root, "scripts", "run-stage4-semantic-mixture-real-failure-adjudication.mjs"),
  ].filter((file) => fs.existsSync(file)).map((file) => fs.readFileSync(file, "utf8")).join("\n")
  const positive = {
    current_run_identity_bound: input.expectedRunId === authorization.runId
      && stage0Terminal.runId === authorization.runId
      && stage0Review.runId === authorization.runId,
    current_run_paths_bound: Object.values(authorization.sourceEvidence).every((binding) => (
      binding.path.replaceAll("\\", "/").startsWith(expectedRunRoot)
    )),
    source_hashes_bound: Object.entries(authorization.sourceEvidence).every(([, binding]) => (
      shaFile(projectFile(binding.path)) === binding.sha256
    )),
    six_preview_byte_bindings_pass: previewBindings.length === 6
      && previewBindings.every((row) => row.previewManifestMatch
        && row.normalizedManifestMatch
        && row.reproductionByteMatch),
    evidence_binding_contract_passes: Object.values(decision.bindingChecks).every(Boolean),
    audit_contract_passes: Object.values(decision.auditContractChecks).every(Boolean),
    model_failure_contract_passes: Object.values(decision.modelFailureChecks).every(Boolean),
    real_model_visual_failure_selected: decision.classification === "real_model_visual_failure",
    progress_remains_sixty_percent: decision.fixedTotalProgress.percent === 60,
    stage1_and_stage2_forbidden: decision.stage1EntryPermitted === false
      && decision.stage2EntryPermitted === false,
    checkpoint_identity_only: authorization.sourceEvidence.failedCheckpointIdentityOnly.weightsReadAuthorized === false,
  }
  const negative = {
    terminal_run_mismatch_classified_as_binding_error: classify((value) => {
      value.stage0Terminal.runId = "other-run"
    }) === "evidence_binding_error",
    terminal_manifest_hash_mismatch_classified_as_binding_error: classify((value) => {
      value.stage0Terminal.manifest.sha256 = "0".repeat(64)
    }) === "evidence_binding_error",
    preview_reproduction_mismatch_classified_as_binding_error: classify((value) => {
      value.previewBindings[5].reproductionByteMatch = false
    }) === "evidence_binding_error",
    changed_review_threshold_classified_as_audit_error: classify((value) => {
      value.stage0Review.reviewThresholdsChanged = true
    }) === "audit_program_or_contract_error",
    missing_audit_schema_classified_as_audit_error: classify((value) => {
      value.stage0Review.reviews[0].conditionAlignment.schemaVersion = "wrong"
    }) === "audit_program_or_contract_error",
    changed_object_threshold_classified_as_audit_error: classify((value) => {
      value.stage0Review.reviews[0].conditionAlignment.objectSemanticAudits[0].priorAcceptanceThresholdChanged = true
    }) === "audit_program_or_contract_error",
    unchanged_weights_block_model_failure: classify((value) => {
      value.stage0Manifest.modelStateHashEvidence.weightsChanged = false
    }) === "insufficient_evidence_for_failure_classification",
    missing_epoch_40_blocks_model_failure: classify((value) => {
      value.stage0Manifest.metrics = value.stage0Manifest.metrics.filter((row) => row.epoch !== 40)
    }) === "insufficient_evidence_for_failure_classification",
    terminal_object_semantic_pass_blocks_model_failure: classify((value) => {
      const object = value.stage0Review.reviews.at(-1).conditionAlignment.objectSemanticAudits
        .find((row) => row.channelId === "object_tree")
      object.passed = true
    }) === "insufficient_evidence_for_failure_classification",
    checkpoint_load_action_absent: !/\b(?:torch\.)?load\s*\(/.test(implementationSources),
    optimizer_action_absent: !/\b(?:create_optimizer|AdamW?|SGD)\s*\(/.test(implementationSources),
    gpu_action_absent: !/\b(?:torch\.)?cuda(?:\.|\s*\()/.test(implementationSources),
    training_action_absent: !/\.backward\s*\(/.test(implementationSources),
  }
  assert.ok(Object.values(positive).every(Boolean), `failedPositiveKeys=${Object.entries(positive).filter(([, value]) => !value).map(([key]) => key).join(",")}`)
  assert.ok(Object.values(negative).every(Boolean), `failedNegativeKeys=${Object.entries(negative).filter(([, value]) => !value).map(([key]) => key).join(",")}`)
  console.log(JSON.stringify({
    schemaVersion: "ai-painter-stage4-semantic-mixture-real-failure-adjudicator-cpu-report-v1",
    status: "stage4_semantic_mixture_real_failure_adjudicator_cpu_contract_passed",
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
      formalAdjudicationExecuted: false,
    },
  }, null, 2))
}

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
