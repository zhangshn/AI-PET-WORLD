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
const REQUEST_ID = "owner-action-request-v7-r4-smoke-config-compilation-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "a27eed02dfdf2a3b0c972c654d93ef46f620892722097af2c679da3a2a829dde"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "96f417da5c87b1b8cafc6498ef2a6d21c1c93402932abcbee49f2850d43a769a"
const COMMAND_REF = "owner-authorized-v7-r4-smoke-config-compilation-20260804"
const SCOPE = "select_r4_bounded_weights_and_compile_isolated_single_sample_smoke_configuration_only"
const PROPOSAL_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r4-candidate-proposal.json"
const PROPOSAL_SHA256 = "255bf781bd7b63af3d993ca1da73a1a3c2d3d4653c9ce6e0eed28ae95b1de884"
const SUPPORT_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r4-trainer-support-contract.json"
const SUPPORT_SHA256 = "09e52752f3d2451de5ace75ee6a6a122f9fbd959d057ff414c5b698700165e68"
const R3_CANDIDATE_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r3-candidate-overlay.json"
const R3_CANDIDATE_SHA256 = "6c013e05a36c85646b18fde12b5573049be8ea1703c47899f54956d468a2a501"
const R2_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r2-training-overlay.json"
const R2_SHA256 = "888393b34fe24e588c83be7e9981f08739f2c6b85228584af57135d5889d7a6d"
const R3_SMOKE_CONFIG_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r3/derived-configs/ai-assisted-v7-repair-r3-random-init-single-sample-overfit-smoke-2026-08-04T05-57-12-288Z.json"
const R3_SMOKE_CONFIG_SHA256 = "fb21621860a5f2816c1027e69414d17b075efc2cbaa7b3b087110d0ee00832c6"
const TRAINER_PATH = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const TRAINER_SHA256 = "3dacafe35fcce05456ed040247aaf2d9fa31bf2459e35bddb19ebf5446e491e8"
const CPU_CHECK = "ml/ai-painter/scripts/check_ai_assisted_v7_r4_smoke_config_compilation_cpu.py"
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const CANDIDATE_CONTRACT_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r4-isolated-smoke-candidate-contract.json"
const OUTPUT_ROOT = ".runtime/ai-painter/local-ai-v7-r4-smoke-configurations"
const now = new Date().toISOString()
const runId = `local-ai-v7-r4-smoke-config-${now.replace(/[:.]/g, "-")}`
const runDir = resolve(OUTPUT_ROOT, runId)
const registrationPath = resolve(OUTPUT_ROOT, "registrations", `${REQUEST_ID}.json`)

verifyAuthorizationAndInputs()
writeImmutableJson(registrationPath, {
  schemaVersion: "local-ai-v7-r4-smoke-config-compilation-start-v1",
  runId,
  requestId: REQUEST_ID,
  status: "registered_before_selection_and_configuration_write",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
  gpuSmokeStarted: false,
  trainingStarted: false,
})
appendEvent("local_ai_v7_r4_smoke_config_compilation_started", "running", "evidence selection and isolated configuration compilation only; training=false")

