import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import { validateBasePackage, validateActivationChain } from
  "../lib/ai-painter-mvp256-dry-v24-package-chain-v1.mjs"

const root = path.resolve(import.meta.dirname, "../..")
const candidate = JSON.parse(fs.readFileSync(path.join(root,
  "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")))
const binding = name => ({ path: `evidence/${name}`, sha256: "b".repeat(64) })
const fixture = () => {
  const candidateBinding = binding("candidate.json")
  const baseBinding = binding("base.json")
  const gpuBinding = binding("gpu.json")
  const lockBinding = binding("lock.json")
  const launchBinding = binding("launch.json")
  const ticketBinding = binding("ticket.json")
  const base = { schemaVersion: "ai-painter-stage4-mvp256-dry-v24-execution-package-v1",
    status: "issued_single_attempt", capabilityVersion: candidate.capabilityVersion,
    runId: "dry-run-0001", packageId: "dry-package-0001", candidateContract: candidateBinding,
    datasetManifest: candidate.frozenBindings.datasetManifest,
    trainSplit: candidate.frozenBindings.trainSplit,
    validationSplit: candidate.frozenBindings.validationSplit,
    resourceBudget: structuredClone(candidate.executionCeiling),
    trainingPlan: { epochs: 48, trainRows: 48, validationRows: 8,
      eligibleCheckpointEpochs: [24, 36, 48], generatorOptimizerSteps: 2304,
      discriminatorOptimizerSteps: 2304, historicalCheckpointLoaded: false },
    trainingAllowed: false, trainingIntent: "bounded_once",
    managedExecutionRequired: "javascript_managed_orchestration",
    formalStage4QualificationAllowed: false,
    runtimePublicationAllowed: false,
    execution: { reviewPlan: { boundedDryReviewAllowed: true,
      formalStage4QualificationAllowed: false, runtimePublicationAllowed: false,
      numericThresholdContract: candidate.frozenBindings.numericReview,
      detailThresholdContract: candidate.frozenBindings.detailReview } },
    programBindings: { worker: binding("worker.py"), workerTests: binding("test-worker.py") } }
  const gpu = { schemaVersion: "ai-painter-stage4-mvp256-dry-v24-zero-update-gpu-gate-v1",
    status: "current_candidate_zero_update_gpu_qualification_passed",
    capabilityVersion: candidate.capabilityVersion, runId: base.runId, packageId: base.packageId,
    executionPackage: baseBinding, candidateContract: candidateBinding,
    historicalV24QualificationReused: false,
    gpuInitialized: true, optimizerCreated: false, optimizerSteps: { generator: 0, discriminator: 0 },
    checkpointLoaded: false, checkpointWritten: false, weightsModified: false,
    generatorAutogradGradCalls: 192, discriminatorAutogradGradCalls: 48,
    initialStateSha256: { Model: "c".repeat(64), Critic: "d".repeat(64) },
    finalStateSha256: { Model: "c".repeat(64), Critic: "d".repeat(64) },
    caseCount: 48, cases: Array.from({ length: 48 }, (_, trainOrdinal) => ({
      passed: true, case: { split: "train", trainOrdinal,
        sampleId: `train-${trainOrdinal}` },
      generatorCandidate: { autogradGradCalls: 4 },
      discriminatorAutogradGradCalls: 1, optimizerCreated: false,
      optimizerSteps: { generator: 0, discriminator: 0 },
      sourceTensorsUnchanged: true, rngRestored: true,
      initialStateSha256: { Model: "c".repeat(64), Critic: "d".repeat(64) },
      finalStateSha256: { Model: "c".repeat(64), Critic: "d".repeat(64) },
      sourceTensorHashesBeforeAndAfter: { image: "e".repeat(64),
        conditions: "f".repeat(64) } })),
    trainingAllowedByThisArtifact: false }
  const lock = { schemaVersion: "ai-painter-stage4-mvp256-dry-v24-managed-lock-v1",
    status: "active_bound_single_attempt", runId: base.runId, packageId: base.packageId,
    executionPackage: baseBinding, resourceBudget: structuredClone(candidate.executionCeiling) }
  const launch = { schemaVersion: "ai-painter-stage4-mvp256-dry-v24-launch-identity-v1",
    status: "managed_supervisor_identity_verified", runId: base.runId, packageId: base.packageId,
    executionPackage: baseBinding, managedLock: lockBinding,
    processId: 1234, processStartIdentity: "1234:2026-09-30T00:00:00.000Z" }
  const ticket = { schemaVersion: "ai-painter-stage4-mvp256-dry-v24-training-ticket-v1",
    status: "issued_single_use", automaticRetries: 0,
    capabilityVersion: candidate.capabilityVersion, runId: base.runId, packageId: base.packageId,
    executionPackage: baseBinding, gpuQualification: gpuBinding, managedLock: lockBinding,
    launchIdentity: launchBinding, trainingAllowed: true,
    formalStage4QualificationAllowed: false, runtimePublicationAllowed: false }
  return { candidate, candidateBinding, base, baseBinding, gpu, gpuBinding,
    lock, lockBinding, launch, launchBinding, ticket, ticketBinding }
}

test("single-use evidence graph is acyclic and does not activate from a base package", () => {
  const x = fixture()
  assert.equal(validateBasePackage(x).status, "base_package_acyclic_not_training_qualified")
  assert.equal(validateActivationChain(x).status,
    "activation_chain_acyclic_bound_to_current_candidate")
})

test("circular binding, stale GPU identity and ticket shortcuts fail", () => {
  for (const mutate of [
    x => { x.base.gpuQualification = x.gpuBinding },
    x => { x.base.trainingAllowed = true },
    x => { x.gpu.executionPackage = binding("other-base.json") },
    x => { x.gpu.historicalV24QualificationReused = true },
    x => { x.ticket.gpuQualification = binding("old-gpu.json") },
    x => { x.ticket.trainingAllowed = false },
    x => { x.lock.trainingTicket = x.ticketBinding },
    x => { x.gpu.cases.pop(); x.gpu.caseCount = 47 },
    x => { x.gpu.cases[0].generatorCandidate.autogradGradCalls = 1 },
    x => { x.gpu.cases[0].discriminatorAutogradGradCalls = 0 },
    x => { x.gpu.finalStateSha256.Model = "0".repeat(64) },
    x => { x.launch.processStartIdentity = "other-process" },
  ]) {
    const x = fixture()
    mutate(x)
    assert.throws(() => {
      validateBasePackage(x)
      validateActivationChain(x)
    })
  }
})
