import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  compileR5CandidateProposal,
  evaluateR5TailGate,
  validateR5CandidateProposal,
} from "./lib/ai-assisted-v7-r5-candidate.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-action-request-v7-r5-candidate-proposal-cpu-regression-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "ec0e9bc655be17af20731a7578972c5a26811479f5fa06f438fe3dd377f38db1"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "30a0881b812171c03bc302f80e8d30bc589d11eb3149f703e45f99b30c7fa3d0"
const COMMAND_REF = "owner-authorized-r4-nine-failures-to-r5-proposal-cpu-regression-20260804"
const SCOPE = "analyze_nine_r4_rejected_previews_and_generate_isolated_r5_bounded_candidate_proposal_with_cpu_regression_only"
const FINALIZATION_PATH = ".runtime/ai-painter/v7-bounded-repair-r4-overfit-smoke-finalizations/ai-assisted-v7-r4-random-init-overfit-smoke-finalization-2026-08-04T07-49-43-831Z/finalization-report.json"
const FINALIZATION_SHA256 = "0b8caa1125801f63f797ae2747d634e7aa2b3167de270d76b817e00fdf77084a"
const REVIEW_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r4/ai-assisted-v7-repair-r4-random-init-single-sample-overfit-smoke-2026-08-04T07-49-43-831Z/fixed-preview-hard-gate-review.json"
const REVIEW_SHA256 = "b5244d0f37a982485c4c29aceaa1fc1e22645cc10139f39b5875a3b29c6c74b4"
const MANIFEST_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r4/ai-assisted-v7-repair-r4-random-init-single-sample-overfit-smoke-2026-08-04T07-49-43-831Z/manifest.json"
const MANIFEST_SHA256 = "621215b5b33ab0c8bf34afa569a72f243b847742b876e576937741a64fe31bd6"
const CHECKPOINT_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r4/ai-assisted-v7-repair-r4-random-init-single-sample-overfit-smoke-2026-08-04T07-49-43-831Z/complete-world-ai-assisted-conditional-denoiser.pt"
const CHECKPOINT_SHA256 = "a8cd24d1be1a1128b2cb487ce72a487218bd9b165adddde31f9caba81ca69a32"
const DERIVED_CONFIG_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r4/derived-configs/ai-assisted-v7-repair-r4-random-init-single-sample-overfit-smoke-2026-08-04T07-49-43-831Z.json"
const DERIVED_CONFIG_SHA256 = "50dd0eabf456f3be45400d3923988d5c43364c7424067b8326ab9a75b8c50f3e"
const R4_CANDIDATE_CONTRACT_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r4-isolated-smoke-candidate-contract.json"
const R4_CANDIDATE_CONTRACT_SHA256 = "7e09f07b329c158d0fc5a60c52a77734a85f387b1779bbecb111073e0ffa04a6"
const R5_CANDIDATE_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r5-candidate-proposal.json"
const OUTPUT_ROOT = ".runtime/ai-painter/local-ai-failure-learning-r5-candidates"
const now = new Date().toISOString()
const runId = `local-ai-v7-r5-candidate-proposal-${now.replace(/[:.]/g, "-")}`
const runDir = resolve(OUTPUT_ROOT, runId)
const registrationPath = resolve(OUTPUT_ROOT, "registrations", `${REQUEST_ID}.json`)

verifyAuthorizationAndSources()
writeImmutableJson(registrationPath, {
  schemaVersion: "local-ai-v7-r5-candidate-proposal-start-v1",
  runId,
  requestId: REQUEST_ID,
  status: "registered_before_failure_analysis_and_candidate_write",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
  sourceFailedPreviewCount: 9,
  trainingStarted: false,
})
appendEvent("local_ai_v7_r5_candidate_proposal_started", "running", "analyze nine R4 failures and compile proposal only; training=false")

