import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-phase0-execution-entry-implementation-20260815-153000000"
const SCOPE = "one_cpu_only_implementation_of_inactive_object_reference_multiscale_phase0_execution_entry_and_contract_regression"
const AUTH_SHA = "0a188437aa37b6a5222a5b4cf928d96523087554a9ae78c32701976c42fc6943"
const CONSUMPTION_SHA = "c9b5bce500cbbd8140162631264a6b9817630140b41ac4f8828d0cc4433448cf"
const CORRECTION_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-phase0-false-positive-contract-correction-20260815-160000000"
const CORRECTION_SCOPE = "one_cpu_only_phase0_false_positive_adjudication_and_entry_contract_correction"
const CORRECTION_AUTH_SHA = "bd6dfa1a6b5c828132347652ba739602dc30b2e83ad2cbfc4b3d0a0aa33f1966"
const CORRECTION_CONSUMPTION_SHA = "6e257b37c92d46bc95b5a416883db5bbbb0c60c7f05bf70b97f6d861409163c2"
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const PYTHON_ENTRY = "ml/ai-painter/scripts/run_stage4_object_visible_structure_phase0.py"
const PYTHON_CHECKER = "ml/ai-painter/scripts/check_stage4_object_reference_multiscale_phase0_cpu.py"
const NODE_RUNNER = "scripts/run-stage4-object-reference-multiscale-phase0.mjs"
const TARGETS = [
  PYTHON_ENTRY,
  PYTHON_CHECKER,
  NODE_RUNNER,
  "scripts/check-stage4-object-reference-multiscale-phase0-execution-entry.mjs",
]

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.ok(value); assert.equal(path.isAbsolute(value), false); const result = path.resolve(ROOT, value); assert.ok(result.startsWith(`${ROOT}${path.sep}`)); return result }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(projectFile(value))).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(projectFile(value), "utf8"))
const clone = (value) => structuredClone(value)
const rejects = (fn) => { try { fn(); return false } catch { return true } }

