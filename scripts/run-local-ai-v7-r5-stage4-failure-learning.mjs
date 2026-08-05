import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { analyzeFailureLearningLoop } from "./lib/ai-assisted-failure-learning-loop.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-action-request-v7-r5-stage4-diagnostic-evidence-failure-analysis-20260805"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "f52c0c0aeaebffc11073a424f0eca6b796086fc02a007657cd1dc6e5e2ef0e06"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "350414d0e73194ae207f52e959edb4de728c8f2f68644e762fe01073805f7da1"
const COMMAND_REF = "owner-authorized-v7-r5-stage4-diagnostic-evidence-failure-analysis-20260805"
const SCOPE = "extend_stage4_local_failure_analyzer_for_bound_17_metric_diagnostic_cpu_regression_and_single_read_only_inactive_repair_proposal"
const SOURCE_RUN_ID = "ai-assisted-v7-r5-stage4-full-training-2026-08-05T10-21-08-137Z"
const SOURCE_STAGE_INDEX = 0
const SOURCE_ROOT = `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/${SOURCE_RUN_ID}-stage-0`
const REVIEW_PATH = `${SOURCE_ROOT}/fixed-preview-reviews.json`
const REVIEW_SHA256 = "6181e50f07392049286cf49bda68199a718e6c2b67790a6a781fc75569d8622b"
const MANIFEST_PATH = `${SOURCE_ROOT}/manifest.json`
const MANIFEST_SHA256 = "2dfcfd016734ef7d88e33d6f75b23b9d043df7d075b280827b304e1c89ede5ef"
const ACTIVE_CONFIG_PATH = `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/chains/${SOURCE_RUN_ID}/active-config.json`
const ACTIVE_CONFIG_SHA256 = "7a5f66356d8b57a5e927487f20c4807b005b99615f9fc0f76e84e593de3e1583"
const TERMINAL_PATH = `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/chains/${SOURCE_RUN_ID}/stage4-terminal.json`
const TERMINAL_SHA256 = "68ee2b06a01db53740303da9e61d21ae8f6c0f426478ef3c08554a410b3c702f"
const FINALIZATION_PATH = `.runtime/ai-painter/v7-r5-stage4-full-training-finalizations/${SOURCE_RUN_ID}-finalization/finalization-report.json`
const FINALIZATION_SHA256 = "f837c93694ca2064bfcbdb70fae9dba118a776ab50b40270d63677367c4d5611"
const DIAGNOSTIC_ROOT = ".runtime/ai-painter/v7-r5-stage4-readonly-diagnostic-object-metric-prefix-final-gpu-smokes/ai-assisted-v7-r5-stage4-readonly-diagnostic-object-metric-prefix-final-gpu-smoke-2026-08-05T13-27-00-000Z"
const DIAGNOSTIC_REPORT_PATH = `${DIAGNOSTIC_ROOT}/diagnostic-report.json`
const DIAGNOSTIC_REPORT_SHA256 = "67a288142eca980200a60ab998359323dda3aa5dc4b5f5381b92eccecc56ffda"
const DIAGNOSTIC_TERMINAL_PATH = `${DIAGNOSTIC_ROOT}/phase-terminal.json`
const DIAGNOSTIC_TERMINAL_SHA256 = "6f4f6e83935295efbf46e018c4f407a75c5dad022bddd48116c3fc68ece5291e"
const PREVIOUS_ANALYSIS_TERMINAL_PATH = ".runtime/ai-painter/local-ai-failure-learning-r5-stage4/local-ai-v7-r5-stage4-failure-learning-2026-08-05T10-52-29-779Z/phase-terminal.json"
const PREVIOUS_ANALYSIS_TERMINAL_SHA256 = "1b7ad85c7828416e23c8b58bc16e511b6af523147973092747873ee80941a790"
const ANALYZER_PATH = "scripts/lib/ai-assisted-failure-learning-loop.mjs"
const ANALYZER_SHA256 = "091826359a4cba3debb3d905fc9a3c0ba4828bda75b9b5111b9828fce8edbc9f"
const EXPECTED_EPOCHS = [1, 5, 10, 20, 30, 40]
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
const runId = `local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-${now.replace(/[:.]/g, "-")}`
const outputRoot = resolve(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-diagnostic-evidence")
const runDir = path.join(outputRoot, runId)
const analysisPath = path.join(runDir, "failure-analysis.json")
const proposalPath = path.join(runDir, "read-only-repair-proposal.json")
const regressionPath = path.join(runDir, "cpu-positive-negative-regression.json")
const terminalPath = path.join(runDir, "phase-terminal.json")

const authorization = readJson(AUTHORIZATION_PATH)
const consumption = readJson(CONSUMPTION_PATH)
const sourceReview = readJson(REVIEW_PATH)
const manifest = readJson(MANIFEST_PATH)
const activeConfig = readJson(ACTIVE_CONFIG_PATH)
const sourceTerminal = readJson(TERMINAL_PATH)
const finalization = readJson(FINALIZATION_PATH)
const diagnosticReport = readJson(DIAGNOSTIC_REPORT_PATH)
const diagnosticTerminal = readJson(DIAGNOSTIC_TERMINAL_PATH)
const previousAnalysisTerminal = readJson(PREVIOUS_ANALYSIS_TERMINAL_PATH)

const runDirectoryAlreadyExisted = fs.existsSync(runDir)
fs.mkdirSync(runDir, { recursive: true })
try {
  validatePreflight(runDirectoryAlreadyExisted)
  appendEvent("r5_stage4_diagnostic_evidence_failure_analysis_started", "running", "CPU-only regression then one read-only interpretation of six previews plus bound 17-metric diagnostic report; checkpoint file read=false; GPU=false")
  const review = enrichTimelineTimestamps(sourceReview, manifest)
  const sourcePaths = {
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
  const regression = runCpuRegression({ review, analysis: regressionFixture, sourcePaths })
  assert(Object.values(regression.positive).every(Boolean), "stage4_failure_learning_positive_regression_failed")
  assert(Object.values(regression.negative).every(Boolean), "stage4_failure_learning_negative_regression_failed")
  verifySourcesUnchanged()
  writeImmutableJson(regressionPath, regression)

  const analysis = compileStage4Analysis({ review, sourcePaths, report: diagnosticReport })
  validateGeneratedAnalysis(analysis)
  verifySourcesUnchanged()
  writeImmutableJson(analysisPath, analysis)
  writeImmutableJson(proposalPath, analysis.repairContract)
  const terminal = {
    schemaVersion: "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-terminal-v1",
    status: "r5_stage4_six_previews_and_17_diagnostic_metrics_analyzed_read_only_proposal_closed",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    sourceRunId: SOURCE_RUN_ID,
    sourceStageIndex: SOURCE_STAGE_INDEX,
    diagnosticReportPath: DIAGNOSTIC_REPORT_PATH,
    diagnosticReportSha256: DIAGNOSTIC_REPORT_SHA256,
    diagnosticMetricCount: analysis.diagnosticInterpretation.metricCount,
    analysisPath: projectPath(analysisPath),
    analysisSha256: sha256File(analysisPath),
    proposalPath: projectPath(proposalPath),
    proposalSha256: sha256File(proposalPath),
    regressionPath: projectPath(regressionPath),
    regressionSha256: sha256File(regressionPath),
    sourceEvidenceModified: false,
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
    nextIndependentAuthorization: "owner_review_of_stage4_diagnostic_evidence_bounded_inactive_repair_proposal_only",
  }
  writeImmutableJson(terminalPath, terminal)
  writeImmutableJson(path.join(outputRoot, "latest.json"), {
    schemaVersion: "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-pointer-v1",
    runId,
    terminalPath: projectPath(terminalPath),
    terminalSha256: sha256File(terminalPath),
  })
  appendEvent("r5_stage4_diagnostic_evidence_failure_analysis_completed", "success", "CPU regression passed; six previews and 17 metrics interpreted; bounded proposal inactive; checkpoint=false; GPU=false", projectPath(terminalPath))
  console.log(JSON.stringify({ ...terminal, terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }, null, 2))
} catch (error) {
  const terminal = {
    schemaVersion: "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-terminal-v1",
    status: "r5_stage4_diagnostic_evidence_failure_analysis_failed_closed",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    blockers: [String(error?.message ?? error)],
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
  if (!fs.existsSync(terminalPath)) writeImmutableJson(terminalPath, terminal)
  appendEvent("r5_stage4_diagnostic_evidence_failure_analysis_failed", "failed", terminal.blockers.join(","), projectPath(terminalPath))
  console.error(JSON.stringify(terminal, null, 2))
  process.exitCode = 1
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
    schemaVersion: "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-v1",
    status: "stage4_six_preview_failures_and_17_diagnostic_metrics_analyzed_read_only_proposal_ready",
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

function runCpuRegression({ review, analysis, sourcePaths }) {
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
  return {
    schemaVersion: "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-cpu-regression-v1",
    status: "passed_cpu_only_six_preview_compatibility_and_17_metric_read_only_analysis_proposal_inactive",
    device: "cpu",
    generatedAtUtc: new Date().toISOString(),
    generatedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    sourcePaths,
    positive,
    negative,
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

function validatePreflight(runDirectoryAlreadyExisted) {
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

function validateStage4SourceReview(review) {
  assert(review.status === "machine_reviews_failed_closed", "stage4_failure_learning_review_status_invalid")
  assert(sameJson(review.reviews.map((row) => row.epoch), EXPECTED_EPOCHS), "stage4_failure_learning_epoch_identity_invalid")
  assert(review.reviews.every((row) => row.passed === false), "stage4_failure_learning_source_not_all_failed")
  for (const row of review.reviews) {
    assert(typeof row.recordedAtUtc === "string" && typeof row.recordedAtAsiaShanghai === "string", "stage4_failure_learning_epoch_timestamp_missing")
    for (const code of row.issueCodes) assert(KNOWN_STAGE4_ISSUES.has(code), `stage4_failure_learning_unknown_issue:${code}`)
  }
}

function validateGeneratedAnalysis(analysis) {
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

function verifySourcesUnchanged() {
  for (const [value, expected] of [[REVIEW_PATH, REVIEW_SHA256], [MANIFEST_PATH, MANIFEST_SHA256], [ACTIVE_CONFIG_PATH, ACTIVE_CONFIG_SHA256], [TERMINAL_PATH, TERMINAL_SHA256], [FINALIZATION_PATH, FINALIZATION_SHA256], [DIAGNOSTIC_REPORT_PATH, DIAGNOSTIC_REPORT_SHA256], [DIAGNOSTIC_TERMINAL_PATH, DIAGNOSTIC_TERMINAL_SHA256], [PREVIOUS_ANALYSIS_TERMINAL_PATH, PREVIOUS_ANALYSIS_TERMINAL_SHA256]]) {
    assert(fileHashMatches(value, expected), `source_evidence_changed:${value}`)
  }
}

function hasRoot(analysis, id) { return analysis.rootCauseCandidates.some((candidate) => candidate.id === id) }
function appendEvent(kind, status, detail, evidencePath = null) { appendAiPainterProgramEvent({ action: "run_local_ai_v7_r5_stage4_failure_learning", runId, kind, status, title: kind.replaceAll("_", " "), titleZh: `本地AI V7 R5第4阶段失败学习：${kind}`, detail, detailZh: detail, script: "scripts/run-local-ai-v7-r5-stage4-failure-learning.mjs", currentStep: kind, evidencePath, finalGameMapSuccess: false, canEnterWorld: false }) }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function writeImmutableJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return fs.existsSync(absolute) && sha256File(absolute) === expected }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function assert(condition, message) { if (!condition) throw new Error(message) }
