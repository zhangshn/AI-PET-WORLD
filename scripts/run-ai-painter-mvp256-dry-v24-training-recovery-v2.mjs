// One managed V24 256x192 dry-world training attempt. No Stage4/runtime grant.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFile, execFileSync } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath, pathToFileURL } from "node:url"

import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from
  "../src/server/ai-painter-current-execution-registry.mjs"
import { inspectCandidate } from "./check-ai-painter-mvp256-dry-v24-candidate.mjs"
import { validateActivationChain, validateBasePackage } from
  "./lib/ai-painter-mvp256-dry-v24-package-chain-v1.mjs"
import { replaceHeartbeatFile, heartbeatPublicationRule } from
  "./run-ai-painter-learning-capacity-experiment.mjs"

const execFileAsync = promisify(execFile)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const CAPABILITY = "stage4_mvp256_dry_v24_closed_loop_candidate_v1"
export const CONTRACT = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
export const SUPERVISOR = "scripts/run-ai-painter-mvp256-dry-v24-training-recovery-v2.mjs"
export const SUPERVISOR_TESTS = "scripts/tests/test-ai-painter-mvp256-dry-v24-training-recovery-v2.mjs"
export const RECOVERY_POLICY = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-heartbeat-recovery-v2.json"
export const WORKER = "ml/ai-painter/scripts/painter_stage4_v24_dry_single_world_checkpoint_worker.py"
export const WORKER_TESTS = "ml/ai-painter/tests/test_stage4_v24_dry_single_world_checkpoint_worker.py"
export const GPU_QUALIFIER = "ml/ai-painter/scripts/qualify_stage4_mvp256_dry_v24_gpu.py"
export const PACKAGE_CHAIN = "scripts/lib/ai-painter-mvp256-dry-v24-package-chain-v1.mjs"
export const PACKAGE_CHAIN_TESTS = "scripts/tests/test-ai-painter-mvp256-dry-v24-package-chain-v1.mjs"
export const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
export const OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions"
export const BUDGET = { trainingAttempts: 1, automaticRetries: 0, epochs: 48,
  generatorOptimizerSteps: 2304, discriminatorOptimizerSteps: 2304,
  maxWallSeconds: 2700, maxGpuMemoryFraction: 0.7, maximumTemperatureC: 85,
  minimumFreeVramMiB: 2048, minimumFreeDiskMiB: 2048,
  maxOutputMiB: 128, cpuThreads: 2 }
export const TRAINING_PLAN = { epochs: 48, trainRows: 48, validationRows: 8,
  eligibleCheckpointEpochs: [24, 36, 48], generatorOptimizerSteps: 2304,
  discriminatorOptimizerSteps: 2304, historicalCheckpointLoaded: false }

export const REQUIRED_PROGRAMS = {
  supervisor: SUPERVISOR,
  supervisorTests: SUPERVISOR_TESTS,
  worker: WORKER,
  workerTests: WORKER_TESTS,
  gpuQualifier: GPU_QUALIFIER,
  packageChain: PACKAGE_CHAIN,
  packageChainTests: PACKAGE_CHAIN_TESTS,
  heartbeatPublisher: "scripts/run-ai-painter-learning-capacity-experiment.mjs",
  heartbeatPublisherTests: "scripts/tests/test-ai-painter-experiment-heartbeat.mjs",
  v24Worker: "ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py",
  v21ObjectCoreWorker: "ml/ai-painter/scripts/painter_stage4_v21_object_core_fidelity_probe.py",
  v21FullExposureWorker: "ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py",
  v24Update: "ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24.py",
  v23Renderer: "ml/ai-painter/src/ai_painter/complete_world/native_rgb_complete_support_partition_v23_cpu.py",
  v21Objective: "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_core_fidelity_candidate_cpu.py",
  structuredObjective: "ml/ai-painter/src/ai_painter/complete_world/native_rgb_structured_object_objective_cpu_v17.py",
}

const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
const now = () => new Date().toISOString()

export function inside(root, logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical)
    && !logical.includes("\\") && logical.split("/").every(part =>
      part && part !== "." && part !== ".." && part !== "latest"
        && part !== "latest.json"), "unsafe project-relative path")
  const absolute = path.resolve(root, logical)
  assert.ok(absolute.startsWith(`${root}${path.sep}`), "path escaped project")
  return absolute
}

