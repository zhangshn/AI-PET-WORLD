import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  compileR5Stage3CoverageConvergenceCandidate,
  runCoverageConvergenceCpuRegression,
  validateR5Stage3CoverageConvergenceCandidate,
} from "./lib/ai-assisted-v7-r5-stage3-internal-candidate.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-action-request-v7-r5-stage3-coverage-convergence-failure-learning-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "25f6fd9a9bf3758ab6b123afd941f86ceb093561d0ef13b59f421b8da784ed08"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "ec4f22883cc1a3b1a794ab9830d773e517022584ee09b15696efb6d2e7448a93"
const COMMAND_REF = "owner-authorized-v7-r5-stage3-coverage-convergence-failure-learning-cpu-regression-20260804"
const SCOPE = "read_r5_stage3_epoch_10_20_30_path_coverage_rejections_compile_isolated_coverage_convergence_candidate_and_cpu_regression_only"
const SOURCE_RUN_ID = "ai-assisted-v7-r5-stage3-internal-checkpoint-continuation-overfit-smoke-2026-08-04T13-23-54-684Z"
const SOURCE_RUN_ROOT = `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage3-internal/${SOURCE_RUN_ID}`
const REVIEW_PATH = `${SOURCE_RUN_ROOT}/fixed-preview-hard-gate-review.json`
const REVIEW_SHA256 = "766718a5cba23491f693e3c63bdf6bf40a01c3a7dbebfff13f91602065afec8a"
const MANIFEST_PATH = `${SOURCE_RUN_ROOT}/manifest.json`
const MANIFEST_SHA256 = "91f36faa6293eef911acc313ede0e11855f5fef7bda1e8c1823dff4ac28cd6d9"
const TERMINAL_PATH = `${SOURCE_RUN_ROOT}/run-terminal-registration.json`
const TERMINAL_SHA256 = "231152e418e6d2a41700ac8cf75db188a288ef6400133b91c61d7ccb721b1710"
const FINALIZATION_PATH = ".runtime/ai-painter/v7-r5-stage3-internal-overfit-smoke-finalizations/ai-assisted-v7-r5-stage3-overfit-smoke-finalization-2026-08-04T13-23-54-684Z/finalization-report.json"
const FINALIZATION_SHA256 = "a6e5cd96817ed2ba6761123786ebe3174513a47dddbbaf83c5f6b3e0c865bc6f"
const CHECKPOINT_PATH = `${SOURCE_RUN_ROOT}/complete-world-ai-assisted-conditional-denoiser.pt`
const CHECKPOINT_SHA256 = "39ce5fc5ac9766795f9e5084a926f1fa1f5237720456010464f69f24098e3514"
const PARENT_CANDIDATE_PATH = "data/ai-painter/system-governance/v7-r5-stage3-internal-path-coverage-boundary-candidate.json"
const PARENT_CANDIDATE_SHA256 = "54004f535bd75d018040cf3f651cd6dcc399b0cb0617fb796f3a339aefb3843c"
const SELECTION_CONTRACT_PATH = "data/ai-painter/system-governance/v7-r5-stage3-internal-isolated-config-selection-contract.json"
const SELECTION_CONTRACT_SHA256 = "0df8084664460711a641365bed0e6435893f7aa8e8343fad3c9702e2eb3b6de3"
const CANDIDATE_LIBRARY_PATH = "scripts/lib/ai-assisted-v7-r5-stage3-internal-candidate.mjs"
const CANDIDATE_LIBRARY_SHA256 = "6442065f798a432cab01d50733b6b1e90bf6ee747b9f76ceae57244fa47942ee"
const CANDIDATE_PATH = "data/ai-painter/system-governance/v7-r5-stage3-internal-path-coverage-convergence-candidate.json"
const now = new Date().toISOString()
const runId = `local-ai-v7-r5-stage3-coverage-convergence-failure-learning-${now.replace(/[:.]/g, "-")}`
const runDir = resolve(`.runtime/ai-painter/local-ai-failure-learning-r5-stage3-coverage-convergence/${runId}`)

const authorization = readJson(AUTHORIZATION_PATH)
const consumption = readJson(CONSUMPTION_PATH)
const review = readJson(REVIEW_PATH)
const manifest = readJson(MANIFEST_PATH)
const terminal = readJson(TERMINAL_PATH)
const finalization = readJson(FINALIZATION_PATH)
const parentCandidate = readJson(PARENT_CANDIDATE_PATH)
const selectionContract = readJson(SELECTION_CONTRACT_PATH)

