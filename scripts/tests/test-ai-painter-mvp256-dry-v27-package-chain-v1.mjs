import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
test("registry dependency roles bind sorted canonical full paths and UTF-8 SHA256", () => {
  const paths = ["scripts/z.mjs", "ml/ai-painter/来源.py", "scripts/a.mjs"]
  const direct = { supervisor: binding("supervisor.mjs") }
  const readBinding = logical => ({ path: logical, sha256: "a".repeat(64) })
  const actual = addDependencyBindings(direct, [...paths, paths[0]], readBinding)
  assert.deepEqual(Object.keys(actual).slice(1), [...paths].sort().map(dependencyRole))
  for (const logical of paths) {
    const role = "dependency_" + crypto.createHash("sha256").update(logical, "utf8").digest("hex")
    assert.equal(dependencyRole(logical), role)
    assert.equal(role.length, 75)
    assert.match(role, /^[A-Za-z0-9._-]{1,80}$/u)
    assert.deepEqual(actual[role], readBinding(logical))
  }
  assert.notEqual(dependencyRole("a/shared.py"), dependencyRole("b/shared.py"))
  assert.equal(validateProgramBindings(actual), true)
})
test("role mapping rejects legacy roles, collisions, reserved names and noncanonical paths", () => {
  const logical = "scripts/source.mjs", item = { path: logical, sha256: "a".repeat(64) }
  for (const role of ["dependency:" + logical, "x".repeat(81), "constructor", "prototype", "__proto__"])
    assert.throws(() => validateProgramBindings(Object.fromEntries([[role, item]])))
  assert.throws(() => addDependencyBindings({ [dependencyRole(logical)]: item }, [logical], () => item))
  assert.throws(() => addDependencyBindings({ worker: item }, [logical], () => ({ ...item, path: "other.mjs" })))
  assert.throws(() => validateProgramBindings({ ["dependency_" + "0".repeat(64)]: item }))
  for (const invalid of ["../x.py", "/x.py", "a/./x.py", "a//x.py", "C:/x.py", "a\\x.py"])
    assert.throws(() => dependencyRole(invalid))
})
test("previous V27 and V27-v2 schemas and capability cannot activate V27-v3", () => {
  for (const mutate of [
    x => { x.base.capabilityVersion = "stage4_mvp256_dry_object_head_shared_hidden_v27" },
    x => { x.base.schemaVersion = "ai-painter-stage4-mvp256-dry-v27-execution-package-v1" },
    x => { x.gpu.schemaVersion = "ai-painter-stage4-mvp256-dry-v27-zero-update-gpu-gate-v1" },
    x => { x.ticket.schemaVersion = "ai-painter-stage4-mvp256-dry-v27-training-ticket-v1" },
    x => { x.base.capabilityVersion = "stage4_mvp256_dry_object_head_shared_hidden_v27_v2" },
    x => { x.base.schemaVersion = "ai-painter-stage4-mvp256-dry-v27-v2-execution-package-v1" },
    x => { x.gpu.schemaVersion = "ai-painter-stage4-mvp256-dry-v27-v2-zero-update-gpu-gate-v1" },
    x => { x.ticket.schemaVersion = "ai-painter-stage4-mvp256-dry-v27-v2-training-ticket-v1" },
  ]) {
    const value = fixture()
    mutate(value)
    assert.throws(() => { validateBasePackage(value); validateActivationChain(value) })
  }
})

import { BUDGET, PLAN, CAPABILITY, validateBasePackage, dependencyRole, addDependencyBindings, validateProgramBindings,
  validateActivationChain } from "../lib/ai-painter-mvp256-dry-v27-package-chain-v1.mjs"

const root = path.resolve(import.meta.dirname, "../..")
const parent = JSON.parse(fs.readFileSync(path.join(root,
  "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")))
const policy = { predecessorCandidate: { path: "evidence/parent.json", sha256: "a".repeat(64) },
  modelCpuEvidence: { path: "evidence/model-cpu.json", sha256: "b".repeat(64) },
  cpuAcceptance: { path: "evidence/cpu.json", sha256: "b".repeat(64) } }

const binding = name => ({ path: `evidence/${name}`, sha256: "b".repeat(64) })
const roles = ["worker", "workerTests", "gpuQualifier", "gpuQualifierTests",
  "supervisor", "supervisorTests", "packageChain", "packageChainTests",
  "model", "modelTests", "probe", "probeTests", "v24Worker", "v24Profile",
  "cpuReview", "independentAudit", "reconciliation", "reviewTests", "reconciliationTests"]

