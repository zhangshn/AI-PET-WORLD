import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  compileR3CandidateOverlay,
  evaluateTailStability,
  R3_TAIL_EPOCHS,
} from "./lib/ai-assisted-v7-r3-candidate.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-local-ai-failure-learning-closed-loop-phase2-20260804/request.json"
const AUTHORIZATION_SHA256 = "f518337d2704e5c82a9c18c9c2c9cb835bbb1bd60017715f79449444b6d49215"
const CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-local-ai-failure-learning-closed-loop-phase2-20260804/r3-candidate-implementation-consumption.json"
const PHASE1_POINTER_PATH = ".runtime/ai-painter/local-ai-failure-learning/latest.json"
const R2_OVERLAY_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r2-training-overlay.json"
const R2_OVERLAY_SHA256 = "888393b34fe24e588c83be7e9981f08739f2c6b85228584af57135d5889d7a6d"
const R3_CANDIDATE_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r3-candidate-overlay.json"
const TRAINER_PATH = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const BASE_CONFIG_PATH = "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json"
const PYTHON_PATH = "ml/ai-painter/.venv/Scripts/python.exe"
const CPU_CHECK_PATH = "ml/ai-painter/scripts/check_ai_assisted_v7_r3_candidate_cpu_regression.py"
const OUTPUT_ROOT = ".runtime/ai-painter/local-ai-failure-learning-r3-candidates"

verifyAuthorization()
assert(fileHashMatches(R2_OVERLAY_PATH, R2_OVERLAY_SHA256), "r3_candidate_r2_overlay_changed_before_compilation")
const r2Overlay = readJson(R2_OVERLAY_PATH)
const phase1Pointer = readJson(PHASE1_POINTER_PATH)
const phase1ReportPath = phase1Pointer.runPath
const failureLearningReport = readJson(phase1ReportPath)
const now = new Date().toISOString()
const runId = `local-ai-v7-r3-candidate-phase2-${now.replace(/[:.]/g, "-")}`
const runtimeRunDirectory = path.join(OUTPUT_ROOT, runId)
fs.mkdirSync(resolve(runtimeRunDirectory), { recursive: true })

const candidate = {
  ...compileR3CandidateOverlay({
    r2Overlay,
    failureLearningReport,
    sourceEvidence: {
      r2Overlay: { path: R2_OVERLAY_PATH, sha256: R2_OVERLAY_SHA256 },
      failureLearningReport: { path: phase1ReportPath, sha256: sha256File(phase1ReportPath) },
    },
  }),
  compiledAtUtc: now,
  compiledAtAsiaShanghai: formatShanghai(now),
  authorizationPath: AUTHORIZATION_PATH,
  authorizationSha256: AUTHORIZATION_SHA256,
  authorizationConsumptionPath: CONSUMPTION_PATH,
  authorizationConsumptionSha256: sha256File(CONSUMPTION_PATH),
}
writeImmutableJson(R3_CANDIDATE_PATH, candidate)

const cpuRegressionPath = path.join(runtimeRunDirectory, "cpu-synthetic-regression.json").replaceAll("\\", "/")
const cpu = spawnSync(resolve(PYTHON_PATH), [
  resolve(CPU_CHECK_PATH),
  "--base-config", resolve(BASE_CONFIG_PATH),
  "--candidate-overlay", resolve(R3_CANDIDATE_PATH),
  "--output", resolve(cpuRegressionPath),
], {
  cwd: ROOT,
  encoding: "utf8",
  env: { ...process.env, CUDA_VISIBLE_DEVICES: "" },
  windowsHide: true,
})
assert(cpu.status === 0, `r3_candidate_cpu_regression_failed:${cpu.stderr || cpu.stdout}`)
const cpuRegression = readJson(cpuRegressionPath)
assert(cpuRegression.status === "passed_cpu_only_no_training", "r3_candidate_cpu_regression_status_invalid")

const gate = candidate.patch.training.smokeStabilityGate
const sourceStability = evaluateTailStability(failureLearningReport.timeline, gate)
const positiveStability = evaluateTailStability(
  R3_TAIL_EPOCHS.map((epoch) => ({ epoch, passed: true, issueCodes: [] })),
  gate,
)
const negativeStability = evaluateTailStability([
  { epoch: 100, passed: true, issueCodes: [] },
  { epoch: 110, passed: false, issueCodes: ["synthetic_regression_failure"] },
  { epoch: 120, passed: true, issueCodes: [] },
], gate)
assert(sourceStability.passed === false, "r3_candidate_source_evidence_must_not_be_promoted")
assert(positiveStability.passed === true, "r3_candidate_positive_tail_regression_failed")
assert(negativeStability.passed === false, "r3_candidate_negative_tail_regression_failed")
assert(fileHashMatches(R2_OVERLAY_PATH, R2_OVERLAY_SHA256), "r3_candidate_r2_overlay_modified_by_phase2")

