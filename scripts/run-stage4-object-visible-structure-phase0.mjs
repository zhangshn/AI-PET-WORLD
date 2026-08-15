import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  IMPLEMENTATION_AUTHORIZATION_SHA256,
  IMPLEMENTATION_CONSUMPTION_SHA256,
  compilePhase0DerivedConfig,
  validateGpuAuthorizationDocument,
  validateImplementationSource,
} from "./lib/ai-painter-stage4-object-visible-structure-phase0-execution.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const RUNNER_PATH = path.join(ROOT, "scripts", "run-stage4-object-visible-structure-phase0.mjs")
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const PYTHON_ENTRY = path.join(ROOT, "ml", "ai-painter", "scripts", "run_stage4_object_visible_structure_phase0.py")
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.ok(value); assert.equal(path.isAbsolute(value), false); const result = path.resolve(ROOT, value); assert.ok(result.startsWith(`${ROOT}${path.sep}`)); return result }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const runPython = (args) => spawnSync(PYTHON, [PYTHON_ENTRY, ...args], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUBLAS_WORKSPACE_CONFIG: ":4096:8" }, windowsHide: true, timeout: 900000 })
const writeExclusive = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  assert.equal(fs.existsSync(file), false, `immutable_file_exists:${relative(file)}`)
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  fs.renameSync(temp, file)
}

const implementationAuthorizationPath = projectFile(arg("--implementation-authorization"))
const implementationConsumptionPath = projectFile(arg("--implementation-consumption"))
assert.equal(sha(implementationAuthorizationPath), IMPLEMENTATION_AUTHORIZATION_SHA256)
assert.equal(sha(implementationConsumptionPath), IMPLEMENTATION_CONSUMPTION_SHA256)
const implementationAuthorization = read(implementationAuthorizationPath)
const implementationConsumption = read(implementationConsumptionPath)
for (const [name, binding] of Object.entries(implementationAuthorization.bindings)) assert.equal(sha(projectFile(binding.path)), binding.sha256, `${name}_binding_changed`)
validateImplementationSource({
  authorization: implementationAuthorization,
  consumption: implementationConsumption,
  designReport: read(projectFile(implementationAuthorization.bindings.phase0DesignReport.path)),
  inactiveContract: read(projectFile(implementationAuthorization.bindings.inactivePhase0ExecutionContract.path)),
  designTerminal: read(projectFile(implementationAuthorization.bindings.phase0DesignTerminal.path)),
})
const pythonContract = spawnSync(PYTHON, [PYTHON_ENTRY, "--contract-only"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true })
assert.equal(pythonContract.status, 0, `python_entry_contract_failed:${pythonContract.stderr}`)
const pythonReport = JSON.parse(pythonContract.stdout)
assert.equal(pythonReport.cudaInitialized, false)
assert.equal(pythonReport.checkpointRead, false)
assert.equal(pythonReport.modelLoaded, false)
assert.equal(pythonReport.optimizerCreated, false)
assert.equal(pythonReport.backwardExecuted, false)
assert.equal(pythonReport.trainingStarted, false)

