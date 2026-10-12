// Immutable parent -> GPU evidence -> activation ticket. No hash cycles.
import assert from "node:assert/strict"

const CAPABILITY = "stage4_mvp256_dry_v24_closed_loop_candidate_v1"
const PACKAGE_SCHEMA = "ai-painter-stage4-mvp256-dry-v24-execution-package-v1"
const GPU_SCHEMA = "ai-painter-stage4-mvp256-dry-v24-zero-update-gpu-gate-v1"
const TICKET_SCHEMA = "ai-painter-stage4-mvp256-dry-v24-training-ticket-v1"
const BUDGET = { trainingAttempts: 1, automaticRetries: 0, epochs: 48,
  generatorOptimizerSteps: 2304, discriminatorOptimizerSteps: 2304,
  maxWallSeconds: 2700, maxGpuMemoryFraction: 0.7, maximumTemperatureC: 85,
  minimumFreeVramMiB: 2048, minimumFreeDiskMiB: 2048,
  maxOutputMiB: 128, cpuThreads: 2 }

const exactBinding = value => {
  assert.deepEqual(Object.keys(value ?? {}).sort(), ["path", "sha256"])
  assert.match(value.sha256, /^[0-9a-f]{64}$/u)
}

export function validateBasePackage({ base, candidate, candidateBinding }) {
  assert.equal(base.schemaVersion, PACKAGE_SCHEMA)
  assert.equal(base.status, "issued_single_attempt")
  assert.equal(base.capabilityVersion, CAPABILITY)
  exactBinding(candidateBinding)
  assert.deepEqual(base.candidateContract, candidateBinding)
  assert.deepEqual(base.datasetManifest, candidate.frozenBindings.datasetManifest)
  assert.deepEqual(base.trainSplit, candidate.frozenBindings.trainSplit)
  assert.deepEqual(base.validationSplit, candidate.frozenBindings.validationSplit)
  assert.deepEqual(base.resourceBudget, BUDGET)
  assert.deepEqual(base.trainingPlan, { epochs: 48, trainRows: 48, validationRows: 8,
    eligibleCheckpointEpochs: [24, 36, 48], generatorOptimizerSteps: 2304,
    discriminatorOptimizerSteps: 2304, historicalCheckpointLoaded: false })
  assert.equal(base.trainingAllowed, false)
  assert.equal(base.trainingIntent, "bounded_once")
  assert.equal(base.managedExecutionRequired, "javascript_managed_orchestration")
  assert.equal(base.formalStage4QualificationAllowed, false)
  assert.equal(base.runtimePublicationAllowed, false)
  assert.ok(typeof base.runId === "string" && base.runId.length >= 8)
  assert.ok(typeof base.packageId === "string" && base.packageId.length >= 8)
  assert.ok(base.runId !== base.packageId)
  assert.deepEqual(base.execution?.reviewPlan, {
    boundedDryReviewAllowed: true, formalStage4QualificationAllowed: false,
    runtimePublicationAllowed: false,
    numericThresholdContract: candidate.frozenBindings.numericReview,
    detailThresholdContract: candidate.frozenBindings.detailReview })
  assert.ok(base.programBindings?.worker && base.programBindings?.workerTests)
  for (const value of Object.values(base.programBindings)) exactBinding(value)
  assert.equal("gpuQualification" in base, false, "GPU result cannot be parent of itself")
  assert.equal("managedExecution" in base, false, "launch identity cannot be parent of itself")
  assert.equal("trainingTicket" in base, false, "ticket cannot be parent of itself")
  return { status: "base_package_acyclic_not_training_qualified", runId: base.runId }
}

