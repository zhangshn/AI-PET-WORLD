import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { spawn, spawnSync } from "node:child_process"
import test from "node:test"

import { bind, boundJson } from "../run-ai-painter-mvp256-dry-v24-training.mjs"
import { buildBasePackage, preflight, validatePolicy, updateHeartbeat,
  heartbeatFailureEvidence, run, validateRecoveryBoundary } from
  "../run-ai-painter-mvp256-dry-v25-training.mjs"

const root = path.resolve(import.meta.dirname, "../..")
const policyPath = "data/ai-painter/system-governance/stage4-mvp256-dry-v25-head-dropout-execution-policy-v2.json"

test("V25 fixed policy binds CPU acceptance and cannot borrow V24 qualification", () => {
  const policyBinding = bind(root, policyPath)
  const policy = boundJson(root, policyBinding)
  const parent = boundJson(root, policy.predecessorCandidate)
  const proposal = boundJson(root, policy.cpuProposal)
  assert.equal(validatePolicy({ root, policy, policyBinding, parent, proposal }).status,
    "v25_cpu_acceptance_passed")
  const programBindings = { worker: bind(root,
    "ml/ai-painter/scripts/painter_stage4_v25_dry_single_world_checkpoint_worker.py") }
  const base = buildBasePackage({ policy, parent, policyBinding,
    runId: "mvp256-dry-v25-example", packageId: "v25-package-example",
    outputRoot: ".runtime/ai-painter/stage4-mvp256-dry-v25-executions/example",
    programBindings: Object.fromEntries([
      "worker", "workerTests", "gpuQualifier", "gpuQualifierTests",
      "supervisor", "supervisorTests", "packageChain", "packageChainTests",
      "model", "modelTests", "probe", "probeTests", "v24Worker", "v24Profile",
    ].map(role => [role, programBindings.worker])) })
  assert.equal(base.trainingAllowed, false)
  assert.equal("gpuQualification" in base, false)
  assert.notEqual(base.capabilityVersion, parent.capabilityVersion)
  const wrong = structuredClone(policy)
  wrong.cpuAcceptance = proposal.predecessor.failedVisualAudit
  assert.throws(() => validatePolicy({ root, policy: wrong,
    policyBinding, parent, proposal }))
})

test("V25 managed preflight stays CPU-only", async () => {
  const claimPath = path.join(root,
    ".runtime/ai-painter/stage4-mvp256-dry-v25-executions/single-training-attempt-claim.json")
  const before = fs.existsSync(claimPath) ? fs.readFileSync(claimPath) : null
  const result = await preflight({ projectRoot: root })
  assert.equal(result.policy.capabilityVersion,
    "stage4_mvp256_dry_object_head_train_dropout_v25_v1")
  assert.equal(result.policy.activation.trainingAllowed, false)
  const after = fs.existsSync(claimPath) ? fs.readFileSync(claimPath) : null
  assert.deepEqual(after, before, "CPU preflight must preserve an already consumed claim")
})

test("V25 consumed production claim cannot be restarted after the heartbeat repair", async context => {
  const claimPath = path.join(root,
    ".runtime/ai-painter/stage4-mvp256-dry-v25-executions/single-training-attempt-claim.json")
  if (!fs.existsSync(claimPath)) { context.skip("no consumed production claim present"); return }
  const before = fs.readFileSync(claimPath)
  const registryPath = path.join(root, ".runtime/ai-painter/current-execution-registry/current.json")
  const registryBefore = fs.readFileSync(registryPath)
  const ready = await preflight({ projectRoot: root })
  await assert.rejects(run({ execute: true, preflightReady: ready,
    command: async () => assert.fail("no GPU or training command after consumed claim") }),
  { code: "EEXIST" })
  assert.deepEqual(fs.readFileSync(claimPath), before)
  assert.deepEqual(fs.readFileSync(registryPath), registryBefore)
})

test("V25 recovery refuses changed budgets, checkpoints, predecessor identities and attempt counts", () => {
  const policy = boundJson(root, bind(root, policyPath))
  for (const mutate of [
    value => { value.recovery.additionalExecutionAttempts = 2 },
    value => { value.recovery.historicalCheckpointMayInitialize = true },
    value => { value.recovery.predecessorFailure.sha256 = "0".repeat(64) },
    value => { value.recovery.historicalSpecification.sha256 = "0".repeat(64) },
    value => { value.recovery.heartbeatPublication.maxWaitMilliseconds = 10_000 },
    value => { value.executionCeiling.epochs = 96 },
    value => { value.singleChange.probability = 0.2 },
    value => { value.executionVersion = "unknown" },
  ]) {
    const changed = structuredClone(policy)
    mutate(changed)
    assert.throws(() => validateRecoveryBoundary(root, changed))
  }
})

