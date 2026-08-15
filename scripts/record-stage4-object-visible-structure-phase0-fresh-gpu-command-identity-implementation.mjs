import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  GPU_REQUEST_ID,
  buildGpuAuthorizationFixture,
  validateGpuAuthorizationDocument,
} from "./lib/ai-painter-stage4-object-visible-structure-phase0-execution.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-fresh-gpu-command-identity-implementation-20260815-061000000"
const AUTHORIZATION_SHA256 = "89ca44e67c1759386f69964b0cb4196760661b7410d8c2c0b283ad2bf15613aa"
const AUTH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization.json`
const CONSUMPTION = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/consumption.json`
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-fresh-gpu-command-identity-implementations/20260815-061000000"
const ORIGINAL_IMPLEMENTATION_AUTH = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-phase0-execution-entry-implementation-20260815-043000000/authorization.json"
const ORIGINAL_IMPLEMENTATION_CONSUMPTION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-phase0-execution-entry-implementation-20260815-043000000/consumption.json"
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
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-visible-structure-phase0-fresh-gpu-command-identity-implementation-v1")
assert.equal(authorization.status, "owner_authorized_unconsumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, "one_cpu_only_parameterization_of_fresh_phase0_gpu_command_identity_and_full_proposed_authorization_composition_regression")
assert.equal(consumption.status, "stage4_object_visible_structure_phase0_fresh_gpu_command_identity_implementation_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTHORIZATION_SHA256)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.oneTimeConsumption, true)
const mutableSourceHashes = {
  phase0Runner: "e622031a9b93de6a5150a09a5535c19bce376eb653fe1569544b55f25e22e384",
  phase0PythonEntry: "dc2bf9a02aefdb75dbd6abae37c096058365df001fb49bd64687452fdc90c747",
  phase0CpuChecker: "78e637705d6236ec6c28824a932a38467830f2276f5b6dc7961510f32b03578f",
  phase0SharedLibrary: "f00b61c54d36c3af0c25e89a8a48e737db44e08cb3a21e564591a8a4ca8e5f1a",
}
for (const [name, binding] of Object.entries(authorization.bindings)) {
  if (name in mutableSourceHashes) assert.equal(binding.sha256, mutableSourceHashes[name], `${name}_authorized_source_identity_changed`)
  else assert.equal(sha(projectFile(binding.path)), binding.sha256, `${name}_binding_changed`)
}
for (const key of ["gpuAuthorized", "cudaInitializationAuthorized", "autogradAuthorized", "checkpointReadOrLoadAuthorized", "modelLoadAuthorized", "optimizerAuthorized", "backwardAuthorized", "weightModificationAuthorized", "trainingAuthorized", "validationAuthorized", "smokeAuthorized", "automaticRetryAuthorized", "stage1OrStage2Authorized"]) assert.equal(consumption[key], false, `${key}_must_be_false`)

const output = projectFile(OUTPUT)
assert.equal(fs.existsSync(output), false, "fresh_command_identity_output_exists")
const runner = projectFile("scripts/run-stage4-object-visible-structure-phase0.mjs")
const pythonEntry = projectFile("ml/ai-painter/scripts/run_stage4_object_visible_structure_phase0.py")
const checker = projectFile("scripts/check-stage4-object-visible-structure-phase0-execution-entry.mjs")
const library = projectFile("scripts/lib/ai-painter-stage4-object-visible-structure-phase0-execution.mjs")
const recorder = projectFile("scripts/record-stage4-object-visible-structure-phase0-fresh-gpu-command-identity-implementation.mjs")
const trainer = projectFile(authorization.bindings.trainer.path)
for (const file of [runner, checker, library, recorder]) {
  const result = spawnSync(process.execPath, ["--check", file], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true })
  assert.equal(result.status, 0, `node_syntax_failed:${relative(file)}:${result.stderr}`)
}
const python = projectFile("ml/ai-painter/.venv/Scripts/python.exe")
const pythonSyntax = spawnSync(python, ["-c", `import ast,pathlib;ast.parse(pathlib.Path(r'${pythonEntry.replaceAll("\\", "\\\\")}').read_text(encoding='utf-8'))`], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true })
assert.equal(pythonSyntax.status, 0, `python_syntax_failed:${pythonSyntax.stderr}`)
const cpuRun = spawnSync(process.execPath, [checker,
  "--authorization", ORIGINAL_IMPLEMENTATION_AUTH,
  "--consumption", ORIGINAL_IMPLEMENTATION_CONSUMPTION,
  "--source-config", authorization.bindings.sourceConfig.path,
  "--inactive-fragment", ".runtime/ai-painter/stage4-object-visible-structure-supervision/20260815-002000000/inactive-config-fragment.json",
  "--lineage-identity", relative(path.join(path.dirname(path.dirname(projectFile(authorization.bindings.failedGpuTerminal.path))), "phase0-update-execution-identity.json")),
  "--prospective-gpu-request-id", GPU_REQUEST_ID,
], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTORCH_NVML_BASED_CUDA_CHECK: "1" }, windowsHide: true, timeout: 900000 })
assert.equal(cpuRun.status, 0, `cpu_contract_failed:${cpuRun.stderr}`)
const cpu = JSON.parse(cpuRun.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
assert.equal(cpu.lineageContract.prospectiveRequestId, GPU_REQUEST_ID)
const entryRun = spawnSync(process.execPath, [runner, "--implementation-contract-only", "--implementation-authorization", ORIGINAL_IMPLEMENTATION_AUTH, "--implementation-consumption", ORIGINAL_IMPLEMENTATION_CONSUMPTION], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true })
assert.equal(entryRun.status, 0, `runner_contract_failed:${entryRun.stderr}`)
const entry = JSON.parse(entryRun.stdout)
assert.equal(entry.cudaInitialized, false)
assert.equal(entry.gpuStarted, false)

