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
const REQUEST_ID = "owner-action-request-v7-r5-stage3-internal-isolated-config-selection-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "b2fef210f442476ea4289ece897e4d550e1663c429544fc1c05cd9b82d83b6a3"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "b2cc1fd43823d560c68566c3c1b8401ad9c6e239c702693dd7ac1ce509ad5eec"
const COMMAND_REF = "owner-authorized-v7-r5-stage3-internal-isolated-config-selection-20260804"
const SCOPE = "select_r5_stage3_internal_bounded_parameters_and_compile_inactive_isolated_config_only"
const SELECTION_POLICY = "failure_prevalence_linear_mapping_with_minimum_continuation_and_preserved_trajectory_weight"
const CANDIDATE_PATH = "data/ai-painter/system-governance/v7-r5-stage3-internal-path-coverage-boundary-candidate.json"
const CANDIDATE_SHA256 = "54004f535bd75d018040cf3f651cd6dcc399b0cb0617fb796f3a339aefb3843c"
const SUPPORT_PATH = "data/ai-painter/system-governance/v7-r5-stage3-internal-trainer-support-contract.json"
const SUPPORT_SHA256 = "da41a392815f55154d39b4b8e8ee8f2bf7e00a399042bb0ed2e3553dfb1a3e60"
const SUPPORT_TERMINAL_PATH = ".runtime/ai-painter/local-ai-failure-learning-r5-stage3-trainer-support/local-ai-v7-r5-stage3-trainer-support-2026-08-04T11-27-02-362Z/phase-terminal.json"
const SUPPORT_TERMINAL_SHA256 = "d4f0a5a3862d9354a1843fe0eb2e7f29b73b9edf1a24a4bf69ab581a23835a19"
const BASE_CONFIG_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/isolated-configs/ai-assisted-v7-r5-isolated-config-2026-08-04T09-31-44-704Z/isolated-config.json"
const BASE_CONFIG_SHA256 = "9421b10789ea5590863f789fa3b7933fc806bd8abf32347c900d5d80a3a54089"
const TRAINER_PATH = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const TRAINER_SHA256 = "e3b1eb17e4945e55ae00c196a85ec1d1dc74b4b7e212e43f00a8b7eb9da12265"
const COMPILER_PATH = "ml/ai-painter/scripts/compile_ai_assisted_v7_r5_stage3_internal_isolated_config.py"
const COMPILER_SHA256 = "6321c0c8fa400710b72149e83dbdd014b54c3178a68a3672715e6eb133d2abcd"
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const SELECTION_CONTRACT_PATH = "data/ai-painter/system-governance/v7-r5-stage3-internal-isolated-config-selection-contract.json"
const OUTPUT_ROOT = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/stage3-internal-isolated-configs"
const now = new Date().toISOString()
const runId = `ai-assisted-v7-r5-stage3-internal-isolated-config-${now.replace(/[:.]/g, "-")}`
const runDir = resolve(OUTPUT_ROOT, runId)
const configPath = path.join(runDir, "isolated-config.json")
const selectionPath = path.join(runDir, "selection-report.json")
const registrationPath = resolve(OUTPUT_ROOT, "registrations", `${REQUEST_ID}.json`)

verifyAuthorizationAndSources()
writeImmutableJson(registrationPath, {
  schemaVersion: "ai-assisted-v7-r5-stage3-internal-isolated-config-start-v1",
  status: "registered_before_bounded_selection_and_inactive_compilation",
  runId,
  requestId: REQUEST_ID,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
  selectionPolicy: SELECTION_POLICY,
  fixedStageNumber: 3,
  addsNewFixedStage: false,
  configurationActive: false,
  checkpointFileRead: false,
  checkpointLoaded: false,
  optimizerCreated: false,
  gpuTrainingStarted: false,
})
appendEvent("r5_stage3_internal_isolated_config_selection_started", "running", "有界参数选择和未激活隔离配置编译已启动；Checkpoint读取=false；优化器=false；GPU=false")