validatePreflight()
fs.mkdirSync(runDir, { recursive: true })
appendEvent("r5_stage3_coverage_convergence_failure_learning_started", "running", "read Epoch 10/20/30 rejection evidence; CPU only; checkpoint deserialize=false; GPU=false")

try {
  const sourceEvidence = {
    review: { path: REVIEW_PATH, sha256: REVIEW_SHA256 },
    manifest: { path: MANIFEST_PATH, sha256: MANIFEST_SHA256 },
    terminal: { path: TERMINAL_PATH, sha256: TERMINAL_SHA256 },
    finalization: { path: FINALIZATION_PATH, sha256: FINALIZATION_SHA256 },
    checkpointIdentity: { path: CHECKPOINT_PATH, sha256: CHECKPOINT_SHA256, fileHashedOnly: true, deserialized: false, loadedIntoModel: false },
    parentCandidate: { path: PARENT_CANDIDATE_PATH, sha256: PARENT_CANDIDATE_SHA256 },
    selectionContract: { path: SELECTION_CONTRACT_PATH, sha256: SELECTION_CONTRACT_SHA256 },
  }
  const candidate = compileR5Stage3CoverageConvergenceCandidate({ review, finalization, manifest, terminal, parentCandidate, selectionContract, sourceEvidence })
  const candidateContract = validateR5Stage3CoverageConvergenceCandidate(candidate)
  const regression = runCpuRegression(candidate)
  const analysis = {
    schemaVersion: "ai-assisted-v7-r5-stage3-coverage-convergence-failure-analysis-v1",
    status: "epoch_10_20_30_path_coverage_rejections_analyzed_convergence_candidate_ready",
    generatedAtUtc: now,
    generatedAtAsiaShanghai: formatShanghai(now),
    fixedStageNumber: 3,
    addsNewFixedStage: false,
    failureAnalysis: candidate.failureAnalysis,
    evidenceReadOnly: true,
    originalEvidenceModified: false,
    reviewThresholdsModified: false,
    failedPreviewPixelsUsedAsTrainingTargets: false,
    checkpointDeserialized: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    modelWeightsModified: false,
    gpuTrainingStarted: false,
  }
  const analysisPath = path.join(runDir, "failure-analysis.json")
  const regressionPath = path.join(runDir, "cpu-positive-negative-regression.json")
  writeImmutableJson(analysisPath, analysis)
  writeImmutableJson(regressionPath, regression)
  const storedCandidate = {
    ...candidate,
    status: "isolated_stage3_coverage_convergence_candidate_cpu_verified_not_implemented_not_active",
    candidateContract,
    cpuRegression: { path: projectPath(regressionPath), sha256: sha256File(regressionPath), status: regression.status },
    failureAnalysisEvidence: { path: projectPath(analysisPath), sha256: sha256File(analysisPath) },
    ownerAuthorization: {
      path: AUTHORIZATION_PATH,
      sha256: AUTHORIZATION_SHA256,
      consumptionPath: CONSUMPTION_PATH,
      consumptionSha256: CONSUMPTION_SHA256,
      commandRef: COMMAND_REF,
      scope: SCOPE,
    },
  }
  writeImmutableJson(resolve(CANDIDATE_PATH), storedCandidate)
  verifySourceEvidenceUnchanged()
  const result = {
    schemaVersion: "local-ai-v7-r5-stage3-coverage-convergence-failure-learning-terminal-v1",
    status: "r5_stage3_coverage_convergence_candidate_cpu_verified_stopped_without_checkpoint_load_or_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    candidatePath: CANDIDATE_PATH,
    candidateSha256: sha256File(CANDIDATE_PATH),
    analysisPath: projectPath(analysisPath),
    analysisSha256: sha256File(analysisPath),
    regressionPath: projectPath(regressionPath),
    regressionSha256: sha256File(regressionPath),
    sourceEvidenceModified: false,
    reviewThresholdsModified: false,
    failedPreviewPixelsUsedAsTrainingTargets: false,
    executionValuesSelected: false,
    checkpointDeserialized: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    modelWeightsModified: false,
    gpuTrainingStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    fixedStageNumber: 3,
    addsNewFixedStage: false,
    nextIndependentAuthorization: "r5_stage3_coverage_convergence_candidate_trainer_support_and_cpu_regression_only",
  }
  const terminalPath = path.join(runDir, "phase-terminal.json")
  writeImmutableJson(terminalPath, result)
  appendEvent("r5_stage3_coverage_convergence_failure_learning_completed", "success", "candidate CPU verified; checkpoint=false; optimizer=false; GPU=false", projectPath(terminalPath))
  console.log(JSON.stringify({ ...result, terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }, null, 2))
} catch (error) {
  const result = {
    schemaVersion: "local-ai-v7-r5-stage3-coverage-convergence-failure-learning-terminal-v1",
    status: "r5_stage3_coverage_convergence_failure_learning_failed_closed",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    blockers: [String(error?.message ?? error)],
    sourceEvidenceModified: false,
    reviewThresholdsModified: false,
    checkpointDeserialized: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    modelWeightsModified: false,
    gpuTrainingStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
  }
  const terminalPath = path.join(runDir, "phase-terminal.json")
  writeImmutableJson(terminalPath, result)
  appendEvent("r5_stage3_coverage_convergence_failure_learning_failed", "failed", result.blockers.join(","), projectPath(terminalPath))
  console.error(JSON.stringify(result, null, 2))
  process.exitCode = 1
}

