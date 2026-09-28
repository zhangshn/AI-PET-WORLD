import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFile, execFileSync } from "node:child_process"
import { promisify } from "node:util"
import { pathToFileURL } from "node:url"

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"


const execFileAsync = promisify(execFile)
const CAPABILITY = "stage4_mvp_fresh_foundation_autoencoder_v1"
const WORKER = "ml/ai-painter/scripts/train_stage4_mvp_fresh_foundation.py"
const CONFIG = "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v6.json"
const PROGRAMS = Object.freeze([
  "scripts/run-ai-painter-stage4-mvp-fresh-foundation.mjs",
  WORKER,
  "ml/ai-painter/src/ai_painter/complete_world/model.py",
  "ml/ai-painter/src/ai_painter/complete_world/isolated_foundation.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
  "ml/ai-painter/src/ai_painter/complete_world/mvp_dataset_release.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
])
const RESOURCE_BUDGET = Object.freeze({
  maxGpuMemoryFraction: 0.70,
  maxEpochs: 20,
  maxOptimizerSteps: 960,
  qualificationTimeoutSeconds: 600,
  trainingTimeoutSeconds: 7200,
})


const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  run({
    projectRoot: process.cwd(),
    datasetManifestPath: argument("--dataset-manifest"),
    datasetManifestSha256: argument("--dataset-sha256"),
  }).then(result => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n")
    if (result.status !== "training_started_or_completed") process.exitCode = 2
  }).catch(error => {
    process.stderr.write(String(error.stack ?? error) + "\n")
    process.exitCode = 1
  })
}


