import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import test from "node:test"
import { executeStage4V2FormalStage0ToStage2 } from "../run-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs"

const CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-formal-evidence-"))
  t.after(() => {
    const real = fs.realpathSync(root)
    assert.equal(path.dirname(real), fs.realpathSync(os.tmpdir()))
    assert(path.basename(real).startsWith("stage4-formal-evidence-"))
    fs.rmSync(real, { recursive: true, force: true })
  })
  const plan = {
    schemaVersion: "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-v1",
    status: "materialized_not_executed", capabilityVersion: CAPABILITY,
    packageId: "test-formal-package", runId: "test-batch", ownerAuthorizationRequired: false,
    orderedStages: [0, 1, 2].map((stage) => ({ stage, width: 256 * 2 ** stage, height: 192 * 2 ** stage, epochCount: 40 })),
  }
  const write = (relative, value) => {
    const logical = path.join(root, relative)
    // Model a child that writes to the resolved storage mount, as the production
    // path contract requires. Preserve logical paths in the returned binding.
    let ancestor = path.dirname(logical)
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor)
    const file = path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, logical))
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value) + "\n")
    return { path: relative, sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
  }
  const runner = { ...write("scripts/fixture-stage-runner.mjs", "// CPU test fixture only\n"),
    entrypointId: "test:formal-stage" }
  const registryPath = "data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json"
  const registry = {
    schemaVersion: "ai-painter-current-entrypoint-registry-v1", status: "active",
    ownerInNormalStateMachine: false, currentEntrypoints: [{
      packageScript: runner.entrypointId, entryFile: runner.path,
      role: "stage4_v2_formal_single_stage_execution",
    }],
  }
  write(registryPath, registry)
  const inputs = plan.orderedStages.map((stage) => {
    const runId = "fixture-stage-" + stage.stage
    const outputTerminalPath = ".runtime/ai-painter/stage4-v2-formal-executions/test-batch/stages/" + runId + "/phase-terminal.json"
    const pkg = {
      schemaVersion: "ai-painter-stage4-v2-formal-stage-execution-package-v1",
      capabilityVersion: CAPABILITY, packageId: plan.packageId, runId, stage,
      runner, parentStage: stage.stage === 0 ? null : stage.stage - 1,
      ticketConsumptionRequired: true,
      // Explicit fixture limits are not production defaults or training grants.
      resourceBudget: { timeoutMs: 3000, terminationGraceMs: 500, heartbeatIntervalMs: 100, maxOutputBytes: 65536 },
      taskTicket: write("inputs/ticket-" + stage.stage + ".json", { fixtureOnly: true }),
      programGraphManifest: write("inputs/graph-" + stage.stage + ".json", { fixtureOnly: true }),
      outputTerminalPath,
    }
    return {
      stage: stage.stage, packageId: plan.packageId, runId, runner, outputTerminalPath,
      executionPackage: write("inputs/package-" + stage.stage + ".json", pkg),
    }
  })
  const emitted = []
  const emit = async ({ stage, input, parent }, mutate = () => {}) => {
    const dir = path.posix.dirname(input.outputTerminalPath)
    // These are deterministic CPU fixture artifacts, NOT trained weights.
    const checkpoint = write(dir + "/checkpoint.fixture", "cpu-fixture-stage-" + stage.stage)
    const manifest = {
      architectureId: CAPABILITY, packageId: plan.packageId, runId: input.runId, stage,
      status: "training_completed", checkpoint, loadedParentCheckpoint: parent?.checkpoint ?? null,
      nonTrainOptimizerSteps: 0,
    }
    const review = { status: "stage4_v2_machine_review_passed", capabilityVersion: CAPABILITY,
      packageId: plan.packageId, runId: input.runId, checkpoint, failCount: 0, passCount: 6 }
    const terminal = {
      schemaVersion: "ai-painter-stage4-v2-formal-stage-terminal-v1",
      status: "stage4_v2_formal_stage_passed", executionState: "completed",
      capabilityVersion: CAPABILITY, packageId: plan.packageId, runId: input.runId,
      stage, executionPackage: input.executionPackage, parent, checkpoint,
      gpuStarted: true, trainingStarted: true,
    }
    mutate({ terminal, manifest, review })
    terminal.trainingManifest = write(dir + "/manifest.json", manifest)
    terminal.machineReview = write(dir + "/review.json", review)
    write(input.outputTerminalPath, terminal)
    emitted.push({ stage: stage.stage, parent, checkpoint })
    return { exitCode: 0, terminal: { ignoredCallerObject: true } }
  }
  const execute = (extra = {}) => {
    const binding = write("formal-plan.json", plan)
    return executeStage4V2FormalStage0ToStage2({
      projectRoot: root, planPath: binding.path, planSha256: binding.sha256,
      stageInputs: inputs, commandRunner: emit, ...extra,
    })
  }
  return { root, plan, inputs, write, execute, emit, emitted, registry, registryPath }
}