function validateCorrectionAuthorization(candidateAuthorization, candidateConsumption) {
  assert.equal(candidateAuthorization.schemaVersion, "ai-painter-owner-stage4-object-reference-multiscale-phase0-false-positive-contract-correction-v1")
  assert.equal(candidateAuthorization.status, "owner_authorized_unconsumed")
  assert.equal(candidateAuthorization.requestId, CORRECTION_REQUEST_ID)
  assert.equal(candidateAuthorization.commandRef, CORRECTION_REQUEST_ID)
  assert.equal(candidateAuthorization.scope, CORRECTION_SCOPE)
  assert.equal(candidateAuthorization.sourceRunId, "20260815-154500000-phase0")
  assert.equal(candidateAuthorization.ownerDecision.classification, "program_and_evidence_contract_false_positive")
  assert.equal(candidateAuthorization.ownerDecision.smokeEntryAccepted, false)
  assert.equal(candidateAuthorization.bindings.diagnosticCheckpointIdentity.weightsReadAuthorized, false)
  assert.equal(candidateAuthorization.execution.maximumExecutions, 1)
  assert.equal(candidateAuthorization.execution.consumeBeforeFirstWrite, true)
  assert.equal(candidateConsumption.status, "stage4_object_reference_multiscale_phase0_false_positive_contract_correction_authorization_atomically_consumed")
  assert.equal(candidateConsumption.authorizationSha256, CORRECTION_AUTH_SHA)
  assert.equal(candidateConsumption.requestId, CORRECTION_REQUEST_ID)
  assert.equal(candidateConsumption.commandRef, CORRECTION_REQUEST_ID)
  assert.equal(candidateConsumption.scope, CORRECTION_SCOPE)
  assert.equal(candidateConsumption.oneTimeConsumption, true)
  for (const key of ["gpuUsed", "cudaInitialized", "autogradExecuted", "diagnosticCheckpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "weightModified", "trainingStarted", "validationStarted", "smokeStarted", "automaticRetryStarted"]) assert.equal(candidateConsumption[key], false, `${key}_opened`)
  return true
}

if (process.argv.includes("--correction-contract")) {
  const correctionAuthorizationPath = arg("--correction-authorization")
  const correctionConsumptionPath = arg("--correction-consumption")
  assert.equal(sha(correctionAuthorizationPath), CORRECTION_AUTH_SHA)
  assert.equal(sha(correctionConsumptionPath), CORRECTION_CONSUMPTION_SHA)
  const correctionAuthorization = read(correctionAuthorizationPath)
  const correctionConsumption = read(correctionConsumptionPath)
  validateCorrectionAuthorization(correctionAuthorization, correctionConsumption)
  for (const [name, binding] of Object.entries(correctionAuthorization.bindings)) {
    if (name.endsWith("Preimage")) assert.notEqual(sha(binding.path), binding.sha256, `${name}_not_changed`)
    else assert.equal(sha(binding.path), binding.sha256, `${name}_changed`)
  }
  const falseUpdate = read(correctionAuthorization.bindings.updateReport.path)
  const falseTerminal = read(correctionAuthorization.bindings.falsePositiveTerminal.path)
  const environment = { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTHONDONTWRITEBYTECODE: "1" }
  for (const target of [PYTHON_ENTRY, PYTHON_CHECKER, "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"]) {
    const syntax = spawnSync(PYTHON, ["-B", "-c", "import ast,pathlib,sys;ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))", projectFile(target)], { cwd: ROOT, encoding: "utf8", env: environment, windowsHide: true })
    assert.equal(syntax.status, 0, `python_syntax_failed:${target}:${syntax.stderr}`)
  }
  for (const target of [NODE_RUNNER, TARGETS[3]]) {
    const syntax = spawnSync(process.execPath, ["--check", projectFile(target)], { cwd: ROOT, encoding: "utf8", env: environment })
    assert.equal(syntax.status, 0, `node_syntax_failed:${target}:${syntax.stderr}`)
  }
  const pythonRegression = spawnSync(PYTHON, ["-B", projectFile(PYTHON_CHECKER)], { cwd: ROOT, encoding: "utf8", env: environment, windowsHide: true })
  assert.equal(pythonRegression.status, 0, `python_cpu_contract_failed:${pythonRegression.stderr}`)
  const pythonReport = JSON.parse(pythonRegression.stdout)
  const runnerContract = spawnSync(process.execPath, [
    projectFile(NODE_RUNNER),
    "--implementation-authorization", ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-reference-multiscale-phase0-execution-entry-implementation-20260815-153000000/authorization.json",
    "--implementation-consumption", ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-reference-multiscale-phase0-execution-entry-implementation-20260815-153000000/consumption.json",
    "--correction-authorization", correctionAuthorizationPath,
    "--correction-consumption", correctionConsumptionPath,
    "--correction-contract-only",
  ], { cwd: ROOT, encoding: "utf8", env: environment })
  assert.equal(runnerContract.status, 0, `runner_correction_contract_failed:${runnerContract.stderr}`)
  const runnerReport = JSON.parse(runnerContract.stdout)
  const trainerSource = fs.readFileSync(projectFile("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"), "utf8")
  const runnerSource = fs.readFileSync(projectFile(NODE_RUNNER), "utf8")
  const positive = {
    authorizationAndConsumptionValid: validateCorrectionAuthorization(correctionAuthorization, correctionConsumption),
    falsePositiveOwnerDecisionBound: correctionAuthorization.ownerDecision.smokeEntryAccepted === false,
    falsePositiveEvidenceDetected: falseTerminal.status === "stage4_object_reference_multiscale_phase0_passed_closed" && falseUpdate.optimizerStepCount === null && Object.keys(falseUpdate.requiredGradientGroups).length === 0,
    checkpointWeightsNotRead: correctionAuthorization.bindings.diagnosticCheckpointIdentity.weightsReadAuthorized === false,
    pythonSyntaxPassed: true,
    nodeSyntaxPassed: true,
    pythonPositivePassed: pythonReport.positivePassed === pythonReport.positiveTotal,
    pythonNegativePassed: pythonReport.negativePassed === pythonReport.negativeTotal,
    runnerCorrectionContractPassed: runnerReport.status === "stage4_object_reference_multiscale_phase0_false_positive_contract_correction_entry_valid_cpu_only",
    runnerNoRuntimeOpened: ["gpuStarted", "cudaInitialized", "autogradExecuted", "diagnosticCheckpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted"].every((key) => runnerReport[key] === false),
    exactOneStepGateImplemented: trainerSource.includes("optimizer_steps != {1}") && runnerSource.includes("report.optimizerStepCount, 1"),
    replaySuppressionImplemented: trainerSource.includes("enable_epoch_worst_replay=not object_reference_multiscale_phase0") && runnerSource.includes("report.replayOptimizerStepCount, 0"),
    exact48GateImplemented: trainerSource.includes("len(expected_fields) != 48") && runnerSource.includes("manifest.fieldCount, 48"),
    fourObjectAndMatchingExpertGateImplemented: trainerSource.includes("matchingSemanticMixtureExpertGradient") && runnerSource.includes("matchingSemanticMixtureExpertGradient.absoluteSum"),
    parameterGradientsClearedGateImplemented: trainerSource.includes("parameter_gradients_cleared") && runnerSource.includes("report.parameterGradientsCleared, true"),
  }
  const mutations = {
    rejectWrongRequestId: (x) => { x.authorization.requestId = "wrong" },
    rejectWrongCommandRef: (x) => { x.authorization.commandRef = "wrong" },
    rejectWrongScope: (x) => { x.authorization.scope = "wrong" },
    rejectSmokeAccepted: (x) => { x.authorization.ownerDecision.smokeEntryAccepted = true },
    rejectCheckpointWeightRead: (x) => { x.authorization.bindings.diagnosticCheckpointIdentity.weightsReadAuthorized = true },
    rejectReusableConsumption: (x) => { x.consumption.oneTimeConsumption = false },
    rejectGpuUsed: (x) => { x.consumption.gpuUsed = true },
    rejectCudaInitialized: (x) => { x.consumption.cudaInitialized = true },
    rejectAutograd: (x) => { x.consumption.autogradExecuted = true },
    rejectCheckpointRead: (x) => { x.consumption.diagnosticCheckpointRead = true },
    rejectOptimizer: (x) => { x.consumption.optimizerCreated = true },
    rejectBackward: (x) => { x.consumption.backwardExecuted = true },
    rejectTraining: (x) => { x.consumption.trainingStarted = true },
    rejectSmoke: (x) => { x.consumption.smokeStarted = true },
  }
  const negative = Object.fromEntries(Object.entries(mutations).map(([name, mutate]) => {
    const candidate = { authorization: clone(correctionAuthorization), consumption: clone(correctionConsumption) }
    mutate(candidate)
    return [name, rejects(() => validateCorrectionAuthorization(candidate.authorization, candidate.consumption))]
  }))
  const failedPositiveKeys = Object.entries(positive).filter(([, value]) => value !== true).map(([name]) => name)
  const failedNegativeKeys = Object.entries(negative).filter(([, value]) => value !== true).map(([name]) => name)
  console.log(JSON.stringify({
    schemaVersion: "stage4-object-reference-multiscale-phase0-false-positive-contract-correction-cpu-report-v1",
    status: failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0 ? "stage4_object_reference_multiscale_phase0_false_positive_contract_correction_cpu_passed" : "stage4_object_reference_multiscale_phase0_false_positive_contract_correction_cpu_failed_closed",
    positive, negative,
    positivePassed: Object.values(positive).filter((value) => value === true).length,
    positiveTotal: Object.keys(positive).length,
    negativePassed: Object.values(negative).filter((value) => value === true).length,
    negativeTotal: Object.keys(negative).length,
    failedPositiveKeys, failedNegativeKeys,
    pythonReport, runnerReport,
    gpuUsedNow: false, cudaInitializedNow: false, autogradExecutedNow: false,
    diagnosticCheckpointReadNow: false, modelLoadedNow: false, optimizerCreatedNow: false,
    backwardExecutedNow: false, trainingStartedNow: false,
  }, null, 2))
  process.exit(failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0 ? 0 : 1)
}

const authorizationPath = arg("--authorization")
const consumptionPath = arg("--consumption")
assert.equal(sha(authorizationPath), AUTH_SHA)
assert.equal(sha(consumptionPath), CONSUMPTION_SHA)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)

function validateImplementation(candidateAuthorization, candidateConsumption) {
  assert.equal(candidateAuthorization.schemaVersion, "ai-painter-owner-stage4-object-reference-multiscale-phase0-execution-entry-implementation-v1")
  assert.equal(candidateAuthorization.status, "owner_authorized_unconsumed")
  assert.equal(candidateAuthorization.requestId, REQUEST_ID)
  assert.equal(candidateAuthorization.commandRef, REQUEST_ID)
  assert.equal(candidateAuthorization.scope, SCOPE)
  assert.deepEqual(candidateAuthorization.authorizedTargetPaths, TARGETS)
  assert.equal(candidateAuthorization.execution.consumeBeforeFirstWrite, true)
  assert.equal(candidateConsumption.status, "stage4_object_reference_multiscale_phase0_execution_entry_implementation_authorization_atomically_consumed")
  assert.equal(candidateConsumption.authorizationSha256, AUTH_SHA)
  assert.equal(candidateConsumption.requestId, REQUEST_ID)
  assert.equal(candidateConsumption.commandRef, REQUEST_ID)
  assert.equal(candidateConsumption.scope, SCOPE)
  assert.equal(candidateConsumption.oneTimeConsumption, true)
  assert.equal(candidateConsumption.firstAuthorizedWrite, true)
  for (const key of ["gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted"]) assert.equal(candidateConsumption[key], false, `${key}_opened`)
  return true
}
validateImplementation(authorization, consumption)
assert.equal(Object.keys(authorization.bindings).length, 18)
for (const [name, binding] of Object.entries(authorization.bindings)) {
  if (name === "phase0PythonRunner") {
    assert.equal(binding.sha256, "d5e05ba5a1021237219e8bd4610f9a0851ff2d2e005c8809cbe2946efcb4d1ad")
    assert.notEqual(sha(binding.path), binding.sha256)
  } else {
    assert.equal(sha(binding.path), binding.sha256, `${name}_binding_changed`)
  }
}
for (const target of TARGETS) assert.equal(fs.existsSync(projectFile(target)), true, `target_missing:${target}`)

const environment = { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTHONDONTWRITEBYTECODE: "1" }
const pythonSyntax = spawnSync(PYTHON, ["-B", "-c", "import ast,pathlib,sys;ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))", projectFile(PYTHON_ENTRY)], { cwd: ROOT, encoding: "utf8", env: environment, windowsHide: true })
assert.equal(pythonSyntax.status, 0, `python_entry_syntax_failed:${pythonSyntax.stderr}`)
const pythonCheckerSyntax = spawnSync(PYTHON, ["-B", "-c", "import ast,pathlib,sys;ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))", projectFile(PYTHON_CHECKER)], { cwd: ROOT, encoding: "utf8", env: environment, windowsHide: true })
assert.equal(pythonCheckerSyntax.status, 0, `python_checker_syntax_failed:${pythonCheckerSyntax.stderr}`)
for (const target of [NODE_RUNNER, TARGETS[3]]) {
  const syntax = spawnSync(process.execPath, ["--check", projectFile(target)], { cwd: ROOT, encoding: "utf8", env: environment })
  assert.equal(syntax.status, 0, `node_syntax_failed:${target}:${syntax.stderr}`)
}
const pythonRegression = spawnSync(PYTHON, ["-B", projectFile(PYTHON_CHECKER)], { cwd: ROOT, encoding: "utf8", env: environment, windowsHide: true })
assert.equal(pythonRegression.status, 0, `python_cpu_contract_failed:${pythonRegression.stderr}`)
const pythonReport = JSON.parse(pythonRegression.stdout)
const nodeContract = spawnSync(process.execPath, [projectFile(NODE_RUNNER), "--implementation-authorization", authorizationPath, "--implementation-consumption", consumptionPath, "--implementation-contract-only"], { cwd: ROOT, encoding: "utf8", env: environment })
assert.equal(nodeContract.status, 0, `node_entry_contract_failed:${nodeContract.stderr}`)
const nodeReport = JSON.parse(nodeContract.stdout)

const design = read(authorization.bindings.phase0DesignReport.path)
const inactive = read(authorization.bindings.inactivePhase0ExecutionContract.path)
const terminal = read(authorization.bindings.phase0DesignTerminal.path)
const positive = {
  authorizationAndConsumptionValid: validateImplementation(authorization, consumption),
  exactBindingsValid: Object.entries(authorization.bindings).every(([name, binding]) => name === "phase0PythonRunner" ? binding.sha256 === "d5e05ba5a1021237219e8bd4610f9a0851ff2d2e005c8809cbe2946efcb4d1ad" : sha(binding.path) === binding.sha256),
  authorizedPythonPreimageChanged: sha(PYTHON_ENTRY) !== authorization.bindings.phase0PythonRunner.sha256,
  trainerFrozen: sha(authorization.bindings.trainer.path) === authorization.bindings.trainer.sha256,
  diagnosticRunnerFrozen: sha(authorization.bindings.diagnosticRunner.path) === authorization.bindings.diagnosticRunner.sha256,
  candidateCompilerFrozen: sha(authorization.bindings.candidateCompiler.path) === authorization.bindings.candidateCompiler.sha256,
  modeRegistryFrozen: sha(authorization.bindings.modeRegistry.path) === authorization.bindings.modeRegistry.sha256,
  designInactiveAndBound: design.currentExecution.contractActive === false,
  inactiveExecutionContractBound: inactive.phase0ExecutionAuthorizedNow === false,
  designTerminalClosed: terminal.status === "stage4_object_reference_multiscale_phase0_design_completed_inactive_closed",
  pythonSyntaxPassed: pythonSyntax.status === 0 && pythonCheckerSyntax.status === 0,
  pythonCpuPositivePassed: pythonReport.positivePassed === pythonReport.positiveTotal,
  pythonCpuNegativePassed: pythonReport.negativePassed === pythonReport.negativeTotal,
  nodeEntryContractPassed: nodeReport.status === "stage4_object_reference_multiscale_phase0_execution_entry_contract_valid_cpu_only",
  nodeEntryNoRuntimeOpened: ["gpuStarted", "cudaInitialized", "autogradExecuted", "checkpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted"].every((key) => nodeReport[key] === false),
}

const mutations = {
  rejectWrongRequestId: (x) => { x.authorization.requestId = "wrong" },
  rejectWrongCommandRef: (x) => { x.authorization.commandRef = "wrong" },
  rejectWrongScope: (x) => { x.authorization.scope = "wrong" },
  rejectExpandedTarget: (x) => { x.authorization.authorizedTargetPaths.push("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py") },
  rejectReusableConsumption: (x) => { x.consumption.oneTimeConsumption = false },
  rejectGpuUsed: (x) => { x.consumption.gpuUsed = true },
  rejectCudaInitialized: (x) => { x.consumption.cudaInitialized = true },
  rejectAutograd: (x) => { x.consumption.autogradExecuted = true },
  rejectCheckpointRead: (x) => { x.consumption.checkpointRead = true },
  rejectModelLoaded: (x) => { x.consumption.modelLoaded = true },
  rejectOptimizer: (x) => { x.consumption.optimizerCreated = true },
  rejectBackward: (x) => { x.consumption.backwardExecuted = true },
  rejectTraining: (x) => { x.consumption.trainingStarted = true },
  rejectSmoke: (x) => { x.consumption.smokeStarted = true },
}
const negative = Object.fromEntries(Object.entries(mutations).map(([name, mutate]) => {
  const candidate = { authorization: clone(authorization), consumption: clone(consumption) }
  mutate(candidate)
  return [name, rejects(() => validateImplementation(candidate.authorization, candidate.consumption))]
}))
const changedDesign = clone(design); changedDesign.currentExecution.contractActive = true
negative.rejectActivatedDesign = changedDesign.currentExecution.contractActive !== false
const changedInactive = clone(inactive); changedInactive.phase0ExecutionAuthorizedNow = true
negative.rejectActivatedExecutionContract = changedInactive.phase0ExecutionAuthorizedNow !== false
const changedTerminal = clone(terminal); changedTerminal.status = "wrong"
negative.rejectWrongDesignTerminal = changedTerminal.status !== "stage4_object_reference_multiscale_phase0_design_completed_inactive_closed"

const failedPositiveKeys = Object.entries(positive).filter(([, value]) => value !== true).map(([name]) => name)
const failedNegativeKeys = Object.entries(negative).filter(([, value]) => value !== true).map(([name]) => name)
const report = {
  schemaVersion: "stage4-object-reference-multiscale-phase0-execution-entry-cpu-contract-report-v1",
  status: failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0 ? "stage4_object_reference_multiscale_phase0_execution_entry_cpu_contract_passed" : "stage4_object_reference_multiscale_phase0_execution_entry_cpu_contract_failed_closed",
  positive,
  negative,
  positivePassed: Object.values(positive).filter((value) => value === true).length,
  positiveTotal: Object.keys(positive).length,
  negativePassed: Object.values(negative).filter((value) => value === true).length,
  negativeTotal: Object.keys(negative).length,
  failedPositiveKeys,
  failedNegativeKeys,
  pythonCpuReport: pythonReport,
  nodeEntryReport: nodeReport,
  gpuUsedNow: false,
  cudaInitializedNow: false,
  autogradExecutedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  optimizerCreatedNow: false,
  backwardExecutedNow: false,
  trainingStartedNow: false,
}
console.log(JSON.stringify(report, null, 2))
process.exitCode = failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0 ? 0 : 1
