import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-v8-stage4-smoke-readonly-failure-attribution-20260809"
const SCOPE = "one_cpu_readonly_v8_smoke_diagnostic_export_and_visual_failure_attribution_only"
const EXPECTED_EPOCHS = [1, 5, 10, 20, 30]

function main(argv = process.argv.slice(2)) {
  const authorizationPath = argument(argv, "--authorization")
  if (!authorizationPath) throw new Error("v8_failure_attribution_authorization_required")
  const authorization = validateAuthorization(authorizationPath)
  const output = authorization.outputPaths
  if (fs.existsSync(resolve(output.runRoot))) throw new Error("v8_failure_attribution_run_root_already_exists")
  fs.mkdirSync(resolve(output.runRoot), { recursive: true })

  const terminal = readJsonRequired(authorization.bindings.smokeFailureTerminal.path)
  const finalization = readJsonRequired(authorization.bindings.smokeFinalization.path)
  const manifest = readJsonRequired(authorization.bindings.smokeManifest.path)
  const review = readJsonRequired(authorization.bindings.machineReview.path)
  validateSourceEvidence(authorization, terminal, finalization, manifest, review)

  const diagnosticAttribution = attributeDiagnosticContract(finalization, manifest)
  const visualAttribution = attributeVisualFailure(review, finalization)
  const analysis = {
    schemaVersion: "local-ai-v8-stage4-smoke-readonly-failure-attribution-v1",
    status: "v8_smoke_diagnostic_contract_and_visual_failure_attributed_read_only",
    recordedAtUtc: new Date().toISOString(),
    authorization: binding(authorizationPath),
    consumption: binding(authorization.consumptionPath),
    sourceEvidence: {
      terminal: binding(authorization.bindings.smokeFailureTerminal.path),
      finalization: binding(authorization.bindings.smokeFinalization.path),
      manifest: binding(authorization.bindings.smokeManifest.path),
      machineReview: binding(authorization.bindings.machineReview.path),
      trainer: binding(authorization.bindings.trainerFrozen.path),
      smokeRunner: binding(authorization.bindings.smokeRunnerFrozen.path),
      checkpointIdentity: {
        path: authorization.checkpointIdentityRecordedOnly.path,
        sha256: authorization.checkpointIdentityRecordedOnly.sha256,
        verifiedFromManifestAndFinalizationOnly: true,
        checkpointFileRead: false,
      },
    },
    diagnosticAttribution,
    visualAttribution,
    combinedFinding: {
      diagnosticContractDefectIndependentOfVisualResult: true,
      diagnosticRegistrationFixCannotConvertVisualFailureToPass: true,
      currentV8CandidateQualifiedForStage4FullTraining: false,
      currentV8CheckpointEligibleForPromotion: false,
      parameterRetryPermitted: false,
    },
    executionBoundary: readonlyBoundary(),
  }
  writeImmutableJson(output.analysisReport, analysis)

  const decision = {
    schemaVersion: "local-ai-v8-stage4-architecture-exit-or-followup-decision-v1",
    status: "current_v8_candidate_revision_exited_followup_architecture_design_required",
    recordedAtUtc: new Date().toISOString(),
    decision: "exit_current_v8_candidate_revision_and_require_v9_object_semantic_decoder_alignment_design",
    reasons: [
      "The current V8 Smoke completed real optimization but passed zero of five fixed visual reviews.",
      "Footprints, rock, and vegetation semantic mismatches remained at Epoch 30; this is a candidate-effect failure independent of diagnostic export.",
      "The runner expected seventeen stage4Diagnostic metrics while the five finalization epochs exported zero of those fields; this is a separate evidence registration/export defect.",
      "Repairing diagnostic registration alone cannot qualify the failed V8 checkpoint or authorize Stage4 full training.",
    ],
    closedCandidate: {
      candidateId: authorization.taskIdentity.candidateId,
      architectureId: authorization.taskIdentity.architectureId,
      checkpointPath: authorization.checkpointIdentityRecordedOnly.path,
      checkpointSha256: authorization.checkpointIdentityRecordedOnly.sha256,
      checkpointPromotionAuthorized: false,
      automaticRetryAuthorized: false,
    },
    requiredBeforeAnyFutureGpu: [
      {
        id: "stage4_diagnostic_manifest_registration_contract_v1",
        type: "evidence_contract_implementation",
        requirement: "Register and export the existing seventeen stage4Diagnostic fields into each fixed-preview epoch metric record, with CPU positive and negative contract regression.",
        effectOnCurrentVisualResult: "none",
      },
      {
        id: "stage4_object_semantic_decoder_alignment_design_v1",
        type: "architecture_design_not_parameter_candidate",
        requirement: "Design a new bounded architecture revision that aligns footprints, tree, rock, and vegetation semantic projections with frozen Autoencoder decoded features while preserving the successful sample-bound west topology contract.",
        legalSupervisionSources: [
          "original_owner_approved_reference_rgb",
          "original_compiled_23_channel_condition_pack",
          "approved_world_facts_and_object_semantic_masks",
          "current_training_prediction_and_frozen_project_autoencoder_decode",
        ],
        forbiddenTargets: ["failed_preview_pixels", "machine_review_thresholds"],
      },
    ],
    activationGate: {
      implementationAuthorizedNow: false,
      configurationActiveNow: false,
      checkpointReadOrLoadNow: false,
      optimizerCreationNow: false,
      gpuUseNow: false,
      trainingNow: false,
      stage4FullTrainingNow: false,
      checkpointPromotionNow: false,
    },
    nextOwnerAction: "separately_authorize_cpu_only_v9_object_semantic_decoder_alignment_architecture_design_and_diagnostic_manifest_registration_contract",
  }
  writeImmutableJson(output.architectureDecision, decision)

  const phaseTerminal = {
    schemaVersion: "local-ai-v8-stage4-smoke-failure-attribution-terminal-v1",
    status: "v8_stage4_smoke_failure_attribution_completed_closed",
    recordedAtUtc: new Date().toISOString(),
    analysisReportPath: projectPath(output.analysisReport),
    analysisReportSha256: sha256File(output.analysisReport),
    architectureDecisionPath: projectPath(output.architectureDecision),
    architectureDecisionSha256: sha256File(output.architectureDecision),
    decision: decision.decision,
    blockers: [],
    checkpointFileRead: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    gpuUsed: false,
    trainingStarted: false,
    automaticRetryStarted: false,
    stage4FullTrainingStarted: false,
  }
  writeImmutableJson(output.terminal, phaseTerminal)
  console.log(JSON.stringify({
    ...phaseTerminal,
    terminalPath: projectPath(output.terminal),
    terminalSha256: sha256File(output.terminal),
  }, null, 2))
  return 0
}

