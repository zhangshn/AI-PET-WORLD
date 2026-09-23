import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { pathToFileURL } from "node:url"

const CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
const PLAN_SCHEMA = "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-v1"
const ACTION = "run:ai-painter-stage4-v2-formal-stage0-to-stage2"
const ENTRY_REGISTRY = "data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json"
const STAGES = Object.freeze([
  Object.freeze({ stage: 0, width: 256, height: 192, epochCount: 40 }),
  Object.freeze({ stage: 1, width: 512, height: 384, epochCount: 40 }),
  Object.freeze({ stage: 2, width: 1024, height: 768, epochCount: 40 }),
])

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  executeStage4V2FormalStage0ToStage2({
    planPath: parseArg("--plan"), planSha256: parseArg("--plan-sha256"),
    stageInputs: readStageInputs(),
  }).then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n")
    if (result.status !== "completed") process.exitCode = 2
  }).catch((error) => {
    process.stderr.write(String(error.stack ?? error) + "\n")
    process.exitCode = 1
  })
}

/**
 * The batch executor never selects a historical runner or a caller's parent
 * checkpoint. A registered single-stage runner must consume its own signed
 * local task ticket, resource gates and exact program graph before training.
 * Until such an input package/runner is registered, execution fails closed.
 * commandRunner is a CPU test seam, not a production qualification bypass.
 */
