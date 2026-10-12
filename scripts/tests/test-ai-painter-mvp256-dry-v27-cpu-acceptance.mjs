import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { testCounts, writeAcceptanceObservations, runRecordedStage } from "../run-ai-painter-mvp256-dry-v27-cpu-acceptance.mjs"
import { javascriptDependencyClosure, describePolicy } from "../run-ai-painter-mvp256-dry-v27-training.mjs"
import { bind, readBound, boundJson, writeExclusive } from "../run-ai-painter-mvp256-dry-v24-training.mjs"
const root = path.resolve(import.meta.dirname, "../..")
test("actual TAP and unittest counts are required, with no failures/skips/cuda", () => {
  const py = { testsRun: 5, failures: 0, errors: 0, skipped: 0, gpuInitialized: false,
    syntheticOptimizerSteps: { generator: 1, discriminator: 1 } }
  const tap = "# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n"
  assert.equal(testCounts(py, tap).passedTests, 8)
  for (const field of ["failures", "errors", "skipped", "gpuInitialized"])
    assert.throws(() => testCounts({ ...py, [field]: field === "gpuInitialized" ? true : 1 }, tap))
  assert.throws(() => testCounts(py, "caller says passed"))
  assert.throws(() => testCounts(py, tap.replace("# fail 0", "# fail 1")))
})
test("recursive JS closure includes only reachable local files and rejects unresolved imports", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v27-closure-"))
  try {
    fs.writeFileSync(path.join(dir, "a.mjs"), 'import "./b.mjs"; import "node:fs"')
    fs.writeFileSync(path.join(dir, "b.mjs"), 'export {x} from "./c.mjs"')
    fs.writeFileSync(path.join(dir, "c.mjs"), 'export const x=1; import("./a.mjs")')
    fs.writeFileSync(path.join(dir, "unreachable.mjs"), 'import "./absent.mjs"')
    assert.deepEqual(javascriptDependencyClosure(dir, ["a.mjs"]), ["a.mjs", "b.mjs", "c.mjs"])
    fs.writeFileSync(path.join(dir, "c.mjs"), 'import "./missing.mjs"')
    assert.throws(() => javascriptDependencyClosure(dir, ["a.mjs"]))
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
    fs.rmSync(dir, { recursive: true })
  }
})
test("policy description uses actual V24 parent scope and has no descendant graph", () => {
  const policy = describePolicy({ root, cpuAcceptance: { path: "fixture/cpu.json", sha256: "1".repeat(64) },
    programBindings: {} })
  assert.equal(policy.numericSuccessGate.preselectedSampleId,
    "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2")
  assert.equal(policy.singleChange.groupCount, 5)
  assert.equal(policy.singleChange.modelParameterTensorCount, 100)
  for (const field of ["executionPackage", "gpuQualification", "trainingTicket", "managedLock", "launchIdentity"])
    assert.equal(field in policy, false)
  assert.equal(policy.activation.trainingAllowed, false)
})

function observationFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v27-cpu-observation-"))
  t.after(() => {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
    fs.rmSync(dir, { recursive: true })
  })
  const file = (logical, bytes) => {
    fs.writeFileSync(path.join(dir, logical), bytes)
    return bind(dir, logical)
  }
  const registry = "registry.json"
  const registryBefore = Buffer.from('{ "revision": 7, "activeExecution": null }\r\n')
  file(registry, registryBefore)
  const predecessorClaims = [Buffer.from('{ "attempt": 1 }\r\n'), Buffer.from([0xff, 0x00, 0x0a])]
    .map((bytes, index) => ({ binding: file("old-claim-" + index + ".bin", bytes), bytes }))
  const out = "acceptance"
  const claim = writeExclusive(dir, out + "/claim.json", { scope: "isolated_mock_unit_fixture" })
  const plannedCommands = {
    python: { file: "mock-python", args: ["-B", "-c", "mock unit fixture"], root: dir, timeout: 25 },
    node: { file: process.execPath, args: ["--test", "mock unit fixture"], root: dir, timeout: 25 } }
  const input = { registry, registryBefore, registryObservedAtUtc: "2026-10-06T00:00:00.000Z",
    predecessorClaims, programBindings: { fixture: file("source.mjs", "// isolated unit fixture\n") },
    modelCpuEvidence: file("model-cpu.json", "{}\n"), formalSpecification: file("spec.md", "fixture spec\n"),
    executionGuide: file("guide.md", "fixture guide\n"), plannedCommands, sourceClosureCommands: [] }
  return { dir, out, claim, input, plannedCommands }
}