function updatePackage(f, input, mutate) {
  const pkg = JSON.parse(fs.readFileSync(path.join(f.root, input.executionPackage.path), "utf8"))
  mutate(pkg)
  input.executionPackage = f.write(input.executionPackage.path, pkg)
}
function nativeRunner(f, code, budget = {}) {
  const runner = { ...f.write(f.inputs[0].runner.path, code), entrypointId: f.inputs[0].runner.entrypointId }
  for (const input of f.inputs) {
    input.runner = runner
    updatePackage(f, input, (pkg) => { pkg.runner = runner; Object.assign(pkg.resourceBudget, budget) })
  }
}
function storedFailure(f, result) {
  const terminal = JSON.parse(fs.readFileSync(path.join(f.root, result.terminalPath), "utf8"))
  const state = JSON.parse(fs.readFileSync(path.join(f.root, path.posix.dirname(result.terminalPath), "execution-state.json"), "utf8"))
  assert.equal(terminal.executionState, "failed_closed")
  assert.equal(state.executionState, "failed_closed")
  assert.equal(terminal.failedTrainingStage, 0)
  assert.deepEqual(terminal.processResult, result.processResult)
  assert.deepEqual(state.processResult, result.processResult)
  assert.equal(terminal.activityEvidenceStatus, "unknown")
  assert.equal(terminal.gpuStarted, null)
  assert.equal(terminal.trainingStarted, null)
  assert.equal(terminal.completedStages.length, 0)
}

test("missing inputs fail closed without starting a child", async (t) => {
  const f = fixture(t)
  let calls = 0
  const r = await f.execute({ stageInputs: [], commandRunner: () => { calls++ } })
  assert.equal(r.status, "blocked")
  assert.equal(r.blocker, "stage_0_execution_package_missing")
  assert.equal(r.executionState, "failed_closed")
  assert.equal(calls, 0)
  assert.equal(r.trainingStarted, false)
})
test("stages consume the actual predecessor files, not pre-created caller parents", async (t) => {
  const f = fixture(t)
  assert(!fs.existsSync(path.join(f.root, f.inputs[0].outputTerminalPath)))
  const r = await f.execute()
  assert.equal(r.status, "completed")
  assert.deepEqual(f.emitted.map((x) => x.stage), [0, 1, 2])
  assert.equal(f.emitted[0].parent, null)
  assert.deepEqual(f.emitted[1].parent.checkpoint, f.emitted[0].checkpoint)
  assert.deepEqual(f.emitted[2].parent.checkpoint, f.emitted[1].checkpoint)
})
test("unregistered single-stage runner cannot be invoked", async (t) => {
  const f = fixture(t)
  f.registry.currentEntrypoints = []
  f.write(f.registryPath, f.registry)
  const r = await f.execute()
  assert.equal(r.status, "blocked")
  assert.match(r.blocker, /not uniquely registered/)
  assert.equal(f.emitted.length, 0)
})
test("legacy authorization-shaped input cannot enter current execution", async (t) => {
  const f = fixture(t)
  const r = await f.execute({ stageInputs: [{ stage: 0, authorizationPath: "old.json" }] })
  assert.equal(r.status, "blocked")
  assert.equal(f.emitted.length, 0)
})
test("success object and zero exit without a real terminal are rejected", async (t) => {
  const f = fixture(t)
  const r = await f.execute({ commandRunner: async () => ({ exitCode: 0, terminal: {
    status: "semantic_mixture_stage4_formal_stage_completed_closed", gpuStarted: true, trainingStarted: true,
  } }) })
  assert.equal(r.status, "failed_closed")
  assert.match(r.blocker, /project file missing/)
  assert.equal(r.completedStages.length, 0)
  assert.equal(r.trainingStarted, null)
  assert.equal(r.activityEvidenceStatus, "unknown")
})

