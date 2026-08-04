import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-action-request-v7-r4-trainer-support-cpu-regression-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "11207f534cd5f5fcdbebe640e10379d60828a4fd35e1b8acd7a5403887c2954a"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "4f218ee9697bb2cbbb52f318899eb164749ea442a03c64cc7d637544644af7f5"
const COMMAND_REF = "owner-authorized-v7-r4-trainer-support-cpu-regression-20260804"
const SCOPE = "v7_r4_trainer_support_and_cpu_positive_negative_regression_only"
const TRAINER_PATH = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const TRAINER_BEFORE_SHA256 = "b1556273ecccd73a439160983c9601d26c4b8352d143bcd56209f340ae0ae6af"
const CPU_CHECK_PATH = "ml/ai-painter/scripts/check_ai_assisted_v7_r4_trainer_support_cpu_regression.py"
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const R4_PROPOSAL_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r4-candidate-proposal.json"
const R4_PROPOSAL_SHA256 = "255bf781bd7b63af3d993ca1da73a1a3c2d3d4653c9ce6e0eed28ae95b1de884"
const R4_PROPOSAL_TERMINAL_PATH = ".runtime/ai-painter/local-ai-failure-learning-r4-candidates/local-ai-v7-r4-candidate-proposal-2026-08-04T06-44-36-619Z/phase-terminal.json"
const R4_PROPOSAL_TERMINAL_SHA256 = "2ae9bf60452eb26fa49c3fdcdb32df26b2190b39f4e9aa5d71ee2ea9a837f156"
const R3_CANDIDATE_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r3-candidate-overlay.json"
const R3_CANDIDATE_SHA256 = "6c013e05a36c85646b18fde12b5573049be8ea1703c47899f54956d468a2a501"
const R2_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r2-training-overlay.json"
const R2_SHA256 = "888393b34fe24e588c83be7e9981f08739f2c6b85228584af57135d5889d7a6d"
const SUPPORT_CONTRACT_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r4-trainer-support-contract.json"
const OUTPUT_ROOT = ".runtime/ai-painter/local-ai-failure-learning-r4-trainer-support"
const now = new Date().toISOString()
const runId = `local-ai-v7-r4-trainer-support-${now.replace(/[:.]/g, "-")}`
const runDir = resolve(OUTPUT_ROOT, runId)
const startPath = resolve(OUTPUT_ROOT, "registrations", `${REQUEST_ID}.json`)

verifyAuthorizationAndInputs()
writeImmutableJson(startPath, {
  schemaVersion: "local-ai-v7-r4-trainer-support-start-v1",
  runId,
  requestId: REQUEST_ID,
  status: "registered_after_authorized_source_implementation_before_cpu_regression",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
  trainerPath: TRAINER_PATH,
  trainerBeforeSha256: TRAINER_BEFORE_SHA256,
  trainerImplementedSha256: sha256File(TRAINER_PATH),
  cpuRegressionStarted: false,
  gpuTrainingStarted: false,
})
appendEvent("local_ai_v7_r4_trainer_support_started", "running", "R4 trainer support and CPU regression only; GPU training=false")

