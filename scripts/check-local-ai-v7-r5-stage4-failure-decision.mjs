import assert from "node:assert/strict"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { analyzeFailureLearningLoop } from "./lib/ai-assisted-failure-learning-loop.mjs"
import {
  classifyStage4FailureDecision,
  runStage4ArchitectureDesignContractRegression,
  runStage4DecisionContractRegression,
} from "./lib/ai-assisted-v7-r5-stage4-failure-decision.mjs"

const root = process.cwd()
if (process.argv.includes("--architecture-design-convergence")) {
  runArchitectureDesignConvergenceCpuRegression()
  process.exit(0)
}
const runnerPath = "scripts/run-local-ai-v7-r5-stage4-failure-learning.mjs"
const analyzerPath = "scripts/lib/ai-assisted-failure-learning-loop.mjs"
const decisionHelperPath = "scripts/lib/ai-assisted-v7-r5-stage4-failure-decision.mjs"
const oldPointerPath = ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-decision-analysis/latest.json"
const decisionOutputRoot = ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-architecture-upgrade"
const decisionOutputRunId = "local-ai-v7-r5-stage4-architecture-upgrade-decision-20260808-195022696"
const decisionOutputRunPath = `${decisionOutputRoot}/${decisionOutputRunId}`
const decisionLatestPath = `${decisionOutputRoot}/latest.json`
const realStartupPreflightAuthorizationPath = ".runtime/ai-painter/owner-action-requests/owner-action-request-r5-stage4-architecture-upgrade-cpu-preflight-20260808-195022696/request.json"
const sourceRunId = "ai-assisted-v7-r5-stage4-structured-stability-smoke-20260808-183823230"
const sourceRoot = `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4-bounded-repair-smoke/${sourceRunId}`
const finalizationRoot = `.runtime/ai-painter/v7-r5-stage4-bounded-repair-smoke-finalizations/${sourceRunId}-finalization`
const reviewPath = `${sourceRoot}/fixed-preview-reviews.json`
const manifestPath = `${sourceRoot}/manifest.json`
const stepTelemetryPath = `${sourceRoot}/stage4-step-telemetry.json`
const terminalPath = `${finalizationRoot}/phase-terminal.json`
const finalizationPath = `${finalizationRoot}/finalization-report.json`
const previousCrossDomainReviewPath = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4-bounded-repair-smoke/ai-assisted-v7-r5-stage4-cross-domain-visual-consistency-smoke-20260808-154822808/fixed-preview-reviews.json"
const bindings = [
  [analyzerPath, "53f9b0735b92b2f707bc03189a984b0506406c39fd93edc937abd49fac7c7f9f"],
  [decisionHelperPath, "10971ef3029b687cd288a330646960146d27291fd37c6079f88cf7bfb664d186"],
  [oldPointerPath, "5726da387c3908a22deeec95fe42e85483da1b8818c2275692ca24f61b56029a"],
  [reviewPath, "5777f7461bf443cc363fab67fe816e2f5e7eee6ceb07a19743c43641e78cc08e"],
  [manifestPath, "d7560fff8ca39f05ea135f4fc54565596026c5db91b2a0126182d11b21c3d32a"],
  [stepTelemetryPath, "8ab302600c161edb39802ca14d0601499d9365ade9e564846cd757603cfeeaa5"],
  [terminalPath, "84d8db4a748caa7bd9e969da189fefffeb10f1a612239ed5e6d23b529afe2461"],
  [finalizationPath, "3502f0688f078f0b3e846dce60df15b5c1044f03881d0d4ed9e33ef73198f33c"],
  [previousCrossDomainReviewPath, "46a383d92c45539547eff6a0c95eccbebcde717795c03b923db5c6338ba04d4a"],
]

