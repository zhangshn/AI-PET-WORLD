import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { inspectCandidate, validateCandidate } from
  "../check-ai-painter-mvp256-dry-v25-candidate.mjs"
import { validateCandidate as validateV24Candidate } from
  "../check-ai-painter-mvp256-dry-v24-candidate.mjs"
import { reconcile as reconcileV24Review } from
  "../reconcile-ai-painter-mvp256-dry-v24-review.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = logical => JSON.parse(fs.readFileSync(path.join(root, logical), "utf8"))

function fixture() {
  const candidate = read("data/ai-painter/system-governance/stage4-mvp256-dry-v25-head-dropout-cpu-candidate-v1.json")
  const facts = {
    parent: read(candidate.predecessor.candidateContract.path),
    terminal: read(candidate.predecessor.trainingTerminal.path),
    audit: read(candidate.predecessor.failedVisualAudit.path),
    fit: read(candidate.predecessor.trainFitDiagnostic.path),
  }
  return { candidate, facts }
}

test("real bound inactive V25 candidate is CPU-only and current run is idle", () => {
  const report = inspectCandidate(root)
  assert.equal(report.status, "cpu_only_inactive_not_execution_qualified")
  assert.equal(report.gpuQualified, false)
  assert.equal(report.trainingStarted, false)
  assert.equal(report.stage4Advanced, false)
  assert.equal(report.currentRegistryChecked, true)
  assert.deepEqual(report.activationBlockedBy,
    ["v25_managed_package_not_bound", "v25_gpu_qualifier_not_bound",
      "v25_training_worker_not_bound", "current_candidate_gpu_qualification_missing"])
  assert.equal(report.specification.registered, true)
  assert.equal(report.specification.executionQualifiedByDocument, false)
  assert.ok(Number.isInteger(report.currentRegistryReviewProjection.revision))
  assert.equal(typeof report.currentRegistryReviewProjection
    .auditRecordedButRegistryStillTrainingReviewPending, "boolean")
})

test("activation, old-checkpoint and old-GPU reuse claims fail closed", () => {
  for (const mutate of [
    value => { value.activation.gpuQualificationAllowed = true },
    value => { value.activation.trainingAllowed = true },
    value => { value.predecessor.checkpointMayInitializeV25 = true },
    value => { value.predecessor.historicalGpuQualificationMayBeReused = true },
    value => { value.formalSpecificationStatus = "registered" },
    value => { value.historicallyViewedValidationIsIndependentChallenge = true },
  ]) {
    const { candidate, facts } = fixture()
    mutate(candidate)
    assert.throws(() => validateCandidate(candidate, facts))
  }
})

test("source, model, scope and review rewrites fail closed", () => {
  for (const mutate of [
    ({ candidate }) => { candidate.singleChange.probability = 0.2 },
    ({ candidate }) => { candidate.scope.resolution = [512, 384] },
    ({ candidate }) => { candidate.inheritWithoutChange.sourceRgbOrConditionsModified = true },
    ({ candidate }) => { candidate.proposedExecutionCeiling.epochs = 96 },
    ({ candidate }) => { candidate.candidateProgram.model.path =
      "ml/ai-painter/src/ai_painter/complete_world/native_rgb_complete_support_partition_v23_cpu.py" },
    ({ candidate }) => { candidate.predecessor.failedVisualAudit.path =
      candidate.predecessor.trainingTerminal.path },
    ({ facts }) => { facts.parent.dataUse.train = 47 },
    ({ facts }) => { facts.audit.visualApprovalGranted = true },
    ({ facts }) => { facts.audit.issueCodes.pop() },
    ({ facts }) => { facts.fit.boundary.optimizerSteps = 1 },
  ]) {
    const record = fixture()
    mutate(record)
    assert.throws(() => validateCandidate(record.candidate, record.facts))
  }
})

test("consumed V24 candidate validator cannot interpret V25 as V24", () => {
  const { candidate } = fixture()
  assert.throws(() => validateV24Candidate(candidate, {}))
})

test("V24 failed-review registry reconciliation check never writes", async () => {
  const registryPath = path.join(root,
    ".runtime/ai-painter/current-execution-registry/current.json")
  const before = fs.readFileSync(registryPath)
  const result = await reconcileV24Review({ root, execute: false })
  assert.ok(["review_reconciliation_preflight_passed", "already_reconciled"]
    .includes(result.status))
  assert.equal(result.stage4Advanced, false)
  assert.ok(fs.readFileSync(registryPath).equals(before))
})