try {
  fs.mkdirSync(runDir, { recursive: true })
  const proposal = readJson(PROPOSAL_PATH)
  const r3Candidate = readJson(R3_CANDIDATE_PATH)
  const r3SmokeConfig = readJson(R3_SMOKE_CONFIG_PATH)
  const selectionPath = path.join(runDir, "r4-bounded-weight-selection.json")
  const compiledConfigPath = path.join(runDir, "r4-isolated-single-sample-smoke-config.json")
  const regressionPath = path.join(runDir, "cpu-configuration-regression.json")
  const selection = compileEvidenceDrivenSelection({
    proposal,
    selectionProjectPath: projectPath(selectionPath),
    r3SmokeConfig,
  })
  writeImmutableJson(selectionPath, selection)
  const selectionSha256 = sha256File(selectionPath)

  const cpu = spawnSync(resolve(PYTHON), [
    resolve(CPU_CHECK),
    "--base-config", resolve(r3Candidate.baseConfigPath),
    "--r3-candidate", resolve(R3_CANDIDATE_PATH),
    "--r4-proposal", resolve(PROPOSAL_PATH),
    "--selection", selectionPath,
    "--selection-sha256", selectionSha256,
    "--compiled-config-project-path", projectPath(compiledConfigPath),
    "--output-config", compiledConfigPath,
    "--output-report", regressionPath,
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
  assert(cpu.status === 0, `r4_smoke_config_cpu_regression_failed:${cpu.stderr || cpu.stdout}`)
  const regression = readJson(regressionPath)
  assert(regression.status === "passed_cpu_configuration_only_not_active_no_training", "r4_smoke_config_regression_status_invalid")
  assert(Object.values(regression.positiveRegression).every(Boolean), "r4_smoke_config_positive_regression_incomplete")
  assert(Object.values(regression.negativeRegression).every(Boolean), "r4_smoke_config_negative_regression_incomplete")
  assert(regression.optimizerCreated === false && regression.modelWeightsModified === false, "r4_smoke_config_regression_modified_model")
  assert(regression.gpuTrainingStarted === false && regression.validationStarted === false, "r4_smoke_config_regression_crossed_execution_boundary")

  const compiled = readJson(compiledConfigPath)
  assert(compiled.status === "isolated_r4_candidate_not_active", "r4_compiled_config_status_invalid")
  assert(compiled.training.trainingAuthorizationStatus === "not_authorized_candidate_only", "r4_compiled_config_training_status_invalid")
  assert(compiled.training.r4SmokeCandidateContract.gpuSmokeAuthorized === false, "r4_compiled_config_gpu_authorization_invalid")
  assert(compiled.training.denoiserLossWeights.pathInteriorRgb === 2, "r4_selected_path_interior_weight_invalid")
  assert(compiled.training.denoiserLossWeights.pathForbiddenBoundaryRgb === 2, "r4_selected_forbidden_boundary_weight_invalid")

  const contract = {
    schemaVersion: "ai-assisted-v7-r4-isolated-smoke-candidate-contract-v1",
    status: "compiled_cpu_verified_isolated_not_active_gpu_smoke_not_authorized",
    generatedBy: "local_ai_v7_r4_smoke_config_compiler",
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    selection: {
      path: projectPath(selectionPath),
      sha256: selectionSha256,
      selectedWeights: selection.selectedWeights,
      rule: selection.selectionRule,
    },
    compiledConfiguration: {
      path: projectPath(compiledConfigPath),
      sha256: sha256File(compiledConfigPath),
      status: compiled.status,
      plannedOverfitSampleId: compiled.training.r4SmokeCandidateContract.plannedOverfitSampleId,
      plannedInitialization: compiled.training.r4SmokeCandidateContract.plannedInitialization,
      plannedEpochs: compiled.training.r4SmokeCandidateContract.plannedEpochs,
      plannedEvaluationInterval: compiled.training.r4SmokeCandidateContract.plannedEvaluationInterval,
      requiredTailEpochs: compiled.training.r4SmokeCandidateContract.requiredTailEpochs,
    },
    cpuRegression: {
      path: projectPath(regressionPath),
      sha256: sha256File(regressionPath),
      status: regression.status,
      positiveRegression: regression.positiveRegression,
      negativeRegression: regression.negativeRegression,
    },
    sourceEvidence: {
      proposal: { path: PROPOSAL_PATH, sha256: PROPOSAL_SHA256 },
      trainerSupport: { path: SUPPORT_PATH, sha256: SUPPORT_SHA256 },
      r3Candidate: { path: R3_CANDIDATE_PATH, sha256: R3_CANDIDATE_SHA256 },
      r3SmokeConfig: { path: R3_SMOKE_CONFIG_PATH, sha256: R3_SMOKE_CONFIG_SHA256 },
      trainer: { path: TRAINER_PATH, sha256: TRAINER_SHA256 },
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
      candidateActive: false,
      formalConfigurationActive: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuSmokeAuthorized: false,
      gpuTrainingStarted: false,
      validationStarted: false,
      formalInferenceStarted: false,
      checkpointPromoted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
      nextIndependentAuthorization: "r4_single_sample_gpu_overfit_smoke_execution_only",
    },
  }
  writeImmutableJson(CANDIDATE_CONTRACT_PATH, contract)
  const sourcesAfter = captureSourceHashes()
  assert(sourcesAfter.proposal === PROPOSAL_SHA256, "r4_proposal_modified")
  assert(sourcesAfter.support === SUPPORT_SHA256, "r4_trainer_support_modified")
  assert(sourcesAfter.r3Candidate === R3_CANDIDATE_SHA256, "r3_candidate_modified")
  assert(sourcesAfter.r2 === R2_SHA256, "r2_overlay_modified")
  assert(sourcesAfter.r3SmokeConfig === R3_SMOKE_CONFIG_SHA256, "r3_smoke_config_modified")
  assert(sourcesAfter.trainer === TRAINER_SHA256, "r4_trainer_modified_during_compilation")

  const terminal = {
    schemaVersion: "local-ai-v7-r4-smoke-config-compilation-terminal-v1",
    status: "r4_isolated_smoke_config_cpu_verified_stopped_before_gpu",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r4_smoke_config_compiler",
    selection: contract.selection,
    compiledConfiguration: contract.compiledConfiguration,
    candidateContract: {
      path: CANDIDATE_CONTRACT_PATH,
      sha256: sha256File(CANDIDATE_CONTRACT_PATH),
      status: contract.status,
    },
    cpuRegression: contract.cpuRegression,
    immutableSourcesAfter: sourcesAfter,
    closure: {
      evidenceDrivenBoundedSelectionCompleted: true,
      isolatedSingleSampleSmokeConfigCompiled: true,
      cpuConfigurationRegressionPassed: true,
      objectSemanticWeightsModified: false,
      reviewThresholdsModified: false,
      candidateActivated: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuSmokeStarted: false,
      trainingStarted: false,
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
      selectedWeights: selection.selectedWeights,
      candidateContractPath: CANDIDATE_CONTRACT_PATH,
      candidateContractSha256: terminal.candidateContract.sha256,
      gpuSmokeStarted: false,
      trainingStarted: false,
      nextState: terminal.closure.nextState,
    },
  })
  appendEvent("local_ai_v7_r4_smoke_config_compilation_completed", "success", "R4 isolated Smoke config compiled and CPU verified; GPU Smoke=false", stored.runPath)
  console.log(JSON.stringify({
    status: terminal.status,
    reportPath: stored.runPath,
    reportSha256: sha256File(stored.runPath),
    candidateContractPath: CANDIDATE_CONTRACT_PATH,
    candidateContractSha256: terminal.candidateContract.sha256,
    compiledConfigPath: terminal.compiledConfiguration.path,
    compiledConfigSha256: terminal.compiledConfiguration.sha256,
    selectedWeights: selection.selectedWeights,
    gpuSmokeStarted: false,
    nextState: terminal.closure.nextState,
  }, null, 2))
} catch (error) {
  const terminal = {
    schemaVersion: "local-ai-v7-r4-smoke-config-compilation-terminal-v1",
    status: "r4_smoke_config_compilation_failed_closed_without_gpu",
    runId,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_v7_r4_smoke_config_compiler",
    blockers: [String(error?.message ?? error)],
    candidateActivated: false,
    optimizerCreated: false,
    modelWeightsModified: false,
    gpuSmokeStarted: false,
    trainingStarted: false,
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
    latest: { status: terminal.status, blockers: terminal.blockers, gpuSmokeStarted: false },
  })
  appendEvent("local_ai_v7_r4_smoke_config_compilation_failed", "failed", terminal.blockers.join(","), stored.runPath)
  console.error(JSON.stringify({ ...terminal, reportPath: stored.runPath, reportSha256: sha256File(stored.runPath) }, null, 2))
  process.exitCode = 1
}