for (const [value, expected] of bindings) assert.equal(sha256(value), expected, `bound_hash_mismatch:${value}`)
const runnerSource = readText(runnerPath)
const review = readJson(reviewPath)
const manifest = readJson(manifestPath)
const terminal = readJson(terminalPath)
const finalization = readJson(finalizationPath)
const baselinePointer = readJson(oldPointerPath)
assert.equal(sha256(baselinePointer.terminalPath), baselinePointer.terminalSha256)
const baselineTerminal = readJson(baselinePointer.terminalPath)
assert.equal(sha256(baselineTerminal.analysisPath), baselineTerminal.analysisSha256)
const baselineAnalysis = readJson(baselineTerminal.analysisPath)

const currentReview = structuredClone(review)
const metricByEpoch = new Map(manifest.metrics.map((row) => [row.epoch, row]))
for (const row of currentReview.reviews) {
  const metric = metricByEpoch.get(row.epoch)
  assert.ok(metric, `missing_manifest_metric_epoch:${row.epoch}`)
  row.recordedAtUtc = metric.recordedAtUtc
  row.recordedAtAsiaShanghai = metric.recordedAtAsiaShanghai
}
const currentAnalysis = analyzeFailureLearningLoop({
  review: currentReview,
  finalization: { ...finalization, runId: finalization.runId },
  overlay: { patch: { training: { fixedEpochPreviewPolicy: { smoke: [1, 5, 10, 20, 30] }, denoiserLossWeights: manifest.denoiserLossWeights ?? {} } } },
  sourcePaths: {},
  proposedBoundedRepairVersion: "cpu-real-evidence-architecture-upgrade-decision-regression",
  repairProfile: "stage4_progressive",
  diagnosticEvidence: finalization.diagnosticEvidence,
})
const realEvidenceDecision = classifyStage4FailureDecision({ currentAnalysis, baselineAnalysis })
const decisionContractRegression = runStage4DecisionContractRegression({ realEvidenceDecision, baselineAnalysis })
const formalRunExistedBeforePreflight = fs.existsSync(resolve(decisionOutputRunPath))
const latestExistedBeforePreflight = fs.existsSync(resolve(decisionLatestPath))
const realStartupPreflight = spawnSync(process.execPath, [
  runnerPath,
  "--structured-stability-architecture-upgrade-decision",
  "--architecture-upgrade-cpu-preflight-only",
  "--authorization",
  realStartupPreflightAuthorizationPath,
], { cwd: root, encoding: "utf8", windowsHide: true })
let realStartupPreflightReport = null
try { realStartupPreflightReport = JSON.parse(realStartupPreflight.stdout) } catch {}

