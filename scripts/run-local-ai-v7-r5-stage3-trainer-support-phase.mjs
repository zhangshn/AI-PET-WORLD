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
const REQUEST_ID = "owner-action-request-v7-r5-stage3-cpu-fixture-retry-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "e209125d996ec66d5bbc4e99d0b61cb98f34b6c29923130e9cd028c0db6320e7"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "65656a5fe2f5051b68c93bc8a2bf9107a8552eedd93d6fca636ad4342bf6f893"
const COMMAND_REF = "owner-authorized-v7-r5-stage3-cpu-fixture-repair-and-one-retry-20260804"
const SCOPE = "repair_authorized_south_cpu_fixture_without_west_contact_and_retry_cpu_regression_once_only"
const CANDIDATE_PATH = "data/ai-painter/system-governance/v7-r5-stage3-internal-path-coverage-boundary-candidate.json"
const CANDIDATE_SHA256 = "54004f535bd75d018040cf3f651cd6dcc399b0cb0617fb796f3a339aefb3843c"
const CANDIDATE_TERMINAL_PATH = ".runtime/ai-painter/local-ai-failure-learning-r5-stage3-internal/local-ai-v7-r5-stage3-internal-failure-learning-2026-08-04T10-30-49-274Z/phase-terminal.json"
const CANDIDATE_TERMINAL_SHA256 = "8eb5deecea2c1801d3ad41df348787cd0f18ffc5d84990b7fc5907d9f5606e00"
const CANDIDATE_CPU_REGRESSION_PATH = ".runtime/ai-painter/local-ai-failure-learning-r5-stage3-internal/local-ai-v7-r5-stage3-internal-failure-learning-2026-08-04T10-30-49-274Z/cpu-positive-negative-regression.json"
const CANDIDATE_CPU_REGRESSION_SHA256 = "000ce7f0c77fe1843f77ccae693822d59dff7573e0fef9df25caf620f51c681c"
const TRAINER_PATH = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const TRAINER_BEFORE_SHA256 = "707a0d74905a5682df41fe8d0d3b5680d82f5b2820830fe9711021a57ae60840"
const TRAINER_AFTER_SHA256 = "e3b1eb17e4945e55ae00c196a85ec1d1dc74b4b7e212e43f00a8b7eb9da12265"
const CPU_CHECK_PATH = "ml/ai-painter/scripts/check_ai_assisted_v7_r5_stage3_internal_trainer_support_cpu.py"
const CPU_CHECK_SHA256 = "0bed488cea97a46262bddd7014ca9322a92b4a43abea0202916f16c9d1fa50a9"
const FAILED_CPU_REGRESSION_PATH = ".runtime/ai-painter/local-ai-failure-learning-r5-stage3-trainer-support/local-ai-v7-r5-stage3-trainer-support-2026-08-04T11-15-31-711Z/cpu-positive-negative-regression.json"
const FAILED_CPU_REGRESSION_SHA256 = "f9e1f2fcaa5be0c23a12519b2c0a15e40adcda61b74755f2036f6bd942d407ec"
const FAILED_TERMINAL_PATH = ".runtime/ai-painter/local-ai-failure-learning-r5-stage3-trainer-support/local-ai-v7-r5-stage3-trainer-support-2026-08-04T11-15-31-711Z/phase-terminal.json"
const FAILED_TERMINAL_SHA256 = "9b3af259b6a13584b5cd0f1ce99b0e9a0010e78039f49de2e3101c854082be9f"
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const SUPPORT_CONTRACT_PATH = "data/ai-painter/system-governance/v7-r5-stage3-internal-trainer-support-contract.json"
const OUTPUT_ROOT = ".runtime/ai-painter/local-ai-failure-learning-r5-stage3-trainer-support"
const now = new Date().toISOString()
const runId = `local-ai-v7-r5-stage3-trainer-support-${now.replace(/[:.]/g, "-")}`
const runDir = resolve(OUTPUT_ROOT, runId)
const registrationPath = resolve(OUTPUT_ROOT, "registrations", `${REQUEST_ID}.json`)

verifyAuthorizationAndSources()
writeImmutableJson(registrationPath, {
  schemaVersion: "local-ai-v7-r5-stage3-trainer-support-start-v1",
  status: "registered_after_authorization_consumption_before_cpu_regression",
  runId,
  requestId: REQUEST_ID,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
  fixedStageNumber: 3,
  addsNewFixedStage: false,
  executionValuesSelected: false,
  checkpointLoaded: false,
  optimizerCreated: false,
  gpuTrainingStarted: false,
})
appendEvent("local_ai_v7_r5_stage3_trainer_support_started", "running", "R5第3阶段内部训练器支持与CPU正反回归已启动；参数选择=false；Checkpoint=false；优化器=false；GPU=false")

