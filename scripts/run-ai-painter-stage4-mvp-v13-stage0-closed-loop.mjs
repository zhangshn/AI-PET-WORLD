import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFile, execFileSync } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from
  "../src/server/ai-painter-current-execution-registry.mjs"
import { runV13FormalReview, verifyV13FormalReviewContract } from
  "./run-ai-painter-stage4-mvp-v13-stage0-machine-review.mjs"
import { V13_CAPABILITY, readBound } from
  "./lib/ai-painter-stage4-mvp-v13-review-lineage.mjs"

const execFileAsync = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CANDIDATE_CONTRACT =
  "data/ai-painter/system-governance/stage4-mvp-native-rgb-instance-object-v13-contract.json"
const REVIEW_CONTRACT =
  "data/ai-painter/system-governance/stage4-mvp-v13-stage0-review-contract-v1.json"
const WORKER = "ml/ai-painter/scripts/train_stage4_mvp_instance_object_v13_stage0.py"
const MATERIALIZER =
  "ml/ai-painter/scripts/materialize_stage4_mvp_instance_object_v13_review_candidates.py"
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const OUTPUT_NAMESPACE =
  ".runtime/ai-painter/stage4-mvp-native-rgb-instance-object-v13-formal-executions"
const STAGE = { stage: 0, width: 256, height: 192, epochCount: 24 }
const BUDGET = { maxGpuMemoryFraction: 0.7, maxEpochs: 24,
  maxOptimizerSteps: 1152, timeoutSeconds: 43200 }
const PROGRAMS = [
  "scripts/run-ai-painter-stage4-mvp-v13-stage0-closed-loop.mjs",
  WORKER, MATERIALIZER,
  "ml/ai-painter/scripts/check_stage4_mvp_instance_object_v13_cpu.py",
  "ml/ai-painter/scripts/run_stage4_mvp_instance_object_v13_readonly_gpu_qualification.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_instance_object_prototype.py",
  "ml/ai-painter/src/ai_painter/complete_world/object_instance_supervision_cpu.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_aperiodic_detail_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
  "ml/ai-painter/scripts/train_stage4_mvp_native_rgb_renderer_v6_stage0.py",
  "ml/ai-painter/scripts/materialize_stage4_mvp_native_rgb_renderer_v6_review_candidates.py",
  "scripts/run-ai-painter-stage4-mvp-v13-stage0-machine-review.mjs",
  "scripts/lib/ai-painter-stage4-mvp-v13-review-lineage.mjs",
  CANDIDATE_CONTRACT, REVIEW_CONTRACT,
]