export async function executeStage4V2FormalStage0ToStage2({
  projectRoot = process.cwd(), planPath, planSha256, stageInputs = [],
  commandRunner = runNodeStage, now = () => new Date(),
} = {}) {
  const root = fs.realpathSync(projectRoot)
  const plan = readBoundJson(root, { path: planPath, sha256: planSha256 })
  validatePlan(plan)
  const executionRelative = ".runtime/ai-painter/stage4-v2-formal-executions/" + plan.runId
  const executionRoot = resolveContained(root, executionRelative)
  fs.mkdirSync(path.dirname(executionRoot), { recursive: true })
  // The leaf is an exclusive reservation, including across independent hosts'
  // processes sharing this workspace. Never merge into a previous run directory.
  try { fs.mkdirSync(executionRoot) } catch (error) {
    if (error.code === "EEXIST") throw new Error("formal execution identity already exists")
    throw error
  }
  const statePath = path.join(executionRoot, "execution-state.json")
  const terminalPath = path.join(executionRoot, "phase-terminal.json")
  const base = {
    schemaVersion: "ai-painter-stage4-v2-formal-stage0-to-stage2-execution-state-v2",
    action: ACTION, capabilityVersion: plan.capabilityVersion,
    packageId: plan.packageId, runId: plan.runId, startedAtUtc: now().toISOString(),
  }
  const completedStages = []
  let gpuStarted = false
  let trainingStarted = false
  let activityEvidenceStatus = "not_started"
  let processResult = null
  let currentStage = null
  let inputs
  let parent = null
  const persist = (executionState) => writeJsonAtomic(statePath, {
    ...base, executionState, currentStage, completedStages,
    ...activitySummary(), processResult,
  })
  const activitySummary = () => ({
    gpuStarted: gpuStarted || (activityEvidenceStatus === "unknown" ? null : false),
    trainingStarted: trainingStarted || (activityEvidenceStatus === "unknown" ? null : false),
    activityEvidenceStatus,
  })
  const close = (status, blocker) => {
    const terminal = {
      ...base,
      schemaVersion: "ai-painter-stage4-v2-formal-stage0-to-stage2-execution-terminal-v2",
      status, executionState: status === "completed" ? "completed" : "failed_closed",
      failedTrainingStage: status === "completed" ? null : currentStage,
      blocker, completedStages, ...activitySummary(), processResult, recordedAtUtc: now().toISOString(),
    }
    persist(terminal.executionState)
    writeJsonAtomic(terminalPath, terminal)
    return { ...terminal, terminalPath: executionRelative + "/phase-terminal.json", terminalSha256: hashFile(terminalPath) }
  }

  persist("preflight")
  try {
    inputs = normalizeInputs(stageInputs)
    const runIds = new Set()
    for (const stage of STAGES) {
      currentStage = stage.stage
      validateInput(root, plan, stage, inputs[stage.stage], runIds, executionRelative)
    }
  } catch (error) {
    return close("blocked", String(error.message ?? error))
  }
  try {
    for (const stage of STAGES) {
      currentStage = stage.stage
      const input = inputs[stage.stage]
      // Recheck mutable paths at consumption time, not only at batch preflight.
      const stagePackage = validateInput(root, plan, stage, input, new Set(), executionRelative)
      if (parent) validateParent(root, parent, plan, stage.stage - 1, inputs, completedStages)
      assert.deepEqual(stagePackage.parentStage,
        stage.stage === 0 ? null : stage.stage - 1, "formal package parent-stage mismatch")
      for (const key of ["parentCheckpointPath", "parentCheckpointSha256", "parentTerminalPath", "parentTerminalSha256"]) {
        assert(!(key in input), "caller-selected formal parent is forbidden")
      }
      const terminalAbsolute = resolveContained(root, input.outputTerminalPath)
      assert(!fs.existsSync(terminalAbsolute), "stage output already exists")
      // A dispatched child with no valid terminal has unknown GPU activity, not
      // evidence that training never started. This also covers abrupt exits.
      activityEvidenceStatus = "unknown"
      processResult = null
      persist("executing")
      const result = await commandRunner({ root, plan, stage, input, parent,
        onSupervisionUpdate: (supervision) => {
          processResult = { stage: stage.stage, executionPackage: input.executionPackage, supervision }
          persist("executing")
        },
      })
      processResult = {
        stage: stage.stage, executionPackage: input.executionPackage, exitCode: result?.exitCode ?? null,
        signal: result?.signal ?? null, terminationReason: result?.terminationReason ?? null,
        supervision: result?.supervision ?? null,
        stdoutTail: String(result?.stdout ?? "").slice(-65536),
        stderrTail: String(result?.stderr ?? "").slice(-65536),
      }
      let terminal, terminalBinding
      if (fs.existsSync(terminalAbsolute)) {
        // Parse and bind the same read, never bind a later on-disk replacement.
        const snapshot = readJsonSnapshot(root, input.outputTerminalPath)
        terminal = snapshot.value
        terminalBinding = snapshot.binding
        const activity = readStageActivity(root, terminal, plan, stage, input)
        gpuStarted ||= activity.gpuStarted
        trainingStarted ||= activity.trainingStarted
        activityEvidenceStatus = "verified"
      }
      assert(!result?.terminationReason, "stage_" + stage.stage + "_" + result?.terminationReason)
      assert.equal(result?.exitCode, 0, "stage_" + stage.stage + "_process_failed")
      // Never trust result.terminal or exit-code-only success.
      assert(terminal, "stage project file missing: " + input.outputTerminalPath)
      validateStageTerminal(root, terminal, plan, stage, input, parent)
      verifyBinding(root, terminalBinding)
      const nextParent = { terminal: terminalBinding, checkpoint: terminal.checkpoint }
      const accepted = structuredClone({ stage: stage.stage, terminal: terminalBinding, checkpoint: terminal.checkpoint })
      // Validate the whole proposed chain before accepting this stage, including
      // Stage2: there is no later stage that could detect its corrupted terminal.
      validateParent(root, nextParent, plan, stage.stage, inputs, [...completedStages, accepted])
      parent = nextParent
      gpuStarted ||= terminal.gpuStarted
      trainingStarted ||= terminal.trainingStarted
      // Keep accepted identities separate from the parent object passed to a
      // runner. A later child/terminal cannot replace our earlier chain anchor.
      completedStages.push(accepted)
    }
    return close("completed", null)
  } catch (error) {
    return close("failed_closed", String(error.message ?? error))
  }
}

function validatePlan(plan) {
  assert.equal(plan.schemaVersion, PLAN_SCHEMA, "formal plan schema mismatch")
  assert.equal(plan.status, "materialized_not_executed", "formal plan is not executable")
  assert.equal(plan.capabilityVersion, CAPABILITY, "formal plan capability mismatch")
  assert.equal(plan.ownerAuthorizationRequired, false, "Owner must not enter formal execution")
  assert.deepEqual(plan.orderedStages, STAGES, "formal stage order/resolution/epoch mismatch")
  assertIdentity(plan.packageId, "packageId")
  assertIdentity(plan.runId, "runId")
}

function normalizeInputs(value) {
  assert(Array.isArray(value), "stage inputs must be an explicit ordered array")
  const result = {}
  for (const item of value) {
    assert(item && Number.isInteger(item.stage) && item.stage >= 0 && item.stage <= 2, "stage input invalid")
    assert(!(item.stage in result), "duplicate stage input")
    result[item.stage] = item
  }
  return result
}

