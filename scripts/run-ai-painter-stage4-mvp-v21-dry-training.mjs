// One bounded local V21 dry-world training run. No formal Stage0/Stage4 grant.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFile, execFileSync } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from
  "../src/server/ai-painter-current-execution-registry.mjs"
import { readBound } from "./lib/ai-painter-stage4-mvp-v13-review-lineage.mjs"
import { verifyV17DryScope } from "./lib/ai-painter-stage4-mvp-v17-dry-scope.mjs"
import { createActiveTrainingTelemetryReporter, normalizeActiveTrainingProgress } from
  "./lib/ai-painter-active-training-telemetry-v1.mjs"

const execFileAsync = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CAPABILITY = "stage4_mvp_native_rgb_object_residual_v21_support_trial"
const CANDIDATE = "data/ai-painter/system-governance/stage4-mvp-native-rgb-object-residual-v21-contract-v1.json"
const CPU = ".runtime/ai-painter/stage4-mvp-object-residual-v21-cpu-acceptances/acceptance-001/report.json"
const GPU = ".runtime/ai-painter/stage4-mvp-object-residual-v21-readonly-gpu-qualifications/attempt-a6a264511cde423f222fd5003f24ebd2e59336d9060ae3300f322e67da2d124b/report.json"
const CANDIDATE_SHA = "f018ec0f7b6e9279e7a25d8abc82af8bd975c5768ec2a5c99a80b82f5b3d4c75"
const CPU_SHA = "cd8f014f0918633cfa3e2b7a0478a9b7476627ba1e19152b54e87c76b2219157"
const GPU_SHA = "a57772d878dacc4beb919271ce43d40222893050f3c7260fdb77481ca1918877"
const SUPERVISOR = "scripts/run-ai-painter-stage4-mvp-v21-dry-training.mjs"
const WORKER = "ml/ai-painter/scripts/train_stage4_mvp_object_residual_v21_dry_stage0.py"
const WORKER_TESTS = "ml/ai-painter/tests/test_stage4_mvp_object_residual_v21_worker_gate.py"
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const OUTPUT = ".runtime/ai-painter/stage4-mvp-object-residual-v21-dry-executions"
const STAGE = { stage: 0, width: 256, height: 192, epochCount: 24 }
const BUDGET = { maxGpuMemoryFraction: 0.7, maxEpochs: 24,
  maxGeneratorSteps: 1152, maxDiscriminatorSteps: 1152,
  timeoutSeconds: 43200, cpuThreads: 2, automaticRetries: 0 }
const OPTIMIZER = { name: "AdamW", generatorLearningRate: 0.0001,
  discriminatorLearningRate: 0.0001, weightDecay: 0.01,
  betas: [0.9, 0.999], eps: 1e-8 }

const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
const same = (a, b) => assert.deepEqual(a, b)

function inside(root, logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !logical.includes("\\"))
  assert.ok(!logical.split("/").some(part => !part || part === "." || part === ".."
    || part === "latest" || part === "latest.json"))
  const absolute = path.resolve(root, logical)
  assert.ok(absolute.startsWith(`${root}${path.sep}`), "path escaped project")
  return absolute
}

function bind(root, logical) {
  const target = inside(root, logical)
  assert.equal(fs.statSync(target).isFile(), true)
  return { path: logical, sha256: sha(fs.readFileSync(target)) }
}

function boundJson(root, binding) {
  return JSON.parse(readBound(root, binding).toString("utf8"))
}

function writeExclusive(root, logical, value) {
  const target = inside(root, logical)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const fd = fs.openSync(target, "wx")
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, "utf8")
    fs.fsyncSync(fd)
  } finally { fs.closeSync(fd) }
  return bind(root, logical)
}