function validateAuthorization(authorizationPath) {
  const authorization = readJsonRequired(authorizationPath)
  if (authorization.requestId !== REQUEST_ID || authorization.status !== "resolved_owner_authorized") {
    throw new Error("v8_failure_attribution_authorization_identity_invalid")
  }
  if (authorization.ownerDecision?.commandRef !== REQUEST_ID || authorization.ownerDecision?.scope !== SCOPE) {
    throw new Error("v8_failure_attribution_command_scope_invalid")
  }
  const actions = authorization.authorizedActions ?? {}
  for (const key of ["localV8FailureAttributionEntryImplementation", "oneCpuReadonlyFailureAttribution", "analysisReportWrite", "architectureDecisionWrite", "terminalEvidenceWrite", "uniquePlanUpdate"]) {
    if (actions[key] !== true) throw new Error(`v8_failure_attribution_action_closed:${key}`)
  }
  for (const key of ["checkpointFileReadOrLoad", "trainerModification", "smokeRunnerModification", "reviewThresholdModification", "modelWeightModification", "optimizerCreation", "gpuUse", "training", "automaticRetry"]) {
    if (actions[key] !== false) throw new Error(`v8_failure_attribution_forbidden_action_open:${key}`)
  }
  for (const [key, value] of Object.entries(authorization.bindings ?? {})) {
    if (!value?.path || !value?.sha256 || !fileHashMatches(value.path, value.sha256)) {
      throw new Error(`v8_failure_attribution_binding_changed:${key}`)
    }
  }
  if (authorization.checkpointIdentityRecordedOnly?.fileReadAuthorized !== false) {
    throw new Error("v8_failure_attribution_checkpoint_read_boundary_invalid")
  }
  const consumption = readJsonRequired(authorization.consumptionPath)
  if (consumption.status !== "cpu_readonly_analysis_authorization_atomically_consumed") {
    throw new Error("v8_failure_attribution_authorization_not_consumed")
  }
  if (consumption.authorizationSha256 !== sha256File(authorizationPath)) {
    throw new Error("v8_failure_attribution_consumption_hash_changed")
  }
  return authorization
}

function validateSourceEvidence(authorization, terminal, finalization, manifest, review) {
  assert(terminal.status === "v8_stage4_single_sample_30_epoch_gpu_smoke_failed_closed", "v8_failure_terminal_status_invalid")
  assert(finalization.status === terminal.status, "v8_failure_finalization_status_invalid")
  assert(manifest.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "v8_failure_manifest_status_invalid")
  assert(review.status === "machine_reviews_failed_closed", "v8_failure_review_status_invalid")
  assert(sameJson(review.requiredPreviewEpochs, EXPECTED_EPOCHS), "v8_failure_preview_epoch_identity_invalid")
  assert(review.reviewThresholdsChanged === false, "v8_failure_review_thresholds_changed")
  assert(review.previewCount === 5 && review.previewPassCount === 0 && review.previewFailCount === 5, "v8_failure_review_count_invalid")
  assert(manifest.singleSampleOverfitSmoke?.sampleId === authorization.taskIdentity.sampleId, "v8_failure_sample_identity_invalid")
  assert(manifest.singleSampleOverfitSmoke?.selectedSplit === "validation", "v8_failure_sample_split_invalid")
  const checkpoint = authorization.checkpointIdentityRecordedOnly
  assert(manifest.checkpointPath === checkpoint.path && manifest.checkpointSha256 === checkpoint.sha256, "v8_failure_manifest_checkpoint_identity_invalid")
  assert(finalization.checkpointPath === checkpoint.path && finalization.checkpointSha256 === checkpoint.sha256, "v8_failure_finalization_checkpoint_identity_invalid")
  assert(manifest.modelStateHashEvidence?.weightsChanged === true, "v8_failure_source_weights_not_changed")
}

