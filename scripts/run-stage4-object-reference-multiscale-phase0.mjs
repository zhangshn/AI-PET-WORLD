import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const IMPLEMENTATION_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-phase0-execution-entry-implementation-20260815-153000000"
const IMPLEMENTATION_SCOPE = "one_cpu_only_implementation_of_inactive_object_reference_multiscale_phase0_execution_entry_and_contract_regression"
const IMPLEMENTATION_AUTHORIZATION_SHA256 = "0a188437aa37b6a5222a5b4cf928d96523087554a9ae78c32701976c42fc6943"
const IMPLEMENTATION_CONSUMPTION_SHA256 = "c9b5bce500cbbd8140162631264a6b9817630140b41ac4f8828d0cc4433448cf"
const CORRECTION_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-phase0-false-positive-contract-correction-20260815-160000000"
const CORRECTION_SCOPE = "one_cpu_only_phase0_false_positive_adjudication_and_entry_contract_correction"
const CORRECTION_AUTHORIZATION_SHA256 = "bd6dfa1a6b5c828132347652ba739602dc30b2e83ad2cbfc4b3d0a0aa33f1966"
const CORRECTION_CONSUMPTION_SHA256 = "6e257b37c92d46bc95b5a416883db5bbbb0c60c7f05bf70b97f6d861409163c2"
const GPU_REQUEST_PREFIX = "owner-authorized-stage4-object-reference-multiscale-phase0-gpu-execution-"
const GPU_SCOPE = "one_corrected_object_reference_multiscale_phase0_gpu_single_update_and_dual_process_reproduction_only"
const RUNNER_PATH = path.join(ROOT, "scripts", "run-stage4-object-reference-multiscale-phase0.mjs")
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const PYTHON_ENTRY = path.join(ROOT, "ml", "ai-painter", "scripts", "run_stage4_object_visible_structure_phase0.py")
const PYTHON_CHECKER = path.join(ROOT, "ml", "ai-painter", "scripts", "check_stage4_object_reference_multiscale_phase0_cpu.py")
const NODE_CHECKER = path.join(ROOT, "scripts", "check-stage4-object-reference-multiscale-phase0-execution-entry.mjs")
const IMPLEMENTATION_OUTPUT = ".runtime/ai-painter/stage4-object-reference-multiscale-phase0-execution-entry-implementations/20260815-153000000"
const FUTURE_GPU_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-phase0-gpu-execution-20260815-154500000"
const CORRECTED_FUTURE_GPU_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-phase0-gpu-execution-20260815-163000000"
const TASK_IDENTITY = Object.freeze({
  architectureId: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
  trainingObjectiveContractId: "typed_object_multiscale_luminance_structure_correlation_supervision_v1",
  sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
  sampleSplit: "validation",
  seed: 20263722,
  timestep: 999,
  resolution: { width: 256, height: 192 },
  requiredBoundarySides: ["west"],
  objectSemanticChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
  pyramidScales: [1.0, 0.5, 0.25],
  diagnosticManifestMetricCount: 48,
  denoiserInitialization: "fixed_random_seed_20263722",
  autoencoderState: "bound_project_checkpoint_loaded_and_frozen",
})
const GPU_ACTIONS = Object.freeze({
  projectAutoencoderCheckpointReadAndLoadFrozen: true,
  fixedRandomDenoiserInitialization: true,
  singleSample194ValidationRead: true,
  exactlyOneOptimizerCreation: true,
  exactlyOneBackwardAndOptimizerStep: true,
  boundedDenoiserWeightModification: true,
  nonPromotableDiagnosticCheckpointWrite: true,
  diagnosticCheckpointReloadInTwoFreshProcesses: true,
  modelConditionRgbAndPngByteIdentityComparison: true,
  exactFortyEightDiagnosticManifestVerification: true,
  fourObjectMultiscaleAndMatchingExpertGradientVerification: true,
  preStepAutogradGradVerification: true,
  exactBackwardCallCountOne: true,
  replayOptimizerStepCountZero: true,
  parameterGradientsClearedBeforeFinalization: true,
  failedDenoiserCheckpointReadOrLoad: false,
  moreThanOneOptimizerStep: false,
  modelSmoke: false,
  formalStage0Training: false,
  stage1OrStage2: false,
  validation: false,
  formalInference: false,
  checkpointPromotion: false,
  runtimeFrame: false,
  worldEntry: false,
  reviewThresholdChange: false,
  automaticRetry: false,
})
const REQUIRED_GPU_BINDINGS = Object.freeze([
  "correctionAuthorization", "correctionConsumption", "correctionReport",
  "correctionAttestation", "correctionTerminal", "implementationAuthorization",
  "implementationConsumption", "implementationReport", "implementationAttestation",
  "implementationTerminal", "inactivePhase0ExecutionContract",
  "phase0DesignReport", "gpuQualificationTerminal", "diagnosticReport", "sourceConfig",
  "inactiveConfigFragment", "datasetManifest", "projectAutoencoderCheckpoint", "trainer",
  "phase0PythonEntry", "phase0Runner",
])

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.ok(value, "path_argument_missing"); assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const result = path.resolve(ROOT, value); assert.ok(result.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`); return result }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const runPython = (args, cpuOnly = false) => spawnSync(PYTHON, ["-B", ...args], {
  cwd: ROOT,
  encoding: "utf8",
  windowsHide: true,
  timeout: 900000,
  env: {
    ...process.env,
    ...(cpuOnly ? { CUDA_VISIBLE_DEVICES: "" } : { CUBLAS_WORKSPACE_CONFIG: ":4096:8" }),
  },
})
const writeExclusive = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  assert.equal(fs.existsSync(file), false, `immutable_file_exists:${relative(file)}`)
  const handle = fs.openSync(file, "wx")
  try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) }
}

function validateImplementation(authorization, consumption) {
  assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-reference-multiscale-phase0-execution-entry-implementation-v1")
  assert.equal(authorization.status, "owner_authorized_unconsumed")
  assert.equal(authorization.requestId, IMPLEMENTATION_REQUEST_ID)
  assert.equal(authorization.commandRef, IMPLEMENTATION_REQUEST_ID)
  assert.equal(authorization.scope, IMPLEMENTATION_SCOPE)
  assert.equal(authorization.execution.consumeBeforeFirstWrite, true)
  assert.equal(consumption.status, "stage4_object_reference_multiscale_phase0_execution_entry_implementation_authorization_atomically_consumed")
  assert.equal(consumption.authorizationSha256, IMPLEMENTATION_AUTHORIZATION_SHA256)
  assert.equal(consumption.oneTimeConsumption, true)
  for (const key of ["gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted"]) assert.equal(consumption[key], false, `${key}_opened_during_implementation`)
  const design = read(projectFile(authorization.bindings.phase0DesignReport.path))
  const contract = read(projectFile(authorization.bindings.inactivePhase0ExecutionContract.path))
  const terminal = read(projectFile(authorization.bindings.phase0DesignTerminal.path))
  assert.equal(design.status, "bounded_object_reference_multiscale_phase0_engineering_qualification_design_completed_inactive")
  assert.equal(contract.status, "inactive_owner_execution_entry_implementation_authorization_required")
  assert.equal(contract.phase0ExecutionAuthorizedNow, false)
  assert.equal(terminal.status, "stage4_object_reference_multiscale_phase0_design_completed_inactive_closed")
  return true
}

function validateCorrection(authorization, consumption, verifyCurrentTargets = true) {
  assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-reference-multiscale-phase0-false-positive-contract-correction-v1")
  assert.equal(authorization.status, "owner_authorized_unconsumed")
  assert.equal(authorization.requestId, CORRECTION_REQUEST_ID)
  assert.equal(authorization.commandRef, CORRECTION_REQUEST_ID)
  assert.equal(authorization.scope, CORRECTION_SCOPE)
  assert.equal(authorization.sourceRunId, "20260815-154500000-phase0")
  assert.equal(authorization.ownerDecision.classification, "program_and_evidence_contract_false_positive")
  assert.equal(authorization.ownerDecision.smokeEntryAccepted, false)
  assert.equal(authorization.bindings.diagnosticCheckpointIdentity.weightsReadAuthorized, false)
  assert.equal(authorization.execution.maximumExecutions, 1)
  assert.equal(authorization.execution.consumeBeforeFirstWrite, true)
  assert.equal(consumption.status, "stage4_object_reference_multiscale_phase0_false_positive_contract_correction_authorization_atomically_consumed")
  assert.equal(consumption.authorizationSha256, CORRECTION_AUTHORIZATION_SHA256)
  assert.equal(consumption.requestId, CORRECTION_REQUEST_ID)
  assert.equal(consumption.commandRef, CORRECTION_REQUEST_ID)
  assert.equal(consumption.scope, CORRECTION_SCOPE)
  assert.equal(consumption.oneTimeConsumption, true)
  assert.equal(consumption.firstAuthorizedWrite, true)
  for (const key of ["gpuUsed", "cudaInitialized", "autogradExecuted", "diagnosticCheckpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "weightModified", "trainingStarted", "validationStarted", "smokeStarted", "automaticRetryStarted"]) assert.equal(consumption[key], false, `${key}_opened_during_correction`)
  for (const [name, binding] of Object.entries(authorization.bindings)) {
    const current = sha(projectFile(binding.path))
    if (name.endsWith("Preimage") && verifyCurrentTargets) assert.notEqual(current, binding.sha256, `${name}_not_corrected`)
    else assert.equal(current, binding.sha256, `${name}_binding_changed`)
  }
  const falseTerminal = read(projectFile(authorization.bindings.falsePositiveTerminal.path))
  const falseFinalization = read(projectFile(authorization.bindings.falsePositiveFinalization.path))
  const falseUpdate = read(projectFile(authorization.bindings.updateReport.path))
  assert.equal(falseTerminal.status, "stage4_object_reference_multiscale_phase0_passed_closed")
  assert.equal(falseFinalization.optimizerSteps, 1)
  assert.equal(falseUpdate.optimizerStepCount, null)
  assert.deepEqual(falseUpdate.requiredGradientGroups, {})
  return true
}

function validateCorrectedUpdateReport(report, expectedFields) {
  assert.equal(report.status, "phase0_single_cuda_optimizer_step_passed_closed")
  assert.equal(report.optimizerStepCount, 1)
  assert.equal(report.backwardCallCount, 1)
  assert.equal(report.replayOptimizerStepCount, 0)
  assert.equal(report.parameterGradientsCleared, true)
  assert.equal(report.lossFinite, true)
  assert.equal(report.gradientFinite, true)
  assert.equal(report.gradientNonzero, true)
  assert.equal(report.weightsChanged, true)
  assert.equal(report.autoencoderWeightsChanged, false)
  const manifest = report.diagnosticManifest ?? {}
  assert.equal(manifest.fieldCount, 48)
  assert.deepEqual(manifest.fields, expectedFields)
  assert.deepEqual(Object.keys(manifest.values ?? {}), expectedFields)
  assert.equal(Object.values(manifest.values).every((value) => Number.isFinite(value) && value >= 0), true)
  const groups = report.requiredGradientGroups ?? {}
  assert.deepEqual(Object.keys(groups), ["footprints", "tree", "rock", "vegetation", "combined"])
  for (const identity of ["footprints", "tree", "rock", "vegetation"]) {
    assert.equal(groups[identity].finiteAndStrictlyNonzero, true)
    assert.equal(groups[identity].denoiserGradient.finite, true)
    assert.ok(groups[identity].denoiserGradient.absoluteSum > 0)
    assert.equal(groups[identity].matchingSemanticMixtureExpertGradient.finite, true)
    assert.ok(groups[identity].matchingSemanticMixtureExpertGradient.absoluteSum > 0)
  }
  assert.equal(groups.combined.finiteAndStrictlyNonzero, true)
  assert.equal(groups.combined.denoiserGradient.finite, true)
  assert.ok(groups.combined.denoiserGradient.absoluteSum > 0)
  return { optimizerSteps: 1, backwardCalls: 1, replayOptimizerSteps: 0, diagnosticManifestMetricCount: 48, requiredGradientGroupCount: 5 }
}

function validateGpuAuthorization(authorization) {
  assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-reference-multiscale-phase0-gpu-execution-v2")
  assert.equal(authorization.status, "owner_authorized_unconsumed")
  assert.match(authorization.requestId, /^owner-authorized-stage4-object-reference-multiscale-phase0-gpu-execution-\d{8}-\d{9}$/)
  assert.equal(authorization.commandRef, authorization.requestId)
  assert.equal(authorization.scope, GPU_SCOPE)
  assert.equal(same(authorization.taskIdentity, TASK_IDENTITY), true, "gpu_task_identity_changed")
  assert.equal(same(authorization.executionActions, GPU_ACTIONS), true, "gpu_actions_changed")
  assert.deepEqual(Object.keys(authorization.bindings), [...REQUIRED_GPU_BINDINGS], "gpu_binding_set_changed")
  const executionId = authorization.requestId.slice(GPU_REQUEST_PREFIX.length)
  assert.equal(authorization.execution.maximumExecutions, 1)
  assert.equal(authorization.execution.consumeBeforeFirstEvidenceWrite, true)
  assert.equal(authorization.execution.runId, `${executionId}-phase0`)
  assert.equal(authorization.execution.consumptionPath, `.runtime/ai-painter/owner-action-requests/${authorization.requestId}/consumption.json`)
  assert.equal(authorization.execution.outputDirectory, `.runtime/ai-painter/stage4-object-reference-multiscale-phase0-executions/${executionId}`)
  assert.deepEqual(authorization.failurePolicy, { stopImmediately: true, automaticRetry: false, preserveEvidence: true, noSmokeOrTrainingEscalation: true })
  return true
}

function compilePhase0DerivedConfig(source, fragment, diagnosticReport) {
  const config = structuredClone(source)
  const training = config.training
  const patch = fragment.trainingPatch
  assert.deepEqual(patch.remove, ["stage4ObjectVisibleStructureSupervision", "stage4VegetationLuminanceSpatialStructureSupervision"])
  assert.deepEqual(Object.keys(patch.add), ["stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"])
  for (const key of patch.remove) delete training[key]
  const contract = structuredClone(patch.add.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision)
  contract.status = "training_loss_active_owner_authorized"
  const active = new Set(["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow"])
  contract.activationGate = Object.fromEntries(Object.keys(contract.activationGate).map((key) => [key, active.has(key)]))
  training.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision = contract
  const fields = diagnosticReport.diagnosticManifest.fields
  assert.equal(fields.length, 48)
  const registry = training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry
  registry.exactFields = [...fields]
  registry.exactFieldCount = fields.length
  assert.equal(contract.contractId, TASK_IDENTITY.trainingObjectiveContractId)
  assert.deepEqual(contract.pyramidScales, TASK_IDENTITY.pyramidScales)
  return config
}

const implementationAuthorizationPath = projectFile(arg("--implementation-authorization"))
const implementationConsumptionPath = projectFile(arg("--implementation-consumption"))
const correctionAuthorizationArgument = arg("--correction-authorization")
const correctionConsumptionArgument = arg("--correction-consumption")
const correctionAuthorizationPath = correctionAuthorizationArgument ? projectFile(correctionAuthorizationArgument) : null
const correctionConsumptionPath = correctionConsumptionArgument ? projectFile(correctionConsumptionArgument) : null
assert.equal(sha(implementationAuthorizationPath), IMPLEMENTATION_AUTHORIZATION_SHA256)
assert.equal(sha(implementationConsumptionPath), IMPLEMENTATION_CONSUMPTION_SHA256)
if ((correctionAuthorizationPath === null) !== (correctionConsumptionPath === null)) throw new Error("correction_authorization_and_consumption_must_be_paired")
const implementationAuthorization = read(implementationAuthorizationPath)
const implementationConsumption = read(implementationConsumptionPath)
const correctionAuthorization = correctionAuthorizationPath ? read(correctionAuthorizationPath) : null
const correctionConsumption = correctionConsumptionPath ? read(correctionConsumptionPath) : null
if (correctionAuthorizationPath) {
  assert.equal(sha(correctionAuthorizationPath), CORRECTION_AUTHORIZATION_SHA256)
  assert.equal(sha(correctionConsumptionPath), CORRECTION_CONSUMPTION_SHA256)
}
for (const [name, binding] of Object.entries(implementationAuthorization.bindings)) {
  if (name === "phase0PythonRunner") {
    assert.equal(binding.sha256, "d5e05ba5a1021237219e8bd4610f9a0851ff2d2e005c8809cbe2946efcb4d1ad")
    assert.notEqual(sha(projectFile(binding.path)), binding.sha256, `authorized_target_not_implemented:${name}`)
  } else if (correctionAuthorization && name === "trainer") {
    assert.equal(binding.sha256, correctionAuthorization.bindings.trainerPreimage.sha256)
    assert.notEqual(sha(projectFile(binding.path)), binding.sha256, `authorized_target_not_implemented:${name}`)
  } else {
    assert.equal(sha(projectFile(binding.path)), binding.sha256, `${name}_implementation_binding_changed`)
  }
}
validateImplementation(implementationAuthorization, implementationConsumption)
if (correctionAuthorization) validateCorrection(correctionAuthorization, correctionConsumption)
const pythonContract = runPython([PYTHON_ENTRY, "--object-reference-multiscale-contract-only"], true)
assert.equal(pythonContract.status, 0, `python_entry_contract_failed:${pythonContract.stderr}`)
const pythonReport = JSON.parse(pythonContract.stdout)

if (process.argv.includes("--correction-contract-only")) {
  assert.ok(correctionAuthorization, "correction_authorization_required")
  console.log(JSON.stringify({
    schemaVersion: "stage4-object-reference-multiscale-phase0-false-positive-contract-correction-entry-v1",
    status: "stage4_object_reference_multiscale_phase0_false_positive_contract_correction_entry_valid_cpu_only",
    sourceRunId: correctionAuthorization.sourceRunId,
    falsePositiveDetected: true,
    correctedGates: {
      optimizerStepCountMustEqualOne: true,
      backwardCallCountMustEqualOne: true,
      replayOptimizerStepCountMustEqualZero: true,
      exactFortyEightDiagnosticMetricsRequired: true,
      fourObjectAndMatchingExpertGradientGroupsRequired: true,
      combinedGradientRequired: true,
      parameterGradientsClearedBeforeFinalization: true,
    },
    gpuStarted: false,
    cudaInitialized: false,
    autogradExecuted: false,
    diagnosticCheckpointRead: false,
    modelLoaded: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
  }, null, 2))
  process.exit(0)
}

if (process.argv.includes("--record-implementation")) {
  const cpuResult = spawnSync(process.execPath, [
    NODE_CHECKER,
    "--authorization", relative(implementationAuthorizationPath),
    "--consumption", relative(implementationConsumptionPath),
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTHONDONTWRITEBYTECODE: "1" },
  })
  assert.equal(cpuResult.status, 0, `implementation_cpu_contract_failed:${cpuResult.stderr}`)
  const cpu = JSON.parse(cpuResult.stdout)
  assert.equal(cpu.positivePassed, cpu.positiveTotal)
  assert.equal(cpu.negativePassed, cpu.negativeTotal)
  const output = projectFile(IMPLEMENTATION_OUTPUT)
  assert.equal(fs.existsSync(output), false, "implementation_output_exists")
  fs.mkdirSync(output, { recursive: true })
  const files = {
    cpu: path.join(output, "cpu-contract-report.json"),
    report: path.join(output, "implementation-report.json"),
    attestation: path.join(output, "implementation-attestation.json"),
    contract: path.join(output, "inactive-gpu-phase0-execution-contract.json"),
    terminal: path.join(output, "phase-terminal.json"),
    owner: path.join(output, "owner-action-request.json"),
    capsule: path.join(output, "local-task-capsule.json"),
  }
  const now = new Date().toISOString()
  writeJsonAtomic(files.cpu, {
    ...cpu,
    authorization: bind(implementationAuthorizationPath),
    consumption: bind(implementationConsumptionPath),
    checker: bind(NODE_CHECKER),
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.report, {
    schemaVersion: "stage4-object-reference-multiscale-phase0-execution-entry-implementation-report-v1",
    status: "stage4_object_reference_multiscale_phase0_execution_entry_implemented_cpu_verified",
    authorization: bind(implementationAuthorizationPath),
    consumption: bind(implementationConsumptionPath),
    designReport: implementationAuthorization.bindings.phase0DesignReport,
    inactiveDesignContract: implementationAuthorization.bindings.inactivePhase0ExecutionContract,
    targets: {
      phase0PythonEntry: bind(PYTHON_ENTRY),
      pythonCpuChecker: bind(PYTHON_CHECKER),
      phase0Runner: bind(RUNNER_PATH),
      nodeCpuChecker: bind(NODE_CHECKER),
    },
    frozenSources: {
      trainer: implementationAuthorization.bindings.trainer,
      diagnosticRunner: implementationAuthorization.bindings.diagnosticRunner,
      candidateCompiler: implementationAuthorization.bindings.candidateCompiler,
      modeRegistry: implementationAuthorization.bindings.modeRegistry,
    },
    implementation: {
      multiscaleGpuAuthorizationProfileImplemented: true,
      multiscaleExecutionIdentityImplemented: true,
      exact48MetricDerivedConfigImplemented: true,
      oneOptimizerStepAndTwoFreshProcessFlowImplemented: true,
      oldVisibleStructureProfilePreserved: true,
      actualGpuExecutionPerformedNow: false,
    },
    cpuContractReport: bind(files.cpu),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.attestation, {
    schemaVersion: "stage4-object-reference-multiscale-phase0-execution-entry-implementation-attestation-v1",
    status: "stage4_object_reference_multiscale_phase0_execution_entry_implemented_cpu_verified",
    implementationAuthorizationSha256: IMPLEMENTATION_AUTHORIZATION_SHA256,
    implementationConsumptionSha256: IMPLEMENTATION_CONSUMPTION_SHA256,
    implementationReportPath: relative(files.report),
    implementationReportSha256: sha(files.report),
    runnerPath: relative(RUNNER_PATH),
    runnerSha256: sha(RUNNER_PATH),
    pythonEntryPath: relative(PYTHON_ENTRY),
    pythonEntrySha256: sha(PYTHON_ENTRY),
    pythonCheckerPath: relative(PYTHON_CHECKER),
    pythonCheckerSha256: sha(PYTHON_CHECKER),
    nodeCheckerPath: relative(NODE_CHECKER),
    nodeCheckerSha256: sha(NODE_CHECKER),
    trainerPath: implementationAuthorization.bindings.trainer.path,
    trainerSha256: implementationAuthorization.bindings.trainer.sha256,
    gpuUsedNow: false,
    cudaInitializedNow: false,
    autogradExecutedNow: false,
    checkpointReadNow: false,
    modelLoadedNow: false,
    optimizerCreatedNow: false,
    backwardExecutedNow: false,
    trainingStartedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  const designAuthorization = read(projectFile(implementationAuthorization.bindings.designAuthorization.path))
  const sourceGpuAuthorizationBinding = designAuthorization.bindings.gpuAuthorization
  const sourceGpuAuthorization = read(projectFile(sourceGpuAuthorizationBinding.path))
  const futureBindings = {
    implementationAuthorization: bind(implementationAuthorizationPath),
    implementationConsumption: bind(implementationConsumptionPath),
    implementationReport: bind(files.report),
    implementationAttestation: bind(files.attestation),
    implementationTerminal: null,
    inactivePhase0ExecutionContract: implementationAuthorization.bindings.inactivePhase0ExecutionContract,
    phase0DesignReport: implementationAuthorization.bindings.phase0DesignReport,
    gpuQualificationTerminal: implementationAuthorization.bindings.gpuTerminal,
    diagnosticReport: implementationAuthorization.bindings.diagnosticReport,
    sourceConfig: sourceGpuAuthorization.bindings.sourceConfig,
    inactiveConfigFragment: sourceGpuAuthorization.bindings.inactiveConfigFragment,
    datasetManifest: sourceGpuAuthorization.bindings.datasetManifest,
    projectAutoencoderCheckpoint: sourceGpuAuthorization.bindings.projectAutoencoderCheckpoint,
    trainer: implementationAuthorization.bindings.trainer,
    phase0PythonEntry: bind(PYTHON_ENTRY),
    phase0Runner: bind(RUNNER_PATH),
  }
  writeJsonAtomic(files.contract, {
    schemaVersion: "stage4-object-reference-multiscale-phase0-gpu-execution-inactive-contract-v1",
    status: "inactive_owner_gpu_phase0_authorization_required",
    requestIdPattern: `${GPU_REQUEST_PREFIX}<yyyyMMdd-HHmmssSSS>`,
    scope: GPU_SCOPE,
    taskIdentity: TASK_IDENTITY,
    executionActions: GPU_ACTIONS,
    requiredBindingNames: [...REQUIRED_GPU_BINDINGS],
    sourceGpuQualificationAuthorization: sourceGpuAuthorizationBinding,
    maximumExecutions: 1,
    consumeBeforeFirstEvidenceWrite: true,
    gpuAuthorizedNow: false,
    cudaAuthorizedNow: false,
    phase0ExecutionAuthorizedNow: false,
    trainingAuthorizedNow: false,
    smokeAuthorizedNow: false,
    stage0AuthorizedNow: false,
    automaticRetryAuthorizedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.terminal, {
    schemaVersion: "stage4-object-reference-multiscale-phase0-execution-entry-implementation-terminal-v1",
    status: "stage4_object_reference_multiscale_phase0_execution_entry_implementation_succeeded_closed",
    implementationReport: bind(files.report),
    implementationAttestation: bind(files.attestation),
    inactiveGpuPhase0ExecutionContract: bind(files.contract),
    cpuContractReport: bind(files.cpu),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    nextLegalAction: "owner_authorize_one_object_reference_multiscale_gpu_phase0_execution_or_exit",
    gpuUsedNow: false,
    cudaInitializedNow: false,
    autogradExecutedNow: false,
    checkpointReadNow: false,
    modelLoadedNow: false,
    trainingStartedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  futureBindings.implementationTerminal = bind(files.terminal)
  const executionId = FUTURE_GPU_REQUEST_ID.slice(GPU_REQUEST_PREFIX.length)
  const proposedAuthorization = {
    schemaVersion: "ai-painter-owner-stage4-object-reference-multiscale-phase0-gpu-execution-v1",
    status: "owner_authorized_unconsumed",
    requestId: FUTURE_GPU_REQUEST_ID,
    commandRef: FUTURE_GPU_REQUEST_ID,
    scope: GPU_SCOPE,
    taskIdentity: structuredClone(TASK_IDENTITY),
    executionActions: structuredClone(GPU_ACTIONS),
    bindings: futureBindings,
    execution: {
      consumptionPath: `.runtime/ai-painter/owner-action-requests/${FUTURE_GPU_REQUEST_ID}/consumption.json`,
      outputDirectory: `.runtime/ai-painter/stage4-object-reference-multiscale-phase0-executions/${executionId}`,
      runId: `${executionId}-phase0`,
      maximumExecutions: 1,
      consumeBeforeFirstEvidenceWrite: true,
    },
    failurePolicy: {
      stopImmediately: true,
      automaticRetry: false,
      preserveEvidence: true,
      noSmokeOrTrainingEscalation: true,
    },
  }
  validateGpuAuthorization(proposedAuthorization)
  writeJsonAtomic(files.owner, {
    schemaVersion: "ai-painter-owner-action-request-preview-v1",
    status: "not_authorized_not_consumed",
    requestedAction: "owner_authorize_one_object_reference_multiscale_gpu_phase0_execution_or_exit",
    requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${FUTURE_GPU_REQUEST_ID}/authorization.json`,
    proposedAuthorization,
    boundImplementationReport: bind(files.report),
    boundImplementationAttestation: bind(files.attestation),
    boundTerminal: bind(files.terminal),
    boundInactiveGpuContract: bind(files.contract),
    gpuExecutedNow: false,
    automaticApproval: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    module: "AI Painter R5",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    currentStage: "Object-reference multiscale Phase0 execution entry implemented CPU-only; GPU Phase0 inactive",
    candidateTerminal: bind(files.terminal),
    latestBlocker: "immutable_owner_gpu_phase0_authorization_not_created_or_consumed",
    nextLegalAction: "owner_authorize_one_object_reference_multiscale_gpu_phase0_execution_or_exit",
    forbiddenActions: implementationAuthorization.forbiddenActions,
    evidence: {
      implementationReport: bind(files.report),
      implementationAttestation: bind(files.attestation),
      inactiveGpuContract: bind(files.contract),
      cpuContractReport: bind(files.cpu),
      ownerActionRequest: bind(files.owner),
    },
    gpuUsedNow: false,
    cudaInitializedNow: false,
    checkpointReadNow: false,
    modelLoadedNow: false,
    trainingStartedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  const indexedFiles = [
    implementationAuthorizationPath,
    implementationConsumptionPath,
    PYTHON_ENTRY,
    PYTHON_CHECKER,
    RUNNER_PATH,
    NODE_CHECKER,
    ...Object.entries(implementationAuthorization.bindings)
      .filter(([name]) => name !== "phase0PythonRunner")
      .map(([, binding]) => projectFile(binding.path)),
    ...Object.values(files),
  ]
  for (const file of [...new Set(indexedFiles)]) {
    const stat = fs.statSync(file)
    indexArtifact({
      logicalPath: logicalProjectPath(file),
      physicalUri: fs.realpathSync(file),
      storageLayer: "hot",
      runId: IMPLEMENTATION_REQUEST_ID,
      byteSize: stat.size,
      modifiedAtUtc: stat.mtime.toISOString(),
      sha256: sha(file),
    })
  }
  appendAiPainterProgramEvent({
    id: `stage4-object-reference-multiscale-phase0-entry-implementation-${IMPLEMENTATION_REQUEST_ID}`,
    timestamp: now,
    action: "stage4_object_reference_multiscale_phase0_execution_entry_implementation",
    runId: IMPLEMENTATION_REQUEST_ID,
    kind: "cpu_only_implementation",
    status: "success",
    title: "Object-reference multiscale Phase0 execution entry implemented",
    titleZh: "四对象参考对齐多尺度亮度—结构监督Phase 0执行入口实施完成",
    detailZh: `CPU正向${cpu.positivePassed}/${cpu.positiveTotal}、反向${cpu.negativePassed}/${cpu.negativeTotal}；未启动GPU/CUDA/autograd，未读取Checkpoint、未加载模型或训练。`,
    evidencePath: relative(files.terminal),
    evidenceSha256: sha(files.terminal),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  })
  console.log(JSON.stringify({
    status: read(files.terminal).status,
    cpuContractReport: bind(files.cpu),
    implementationReport: bind(files.report),
    implementationAttestation: bind(files.attestation),
    inactiveGpuPhase0ExecutionContract: bind(files.contract),
    terminal: bind(files.terminal),
    ownerActionRequest: bind(files.owner),
    capsule: bind(files.capsule),
  }, null, 2))
  process.exit(0)
}