function validateInput(root, plan, stage, input, runIds, executionRelative) {
  assert(input?.executionPackage, "stage_" + stage.stage + "_execution_package_missing")
  for (const key of ["parentCheckpointPath", "parentCheckpointSha256", "parentTerminalPath", "parentTerminalSha256"]) {
    assert(!(key in input), "caller-selected formal parent is forbidden")
  }
  assert.equal(input.stage, stage.stage, "stage input order mismatch")
  assert.equal(input.packageId, plan.packageId, "stage input package mismatch")
  assertIdentity(input.runId, "stage runId")
  assert(!runIds.has(input.runId), "duplicate stage runId")
  runIds.add(input.runId)
  const pkg = readBoundJson(root, input.executionPackage)
  assert.equal(pkg.schemaVersion, "ai-painter-stage4-v2-formal-stage-execution-package-v1", "formal package schema mismatch")
  assert.equal(pkg.capabilityVersion, CAPABILITY, "formal package capability mismatch")
  assert.equal(pkg.packageId, plan.packageId, "formal package identity mismatch")
  assert.equal(pkg.runId, input.runId, "formal package run mismatch")
  assert.deepEqual(pkg.stage, stage, "formal package stage settings mismatch")
  validateProcessBudget(pkg.resourceBudget)
  assert.equal(pkg.ticketConsumptionRequired, true, "formal local ticket consumption is required")
  assert.deepEqual(pkg.runner, input.runner, "formal runner binding mismatch")
  readBoundJson(root, pkg.taskTicket)
  readBoundJson(root, pkg.programGraphManifest)
  assert.equal(pkg.outputTerminalPath, input.outputTerminalPath, "formal terminal path mismatch")
  const expected = executionRelative + "/stages/" + input.runId + "/phase-terminal.json"
  assert.equal(input.outputTerminalPath, expected, "formal terminal outside stage namespace")
  verifyBinding(root, input.runner)
  const registry = readJson(resolveContained(root, ENTRY_REGISTRY, true))
  assert.equal(registry.schemaVersion, "ai-painter-current-entrypoint-registry-v1")
  assert.equal(registry.status, "active")
  assert.equal(registry.ownerInNormalStateMachine, false)
  const entries = registry.currentEntrypoints?.filter((entry) =>
    entry.packageScript === input.runner.entrypointId
    && entry.entryFile === input.runner.path
    && entry.role === "stage4_v2_formal_single_stage_execution")
  assert.equal(entries?.length, 1, "formal single-stage runner is not uniquely registered")
  // Existing old semantic-mixture executors are never a compatible default.
  assert(!input.runner.path.includes("semantic-mixture"), "retired formal runner is forbidden")
  return pkg
}

function readStageActivity(root, terminal, plan, stage, input) {
  assert.equal(terminal.schemaVersion, "ai-painter-stage4-v2-formal-stage-terminal-v1", "stage terminal schema mismatch")
  assert.equal(terminal.capabilityVersion, CAPABILITY, "stage capability mismatch")
  assert.equal(terminal.packageId, plan.packageId, "stage package mismatch")
  assert.equal(terminal.runId, input.runId, "stage run mismatch")
  assert.deepEqual(terminal.stage, stage, "stage terminal resolution mismatch")
  assert.deepEqual(terminal.executionPackage, input.executionPackage, "stage consumed another execution package")
  const manifest = readBoundJson(root, terminal.trainingManifest)
  assert.equal(manifest.architectureId, CAPABILITY, "training architecture mismatch")
  assert.equal(manifest.packageId, plan.packageId)
  assert.equal(manifest.runId, input.runId)
  assert.deepEqual(manifest.stage, stage)
  assert.equal(typeof terminal.gpuStarted, "boolean", "stage GPU activity missing")
  assert.equal(typeof terminal.trainingStarted, "boolean", "stage training activity missing")
  return { gpuStarted: terminal.gpuStarted === true, trainingStarted: terminal.trainingStarted === true }
}