test("a nonzero child exit preserves already-evidenced training activity", async (t) => {
  const f = fixture(t)
  const r = await f.execute({ commandRunner: async (args) => {
    await f.emit(args, ({ terminal }) => {
      terminal.status = "failed_closed"
      terminal.executionState = "failed_closed"
    })
    return { exitCode: 2, stderr: "fixture child failed after training" }
  } })
  assert.equal(r.status, "failed_closed")
  assert.match(r.blocker, /stage_0_process_failed/)
  assert.equal(r.trainingStarted, true)
  assert.equal(r.gpuStarted, true)
  assert.equal(r.completedStages.length, 0)
  assert.equal(f.emitted.length, 1)
  assert.equal(r.processResult.exitCode, 2)
  assert.match(r.processResult.stderrTail, /failed after training/)
})

test("one run identity cannot be reserved twice", async (t) => {
  const f = fixture(t)
  let resume
  const paused = new Promise((resolve) => { resume = resolve })
  const first = f.execute({ commandRunner: async (args) => {
    await paused
    return f.emit(args)
  } })
  await assert.rejects(f.execute(), /identity already exists/)
  resume()
  assert.equal((await first).status, "completed")
})

test("native child dispatch records failure diagnostics and no false completion", async (t) => {
  const f = fixture(t)
  const runnerPath = f.inputs[0].runner.path
  const runner = { ...f.write(runnerPath, `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
const bytes = fs.readFileSync(arg('--execution-package'));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), arg('--execution-package-sha256'));
assert.equal(arg('--stage'), '0');
assert(!process.argv.includes('--authorization'));
process.stderr.write('native CPU fixture intentionally exits before terminal');
process.exitCode = 3;
`), entrypointId: f.inputs[0].runner.entrypointId }
  for (const input of f.inputs) {
    const pkg = JSON.parse(fs.readFileSync(path.join(f.root, input.executionPackage.path), "utf8"))
    pkg.runner = runner
    input.runner = runner
    input.executionPackage = f.write(input.executionPackage.path, pkg)
  }
  const r = await f.execute({ commandRunner: undefined })
  assert.equal(r.status, "failed_closed")
  assert.equal(r.processResult.exitCode, 3)
  assert.match(r.processResult.stderrTail, /native CPU fixture/)
  assert.equal(r.trainingStarted, null)
  assert.equal(r.activityEvidenceStatus, "unknown")
  assert.equal(r.completedStages.length, 0)
  assert.equal(r.processResult.supervision.processExitObserved, true)
  assert.equal(r.processResult.supervision.stdioCloseObserved, true)
  assert.deepEqual(r.processResult.supervision.terminationAttempts, [])
  storedFailure(f, r)
})

test("native CPU child ends within its bound; exit zero alone still cannot complete a formal stage", async (t) => {
  const f = fixture(t)
  nativeRunner(f, "process.stdout.write('bounded CPU fixture finished');\n")
  const r = await f.execute({ commandRunner: undefined })
  assert.equal(r.processResult.exitCode, 0)
  assert.equal(r.processResult.terminationReason, null)
  assert.equal(r.processResult.supervision.processExitObserved, true)
  assert.equal(r.processResult.supervision.stdioCloseObserved, true)
  assert.deepEqual(r.processResult.supervision.terminationAttempts, [])
  assert.match(r.processResult.stdoutTail, /bounded CPU fixture finished/)
  assert.match(r.blocker, /project file missing/)
  storedFailure(f, r)
})