if (process.argv.includes("--implementation-contract-only")) {
  console.log(JSON.stringify({
    schemaVersion: "stage4-object-reference-multiscale-phase0-execution-entry-contract-v1",
    status: "stage4_object_reference_multiscale_phase0_execution_entry_contract_valid_cpu_only",
    pythonEntry: pythonReport,
    gpuStarted: false,
    cudaInitialized: false,
    autogradExecuted: false,
    checkpointRead: false,
    modelLoaded: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
  }, null, 2))
  process.exit(0)
}

const gpuAuthorizationPath = projectFile(arg("--gpu-authorization"))
const gpuAuthorizationSha256 = arg("--gpu-authorization-sha256")
assert.equal(sha(gpuAuthorizationPath), gpuAuthorizationSha256, "gpu_authorization_sha256_mismatch")
const gpuAuthorization = read(gpuAuthorizationPath)
validateGpuAuthorization(gpuAuthorization)
for (const [name, binding] of Object.entries(gpuAuthorization.bindings)) assert.equal(sha(projectFile(binding.path)), binding.sha256, `${name}_gpu_binding_changed`)
assert.ok(process.argv.includes("--execute-authorized-gpu-phase0"), "explicit_gpu_phase0_execution_flag_required")
assert.ok(correctionAuthorization, "correction_lineage_required_for_gpu_phase0")
const attestationPath = projectFile(gpuAuthorization.bindings.correctionAttestation.path)
const attestation = read(attestationPath)
assert.equal(attestation.status, "stage4_object_reference_multiscale_phase0_false_positive_contract_corrected_cpu_verified")
assert.equal(attestation.runnerSha256, sha(RUNNER_PATH))
assert.equal(attestation.pythonEntrySha256, sha(PYTHON_ENTRY))
assert.equal(attestation.trainerSha256, gpuAuthorization.bindings.trainer.sha256)

