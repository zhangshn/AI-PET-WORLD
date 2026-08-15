import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  buildGpuAuthorizationFixture,
  validateGpuAuthorizationDocument,
} from "./lib/ai-painter-stage4-object-visible-structure-phase0-execution.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-derived-mode-control-flow-correction-20260815-080000000"
const AUTHORIZATION_SHA256 = "37ade7037cef6d7115c96ae86d0d322b0a5b9bcfba85023842f9f64c23f30f89"
const AUTH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization.json`
const CONSUMPTION = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/consumption.json`
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-derived-mode-control-flow-corrections/20260815-080000000"
const ORIGINAL_IMPLEMENTATION_AUTH = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-phase0-execution-entry-implementation-20260815-043000000/authorization.json"
const ORIGINAL_IMPLEMENTATION_CONSUMPTION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-phase0-execution-entry-implementation-20260815-043000000/consumption.json"
const GPU_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-20260815-083000000"
const GPU_EXECUTION_ID = "20260815-083000000"
const projectFile = (value) => path.resolve(ROOT, value)
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const authorizationPath = projectFile(AUTH)
const consumptionPath = projectFile(CONSUMPTION)
assert.equal(sha(authorizationPath), AUTHORIZATION_SHA256)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-visible-structure-phase0-derived-mode-control-flow-correction-v1")
assert.equal(authorization.status, "owner_authorized_unconsumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, "one_cpu_only_phase0_derived_mode_and_execution_grant_isolation_correction_with_full_trainer_pre_model_control_flow_regression")
assert.equal(consumption.status, "stage4_object_visible_structure_phase0_derived_mode_control_flow_correction_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTHORIZATION_SHA256)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.oneTimeConsumption, true)
for (const key of [
  "gpuAuthorized", "cudaInitializationAuthorized", "autogradAuthorized",
  "checkpointReadOrLoadAuthorized", "modelLoadAuthorized", "datasetMaterializationAuthorized",
  "optimizerAuthorized", "backwardAuthorized", "weightModificationAuthorized",
  "trainingAuthorized", "validationAuthorized", "smokeAuthorized",
  "automaticRetryAuthorized", "stage1OrStage2Authorized",
]) assert.equal(consumption[key], false, `${key}_must_be_false`)

const mutableSourceHashes = {
  phase0PythonEntry: "89bd4aae744bf17e0cd7feaef19ced1eca8b07d9dfbbbf3b2ccedc85bf98d859",
  phase0CpuChecker: "273d15babd63ad075e409d2026af7089f0fd7bc07c9ea8d5b3fd7ea02b46faed",
}
for (const [name, binding] of Object.entries(authorization.bindings)) {
  if (name in mutableSourceHashes) assert.equal(binding.sha256, mutableSourceHashes[name], `${name}_authorized_source_identity_changed`)
  else assert.equal(sha(projectFile(binding.path)), binding.sha256, `${name}_binding_changed`)
}

const output = projectFile(OUTPUT)
assert.equal(fs.existsSync(output), false, "derived_mode_control_flow_correction_output_exists")
const runner = projectFile(authorization.bindings.phase0Runner.path)
const pythonEntry = projectFile(authorization.bindings.phase0PythonEntry.path)
const checker = projectFile(authorization.bindings.phase0CpuChecker.path)
const library = projectFile(authorization.bindings.phase0SharedLibrary.path)
const trainer = projectFile(authorization.bindings.trainer.path)
const recorder = projectFile("scripts/record-stage4-object-visible-structure-phase0-derived-mode-control-flow-correction.mjs")
assert.equal(sha(runner), authorization.bindings.phase0Runner.sha256, "runner_must_remain_frozen")
assert.equal(sha(trainer), authorization.bindings.trainer.sha256, "trainer_must_remain_frozen")
assert.equal(sha(library), authorization.bindings.phase0SharedLibrary.sha256, "shared_library_remained_unchanged")

for (const file of [checker, recorder]) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true,
  })
  assert.equal(result.status, 0, `node_syntax_failed:${relative(file)}:${result.stderr}`)
}
const python = projectFile("ml/ai-painter/.venv/Scripts/python.exe")
const pythonSyntax = spawnSync(python, ["-c", `import ast,pathlib;ast.parse(pathlib.Path(r'${pythonEntry.replaceAll("\\", "\\\\")}').read_text(encoding='utf-8'))`], {
  cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true,
})
assert.equal(pythonSyntax.status, 0, `python_syntax_failed:${pythonSyntax.stderr}`)