export function validateStageTerminal(root, terminal, plan, stage, input, parent) {
  assert.equal(terminal.schemaVersion, "ai-painter-stage4-v2-formal-stage-terminal-v1", "stage terminal schema mismatch")
  assert.equal(terminal.status, "stage4_v2_formal_stage_passed", "stage did not pass")
  assert.equal(terminal.executionState, "completed", "stage execution incomplete")
  assert.equal(terminal.capabilityVersion, CAPABILITY, "stage capability mismatch")
  assert.equal(terminal.packageId, plan.packageId, "stage package mismatch")
  assert.equal(terminal.runId, input.runId, "stage run mismatch")
  assert.deepEqual(terminal.stage, stage, "stage terminal resolution mismatch")
  assert.deepEqual(terminal.executionPackage, input.executionPackage, "stage consumed another execution package")
  assert.deepEqual(terminal.parent, parent, "stage consumed a different parent")
  assert.equal(terminal.gpuStarted, true, "formal GPU execution not evidenced")
  assert.equal(terminal.trainingStarted, true, "formal training not evidenced")
  verifyBinding(root, terminal.checkpoint)
  const stageDirectory = path.posix.dirname(input.outputTerminalPath) + "/"
  assert(terminal.checkpoint.path.startsWith(stageDirectory), "checkpoint outside current stage namespace")
  const manifest = readBoundJson(root, terminal.trainingManifest)
  assert.equal(manifest.architectureId, CAPABILITY, "training architecture mismatch")
  assert.equal(manifest.packageId, plan.packageId)
  assert.equal(manifest.runId, input.runId)
  assert.deepEqual(manifest.stage, stage)
  assert.equal(manifest.status, "training_completed")
  assert.deepEqual(manifest.checkpoint, terminal.checkpoint)
  assert.deepEqual(manifest.loadedParentCheckpoint, parent?.checkpoint ?? null, "actual loaded parent mismatch")
  assert.equal(manifest.nonTrainOptimizerSteps, 0, "non-train samples updated weights")
  const review = readBoundJson(root, terminal.machineReview)
  assert.equal(review.status, "stage4_v2_machine_review_passed")
  assert.equal(review.capabilityVersion, CAPABILITY)
  assert.equal(review.packageId, plan.packageId)
  assert.equal(review.runId, input.runId)
  assert.deepEqual(review.checkpoint, terminal.checkpoint)
  assert.equal(review.failCount, 0)
  assert(Number.isInteger(review.passCount) && review.passCount > 0, "stage review has no passing nodes")
}

function validateParent(root, parent, plan, previousStage, inputs, completedStages) {
  assert.equal(completedStages.length, previousStage + 1, "accepted formal parent chain incomplete")
  let ancestor = null
  const bindings = []
  // At most three stages, including the candidate at finalization. Reuse the full
  // terminal validator, including bound Manifest/Review bytes and success, for
  // every accepted predecessor; do not trust terminal.parent as its own proof.
  for (let index = 0; index <= previousStage; index++) {
    const accepted = completedStages[index]
    assert.equal(accepted.stage, index, "accepted formal parent chain order mismatch")
    assert.equal(accepted.terminal.path, inputs[index].outputTerminalPath, "accepted parent terminal path mismatch")
    const terminal = readBoundJson(root, accepted.terminal)
    assert.deepEqual(terminal.checkpoint, accepted.checkpoint, "parent checkpoint changed")
    validateStageTerminal(root, terminal, plan, STAGES[index], inputs[index], ancestor)
    bindings.push(accepted.terminal, terminal.checkpoint, terminal.trainingManifest, terminal.machineReview)
    ancestor = { terminal: accepted.terminal, checkpoint: accepted.checkpoint }
  }
  assert.deepEqual(parent, ancestor, "parent differs from accepted formal chain")
  // A later stage's validation must not hide a mid-read change to an ancestor.
  for (const binding of bindings) verifyBinding(root, binding)
}

function validateProcessBudget(value) {
  assert(value && typeof value === "object" && !Array.isArray(value), "formal process resource budget missing")
  // Node timers overflow above 2^31-1 ms. Reject, rather than silently mapping
  // an invalid/absent budget to a default or an effectively unbounded wait.
  for (const key of ["timeoutMs", "terminationGraceMs", "heartbeatIntervalMs"]) {
    assert(Number.isSafeInteger(value[key]) && value[key] > 0 && value[key] <= 2147483647,
      "formal process resource budget invalid: " + key)
  }
  assert(value.heartbeatIntervalMs <= value.timeoutMs, "formal process heartbeat exceeds timeout")
  assert(Number.isSafeInteger(value.maxOutputBytes) && value.maxOutputBytes > 0,
    "formal process resource budget invalid: maxOutputBytes")
  return Object.freeze(Object.fromEntries(["timeoutMs", "terminationGraceMs", "heartbeatIntervalMs", "maxOutputBytes"]
    .map((key) => [key, value[key]])))
}

