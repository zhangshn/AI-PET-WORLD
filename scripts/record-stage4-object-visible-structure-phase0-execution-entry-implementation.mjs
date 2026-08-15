import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  FIXED_TASK_IDENTITY,
  GPU_ACTIONS,
  GPU_REQUEST_ID,
  GPU_SCOPE,
  IMPLEMENTATION_AUTHORIZATION_SHA256,
  IMPLEMENTATION_CONSUMPTION_SHA256,
  buildGpuAuthorizationFixture,
  validateImplementationSource,
} from "./lib/ai-painter-stage4-object-visible-structure-phase0-execution.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-execution-entry-implementation-20260815-043000000"
const AUTH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization.json`
const CONSUMPTION = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/consumption.json`
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-execution-entry-implementations/20260815-043000000"
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.ok(value); assert.equal(path.isAbsolute(value), false); const result = path.resolve(ROOT, value); assert.ok(result.startsWith(`${ROOT}${path.sep}`)); return result }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

assert.equal(arg("--authorization"), AUTH)
assert.equal(arg("--consumption"), CONSUMPTION)
const authorizationPath = projectFile(AUTH)
const consumptionPath = projectFile(CONSUMPTION)
assert.equal(sha(authorizationPath), IMPLEMENTATION_AUTHORIZATION_SHA256)
assert.equal(sha(consumptionPath), IMPLEMENTATION_CONSUMPTION_SHA256)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
for (const [name, binding] of Object.entries(authorization.bindings)) assert.equal(sha(projectFile(binding.path)), binding.sha256, `${name}_binding_changed`)
const designReportPath = projectFile(authorization.bindings.phase0DesignReport.path)
const inactiveDesignContractPath = projectFile(authorization.bindings.inactivePhase0ExecutionContract.path)
const designTerminalPath = projectFile(authorization.bindings.phase0DesignTerminal.path)
const designReport = read(designReportPath)
validateImplementationSource({ authorization, consumption, designReport, inactiveContract: read(inactiveDesignContractPath), designTerminal: read(designTerminalPath) })
const output = projectFile(OUTPUT)
assert.equal(fs.existsSync(output), false, "implementation_output_exists")

