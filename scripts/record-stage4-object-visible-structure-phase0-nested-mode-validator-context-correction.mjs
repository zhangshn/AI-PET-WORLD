import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { buildGpuAuthorizationFixture, validateGpuAuthorizationDocument } from "./lib/ai-painter-stage4-object-visible-structure-phase0-execution.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-nested-mode-validator-context-correction-20260815-090000000"
const AUTH_SHA = "b1fde7f1be300fd03bff22f3a27dcb559f05c01477b27151a703c5c60351aac9"
const AUTH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization.json`
const CONSUMPTION = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/consumption.json`
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-nested-mode-validator-context-corrections/20260815-090000000"
const GPU_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-20260815-093000000"
const GPU_EXECUTION_ID = "20260815-093000000"
const ORIGINAL_IMPLEMENTATION_AUTH = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-phase0-execution-entry-implementation-20260815-043000000/authorization.json"
const ORIGINAL_IMPLEMENTATION_CONSUMPTION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-phase0-execution-entry-implementation-20260815-043000000/consumption.json"
const file = (value) => path.resolve(ROOT, value)
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const authorizationPath = file(AUTH)
const consumptionPath = file(CONSUMPTION)
assert.equal(sha(authorizationPath), AUTH_SHA)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.status, "owner_authorized_unconsumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(consumption.status, "stage4_object_visible_structure_phase0_nested_mode_validator_context_correction_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTH_SHA)
assert.equal(consumption.oneTimeConsumption, true)
for (const key of ["gpuAuthorized", "cudaInitializationAuthorized", "autogradAuthorized", "checkpointReadOrLoadAuthorized", "modelLoadAuthorized", "datasetMaterializationAuthorized", "optimizerAuthorized", "backwardAuthorized", "weightModificationAuthorized", "trainingAuthorized", "validationAuthorized", "smokeAuthorized", "automaticRetryAuthorized", "stage1OrStage2Authorized"]) assert.equal(consumption[key], false)

const mutable = {
  phase0PythonEntry: "70fa98c76a82f2ac30bdd0c072493647a9cd00896e15e7de233453d3d06d46a6",
  phase0CpuChecker: "f62b231bba28aebe5c9f2929a5d8d90abfc859aca74be457c3889c3454a0294d",
}
for (const [name, binding] of Object.entries(authorization.bindings)) {
  if (name in mutable) assert.equal(binding.sha256, mutable[name])
  else assert.equal(sha(file(binding.path)), binding.sha256, `${name}_binding_changed`)
}
const output = file(OUTPUT)
assert.equal(fs.existsSync(output), false)
const runner = file(authorization.bindings.phase0Runner.path)
const pythonEntry = file(authorization.bindings.phase0PythonEntry.path)
const checker = file(authorization.bindings.phase0CpuChecker.path)
const library = file(authorization.bindings.phase0SharedLibrary.path)
const trainer = file(authorization.bindings.trainer.path)
const recorder = file("scripts/record-stage4-object-visible-structure-phase0-nested-mode-validator-context-correction.mjs")
assert.equal(sha(runner), authorization.bindings.phase0Runner.sha256)
assert.equal(sha(library), authorization.bindings.phase0SharedLibrary.sha256)
assert.equal(sha(trainer), authorization.bindings.trainer.sha256)
for (const candidate of [checker, recorder]) {
  const result = spawnSync(process.execPath, ["--check", candidate], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true })
  assert.equal(result.status, 0, result.stderr)
}
const python = file("ml/ai-painter/.venv/Scripts/python.exe")
const syntax = spawnSync(python, ["-c", `import ast,pathlib;ast.parse(pathlib.Path(r'${pythonEntry.replaceAll("\\", "\\\\")}').read_text(encoding='utf-8'))`], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true })
assert.equal(syntax.status, 0, syntax.stderr)

