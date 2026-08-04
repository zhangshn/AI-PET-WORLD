import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { analyzeFailureLearningLoop } from "./lib/ai-assisted-failure-learning-loop.mjs"
import {
  compileR4CandidateProposal,
  evaluateR4TailStability,
  R4_CANDIDATE_VERSION,
  R4_TAIL_EPOCHS,
} from "./lib/ai-assisted-v7-r4-candidate.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-action-request-v7-r4-candidate-proposal-cpu-regression-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "6cc894ba1237e002ab3803008ca2e659235c87d4cbdfc4b73966b02f1a02e1d2"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "963f7fff0074eaefd5be6c4630d0ab1311abd17fa7e42aad4e3abc338fd98063"
const COMMAND_REF = "owner-authorized-v7-r4-candidate-proposal-cpu-regression-20260804"
const SCOPE = "local_ai_v7_r3_failure_evidence_to_r4_isolated_candidate_proposal_and_cpu_regression_only"
const CLOSURE_REPORT_PATH = ".runtime/ai-painter/v7-bounded-repair-r3-offline-closures/ai-assisted-v7-r3-existing-smoke-offline-closure-2026-08-04T06-23-28-275Z/closure-report.json"
const CLOSURE_REPORT_SHA256 = "ef1a76cfb9f7f379b49103cb30a47c7c56cbc3ba2350c173fbf7ef69610632df"
const REVIEW_PATH = ".runtime/ai-painter/v7-bounded-repair-r3-offline-closures/ai-assisted-v7-r3-existing-smoke-offline-closure-2026-08-04T06-23-28-275Z/fixed-preview-hard-gate-review.json"
const REVIEW_SHA256 = "5d132b235a6893abf2a3edec073593c327f3148676343d35fc94804a29d1e2e5"
const R3_CANDIDATE_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r3-candidate-overlay.json"
const R3_CANDIDATE_SHA256 = "6c013e05a36c85646b18fde12b5573049be8ea1703c47899f54956d468a2a501"
const R2_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r2-training-overlay.json"
const R2_SHA256 = "888393b34fe24e588c83be7e9981f08739f2c6b85228584af57135d5889d7a6d"
const SOURCE_MANIFEST_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r3/ai-assisted-v7-repair-r3-random-init-single-sample-overfit-smoke-2026-08-04T05-57-12-288Z/manifest.json"
const SOURCE_MANIFEST_SHA256 = "a1e6f6120a9f4fa2a25592d2fb9962fb1783254366bad72f6767b21caec56735"
const R4_CANDIDATE_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r4-candidate-proposal.json"
const OUTPUT_ROOT = ".runtime/ai-painter/local-ai-failure-learning-r4-candidates"
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const CPU_CHECK = "ml/ai-painter/scripts/check_ai_assisted_v7_r4_candidate_proposal_cpu_regression.py"
const now = new Date().toISOString()
const runId = `local-ai-v7-r4-candidate-proposal-${now.replace(/[:.]/g, "-")}`
const runDir = path.resolve(ROOT, OUTPUT_ROOT, runId)
const startPath = path.resolve(ROOT, OUTPUT_ROOT, "registrations", `${REQUEST_ID}.json`)

verifyAuthorizationAndEvidence()
writeImmutableJson(startPath, {
  schemaVersion: "local-ai-v7-r4-candidate-proposal-start-v1",
  runId,
  requestId: REQUEST_ID,
  status: "registered_before_candidate_or_regression_write",
  registeredAtUtc: now,
  registeredAtAsiaShanghai: formatShanghai(now),
  sourceClosureReportPath: CLOSURE_REPORT_PATH,
  sourceClosureReportSha256: CLOSURE_REPORT_SHA256,
  sourceReviewPath: REVIEW_PATH,
  sourceReviewSha256: REVIEW_SHA256,
  sourceR3CandidatePath: R3_CANDIDATE_PATH,
  sourceR3CandidateSha256: R3_CANDIDATE_SHA256,
  trainingStarted: false,
})
appendEvent("local_ai_v7_r4_candidate_proposal_started", "running", "proposal and CPU regression only; training=false")

