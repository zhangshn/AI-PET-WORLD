// V26-specific acyclic identity checks; V24 artifacts cannot satisfy these.
import assert from "node:assert/strict"

export const CAPABILITY = "stage4_mvp256_dry_object_local_context_isolation_v26_v2"
export const PACKAGE_SCHEMA = "ai-painter-stage4-mvp256-dry-v26-v2-execution-package-v1"
export const GPU_SCHEMA = "ai-painter-stage4-mvp256-dry-v26-v2-zero-update-gpu-gate-v1"
export const TICKET_SCHEMA = "ai-painter-stage4-mvp256-dry-v26-v2-training-ticket-v1"
export const BUDGET = { trainingAttempts: 1, automaticRetries: 0, epochs: 48,
  generatorOptimizerSteps: 2304, discriminatorOptimizerSteps: 2304,
  maxWallSeconds: 2700, maxGpuMemoryFraction: 0.7, maximumTemperatureC: 85,
  minimumFreeVramMiB: 2048, minimumFreeDiskMiB: 2048,
  maxOutputMiB: 128, cpuThreads: 2 }
export const PLAN = { epochs: 48, trainRows: 48, validationRows: 8,
  eligibleCheckpointEpochs: [24, 36, 48], generatorOptimizerSteps: 2304,
  discriminatorOptimizerSteps: 2304, historicalCheckpointLoaded: false }

export function exactBinding(value) {
  assert.deepEqual(Object.keys(value ?? {}).sort(), ["path", "sha256"])
  assert.equal(typeof value.path, "string")
  assert.ok(value.path && !value.path.includes("\\") && !value.path.includes(".."))
  assert.match(value.sha256, /^[0-9a-f]{64}$/u)
  return value
}

export function validateBasePackage({ base, policy, parent, policyBinding }) {
  assert.equal(base.schemaVersion, PACKAGE_SCHEMA)
  assert.equal(base.status, "issued_single_attempt")
  assert.equal(base.capabilityVersion, CAPABILITY)
  assert.deepEqual(base.candidateContract, exactBinding(policyBinding))
  assert.deepEqual(base.sourceDataCandidate, exactBinding(policy.predecessorCandidate))
  assert.deepEqual(base.cpuAcceptance, exactBinding(policy.cpuAcceptance))
  assert.deepEqual(base.datasetManifest, parent.frozenBindings.datasetManifest)
  assert.deepEqual(base.trainSplit, parent.frozenBindings.trainSplit)
  assert.deepEqual(base.validationSplit, parent.frozenBindings.validationSplit)
  assert.deepEqual(base.resourceBudget, BUDGET)
  assert.deepEqual(base.trainingPlan, PLAN)
  assert.equal(base.trainingAllowed, false)
  assert.equal(base.trainingIntent, "bounded_once")
  assert.equal(base.managedExecutionRequired, "javascript_managed_orchestration")
  assert.equal(base.formalStage4QualificationAllowed, false)
  assert.equal(base.runtimePublicationAllowed, false)
  assert.ok(typeof base.runId === "string" && base.runId.length >= 8)
  assert.ok(typeof base.packageId === "string" && base.packageId.length >= 8)
  assert.notEqual(base.runId, base.packageId)
  assert.deepEqual(base.execution?.reviewPlan, {
    boundedDryReviewAllowed: true, formalStage4QualificationAllowed: false,
    runtimePublicationAllowed: false,
    numericThresholdContract: parent.frozenBindings.numericReview,
    detailThresholdContract: parent.frozenBindings.detailReview })
  for (const value of Object.values(base.programBindings ?? {})) exactBinding(value)
  for (const role of ["worker", "workerTests", "gpuQualifier", "gpuQualifierTests",
    "supervisor", "supervisorTests", "packageChain", "packageChainTests",
    "model", "modelTests", "probe", "probeTests", "v24Worker", "v24Profile",
    "cpuReview", "independentAudit", "reconciliation", "reviewTests", "reconciliationTests"])
    assert.ok(base.programBindings?.[role], `V26 missing ${role}`)
  for (const name of ["gpuQualification", "trainingTicket", "managedExecution"])
    assert.equal(name in base, false, "V26 base package points to descendant")
  return true
}

export function validateActivationChain({ base, baseBinding, gpu, gpuBinding,
  lock, lockBinding, launch, launchBinding, ticket, ticketBinding,
  trainIds }) {
  for (const value of [baseBinding, gpuBinding, lockBinding, launchBinding,
    ticketBinding]) exactBinding(value)
  assert.equal(gpu.schemaVersion, GPU_SCHEMA)
  assert.equal(gpu.status, "current_candidate_zero_update_gpu_qualification_passed")
  assert.equal(gpu.capabilityVersion, CAPABILITY)
  assert.equal(gpu.runId, base.runId)
  assert.equal(gpu.packageId, base.packageId)
  assert.deepEqual(gpu.executionPackage, baseBinding)
  assert.deepEqual(gpu.candidateContract, base.candidateContract)
  assert.equal(gpu.historicalV24QualificationReused, false)
  assert.equal(gpu.trainingModeDeterminismObserved, true)
  assert.equal(gpu.aggregationRule, "strict_deterministic_index_add_scoped_to_object_assembly_v1")
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
  assert.deepEqual(gpu.cases.map((row, ordinal) => {
    assert.equal(row.passed, true)
    assert.equal(row.case?.split, "train")
    assert.equal(row.case?.trainOrdinal, ordinal)
    assert.equal(row.contextIsolationRule, "zero_private_learned_terrain_patches_keep_local_facts_v1")
    assert.equal(row.aggregationRule, gpu.aggregationRule)
    assert.equal(row.autogradGradCalls, 4)
    assert.equal(row.discriminatorAutogradGradCalls, 1)
    assert.equal(row.optimizerCreated, false)
    assert.deepEqual(row.optimizerSteps, { generator: 0, discriminator: 0 })
    assert.equal(row.sourceTensorsUnchanged, true)
    assert.equal(row.rngRestored, true)
    assert.equal(row.gradFieldsCleared, true)
    assert.deepEqual(row.initialStateSha256, gpu.initialStateSha256)
    assert.deepEqual(row.finalStateSha256, gpu.initialStateSha256)
    assert.deepEqual(Object.keys(row.sourceTensorHashesBeforeAndAfter ?? {}).sort(),
      ["conditions", "image"])
    return row.case.sampleId
  }), trainIds)
  assert.equal(gpu.trainingAllowedByThisArtifact, false)
  assert.equal(lock.schemaVersion, "ai-painter-stage4-mvp256-dry-v26-v2-managed-lock-v1")
  assert.equal(lock.status, "active_bound_single_attempt")
  assert.equal(lock.runId, base.runId)
  assert.equal(lock.packageId, base.packageId)
  assert.deepEqual(lock.executionPackage, baseBinding)
  assert.deepEqual(lock.resourceBudget, BUDGET)
  assert.equal(launch.schemaVersion, "ai-painter-stage4-mvp256-dry-v26-v2-launch-identity-v1")
  assert.equal(launch.status, "managed_supervisor_identity_verified")
  assert.equal(launch.runId, base.runId)
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
  assert.equal(ticket.consumptionClaimPath,
    `${base.outputRoot}/training-ticket-consumed.json`)
  for (const [name, value] of [["base", base], ["gpu", gpu], ["lock", lock],
    ["launch", launch]])
    assert.equal("trainingTicket" in value, false, `${name} references ticket descendant`)
  return true
}
