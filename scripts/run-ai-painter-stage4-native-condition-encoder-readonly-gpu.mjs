import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4-native-condition-encoder-clean-latent-change-candidate-v1"
const TASK = "run_native_condition_encoder_readonly_gpu_qualification"
const NEXT_TASK = "compile_native_condition_encoder_controlled_smoke_contract"
const RUN_ID = process.argv[2] ?? `stage4-native-condition-encoder-gpu-${compactUtc()}-01`
const AE = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
const SOURCE_INDEX = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"
assert.match(RUN_ID, /^[a-z0-9][a-z0-9-]{7,127}$/)

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registry.capabilityVersion, CAPABILITY)
assert.equal(current.registry.taskId, TASK)
assert.equal(current.registry.lifecycleStage, "cpu_contract_verified")
assert.equal(current.registry.activeExecution, null)
const cpuTerminal = existing(current.registry.terminalEvidence.path)
assert.equal(sha(cpuTerminal), current.registry.terminalEvidence.sha256)
const cpu = read(cpuTerminal)
const inactiveConfig = existing(cpu.inactiveConfig.path)
const cpuReport = existing(cpu.cpuReport.path)
const support = existing(cpu.supportContract.path)

const root = inside(`.runtime/ai-painter/stage4-native-condition-encoder-readonly-gpu/${RUN_ID}`)
assert.equal(fs.existsSync(root), false, "readonly GPU package already exists")
fs.mkdirSync(path.dirname(root), { recursive: true })
fs.mkdirSync(root, { recursive: false })
const files = {
  ticket: path.join(root, "internal-ticket.json"),
  cpuEntry: path.join(root, "cpu-entry-report.json"),
  preflight: path.join(root, "preflight-report.json"),
  consumption: path.join(root, "internal-ticket-consumption.json"),
  diagnostic: path.join(root, "diagnostic-output"),
  terminal: path.join(root, "phase-terminal.json"),
  capsule: path.join(root, "local-task-capsule.json"),
}
try {
  const python = existing("ml/ai-painter/.venv/Scripts/python.exe")
  const runner = existing("ml/ai-painter/scripts/run_stage4_native_condition_encoder_readonly_gpu_qualification.py")
  const checker = existing("ml/ai-painter/scripts/check_stage4_native_condition_encoder_cpu.py")
  const trainer = existing("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
  const model = existing("ml/ai-painter/src/ai_painter/complete_world/model.py")
  const modeRegistry = existing("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")
  const sourceIndex = existing(SOURCE_INDEX)
  const autoencoder = existing(AE)
  assert.equal(sha(sourceIndex), "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251")
  assert.equal(sha(autoencoder), "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba")
  const checked = runPython(python, [checker])
  assert.equal(checked.status, "stage4_native_condition_encoder_cpu_support_passed")
  assert.deepEqual(checked.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  writeJsonAtomic(files.cpuEntry, { ...checked, status: "passed", trainer: bind(trainer), checker: bind(checker), recordedAtUtc: new Date().toISOString() })
  writeJsonAtomic(files.ticket, {
    schemaVersion: "ai-painter-local-internal-readonly-gpu-ticket-v1",
    status: "issued_not_consumed",
    authority: "local_ai_pet_world_program",
    capabilityVersion: CAPABILITY,
    taskId: TASK,
    runId: RUN_ID,
    oneTimeConsumption: true,
    gpuUse: true,
    permissions: { projectAutoencoderCheckpointRead: true, denoiserCheckpointRead: false, optimizerCreation: false, backwardExecution: false, weightMutation: false, checkpointWrite: false, smoke: false, training: false },
    executionIdentity: { seed: 20263722, imageSize: { width: 256, height: 192 }, sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6", split: "validation", conditionChannels: 23, latentChannels: 12 },
    bindings: { inactiveConfig: bind(inactiveConfig), cpuTerminal: bind(cpuTerminal), cpuReport: bind(cpuReport), modelSupportContract: bind(support), cpuEntryReport: bind(files.cpuEntry), trainer: bind(trainer), modelFactory: bind(model), modeRegistry: bind(modeRegistry), sourceIndex: bind(sourceIndex), projectAutoencoderCheckpoint: bind(autoencoder) },
    parentRegistry: { revision: current.registry.registryRevision, sha256: current.registrySha256 },
    ownerAuthorizationRequired: false,
    issuedAtUtc: new Date().toISOString(),
  })
  const args = [runner, "--ticket", relative(files.ticket), "--ticket-sha256", sha(files.ticket), "--consumption", relative(files.consumption), "--output-dir", relative(files.diagnostic)]
  const preflight = runPython(python, [...args, "--preflight-only"])
  assert.equal(preflight.status, "passed_not_consumed")
  writeJsonAtomic(files.preflight, preflight)
  const result = runPython(python, args)
  assert.equal(result.status, "native_condition_encoder_readonly_gpu_qualification_succeeded")
  const gpuReport = existing(`${relative(files.diagnostic)}/gpu-report.json`)
  const gradients = existing(`${relative(files.diagnostic)}/gradient-evidence.json`)
  const states = existing(`${relative(files.diagnostic)}/model-state-hashes.json`)
  const cuda = existing(`${relative(files.diagnostic)}/cuda-telemetry.json`)
  const diagnosticTerminal = existing(`${relative(files.diagnostic)}/phase-terminal.json`)
  const recordedAtUtc = new Date().toISOString()
  const lifecycle = advanceCapabilityLifecycle({ root: ROOT, capabilityVersion: CAPABILITY, targetState: "readonly_gpu_qualified", evidence: { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion: CAPABILITY, targetState: "readonly_gpu_qualified", status: "passed", bindings: [files.cpuEntry, gpuReport, gradients, states, cuda, diagnosticTerminal].map(bind) }, recordedAtUtc })
  const lifecycleState = existing(`.runtime/ai-painter/capability-lifecycle/${CAPABILITY}/state.json`)
  writeJsonAtomic(files.terminal, {
    schemaVersion: "stage4-native-condition-encoder-readonly-gpu-package-terminal-v1",
    executionState: "completed",
    status: result.status,
    runId: RUN_ID,
    capabilityVersion: CAPABILITY,
    internalTicket: bind(files.ticket),
    consumption: bind(files.consumption),
    cpuEntryReport: bind(files.cpuEntry),
    preflightReport: bind(files.preflight),
    gpuReport: bind(gpuReport),
    gradientEvidence: bind(gradients),
    modelStateHashes: bind(states),
    cudaTelemetry: bind(cuda),
    lifecycleState: bind(lifecycleState),
    nextAction: NEXT_TASK,
    fixedTotalProgress: progress(),
    ownerAuthorizationRequired: false,
    optimizerCreated: false,
    backwardExecuted: false,
    modelWeightsModified: false,
    checkpointWritten: false,
    trainingStarted: false,
    recordedAtUtc,
  })
  writeJsonAtomic(files.capsule, capsule(recordedAtUtc, [files.terminal, files.ticket, files.consumption, files.cpuEntry, files.preflight, gpuReport, gradients, states, cuda]))
  const registry = await advanceCurrentExecutionRegistry({ projectRoot: ROOT, capabilityVersion: CAPABILITY, packageId: RUN_ID, taskId: NEXT_TASK, taskKind: "contract_compilation", runId: RUN_ID, lifecycleStage: lifecycle.state, executionState: "completed", activity: "planned_not_started", taskCapsulePath: relative(files.capsule), terminalEvidencePath: relative(files.terminal) })
  assert.equal(registry.ok, true, registry.errorCode)
  appendAiPainterProgramEvent({ id: `stage4-native-condition-encoder-gpu-${RUN_ID}`, timestamp: recordedAtUtc, action: "stage4_native_condition_encoder_readonly_gpu_qualified", runId: RUN_ID, kind: "local_autonomous_readonly_gpu_qualification", status: "success", title: "Native-condition encoder readonly GPU qualification passed", titleZh: "Stage4原生分辨率条件编码只读GPU资格通过", detailZh: "真实validation样本194、CUDA原生分辨率条件到达、全部正式参数梯度及状态不变通过；未训练。", evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: progress() })
  process.stdout.write(`${JSON.stringify({ status: result.status, runId: RUN_ID, terminal: bind(files.terminal), gpuReport: bind(gpuReport), cudaTelemetry: bind(cuda), lifecycleState: lifecycle.state, currentRegistrySha256: registry.registrySha256, nextAction: NEXT_TASK, fixedTotalProgress: progress(), ownerAuthorizationRequired: false }, null, 2)}\n`)
} catch (error) {
  const failure = path.join(root, "failure-terminal.json")
  if (!fs.existsSync(failure)) writeJsonAtomic(failure, { schemaVersion: "stage4-native-condition-encoder-readonly-gpu-failure-v1", executionState: "failed_closed", status: "native_condition_encoder_readonly_gpu_qualification_failed", runId: RUN_ID, error: String(error?.message ?? error), ticketConsumed: fs.existsSync(files.consumption), trainingStarted: false, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() })
  throw error
}

function capsule(recordedAtUtc, evidenceFiles) { return { schemaVersion: "ai-painter-local-task-capsule-v1", capsuleId: `local-ai-${RUN_ID}`, generatedFrom: "program_saved_evidence", readOnly: true, module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" }, fixedOverallProgress: { ...progress(), source: "current_execution_registry" }, currentStage: { number: 4, total: 5, labelZh: "Stage4原生条件编码只读GPU资格", status: "readonly_gpu_qualified" }, candidateTerminal: { runId: RUN_ID, status: "completed", programStatus: "native_condition_encoder_readonly_gpu_qualification_succeeded", previewMachineStatus: "not_run_readonly_gpu_only", modelQualificationStatus: "readonly_gpu_qualified", checkpointWritten: false, modelWeightsModified: false, recordedAtUtc }, latestBlocker: { code: "controlled_smoke_contract_not_compiled", summaryZh: "只读GPU资格通过，受控Smoke合同尚未编译。" }, nextAllowedAction: { code: NEXT_TASK, labelZh: "编译原生条件编码30 Epoch受控Smoke合同", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true }, forbiddenActions: ["read_historical_denoiser_checkpoint", "start_training_before_smoke_contract", "reuse_old_smoke", "change_loss_or_threshold"], taskIdentity: { modelId: "stage4_native_condition_encoder_clean_latent_generator_v1", sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6", sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] }, evidence: evidenceFiles.map((file) => ({ kind: path.basename(file), labelZh: path.basename(file), ...bind(file), expectedSha256: sha(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })), integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" }, ownerAuthorizationRequired: false, recordedAtUtc } }
function runPython(python, args) { const value = execFileSync(python, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }); const start = value.indexOf("{"); assert.ok(start >= 0, "Python JSON output missing"); return JSON.parse(value.slice(start)) }
function existing(value) { const file = inside(value); assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), `file missing: ${value}`); return file }
function inside(value) { assert.ok(value && !path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.split(/[\\/]/).includes("..")); const file = path.resolve(ROOT, value); assert.ok(file.startsWith(`${ROOT}${path.sep}`)); return file }
function relative(file) { return path.relative(ROOT, file).replaceAll("\\", "/") }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(file) { return { path: relative(file), sha256: sha(file) } }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function progress() { return { completedStages: 3, totalStages: 5, percent: 60 } }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }
