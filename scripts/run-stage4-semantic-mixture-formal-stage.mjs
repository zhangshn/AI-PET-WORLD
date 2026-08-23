import crypto from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { evaluateV7TrainingGpuResourceGate } from "./lib/ai-assisted-v7-training-resource-gate.mjs"

const ROOT = process.cwd()
const PYTHON = path.resolve(ROOT, "ml/ai-painter/.venv/Scripts/python.exe")
const TRAINER = path.resolve(ROOT, "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const COMPILER = path.resolve(ROOT, "ml/ai-painter/scripts/compile_stage4_semantic_mixture_full_training_config.py")
const DATASET = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
const DATASET_SHA = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
const AE = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
const AE_SHA = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
const EXPECTED_STAGES = [{ width: 256, height: 192 }, { width: 512, height: 384 }, { width: 1024, height: 768 }]
const EXPECTED_SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }

const args = parseArgs(process.argv.slice(2))
const stage = Number(args.stage)
if (![0, 1, 2].includes(stage)) fail("stage_argument_invalid")
if (!args.authorization || !args.authorizationSha256 || !args.runId) fail("authorization_arguments_missing")
const authorizationPath = resolve(args.authorization)
const authorization = read(authorizationPath)
const SOURCE_CONFIG = authorization?.bindings?.sourceConfig?.path
const SOURCE_CONFIG_SHA = authorization?.bindings?.sourceConfig?.sha256
const IMPLEMENTATION_AUTH = authorization?.bindings?.implementationAuthorization?.path
const IMPLEMENTATION_CONSUMPTION = authorization?.bindings?.implementationConsumption?.path
const QUALIFICATION = authorization?.bindings?.terminalQualification?.path
const QUALIFICATION_SHA = authorization?.bindings?.terminalQualification?.sha256
const runRoot = resolve(`.runtime/ai-painter/stage4-semantic-mixture-formal-training/${args.runId}`)
const outputDir = path.join(runRoot, "training-output")
const finalizationDir = path.join(runRoot, "finalization")
const consumptionPath = path.join(path.dirname(authorizationPath), "execution-consumption.json")
const configPath = path.join(runRoot, "active-config.json")
const preflightPath = path.join(runRoot, "preflight-report.json")
const resourceTelemetryPath = path.join(runRoot, "resource-telemetry.json")
const lockPath = resolve(".runtime/ai-painter/stage4-semantic-mixture-formal-training/.formal-stage.lock")
const parentTerminalPath = args.parentTerminal ? resolve(args.parentTerminal) : null
let child = null
let releaseLock = null
let resourceTelemetry = null

const preflight = validatePreflight()
if (preflight.blockers.length) {
  console.error(JSON.stringify(preflight, null, 2)); process.exit(1)
}
if (args.preflightOnly) {
  console.log(JSON.stringify(preflight, null, 2)); process.exit(0)
}

try {
  const consumption = consumeAuthorization()
  fs.mkdirSync(runRoot, { recursive: true })
  writeJsonAtomic(preflightPath, preflight)
  compileActiveConfig(consumption)
  releaseLock = acquireLock()
  event("formal_stage_started", "running", `Stage ${stage}正式训练开始`, `40 Epoch; ${EXPECTED_STAGES[stage].width}x${EXPECTED_STAGES[stage].height}`, project(configPath))
  const trainerArgs = [TRAINER, "--config", configPath, "--dataset-package", resolve(DATASET), "--autoencoder-checkpoint", resolve(AE), "--output-dir", outputDir, "--resolution-stage", String(stage)]
  if (stage > 0) trainerArgs.push("--initial-denoiser-checkpoint", resolve(args.parentCheckpoint))
  const result = await runLongProcess(trainerArgs)
  if (result.exitCode !== 0) throw new Error(`trainer_exit_${result.exitCode}:${result.stderr.slice(-2000)}`)
  const manifestPath = path.join(outputDir, "manifest.json")
  const manifest = read(manifestPath)
  const manifestIssues = validateManifest(manifest)
  if (manifestIssues.length) throw new Error(manifestIssues.join(","))
  const review = await reviewPreviews(manifest)
  if (review.previewFailCount > 0 || review.previewPassCount !== 6) throw new Error(`stage_${stage}_visual_review_failed_${review.previewPassCount}_of_6`)
  const terminal = finalize("semantic_mixture_stage4_formal_stage_completed_closed", [], manifest, review)
  event("formal_stage_completed", "success", `Stage ${stage}正式训练通过`, `checkpoint=${manifest.checkpointSha256}; previews=6/6`, terminal.path)
  console.log(JSON.stringify(terminal, null, 2))
} catch (error) {
  const terminal = finalize("semantic_mixture_stage4_formal_stage_failed_closed", [String(error?.message ?? error)], fs.existsSync(path.join(outputDir, "manifest.json")) ? read(path.join(outputDir, "manifest.json")) : null, fs.existsSync(path.join(outputDir, "fixed-preview-reviews.json")) ? read(path.join(outputDir, "fixed-preview-reviews.json")) : null)
  event("formal_stage_failed", "failed", `Stage ${stage}正式训练失败关闭`, terminal.blockers.join("; "), terminal.path)
  console.error(JSON.stringify(terminal, null, 2)); process.exitCode = 1
} finally {
  releaseLock?.()
}

