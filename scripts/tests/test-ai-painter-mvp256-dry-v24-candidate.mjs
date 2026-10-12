import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
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

test("bound current CPU candidate remains inactive and has exact split/use limits", () => {
  const result = inspectCandidate(root)
  assert.equal(result.status, "cpu_candidate_boundary_valid_not_execution_qualified")
  assert.equal(result.gpuStarted, false)
  assert.equal(result.trainingStarted, false)
  assert.deepEqual(result.checkpointEpochs, [24, 36, 48])
})

test("scope, split leakage and source promotion mutations fail closed", () => {
  for (const mutate of [
    (c, i) => { c.scope.waterFactPresent = true },
    (c, i) => { c.scope.formalStage4Qualification = true },
    (c, i) => { c.scope.subjectSampleId = i.train.sampleIds[0] },
    (c, i) => { i.validation.sampleIds[0] = i.train.sampleIds[0] },
    (c, i) => { c.dataUse.weightUpdatesFrom = ["train", "validation"] },
    (c, i) => { c.checkpointSelection.historicalV24CheckpointMayInitializeTraining = true },
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