try {
  fs.mkdirSync(runDir, { recursive: true })
  const cpuRegressionPath = path.join(runDir, "cpu-positive-negative-regression.json")
  const proposal = readJson(R4_PROPOSAL_PATH)
  const r3 = readJson(R3_CANDIDATE_PATH)
  const cpu = spawnSync(resolve(PYTHON), [
    resolve(CPU_CHECK_PATH),
    "--base-config", resolve(r3.baseConfigPath),
    "--r3-candidate", resolve(R3_CANDIDATE_PATH),
    "--r4-proposal", resolve(R4_PROPOSAL_PATH),
    "--output", cpuRegressionPath,
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      CUDA_VISIBLE_DEVICES: "",
      PYTHONUTF8: "1",
      PYTHONPATH: path.resolve(ROOT, "ml/ai-painter/src"),
    },
    windowsHide: true,
  })
  assert(cpu.status === 0, `r4_trainer_cpu_regression_failed:${cpu.stderr || cpu.stdout}`)
  const regression = readJson(cpuRegressionPath)
  assert(regression.status === "passed_cpu_only_r4_trainer_support_not_active_no_training", "r4_trainer_cpu_regression_status_invalid")
  assert(regression.optimizerCreated === false && regression.modelWeightsModified === false, "r4_cpu_regression_modified_model_state")
  assert(regression.gpuTrainingStarted === false && regression.validationStarted === false, "r4_cpu_regression_crossed_execution_boundary")
  assert(Object.values(regression.positiveRegression).every(Boolean), "r4_positive_regression_incomplete")
  assert(Object.values(regression.negativeRegression).every(Boolean), "r4_negative_regression_incomplete")

  const trainerAfterSha256 = sha256File(TRAINER_PATH)
  const cpuCheckSha256 = sha256File(CPU_CHECK_PATH)
  const contract = {
    schemaVersion: "ai-assisted-v7-r4-trainer-support-contract-v1",
    status: "implemented_cpu_verified_candidate_not_active_training_not_authorized",
    generatedBy: "local_ai_v7_r4_trainer_support_program",
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    sourceProposal: {
      path: R4_PROPOSAL_PATH,
      sha256: R4_PROPOSAL_SHA256,
      status: proposal.status,
    },
    implementation: {
      trainerPath: TRAINER_PATH,
      trainerBeforeSha256: TRAINER_BEFORE_SHA256,
      trainerAfterSha256,
      cpuRegressionScriptPath: CPU_CHECK_PATH,
      cpuRegressionScriptSha256: cpuCheckSha256,
      supportedCapabilities: [
        "bounded_path_interior_weight_selection_validation",
        "bounded_forbidden_boundary_weight_selection_validation",
        "independent_object_footprints_tree_rock_vegetation_loss_and_gradient",
        "epoch_100_110_120_zero_path_and_object_recurrence_gate",
        "inactive_r4_candidate_training_rejection",
      ],
    },
    cpuRegressionEvidence: {
      path: projectPath(cpuRegressionPath),
      sha256: sha256File(cpuRegressionPath),
      status: regression.status,
      positiveRegression: regression.positiveRegression,
      negativeRegression: regression.negativeRegression,
    },
    ownerAuthorization: {
      path: AUTHORIZATION_PATH,
      sha256: AUTHORIZATION_SHA256,
      consumptionPath: CONSUMPTION_PATH,
      consumptionSha256: CONSUMPTION_SHA256,
      commandRef: COMMAND_REF,
      scope: SCOPE,
    },
    activationBoundary: {
      candidateActive: false,
      formalConfigurationSelected: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      validationStarted: false,
      formalInferenceStarted: false,
      checkpointPromoted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextIndependentAuthorization: "select_r4_bounded_candidate_values_and_compile_isolated_r4_smoke_configuration",
    },
  }
  writeImmutableJson(SUPPORT_CONTRACT_PATH, contract)

  const sourcesAfter = captureImmutableSourceHashes()
  assert(sourcesAfter.r4Proposal === R4_PROPOSAL_SHA256, "r4_proposal_modified")
  assert(sourcesAfter.r4ProposalTerminal === R4_PROPOSAL_TERMINAL_SHA256, "r4_proposal_terminal_modified")
  assert(sourcesAfter.r3Candidate === R3_CANDIDATE_SHA256, "r3_candidate_modified")
  assert(sourcesAfter.r2 === R2_SHA256, "r2_overlay_modified")

  const terminal = {
    schemaVersion: "local-ai-v7-r4-trainer-support-terminal-v1",
    status: "r4_trainer_support_cpu_verified_stopped_without_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r4_trainer_support_program",
    trainer: {
      path: TRAINER_PATH,
      beforeSha256: TRAINER_BEFORE_SHA256,
      afterSha256: trainerAfterSha256,
    },
    supportContract: {
      path: SUPPORT_CONTRACT_PATH,
      sha256: sha256File(SUPPORT_CONTRACT_PATH),
      status: contract.status,
    },
    cpuRegression: contract.cpuRegressionEvidence,
    immutableSourcesAfter: sourcesAfter,
    closure: {
      r4TrainerContractImplemented: true,
      boundedWeightValidationImplemented: true,
      objectSemanticStabilitySupportImplemented: true,
      roadBoundaryStabilitySupportImplemented: true,
      consecutiveTailGateImplemented: true,
      inactiveCandidateTrainingRejectionImplemented: true,
      cpuPositiveNegativeRegressionPassed: true,
      candidateActivated: false,
      formalConfigurationSelected: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      validationStarted: false,
      formalInferenceStarted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextState: contract.activationBoundary.nextIndependentAuthorization,
    },
  }
  const stored = writeImmutableProgramRun({
    root: OUTPUT_ROOT,
    runId,
    fileName: "phase-terminal.json",
    record: terminal,
    latest: {
      status: terminal.status,
      trainerAfterSha256,
      supportContractPath: SUPPORT_CONTRACT_PATH,
      supportContractSha256: terminal.supportContract.sha256,
      cpuRegressionPassed: true,
      trainingStarted: false,
      nextState: terminal.closure.nextState,
    },
  })
  appendEvent("local_ai_v7_r4_trainer_support_completed", "success", "R4 trainer support CPU verified; candidate inactive; training=false", stored.runPath)
  console.log(JSON.stringify({
    status: terminal.status,
    reportPath: stored.runPath,
    reportSha256: sha256File(stored.runPath),
    supportContractPath: SUPPORT_CONTRACT_PATH,
    supportContractSha256: terminal.supportContract.sha256,
    cpuRegressionPath: terminal.cpuRegression.path,
    cpuRegressionSha256: terminal.cpuRegression.sha256,
    trainerAfterSha256,
    candidateActive: false,
    gpuTrainingStarted: false,
    nextState: terminal.closure.nextState,
  }, null, 2))
} catch (error) {
  const terminal = {
    schemaVersion: "local-ai-v7-r4-trainer-support-terminal-v1",
    status: "r4_trainer_support_failed_closed_without_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r4_trainer_support_program",
    blockers: [String(error?.message ?? error)],
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
  appendEvent("local_ai_v7_r4_trainer_support_failed", "failed", terminal.blockers.join(","), stored.runPath)
  console.error(JSON.stringify({ ...terminal, reportPath: stored.runPath, reportSha256: sha256File(stored.runPath) }, null, 2))
  process.exitCode = 1
}

function verifyAuthorizationAndInputs() {
  assert(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r4_trainer_authorization_hash_invalid")
  assert(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r4_trainer_consumption_hash_invalid")
  const authorization = readJson(AUTHORIZATION_PATH)
  const consumption = readJson(CONSUMPTION_PATH)
  assert(authorization.status === "resolved_owner_authorized", "r4_trainer_authorization_not_resolved")
  assert(authorization.ownerDecision?.commandRef === COMMAND_REF, "r4_trainer_authorization_command_invalid")
  assert(authorization.ownerDecision?.scope === SCOPE, "r4_trainer_authorization_scope_invalid")
  assert(authorization.taskIdentity?.trainerBeforeSha256 === TRAINER_BEFORE_SHA256, "r4_trainer_before_identity_invalid")
  assert(consumption.status === "consumed_before_authorized_write", "r4_trainer_authorization_not_consumed")
  assert(consumption.commandRef === COMMAND_REF && consumption.scope === SCOPE, "r4_trainer_consumption_identity_invalid")
  for (const key of [
    "trainerR4ContractImplementationAuthorized",
    "boundedWeightSelectionValidationAuthorized",
    "stabilityEvidenceSupportAuthorized",
    "cpuPositiveNegativeRegressionAuthorized",
    "automaticTerminalStorageAuthorized",
  ]) assert(authorization.resolution?.[key] === true, `r4_trainer_${key}_missing`)
  for (const key of [
    "candidateActivationAuthorized",
    "formalConfigurationSelectionAuthorized",
    "trainingAuthorized",
    "validationAuthorized",
    "formalInferenceAuthorized",
    "checkpointPromotionAuthorized",
    "runtimeFrameAuthorized",
    "worldEntryAuthorized",
  ]) assert(authorization.resolution?.[key] === false, `r4_trainer_boundary_${key}_invalid`)
  assert(fileHashMatches(R4_PROPOSAL_PATH, R4_PROPOSAL_SHA256), "r4_proposal_hash_invalid")
  assert(fileHashMatches(R4_PROPOSAL_TERMINAL_PATH, R4_PROPOSAL_TERMINAL_SHA256), "r4_proposal_terminal_hash_invalid")
  assert(fileHashMatches(R3_CANDIDATE_PATH, R3_CANDIDATE_SHA256), "r3_candidate_hash_invalid")
  assert(fileHashMatches(R2_PATH, R2_SHA256), "r2_overlay_hash_invalid")
  assert(fs.existsSync(resolve(TRAINER_PATH)) && fs.existsSync(resolve(CPU_CHECK_PATH)), "r4_trainer_support_source_missing")
  assert(fs.existsSync(resolve(PYTHON)), "r4_trainer_cpu_runtime_missing")
  assert(!fs.existsSync(resolve(SUPPORT_CONTRACT_PATH)), "r4_trainer_support_contract_already_exists")
  assert(!fs.existsSync(startPath), "r4_trainer_support_authorization_already_started")
}

function captureImmutableSourceHashes() {
  return {
    r4Proposal: sha256File(R4_PROPOSAL_PATH),
    r4ProposalTerminal: sha256File(R4_PROPOSAL_TERMINAL_PATH),
    r3Candidate: sha256File(R3_CANDIDATE_PATH),
    r2: sha256File(R2_PATH),
  }
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_local_ai_v7_r4_trainer_support_phase",
    runId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `本地AI V7 R4训练器支持：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/run-local-ai-v7-r4-trainer-support-phase.mjs",
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
function fileHashMatches(value, expected) { return Boolean(value && expected && fs.existsSync(resolve(value)) && sha256File(value) === expected) }
function writeImmutableJson(target, value) {
  const absolute = resolve(target)
  assert(!fs.existsSync(absolute), `immutable_output_already_exists:${projectPath(absolute)}`)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  const handle = fs.openSync(absolute, "wx")
  try {
    fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8")
    fs.fsyncSync(handle)
  } finally {
    fs.closeSync(handle)
  }
}
function assert(condition, message) { if (!condition) throw new Error(message) }
