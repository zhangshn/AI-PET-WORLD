import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import test from "node:test"

import { inspectCandidate, validateCandidate } from
  "../check-ai-painter-mvp256-dry-v24-candidate.mjs"

const root = path.resolve(import.meta.dirname, "../..")
const contract = JSON.parse(fs.readFileSync(path.join(root,
  "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")))
const read = logical => JSON.parse(fs.readFileSync(path.join(root, logical)))
const sourceRun = "v24-resource-bound-core-priority-049a77d0f96ffff8eb1ee4b2363e28f1802ab0bf4fbd6a15"
const inputs = Object.fromEntries(Object.entries(contract.frozenBindings).map(([key, binding]) =>
  [key === "datasetManifest" ? "manifest" : key === "trainSplit" ? "train"
    : key === "validationSplit" ? "validation" : key, read(binding.path)]))
inputs.terminal = read(`.runtime/ai-painter/learning-capacity-experiments/${sourceRun}/terminal.json`)
const copy = value => structuredClone(value)
const currentPath = ".runtime/ai-painter/current-execution-registry/current.json"
const terminalPath = `.runtime/ai-painter/learning-capacity-experiments/${sourceRun}/terminal.json`
const hash = bytes => createHash("sha256").update(bytes).digest("hex")

function candidateFixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "v24-candidate-regression-"))
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(temporary).startsWith("v24-candidate-regression-"))
    fs.rmSync(temporary, { recursive: true })
  })
  const put = (logical, bytes) => {
    const destination = path.resolve(temporary, logical)
    assert.ok(destination.startsWith(temporary + path.sep))
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, bytes)
  }
  const contractPath = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
  put(contractPath, fs.readFileSync(path.join(root, contractPath)))
  for (const binding of Object.values(contract.frozenBindings)) {
    const bytes = fs.readFileSync(path.join(root, binding.path))
    assert.equal(hash(bytes), binding.sha256)
    put(binding.path, bytes)
  }
  const terminal = fs.readFileSync(path.join(root, terminalPath))
  put(terminalPath, terminal)
  // Synthetic registry only in the isolated fixture; the real registry keeps advancing.
  const registry = { testFixtureOnly: true, activeExecution: null,
    latestTrainingTerminal: { runId: sourceRun, sha256: hash(terminal) } }
  const writeRegistry = value => put(currentPath, JSON.stringify(value))
  writeRegistry(registry)
  return { root: temporary, registry, writeRegistry, put }
}

test("isolated historical V24 registry preserves current checks and exact split/use limits", t => {
  const fixture = candidateFixture(t)
  const result = inspectCandidate(fixture.root)
  assert.equal(result.status, "cpu_candidate_boundary_valid_not_execution_qualified")
  assert.equal(result.gpuStarted, false)
  assert.equal(result.trainingStarted, false)
  assert.equal(result.currentRegistryChecked, true)
  assert.deepEqual(result.checkpointEpochs, [24, 36, 48])
})

test("current checks reject foreign runs, active execution and changed evidence in isolation", t => {
  const fixture = candidateFixture(t)
  for (const [alter, message] of [
    [r => { r.latestTrainingTerminal.runId = "synthetic-successor" }, /not the latest registered/],
    [r => { r.latestTrainingTerminal.sha256 = "0".repeat(64) }, /registered V24 terminal changed/],
    [r => { r.activeExecution = { runId: "synthetic-active" } }, /active run requires/],
    [r => { delete r.latestTrainingTerminal }, /not the latest registered/],
  ]) {
    const registry = copy(fixture.registry)
    alter(registry)
    fixture.writeRegistry(registry)
    assert.throws(() => inspectCandidate(fixture.root), message)
  }
  fixture.writeRegistry(fixture.registry)
  const binding = contract.frozenBindings.trainSplit
  fixture.put(binding.path, Buffer.concat([fs.readFileSync(path.join(root, binding.path)), Buffer.from(" ")]))
  assert.throws(() => inspectCandidate(fixture.root), /binding changed/)
})

test("scope, split leakage and source promotion mutations fail closed", () => {
  for (const mutate of [
    (c) => { c.scope.waterFactPresent = true },
    (c) => { c.scope.formalStage4Qualification = true },
    (c, i) => { c.scope.subjectSampleId = i.train.sampleIds[0] },
    (c, i) => { i.validation.sampleIds[0] = i.train.sampleIds[0] },
    (c) => { c.dataUse.weightUpdatesFrom = ["train", "validation"] },
    (c) => { c.checkpointSelection.historicalV24CheckpointMayInitializeTraining = true },
    (c, i) => { i.terminal.checkpointPromotable = true },
  ]) {
    const candidate = copy(contract)
    const evidence = copy(inputs)
    mutate(candidate, evidence)
    assert.throws(() => validateCandidate(candidate, evidence))
  }
})

test("resource escalation, review shortcuts and premature activation fail closed", () => {
  for (const mutate of [
    c => { c.executionCeiling.trainingAttempts = 2 },
    c => { c.executionCeiling.maxGpuMemoryFraction = 1 },
    c => { c.checkpointSelection.eligibleEpochs = [48] },
    c => { c.review.numericThresholdOverridesAllowed = true },
    c => { c.review.numericPassIsVisualApproval = true },
    c => { c.activation.trainingAllowed = true },
    c => { c.activation.runtimePublicationAllowed = true },
  ]) {
    const candidate = copy(contract)
    mutate(candidate)
    assert.throws(() => validateCandidate(candidate, copy(inputs)))
  }
})