function attributeDiagnosticContract(finalization, manifest) {
  const diagnostics = finalization.diagnostics ?? {}
  const expectedNames = diagnostics.metricNames ?? []
  const epochs = diagnostics.epochs ?? []
  const epochMetricCounts = epochs.map((row) => ({ epoch: row.epoch, exportedMetricCount: Object.keys(row.metrics ?? {}).length, sharedReadoutBce: row.sharedReadoutBce }))
  const manifestEpochRows = (manifest.metrics ?? []).filter((row) => EXPECTED_EPOCHS.includes(row.epoch))
  const actualStage4Keys = [...new Set(manifestEpochRows.flatMap((row) => Object.keys(row).filter((key) => /stage4/i.test(key))))].sort()
  return {
    classification: "diagnostic_metric_registration_or_export_contract_defect",
    expectedMetricCount: 17,
    declaredMetricNameCount: expectedNames.length,
    collectedMetricCount: diagnostics.metricCount,
    allMetricsPresent: diagnostics.allMetricsPresent,
    epochMetricCounts,
    expectedMetricNames: expectedNames,
    manifestStage4MetricKeys: actualStage4Keys,
    sharedReadoutBceTimeline: epochMetricCounts.map((row) => ({ epoch: row.epoch, value: row.sharedReadoutBce })),
    finding: "The training Manifest contains Stage4 training and shared-readout measurements, but none are registered under the seventeen stage4Diagnostic names collected by the Smoke runner.",
    computationAbsenceProven: false,
    registrationOrExportAbsenceProven: diagnostics.metricCount === 0 && epochs.length === 5 && epochMetricCounts.every((row) => row.exportedMetricCount === 0),
    candidateQualificationEffect: "independent_blocker_only; fixing it cannot change the existing visual review outcome",
  }
}

function attributeVisualFailure(review, finalization) {
  const timeline = review.reviews.map((row) => ({ epoch: row.epoch, passed: row.passed, issueCodes: row.issueCodes }))
  const final = timeline.find((row) => row.epoch === 30)
  const counts = {}
  for (const row of timeline) for (const code of row.issueCodes) counts[code] = (counts[code] ?? 0) + 1
  const objectCodes = Object.entries(counts).filter(([code]) => code.includes("condition_object_"))
  const routeCodes = Object.entries(counts).filter(([code]) => /path|route|boundary/i.test(code))
  return {
    classification: "current_v8_candidate_visual_effect_failure",
    previewCount: review.previewCount,
    previewPassCount: review.previewPassCount,
    previewFailCount: review.previewFailCount,
    timeline,
    issueOccurrenceCounts: counts,
    objectSemanticIssueOccurrences: Object.fromEntries(objectCodes),
    routeOrBoundaryIssueOccurrences: Object.fromEntries(routeCodes),
    epoch30PersistentIssues: final?.issueCodes ?? [],
    sharedReadoutBceImproved: (finalization.diagnostics?.epochs?.[0]?.sharedReadoutBce ?? 0) > (finalization.diagnostics?.epochs?.at(-1)?.sharedReadoutBce ?? 0),
    finding: "Optimization reduced the shared-readout BCE and removed water and tree review codes by Epoch 30, but footprints, rock, and vegetation semantic mismatches remained; zero fixed previews passed.",
    reviewThresholdsChanged: review.reviewThresholdsChanged,
    visualFailureCanBeReclassifiedByDiagnosticExportFix: false,
  }
}

function readonlyBoundary() {
  return {
    checkpointFileRead: false,
    checkpointLoaded: false,
    trainerModified: false,
    smokeRunnerModified: false,
    reviewThresholdsModified: false,
    optimizerCreated: false,
    modelWeightsModified: false,
    gpuUsed: false,
    trainingStarted: false,
    automaticRetryStarted: false,
  }
}

function argument(argv, name) { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : null }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, resolve(value)).replaceAll("\\", "/") }
function readJsonRequired(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { return fs.existsSync(resolve(value)) && sha256File(value) === expected }
function binding(value) { return { path: projectPath(value), sha256: sha256File(value) } }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function assert(condition, message) { if (!condition) throw new Error(message) }
function writeImmutableJson(value, body) {
  const absolute = resolve(value)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  const handle = fs.openSync(absolute, "wx")
  try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) }
}

try { process.exitCode = main() } catch (error) { console.error(error?.stack ?? String(error)); process.exitCode = 1 }
