import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { analyzeFailureLearningLoop } from "./lib/ai-assisted-failure-learning-loop.mjs"
import {
  buildStage4ArchitectureOwnerActionRequestPreview,
  buildStage4InactiveArchitectureImplementationContract,
  classifyStage4FailureDecision,
  compileStage4ArchitectureDesignConvergence,
  runStage4ArchitectureDesignContractRegression,
  runStage4DecisionContractRegression,
  validateStage4ArchitectureDesignConvergence,
  validateStage4ArchitectureOwnerActionRequestPreview,
  validateStage4FailureDecision,
  validateStage4InactiveArchitectureImplementationContract,
} from "./lib/ai-assisted-v7-r5-stage4-failure-decision.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const ARCHITECTURE_DESIGN_CONVERGENCE_MODE = process.argv.includes("--architecture-design-convergence")
const ARCHITECTURE_DESIGN_CPU_PREFLIGHT_MODE = process.argv.includes("--architecture-design-convergence-cpu-preflight-only")
if (ARCHITECTURE_DESIGN_CONVERGENCE_MODE || ARCHITECTURE_DESIGN_CPU_PREFLIGHT_MODE) {
  try {
    const result = runStage4ArchitectureDesignConvergence({ preflightOnly: ARCHITECTURE_DESIGN_CPU_PREFLIGHT_MODE })
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  } catch (error) {
    console.error(JSON.stringify({
      schemaVersion: "local-ai-v7-r5-stage4-architecture-design-convergence-startup-failure-v1",
      status: "stage4_architecture_design_convergence_failed_stopped_no_retry",
      blocker: String(error?.message ?? error),
      checkpointRead: false,
      optimizerCreated: false,
      gpuUsed: false,
      trainingStarted: false,
      automaticRetryStarted: false,
    }, null, 2))
    process.exit(1)
  }
}
const ARCHITECTURE_UPGRADE_CPU_PREFLIGHT_MODE = process.argv.includes("--architecture-upgrade-cpu-preflight-only")
const ARCHITECTURE_UPGRADE_DECISION_MODE = ARCHITECTURE_UPGRADE_CPU_PREFLIGHT_MODE || process.argv.includes("--structured-stability-architecture-upgrade-decision")
const DECISION_ANALYSIS_MODE = ARCHITECTURE_UPGRADE_DECISION_MODE || process.argv.includes("--current-smoke-decision-analysis")
const CURRENT_SMOKE_TIMELINE_MODE = DECISION_ANALYSIS_MODE || process.argv.includes("--current-smoke-five-preview")
const AUTHORIZATION_ARGUMENT_INDEX = process.argv.indexOf("--authorization")
const CURRENT_AUTHORIZATION_PATH = AUTHORIZATION_ARGUMENT_INDEX >= 0 ? process.argv[AUTHORIZATION_ARGUMENT_INDEX + 1] : null
if (CURRENT_SMOKE_TIMELINE_MODE && !CURRENT_AUTHORIZATION_PATH) throw new Error("stage4_current_smoke_timeline_authorization_argument_required")
const LEGACY_REQUEST_ID = "owner-action-request-v7-r5-stage4-diagnostic-evidence-failure-analysis-20260805"
const LEGACY_AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${LEGACY_REQUEST_ID}/request.json`
const LEGACY_AUTHORIZATION_SHA256 = "f52c0c0aeaebffc11073a424f0eca6b796086fc02a007657cd1dc6e5e2ef0e06"
const LEGACY_CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${LEGACY_REQUEST_ID}/authorization-consumption.json`
const LEGACY_CONSUMPTION_SHA256 = "350414d0e73194ae207f52e959edb4de728c8f2f68644e762fe01073805f7da1"
const AUTHORIZATION_PATH = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_AUTHORIZATION_PATH : LEGACY_AUTHORIZATION_PATH
const AUTHORIZATION_SHA256 = CURRENT_SMOKE_TIMELINE_MODE ? sha256File(AUTHORIZATION_PATH) : LEGACY_AUTHORIZATION_SHA256
const authorization = readJson(AUTHORIZATION_PATH)
const CURRENT_IDENTITY = CURRENT_SMOKE_TIMELINE_MODE ? authorization.taskIdentity ?? {} : {}
const REQUEST_ID = CURRENT_SMOKE_TIMELINE_MODE ? authorization.requestId : LEGACY_REQUEST_ID
const CONSUMPTION_PATH = CURRENT_SMOKE_TIMELINE_MODE
  ? projectPath(path.join(path.dirname(resolve(AUTHORIZATION_PATH)), "analysis-implementation-consumption.json"))
  : LEGACY_CONSUMPTION_PATH
const CONSUMPTION_SHA256 = CURRENT_SMOKE_TIMELINE_MODE
  ? ARCHITECTURE_UPGRADE_CPU_PREFLIGHT_MODE ? null : sha256File(CONSUMPTION_PATH)
  : LEGACY_CONSUMPTION_SHA256