test("native hung CPU child times out, is reaped, and writes one failed terminal with unknown activity", async (t) => {
  const f = fixture(t)
  nativeRunner(f, "setInterval(() => {}, 1000);\n", { timeoutMs: 200, heartbeatIntervalMs: 25 })
  const start = performance.now()
  const r = await f.execute({ commandRunner: undefined })
  assert(performance.now() - start < 5000, "bounded synthetic child must not hang the test")
  assert.equal(r.status, "failed_closed")
  assert.match(r.blocker, /stage_0_process_timeout/)
  assert.equal(r.processResult.terminationReason, "process_timeout")
  const supervision = r.processResult.supervision
  assert.equal(supervision.budget.timeoutMs, 200)
  assert.equal(supervision.processExitObserved, true)
  assert.equal(supervision.childTerminationStatus, "exit_observed")
  assert.equal(supervision.automaticRestarts, 0)
  assert.equal(supervision.heartbeatScope, "parent_supervisor_not_training_progress")
  assert.ok(supervision.lastSupervisorHeartbeatAtUtc)
  assert.equal(supervision.terminationAttempts[0].signal, "SIGTERM")
  assert.equal(supervision.terminationAttempts[0].sent, true)
  storedFailure(f, r)
})

test("native CPU stdout flood obeys explicit output budget and never advances", async (t) => {
  const f = fixture(t)
  nativeRunner(f, "process.stdout.write('x'.repeat(4096)); setInterval(() => {}, 1000);\n", { maxOutputBytes: 128 })
  const r = await f.execute({ commandRunner: undefined })
  assert.equal(r.processResult.terminationReason, "process_output_budget_exceeded")
  assert(r.processResult.supervision.outputBytes > 128)
  assert.equal(r.processResult.supervision.processExitObserved, true)
  storedFailure(f, r)
})

test("native runner heartbeat persists executing state, not proof of GPU or training progress", async (t) => {
  const f = fixture(t)
  nativeRunner(f, `
import fs from 'node:fs';
const file = '.runtime/ai-painter/stage4-v2-formal-executions/test-batch/execution-state.json';
const timer = setInterval(() => {
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  const s = state.processResult?.supervision;
  if (s?.lastSupervisorHeartbeatAtUtc) {
    process.stdout.write(JSON.stringify({ executionState: state.executionState, activityEvidenceStatus: state.activityEvidenceStatus,
      gpuStarted: state.gpuStarted, trainingStarted: state.trainingStarted, heartbeatScope: s.heartbeatScope }));
    clearInterval(timer);
  }
}, 10);
`, { heartbeatIntervalMs: 25 })
  const r = await f.execute({ commandRunner: undefined })
  assert.equal(r.processResult.exitCode, 0)
  const observed = JSON.parse(r.processResult.stdoutTail)
  assert.deepEqual(observed, { executionState: "executing", activityEvidenceStatus: "unknown", gpuStarted: null,
    trainingStarted: null, heartbeatScope: "parent_supervisor_not_training_progress" })
  storedFailure(f, r)
})

test("timeout never terminates an unrelated CPU child started outside this execution", async (t) => {
  const f = fixture(t)
  const other = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", windowsHide: true })
  const closed = new Promise((resolve) => other.once("close", resolve))
  await new Promise((resolve, reject) => { other.once("spawn", resolve); other.once("error", reject) })
  try {
    nativeRunner(f, "setInterval(() => {}, 1000);\n", { timeoutMs: 200, heartbeatIntervalMs: 25 })
    const r = await f.execute({ commandRunner: undefined })
    assert.equal(r.processResult.terminationReason, "process_timeout")
    assert.notEqual(r.processResult.supervision.pid, other.pid)
    assert.equal(other.exitCode, null)
    assert.equal(other.signalCode, null)
    assert.equal(other.killed, false)
    storedFailure(f, r)
  } finally {
    // This fixture alone owns this unrelated process, not the batch supervisor.
    other.kill("SIGKILL")
    await closed
  }
})