async function runNodeStage({ root, stage, input, parent, onSupervisionUpdate }) {
  // Read the SHA-bound package again at dispatch; no caller-supplied timeout
  // override and no fallback to a historical contract's budget is accepted.
  const budget = validateProcessBudget(readBoundJson(root, input.executionPackage).resourceBudget)
  const runner = verifyBinding(root, input.runner)
  const args = [runner, "--stage", String(stage.stage),
    "--execution-package", verifyBinding(root, input.executionPackage),
    "--execution-package-sha256", input.executionPackage.sha256]
  if (parent) args.push("--parent-checkpoint", verifyBinding(root, parent.checkpoint),
    "--parent-checkpoint-sha256", parent.checkpoint.sha256,
    "--parent-terminal", verifyBinding(root, parent.terminal),
    "--parent-terminal-sha256", parent.terminal.sha256)
  return new Promise((resolve) => {
    const startedAtUtc = new Date().toISOString()
    const started = performance.now()
    const child = spawn(process.execPath, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, shell: false })
    let stdout = "", stderr = ""
    let outputBytes = 0, exitCode = null, signal = null, terminationReason = null
    let spawned = false, exited = false, closed = false, settled = false
    let graceTimer, closeTimer, timeoutTimer, heartbeatTimer
    let lastSupervisorHeartbeatAtUtc = null, supervisionError = null
    const terminationAttempts = []
    const supervision = () => ({
      budget, pid: child.pid ?? null, spawned, processExitObserved: exited, stdioCloseObserved: closed,
      childTerminationStatus: exited ? "exit_observed" : child.pid ? "unknown" : "not_spawned",
      startedAtUtc, elapsedMs: Math.ceil(performance.now() - started), outputBytes,
      terminationReason, terminationAttempts: [...terminationAttempts],
      lastSupervisorHeartbeatAtUtc, heartbeatScope: "parent_supervisor_not_training_progress",
      supervisionError, automaticRestarts: 0, descendantTerminationVerified: false,
    })
    const finish = () => {
      if (settled) return
      settled = true
      for (const timer of [graceTimer, closeTimer, timeoutTimer]) clearTimeout(timer)
      clearInterval(heartbeatTimer)
      process.removeListener("SIGINT", onInterrupt)
      process.removeListener("SIGTERM", onTerminate)
      // A descendant holding inherited pipes must not hang this parent. Closing
      // our streams is not proof that descendants exited, and never kills them.
      child.stdout.destroy()
      child.stderr.destroy()
      child.unref()
      resolve({ exitCode, signal, stdout, stderr, terminationReason,
        supervision: { ...supervision(), finishedAtUtc: new Date().toISOString() } })
    }
    const killOwnedChild = (requestedSignal) => {
      if (exited || child.exitCode !== null || child.signalCode !== null || !child.pid) return
      try { terminationAttempts.push({ signal: requestedSignal, sent: child.kill(requestedSignal) }) }
      catch (error) { terminationAttempts.push({ signal: requestedSignal, sent: false, error: String(error.message) }) }
    }
    const interrupt = (reason) => {
      if (settled || terminationReason) return
      terminationReason = reason
      killOwnedChild("SIGTERM")
      graceTimer = setTimeout(() => {
        killOwnedChild("SIGKILL")
        // Even failed kill/close is bounded, but cannot be reported as stopped.
        graceTimer = setTimeout(finish, budget.terminationGraceMs)
      }, budget.terminationGraceMs)
    }
    const update = () => {
      if (settled) return
      lastSupervisorHeartbeatAtUtc = new Date().toISOString()
      try { onSupervisionUpdate?.(supervision()) }
      catch (error) {
        supervisionError = String(error.message ?? error)
        interrupt("supervision_persistence_failed")
      }
    }
    const onInterrupt = () => interrupt("parent_sigint")
    const onTerminate = () => interrupt("parent_sigterm")
    process.once("SIGINT", onInterrupt)
    process.once("SIGTERM", onTerminate)
    timeoutTimer = setTimeout(() => interrupt("process_timeout"), budget.timeoutMs)
    heartbeatTimer = setInterval(update, budget.heartbeatIntervalMs)
    child.once("spawn", () => { spawned = true; update() })
    for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]]) {
      stream.on("data", (chunk) => {
        if (name === "stdout") stdout = (stdout + chunk).slice(-65536)
        else stderr = (stderr + chunk).slice(-65536)
        if (chunk.length > budget.maxOutputBytes - outputBytes) interrupt("process_output_budget_exceeded")
        outputBytes = Math.min(Number.MAX_SAFE_INTEGER, outputBytes + chunk.length)
      })
      stream.on("error", () => interrupt("process_stdio_error"))
    }
    child.on("error", (error) => {
      supervisionError = String(error.message ?? error)
      if (!spawned && !child.pid) { terminationReason = "process_spawn_failed"; finish() }
      else interrupt("process_error")
    })
    child.once("exit", (code, exitSignal) => {
      exited = true; exitCode = code; signal = exitSignal
      closeTimer = setTimeout(() => {
        terminationReason ??= "process_stdio_close_timeout"
        finish()
      }, budget.terminationGraceMs)
    })
    child.once("close", (code, exitSignal) => {
      closed = true; exitCode = code; signal = exitSignal
      // Close and timer callbacks can be queued together after event-loop delay.
      // A late zero exit must not win that race and silently relax the budget.
      if (performance.now() - started >= budget.timeoutMs) terminationReason ??= "process_timeout"
      finish()
    })
  })
}