function sha(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function projectFile(root, logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !logical.includes("\\"))
  assert.ok(!logical.split("/").some(part => !part || part === "." || part === ".."
    || part === "latest" || part === "latest.json"))
  const absolute = path.resolve(root, logical)
  assert.ok(absolute.startsWith(root + path.sep))
  return absolute
}
function bind(root, logical) {
  const target = projectFile(root, logical)
  assert.equal(fs.statSync(target).isFile(), true)
  return { path: logical, sha256: sha(fs.readFileSync(target)) }
}
function readJson(root, binding) {
  return JSON.parse(readBound(root, binding).toString("utf8"))
}
function writeExclusive(root, logical, value) {
  const target = projectFile(root, logical)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const fd = fs.openSync(target, "wx")
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, "utf8")
    fs.fsyncSync(fd)
  } finally { fs.closeSync(fd) }
  return bind(root, logical)
}
function updateHeartbeat(root, outputRoot, runId) {
  const target = projectFile(root, `${outputRoot}/heartbeat.json`)
  const value = JSON.parse(fs.readFileSync(target, "utf8"))
  assert.equal(value.runId, runId)
  assert.equal(value.processId, process.pid)
  value.heartbeatAtUtc = new Date().toISOString()
  const staged = `${target}.staged-${process.pid}`
  fs.writeFileSync(staged, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" })
  fs.renameSync(staged, target)
}
function processIdentity(pid) {
  const command = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if($null -eq $p){exit 3}; [string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o')`
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8", windowsHide: true, timeout: 10_000,
  }).trim()
}
function capsule(root, outputRoot, taskId, kind, evidence, name) {
  return writeExclusive(root, `${outputRoot}/${name}-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v1", taskId,
    integrity: { status: "verified" },
    evidence: [{ ...evidence, kind, sha256Verified: true }],
  })
}
async function advance(root, { runId, packageId, capabilityVersion, outputRoot,
  evidence, programs, active, status, state, action = null, taskKind,
  taskId = runId, latestTrainingTerminal = undefined }) {
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  if (active) assert.equal(current.registry.activeExecution, null)
  else if (current.registry.activeExecution)
    assert.equal(current.registry.activeExecution.runId, runId)
  let activeExecution = null
  if (active) {
    const identity = { capabilityVersion, packageId, runId, processId: process.pid,
      processStartIdentity: processIdentity(process.pid) }
    const lock = writeExclusive(root, `${outputRoot}/execution-lock.json`, {
      schemaVersion: "ai-painter-current-active-execution-lock-v1", ...identity,
    })
    writeExclusive(root, `${outputRoot}/heartbeat.json`, {
      schemaVersion: "ai-painter-current-active-execution-heartbeat-v1", ...identity,
      executionState: "executing", heartbeatAtUtc: new Date().toISOString(), ttlSeconds: 120,
    })
    activeExecution = {
      schemaVersion: "ai-painter-current-active-execution-v1", ...identity,
      executionState: "executing",
      programLineage: Object.fromEntries(programs.map((entry, index) =>
        [`program${index + 1}`, entry])),
      lock, heartbeat: { path: `${outputRoot}/heartbeat.json`, ttlSeconds: 120 },
    }
  }
  const taskCapsule = capsule(root, outputRoot, taskId,
    active ? "mvp_native_rgb_stage0_lifecycle" : "stage0_v13_terminal",
    evidence, active ? "begin" : status === "training_completed_review_pending"
      ? "training-complete" : "review-complete")
  const result = await advanceCurrentExecutionRegistry({
    projectRoot: root, capabilityVersion, packageId, taskId, taskKind,
    taskGoal: "Complete one bounded local V13 Stage0 train, checkpoint, candidate and review lifecycle",
    priority: 5, queueStatus: active ? "running"
      : state === "completed" ? "completed" : "failed_closed",
    nextMachineAction: active ? null : action,
    queuedAtUtc: new Date().toISOString(), runId,
    lifecycleStage: state === "completed" && status === "stage4_mvp_stage0_machine_review_passed"
      ? "stage0_review_passed" : "stage0_256x192",
    executionState: active ? "executing" : state,
    activity: status, taskCapsulePath: taskCapsule.path,
    terminalEvidencePath: evidence.path,
    ...(latestTrainingTerminal === undefined ? {} : { latestTrainingTerminal }),
    activeExecution,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  assert.equal(result.ok, true, "V13 current registry advance failed")
}
async function python(root, program, args, timeoutSeconds, signal = undefined) {
  const { stdout } = await execFileAsync(projectFile(root, PYTHON), [
    "-B", projectFile(root, program), ...args,
  ], {
    cwd: root, windowsHide: true, timeout: timeoutSeconds * 1000, signal,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1",
      PYTHONDONTWRITEBYTECODE: "1", PYTHONPATH: path.join(root, "ml/ai-painter/src") },
  })
  return JSON.parse(stdout)
}

export async function preflight({ projectRoot = ROOT, cpuQualification,
  gpuQualification }) {
  const root = fs.realpathSync(projectRoot)
  const candidate = bind(root, CANDIDATE_CONTRACT)
  const contract = readJson(root, candidate)
  const review = bind(root, REVIEW_CONTRACT)
  verifyV13FormalReviewContract(root, review)
  const cpu = readJson(root, cpuQualification)
  const gpu = readJson(root, gpuQualification)
  const dataset = contract.datasetBinding?.manifest
  const datasetValue = readJson(root, dataset)
  assert.equal(datasetValue.sampleCount, 64)
  assert.deepEqual(datasetValue.splitCounts,
    { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(datasetValue.qualification?.dataQualifiedForTraining, true)
  assert.equal(contract.status, "cpu_candidate_not_execution_qualified")
  assert.equal(contract.capabilityVersion, V13_CAPABILITY)
  assert.equal(cpu.status, "cpu_readonly_passed_formal_review_and_training_still_disabled")
  assert.deepEqual(cpu.candidateContract, candidate)
  assert.deepEqual(cpu.datasetManifest, dataset)
  assert.equal(cpu.splitObjectCoverage?.train?.sampleCount, 48)
  assert.equal(cpu.splitObjectCoverage?.validation?.sampleCount, 8)
  assert.equal(cpu.optimizerSteps, 0)
  assert.equal(cpu.trainingStarted, false)
  assert.equal(gpu.status, "readonly_gpu_qualification_passed_training_still_disabled")
  assert.deepEqual(gpu.candidateContract, candidate)
  assert.deepEqual(gpu.cpuQualification, cpuQualification)
  assert.deepEqual(gpu.datasetManifest, dataset)
  assert.equal(gpu.optimizerSteps, 0)
  assert.equal(gpu.weightsModified, false)
  assert.equal(gpu.trainingStarted, false)
  assert.equal(gpu.trainingAllowedByThisArtifact, false)
  assert.equal(gpu.initialModelStateSha256, cpu.initialModelStateSha256)
  assert.ok(gpu.peakGpuReservedFraction > 0 && gpu.peakGpuReservedFraction <= 0.7)
  const policy = readJson(root, gpu.policy)
  assert.equal(policy.status, "active_single_readonly_qualification")
  assert.deepEqual(policy.candidateContract, candidate)
  assert.deepEqual(policy.cpuQualification, cpuQualification)
  assert.deepEqual(policy.datasetManifest, dataset)
  assert.deepEqual(policy.program, bind(root, policy.program.path))
  assert.equal(policy.execution?.trainingAllowed, false)
  const programs = PROGRAMS.map(logical => bind(root, logical))
  for (const binding of Object.values(contract.programBindings))
    assert.deepEqual(binding, bind(root, binding.path))
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  assert.equal(current.registry.activeExecution, null, "another execution is active")
  return { root, candidate, contract, review, dataset, cpuQualification,
    gpuQualification, gpu, programs, registryRevision: current.registry.registryRevision,
    registrySha256: current.registrySha256 }
}

export async function run({ projectRoot = ROOT, cpuQualification,
  gpuQualification, verifyOnly = false }) {
  const ready = await preflight({ projectRoot, cpuQualification, gpuQualification })
  if (verifyOnly) return { status: "v13_preflight_passed_training_not_started",
    registryRevision: ready.registryRevision, programBindingsVerified: ready.programs.length,
    gpuStarted: false, trainingStarted: false }
  const { root, candidate, review, dataset, gpu, programs } = ready
  const currentBeforeMaterialization = await readCurrentExecutionRegistry(root)
  assert.equal(currentBeforeMaterialization.ok, true)
  assert.equal(currentBeforeMaterialization.registry.registryRevision, ready.registryRevision)
  assert.equal(currentBeforeMaterialization.registrySha256, ready.registrySha256)
  assert.equal(currentBeforeMaterialization.registry.activeExecution, null)
  const identityPayload = { capabilityVersion: V13_CAPABILITY, stage: STAGE,
    candidateContract: candidate, reviewContract: review, datasetManifest: dataset,
    cpuQualification, gpuQualification, resourceBudget: BUDGET,
    programBindings: programs }
  const digest = sha(Buffer.from(JSON.stringify(identityPayload)))
  const runId = `mvp-stage0-${digest.slice(0, 48)}`
  const batchRunId = `mvp-stage0-batch-${digest.slice(0, 40)}`
  const packageId = `mvp-stage0-package-${digest.slice(0, 40)}`
  const outputRoot = `${OUTPUT_NAMESPACE}/${batchRunId}/stages/${runId}`
  const outputDirectory = projectFile(root, outputRoot)
  fs.mkdirSync(path.dirname(outputDirectory), { recursive: true })
  fs.mkdirSync(outputDirectory)
  const packageBinding = writeExclusive(root, `${outputRoot}/execution-package.json`, {
    schemaVersion: "ai-painter-stage4-mvp-native-rgb-instance-object-v13-formal-stage-execution-package-v1",
    batchRunId, runId, packageId, capabilityVersion: V13_CAPABILITY,
    stage: STAGE, parentStage: null, outputRoot,
    outputTerminalPath: `${outputRoot}/phase-terminal.json`,
    candidateContract: candidate, reviewContract: review,
    datasetManifest: dataset, cpuQualification, gpuQualification,
    formalInitializationSha256: gpu.initialModelStateSha256,
    resourceBudget: BUDGET, programBindings: programs,
    permittedSplits: ["train", "validation"],
    forbiddenSplits: ["challenge", "regression"],
    ticketConsumptionRequired: true, recordedAtUtc: new Date().toISOString(),
  })
  let timer = null
  let active = false
  const heartbeatAbort = new AbortController()
  try {
    const started = writeExclusive(root, `${outputRoot}/training-started-terminal.json`, {
      schemaVersion: "ai-painter-stage4-mvp-stage0-training-lifecycle-v1",
      status: "formal_stage0_training_dispatched", executionState: "completed",
      capabilityVersion: V13_CAPABILITY, batchRunId, runId, packageId,
      stage: STAGE, executionPackage: packageBinding,
      cpuQualification, gpuQualification, gpuStarted: false,
      trainingStarted: false, recordedAtUtc: new Date().toISOString(),
    })
    await advance(root, { runId, packageId, capabilityVersion: V13_CAPABILITY,
      outputRoot, evidence: started, programs, active: true,
      status: "formal_stage0_training_dispatched", state: "executing",
      taskKind: "formal_stage0_256x192_native_rgb_training" })
    active = true
    timer = setInterval(() => {
      try { updateHeartbeat(root, outputRoot, runId) }
      catch (error) { heartbeatAbort.abort(error) }
    }, 10_000)
    const workerPath = `${outputRoot}/phase-terminal.json`
    await python(root, WORKER, ["--execution-package", packageBinding.path,
      "--execution-package-sha256", packageBinding.sha256,
      "--output", workerPath], BUDGET.timeoutSeconds, heartbeatAbort.signal)
    const workerBinding = bind(root, workerPath)
    const worker = readJson(root, workerBinding)
    assert.equal(worker.status, "training_completed_review_pending")
    assert.equal(worker.optimizerSteps, BUDGET.maxOptimizerSteps)
    assert.equal(worker.checkpointReloadVerified, true)
    readBound(root, worker.checkpoint)
    clearInterval(timer)
    timer = null
    const trainingFinal = writeExclusive(root, `${outputRoot}/training-finalize.json`, {
      schemaVersion: "ai-painter-stage4-mvp-stage0-training-lifecycle-v1",
      status: "training_completed_review_pending", executionState: "completed",
      capabilityVersion: V13_CAPABILITY, runId, packageId,
      executionPackage: packageBinding, workerTerminal: workerBinding,
      checkpoint: worker.checkpoint, gpuStarted: true, trainingStarted: true,
      recordedAtUtc: new Date().toISOString(),
    })
    await advance(root, { runId, packageId, capabilityVersion: V13_CAPABILITY,
      outputRoot, evidence: trainingFinal, programs, active: false,
      status: "training_completed_review_pending", state: "completed",
      action: "run_stage0_machine_review",
      taskKind: "formal_stage0_256x192_native_rgb_training",
      latestTrainingTerminal: { runId, path: trainingFinal.path,
        sha256: trainingFinal.sha256, status: "training_completed_review_pending", evidence: {} } })
    active = false
    const candidateOutput = `${outputRoot}/review-candidates`
    const result = await python(root, MATERIALIZER, [
      "--execution-package", packageBinding.path,
      "--execution-package-sha256", packageBinding.sha256,
      "--training-terminal", workerBinding.path,
      "--training-terminal-sha256", workerBinding.sha256,
      "--output-dir", candidateOutput,
    ], 600)
    assert.equal(result.status, "candidate_pack_materialized_review_pending")
    const candidateManifest = bind(root, `${candidateOutput}/manifest.json`)
    fs.mkdirSync(projectFile(root, `${outputRoot}/review`))
    const reviewed = await runV13FormalReview({ projectRoot: root,
      candidateManifestBinding: candidateManifest, contractBinding: review })
    const report = readJson(root, reviewed.report)
    assert.equal(report.runId, runId)
    assert.equal(report.packageId, packageId)
    const accepted = report.formalQualificationGranted === true
    const terminal = writeExclusive(root, `${outputRoot}/review/terminal.json`, {
      schemaVersion: "ai-painter-stage4-mvp-stage0-machine-review-terminal-v1",
      status: report.status, executionState: accepted ? "completed" : "failed_closed",
      capabilityVersion: V13_CAPABILITY, runId, packageId, stage: STAGE,
      sourceTrainingTerminal: workerBinding, candidateManifest,
      machineReview: reviewed.report, checkpoint: worker.checkpoint,
      candidateCount: 8, candidatePassCount: report.candidatePassCount,
      stagePassed: accepted, formalQualificationGranted: accepted,
      checkpointPromotionEligible: accepted,
      stage1InitializationEligible: accepted,
      automaticRetryStarted: false, recordedAtUtc: new Date().toISOString(),
    })
    await advance(root, { runId, packageId, capabilityVersion: V13_CAPABILITY,
      outputRoot, evidence: terminal, programs, active: false,
      status: report.status, state: accepted ? "completed" : "failed_closed",
      action: null, taskKind: "stage0_machine_review_closure",
      taskId: `${runId}-machine-review-closed` })
    return { status: report.status, runId, packageId,
      trainingTerminal: workerBinding, candidateManifest,
      machineReview: reviewed.report, terminal }
  } catch (error) {
    if (timer) clearInterval(timer)
    const failure = writeExclusive(root, `${outputRoot}/failure.json`, {
      schemaVersion: "ai-painter-stage4-mvp-v13-closed-loop-failure-v1",
      status: "failed_closed", executionState: "failed_closed",
      capabilityVersion: V13_CAPABILITY, runId, packageId,
      executionPackage: packageBinding, error: String(error.stack ?? error),
      trainingStarted: fs.existsSync(projectFile(root, `${outputRoot}/progress.json`))
        ? true : null,
      automaticRetryStarted: false,
      recordedAtUtc: new Date().toISOString(),
    })
    try {
      await advance(root, { runId, packageId, capabilityVersion: V13_CAPABILITY,
        outputRoot, evidence: failure, programs, active: false,
        status: "failed_closed", state: "failed_closed",
        action: null, taskKind: "formal_stage0_256x192_native_rgb_training" })
    } catch (registryError) {
      writeExclusive(root, `${outputRoot}/registry-finalization-failure.json`, {
        status: "failed_closed", error: String(registryError.stack ?? registryError),
        recordedAtUtc: new Date().toISOString(),
      })
    }
    return { status: "failed_closed", runId, packageId, failure,
      error: String(error.message ?? error) }
  }
}

function flag(name) {
  const index = process.argv.indexOf(name)
  assert.ok(index >= 0 && process.argv[index + 1], `${name} required`)
  return process.argv[index + 1]
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await run({ projectRoot: process.cwd(),
    cpuQualification: { path: flag("--cpu-qualification"), sha256: flag("--cpu-sha256") },
    gpuQualification: { path: flag("--gpu-qualification"), sha256: flag("--gpu-sha256") },
    verifyOnly: process.argv.includes("--verify-only"),
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