function runCpuRegression(candidate) {
  const exact = runCoverageConvergenceCpuRegression({ targetActivationMass: 1, predictedActivationMass: 1 })
  const mildOverCoverage = runCoverageConvergenceCpuRegression({ targetActivationMass: 1, predictedActivationMass: 1.2 })
  const strongOverCoverage = runCoverageConvergenceCpuRegression({ targetActivationMass: 1, predictedActivationMass: 1.8 })
  const underCoverage = runCoverageConvergenceCpuRegression({ targetActivationMass: 1, predictedActivationMass: 0.5 })
  const symmetricOverCoverage = runCoverageConvergenceCpuRegression({ targetActivationMass: 1, predictedActivationMass: 2 })
  const outsideLeakage = runCoverageConvergenceCpuRegression({ targetActivationMass: 1, predictedActivationMass: 1, outsideSupportActivationMass: 0.2 })
  const trajectoryDrift = runCoverageConvergenceCpuRegression({ targetActivationMass: 1, predictedActivationMass: 1.1, previousPredictedActivationMass: 1.5 })
  const positive = {
    candidateContractAccepted: true,
    exactOriginalTargetActivationHasZeroLoss: exact.totalLoss === 0,
    overCoverageProducesPositiveLoss: mildOverCoverage.totalLoss > 0,
    strongerOverCoverageProducesStrongerLoss: strongOverCoverage.totalLoss > mildOverCoverage.totalLoss,
    underCoverageProducesPositiveLoss: underCoverage.totalLoss > 0,
    symmetricHalfAndDoubleMassHaveEqualLoss: Math.abs(underCoverage.symmetricActivationMassLoss - symmetricOverCoverage.symmetricActivationMassLoss) < 1e-12,
    outsideSupportLeakageProducesPositiveLoss: outsideLeakage.outsideSupportLeakageLoss > 0,
    shortTrajectoryDriftProducesPositiveLoss: trajectoryDrift.shortTrajectoryDriftLoss > 0,
    baselineAndRejectedEpochsBoundCorrectly: candidate.failureAnalysis.passedBaselineEpoch === 1 && JSON.stringify(candidate.failureAnalysis.rejectedEpochs) === JSON.stringify([10, 20, 30]),
    unrelatedBoundaryAndObjectSemanticsPreserved: candidate.failureAnalysis.authorizedBoundaryStable === true && candidate.failureAnalysis.objectSemanticsStable === true,
  }
  const negative = {
    failedPreviewTargetRejected: expectCandidateRejected(candidate, (value) => { value.proposal.pathActivationMassCalibrationProposal.failedPreviewPixelsUsedAsTrainingTargets = true }, "r5_stage3_convergence_failed_preview_used_as_target"),
    reviewThresholdAsTargetRejected: expectCandidateRejected(candidate, (value) => { value.proposal.pathActivationMassCalibrationProposal.machineReviewThresholdUsedAsTrainingTarget = true }, "r5_stage3_convergence_review_threshold_used_as_target"),
    reviewThresholdChangeRejected: expectCandidateRejected(candidate, (value) => { value.proposal.smokeStabilityGate.preserveReviewThresholds = false }, "r5_stage3_convergence_review_thresholds_changed"),
    executionValueSelectionRejected: expectCandidateRejected(candidate, (value) => { value.proposal.pathActivationMassCalibrationProposal.weight.selectedValue = 0.5 }, "r5_stage3_convergence_execution_value_selected_without_authorization"),
    checkpointActivationRejected: expectCandidateRejected(candidate, (value) => { value.proposal.ownerTrainingAuthorization.checkpointLoadingAuthorized = true }, "r5_stage3_convergence_candidate_improperly_authorizes_checkpointLoadingAuthorized"),
    objectWeightChangeRejected: expectCandidateRejected(candidate, (value) => { value.proposal.preserveExistingTrainingContract.objectSemanticWeightChanges = { object_tree: 2 } }, "r5_stage3_convergence_unrelated_semantics_changed"),
    boundaryChangeRejected: expectCandidateRejected(candidate, (value) => { value.proposal.preserveExistingTrainingContract.boundaryTopologyChanges = { allowedSides: ["north"] } }, "r5_stage3_convergence_unrelated_semantics_changed"),
    replayCountChangeRejected: expectCandidateRejected(candidate, (value) => { value.proposal.preserveExistingTrainingContract.originalApprovedTargetReplayPassesPerEpoch = 3 }, "r5_stage3_convergence_replay_contract_changed"),
    newFixedStageRejected: expectCandidateRejected(candidate, (value) => { value.promotionBoundary.addsNewFixedStage = true }, "r5_stage3_convergence_fixed_plan_boundary_invalid"),
    invalidMassRejected: expectRegressionRejected({ targetActivationMass: 0, predictedActivationMass: 1 }, "r5_stage3_convergence_target_activation_invalid"),
  }
  assert(Object.values(positive).every(Boolean), "r5_stage3_convergence_positive_regression_failed")
  assert(Object.values(negative).every(Boolean), "r5_stage3_convergence_negative_regression_failed")
  return {
    schemaVersion: "ai-assisted-v7-r5-stage3-coverage-convergence-cpu-regression-v1",
    status: "passed_cpu_only_coverage_convergence_candidate_not_implemented_not_active",
    device: "cpu",
    positive,
    negative,
    measured: { exact, mildOverCoverage, strongOverCoverage, underCoverage, symmetricOverCoverage, outsideLeakage, trajectoryDrift },
    boundaries: {
      sourceEvidenceModified: false,
      reviewThresholdsModified: false,
      executionValuesSelected: false,
      checkpointDeserialized: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      fullTrainingStarted: false,
      strictRevalidationStarted: false,
      formalInferenceStarted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
    },
  }
}