for (const [name, mutate] of [
  ["missing budget", (pkg) => { delete pkg.resourceBudget }],
  ["missing timeout", (pkg) => { delete pkg.resourceBudget.timeoutMs }],
  ["zero timeout", (pkg) => { pkg.resourceBudget.timeoutMs = 0 }],
  ["negative timeout", (pkg) => { pkg.resourceBudget.timeoutMs = -1 }],
  ["fractional timeout", (pkg) => { pkg.resourceBudget.timeoutMs = 1.5 }],
  ["string timeout", (pkg) => { pkg.resourceBudget.timeoutMs = "3000" }],
  ["boolean timeout", (pkg) => { pkg.resourceBudget.timeoutMs = true }],
  ["null timeout", (pkg) => { pkg.resourceBudget.timeoutMs = null }],
  ["timer overflow", (pkg) => { pkg.resourceBudget.timeoutMs = 2147483648 }],
  ["missing termination grace", (pkg) => { delete pkg.resourceBudget.terminationGraceMs }],
  ["zero termination grace", (pkg) => { pkg.resourceBudget.terminationGraceMs = 0 }],
  ["missing heartbeat", (pkg) => { delete pkg.resourceBudget.heartbeatIntervalMs }],
  ["heartbeat after timeout", (pkg) => { pkg.resourceBudget.heartbeatIntervalMs = 3001 }],
  ["missing output limit", (pkg) => { delete pkg.resourceBudget.maxOutputBytes }],
  ["zero output limit", (pkg) => { pkg.resourceBudget.maxOutputBytes = 0 }],
  ["unsafe output limit", (pkg) => { pkg.resourceBudget.maxOutputBytes = Number.MAX_SAFE_INTEGER + 1 }],
]) test(`invalid package resource budget blocks all dispatch: ${name}`, async (t) => {
  const f = fixture(t)
  // A bad later-stage budget also blocks Stage0, not just the invalid stage.
  updatePackage(f, f.inputs[2], mutate)
  let calls = 0
  const r = await f.execute({ commandRunner: () => { calls++; throw new Error("must not dispatch") } })
  assert.equal(r.status, "blocked")
  assert.match(r.blocker, /formal process/)
  assert.equal(calls, 0)
  assert.equal(r.activityEvidenceStatus, "not_started")
  assert.equal(r.gpuStarted, false)
  assert.equal(r.trainingStarted, false)
})

test("timed-out child cannot advance using an otherwise passing terminal or exit zero", async (t) => {
  const f = fixture(t)
  const r = await f.execute({ commandRunner: async (args) => {
    const result = await f.emit(args)
    return { ...result, terminationReason: "process_timeout" }
  } })
  assert.equal(r.status, "failed_closed")
  assert.match(r.blocker, /stage_0_process_timeout/)
  assert.equal(r.completedStages.length, 0)
  assert.equal(f.emitted.length, 1)
  assert.equal(r.gpuStarted, true)
  assert.equal(r.trainingStarted, true)
  assert.equal(r.activityEvidenceStatus, "verified")
})

test("resource budget is revalidated at stage consumption, preserving the successful predecessor", async (t) => {
  const f = fixture(t)
  const r = await f.execute({ commandRunner: async (args) => {
    const result = await f.emit(args)
    if (args.stage.stage === 0) updatePackage(f, f.inputs[1], (pkg) => { delete pkg.resourceBudget.timeoutMs })
    return result
  } })
  assert.equal(r.status, "failed_closed")
  assert.match(r.blocker, /resource budget invalid: timeoutMs/)
  assert.equal(r.failedTrainingStage, 1)
  assert.deepEqual(f.emitted.map((v) => v.stage), [0])
  assert.equal(r.completedStages.length, 1)
})

test("native supervisor persistence failure terminates its child and still records a failed terminal", async (t) => {
  const f = fixture(t)
  nativeRunner(f, "setInterval(() => {}, 1000);\n")
  const write = fs.writeFileSync
  let injected = false
  fs.writeFileSync = function (file, data, ...args) {
    if (!injected && String(file).includes("execution-state.json.") && typeof data === "string"
      && JSON.parse(data).processResult?.supervision?.spawned) {
      injected = true
      throw new Error("fixture heartbeat storage failure")
    }
    return write.call(this, file, data, ...args)
  }
  let r
  try { r = await f.execute({ commandRunner: undefined }) } finally { fs.writeFileSync = write }
  assert.equal(injected, true)
  assert.equal(r.processResult.terminationReason, "supervision_persistence_failed")
  assert.equal(r.processResult.supervision.processExitObserved, true)
  assert.match(r.processResult.supervision.supervisionError, /heartbeat storage failure/)
  assert.deepEqual(r.processResult.executionPackage, f.inputs[0].executionPackage)
  storedFailure(f, r)
})
test("duplicate stage inputs are rejected", async (t) => {
  const f = fixture(t)
  const r = await f.execute({ stageInputs: [f.inputs[0], f.inputs[0]] })
  assert.equal(r.status, "blocked")
  assert.match(r.blocker, /duplicate stage/)
})
test("caller-selected parent is rejected before any stage starts", async (t) => {
  const f = fixture(t)
  f.inputs[1].parentCheckpointPath = "historical.pt"
  const r = await f.execute()
  assert.equal(r.status, "blocked")
  assert.match(r.blocker, /caller-selected formal parent/)
  assert.equal(f.emitted.length, 0)
})
test("plan cannot escape the output namespace", async (t) => {
  const f = fixture(t)
  f.plan.runId = "../../escape"
  await assert.rejects(f.execute(), /runId is invalid/)
  assert(!fs.existsSync(path.join(f.root, ".runtime")))
})
test("plan cannot relabel another model as V2", async (t) => {
  const f = fixture(t)
  f.plan.capabilityVersion = "old-model"
  await assert.rejects(f.execute(), /capability mismatch/)
})

