import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { buildBasePackage, run, runReviewPipeline, PROGRAMS, updateHeartbeat,
  readNumericCpuProof, NUMERIC_CPU, HISTORICAL_SPECIFICATION } from
  "../run-ai-painter-mvp256-dry-v26-v2-training.mjs"
import { bind, boundJson, writeExclusive } from "../run-ai-painter-mvp256-dry-v24-training.mjs"

const root = path.resolve(import.meta.dirname, "../..")
const parent = JSON.parse(fs.readFileSync(path.join(root,
  "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")))
test("numeric proof binds real CPU report, original data and exact historical specification", () => {
  const proof = readNumericCpuProof(root, bind(root, NUMERIC_CPU), parent)
  assert.equal(proof.realTrainComparison.actualAutogradCalls, 10)
  assert.equal(proof.realTrainComparison.optimizerSteps, 0)
  assert.equal(HISTORICAL_SPECIFICATION.sha256,
    "1131b337bae2638ac7b8ec4c507c0b5514954b941222069ff65f2478eb619e45")
})
test("old or fabricated CPU evidence is rejected rather than inherited", () => {
  for (const binding of [
    bind(root, ".runtime/ai-painter/stage4-mvp256-dry-v26-cpu/report.json"),
    { path: NUMERIC_CPU, sha256: "0".repeat(64) },
  ]) assert.throws(() => readNumericCpuProof(root, binding, parent))
})
const fake = name => ({ path: `fixture/${name}`, sha256: "a".repeat(64) })
function ready(directory) {
  return { root: directory, registryRevision: 1, registrySha256: "b".repeat(64),
    parent, policyBinding: fake("policy"), policy: { predecessorCandidate: fake("parent"),
      cpuAcceptance: fake("cpu"), predecessorReviewTerminal: fake("prior-review") },
    programBindings: Object.fromEntries(Object.keys(PROGRAMS).map(role => [role, fake(role)])) }
}
function temporary(body) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aip-v26-v2-cpu-"))
  return Promise.resolve().then(() => body(directory)).finally(() => {
    assert.ok(path.resolve(directory).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`))
    fs.rmSync(directory, { recursive: true })
  })
}

test("V26 acyclic base remains inactive with all review components bound", () => {
  const value = ready(root)
  const base = buildBasePackage({ policy: value.policy, parent,
    policyBinding: value.policyBinding, runId: "v26-v2-fixture-run", packageId: "v26-v2-fixture-package",
    outputRoot: ".runtime/ai-painter/stage4-mvp256-dry-v26-v2-executions/fixture",
    programBindings: value.programBindings })
  assert.equal(base.trainingAllowed, false)
  assert.equal("trainingTicket" in base, false)
  assert.ok(base.programBindings.reconciliation)
})

test("duplicate V26 claim cannot launch any command", () => temporary(async directory => {
  const output = path.join(directory, ".runtime/ai-painter/stage4-mvp256-dry-v26-v2-executions")
  fs.mkdirSync(output, { recursive: true })
  const file = path.join(output, "single-training-attempt-claim.json")
  fs.writeFileSync(file, '{"fixture":"consumed"}\n', { flag: "wx" })
  const before = fs.readFileSync(file)
  await assert.rejects(run({ execute: true, preflightReady: ready(directory),
    registry: { read: async () => ({ ok: true, registry: { activeExecution: null, registryRevision: 1 },
      registrySha256: "b".repeat(64) }), advance: async () => assert.fail("duplicate changed registry") },
    command: async () => assert.fail("duplicate launched command") }), { code: "EEXIST" })
  assert.deepEqual(fs.readFileSync(file), before)
}))

test("persistent heartbeat error closes GPU preflight without retry or training", () => temporary(async directory => {
  let state = { activeExecution: null, registryRevision: 1 }, callback, calls = 0
  const original = Object.assign(new Error("heartbeat publication failed"), { code: "EPERM" })
  const registry = {
    read: async () => ({ ok: true, registry: state, registrySha256: "b".repeat(64) }),
    advance: async options => { state = { ...state, ...options,
      registryRevision: state.registryRevision + 1 }; return { ok: true } },
  }
  const result = await run({ execute: true, preflightReady: ready(directory), registry,
    processIdentityReader: () => "fixture-identity",
    intervalFactory: value => { callback = value; return 1 }, intervalClear: () => {},
    heartbeatUpdater: () => { throw original },
    command: async ({ signal }) => {
      calls += 1; callback(); assert.equal(signal.reason, original)
      throw new Error("child stopped")
    } })
  assert.equal(calls, 1)
  assert.equal(result.status, "failed_closed")
  const failure = boundJson(directory, result.failure)
  assert.equal(failure.abortReason.code, "EPERM")
  assert.equal(failure.trainingStarted, false)
  assert.equal(failure.automaticRetryStarted, false)
  assert.equal(state.activeExecution, null)
}))

test("review pipeline orders CPU comparison, audit, reconciliation without a GPU command", () =>
  temporary(async directory => {
    fs.mkdirSync(path.join(directory, "run"))
    const terminalBinding = writeExclusive(directory, "run/training.json", { fixture: true })
    const compared = writeExclusive(directory, "run/comparison.json", { fixture: true })
    const audit = writeExclusive(directory, "run/audit.json", { fixture: true })
    const end = writeExclusive(directory, "run/end.json", { fixture: true })
    const calls = []
    const result = await runReviewPipeline({ root: directory, terminalBinding,
      outputRoot: "run", runId: "v26-v2-fixture", packageId: "v26-v2-package", programBindings: {},
      command: async ({ args }) => {
        calls.push(args)
        if (calls.length === 1) return { stdout: JSON.stringify(compared) }
        if (calls.length === 2) return { stdout: JSON.stringify({ report: audit }) }
        return { stdout: JSON.stringify({ status: "dry_single_world_review_failed_closed", terminal: end }) }
      } })
    assert.equal(result.status, "dry_single_world_review_failed_closed")
    assert.equal(calls.length, 3)
    assert.ok(calls[0][1].replaceAll("\\", "/").endsWith(PROGRAMS.cpuReview))
    assert.ok(calls[1][0].replaceAll("\\", "/").endsWith(PROGRAMS.independentAudit))
    assert.ok(calls[2][0].replaceAll("\\", "/").endsWith(PROGRAMS.reconciliation))
    assert.ok(calls.every(args => !args.includes("--run") && !args.includes("--package")))
  }))

test("review failure preserves successful training identity and terminates once", () =>
  temporary(async directory => {
    fs.mkdirSync(path.join(directory, "run"))
    const terminalBinding = writeExclusive(directory, "run/training.json", { fixture: true })
    const before = fs.readFileSync(path.join(directory, terminalBinding.path))
    let state = { activeExecution: null, runId: "v26-v2-fixture", registryRevision: 2,
      latestTrainingTerminal: terminalBinding }, calls = 0
    const registry = {
      read: async () => ({ ok: true, registry: state, registrySha256: "c".repeat(64) }),
      advance: async options => { assert.equal("latestTrainingTerminal" in options, false)
        state = { ...state, ...options }; return { ok: true } },
    }
    const result = await runReviewPipeline({ root: directory, terminalBinding, registry,
      outputRoot: "run", runId: "v26-v2-fixture", packageId: "v26-v2-package", programBindings: {},
      command: async () => { calls += 1; throw new Error("CPU review failed") } })
    assert.equal(result.status, "review_execution_failed_closed")
    assert.equal(calls, 1)
    assert.equal(state.activity, result.status)
    assert.deepEqual(state.latestTrainingTerminal, terminalBinding)
    assert.deepEqual(fs.readFileSync(path.join(directory, terminalBinding.path)), before)
  }))

test("foreign heartbeat cannot be overwritten", () => temporary(directory => {
  fs.mkdirSync(path.join(directory, "run"))
  const file = path.join(directory, "run/heartbeat.json")
  fs.writeFileSync(file, '{"runId":"foreign","processId":1}\n')
  const before = fs.readFileSync(file)
  assert.throws(() => updateHeartbeat(directory, "run", { runId: "v26-v2-owned", processId: 1 }))
  assert.deepEqual(fs.readFileSync(file), before)
}))
