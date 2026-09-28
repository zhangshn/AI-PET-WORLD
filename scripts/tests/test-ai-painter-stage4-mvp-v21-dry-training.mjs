import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { drainTelemetryBeforeTerminal, preflight, recordPreparationFailure,
  run, trustedTelemetryFromProgress } from
  "../run-ai-painter-stage4-mvp-v21-dry-training.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const registryPath = path.join(root, ".runtime/ai-painter/current-execution-registry/current.json")
const claimPath = path.join(root,
  ".runtime/ai-painter/stage4-mvp-object-residual-v21-dry-executions/single-training-attempt-claim.json")

const identity = { runId: "synthetic-v21-run", packageId: "synthetic-v21-package" }
const progress = (overrides = {}) => ({
  phase: "training", ...identity, epoch: 1, batchIndex: 1, batchCount: 48,
  optimizationStep: 1, optimizerStepsGenerator: 1, optimizerStepsDiscriminator: 1,
  rawGeneratorLoss: 0.75, loss: 0.75, learningRate: 0.0001,
  throughputSamplesPerSecond: 2.5, estimatedCompletionAtUtc: null,
  checkpointIdentity: null, ...overrides,
})

test("trusted progress maps real nonnegative loss and never supplies worker PID", () => {
  const value = trustedTelemetryFromProgress(progress(), { ...identity, lastStep: 0 })
  assert.equal(value.optimizationStep, 1)
  assert.equal(value.loss, 0.75)
  assert.equal(Object.hasOwn(value, "processId"), false)
  const heartbeat = trustedTelemetryFromProgress(progress(), { ...identity, lastStep: 1 })
  assert.equal(heartbeat.optimizationStep, 1)
  assert.equal(heartbeat.loss, 0.75)
})

test("negative adversarial total loss stays raw in worker evidence and projects null", () => {
  const row = progress({ rawGeneratorLoss: -0.25, loss: null })
  const value = trustedTelemetryFromProgress(row, { ...identity, lastStep: 0 })
  assert.equal(row.rawGeneratorLoss, -0.25)
  assert.equal(value.loss, null)
  assert.throws(() => trustedTelemetryFromProgress(
    { ...row, loss: 0 }, { ...identity, lastStep: 0 }), /display_loss_not_truthful/)
})

test("missing and unrelated progress create no telemetry sample", () => {
  assert.equal(trustedTelemetryFromProgress(null, { ...identity, lastStep: 0 }), null)
  assert.equal(trustedTelemetryFromProgress(progress({ phase: "loading_train" }),
    { ...identity, lastStep: 0 }), null)
})

test("identity, step, resource and nonfinite progress are rejected", () => {
  for (const altered of [
    progress({ runId: "other" }), progress({ packageId: "other" }),
    progress({ optimizationStep: 2 }),
    progress({ optimizerStepsDiscriminator: 0 }),
    progress({ batchCount: 49 }),
    progress({ rawGeneratorLoss: Number.NaN }),
    progress({ learningRate: 0.001 }),
  ]) assert.throws(() => trustedTelemetryFromProgress(altered,
    { ...identity, lastStep: 0 }))
  assert.throws(() => trustedTelemetryFromProgress(progress(),
    { ...identity, lastStep: 2 }), /step_regressed/)
})

test("consumed claim leaves immutable preparation failure when output root is absent", () => {
  const writes = []
  const claim = { path: "fixed-claim.json", sha256: "a".repeat(64) }
  const failure = recordPreparationFailure({ root,
    outputRoot: ".runtime/ai-painter/stage4-mvp-object-residual-v21-dry-executions/run",
    claim, runId: "run", packageId: "package", error: new Error("mkdir failed") },
  { exists: () => false, write: (_root, logical, value) => {
    writes.push({ logical, value })
    return { path: logical, sha256: "b".repeat(64) }
  } })
  assert.equal(writes.length, 1)
  assert.match(failure.path, /single-training-attempt-prepare-failure\.json$/)
  assert.deepEqual(writes[0].value.claim, claim)
  assert.equal(writes[0].value.trainingStarted, false)
  assert.equal(writes[0].value.registryWritten, false)
  assert.equal(writes[0].value.automaticRetryStarted, false)
})