test("the declared runtime junction supports actual stage artifacts", async (t) => {
  const f = fixture(t)
  const hot = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-hot-storage-"))
  t.after(() => {
    const real = fs.realpathSync(hot)
    assert.equal(path.dirname(real), fs.realpathSync(os.tmpdir()))
    assert(path.basename(real).startsWith("stage4-hot-storage-"))
    fs.rmSync(real, { recursive: true, force: true })
  })
  fs.symlinkSync(hot, path.join(f.root, ".runtime"), process.platform === "win32" ? "junction" : "dir")
  const r = await f.execute()
  assert.equal(r.status, "completed", r.blocker)
  assert(fs.existsSync(path.join(hot, "ai-painter/stage4-v2-formal-executions/test-batch/phase-terminal.json")))
})

test("a nested junction cannot escape the declared runtime mount", async (t) => {
  const f = fixture(t)
  const hot = path.join(f.root, "runtime-physical")
  const escape = path.join(f.root, "not-runtime")
  fs.mkdirSync(hot)
  fs.mkdirSync(escape)
  fs.symlinkSync(hot, path.join(f.root, ".runtime"), process.platform === "win32" ? "junction" : "dir")
  fs.symlinkSync(escape, path.join(hot, "ai-painter"), process.platform === "win32" ? "junction" : "dir")
  await assert.rejects(f.execute(), /escapes declared storage/)
  assert.equal(fs.readdirSync(escape).length, 0)
})
for (const [label, mutate, pattern] of [
  ["cross-capability terminal", ({ terminal }) => { terminal.capabilityVersion = "old-model" }, /capability mismatch/],
  ["actual wrong parent", ({ manifest }) => { manifest.loadedParentCheckpoint = { path: "old", sha256: "0".repeat(64) } }, /loaded parent mismatch/],
  ["validation weight updates", ({ manifest }) => { manifest.nonTrainOptimizerSteps = 1 }, /non-train/],
  ["failed review", ({ review }) => { review.failCount = 1 }, /strictly equal/],
  ["missing GPU proof", ({ terminal }) => { terminal.gpuStarted = false }, /GPU execution/],
  ["empty passing review", ({ review }) => { review.passCount = 0 }, /no passing nodes/],
]) test(label + " fails without advancing subsequent stages", async (t) => {
  const f = fixture(t)
  const r = await f.execute({ commandRunner: (args) => f.emit(args, mutate) })
  assert.equal(r.status, "failed_closed")
  assert.match(r.blocker, pattern)
  assert.equal(r.completedStages.length, 0)
  assert.equal(f.emitted.length, 1)
  if (label === "failed review") assert.equal(r.trainingStarted, true)
})
test("parent file changed between stages is rejected before the next child", async (t) => {
  const f = fixture(t)
  const r = await f.execute({ commandRunner: async (args) => {
    const result = await f.emit(args)
    if (args.stage.stage === 0) {
      const binding = f.emitted[0].checkpoint
      // A getter mutates the already-bound predecessor during next preflight.
      let called = false
      const input = f.inputs[1]
      const originalPackage = input.executionPackage
      Object.defineProperty(input, "executionPackage", {
        get: () => {
          if (!called) { fs.appendFileSync(path.join(f.root, binding.path), "tampered"); called = true }
          return originalPackage
        },
      })
    }
    return result
  } })
  assert.equal(r.status, "failed_closed")
  assert.match(r.blocker, /file SHA-256 mismatch/)
  assert.equal(r.completedStages.length, 1)
  assert.equal(f.emitted.length, 1)
})

