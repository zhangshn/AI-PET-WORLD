import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-lineage-status-correction-20260815-055500000"
const AUTHORIZATION_SHA256 = "d4c902329347a6226af1f878a7b0de056d5f35257f9f1666e2b37586bde09e04"
const AUTH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization.json`
const CONSUMPTION = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/consumption.json`
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-lineage-status-corrections/20260815-055500000"
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
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-visible-structure-phase0-lineage-status-correction-v1")
assert.equal(authorization.status, "owner_authorized_unconsumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, "one_cpu_only_phase0_python_attestation_status_lineage_correction_and_full_preconsumption_regression")
assert.equal(consumption.status, "stage4_object_visible_structure_phase0_lineage_status_correction_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTHORIZATION_SHA256)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.oneTimeConsumption, true)
const authorizedMutable = {
  phase0PythonEntry: "945e2581fb8ac36ae1e8cf51dbe8fdf5e057383b4afb4773331b1cb1c3bc2721",
  phase0CpuChecker: "6b68fe99524b0e685c1414731de1d0d4d5c5a1a9894fa8d1e26c07245de5a369",
}
for (const [name, binding] of Object.entries(authorization.bindings)) {
  if (name in authorizedMutable) assert.equal(binding.sha256, authorizedMutable[name], `${name}_authorized_source_identity_changed`)
  else assert.equal(sha(projectFile(binding.path)), binding.sha256, `${name}_binding_changed`)
}
for (const key of ["gpuAuthorized", "cudaInitializationAuthorized", "autogradAuthorized", "checkpointReadOrLoadAuthorized", "modelLoadAuthorized", "optimizerAuthorized", "backwardAuthorized", "weightModificationAuthorized", "trainingAuthorized", "validationAuthorized", "smokeAuthorized", "automaticRetryAuthorized", "stage1OrStage2Authorized"]) assert.equal(consumption[key], false, `${key}_must_be_false`)

const output = projectFile(OUTPUT)
assert.equal(fs.existsSync(output), false, "lineage_status_correction_output_exists")
const runner = projectFile("scripts/run-stage4-object-visible-structure-phase0.mjs")
const pythonEntry = projectFile("ml/ai-painter/scripts/run_stage4_object_visible_structure_phase0.py")
const checker = projectFile("scripts/check-stage4-object-visible-structure-phase0-execution-entry.mjs")
const library = projectFile("scripts/lib/ai-painter-stage4-object-visible-structure-phase0-execution.mjs")
const recorder = projectFile("scripts/record-stage4-object-visible-structure-phase0-lineage-status-correction.mjs")
const trainer = projectFile(authorization.bindings.trainer.path)
assert.equal(sha(runner), authorization.bindings.phase0Runner.sha256, "runner_must_remain_frozen")
assert.equal(sha(library), authorization.bindings.phase0SharedLibrary.sha256, "shared_library_must_remain_frozen")
for (const file of [checker, recorder]) {
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
  "--lineage-identity", authorization.bindings.executionIdentity.path,
], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTORCH_NVML_BASED_CUDA_CHECK: "1" }, windowsHide: true, timeout: 900000 })
assert.equal(cpuRun.status, 0, `cpu_contract_failed:${cpuRun.stderr}`)
const cpu = JSON.parse(cpuRun.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
assert.equal(cpu.lineageContract.cudaInitialized, false)

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
writeJsonAtomic(files.cpu, { ...cpu, authorization: bind(authorizationPath), consumption: bind(consumptionPath), recordedAtUtc: now, recordedAtAsiaShanghai: shanghai })
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-visible-structure-phase0-lineage-status-correction-report-v1",
  status: "stage4_object_visible_structure_phase0_lineage_status_corrected_cpu_verified",
  authorization: bind(authorizationPath), consumption: bind(consumptionPath),
  boundFailure: { failureReport: authorization.bindings.failureReport, failureTerminal: authorization.bindings.failureTerminal, failureFinalizationReport: authorization.bindings.failureFinalizationReport, updateStderr: authorization.bindings.updateStderr },
  correction: { oldExpectedStatus: "stage4_object_visible_structure_phase0_execution_entry_implemented_cpu_verified", currentExpectedStatus: "stage4_object_visible_structure_phase0_derived_diagnostic_registry_corrected_cpu_verified", pythonEntryOnly: true },
  codeIdentity: { runner: bind(runner), pythonEntry: bind(pythonEntry), cpuChecker: bind(checker), sharedLibrary: bind(library), recorder: bind(recorder), trainer: bind(trainer) },
  cpuContractReport: bind(files.cpu),
  freshGpuCommandIdentityReadiness: { readyNow: false, reason: "runner_shared_library_and_python_entry_still_bind_retired_consumed_gpu_request_id_20260815_054500000", separateCpuImplementationAuthorizationRequired: true },
  executionBoundary: { gpuUsed: false, cudaInitialized: false, autogradExecuted: false, checkpointReadOrLoaded: false, modelLoaded: false, optimizerCreated: false, backwardExecuted: false, weightsModified: false, trainingStarted: false, validationStarted: false, smokeStarted: false },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-object-visible-structure-phase0-lineage-status-correction-attestation-v1",
  status: "stage4_object_visible_structure_phase0_lineage_status_corrected_cpu_verified",
  correctionAuthorizationSha256: AUTHORIZATION_SHA256, correctionConsumptionSha256: sha(consumptionPath), correctionReport: bind(files.report),
  runnerSha256: sha(runner), pythonEntrySha256: sha(pythonEntry), cpuCheckerSha256: sha(checker), sharedLibrarySha256: sha(library), trainerSha256: sha(trainer),
  gpuExecutedNow: false, cudaInitializedNow: false, checkpointReadNow: false, modelLoadedNow: false, trainingStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-phase0-lineage-status-correction-terminal-v1",
  status: "stage4_object_visible_structure_phase0_lineage_status_correction_succeeded_closed",
  correctionReport: bind(files.report), implementationAttestation: bind(files.attestation), cpuContractReport: bind(files.cpu),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_authorize_cpu_only_fresh_gpu_command_identity_parameterization_or_exit",
  gpuUsedNow: false, cudaInitializedNow: false, checkpointReadNow: false, modelLoadedNow: false, trainingStartedNow: false, smokeStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})

