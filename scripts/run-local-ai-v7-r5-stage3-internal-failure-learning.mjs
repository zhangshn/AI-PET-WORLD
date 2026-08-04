import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  compileR5Stage3InternalCandidate,
  runCoverageBoundaryCpuRegression,
  validateR5Stage3InternalCandidate,
} from "./lib/ai-assisted-v7-r5-stage3-internal-candidate.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-action-request-v7-r5-stage3-internal-failure-learning-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "5ceec1431b1bbce09353515421e762ac741726c86a6b9777fb9da45ad39314dc"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "55ea3c30fa04f74b7cf2c774354df8df37ec64a67b523913713da0c1ebd1c95f"
const COMMAND_REF = "owner-authorized-v7-r5-stage3-internal-failure-learning-cpu-regression-20260804"
const SCOPE = "read_four_r5_smoke_rejections_generate_stage3_internal_path_coverage_boundary_candidate_and_cpu_regression_only"
const REVIEW_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/ai-assisted-v7-repair-r5-checkpoint-continuation-single-sample-overfit-smoke-2026-08-04T10-07-52-619Z/fixed-preview-hard-gate-review.json"
const REVIEW_SHA256 = "e3c834c8b07dfaeea0a70c9b7a1cc95caa00e4fb37a94c7e2105f26de4f165a3"
const CLOSURE_PATH = ".runtime/ai-painter/v7-bounded-repair-r5-overfit-smoke-review-closures/r5-review-closure-2026-08-04T10-13-36-185Z/closure-report.json"
const CLOSURE_SHA256 = "26c5e920f4703118a1f35a6f3380e30d7175427ab5f0d674946a40c6538a55bd"
const MANIFEST_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/ai-assisted-v7-repair-r5-checkpoint-continuation-single-sample-overfit-smoke-2026-08-04T10-07-52-619Z/manifest.json"
const MANIFEST_SHA256 = "37fab710dab997d0ea390ffa9f8dcf337f21011ac37c7f40698c8a49d836686d"
const CHECKPOINT_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/ai-assisted-v7-repair-r5-checkpoint-continuation-single-sample-overfit-smoke-2026-08-04T10-07-52-619Z/complete-world-ai-assisted-conditional-denoiser.pt"
const CHECKPOINT_SHA256 = "21198424af06d140c780540c345809841afc4fb2e19cd0c52419f62b58f5da42"
const BASE_PROPOSAL_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r5-candidate-proposal.json"
const BASE_PROPOSAL_SHA256 = "0af7181ca95ec9e907bc01b9ccbcd1c4bd45fdfdfe1a472a55fa840deac0e049"
const SELECTION_CONTRACT_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r5-isolated-config-selection-contract.json"
const SELECTION_CONTRACT_SHA256 = "7d5cda5f3def74635f6b16ce9f647430c9610e0290ac244c9000743f52f5b3b3"
const CANDIDATE_PATH = "data/ai-painter/system-governance/v7-r5-stage3-internal-path-coverage-boundary-candidate.json"
const now = new Date().toISOString()
const runId = `local-ai-v7-r5-stage3-internal-failure-learning-${now.replace(/[:.]/g, "-")}`
const runDir = resolve(`.runtime/ai-painter/local-ai-failure-learning-r5-stage3-internal/${runId}`)

const authorization = readJson(AUTHORIZATION_PATH)
const consumption = readJson(CONSUMPTION_PATH)
const review = readJson(REVIEW_PATH)
const closure = readJson(CLOSURE_PATH)
const manifest = readJson(MANIFEST_PATH)
const baseProposal = readJson(BASE_PROPOSAL_PATH)
const selectionContract = readJson(SELECTION_CONTRACT_PATH)

validatePreflight()
fs.mkdirSync(runDir, { recursive: true })
appendEvent("r5_stage3_internal_failure_learning_started", "running", "four rejected previews; CPU only; checkpoint deserialize=false; GPU=false")