const positive = {
  frozenAnalyzerHashPreserved: sha256(analyzerPath) === bindings[0][1],
  frozenDecisionHelperHashPreserved: sha256(decisionHelperPath) === bindings[1][1],
  oldSuccessfulPointerHashPreserved: sha256(oldPointerPath) === bindings[2][1],
  allSourceEvidenceHashesPreserved: bindings.slice(3).every(([value, expected]) => sha256(value) === expected),
  currentReviewIdentityAccepted: review.previewCount === 5 && review.previewPassCount === 1 && review.previewFailCount === 4,
  structuredReviewStatusAccepted: review.status === "machine_reviews_late_stability_failed_closed",
  structuredFailureBlockerAccepted: terminal.status === "stage4_bounded_repair_single_sample_gpu_smoke_failed_stopped" && terminal.blockers.includes("late_stability_qualification_failed"),
  structuredLateStabilityEvidenceAccepted: structuredLateStabilityEvidenceValid(review),
  realFrozenAnalyzerOutputAccepted: currentAnalysis.summary.previewCount === 5 && currentAnalysis.summary.passedPreviewCount === 1 && currentAnalysis.summary.failedPreviewCount === 4,
  realMixedTimelineAccepted: currentAnalysis.timeline.at(-1).passed === true && currentAnalysis.timeline.at(-1).issueCodes.length === 0,
  realRouteCoverageHistoryAccepted: sameJson(issueEpochs(currentAnalysis, "condition_terrain_path_ground_coverage_mismatch"), [1]),
  realWestBoundaryHistoryAccepted: sameJson(issueEpochs(currentAnalysis, "condition_terrain_path_ground_required_boundary_contact_missing"), [1, 5]),
  realRockSemanticHistoryAccepted: sameJson(issueEpochs(currentAnalysis, "condition_object_rock_reference_semantic_mismatch"), [1, 5, 10, 20]),
  realFinalVisualDifferentialPassAccepted: currentAnalysis.diagnosticVisualDifferential.route.visualCoverageReviewFailed === false && currentAnalysis.diagnosticVisualDifferential.route.visualRequiredWestBoundaryContactReviewFailed === false && currentAnalysis.diagnosticVisualDifferential.rock.heldoutVisualSemanticReviewFailed === false,
  architectureUpgradeModeRegistered: runnerSource.includes('--structured-stability-architecture-upgrade-decision'),
  realStartupCpuPreflightModeRegistered: runnerSource.includes('--architecture-upgrade-cpu-preflight-only'),
  irrelevantPreviousCompatibilityTerminalReadSkippedInDecisionMode: runnerSource.includes("DECISION_ANALYSIS_MODE ? null : readJson(PREVIOUS_ANALYSIS_TERMINAL_PATH)"),
  realStartupCpuPreflightSubprocessPassed: realStartupPreflight.status === 0 && realStartupPreflightReport?.status === "stage4_architecture_upgrade_real_startup_cpu_preflight_passed_no_formal_writes",
  realStartupCpuPreflightReachedRepeatedEvidenceDecision: realStartupPreflightReport?.decisionCode === "evidence_repeats_existing_failure",
  realStartupCpuPreflightDidNotConsumeFormalAnalysisAuthorization: realStartupPreflightReport?.formalAnalysisAuthorizationConsumed === false,
  realStartupCpuPreflightCreatedNoFormalOutputs: formalRunExistedBeforePreflight === false && latestExistedBeforePreflight === false && !fs.existsSync(resolve(decisionOutputRunPath)) && !fs.existsSync(resolve(decisionLatestPath)),
  architectureUpgradeProposalOnlyGateRegistered: runnerSource.includes('"architectureUpgradeProposalOnlyAuthorized"') && runnerSource.includes('parameterCandidateGenerationAuthorized === false'),
  legacyDecisionModePreserved: runnerSource.includes('--current-smoke-decision-analysis'),
  legacyFivePreviewModePreserved: runnerSource.includes('--current-smoke-five-preview'),
  legacySixPreviewModePreserved: runnerSource.includes("LEGACY_AUTHORIZATION_PATH"),
  isolatedArchitectureUpgradeNamespaceRegistered: runnerSource.includes("local-ai-failure-learning-r5-stage4-architecture-upgrade"),
  separateArchitectureUpgradePreflightFailureNamespaceRegistered: runnerSource.includes("local-ai-failure-learning-r5-stage4-architecture-upgrade-preflight-failures"),
  legacyReviewStatusPreserved: runnerSource.includes('"machine_reviews_failed_closed"'),
  legacyFailureBlockerPreserved: runnerSource.includes('"fixed_preview_machine_review_failed"'),
  sharedDecisionContractImportedByRunner: runnerSource.includes("runStage4DecisionContractRegression"),
  formalRunDirectoryCreatedAfterCpuRegression: runnerSource.indexOf("fs.mkdirSync(runDir, { recursive: false })") > runnerSource.indexOf("failedPositiveKeys"),
  oldPointerDeleteAbsent: !/\b(rmSync|unlinkSync|renameSync)\b/.test(runnerSource),
  repeatedEvidenceDecisionSelected: realEvidenceDecision.decisionCode === "evidence_repeats_existing_failure",
  repeatedEvidenceStopsParameterRepair: realEvidenceDecision.actionProposal.parameterRepairContinuationRecommended === false,
  architectureUpgradeProposalSelected: realEvidenceDecision.actionProposal.schemaVersion === "stage4-architecture-decision-upgrade-proposal-v1",
  ...decisionContractRegression.positive,
  architectureUpgradeRunInitiallyAbsent: !fs.existsSync(resolve(decisionOutputRunPath)),
  architectureUpgradeLatestInitiallyAbsent: !fs.existsSync(resolve(decisionLatestPath)),
}

