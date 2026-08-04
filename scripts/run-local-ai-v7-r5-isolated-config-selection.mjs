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
const REQUEST_ID = "owner-action-request-v7-r5-isolated-config-selection-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "c358be52d05fbb92410f2b3fa4806196dadaf3671a709734876596b9c401e764"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "73f799ef027d3e1a92930aeb39e6fe57442506574eaaa526ca73a5a6a127a29f"
const COMMAND_REF = "owner-authorized-v7-r5-isolated-config-selection-20260804"
const SCOPE = "select_r5_bounded_parameters_and_compile_isolated_configuration_only"
const TRAINER_PATH = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const TRAINER_SHA256 = "10014274b74972c91b2f927b26fd45341fb81175f61718e3a538d2d210857648"
const COMPILER_PATH = "ml/ai-painter/scripts/compile_ai_assisted_v7_r5_isolated_config.py"
const COMPILER_SHA256 = "591c8fa0fcba89d545c3b664b30efae6112d77f41c8c71b81a0246a57662edbb"
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const R5_PROPOSAL_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r5-candidate-proposal.json"
const R5_PROPOSAL_SHA256 = "0af7181ca95ec9e907bc01b9ccbcd1c4bd45fdfdfe1a472a55fa840deac0e049"
const R5_SUPPORT_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r5-trainer-support-contract.json"
const R5_SUPPORT_SHA256 = "667d2f27cdf5d5f6403711176e2e07b036796d6bcafa4a829412e3c7ccdca877"
const R5_SUPPORT_TERMINAL_PATH = ".runtime/ai-painter/local-ai-failure-learning-r5-trainer-support/local-ai-v7-r5-trainer-support-2026-08-04T09-08-51-566Z/phase-terminal.json"
const R5_SUPPORT_TERMINAL_SHA256 = "cf030052cb3542a3150f454a82d2cb0c0b827d3c5f19203adda2d29274bc7815"
const R4_CONFIG_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r4/derived-configs/ai-assisted-v7-repair-r4-random-init-single-sample-overfit-smoke-2026-08-04T07-49-43-831Z.json"
const R4_CONFIG_SHA256 = "50dd0eabf456f3be45400d3923988d5c43364c7424067b8326ab9a75b8c50f3e"
const R4_CHECKPOINT_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r4/ai-assisted-v7-repair-r4-random-init-single-sample-overfit-smoke-2026-08-04T07-49-43-831Z/complete-world-ai-assisted-conditional-denoiser.pt"
const R4_CHECKPOINT_SHA256 = "a8cd24d1be1a1128b2cb487ce72a487218bd9b165adddde31f9caba81ca69a32"
const SELECTION_CONTRACT_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r5-isolated-config-selection-contract.json"
const OUTPUT_ROOT = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/isolated-configs"
const now = new Date().toISOString()
const runId = `ai-assisted-v7-r5-isolated-config-${now.replace(/[:.]/g, "-")}`
const runDir = resolve(OUTPUT_ROOT, runId)
const configPath = path.join(runDir, "isolated-config.json")
const selectionPath = path.join(runDir, "selection-report.json")
const startPath = resolve(OUTPUT_ROOT, "registrations", `${REQUEST_ID}.json`)

verifyAuthorizationAndInputs()
writeImmutableJson(startPath, {
  schemaVersion: "ai-assisted-v7-r5-isolated-config-start-v1",
  runId,
  requestId: REQUEST_ID,
  status: "registered_before_selection_and_compilation",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
  selectionPolicy: "minimum_effective_intervention_before_single_sample_gpu_smoke",
  checkpointFileRead: false,
  checkpointDeserialized: false,
  checkpointLoaded: false,
  optimizerCreated: false,
  gpuTrainingStarted: false,
})
appendEvent("local_ai_v7_r5_isolated_config_selection_started", "running", "R5 bounded selection and inactive config compilation; checkpoint=false; optimizer=false; GPU=false")