const failedGpuAuthorization = read(projectFile(authorization.bindings.gpuAuthorization.path))
const cpuRun = spawnSync(process.execPath, [checker,
  "--authorization", ORIGINAL_IMPLEMENTATION_AUTH,
  "--consumption", ORIGINAL_IMPLEMENTATION_CONSUMPTION,
  "--source-config", authorization.bindings.sourceConfig.path,
  "--inactive-fragment", failedGpuAuthorization.bindings.inactiveConfigFragment.path,
  "--lineage-identity", authorization.bindings.executionIdentity.path,
  "--prospective-gpu-request-id", GPU_REQUEST_ID,
], {
  cwd: ROOT,
  encoding: "utf8",
  env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTORCH_NVML_BASED_CUDA_CHECK: "1" },
  windowsHide: true,
  timeout: 900000,
})
assert.equal(cpuRun.status, 0, `cpu_contract_failed:${cpuRun.stderr}`)
const cpu = JSON.parse(cpuRun.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
assert.equal(cpu.trainerPreModelControlFlowContract.immutableFormalSourceValidatedFirst, true)
assert.equal(cpu.trainerPreModelControlFlowContract.dedicatedModeInstalledAfterSourceValidation, true)
assert.equal(cpu.trainerPreModelControlFlowContract.resolvedAdapterBinding, "object_visible_structure_phase0_adapter")
assert.equal(cpu.trainerPreModelControlFlowContract.datasetMaterialized, false)
assert.equal(cpu.trainerPreModelControlFlowContract.cudaInitialized, false)

fs.mkdirSync(output, { recursive: true })
const files = {
  cpu: path.join(output, "cpu-contract-report.json"),
  report: path.join(output, "correction-report.json"),
  attestation: path.join(output, "implementation-attestation.json"),
  terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const now = new Date().toISOString()
const shanghai = formatShanghai(now)
writeJsonAtomic(files.cpu, {
  ...cpu,
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-visible-structure-phase0-derived-mode-control-flow-correction-report-v1",
  status: "stage4_object_visible_structure_phase0_derived_mode_and_execution_grant_isolated_cpu_verified",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  boundFailure: {
    gpuAuthorization: authorization.bindings.gpuAuthorization,
    gpuConsumption: authorization.bindings.gpuConsumption,
    failureReport: authorization.bindings.failureReport,
    failureTerminal: authorization.bindings.failureTerminal,
    failureFinalizationReport: authorization.bindings.failureFinalizationReport,
    updateStderr: authorization.bindings.updateStderr,
  },
  correction: {
    immutableFormalSourceValidatedBeforeDedicatedModeInstallation: true,
    dedicatedModeId: "stage4_object_visible_structure_phase0_engineering",
    dedicatedAdapterBinding: "object_visible_structure_phase0_adapter",
    dedicatedExecutionKind: "phase0_engineering",
    selectedSplit: "validation",
    formalStage0ActionDenied: true,
    smokeAndAutomaticRetryDenied: true,
    runnerFrozen: true,
    trainerFrozen: true,
    sourceConfigImmutable: true,
  },
  codeIdentity: {
    runner: bind(runner), pythonEntry: bind(pythonEntry), cpuChecker: bind(checker),
    sharedLibrary: bind(library), trainer: bind(trainer), recorder: bind(recorder),
  },
  cpuContractReport: bind(files.cpu),
  executionBoundary: {
    gpuUsed: false, cudaInitialized: false, autogradExecuted: false,
    checkpointReadOrLoaded: false, modelLoaded: false, datasetMaterialized: false,
    optimizerCreated: false, backwardExecuted: false, weightsModified: false,
    trainingStarted: false, validationStarted: false, smokeStarted: false,
  },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-object-visible-structure-phase0-derived-mode-control-flow-implementation-attestation-v1",
  status: "stage4_object_visible_structure_phase0_fresh_gpu_command_identity_implemented_cpu_verified",
  implementationAuthorizationSha256: AUTHORIZATION_SHA256,
  implementationConsumptionSha256: sha(consumptionPath),
  implementationReport: bind(files.report),
  runnerSha256: sha(runner),
  pythonEntrySha256: sha(pythonEntry),
  cpuCheckerSha256: sha(checker),
  sharedLibrarySha256: sha(library),
  trainerSha256: sha(trainer),
  dedicatedPhase0ModeInstalledAfterFormalSourceValidation: true,
  realTrainerPreModelControlFlowPassed: true,
  gpuExecutedNow: false,
  cudaInitializedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  datasetMaterializedNow: false,
  trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-phase0-derived-mode-control-flow-correction-terminal-v1",
  status: "stage4_object_visible_structure_phase0_derived_mode_control_flow_correction_succeeded_closed",
  correctionReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  cpuContractReport: bind(files.cpu),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_create_new_bound_single_gpu_phase0_execution_authorization_or_exit",
  gpuUsedNow: false,
  cudaInitializedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  datasetMaterializedNow: false,
  trainingStartedNow: false,
  smokeStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})

const oldBindings = failedGpuAuthorization.bindings
const gpuBindings = {
  implementationAuthorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  implementationReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  implementationTerminal: bind(files.terminal),
  phase0DesignReport: oldBindings.phase0DesignReport,
  inactivePhase0ExecutionContract: oldBindings.inactivePhase0ExecutionContract,
  phase0Runner: bind(runner),
  phase0PythonEntry: bind(pythonEntry),
  phase0CpuChecker: bind(checker),
  phase0SharedLibrary: bind(library),
  sourceConfig: authorization.bindings.sourceConfig,
  inactiveConfigFragment: oldBindings.inactiveConfigFragment,
  datasetManifest: oldBindings.datasetManifest,
  datasetSourceIndex: oldBindings.datasetSourceIndex,
  projectAutoencoderCheckpoint: oldBindings.projectAutoencoderCheckpoint,
  model: oldBindings.model,
  trainer: bind(trainer),
  readonlyGpuTerminal: oldBindings.readonlyGpuTerminal,
  readonlyGpuFinalizationReport: oldBindings.readonlyGpuFinalizationReport,
}
const proposedAuthorization = buildGpuAuthorizationFixture(gpuBindings)
proposedAuthorization.requestId = GPU_REQUEST_ID
proposedAuthorization.commandRef = GPU_REQUEST_ID
proposedAuthorization.execution = {
  consumptionPath: `.runtime/ai-painter/owner-action-requests/${GPU_REQUEST_ID}/consumption.json`,
  outputDirectory: `.runtime/ai-painter/stage4-object-visible-structure-phase0-executions/${GPU_EXECUTION_ID}`,
  runId: `${GPU_EXECUTION_ID}-phase0`,
  maximumExecutions: 1,
  consumeBeforeFirstEvidenceWrite: true,
}
validateGpuAuthorizationDocument(proposedAuthorization)
assert.equal(fs.existsSync(projectFile(proposedAuthorization.execution.consumptionPath)), false)
assert.equal(fs.existsSync(projectFile(proposedAuthorization.execution.outputDirectory)), false)
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "owner_create_new_bound_single_gpu_phase0_execution_authorization_or_exit",
  requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${GPU_REQUEST_ID}/authorization.json`,
  proposedAuthorization,
  boundCorrectionReport: bind(files.report),
  boundImplementationAttestation: bind(files.attestation),
  boundTerminal: bind(files.terminal),
  gpuExecutedNow: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Phase0 dedicated in-memory mode and ExecutionGrant isolated; real Trainer pre-model CPU control flow passed; GPU inactive",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "new_immutable_owner_single_gpu_phase0_execution_authorization_not_created_or_consumed",
  nextLegalAction: "owner_create_new_bound_single_gpu_phase0_execution_authorization_or_exit",
  forbiddenActions: authorization.forbiddenActions,
  evidence: {
    correctionReport: bind(files.report), implementationAttestation: bind(files.attestation),
    cpuContractReport: bind(files.cpu), ownerActionRequest: bind(files.owner),
  },
  gpuUsedNow: false,
  cudaInitializedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  datasetMaterializedNow: false,
  trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})

for (const file of [authorizationPath, consumptionPath, runner, pythonEntry, checker, library, trainer, recorder, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot",
    runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-object-visible-structure-phase0-derived-mode-control-flow-correction-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_visible_structure_phase0_derived_mode_control_flow_correction",
  runId: REQUEST_ID,
  kind: "cpu_only_contract_correction",
  status: "success",
  title: "Phase0 dedicated mode and grant control flow corrected",
  titleZh: "Phase0 专用模式与授权控制流修正完成",
  detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}；真实 Trainer 在数据集构造前通过专用 Phase0 模式，未启动 GPU、CUDA、模型或训练。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status,
  cpuContractReport: bind(files.cpu),
  correctionReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  terminal: bind(files.terminal),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
}, null, 2))