function assertIdentity(value, label) {
  assert(typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
    && value !== "." && value !== "..", label + " is invalid")
}
function resolveContained(root, value, mustExist = false) {
  assert(typeof value === "string" && value.length && !path.isAbsolute(value)
    && !path.win32.isAbsolute(value) && !value.includes("\\"), "invalid project-relative path")
  assert(!value.split("/").some((part) => part === ".." || part === "."), "path traversal forbidden")
  const resolved = path.resolve(root, value)
  assert(resolved.startsWith(root + path.sep), "path escapes repository")
  let ancestor = resolved
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor)
  const real = fs.realpathSync(ancestor)
  // .runtime is the project's declared hot-storage junction (a separate disk on
  // this host). Allow only this logical mount, not arbitrary external symlinks.
  const runtimeMount = path.join(root, ".runtime")
  const allowed = value.startsWith(".runtime/") && fs.existsSync(runtimeMount)
    ? fs.realpathSync(runtimeMount) : root
  assert(real === allowed || real.startsWith(allowed + path.sep), "symlink escapes declared storage root")
  if (mustExist) assert(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), "project file missing: " + value)
  // Operate on the checked physical path. Windows recursive mkdir may otherwise
  // fail beneath an empty junction, and evidence must keep the logical path.
  return path.resolve(real, path.relative(ancestor, resolved))
}
function verifyBinding(root, binding) {
  assert(binding && /^[a-f0-9]{64}$/.test(binding.sha256 ?? ""), "file SHA-256 binding missing")
  const file = resolveContained(root, binding.path, true)
  assert.equal(hashFile(file), binding.sha256, "file SHA-256 mismatch: " + binding.path)
  return file
}
function readJsonSnapshot(root, relative, expectedSha256) {
  const bytes = fs.readFileSync(resolveContained(root, relative, true))
  const binding = { path: relative, sha256: crypto.createHash("sha256").update(bytes).digest("hex") }
  if (expectedSha256 !== undefined) assert.equal(binding.sha256, expectedSha256, "file SHA-256 mismatch: " + relative)
  return { value: JSON.parse(bytes.toString("utf8")), binding }
}
function readBoundJson(root, binding) {
  assert(binding && /^[a-f0-9]{64}$/.test(binding.sha256 ?? ""), "file SHA-256 binding missing")
  return readJsonSnapshot(root, binding.path, binding.sha256).value
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function hashFile(file) {
  // Formal checkpoints may be large; hashing must not allocate their full size.
  const digest = crypto.createHash("sha256")
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  const fd = fs.openSync(file, "r")
  try {
    let count
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) digest.update(buffer.subarray(0, count))
    return digest.digest("hex")
  } finally { fs.closeSync(fd) }
}
function writeJsonAtomic(file, value) {
  const temp = file + "." + process.pid + "." + crypto.randomUUID() + ".tmp"
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", flag: "wx" })
  const fd = fs.openSync(temp, "r+")
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(temp, file)
}
function parseArg(name) { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] }
function readStageInputs() { const file = parseArg("--stage-inputs"); return file ? readJson(file) : [] }
