import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import { BUDGET, PLAN, CAPABILITY, validateBasePackage,
  validateActivationChain } from "../lib/ai-painter-mvp256-dry-v25-package-chain-v1.mjs"

const root = path.resolve(import.meta.dirname, "../..")
const parent = JSON.parse(fs.readFileSync(path.join(root,
  "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")))
const policy = JSON.parse(fs.readFileSync(path.join(root,
  "data/ai-painter/system-governance/stage4-mvp256-dry-v25-head-dropout-execution-policy-v1.json")))
const binding = name => ({ path: `evidence/${name}`, sha256: "b".repeat(64) })
const roles = ["worker", "workerTests", "gpuQualifier", "gpuQualifierTests",
  "supervisor", "supervisorTests", "packageChain", "packageChainTests",
  "model", "modelTests", "probe", "probeTests", "v24Worker", "v24Profile"]

function fixture() {
  const policyBinding = binding("policy.json")
  const baseBinding = binding("base.json")
  const gpuBinding = binding("gpu.json")
  const lockBinding = binding("lock.json")
  const launchBinding = binding("launch.json")
  const ticketBinding = binding("ticket.json")
  const outputRoot = ".runtime/ai-painter/stage4-mvp256-dry-v25-executions/run-0001"
  const base = {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v25-execution-package-v1",
    status: "issued_single_attempt", capabilityVersion: CAPABILITY,
    runId: "v25-run-0001", packageId: "v25-package-0001", outputRoot,
    candidateContract: policyBinding,
    sourceDataCandidate: policy.predecessorCandidate,
    cpuAcceptance: policy.cpuAcceptance,
    datasetManifest: parent.frozenBindings.datasetManifest,
    trainSplit: parent.frozenBindings.trainSplit,
    validationSplit: parent.frozenBindings.validationSplit,
    resourceBudget: structuredClone(BUDGET), trainingPlan: structuredClone(PLAN),
    trainingAllowed: false, trainingIntent: "bounded_once",
    managedExecutionRequired: "javascript_managed_orchestration",
    formalStage4QualificationAllowed: false, runtimePublicationAllowed: false,
    execution: { reviewPlan: { boundedDryReviewAllowed: true,
      formalStage4QualificationAllowed: false, runtimePublicationAllowed: false,
      numericThresholdContract: parent.frozenBindings.numericReview,
      detailThresholdContract: parent.frozenBindings.detailReview } },
    programBindings: Object.fromEntries(roles.map(role => [role, binding(`${role}.txt`)])),
  }
  const states = { Model: "c".repeat(64), Critic: "d".repeat(64) }
  const trainIds = Array.from({ length: 48 }, (_, index) => `train-${index}`)
  const gpu = {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v25-zero-update-gpu-gate-v1",
    status: "current_candidate_zero_update_gpu_qualification_passed",
    capabilityVersion: CAPABILITY, runId: base.runId, packageId: base.packageId,
    executionPackage: baseBinding, candidateContract: policyBinding,
    historicalV24QualificationReused: false, gpuInitialized: true,
    trainingModeStochasticityObserved: true,
    optimizerCreated: false, optimizerSteps: { generator: 0, discriminator: 0 },
    checkpointLoaded: false, checkpointWritten: false, weightsModified: false,
    generatorAutogradGradCalls: 192, discriminatorAutogradGradCalls: 48,
    initialStateSha256: states, finalStateSha256: states,
    caseCount: 48, trainingAllowedByThisArtifact: false,
    cases: trainIds.map((sampleId, trainOrdinal) => ({
      passed: true, dropoutTrainingMode: true, autogradGradCalls: 4,
      discriminatorAutogradGradCalls: 1, optimizerCreated: false,
      optimizerSteps: { generator: 0, discriminator: 0 },
      sourceTensorsUnchanged: true, rngRestored: true, gradFieldsCleared: true,
      initialStateSha256: states, finalStateSha256: states,
      sourceTensorHashesBeforeAndAfter: { image: "e".repeat(64),
        conditions: "f".repeat(64) },
      case: { sampleId, split: "train", trainOrdinal } })),
  }
  const lock = { schemaVersion: "ai-painter-stage4-mvp256-dry-v25-managed-lock-v1",
    status: "active_bound_single_attempt", runId: base.runId, packageId: base.packageId,
    executionPackage: baseBinding, resourceBudget: structuredClone(BUDGET) }
  const launch = { schemaVersion: "ai-painter-stage4-mvp256-dry-v25-launch-identity-v1",
    status: "managed_supervisor_identity_verified", runId: base.runId,
    packageId: base.packageId, executionPackage: baseBinding, managedLock: lockBinding,
    processId: 1234, processStartIdentity: "1234:2026-10-03T00:00:00.000Z" }
  const ticket = { schemaVersion: "ai-painter-stage4-mvp256-dry-v25-training-ticket-v1",
    status: "issued_single_use", capabilityVersion: CAPABILITY,
    runId: base.runId, packageId: base.packageId, executionPackage: baseBinding,
    gpuQualification: gpuBinding, managedLock: lockBinding,
    launchIdentity: launchBinding, trainingAllowed: true,
    automaticRetries: 0, formalStage4QualificationAllowed: false,
    runtimePublicationAllowed: false,
    consumptionClaimPath: `${outputRoot}/training-ticket-consumed.json` }
  return { base, policy, parent, policyBinding, baseBinding, gpu, gpuBinding,
    lock, lockBinding, launch, launchBinding, ticket, ticketBinding, trainIds }
}

test("V25 package and activation require separate current identities", () => {
  const x = fixture()
  assert.equal(validateBasePackage(x), true)
  assert.equal(validateActivationChain(x), true)
})

test("V24, fake dropout, mismatched train and ticket shortcuts fail", () => {
  for (const mutate of [
    x => { x.base.capabilityVersion = parent.capabilityVersion },
    x => { x.base.trainingAllowed = true },
    x => { x.base.gpuQualification = x.gpuBinding },
    x => { x.gpu.schemaVersion = "ai-painter-stage4-mvp256-dry-v24-zero-update-gpu-gate-v1" },
    x => { x.gpu.historicalV24QualificationReused = true },
    x => { x.gpu.cases[0].dropoutTrainingMode = false },
    x => { x.gpu.cases[0].autogradGradCalls = 1 },
    x => { x.gpu.cases[0].case.sampleId = "wrong-source" },
    x => { x.gpu.finalStateSha256 = { ...x.gpu.finalStateSha256, Model: "0".repeat(64) } },
    x => { x.ticket.gpuQualification = binding("old-gpu.json") },
    x => { x.ticket.trainingAllowed = false },
    x => { x.lock.trainingTicket = x.ticketBinding },
  ]) {
    const x = fixture()
    mutate(x)
    assert.throws(() => {
      validateBasePackage(x)
      validateActivationChain(x)
    })
  }
})
