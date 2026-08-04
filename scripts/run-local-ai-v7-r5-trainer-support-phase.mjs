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
const REQUEST_ID = "owner-action-request-v7-r5-trainer-support-cpu-regression-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "9a1a6b20d61519cddc3bb21f7124e058f1f1f609096cfb6aa637a63d1f35e134"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "4b3b69350e3dc41bfbab3a8e430af45baabc87106b1c17fdb5bc2f7a083e359c"
const COMMAND_REF = "owner-authorized-v7-r5-trainer-support-cpu-regression-20260804"
const SCOPE = "v7_r5_trainer_support_and_cpu_positive_negative_regression_only"
const TRAINER_PATH = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const TRAINER_BEFORE_SHA256 = "38add4321af1ef0d87348f8b1770af404e1dbd7f7b6ac5fb31d09d6a52974269"
const TRAINER_IMPLEMENTED_SHA256 = "10014274b74972c91b2f927b26fd45341fb81175f61718e3a538d2d210857648"
const CPU_CHECK_PATH = "ml/ai-painter/scripts/check_ai_assisted_v7_r5_trainer_support_cpu_regression.py"
const CPU_CHECK_SHA256 = "e1326d94b436aaad5c460b09092b5adeb0a34590070f73553d2c92279cd22b24"
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const R5_PROPOSAL_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r5-candidate-proposal.json"
const R5_PROPOSAL_SHA256 = "0af7181ca95ec9e907bc01b9ccbcd1c4bd45fdfdfe1a472a55fa840deac0e049"
const R5_PROPOSAL_TERMINAL_PATH = ".runtime/ai-painter/local-ai-failure-learning-r5-candidates/local-ai-v7-r5-candidate-proposal-2026-08-04T08-09-02-546Z/phase-terminal.json"
const R5_PROPOSAL_TERMINAL_SHA256 = "bdd261912138cf8ac952e22596b58538bc8e90a5abcb95a592e49a75e57b9b51"
const R5_COMPILER_PATH = "scripts/lib/ai-assisted-v7-r5-candidate.mjs"
const R5_COMPILER_SHA256 = "8b996ef024489004a2b9a5bb1605a6f421ae5e7261b46911fc9c4708c9ef3b73"
const R4_CONFIG_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r4/derived-configs/ai-assisted-v7-repair-r4-random-init-single-sample-overfit-smoke-2026-08-04T07-49-43-831Z.json"
const R4_CONFIG_SHA256 = "50dd0eabf456f3be45400d3923988d5c43364c7424067b8326ab9a75b8c50f3e"
const SUPPORT_CONTRACT_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r5-trainer-support-contract.json"
const OUTPUT_ROOT = ".runtime/ai-painter/local-ai-failure-learning-r5-trainer-support"
const now = new Date().toISOString()
const runId = `local-ai-v7-r5-trainer-support-${now.replace(/[:.]/g, "-")}`
const runDir = resolve(OUTPUT_ROOT, runId)
const startPath = resolve(OUTPUT_ROOT, "registrations", `${REQUEST_ID}.json`)

verifyAuthorizationAndInputs()
writeImmutableJson(startPath, {
  schemaVersion: "local-ai-v7-r5-trainer-support-start-v1",
  runId,
  requestId: REQUEST_ID,
  status: "registered_after_authorized_implementation_before_cpu_regression",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
  trainerPath: TRAINER_PATH,
  trainerBeforeSha256: TRAINER_BEFORE_SHA256,
  trainerImplementedSha256: TRAINER_IMPLEMENTED_SHA256,
  checkpointLoaded: false,
  optimizerCreated: false,
  gpuTrainingStarted: false,
})
appendEvent("local_ai_v7_r5_trainer_support_started", "running", "R5 trainer support CPU regression only; checkpoint=false; optimizer=false; GPU=false")