const COMMAND_REF = CURRENT_SMOKE_TIMELINE_MODE ? authorization.ownerDecision?.commandRef : "owner-authorized-v7-r5-stage4-diagnostic-evidence-failure-analysis-20260805"
const SCOPE = CURRENT_SMOKE_TIMELINE_MODE ? authorization.ownerDecision?.scope : "extend_stage4_local_failure_analyzer_for_bound_17_metric_diagnostic_cpu_regression_and_single_read_only_inactive_repair_proposal"
const SOURCE_RUN_ID = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceRunId : "ai-assisted-v7-r5-stage4-full-training-2026-08-05T10-21-08-137Z"
const SOURCE_STAGE_INDEX = 0
const SOURCE_ROOT = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceRoot : `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/${SOURCE_RUN_ID}-stage-0`
const REVIEW_PATH = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceReviewPath : `${SOURCE_ROOT}/fixed-preview-reviews.json`
const REVIEW_SHA256 = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceReviewSha256 : "6181e50f07392049286cf49bda68199a718e6c2b67790a6a781fc75569d8622b"
const MANIFEST_PATH = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceManifestPath : `${SOURCE_ROOT}/manifest.json`
const MANIFEST_SHA256 = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceManifestSha256 : "2dfcfd016734ef7d88e33d6f75b23b9d043df7d075b280827b304e1c89ede5ef"
const ACTIVE_CONFIG_PATH = `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/chains/${SOURCE_RUN_ID}/active-config.json`
const ACTIVE_CONFIG_SHA256 = "7a5f66356d8b57a5e927487f20c4807b005b99615f9fc0f76e84e593de3e1583"
const TERMINAL_PATH = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceFailureTerminalPath : `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/chains/${SOURCE_RUN_ID}/stage4-terminal.json`
const TERMINAL_SHA256 = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceFailureTerminalSha256 : "68ee2b06a01db53740303da9e61d21ae8f6c0f426478ef3c08554a410b3c702f"
const FINALIZATION_PATH = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceFinalizationPath : `.runtime/ai-painter/v7-r5-stage4-full-training-finalizations/${SOURCE_RUN_ID}-finalization/finalization-report.json`
const FINALIZATION_SHA256 = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceFinalizationSha256 : "f837c93694ca2064bfcbdb70fae9dba118a776ab50b40270d63677367c4d5611"
const STEP_TELEMETRY_PATH = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceStepTelemetryPath : null
const STEP_TELEMETRY_SHA256 = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.sourceStepTelemetrySha256 : null
const DIAGNOSTIC_ROOT = ".runtime/ai-painter/v7-r5-stage4-readonly-diagnostic-object-metric-prefix-final-gpu-smokes/ai-assisted-v7-r5-stage4-readonly-diagnostic-object-metric-prefix-final-gpu-smoke-2026-08-05T13-27-00-000Z"
const DIAGNOSTIC_REPORT_PATH = CURRENT_SMOKE_TIMELINE_MODE ? FINALIZATION_PATH : `${DIAGNOSTIC_ROOT}/diagnostic-report.json`
const DIAGNOSTIC_REPORT_SHA256 = CURRENT_SMOKE_TIMELINE_MODE ? FINALIZATION_SHA256 : "67a288142eca980200a60ab998359323dda3aa5dc4b5f5381b92eccecc56ffda"
const DIAGNOSTIC_TERMINAL_PATH = CURRENT_SMOKE_TIMELINE_MODE ? TERMINAL_PATH : `${DIAGNOSTIC_ROOT}/phase-terminal.json`
const DIAGNOSTIC_TERMINAL_SHA256 = CURRENT_SMOKE_TIMELINE_MODE ? TERMINAL_SHA256 : "6f4f6e83935295efbf46e018c4f407a75c5dad022bddd48116c3fc68ece5291e"
const PREVIOUS_ANALYSIS_TERMINAL_PATH = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.previousCompatibilityTerminalPath : ".runtime/ai-painter/local-ai-failure-learning-r5-stage4/local-ai-v7-r5-stage4-failure-learning-2026-08-05T10-52-29-779Z/phase-terminal.json"
const PREVIOUS_ANALYSIS_TERMINAL_SHA256 = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.previousCompatibilityTerminalSha256 : "1b7ad85c7828416e23c8b58bc16e511b6af523147973092747873ee80941a790"
const ANALYZER_PATH = "scripts/lib/ai-assisted-failure-learning-loop.mjs"
const ANALYZER_SHA256 = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.analyzerLibrarySha256 : "091826359a4cba3debb3d905fc9a3c0ba4828bda75b9b5111b9828fce8edbc9f"
const DECISION_HELPER_PATH = "scripts/lib/ai-assisted-v7-r5-stage4-failure-decision.mjs"
const BASELINE_POINTER_PATH = DECISION_ANALYSIS_MODE ? CURRENT_IDENTITY.previousSuccessfulAnalysisPointerPath : null
const BASELINE_POINTER_SHA256 = DECISION_ANALYSIS_MODE ? CURRENT_IDENTITY.previousSuccessfulAnalysisPointerSha256 : null
const EXPECTED_EPOCHS = CURRENT_SMOKE_TIMELINE_MODE ? [1, 5, 10, 20, 30] : [1, 5, 10, 20, 30, 40]
const KNOWN_STAGE4_ISSUES = new Set([
  "condition_terrain_path_ground_coverage_mismatch",
  "condition_terrain_path_ground_spatial_distribution_mismatch",
  "condition_terrain_path_ground_centroid_drift",
  "condition_terrain_path_ground_required_boundary_contact_missing",
  "condition_terrain_water_coverage_mismatch",
  "condition_terrain_water_spatial_distribution_mismatch",
  "condition_terrain_water_centroid_drift",
  "condition_object_footprints_reference_semantic_mismatch",
  "condition_object_tree_reference_semantic_mismatch",
  "condition_object_rock_reference_semantic_mismatch",
  "condition_object_vegetation_reference_semantic_mismatch",
])
const now = new Date().toISOString()
const runId = CURRENT_SMOKE_TIMELINE_MODE ? CURRENT_IDENTITY.outputRunId : `local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-${now.replace(/[:.]/g, "-")}`
const outputRoot = resolve(ARCHITECTURE_UPGRADE_DECISION_MODE
  ? ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-architecture-upgrade"
  : DECISION_ANALYSIS_MODE
  ? ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-decision-analysis"
  : CURRENT_SMOKE_TIMELINE_MODE
    ? ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-smoke-timeline"
    : ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-diagnostic-evidence")
const runDir = path.join(outputRoot, runId)
const analysisPath = path.join(runDir, "failure-analysis.json")
const decisionPath = DECISION_ANALYSIS_MODE ? path.join(runDir, ARCHITECTURE_UPGRADE_DECISION_MODE ? "architecture-decision.json" : "binary-decision.json") : null
const proposalPath = path.join(runDir, ARCHITECTURE_UPGRADE_DECISION_MODE ? "architecture-upgrade-proposal.json" : DECISION_ANALYSIS_MODE ? "architecture-or-candidate-proposal.json" : "read-only-repair-proposal.json")
const regressionPath = path.join(runDir, "cpu-positive-negative-regression.json")
const terminalPath = path.join(runDir, "phase-terminal.json")

const consumption = ARCHITECTURE_UPGRADE_CPU_PREFLIGHT_MODE ? null : readJson(CONSUMPTION_PATH)
const sourceReview = readJson(REVIEW_PATH)
const manifest = readJson(MANIFEST_PATH)
const activeConfig = CURRENT_SMOKE_TIMELINE_MODE ? {
  training: {
    fixedEpochPreviewPolicy: { smoke: EXPECTED_EPOCHS },
    denoiserLossWeights: manifest.denoiserLossWeights ?? {},
  },
} : readJson(ACTIVE_CONFIG_PATH)
const sourceTerminal = readJson(TERMINAL_PATH)
const finalization = readJson(FINALIZATION_PATH)
const diagnosticReport = CURRENT_SMOKE_TIMELINE_MODE ? finalization.diagnosticEvidence : readJson(DIAGNOSTIC_REPORT_PATH)
const diagnosticTerminal = CURRENT_SMOKE_TIMELINE_MODE ? sourceTerminal : readJson(DIAGNOSTIC_TERMINAL_PATH)
const previousAnalysisTerminal = DECISION_ANALYSIS_MODE ? null : readJson(PREVIOUS_ANALYSIS_TERMINAL_PATH)
const stepTelemetry = CURRENT_SMOKE_TIMELINE_MODE ? readJson(STEP_TELEMETRY_PATH) : null
const baselinePointer = DECISION_ANALYSIS_MODE ? readJson(BASELINE_POINTER_PATH) : null
const baselineTerminal = DECISION_ANALYSIS_MODE ? readJson(baselinePointer.terminalPath) : null
const baselineAnalysis = DECISION_ANALYSIS_MODE ? readJson(baselineTerminal.analysisPath) : null

const runDirectoryAlreadyExisted = fs.existsSync(runDir)
let formalRunDirectoryCreated = false
try {
  validatePreflight(runDirectoryAlreadyExisted)
  const review = enrichTimelineTimestamps(sourceReview, manifest)
  const sourcePaths = CURRENT_SMOKE_TIMELINE_MODE ? {
    review: { path: REVIEW_PATH, sha256: REVIEW_SHA256 },
    manifest: { path: MANIFEST_PATH, sha256: MANIFEST_SHA256 },
    stepTelemetry: { path: STEP_TELEMETRY_PATH, sha256: STEP_TELEMETRY_SHA256 },
    terminal: { path: TERMINAL_PATH, sha256: TERMINAL_SHA256 },
    finalization: { path: FINALIZATION_PATH, sha256: FINALIZATION_SHA256 },
    ...(DECISION_ANALYSIS_MODE ? {
      previousSuccessfulAnalysisPointer: { path: BASELINE_POINTER_PATH, sha256: BASELINE_POINTER_SHA256 },
      previousSuccessfulAnalysisTerminal: { path: baselinePointer.terminalPath, sha256: baselinePointer.terminalSha256 },
      previousSuccessfulAnalysis: { path: baselineTerminal.analysisPath, sha256: baselineTerminal.analysisSha256 },
    } : {
      previousCompatibilityTerminal: { path: PREVIOUS_ANALYSIS_TERMINAL_PATH, sha256: PREVIOUS_ANALYSIS_TERMINAL_SHA256 },
    }),
  } : {
    review: { path: REVIEW_PATH, sha256: REVIEW_SHA256 },
    manifest: { path: MANIFEST_PATH, sha256: MANIFEST_SHA256 },
    activeConfig: { path: ACTIVE_CONFIG_PATH, sha256: ACTIVE_CONFIG_SHA256 },
    terminal: { path: TERMINAL_PATH, sha256: TERMINAL_SHA256 },
    finalization: { path: FINALIZATION_PATH, sha256: FINALIZATION_SHA256 },
    diagnosticReport: { path: DIAGNOSTIC_REPORT_PATH, sha256: DIAGNOSTIC_REPORT_SHA256 },
    diagnosticTerminal: { path: DIAGNOSTIC_TERMINAL_PATH, sha256: DIAGNOSTIC_TERMINAL_SHA256 },
    previousSixPreviewAnalysisTerminal: { path: PREVIOUS_ANALYSIS_TERMINAL_PATH, sha256: PREVIOUS_ANALYSIS_TERMINAL_SHA256 },
  }
  const regressionFixture = compileStage4Analysis({ review, sourcePaths, report: diagnosticReport })
  validateGeneratedAnalysis(regressionFixture)
  const decisionFixture = DECISION_ANALYSIS_MODE
    ? classifyStage4FailureDecision({ currentAnalysis: regressionFixture, baselineAnalysis })
    : null
  if (decisionFixture) validateStage4FailureDecision(decisionFixture)
  const regression = runCpuRegression({ review, analysis: regressionFixture, sourcePaths, decision: decisionFixture })
  if (regression.failedPositiveKeys.length > 0 || regression.failedNegativeKeys.length > 0) {
    console.error(JSON.stringify({
      status: "stage4_failure_learning_cpu_regression_failed",
      failedPositiveKeys: regression.failedPositiveKeys,
      failedNegativeKeys: regression.failedNegativeKeys,
    }, null, 2))
  }
  assert(regression.failedPositiveKeys.length === 0, `stage4_failure_learning_positive_regression_failed:${regression.failedPositiveKeys.join(",")}`)
  assert(regression.failedNegativeKeys.length === 0, `stage4_failure_learning_negative_regression_failed:${regression.failedNegativeKeys.join(",")}`)
  verifySourcesUnchanged()
  if (ARCHITECTURE_UPGRADE_CPU_PREFLIGHT_MODE) {
    console.log(JSON.stringify({
      schemaVersion: "local-ai-v7-r5-stage4-architecture-upgrade-real-startup-cpu-preflight-v1",
      status: "stage4_architecture_upgrade_real_startup_cpu_preflight_passed_no_formal_writes",
      runId,
      decisionCode: decisionFixture.decisionCode,
      positiveAssertionsPassed: regression.positiveAssertionsPassed,
      negativeAssertionsPassed: regression.negativeAssertionsPassed,
      failedPositiveKeys: regression.failedPositiveKeys,
      failedNegativeKeys: regression.failedNegativeKeys,
      formalRunDirectoryCreated: false,
      latestPointerWritten: false,
      decisionReportWritten: false,
      architectureProposalWritten: false,
      formalAnalysisAuthorizationConsumed: false,
      checkpointFileRead: false,
      gpuUsed: false,
      trainingStarted: false,
    }, null, 2))
    process.exit(0)
  }
  fs.mkdirSync(outputRoot, { recursive: true })
  fs.mkdirSync(runDir, { recursive: false })
  formalRunDirectoryCreated = true
  appendEvent("r5_stage4_diagnostic_evidence_failure_analysis_started", "running", CURRENT_SMOKE_TIMELINE_MODE
    ? "CPU-only regression then one read-only interpretation of five previews plus five-epoch 17-metric post-training timeline; source weights changed in the completed Smoke; analyzer mutation=false; checkpoint file read=false; GPU=false"
    : "CPU-only regression then one read-only interpretation of six previews plus bound 17-metric diagnostic report; checkpoint file read=false; GPU=false")
  writeImmutableJson(regressionPath, regression)

  const analysis = compileStage4Analysis({ review, sourcePaths, report: diagnosticReport })
  validateGeneratedAnalysis(analysis)
  const decision = DECISION_ANALYSIS_MODE
    ? classifyStage4FailureDecision({ currentAnalysis: analysis, baselineAnalysis })
    : null
  if (decision) validateStage4FailureDecision(decision)
  verifySourcesUnchanged()
  writeImmutableJson(analysisPath, analysis)
  if (decisionPath) writeImmutableJson(decisionPath, decision)
  writeImmutableJson(proposalPath, decision ? decision.actionProposal : analysis.repairContract)
  const terminal = {
    schemaVersion: ARCHITECTURE_UPGRADE_DECISION_MODE ? "local-ai-v7-r5-stage4-architecture-upgrade-decision-terminal-v1" : DECISION_ANALYSIS_MODE ? "local-ai-v7-r5-stage4-binary-decision-analysis-terminal-v1" : CURRENT_SMOKE_TIMELINE_MODE ? "local-ai-v7-r5-stage4-smoke-timeline-failure-analysis-terminal-v1" : "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-terminal-v1",
    status: ARCHITECTURE_UPGRADE_DECISION_MODE ? "r5_stage4_architecture_upgrade_decision_completed_closed" : DECISION_ANALYSIS_MODE ? "r5_stage4_binary_decision_analysis_completed_closed" : CURRENT_SMOKE_TIMELINE_MODE ? "r5_stage4_five_previews_and_five_epoch_17_metric_timeline_analyzed_read_only_proposal_closed" : "r5_stage4_six_previews_and_17_diagnostic_metrics_analyzed_read_only_proposal_closed",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    sourceRunId: SOURCE_RUN_ID,
    sourceStageIndex: SOURCE_STAGE_INDEX,
    diagnosticReportPath: DIAGNOSTIC_REPORT_PATH,
    diagnosticReportSha256: CURRENT_SMOKE_TIMELINE_MODE ? FINALIZATION_SHA256 : DIAGNOSTIC_REPORT_SHA256,
    diagnosticMetricCount: analysis.diagnosticInterpretation.metricCount,
    analysisPath: projectPath(analysisPath),
    analysisSha256: sha256File(analysisPath),
    decisionCode: decision?.decisionCode ?? null,
    decisionPath: decisionPath ? projectPath(decisionPath) : null,
    decisionSha256: decisionPath ? sha256File(decisionPath) : null,
    proposalPath: projectPath(proposalPath),
    proposalSha256: sha256File(proposalPath),
    regressionPath: projectPath(regressionPath),
    regressionSha256: sha256File(regressionPath),
    sourceEvidenceModified: false,
    sourceWeightsChangedDuringExistingSmoke: CURRENT_SMOKE_TIMELINE_MODE,
    analyzerModifiedSourceWeights: false,
    trainingConfigModified: false,
    reviewThresholdsModified: false,
    executionValuesSelected: false,
    repairProposalActivated: false,
    checkpointFileRead: false,
    checkpointDeserialized: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    modelWeightsModified: false,
    gpuUsed: false,
    gpuTrainingStarted: false,
    trainingStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    checkpointFormallyPromoted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    automaticRetryStarted: false,
    nextIndependentAuthorization: decision?.decisionCode === "evidence_repeats_existing_failure"
      ? ARCHITECTURE_UPGRADE_DECISION_MODE
        ? "owner_stage4_architecture_upgrade_implementation_decision_required_before_any_new_candidate_or_training"
        : "owner_stage4_architecture_decision_required_before_any_new_candidate_or_training"
      : "owner_review_of_stage4_diagnostic_evidence_bounded_inactive_repair_proposal_only",
  }
  writeImmutableJson(terminalPath, terminal)
  writeImmutableJson(path.join(outputRoot, "latest.json"), {
    schemaVersion: ARCHITECTURE_UPGRADE_DECISION_MODE ? "local-ai-v7-r5-stage4-architecture-upgrade-decision-pointer-v1" : DECISION_ANALYSIS_MODE ? "local-ai-v7-r5-stage4-binary-decision-analysis-pointer-v1" : "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-pointer-v1",
    runId,
    terminalPath: projectPath(terminalPath),
    terminalSha256: sha256File(terminalPath),
  })
  appendEvent("r5_stage4_diagnostic_evidence_failure_analysis_completed", "success", DECISION_ANALYSIS_MODE
    ? `CPU regression passed; binary decision=${decision.decisionCode}; proposal inactive; analyzer mutation=false; checkpoint=false; GPU=false`
    : CURRENT_SMOKE_TIMELINE_MODE
    ? "CPU regression passed; five previews and five-epoch 17-metric timeline interpreted; bounded proposal inactive; source weights changed only in prior Smoke; analyzer mutation=false; checkpoint=false; GPU=false"
    : "CPU regression passed; six previews and 17 metrics interpreted; bounded proposal inactive; checkpoint=false; GPU=false", projectPath(terminalPath))
  console.log(JSON.stringify({ ...terminal, terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }, null, 2))
} catch (error) {
  if (ARCHITECTURE_UPGRADE_CPU_PREFLIGHT_MODE) {
    console.error(JSON.stringify({
      schemaVersion: "local-ai-v7-r5-stage4-architecture-upgrade-real-startup-cpu-preflight-v1",
      status: "stage4_architecture_upgrade_real_startup_cpu_preflight_failed_no_formal_writes",
      blockers: [String(error?.message ?? error)],
      formalRunDirectoryCreated: false,
      latestPointerWritten: false,
      formalAnalysisAuthorizationConsumed: false,
      checkpointFileRead: false,
      gpuUsed: false,
      trainingStarted: false,
    }, null, 2))
    process.exitCode = 1
  } else {
  const failureOutputRoot = DECISION_ANALYSIS_MODE && !formalRunDirectoryCreated
    ? resolve(ARCHITECTURE_UPGRADE_DECISION_MODE
      ? ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-architecture-upgrade-preflight-failures"
      : ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-decision-analysis-preflight-failures")
    : outputRoot
  const failureRunDir = path.join(failureOutputRoot, runId)
  const failureTerminalPath = path.join(failureRunDir, "phase-terminal.json")
  const terminal = {
    schemaVersion: ARCHITECTURE_UPGRADE_DECISION_MODE ? "local-ai-v7-r5-stage4-architecture-upgrade-decision-terminal-v1" : DECISION_ANALYSIS_MODE ? "local-ai-v7-r5-stage4-binary-decision-analysis-terminal-v1" : CURRENT_SMOKE_TIMELINE_MODE ? "local-ai-v7-r5-stage4-smoke-timeline-failure-analysis-terminal-v1" : "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-terminal-v1",
    status: "r5_stage4_diagnostic_evidence_failure_analysis_failed_closed",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    blockers: [String(error?.message ?? error)],
    formalRunDirectoryCreated,
    sourceEvidenceModified: false,
    trainingConfigModified: false,
    checkpointFileRead: false,
    checkpointDeserialized: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    modelWeightsModified: false,
    gpuUsed: false,
    gpuTrainingStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    automaticRetryStarted: false,
  }
  if (!fs.existsSync(failureTerminalPath)) writeImmutableJson(failureTerminalPath, terminal)
  appendEvent("r5_stage4_diagnostic_evidence_failure_analysis_failed", "failed", terminal.blockers.join(","), projectPath(failureTerminalPath))
  console.error(JSON.stringify({ ...terminal, terminalPath: projectPath(failureTerminalPath), terminalSha256: sha256File(failureTerminalPath) }, null, 2))
  process.exitCode = 1
  }
}

function compileStage4Analysis({ review, sourcePaths, report }) {
  const base = analyzeFailureLearningLoop({
    review,
    finalization: { ...finalization, runId: SOURCE_RUN_ID },
    overlay: { patch: { training: activeConfig.training } },
    sourcePaths,
    proposedBoundedRepairVersion: "v7_r5_stage4_diagnostic_evidence_bounded_candidate_proposal_v1",
    repairProfile: "stage4_progressive",
    diagnosticEvidence: report,
  })
  return {
    ...base,
    schemaVersion: CURRENT_SMOKE_TIMELINE_MODE ? "local-ai-v7-r5-stage4-smoke-training-timeline-failure-analysis-v1" : "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-v1",
    status: CURRENT_SMOKE_TIMELINE_MODE ? "stage4_five_preview_post_training_17_metric_timeline_analyzed_read_only_proposal_ready" : "stage4_six_preview_failures_and_17_diagnostic_metrics_analyzed_read_only_proposal_ready",
    generatedAtUtc: now,
    generatedAtAsiaShanghai: formatShanghai(now),
    generatedBy: "local_ai_v7_r5_stage4_failure_learning_program",
    fixedStageNumber: 4,
    addsNewFixedStage: false,
    sourceRunId: SOURCE_RUN_ID,
    sourceStageIndex: SOURCE_STAGE_INDEX,
    sourceEvidence: sourcePaths,
    sourceReviewTimestampsEnrichedFromManifestMetrics: true,
    diagnosticEvidenceReadOnly: true,
    sourceWeightsChangedDuringExistingSmoke: CURRENT_SMOKE_TIMELINE_MODE,
    sourceWeightsRepresentedAsUnchangedDiagnostic: false,
    analyzerModifiedSourceWeights: false,
    sourceEvidenceModified: false,
    reviewThresholdsModified: false,
    failedPreviewPixelsUsedAsTrainingTargets: false,
    executionValuesSelected: false,
    trainingConfigModified: false,
    checkpointFileRead: false,
    checkpointDeserialized: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    modelWeightsModified: false,
    gpuUsed: false,
    gpuTrainingStarted: false,
  }
}

function runCpuRegression({ review, analysis, sourcePaths, decision = null }) {
  if (CURRENT_SMOKE_TIMELINE_MODE) return runCurrentSmokeTimelineCpuRegression({ review, analysis, sourcePaths, decision })
  const positive = {
    sixFixedEpochsAccepted: sameJson(analysis.timeline.map((row) => row.epoch), EXPECTED_EPOCHS),
    allSixFailuresPreserved: analysis.summary.previewCount === 6 && analysis.summary.failedPreviewCount === 6 && analysis.summary.passedPreviewCount === 0,
    allIssueCodesClassified: analysis.issueClusters.every((cluster) => cluster.family !== "unclassified_machine_issue"),
    objectSemanticPersistenceDetected: hasRoot(analysis, "persistent_object_semantic_non_convergence"),
    hydrologyEarlyConvergenceDetected: hasRoot(analysis, "hydrology_learned_before_terminal"),
    routeTerminalNonConvergenceDetected: hasRoot(analysis, "route_topology_terminal_non_convergence"),
    stage4ProposalModeUsed: analysis.repairContract.schemaVersion === "local-ai-stage4-bounded-repair-contract-proposal-v1",
    originalDatasetAndStagesPreserved: analysis.repairContract.preservedContracts.datasetCapacityCount === 64 && analysis.repairContract.preservedContracts.resolutionStages?.length === 3,
    noExecutionValuesSelected: analysis.repairContract.configurationPatchProposal.selectedExecutionValues === false,
    noConfigurationApplied: analysis.repairContract.applicationGate.applyConfigurationNow === false,
    checkpointAndGpuClosed: analysis.repairContract.applicationGate.readCheckpointNow === false && analysis.repairContract.applicationGate.startGpuNow === false,
    seventeenDiagnosticMetricsAccepted: analysis.diagnosticInterpretation.metricCount === 17,
    fourObjectChannelsInterpreted: analysis.diagnosticInterpretation.objectMetrics.channels.length === 4,
    objectLossGradientAndDecodedResponseExplained: analysis.diagnosticInterpretation.objectMetrics.highestIndependentLossChannel === "rock" && analysis.diagnosticInterpretation.objectMetrics.highestGradientContributionChannel === "rock" && analysis.diagnosticInterpretation.objectMetrics.highestDecodedResponsePrototypeMaeChannel === "rock",
    fourRouteMetricsExplained: analysis.diagnosticInterpretation.routeMetrics.activationDirectionRelativeToTarget === "above_target" && analysis.diagnosticInterpretation.routeMetrics.requiredBoundaryContactState === "absent" && analysis.diagnosticInterpretation.routeMetrics.spatialDistributionL1 > 0 && analysis.diagnosticInterpretation.routeMetrics.centroidDrift > 0,
    boundedDiagnosticCandidateInactive: analysis.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate.status === "bounded_candidate_not_selected_not_applied" && analysis.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate.activationGate.selectedExecutionValues === false && analysis.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate.activationGate.applyConfigurationNow === false,
    originalSixPreviewStage4CompatibilityPreserved: stage4SixPreviewAnalyzerRegression(review, sourcePaths),
    legacyAnalyzerCompatibilityPreserved: legacyAnalyzerRegression(),
  }
  const negative = {
    missingFixedEpochRejected: expectSourceRejected(review, (value) => { value.reviews = value.reviews.filter((row) => row.epoch !== 20) }, "stage4_failure_learning_epoch_identity_invalid"),
    passedSourcePreviewRejected: expectSourceRejected(review, (value) => { value.reviews[0].passed = true }, "stage4_failure_learning_source_not_all_failed"),
    unknownIssueRejected: expectSourceRejected(review, (value) => { value.reviews[0].issueCodes.push("unknown_stage4_issue") }, "stage4_failure_learning_unknown_issue"),
    missingTimestampRejected: expectSourceRejected(review, (value) => { value.reviews[0].recordedAtUtc = null }, "stage4_failure_learning_epoch_timestamp_missing"),
    configurationApplicationRejected: expectAnalysisRejected(analysis, (value) => { value.repairContract.applicationGate.applyConfigurationNow = true }, "stage4_failure_learning_configuration_application_open"),
    selectedExecutionValueRejected: expectAnalysisRejected(analysis, (value) => { value.repairContract.configurationPatchProposal.selectedExecutionValues = true }, "stage4_failure_learning_execution_value_selected"),
    checkpointReadRejected: expectAnalysisRejected(analysis, (value) => { value.checkpointFileRead = true }, "stage4_failure_learning_checkpoint_boundary_open"),
    gpuUseRejected: expectAnalysisRejected(analysis, (value) => { value.gpuUsed = true }, "stage4_failure_learning_gpu_boundary_open"),
    sourcePathMutationRejected: expectAnalysisRejected(analysis, (value) => { value.sourceEvidence.review.sha256 = "0".repeat(64) }, "stage4_failure_learning_source_binding_invalid"),
    missingDiagnosticMetricRejected: expectDiagnosticRejected(diagnosticReport, (value) => { delete value.diagnosticMetrics.stage4DiagnosticObjectRockIndependentLoss }, "failure_learning_diagnostic_metric_count_invalid"),
    extraDiagnosticMetricRejected: expectDiagnosticRejected(diagnosticReport, (value) => { value.diagnosticMetrics.uncontractedMetric = 1 }, "failure_learning_diagnostic_metric_count_invalid"),
    nonFiniteDiagnosticMetricRejected: expectDiagnosticRejected(diagnosticReport, (value) => { value.diagnosticMetrics.stage4DiagnosticRouteCentroidDrift = null }, "failure_learning_diagnostic_metric_value_invalid"),
    unavailableObjectGradientRejected: expectDiagnosticRejected(diagnosticReport, (value) => { value.diagnosticMetrics.stage4DiagnosticObjectGradientAvailable = 0 }, "failure_learning_diagnostic_object_gradient_unavailable"),
    changedModelStateRejected: expectDiagnosticRejected(diagnosticReport, (value) => { value.integrity.denoiserStateSha256After = "0".repeat(64) }, "failure_learning_diagnostic_denoiser_state_changed"),
    activatedDiagnosticProposalRejected: expectAnalysisRejected(analysis, (value) => { value.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate.activationGate.applyConfigurationNow = true }, "stage4_failure_learning_diagnostic_candidate_activated"),
  }
  const failedPositiveKeys = Object.entries(positive).filter(([, passed]) => !passed).map(([key]) => key)
  const failedNegativeKeys = Object.entries(negative).filter(([, passed]) => !passed).map(([key]) => key)
  return {
    schemaVersion: "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-cpu-regression-v1",
    status: "passed_cpu_only_six_preview_compatibility_and_17_metric_read_only_analysis_proposal_inactive",
    device: "cpu",
    generatedAtUtc: new Date().toISOString(),
    generatedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    sourcePaths,
    positive,
    negative,
    failedPositiveKeys,
    failedNegativeKeys,
    positiveAssertionsPassed: Object.values(positive).filter(Boolean).length,
    negativeAssertionsPassed: Object.values(negative).filter(Boolean).length,
    boundaries: {
      sourceEvidenceModified: false,
      trainingConfigModified: false,
      reviewThresholdsModified: false,
      failedPreviewPixelsUsedAsTrainingTargets: false,
      executionValuesSelected: false,
      checkpointFileRead: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuUsed: false,
      gpuTrainingStarted: false,
      fullTrainingStarted: false,
      strictRevalidationStarted: false,
      formalInferenceStarted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
    },
  }
}

function runCurrentSmokeTimelineCpuRegression({ review, analysis, sourcePaths, decision }) {
  const rock = analysis.diagnosticInterpretation.objectMetrics.channels.find((row) => row.channel === "rock")
  const decisionContractRegression = DECISION_ANALYSIS_MODE
    ? runStage4DecisionContractRegression({ realEvidenceDecision: decision, baselineAnalysis })
    : null
  const positive = {
    fiveFixedEpochsAccepted: sameJson(analysis.timeline.map((row) => row.epoch), [1, 5, 10, 20, 30]),
    ...(DECISION_ANALYSIS_MODE
      ? { onePassFourFailuresPreserved: analysis.summary.previewCount === 5 && analysis.summary.failedPreviewCount === 4 && analysis.summary.passedPreviewCount === 1 }
      : { allFiveFailuresPreserved: analysis.summary.previewCount === 5 && analysis.summary.failedPreviewCount === 5 && analysis.summary.passedPreviewCount === 0 }),
    allIssueCodesClassified: analysis.issueClusters.every((cluster) => cluster.family !== "unclassified_machine_issue"),
    ...(DECISION_ANALYSIS_MODE ? {
      finalEpochVisualPassPreserved: analysis.timeline.at(-1).epoch === 30 && analysis.timeline.at(-1).passed === true && analysis.timeline.at(-1).issueCodes.length === 0,
      routeCoverageFailureTimelinePreserved: sameJson(issueEpochs(analysis, "condition_terrain_path_ground_coverage_mismatch"), [1]),
      westBoundaryFailureTimelinePreserved: sameJson(issueEpochs(analysis, "condition_terrain_path_ground_required_boundary_contact_missing"), [1, 5]),
      rockSemanticFailureTimelinePreserved: sameJson(issueEpochs(analysis, "condition_object_rock_reference_semantic_mismatch"), [1, 5, 10, 20]),
      finalVisualDifferentialPassStatePreserved: analysis.diagnosticVisualDifferential.route.visualCoverageReviewFailed === false && analysis.diagnosticVisualDifferential.route.visualRequiredWestBoundaryContactReviewFailed === false && analysis.diagnosticVisualDifferential.rock.heldoutVisualSemanticReviewFailed === false,
    } : {
      objectSemanticPersistenceDetected: hasRoot(analysis, "persistent_object_semantic_non_convergence"),
      routeTerminalNonConvergenceDetected: hasRoot(analysis, "route_topology_terminal_non_convergence"),
      routeMetricVisualDomainGapDetected: hasRoot(analysis, "route_internal_metric_and_fixed_preview_visual_review_domain_gap"),
      rockMetricVisualNonConvergenceDetected: hasRoot(analysis, "rock_training_diagnostic_improvement_without_heldout_visual_acceptance"),
    }),
    trainingTimelineSchemaAccepted: analysis.diagnosticInterpretation.status === "post_training_five_epoch_diagnostic_timeline_interpreted_read_only",
    seventeenMetricsAtFiveEpochsAccepted: analysis.diagnosticInterpretation.metricCount === 17 && analysis.diagnosticInterpretation.epochCount === 5,
    sourceWeightChangeAndAnalyzerReadonlySeparated: analysis.sourceWeightsChangedDuringExistingSmoke === true && analysis.sourceWeightsRepresentedAsUnchangedDiagnostic === false && analysis.analyzerModifiedSourceWeights === false && analysis.diagnosticInterpretation.sourceMutationContext.analyzerReadsEvidenceOnly === true,
    rockTrainingResponseImproved: rock.independentLossDelta < 0 && rock.decodedResponsePrototypeMaeDelta < 0,
    rockRemainsHighestFinalResidual: analysis.diagnosticInterpretation.objectMetrics.highestIndependentLossChannel === "rock" && analysis.diagnosticInterpretation.objectMetrics.highestGradientContributionChannel === "rock" && analysis.diagnosticInterpretation.objectMetrics.highestDecodedResponsePrototypeMaeChannel === "rock",
    ...(DECISION_ANALYSIS_MODE ? {
      finalVisualAcceptanceNotRewrittenAsDiagnosticFailure: analysis.diagnosticVisualDifferential.finalEpoch === 30 && analysis.diagnosticVisualDifferential.thresholdsReinterpreted === false,
    } : {
      internalBoundaryResponseNotVisualAcceptance: analysis.diagnosticInterpretation.routeMetrics.requiredBoundaryContactState === "positive_internal_response_not_visual_acceptance" && analysis.diagnosticVisualDifferential.route.visualRequiredWestBoundaryContactReviewFailed === true,
      routeCoverageMetricReviewGapPreserved: analysis.diagnosticVisualDifferential.route.visualCoverageReviewFailed === true && analysis.diagnosticVisualDifferential.thresholdsReinterpreted === false,
    }),
    stage4ProposalModeUsed: analysis.repairContract.schemaVersion === "local-ai-stage4-bounded-repair-contract-proposal-v1",
    boundedProposalInactive: analysis.repairContract.configurationPatchProposal.selectedExecutionValues === false && analysis.repairContract.applicationGate.applyConfigurationNow === false && analysis.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate.activationGate.applyConfigurationNow === false,
    checkpointGpuAndTrainingClosed: analysis.repairContract.applicationGate.readCheckpointNow === false && analysis.repairContract.applicationGate.startGpuNow === false && analysis.checkpointFileRead === false && analysis.gpuUsed === false && analysis.gpuTrainingStarted === false,
    currentSourceEvidenceBound: analysis.sourceEvidence.review.sha256 === REVIEW_SHA256 && analysis.sourceEvidence.manifest.sha256 === MANIFEST_SHA256 && analysis.sourceEvidence.stepTelemetry.sha256 === STEP_TELEMETRY_SHA256 && analysis.sourceEvidence.finalization.sha256 === FINALIZATION_SHA256,
    legacyGenericAnalyzerCompatibilityPreserved: legacyAnalyzerRegression(),
    legacySixPreviewCompatibilityPreserved: legacySixPreviewSyntheticRegression(),
    legacyReadonlyDiagnosticCompatibilityPreserved: legacyReadonlyDiagnosticSyntheticRegression(review),
    ...(DECISION_ANALYSIS_MODE ? {
      binaryDecisionExactlyOneCode: decision?.decisionCode === "evidence_repeats_existing_failure" || decision?.decisionCode === "new_actionable_difference",
      repeatedEvidenceStopsParameterRepair: decision?.decisionCode !== "evidence_repeats_existing_failure" || decision.actionProposal.parameterRepairContinuationRecommended === false,
      decisionProposalInactive: decision?.proposalActivated === false && decision?.actionProposal?.activationGate?.applyConfigurationNow === false,
      ...decisionContractRegression.positive,
      isolatedDecisionOutputNamespace: projectPath(outputRoot) === (ARCHITECTURE_UPGRADE_DECISION_MODE
        ? ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-architecture-upgrade"
        : ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-decision-analysis"),
      oldSuccessfulPointerPreserved: fileHashMatches(BASELINE_POINTER_PATH, BASELINE_POINTER_SHA256),
    } : {}),
  }
  const negative = {
    missingFixedEpochRejected: expectSourceRejected(review, (value) => { value.reviews = value.reviews.filter((row) => row.epoch !== 20) }, "stage4_failure_learning_epoch_identity_invalid"),
    ...(DECISION_ANALYSIS_MODE
      ? { unexpectedPassPatternRejected: expectSourceRejected(review, (value) => { value.reviews[0].passed = true }, "stage4_failure_learning_decision_review_pass_pattern_invalid") }
      : { passedSourcePreviewRejected: expectSourceRejected(review, (value) => { value.reviews[0].passed = true }, "stage4_failure_learning_source_not_all_failed") }),
    unknownIssueRejected: expectSourceRejected(review, (value) => { value.reviews[0].issueCodes.push("unknown_stage4_issue") }, "stage4_failure_learning_unknown_issue"),
    missingTimestampRejected: expectSourceRejected(review, (value) => { value.reviews[0].recordedAtUtc = null }, "stage4_failure_learning_epoch_timestamp_missing"),
    configurationApplicationRejected: expectAnalysisRejected(analysis, (value) => { value.repairContract.applicationGate.applyConfigurationNow = true }, "stage4_failure_learning_configuration_application_open"),
    checkpointReadRejected: expectAnalysisRejected(analysis, (value) => { value.checkpointFileRead = true }, "stage4_failure_learning_checkpoint_boundary_open"),
    gpuUseRejected: expectAnalysisRejected(analysis, (value) => { value.gpuUsed = true }, "stage4_failure_learning_gpu_boundary_open"),
    sourcePathMutationRejected: expectAnalysisRejected(analysis, (value) => { value.sourceEvidence.stepTelemetry.sha256 = "0".repeat(64) }, "stage4_failure_learning_source_binding_invalid"),
    missingTimelineMetricRejected: expectDiagnosticRejected(diagnosticReport, (value) => { delete value.epochs[0].metrics.stage4DiagnosticObjectRockIndependentLoss }, "failure_learning_training_timeline_epoch_1_metric_identity_invalid"),
    extraTimelineMetricRejected: expectDiagnosticRejected(diagnosticReport, (value) => { value.epochs[0].metrics.uncontractedMetric = 1 }, "failure_learning_training_timeline_epoch_1_metric_identity_invalid"),
    nonFiniteTimelineMetricRejected: expectDiagnosticRejected(diagnosticReport, (value) => { value.epochs[4].metrics.stage4DiagnosticRouteCentroidDrift = null }, "failure_learning_training_timeline_epoch_30_metric_value_invalid"),
    unavailableTimelineGradientRejected: expectDiagnosticRejected(diagnosticReport, (value) => { value.epochs[2].metrics.stage4DiagnosticObjectGradientAvailable = 0 }, "failure_learning_training_timeline_epoch_10_object_gradient_unavailable"),
    missingTimelineEpochRejected: expectDiagnosticRejected(diagnosticReport, (value) => { value.epochs = value.epochs.filter((row) => row.epoch !== 10) }, "failure_learning_training_timeline_epoch_identity_invalid"),
    activatedDiagnosticProposalRejected: expectAnalysisRejected(analysis, (value) => { value.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate.activationGate.applyConfigurationNow = true }, "stage4_failure_learning_diagnostic_candidate_activated"),
    ...(DECISION_ANALYSIS_MODE ? decisionContractRegression.negative : {}),
  }
  const failedPositiveKeys = Object.entries(positive).filter(([, passed]) => !passed).map(([key]) => key)
  const failedNegativeKeys = Object.entries(negative).filter(([, passed]) => !passed).map(([key]) => key)
  return {
    schemaVersion: DECISION_ANALYSIS_MODE ? "local-ai-v7-r5-stage4-binary-decision-analysis-cpu-regression-v1" : "local-ai-v7-r5-stage4-smoke-training-timeline-analysis-cpu-regression-v1",
    status: DECISION_ANALYSIS_MODE ? "passed_cpu_only_binary_decision_analysis_and_legacy_compatibility" : "passed_cpu_only_five_preview_post_training_17_metric_timeline_read_only_analysis_proposal_inactive",
    device: "cpu",
    generatedAtUtc: new Date().toISOString(),
    generatedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    sourcePaths,
    sharedDecisionContract: decisionContractRegression ? {
      schemaVersion: decisionContractRegression.schemaVersion,
      realEvidenceDecisionCode: decisionContractRegression.realEvidenceDecisionCode,
      fixtureDecisionCodes: decisionContractRegression.fixtureDecisionCodes,
    } : null,
    positive,
    negative,
    failedPositiveKeys,
    failedNegativeKeys,
    positiveAssertionsPassed: Object.values(positive).filter(Boolean).length,
    negativeAssertionsPassed: Object.values(negative).filter(Boolean).length,
    boundaries: {
      sourceEvidenceModified: false,
      sourceWeightsChangedDuringExistingSmoke: true,
      analyzerModifiedSourceWeights: false,
      trainingConfigModified: false,
      reviewThresholdsModified: false,
      executionValuesSelected: false,
      checkpointFileRead: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuUsed: false,
      gpuTrainingStarted: false,
      fullTrainingStarted: false,
      strictRevalidationStarted: false,
      formalInferenceStarted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
    },
  }
}

function validatePreflight(runDirectoryAlreadyExisted) {
  if (CURRENT_SMOKE_TIMELINE_MODE) return validateCurrentSmokeTimelinePreflight(runDirectoryAlreadyExisted)
  const identity = authorization?.taskIdentity ?? {}
  const checks = [
    [fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "stage4_failure_learning_authorization_hash_invalid"],
    [fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "stage4_failure_learning_consumption_hash_invalid"],
    [authorization?.status === "resolved_owner_authorized", "stage4_failure_learning_authorization_not_resolved"],
    [authorization?.ownerDecision?.commandRef === COMMAND_REF && authorization?.ownerDecision?.scope === SCOPE, "stage4_failure_learning_authorization_identity_invalid"],
    [consumption?.status === "consumed_before_authorized_write" && consumption?.authorizationSha256 === AUTHORIZATION_SHA256, "stage4_failure_learning_authorization_not_consumed"],
    [consumption?.commandRef === COMMAND_REF && consumption?.scope === SCOPE && consumption?.allowedExecutionCount === 1, "stage4_failure_learning_consumption_identity_invalid"],
    [identity.sourceRunId === SOURCE_RUN_ID && identity.sourceStageIndex === SOURCE_STAGE_INDEX, "stage4_failure_learning_source_identity_invalid"],
    [sameJson(identity.requiredEpochs, EXPECTED_EPOCHS) && identity.requiredFailedPreviewCount === 6, "stage4_failure_learning_epoch_authorization_invalid"],
    [identity.sourceReviewPath === REVIEW_PATH && identity.sourceReviewSha256 === REVIEW_SHA256, "stage4_failure_learning_review_authorization_binding_invalid"],
    [identity.sourceManifestPath === MANIFEST_PATH && identity.sourceManifestSha256 === MANIFEST_SHA256, "stage4_failure_learning_manifest_authorization_binding_invalid"],
    [identity.sourceActiveConfigPath === ACTIVE_CONFIG_PATH && identity.sourceActiveConfigSha256 === ACTIVE_CONFIG_SHA256, "stage4_failure_learning_config_authorization_binding_invalid"],
    [identity.sourceTerminalPath === TERMINAL_PATH && identity.sourceTerminalSha256 === TERMINAL_SHA256, "stage4_failure_learning_terminal_authorization_binding_invalid"],
    [identity.sourceFinalizationPath === FINALIZATION_PATH && identity.sourceFinalizationSha256 === FINALIZATION_SHA256, "stage4_failure_learning_finalization_authorization_binding_invalid"],
    [identity.diagnosticReportPath === DIAGNOSTIC_REPORT_PATH && identity.diagnosticReportSha256 === DIAGNOSTIC_REPORT_SHA256, "stage4_failure_learning_diagnostic_report_authorization_binding_invalid"],
    [identity.diagnosticTerminalPath === DIAGNOSTIC_TERMINAL_PATH && identity.diagnosticTerminalSha256 === DIAGNOSTIC_TERMINAL_SHA256, "stage4_failure_learning_diagnostic_terminal_authorization_binding_invalid"],
    [identity.previousSixPreviewAnalysisTerminalPath === PREVIOUS_ANALYSIS_TERMINAL_PATH && identity.previousSixPreviewAnalysisTerminalSha256 === PREVIOUS_ANALYSIS_TERMINAL_SHA256, "stage4_failure_learning_previous_analysis_authorization_binding_invalid"],
    [identity.runnerPath === "scripts/run-local-ai-v7-r5-stage4-failure-learning.mjs" && identity.runnerBeforeSha256 === "df8f2cbb2edcd1b9f9f07a1c922966df1341b5fec4f76b43d8b7ae57cde5e95b", "stage4_failure_learning_runner_before_binding_invalid"],
    [identity.analyzerLibraryPath === ANALYZER_PATH && identity.analyzerLibraryBeforeSha256 === "017b221b3e47bdd7252d994a485706ff16be551d5b6d60f6d8cb035534529fbc", "stage4_failure_learning_analyzer_before_binding_invalid"],
    [identity.requiredDiagnosticMetricCount === 17, "stage4_failure_learning_diagnostic_metric_count_authorization_invalid"],
    [fileHashMatches(REVIEW_PATH, REVIEW_SHA256), "stage4_failure_learning_review_changed"],
    [fileHashMatches(MANIFEST_PATH, MANIFEST_SHA256), "stage4_failure_learning_manifest_changed"],
    [fileHashMatches(ACTIVE_CONFIG_PATH, ACTIVE_CONFIG_SHA256), "stage4_failure_learning_active_config_changed"],
    [fileHashMatches(TERMINAL_PATH, TERMINAL_SHA256), "stage4_failure_learning_terminal_changed"],
    [fileHashMatches(FINALIZATION_PATH, FINALIZATION_SHA256), "stage4_failure_learning_finalization_changed"],
    [fileHashMatches(DIAGNOSTIC_REPORT_PATH, DIAGNOSTIC_REPORT_SHA256), "stage4_failure_learning_diagnostic_report_changed"],
    [fileHashMatches(DIAGNOSTIC_TERMINAL_PATH, DIAGNOSTIC_TERMINAL_SHA256), "stage4_failure_learning_diagnostic_terminal_changed"],
    [fileHashMatches(PREVIOUS_ANALYSIS_TERMINAL_PATH, PREVIOUS_ANALYSIS_TERMINAL_SHA256), "stage4_failure_learning_previous_analysis_terminal_changed"],
    [fileHashMatches(ANALYZER_PATH, ANALYZER_SHA256), "stage4_failure_learning_analyzer_changed"],
    [sourceReview.status === "machine_reviews_failed_closed" && sourceReview.previewFailCount === 6, "stage4_failure_learning_review_status_invalid"],
    [manifest.status === "conditional_denoiser_training_completed_pending_validation" && manifest.resolutionStage?.width === 256 && manifest.resolutionStage?.height === 192, "stage4_failure_learning_manifest_status_invalid"],
    [sourceTerminal.status === "r5_stage4_full_training_failed_stopped" && sourceTerminal.completedStageCount === 1, "stage4_failure_learning_terminal_status_invalid"],
    [finalization.blockers?.includes("stage_0_preview_machine_gate_failed") && finalization.stageResults?.length === 1, "stage4_failure_learning_finalization_status_invalid"],
    [activeConfig.training?.stage4FullTrainingContract?.status === "active_single_execution", "stage4_failure_learning_source_training_contract_invalid"],
    [diagnosticReport.status === "read_only_single_sample_gpu_diagnostic_completed_weights_unchanged" && Object.keys(diagnosticReport.diagnosticMetrics ?? {}).length === 17, "stage4_failure_learning_diagnostic_report_status_invalid"],
    [diagnosticTerminal.status === "r5_stage4_readonly_single_sample_gpu_diagnostic_completed_closed" && diagnosticTerminal.reportSha256 === DIAGNOSTIC_REPORT_SHA256, "stage4_failure_learning_diagnostic_terminal_status_invalid"],
    [previousAnalysisTerminal.status === "r5_stage4_six_preview_failures_analyzed_read_only_repair_proposal_cpu_verified", "stage4_failure_learning_previous_analysis_terminal_status_invalid"],
    [runDirectoryAlreadyExisted === false, "stage4_failure_learning_run_already_exists"],
    [!fs.existsSync(path.join(outputRoot, "latest.json")), "stage4_failure_learning_execution_already_registered"],
  ]
  for (const [ok, code] of checks) assert(ok, code)
  for (const key of ["failurePreviewEvidenceReadAuthorized", "diagnosticReportReadAuthorized", "localAnalyzerExtensionAuthorized", "cpuPositiveNegativeRegressionAuthorized", "singleReadOnlyAnalysisAuthorized", "boundedInactiveRepairProposalAuthorized", "immutableEvidenceStorageAuthorized", "automaticTerminalStorageAuthorized"]) {
    assert(authorization.resolution?.[key] === true, `stage4_failure_learning_${key}_missing`)
  }
  for (const key of ["sourceEvidenceModificationAuthorized", "trainingConfigModificationAuthorized", "reviewThresholdChangeAuthorized", "checkpointFileReadAuthorized", "checkpointDeserializationAuthorized", "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "backwardExecutionAuthorized", "modelWeightMutationAuthorized", "gpuUseAuthorized", "trainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointFormalPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized", "automaticRetryAuthorized"]) {
    assert(authorization.resolution?.[key] === false, `stage4_failure_learning_boundary_${key}_invalid`)
  }
}

function validateCurrentSmokeTimelinePreflight(runDirectoryAlreadyExisted) {
  const identity = authorization?.taskIdentity ?? {}
  const checks = [
    [fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "stage4_failure_learning_authorization_hash_invalid"],
    [ARCHITECTURE_UPGRADE_CPU_PREFLIGHT_MODE || fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "stage4_failure_learning_consumption_hash_invalid"],
    [authorization?.status === "resolved_owner_authorized", "stage4_failure_learning_authorization_not_resolved"],
    [authorization?.ownerDecision?.commandRef === COMMAND_REF && authorization?.ownerDecision?.scope === SCOPE, "stage4_failure_learning_authorization_identity_invalid"],
    [ARCHITECTURE_UPGRADE_CPU_PREFLIGHT_MODE || (consumption?.status === "consumed_before_cpu_regression_and_single_readonly_analysis" && consumption?.authorizationSha256 === AUTHORIZATION_SHA256), "stage4_failure_learning_authorization_not_consumed"],
    [ARCHITECTURE_UPGRADE_CPU_PREFLIGHT_MODE || (consumption?.commandRef === COMMAND_REF && consumption?.scope === SCOPE && consumption?.allowedCpuRegressionCount === 1 && consumption?.allowedReadonlyAnalysisCount === 1 && consumption?.automaticRetryAuthorized === false), "stage4_failure_learning_consumption_identity_invalid"],
    [identity.sourceRunId === SOURCE_RUN_ID && identity.sourceStageIndex === SOURCE_STAGE_INDEX, "stage4_failure_learning_source_identity_invalid"],
    [sameJson(identity.requiredEpochs, EXPECTED_EPOCHS) && identity.requiredFailedPreviewCount === (DECISION_ANALYSIS_MODE ? 4 : 5) && (!DECISION_ANALYSIS_MODE || identity.requiredPassedPreviewCount === 1) && identity.requiredDiagnosticMetricCountPerEpoch === 17, "stage4_failure_learning_epoch_authorization_invalid"],
    [identity.sourceReviewPath === REVIEW_PATH && identity.sourceReviewSha256 === REVIEW_SHA256, "stage4_failure_learning_review_authorization_binding_invalid"],
    [identity.sourceManifestPath === MANIFEST_PATH && identity.sourceManifestSha256 === MANIFEST_SHA256, "stage4_failure_learning_manifest_authorization_binding_invalid"],
    [identity.sourceStepTelemetryPath === STEP_TELEMETRY_PATH && identity.sourceStepTelemetrySha256 === STEP_TELEMETRY_SHA256, "stage4_failure_learning_step_telemetry_authorization_binding_invalid"],
    [identity.sourceFailureTerminalPath === TERMINAL_PATH && identity.sourceFailureTerminalSha256 === TERMINAL_SHA256, "stage4_failure_learning_terminal_authorization_binding_invalid"],
    [identity.sourceFinalizationPath === FINALIZATION_PATH && identity.sourceFinalizationSha256 === FINALIZATION_SHA256, "stage4_failure_learning_finalization_authorization_binding_invalid"],
    [DECISION_ANALYSIS_MODE || (identity.previousCompatibilityTerminalPath === PREVIOUS_ANALYSIS_TERMINAL_PATH && identity.previousCompatibilityTerminalSha256 === PREVIOUS_ANALYSIS_TERMINAL_SHA256), "stage4_failure_learning_previous_analysis_authorization_binding_invalid"],
    [!DECISION_ANALYSIS_MODE || (identity.previousSuccessfulAnalysisPointerPath === BASELINE_POINTER_PATH && identity.previousSuccessfulAnalysisPointerSha256 === BASELINE_POINTER_SHA256), "stage4_failure_learning_baseline_pointer_authorization_binding_invalid"],
    [identity.runnerPath === "scripts/run-local-ai-v7-r5-stage4-failure-learning.mjs" && identity.runnerSha256 === sha256File("scripts/run-local-ai-v7-r5-stage4-failure-learning.mjs"), "stage4_failure_learning_runner_binding_invalid"],
    [identity.analyzerLibraryPath === ANALYZER_PATH && identity.analyzerLibrarySha256 === ANALYZER_SHA256, "stage4_failure_learning_analyzer_binding_invalid"],
    [!DECISION_ANALYSIS_MODE || (identity.decisionContractHelperPath === DECISION_HELPER_PATH && identity.decisionContractHelperSha256 === sha256File(DECISION_HELPER_PATH)), "stage4_failure_learning_decision_helper_binding_invalid"],
    [fileHashMatches(REVIEW_PATH, REVIEW_SHA256), "stage4_failure_learning_review_changed"],
    [fileHashMatches(MANIFEST_PATH, MANIFEST_SHA256), "stage4_failure_learning_manifest_changed"],
    [fileHashMatches(STEP_TELEMETRY_PATH, STEP_TELEMETRY_SHA256), "stage4_failure_learning_step_telemetry_changed"],
    [fileHashMatches(TERMINAL_PATH, TERMINAL_SHA256), "stage4_failure_learning_terminal_changed"],
    [fileHashMatches(FINALIZATION_PATH, FINALIZATION_SHA256), "stage4_failure_learning_finalization_changed"],
    [DECISION_ANALYSIS_MODE || fileHashMatches(PREVIOUS_ANALYSIS_TERMINAL_PATH, PREVIOUS_ANALYSIS_TERMINAL_SHA256), "stage4_failure_learning_previous_analysis_terminal_changed"],
    [!DECISION_ANALYSIS_MODE || fileHashMatches(BASELINE_POINTER_PATH, BASELINE_POINTER_SHA256), "stage4_failure_learning_baseline_pointer_changed"],
    [!DECISION_ANALYSIS_MODE || fileHashMatches(baselinePointer.terminalPath, baselinePointer.terminalSha256), "stage4_failure_learning_baseline_terminal_changed"],
    [!DECISION_ANALYSIS_MODE || fileHashMatches(baselineTerminal.analysisPath, baselineTerminal.analysisSha256), "stage4_failure_learning_baseline_analysis_changed"],
    [fileHashMatches(ANALYZER_PATH, ANALYZER_SHA256), "stage4_failure_learning_analyzer_changed"],
    [!DECISION_ANALYSIS_MODE || fileHashMatches(DECISION_HELPER_PATH, identity.decisionContractHelperSha256), "stage4_failure_learning_decision_helper_changed"],
    [sourceReview.status === (ARCHITECTURE_UPGRADE_DECISION_MODE ? "machine_reviews_late_stability_failed_closed" : "machine_reviews_failed_closed") && sourceReview.previewCount === 5 && sourceReview.previewFailCount === (DECISION_ANALYSIS_MODE ? 4 : 5) && sourceReview.previewPassCount === (DECISION_ANALYSIS_MODE ? 1 : 0), "stage4_failure_learning_review_status_invalid"],
    [manifest.status === "conditional_denoiser_single_sample_overfit_smoke_completed" && manifest.modelStateHashEvidence?.weightsChanged === true, "stage4_failure_learning_manifest_status_invalid"],
    [sourceTerminal.status === "stage4_bounded_repair_single_sample_gpu_smoke_failed_stopped" && sourceTerminal.blockers?.includes(ARCHITECTURE_UPGRADE_DECISION_MODE ? "late_stability_qualification_failed" : "fixed_preview_machine_review_failed"), "stage4_failure_learning_terminal_status_invalid"],
    [finalization.status === "stage4_bounded_repair_single_sample_gpu_smoke_failed_stopped" && finalization.diagnosticEvidence?.metricCount === 17 && finalization.diagnosticEvidence?.epochs?.length === 5, "stage4_failure_learning_finalization_status_invalid"],
    [stepTelemetry.status === "step_recorded" && stepTelemetry.latestStep === "checkpoint_write" && stepTelemetry.latestStatus === "completed", "stage4_failure_learning_step_telemetry_status_invalid"],
    [!ARCHITECTURE_UPGRADE_DECISION_MODE || structuredLateStabilityEvidenceValid(sourceReview), "stage4_failure_learning_late_stability_evidence_invalid"],
    [DECISION_ANALYSIS_MODE || previousAnalysisTerminal.status === "r5_stage4_smoke_five_preview_differential_analysis_preflight_failed_closed", "stage4_failure_learning_previous_analysis_terminal_status_invalid"],
    [runDirectoryAlreadyExisted === false, "stage4_failure_learning_run_already_exists"],
    [!fs.existsSync(path.join(outputRoot, "latest.json")), "stage4_failure_learning_execution_already_registered"],
  ]
  for (const [ok, code] of checks) assert(ok, code)
  const requiredAllowedKeys = ARCHITECTURE_UPGRADE_DECISION_MODE
    ? ["postTrainingTimelineReadAuthorized", "failurePreviewEvidenceReadAuthorized", "binaryDecisionAnalysisAuthorized", "cpuPositiveNegativeRegressionAuthorized", "singleReadOnlyAnalysisAuthorized", "architectureDecisionUpgradeProposalAuthorized", "architectureUpgradeProposalOnlyAuthorized", "immutableEvidenceStorageAuthorized"]
    : DECISION_ANALYSIS_MODE
    ? ["postTrainingTimelineReadAuthorized", "failurePreviewEvidenceReadAuthorized", "binaryDecisionAnalysisAuthorized", "cpuPositiveNegativeRegressionAuthorized", "singleReadOnlyAnalysisAuthorized", "boundedInactiveCandidateProposalAuthorized", "architectureDecisionUpgradeProposalAuthorized", "immutableEvidenceStorageAuthorized"]
    : ["postTrainingTimelineReadAuthorized", "failurePreviewEvidenceReadAuthorized", "localAnalyzerExtensionAuthorized", "cpuPositiveNegativeRegressionAuthorized", "singleReadOnlyAnalysisAuthorized", "boundedInactiveRepairProposalAuthorized", "immutableEvidenceStorageAuthorized"]
  for (const key of requiredAllowedKeys) {
    assert(authorization.resolution?.[key] === true, `stage4_failure_learning_${key}_missing`)
  }
  if (ARCHITECTURE_UPGRADE_DECISION_MODE) {
    assert(authorization.resolution?.architectureUpgradeDecisionModeAuthorized === true, "stage4_failure_learning_architecture_upgrade_mode_missing")
    assert(authorization.resolution?.parameterCandidateGenerationAuthorized === false, "stage4_failure_learning_parameter_candidate_generation_boundary_invalid")
  }
  for (const key of ["sourceEvidenceModificationAuthorized", "trainingConfigModificationAuthorized", "reviewThresholdChangeAuthorized", "checkpointFileReadAuthorized", "checkpointDeserializationAuthorized", "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "backwardExecutionAuthorized", "modelWeightMutationAuthorized", "gpuUseAuthorized", "trainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointFormalPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized", "automaticRetryAuthorized"]) {
    assert(authorization.resolution?.[key] === false, `stage4_failure_learning_boundary_${key}_invalid`)
  }
}

function validateStage4SourceReview(review) {
  assert(review.status === (ARCHITECTURE_UPGRADE_DECISION_MODE ? "machine_reviews_late_stability_failed_closed" : "machine_reviews_failed_closed"), "stage4_failure_learning_review_status_invalid")
  assert(sameJson(review.reviews.map((row) => row.epoch), EXPECTED_EPOCHS), "stage4_failure_learning_epoch_identity_invalid")
  if (DECISION_ANALYSIS_MODE) {
    assert(review.previewCount === 5 && review.previewPassCount === 1 && review.previewFailCount === 4, "stage4_failure_learning_decision_review_count_invalid")
    assert(review.reviews.slice(0, 4).every((row) => row.passed === false) && review.reviews[4].epoch === 30 && review.reviews[4].passed === true, "stage4_failure_learning_decision_review_pass_pattern_invalid")
  } else {
    assert(review.reviews.every((row) => row.passed === false), "stage4_failure_learning_source_not_all_failed")
  }
  for (const row of review.reviews) {
    assert(typeof row.recordedAtUtc === "string" && typeof row.recordedAtAsiaShanghai === "string", "stage4_failure_learning_epoch_timestamp_missing")
    for (const code of row.issueCodes) assert(KNOWN_STAGE4_ISSUES.has(code), `stage4_failure_learning_unknown_issue:${code}`)
  }
}

function structuredLateStabilityEvidenceValid(review) {
  const qualification = review?.lateStabilityQualification
  return review?.reviewThresholdsChanged === false
    && qualification?.status === "late_stability_not_qualified"
    && qualification?.passed === false
    && sameJson(qualification.requiredEpochs, [20, 30])
    && qualification.requiredEpochPasses?.["20"] === false
    && qualification.requiredEpochPasses?.["30"] === true
    && qualification.minimumConsecutivePasses === 2
    && qualification.observedConsecutivePasses === 1
    && qualification.finalEpochMustPass === true
    && qualification.finalEpochPassed === true
    && qualification.allFivePreviewsReviewed === true
    && qualification.reviewThresholdsChanged === false
    && qualification.trainingTarget === false
}

function validateGeneratedAnalysis(analysis) {
  if (CURRENT_SMOKE_TIMELINE_MODE) return validateCurrentSmokeTimelineAnalysis(analysis)
  assert(analysis.schemaVersion === "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-v1", "stage4_failure_learning_analysis_schema_invalid")
  assert(analysis.status === "stage4_six_preview_failures_and_17_diagnostic_metrics_analyzed_read_only_proposal_ready", "stage4_failure_learning_analysis_status_invalid")
  assert(sameJson(analysis.timeline.map((row) => row.epoch), EXPECTED_EPOCHS), "stage4_failure_learning_analysis_timeline_invalid")
  assert(analysis.summary.failedPreviewCount === 6 && analysis.summary.passedPreviewCount === 0, "stage4_failure_learning_analysis_count_invalid")
  assert(analysis.issueClusters.every((cluster) => cluster.family !== "unclassified_machine_issue"), "stage4_failure_learning_unknown_issue_family")
  assert(analysis.repairContract.status === "owner_review_required_not_applied", "stage4_failure_learning_proposal_status_invalid")
  assert(analysis.repairContract.applicationGate.applyConfigurationNow === false, "stage4_failure_learning_configuration_application_open")
  assert(analysis.repairContract.configurationPatchProposal.selectedExecutionValues === false, "stage4_failure_learning_execution_value_selected")
  assert(analysis.diagnosticInterpretation?.metricCount === 17, "stage4_failure_learning_diagnostic_interpretation_invalid")
  assert(analysis.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate?.status === "bounded_candidate_not_selected_not_applied", "stage4_failure_learning_diagnostic_candidate_missing")
  assert(analysis.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate.activationGate.selectedExecutionValues === false && analysis.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate.activationGate.applyConfigurationNow === false, "stage4_failure_learning_diagnostic_candidate_activated")
  assert(analysis.repairContract.applicationGate.readCheckpointNow === false && analysis.checkpointFileRead === false && analysis.checkpointLoaded === false, "stage4_failure_learning_checkpoint_boundary_open")
  assert(analysis.repairContract.applicationGate.startGpuNow === false && analysis.gpuUsed === false && analysis.gpuTrainingStarted === false, "stage4_failure_learning_gpu_boundary_open")
  assert(analysis.trainingConfigModified === false && analysis.modelWeightsModified === false && analysis.optimizerCreated === false, "stage4_failure_learning_mutation_boundary_open")
  assert(analysis.sourceEvidence.review.sha256 === REVIEW_SHA256 && analysis.sourceEvidence.manifest.sha256 === MANIFEST_SHA256 && analysis.sourceEvidence.activeConfig.sha256 === ACTIVE_CONFIG_SHA256 && analysis.sourceEvidence.terminal.sha256 === TERMINAL_SHA256 && analysis.sourceEvidence.finalization.sha256 === FINALIZATION_SHA256 && analysis.sourceEvidence.diagnosticReport.sha256 === DIAGNOSTIC_REPORT_SHA256 && analysis.sourceEvidence.diagnosticTerminal.sha256 === DIAGNOSTIC_TERMINAL_SHA256 && analysis.sourceEvidence.previousSixPreviewAnalysisTerminal.sha256 === PREVIOUS_ANALYSIS_TERMINAL_SHA256, "stage4_failure_learning_source_binding_invalid")
}

function validateCurrentSmokeTimelineAnalysis(analysis) {
  assert(analysis.schemaVersion === "local-ai-v7-r5-stage4-smoke-training-timeline-failure-analysis-v1", "stage4_failure_learning_analysis_schema_invalid")
  assert(analysis.status === "stage4_five_preview_post_training_17_metric_timeline_analyzed_read_only_proposal_ready", "stage4_failure_learning_analysis_status_invalid")
  assert(sameJson(analysis.timeline.map((row) => row.epoch), [1, 5, 10, 20, 30]), "stage4_failure_learning_analysis_timeline_invalid")
  assert(analysis.summary.failedPreviewCount === (DECISION_ANALYSIS_MODE ? 4 : 5) && analysis.summary.passedPreviewCount === (DECISION_ANALYSIS_MODE ? 1 : 0), "stage4_failure_learning_analysis_count_invalid")
  assert(analysis.issueClusters.every((cluster) => cluster.family !== "unclassified_machine_issue"), "stage4_failure_learning_unknown_issue_family")
  assert(analysis.diagnosticInterpretation?.status === "post_training_five_epoch_diagnostic_timeline_interpreted_read_only" && analysis.diagnosticInterpretation?.metricCount === 17 && analysis.diagnosticInterpretation?.epochCount === 5, "stage4_failure_learning_diagnostic_interpretation_invalid")
  assert(analysis.diagnosticInterpretation.sourceMutationContext.sourceWeightsChangedDuringExistingSmoke === true && analysis.diagnosticInterpretation.sourceMutationContext.analyzerChangesWeights === false && analysis.sourceWeightsRepresentedAsUnchangedDiagnostic === false, "stage4_failure_learning_source_weight_context_invalid")
  assert(analysis.diagnosticVisualDifferential?.status === "training_metric_and_fixed_preview_visual_review_domains_compared_read_only", "stage4_failure_learning_visual_differential_missing")
  if (DECISION_ANALYSIS_MODE) {
    assert(analysis.diagnosticVisualDifferential.finalEpoch === 30 && analysis.diagnosticVisualDifferential.route.visualCoverageReviewFailed === false && analysis.diagnosticVisualDifferential.route.visualRequiredWestBoundaryContactReviewFailed === false && analysis.diagnosticVisualDifferential.rock.heldoutVisualSemanticReviewFailed === false, "stage4_failure_learning_visual_differential_identity_invalid")
    assert(sameJson(issueEpochs(analysis, "condition_terrain_path_ground_coverage_mismatch"), [1]) && sameJson(issueEpochs(analysis, "condition_terrain_path_ground_required_boundary_contact_missing"), [1, 5]) && sameJson(issueEpochs(analysis, "condition_object_rock_reference_semantic_mismatch"), [1, 5, 10, 20]) && analysis.timeline.at(-1).passed === true && analysis.timeline.at(-1).issueCodes.length === 0, "stage4_failure_learning_mixed_visual_timeline_identity_invalid")
  } else {
    assert(analysis.diagnosticVisualDifferential.route.visualCoverageReviewFailed === true && analysis.diagnosticVisualDifferential.route.visualRequiredWestBoundaryContactReviewFailed === true && analysis.diagnosticVisualDifferential.rock.heldoutVisualSemanticReviewFailed === true, "stage4_failure_learning_visual_differential_identity_invalid")
  }
  assert(analysis.diagnosticVisualDifferential.thresholdsReinterpreted === false && analysis.diagnosticVisualDifferential.executionValuesSelected === false, "stage4_failure_learning_visual_differential_boundary_invalid")
  assert(analysis.repairContract.status === "owner_review_required_not_applied", "stage4_failure_learning_proposal_status_invalid")
  assert(analysis.repairContract.applicationGate.applyConfigurationNow === false && analysis.repairContract.configurationPatchProposal.selectedExecutionValues === false, "stage4_failure_learning_configuration_application_open")
  assert(analysis.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate?.status === "bounded_candidate_not_selected_not_applied" && analysis.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate.activationGate.applyConfigurationNow === false, "stage4_failure_learning_diagnostic_candidate_activated")
  assert(analysis.repairContract.applicationGate.readCheckpointNow === false && analysis.checkpointFileRead === false && analysis.checkpointLoaded === false, "stage4_failure_learning_checkpoint_boundary_open")
  assert(analysis.repairContract.applicationGate.startGpuNow === false && analysis.gpuUsed === false && analysis.gpuTrainingStarted === false, "stage4_failure_learning_gpu_boundary_open")
  assert(analysis.trainingConfigModified === false && analysis.modelWeightsModified === false && analysis.optimizerCreated === false && analysis.analyzerModifiedSourceWeights === false, "stage4_failure_learning_mutation_boundary_open")
  const compatibilityBindingValid = DECISION_ANALYSIS_MODE
    ? analysis.sourceEvidence.previousSuccessfulAnalysisPointer.sha256 === BASELINE_POINTER_SHA256 && analysis.sourceEvidence.previousSuccessfulAnalysisTerminal.sha256 === baselinePointer.terminalSha256 && analysis.sourceEvidence.previousSuccessfulAnalysis.sha256 === baselineTerminal.analysisSha256
    : analysis.sourceEvidence.previousCompatibilityTerminal.sha256 === PREVIOUS_ANALYSIS_TERMINAL_SHA256
  assert(analysis.sourceEvidence.review.sha256 === REVIEW_SHA256 && analysis.sourceEvidence.manifest.sha256 === MANIFEST_SHA256 && analysis.sourceEvidence.stepTelemetry.sha256 === STEP_TELEMETRY_SHA256 && analysis.sourceEvidence.terminal.sha256 === TERMINAL_SHA256 && analysis.sourceEvidence.finalization.sha256 === FINALIZATION_SHA256 && compatibilityBindingValid, "stage4_failure_learning_source_binding_invalid")
}

function enrichTimelineTimestamps(review, sourceManifest) {
  const copy = structuredClone(review)
  const metricByEpoch = new Map(sourceManifest.metrics.map((row) => [row.epoch, row]))
  for (const row of copy.reviews) {
    const metric = metricByEpoch.get(row.epoch)
    assert(metric, `stage4_failure_learning_manifest_epoch_missing:${row.epoch}`)
    row.recordedAtUtc = metric.recordedAtUtc
    row.recordedAtAsiaShanghai = metric.recordedAtAsiaShanghai
  }
  validateStage4SourceReview(copy)
  return copy
}

function legacyAnalyzerRegression() {
  const review = {
    status: "machine_reviews_failed_closed",
    reviews: [
      { epoch: 1, passed: false, recordedAtUtc: "2026-08-05T00:00:00Z", recordedAtAsiaShanghai: "2026-08-05T08:00:00+08:00", issueCodes: ["condition_object_rock_reference_semantic_mismatch"] },
      { epoch: 2, passed: true, recordedAtUtc: "2026-08-05T00:01:00Z", recordedAtAsiaShanghai: "2026-08-05T08:01:00+08:00", issueCodes: [] },
    ],
  }
  const result = analyzeFailureLearningLoop({ review, finalization: { status: "failed" }, overlay: { patch: { training: {} } }, sourcePaths: {}, proposedBoundedRepairVersion: "legacy-regression" })
  return result.schemaVersion === "local-ai-failure-learning-report-v1" && result.repairContract.schemaVersion === "local-ai-bounded-repair-contract-proposal-v1" && result.issueClusters[0].resolvedByFinal === true
}

function legacySixPreviewSyntheticRegression() {
  const epochs = [1, 5, 10, 20, 30, 40]
  const review = {
    status: "machine_reviews_failed_closed",
    reviews: epochs.map((epoch, index) => ({
      epoch,
      passed: false,
      recordedAtUtc: `2026-08-05T00:0${index}:00Z`,
      recordedAtAsiaShanghai: `2026-08-05T08:0${index}:00+08:00`,
      issueCodes: ["condition_object_rock_reference_semantic_mismatch"],
    })),
  }
  const result = analyzeFailureLearningLoop({
    review,
    finalization: { status: "failed", runId: "legacy-six-preview-regression" },
    overlay: { patch: { training: {} } },
    sourcePaths: {},
    proposedBoundedRepairVersion: "legacy-six-preview-regression",
    repairProfile: "stage4_progressive",
  })
  return result.timeline.length === 6 && result.diagnosticInterpretation === null && result.repairContract.schemaVersion === "local-ai-stage4-bounded-repair-contract-proposal-v1"
}

function legacyReadonlyDiagnosticSyntheticRegression(review) {
  const metrics = structuredClone(diagnosticReport.epochs.at(-1).metrics)
  const readonlyDiagnostic = {
    schemaVersion: "v7-r5-stage4-readonly-single-sample-gpu-diagnostic-report-v1",
    status: "read_only_single_sample_gpu_diagnostic_completed_weights_unchanged",
    diagnosticMetrics: metrics,
    integrity: {
      autoencoderStateSha256Before: "a".repeat(64),
      autoencoderStateSha256After: "a".repeat(64),
      denoiserStateSha256Before: "b".repeat(64),
      denoiserStateSha256After: "b".repeat(64),
      parameterGradientsAbsentAfterDiagnostic: true,
    },
    optimizerCreated: false,
    lossBackwardExecuted: false,
    modelWeightsModified: false,
    checkpointWritten: false,
    trainingStarted: false,
    fullTrainingStarted: false,
  }
  const result = analyzeFailureLearningLoop({
    review,
    finalization: { status: "failed", runId: "legacy-readonly-diagnostic-regression" },
    overlay: { patch: { training: {} } },
    sourcePaths: {},
    proposedBoundedRepairVersion: "legacy-readonly-diagnostic-regression",
    repairProfile: "stage4_progressive",
    diagnosticEvidence: readonlyDiagnostic,
  })
  return result.diagnosticInterpretation?.status === "single_sample_diagnostic_metrics_interpreted_read_only"
    && result.diagnosticInterpretation?.evidenceMode === undefined
    && result.diagnosticVisualDifferential === undefined
}

function stage4SixPreviewAnalyzerRegression(review, sourcePaths) {
  const result = analyzeFailureLearningLoop({
    review,
    finalization: { ...finalization, runId: SOURCE_RUN_ID },
    overlay: { patch: { training: activeConfig.training } },
    sourcePaths,
    proposedBoundedRepairVersion: "stage4-six-preview-compatibility-regression",
    repairProfile: "stage4_progressive",
  })
  return result.schemaVersion === "local-ai-failure-learning-report-v1"
    && result.timeline.length === 6
    && result.diagnosticInterpretation === null
    && result.repairContract.schemaVersion === "local-ai-stage4-bounded-repair-contract-proposal-v1"
    && result.repairContract.configurationPatchProposal.diagnosticEvidenceCandidate === null
}

function expectSourceRejected(review, mutate, expected) {
  const copy = structuredClone(review)
  mutate(copy)
  try { validateStage4SourceReview(copy) } catch (error) { assert(String(error.message).includes(expected), `unexpected_source_rejection:${error.message}`); return true }
  throw new Error(`expected_source_rejection:${expected}`)
}

function expectAnalysisRejected(analysis, mutate, expected) {
  const copy = structuredClone(analysis)
  mutate(copy)
  try { validateGeneratedAnalysis(copy) } catch (error) { assert(String(error.message).includes(expected), `unexpected_analysis_rejection:${error.message}`); return true }
  throw new Error(`expected_analysis_rejection:${expected}`)
}

function expectDiagnosticRejected(report, mutate, expected) {
  const copy = structuredClone(report)
  mutate(copy)
  try {
    analyzeFailureLearningLoop({
      review: enrichTimelineTimestamps(sourceReview, manifest),
      finalization: { ...finalization, runId: SOURCE_RUN_ID },
      overlay: { patch: { training: activeConfig.training } },
      sourcePaths: {},
      proposedBoundedRepairVersion: "diagnostic-negative-regression",
      repairProfile: "stage4_progressive",
      diagnosticEvidence: copy,
    })
  } catch (error) {
    assert(String(error.message).includes(expected), `unexpected_diagnostic_rejection:${error.message}`)
    return true
  }
  throw new Error(`expected_diagnostic_rejection:${expected}`)
}

function runStage4ArchitectureDesignConvergence({ preflightOnly }) {
  const authorizationIndex = process.argv.indexOf("--authorization")
  const authorizationPath = authorizationIndex >= 0 ? process.argv[authorizationIndex + 1] : null
  assert(authorizationPath, "stage4_architecture_design_authorization_argument_required")
  const authorizationSha256 = sha256File(authorizationPath)
  const authorization = readJson(authorizationPath)

  const isParentImplementationAuthorization = authorization.schemaVersion === "owner-authorized-r5-stage4-architecture-design-convergence-input-v1"
  if (preflightOnly) {
    assert(isParentImplementationAuthorization, "stage4_architecture_design_preflight_parent_authorization_invalid")
    validateArchitectureDesignParentAuthorization(authorization, authorizationPath, authorizationSha256)
  } else {
    assert(authorization.schemaVersion === "project-owner-action-request-v1", "stage4_architecture_design_execution_authorization_schema_invalid")
    validateArchitectureDesignExecutionAuthorization(authorization, authorizationPath, authorizationSha256)
  }

  const identity = isParentImplementationAuthorization ? {
    architectureDecisionTerminalPath: authorization.boundArchitectureDecisionTerminal.path,
    architectureDecisionTerminalSha256: authorization.boundArchitectureDecisionTerminal.sha256,
    architectureUpgradeProposalPath: authorization.boundArchitectureUpgradeProposal.path,
    architectureUpgradeProposalSha256: authorization.boundArchitectureUpgradeProposal.sha256,
  } : authorization.taskIdentity
  const architectureDecisionTerminal = readJson(identity.architectureDecisionTerminalPath)
  const architectureUpgradeProposal = readJson(identity.architectureUpgradeProposalPath)
  const sourceBindings = {
    architectureDecisionTerminal: {
      path: identity.architectureDecisionTerminalPath,
      sha256: identity.architectureDecisionTerminalSha256,
      actualSha256: sha256File(identity.architectureDecisionTerminalPath),
    },
    architectureUpgradeProposal: {
      path: identity.architectureUpgradeProposalPath,
      sha256: identity.architectureUpgradeProposalSha256,
      actualSha256: sha256File(identity.architectureUpgradeProposalPath),
    },
  }
  const regression = runStage4ArchitectureDesignContractRegression({
    architectureDecisionTerminal,
    architectureUpgradeProposal,
    sourceBindings,
  })
  assert(regression.failedPositiveKeys.length === 0, `stage4_architecture_design_positive_regression_failed:${regression.failedPositiveKeys.join(",")}`)
  assert(regression.failedNegativeKeys.length === 0, `stage4_architecture_design_negative_regression_failed:${regression.failedNegativeKeys.join(",")}`)

  if (preflightOnly) {
    return {
      schemaVersion: "local-ai-v7-r5-stage4-architecture-design-convergence-cpu-preflight-v1",
      status: "stage4_architecture_design_convergence_cpu_preflight_passed_no_formal_writes",
      positiveAssertionsPassed: Object.values(regression.positive).filter(Boolean).length,
      negativeAssertionsPassed: Object.values(regression.negative).filter(Boolean).length,
      formalRunDirectoryCreated: false,
      formalAuthorizationConsumed: false,
      checkpointRead: false,
      gpuUsed: false,
      trainingStarted: false,
    }
  }

  const outputRoot = resolve(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-architecture-design-convergence")
  const runId = identity.outputRunId
  const runDirectory = path.join(outputRoot, runId)
  const latestPath = path.join(outputRoot, "latest.json")
  assert(typeof runId === "string" && runId.startsWith("local-ai-v7-r5-stage4-architecture-design-convergence-"), "stage4_architecture_design_output_run_id_invalid")
  assert(!fs.existsSync(runDirectory), "stage4_architecture_design_run_already_exists")
  assert(!fs.existsSync(latestPath), "stage4_architecture_design_latest_already_exists")

  const report = compileStage4ArchitectureDesignConvergence({
    architectureDecisionTerminal,
    architectureUpgradeProposal,
    sourceBindings,
  })
  report.runId = runId
  report.recordedAtUtc = new Date().toISOString()
  report.recordedAtAsiaShanghai = formatShanghai(report.recordedAtUtc)
  report.evidenceBindings = sourceBindings
  report.sourceCodeBindings = {
    trainer: { path: identity.frozenTrainerPath, sha256: identity.frozenTrainerSha256 },
    model: { path: identity.frozenModelPath, sha256: identity.frozenModelSha256 },
    formalSpecification: { path: identity.formalSpecificationPath, sha256: identity.formalSpecificationSha256 },
  }
  validateStage4ArchitectureDesignConvergence(report)
  const contract = buildStage4InactiveArchitectureImplementationContract(report)
  const ownerRequestPreview = buildStage4ArchitectureOwnerActionRequestPreview(report, contract)

  const reportPath = path.join(runDirectory, "architecture-design-report.json")
  const contractPath = path.join(runDirectory, "inactive-architecture-implementation-contract.json")
  const ownerRequestPath = path.join(runDirectory, "owner-action-request-preview.json")
  const regressionPath = path.join(runDirectory, "cpu-positive-negative-regression.json")
  const capsulePath = path.join(runDirectory, "local-task-capsule.json")
  const terminalPath = path.join(runDirectory, "phase-terminal.json")
  writeImmutableJson(reportPath, report)
  writeImmutableJson(contractPath, contract)
  writeImmutableJson(ownerRequestPath, ownerRequestPreview)
  writeImmutableJson(regressionPath, {
    schemaVersion: regression.schemaVersion,
    status: "stage4_architecture_design_convergence_cpu_positive_negative_regression_passed",
    positive: regression.positive,
    negative: regression.negative,
    failedPositiveKeys: regression.failedPositiveKeys,
    failedNegativeKeys: regression.failedNegativeKeys,
    positiveAssertionsPassed: Object.values(regression.positive).filter(Boolean).length,
    negativeAssertionsPassed: Object.values(regression.negative).filter(Boolean).length,
    checkpointRead: false,
    gpuUsed: false,
    trainingStarted: false,
  })
  const capsule = buildArchitectureDesignTaskCapsule({
    runId,
    reportPath,
    contractPath,
    ownerRequestPath,
    regressionPath,
    sourceBindings,
  })
  writeImmutableJson(capsulePath, capsule)
  const terminal = {
    schemaVersion: "local-ai-v7-r5-stage4-architecture-design-convergence-terminal-v1",
    status: "r5_stage4_architecture_design_convergence_completed_closed",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    currentStage: 4,
    selectedOutcome: report.outcome.decision,
    recommendedDirectionId: report.outcome.recommendedDirectionId,
    recommendedContractId: report.outcome.recommendedContractId,
    exitCurrentCandidateRoute: report.outcome.exitCurrentCandidateRoute,
    architectureDesignReportPath: projectPath(reportPath),
    architectureDesignReportSha256: sha256File(reportPath),
    inactiveImplementationContractPath: projectPath(contractPath),
    inactiveImplementationContractSha256: sha256File(contractPath),
    ownerActionRequestPreviewPath: projectPath(ownerRequestPath),
    ownerActionRequestPreviewSha256: sha256File(ownerRequestPath),
    cpuRegressionPath: projectPath(regressionPath),
    cpuRegressionSha256: sha256File(regressionPath),
    localTaskCapsulePath: projectPath(capsulePath),
    localTaskCapsuleSha256: sha256File(capsulePath),
    hyperparameterCandidateGenerated: false,
    implementationActivated: false,
    trainingConfigModified: false,
    checkpointRead: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    backwardExecuted: false,
    modelWeightsModified: false,
    reviewThresholdsModified: false,
    gpuUsed: false,
    trainingStarted: false,
    automaticRetryStarted: false,
    nextIndependentAuthorization: "owner_may_authorize_bounded_stage4_decoded_domain_alignment_bridge_implementation_only",
  }
  writeImmutableJson(terminalPath, terminal)
  writeImmutableJson(latestPath, {
    schemaVersion: "local-ai-v7-r5-stage4-architecture-design-convergence-pointer-v1",
    runId,
    terminalPath: projectPath(terminalPath),
    terminalSha256: sha256File(terminalPath),
  })
  appendAiPainterProgramEvent({
    action: "run_local_ai_v7_r5_stage4_architecture_design_convergence",
    runId,
    kind: "r5_stage4_architecture_design_convergence_completed",
    status: "success",
    title: "R5 Stage4 architecture design convergence completed",
    titleZh: "R5第4阶段架构设计收敛已闭环",
    detail: `recommended=${report.outcome.recommendedDirectionId}; inactive=true; checkpoint=false; gpu=false; training=false`,
    detailZh: `推荐方向=${report.outcome.recommendedDirectionId}；未激活；未读取Checkpoint；未使用GPU或训练`,
    script: "scripts/run-local-ai-v7-r5-stage4-failure-learning.mjs",
    currentStep: "architecture_design_convergence_completed",
    evidencePath: projectPath(terminalPath),
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
  return { ...terminal, terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }
}

function validateArchitectureDesignParentAuthorization(authorization, authorizationPath, authorizationSha256) {
  assert(authorization.status === "resolved_owner_authorized", "stage4_architecture_design_parent_authorization_not_resolved")
  assert(authorization.commandRef === "owner-authorized-r5-stage4-architecture-design-convergence-20260808", "stage4_architecture_design_parent_command_invalid")
  assert(authorization.scope === "add_cpu_readonly_architecture_design_convergence_mode_regress_then_one_formal_readonly_design", "stage4_architecture_design_parent_scope_invalid")
  assert(fileHashMatches(authorizationPath, authorizationSha256), "stage4_architecture_design_parent_hash_invalid")
  const implementationConsumptionPath = ".runtime/ai-painter/owner-action-requests/owner-authorized-r5-stage4-architecture-design-convergence-20260808/implementation-authorization-consumption.json"
  const consumption = readJson(implementationConsumptionPath)
  assert(consumption.status === "implementation_scope_consumed_before_authorized_write_formal_design_scope_not_consumed", "stage4_architecture_design_implementation_not_consumed")
  assert(consumption.authorizationSha256 === authorizationSha256, "stage4_architecture_design_implementation_consumption_binding_invalid")
  assert(fileHashMatches(authorization.boundArchitectureDecisionTerminal.path, authorization.boundArchitectureDecisionTerminal.sha256), "stage4_architecture_design_bound_terminal_changed")
  assert(fileHashMatches(authorization.boundArchitectureUpgradeProposal.path, authorization.boundArchitectureUpgradeProposal.sha256), "stage4_architecture_design_bound_proposal_changed")
  const frozen = authorization.implementationIdentity
  for (const [pathKey, shaKey] of [
    ["frozenAnalyzerPath", "frozenAnalyzerSha256"],
    ["frozenSmokeRunnerPath", "frozenSmokeRunnerSha256"],
    ["frozenTrainerPath", "frozenTrainerSha256"],
    ["frozenModelPath", "frozenModelSha256"],
    ["formalSpecificationPath", "formalSpecificationSha256"],
  ]) assert(fileHashMatches(frozen[pathKey], frozen[shaKey]), `stage4_architecture_design_frozen_source_changed:${pathKey}`)
}

function validateArchitectureDesignExecutionAuthorization(authorization, authorizationPath, authorizationSha256) {
  assert(authorization.status === "resolved_owner_authorized", "stage4_architecture_design_execution_authorization_not_resolved")
  assert(authorization.ownerDecision?.commandRef === "owner-authorized-r5-stage4-architecture-design-convergence-20260808", "stage4_architecture_design_execution_command_invalid")
  assert(authorization.ownerDecision?.scope === "one_cpu_readonly_stage4_architecture_design_convergence_after_passed_regression", "stage4_architecture_design_execution_scope_invalid")
  assert(fileHashMatches(authorizationPath, authorizationSha256), "stage4_architecture_design_execution_authorization_hash_invalid")
  const parent = authorization.parentAuthorization
  assert(fileHashMatches(parent.path, parent.sha256), "stage4_architecture_design_parent_authorization_changed")
  const implementation = authorization.implementationConsumption
  assert(fileHashMatches(implementation.path, implementation.sha256), "stage4_architecture_design_implementation_consumption_changed")
  const regression = authorization.passedImplementationCpuRegression
  assert(fileHashMatches(regression.path, regression.sha256), "stage4_architecture_design_cpu_regression_changed")
  assert(regression.failedPositiveKeys.length === 0 && regression.failedNegativeKeys.length === 0, "stage4_architecture_design_cpu_regression_not_passed")
  const identity = authorization.taskIdentity
  for (const [pathKey, shaKey] of [
    ["architectureDecisionTerminalPath", "architectureDecisionTerminalSha256"],
    ["architectureUpgradeProposalPath", "architectureUpgradeProposalSha256"],
    ["runnerPath", "runnerSha256"],
    ["cpuCheckerPath", "cpuCheckerSha256"],
    ["decisionHelperPath", "decisionHelperSha256"],
    ["frozenAnalyzerPath", "frozenAnalyzerSha256"],
    ["frozenSmokeRunnerPath", "frozenSmokeRunnerSha256"],
    ["frozenTrainerPath", "frozenTrainerSha256"],
    ["frozenModelPath", "frozenModelSha256"],
    ["formalSpecificationPath", "formalSpecificationSha256"],
  ]) assert(fileHashMatches(identity[pathKey], identity[shaKey]), `stage4_architecture_design_execution_binding_changed:${pathKey}`)
  const consumptionPath = projectPath(path.join(path.dirname(resolve(authorizationPath)), "architecture-design-execution-consumption.json"))
  const consumption = readJson(consumptionPath)
  assert(consumption.status === "consumed_before_single_cpu_readonly_architecture_design", "stage4_architecture_design_execution_not_consumed")
  assert(consumption.authorizationSha256 === authorizationSha256, "stage4_architecture_design_execution_consumption_binding_invalid")
  assert(consumption.allowedReadonlyDesignCount === 1 && consumption.automaticRetryAuthorized === false, "stage4_architecture_design_execution_count_invalid")
  for (const key of [
    "architectureDesignReadOnlyExecutionAuthorized",
    "architectureDesignEvidenceWriteAuthorized",
    "inactiveImplementationContractWriteAuthorized",
    "ownerActionRequestPreviewWriteAuthorized",
    "localTaskCapsuleWriteAuthorized",
    "uniquePlanSyncAuthorized",
  ]) assert(authorization.resolution?.[key] === true, `stage4_architecture_design_${key}_missing`)
  for (const key of [
    "trainerModificationAuthorized",
    "smokeRunnerModificationAuthorized",
    "trainingConfigModificationAuthorized",
    "checkpointReadAuthorized",
    "checkpointLoadAuthorized",
    "optimizerCreationAuthorized",
    "backwardExecutionAuthorized",
    "modelWeightModificationAuthorized",
    "reviewThresholdModificationAuthorized",
    "hyperparameterCandidateGenerationAuthorized",
    "gpuUseAuthorized",
    "trainingAuthorized",
    "validationAuthorized",
    "formalInferenceAuthorized",
    "checkpointPromotionAuthorized",
    "runtimeFrameAuthorized",
    "worldEntryAuthorized",
    "automaticRetryAuthorized",
  ]) assert(authorization.resolution?.[key] === false, `stage4_architecture_design_boundary_${key}_invalid`)
}

function buildArchitectureDesignTaskCapsule({ runId, reportPath, contractPath, ownerRequestPath, regressionPath, sourceBindings }) {
  return {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `ai-painter-r5-stage4-architecture-design-convergence-${runId}`,
    generatedAtUtc: new Date().toISOString(),
    generatedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-v7-failure-learning-r5", nameZh: "AI Painter V7失败学习与R5隔离候选" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "unique_module_plan" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→1→2完整训练", status: "in_progress_architecture_design_converged_implementation_not_authorized" },
    candidateTerminal: {
      runId,
      status: "architecture_design_convergence_completed_closed",
      recommendedDirectionId: "condition_to_decoded_visual_domain_consistency",
      recommendedContractId: "stage4_decoded_domain_alignment_bridge_v1",
      implementationActivated: false,
      hyperparameterCandidateGenerated: false,
    },
    latestBlocker: {
      code: "bounded_architecture_implementation_requires_new_owner_authorization",
      summaryZh: "三个架构方向已收敛为一个未激活的解码视觉域对齐桥接合同；尚未授权修改模型、训练器、配置或执行GPU。",
    },
    nextAllowedAction: {
      code: "owner_may_authorize_bounded_stage4_decoded_domain_alignment_bridge_implementation_only",
      labelZh: "Owner可单独授权实现新的V8解码域对齐架构分支、训练器支持、未激活配置和CPU合同，不包含Checkpoint或GPU执行。",
      ownerAuthorizationRequired: true,
      automaticExecutionAllowed: false,
      gpuAllowed: false,
      trainingAllowed: false,
    },
    forbiddenActions: [
      "automatic_retry",
      "continue_parameter_repair_from_same_evidence",
      "generate_hyperparameter_candidate",
      "activate_architecture_contract_without_owner_authorization",
      "read_or_load_checkpoint",
      "start_gpu_or_training",
      "start_stage4_full_training",
      "start_stage5_strict_revalidation",
      "formal_inference",
      "checkpoint_formal_promotion",
      "runtime_frame",
      "world_entry",
    ],
    evidence: [
      { kind: "architecture-decision-terminal", path: sourceBindings.architectureDecisionTerminal.path, sha256: sourceBindings.architectureDecisionTerminal.sha256 },
      { kind: "architecture-upgrade-proposal", path: sourceBindings.architectureUpgradeProposal.path, sha256: sourceBindings.architectureUpgradeProposal.sha256 },
      { kind: "architecture-design-report", path: projectPath(reportPath), sha256: sha256File(reportPath) },
      { kind: "inactive-architecture-implementation-contract", path: projectPath(contractPath), sha256: sha256File(contractPath) },
      { kind: "owner-action-request-preview", path: projectPath(ownerRequestPath), sha256: sha256File(ownerRequestPath) },
      { kind: "cpu-positive-negative-regression", path: projectPath(regressionPath), sha256: sha256File(regressionPath) },
    ],
    integrity: {
      status: "verified",
      failedPreviewPixelsUsedAsTrainingTargets: false,
      reviewThresholdsUsedAsTrainingTargets: false,
      hyperparameterCandidateGenerated: false,
      trainingConfigModified: false,
      checkpointRead: false,
      gpuUsed: false,
      trainingStarted: false,
    },
  }
}

function verifySourcesUnchanged() {
  const bindings = DECISION_ANALYSIS_MODE
    ? [[REVIEW_PATH, REVIEW_SHA256], [MANIFEST_PATH, MANIFEST_SHA256], [STEP_TELEMETRY_PATH, STEP_TELEMETRY_SHA256], [TERMINAL_PATH, TERMINAL_SHA256], [FINALIZATION_PATH, FINALIZATION_SHA256], [BASELINE_POINTER_PATH, BASELINE_POINTER_SHA256], [baselinePointer.terminalPath, baselinePointer.terminalSha256], [baselineTerminal.analysisPath, baselineTerminal.analysisSha256]]
    : CURRENT_SMOKE_TIMELINE_MODE
      ? [[REVIEW_PATH, REVIEW_SHA256], [MANIFEST_PATH, MANIFEST_SHA256], [STEP_TELEMETRY_PATH, STEP_TELEMETRY_SHA256], [TERMINAL_PATH, TERMINAL_SHA256], [FINALIZATION_PATH, FINALIZATION_SHA256], [PREVIOUS_ANALYSIS_TERMINAL_PATH, PREVIOUS_ANALYSIS_TERMINAL_SHA256]]
    : [[REVIEW_PATH, REVIEW_SHA256], [MANIFEST_PATH, MANIFEST_SHA256], [ACTIVE_CONFIG_PATH, ACTIVE_CONFIG_SHA256], [TERMINAL_PATH, TERMINAL_SHA256], [FINALIZATION_PATH, FINALIZATION_SHA256], [DIAGNOSTIC_REPORT_PATH, DIAGNOSTIC_REPORT_SHA256], [DIAGNOSTIC_TERMINAL_PATH, DIAGNOSTIC_TERMINAL_SHA256], [PREVIOUS_ANALYSIS_TERMINAL_PATH, PREVIOUS_ANALYSIS_TERMINAL_SHA256]]
  for (const [value, expected] of bindings) {
    assert(fileHashMatches(value, expected), `source_evidence_changed:${value}`)
  }
}

function hasRoot(analysis, id) { return analysis.rootCauseCandidates.some((candidate) => candidate.id === id) }
function issueEpochs(analysis, code) { return analysis.timeline.filter((row) => row.issueCodes.includes(code)).map((row) => row.epoch) }
function appendEvent(kind, status, detail, evidencePath = null) { appendAiPainterProgramEvent({ action: "run_local_ai_v7_r5_stage4_failure_learning", runId, kind, status, title: kind.replaceAll("_", " "), titleZh: `本地AI V7 R5第4阶段失败学习：${kind}`, detail, detailZh: detail, script: "scripts/run-local-ai-v7-r5-stage4-failure-learning.mjs", currentStep: kind, evidencePath, finalGameMapSuccess: false, canEnterWorld: false }) }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function writeImmutableJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return fs.existsSync(absolute) && sha256File(absolute) === expected }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function assert(condition, message) { if (!condition) throw new Error(message) }