function beforeNextStagePreflight(f, stage, mutate) {
  const input = f.inputs[stage], original = input.executionPackage
  let called = false
  Object.defineProperty(input, "executionPackage", { get: () => {
    if (!called) { called = true; mutate() }
    return original
  } })
}

for (const [nextStage, ancestorStage] of [[1, 0], [2, 1], [2, 0]]) {
  for (const file of ["manifest.json", "review.json"]) {
    test(`Stage${nextStage} rejects accepted Stage${ancestorStage} ${file} changed before consumption`, async (t) => {
      const f = fixture(t)
      const artifact = path.posix.dirname(f.inputs[ancestorStage].outputTerminalPath) + "/" + file
      let changed
      const r = await f.execute({ commandRunner: async (args) => {
        const result = await f.emit(args)
        if (args.stage.stage === nextStage - 1) beforeNextStagePreflight(f, nextStage, () => {
          const value = JSON.parse(fs.readFileSync(path.join(f.root, artifact), "utf8"))
          if (file === "manifest.json") value.packageId = "foreign-formal-chain"
          else { value.status = "stage4_v2_machine_review_failed"; value.failCount = 1 }
          changed = f.write(artifact, value)
        })
        return result
      } })
      assert.equal(r.status, "failed_closed")
      assert.equal(r.failedTrainingStage, nextStage)
      assert.match(r.blocker, /file SHA-256 mismatch/)
      assert(r.blocker.includes(artifact))
      assert.deepEqual(f.emitted.map((v) => v.stage), Array.from({ length: nextStage }, (_, i) => i))
      assert.equal(r.completedStages.length, nextStage)
      const terminal = JSON.parse(fs.readFileSync(path.join(f.root, r.terminalPath), "utf8"))
      assert.equal(terminal.executionState, "failed_closed")
      assert.equal(terminal.failedTrainingStage, nextStage)
      assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(f.root, artifact))).digest("hex"), changed.sha256,
        "failure must preserve the conflicting evidence, not rewrite it to pass")
    })
  }
}

test("Stage2 rejects an earlier Stage0 identity replacement even while direct Stage1 parent stays intact", async (t) => {
  const f = fixture(t)
  let directParentBefore
  const r = await f.execute({ commandRunner: async (args) => {
    const result = await f.emit(args)
    if (args.stage.stage === 1) beforeNextStagePreflight(f, 2, () => {
      directParentBefore = fs.readFileSync(path.join(f.root, f.inputs[1].outputTerminalPath))
      const value = JSON.parse(fs.readFileSync(path.join(f.root, f.inputs[0].outputTerminalPath), "utf8"))
      value.runId = "another-stage0-run"
      f.write(f.inputs[0].outputTerminalPath, value)
    })
    return result
  } })
  assert.equal(r.status, "failed_closed")
  assert.equal(r.failedTrainingStage, 2)
  assert.match(r.blocker, /file SHA-256 mismatch/)
  assert(r.blocker.includes(f.inputs[0].outputTerminalPath))
  assert.deepEqual(fs.readFileSync(path.join(f.root, f.inputs[1].outputTerminalPath)), directParentBefore)
  assert.deepEqual(f.emitted.map((v) => v.stage), [0, 1])
})