const negative = {
  ...decisionContractRegression.negative,
  epoch20PassMutationRejected: expectStructuredEvidenceRejected(review, (value) => { value.lateStabilityQualification.requiredEpochPasses["20"] = true }),
  observedConsecutivePassMutationRejected: expectStructuredEvidenceRejected(review, (value) => { value.lateStabilityQualification.observedConsecutivePasses = 2 }),
  thresholdChangeMutationRejected: expectStructuredEvidenceRejected(review, (value) => { value.reviewThresholdsChanged = true }),
  trainingTargetMutationRejected: expectStructuredEvidenceRejected(review, (value) => { value.lateStabilityQualification.trainingTarget = true }),
}

const failedPositiveKeys = Object.entries(positive).filter(([, passed]) => !passed).map(([key]) => key)
const failedNegativeKeys = Object.entries(negative).filter(([, passed]) => !passed).map(([key]) => key)
if (failedPositiveKeys.length > 0 || failedNegativeKeys.length > 0) {
  const failureReport = {
    ok: false,
    status: "stage4_architecture_upgrade_decision_cpu_regression_failed",
    realEvidenceDecisionCode: realEvidenceDecision.decisionCode,
    failedPositiveKeys,
    failedNegativeKeys,
    realStartupPreflightExitCode: realStartupPreflight.status,
    realStartupPreflightStdout: realStartupPreflight.stdout,
    realStartupPreflightStderr: realStartupPreflight.stderr,
  }
  saveReportIfRequested(failureReport)
  console.error(JSON.stringify(failureReport, null, 2))
}
assert.equal(failedPositiveKeys.length, 0, `stage4_architecture_upgrade_decision_cpu_positive_regression_failed:${failedPositiveKeys.join(",")}`)
assert.equal(failedNegativeKeys.length, 0, `stage4_architecture_upgrade_decision_cpu_negative_regression_failed:${failedNegativeKeys.join(",")}`)
const successReport = {
  ok: true,
  status: "stage4_architecture_upgrade_decision_cpu_regression_passed",
  runnerSha256: sha256(runnerPath),
  cpuCheckerSha256: sha256("scripts/check-local-ai-v7-r5-stage4-failure-decision.mjs"),
  analyzerSha256: sha256(analyzerPath),
  decisionHelperSha256: sha256(decisionHelperPath),
  oldPointerSha256: sha256(oldPointerPath),
  sharedDecisionContractSchemaVersion: decisionContractRegression.schemaVersion,
  realEvidenceDecisionCode: realEvidenceDecision.decisionCode,
  realStartupPreflightExitCode: realStartupPreflight.status,
  realStartupPreflightStatus: realStartupPreflightReport?.status ?? null,
  realStartupPreflightStderr: realStartupPreflight.status === 0 ? null : realStartupPreflight.stderr,
  fixtureDecisionCodes: decisionContractRegression.fixtureDecisionCodes,
  positive,
  negative,
  failedPositiveKeys,
  failedNegativeKeys,
  positiveAssertionsPassed: Object.values(positive).filter(Boolean).length,
  negativeAssertionsPassed: Object.values(negative).filter(Boolean).length,
  checkpointRead: false,
  gpuUsed: false,
  trainingStarted: false,
}
saveReportIfRequested(successReport)
console.log(JSON.stringify(successReport, null, 2))