try {
  const closure = readJson(CLOSURE_REPORT_PATH)
  const review = readJson(REVIEW_PATH)
  const manifest = readJson(SOURCE_MANIFEST_PATH)
  const r3Candidate = readJson(R3_CANDIDATE_PATH)
  const metricsByEpoch = new Map(manifest.metrics.map((row) => [Number(row.epoch), row]))
  const normalizedReview = {
    ...review,
    runId: closure.sourceRunId,
    reviews: review.reviews.map((row) => {
      const metric = metricsByEpoch.get(Number(row.epoch))
      assert(metric?.recordedAtUtc && metric?.recordedAtAsiaShanghai, `r4_epoch_${row.epoch}_timestamp_missing_in_manifest`)
      return {
        ...row,
        recordedAtUtc: metric.recordedAtUtc,
        recordedAtAsiaShanghai: metric.recordedAtAsiaShanghai,
        previewPath: row.normalizedReviewImagePath,
        previewSha256: row.normalizedReviewImageSha256,
      }
    }),
  }
  const failureLearningReport = {
    ...analyzeFailureLearningLoop({
      review: normalizedReview,
      finalization: { runId: closure.sourceRunId, status: closure.status },
      overlay: r3Candidate,
      proposedBoundedRepairVersion: R4_CANDIDATE_VERSION,
      sourcePaths: [
        { path: CLOSURE_REPORT_PATH, sha256: CLOSURE_REPORT_SHA256 },
        { path: REVIEW_PATH, sha256: REVIEW_SHA256 },
        { path: SOURCE_MANIFEST_PATH, sha256: SOURCE_MANIFEST_SHA256 },
        { path: R3_CANDIDATE_PATH, sha256: R3_CANDIDATE_SHA256 },
      ],
    }),
    analysisId: runId,
    createdAtUtc: now,
    createdAtAsiaShanghai: formatShanghai(now),
    generatedBy: "local_ai_failure_learning_r4_candidate_proposal_program",
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    automaticStorage: true,
  }
  assert(failureLearningReport.summary.failedPreviewCount === 8, "r4_expected_eight_failed_previews")
  assert(failureLearningReport.summary.passedPreviewCount === 2, "r4_expected_two_passed_previews")
  const candidateDraft = {
    ...compileR4CandidateProposal({
      r3Candidate,
      failureLearningReport,
      sourceEvidence: {
        r3Candidate: { path: R3_CANDIDATE_PATH, sha256: R3_CANDIDATE_SHA256 },
        failureLearningReport: { path: `${projectPath(runDir)}/failure-learning-report.json`, sha256: null },
        offlineClosure: { path: CLOSURE_REPORT_PATH, sha256: CLOSURE_REPORT_SHA256 },
        previewReview: { path: REVIEW_PATH, sha256: REVIEW_SHA256 },
      },
    }),
    compiledAtUtc: now,
    compiledAtAsiaShanghai: formatShanghai(now),
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
  }
  fs.mkdirSync(runDir, { recursive: true })
  const analysisPath = path.join(runDir, "failure-learning-report.json")
  writeImmutableJson(analysisPath, failureLearningReport)
  candidateDraft.sourceFailureLearningReport.sha256 = sha256File(analysisPath)
  const draftPath = path.join(runDir, "r4-candidate-proposal-draft.json")
  writeImmutableJson(draftPath, candidateDraft)

  const cpuRegressionPath = path.join(runDir, "cpu-synthetic-regression.json")
  const cpu = spawnSync(resolve(PYTHON), [
    resolve(CPU_CHECK),
    "--base-config", resolve(r3Candidate.baseConfigPath),
    "--r3-candidate", resolve(R3_CANDIDATE_PATH),
    "--r4-proposal", draftPath,
    "--output", cpuRegressionPath,
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTHONUTF8: "1", PYTHONPATH: path.resolve(ROOT, "ml/ai-painter/src") },
    windowsHide: true,
  })
  assert(cpu.status === 0, `r4_candidate_cpu_regression_failed:${cpu.stderr || cpu.stdout}`)
  const cpuRegression = readJson(cpuRegressionPath)
  assert(cpuRegression.status === "passed_cpu_only_proposal_not_implemented_no_training", "r4_cpu_regression_status_invalid")

  const sourceTail = evaluateR4TailStability(normalizedReview.reviews, candidateDraft.proposal)
  const positiveTail = evaluateR4TailStability(R4_TAIL_EPOCHS.map((epoch) => ({ epoch, passed: true, issueCodes: [] })), candidateDraft.proposal)
  const negativeTail = evaluateR4TailStability([
    { epoch: 100, passed: true, issueCodes: [] },
    { epoch: 110, passed: false, issueCodes: ["condition_terrain_path_ground_uncontracted_boundary_contact"] },
    { epoch: 120, passed: true, issueCodes: [] },
  ], candidateDraft.proposal)
  assert(sourceTail.passed === false, "r4_source_failed_evidence_must_remain_failed")
  assert(positiveTail.passed === true, "r4_positive_tail_regression_failed")
  assert(negativeTail.passed === false, "r4_negative_tail_regression_failed")

  const candidate = {
    ...candidateDraft,
    status: "isolated_candidate_proposal_cpu_verified_not_implemented_not_active",
    cpuRegressionEvidence: {
      path: projectPath(cpuRegressionPath),
      sha256: sha256File(cpuRegressionPath),
      status: cpuRegression.status,
    },
    failureLearningEvidence: {
      path: projectPath(analysisPath),
      sha256: sha256File(analysisPath),
    },
  }
  writeImmutableJson(resolve(R4_CANDIDATE_PATH), candidate)
  const sourceHashesAfter = captureSourceHashes()
  assert(sourceHashesAfter.r2 === R2_SHA256, "r4_r2_evidence_modified")
  assert(sourceHashesAfter.r3 === R3_CANDIDATE_SHA256, "r4_r3_candidate_modified")
  assert(sourceHashesAfter.closure === CLOSURE_REPORT_SHA256, "r4_closure_evidence_modified")
  assert(sourceHashesAfter.review === REVIEW_SHA256, "r4_review_evidence_modified")
  assert(sourceHashesAfter.manifest === SOURCE_MANIFEST_SHA256, "r4_manifest_modified")

  const terminal = {
    schemaVersion: "local-ai-v7-r4-candidate-proposal-terminal-v1",
    status: "r4_candidate_proposal_cpu_verified_waiting_separate_trainer_implementation_authorization",
    runId,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_failure_learning_r4_candidate_proposal_program",
    candidate: {
      path: R4_CANDIDATE_PATH,
      sha256: sha256File(R4_CANDIDATE_PATH),
      proposalOnly: true,
      implemented: false,
      active: false,
      trainingAuthorized: false,
    },
    failureLearning: {
      path: projectPath(analysisPath),
      sha256: sha256File(analysisPath),
      failedPreviewCount: failureLearningReport.summary.failedPreviewCount,
      passedPreviewCount: failureLearningReport.summary.passedPreviewCount,
      issueClusters: failureLearningReport.issueClusters,
    },
    cpuRegression: {
      path: projectPath(cpuRegressionPath),
      sha256: sha256File(cpuRegressionPath),
      status: cpuRegression.status,
      positive: cpuRegression.positiveRegression,
      negative: cpuRegression.negativeRegression,
      measured: cpuRegression.measured,
    },
    tailStabilityRegression: {
      sourceR3Evidence: sourceTail,
      positiveSynthetic: positiveTail,
      negativeSynthetic: negativeTail,
    },
    sourceHashesAfter,
    closure: {
      failureEvidenceNormalized: true,
      boundedRepairContractGenerated: true,
      candidateProposalCompiled: true,
      cpuRegressionPassed: true,
      reviewThresholdsModified: false,
      trainerFormalConfigurationModified: false,
      modelWeightsModified: false,
      optimizerCreated: false,
      gpuTrainingStarted: false,
      validationStarted: false,
      formalInferenceStarted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextState: "waiting_for_owner_authorization_of_r4_trainer_implementation_and_non_training_regression",
    },
  }
  const stored = writeImmutableProgramRun({
    root: OUTPUT_ROOT,
    runId,
    fileName: "phase-terminal.json",
    record: terminal,
    latest: {
      status: terminal.status,
      candidatePath: R4_CANDIDATE_PATH,
      candidateSha256: terminal.candidate.sha256,
      cpuRegressionPassed: true,
      trainingStarted: false,
      nextState: terminal.closure.nextState,
    },
  })
  appendEvent("local_ai_v7_r4_candidate_proposal_completed", "success", `candidate=${R4_CANDIDATE_PATH}; cpu=passed; training=false`, stored.runPath)
  console.log(JSON.stringify({
    status: terminal.status,
    reportPath: stored.runPath,
    reportSha256: sha256File(stored.runPath),
    candidatePath: R4_CANDIDATE_PATH,
    candidateSha256: terminal.candidate.sha256,
    failureLearningPath: terminal.failureLearning.path,
    failureLearningSha256: terminal.failureLearning.sha256,
    cpuRegressionPath: terminal.cpuRegression.path,
    cpuRegressionSha256: terminal.cpuRegression.sha256,
    failedPreviewCount: 8,
    trainingStarted: false,
    nextState: terminal.closure.nextState,
  }, null, 2))
} catch (error) {
  const terminal = {
    schemaVersion: "local-ai-v7-r4-candidate-proposal-terminal-v1",
    status: "r4_candidate_proposal_execution_failed_stopped",
    runId,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_failure_learning_r4_candidate_proposal_program",
    blockers: [String(error?.message ?? error)],
    trainerFormalConfigurationModified: false,
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
  appendEvent("local_ai_v7_r4_candidate_proposal_failed", "failed", terminal.blockers.join(","), stored.runPath)
  console.error(JSON.stringify({ ...terminal, reportPath: stored.runPath, reportSha256: sha256File(stored.runPath) }, null, 2))
  process.exitCode = 1
}

function verifyAuthorizationAndEvidence() {
  assert(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r4_authorization_hash_invalid")
  assert(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r4_consumption_hash_invalid")
  const authorization = readJson(AUTHORIZATION_PATH)
  const consumption = readJson(CONSUMPTION_PATH)
  assert(authorization?.status === "resolved_owner_authorized", "r4_authorization_not_resolved")
  assert(authorization?.ownerDecision?.commandRef === COMMAND_REF, "r4_authorization_command_invalid")
  assert(authorization?.ownerDecision?.scope === SCOPE, "r4_authorization_scope_invalid")
  assert(consumption?.status === "consumed_before_authorized_write", "r4_authorization_not_consumed")
  assert(consumption?.commandRef === COMMAND_REF && consumption?.scope === SCOPE, "r4_consumption_identity_invalid")
  for (const key of ["failureEvidenceAnalysisAuthorized", "boundedRepairContractProposalAuthorized", "isolatedR4CandidateProposalAuthorized", "cpuSyntheticRegressionAuthorized", "automaticTerminalStorageAuthorized"]) {
    assert(authorization?.resolution?.[key] === true, `r4_${key}_missing`)
  }
  for (const key of ["trainerImplementationAuthorized", "candidateActivationAuthorized", "trainingAuthorized", "validationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) {
    assert(authorization?.resolution?.[key] === false, `r4_boundary_${key}_invalid`)
  }
  assert(fileHashMatches(CLOSURE_REPORT_PATH, CLOSURE_REPORT_SHA256), "r4_closure_hash_invalid")
  assert(fileHashMatches(REVIEW_PATH, REVIEW_SHA256), "r4_review_hash_invalid")
  assert(fileHashMatches(R3_CANDIDATE_PATH, R3_CANDIDATE_SHA256), "r4_r3_candidate_hash_invalid")
  assert(fileHashMatches(R2_PATH, R2_SHA256), "r4_r2_hash_invalid")
  assert(fileHashMatches(SOURCE_MANIFEST_PATH, SOURCE_MANIFEST_SHA256), "r4_manifest_hash_invalid")
  assert(fs.existsSync(resolve(PYTHON)) && fs.existsSync(resolve(CPU_CHECK)), "r4_cpu_runtime_missing")
  assert(!fs.existsSync(resolve(R4_CANDIDATE_PATH)), "r4_durable_candidate_already_exists")
  assert(!fs.existsSync(startPath), "r4_candidate_authorization_already_started")
}

function captureSourceHashes() {
  return {
    r2: sha256File(R2_PATH),
    r3: sha256File(R3_CANDIDATE_PATH),
    closure: sha256File(CLOSURE_REPORT_PATH),
    review: sha256File(REVIEW_PATH),
    manifest: sha256File(SOURCE_MANIFEST_PATH),
  }
}
function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_local_ai_v7_r4_candidate_proposal",
    runId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `本地AI V7 R4候选提案：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/run-local-ai-v7-r4-candidate-proposal.mjs",
    currentStep: kind,
    evidencePath,
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
}
function resolve(value) { return path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { return Boolean(value && expected && fs.existsSync(resolve(value)) && sha256File(value) === expected) }
function writeImmutableJson(target, value) {
  const absolute = resolve(target)
  assert(!fs.existsSync(absolute), `immutable_output_already_exists:${projectPath(absolute)}`)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  const handle = fs.openSync(absolute, "wx")
  try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) }
}
function assert(condition, message) { if (!condition) throw new Error(message) }