try {
  fs.mkdirSync(runDir, { recursive: true })
  const regressionPath = path.join(runDir, "cpu-positive-negative-regression.json")
  const cpu = spawnSync(resolve(PYTHON), [resolve(CPU_CHECK_PATH), "--output", regressionPath], {
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
  assert(cpu.status === 0, `r5_stage3_cpu_regression_failed:${cpu.stderr || cpu.stdout}`)
  const regression = readJson(regressionPath)
  assert(regression.status === "passed_cpu_only_stage3_internal_trainer_support_not_selected_not_active", "r5_stage3_cpu_regression_status_invalid")
  assert(Object.values(regression.positiveRegression).every(Boolean), "r5_stage3_positive_regression_incomplete")
  assert(Object.values(regression.negativeRegression).every(Boolean), "r5_stage3_negative_regression_incomplete")
  assertBoundaryClosed(regression.executionBoundary)

  const recordedAtUtc = new Date().toISOString()
  const contract = {
    schemaVersion: "ai-assisted-v7-r5-stage3-internal-trainer-support-contract-v1",
    status: "implemented_cpu_verified_not_selected_not_active_no_checkpoint_load_no_training",
    generatedBy: "local_ai_v7_r5_stage3_internal_trainer_support_program",
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    fixedStageNumber: 3,
    addsNewFixedStage: false,
    sourceCandidate: { path: CANDIDATE_PATH, sha256: CANDIDATE_SHA256 },
    implementation: {
      trainerPath: TRAINER_PATH,
      trainerBeforeSha256: TRAINER_BEFORE_SHA256,
      trainerAfterSha256: TRAINER_AFTER_SHA256,
      cpuRegressionScriptPath: CPU_CHECK_PATH,
      cpuRegressionScriptSha256: CPU_CHECK_SHA256,
      supportedCapabilities: [
        "original_condition_mask_path_coverage_calibration_loss",
        "original_condition_boundary_contact_authorized_topology_loss",
        "exactly_two_original_owner_approved_target_replay_passes_per_epoch",
        "coverage_and_boundary_supervision_across_short_trajectory_steps",
        "failed_preview_target_and_machine_review_threshold_target_rejection",
      ],
    },
    cpuRegressionEvidence: {
      path: projectPath(regressionPath),
      sha256: sha256File(regressionPath),
      status: regression.status,
      positiveRegression: regression.positiveRegression,
      negativeRegression: regression.negativeRegression,
      measurements: regression.measurements,
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
      executionValuesSelected: false,
      candidateActive: false,
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
      nextIndependentAuthorization: "select_r5_stage3_internal_bounded_execution_parameters_and_compile_inactive_isolated_config_only",
    },
  }
  writeImmutableJson(SUPPORT_CONTRACT_PATH, contract)
  verifyImmutableSources()

  const terminal = {
    schemaVersion: "local-ai-v7-r5-stage3-trainer-support-terminal-v1",
    status: "r5_stage3_trainer_support_cpu_verified_stopped_without_parameter_selection_or_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r5_stage3_internal_trainer_support_program",
    fixedStageNumber: 3,
    addsNewFixedStage: false,
    trainer: { path: TRAINER_PATH, beforeSha256: TRAINER_BEFORE_SHA256, afterSha256: TRAINER_AFTER_SHA256 },
    supportContract: { path: SUPPORT_CONTRACT_PATH, sha256: sha256File(SUPPORT_CONTRACT_PATH), status: contract.status },
    cpuRegression: contract.cpuRegressionEvidence,
    closure: {
      pathCoverageCalibrationLossImplemented: true,
      authorizedBoundaryTopologyLossImplemented: true,
      twoOriginalApprovedTargetReplayPassesImplemented: true,
      cpuPositiveNegativeRegressionPassed: true,
      executionValuesSelected: false,
      candidateActive: false,
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
      supportContractPath: SUPPORT_CONTRACT_PATH,
      supportContractSha256: terminal.supportContract.sha256,
      cpuRegressionPassed: true,
      executionValuesSelected: false,
      checkpointLoaded: false,
      trainingStarted: false,
      nextState: terminal.closure.nextState,
    },
  })
  appendEvent("local_ai_v7_r5_stage3_trainer_support_completed", "success", "道路覆盖、授权边界和每Epoch两次原始目标重放支持已通过CPU回归；参数选择=false；Checkpoint=false；GPU=false", stored.runPath)
  console.log(JSON.stringify({
    status: terminal.status,
    reportPath: stored.runPath,
    reportSha256: sha256File(stored.runPath),
    supportContractPath: SUPPORT_CONTRACT_PATH,
    supportContractSha256: terminal.supportContract.sha256,
    cpuRegressionPath: terminal.cpuRegression.path,
    cpuRegressionSha256: terminal.cpuRegression.sha256,
    executionValuesSelected: false,
    checkpointLoaded: false,
    gpuTrainingStarted: false,
    nextState: terminal.closure.nextState,
  }, null, 2))
} catch (error) {
  const terminal = {
    schemaVersion: "local-ai-v7-r5-stage3-trainer-support-terminal-v1",
    status: "r5_stage3_trainer_support_failed_closed_without_parameter_selection_or_training",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r5_stage3_internal_trainer_support_program",
    blockers: [String(error?.message ?? error)],
    executionValuesSelected: false,
    candidateActive: false,
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
  appendEvent("local_ai_v7_r5_stage3_trainer_support_failed", "failed", terminal.blockers.join(","), stored.runPath)
  console.error(JSON.stringify({ ...terminal, reportPath: stored.runPath, reportSha256: sha256File(stored.runPath) }, null, 2))
  process.exitCode = 1
}

function verifyAuthorizationAndSources() {
  assert(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r5_stage3_authorization_hash_invalid")
  assert(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r5_stage3_consumption_hash_invalid")
  const authorization = readJson(AUTHORIZATION_PATH)
  const consumption = readJson(CONSUMPTION_PATH)
  assert(authorization.status === "resolved_owner_authorized", "r5_stage3_authorization_not_resolved")
  assert(authorization.ownerDecision?.commandRef === COMMAND_REF && authorization.ownerDecision?.scope === SCOPE, "r5_stage3_authorization_identity_invalid")
  assert(authorization.taskIdentity?.trainerSha256 === TRAINER_AFTER_SHA256, "r5_stage3_trainer_identity_invalid")
  assert(consumption.status === "consumed_before_authorized_write", "r5_stage3_authorization_not_consumed")
  assert(consumption.commandRef === COMMAND_REF && consumption.scope === SCOPE, "r5_stage3_consumption_identity_invalid")
  for (const key of [
    "cpuFixtureRepairAuthorized",
    "authorizedSouthFixtureMoveAwayFromWestBoundaryAuthorized",
    "oneCpuPositiveNegativeRegressionRetryAuthorized",
    "immutableEvidenceStorageAuthorized",
    "automaticTerminalStorageAuthorized",
  ]) assert(authorization.resolution?.[key] === true, `r5_stage3_${key}_missing`)
  for (const key of [
    "trainerLossModificationAuthorized",
    "formalExecutionValueSelectionAuthorized",
    "checkpointDeserializationAuthorized",
    "checkpointLoadingAuthorized",
    "optimizerCreationAuthorized",
    "gpuTrainingAuthorized",
    "fullTrainingAuthorized",
    "strictRevalidationAuthorized",
    "formalInferenceAuthorized",
    "runtimeFrameAuthorized",
    "worldEntryAuthorized",
  ]) assert(authorization.resolution?.[key] === false, `r5_stage3_boundary_${key}_invalid`)
  assert(fileHashMatches(TRAINER_PATH, TRAINER_AFTER_SHA256), "r5_stage3_trainer_hash_invalid")
  assert(fileHashMatches(CPU_CHECK_PATH, CPU_CHECK_SHA256), "r5_stage3_cpu_check_hash_invalid")
  assert(fileHashMatches(FAILED_CPU_REGRESSION_PATH, FAILED_CPU_REGRESSION_SHA256), "r5_stage3_failed_cpu_evidence_modified")
  assert(fileHashMatches(FAILED_TERMINAL_PATH, FAILED_TERMINAL_SHA256), "r5_stage3_failed_terminal_modified")
  verifyImmutableSources()
  assert(fs.existsSync(resolve(PYTHON)), "r5_stage3_cpu_runtime_missing")
  assert(!fs.existsSync(resolve(SUPPORT_CONTRACT_PATH)), "r5_stage3_support_contract_already_exists")
  assert(!fs.existsSync(registrationPath), "r5_stage3_authorization_already_started")
}

function verifyImmutableSources() {
  assert(fileHashMatches(CANDIDATE_PATH, CANDIDATE_SHA256), "r5_stage3_candidate_modified")
  assert(fileHashMatches(CANDIDATE_TERMINAL_PATH, CANDIDATE_TERMINAL_SHA256), "r5_stage3_candidate_terminal_modified")
  assert(fileHashMatches(CANDIDATE_CPU_REGRESSION_PATH, CANDIDATE_CPU_REGRESSION_SHA256), "r5_stage3_candidate_cpu_regression_modified")
}

function assertBoundaryClosed(boundary) {
  for (const key of [
    "executionValuesSelected",
    "candidateActive",
    "checkpointLoaded",
    "optimizerCreated",
    "modelWeightsModified",
    "gpuTrainingStarted",
    "validationStarted",
    "formalInferenceStarted",
    "runtimeFrameStarted",
    "worldEntered",
  ]) assert(boundary?.[key] === false, `r5_stage3_cpu_boundary_${key}_invalid`)
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_local_ai_v7_r5_stage3_trainer_support_phase",
    runId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `本地AI V7 R5第3阶段训练器支持：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/run-local-ai-v7-r5-stage3-trainer-support-phase.mjs",
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