const report = {
  schemaVersion: "local-ai-v7-r3-candidate-phase2-terminal-v1",
  status: "r3_candidate_cpu_verified_waiting_independent_gpu_smoke_authorization",
  runId,
  createdAtUtc: now,
  createdAtAsiaShanghai: formatShanghai(now),
  generatedBy: "local_ai_failure_learning_phase2_program",
  candidate: {
    path: R3_CANDIDATE_PATH,
    sha256: sha256File(R3_CANDIDATE_PATH),
    active: false,
    trainingAuthorized: false,
  },
  trainer: {
    path: TRAINER_PATH,
    sha256: sha256File(TRAINER_PATH),
    r3CandidateCodeSupport: true,
    actualTrainingGate: "failed_closed_not_authorized_candidate_only",
  },
  sourceEvidence: {
    r2OverlayPath: R2_OVERLAY_PATH,
    r2OverlaySha256BeforeAndAfter: R2_OVERLAY_SHA256,
    r2EvidenceModified: false,
    failureLearningReportPath: phase1ReportPath,
    failureLearningReportSha256: sha256File(phase1ReportPath),
  },
  cpuRegression: {
    path: cpuRegressionPath,
    sha256: sha256File(cpuRegressionPath),
    status: cpuRegression.status,
    positive: cpuRegression.positiveRegression,
    negative: cpuRegression.negativeRegression,
    measured: cpuRegression.measured,
  },
  tailStabilityRegression: {
    sourceR2Evidence: sourceStability,
    positiveSynthetic: positiveStability,
    negativeSynthetic: negativeStability,
  },
  closure: {
    candidateConfigurationCompiled: true,
    candidateConfigurationImmutable: true,
    trainerCodeSupportImplemented: true,
    objectChannelLossesIndependent: true,
    pathInteriorCoverageLossImplemented: true,
    forbiddenBoundaryLossImplemented: true,
    requiredConsecutiveTailPasses: 3,
    cpuRegressionPassed: true,
    reviewThresholdsModified: false,
    r2EvidenceModified: false,
    modelWeightsModified: false,
    gpuTrainingStarted: false,
    validationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntered: false,
    nextState: "waiting_for_owner_authorization_of_r3_single_sample_gpu_overfit_smoke",
  },
}
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "phase2-terminal.json",
  record: report,
  latest: {
    status: report.status,
    candidatePath: R3_CANDIDATE_PATH,
    candidateSha256: report.candidate.sha256,
    cpuRegressionPassed: true,
    trainingStarted: false,
    nextState: report.closure.nextState,
  },
})
appendAiPainterProgramEvent({
  action: "run_local_ai_v7_r3_candidate_phase2",
  runId,
  kind: "local_ai_failure_learning_phase2_terminal",
  status: "success",
  title: "Local AI V7 R3 candidate compiled and CPU regression verified",
  titleZh: "本地AI V7 R3隔离候选已编译并通过CPU正反回归",
  detail: `candidate=${R3_CANDIDATE_PATH}; cpuRegression=passed; trainingStarted=false; next=${report.closure.nextState}`,
  detailZh: `候选配置=${R3_CANDIDATE_PATH}；CPU回归=通过；训练已启动=false；下一状态=${report.closure.nextState}`,
  script: "scripts/run-local-ai-v7-r3-candidate-phase2.mjs",
  currentStep: report.closure.nextState,
  evidencePath: stored.runPath,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})
console.log(JSON.stringify({
  status: report.status,
  reportPath: stored.runPath,
  reportSha256: sha256File(stored.runPath),
  candidatePath: R3_CANDIDATE_PATH,
  candidateSha256: report.candidate.sha256,
  cpuRegressionPath,
  cpuRegressionSha256: report.cpuRegression.sha256,
  trainingStarted: false,
  nextState: report.closure.nextState,
}, null, 2))

function verifyAuthorization() {
  assert(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r3_candidate_authorization_hash_mismatch")
  const authorization = readJson(AUTHORIZATION_PATH)
  const consumption = readJson(CONSUMPTION_PATH)
  assert(authorization.ownerDecision?.decision === "authorized", "r3_candidate_owner_decision_invalid")
  assert(authorization.ownerDecision?.scope === "local_ai_failure_learning_closed_loop_phase2_r3_candidate_non_training_implementation_only", "r3_candidate_scope_invalid")
  assert(consumption.status === "consumed_before_authorized_write", "r3_candidate_authorization_not_consumed")
  assert(consumption.authorizationSha256 === AUTHORIZATION_SHA256, "r3_candidate_consumption_hash_binding_invalid")
}

function writeImmutableJson(target, value) {
  const absoluteTarget = resolve(target)
  assert(!fs.existsSync(absoluteTarget), `immutable_output_already_exists:${target}`)
  fs.mkdirSync(path.dirname(absoluteTarget), { recursive: true })
  const temporary = `${absoluteTarget}.${process.pid}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  try {
    fs.linkSync(temporary, absoluteTarget)
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
  }
}

function resolve(value) { return path.resolve(ROOT, value) }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { return Boolean(value && expected && fs.existsSync(resolve(value)) && sha256File(value) === expected) }
function assert(condition, message) { if (!condition) throw new Error(message) }