function compileEvidenceDrivenSelection({ proposal, selectionProjectPath, r3SmokeConfig }) {
  const searches = proposal.proposal?.pathStabilityWeightSearch ?? {}
  const interior = selectBoundedWeight("pathInteriorRgb", searches.pathInteriorRgb)
  const forbidden = selectBoundedWeight("pathForbiddenBoundaryRgb", searches.pathForbiddenBoundaryRgb)
  assert(interior.selected === 2 && forbidden.selected === 2, "r4_evidence_selection_did_not_reach_expected_bounds")
  return {
    schemaVersion: "ai-assisted-v7-r4-bounded-weight-selection-v1",
    status: "evidence_driven_bounded_selection_completed_not_active",
    generatedBy: "local_ai_v7_r4_evidence_weight_selector",
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    selectionRule: "select_maximum_when_issue_occurs_at_least_three_times_or_recurs_in_required_tail_otherwise_preserve_current",
    selectedWeights: {
      pathInteriorRgb: interior.selected,
      pathForbiddenBoundaryRgb: forbidden.selected,
    },
    evidence: { pathInteriorRgb: interior, pathForbiddenBoundaryRgb: forbidden },
    objectSemanticWeightPolicy: "preserved_unchanged",
    reviewThresholdPolicy: "preserved_unchanged",
    plannedSmoke: {
      mode: "single_sample_overfit_smoke",
      overfitSampleId: r3SmokeConfig.training.authorizedOverfitSampleId,
      initialization: r3SmokeConfig.training.authorizedInitialization,
      epochs: 120,
      evaluationInterval: 10,
      parentCheckpointAllowed: false,
      requiredTailEpochs: [100, 110, 120],
    },
    identity: {
      selectionPath: selectionProjectPath,
      proposalPath: PROPOSAL_PATH,
      proposalSha256: PROPOSAL_SHA256,
      trainerSupportContractPath: SUPPORT_PATH,
      trainerSupportContractSha256: SUPPORT_SHA256,
      sourceR3SmokeConfigPath: R3_SMOKE_CONFIG_PATH,
      sourceR3SmokeConfigSha256: R3_SMOKE_CONFIG_SHA256,
    },
    candidateActive: false,
    gpuTrainingAuthorized: false,
  }
}