export function recordPreparationFailure({ root, outputRoot, claim, runId, packageId,
  ticket = null, packageBinding = null, error },
{ write = writeExclusive, exists = fs.existsSync } = {}) {
  const evidence = { schemaVersion: "ai-painter-stage4-mvp-v21-dry-prepare-failure-v1",
    status: "failed_closed", phase: "prepare", capabilityVersion: CAPABILITY,
    runId, packageId, claim, outputRoot, trainingExecutionTicket: ticket,
    executionPackage: packageBinding, registryWritten: false,
    trainingStarted: false, automaticRetryStarted: false,
    error: String(error.stack ?? error), recordedAtUtc: new Date().toISOString() }
  const fallback = `${OUTPUT}/single-training-attempt-prepare-failure.json`
  const localFailure = exists(inside(root, outputRoot))
    ? `${outputRoot}/prepare-failure.json` : fallback
  try { return write(root, localFailure, evidence) }
  catch (writeError) {
    if (localFailure === fallback) throw writeError
    return write(root, fallback,
      { ...evidence, primaryEvidenceWriteError: String(writeError.stack ?? writeError) })
  }
}

function processIdentity(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0)
  const command = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if($null -eq $p){exit 3}; [string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o')`
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8", windowsHide: true, timeout: 10_000,
  }).trim()
}

function heartbeat(root, outputRoot, runId) {
  const target = inside(root, `${outputRoot}/heartbeat.json`)
  const value = JSON.parse(fs.readFileSync(target, "utf8"))
  assert.equal(value.runId, runId)
  assert.equal(value.processId, process.pid)
  value.heartbeatAtUtc = new Date().toISOString()
  const staged = `${target}.staged-${process.pid}`
  fs.writeFileSync(staged, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" })
  fs.renameSync(staged, target)
}

function verifyBoundFiles(root, value) {
  if (Array.isArray(value)) {
    for (const item of value) verifyBoundFiles(root, item)
    return
  }
  if (value && typeof value === "object") {
    if ("path" in value || "sha256" in value) {
      assert.equal(Object.keys(value).length, 2, "non-exact binding")
      assert.equal(typeof value.path, "string")
      assert.match(value.sha256, /^[a-f0-9]{64}$/)
      readBound(root, value)
      return
    }
    for (const item of Object.values(value)) verifyBoundFiles(root, item)
  }
}

export function trustedTelemetryFromProgress(progress, { runId, packageId, lastStep = 0 }) {
  if (progress === null) return null
  assert.ok(progress && Object.getPrototypeOf(progress) === Object.prototype,
    "v21_progress_not_plain_object")
  assert.equal(progress.runId, runId, "v21_progress_run_mismatch")
  assert.equal(progress.packageId, packageId, "v21_progress_package_mismatch")
  if (progress.phase !== "training") return null
  assert.ok(Number.isSafeInteger(progress.epoch) && progress.epoch >= 1
    && progress.epoch <= 24, "v21_progress_epoch_invalid")
  assert.equal(progress.batchCount, 48, "v21_progress_batch_count_invalid")
  assert.ok(Number.isSafeInteger(progress.batchIndex) && progress.batchIndex >= 1
    && progress.batchIndex <= 48, "v21_progress_batch_index_invalid")
  const step = (progress.epoch - 1) * 48 + progress.batchIndex
  assert.equal(progress.optimizationStep, step, "v21_progress_step_invalid")
  assert.equal(progress.optimizerStepsGenerator, step, "v21_progress_generator_step_invalid")
  assert.equal(progress.optimizerStepsDiscriminator, step,
    "v21_progress_discriminator_step_invalid")
  assert.ok(step >= lastStep, "v21_progress_step_regressed")
  // A slow next step may exceed the console heartbeat window. Re-report the
  // last verified worker record with its unchanged step and measurements.
  assert.ok(typeof progress.rawGeneratorLoss === "number"
    && Number.isFinite(progress.rawGeneratorLoss), "v21_progress_raw_loss_invalid")
  assert.equal(progress.loss,
    progress.rawGeneratorLoss >= 0 ? progress.rawGeneratorLoss : null,
  "v21_progress_display_loss_not_truthful")
  assert.equal(progress.learningRate, OPTIMIZER.generatorLearningRate,
    "v21_progress_learning_rate_invalid")
  const normalized = normalizeActiveTrainingProgress({
    epoch: progress.epoch, batchIndex: progress.batchIndex,
    batchCount: progress.batchCount, optimizationStep: step,
    loss: progress.loss, learningRate: progress.learningRate,
    throughputSamplesPerSecond: progress.throughputSamplesPerSecond,
    estimatedCompletionAtUtc: progress.estimatedCompletionAtUtc,
    checkpointIdentity: progress.checkpointIdentity,
  })
  return normalized
}

export async function drainTelemetryBeforeTerminal(task, timeoutMs = 15_000) {
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0,
    "v21_telemetry_drain_limit_invalid")
  let timer
  try {
    return await Promise.race([
      Promise.resolve(task).then(() => ({ drained: true }),
        error => ({ drained: true, error: String(error.stack ?? error) })),
      new Promise(resolve => { timer = setTimeout(() => resolve({ drained: false }), timeoutMs) }),
    ])
  } finally { clearTimeout(timer) }
}