const resource = spawnSync("nvidia-smi", ["--query-gpu=index,name,memory.total,memory.free", "--format=csv,noheader,nounits"], { cwd: ROOT, encoding: "utf8", windowsHide: true })
assert.equal(resource.status, 0, `cuda_resource_preflight_failed:${resource.stderr}`)
const consumptionPath = projectFile(gpuAuthorization.execution.consumptionPath)
assert.equal(fs.existsSync(consumptionPath), false, "gpu_authorization_already_consumed")
const output = projectFile(gpuAuthorization.execution.outputDirectory)
assert.equal(fs.existsSync(output), false, "phase0_output_already_exists")
const now = new Date().toISOString()
const runId = gpuAuthorization.execution.runId
writeExclusive(consumptionPath, {
  schemaVersion: "ai-painter-stage4-object-reference-multiscale-phase0-gpu-consumption-v2",
  status: "stage4_object_reference_multiscale_phase0_gpu_authorization_atomically_consumed",
  requestId: gpuAuthorization.requestId,
  commandRef: gpuAuthorization.commandRef,
  scope: gpuAuthorization.scope,
  runId,
  authorizationPath: relative(gpuAuthorizationPath),
  authorizationSha256: gpuAuthorizationSha256,
  correctionAttestationPath: relative(attestationPath),
  correctionAttestationSha256: sha(attestationPath),
  consumedAtUtc: now,
  consumedAtAsiaShanghai: formatShanghai(now),
  oneTimeConsumption: true,
  maximumExecutions: 1,
  smokeQuotaConsumed: false,
  formalTrainingAuthorized: false,
})
fs.mkdirSync(output, { recursive: true })
const sourceConfig = read(projectFile(gpuAuthorization.bindings.sourceConfig.path))
const fragment = read(projectFile(gpuAuthorization.bindings.inactiveConfigFragment.path))
const diagnosticReport = read(projectFile(gpuAuthorization.bindings.diagnosticReport.path))
const configPath = path.join(output, "phase0-effective-config.json")
writeExclusive(configPath, compilePhase0DerivedConfig(sourceConfig, fragment, diagnosticReport))