test("V25 recovery claim is single-use and cannot start a command twice", async () => {
  const ready = await preflight({ projectRoot: root })
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aip-v25-recovery-claim-"))
  const directory = path.join(fixtureRoot, ".runtime/ai-painter/stage4-mvp256-dry-v25-executions")
  fs.mkdirSync(directory, { recursive: true })
  const claimPath = path.join(directory, "single-heartbeat-recovery-v2-attempt-claim.json")
  const before = Buffer.from('{"status":"already_consumed_fixture"}\n')
  fs.writeFileSync(claimPath, before)
  const registry = {
    read: async () => ({ ok: true, registry: { activeExecution: null, registryRevision: 1 },
      registrySha256: "a".repeat(64) }),
    advance: async () => assert.fail("duplicate claim must not change registry"),
  }
  try {
    await assert.rejects(run({ projectRoot: fixtureRoot, execute: true, recovery: true,
      preflightReady: { ...ready, root: fixtureRoot, registryRevision: 1,
        registrySha256: "a".repeat(64) }, registry,
      command: async () => assert.fail("no GPU or training command after consumed recovery claim") }),
    { code: "EEXIST" })
    assert.deepEqual(fs.readFileSync(claimPath), before)
    assert.deepEqual(fs.readdirSync(directory), [path.basename(claimPath)])
  } finally {
    assert.ok(fixtureRoot.startsWith(`${os.tmpdir()}${path.sep}`))
    fs.rmSync(fixtureRoot, { recursive: true })
  }
})

test("V25 heartbeat identity mismatch cannot replace or stage another run's heartbeat", () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aip-v25-heartbeat-identity-"))
  const directory = path.join(fixtureRoot, "run")
  fs.mkdirSync(directory)
  const target = path.join(directory, "heartbeat.json")
  const previous = Buffer.from('{"runId":"other-run","processId":123}\n')
  fs.writeFileSync(target, previous)
  try {
    assert.throws(() => updateHeartbeat(fixtureRoot, "run", { runId: "owned-run", processId: 123 }))
    assert.deepEqual(fs.readFileSync(target), previous)
    assert.deepEqual(fs.readdirSync(directory), ["heartbeat.json"])
  } finally {
    assert.ok(fixtureRoot.startsWith(`${os.tmpdir()}${path.sep}`))
    fs.rmSync(fixtureRoot, { recursive: true })
  }
})

test("V25 preserves the original heartbeat publication failure through child cancellation", async () => {
  const ready = await preflight({ projectRoot: root })
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aip-v25-heartbeat-cancel-"))
  const original = Object.assign(new Error("heartbeat destination locked"), {
    code: "EPERM", syscall: "rename", path: "same.staged", dest: "heartbeat.json",
    heartbeatPublication: { attempts: 21, automaticTrainingRetries: 0 },
  })
  let state = { activeExecution: null, registryRevision: 1 }
  let callback, commandCalls = 0
  const registry = {
    read: async () => ({ ok: true, registry: state, registrySha256: "a".repeat(64) }),
    advance: async options => {
      state = { ...state, activeExecution: options.activeExecution,
        registryRevision: state.registryRevision + 1 }
      return { ok: true }
    },
  }
  try {
    const result = await run({ projectRoot: fixtureRoot, execute: true, recovery: true,
      preflightReady: { ...ready, root: fixtureRoot, registryRevision: 1,
        registrySha256: "a".repeat(64) }, registry,
      processIdentityReader: () => "cpu-fixture-process",
      intervalFactory: fn => { callback = fn; return 1 }, intervalClear: () => {},
      heartbeatUpdater: () => { throw original },
      command: async ({ signal }) => {
        commandCalls += 1
        callback()
        assert.equal(signal.reason, original)
        throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" })
      },
    })
    assert.equal(result.status, "failed_closed")
    const failure = boundJson(fixtureRoot, result.failure)
    assert.deepEqual(failure.abortReason, heartbeatFailureEvidence(original))
    assert.equal(failure.abortReason.code, "EPERM")
    assert.equal(failure.optimizerStepsGenerator, 0)
    assert.equal(failure.automaticRetryStarted, false)
    assert.equal(state.activeExecution, null)
    assert.equal(commandCalls, 1, "no training or command retry after persistent failure")
  } finally {
    assert.ok(fixtureRoot.startsWith(`${os.tmpdir()}${path.sep}`))
    fs.rmSync(fixtureRoot, { recursive: true })
  }
})