test("preparation evidence falls back beside claim if run-local write fails", () => {
  const writes = []
  recordPreparationFailure({ root,
    outputRoot: ".runtime/ai-painter/stage4-mvp-object-residual-v21-dry-executions/run",
    claim: { path: "fixed-claim.json", sha256: "a".repeat(64) },
    runId: "run", packageId: "package", error: new Error("ticket failed") },
  { exists: () => true, write: (_root, logical, value) => {
    writes.push({ logical, value })
    if (writes.length === 1) throw new Error("run directory unwritable")
    return { path: logical, sha256: "b".repeat(64) }
  } })
  assert.match(writes[0].logical, /\/prepare-failure\.json$/)
  assert.match(writes[1].logical, /single-training-attempt-prepare-failure\.json$/)
  assert.match(writes[1].value.primaryEvidenceWriteError, /run directory unwritable/)
})

test("preparation failure persists beside a real unchanged claim in an isolated temp root", () => {
  const base = fs.realpathSync(os.tmpdir())
  const isolated = fs.mkdtempSync(path.join(base, "v21-prepare-test-"))
  try {
    const claimLogical = ".runtime/ai-painter/stage4-mvp-object-residual-v21-dry-executions/single-training-attempt-claim.json"
    const claimAbsolute = path.join(isolated, ...claimLogical.split("/"))
    fs.mkdirSync(path.dirname(claimAbsolute), { recursive: true })
    const claimBytes = Buffer.from('{"attempt":"fixed-once"}\n')
    fs.writeFileSync(claimAbsolute, claimBytes, { flag: "wx" })
    const binding = { path: claimLogical, sha256: "a".repeat(64) }
    const failure = recordPreparationFailure({ root: isolated,
      outputRoot: ".runtime/ai-painter/stage4-mvp-object-residual-v21-dry-executions/absent-run",
      claim: binding, runId: "run", packageId: "package", error: new Error("ticket failed") })
    assert.deepEqual(fs.readFileSync(claimAbsolute), claimBytes)
    const failureAbsolute = path.join(isolated, ...failure.path.split("/"))
    assert.equal(fs.existsSync(failureAbsolute), true)
    const evidence = JSON.parse(fs.readFileSync(failureAbsolute, "utf8"))
    assert.deepEqual(evidence.claim, binding)
    assert.equal(evidence.status, "failed_closed")
    assert.equal(evidence.automaticRetryStarted, false)
    assert.equal(evidence.trainingStarted, false)
    assert.equal(evidence.registryWritten, false)
  } finally {
    const resolved = path.resolve(isolated)
    assert.ok(resolved.startsWith(`${base}${path.sep}`)
      && path.basename(resolved).startsWith("v21-prepare-test-"))
    fs.rmSync(resolved, { recursive: true })
  }
})

test("telemetry drains before terminal or reports an explicit bounded timeout", async () => {
  assert.deepEqual(await drainTelemetryBeforeTerminal(Promise.resolve(), 20),
    { drained: true })
  assert.deepEqual(await drainTelemetryBeforeTerminal(new Promise(() => {}), 5),
    { drained: false })
  const rejected = await drainTelemetryBeforeTerminal(
    Promise.reject(new Error("reporter failed")), 20)
  assert.equal(rejected.drained, true)
  assert.match(rejected.error, /reporter failed/)
  await assert.rejects(() => drainTelemetryBeforeTerminal(Promise.resolve(), 0),
    /drain_limit_invalid/)
})

test("real V21 Node CPU preflight verifies frozen reports without consuming attempt", async () => {
  const before = fs.readFileSync(registryPath)
  const claimBefore = fs.existsSync(claimPath) ? fs.readFileSync(claimPath) : null
  const ready = await preflight({ projectRoot: root })
  assert.equal(ready.candidateBinding.sha256,
    "f018ec0f7b6e9279e7a25d8abc82af8bd975c5768ec2a5c99a80b82f5b3d4c75")
  assert.equal(ready.cpuBinding.sha256,
    "cd8f014f0918633cfa3e2b7a0478a9b7476627ba1e19152b54e87c76b2219157")
  assert.equal(ready.gpuBinding.sha256,
    "a57772d878dacc4beb919271ce43d40222893050f3c7260fdb77481ca1918877")
  const result = await run({ projectRoot: root, execute: false })
  assert.equal(result.status, "cpu_preflight_passed_training_not_started")
  assert.equal(result.trainingStarted, false)
  const claimAfter = fs.existsSync(claimPath) ? fs.readFileSync(claimPath) : null
  assert.deepEqual(claimAfter, claimBefore)
  assert.deepEqual(fs.readFileSync(registryPath), before)
})