function validatePreflight() {
  const blockers = []
  const expect = (value, code) => { if (!value) blockers.push(code) }
  expect(!fs.existsSync(runRoot), "run_id_already_exists")
  expect(!fs.existsSync(consumptionPath), "authorization_already_consumed")
  expect(hash(authorizationPath) === args.authorizationSha256, "authorization_hash_invalid")
  expect(authorization?.status === "resolved_owner_authorized_not_consumed", "authorization_status_invalid")
  expect(authorization?.requestId === authorization?.commandRef, "authorization_command_identity_invalid")
  expect(authorization?.scope === `one_stage4_semantic_mixture_stage${stage}_full_training_only`, "authorization_scope_invalid")
  expect(JSON.stringify(authorization?.executionActions) === JSON.stringify(expectedActions(stage)), "authorization_actions_invalid")
  expect(fileHash(DATASET, DATASET_SHA), "dataset_identity_invalid")
  expect(Boolean(SOURCE_CONFIG && SOURCE_CONFIG_SHA), "source_config_binding_missing")
  expect(fileHash(SOURCE_CONFIG, SOURCE_CONFIG_SHA), "source_config_identity_invalid")
  const sourceConfig = read(SOURCE_CONFIG)
  const controlledArm = authorization?.controlledStructureArm
  if (controlledArm) {
    expect(["condition_fusion_only_final_direct_residual_23_64_12", "capacity_only_base_width_64_to_existing_level1_128"].includes(controlledArm), "controlled_structure_adjudicated_arm_invalid")
    expect(sourceConfig?.stage4ControlledStructureArm === controlledArm, "controlled_structure_source_arm_invalid")
    expect(sourceConfig?.training?.stage4ControlledStructureThreeArm?.armId === controlledArm, "controlled_structure_source_contract_invalid")
    expect(sourceConfig?.training?.stage4ControlledStructureThreeArm?.status === "cpu_support_verified_inactive", "controlled_structure_source_not_inactive")
    expect(Object.values(sourceConfig?.training?.stage4ControlledStructureThreeArm?.activationGate ?? {}).every(value => value === false), "controlled_structure_source_gate_not_closed")
    const crossArmDecisionBinding = authorization?.bindings?.crossArmDecision
    expect(fileHash(crossArmDecisionBinding?.path, crossArmDecisionBinding?.sha256), "cross_arm_decision_identity_invalid")
    expect(read(crossArmDecisionBinding?.path)?.outcome === "condition_fusion_only_priority", "cross_arm_controlled_comparison_identity_invalid")
    if (controlledArm === "capacity_only_base_width_64_to_existing_level1_128") {
      const routeDecisionBinding = authorization?.bindings?.routeDecision
      expect(fileHash(routeDecisionBinding?.path, routeDecisionBinding?.sha256), "capacity_route_decision_identity_invalid")
      const routeDecision = read(routeDecisionBinding?.path)
      expect(routeDecision?.selectedCause === "C" && routeDecision?.status === "condition_fusion_multisample_semantic_capacity_insufficient_confirmed", "capacity_route_decision_invalid")
    }
  }
  expect(fileHash(AE, AE_SHA), "autoencoder_identity_invalid")
  expect(Boolean(QUALIFICATION && QUALIFICATION_SHA), "stage0_qualification_binding_missing")
  const qualification = read(QUALIFICATION)
  const qualificationStatusAccepted = qualification?.status === "terminal_pass_with_late_convergence_evidence_qualified_closed"
    || qualification?.status === "three_consecutive_late_previews_qualified_closed"
  expect(fileHash(QUALIFICATION, QUALIFICATION_SHA) && qualificationStatusAccepted && qualification?.stage0EntryPermitted === true, "stage0_qualification_invalid")
  expect(fileHash(IMPLEMENTATION_AUTH, authorization?.bindings?.implementationAuthorization?.sha256), "implementation_authorization_identity_invalid")
  expect(fileHash(IMPLEMENTATION_CONSUMPTION, authorization?.bindings?.implementationConsumption?.sha256), "implementation_consumption_identity_invalid")
  const implementationAuthorization = read(IMPLEMENTATION_AUTH)
  const implementationConsumption = read(IMPLEMENTATION_CONSUMPTION)
  expect(implementationAuthorization?.status === "resolved_owner_authorized_not_consumed", "implementation_authorization_status_invalid")
  expect(implementationConsumption?.requestId === implementationAuthorization?.requestId, "implementation_consumption_request_id_invalid")
  expect(implementationConsumption?.commandRef === implementationAuthorization?.commandRef, "implementation_consumption_command_ref_invalid")
  expect(implementationConsumption?.scope === implementationAuthorization?.scope, "implementation_consumption_scope_invalid")
  expect(implementationConsumption?.authorizationSha256 === authorization?.bindings?.implementationAuthorization?.sha256, "implementation_consumption_authorization_hash_invalid")
  expect(implementationConsumption?.oneTimeConsumption === true, "implementation_consumption_one_time_invalid")
  const boundCode = authorization?.bindings?.code ?? {}
  expect(fileHash("ml/ai-painter/scripts/ai_painter_authorization_policy.py", boundCode.authorizationPolicy), "authorization_policy_hash_invalid")
  expect(fileHash("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py", boundCode.modeRegistry), "mode_registry_hash_invalid")
  expect(fileHash("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py", boundCode.trainer), "trainer_hash_invalid")
  expect(fileHash("ml/ai-painter/scripts/compile_stage4_semantic_mixture_full_training_config.py", boundCode.compiler), "compiler_hash_invalid")
  expect(fileHash("ml/ai-painter/scripts/check_stage4_semantic_mixture_full_training_modes_cpu.py", boundCode.cpuChecker), "cpu_checker_hash_invalid")
  expect(fileHash("scripts/run-stage4-semantic-mixture-formal-stage.mjs", boundCode.runner), "runner_hash_invalid")
  expect(fs.existsSync(PYTHON) && fs.existsSync(TRAINER) && fs.existsSync(COMPILER), "runtime_missing")
  if (stage === 0) {
    expect(!args.parentCheckpoint && !args.parentTerminal, "stage0_parent_forbidden")
  } else {
    expect(Boolean(args.parentCheckpoint && args.parentCheckpointSha256 && parentTerminalPath && args.parentTerminalSha256), "parent_binding_missing")
    expect(fileHash(args.parentCheckpoint, args.parentCheckpointSha256), "parent_checkpoint_hash_invalid")
    expect(parentTerminalPath && hash(parentTerminalPath) === args.parentTerminalSha256, "parent_terminal_hash_invalid")
    const parent = parentTerminalPath ? read(parentTerminalPath) : null
    expect(parent?.status === "semantic_mixture_stage4_formal_stage_completed_closed" && parent?.stage === stage - 1, "parent_stage_terminal_invalid")
    expect(parent?.checkpoint?.sha256 === args.parentCheckpointSha256, "parent_checkpoint_terminal_mismatch")
  }
  const hardware = hardwareSnapshot()
  blockers.push(...evaluateV7TrainingGpuResourceGate(hardware.gpu))
  const disk = fs.statfsSync(resolve(".runtime"))
  expect(Number(disk.bavail) * Number(disk.bsize) >= 20 * 1024 ** 3, "disk_budget_below_20_gib")
  return { schemaVersion: "stage4-semantic-mixture-formal-stage-preflight-v1", status: blockers.length ? "failed_readonly_preflight_closed" : "passed_readonly_preflight", stage, runId: args.runId, blockers, authorizationConsumed: false, gpuStarted: false, checkpointRead: false, hardware, recordedAtUtc: new Date().toISOString() }
}