try {
  fs.mkdirSync(runDir, { recursive: false })
  const compile = spawnSync(resolve(PYTHON), [
    resolve(COMPILER_PATH),
    "--r4-config", resolve(R4_CONFIG_PATH),
    "--r5-proposal", resolve(R5_PROPOSAL_PATH),
    "--output-config", configPath,
    "--output-selection", selectionPath,
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
  assert(compile.status === 0, `r5_isolated_config_compilation_failed:${compile.stderr || compile.stdout}`)

  const config = readJson(configPath)
  const selection = readJson(selectionPath)
  assert(selection.status === "r5_bounded_values_selected_isolated_config_compiled_not_active", "r5_selection_status_invalid")
  assert(selection.selectionPolicy === "minimum_effective_intervention_before_single_sample_gpu_smoke", "r5_selection_policy_invalid")
  assert(selection.selectedValues?.continuationEpochs === 30, "r5_continuation_epoch_selection_invalid")
  assert(selection.selectedValues?.replayPassesPerEpoch === 1, "r5_replay_pass_selection_invalid")
  assert(selection.selectedValues?.pathShortTrajectoryConsistencyWeight === 0.25, "r5_trajectory_weight_selection_invalid")
  assert(config.status === "isolated_r5_candidate_not_active", "r5_compiled_config_not_isolated")
  assert(config.training?.trainingAuthorizationStatus === "not_authorized_candidate_only", "r5_compiled_config_training_status_invalid")
  assert(config.training?.r5CheckpointContinuation?.sourceCheckpointPath === R4_CHECKPOINT_PATH, "r5_checkpoint_path_binding_invalid")
  assert(config.training?.r5CheckpointContinuation?.sourceCheckpointSha256 === R4_CHECKPOINT_SHA256, "r5_checkpoint_hash_binding_invalid")
  assert(config.training?.r5CheckpointContinuation?.loadingAuthorizedNow === false, "r5_checkpoint_loading_improperly_enabled")
  assert(config.training?.pathHardExampleReplay?.targetSource === "original_owner_approved_rgb_and_condition_pack_only", "r5_replay_target_source_invalid")
  assert(config.training?.pathHardExampleReplay?.failedPreviewPixelsUsedAsTrainingTargets === false, "r5_failed_preview_target_enabled")
  assert(config.training?.smokeStabilityGate?.requiredConsecutiveTailPasses === 3, "r5_tail_gate_invalid")
  assert(JSON.stringify(config.training?.smokeStabilityGate?.tailEpochs) === JSON.stringify([10, 20, 30]), "r5_tail_epochs_invalid")
  assert(Object.values(selection.boundaries).every((value) => value === false), "r5_selection_crossed_execution_boundary")

  const contract = {
    schemaVersion: "ai-assisted-v7-r5-isolated-config-selection-contract-v1",
    status: "r5_isolated_config_compiled_not_active_checkpoint_not_loaded_training_not_authorized",
    generatedBy: "local_ai_v7_r5_isolated_config_selection_program",
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    selectionPolicy: selection.selectionPolicy,
    selectedValues: selection.selectedValues,
    selectionRationale: selection.selectionRationale,
    compiledConfiguration: {
      path: projectPath(configPath),
      sha256: sha256File(configPath),
      status: config.status,
      trainingAuthorizationStatus: config.training.trainingAuthorizationStatus,
    },
    selectionEvidence: {
      path: projectPath(selectionPath),
      sha256: sha256File(selectionPath),
      status: selection.status,
    },
    sourceEvidence: {
      proposal: { path: R5_PROPOSAL_PATH, sha256: R5_PROPOSAL_SHA256 },
      trainerSupport: { path: R5_SUPPORT_PATH, sha256: R5_SUPPORT_SHA256 },
      trainerSupportTerminal: { path: R5_SUPPORT_TERMINAL_PATH, sha256: R5_SUPPORT_TERMINAL_SHA256 },
      r4Config: { path: R4_CONFIG_PATH, sha256: R4_CONFIG_SHA256 },
      r4CheckpointIdentity: { path: R4_CHECKPOINT_PATH, sha256: R4_CHECKPOINT_SHA256, fileDeserialized: false, loadedIntoModel: false },
    },
    ownerAuthorization: {
      path: AUTHORIZATION_PATH,
      sha256: AUTHORIZATION_SHA256,
      consumptionPath: CONSUMPTION_PATH,
      consumptionSha256: CONSUMPTION_SHA256,
      commandRef: COMMAND_REF,
      scope: SCOPE,
    },
    executionBoundary: {
      configurationActive: false,
      checkpointFileReadByCompiler: false,
      checkpointDeserialized: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      validationStarted: false,
      formalInferenceStarted: false,
      checkpointPromoted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextIndependentAuthorization: "one_r5_single_sample_gpu_overfit_smoke_only",
    },
  }
  writeImmutableJson(SELECTION_CONTRACT_PATH, contract)
  assertImmutableSources()

  const terminal = {
    schemaVersion: "local-ai-v7-r5-isolated-config-selection-terminal-v1",
    status: "r5_isolated_config_selection_completed_stopped_before_checkpoint_load_and_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r5_isolated_config_selection_program",
    selectedValues: contract.selectedValues,
    compiledConfiguration: contract.compiledConfiguration,
    selectionEvidence: contract.selectionEvidence,
    selectionContract: {
      path: SELECTION_CONTRACT_PATH,
      sha256: sha256File(SELECTION_CONTRACT_PATH),
      status: contract.status,
    },
    closure: {
      boundedValuesSelected: true,
      isolatedConfigurationCompiled: true,
      configurationContractValidated: true,
      configurationActive: false,
      checkpointFileReadByCompiler: false,
      checkpointDeserialized: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      validationStarted: false,
      formalInferenceStarted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextState: contract.executionBoundary.nextIndependentAuthorization,
    },
  }
  const stored = writeImmutableProgramRun({
    root: OUTPUT_ROOT,
    runId,
    fileName: "phase-terminal.json",
    record: terminal,
    latest: {
      status: terminal.status,
      selectedValues: terminal.selectedValues,
      compiledConfigPath: terminal.compiledConfiguration.path,
      compiledConfigSha256: terminal.compiledConfiguration.sha256,
      checkpointLoaded: false,
      trainingStarted: false,
      nextState: terminal.closure.nextState,
    },
  })
  appendEvent("local_ai_v7_r5_isolated_config_selection_completed", "success", "R5 values selected and isolated config compiled; active=false; checkpoint=false; optimizer=false; GPU=false", stored.runPath)
  console.log(JSON.stringify({
    status: terminal.status,
    selectedValues: terminal.selectedValues,
    configPath: terminal.compiledConfiguration.path,
    configSha256: terminal.compiledConfiguration.sha256,
    reportPath: stored.runPath,
    reportSha256: sha256File(stored.runPath),
    selectionContractPath: SELECTION_CONTRACT_PATH,
    selectionContractSha256: terminal.selectionContract.sha256,
    checkpointLoaded: false,
    optimizerCreated: false,
    gpuTrainingStarted: false,
    nextState: terminal.closure.nextState,
  }, null, 2))
} catch (error) {
  const terminal = {
    schemaVersion: "local-ai-v7-r5-isolated-config-selection-terminal-v1",
    status: "r5_isolated_config_selection_failed_closed_without_checkpoint_load_or_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r5_isolated_config_selection_program",
    blockers: [String(error?.message ?? error)],
    configurationActive: false,
    checkpointFileReadByCompiler: false,
    checkpointDeserialized: false,
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
  appendEvent("local_ai_v7_r5_isolated_config_selection_failed", "failed", terminal.blockers.join(","), stored.runPath)
  console.error(JSON.stringify({ ...terminal, reportPath: stored.runPath, reportSha256: sha256File(stored.runPath) }, null, 2))
  process.exitCode = 1
}

function verifyAuthorizationAndInputs() {
  assert(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r5_selection_authorization_hash_invalid")
  assert(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r5_selection_consumption_hash_invalid")
  const authorization = readJson(AUTHORIZATION_PATH)
  const consumption = readJson(CONSUMPTION_PATH)
  assert(authorization.status === "resolved_owner_authorized", "r5_selection_authorization_not_resolved")
  assert(authorization.ownerDecision?.commandRef === COMMAND_REF, "r5_selection_authorization_command_invalid")
  assert(authorization.ownerDecision?.scope === SCOPE, "r5_selection_authorization_scope_invalid")
  assert(authorization.selectionContract?.policy === "minimum_effective_intervention_before_single_sample_gpu_smoke", "r5_selection_policy_not_authorized")
  assert(consumption.status === "consumed_before_authorized_write", "r5_selection_authorization_not_consumed")
  assert(consumption.commandRef === COMMAND_REF && consumption.scope === SCOPE, "r5_selection_consumption_identity_invalid")
  for (const key of [
    "boundedParameterSelectionAuthorized",
    "isolatedConfigurationCompilationAuthorized",
    "configurationContractValidationAuthorized",
    "automaticTerminalStorageAuthorized",
  ]) assert(authorization.resolution?.[key] === true, `r5_selection_${key}_missing`)
  for (const key of [
    "checkpointDeserializationAuthorized",
    "checkpointLoadingAuthorized",
    "candidateActivationAuthorized",
    "optimizerCreationAuthorized",
    "modelWeightMutationAuthorized",
    "gpuTrainingAuthorized",
    "validationAuthorized",
    "formalInferenceAuthorized",
    "checkpointPromotionAuthorized",
    "runtimeFrameAuthorized",
    "worldEntryAuthorized",
  ]) assert(authorization.resolution?.[key] === false, `r5_selection_boundary_${key}_invalid`)
  assert(fileHashMatches(TRAINER_PATH, TRAINER_SHA256), "r5_selection_trainer_hash_invalid")
  assert(fileHashMatches(COMPILER_PATH, COMPILER_SHA256), "r5_selection_compiler_hash_invalid")
  assertImmutableSources()
  assert(fs.existsSync(resolve(PYTHON)), "r5_selection_cpu_runtime_missing")
  assert(!fs.existsSync(resolve(SELECTION_CONTRACT_PATH)), "r5_selection_contract_already_exists")
  assert(!fs.existsSync(startPath), "r5_selection_authorization_already_started")
}

function assertImmutableSources() {
  assert(fileHashMatches(R5_PROPOSAL_PATH, R5_PROPOSAL_SHA256), "r5_proposal_modified")
  assert(fileHashMatches(R5_SUPPORT_PATH, R5_SUPPORT_SHA256), "r5_support_contract_modified")
  assert(fileHashMatches(R5_SUPPORT_TERMINAL_PATH, R5_SUPPORT_TERMINAL_SHA256), "r5_support_terminal_modified")
  assert(fileHashMatches(R4_CONFIG_PATH, R4_CONFIG_SHA256), "r4_source_config_modified")
  const proposal = readJson(R5_PROPOSAL_PATH)
  assert(proposal.sourceEvidence?.checkpoint?.path === R4_CHECKPOINT_PATH, "r4_checkpoint_path_identity_changed")
  assert(proposal.sourceEvidence?.checkpoint?.sha256 === R4_CHECKPOINT_SHA256, "r4_checkpoint_hash_identity_changed")
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_local_ai_v7_r5_isolated_config_selection",
    runId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `本地AI V7 R5隔离配置：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/run-local-ai-v7-r5-isolated-config-selection.mjs",
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