fs.mkdirSync(output, { recursive: true })
const files = { cpu: path.join(output, "cpu-contract-report.json"), report: path.join(output, "implementation-report.json"), attestation: path.join(output, "implementation-attestation.json"), terminal: path.join(output, "phase-terminal.json"), owner: path.join(output, "owner-action-request.json"), capsule: path.join(output, "local-task-capsule.json") }
const now = new Date().toISOString()
const shanghai = formatShanghai(now)
writeJsonAtomic(files.cpu, { ...cpu, actualRunnerContract: entry, authorization: bind(authorizationPath), consumption: bind(consumptionPath), recordedAtUtc: now, recordedAtAsiaShanghai: shanghai })
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-visible-structure-phase0-fresh-gpu-command-identity-implementation-report-v1",
  status: "stage4_object_visible_structure_phase0_fresh_gpu_command_identity_implemented_cpu_verified",
  authorization: bind(authorizationPath), consumption: bind(consumptionPath),
  priorLineageCorrection: { report: authorization.bindings.lineageCorrectionReport, attestation: authorization.bindings.lineageCorrectionAttestation, terminal: authorization.bindings.lineageCorrectionTerminal },
  implementation: { freshGpuRequestId: GPU_REQUEST_ID, retiredRequestIdsRejected: [authorization.bindings.failedGpuAuthorization.path], requestIdDerivedRunIdConsumptionAndOutput: true, sourceConfigModified: false },
  codeIdentity: { runner: bind(runner), pythonEntry: bind(pythonEntry), cpuChecker: bind(checker), sharedLibrary: bind(library), recorder: bind(recorder), trainer: bind(trainer) },
  cpuContractReport: bind(files.cpu),
  executionBoundary: { gpuUsed: false, cudaInitialized: false, autogradExecuted: false, checkpointReadOrLoaded: false, modelLoaded: false, optimizerCreated: false, backwardExecuted: false, weightsModified: false, trainingStarted: false, validationStarted: false, smokeStarted: false },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-object-visible-structure-phase0-fresh-gpu-command-identity-implementation-attestation-v1",
  status: "stage4_object_visible_structure_phase0_fresh_gpu_command_identity_implemented_cpu_verified",
  implementationAuthorizationSha256: AUTHORIZATION_SHA256, implementationConsumptionSha256: sha(consumptionPath), implementationReport: bind(files.report),
  runnerSha256: sha(runner), pythonEntrySha256: sha(pythonEntry), cpuCheckerSha256: sha(checker), sharedLibrarySha256: sha(library), trainerSha256: sha(trainer),
  gpuExecutedNow: false, cudaInitializedNow: false, checkpointReadNow: false, modelLoadedNow: false, trainingStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-phase0-fresh-gpu-command-identity-implementation-terminal-v1",
  status: "stage4_object_visible_structure_phase0_fresh_gpu_command_identity_implementation_succeeded_closed",
  implementationReport: bind(files.report), implementationAttestation: bind(files.attestation), cpuContractReport: bind(files.cpu),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, nextLegalAction: "owner_create_new_bound_single_gpu_phase0_execution_authorization_or_exit",
  gpuUsedNow: false, cudaInitializedNow: false, checkpointReadNow: false, modelLoadedNow: false, trainingStartedNow: false, smokeStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})