const baseIdentity = {
  schemaVersion: "ai-painter-stage4-object-reference-multiscale-phase0-execution-identity-v1",
  status: "phase0_execution_identity_active_not_completed",
  runId,
  requestId: gpuAuthorization.requestId,
  commandRef: gpuAuthorization.commandRef,
  scope: gpuAuthorization.scope,
  authorizationPath: relative(gpuAuthorizationPath),
  authorizationSha256: gpuAuthorizationSha256,
  phase0ConsumptionPath: relative(consumptionPath),
  phase0ConsumptionSha256: sha(consumptionPath),
  implementationAttestationPath: relative(attestationPath),
  implementationAttestationSha256: sha(attestationPath),
  sourceInactiveConfigPath: relative(configPath),
  sourceInactiveConfigSha256: sha(configPath),
  datasetManifestPath: gpuAuthorization.bindings.datasetManifest.path,
  datasetManifestSha256: gpuAuthorization.bindings.datasetManifest.sha256,
  autoencoderCheckpointPath: gpuAuthorization.bindings.projectAutoencoderCheckpoint.path,
  autoencoderCheckpointSha256: gpuAuthorization.bindings.projectAutoencoderCheckpoint.sha256,
  trainerPath: gpuAuthorization.bindings.trainer.path,
  trainerSha256: gpuAuthorization.bindings.trainer.sha256,
  pythonEntryPath: gpuAuthorization.bindings.phase0PythonEntry.path,
  pythonEntrySha256: gpuAuthorization.bindings.phase0PythonEntry.sha256,
  fixedTaskIdentity: gpuAuthorization.taskIdentity,
}
const commonArgs = ["--config", configPath, "--dataset-package", projectFile(gpuAuthorization.bindings.datasetManifest.path), "--autoencoder-checkpoint", projectFile(gpuAuthorization.bindings.projectAutoencoderCheckpoint.path), "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", TASK_IDENTITY.sampleId, "--overfit-epochs", "1", "--overfit-evaluation-interval", "1"]
const processFiles = []
const persistProcess = (label, result) => {
  const stdout = path.join(output, `${label}-stdout.log`)
  const stderr = path.join(output, `${label}-stderr.log`)
  fs.writeFileSync(stdout, result.stdout ?? "", "utf8")
  fs.writeFileSync(stderr, result.stderr ?? "", "utf8")
  processFiles.push(stdout, stderr)
}