function selectBoundedWeight(name, entry) {
  const current = Number(entry?.current)
  const minimum = Number(entry?.minimum)
  const maximum = Number(entry?.maximum)
  const epochs = [...(entry?.occurrenceEpochs ?? [])].map(Number)
  const tailRecurrenceEpoch = entry?.tailRecurrenceEpoch == null ? null : Number(entry.tailRecurrenceEpoch)
  assert([current, minimum, maximum].every(Number.isFinite), `r4_${name}_range_invalid`)
  assert(minimum <= current && current <= maximum, `r4_${name}_current_outside_range`)
  const repeated = epochs.length >= 3
  const tailRecurrence = tailRecurrenceEpoch != null
  const selected = repeated || tailRecurrence ? maximum : current
  return {
    current,
    minimum,
    maximum,
    occurrenceEpochs: epochs,
    occurrenceCount: epochs.length,
    tailRecurrenceEpoch,
    repeatedAtLeastThreeTimes: repeated,
    recurredInRequiredTail: tailRecurrence,
    selected,
    selectionReason: repeated || tailRecurrence
      ? "bounded_maximum_selected_from_repeated_failure_evidence"
      : "current_weight_preserved_without_repeated_failure_evidence",
  }
}

function verifyAuthorizationAndInputs() {
  assert(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r4_config_authorization_hash_invalid")
  assert(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r4_config_consumption_hash_invalid")
  const authorization = readJson(AUTHORIZATION_PATH)
  const consumption = readJson(CONSUMPTION_PATH)
  assert(authorization.status === "resolved_owner_authorized", "r4_config_authorization_not_resolved")
  assert(authorization.ownerDecision?.commandRef === COMMAND_REF, "r4_config_authorization_command_invalid")
  assert(authorization.ownerDecision?.scope === SCOPE, "r4_config_authorization_scope_invalid")
  assert(consumption.status === "consumed_before_authorized_write", "r4_config_authorization_not_consumed")
  assert(consumption.commandRef === COMMAND_REF && consumption.scope === SCOPE, "r4_config_consumption_identity_invalid")
  for (const key of [
    "evidenceDrivenBoundedWeightSelectionAuthorized",
    "isolatedR4SingleSampleSmokeConfigCompilationAuthorized",
    "cpuConfigurationRegressionAuthorized",
    "automaticTerminalStorageAuthorized",
  ]) assert(authorization.resolution?.[key] === true, `r4_config_${key}_missing`)
  for (const key of [
    "candidateActivationAuthorized",
    "gpuSmokeAuthorized",
    "trainingAuthorized",
    "validationAuthorized",
    "formalInferenceAuthorized",
    "checkpointPromotionAuthorized",
    "runtimeFrameAuthorized",
    "worldEntryAuthorized",
  ]) assert(authorization.resolution?.[key] === false, `r4_config_boundary_${key}_invalid`)
  assert(fileHashMatches(PROPOSAL_PATH, PROPOSAL_SHA256), "r4_proposal_hash_invalid")
  assert(fileHashMatches(SUPPORT_PATH, SUPPORT_SHA256), "r4_support_hash_invalid")
  assert(fileHashMatches(R3_CANDIDATE_PATH, R3_CANDIDATE_SHA256), "r3_candidate_hash_invalid")
  assert(fileHashMatches(R2_PATH, R2_SHA256), "r2_overlay_hash_invalid")
  assert(fileHashMatches(R3_SMOKE_CONFIG_PATH, R3_SMOKE_CONFIG_SHA256), "r3_smoke_config_hash_invalid")
  assert(fileHashMatches(TRAINER_PATH, TRAINER_SHA256), "r4_trainer_hash_invalid")
  assert(fs.existsSync(resolve(PYTHON)) && fs.existsSync(resolve(CPU_CHECK)), "r4_config_cpu_runtime_missing")
  assert(!fs.existsSync(resolve(CANDIDATE_CONTRACT_PATH)), "r4_candidate_contract_already_exists")
  assert(!fs.existsSync(registrationPath), "r4_config_authorization_already_started")
}

function captureSourceHashes() {
  return {
    proposal: sha256File(PROPOSAL_PATH),
    support: sha256File(SUPPORT_PATH),
    r3Candidate: sha256File(R3_CANDIDATE_PATH),
    r2: sha256File(R2_PATH),
    r3SmokeConfig: sha256File(R3_SMOKE_CONFIG_PATH),
    trainer: sha256File(TRAINER_PATH),
  }
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_local_ai_v7_r4_smoke_config_compilation",
    runId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `本地AI V7 R4隔离Smoke配置：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/run-local-ai-v7-r4-smoke-config-compilation.mjs",
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