for (const { lockMs, recovers } of [{ lockMs: 800, recovers: true },
  { lockMs: 2600, recovers: false }]) {
  test(`V25 actual Windows ${lockMs}ms read lock ${recovers ? "recovers" : "fails closed"}`,
    { skip: process.platform !== "win32", timeout: 10_000 }, async () => {
      const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aip-v25-heartbeat-"))
      const target = path.join(fixtureRoot, "run", "heartbeat.json")
      fs.mkdirSync(path.dirname(target))
      const identity = { runId: "v25-lock-fixture", processId: 123 }
      const previous = { ...identity, heartbeatAtUtc: "2026-01-01T00:00:00Z" }
      fs.writeFileSync(target, `${JSON.stringify(previous)}\n`)
      const escaped = target.replaceAll("'", "''")
      const script = `$stream=[System.IO.File]::Open('${escaped}',[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::Read); try { [Console]::WriteLine('locked'); Start-Sleep -Milliseconds ${lockMs} } finally { $stream.Dispose() }`
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script],
        { windowsHide: true })
      const completed = new Promise((resolve, reject) => {
        child.once("error", reject)
        child.once("close", code => code === 0 ? resolve() : reject(new Error(`reader exited ${code}`)))
      })
      completed.catch(() => {})
      try {
        await new Promise((resolve, reject) => {
          child.stdout.on("data", value => { if (value.toString().includes("locked")) resolve() })
          child.once("error", reject)
          child.once("close", () => reject(new Error("reader closed before lock")))
        })
        if (recovers) {
          const publication = updateHeartbeat(fixtureRoot, "run", identity)
          assert.equal(publication.recovered, true)
          assert.ok(publication.attempts > 1)
          assert.notEqual(JSON.parse(fs.readFileSync(target)).heartbeatAtUtc, previous.heartbeatAtUtc)
        } else {
          assert.throws(() => updateHeartbeat(fixtureRoot, "run", identity), error => {
            assert.ok(["EPERM", "EACCES", "EBUSY"].includes(error.code))
            assert.ok(error.heartbeatPublication.attempts <= 21)
            assert.equal(error.heartbeatPublication.automaticTrainingRetries, 0)
            return true
          })
          assert.deepEqual(JSON.parse(fs.readFileSync(target)), previous)
          const staged = fs.readdirSync(path.dirname(target)).filter(name => name.includes(".staged-"))
          assert.equal(staged.length, 1)
          assert.notEqual(JSON.parse(fs.readFileSync(path.join(path.dirname(target), staged[0]))).heartbeatAtUtc,
            previous.heartbeatAtUtc)
        }
        await completed
      } finally {
        if (child.exitCode === null && child.signalCode === null) await completed
        assert.ok(fixtureRoot.startsWith(`${os.tmpdir()}${path.sep}`))
        fs.rmSync(fixtureRoot, { recursive: true })
      }
    })
}

test("V25 base package is accepted by the Python qualifier without GPU", async () => {
  const ready = await preflight({ projectRoot: root })
  const parent = path.join(root, ".runtime/ai-painter/stage4-mvp256-dry-v25-executions")
  fs.mkdirSync(parent, { recursive: true })
  const directory = fs.mkdtempSync(path.join(parent, "package-"))
  assert.ok(path.resolve(directory).startsWith(`${path.resolve(parent)}${path.sep}`))
  try {
    const outputRoot = path.relative(root, directory).replaceAll("\\", "/")
    const base = buildBasePackage({ policy: ready.policy, parent: ready.parent,
      policyBinding: ready.policyBinding, runId: "v25-cpu-package-check",
      packageId: "v25-cpu-package-check-id", outputRoot,
      programBindings: ready.programBindings })
    const logical = `${outputRoot}/execution-package.json`
    const bytes = Buffer.from(`${JSON.stringify(base, null, 2)}\n`)
    fs.writeFileSync(path.join(directory, "execution-package.json"), bytes, { flag: "wx" })
    const code = "import sys;sys.path.insert(0,'ml/ai-painter/scripts');import qualify_stage4_mvp256_dry_v25_gpu as q;q.check_package({'path':sys.argv[1],'sha256':sys.argv[2]},check_registry=False);print('v25_package_cpu_valid')"
    const result = spawnSync(path.join(root, "ml/ai-painter/.venv/Scripts/python.exe"),
      ["-B", "-c", code, logical,
        crypto.createHash("sha256").update(bytes).digest("hex")], {
        cwd: root, encoding: "utf8", timeout: 120_000, windowsHide: true,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1",
          PYTHONPATH: path.join(root, "ml/ai-painter/src") },
      })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /v25_package_cpu_valid/u)
  } finally {
    fs.rmSync(directory, { recursive: true })
  }
})