function runArchitectureDesignConvergenceCpuRegression() {
  const parentAuthorizationPath = "data/ai-painter/system-governance/owner-authorized-r5-stage4-architecture-design-convergence-20260808-input.json"
  const implementationConsumptionPath = ".runtime/ai-painter/owner-action-requests/owner-authorized-r5-stage4-architecture-design-convergence-20260808/implementation-authorization-consumption.json"
  const repairAuthorizationPath = "data/ai-painter/system-governance/owner-authorized-r5-stage4-architecture-design-activation-gate-fix-20260808-input.json"
  const repairConsumptionPath = ".runtime/ai-painter/owner-action-requests/owner-authorized-r5-stage4-architecture-design-activation-gate-fix-20260808/implementation-authorization-consumption.json"
  const localRunnerPath = "scripts/run-local-ai-v7-r5-stage4-failure-learning.mjs"
  const localCheckerPath = "scripts/check-local-ai-v7-r5-stage4-failure-decision.mjs"
  const localHelperPath = "scripts/lib/ai-assisted-v7-r5-stage4-failure-decision.mjs"
  const authorization = readJson(parentAuthorizationPath)
  const consumption = readJson(implementationConsumptionPath)
  const repairAuthorization = readJson(repairAuthorizationPath)
  const repairConsumption = readJson(repairConsumptionPath)
  const terminalPath = authorization.boundArchitectureDecisionTerminal.path
  const proposalPath = authorization.boundArchitectureUpgradeProposal.path
  const terminal = readJson(terminalPath)
  const proposal = readJson(proposalPath)
  const sourceBindings = {
    architectureDecisionTerminal: {
      path: terminalPath,
      sha256: authorization.boundArchitectureDecisionTerminal.sha256,
      actualSha256: sha256(terminalPath),
    },
    architectureUpgradeProposal: {
      path: proposalPath,
      sha256: authorization.boundArchitectureUpgradeProposal.sha256,
      actualSha256: sha256(proposalPath),
    },
  }
  const contractRegression = runStage4ArchitectureDesignContractRegression({
    architectureDecisionTerminal: terminal,
    architectureUpgradeProposal: proposal,
    sourceBindings,
  })
  const runnerSource = readText(localRunnerPath)
  const helperSource = readText(localHelperPath)
  const outputRoot = ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-architecture-design-convergence"
  const outputRootExistedBefore = fs.existsSync(resolve(outputRoot))
  const preflight = spawnSync(process.execPath, [
    localRunnerPath,
    "--architecture-design-convergence-cpu-preflight-only",
    "--authorization",
    parentAuthorizationPath,
  ], { cwd: root, encoding: "utf8", windowsHide: true })
  let preflightReport = null
  try { preflightReport = JSON.parse(preflight.stdout) } catch {}
  const outputRootExistsAfter = fs.existsSync(resolve(outputRoot))
  const frozen = authorization.implementationIdentity
  const frozenBindings = [
    [frozen.frozenAnalyzerPath, frozen.frozenAnalyzerSha256],
    [frozen.frozenSmokeRunnerPath, frozen.frozenSmokeRunnerSha256],
    [frozen.frozenTrainerPath, frozen.frozenTrainerSha256],
    [frozen.frozenModelPath, frozen.frozenModelSha256],
    [frozen.formalSpecificationPath, frozen.formalSpecificationSha256],
  ]
  const positive = {
    immutableParentAuthorizationValid: authorization.status === "resolved_owner_authorized"
      && authorization.commandRef === "owner-authorized-r5-stage4-architecture-design-convergence-20260808",
    implementationAuthorizationConsumedBeforeCodeWrite: consumption.status === "implementation_scope_consumed_before_authorized_write_formal_design_scope_not_consumed"
      && consumption.authorizationSha256 === sha256(parentAuthorizationPath),
    activationGateFixAuthorizationValid: repairAuthorization.status === "resolved_owner_authorized"
      && repairAuthorization.commandRef === "owner-authorized-r5-stage4-architecture-design-activation-gate-fix-20260808"
      && sha256(repairAuthorization.boundFailureTerminal.path) === repairAuthorization.boundFailureTerminal.sha256,
    activationGateFixAuthorizationConsumedBeforeCodeWrite: repairConsumption.status === "activation_gate_fix_scope_consumed_before_authorized_write_formal_design_scope_not_consumed"
      && repairConsumption.authorizationSha256 === sha256(repairAuthorizationPath),
    runnerRemainedFrozenDuringGateFix: sha256(repairAuthorization.implementationIdentity.frozenRunnerPath) === repairAuthorization.implementationIdentity.frozenRunnerSha256,
    architectureDecisionTerminalBound: sourceBindings.architectureDecisionTerminal.sha256 === sourceBindings.architectureDecisionTerminal.actualSha256,
    architectureUpgradeProposalBound: sourceBindings.architectureUpgradeProposal.sha256 === sourceBindings.architectureUpgradeProposal.actualSha256,
    allFrozenSourcesPreserved: frozenBindings.every(([value, expected]) => sha256(value) === expected),
    architectureDesignModeRegistered: runnerSource.includes('--architecture-design-convergence'),
    architectureDesignPreflightModeRegistered: runnerSource.includes('--architecture-design-convergence-cpu-preflight-only'),
    sharedArchitectureDesignContractImported: runnerSource.includes("runStage4ArchitectureDesignContractRegression"),
    architectureDesignCompilerImplemented: helperSource.includes("compileStage4ArchitectureDesignConvergence"),
    allThreeDirectionsImplemented: authorization.requiredArchitectureDirections.every((value) => helperSource.includes(value)),
    exactActivationGateKeyValidationRegistered: helperSource.includes('sameSequence(Object.keys(gate).sort(), expectedGateKeys)'),
    formalTrainingActivationFixtureRegistered: helperSource.includes("formalTrainingActivationRejected"),
    unknownTrainingActionInjectionFixtureRegistered: helperSource.includes("unknownTrainingActionFieldRejected"),
    architectureDesignReportContentFrozen: canonicalSha256(contractRegression.report) === repairAuthorization.frozenArchitectureDesignCanonicalOutputs.reportCanonicalSha256,
    architectureImplementationContractContentFrozen: canonicalSha256(contractRegression.contract) === repairAuthorization.frozenArchitectureDesignCanonicalOutputs.contractCanonicalSha256,
    ownerRequestPreviewContentFrozen: canonicalSha256(contractRegression.ownerRequestPreview) === repairAuthorization.frozenArchitectureDesignCanonicalOutputs.ownerRequestCanonicalSha256,
    legacyArchitectureDecisionModePreserved: runnerSource.includes('--structured-stability-architecture-upgrade-decision'),
    legacyFivePreviewModePreserved: runnerSource.includes('--current-smoke-five-preview'),
    legacySixPreviewModePreserved: runnerSource.includes("LEGACY_AUTHORIZATION_PATH"),
    preflightSubprocessPassed: preflight.status === 0 && preflightReport?.status === "stage4_architecture_design_convergence_cpu_preflight_passed_no_formal_writes",
    preflightDidNotCreateFormalOutput: outputRootExistedBefore === false && outputRootExistsAfter === false && preflightReport?.formalRunDirectoryCreated === false,
    preflightDidNotConsumeFormalAuthorization: preflightReport?.formalAuthorizationConsumed === false,
    oneRecommendationAndNoExit: contractRegression.report.outcome.decision === "recommend_bounded_architecture_implementation"
      && contractRegression.report.outcome.exitCurrentCandidateRoute === false,
    inactiveContractGeneratedInMemory: contractRegression.contract.status === "recommended_bounded_architecture_implementation_not_activated",
    ownerRequestPreviewNotApproved: contractRegression.ownerRequestPreview.status === "preview_not_approved_not_consumed_not_executed",
    noCheckpointGpuTrainingSideEffects: preflightReport?.checkpointRead === false && preflightReport?.gpuUsed === false && preflightReport?.trainingStarted === false,
    destructiveHistoricalOutputOperationsAbsent: !/\b(rmSync|unlinkSync|renameSync)\b/.test(runnerSource),
    ...contractRegression.positive,
  }
  const negative = {
    ...contractRegression.negative,
    parentCheckpointPermissionClosed: authorization.authorizedBoundaries.checkpointReadOrLoadAuthorized === false,
    parentGpuPermissionClosed: authorization.authorizedBoundaries.gpuUseAuthorized === false,
    parentTrainingPermissionClosed: authorization.authorizedBoundaries.trainingAuthorized === false,
    parentHyperparameterCandidatePermissionClosed: authorization.authorizedBoundaries.hyperparameterCandidateGenerationAuthorized === false,
  }
  const failedPositiveKeys = Object.entries(positive).filter(([, passed]) => !passed).map(([key]) => key)
  const failedNegativeKeys = Object.entries(negative).filter(([, passed]) => !passed).map(([key]) => key)
  const report = {
    ok: failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0,
    status: failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0
      ? "stage4_architecture_design_convergence_cpu_regression_passed"
      : "stage4_architecture_design_convergence_cpu_regression_failed",
    runnerSha256: sha256(localRunnerPath),
    cpuCheckerSha256: sha256(localCheckerPath),
    decisionHelperSha256: sha256(localHelperPath),
    analyzerSha256: sha256(frozen.frozenAnalyzerPath),
    positive,
    negative,
    failedPositiveKeys,
    failedNegativeKeys,
    positiveAssertionsPassed: Object.values(positive).filter(Boolean).length,
    negativeAssertionsPassed: Object.values(negative).filter(Boolean).length,
    preflightExitCode: preflight.status,
    preflightStatus: preflightReport?.status ?? null,
    preflightStdout: preflight.status === 0 ? null : preflight.stdout,
    preflightStderr: preflight.status === 0 ? null : preflight.stderr,
    checkpointRead: false,
    gpuUsed: false,
    trainingStarted: false,
  }
  saveReportIfRequested(report)
  if (!report.ok) console.error(JSON.stringify(report, null, 2))
  assert.equal(failedPositiveKeys.length, 0, `stage4_architecture_design_cpu_positive_regression_failed:${failedPositiveKeys.join(",")}`)
  assert.equal(failedNegativeKeys.length, 0, `stage4_architecture_design_cpu_negative_regression_failed:${failedNegativeKeys.join(",")}`)
  console.log(JSON.stringify(report, null, 2))
}

function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(root, value) }
function readText(value) { return fs.readFileSync(resolve(value), "utf8") }
function readJson(value) { return JSON.parse(readText(value)) }
function sha256(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function canonicalSha256(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex") }
function issueEpochs(analysis, code) { return analysis.timeline.filter((row) => row.issueCodes.includes(code)).map((row) => row.epoch) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function saveReportIfRequested(report) {
  const index = process.argv.indexOf("--report-output")
  if (index < 0) return
  const output = process.argv[index + 1]
  assert.ok(output, "cpu_regression_report_output_path_required")
  const absolute = resolve(output)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  const handle = fs.openSync(absolute, "wx")
  try {
    fs.writeFileSync(handle, `${JSON.stringify(report, null, 2)}\n`, "utf8")
    fs.fsyncSync(handle)
  } finally {
    fs.closeSync(handle)
  }
}
function structuredLateStabilityEvidenceValid(reviewValue) {
  const qualification = reviewValue?.lateStabilityQualification
  return reviewValue?.reviewThresholdsChanged === false
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
function expectStructuredEvidenceRejected(reviewValue, mutate) {
  const copy = structuredClone(reviewValue)
  mutate(copy)
  return structuredLateStabilityEvidenceValid(copy) === false
}