try {
  fs.mkdirSync(runDir, { recursive: true })
  const finalization = readJson(FINALIZATION_PATH)
  const review = readJson(REVIEW_PATH)
  const manifest = readJson(MANIFEST_PATH)
  const derivedConfig = readJson(DERIVED_CONFIG_PATH)
  const candidateDraft = compileR5CandidateProposal({
    finalization,
    review,
    manifest,
    derivedConfig,
    sourceEvidence: {
      finalization: { path: FINALIZATION_PATH, sha256: FINALIZATION_SHA256 },
      review: { path: REVIEW_PATH, sha256: REVIEW_SHA256 },
      manifest: { path: MANIFEST_PATH, sha256: MANIFEST_SHA256 },
      checkpoint: { path: CHECKPOINT_PATH, sha256: CHECKPOINT_SHA256 },
      derivedConfig: { path: DERIVED_CONFIG_PATH, sha256: DERIVED_CONFIG_SHA256 },
      r4CandidateContract: { path: R4_CANDIDATE_CONTRACT_PATH, sha256: R4_CANDIDATE_CONTRACT_SHA256 },
    },
  })
  const analysisPath = path.join(runDir, "r4-failure-learning-analysis.json")
  const analysis = {
    schemaVersion: "local-ai-v7-r4-to-r5-failure-learning-analysis-v1",
    status: "nine_r4_failures_analyzed_r5_candidate_ready",
    generatedBy: "local_ai_v7_r5_failure_learning_candidate_compiler",
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    sourceRunId: finalization.runId,
    sourceStatus: finalization.status,
    failureAnalysis: candidateDraft.failureAnalysis,
    selectedRepairDirection: {
      id: "checkpoint_continuation_path_trajectory_stability",
      reason: "R4 path weights reached their bound and the final preview passed, but path failures recurred at epochs 100 and 110",
      failedPreviewPixelsUsedAsTrainingTargets: false,
      objectWeightIncreaseSelected: false,
      reviewThresholdChangeSelected: false,
    },
    trainingStarted: false,
  }
  writeImmutableJson(analysisPath, analysis)
  const draftPath = path.join(runDir, "r5-candidate-proposal-draft.json")
  writeImmutableJson(draftPath, candidateDraft)

  const contract = validateR5CandidateProposal(candidateDraft)
  const sourceTail = evaluateR5TailGate(review.reviews.filter((row) => [100, 110, 120].includes(Number(row.epoch))))
  const positiveTail = evaluateR5TailGate([
    { epoch: 140, passed: true, issueCodes: [] },
    { epoch: 150, passed: true, issueCodes: [] },
    { epoch: 160, passed: true, issueCodes: [] },
  ])
  const pathNegativeTail = evaluateR5TailGate([
    { epoch: 140, passed: true, issueCodes: [] },
    { epoch: 150, passed: false, issueCodes: ["condition_terrain_path_ground_uncontracted_boundary_contact"] },
    { epoch: 160, passed: true, issueCodes: [] },
  ])
  const objectNegativeTail = evaluateR5TailGate([
    { epoch: 140, passed: true, issueCodes: [] },
    { epoch: 150, passed: false, issueCodes: ["condition_object_rock_reference_semantic_mismatch"] },
    { epoch: 160, passed: true, issueCodes: [] },
  ])
  const missingTail = evaluateR5TailGate([
    { epoch: 150, passed: true, issueCodes: [] },
    { epoch: 160, passed: true, issueCodes: [] },
  ])
  const negativeContract = {
    selectedContinuationRejected: expectCandidateMutationRejected(candidateDraft, (value) => {
      value.proposal.checkpointContinuationProposal.continuationEpochs.selectedValue = 40
    }),
    failedPreviewTargetRejected: expectCandidateMutationRejected(candidateDraft, (value) => {
      value.proposal.pathHardExampleReplayProposal.failedPreviewPixelsUsedAsTrainingTargets = true
    }),
    reviewThresholdMutationRejected: expectCandidateMutationRejected(candidateDraft, (value) => {
      value.proposal.smokeStabilityGate.preserveReviewThresholds = false
    }),
    gpuAuthorizationRejected: expectCandidateMutationRejected(candidateDraft, (value) => {
      value.proposal.ownerTrainingAuthorization.gpuTrainingAuthorizedNow = true
    }),
  }
  const cpuRegression = {
    schemaVersion: "ai-assisted-v7-r5-candidate-proposal-cpu-regression-v1",
    status: "passed_cpu_only_proposal_not_implemented_no_training",
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    device: "cpu",
    candidateContract: contract,
    positiveRegression: {
      sourceFailureCountsExact: candidateDraft.failureAnalysis.failedPreviewCount === 9 && candidateDraft.failureAnalysis.passedPreviewCount === 1,
      sourceQualityImproved: candidateDraft.failureAnalysis.checkpointSelectionScoreImproved === true,
      sourceTailCorrectlyFails: sourceTail.passed === false,
      syntheticThreePassTailAccepted: positiveTail.passed === true,
      objectWeightsPreserved: candidateDraft.proposal.objectSemanticStabilityProposal.selectedWeightChanges == null,
      r4PathWeightsNotBlindlyIncreased: candidateDraft.proposal.preserveR4PathLossWeights.increaseBeyondR4BoundSelected === false,
    },
    negativeRegression: {
      ...negativeContract,
      pathRecurrenceRejected: pathNegativeTail.passed === false,
      objectRecurrenceRejected: objectNegativeTail.passed === false,
      missingTailRejected: missingTail.passed === false,
    },
    tailGateRegression: { sourceTail, positiveTail, pathNegativeTail, objectNegativeTail, missingTail },
    optimizerCreated: false,
    modelWeightsModified: false,
    candidateActivated: false,
    checkpointLoaded: false,
    gpuTrainingStarted: false,
    validationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntered: false,
  }
  assert(Object.values(cpuRegression.positiveRegression).every(Boolean), "r5_positive_cpu_regression_failed")
  assert(Object.values(cpuRegression.negativeRegression).every(Boolean), "r5_negative_cpu_regression_failed")
  const cpuPath = path.join(runDir, "cpu-positive-negative-regression.json")
  writeImmutableJson(cpuPath, cpuRegression)

  const candidate = {
    ...candidateDraft,
    status: "isolated_candidate_proposal_cpu_verified_not_implemented_not_active",
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    failureLearningEvidence: { path: projectPath(analysisPath), sha256: sha256File(analysisPath) },
    cpuRegressionEvidence: { path: projectPath(cpuPath), sha256: sha256File(cpuPath), status: cpuRegression.status },
  }
  validateR5CandidateProposal(candidate)
  writeImmutableJson(R5_CANDIDATE_PATH, candidate)
  const sourcesAfter = captureSourceHashes()
  assert(sourcesAfter.finalization === FINALIZATION_SHA256, "r5_source_finalization_modified")
  assert(sourcesAfter.review === REVIEW_SHA256, "r5_source_review_modified")
  assert(sourcesAfter.manifest === MANIFEST_SHA256, "r5_source_manifest_modified")
  assert(sourcesAfter.checkpoint === CHECKPOINT_SHA256, "r5_source_checkpoint_modified")
  assert(sourcesAfter.derivedConfig === DERIVED_CONFIG_SHA256, "r5_source_config_modified")
  assert(sourcesAfter.r4CandidateContract === R4_CANDIDATE_CONTRACT_SHA256, "r5_source_r4_contract_modified")

  const terminal = {
    schemaVersion: "local-ai-v7-r5-candidate-proposal-terminal-v1",
    status: "r5_candidate_proposal_cpu_verified_stopped_without_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r5_failure_learning_candidate_compiler",
    candidate: { path: R5_CANDIDATE_PATH, sha256: sha256File(R5_CANDIDATE_PATH), implemented: false, active: false },
    failureLearning: { path: projectPath(analysisPath), sha256: sha256File(analysisPath), failedPreviewCount: 9 },
    cpuRegression: { path: projectPath(cpuPath), sha256: sha256File(cpuPath), status: cpuRegression.status },
    immutableSourcesAfter: sourcesAfter,
    closure: {
      nineFailureEvidenceAnalyzed: true,
      boundedR5CandidateProposalGenerated: true,
      cpuPositiveNegativeRegressionPassed: true,
      r4Retried: false,
      trainerImplemented: false,
      candidateActivated: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      validationStarted: false,
      formalInferenceStarted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextState: "waiting_for_owner_authorization_of_r5_trainer_support_and_cpu_regression_only",
    },
  }
  const stored = writeImmutableProgramRun({
    root: OUTPUT_ROOT,
    runId,
    fileName: "phase-terminal.json",
    record: terminal,
    latest: {
      status: terminal.status,
      candidatePath: R5_CANDIDATE_PATH,
      candidateSha256: terminal.candidate.sha256,
      cpuRegressionPassed: true,
      trainingStarted: false,
      nextState: terminal.closure.nextState,
    },
  })
  appendEvent("local_ai_v7_r5_candidate_proposal_completed", "success", "R5 proposal and CPU regression completed; training=false", stored.runPath)
  console.log(JSON.stringify({
    status: terminal.status,
    reportPath: stored.runPath,
    reportSha256: sha256File(stored.runPath),
    candidatePath: R5_CANDIDATE_PATH,
    candidateSha256: terminal.candidate.sha256,
    failureLearningPath: terminal.failureLearning.path,
    cpuRegressionPath: terminal.cpuRegression.path,
    sourceFailedPreviewCount: 9,
    trainingStarted: false,
    nextState: terminal.closure.nextState,
  }, null, 2))
} catch (error) {
  const terminal = {
    schemaVersion: "local-ai-v7-r5-candidate-proposal-terminal-v1",
    status: "r5_candidate_proposal_failed_closed_without_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    blockers: [String(error?.message ?? error)],
    r4Retried: false,
    trainerImplemented: false,
    candidateActivated: false,
    optimizerCreated: false,
    modelWeightsModified: false,
    gpuTrainingStarted: false,
    validationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntered: false,
  }
  const stored = writeImmutableProgramRun({
    root: OUTPUT_ROOT,
    runId,
    fileName: "phase-terminal.json",
    record: terminal,
    latest: { status: terminal.status, blockers: terminal.blockers, trainingStarted: false },
  })
  appendEvent("local_ai_v7_r5_candidate_proposal_failed", "failed", terminal.blockers.join(","), stored.runPath)
  console.error(JSON.stringify({ ...terminal, reportPath: stored.runPath, reportSha256: sha256File(stored.runPath) }, null, 2))
  process.exitCode = 1
}