try {
  const updateIdentityPath = path.join(output, "phase0-update-execution-identity.json")
  writeExclusive(updateIdentityPath, { ...baseIdentity, executionPart: "single_optimizer_step" })
  const updateOutput = path.join(output, "update")
  const update = runPython([PYTHON_ENTRY, ...commonArgs, "--output-dir", updateOutput, "--stage4-validation-kernel-phase0-update", "--phase0-execution-identity", updateIdentityPath])
  persistProcess("update", update)
  assert.equal(update.status, 0, `phase0_update_failed:${update.status}`)
  const updateReportPath = path.join(updateOutput, "phase0-update-report.json")
  const updateReport = read(updateReportPath)
  const expectedDiagnosticFields = read(configPath).training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.exactFields
  const correctedUpdateEvidence = validateCorrectedUpdateReport(updateReport, expectedDiagnosticFields)
  const checkpointPath = projectFile(updateReport.checkpointPath)
  assert.equal(sha(checkpointPath), updateReport.checkpointSha256)
  const reproductions = []
  for (const label of ["A", "B"]) {
    const identityPath = path.join(output, `phase0-reproduce-${label.toLowerCase()}-execution-identity.json`)
    writeExclusive(identityPath, { ...baseIdentity, executionPart: "fresh_process_checkpoint_preview_reproduction", reproductionLabel: label, diagnosticCheckpointPath: relative(checkpointPath), diagnosticCheckpointSha256: sha(checkpointPath) })
    const reproduceOutput = path.join(output, `reproduce-${label.toLowerCase()}`)
    const result = runPython([PYTHON_ENTRY, ...commonArgs, "--output-dir", reproduceOutput, "--stage4-validation-kernel-phase0-reproduce", "--phase0-execution-identity", identityPath, "--phase0-diagnostic-checkpoint", checkpointPath])
    persistProcess(`reproduce-${label.toLowerCase()}`, result)
    assert.equal(result.status, 0, `phase0_reproduction_${label}_failed:${result.status}`)
    const reportPath = path.join(reproduceOutput, "phase0-reproduction-report.json")
    reproductions.push({ label, reportPath, report: read(reportPath) })
  }
  const [left, right] = reproductions.map((row) => row.report)
  for (const reproduction of [left, right]) {
    assert.equal(reproduction.status, "phase0_checkpoint_fixed_preview_reproduction_passed_closed")
    assert.equal(reproduction.checkpointSha256, updateReport.checkpointSha256)
    assert.equal(reproduction.modelStateSha256, updateReport.finalDenoiserStateSha256)
    assert.equal(reproduction.sample.sampleId, TASK_IDENTITY.sampleId)
    assert.equal(reproduction.sample.selectedSplit, TASK_IDENTITY.sampleSplit)
    assert.equal(reproduction.previewArtifact.seed, TASK_IDENTITY.seed + 3000)
  }
  const equality = {
    modelStateSha256Matches: left.modelStateSha256 === right.modelStateSha256,
    conditionTensorSha256Matches: left.previewArtifact.conditionTensorSha256 === right.previewArtifact.conditionTensorSha256,
    rgbTensorSha256Matches: left.previewArtifact.rgbTensorSha256 === right.previewArtifact.rgbTensorSha256,
    pngByteSha256Matches: left.previewArtifact.previewSha256 === right.previewArtifact.previewSha256,
    latentNormalizationSha256Matches: left.previewArtifact.latentNormalizationSha256 === right.previewArtifact.latentNormalizationSha256,
  }
  assert.equal(Object.values(equality).every(Boolean), true, `phase0_reproduction_mismatch:${JSON.stringify(equality)}`)
  const finalization = path.join(output, "finalization")
  fs.mkdirSync(finalization, { recursive: true })
  const reportPath = path.join(finalization, "finalization-report.json")
  writeJsonAtomic(reportPath, { schemaVersion: "stage4-object-reference-multiscale-phase0-finalization-v2", status: "stage4_object_reference_multiscale_phase0_passed_closed", runId, authorization: bind(gpuAuthorizationPath), consumption: bind(consumptionPath), correctionTerminal: gpuAuthorization.bindings.correctionTerminal, updateReport: bind(updateReportPath), diagnosticCheckpoint: { ...bind(checkpointPath), promotable: false, fullTrainingInitializationEligible: false }, reproductions: reproductions.map((row) => ({ label: row.label, ...bind(row.reportPath) })), equality, ...correctedUpdateEvidence, smokeQuotaConsumed: false, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: new Date().toISOString() })
  const terminalPath = path.join(finalization, "phase-terminal.json")
  writeJsonAtomic(terminalPath, { schemaVersion: "stage4-object-reference-multiscale-phase0-terminal-v1", status: "stage4_object_reference_multiscale_phase0_passed_closed", runId, finalizationReport: bind(reportPath), nextLegalAction: "owner_authorize_independent_object_reference_multiscale_30_epoch_smoke_or_exit", diagnosticCheckpointPromotable: false, smokeStarted: false, formalTrainingStarted: false, automaticRetryStarted: false, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: new Date().toISOString() })
  for (const file of [gpuAuthorizationPath, consumptionPath, attestationPath, configPath, updateReportPath, checkpointPath, ...processFiles, ...reproductions.map((row) => row.reportPath), reportPath, terminalPath]) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }
  appendAiPainterProgramEvent({ id: `stage4-object-reference-multiscale-phase0-${runId}`, timestamp: new Date().toISOString(), action: "stage4_object_reference_multiscale_phase0", runId, kind: "gpu_phase0_engineering_qualification", status: "success", title: "Object-reference multiscale Phase0 passed", titleZh: "四对象参考对齐多尺度亮度—结构监督Phase 0工程资格通过", evidencePath: relative(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  console.log(JSON.stringify({ status: read(terminalPath).status, terminal: bind(terminalPath), equality }, null, 2))
} catch (error) {
  const finalization = path.join(output, "finalization")
  fs.mkdirSync(finalization, { recursive: true })
  const reportPath = path.join(finalization, "failure-report.json")
  const terminalPath = path.join(finalization, "phase-terminal.json")
  if (!fs.existsSync(reportPath)) writeJsonAtomic(reportPath, { schemaVersion: "stage4-object-reference-multiscale-phase0-failure-report-v1", status: "stage4_object_reference_multiscale_phase0_failed_closed", runId, authorization: bind(gpuAuthorizationPath), consumption: bind(consumptionPath), failureMessage: String(error?.message ?? error), stack: error?.stack, smokeStarted: false, formalTrainingStarted: false, automaticRetryStarted: false, recordedAtUtc: new Date().toISOString() })
  if (!fs.existsSync(terminalPath)) writeJsonAtomic(terminalPath, { schemaVersion: "stage4-object-reference-multiscale-phase0-terminal-v1", status: "stage4_object_reference_multiscale_phase0_failed_closed", runId, failureReport: bind(reportPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, smokeStarted: false, formalTrainingStarted: false, automaticRetryStarted: false, recordedAtUtc: new Date().toISOString() })
  console.error(JSON.stringify({ status: read(terminalPath).status, terminal: bind(terminalPath), failureMessage: String(error?.message ?? error) }, null, 2))
  process.exitCode = 1
}