const nextId = "owner-authorized-stage4-object-visible-structure-phase0-fresh-gpu-command-identity-implementation-20260815-061000000"
const proposedAuthorization = {
  schemaVersion: "ai-painter-owner-stage4-object-visible-structure-phase0-fresh-gpu-command-identity-implementation-v1",
  status: "owner_authorized_unconsumed", requestId: nextId, commandRef: nextId,
  scope: "one_cpu_only_parameterization_of_fresh_phase0_gpu_command_identity_and_full_proposed_authorization_composition_regression",
  bindings: {
    lineageCorrectionAuthorization: bind(authorizationPath), lineageCorrectionConsumption: bind(consumptionPath), lineageCorrectionReport: bind(files.report), lineageCorrectionAttestation: bind(files.attestation), lineageCorrectionTerminal: bind(files.terminal),
    failedGpuAuthorization: authorization.bindings.gpuAuthorization, failedGpuConsumption: authorization.bindings.gpuConsumption, failedGpuTerminal: authorization.bindings.failureTerminal,
    phase0Runner: bind(runner), phase0PythonEntry: bind(pythonEntry), phase0CpuChecker: bind(checker), phase0SharedLibrary: bind(library), sourceConfig: authorization.bindings.sourceConfig, trainer: bind(trainer),
  },
  permittedActions: [
    "parameterize_fresh_phase0_gpu_request_id_run_id_consumption_path_and_output_namespace_across_runner_shared_library_and_python_entry",
    "reject_retired_consumed_gpu_request_identity_and_require_new_unique_command_identity",
    "modify_only_phase0_runner_shared_library_python_entry_cpu_checker_and_bounded_recorder",
    "execute_node_python_syntax_cpu_positive_negative_and_full_proposed_authorization_composition_regression_with_cuda_hidden",
    "write_implementation_report_terminal_capsule_and_new_inactive_gpu_phase0_owner_request",
    "synchronize_event_ledger_and_sqlite_index",
  ],
  forbiddenActions: authorization.forbiddenActions,
  execution: { consumptionPath: `.runtime/ai-painter/owner-action-requests/${nextId}/consumption.json`, outputDirectory: ".runtime/ai-painter/stage4-object-visible-structure-phase0-fresh-gpu-command-identity-implementations/20260815-061000000", consumeBeforeFirstWrite: true },
  failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true, noGpuEscalation: true },
}
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1", status: "not_authorized_not_consumed",
  requestedAction: "owner_authorize_cpu_only_fresh_gpu_command_identity_parameterization_or_exit",
  requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${nextId}/authorization.json`, proposedAuthorization,
  boundCorrectionReport: bind(files.report), boundCorrectionAttestation: bind(files.attestation), boundTerminal: bind(files.terminal), gpuRequestedNow: false, automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Phase0 Python attestation-status lineage corrected CPU-verified; fresh GPU command identity implementation remains inactive",
  candidateTerminal: bind(files.terminal), latestBlocker: "fresh_phase0_gpu_command_identity_parameterization_requires_new_owner_authorization",
  nextLegalAction: "owner_authorize_cpu_only_fresh_gpu_command_identity_parameterization_or_exit", forbiddenActions: authorization.forbiddenActions,
  evidence: { correctionReport: bind(files.report), implementationAttestation: bind(files.attestation), cpuContractReport: bind(files.cpu), ownerActionRequest: bind(files.owner) },
  gpuUsedNow: false, cudaInitializedNow: false, checkpointReadNow: false, modelLoadedNow: false, trainingStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
for (const file of [authorizationPath, consumptionPath, runner, pythonEntry, checker, library, recorder, trainer, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({ id: `stage4-object-visible-structure-phase0-lineage-status-correction-${REQUEST_ID}`, timestamp: now, action: "stage4_object_visible_structure_phase0_lineage_status_correction", runId: REQUEST_ID, kind: "cpu_only_contract_correction", status: "success", title: "Phase0 attestation-status lineage corrected", titleZh: "Phase0 实施证明状态血缘修正完成", detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}；未启动 GPU、CUDA、模型或训练。`, evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(files.terminal).status, cpuContractReport: bind(files.cpu), correctionReport: bind(files.report), implementationAttestation: bind(files.attestation), terminal: bind(files.terminal), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