function expectCandidateMutationRejected(source, mutate) {
  const value = structuredClone(source)
  mutate(value)
  try {
    validateR5CandidateProposal(value)
  } catch {
    return true
  }
  throw new Error("r5_negative_candidate_mutation_was_not_rejected")
}

function verifyAuthorizationAndSources() {
  assert(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r5_authorization_hash_invalid")
  assert(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r5_consumption_hash_invalid")
  const authorization = readJson(AUTHORIZATION_PATH)
  const consumption = readJson(CONSUMPTION_PATH)
  assert(authorization.status === "resolved_owner_authorized", "r5_authorization_not_resolved")
  assert(authorization.ownerDecision?.commandRef === COMMAND_REF && authorization.ownerDecision?.scope === SCOPE, "r5_authorization_identity_invalid")
  assert(consumption.status === "consumed_before_authorized_write", "r5_authorization_not_consumed")
  assert(consumption.commandRef === COMMAND_REF && consumption.scope === SCOPE, "r5_consumption_identity_invalid")
  for (const key of ["failureEvidenceAnalysisAuthorized", "isolatedR5CandidateProposalAuthorized", "cpuPositiveNegativeRegressionAuthorized", "automaticTerminalStorageAuthorized"]) {
    assert(authorization.resolution?.[key] === true, `r5_${key}_missing`)
  }
  for (const key of ["r4RetryAuthorized", "r5TrainerImplementationAuthorized", "candidateActivationAuthorized", "gpuTrainingAuthorized", "validationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) {
    assert(authorization.resolution?.[key] === false, `r5_boundary_${key}_invalid`)
  }
  assert(fileHashMatches(FINALIZATION_PATH, FINALIZATION_SHA256), "r5_finalization_hash_invalid")
  assert(fileHashMatches(REVIEW_PATH, REVIEW_SHA256), "r5_review_hash_invalid")
  assert(fileHashMatches(MANIFEST_PATH, MANIFEST_SHA256), "r5_manifest_hash_invalid")
  assert(fileHashMatches(CHECKPOINT_PATH, CHECKPOINT_SHA256), "r5_checkpoint_hash_invalid")
  assert(fileHashMatches(DERIVED_CONFIG_PATH, DERIVED_CONFIG_SHA256), "r5_derived_config_hash_invalid")
  assert(fileHashMatches(R4_CANDIDATE_CONTRACT_PATH, R4_CANDIDATE_CONTRACT_SHA256), "r5_r4_contract_hash_invalid")
  assert(!fs.existsSync(resolve(R5_CANDIDATE_PATH)), "r5_candidate_already_exists")
  assert(!fs.existsSync(registrationPath), "r5_authorization_already_started")
}

function captureSourceHashes() {
  return {
    finalization: sha256File(FINALIZATION_PATH),
    review: sha256File(REVIEW_PATH),
    manifest: sha256File(MANIFEST_PATH),
    checkpoint: sha256File(CHECKPOINT_PATH),
    derivedConfig: sha256File(DERIVED_CONFIG_PATH),
    r4CandidateContract: sha256File(R4_CANDIDATE_CONTRACT_PATH),
  }
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_local_ai_v7_r5_candidate_proposal",
    runId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `本地AI V7 R5候选提案：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/run-local-ai-v7-r5-candidate-proposal.mjs",
    currentStep: kind,
    evidencePath,
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
}

function resolve(...values) { return path.resolve(ROOT, ...values) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { return Boolean(fs.existsSync(resolve(value)) && sha256File(value) === expected) }
function writeImmutableJson(target, value) {
  const absolute = resolve(target)
  assert(!fs.existsSync(absolute), `immutable_output_already_exists:${projectPath(absolute)}`)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  const handle = fs.openSync(absolute, "wx")
  try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) }
}
function assert(condition, message) { if (!condition) throw new Error(message) }