function consumeAuthorization() {
  const record = { schemaVersion: "stage4-semantic-mixture-formal-stage-consumption-v1", status: "stage4_formal_stage_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: project(authorizationPath), authorizationSha256: args.authorizationSha256, executionActions: expectedActions(stage), oneTimeConsumption: true, consumedAtUtc: new Date().toISOString() }
  const fd = fs.openSync(consumptionPath, "wx"); fs.writeFileSync(fd, `${JSON.stringify(record, null, 2)}\n`); fs.closeSync(fd)
  return { ...record, path: project(consumptionPath), sha256: hash(consumptionPath) }
}

function compileActiveConfig(consumption) {
  const command = [COMPILER, "--source", resolve(SOURCE_CONFIG), "--stage", String(stage), "--authorization", authorizationPath, "--authorization-sha256", args.authorizationSha256, "--consumption", consumptionPath, "--consumption-sha256", consumption.sha256, "--implementation-authorization", resolve(IMPLEMENTATION_AUTH), "--implementation-authorization-sha256", authorization.bindings.implementationAuthorization.sha256, "--implementation-consumption", resolve(IMPLEMENTATION_CONSUMPTION), "--implementation-consumption-sha256", authorization.bindings.implementationConsumption.sha256, "--output", configPath]
  const result = spawnSync(PYTHON, command, { cwd: ROOT, env: pythonEnv(), encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`active_config_compile_failed:${result.stderr || result.stdout}`)
  const active = read(configPath)
  if (authorization?.controlledStructureArm && (
    active?.stage4ControlledStructureArm !== authorization.controlledStructureArm
    || active?.training?.stage4ControlledStructureThreeArm?.status !== "structure_active_owner_authorized"
    || active?.training?.stage4ControlledStructureThreeArm?.activationGate?.stage4FullTrainingNow !== true
    || active?.training?.stage4ControlledStructureThreeArm?.activationGate?.smokeNow !== false
  )) throw new Error("active_controlled_structure_identity_invalid")
}

function runLongProcess(command) {
  return new Promise((done) => {
    child = spawn(PYTHON, command, { cwd: ROOT, env: pythonEnv(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = "", stderr = ""
    child.stdout.on("data", chunk => { stdout += chunk.toString() })
    child.stderr.on("data", chunk => { stderr += chunk.toString(); process.stderr.write(chunk) })
    const samples = []
    const capture = () => {
      const progress = read(path.join(outputDir, "progress.json"))
      const hardware = hardwareSnapshot()
      const sample = { kind: "training_heartbeat", recordedAtUtc: new Date().toISOString(), epoch: progress?.liveProgress?.epoch ?? progress?.currentEpoch?.epoch ?? null, phase: progress?.liveProgress?.phase ?? progress?.status ?? "starting", gpuMemoryUsedMiB: hardware.gpu.memoryUsedMiB, gpuUtilizationPercent: hardware.gpu.utilizationPercent }
      samples.push(sample)
      console.log(JSON.stringify({ kind: "stage4_formal_training_progress", runId: args.runId, stage, phase: sample.phase, epoch: sample.epoch, epochTarget: 40, gpu: hardware.gpu, recordedAtUtc: sample.recordedAtUtc }))
    }
    capture()
    const timer = setInterval(capture, 20000)
    child.on("close", (exitCode, signal) => {
      clearInterval(timer)
      capture()
      child = null
      resourceTelemetry = {
        schemaVersion: "stage4-formal-training-immutable-resource-telemetry-v1",
        status: "formal_training_resource_telemetry_recorded",
        stage, runId: args.runId, sampleKind: "training_heartbeat",
        sampleCount: samples.length, samples,
        peakGpuMemoryBytes: Math.max(...samples.map(sample => sample.gpuMemoryUsedMiB)) * 1024 * 1024,
        preflightMemoryUsedAsTrainingPeak: false,
        consoleTextUsedAsFormalEvidence: false,
        recordedAtUtc: new Date().toISOString(),
      }
      const fd = fs.openSync(resourceTelemetryPath, "wx")
      try { fs.writeFileSync(fd, `${JSON.stringify(resourceTelemetry, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      done({ exitCode, signal, stdout, stderr })
    })
  })
}

function validateManifest(manifest) {
  const issues = []; const check = (v, c) => { if (!v) issues.push(c) }
  check(manifest?.status === "conditional_denoiser_training_completed_pending_validation", "manifest_status_invalid")
  check(manifest?.denoiserTrained === true && manifest?.formalInferenceEligible === false, "formal_boundary_invalid")
  check(JSON.stringify(manifest?.actualLoadedSplitCounts) === JSON.stringify(EXPECTED_SPLITS), "split_invalid")
  check(manifest?.actualLoadedConditionalSampleCount === 64 && manifest?.actualLoadedV7CapacityCount === 64, "capacity_invalid")
  check(JSON.stringify(manifest?.resolutionStage) === JSON.stringify(EXPECTED_STAGES[stage]), "resolution_invalid")
  check(fileHash(manifest?.checkpointPath, manifest?.checkpointSha256), "checkpoint_hash_invalid")
  check(stage === 0 ? manifest?.parentDenoiserCheckpointSha256 == null : manifest?.parentDenoiserCheckpointSha256 === args.parentCheckpointSha256, "parent_checkpoint_invalid")
  check(manifest?.metrics?.length === 40, "metric_timeline_incomplete")
  for (const epoch of [1, 5, 10, 20, 30, 40]) check(manifest.metrics.some(row => row.epoch === epoch && row.validationPreviewArtifact), `epoch_${epoch}_preview_identity_missing`)
  check(manifest?.modelStateHashEvidence?.weightsChanged === true, "model_weights_not_changed")
  return issues
}

async function reviewPreviews(manifest) {
  const files = fs.readdirSync(path.join(outputDir, "fixed-epoch-previews")).filter(v => v.endsWith(".png")).sort()
  if (files.length !== 6) throw new Error(`fixed_preview_count_${files.length}`)
  const sourceIndex = read(read(DATASET).sourceIndexPath)
  const rows = sourceIndex.samples ?? []
  const reviews = []
  for (const file of files) {
    const preview = path.join(outputDir, "fixed-epoch-previews", file)
    const normalized = path.join(outputDir, "fixed-preview-review-assets", `${path.parse(file).name}-1024x768.png`)
    fs.mkdirSync(path.dirname(normalized), { recursive: true })
    await sharp(preview).removeAlpha().resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).png().toFile(normalized)
    const row = rows.find(item => file.includes(item.conditionLabel))
    if (!row) throw new Error(`preview_condition_identity_missing:${file}`)
    const conditionPack = read(row.conditionPackPath)
    const [aesthetic, alignment] = await Promise.all([auditAiAssistedProfessionalAesthetic(normalized), auditAiAssistedConditionAlignment({ record: { recordId: `${args.runId}-${file}`, conditionBinding: { conditionPackPath: row.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: row.classification }, imagePath: normalized, referenceImagePath: row.imagePath })])
    reviews.push({ epoch: Number(file.match(/epoch-(\d+)/)?.[1]), previewPath: project(preview), previewSha256: hash(preview), normalizedPath: project(normalized), normalizedSha256: hash(normalized), passed: aesthetic.passed && alignment.passed, issueCodes: [...aesthetic.issues, ...alignment.issues].map(v => v.code), professionalAesthetic: aesthetic, conditionAlignment: alignment })
  }
  const report = { schemaVersion: "stage4-semantic-mixture-formal-stage-preview-reviews-v1", status: "machine_reviews_completed", stage, runId: args.runId, reviewThresholdsChanged: false, reviews, previewCount: 6, previewPassCount: reviews.filter(v => v.passed).length, previewFailCount: reviews.filter(v => !v.passed).length, automaticStorage: true, recordedAtUtc: new Date().toISOString() }
  const reviewPath = path.join(outputDir, "fixed-preview-reviews.json"); writeJsonAtomic(reviewPath, report); return { ...report, path: project(reviewPath), sha256: hash(reviewPath) }
}

function finalize(status, blockers, manifest, review) {
  fs.mkdirSync(finalizationDir, { recursive: true })
  const terminalPath = path.join(finalizationDir, "phase-terminal.json")
  const terminal = { schemaVersion: "stage4-semantic-mixture-formal-stage-terminal-v1", status, stage, runId: args.runId, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, blockers, authorization: { path: project(authorizationPath), sha256: args.authorizationSha256, consumptionPath: project(consumptionPath), consumptionSha256: fs.existsSync(consumptionPath) ? hash(consumptionPath) : null }, manifest: manifest ? { path: project(path.join(outputDir, "manifest.json")), sha256: hash(path.join(outputDir, "manifest.json")) } : null, checkpoint: manifest ? { path: manifest.checkpointPath, sha256: manifest.checkpointSha256 } : null, machineReview: review ? { path: review.path ?? project(path.join(outputDir, "fixed-preview-reviews.json")), sha256: review.sha256 ?? hash(path.join(outputDir, "fixed-preview-reviews.json")), passCount: review.previewPassCount, failCount: review.previewFailCount } : null, resourceTelemetry: fs.existsSync(resourceTelemetryPath) ? { path: project(resourceTelemetryPath), sha256: hash(resourceTelemetryPath), sampleCount: resourceTelemetry?.sampleCount ?? null, peakGpuMemoryBytes: resourceTelemetry?.peakGpuMemoryBytes ?? null } : null, nextLegalAction: status.includes("completed") ? (stage < 2 ? `independently_authorized_stage_${stage + 1}_full_training` : "update_stage4_progress_to_4_of_5") : "owner_review_of_new_real_failure", automaticRetry: false, stage5Started: false, formalInferenceStarted: false, checkpointPromoted: false, runtimeFrameStarted: false, worldEntered: false, recordedAtUtc: new Date().toISOString(), recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()) }
  writeJsonAtomic(terminalPath, terminal)
  const capsulePath = path.join(finalizationDir, "local-task-capsule.json")
  writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: terminal.fixedTotalProgress, currentStage: `Stage4 formal Stage ${stage}`, candidateTerminal: { path: project(terminalPath), sha256: hash(terminalPath) }, latestBlocker: blockers[0] ?? null, nextLegalAction: terminal.nextLegalAction, forbiddenActions: ["automatic_retry", "stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"], evidence: { manifest: terminal.manifest, checkpoint: terminal.checkpoint, machineReview: terminal.machineReview }, recordedAtUtc: terminal.recordedAtUtc })
  indexTree(runRoot)
  return { ...terminal, path: project(terminalPath), sha256: hash(terminalPath), capsule: { path: project(capsulePath), sha256: hash(capsulePath) } }
}

function acquireLock() { fs.mkdirSync(path.dirname(lockPath), { recursive: true }); const fd = fs.openSync(lockPath, "wx"); fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, runId: args.runId, stage })); fs.closeSync(fd); return () => { if (fs.existsSync(lockPath) && read(lockPath)?.runId === args.runId) fs.rmSync(lockPath) } }
function expectedActions(value) { return ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", ...(value > 0 ? ["load_parent_denoiser"] : []), "mutate_model_weights", `run_stage${value}`].sort() }
function parseArgs(values) { const out = {}; for (let i = 0; i < values.length; i++) { const key = values[i]; if (key === "--preflight-only") out.preflightOnly = true; else if (key.startsWith("--")) out[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = values[++i] } return out }
function read(value) { try { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) } catch { return null } }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function project(value) { const absolute = resolve(value), runtime = resolve(".runtime"); if (absolute === runtime || absolute.startsWith(`${runtime}${path.sep}`)) return path.join(".runtime", path.relative(runtime, absolute)).replace(/\\/g, "/"); return path.relative(ROOT, absolute).replace(/\\/g, "/") }
function hash(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHash(value, expected) { return Boolean(value && expected && fs.existsSync(resolve(value)) && hash(value) === expected) }
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "ml/ai-painter/src") } }
function hardwareSnapshot() { const r = spawnSync("nvidia-smi", ["--query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true }); const v = r.status === 0 ? r.stdout.trim().split(",").map(x => x.trim()) : []; return { cpu: { model: os.cpus()[0]?.model, logicalProcessors: os.cpus().length }, memory: { totalBytes: os.totalmem(), freeBytes: os.freemem() }, gpu: { available: r.status === 0, name: v[0] ?? null, driverVersion: v[1] ?? null, memoryTotalMiB: Number(v[2] ?? 0), memoryUsedMiB: Number(v[3] ?? 0), utilizationPercent: Number(v[4] ?? 0), temperatureC: Number(v[5] ?? 0), pythonComputeProcessCount: 0, computeProcesses: [] } } }
function indexTree(root) { for (const entry of fs.readdirSync(root, { withFileTypes: true })) { const childPath = path.join(root, entry.name); if (entry.isDirectory()) indexTree(childPath); else { const info = fs.statSync(childPath); indexArtifact({ logicalPath: project(childPath), physicalUri: fs.realpathSync(childPath), storageLayer: "hot", runId: args.runId, byteSize: info.size, modifiedAtUtc: info.mtime.toISOString(), sha256: hash(childPath) }) } } }
function event(kind, status, titleZh, detailZh, evidencePath) { appendAiPainterProgramEvent({ action: "stage4_semantic_mixture_formal_training", runId: args.runId, kind, status, title: titleZh, titleZh, detail: detailZh, detailZh, script: "scripts/run-stage4-semantic-mixture-formal-stage.mjs", currentStep: `stage4_stage_${stage}`, evidencePath, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, finalGameMapSuccess: false, canEnterWorld: false }) }
function fail(message) { console.error(message); process.exit(1) }