const failedGpuAuthorization = read(file(authorization.bindings.gpuAuthorization.path))
const cpuRun = spawnSync(process.execPath, [checker,
  "--authorization", ORIGINAL_IMPLEMENTATION_AUTH,
  "--consumption", ORIGINAL_IMPLEMENTATION_CONSUMPTION,
  "--source-config", authorization.bindings.sourceConfig.path,
  "--inactive-fragment", failedGpuAuthorization.bindings.inactiveConfigFragment.path,
  "--lineage-identity", authorization.bindings.executionIdentity.path,
  "--prospective-gpu-request-id", GPU_REQUEST_ID,
], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTORCH_NVML_BASED_CUDA_CHECK: "1" }, windowsHide: true, timeout: 900000 })
assert.equal(cpuRun.status, 0, cpuRun.stderr)
const cpu = JSON.parse(cpuRun.stdout)
assert.equal(cpu.positivePassed, 23)
assert.equal(cpu.negativePassed, 50)
assert.equal(cpu.trainerPreModelControlFlowContract.dispatchModeResolutionCount, 1)
assert.equal(cpu.trainerPreModelControlFlowContract.nestedValidatorModeId, "fact_conditioned_semantic_mixture_stage0_full_training")
assert.equal(cpu.trainerPreModelControlFlowContract.nestedFormalContractCheckCount, 8)
assert.equal(cpu.trainerPreModelControlFlowContract.nestedFormalContractsValidatedAfterDispatch, true)

fs.mkdirSync(output, { recursive: true })
const files = {
  cpu: path.join(output, "cpu-contract-report.json"), report: path.join(output, "correction-report.json"),
  attestation: path.join(output, "implementation-attestation.json"), terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "owner-action-request.json"), capsule: path.join(output, "local-task-capsule.json"),
}
const now = new Date().toISOString(), shanghai = formatShanghai(now)
writeJsonAtomic(files.cpu, { ...cpu, authorization: bind(authorizationPath), consumption: bind(consumptionPath), recordedAtUtc: now, recordedAtAsiaShanghai: shanghai })
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-visible-structure-phase0-nested-mode-validator-context-correction-report-v1",
  status: "stage4_object_visible_structure_phase0_one_shot_dispatch_and_nested_formal_validator_context_corrected_cpu_verified",
  authorization: bind(authorizationPath), consumption: bind(consumptionPath),
  boundFailure: { gpuAuthorization: authorization.bindings.gpuAuthorization, gpuConsumption: authorization.bindings.gpuConsumption, failureFinalizationReport: authorization.bindings.failureFinalizationReport, stepTelemetry: authorization.bindings.stepTelemetry },
  correction: { dedicatedPhase0DispatchResolutionCount: 1, nestedValidatorModeId: "fact_conditioned_semantic_mixture_stage0_full_training", nestedFormalContractCheckCount: 8, dedicatedExecutionGrantPreserved: true, runnerFrozen: true, trainerFrozen: true, sharedLibraryFrozen: true, sourceConfigImmutable: true },
  codeIdentity: { runner: bind(runner), pythonEntry: bind(pythonEntry), cpuChecker: bind(checker), sharedLibrary: bind(library), trainer: bind(trainer), recorder: bind(recorder) },
  cpuContractReport: bind(files.cpu),
  executionBoundary: { gpuUsed: false, cudaInitialized: false, autogradExecuted: false, checkpointReadOrLoaded: false, modelLoaded: false, datasetMaterialized: false, optimizerCreated: false, backwardExecuted: false, weightsModified: false, trainingStarted: false, validationStarted: false, smokeStarted: false },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-object-visible-structure-phase0-nested-mode-validator-context-implementation-attestation-v1",
  status: "stage4_object_visible_structure_phase0_fresh_gpu_command_identity_implemented_cpu_verified",
  implementationAuthorizationSha256: AUTH_SHA, implementationConsumptionSha256: sha(consumptionPath), implementationReport: bind(files.report),
  runnerSha256: sha(runner), pythonEntrySha256: sha(pythonEntry), cpuCheckerSha256: sha(checker), sharedLibrarySha256: sha(library), trainerSha256: sha(trainer),
  oneShotDispatchModeVerified: true, nestedFormalValidatorsVerified: true, gpuExecutedNow: false, cudaInitializedNow: false, checkpointReadNow: false, modelLoadedNow: false, datasetMaterializedNow: false, trainingStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-phase0-nested-mode-validator-context-correction-terminal-v1",
  status: "stage4_object_visible_structure_phase0_nested_mode_validator_context_correction_succeeded_closed",
  correctionReport: bind(files.report), implementationAttestation: bind(files.attestation), cpuContractReport: bind(files.cpu),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, nextLegalAction: "owner_create_new_bound_single_gpu_phase0_execution_authorization_or_exit",
  gpuUsedNow: false, cudaInitializedNow: false, checkpointReadNow: false, modelLoadedNow: false, datasetMaterializedNow: false, trainingStartedNow: false, smokeStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})

const old = failedGpuAuthorization.bindings
const bindings = {
  implementationAuthorization: bind(authorizationPath), implementationConsumption: bind(consumptionPath), implementationReport: bind(files.report), implementationAttestation: bind(files.attestation), implementationTerminal: bind(files.terminal),
  phase0DesignReport: old.phase0DesignReport, inactivePhase0ExecutionContract: old.inactivePhase0ExecutionContract,
  phase0Runner: bind(runner), phase0PythonEntry: bind(pythonEntry), phase0CpuChecker: bind(checker), phase0SharedLibrary: bind(library),
  sourceConfig: authorization.bindings.sourceConfig, inactiveConfigFragment: old.inactiveConfigFragment, datasetManifest: old.datasetManifest, datasetSourceIndex: old.datasetSourceIndex,
  projectAutoencoderCheckpoint: old.projectAutoencoderCheckpoint, model: old.model, trainer: bind(trainer), readonlyGpuTerminal: old.readonlyGpuTerminal, readonlyGpuFinalizationReport: old.readonlyGpuFinalizationReport,
}
const proposedAuthorization = buildGpuAuthorizationFixture(bindings)
proposedAuthorization.requestId = GPU_REQUEST_ID
proposedAuthorization.commandRef = GPU_REQUEST_ID
proposedAuthorization.execution = { consumptionPath: `.runtime/ai-painter/owner-action-requests/${GPU_REQUEST_ID}/consumption.json`, outputDirectory: `.runtime/ai-painter/stage4-object-visible-structure-phase0-executions/${GPU_EXECUTION_ID}`, runId: `${GPU_EXECUTION_ID}-phase0`, maximumExecutions: 1, consumeBeforeFirstEvidenceWrite: true }
validateGpuAuthorizationDocument(proposedAuthorization)
assert.equal(fs.existsSync(file(proposedAuthorization.execution.consumptionPath)), false)
assert.equal(fs.existsSync(file(proposedAuthorization.execution.outputDirectory)), false)
writeJsonAtomic(files.owner, { schemaVersion: "ai-painter-owner-action-request-preview-v1", status: "not_authorized_not_consumed", requestedAction: "owner_create_new_bound_single_gpu_phase0_execution_authorization_or_exit", requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${GPU_REQUEST_ID}/authorization.json`, proposedAuthorization, boundCorrectionReport: bind(files.report), boundImplementationAttestation: bind(files.attestation), boundTerminal: bind(files.terminal), gpuExecutedNow: false, automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Phase0 one-shot dispatch and eight nested formal validators CPU-verified; GPU inactive", candidateTerminal: bind(files.terminal), latestBlocker: "new_immutable_owner_single_gpu_phase0_execution_authorization_not_created_or_consumed", nextLegalAction: "owner_create_new_bound_single_gpu_phase0_execution_authorization_or_exit", forbiddenActions: authorization.forbiddenActions, evidence: { correctionReport: bind(files.report), implementationAttestation: bind(files.attestation), cpuContractReport: bind(files.cpu), ownerActionRequest: bind(files.owner) }, gpuUsedNow: false, cudaInitializedNow: false, modelLoadedNow: false, trainingStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai })
for (const candidate of [authorizationPath, consumptionPath, runner, pythonEntry, checker, library, trainer, recorder, ...Object.values(files)]) { const stat = fs.statSync(candidate); indexArtifact({ logicalPath: logicalProjectPath(candidate), physicalUri: fs.realpathSync(candidate), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(candidate) }) }
appendAiPainterProgramEvent({ id: `stage4-object-visible-structure-phase0-nested-mode-correction-${REQUEST_ID}`, timestamp: now, action: "stage4_object_visible_structure_phase0_nested_mode_validator_context_correction", runId: REQUEST_ID, kind: "cpu_only_contract_correction", status: "success", title: "Phase0 one-shot dispatch and nested validator context corrected", titleZh: "Phase0 单次主分派与嵌套校验上下文修正完成", detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}；8 个嵌套正式合同通过，未启动 GPU、CUDA、模型或训练。`, evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(files.terminal).status, cpuContractReport: bind(files.cpu), correctionReport: bind(files.report), implementationAttestation: bind(files.attestation), terminal: bind(files.terminal), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