export async function run({ projectRoot, datasetManifestPath, datasetManifestSha256 }) {
  const root = fs.realpathSync(projectRoot)
  const datasetManifest = binding(datasetManifestPath, datasetManifestSha256)
  const dataset = readBoundJson(root, datasetManifest)
  validateDataset(dataset)
  const config = bind(root, CONFIG)
  const programs = PROGRAMS.map(value => bind(root, value))
  const payload = {
    capabilityVersion: CAPABILITY,
    datasetManifest,
    datasetReleaseIdentity: dataset.datasetReleaseIdentity,
    config,
    programBindings: programs,
    resolution: { width: 256, height: 192 },
    permittedSplits: ["train", "validation"],
    forbiddenSplits: ["challenge", "regression"],
    freshRandomInitializationOnly: true,
    checkpointLoadAllowed: false,
    denoiserTrainingAllowed: false,
    resourceBudget: RESOURCE_BUDGET,
  }
  const runId = `stage4-mvp-fresh-foundation-${sha(bytes(payload))}`
  const outputRoot = `.runtime/ai-painter/fresh-foundation-training/${runId}`
  const outputDirectory = projectFile(root, outputRoot)
  fs.mkdirSync(path.dirname(outputDirectory), { recursive: true })
  fs.mkdirSync(outputDirectory)
  const gpuRequest = persist(root, `${outputRoot}/gpu-request.json`, {
    schemaVersion: "ai-painter-stage4-mvp-fresh-foundation-gpu-request-v1",
    runId,
    outputRoot,
    ...payload,
  })
  let heartbeatTimer = null
  let activeRegistered = false
  let trainingDispatched = false
  try {
    const lifecycle = persist(root, `${outputRoot}/preflight-terminal.json`, lifecycleValue(
      runId, "completed", "fresh_foundation_gpu_qualification_pending", { lifecyclePhase: "preflight" }))
    await register(root, { runId, outputRoot, evidence: lifecycle, programs, active: true })
    activeRegistered = true
    heartbeatTimer = setInterval(() => {
      try { updateHeartbeat(root, outputRoot, runId) } catch {}
    }, 10_000)

    const qualificationOutput = `${outputRoot}/gpu-qualification.json`
    await runWorker(root, [
      "--mode", "gpu-qualify",
      "--request", gpuRequest.path,
      "--request-sha256", gpuRequest.sha256,
      "--output", qualificationOutput,
    ], RESOURCE_BUDGET.qualificationTimeoutSeconds)
    const gpuQualification = bind(root, qualificationOutput)
    const qualification = readBoundJson(root, gpuQualification)
    assert.equal(qualification.status, "passed_no_optimizer_step", "GPU qualification did not pass")
    assert.equal(qualification.optimizerSteps, 0, "GPU qualification performed an optimizer step")
    assert.equal(qualification.modelStateUnchanged, true, "GPU qualification changed the model")

    const trainingOutputRoot = `${outputRoot}/training`
    const trainingRequest = persist(root, `${outputRoot}/training-request.json`, {
      schemaVersion: "ai-painter-stage4-mvp-fresh-foundation-training-request-v1",
      runId,
      qualificationRunId: runId,
      outputRoot,
      trainingOutputRoot,
      gpuQualification,
      ...payload,
    })
    const trainingStartedEvidence = persist(root, `${outputRoot}/training-started-terminal.json`, lifecycleValue(
      runId, "completed", "fresh_foundation_training_started", {
        lifecyclePhase: "executing",
        gpuQualification,
        trainingRequest,
        trainingStarted: true,
        gpuStarted: true,
      }))
    await updateRegistryActivity(root, {
      runId, outputRoot, programs, evidence: trainingStartedEvidence,
      activity: "fresh_foundation_training_started",
      executionState: "executing",
    })
    const workerTerminalPath = `${trainingOutputRoot}/worker-result.json`
    trainingDispatched = true
    await runWorker(root, [
      "--mode", "train",
      "--request", trainingRequest.path,
      "--request-sha256", trainingRequest.sha256,
      "--output", workerTerminalPath,
    ], RESOURCE_BUDGET.trainingTimeoutSeconds)
    const workerTerminal = bind(root, workerTerminalPath)
    const terminal = readBoundJson(root, workerTerminal)
    assert.equal(terminal.status, "completed_foundation_checkpoint_pending_denoiser_qualification")
    assert.equal(terminal.optimizerSteps, 960)
    assert.equal(terminal.nonTrainOptimizerSteps, 0)
    verifyBinding(root, terminal.checkpoint)
    const final = persist(root, `${outputRoot}/finalize.json`, lifecycleValue(
      runId, "completed", terminal.status, {
        gpuQualification,
        trainingRequest,
        workerTerminal,
        checkpoint: terminal.checkpoint,
        trainingStarted: true,
        gpuStarted: true,
        stage4ProgressRaised: false,
      }))
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
    await register(root, { runId, outputRoot, evidence: final, programs, active: false })
    activeRegistered = false
    return { status: "training_started_or_completed", runId, outputRoot, terminal: final }
  } catch (error) {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    const failure = persist(root, `${outputRoot}/failure.json`, lifecycleValue(
      runId, "failed_closed", "fresh_foundation_failed_closed", {
        error: String(error.stack ?? error),
        trainingStarted: trainingDispatched,
        gpuStarted: fs.existsSync(projectFile(root, `${outputRoot}/gpu-qualification.json`)),
        stage4ProgressRaised: false,
      }))
    if (activeRegistered) {
      try { await register(root, { runId, outputRoot, evidence: failure, programs, active: false }) }
      catch (registryError) {
        persist(root, `${outputRoot}/registry-finalization-failure.json`, {
          status: "failed_closed", error: String(registryError.stack ?? registryError), recordedAtUtc: new Date().toISOString(),
        })
      }
    }
    return { status: "failed_closed", runId, outputRoot, failure, error: String(error.message ?? error) }
  }
}