if (process.argv.includes("--implementation-contract-only")) {
  console.log(JSON.stringify({
    schemaVersion: "stage4-object-visible-structure-phase0-execution-entry-contract-v1",
    status: "stage4_object_visible_structure_phase0_execution_entry_contract_valid_cpu_only",
    pythonEntry: pythonReport,
    gpuStarted: false,
    cudaInitialized: false,
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
validateGpuAuthorizationDocument(gpuAuthorization)
for (const [name, binding] of Object.entries(gpuAuthorization.bindings)) assert.equal(sha(projectFile(binding.path)), binding.sha256, `${name}_gpu_binding_changed`)
assert.ok(process.argv.includes("--execute-authorized-gpu-phase0"), "explicit_gpu_phase0_execution_flag_required")
const attestationPath = projectFile(gpuAuthorization.bindings.implementationAttestation.path)
const attestation = read(attestationPath)
assert.equal(attestation.status, "stage4_object_visible_structure_phase0_fresh_gpu_command_identity_implemented_cpu_verified")
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
  schemaVersion: "ai-painter-stage4-object-visible-structure-phase0-gpu-consumption-v1",
  status: "stage4_object_visible_structure_phase0_gpu_authorization_atomically_consumed",
  requestId: gpuAuthorization.requestId,
  commandRef: gpuAuthorization.commandRef,
  scope: gpuAuthorization.scope,
  runId,
  authorizationPath: relative(gpuAuthorizationPath),
  authorizationSha256: gpuAuthorizationSha256,
  implementationAttestationPath: relative(attestationPath),
  implementationAttestationSha256: sha(attestationPath),
  consumedAtUtc: now,
  consumedAtAsiaShanghai: formatShanghai(now),
  oneTimeConsumption: true,
  maximumExecutions: 1,
  smokeQuotaConsumed: false,
  formalTrainingAuthorized: false,
})
const consumption = { ...read(consumptionPath), ...bind(consumptionPath) }
fs.mkdirSync(output, { recursive: true })

const sourceConfig = read(projectFile(gpuAuthorization.bindings.sourceConfig.path))
const fragment = read(projectFile(gpuAuthorization.bindings.inactiveConfigFragment.path))
const effectiveConfig = compilePhase0DerivedConfig(sourceConfig, fragment)
const configPath = path.join(output, "phase0-effective-config.json")
writeExclusive(configPath, effectiveConfig)

const baseIdentity = {
  schemaVersion: "ai-painter-stage4-object-visible-structure-phase0-execution-identity-v1",
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
const commonArgs = ["--config", configPath, "--dataset-package", projectFile(gpuAuthorization.bindings.datasetManifest.path), "--autoencoder-checkpoint", projectFile(gpuAuthorization.bindings.projectAutoencoderCheckpoint.path), "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", gpuAuthorization.taskIdentity.sampleId, "--overfit-epochs", "1", "--overfit-evaluation-interval", "1"]
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
  const update = runPython([...commonArgs, "--output-dir", updateOutput, "--stage4-validation-kernel-phase0-update", "--phase0-execution-identity", updateIdentityPath])
  persistProcess("update", update)
  assert.equal(update.status, 0, `phase0_update_failed:${update.status}`)
  const updateReportPath = path.join(updateOutput, "phase0-update-report.json")
  const updateReport = read(updateReportPath)
  assert.equal(updateReport.status, "phase0_single_cuda_optimizer_step_passed_closed")
  assert.equal(updateReport.gradientFinite, true)
  assert.equal(updateReport.gradientNonzero, true)
  assert.equal(updateReport.weightsChanged, true)
  assert.equal(updateReport.autoencoderWeightsChanged, false)
  const checkpointPath = projectFile(updateReport.checkpointPath)
  assert.equal(sha(checkpointPath), updateReport.checkpointSha256)
  const reproductions = []
  for (const label of ["A", "B"]) {
    const identityPath = path.join(output, `phase0-reproduce-${label.toLowerCase()}-execution-identity.json`)
    writeExclusive(identityPath, { ...baseIdentity, executionPart: "fresh_process_checkpoint_preview_reproduction", reproductionLabel: label, diagnosticCheckpointPath: relative(checkpointPath), diagnosticCheckpointSha256: sha(checkpointPath) })
    const reproduceOutput = path.join(output, `reproduce-${label.toLowerCase()}`)
    const result = runPython([...commonArgs, "--output-dir", reproduceOutput, "--stage4-validation-kernel-phase0-reproduce", "--phase0-execution-identity", identityPath, "--phase0-diagnostic-checkpoint", checkpointPath])
    persistProcess(`reproduce-${label.toLowerCase()}`, result)
    assert.equal(result.status, 0, `phase0_reproduction_${label}_failed:${result.status}`)
    const reportPath = path.join(reproduceOutput, "phase0-reproduction-report.json")
    reproductions.push({ label, reportPath, report: read(reportPath) })
  }
  const [left, right] = reproductions.map((row) => row.report)
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
  writeJsonAtomic(reportPath, { schemaVersion: "stage4-object-visible-structure-phase0-finalization-v1", status: "stage4_object_visible_structure_phase0_passed_closed", runId, authorization: bind(gpuAuthorizationPath), consumption: bind(consumptionPath), updateReport: bind(updateReportPath), diagnosticCheckpoint: { ...bind(checkpointPath), promotable: false, fullTrainingInitializationEligible: false }, reproductions: reproductions.map((row) => ({ label: row.label, ...bind(row.reportPath) })), equality, optimizerSteps: 1, smokeQuotaConsumed: false, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: new Date().toISOString() })
  const terminalPath = path.join(finalization, "phase-terminal.json")
  writeJsonAtomic(terminalPath, { schemaVersion: "stage4-object-visible-structure-phase0-terminal-v1", status: "stage4_object_visible_structure_phase0_passed_closed", runId, finalizationReport: bind(reportPath), nextLegalAction: "owner_authorize_independent_30_epoch_smoke_or_exit", diagnosticCheckpointPromotable: false, smokeStarted: false, formalTrainingStarted: false, automaticRetryStarted: false, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: new Date().toISOString() })
  for (const file of [gpuAuthorizationPath, consumptionPath, attestationPath, configPath, updateReportPath, checkpointPath, ...processFiles, ...reproductions.map((row) => row.reportPath), reportPath, terminalPath]) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }
  appendAiPainterProgramEvent({ id: `stage4-object-visible-structure-phase0-${runId}`, timestamp: new Date().toISOString(), action: "stage4_object_visible_structure_phase0", runId, kind: "gpu_phase0_engineering_qualification", status: "success", title: "Four-object visible-structure Phase0 passed", titleZh: "四对象可见结构Phase0工程资格通过", evidencePath: relative(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  console.log(JSON.stringify({ status: read(terminalPath).status, terminal: bind(terminalPath), equality }, null, 2))
} catch (error) {
  const finalization = path.join(output, "finalization")
  fs.mkdirSync(finalization, { recursive: true })
  const reportPath = path.join(finalization, "failure-report.json")
  const terminalPath = path.join(finalization, "phase-terminal.json")
  if (!fs.existsSync(reportPath)) writeJsonAtomic(reportPath, { schemaVersion: "stage4-object-visible-structure-phase0-failure-report-v1", status: "stage4_object_visible_structure_phase0_failed_closed", runId, authorization: bind(gpuAuthorizationPath), consumption: bind(consumptionPath), failureMessage: String(error?.message ?? error), stack: error?.stack, smokeStarted: false, formalTrainingStarted: false, automaticRetryStarted: false, recordedAtUtc: new Date().toISOString() })
  if (!fs.existsSync(terminalPath)) writeJsonAtomic(terminalPath, { schemaVersion: "stage4-object-visible-structure-phase0-terminal-v1", status: "stage4_object_visible_structure_phase0_failed_closed", runId, failureReport: bind(reportPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, smokeStarted: false, formalTrainingStarted: false, automaticRetryStarted: false, recordedAtUtc: new Date().toISOString() })
  console.error(JSON.stringify({ status: read(terminalPath).status, terminal: bind(terminalPath), failureMessage: String(error?.message ?? error) }, null, 2))
  process.exitCode = 1
}