function expectCandidateRejected(candidate, mutate, expected) {
  const copy = structuredClone(candidate)
  mutate(copy)
  try {
    validateR5Stage3CoverageConvergenceCandidate(copy)
  } catch (error) {
    assert(String(error.message).includes(expected), `unexpected rejection:${error.message}`)
    return true
  }
  throw new Error(`expected rejection:${expected}`)
}

function expectRegressionRejected(input, expected) {
  try {
    runCoverageConvergenceCpuRegression(input)
  } catch (error) {
    assert(String(error.message).includes(expected), `unexpected regression rejection:${error.message}`)
    return true
  }
  throw new Error(`expected regression rejection:${expected}`)
}

function validatePreflight() {
  const identity = authorization?.taskIdentity ?? {}
  const checks = [
    [fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r5_stage3_convergence_authorization_hash_invalid"],
    [fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r5_stage3_convergence_consumption_hash_invalid"],
    [authorization?.status === "resolved_owner_authorized", "r5_stage3_convergence_authorization_not_resolved"],
    [authorization?.ownerDecision?.commandRef === COMMAND_REF && authorization?.ownerDecision?.scope === SCOPE, "r5_stage3_convergence_authorization_identity_invalid"],
    [consumption?.status === "consumed_before_authorized_write" && consumption?.authorizationSha256 === AUTHORIZATION_SHA256, "r5_stage3_convergence_authorization_not_consumed"],
    [consumption?.commandRef === COMMAND_REF && consumption?.scope === SCOPE && consumption?.allowedExecutionCount === 1, "r5_stage3_convergence_consumption_identity_invalid"],
    [identity.sourceRunId === SOURCE_RUN_ID, "r5_stage3_convergence_source_run_invalid"],
    [identity.sourceReviewPath === REVIEW_PATH && identity.sourceReviewSha256 === REVIEW_SHA256, "r5_stage3_convergence_review_authorization_binding_invalid"],
    [identity.sourceCheckpointPath === CHECKPOINT_PATH && identity.sourceCheckpointSha256 === CHECKPOINT_SHA256, "r5_stage3_convergence_checkpoint_authorization_binding_invalid"],
    [JSON.stringify(identity.requiredRejectedEpochs) === JSON.stringify([10, 20, 30]) && identity.requiredPassedBaselineEpoch === 1, "r5_stage3_convergence_epoch_authorization_binding_invalid"],
    [fileHashMatches(REVIEW_PATH, REVIEW_SHA256), "r5_stage3_convergence_review_changed"],
    [fileHashMatches(MANIFEST_PATH, MANIFEST_SHA256), "r5_stage3_convergence_manifest_changed"],
    [fileHashMatches(TERMINAL_PATH, TERMINAL_SHA256), "r5_stage3_convergence_terminal_changed"],
    [fileHashMatches(FINALIZATION_PATH, FINALIZATION_SHA256), "r5_stage3_convergence_finalization_changed"],
    [fileHashMatches(CHECKPOINT_PATH, CHECKPOINT_SHA256), "r5_stage3_convergence_checkpoint_identity_changed"],
    [fileHashMatches(PARENT_CANDIDATE_PATH, PARENT_CANDIDATE_SHA256), "r5_stage3_convergence_parent_candidate_changed"],
    [fileHashMatches(SELECTION_CONTRACT_PATH, SELECTION_CONTRACT_SHA256), "r5_stage3_convergence_selection_contract_changed"],
    [fileHashMatches(CANDIDATE_LIBRARY_PATH, CANDIDATE_LIBRARY_SHA256), "r5_stage3_convergence_candidate_library_changed"],
    [!fs.existsSync(resolve(CANDIDATE_PATH)), "r5_stage3_convergence_candidate_already_exists"],
    [!fs.existsSync(runDir), "r5_stage3_convergence_run_already_exists"],
  ]
  for (const [ok, code] of checks) assert(ok, code)
  for (const key of ["failureEvidenceReadAuthorized", "coverageConvergenceCandidateCompilationAuthorized", "cpuPositiveNegativeRegressionAuthorized", "immutableEvidenceStorageAuthorized", "automaticTerminalStorageAuthorized"]) assert(authorization.resolution?.[key] === true, `r5_stage3_convergence_${key}_missing`)
  for (const key of ["sourceEvidenceModificationAuthorized", "reviewThresholdChangeAuthorized", "failedPreviewPixelsAsTrainingTargetsAuthorized", "executionValueSelectionAuthorized", "checkpointDeserializationAuthorized", "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "modelWeightMutationAuthorized", "gpuTrainingAuthorized", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) assert(authorization.resolution?.[key] === false, `r5_stage3_convergence_boundary_${key}_invalid`)
}

function verifySourceEvidenceUnchanged() {
  for (const [value, expected] of [[REVIEW_PATH, REVIEW_SHA256], [MANIFEST_PATH, MANIFEST_SHA256], [TERMINAL_PATH, TERMINAL_SHA256], [FINALIZATION_PATH, FINALIZATION_SHA256], [CHECKPOINT_PATH, CHECKPOINT_SHA256], [PARENT_CANDIDATE_PATH, PARENT_CANDIDATE_SHA256], [SELECTION_CONTRACT_PATH, SELECTION_CONTRACT_SHA256]]) assert(fileHashMatches(value, expected), `source_evidence_changed:${value}`)
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_local_ai_v7_r5_stage3_coverage_convergence_failure_learning",
    runId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `本地AI V7 R5第3阶段道路覆盖收敛失败学习：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/run-local-ai-v7-r5-stage3-coverage-convergence-failure-learning.mjs",
    currentStep: kind,
    evidencePath,
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
}

function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function writeImmutableJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return fs.existsSync(absolute) && sha256File(absolute) === expected }
function assert(condition, message) { if (!condition) throw new Error(message) }
