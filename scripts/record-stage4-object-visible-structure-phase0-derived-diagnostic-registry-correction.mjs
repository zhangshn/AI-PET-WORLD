import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  FIXED_TASK_IDENTITY,
  GPU_ACTIONS,
  GPU_REQUEST_ID,
  OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS,
  buildGpuAuthorizationFixture,
  compilePhase0DerivedConfig,
  validatePhase0DerivedConfig,
} from "./lib/ai-painter-stage4-object-visible-structure-phase0-execution.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-derived-diagnostic-registry-correction-20260815-052000000"
const AUTHORIZATION_SHA256 = "b2b4da73c35143cf2a830a14c60d599a6af04f276703b13b55fd5a43ffd7d8cf"
const AUTH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization.json`
const CONSUMPTION = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/consumption.json`
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-derived-config-corrections/20260815-052000000"
const ORIGINAL_IMPLEMENTATION_AUTH = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-phase0-execution-entry-implementation-20260815-043000000/authorization.json"
const ORIGINAL_IMPLEMENTATION_CONSUMPTION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-phase0-execution-entry-implementation-20260815-043000000/consumption.json"
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const projectFile = (value) => {
  assert.ok(value)
  const result = path.resolve(ROOT, value)
  assert.ok(result.startsWith(`${ROOT}${path.sep}`))
  return result
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const authorizationPath = projectFile(AUTH)
const consumptionPath = projectFile(CONSUMPTION)
assert.equal(sha(authorizationPath), AUTHORIZATION_SHA256)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-visible-structure-phase0-derived-diagnostic-registry-correction-v1")
assert.equal(authorization.status, "owner_authorized_unconsumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, "one_cpu_only_phase0_derived_diagnostic_registry_compilation_and_preconsumption_regression_correction")
assert.equal(consumption.status, "stage4_object_visible_structure_phase0_derived_diagnostic_registry_correction_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTHORIZATION_SHA256)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.oneTimeConsumption, true)
const authorizedMutableSourceHashes = {
  phase0Runner: "9e5a8ab50f56a63489f317673859f80f7726e85cbd7c707f7d60a3c0a2cd60ec",
  phase0PythonEntry: "b1225aa90d5460d296689d292e2bd9e3d7455eefe2b0bb13f88fc9084b9be277",
  phase0CpuChecker: "af7a95e04c300172b9d193e49647953680084b718c2b5019d1d53ba2bba8be76",
  phase0SharedLibrary: "5a9fb9a1166b758eff5de15587fc256d4323019cca4f82f22c01193a550296b2",
}
for (const [name, binding] of Object.entries(authorization.bindings)) {
  if (name in authorizedMutableSourceHashes) {
    assert.equal(binding.sha256, authorizedMutableSourceHashes[name], `${name}_authorized_source_identity_changed`)
  } else {
    assert.equal(sha(projectFile(binding.path)), binding.sha256, `${name}_binding_changed`)
  }
}
for (const key of [
  "gpuAuthorized", "cudaInitializationAuthorized", "autogradAuthorized",
  "checkpointReadOrLoadAuthorized", "modelLoadAuthorized", "trainingAuthorized",
  "validationAuthorized", "smokeAuthorized", "automaticRetryAuthorized",
  "stage1OrStage2Authorized",
]) assert.equal(consumption[key], false, `${key}_must_be_false`)

const output = projectFile(OUTPUT)
assert.equal(fs.existsSync(output), false, "correction_output_already_exists")
const runner = projectFile("scripts/run-stage4-object-visible-structure-phase0.mjs")
const pythonEntry = projectFile("ml/ai-painter/scripts/run_stage4_object_visible_structure_phase0.py")
const checker = projectFile("scripts/check-stage4-object-visible-structure-phase0-execution-entry.mjs")
const library = projectFile("scripts/lib/ai-painter-stage4-object-visible-structure-phase0-execution.mjs")
const recorder = projectFile("scripts/record-stage4-object-visible-structure-phase0-derived-diagnostic-registry-correction.mjs")
const trainer = projectFile(authorization.bindings.trainer.path)
const sourceConfigPath = projectFile(authorization.bindings.sourceConfig.path)
const fragmentPath = projectFile(authorization.bindings.inactiveConfigFragment.path)
const failedConfigPath = projectFile(authorization.bindings.failedEffectiveConfig.path)

for (const file of [runner, checker, library, recorder]) {
  const syntax = spawnSync(process.execPath, ["--check", file], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true })
  assert.equal(syntax.status, 0, `node_syntax_failed:${relative(file)}:${syntax.stderr}`)
}
const pythonSyntax = spawnSync(PYTHON, ["-c", `import ast,pathlib;ast.parse(pathlib.Path(r'${pythonEntry.replaceAll("\\", "\\\\")}').read_text(encoding='utf-8'))`], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true })
assert.equal(pythonSyntax.status, 0, `python_syntax_failed:${pythonSyntax.stderr}`)
const cpuRun = spawnSync(process.execPath, [checker,
  "--authorization", ORIGINAL_IMPLEMENTATION_AUTH,
  "--consumption", ORIGINAL_IMPLEMENTATION_CONSUMPTION,
  "--source-config", relative(sourceConfigPath),
  "--inactive-fragment", relative(fragmentPath),
], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true })
assert.equal(cpuRun.status, 0, `cpu_contract_failed:${cpuRun.stderr}`)
const cpu = JSON.parse(cpuRun.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)