const failedGpuAuthorization = read(projectFile(authorization.bindings.failedGpuAuthorization.path))
const oldBindings = failedGpuAuthorization.bindings
const gpuBindings = {
  implementationAuthorization: bind(authorizationPath), implementationConsumption: bind(consumptionPath), implementationReport: bind(files.report), implementationAttestation: bind(files.attestation), implementationTerminal: bind(files.terminal),
  phase0DesignReport: oldBindings.phase0DesignReport, inactivePhase0ExecutionContract: oldBindings.inactivePhase0ExecutionContract,
  phase0Runner: bind(runner), phase0PythonEntry: bind(pythonEntry), phase0CpuChecker: bind(checker), phase0SharedLibrary: bind(library),
  sourceConfig: authorization.bindings.sourceConfig, inactiveConfigFragment: oldBindings.inactiveConfigFragment, datasetManifest: oldBindings.datasetManifest, datasetSourceIndex: oldBindings.datasetSourceIndex, projectAutoencoderCheckpoint: oldBindings.projectAutoencoderCheckpoint, model: oldBindings.model, trainer: bind(trainer), readonlyGpuTerminal: oldBindings.readonlyGpuTerminal, readonlyGpuFinalizationReport: oldBindings.readonlyGpuFinalizationReport,
}
const proposedAuthorization = buildGpuAuthorizationFixture(gpuBindings)
validateGpuAuthorizationDocument(proposedAuthorization)
assert.equal(fs.existsSync(projectFile(proposedAuthorization.execution.consumptionPath)), false)
assert.equal(fs.existsSync(projectFile(proposedAuthorization.execution.outputDirectory)), false)
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1", status: "not_authorized_not_consumed", requestedAction: "owner_create_new_bound_single_gpu_phase0_execution_authorization_or_exit",
  requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${GPU_REQUEST_ID}/authorization.json`, proposedAuthorization,
  boundImplementationReport: bind(files.report), boundImplementationAttestation: bind(files.attestation), boundTerminal: bind(files.terminal), gpuExecutedNow: false, automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Fresh Phase0 GPU command identity implemented and CPU-verified; GPU execution inactive",
  candidateTerminal: bind(files.terminal), latestBlocker: "new_immutable_owner_single_gpu_phase0_execution_authorization_not_created_or_consumed", nextLegalAction: "owner_create_new_bound_single_gpu_phase0_execution_authorization_or_exit",
  forbiddenActions: authorization.forbiddenActions, evidence: { implementationReport: bind(files.report), implementationAttestation: bind(files.attestation), cpuContractReport: bind(files.cpu), ownerActionRequest: bind(files.owner) },
  gpuUsedNow: false, cudaInitializedNow: false, checkpointReadNow: false, modelLoadedNow: false, trainingStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
for (const file of [authorizationPath, consumptionPath, runner, pythonEntry, checker, library, recorder, trainer, ...Object.values(files)]) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }
appendAiPainterProgramEvent({ id: `stage4-object-visible-structure-phase0-fresh-command-identity-${REQUEST_ID}`, timestamp: now, action: "stage4_object_visible_structure_phase0_fresh_gpu_command_identity_implementation", runId: REQUEST_ID, kind: "cpu_only_implementation", status: "success", title: "Fresh Phase0 GPU command identity implemented", titleZh: "Phase0 新 GPU 命令身份实施完成", detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}；未启动 GPU、CUDA、模型或训练。`, evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(files.terminal).status, cpuContractReport: bind(files.cpu), implementationReport: bind(files.report), implementationAttestation: bind(files.attestation), terminal: bind(files.terminal), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