try {
  const sourceEvidence = {
    review: { path: REVIEW_PATH, sha256: REVIEW_SHA256 },
    closure: { path: CLOSURE_PATH, sha256: CLOSURE_SHA256 },
    manifest: { path: MANIFEST_PATH, sha256: MANIFEST_SHA256 },
    checkpointIdentity: { path: CHECKPOINT_PATH, sha256: CHECKPOINT_SHA256, fileHashedOnly: true, deserialized: false, loadedIntoModel: false },
    baseR5Proposal: { path: BASE_PROPOSAL_PATH, sha256: BASE_PROPOSAL_SHA256 },
    r5SelectionContract: { path: SELECTION_CONTRACT_PATH, sha256: SELECTION_CONTRACT_SHA256 },
  }
  const candidate = compileR5Stage3InternalCandidate({ review, closure, manifest, baseProposal, selectionContract, sourceEvidence })
  const candidateContract = validateR5Stage3InternalCandidate(candidate)
  const regression = runCpuRegression(candidate)
  const analysis = {
    schemaVersion: "ai-assisted-v7-r5-stage3-internal-failure-analysis-v1",
    status: "four_r5_rejections_analyzed_path_coverage_boundary_candidate_ready",
    generatedAtUtc: now,
    generatedAtAsiaShanghai: formatShanghai(now),
    fixedStageNumber: 3,
    addsNewFixedStage: false,
    failureAnalysis: candidate.failureAnalysis,
    evidenceReadOnly: true,
    originalEvidenceModified: false,
    reviewThresholdsModified: false,
    checkpointDeserialized: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    gpuTrainingStarted: false,
  }
  const regressionPath = path.join(runDir, "cpu-positive-negative-regression.json")
  const analysisPath = path.join(runDir, "failure-analysis.json")
  writeImmutableJson(analysisPath, analysis)
  writeImmutableJson(regressionPath, regression)
  const storedCandidate = {
    ...candidate,
    status: "isolated_stage3_internal_candidate_cpu_verified_not_implemented_not_active",
    candidateContract,
    cpuRegression: { path: projectPath(regressionPath), sha256: sha256File(regressionPath), status: regression.status },
    failureAnalysisEvidence: { path: projectPath(analysisPath), sha256: sha256File(analysisPath) },
    ownerAuthorization: { path: AUTHORIZATION_PATH, sha256: AUTHORIZATION_SHA256, consumptionPath: CONSUMPTION_PATH, consumptionSha256: CONSUMPTION_SHA256, commandRef: COMMAND_REF, scope: SCOPE },
  }
  writeImmutableJson(resolve(CANDIDATE_PATH), storedCandidate)
  const terminal = {
    schemaVersion: "local-ai-v7-r5-stage3-internal-failure-learning-terminal-v1",
    status: "r5_stage3_internal_candidate_cpu_verified_stopped_without_checkpoint_load_or_training",
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
    nextIndependentAuthorization: "r5_stage3_internal_candidate_trainer_support_and_cpu_regression_only",
  }
  const terminalPath = path.join(runDir, "phase-terminal.json")
  writeImmutableJson(terminalPath, terminal)
  appendEvent("r5_stage3_internal_failure_learning_completed", "success", "candidate CPU verified; checkpoint=false; optimizer=false; GPU=false", projectPath(terminalPath))
  console.log(JSON.stringify({ ...terminal, terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }, null, 2))
} catch (error) {
  const terminal = {
    schemaVersion: "local-ai-v7-r5-stage3-internal-failure-learning-terminal-v1",
    status: "r5_stage3_internal_failure_learning_failed_closed",
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
  writeImmutableJson(terminalPath, terminal)
  appendEvent("r5_stage3_internal_failure_learning_failed", "failed", terminal.blockers.join(","), projectPath(terminalPath))
  console.error(JSON.stringify(terminal, null, 2))
  process.exitCode = 1
}

function runCpuRegression(candidate) {
  const positiveCoverage = runCoverageBoundaryCpuRegression({
    expectedMask: [0, 0, 1, 1, 0, 0, 0, 0],
    predictedMask: [0, 1, 1, 1, 1, 0, 0, 0],
    boundary: { allowedSides: ["south"], predictedSideSignals: { north: 0, east: 0, south: 0.8, west: 0 } },
  })
  const compliant = runCoverageBoundaryCpuRegression({
    expectedMask: [0, 0, 1, 1, 0, 0, 0, 0],
    predictedMask: [0, 0, 1, 1, 0, 0, 0, 0],
    boundary: { allowedSides: ["south"], predictedSideSignals: { north: 0, east: 0, south: 0.8, west: 0 } },
  })
  const unauthorizedBoundary = runCoverageBoundaryCpuRegression({
    expectedMask: [0, 0, 1, 1, 0, 0, 0, 0],
    predictedMask: [0, 0, 1, 1, 0, 0, 0, 0],
    boundary: { allowedSides: ["south"], predictedSideSignals: { north: 0.4, east: 0.2, south: 0.8, west: 0.3 } },
  })
  assert(positiveCoverage.coverageExcessLoss > 0 && positiveCoverage.unauthorizedBoundaryLoss === 0, "r5_stage3_coverage_positive_regression_failed")
  assert(compliant.totalLoss === 0, "r5_stage3_compliant_target_not_zero")
  assert(unauthorizedBoundary.coverageExcessLoss === 0 && unauthorizedBoundary.unauthorizedBoundaryLoss > 0, "r5_stage3_boundary_positive_regression_failed")
  const negative = {
    failedPreviewTargetRejected: expectCandidateRejected(candidate, (value) => { value.proposal.pathHardExampleReplayProposal.failedPreviewPixelsUsedAsTrainingTargets = true }, "r5_stage3_failed_preview_used_as_target"),
    reviewThresholdChangeRejected: expectCandidateRejected(candidate, (value) => { value.proposal.smokeStabilityGate.preserveReviewThresholds = false }, "r5_stage3_review_thresholds_changed"),
    checkpointActivationRejected: expectCandidateRejected(candidate, (value) => { value.proposal.ownerTrainingAuthorization.checkpointLoadingAuthorized = true }, "r5_stage3_candidate_improperly_authorizes_checkpointLoadingAuthorized"),
    executionValueSelectionRejected: expectCandidateRejected(candidate, (value) => { value.proposal.pathCoverageCalibrationProposal.weight.selectedValue = 0.5 }, "r5_stage3_execution_value_selected_without_authorization"),
    objectWeightChangeRejected: expectCandidateRejected(candidate, (value) => { value.proposal.objectSemanticStabilityProposal.selectedWeightChanges = { object_tree: 2 } }, "r5_stage3_object_weights_changed"),
    invalidRangeRejected: expectCandidateRejected(candidate, (value) => { value.proposal.authorizedBoundaryTopologyProposal.weight = { minimum: 1, maximum: 0.5, selectedValue: null } }, "r5_stage3_bounded_range_invalid"),
    newFixedStageRejected: expectCandidateRejected(candidate, (value) => { value.promotionBoundary.addsNewFixedStage = true }, "r5_stage3_fixed_plan_boundary_invalid"),
  }
  return {
    schemaVersion: "ai-assisted-v7-r5-stage3-internal-cpu-regression-v1",
    status: "passed_cpu_only_candidate_not_active_no_checkpoint_load_no_training",
    device: "cpu",
    positive: {
      candidateContractAccepted: true,
      excessCoverageProducesPositiveLoss: positiveCoverage.coverageExcessLoss > 0,
      compliantCoverageAndAuthorizedBoundaryProduceZeroLoss: compliant.totalLoss === 0,
      unauthorizedBoundaryProducesPositiveLoss: unauthorizedBoundary.unauthorizedBoundaryLoss > 0,
      authorizedSouthBoundaryNotPenalized: positiveCoverage.unauthorizedBoundaryLoss === 0,
    },
    negative,
    measured: { positiveCoverage, compliant, unauthorizedBoundary },
    boundaries: { sourceEvidenceModified: false, reviewThresholdsModified: false, checkpointDeserialized: false, checkpointLoaded: false, optimizerCreated: false, gpuTrainingStarted: false, fullTrainingStarted: false, strictRevalidationStarted: false, formalInferenceStarted: false, runtimeFrameStarted: false, worldEntered: false },
  }
}

function expectCandidateRejected(candidate, mutate, expected) {
  const copy = structuredClone(candidate)
  mutate(copy)
  try { validateR5Stage3InternalCandidate(copy) } catch (error) { assert(String(error.message).includes(expected), `unexpected rejection:${error.message}`); return true }
  throw new Error(`expected rejection:${expected}`)
}

function validatePreflight() {
  const checks = [
    [fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r5_stage3_authorization_hash_invalid"],
    [fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r5_stage3_consumption_hash_invalid"],
    [authorization?.status === "resolved_owner_authorized", "r5_stage3_authorization_not_resolved"],
    [authorization?.ownerDecision?.commandRef === COMMAND_REF && authorization?.ownerDecision?.scope === SCOPE, "r5_stage3_authorization_identity_invalid"],
    [consumption?.status === "consumed_before_authorized_write" && consumption?.authorizationSha256 === AUTHORIZATION_SHA256, "r5_stage3_authorization_not_consumed"],
    [fileHashMatches(REVIEW_PATH, REVIEW_SHA256), "r5_stage3_review_changed"],
    [fileHashMatches(CLOSURE_PATH, CLOSURE_SHA256), "r5_stage3_closure_changed"],
    [fileHashMatches(MANIFEST_PATH, MANIFEST_SHA256), "r5_stage3_manifest_changed"],
    [fileHashMatches(CHECKPOINT_PATH, CHECKPOINT_SHA256), "r5_stage3_checkpoint_identity_changed"],
    [fileHashMatches(BASE_PROPOSAL_PATH, BASE_PROPOSAL_SHA256), "r5_stage3_base_proposal_changed"],
    [fileHashMatches(SELECTION_CONTRACT_PATH, SELECTION_CONTRACT_SHA256), "r5_stage3_selection_contract_changed"],
    [!fs.existsSync(resolve(CANDIDATE_PATH)), "r5_stage3_candidate_already_exists"],
    [!fs.existsSync(runDir), "r5_stage3_run_already_exists"],
  ]
  for (const [ok, code] of checks) assert(ok, code)
  for (const key of ["failureEvidenceReadAuthorized", "stage3InternalCandidateCompilationAuthorized", "cpuPositiveNegativeRegressionAuthorized", "immutableEvidenceStorageAuthorized", "automaticTerminalStorageAuthorized"]) assert(authorization.resolution?.[key] === true, `r5_stage3_${key}_missing`)
  for (const key of ["sourceEvidenceModificationAuthorized", "reviewThresholdChangeAuthorized", "checkpointDeserializationAuthorized", "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "gpuTrainingAuthorized", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) assert(authorization.resolution?.[key] === false, `r5_stage3_boundary_${key}_invalid`)
}

function appendEvent(kind, status, detail, evidencePath = null) { appendAiPainterProgramEvent({ action: "run_local_ai_v7_r5_stage3_internal_failure_learning", runId, kind, status, title: kind.replaceAll("_", " "), titleZh: `本地AI V7 R5第3阶段内部失败学习：${kind}`, detail, detailZh: detail, script: "scripts/run-local-ai-v7-r5-stage3-internal-failure-learning.mjs", currentStep: kind, evidencePath, finalGameMapSuccess: false, canEnterWorld: false }) }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function writeImmutableJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return fs.existsSync(absolute) && sha256File(absolute) === expected }
function assert(condition, message) { if (!condition) throw new Error(message) }