fs.mkdirSync(output, { recursive: true })
const files = {
  correctedConfig: path.join(output, "corrected-phase0-effective-config.json"),
  cpu: path.join(output, "cpu-contract-report.json"),
  trainerPreflight: path.join(output, "real-trainer-input-preflight.json"),
  report: path.join(output, "correction-report.json"),
  attestation: path.join(output, "implementation-attestation.json"),
  terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const sourceConfig = read(sourceConfigPath)
const fragment = read(fragmentPath)
const failedConfig = read(failedConfigPath)
const correctedConfig = compilePhase0DerivedConfig(sourceConfig, fragment)
validatePhase0DerivedConfig(correctedConfig, sourceConfig)
writeJsonAtomic(files.correctedConfig, correctedConfig)
const trainerRun = spawnSync(PYTHON, [pythonEntry,
  "--derived-config-contract-only",
  "--config", files.correctedConfig,
  "--dataset-package", projectFile(read(authorization.bindings.gpuAuthorization.path).bindings.datasetManifest.path),
], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTORCH_NVML_BASED_CUDA_CHECK: "1" }, windowsHide: true, timeout: 900000 })
assert.equal(trainerRun.status, 0, `real_trainer_input_preflight_failed:${trainerRun.stderr}`)
const trainerPreflight = JSON.parse(trainerRun.stdout)
assert.equal(trainerPreflight.diagnosticFieldCount, 32)
assert.equal(trainerPreflight.diagnosticFieldsExact, true)
assert.equal(trainerPreflight.cudaInitialized, false)
for (const key of ["checkpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "weightsModified", "trainingStarted", "validationStarted", "smokeStarted"]) assert.equal(trainerPreflight[key], false, `${key}_must_be_false`)

const now = new Date().toISOString()
const shanghai = formatShanghai(now)
writeJsonAtomic(files.cpu, {
  ...cpu,
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  sourceConfig: bind(sourceConfigPath),
  inactiveConfigFragment: bind(fragmentPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.trainerPreflight, {
  ...trainerPreflight,
  correctedDerivedConfig: bind(files.correctedConfig),
  trainer: bind(trainer),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
const failedRegistry = failedConfig.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry
const correctedRegistry = correctedConfig.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-visible-structure-phase0-derived-diagnostic-registry-correction-report-v1",
  status: "stage4_object_visible_structure_phase0_derived_diagnostic_registry_corrected_cpu_verified",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  boundFailureEvidence: {
    failureReport: authorization.bindings.failureReport,
    failureTerminal: authorization.bindings.failureTerminal,
    failureFinalizationReport: authorization.bindings.failureFinalizationReport,
    updateStderr: authorization.bindings.updateStderr,
    failedEffectiveConfig: authorization.bindings.failedEffectiveConfig,
  },
  rootCause: "the prior Phase0 derived config retained the 29-field semantic-mixture diagnostic registry after activating four-object visible-structure supervision",
  correction: {
    sourceConfigModified: false,
    derivedConfigOnly: true,
    failedExactFieldCount: failedRegistry.exactFieldCount,
    correctedExactFieldCount: correctedRegistry.exactFieldCount,
    exactFields: correctedRegistry.exactFields,
    baseDiagnosticSupportManifestPreserved: true,
  },
  codeIdentity: { runner: bind(runner), pythonEntry: bind(pythonEntry), cpuChecker: bind(checker), sharedLibrary: bind(library), recorder: bind(recorder), trainer: bind(trainer) },
  correctedDerivedConfig: bind(files.correctedConfig),
  cpuContractReport: bind(files.cpu),
  realTrainerInputPreflight: bind(files.trainerPreflight),
  executionBoundary: {
    gpuUsed: false, cudaInitialized: false, autogradExecuted: false,
    checkpointReadOrLoaded: false, modelLoaded: false, optimizerCreated: false,
    backwardExecuted: false, weightsModified: false, trainingStarted: false,
    validationStarted: false, smokeStarted: false, automaticRetryStarted: false,
  },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-object-visible-structure-phase0-derived-diagnostic-registry-correction-attestation-v1",
  status: "stage4_object_visible_structure_phase0_derived_diagnostic_registry_corrected_cpu_verified",
  correctionAuthorizationSha256: AUTHORIZATION_SHA256,
  correctionConsumptionSha256: sha(consumptionPath),
  correctionReport: bind(files.report),
  correctedDerivedConfig: bind(files.correctedConfig),
  runnerSha256: sha(runner),
  pythonEntrySha256: sha(pythonEntry),
  cpuCheckerSha256: sha(checker),
  sharedLibrarySha256: sha(library),
  trainerSha256: sha(trainer),
  diagnosticManifestMetricCount: OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS.length,
  gpuExecutedNow: false,
  cudaInitializedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-phase0-derived-diagnostic-registry-correction-terminal-v1",
  status: "stage4_object_visible_structure_phase0_derived_diagnostic_registry_correction_succeeded_closed",
  correctionReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  correctedDerivedConfig: bind(files.correctedConfig),
  cpuContractReport: bind(files.cpu),
  realTrainerInputPreflight: bind(files.trainerPreflight),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_create_new_bound_single_gpu_phase0_execution_authorization_or_exit",
  gpuUsedNow: false,
  cudaInitializedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  trainingStartedNow: false,
  smokeStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})

const failedGpuAuthorization = read(projectFile(authorization.bindings.gpuAuthorization.path))
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
  inactiveConfigFragment: authorization.bindings.inactiveConfigFragment,
  datasetManifest: oldBindings.datasetManifest,
  datasetSourceIndex: oldBindings.datasetSourceIndex,
  projectAutoencoderCheckpoint: oldBindings.projectAutoencoderCheckpoint,
  model: oldBindings.model,
  trainer: authorization.bindings.trainer,
  readonlyGpuTerminal: oldBindings.readonlyGpuTerminal,
  readonlyGpuFinalizationReport: oldBindings.readonlyGpuFinalizationReport,
}
const proposedAuthorization = buildGpuAuthorizationFixture(gpuBindings)
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
  currentStage: "Four-object visible-structure Phase0 derived diagnostic registry corrected and real Trainer input contract CPU-verified; GPU execution inactive",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "new_immutable_owner_single_gpu_phase0_execution_authorization_not_created_or_consumed",
  nextLegalAction: "owner_create_new_bound_single_gpu_phase0_execution_authorization_or_exit",
  forbiddenActions: authorization.forbiddenActions,
  evidence: {
    correctionReport: bind(files.report),
    implementationAttestation: bind(files.attestation),
    correctedDerivedConfig: bind(files.correctedConfig),
    cpuContractReport: bind(files.cpu),
    realTrainerInputPreflight: bind(files.trainerPreflight),
    ownerActionRequest: bind(files.owner),
  },
  gpuUsedNow: false,
  cudaInitializedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})

const indexed = [authorizationPath, consumptionPath, runner, pythonEntry, checker, library, recorder, trainer, sourceConfigPath, fragmentPath, failedConfigPath, ...Object.values(files)]
for (const file of indexed) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-object-visible-structure-phase0-derived-registry-correction-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_visible_structure_phase0_derived_diagnostic_registry_correction",
  runId: REQUEST_ID,
  kind: "cpu_only_contract_correction",
  status: "success",
  title: "Phase0 derived diagnostic registry corrected",
  titleZh: "Phase0 派生诊断注册表修正完成",
  detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}，真实 Trainer 输入合同通过；未启动 GPU、未读取 Checkpoint、未加载模型。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status,
  cpuContractReport: bind(files.cpu),
  realTrainerInputPreflight: bind(files.trainerPreflight),
  correctionReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  terminal: bind(files.terminal),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
}, null, 2))
