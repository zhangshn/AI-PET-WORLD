import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"

import { inspectCandidate, validateCandidate } from
  "../check-ai-painter-mvp256-dry-v25-candidate.mjs"
import { validateCandidate as validateV24Candidate } from
  "../check-ai-painter-mvp256-dry-v24-candidate.mjs"
import { reconcile as reconcileV24Review } from
  "../reconcile-ai-painter-mvp256-dry-v24-review.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = logical => JSON.parse(fs.readFileSync(path.join(root, logical), "utf8"))
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const contractPath = "data/ai-painter/system-governance/stage4-mvp256-dry-v25-head-dropout-cpu-candidate-v1.json"
const registryPath = ".runtime/ai-painter/current-execution-registry/current.json"
const specificationPath = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"

function fixture() {
  const candidate = read(contractPath)
  const facts = {
    parent: read(candidate.predecessor.candidateContract.path),
    terminal: read(candidate.predecessor.trainingTerminal.path),
    audit: read(candidate.predecessor.failedVisualAudit.path),
    fit: read(candidate.predecessor.trainFitDiagnostic.path),
  }
  return { candidate, facts }
}

function historicalProject(t) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "v25-candidate-regression-"))
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(project)), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(project).startsWith("v25-candidate-regression-"))
    fs.rmSync(project, { recursive: true })
  })
  const put = (logical, bytes) => {
    const file = path.resolve(project, logical)
    assert.ok(file.startsWith(project + path.sep))
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, bytes)
  }
  const copyBound = (binding, destination = binding.path) => {
    const bytes = fs.readFileSync(path.join(root, binding.path))
    assert.equal(hash(bytes), binding.sha256, binding.path)
    put(destination, bytes)
  }
  const { candidate, facts } = fixture()
  const execution = read("data/ai-painter/system-governance/stage4-mvp256-dry-v25-head-dropout-execution-policy-v2.json")
  copyBound(execution.cpuProposal)
  for (const binding of [candidate.predecessor.candidateContract,
    candidate.predecessor.trainingTerminal, candidate.predecessor.failedVisualAudit,
    candidate.predecessor.trainFitDiagnostic, ...Object.values(candidate.candidateProgram), facts.audit.input]) {
    copyBound(binding)
  }
  // These are existing historical bytes, not today's document with an old version label.
  copyBound({ path: ".runtime/ai-painter/stage4-mvp256-dry-v26-cpu/frozen-formal-spec-1.33.md",
    sha256: "95cb74c9bb1f9fdca69983df74a5b96c8b3c46a159717af1ea5bb8ce22af8b45" }, specificationPath)
  const historicalRoot = ".runtime/ai-painter/stage4-mvp-v25-successor-binding/frozen-v24-1.31/"
  for (const [name, sha256] of Object.entries({
    "formal-spec-1.31.md": "06a3b8db7b4bed22ef1b2ebbaa219b2d87688efeea36d31fb1af5bc146489dcc",
    "v24-supervisor.mjs": "4860f0a80484476d846cfb95833b8e9d5207d8da10e8cc9fb6dc7fce6473d6a5",
    "v24-worker.py": "ef53eb6656c17c607146e3b74e7dcdc92cc7857568e109e78c5d01eebe0adb0e",
    "v24-gpu-qualifier.py": "8c5ddacc21d0c6b43d515132b5cca637bbe223cce5d17f0b91343aefd36c85bf",
    "v24-package-chain.mjs": "659ae6c326738dfada3b2ff7441282d36606358960db230b5735c7f48b2a53d7",
  })) copyBound({ path: historicalRoot + name, sha256 })
  const registry = { testFixtureOnly: true, registryRevision: 17, activeExecution: null,
    runId: facts.terminal.runId,
    latestTrainingTerminal: { ...candidate.predecessor.trainingTerminal,
      runId: facts.terminal.runId, status: facts.terminal.status },
    activity: "dry_single_world_review_failed_closed", nextMachineAction: null,
    terminalEvidence: { status: facts.audit.status } }
  put(registryPath, JSON.stringify(registry))
  return { root: project, put, copyBound, registry, candidate, facts }
}

test("isolated historical V25 candidate is CPU-only with default current checks", t => {
  const project = historicalProject(t)
  const report = inspectCandidate(project.root)
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

test("historical V25 inspection rejects foreign current identity and changed original bytes", t => {
  const project = historicalProject(t)
  for (const alter of [
    r => { r.latestTrainingTerminal.runId = "synthetic-successor" },
    r => { r.latestTrainingTerminal.sha256 = "0".repeat(64) },
    r => { r.latestTrainingTerminal.path += ".foreign" },
    r => { r.activeExecution = { runId: "synthetic-active" } },
  ]) {
    const registry = structuredClone(project.registry)
    alter(registry)
    project.put(registryPath, JSON.stringify(registry))
    assert.throws(() => inspectCandidate(project.root))
  }
  project.put(registryPath, JSON.stringify(project.registry))
  const model = project.candidate.candidateProgram.model
  project.put(model.path, Buffer.concat([fs.readFileSync(path.join(root, model.path)), Buffer.from("\n")]))
  assert.throws(() => inspectCandidate(project.root), /candidate binding changed/)
  project.copyBound(model)
  project.put(specificationPath, "invalid test-only specification")
  assert.throws(() => inspectCandidate(project.root), /did not match/)
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

test("already-reconciled historical V24 review is read-only in an isolated registry", async t => {
  const project = historicalProject(t)
  const registryFile = path.join(project.root, registryPath)
  const before = fs.readFileSync(registryFile)
  let writes = 0
  const registryApi = {
    read: async requestedRoot => {
      assert.equal(requestedRoot, fs.realpathSync(project.root))
      return { ok: true, registry: JSON.parse(fs.readFileSync(registryFile)) }
    },
    advance: async () => { writes++; assert.fail("read-only reconciliation must not advance") },
  }
  const result = await reconcileV24Review({ root: project.root, execute: false, registryApi })
  assert.equal(result.status, "already_reconciled")
  assert.equal(result.stage4Advanced, false)
  assert.ok(fs.readFileSync(registryFile).equals(before))
  for (const alter of [
    r => { r.runId = "synthetic-successor" },
    r => { r.activeExecution = { runId: "synthetic-active" } },
    r => { r.latestTrainingTerminal.sha256 = "0".repeat(64) },
  ]) {
    const registry = structuredClone(project.registry)
    alter(registry)
    project.put(registryPath, JSON.stringify(registry))
    const invalidBefore = fs.readFileSync(registryFile)
    await assert.rejects(reconcileV24Review({ root: project.root, execute: false, registryApi }))
    assert.ok(fs.readFileSync(registryFile).equals(invalidBefore))
  }
  assert.equal(writes, 0)
})