export function validateActivationChain({ base, baseBinding, gpu, gpuBinding,
  lock, lockBinding, launch, launchBinding, ticket, ticketBinding }) {
  for (const binding of [baseBinding, gpuBinding, lockBinding, launchBinding, ticketBinding])
    exactBinding(binding)
  assert.equal(gpu.schemaVersion, GPU_SCHEMA)
  assert.equal(gpu.status, "current_candidate_zero_update_gpu_qualification_passed")
  assert.equal(gpu.capabilityVersion, CAPABILITY)
  assert.equal(gpu.runId, base.runId)
  assert.equal(gpu.packageId, base.packageId)
  assert.deepEqual(gpu.executionPackage, baseBinding)
  assert.deepEqual(gpu.candidateContract, base.candidateContract)
  assert.equal(gpu.historicalV24QualificationReused, false)
  assert.equal(gpu.gpuInitialized, true)
  assert.equal(gpu.optimizerCreated, false)
  assert.deepEqual(gpu.optimizerSteps, { generator: 0, discriminator: 0 })
  assert.equal(gpu.checkpointLoaded, false)
  assert.equal(gpu.checkpointWritten, false)
  assert.equal(gpu.weightsModified, false)
  assert.deepEqual(gpu.finalStateSha256, gpu.initialStateSha256)
  assert.equal(gpu.generatorAutogradGradCalls, 192)
  assert.equal(gpu.discriminatorAutogradGradCalls, 48)
  assert.equal(gpu.caseCount, 48)
  assert.equal(gpu.cases?.length, 48)
  const ids = gpu.cases.map((row, ordinal) => {
    assert.equal(row.passed, true)
    assert.equal(row.case?.split, "train")
    assert.equal(row.case?.trainOrdinal, ordinal)
    assert.equal(row.generatorCandidate?.autogradGradCalls, 4)
    assert.equal(row.discriminatorAutogradGradCalls, 1)
    assert.equal(row.optimizerCreated, false)
    assert.deepEqual(row.optimizerSteps, { generator: 0, discriminator: 0 })
    assert.equal(row.sourceTensorsUnchanged, true)
    assert.equal(row.rngRestored, true)
    assert.deepEqual(row.initialStateSha256, gpu.initialStateSha256)
    assert.deepEqual(row.finalStateSha256, gpu.initialStateSha256)
    assert.deepEqual(Object.keys(row.sourceTensorHashesBeforeAndAfter ?? {}).sort(),
      ["conditions", "image"])
    return row.case?.sampleId
  })
  assert.equal(new Set(ids).size, 48)
  assert.equal(gpu.trainingAllowedByThisArtifact, false)
  assert.equal(lock.runId, base.runId)
  assert.equal(lock.schemaVersion, "ai-painter-stage4-mvp256-dry-v24-managed-lock-v1")
  assert.equal(lock.status, "active_bound_single_attempt")
  assert.equal(lock.packageId, base.packageId)
  assert.deepEqual(lock.executionPackage, baseBinding)
  assert.deepEqual(lock.resourceBudget, BUDGET)
  assert.equal(launch.runId, base.runId)
  assert.equal(launch.schemaVersion, "ai-painter-stage4-mvp256-dry-v24-launch-identity-v1")
  assert.equal(launch.status, "managed_supervisor_identity_verified")
  assert.equal(launch.packageId, base.packageId)
  assert.deepEqual(launch.executionPackage, baseBinding)
  assert.deepEqual(launch.managedLock, lockBinding)
  assert.ok(Number.isSafeInteger(launch.processId) && launch.processId > 0)
  assert.ok(typeof launch.processStartIdentity === "string"
    && launch.processStartIdentity.startsWith(`${launch.processId}:`))
  assert.equal(ticket.schemaVersion, TICKET_SCHEMA)
  assert.equal(ticket.status, "issued_single_use")
  assert.equal(ticket.capabilityVersion, CAPABILITY)
  assert.equal(ticket.runId, base.runId)
  assert.equal(ticket.packageId, base.packageId)
  assert.deepEqual(ticket.executionPackage, baseBinding)
  assert.deepEqual(ticket.gpuQualification, gpuBinding)
  assert.deepEqual(ticket.managedLock, lockBinding)
  assert.deepEqual(ticket.launchIdentity, launchBinding)
  assert.equal(ticket.trainingAllowed, true)
  assert.equal(ticket.automaticRetries, 0)
  assert.equal(ticket.formalStage4QualificationAllowed, false)
  assert.equal(ticket.runtimePublicationAllowed, false)
  for (const [name, value] of [["base", base], ["gpu", gpu], ["lock", lock], ["launch", launch]])
    assert.equal("trainingTicket" in value, false, `${name} refers to its descendant ticket`)
  assert.equal("gpuQualification" in base, false)
  assert.equal("managedExecution" in base, false)
  return { status: "activation_chain_acyclic_bound_to_current_candidate",
    runId: base.runId, ticket: ticketBinding, trainingStarted: false }
}