function validateDataset(value) {
  assert.equal(value.schemaVersion, "ai-painter-stage4-v2-mvp64-fresh-lineage-dataset-release-v1")
  assert.equal(value.immutable, true)
  assert.deepEqual(value.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(value.qualification?.foundationTrainingAllowed, true)
  assert.equal(value.qualification?.foundationTrainingRole, "fresh_foundation_autoencoder_only")
  assert.equal(value.qualification?.denoiserTrainingAllowed, false)
  assert.equal(value.qualification?.trainingAllowed, false)
}


async function runWorker(root, args, timeoutSeconds) {
  const executable = projectFile(root, "ml/ai-painter/.venv/Scripts/python.exe")
  const result = await execFileAsync(executable, ["-B", projectFile(root, WORKER), ...args], {
    cwd: root,
    windowsHide: true,
    timeout: timeoutSeconds * 1000,
    maxBuffer: 2 * 1024 * 1024,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUNBUFFERED: "1",
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONPATH: path.join(root, "ml/ai-painter/src"),
    },
  })
  return { stdout: result.stdout, stderr: result.stderr }
}


async function register(root, { runId, outputRoot, evidence, programs, active }) {
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true, "current execution registry unavailable")
  if (active) assert.equal(current.registry.activeExecution, null, "another execution is active")
  else assert.equal(current.registry.activeExecution?.runId, runId, "active execution ownership changed")
  let activeExecution = null
  if (active) {
    const processStartIdentity = processIdentity(process.pid)
    const identity = {
      capabilityVersion: CAPABILITY,
      packageId: runId,
      runId,
      processId: process.pid,
      processStartIdentity,
    }
    const lock = persist(root, `${outputRoot}/execution-lock.json`, {
      schemaVersion: "ai-painter-current-active-execution-lock-v1", ...identity,
    })
    persist(root, `${outputRoot}/heartbeat.json`, {
      schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
      ...identity,
      executionState: "executing",
      heartbeatAtUtc: new Date().toISOString(),
      ttlSeconds: 120,
    })
    activeExecution = {
      schemaVersion: "ai-painter-current-active-execution-v1",
      ...identity,
      executionState: "executing",
      programLineage: Object.fromEntries(programs.map((entry, index) => [`program${index + 1}`, entry])),
      lock,
      heartbeat: { path: `${outputRoot}/heartbeat.json`, ttlSeconds: 120 },
    }
  }
  const capsule = persist(root, `${outputRoot}/${active ? "begin" : "finish"}-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    taskId: runId,
    integrity: { status: "verified" },
    evidence: [{ ...evidence, kind: "fresh_foundation_lifecycle", sha256Verified: true }],
  })
  const terminalValue = readBoundJson(root, evidence)
  const latestTrainingTerminal = active ? undefined : {
    runId,
    path: evidence.path,
    sha256: evidence.sha256,
    status: terminalValue.status,
    evidence: {},
  }
  const result = await advanceCurrentExecutionRegistry({
    projectRoot: root,
    capabilityVersion: CAPABILITY,
    packageId: runId,
    taskId: runId,
    taskKind: "bounded_fresh_foundation_training",
    taskGoal: "Train one fresh local 256x192 MVP Autoencoder from the bound train split; validation selects checkpoint; held-out splits remain unread",
    priority: 5,
    queueStatus: active ? "running" : terminalValue.executionState === "completed" ? "completed" : "failed_closed",
    nextMachineAction: null,
    queuedAtUtc: new Date().toISOString(),
    runId,
    lifecycleStage: "isolated_implementation",
    executionState: active ? "executing" : terminalValue.executionState,
    activity: active ? "fresh_foundation_gpu_qualification" : terminalValue.status,
    taskCapsulePath: capsule.path,
    terminalEvidencePath: evidence.path,
    latestTrainingTerminal,
    activeExecution,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  assert.equal(result.ok, true, "registry update failed")
}


async function updateRegistryActivity(root, { runId, outputRoot, programs, evidence, activity, executionState }) {
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true)
  assert.equal(current.registry.activeExecution?.runId, runId)
  verifyBinding(root, evidence)
  const capsule = persist(root, `${outputRoot}/training-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    taskId: runId,
    integrity: { status: "verified" },
    evidence: [{ ...evidence, kind: "fresh_foundation_training_started", sha256Verified: true }],
  })
  const activeExecution = {
    ...current.registry.activeExecution,
    executionState,
    programLineage: Object.fromEntries(programs.map((entry, index) => [`program${index + 1}`, entry])),
  }
  const result = await advanceCurrentExecutionRegistry({
    projectRoot: root,
    capabilityVersion: CAPABILITY,
    packageId: runId,
    taskId: runId,
    taskKind: "bounded_fresh_foundation_training",
    taskGoal: "Train one fresh local 256x192 MVP Autoencoder from the bound train split; validation selects checkpoint; held-out splits remain unread",
    priority: 5,
    queueStatus: "running",
    nextMachineAction: null,
    queuedAtUtc: current.registry.queuedAtUtc,
    runId,
    lifecycleStage: "isolated_implementation",
    executionState,
    activity,
    taskCapsulePath: capsule.path,
    terminalEvidencePath: evidence.path,
    activeExecution,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  assert.equal(result.ok, true)
}


function updateHeartbeat(root, outputRoot, runId) {
  const target = projectFile(root, `${outputRoot}/heartbeat.json`)
  const value = JSON.parse(fs.readFileSync(target, "utf8"))
  assert.equal(value.runId, runId)
  assert.equal(value.processId, process.pid)
  value.heartbeatAtUtc = new Date().toISOString()
  writeJsonAtomic(target, value)
}


function processIdentity(pid) {
  const command = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if($null -eq $p){exit 3}; [string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o')`
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8", windowsHide: true, timeout: 10_000,
  }).trim()
}