try {
  fs.mkdirSync(runDir, { recursive: true })
  const cpuRegressionPath = path.join(runDir, "cpu-positive-negative-regression.json")
  const cpu = spawnSync(resolve(PYTHON), [
    resolve(CPU_CHECK_PATH),
    "--r4-config", resolve(R4_CONFIG_PATH),
    "--r5-proposal", resolve(R5_PROPOSAL_PATH),
    "--output", cpuRegressionPath,
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      CUDA_VISIBLE_DEVICES: "",
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONUTF8: "1",
      PYTHONPATH: path.resolve(ROOT, "ml/ai-painter/src"),
    },
    windowsHide: true,
  })
  assert(cpu.status === 0, `r5_trainer_cpu_regression_failed:${cpu.stderr || cpu.stdout}`)
  const regression = readJson(cpuRegressionPath)
  assert(regression.status === "passed_cpu_only_r5_trainer_support_not_active_no_checkpoint_load_no_training", "r5_cpu_regression_status_invalid")
  assert(regression.checkpointLoaded === false, "r5_cpu_regression_loaded_checkpoint")
  assert(regression.optimizerCreated === false && regression.modelWeightsModified === false, "r5_cpu_regression_modified_model_state")
  assert(regression.gpuTrainingStarted === false && regression.validationStarted === false, "r5_cpu_regression_crossed_execution_boundary")
  assert(Object.values(regression.positiveRegression).every(Boolean), "r5_positive_regression_incomplete")
  assert(Object.values(regression.negativeRegression).every(Boolean), "r5_negative_regression_incomplete")

  const contract = {
    schemaVersion: "ai-assisted-v7-r5-trainer-support-contract-v1",
    status: "implemented_cpu_verified_candidate_not_active_no_checkpoint_load_no_training",
    generatedBy: "local_ai_v7_r5_trainer_support_program",
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    sourceProposal: {
      path: R5_PROPOSAL_PATH,
      sha256: R5_PROPOSAL_SHA256,
      status: readJson(R5_PROPOSAL_PATH).status,
    },
    implementation: {
      trainerPath: TRAINER_PATH,
      trainerBeforeSha256: TRAINER_BEFORE_SHA256,
      trainerAfterSha256: sha256File(TRAINER_PATH),
      cpuRegressionScriptPath: CPU_CHECK_PATH,
      cpuRegressionScriptSha256: sha256File(CPU_CHECK_PATH),
      supportedCapabilities: [
        "bounded_r5_continuation_epoch_replay_count_and_path_consistency_weight_validation",
        "checkpoint_continuation_identity_binding_without_checkpoint_loading",
        "original_owner_approved_rgb_and_condition_pack_only_path_replay",
        "failed_preview_target_rejection",
        "path_short_trajectory_target_and_step_consistency_loss_with_gradient",
        "dynamic_three_consecutive_tail_preview_gate",
        "inactive_r5_candidate_training_rejection",
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
      executionValuesSelected: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      validationStarted: false,
      formalInferenceStarted: false,
      checkpointPromoted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextIndependentAuthorization: "select_r5_bounded_parameters_and_compile_isolated_configuration_only",
    },
  }
  writeImmutableJson(SUPPORT_CONTRACT_PATH, contract)
  assertImmutableSources()

  const terminal = {
    schemaVersion: "local-ai-v7-r5-trainer-support-terminal-v1",
    status: "r5_trainer_support_cpu_verified_stopped_without_checkpoint_load_or_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r5_trainer_support_program",
    trainer: {
      path: TRAINER_PATH,
      beforeSha256: TRAINER_BEFORE_SHA256,
      afterSha256: sha256File(TRAINER_PATH),
    },
    supportContract: {
      path: SUPPORT_CONTRACT_PATH,
      sha256: sha256File(SUPPORT_CONTRACT_PATH),
      status: contract.status,
    },
    cpuRegression: contract.cpuRegressionEvidence,
    closure: {
      r5TrainerContractImplemented: true,
      checkpointContinuationContractImplementedWithoutLoading: true,
      originalApprovedTargetReplayImplemented: true,
      failedPreviewTargetRejectionImplemented: true,
      pathShortTrajectoryConsistencyImplemented: true,
      dynamicThreeTailGateImplemented: true,
      inactiveCandidateTrainingRejectionImplemented: true,
      cpuPositiveNegativeRegressionPassed: true,
      executionValuesSelected: false,
      candidateActivated: false,
      checkpointLoaded: false,
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
      supportContractPath: SUPPORT_CONTRACT_PATH,
      supportContractSha256: terminal.supportContract.sha256,
      cpuRegressionPassed: true,
      checkpointLoaded: false,
      trainingStarted: false,
      nextState: terminal.closure.nextState,
    },
  })
  appendEvent("local_ai_v7_r5_trainer_support_completed", "success", "R5 trainer support CPU verified; selected=false; checkpoint=false; optimizer=false; GPU=false", stored.runPath)
  console.log(JSON.stringify({
    status: terminal.status,
    reportPath: stored.runPath,
    reportSha256: sha256File(stored.runPath),
    supportContractPath: SUPPORT_CONTRACT_PATH,
    supportContractSha256: terminal.supportContract.sha256,
    cpuRegressionPath: terminal.cpuRegression.path,
    cpuRegressionSha256: terminal.cpuRegression.sha256,
    trainerAfterSha256: terminal.trainer.afterSha256,
    candidateActive: false,
    checkpointLoaded: false,
    gpuTrainingStarted: false,
    nextState: terminal.closure.nextState,
  }, null, 2))
} catch (error) {
  const terminal = {
    schemaVersion: "local-ai-v7-r5-trainer-support-terminal-v1",
    status: "r5_trainer_support_failed_closed_without_checkpoint_load_or_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r5_trainer_support_program",
    blockers: [String(error?.message ?? error)],
    executionValuesSelected: false,
    candidateActivated: false,
    checkpointLoaded: false,
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
  appendEvent("local_ai_v7_r5_trainer_support_failed", "failed", terminal.blockers.join(","), stored.runPath)
  console.error(JSON.stringify({ ...terminal, reportPath: stored.runPath, reportSha256: sha256File(stored.runPath) }, null, 2))
  process.exitCode = 1
}

function verifyAuthorizationAndInputs() {
  assert(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r5_trainer_authorization_hash_invalid")
  assert(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r5_trainer_consumption_hash_invalid")
  const authorization = readJson(AUTHORIZATION_PATH)
  const consumption = readJson(CONSUMPTION_PATH)
  assert(authorization.status === "resolved_owner_authorized", "r5_trainer_authorization_not_resolved")
  assert(authorization.ownerDecision?.commandRef === COMMAND_REF, "r5_trainer_authorization_command_invalid")
  assert(authorization.ownerDecision?.scope === SCOPE, "r5_trainer_authorization_scope_invalid")
  assert(authorization.taskIdentity?.trainerBeforeSha256 === TRAINER_BEFORE_SHA256, "r5_trainer_before_identity_invalid")
  assert(consumption.status === "consumed_before_authorized_write", "r5_trainer_authorization_not_consumed")
  assert(consumption.commandRef === COMMAND_REF && consumption.scope === SCOPE, "r5_trainer_consumption_identity_invalid")
  for (const key of [
    "r5TrainerContractImplementationAuthorized",
    "checkpointContinuationContractSupportAuthorized",
    "originalApprovedTargetPathReplaySupportAuthorized",
    "pathShortTrajectoryConsistencyLossSupportAuthorized",
    "cpuPositiveNegativeRegressionAuthorized",
    "automaticTerminalStorageAuthorized",
  ]) assert(authorization.resolution?.[key] === true, `r5_trainer_${key}_missing`)
  for (const key of [
    "executionValueSelectionAuthorized",
    "candidateActivationAuthorized",
    "checkpointLoadingAuthorized",
    "optimizerCreationAuthorized",
    "modelWeightMutationAuthorized",
    "gpuTrainingAuthorized",
    "validationAuthorized",
    "formalInferenceAuthorized",
    "checkpointPromotionAuthorized",
    "runtimeFrameAuthorized",
    "worldEntryAuthorized",
  ]) assert(authorization.resolution?.[key] === false, `r5_trainer_boundary_${key}_invalid`)
  assert(fileHashMatches(TRAINER_PATH, TRAINER_IMPLEMENTED_SHA256), "r5_trainer_implemented_hash_invalid")
  assert(fileHashMatches(CPU_CHECK_PATH, CPU_CHECK_SHA256), "r5_cpu_check_hash_invalid")
  assertImmutableSources()
  assert(fs.existsSync(resolve(PYTHON)), "r5_trainer_cpu_runtime_missing")
  assert(!fs.existsSync(resolve(SUPPORT_CONTRACT_PATH)), "r5_trainer_support_contract_already_exists")
  assert(!fs.existsSync(startPath), "r5_trainer_support_authorization_already_started")
}

function assertImmutableSources() {
  assert(fileHashMatches(R5_PROPOSAL_PATH, R5_PROPOSAL_SHA256), "r5_proposal_modified")
  assert(fileHashMatches(R5_PROPOSAL_TERMINAL_PATH, R5_PROPOSAL_TERMINAL_SHA256), "r5_proposal_terminal_modified")
  assert(fileHashMatches(R5_COMPILER_PATH, R5_COMPILER_SHA256), "r5_candidate_compiler_modified")
  assert(fileHashMatches(R4_CONFIG_PATH, R4_CONFIG_SHA256), "r4_source_config_modified")
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_local_ai_v7_r5_trainer_support_phase",
    runId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `本地AI V7 R5训练器支持：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/run-local-ai-v7-r5-trainer-support-phase.mjs",
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