test("before execution observations bind exact registry/old claim bytes, sources, docs and commands", t => {
  const { dir, out, claim, input, plannedCommands } = observationFixture(t)
  const observations = writeAcceptanceObservations(dir, out, input)
  const recorded = boundJson(dir, observations)
  assert.deepEqual(recorded.claim, claim)
  assert.deepEqual(readBound(dir, recorded.registryBefore.snapshot), input.registryBefore)
  assert.equal(recorded.registryBefore.sha256, bind(dir, input.registry).sha256)
  for (const [index, row] of recorded.predecessorClaims.entries()) {
    assert.deepEqual(readBound(dir, row.snapshot), input.predecessorClaims[index].bytes)
    assert.deepEqual(row.binding, input.predecessorClaims[index].binding)
    readBound(dir, row.binding)
  }
  assert.deepEqual(recorded.programBindings, input.programBindings)
  for (const name of ["modelCpuEvidence", "formalSpecification", "executionGuide"]) {
    assert.deepEqual(recorded[name], input[name])
    readBound(dir, recorded[name])
  }
  for (const [stage, spec] of Object.entries(plannedCommands)) {
    const actual = recorded.plannedCommands[stage]
    assert.equal(actual.executable, spec.file)
    assert.deepEqual(actual.arguments, spec.args)
    assert.equal(actual.cwd, dir)
    assert.equal(actual.timeoutMs, spec.timeout)
    assert.match(actual.sha256, /^[a-f0-9]{64}$/u)
  }
  assert.deepEqual(fs.readFileSync(path.join(dir, input.registry)), input.registryBefore)
  assert.throws(() => writeAcceptanceObservations(dir, out, input), { code: "EEXIST" })
  assert.deepEqual(boundJson(dir, observations), recorded)
})

test("changed source observations fail before executing any phase", t => {
  const { dir, out, input } = observationFixture(t)
  fs.appendFileSync(path.join(dir, "source.mjs"), "// changed\n")
  assert.throws(() => writeAcceptanceObservations(dir, out, input), /bound evidence changed/u)
  assert.equal(fs.existsSync(path.join(dir, out, "observations.json")), false)
  assert.equal(fs.existsSync(path.join(dir, out, "python-started.json")), false)
})

test("mock stages persist start before invocation and real returned output before completion", async t => {
  const { dir, out, claim, input, plannedCommands } = observationFixture(t)
  const observations = writeAcceptanceObservations(dir, out, input)
  const evidence = {}
  const returned = {
    python: { stdout: JSON.stringify({ testsRun: 5, failures: 0, errors: 0, skipped: 0,
      gpuInitialized: false, syntheticOptimizerSteps: { generator: 1, discriminator: 1 } }), stderr: "mock unittest\n" },
    node: { stdout: "# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n", stderr: "" } }
  const results = {}
  for (const stage of ["python", "node"]) {
    results[stage] = await runRecordedStage(dir, out, stage, plannedCommands[stage], {
      claim, observations, evidence, command: async spec => {
        assert.deepEqual(spec, plannedCommands[stage])
        const started = boundJson(dir, evidence[stage].started)
        assert.equal(started.state, "started")
        assert.equal(started.outcome, "unknown")
        assert.deepEqual(started.observations, observations)
        assert.equal(started.command.timeoutMs, spec.timeout)
        assert.equal(fs.existsSync(path.join(dir, out, stage + "-completed.json")), false)
        return returned[stage]
      } })
    const complete = boundJson(dir, evidence[stage].completed)
    assert.equal(complete.outcome, "command_returned_successfully")
    assert.equal(complete.exitCode, 0)
    assert.deepEqual(boundJson(dir, complete.output), returned[stage])
    assert.deepEqual(complete.started, evidence[stage].started)
    assert.deepEqual(results[stage].result, returned[stage])
    assert.equal(results[stage].output.path, out + "/" + stage + "-test-output.json")
  }
  assert.equal(testCounts(JSON.parse(results.python.result.stdout), results.node.result.stdout).passedTests, 8)
  assert.equal(fs.existsSync(path.join(dir, out, "report.json")), false)
})