function lifecycleValue(runId, executionState, status, extra = {}) {
  return {
    schemaVersion: "ai-painter-stage4-mvp-fresh-foundation-lifecycle-v1",
    runId,
    capabilityVersion: CAPABILITY,
    packageId: runId,
    executionState,
    status,
    recordedAtUtc: new Date().toISOString(),
    ...extra,
  }
}


function argument(name) {
  const index = process.argv.indexOf(name)
  if (index < 0 || !process.argv[index + 1]) throw new Error(`missing ${name}`)
  return process.argv[index + 1]
}


function binding(filePath, sha256) {
  assert.equal(typeof filePath, "string")
  assert.match(sha256, /^[a-f0-9]{64}$/u)
  return { path: filePath.replaceAll("\\", "/"), sha256 }
}


function projectFile(root, logical) {
  assert.equal(typeof logical, "string")
  assert(logical && !logical.includes("\\") && !path.isAbsolute(logical))
  const target = path.resolve(root, logical)
  assert(target === root || target.startsWith(root + path.sep), "path escapes project root")
  return target
}


function bytes(value) {
  return Buffer.from(JSON.stringify(value), "utf8")
}


function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}


function hashFile(target) {
  return sha(fs.readFileSync(target))
}


function bind(root, logical) {
  const target = projectFile(root, logical)
  assert(fs.statSync(target).isFile(), "bound path is not a file: " + logical)
  return { path: logical, sha256: hashFile(target) }
}


function verifyBinding(root, value) {
  assert.deepEqual(bind(root, value.path), value, "bound file changed: " + value.path)
}


function readBoundJson(root, value) {
  verifyBinding(root, value)
  return JSON.parse(fs.readFileSync(projectFile(root, value.path), "utf8"))
}


function persist(root, logical, value) {
  const target = projectFile(root, logical)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  writeJsonAtomic(target, value)
  return bind(root, logical)
}


function writeJsonAtomic(target, value) {
  const staged = target + `.staged-${process.pid}`
  fs.writeFileSync(staged, JSON.stringify(value, null, 2) + "\n")
  fs.renameSync(staged, target)
}