test("V25 Python worker checks a full single-use ticket chain without CUDA", async () => {
  const ready = await preflight({ projectRoot: root })
  const parent = path.join(root, ".runtime/ai-painter/stage4-mvp256-dry-v25-executions")
  fs.mkdirSync(parent, { recursive: true })
  const directory = fs.mkdtempSync(path.join(parent, "ticket-cpu-fixture-"))
  assert.ok(path.resolve(directory).startsWith(`${path.resolve(parent)}${path.sep}`))
  try {
    const outputRoot = path.relative(root, directory).replaceAll("\\", "/")
    const runId = "v25-cpu-ticket-fixture"
    const packageId = "v25-cpu-ticket-fixture-package"
    const save = (name, value) => {
      const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
      fs.writeFileSync(path.join(directory, name), bytes, { flag: "wx" })
      return { path: `${outputRoot}/${name}`,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex") }
    }
    const base = buildBasePackage({ policy: ready.policy, parent: ready.parent,
      policyBinding: ready.policyBinding, runId, packageId, outputRoot,
      programBindings: ready.programBindings })
    const baseBinding = save("execution-package.json", base)
    const trainIds = boundJson(root, ready.parent.frozenBindings.trainSplit).sampleIds
    const state = { Model: "1".repeat(64), Critic: "2".repeat(64) }
    const gpu = {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v25-zero-update-gpu-gate-v1",
      status: "current_candidate_zero_update_gpu_qualification_passed",
      capabilityVersion: ready.policy.capabilityVersion,
      runId, packageId, executionPackage: baseBinding,
      candidateContract: ready.policyBinding,
      historicalV24QualificationReused: false,
      trainingModeStochasticityObserved: true,
      gpuInitialized: true, optimizerCreated: false,
      optimizerSteps: { generator: 0, discriminator: 0 },
      checkpointLoaded: false, checkpointWritten: false, weightsModified: false,
      caseCount: 48, generatorAutogradGradCalls: 192,
      discriminatorAutogradGradCalls: 48,
      initialStateSha256: state, finalStateSha256: state,
      trainingAllowedByThisArtifact: false,
      cases: trainIds.map((sampleId, trainOrdinal) => ({
        passed: true, dropoutTrainingMode: true,
        autogradGradCalls: 4, discriminatorAutogradGradCalls: 1,
        optimizerCreated: false, optimizerSteps: { generator: 0, discriminator: 0 },
        sourceTensorsUnchanged: true, rngRestored: true, gradFieldsCleared: true,
        initialStateSha256: state, finalStateSha256: state,
        case: { sampleId, split: "train", trainOrdinal },
      })),
    }
    const gpuBinding = save("zero-update-gpu-qualification.json", gpu)
    const lockBinding = save("managed-training-lock.json", {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v25-managed-lock-v1",
      status: "active_bound_single_attempt", runId, packageId,
      executionPackage: baseBinding, resourceBudget: base.resourceBudget })
    const launchBinding = save("supervisor-launch-identity.json", {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v25-launch-identity-v1",
      status: "managed_supervisor_identity_verified", runId, packageId,
      executionPackage: baseBinding, managedLock: lockBinding,
      processId: process.pid, processStartIdentity: `${process.pid}:cpu-fixture` })
    const ticket = save("training-ticket.json", {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v25-training-ticket-v1",
      status: "issued_single_use", capabilityVersion: ready.policy.capabilityVersion,
      runId, packageId, executionPackage: baseBinding,
      gpuQualification: gpuBinding, managedLock: lockBinding,
      launchIdentity: launchBinding,
      consumptionClaimPath: `${outputRoot}/training-ticket-consumed.json`,
      trainingAllowed: true, automaticRetries: 0,
      formalStage4QualificationAllowed: false,
      runtimePublicationAllowed: false,
    })
    const code = "import sys,torch;sys.path.insert(0,'ml/ai-painter/scripts');import painter_stage4_v25_dry_single_world_checkpoint_worker as w;g=w.authenticate_training_gate({'path':sys.argv[1],'sha256':sys.argv[2]},check_process=False);assert g.run_id==sys.argv[3];assert not torch.cuda.is_initialized();print('v25_ticket_cpu_valid')"
    const result = spawnSync(path.join(root, "ml/ai-painter/.venv/Scripts/python.exe"),
      ["-B", "-c", code, ticket.path, ticket.sha256, runId], {
        cwd: root, encoding: "utf8", timeout: 120_000, windowsHide: true,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1",
          PYTHONPATH: path.join(root, "ml/ai-painter/src") },
      })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /v25_ticket_cpu_valid/u)
  } finally {
    fs.rmSync(directory, { recursive: true })
  }
})