const runner = path.join(ROOT, "scripts", "run-stage4-object-visible-structure-phase0.mjs")
const pythonEntry = path.join(ROOT, "ml", "ai-painter", "scripts", "run_stage4_object_visible_structure_phase0.py")
const checker = path.join(ROOT, "scripts", "check-stage4-object-visible-structure-phase0-execution-entry.mjs")
const library = path.join(ROOT, "scripts", "lib", "ai-painter-stage4-object-visible-structure-phase0-execution.mjs")
const recorder = path.join(ROOT, "scripts", "record-stage4-object-visible-structure-phase0-execution-entry-implementation.mjs")
const trainer = path.join(ROOT, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py")
for (const file of [runner, checker, library, recorder]) { const result = spawnSync(process.execPath, ["--check", file], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" } }); assert.equal(result.status, 0, `syntax_failed:${relative(file)}:${result.stderr}`) }
const pythonSyntax = spawnSync(path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe"), ["-c", `import ast,pathlib;ast.parse(pathlib.Path(r'${pythonEntry.replaceAll("\\", "\\\\")}').read_text(encoding='utf-8'))`], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" }, windowsHide: true })
assert.equal(pythonSyntax.status, 0, `python_syntax_failed:${pythonSyntax.stderr}`)
const cpuRun = spawnSync(process.execPath, [checker, "--authorization", AUTH, "--consumption", CONSUMPTION], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" } })
assert.equal(cpuRun.status, 0, `cpu_checker_failed:${cpuRun.stderr}`)
const cpu = JSON.parse(cpuRun.stdout)
const entryRun = spawnSync(process.execPath, [runner, "--implementation-contract-only", "--implementation-authorization", AUTH, "--implementation-consumption", CONSUMPTION], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" } })
assert.equal(entryRun.status, 0, `entry_contract_failed:${entryRun.stderr}`)
const entry = JSON.parse(entryRun.stdout)
assert.equal(entry.gpuStarted, false)
assert.equal(entry.pythonEntry.trainerImported, false)
assert.equal(entry.pythonEntry.torchImported, false)

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
const shanghai = formatShanghai(now)
writeJsonAtomic(files.cpu, { ...cpu, actualEntryContract: entry, authorization: bind(authorizationPath), consumption: bind(consumptionPath), recordedAtUtc: now, recordedAtAsiaShanghai: shanghai })
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-visible-structure-phase0-execution-entry-implementation-report-v1",
  status: "stage4_object_visible_structure_phase0_execution_entry_implemented_cpu_verified",
  authorization: bind(authorizationPath), consumption: bind(consumptionPath), designReport: bind(designReportPath), inactiveDesignContract: bind(inactiveDesignContractPath), designTerminal: bind(designTerminalPath),
  codeIdentity: { runner: bind(runner), pythonEntry: bind(pythonEntry), checker: bind(checker), library: bind(library), recorder: bind(recorder), trainer: bind(trainer) },
  cpuContractReport: bind(files.cpu),
  implementedSequence: ["cpu_contract_and_binding_preflight", "explicit_gpu_activation_flag", "cuda_resource_preflight", "atomic_gpu_authorization_consumption", "derived_phase0_config_write", "single_optimizer_step", "nonpromotable_diagnostic_checkpoint", "fresh_process_reproduction_a", "fresh_process_reproduction_b", "byte_identity_comparison", "success_or_failure_terminal_and_index"],
  currentExecution: { gpuUsed: false, cudaInitialized: false, autogradExecuted: false, checkpointReadOrWritten: false, modelLoaded: false, optimizerCreated: false, backwardExecuted: false, weightModified: false, trainingStarted: false, validationStarted: false, smokeStarted: false },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-object-visible-structure-phase0-execution-entry-implementation-attestation-v1",
  status: "stage4_object_visible_structure_phase0_execution_entry_implemented_cpu_verified",
  implementationAuthorizationSha256: IMPLEMENTATION_AUTHORIZATION_SHA256,
  implementationConsumptionSha256: IMPLEMENTATION_CONSUMPTION_SHA256,
  implementationReport: bind(files.report),
  runnerSha256: sha(runner), pythonEntrySha256: sha(pythonEntry), cpuCheckerSha256: sha(checker), sharedLibrarySha256: sha(library), trainerSha256: sha(trainer),
  gpuExecutedNow: false, checkpointReadNow: false, modelLoadedNow: false, trainingStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-object-visible-structure-phase0-gpu-execution-inactive-contract-v1",
  status: "inactive_owner_gpu_authorization_required",
  implementationReport: bind(files.report), implementationAttestation: bind(files.attestation), fixedTaskIdentity: FIXED_TASK_IDENTITY, executionActions: GPU_ACTIONS,
  activation: { activeNow: false, gpuAuthorizedNow: false, phase0ExecutedNow: false, smokeAuthorizedNow: false, formalTrainingAuthorizedNow: false },
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-phase0-execution-entry-implementation-terminal-v1",
  status: "stage4_object_visible_structure_phase0_execution_entry_implementation_succeeded_closed",
  implementationReport: bind(files.report), implementationAttestation: bind(files.attestation), inactiveGpuExecutionContract: bind(files.contract), cpuContractReport: bind(files.cpu),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, nextLegalAction: "owner_create_bound_single_gpu_phase0_execution_authorization_or_exit",
  gpuUsedNow: false, checkpointReadOrWrittenNow: false, modelLoadedNow: false, trainingStartedNow: false, smokeStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})

const sourceGpuAuthorization = read(projectFile(designReport.sourceEvidence.gpuAuthorization.path))
const source = sourceGpuAuthorization.bindings
const gpuBindings = {
  implementationAuthorization: bind(authorizationPath), implementationConsumption: bind(consumptionPath), implementationReport: bind(files.report), implementationAttestation: bind(files.attestation), implementationTerminal: bind(files.terminal),
  phase0DesignReport: bind(designReportPath), inactivePhase0ExecutionContract: bind(inactiveDesignContractPath), phase0Runner: bind(runner), phase0PythonEntry: bind(pythonEntry), phase0CpuChecker: bind(checker), phase0SharedLibrary: bind(library),
  sourceConfig: source.sourceConfig, inactiveConfigFragment: source.inactiveConfigFragment, datasetManifest: source.datasetManifest, datasetSourceIndex: source.datasetSourceIndex, projectAutoencoderCheckpoint: source.projectAutoencoderCheckpoint, model: source.model, trainer: source.trainer,
  readonlyGpuTerminal: designReport.sourceEvidence.gpuTerminal, readonlyGpuFinalizationReport: designReport.sourceEvidence.finalizationReport,
}
const proposedAuthorization = buildGpuAuthorizationFixture(gpuBindings)
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1", status: "not_authorized_not_consumed", requestedAction: "owner_create_bound_single_gpu_phase0_execution_authorization_or_exit",
  requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${GPU_REQUEST_ID}/authorization.json`, proposedAuthorization,
  boundImplementationReport: bind(files.report), boundImplementationAttestation: bind(files.attestation), boundTerminal: bind(files.terminal), gpuExecutedNow: false, automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Four-object visible-structure Phase0 execution entry implemented CPU-verified; GPU execution inactive",
  candidateTerminal: bind(files.terminal), latestBlocker: "immutable_owner_single_gpu_phase0_execution_authorization_not_created_or_consumed", nextLegalAction: "owner_create_bound_single_gpu_phase0_execution_authorization_or_exit",
  forbiddenActions: authorization.forbiddenActions, evidence: { implementationReport: bind(files.report), implementationAttestation: bind(files.attestation), inactiveGpuExecutionContract: bind(files.contract), cpuContractReport: bind(files.cpu), ownerActionRequest: bind(files.owner) },
  gpuUsedNow: false, checkpointReadOrWrittenNow: false, trainingStartedNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})

const indexed = [authorizationPath, consumptionPath, designReportPath, inactiveDesignContractPath, designTerminalPath, runner, pythonEntry, checker, library, recorder, trainer, ...Object.values(files)]
for (const file of indexed) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }
appendAiPainterProgramEvent({ id: `stage4-object-visible-structure-phase0-entry-implementation-${REQUEST_ID}`, timestamp: now, action: "stage4_object_visible_structure_phase0_execution_entry_implementation", runId: REQUEST_ID, kind: "cpu_only_implementation", status: "success", title: "Four-object visible-structure Phase0 execution entry implemented", titleZh: "四对象可见结构Phase0执行入口实施完成", detailZh: `CPU正向${cpu.positivePassed}/${cpu.positiveTotal}、反向${cpu.negativePassed}/${cpu.negativeTotal}；本次未启动GPU、未读取Checkpoint、未加载模型或训练。`, evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(files.terminal).status, cpuContractReport: bind(files.cpu), implementationReport: bind(files.report), implementationAttestation: bind(files.attestation), terminal: bind(files.terminal), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