function fixture() {
  const policyBinding = binding("policy.json")
  const baseBinding = binding("base.json")
  const gpuBinding = binding("gpu.json")
  const lockBinding = binding("lock.json")
  const launchBinding = binding("launch.json")
  const ticketBinding = binding("ticket.json")
  const outputRoot = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/run-0001"
  const base = {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-execution-package-v1",
    status: "issued_single_attempt", capabilityVersion: CAPABILITY,
    runId: "v27-run-0001", packageId: "v27-package-0001", outputRoot,
    candidateContract: policyBinding,
    sourceDataCandidate: policy.predecessorCandidate,
    cpuAcceptance: policy.cpuAcceptance,
    modelCpuEvidence: policy.modelCpuEvidence,
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
  policy.programBindings = base.programBindings
  const states = { Model: "c".repeat(64), Critic: "d".repeat(64) }
  const trainIds = Array.from({ length: 48 }, (_, index) => `train-${index}`)
  const gpu = {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-zero-update-gpu-gate-v1",
    status: "current_candidate_zero_update_gpu_qualification_passed",
    capabilityVersion: CAPABILITY, runId: base.runId, packageId: base.packageId,
    executionPackage: baseBinding, candidateContract: policyBinding,
    historicalV24QualificationReused: false, gpuInitialized: true,
    trainingModeDeterminismObserved: true,
    aggregationRule: "strict_deterministic_index_add_scoped_to_object_assembly_v1",
    optimizerCreated: false, optimizerSteps: { generator: 0, discriminator: 0 },
    checkpointLoaded: false, checkpointWritten: false, weightsModified: false,
    generatorAutogradGradCalls: 192, discriminatorAutogradGradCalls: 48,
    initialStateSha256: states, finalStateSha256: states,
    caseCount: 48, trainingAllowedByThisArtifact: false,
    cases: trainIds.map((sampleId, trainOrdinal) => ({
      passed: true, trainingModeRepeatBytesEqual: true, objectInstancesUnchanged: true,
      contextIsolationRule: "full_v23_terrain_context_private_global_xy_zero_v1", autogradGradCalls: 4,
      aggregationRule: "strict_deterministic_index_add_scoped_to_object_assembly_v1",
      discriminatorAutogradGradCalls: 1, optimizerCreated: false,
      optimizerSteps: { generator: 0, discriminator: 0 },
      sourceTensorsUnchanged: true, rngRestored: true, gradFieldsCleared: true,
      initialStateSha256: states, finalStateSha256: states,
      sourceTensorHashesBeforeAndAfter: { image: "e".repeat(64),
        conditions: "f".repeat(64) },
      case: { sampleId, split: "train", trainOrdinal } })),
  }
  const lock = { schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-managed-lock-v1",
    status: "active_bound_single_attempt", runId: base.runId, packageId: base.packageId,
    executionPackage: baseBinding, resourceBudget: structuredClone(BUDGET) }
  const launch = { schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-launch-identity-v1",
    status: "managed_supervisor_identity_verified", runId: base.runId,
    packageId: base.packageId, executionPackage: baseBinding, managedLock: lockBinding,
    processId: 1234, processStartIdentity: "1234:2026-10-03T00:00:00.000Z" }
  const ticket = { schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-training-ticket-v1",
    status: "issued_single_use", capabilityVersion: CAPABILITY,
    runId: base.runId, packageId: base.packageId, executionPackage: baseBinding,
    gpuQualification: gpuBinding, managedLock: lockBinding,
    launchIdentity: launchBinding, trainingAllowed: true,
    automaticRetries: 0, formalStage4QualificationAllowed: false,
    runtimePublicationAllowed: false,
    consumptionClaimPath: `${outputRoot}/training-ticket-consumed.json` }
  return { base, policy: structuredClone(policy), parent, policyBinding, baseBinding, gpu, gpuBinding,
    lock, lockBinding, launch, launchBinding, ticket, ticketBinding, trainIds }
}

test("V27 package and activation require separate current identities", () => {
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
    x => { x.gpu.cases[0].contextIsolationRule = "unknown" },
    x => { delete x.gpu.aggregationRule },
    x => { x.gpu.cases[0].aggregationRule = "unknown" },
    x => { x.gpu.schemaVersion = "ai-painter-stage4-mvp256-dry-v26-zero-update-gpu-gate-v1" },
    x => { x.gpu.cases[0].autogradGradCalls = 1 },
    x => { x.gpu.cases[0].case.sampleId = "wrong-source" },
    x => { x.gpu.finalStateSha256 = { ...x.gpu.finalStateSha256, Model: "0".repeat(64) } },
    x => { x.ticket.gpuQualification = binding("old-gpu.json") },
    x => { x.ticket.trainingAllowed = false },
    x => { x.gpu.runId = "foreign-run" },
    x => { x.gpu.packageId = "foreign-package" },
    x => { x.launch.runId = "foreign-run" },
    x => { x.lock.packageId = "foreign-package" },
    x => { x.ticket.runId = "foreign-run" },
    x => { x.gpu.cases[0].trainingModeRepeatBytesEqual = false },
    x => { x.gpu.cases[0].objectInstancesUnchanged = false },
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