for (const [name, targetStage, mutate] of [
  ["foreign run identity", 0, (v) => { v.runId = "foreign-run" }],
  ["failed status", 0, (v) => { v.status = "failed_closed" }],
  ["self-reported ancestor", 1, (v) => { v.parent = null }],
  ["foreign run identity", 2, (v) => { v.runId = "foreign-run" }],
  ["failed status", 2, (v) => { v.status = "failed_closed" }],
]) test(`Stage${targetStage} terminal TOCTOU (${name}) fails in that stage before acceptance`, async (t) => {
  const f = fixture(t)
  const r = await f.execute({ commandRunner: async (args) => {
    const result = await f.emit(args)
    if (args.stage.stage !== targetStage) return result
    let reads = 0
    return { get exitCode() {
      // Change disk after the terminal snapshot was read. The accepted binding
      // must remain the SHA of that same buffer; never adopt the replacement.
      if (++reads === 2) {
        const value = JSON.parse(fs.readFileSync(path.join(f.root, args.input.outputTerminalPath), "utf8"))
        mutate(value)
        f.write(args.input.outputTerminalPath, value)
      }
      return 0
    } }
  } })
  assert.equal(r.status, "failed_closed")
  assert.equal(r.failedTrainingStage, targetStage)
  assert.match(r.blocker, /file SHA-256 mismatch/)
  assert.equal(r.completedStages.length, targetStage)
  assert.deepEqual(f.emitted.map((v) => v.stage), Array.from({ length: targetStage + 1 }, (_, i) => i))
})

test("child-visible parent bindings cannot mutate an earlier accepted chain anchor", async (t) => {
  const f = fixture(t)
  let acceptedAncestorSha
  const r = await f.execute({ commandRunner: async (args) => {
    if (args.stage.stage === 1) {
      acceptedAncestorSha = args.parent.terminal.sha256
      const ancestor = JSON.parse(fs.readFileSync(path.join(f.root, args.parent.terminal.path), "utf8"))
      ancestor.runId = "forged-ancestor"
      // Test-seam mutation models an untrusted child's replacement lineage;
      // it must not rewrite the supervisor's independent accepted history.
      Object.assign(args.parent.terminal, f.write(args.parent.terminal.path, ancestor))
    }
    return f.emit(args)
  } })
  assert.equal(r.status, "failed_closed")
  assert.equal(r.failedTrainingStage, 1)
  assert.match(r.blocker, /file SHA-256 mismatch/)
  assert.equal(r.completedStages.length, 1)
  assert.equal(r.completedStages[0].terminal.sha256, acceptedAncestorSha)
  assert.deepEqual(f.emitted.map((v) => v.stage), [0, 1])
})

test("Stage2 binds the exact read buffer even if disk changes before readFileSync returns", async (t) => {
  const f = fixture(t), read = fs.readFileSync
  const target = path.resolve(f.root, f.inputs[2].outputTerminalPath)
  let armed = false, changed = false
  fs.readFileSync = function (file, ...args) {
    const bytes = read.call(this, file, ...args)
    if (armed && !changed && typeof file === "string" && path.resolve(file) === target && Buffer.isBuffer(bytes)) {
      changed = true
      const value = JSON.parse(bytes.toString("utf8"))
      value.runId = "disk-replaced-after-read"
      fs.writeFileSync(target, JSON.stringify(value))
    }
    return bytes
  }
  let r
  try {
    r = await f.execute({ commandRunner: async (args) => {
      const result = await f.emit(args)
      if (args.stage.stage === 2) armed = true
      return result
    } })
  } finally { fs.readFileSync = read }
  assert.equal(changed, true)
  assert.equal(r.status, "failed_closed")
  assert.equal(r.failedTrainingStage, 2)
  assert.equal(r.completedStages.length, 2)
  assert.match(r.blocker, /file SHA-256 mismatch/)
})

for (const file of ["manifest.json", "review.json"]) {
  test(`final Stage2 acceptance rechecks earlier Stage0 ${file} changed during the last child`, async (t) => {
    const f = fixture(t)
    const artifact = path.posix.dirname(f.inputs[0].outputTerminalPath) + "/" + file
    const r = await f.execute({ commandRunner: async (args) => {
      const result = await f.emit(args)
      if (args.stage.stage === 2) fs.appendFileSync(path.join(f.root, artifact), " ")
      return result
    } })
    assert.equal(r.status, "failed_closed")
    assert.equal(r.failedTrainingStage, 2)
    assert.equal(r.completedStages.length, 2)
    assert.match(r.blocker, /file SHA-256 mismatch/)
    assert(r.blocker.includes(artifact))
    const terminal = JSON.parse(fs.readFileSync(path.join(f.root, r.terminalPath), "utf8"))
    assert.equal(terminal.executionState, "failed_closed")
    assert.equal(terminal.completedStages.length, 2)
  })
}