export async function preflight({ projectRoot = ROOT } = {}) {
  const root = fs.realpathSync(projectRoot)
  const candidateBinding = bind(root, CANDIDATE)
  const cpuBinding = bind(root, CPU)
  const gpuBinding = bind(root, GPU)
  same(candidateBinding, { path: CANDIDATE, sha256: CANDIDATE_SHA })
  same(cpuBinding, { path: CPU, sha256: CPU_SHA })
  same(gpuBinding, { path: GPU, sha256: GPU_SHA })
  const candidate = boundJson(root, candidateBinding)
  const cpu = boundJson(root, cpuBinding)
  const gpu = boundJson(root, gpuBinding)
  assert.equal(candidate.schemaVersion,
    "stage4-mvp-native-rgb-object-residual-v21-contract-v1")
  assert.equal(candidate.capabilityVersion, CAPABILITY)
  assert.equal(candidate.status, "cpu_candidate_not_execution_qualified")
  same(candidate.cpuAcceptance, null)
  same(candidate.modelPlan, { baseChannels: 48, patchChannels: 32, seed: 20260929 })
  assert.equal(candidate.foundationAssetBinding.initializationSeed, 20260929)
  assert.equal(candidate.foundationAssetBinding.parentCheckpointLoaded, false)
  assert.equal(candidate.foundationAssetBinding.checkpointLoaded, false)
  same(cpu.candidateContractAtAcceptance, candidateBinding)
  same(candidate.boundedTrainingPlan.sourceSplitCounts,
    { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(candidate.boundedTrainingPlan.stage.maxEpochs, 24)
  assert.equal(candidate.boundedTrainingPlan.resourceBound.maxGeneratorSteps, 1152)
  assert.equal(candidate.boundedTrainingPlan.resourceBound.maxDiscriminatorSteps, 1152)
  assert.equal(candidate.boundedTrainingPlan.resourceBound.maxTrainingAttempts, 1)
  assert.equal(candidate.boundedTrainingPlan.resourceBound.automaticRetries, 0)
  same(candidate.boundedTrainingPlan.checkpointSelection, {
    eligibleEpochFirst: 8, eligibleEpochLast: 24, validationSamples: 8,
    firstCriterion: "maximum_worst_applicable_object_class_correlation",
    secondCriterion: "minimum_mean_existing_validation_objective",
    thirdCriterion: "earliest_epoch", reviewThresholdsChanged: false,
  })
  assert.equal(candidate.activationGates.trainingAllowed, false)
  assert.equal(candidate.activationGates.formalStage0QualificationAllowed, false)
  assert.equal(candidate.activationGates.runtimePublicationAllowed, false)
  assert.equal(candidate.foundationAssetBinding.autoencoderLoadedByThisRenderer, false)
  assert.equal(candidate.foundationAssetBinding.failedCheckpointLoaded, false)
  verifyBoundFiles(root, candidate.datasetBinding)
  verifyBoundFiles(root, candidate.programBindings)
  verifyBoundFiles(root, candidate.lossContract)
  verifyBoundFiles(root, candidate.reviewThresholdContract)
  verifyBoundFiles(root, candidate.foundationAssetBinding)
  const scope = verifyV17DryScope({ projectRoot: root,
    scopeBinding: candidate.dryScope })
  assert.equal(scope.status, "v17_dry_scope_facts_verified_not_execution_qualified")
  assert.equal(cpu.status, "cpu_readonly_accepted_execution_disabled")
  assert.equal(cpu.capabilityVersion, CAPABILITY)
  assert.equal(cpu.cpuTestsPassed, true)
  assert.equal(cpu.trainingAllowed, false)
  assert.equal(cpu.optimizerSteps, 0)
  assert.equal(cpu.gpuInitialized, false)
  assert.equal(cpu.initialModelStateSha256, cpu.finalModelStateSha256)
  assert.equal(cpu.initialCriticStateSha256, cpu.finalCriticStateSha256)
  assert.equal(cpu.checkpointLoaded, false)
  assert.equal(cpu.checkpointWritten, false)
  assert.equal(gpu.status, "readonly_gpu_qualification_passed_training_still_disabled")
  assert.equal(gpu.capabilityVersion, CAPABILITY)
  same(gpu.candidateContract, candidateBinding)
  same(gpu.cpuAcceptance, cpuBinding)
  assert.equal(gpu.implementationIdentitySha256, cpu.implementationIdentitySha256)
  assert.equal(gpu.gpuInitialized, true)
  assert.equal(gpu.generatorBackwardCalls, 1)
  assert.equal(gpu.discriminatorBackwardCalls, 1)
  assert.equal(gpu.checkpointLoaded, false)
  assert.equal(gpu.initialModelStateSha256, cpu.initialModelStateSha256)
  assert.equal(gpu.finalModelStateSha256, gpu.initialModelStateSha256)
  assert.equal(gpu.initialCriticStateSha256, cpu.initialCriticStateSha256)
  assert.equal(gpu.finalCriticStateSha256, gpu.initialCriticStateSha256)
  assert.equal(gpu.optimizerCreated, false)
  assert.equal(gpu.optimizerSteps, 0)
  assert.equal(gpu.weightsModified, false)
  assert.equal(gpu.trainingAllowedByThisArtifact, false)
  assert.equal(gpu.stage4QualificationGranted, false)
  assert.equal(gpu.checkpointWritten, false)
  assert.equal(gpu.validationRgbOrChannelPixelsRead, false)
  assert.equal(gpu.challengeContentRead, false)
  assert.equal(gpu.regressionContentRead, false)
  assert.deepEqual(Object.keys(gpu.responsibilityGradients).sort(),
    ["terrain_path_ground", "terrain_water", "terrain_shoreline",
      "object_footprints", "object_tree", "object_rock", "object_vegetation"].sort())
  for (const item of Object.values(gpu.responsibilityGradients))
    assert.ok(item.maskedGradientAbsoluteSum > 0)
  for (const role of ["object_footprints", "object_tree", "object_rock", "object_vegetation"]) {
    assert.ok(gpu.objectHeadGradientAbsoluteSums?.[role] > 0)
    same(gpu.objectSupport?.[role], cpu.objectSupport?.[role])
  }
  same(gpu.reviewApplicability, cpu.reviewApplicability)
  assert.ok(gpu.elapsedSeconds > 0 && gpu.elapsedSeconds <= 120)
  assert.ok(gpu.memoryMeasurements?.length >= 4)
  for (const item of gpu.memoryMeasurements)
    assert.ok(item.peakReservedBytes <= item.limitBytes
      && item.peakAllocatedBytes <= item.limitBytes
      && item.sampledDeviceUsedBytes <= item.limitBytes)
  const release = boundJson(root, candidate.datasetBinding.manifest)
  assert.equal(release.sampleCount, 64)
  same(release.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(release.qualification?.dataQualifiedForTraining, true)
  const programs = { worker: bind(root, WORKER), workerTests: bind(root, WORKER_TESTS),
    supervisor: bind(root, SUPERVISOR) }
  const registry = await readCurrentExecutionRegistry(root)
  assert.equal(registry.ok, true, registry.errorCode ?? "current registry invalid")
  assert.equal(registry.registry.activeExecution, null, "another run is active")
  return { root, candidateBinding, cpuBinding, gpuBinding, candidate, cpu, gpu,
    scope, release, programs, registryRevision: registry.registry.registryRevision,
    registrySha256: registry.registrySha256 }
}

async function advance(root, { runId, packageId, outputRoot, evidence,
  programs, active, status, state, nextAction = null, latestTrainingTerminal = null }) {
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  if (active) assert.equal(current.registry.activeExecution, null)
  else if (current.registry.activeExecution)
    assert.equal(current.registry.activeExecution.runId, runId)
  let activeExecution = null
  if (active) {
    const identity = { capabilityVersion: CAPABILITY, packageId, runId,
      processId: process.pid, processStartIdentity: processIdentity(process.pid) }
    const lock = writeExclusive(root, `${outputRoot}/execution-lock.json`, {
      schemaVersion: "ai-painter-current-active-execution-lock-v1", ...identity,
    })
    writeExclusive(root, `${outputRoot}/heartbeat.json`, {
      schemaVersion: "ai-painter-current-active-execution-heartbeat-v1", ...identity,
      executionState: "executing", heartbeatAtUtc: new Date().toISOString(), ttlSeconds: 120,
    })
    activeExecution = {
      schemaVersion: "ai-painter-current-active-execution-v1", ...identity,
      executionState: "executing", programLineage: programs,
      lock, heartbeat: { path: `${outputRoot}/heartbeat.json`, ttlSeconds: 120 },
    }
  }
  const capsule = writeExclusive(root, `${outputRoot}/${active ? "begin" :
    state === "completed" ? "training-complete" : "training-failed"}-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v1", taskId: runId,
    integrity: { status: "verified" },
    evidence: [{ ...evidence, kind: "dry_single_world_bounded_training",
      sha256Verified: true }],
  })
  const result = await advanceCurrentExecutionRegistry({
    projectRoot: root, capabilityVersion: CAPABILITY, packageId, taskId: runId,
    taskKind: "dry_single_world_bounded_training",
    taskGoal: "Train one bounded V21 256x192 dry natural-world slice without formal Stage0 credit.",
    priority: 5, queueStatus: active ? "running" : state,
    nextMachineAction: active ? null : nextAction,
    queuedAtUtc: new Date().toISOString(), runId,
    lifecycleStage: "dry_single_world_256x192", executionState: state,
    activity: status, taskCapsulePath: capsule.path,
    terminalEvidencePath: evidence.path, activeExecution,
    ...(latestTrainingTerminal ? { latestTrainingTerminal } : {}),
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  assert.equal(result.ok, true, "V21 current registry advance failed")
}

async function runWorker(root, packageBinding, outputRoot, signal = undefined,
  preflightOnly = false) {
  const { stdout, stderr } = await execFileAsync(inside(root, PYTHON), [
    "-B", inside(root, WORKER), "--execution-package", packageBinding.path,
    "--execution-package-sha256", packageBinding.sha256,
    "--output", `${outputRoot}/phase-terminal.json`,
    ...(preflightOnly ? ["--preflight"] : []),
  ], {
    cwd: root, windowsHide: true, timeout: (preflightOnly ? 120 : BUDGET.timeoutSeconds) * 1000,
    signal, maxBuffer: 4 * 1024 * 1024, encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1",
      PYTHONDONTWRITEBYTECODE: "1", OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2",
      PYTHONPATH: path.join(root, "ml/ai-painter/src") },
  })
  if (preflightOnly) return JSON.parse(stdout)
  writeExclusive(root, `${outputRoot}/worker-stdout.json`, {
    stdout, stderr, recordedAtUtc: new Date().toISOString(),
  })
}

export async function run({ projectRoot = ROOT, execute = false } = {}) {
  const ready = await preflight({ projectRoot })
  if (!execute) return { status: "cpu_preflight_passed_training_not_started",
    registryRevision: ready.registryRevision, trainingStarted: false }
  const { root, candidateBinding, cpuBinding, gpuBinding, candidate,
    programs } = ready
  const before = await readCurrentExecutionRegistry(root)
  assert.equal(before.ok, true)
  assert.equal(before.registry.registryRevision, ready.registryRevision)
  assert.equal(before.registrySha256, ready.registrySha256)
  assert.equal(before.registry.activeExecution, null)
  const identity = { capabilityVersion: CAPABILITY, candidateContract: candidateBinding,
    cpuQualification: cpuBinding, gpuQualification: gpuBinding,
    stage: STAGE, resourceBudget: BUDGET, optimizerPlan: OPTIMIZER, programs }
  const digest = sha(Buffer.from(JSON.stringify(identity)))
  const runId = `mvp-v21-dry-stage0-${digest.slice(0, 48)}`
  const batchRunId = `mvp-v21-dry-batch-${digest.slice(0, 40)}`
  const packageId = `mvp-v21-dry-package-${digest.slice(0, 40)}`
  const outputRoot = `${OUTPUT}/${batchRunId}/stages/${runId}`
  const common = {
    batchRunId, runId, packageId, capabilityVersion: CAPABILITY,
    candidateContract: candidateBinding, cpuQualification: cpuBinding,
    gpuQualification: gpuBinding, datasetManifest: candidate.datasetBinding.manifest,
    dryScope: candidate.dryScope, modelPlan: candidate.modelPlan,
    precisionExecutionPlan: candidate.precisionExecutionPlan,
    stage: STAGE, resourceBudget: BUDGET, optimizerPlan: OPTIMIZER,
    programBindings: programs, ticketConsumptionRequired: true,
    permittedSplits: ["train", "validation"], forbiddenSplits: ["challenge", "regression"],
    outputRoot, outputTerminalPath: `${outputRoot}/phase-terminal.json`,
    formalStage0QualificationAllowed: false, runtimePublicationAllowed: false,
  }
  // A fixed capability claim prevents a second attempt even after a failed
  // preparation. Pure identity construction above cannot consume the claim.
  const claim = writeExclusive(root, `${OUTPUT}/single-training-attempt-claim.json`, {
    schemaVersion: "ai-painter-stage4-mvp-v21-single-training-attempt-claim-v1",
    capabilityVersion: CAPABILITY, candidateContract: candidateBinding,
    cpuQualification: cpuBinding, gpuQualification: gpuBinding,
    claimedAtUtc: new Date().toISOString(), automaticRetries: 0,
  })
  let ticket
  let packageBinding
  try {
    fs.mkdirSync(path.dirname(inside(root, outputRoot)), { recursive: true })
    fs.mkdirSync(inside(root, outputRoot))
    ticket = writeExclusive(root, `${outputRoot}/training-ticket.json`, {
      schemaVersion: "ai-painter-stage4-mvp-object-residual-v21-training-execution-ticket-v1",
      status: "issued_single_use", ticketId: `v21-dry-ticket-${digest.slice(0, 40)}`,
      ...common, registryBeforeStart: { registryRevision: ready.registryRevision,
        registrySha256: ready.registrySha256, activeExecution: null },
    })
    packageBinding = writeExclusive(root, `${outputRoot}/execution-package.json`, {
      schemaVersion: "ai-painter-stage4-mvp-object-residual-v21-dry-stage0-execution-package-v1",
      ...common, trainingExecutionTicket: ticket,
    })
  } catch (error) {
    const failure = recordPreparationFailure({ root, outputRoot, claim, runId,
      packageId, ticket: ticket ?? null, packageBinding: packageBinding ?? null, error })
    return { status: "failed_closed", runId, failure,
      error: String(error.message ?? error), trainingStarted: false }
  }
  let timer = null
  let telemetryTimer = null
  let telemetryTask = Promise.resolve()
  let telemetryLastStep = 0
  let telemetryStorageFailed = false
  let telemetryClosed = false
  const telemetryReporter = createActiveTrainingTelemetryReporter({
    projectRoot: root, runId, packageId,
  })
  const abort = new AbortController()
  const pollTelemetry = async () => {
    if (telemetryClosed) return
    const target = inside(root, `${outputRoot}/progress.json`)
    if (!fs.existsSync(target)) return // Worker has not emitted its first progress record.
    const progress = JSON.parse(fs.readFileSync(target, "utf8"))
    const normalized = trustedTelemetryFromProgress(progress,
      { runId, packageId, lastStep: telemetryLastStep })
    if (normalized === null) return
    telemetryLastStep = normalized.optimizationStep
    if (telemetryStorageFailed || telemetryClosed) return
    try { await telemetryReporter(normalized) }
    catch (error) {
      telemetryStorageFailed = true
      writeExclusive(root, `${outputRoot}/telemetry-store-failure.json`, {
        status: "telemetry_projection_failed_training_state_unaffected",
        runId, packageId, optimizationStep: telemetryLastStep,
        error: String(error.stack ?? error), recordedAtUtc: new Date().toISOString(),
      })
    }
  }
  try {
    const workerPreflight = await runWorker(root, packageBinding, outputRoot,
      undefined, true)
    assert.equal(workerPreflight.status, "cpu_preflight_passed_training_not_started")
    assert.equal(workerPreflight.registryRevision, ready.registryRevision)
    assert.equal(workerPreflight.trainSampleCount, 48)
    assert.equal(workerPreflight.validationSampleCount, 8)
    assert.equal(workerPreflight.trainingStarted, false)
    assert.equal(workerPreflight.sampleTensorsDecoded, false)
    writeExclusive(root, `${outputRoot}/worker-preflight.json`, workerPreflight)
    const dispatch = writeExclusive(root, `${outputRoot}/training-dispatched.json`, {
      schemaVersion: "ai-painter-stage4-mvp-v21-dry-training-lifecycle-v1",
      status: "bounded_dry_training_dispatched", executionState: "completed",
      runId, packageId, capabilityVersion: CAPABILITY,
      executionPackage: packageBinding, trainingExecutionTicket: ticket,
      trainingStarted: false, formalStage0QualificationGranted: false,
      recordedAtUtc: new Date().toISOString(),
    })
    await advance(root, { runId, packageId, outputRoot, evidence: dispatch,
      programs, active: true, status: "bounded_dry_training_dispatched", state: "executing" })
    timer = setInterval(() => {
      try { heartbeat(root, outputRoot, runId) }
      catch (error) { abort.abort(error) }
    }, 10_000)
    telemetryTimer = setInterval(() => {
      if (abort.signal.aborted) return
      telemetryTask = telemetryTask.then(pollTelemetry)
        .catch(error => abort.abort(error))
    }, 10_000)
    await runWorker(root, packageBinding, outputRoot, abort.signal)
    telemetryClosed = true
    if (telemetryTimer) clearInterval(telemetryTimer)
    telemetryTimer = null
    const telemetryDrain = await drainTelemetryBeforeTerminal(telemetryTask)
    assert.equal(telemetryDrain.drained, true,
      "V21 telemetry did not drain before success terminal")
    assert.equal(telemetryDrain.error, undefined,
      "V21 telemetry task rejected before success terminal")
    assert.equal(abort.signal.aborted, false, "V21 supervisor heartbeat or progress trust failed")
    const workerBinding = bind(root, `${outputRoot}/phase-terminal.json`)
    const worker = boundJson(root, workerBinding)
    assert.equal(worker.runId, runId)
    assert.equal(worker.packageId, packageId)
    assert.equal(worker.status, "training_completed_review_pending")
    assert.equal(worker.optimizerStepsGenerator, BUDGET.maxGeneratorSteps)
    assert.equal(worker.optimizerStepsDiscriminator, BUDGET.maxDiscriminatorSteps)
    assert.equal(worker.checkpointReloadVerified, true)
    readBound(root, worker.checkpoint)
    clearInterval(timer)
    timer = null
    const final = writeExclusive(root, `${outputRoot}/training-finalize.json`, {
      schemaVersion: "ai-painter-stage4-mvp-v21-dry-training-lifecycle-v1",
      status: "training_completed_review_pending", executionState: "completed",
      runId, packageId, capabilityVersion: CAPABILITY,
      executionPackage: packageBinding, workerTerminal: workerBinding,
      checkpoint: worker.checkpoint, trainingStarted: true,
      formalStage0QualificationGranted: false, runtimePublicationGranted: false,
      recordedAtUtc: new Date().toISOString(),
    })
    await advance(root, { runId, packageId, outputRoot, evidence: final,
      programs, active: false, status: "training_completed_review_pending",
      state: "completed", nextAction: "v21_dry_materialization_adapter_required",
      latestTrainingTerminal: { runId, path: final.path,
        sha256: final.sha256, status: "training_completed_review_pending", evidence: {} } })
    return { status: "training_completed_review_pending", runId,
      workerTerminal: workerBinding, checkpoint: worker.checkpoint }
  } catch (error) {
    if (timer) clearInterval(timer)
    if (telemetryTimer) clearInterval(telemetryTimer)
    telemetryClosed = true
    const telemetryDrain = await drainTelemetryBeforeTerminal(telemetryTask)
    if (!telemetryDrain.drained) {
      const pending = writeExclusive(root, `${outputRoot}/telemetry-drain-timeout.json`, {
        status: "failed_closed_registry_finalization_deferred",
        runId, packageId, executionPackage: packageBinding,
        trainingStateError: String(error.stack ?? error),
        telemetryLastStep, telemetryDrainLimitMs: 15_000,
        registryFinalized: false, automaticRetryStarted: false,
        recordedAtUtc: new Date().toISOString(),
      })
      return { status: "failed_closed", runId, failure: pending,
        registryFinalizationDeferred: true,
        error: "telemetry drain timed out; active registry requires recovery" }
    }
    let workerTerminal = null
    let workerTerminalBinding = null
    let lastProgress = null
    try {
      if (fs.existsSync(inside(root, `${outputRoot}/phase-terminal.json`))) {
        workerTerminalBinding = bind(root, `${outputRoot}/phase-terminal.json`)
        workerTerminal = boundJson(root, workerTerminalBinding)
        assert.equal(workerTerminal.runId, runId)
        assert.equal(workerTerminal.packageId, packageId)
      }
      if (fs.existsSync(inside(root, `${outputRoot}/progress.json`)))
        lastProgress = JSON.parse(fs.readFileSync(inside(root,
          `${outputRoot}/progress.json`), "utf8"))
    } catch (evidenceError) {
      workerTerminalBinding = null
      workerTerminal = null
      lastProgress = { evidenceReadError: String(evidenceError.stack ?? evidenceError) }
    }
    const generatorSteps = workerTerminal?.optimizerStepsGenerator
      ?? lastProgress?.optimizerStepsGenerator ?? null
    const discriminatorSteps = workerTerminal?.optimizerStepsDiscriminator
      ?? lastProgress?.optimizerStepsDiscriminator ?? null
    const failure = writeExclusive(root, `${outputRoot}/failure.json`, {
      schemaVersion: "ai-painter-stage4-mvp-v21-dry-training-failure-v1",
      status: "failed_closed", executionState: "failed_closed",
      runId, packageId, capabilityVersion: CAPABILITY,
      executionPackage: packageBinding, error: String(error.stack ?? error),
      workerTerminal: workerTerminalBinding, lastProgress,
      optimizerStepsGenerator: generatorSteps,
      optimizerStepsDiscriminator: discriminatorSteps,
      trainingStarted: generatorSteps === null && discriminatorSteps === null
        ? null : Number(generatorSteps) > 0 || Number(discriminatorSteps) > 0,
      automaticRetryStarted: false, recordedAtUtc: new Date().toISOString(),
    })
    try {
      const current = await readCurrentExecutionRegistry(root)
      if (current.ok && current.registry.activeExecution?.runId === runId)
        await advance(root, { runId, packageId, outputRoot, evidence: failure,
          programs, active: false, status: "failed_closed", state: "failed_closed" })
    } catch (registryError) {
      writeExclusive(root, `${outputRoot}/registry-finalization-failure.json`, {
        status: "failed_closed", error: String(registryError.stack ?? registryError),
        recordedAtUtc: new Date().toISOString(),
      })
    }
    return { status: "failed_closed", runId, failure, error: String(error.message ?? error) }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await run({ projectRoot: process.cwd(),
    execute: process.argv.includes("--execute") })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