export function bind(root, logical) {
  const target = inside(root, logical)
  assert.equal(fs.statSync(target).isFile(), true, `binding is not a file: ${logical}`)
  return { path: logical, sha256: sha(fs.readFileSync(target)) }
}

export function readBound(root, binding) {
  assert.deepEqual(Object.keys(binding ?? {}).sort(), ["path", "sha256"])
  assert.match(binding.sha256, /^[0-9a-f]{64}$/u)
  const bytes = fs.readFileSync(inside(root, binding.path))
  assert.equal(sha(bytes), binding.sha256, `bound evidence changed: ${binding.path}`)
  return bytes
}

export function boundJson(root, binding) {
  return JSON.parse(readBound(root, binding).toString("utf8"))
}

export function writeExclusive(root, logical, value) {
  const target = inside(root, logical)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const encoded = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  const descriptor = fs.openSync(target, "wx")
  try {
    fs.writeFileSync(descriptor, encoded)
    fs.fsyncSync(descriptor)
  } finally { fs.closeSync(descriptor) }
  return { path: logical, sha256: sha(encoded) }
}

export function processIdentity(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0)
  const command = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if($null -eq $p){exit 3}; [string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o')`
  return execFileSync("powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { encoding: "utf8", windowsHide: true, timeout: 10_000 }).trim()
}

function programs(root) {
  return Object.fromEntries(Object.entries(REQUIRED_PROGRAMS)
    .map(([role, logical]) => [role, bind(root, logical)]))
}

function fixedReviewPlan(candidate) {
  return { boundedDryReviewAllowed: true,
    formalStage4QualificationAllowed: false, runtimePublicationAllowed: false,
    numericThresholdContract: candidate.frozenBindings.numericReview,
    detailThresholdContract: candidate.frozenBindings.detailReview }
}

export function buildBasePackage({ candidate, candidateBinding, runId, packageId,
  outputRoot, programBindings, recoveryPolicy, predecessorFailure }) {
  const base = { schemaVersion: "ai-painter-stage4-mvp256-dry-v24-execution-package-v1",
    status: "issued_single_attempt", capabilityVersion: CAPABILITY, runId, packageId,
    candidateContract: candidateBinding,
    datasetManifest: candidate.frozenBindings.datasetManifest,
    trainSplit: candidate.frozenBindings.trainSplit,
    validationSplit: candidate.frozenBindings.validationSplit,
    outputRoot, resourceBudget: structuredClone(BUDGET),
    trainingPlan: structuredClone(TRAINING_PLAN),
    programBindings, recoveryPolicy, predecessorFailure,
    trainingIntent: "bounded_once", trainingAllowed: false,
    managedExecutionRequired: "javascript_managed_orchestration",
    formalStage4QualificationAllowed: false, runtimePublicationAllowed: false,
    execution: { reviewPlan: fixedReviewPlan(candidate) } }
  validateBasePackage({ base, candidate, candidateBinding })
  return base
}

function exactTrainIds(root, candidate) {
  const split = boundJson(root, candidate.frozenBindings.trainSplit)
  assert.equal(split.split, "train")
  assert.equal(split.sampleIds?.length, 48)
  assert.equal(new Set(split.sampleIds).size, 48)
  return split.sampleIds
}

export function validateGpuGate({ root, gpu, base, baseBinding, candidate }) {
  const expected = exactTrainIds(root, candidate)
  assert.equal(gpu.schemaVersion, "ai-painter-stage4-mvp256-dry-v24-zero-update-gpu-gate-v1")
  assert.equal(gpu.status, "current_candidate_zero_update_gpu_qualification_passed")
  assert.equal(gpu.runId, base.runId)
  assert.equal(gpu.packageId, base.packageId)
  assert.deepEqual(gpu.executionPackage, baseBinding)
  assert.deepEqual(gpu.candidateContract, base.candidateContract)
  assert.equal(gpu.caseCount, 48)
  assert.equal(gpu.generatorAutogradGradCalls, 192)
  assert.equal(gpu.discriminatorAutogradGradCalls, 48)
  assert.deepEqual(gpu.optimizerSteps, { generator: 0, discriminator: 0 })
  assert.equal(gpu.optimizerCreated, false)
  assert.equal(gpu.weightsModified, false)
  assert.equal(gpu.trainingAllowedByThisArtifact, false)
  assert.deepEqual(gpu.finalStateSha256, gpu.initialStateSha256)
  assert.deepEqual(gpu.cases?.map(row => row.case?.sampleId), expected)
  for (const [ordinal, row] of gpu.cases.entries()) {
    assert.equal(row.case.trainOrdinal, ordinal)
    assert.equal(row.case.split, "train")
    assert.equal(row.generatorCandidate?.autogradGradCalls, 4)
    assert.equal(row.discriminatorAutogradGradCalls, 1)
    assert.equal(row.optimizerCreated, false)
    assert.deepEqual(row.optimizerSteps, { generator: 0, discriminator: 0 })
    assert.equal(row.sourceTensorsUnchanged, true)
    assert.equal(row.rngRestored, true)
    assert.deepEqual(row.initialStateSha256, gpu.initialStateSha256)
    assert.deepEqual(row.finalStateSha256, gpu.initialStateSha256)
    assert.deepEqual(Object.keys(row.sourceTensorHashesBeforeAndAfter ?? {}).sort(),
      ["conditions", "image"])
  }
  return true
}

export function validateWorkerTerminal({ root, terminal, base, ticketBinding }) {
  assert.equal(terminal.schemaVersion,
    "ai-painter-stage4-mvp256-dry-v24-worker-terminal-v1")
  assert.equal(terminal.status, "training_completed_review_pending")
  assert.equal(terminal.executionState, "completed")
  assert.equal(terminal.runId, base.runId)
  assert.equal(terminal.packageId, base.packageId)
  assert.equal(terminal.capabilityVersion, CAPABILITY)
  assert.equal(terminal.optimizerStepsGenerator, 2304)
  assert.equal(terminal.optimizerStepsDiscriminator, 2304)
  assert.deepEqual(terminal.eligibleCheckpointEpochs, [24, 36, 48])
  assert.equal(terminal.checkpoints?.length, 3)
  assert.deepEqual(terminal.checkpoints.map(row => row.epoch), [24, 36, 48])
  for (const row of terminal.checkpoints) {
    assert.equal(row.validation?.length, 8)
    assert.deepEqual(row.selection?.rank,
      [row.selection.worstApplicableObjectCorrelation,
        -row.selection.meanValidationRgbMae, -row.epoch])
    assert.deepEqual(row.checkpoint, { path: row.checkpoint.path,
      sha256: row.checkpointSha256 })
    readBound(root, row.checkpoint)
  }
  assert.ok([24, 36, 48].includes(terminal.selectedEpoch))
  const selected = terminal.checkpoints.find(row => row.epoch === terminal.selectedEpoch)
  assert.ok(selected)
  assert.deepEqual(terminal.selectedCheckpoint, selected.checkpoint)
  assert.deepEqual(terminal.selectedRank, selected.selection.rank)
  assert.equal(terminal.selectedModelStateSha256, selected.stateSha256.Model)
  assert.equal(terminal.selectedCriticStateSha256, selected.stateSha256.Critic)
  assert.equal(terminal.checkpointReloadVerified, true)
  assert.equal(terminal.checkpointPromotable, false)
  assert.equal(terminal.challengeContentRead, false)
  assert.equal(terminal.regressionContentRead, false)
  assert.equal(terminal.historicalCheckpointLoaded, false)
  assert.equal(terminal.formalStage4QualificationAllowed, false)
  assert.equal(terminal.stage4QualificationGranted, false)
  assert.equal(terminal.runtimePublicationAllowed, false)
  const claim = boundJson(root, terminal.trainingTicketConsumption)
  assert.deepEqual(claim.trainingTicket, ticketBinding)
  assert.equal(claim.optimizerCreatedAtConsumption, false)
  assert.equal(claim.gpuInitializedAtConsumption, false)
  return selected
}

export function updateHeartbeat(root, outputRoot, identity) {
  const target = inside(root, `${outputRoot}/heartbeat.json`)
  const value = JSON.parse(fs.readFileSync(target, "utf8"))
  assert.equal(value.runId, identity.runId)
  assert.equal(value.processId, identity.processId)
  value.heartbeatAtUtc = now()
  const staged = `${target}.staged-${process.pid}-${crypto.randomBytes(6).toString("hex")}`
  const descriptor = fs.openSync(staged, "wx")
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`)
    fs.fsyncSync(descriptor)
  } finally { fs.closeSync(descriptor) }
  return replaceHeartbeatFile(staged, target)
}

export function verifyRecoveryBoundary(root, recoveryPolicyBinding) {
  const policy = boundJson(root, recoveryPolicyBinding)
  assert.equal(policy.schemaVersion, "stage4-mvp256-dry-v24-heartbeat-recovery-v2")
  assert.equal(policy.status, "isolated_execution_repair_not_model_qualification")
  assert.equal(policy.modelCandidate, CAPABILITY)
  assert.equal(policy.allowedChange, "windows_heartbeat_atomic_replace_bounded_retry_only")
  assert.deepEqual(policy.heartbeatPublication, {
    retryableErrorCodes: ["EPERM", "EACCES", "EBUSY"],
    maxReplaceAttempts: heartbeatPublicationRule.maxReplaceAttempts,
    retryDelayMilliseconds: heartbeatPublicationRule.retryDelayMilliseconds,
    maxWaitMilliseconds: heartbeatPublicationRule.maxWaitMilliseconds,
    sameStagedBytesOnly: true, preservePreviousHeartbeat: true,
  })
  assert.equal(policy.additionalExecutionAttempts, 1)
  assert.equal(policy.automaticTrainingRetries, 0)
  for (const key of ["trainingPlanChangesAllowed", "datasetChangesAllowed",
    "modelChangesAllowed", "lossChangesAllowed", "reviewThresholdChangesAllowed",
    "resourceCeilingChangesAllowed", "formalStage4QualificationAllowed",
    "runtimePublicationAllowed"]) assert.equal(policy[key], false)
  const failure = boundJson(root, policy.predecessorFailure)
  assert.equal(failure.status, "failed_closed")
  assert.equal(failure.trainingStarted, false)
  assert.equal(failure.optimizerStepsGenerator, 0)
  assert.equal(failure.optimizerStepsDiscriminator, 0)
  assert.equal(failure.workerTerminal, null)
  assert.equal(failure.progress, null)
  assert.equal(failure.gpuQualificationFailure, null)
  assert.match(failure.error, /AbortController\.abort|AbortError/u)
  const previousRoot = path.posix.dirname(policy.predecessorFailure.path)
  const previousClaim = boundJson(root, bind(root,
    ".runtime/ai-painter/stage4-mvp256-dry-v24-executions/single-training-attempt-claim.json"))
  assert.equal(previousClaim.runId, failure.runId)
  assert.equal(previousClaim.capabilityVersion, CAPABILITY)
  assert.equal(failure.packageId, previousClaim.packageId)
  assert.equal(previousRoot.endsWith(`/${failure.runId}`), true)
  assert.equal(fs.existsSync(inside(root, `${previousRoot}/training-ticket.json`)), false)
  assert.equal(fs.existsSync(inside(root, `${previousRoot}/phase-terminal.json`)), false)
  assert.equal(fs.existsSync(inside(root, `${previousRoot}/zero-update-gpu-qualification.json`)), false)
  return { policy, predecessorFailure: policy.predecessorFailure }
}

const productionRegistry = {
  read: root => readCurrentExecutionRegistry(root),
  advance: options => advanceCurrentExecutionRegistry(options),
}

async function advanceRegistry(registry, root, { runId, packageId, outputRoot,
  evidence, programBindings, activeExecution, status, state, nextAction = null,
  latestTrainingTerminal = null }) {
  const current = await registry.read(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  if (activeExecution) assert.equal(current.registry.activeExecution, null)
  else if (current.registry.activeExecution)
    assert.equal(current.registry.activeExecution.runId, runId)
  const capsule = writeExclusive(root, `${outputRoot}/${activeExecution ? "begin" :
    state === "completed" ? "training-complete" : "training-failed"}-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v1", taskId: runId,
    integrity: { status: "verified" },
    evidence: [{ ...evidence, kind: "mvp256_dry_v24_bounded_training",
      sha256Verified: true }],
  })
  const result = await registry.advance({ projectRoot: root,
    capabilityVersion: CAPABILITY, packageId, taskId: runId,
    taskKind: "mvp256_dry_v24_bounded_training",
    taskGoal: "Run one bounded V24 256x192 dry-world train/validation checkpoint selection.",
    priority: 5, queueStatus: activeExecution ? "running" : state,
    nextMachineAction: activeExecution ? null : nextAction,
    queuedAtUtc: now(), runId, lifecycleStage: "dry_single_world_256x192",
    executionState: state, activity: status, taskCapsulePath: capsule.path,
    terminalEvidencePath: evidence.path, activeExecution,
    ...(latestTrainingTerminal ? { latestTrainingTerminal } : {}),
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  assert.equal(result.ok, true, "current execution registry advance failed")
  return result
}

const productionCommand = async ({ file, args, root, timeout, signal }) =>
  execFileAsync(file, args, { cwd: root, windowsHide: true, timeout, signal,
    maxBuffer: 16 * 1024 * 1024, encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1",
      PYTHONDONTWRITEBYTECODE: "1", OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2",
      PYTHONPATH: path.join(root, "ml/ai-painter/src") } })