test("actual command rejection preserves partial output, exit and signal without a pass", async t => {
  const { dir, out, claim, input, plannedCommands } = observationFixture(t)
  const observations = writeAcceptanceObservations(dir, out, input)
  const evidence = {}
  const error = Object.assign(new Error("mock command exited"), {
    stdout: "partial stdout\n", stderr: "actual error\n", code: 2, signal: null, killed: false })
  await assert.rejects(runRecordedStage(dir, out, "python", plannedCommands.python, {
    claim, observations, evidence, command: async () => { throw error } }), value => value === error)
  const completed = boundJson(dir, evidence.python.completed)
  assert.equal(completed.state, "completed")
  assert.equal(completed.outcome, "command_error")
  assert.equal(completed.exitCode, 2)
  assert.deepEqual(boundJson(dir, completed.output), { stdout: error.stdout, stderr: error.stderr })
  assert.equal(fs.existsSync(path.join(dir, out, "node-started.json")), false)
  assert.equal(fs.existsSync(path.join(dir, out, "report.json")), false)
})

test("timeout records its real signal and leaves an unknown exit code", async t => {
  const { dir, out, claim, input, plannedCommands } = observationFixture(t)
  const observations = writeAcceptanceObservations(dir, out, input)
  const evidence = {}
  const error = Object.assign(new Error("mock timeout"), { code: "ETIMEDOUT", signal: "SIGTERM", killed: true })
  await assert.rejects(runRecordedStage(dir, out, "node", plannedCommands.node, {
    claim, observations, evidence, command: async () => { throw error } }), value => value === error)
  const completed = boundJson(dir, evidence.node.completed)
  assert.equal(completed.exitCode, null)
  assert.equal(completed.signal, "SIGTERM")
  assert.equal(completed.killed, true)
  assert.deepEqual(boundJson(dir, completed.output), { stdout: null, stderr: null })
})

test("an unfinished invocation has only unknown start evidence and exclusive claim blocks replay", async t => {
  const { dir, out, claim, input, plannedCommands } = observationFixture(t)
  const observations = writeAcceptanceObservations(dir, out, input)
  const evidence = {}
  let finish
  const pending = runRecordedStage(dir, out, "node", plannedCommands.node, {
    claim, observations, evidence, command: () => new Promise(resolve => { finish = resolve }) })
  try {
    const started = boundJson(dir, evidence.node.started)
    assert.equal(started.state, "started")
    assert.equal(started.outcome, "unknown")
    for (const name of ["node-test-output.json", "node-completed.json", "report.json", "failure.json"])
      assert.equal(fs.existsSync(path.join(dir, out, name)), false)
    assert.throws(() => writeExclusive(dir, out + "/claim.json", {}), { code: "EEXIST" })
    assert.deepEqual(bind(dir, out + "/claim.json"), claim)
    let invokedAgain = false
    await assert.rejects(runRecordedStage(dir, out, "node", plannedCommands.node, {
      claim, observations, command: async () => { invokedAgain = true; return { stdout: "", stderr: "" } } }),
    { code: "EEXIST" })
    assert.equal(invokedAgain, false)
  } finally {
    finish({ stdout: "mock released after unknown-state assertions\n", stderr: "" })
    await pending
  }
})

test("final source closure command also has bound stage and output evidence", async t => {
  const { dir, out, claim, input, plannedCommands } = observationFixture(t)
  const observations = writeAcceptanceObservations(dir, out, input)
  const evidence = {}
  const result = await runRecordedStage(dir, out, "source-recheck", plannedCommands.python, {
    claim, observations, evidence, command: async () => ({ stdout: '["source.mjs"]\n', stderr: "" }) })
  assert.equal(boundJson(dir, evidence["source-recheck"].completed).exitCode, 0)
  assert.equal(boundJson(dir, result.output).stdout, '["source.mjs"]\n')
})