try {
  fs.mkdirSync(runDir, { recursive: false })
  const compile = spawnSync(resolve(PYTHON), [
    resolve(COMPILER_PATH),
    "--base-r5-config", resolve(BASE_CONFIG_PATH),
    "--stage3-candidate", resolve(CANDIDATE_PATH),
    "--trainer-support", resolve(SUPPORT_PATH),
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
  assert(compile.status === 0, `r5_stage3_config_compilation_failed:${compile.stderr || compile.stdout}`)
  const config = readJson(configPath)
  const selection = readJson(selectionPath)
  const expected = {
    continuationEpochs: 30,
    replayPassesPerEpoch: 2,
    pathCoverageCalibrationWeight: 0.75,
    authorizedBoundaryTopologyWeight: 0.5,
    pathShortTrajectoryConsistencyWeight: 0.25,
  }
  assert(selection.status === "r5_stage3_bounded_values_selected_isolated_config_compiled_not_active", "r5_stage3_selection_status_invalid")
  assert(selection.selectionPolicy === SELECTION_POLICY, "r5_stage3_selection_policy_invalid")
  assert(JSON.stringify(selection.selectedValues) === JSON.stringify(expected), "r5_stage3_selected_values_invalid")
  assert(Object.values(selection.boundaries).every((value) => value === false), "r5_stage3_selection_crossed_execution_boundary")
  assert(config.status === "isolated_r5_stage3_internal_candidate_not_active", "r5_stage3_config_status_invalid")
  assert(config.training?.trainingAuthorizationStatus === "not_authorized_candidate_only", "r5_stage3_training_improperly_authorized")
  assert(config.training?.pathHardExampleReplay?.passesPerEpoch === 2, "r5_stage3_replay_count_invalid")
  assert(config.training?.pathCoverageCalibration?.weight === 0.75, "r5_stage3_coverage_weight_invalid")
  assert(config.training?.authorizedBoundaryTopology?.weight === 0.5, "r5_stage3_boundary_weight_invalid")
  assert(config.training?.pathShortTrajectoryConsistency?.weight === 0.25, "r5_stage3_trajectory_weight_invalid")
  assert(config.training?.r5Stage3CheckpointContinuation?.sourceCheckpointPath === readJson(CANDIDATE_PATH).proposal.checkpointContinuationProposal.sourceCheckpointPath, "r5_stage3_checkpoint_path_binding_invalid")
  assert(config.training?.r5Stage3CheckpointContinuation?.sourceCheckpointSha256 === readJson(CANDIDATE_PATH).proposal.checkpointContinuationProposal.sourceCheckpointSha256, "r5_stage3_checkpoint_hash_binding_invalid")
  assert(config.training?.r5Stage3CheckpointContinuation?.checkpointFileReadByCompiler === false, "r5_stage3_compiler_read_checkpoint")
  assert(config.training?.r5Stage3CheckpointContinuation?.loadingAuthorizedNow === false, "r5_stage3_checkpoint_loading_enabled")

  const recordedAtUtc = new Date().toISOString()
  const contract = {
    schemaVersion: "ai-assisted-v7-r5-stage3-internal-isolated-config-selection-contract-v1",
    status: "r5_stage3_isolated_config_compiled_not_active_checkpoint_not_read_or_loaded_training_not_authorized",
    generatedBy: "local_ai_v7_r5_stage3_internal_isolated_config_selection_program",
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    fixedStageNumber: 3,
    addsNewFixedStage: false,
    selectionPolicy: SELECTION_POLICY,
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
      candidate: { path: CANDIDATE_PATH, sha256: CANDIDATE_SHA256 },
      trainerSupport: { path: SUPPORT_PATH, sha256: SUPPORT_SHA256 },
      trainerSupportTerminal: { path: SUPPORT_TERMINAL_PATH, sha256: SUPPORT_TERMINAL_SHA256 },
      baseR5IsolatedConfig: { path: BASE_CONFIG_PATH, sha256: BASE_CONFIG_SHA256 },
      trainer: { path: TRAINER_PATH, sha256: TRAINER_SHA256 },
      compiler: { path: COMPILER_PATH, sha256: COMPILER_SHA256 },
      checkpointIdentityCopiedFromCandidateWithoutFileRead: {
        path: config.training.r5Stage3CheckpointContinuation.sourceCheckpointPath,
        sha256: config.training.r5Stage3CheckpointContinuation.sourceCheckpointSha256,
        checkpointFileReadByCompiler: false,
        checkpointDeserialized: false,
        checkpointLoaded: false,
      },
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
      fullTrainingStarted: false,
      strictRevalidationStarted: false,
      formalInferenceStarted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextIndependentAuthorization: "one_r5_stage3_internal_checkpoint_continuation_single_sample_gpu_overfit_smoke_only",
    },
  }
  writeImmutableJson(SELECTION_CONTRACT_PATH, contract)
  verifyImmutableSources()

  const terminal = {
    schemaVersion: "local-ai-v7-r5-stage3-internal-isolated-config-selection-terminal-v1",
    status: "r5_stage3_isolated_config_selection_completed_stopped_before_checkpoint_read_or_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r5_stage3_internal_isolated_config_selection_program",
    fixedStageNumber: 3,
    addsNewFixedStage: false,
    selectedValues: contract.selectedValues,
    compiledConfiguration: contract.compiledConfiguration,
    selectionEvidence: contract.selectionEvidence,
    selectionContract: { path: SELECTION_CONTRACT_PATH, sha256: sha256File(SELECTION_CONTRACT_PATH), status: contract.status },
    closure: {
      boundedValuesSelected: true,
      inactiveIsolatedConfigurationCompiled: true,
      configurationContractValidated: true,
      configurationActive: false,
      checkpointFileReadByCompiler: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      strictRevalidationStarted: false,
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
  appendEvent("r5_stage3_internal_isolated_config_selection_completed", "success", "有界参数已选择且未激活配置已编译；Checkpoint读取=false；优化器=false；GPU=false", stored.runPath)
  console.log(JSON.stringify({
    status: terminal.status,
    selectedValues: terminal.selectedValues,
    configPath: terminal.compiledConfiguration.path,
    configSha256: terminal.compiledConfiguration.sha256,
    reportPath: stored.runPath,
    reportSha256: sha256File(stored.runPath),
    selectionContractPath: SELECTION_CONTRACT_PATH,
    selectionContractSha256: terminal.selectionContract.sha256,
    checkpointFileRead: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    gpuTrainingStarted: false,
    nextState: terminal.closure.nextState,
  }, null, 2))
} catch (error) {
  const terminal = {
    schemaVersion: "local-ai-v7-r5-stage3-internal-isolated-config-selection-terminal-v1",
    status: "r5_stage3_isolated_config_selection_failed_closed_without_checkpoint_read_or_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r5_stage3_internal_isolated_config_selection_program",
    blockers: [String(error?.message ?? error)],
    configurationActive: false,
    checkpointFileRead: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    modelWeightsModified: false,
    gpuTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntered: false,
  }
  const stored = writeImmutableProgramRun({ root: OUTPUT_ROOT, runId, fileName: "phase-terminal.json", record: terminal, latest: { status: terminal.status, blockers: terminal.blockers, trainingStarted: false } })
  appendEvent("r5_stage3_internal_isolated_config_selection_failed", "failed", terminal.blockers.join(","), stored.runPath)
  console.error(JSON.stringify({ ...terminal, reportPath: stored.runPath, reportSha256: sha256File(stored.runPath) }, null, 2))
  process.exitCode = 1
}

function verifyAuthorizationAndSources() {
  assert(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r5_stage3_selection_authorization_hash_invalid")
  assert(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r5_stage3_selection_consumption_hash_invalid")
  const authorization = readJson(AUTHORIZATION_PATH)
  const consumption = readJson(CONSUMPTION_PATH)
  assert(authorization.status === "resolved_owner_authorized", "r5_stage3_selection_authorization_not_resolved")
  assert(authorization.ownerDecision?.commandRef === COMMAND_REF && authorization.ownerDecision?.scope === SCOPE, "r5_stage3_selection_authorization_identity_invalid")
  assert(authorization.selectionContract?.policy === SELECTION_POLICY, "r5_stage3_selection_policy_not_authorized")
  assert(consumption.status === "consumed_before_authorized_write", "r5_stage3_selection_authorization_not_consumed")
  assert(consumption.commandRef === COMMAND_REF && consumption.scope === SCOPE, "r5_stage3_selection_consumption_identity_invalid")
  for (const key of ["boundedParameterSelectionAuthorized", "inactiveIsolatedConfigurationCompilationAuthorized", "configurationContractValidationAuthorized", "immutableEvidenceStorageAuthorized", "automaticTerminalStorageAuthorized"]) {
    assert(authorization.resolution?.[key] === true, `r5_stage3_selection_${key}_missing`)
  }
  for (const key of ["candidateActivationAuthorized", "checkpointFileReadAuthorized", "checkpointDeserializationAuthorized", "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "modelWeightMutationAuthorized", "gpuTrainingAuthorized", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) {
    assert(authorization.resolution?.[key] === false, `r5_stage3_selection_boundary_${key}_invalid`)
  }
  assert(fileHashMatches(COMPILER_PATH, COMPILER_SHA256), "r5_stage3_compiler_hash_invalid")
  verifyImmutableSources()
  assert(fs.existsSync(resolve(PYTHON)), "r5_stage3_cpu_runtime_missing")
  assert(!fs.existsSync(resolve(SELECTION_CONTRACT_PATH)), "r5_stage3_selection_contract_already_exists")
  assert(!fs.existsSync(registrationPath), "r5_stage3_selection_authorization_already_started")
}

function verifyImmutableSources() {
  assert(fileHashMatches(CANDIDATE_PATH, CANDIDATE_SHA256), "r5_stage3_candidate_modified")
  assert(fileHashMatches(SUPPORT_PATH, SUPPORT_SHA256), "r5_stage3_support_contract_modified")
  assert(fileHashMatches(SUPPORT_TERMINAL_PATH, SUPPORT_TERMINAL_SHA256), "r5_stage3_support_terminal_modified")
  assert(fileHashMatches(BASE_CONFIG_PATH, BASE_CONFIG_SHA256), "r5_stage3_base_config_modified")
  assert(fileHashMatches(TRAINER_PATH, TRAINER_SHA256), "r5_stage3_trainer_modified")
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_local_ai_v7_r5_stage3_internal_isolated_config_selection",
    runId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `本地AI V7 R5第3阶段隔离配置：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/run-local-ai-v7-r5-stage3-internal-isolated-config-selection.mjs",
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