export async function preflight({ projectRoot = ROOT, registry = productionRegistry,
  command = productionCommand } = {}) {
  const root = fs.realpathSync(projectRoot)
  const inspection = inspectCandidate(root, { checkCurrent: false })
  assert.equal(inspection.status, "cpu_candidate_boundary_valid_not_execution_qualified")
  const recoveryPolicy = bind(root, RECOVERY_POLICY)
  const recovery = verifyRecoveryBoundary(root, recoveryPolicy)
  const candidateBinding = bind(root, CONTRACT)
  assert.deepEqual(candidateBinding, inspection.contract)
  const candidate = boundJson(root, candidateBinding)
  assert.deepEqual(candidate.executionCeiling, BUDGET)
  assert.equal(candidate.activation.cpuPreflightAllowed, true)
  assert.equal(candidate.activation.gpuQualificationAllowed, false)
  assert.equal(candidate.activation.trainingAllowed, false)
  for (const binding of Object.values(candidate.frozenBindings)) readBound(root, binding)
  const programBindings = programs(root)
  const current = await registry.read(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  assert.equal(current.registry.activeExecution, null, "another execution is active")
  assert.deepEqual({ path: current.registry.latestTrainingTerminal?.path,
    sha256: current.registry.latestTrainingTerminal?.sha256 },
  recovery.predecessorFailure, "latest terminal is not the bound zero-step failure")
  const workerCheck = await command({ file: inside(root, PYTHON),
    args: ["-B", inside(root, WORKER), "--cpu-preflight"], root,
    timeout: 120_000 })
  const workerPreflight = JSON.parse(workerCheck.stdout)
  assert.equal(workerPreflight.status, "cpu_preflight_passed_training_not_started")
  assert.equal(workerPreflight.trainingStarted, false)
  assert.equal(workerPreflight.gpuInitialized, false)
  assert.equal(workerPreflight.optimizerCreated, false)
  return { root, candidate, candidateBinding, programBindings,
    recoveryPolicy, predecessorFailure: recovery.predecessorFailure,
    registryRevision: current.registry.registryRevision,
    registrySha256: current.registrySha256, workerPreflight }
}

function identityFor(ready) {
  const identity = { capabilityVersion: CAPABILITY,
    candidateContract: ready.candidateBinding,
    recoveryPolicy: ready.recoveryPolicy,
    predecessorFailure: ready.predecessorFailure,
    datasetManifest: ready.candidate.frozenBindings.datasetManifest,
    resourceBudget: BUDGET, trainingPlan: TRAINING_PLAN,
    programBindings: ready.programBindings }
  const digest = sha(Buffer.from(JSON.stringify(identity)))
  return { runId: `mvp256-dry-v24-${digest.slice(0, 48)}`,
    packageId: `mvp256-dry-v24-package-${digest.slice(0, 40)}` }
}

export async function run({ projectRoot = ROOT, execute = false,
  registry = productionRegistry, command = productionCommand,
  processIdentityReader = processIdentity, preflightReady = null,
  intervalFactory = setInterval, intervalClear = clearInterval } = {}) {
  const ready = preflightReady ?? await preflight({ projectRoot, registry, command })
  if (!execute) return { status: "cpu_preflight_passed_training_not_started",
    registryRevision: ready.registryRevision, trainingStarted: false,
    gpuInitialized: false }
  const root = ready.root
  const before = await registry.read(root)
  assert.equal(before.ok, true)
  assert.equal(before.registry.registryRevision, ready.registryRevision)
  assert.equal(before.registrySha256, ready.registrySha256)
  assert.equal(before.registry.activeExecution, null)
  const { runId, packageId } = identityFor(ready)
  const outputRoot = `${OUTPUT_PARENT}/${runId}`
  fs.mkdirSync(inside(root, OUTPUT_PARENT), { recursive: true })
  const claim = writeExclusive(root, `${OUTPUT_PARENT}/single-training-attempt-claim.json`, {
    schemaVersion: "ai-painter-mvp256-dry-v24-recovery-v2-single-training-attempt-claim-v1",
    capabilityVersion: CAPABILITY, candidateContract: ready.candidateBinding,
    recoveryPolicy: ready.recoveryPolicy,
    predecessorFailure: ready.predecessorFailure,
    runId, packageId, automaticRetries: 0, claimedAtUtc: now(),
  })
  fs.mkdirSync(inside(root, outputRoot))
  let base = null
  let baseBinding = null
  let supervisorIdentity = null
  let dispatch = null
  let heartbeatTimer = null
  let activeRegistered = false
  const abort = new AbortController()
  try {
    base = buildBasePackage({ candidate: ready.candidate,
      candidateBinding: ready.candidateBinding, runId, packageId, outputRoot,
      programBindings: ready.programBindings,
      recoveryPolicy: ready.recoveryPolicy,
      predecessorFailure: ready.predecessorFailure })
    baseBinding = writeExclusive(root, `${outputRoot}/execution-package.json`, base)
    supervisorIdentity = { capabilityVersion: CAPABILITY, runId, packageId,
      processId: process.pid, processStartIdentity: processIdentityReader(process.pid) }
    const registryLock = writeExclusive(root, `${outputRoot}/execution-lock.json`, {
      schemaVersion: "ai-painter-current-active-execution-lock-v1", ...supervisorIdentity,
    })
    writeExclusive(root, `${outputRoot}/heartbeat.json`, {
      schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
      ...supervisorIdentity, executionState: "executing",
      heartbeatAtUtc: now(), ttlSeconds: 120,
    })
    const activeExecution = {
      schemaVersion: "ai-painter-current-active-execution-v1", ...supervisorIdentity,
      executionState: "executing", programLineage: ready.programBindings,
      lock: registryLock, heartbeat: { path: `${outputRoot}/heartbeat.json`, ttlSeconds: 120 },
    }
    dispatch = writeExclusive(root, `${outputRoot}/training-dispatched.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v24-training-lifecycle-v1",
      status: "base_package_dispatched_gpu_gate_pending", executionState: "completed",
      runId, packageId, capabilityVersion: CAPABILITY, singleAttemptClaim: claim,
      executionPackage: baseBinding, trainingStarted: false, gpuQualificationStarted: false,
      formalStage4QualificationGranted: false, runtimePublicationGranted: false,
      recordedAtUtc: now(),
    })
    await advanceRegistry(registry, root, { runId, packageId, outputRoot,
      evidence: dispatch, programBindings: ready.programBindings,
      activeExecution, status: "gpu_qualification_pending", state: "executing" })
    activeRegistered = true
    heartbeatTimer = intervalFactory(() => {
      try { updateHeartbeat(root, outputRoot, supervisorIdentity) }
      catch (error) { abort.abort(error) }
    }, 10_000)
    const qualifierResult = await command({ file: inside(root, PYTHON),
      args: ["-B", inside(root, GPU_QUALIFIER), "--package", baseBinding.path,
        "--sha256", baseBinding.sha256, "--execute"], root,
      timeout: 660_000, signal: abort.signal })
    const qualifierStdout = JSON.parse(qualifierResult.stdout)
    assert.equal(qualifierStdout.status,
      "current_candidate_zero_update_gpu_qualification_passed")
    const gpuBinding = bind(root, `${outputRoot}/zero-update-gpu-qualification.json`)
    const gpu = boundJson(root, gpuBinding)
    validateGpuGate({ root, gpu, base, baseBinding, candidate: ready.candidate })
    const managedLock = writeExclusive(root, `${outputRoot}/managed-training-lock.json`, {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v24-managed-lock-v1",
      status: "active_bound_single_attempt", runId, packageId,
      executionPackage: baseBinding, resourceBudget: structuredClone(BUDGET),
    })
    const launch = writeExclusive(root, `${outputRoot}/supervisor-launch-identity.json`, {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v24-launch-identity-v1",
      status: "managed_supervisor_identity_verified", runId, packageId,
      executionPackage: baseBinding, managedLock,
      processId: supervisorIdentity.processId,
      processStartIdentity: supervisorIdentity.processStartIdentity,
    })
    const ticketValue = {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v24-training-ticket-v1",
      status: "issued_single_use", capabilityVersion: CAPABILITY, runId, packageId,
      executionPackage: baseBinding, gpuQualification: gpuBinding,
      managedLock, launchIdentity: launch,
      consumptionClaimPath: `${outputRoot}/training-ticket-consumed.json`,
      trainingAllowed: true, automaticRetries: 0,
      formalStage4QualificationAllowed: false, runtimePublicationAllowed: false,
    }
    const ticketBinding = writeExclusive(root, `${outputRoot}/training-ticket.json`, ticketValue)
    validateActivationChain({ base, baseBinding, gpu, gpuBinding,
      lock: boundJson(root, managedLock), lockBinding: managedLock,
      launch: boundJson(root, launch), launchBinding: launch,
      ticket: ticketValue, ticketBinding })
    const activation = writeExclusive(root, `${outputRoot}/training-activated.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v24-training-lifecycle-v1",
      status: "single_use_training_ticket_issued", executionState: "executing",
      runId, packageId, executionPackage: baseBinding,
      gpuQualification: gpuBinding, trainingTicket: ticketBinding,
      trainingStarted: false, recordedAtUtc: now(),
    })
    readBound(root, activation)
    await command({ file: inside(root, PYTHON),
      args: ["-B", inside(root, WORKER), "--run",
        "--training-ticket", ticketBinding.path,
        "--training-ticket-sha256", ticketBinding.sha256,
        "--output", `${outputRoot}/phase-terminal.json`], root,
      timeout: (BUDGET.maxWallSeconds + 120) * 1000, signal: abort.signal })
    const workerBinding = bind(root, `${outputRoot}/phase-terminal.json`)
    const worker = boundJson(root, workerBinding)
    const selected = validateWorkerTerminal({ root, terminal: worker, base, ticketBinding })
    if (heartbeatTimer) intervalClear(heartbeatTimer)
    heartbeatTimer = null
    const final = writeExclusive(root, `${outputRoot}/training-finalize.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v24-training-lifecycle-v1",
      status: "training_completed_review_pending", executionState: "completed",
      runId, packageId, capabilityVersion: CAPABILITY,
      executionPackage: baseBinding, gpuQualification: gpuBinding,
      trainingTicket: ticketBinding, workerTerminal: workerBinding,
      selectedEpoch: worker.selectedEpoch, selectedRank: worker.selectedRank,
      selectedCheckpoint: selected.checkpoint,
      checkpointReloadVerified: true, checkpointPromotable: false,
      trainingProgress: bind(root, `${outputRoot}/progress.json`),
      formalStage4QualificationGranted: false, runtimePublicationGranted: false,
      recordedAtUtc: now(),
    })
    await advanceRegistry(registry, root, { runId, packageId, outputRoot,
      evidence: final, programBindings: ready.programBindings, activeExecution: null,
      status: "training_completed_review_pending", state: "completed",
      nextAction: "materialize_mvp256_dry_v24_selected_candidate",
      latestTrainingTerminal: { runId, path: final.path, sha256: final.sha256,
        status: "training_completed_review_pending", evidence: {
          workerTerminal: workerBinding,
          trainingProgress: bind(root, `${outputRoot}/progress.json`) } } })
    activeRegistered = false
    return { status: "training_completed_review_pending", runId, packageId,
      executionPackage: baseBinding, workerTerminal: workerBinding,
      selectedCheckpoint: selected.checkpoint }
  } catch (error) {
    if (heartbeatTimer) intervalClear(heartbeatTimer)
    heartbeatTimer = null
    let workerTerminal = null
    let progress = null
    let gpuFailure = null
    for (const [key, logical] of [
      ["workerTerminal", `${outputRoot}/phase-terminal.json`],
      ["progress", `${outputRoot}/progress.json`],
      ["gpuFailure", `${outputRoot}/zero-update-gpu-qualification-failure.json`],
    ]) {
      try {
        if (!fs.existsSync(inside(root, logical))) continue
        const binding = bind(root, logical)
        if (key === "workerTerminal") workerTerminal = binding
        else if (key === "progress") progress = binding
        else gpuFailure = binding
      } catch { /* the failure record below preserves the read error stack */ }
    }
    const workerValue = workerTerminal ? boundJson(root, workerTerminal) : null
    const progressValue = progress ? boundJson(root, progress) : null
    const generatorSteps = workerValue?.optimizerStepsGenerator
      ?? progressValue?.optimizerStepsGenerator ?? 0
    const discriminatorSteps = workerValue?.optimizerStepsDiscriminator
      ?? progressValue?.optimizerStepsDiscriminator ?? 0
    const failure = writeExclusive(root, `${outputRoot}/failure.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v24-training-failure-v1",
      status: "failed_closed", executionState: "failed_closed",
      runId, packageId, capabilityVersion: CAPABILITY,
      executionPackage: baseBinding, error: String(error.stack ?? error),
      abortReason: abort.signal.aborted ? String(abort.signal.reason?.stack
        ?? abort.signal.reason) : null,
      heartbeatPublication: abort.signal.reason?.heartbeatPublication ?? null,
      workerTerminal, progress, gpuQualificationFailure: gpuFailure,
      optimizerStepsGenerator: generatorSteps,
      optimizerStepsDiscriminator: discriminatorSteps,
      trainingStarted: Number(generatorSteps) > 0 || Number(discriminatorSteps) > 0,
      automaticRetryStarted: false, checkpointPromotable: false,
      formalStage4QualificationGranted: false, runtimePublicationGranted: false,
      recordedAtUtc: now(),
    })
    if (activeRegistered) {
      try {
        const current = await registry.read(root)
        if (current.ok && current.registry.activeExecution?.runId === runId) {
          const latestEvidence = {}
          if (workerTerminal) latestEvidence.workerTerminal = workerTerminal
          if (progress) latestEvidence.trainingProgress = progress
          await advanceRegistry(registry, root, { runId, packageId, outputRoot,
            evidence: failure, programBindings: ready.programBindings,
            activeExecution: null, status: "failed_closed", state: "failed_closed",
            latestTrainingTerminal: { runId, path: failure.path,
              sha256: failure.sha256, status: "failed_closed",
              evidence: latestEvidence } })
          activeRegistered = false
        }
      } catch (registryError) {
        writeExclusive(root, `${outputRoot}/registry-finalization-failure.json`, {
          schemaVersion: "ai-painter-mvp256-dry-v24-registry-finalization-failure-v1",
          status: "failed_closed", runId, packageId,
          error: String(registryError.stack ?? registryError), recordedAtUtc: now(),
        })
      }
    }
    return { status: "failed_closed", runId, packageId, failure,
      error: String(error.message ?? error) }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const execute = process.argv.slice(2).includes("--execute")
  assert.deepEqual(process.argv.slice(2), execute ? ["--execute"] : [])
  const result = await run({ projectRoot: process.cwd(), execute })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
