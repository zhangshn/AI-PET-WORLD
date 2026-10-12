// One managed V27 dry-world attempt. CPU, GPU, training, and review are distinct.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath, pathToFileURL } from "node:url"

import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from
  "../src/server/ai-painter-current-execution-registry.mjs"
import { bind, boundJson, inside, processIdentity, readBound, writeExclusive } from
  "./run-ai-painter-mvp256-dry-v24-training.mjs"
import { BUDGET, CAPABILITY, PLAN, validateActivationChain,
  validateBasePackage, addDependencyBindings, validateProgramBindings } from "./lib/ai-painter-mvp256-dry-v27-package-chain-v1.mjs"
import { replaceHeartbeatFile, heartbeatPublicationRule } from "./run-ai-painter-learning-capacity-experiment.mjs"

const execFileAsync = promisify(execFile)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-v27-shared-hidden-execution-policy-v3.json"
export const PROPOSAL_PATH = null
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const WORKER = "ml/ai-painter/scripts/painter_stage4_v27_dry_single_world_checkpoint_worker.py"
const GPU_QUALIFIER = "ml/ai-painter/scripts/qualify_stage4_mvp256_dry_v27_gpu.py"
const OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions"
const CLAIM_PATH = `${OUTPUT_PARENT}/single-training-attempt-claim.json`
const MODEL_CPU_PATH = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-cpu/report.json"
export const PROGRAMS = {
  "supervisor": "scripts/run-ai-painter-mvp256-dry-v27-training.mjs",
  "supervisorTests": "scripts/tests/test-ai-painter-mvp256-dry-v27-training.mjs",
  "worker": "ml/ai-painter/scripts/painter_stage4_v27_dry_single_world_checkpoint_worker.py",
  "workerTests": "ml/ai-painter/tests/test_stage4_v27_dry_single_world_checkpoint_worker.py",
  "gpuQualifier": "ml/ai-painter/scripts/qualify_stage4_mvp256_dry_v27_gpu.py",
  "gpuQualifierTests": "ml/ai-painter/tests/test_qualify_stage4_mvp256_dry_v27_gpu.py",
  "packageChain": "scripts/lib/ai-painter-mvp256-dry-v27-package-chain-v1.mjs",
  "packageChainTests": "scripts/tests/test-ai-painter-mvp256-dry-v27-package-chain-v1.mjs",
  "model": "ml/ai-painter/src/ai_painter/complete_world/object_head_shared_hidden_v27_cpu.py",
  "modelTests": "ml/ai-painter/tests/test_object_head_shared_hidden_v27_cpu.py",
  "probe": "ml/ai-painter/src/ai_painter/complete_world/object_head_shared_hidden_priority_v27.py",
  "probeTests": "ml/ai-painter/tests/test_object_head_shared_hidden_priority_v27.py",
  "cpuAcceptance": "scripts/run-ai-painter-mvp256-dry-v27-cpu-acceptance.mjs",
  "cpuAcceptanceTests": "scripts/tests/test-ai-painter-mvp256-dry-v27-cpu-acceptance.mjs",
  "cpuReview": "ml/ai-painter/scripts/review_stage4_mvp256_dry_v27_cpu.py",
  "cpuReviewTests": "ml/ai-painter/tests/test_review_stage4_mvp256_dry_v27_cpu.py",
  "independentAudit": "scripts/run-ai-painter-mvp256-dry-v27-independent-audit.mjs",
  "reviewTests": "scripts/tests/test-ai-painter-mvp256-dry-v27-independent-audit.mjs",
  "reconciliation": "scripts/reconcile-ai-painter-mvp256-dry-v27-review.mjs",
  "reconciliationTests": "scripts/tests/test-ai-painter-mvp256-dry-v27-review-closure.mjs",
  "v24Worker": "ml/ai-painter/scripts/painter_stage4_v24_dry_single_world_checkpoint_worker.py",
  "v24Profile": "ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py",
  "v3Checker": "ml/ai-painter/scripts/check_stage4_mvp256_dry_v27_v3_cpu.py"
}
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
const now = () => new Date().toISOString()


export const NUMERIC_CPU = MODEL_CPU_PATH
export const HISTORICAL_SPECIFICATION = { path: ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-cpu/frozen-checked-formal-spec-1.38.md",
  sha256: "aa28b9617b85df7c5f50b47f02f328eb9267f5c6a72e1c5fa7ca9e6e83d9527c" }
export const AGGREGATION_RULE = "strict_deterministic_index_add_scoped_to_object_assembly_v1"
export const SINGLE_CHANGE = { operation: "one_registered_hidden_four_independent_rgb_adapters_v1",
  trainingAndInference: true, dropoutEnabled: false, fullV23ContextPreserved: true,
  groupCount: 5, modelParameterTensorCount: 100, modelParameterElementCount: 2236015,
  objectParameterTensorCount: 10, objectParameterElementCount: 1372, crossClassCouplingChanged: true }

const HISTORICAL_TRANSACTION_ID = "current-execution-registry-advance-20261003072654-34480828-e8e3-4b53-a53e-1054b966ca29"
const HISTORICAL_TRANSACTION_ROOT = ".runtime/ai-painter/current-execution-registry/transactions/" + HISTORICAL_TRANSACTION_ID
export const HISTORICAL_REGISTRY_OBSERVATION = {
  observed: { path: ".runtime/ai-painter/current-execution-registry/current.json",
    sha256: "0ce72710a9232731c133ca5af47ca15057b301802efdb5f4a25518d078436908",
    registryRevision: 366, activeExecution: null },
  transaction: { path: HISTORICAL_TRANSACTION_ROOT + "/transaction.json",
    sha256: "bda02cd448662b461bab42deb613a0c73ea8763893445238187fceccd462ff86" },
  snapshot: { path: HISTORICAL_TRANSACTION_ROOT + "/current.staged.json",
    sha256: "0ce72710a9232731c133ca5af47ca15057b301802efdb5f4a25518d078436908" },
  event: { path: HISTORICAL_TRANSACTION_ROOT + "/registry-event.staged.jsonl",
    sha256: "6123bd6026edb8a003c9d68d159a6c5cbd3890590927be07daf94e174cb7123c" },
}
export function validateHistoricalRegistryRecords(transaction, snapshot, event) {
  const proof = HISTORICAL_REGISTRY_OBSERVATION
  assert.equal(transaction.schemaVersion, "ai-painter-current-execution-registry-transaction-v1")
  assert.equal(snapshot.schemaVersion, "ai-painter-current-execution-registry-v1")
  assert.equal(event.schemaVersion, "ai-painter-current-execution-registry-event-v1")
  assert.equal(transaction.status, "committed")
  assert.ok(Number.isFinite(Date.parse(transaction.committedAtUtc))
    && Date.parse(transaction.committedAtUtc) >= Date.parse(transaction.recordedAtUtc))
  for (const record of [transaction, snapshot, event]) {
    assert.equal(record.transactionId, HISTORICAL_TRANSACTION_ID)
    assert.equal(record.registryRevision, 366)
    assert.equal(record.eventSequence, 366)
    assert.equal(record.recordedAtUtc, transaction.recordedAtUtc)
  }
  assert.deepEqual(transaction.currentStaged, proof.snapshot)
  assert.deepEqual(transaction.registryEventStaged, proof.event)
  assert.equal(transaction.currentSha256, proof.observed.sha256)
  assert.equal(event.currentSha256, proof.observed.sha256)
  assert.equal(event.previousCurrentSha256, transaction.previousCurrentSha256)
  assert.equal(snapshot.supersedes.currentSha256, transaction.previousCurrentSha256)
  assert.equal(transaction.previousRegistryRevision, 365)
  assert.equal(snapshot.supersedes.registryRevision, 365)
  assert.equal(snapshot.supersedes.eventSequence, 365)
  assert.equal(event.action, "advance_current_capability_lifecycle")
  assert.equal(event.taskId, snapshot.taskId)
  assert.equal(event.runId, snapshot.runId)
  assert.equal(snapshot.activeExecution, null)
  return true
}
export function readHistoricalRegistryObservation(root, observation) {
  assert.deepEqual(observation, HISTORICAL_REGISTRY_OBSERVATION.observed,
    "historical registry observation identity differs")
  const proof = HISTORICAL_REGISTRY_OBSERVATION
  validateHistoricalRegistryRecords(boundJson(root, proof.transaction),
    boundJson(root, proof.snapshot), boundJson(root, proof.event))
  return proof
}

export function readNumericCpuProof(root, binding) {
  const out = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-cpu/"
  assert.deepEqual(binding, { path: NUMERIC_CPU,
    sha256: "0c45507597b1cb6fa1b497274b12fbbf34c6726d07f252909a49c10cbd804955" })
  const report = boundJson(root, binding)
  const contractBinding = { path: "data/ai-painter/system-governance/stage4-mvp256-dry-v27-shared-hidden-cpu-candidate-v3.json",
    sha256: "0dba539adf017cfd4a7e900aef6aa8602d4db1538e4640c9f0cb76ae1c0241b7" }
  const claimBinding = { path: out + "claim.json",
    sha256: "c962867bfbcd364341fe57d261b399a3165e57c10c5980ea8c226ff6791ff2b5" }
  const acceptance = boundJson(root, { path: out + "controller-acceptance.json",
    sha256: "8de54d9a2b4c3b2b053ddfe3511642de70b79b0cfb6db690484df706b272415e" })
  const contract = boundJson(root, contractBinding), claim = boundJson(root, claimBinding)
  readHistoricalRegistryObservation(root, acceptance.registryBeforeAndAfter)
  assert.deepEqual(report.contract, contractBinding)
  assert.deepEqual(claim.contract, contractBinding)
  assert.deepEqual(acceptance.contract, contractBinding)
  assert.deepEqual(acceptance.report, binding)
  assert.deepEqual(acceptance.claim, claimBinding)
  assert.equal(claim.attempt, 1)
  assert.equal(claim.automaticRetries, 0)
  assert.equal(acceptance.bindingMismatches, 0)
  const snapshots = {
    "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md": acceptance.checkedFormalSpecificationSnapshot,
    "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md": acceptance.checkedExecutionGuideSnapshot,
  }
  function rehash(value) {
    if (value === acceptance.registryBeforeAndAfter)
      return readHistoricalRegistryObservation(root, value)
    if (Array.isArray(value)) value.forEach(rehash)
    else if (value && typeof value === "object") {
      if (typeof value.path === "string" && typeof value.sha256 === "string") {
        let item = { path: value.path, sha256: value.sha256 }
        if (snapshots[item.path]) {
          assert.equal(item.sha256, snapshots[item.path].sha256, "historical document differs")
          item = snapshots[item.path]
        }
        readBound(root, item)
      }
      Object.values(value).forEach(rehash)
    }
  }
  for (const value of [report, contract, claim, acceptance]) rehash(value)
  assert.equal(report.status, "cpu_contract_checked_not_execution_qualified")
  assert.equal(report.capabilityVersion, "stage4_mvp256_dry_object_head_shared_hidden_v27_cpu_v3_candidate")
  assert.deepEqual(report.actualModelIdentity, {
    capabilityVersion: "stage4_mvp256_dry_object_head_shared_hidden_v27_cpu_candidate",
    executionQualified: false, parentCheckpointLoaded: false })
  assert.deepEqual(report.realCallCounts, { modelForwardsAttempted: 2, modelForwardsCompleted: 2,
    autogradGradCallsAttempted: 8, autogradGradCallsCompleted: 8 })
  assert.equal(report.syntheticEvidence.testsRun, 29)
  for (const key of ["failures", "errors", "skipped"]) assert.equal(report.syntheticEvidence[key], 0)
  assert.equal(report.dependencyChecks.length, 6)
  report.dependencyChecks.forEach(row => assert.equal(row.status, "verified"))
  assert.equal(report.terminalAssertionsCompleted, true)
  assert.deepEqual(report.initialState, report.finalState)
  for (const [key, value] of Object.entries(report.boundary))
    assert.equal(value, key === "optimizerSteps" ? 0 : false)
  return report
}

// Reachable literal local JS imports only. External package imports stay external.
// Dynamic computed imports are not represented as an exhaustive static proof.
export function javascriptDependencyClosure(root, seeds) {
  const pending = [...seeds], seen = new Set()
  while (pending.length) {
    const logical = pending.pop()
    if (seen.has(logical)) continue
    const source = fs.readFileSync(inside(root, logical), "utf8")
    seen.add(logical)
    const parsed = ts.createSourceFile(logical, source, ts.ScriptTarget.Latest, true)
    assert.equal(parsed.parseDiagnostics.length, 0, "invalid source: " + logical)
    const specifiers = []
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
        specifiers.push(node.moduleSpecifier.text)
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require"))
        && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]))
        specifiers.push(node.arguments[0].text)
      ts.forEachChild(node, visit)
    }
    visit(parsed)
    for (const specifier of specifiers) {
      if (!specifier.startsWith(".")) continue
      const next = path.posix.normalize(path.posix.join(path.posix.dirname(logical), specifier))
      const candidates = [next, next + ".mjs", next + ".js", next + ".ts", next + "/index.mjs"]
      const child = candidates.find(candidate => fs.existsSync(inside(root, candidate))
        && fs.statSync(inside(root, candidate)).isFile())
      assert.ok(child, "unresolved local import: " + logical + " -> " + specifier)
      pending.push(child)
    }
  }
  return [...seen].sort()
}

export async function collectProgramBindings(root, command = productionCommand) {
  const pythonSeeds = Object.values(PROGRAMS).filter(value => value.endsWith(".py"))
  const script = "import json,sys; import check_stage4_mvp256_dry_v27_v3_cpu as c; print(json.dumps(c.local_dependency_closure(json.loads(sys.argv[1]))))"
  const result = await command({ file: inside(root, PYTHON),
    args: ["-B", "-c", script, JSON.stringify(pythonSeeds)], root, timeout: 120000 })
  const python = JSON.parse(result.stdout)
  const javascript = javascriptDependencyClosure(root, Object.values(PROGRAMS).filter(value => value.endsWith(".mjs")))
  const direct = Object.fromEntries(Object.entries(PROGRAMS).map(([role, logical]) => [role, bind(root, logical)]))
  return addDependencyBindings(direct, [...python, ...javascript], logical => bind(root, logical))
}

export function validateProgramSources(root, bindings) {
  validateProgramBindings(bindings)
  for (const item of Object.values(bindings)) readBound(root, item)
  return true
}


export const PREDECESSOR_MANIFEST = {
  path: ".runtime/ai-painter/stage4-mvp256-dry-v27-lifecycle-cpu/frozen-before-registry-repair-20261006/manifest.json",
  sha256: "9982e3c7c7be329c8082673449b9e73046f927512c091ed1946c3fd11178a71a" }

export function readPredecessorProof(root, manifestBinding = PREDECESSOR_MANIFEST) {
  assert.deepEqual(manifestBinding, PREDECESSOR_MANIFEST)
  const manifest = boundJson(root, manifestBinding)
  assert.equal(manifest.schemaVersion, "ai-painter-v27-pre-registration-repair-source-snapshot-v1")
  assert.equal(manifest.sources.length, 20)
  const archived = new Map()
  for (const row of manifest.sources) {
    assert.ok(!archived.has(row.originalPath), "duplicate frozen source path")
    assert.equal(row.snapshot.path, path.posix.dirname(manifestBinding.path) + "/" + row.originalPath)
    readBound(root, row.snapshot)
    archived.set(row.originalPath, row.snapshot)
  }
  function rehash(value) {
    if (Array.isArray(value)) value.forEach(rehash)
    else if (value && typeof value === "object") {
      if (typeof value.path === "string" && typeof value.sha256 === "string") {
        let binding = { path: value.path, sha256: value.sha256 }
        if (archived.has(binding.path)) {
          const snapshot = archived.get(binding.path)
          assert.equal(binding.sha256, snapshot.sha256, "historical source snapshot SHA differs")
          binding = snapshot
        }
        readBound(root, binding)
      }
      Object.values(value).forEach(rehash)
    }
  }
  const policy = boundJson(root, manifest.predecessorPolicy)
  const cpu = boundJson(root, manifest.predecessorCpuAcceptance)
  const claim = boundJson(root, manifest.predecessorClaim)
  const failure = boundJson(root, manifest.predecessorFailure)
  const execution = boundJson(root, manifest.predecessorExecutionPackage)
  for (const record of [policy, cpu, claim, failure, execution]) rehash(record)
  assert.equal(policy.schemaVersion, "stage4-mvp256-dry-v27-shared-hidden-execution-policy-v1")
  assert.equal(policy.capabilityVersion, "stage4_mvp256_dry_object_head_shared_hidden_v27")
  assert.deepEqual(policy.cpuAcceptance, manifest.predecessorCpuAcceptance)
  assert.deepEqual(claim.candidateContract, manifest.predecessorPolicy)
  assert.deepEqual(failure.executionPackage, manifest.predecessorExecutionPackage)
  assert.deepEqual(execution.candidateContract, manifest.predecessorPolicy)
  for (const record of [claim, failure, execution]) {
    assert.equal(record.capabilityVersion, policy.capabilityVersion)
    assert.equal(record.runId, claim.runId)
    assert.equal(record.packageId, claim.packageId)
  }
  assert.equal(claim.automaticRetries, 0)
  assert.equal(failure.status, "failed_closed")
  assert.equal(failure.executionState, "failed_closed")
  assert.match(failure.error, /^Error: registry_active_execution_program_role_invalid\n/u)
  assert.equal(failure.trainingStarted, false)
  assert.equal(failure.optimizerStepsGenerator, 0)
  assert.equal(failure.optimizerStepsDiscriminator, 0)
  for (const key of ["workerTerminal", "progress", "gpuQualificationFailure"]) assert.equal(failure[key], null)
  const previousRoot = path.posix.dirname(manifest.predecessorExecutionPackage.path)
  for (const name of ["zero-update-gpu-qualification.json", "zero-update-gpu-qualification-claim.json",
    "zero-update-gpu-qualification-failure.json", "training-ticket.json", "training-ticket-consumed.json",
    "phase-terminal.json", "progress.json"])
    assert.equal(fs.existsSync(inside(root, previousRoot + "/" + name)), false, "predecessor progressed beyond registration")
  return { frozenSourceManifest: manifestBinding,
    predecessorExecutionPolicy: manifest.predecessorPolicy,
    predecessorExecutionClaim: manifest.predecessorClaim,
    predecessorRegistrationFailure: manifest.predecessorFailure }
}


export const PREDECESSOR_V2_MANIFEST = {
  path: ".runtime/ai-painter/stage4-mvp256-dry-v27-v2-lifecycle-cpu/frozen-before-historical-binding-repair-20261006/manifest.json",
  sha256: "8d710b8331943c1cd38378cbe36d7c68df9543fe586a9b354411a96b30b83db7" }
export const PREDECESSOR_V2_CLAIM = {
  path: ".runtime/ai-painter/stage4-mvp256-dry-v27-v2-executions/single-training-attempt-claim.json",
  sha256: "358dabeab755d82ed15ca1a520affb06c913d0eede673e6084387d163d81eaf1" }
export function readExecutionPredecessorProof(root) {
  const original = readPredecessorProof(root)
  const manifest = boundJson(root, PREDECESSOR_V2_MANIFEST)
  assert.equal(manifest.schemaVersion, "ai-painter-v27-v2-pre-historical-binding-repair-source-snapshot-v1")
  assert.equal(manifest.sources.length, 18)
  const archived = new Map()
  for (const row of manifest.sources) {
    assert.ok(!archived.has(row.originalPath), "duplicate V2 frozen source")
    assert.equal(row.snapshot.path, path.posix.dirname(PREDECESSOR_V2_MANIFEST.path) + "/" + row.originalPath)
    readBound(root, row.snapshot)
    archived.set(row.originalPath, row.snapshot)
  }
  const rehash = value => {
    if (Array.isArray(value)) value.forEach(rehash)
    else if (value && typeof value === "object") {
      if (typeof value.path === "string" && typeof value.sha256 === "string") {
        let binding = { path: value.path, sha256: value.sha256 }
        if (archived.has(binding.path)) {
          const snapshot = archived.get(binding.path)
          assert.equal(snapshot.sha256, binding.sha256, "V2 historical source SHA differs")
          binding = snapshot
        }
        readBound(root, binding)
      }
      Object.values(value).forEach(rehash)
    }
  }
  const policy = boundJson(root, manifest.predecessorPolicy)
  const cpu = boundJson(root, manifest.predecessorCpuAcceptance)
  const cpuClaim = boundJson(root, cpu.claim)
  const claim = boundJson(root, PREDECESSOR_V2_CLAIM)
  const failure = boundJson(root, manifest.predecessorFailure)
  const execution = boundJson(root, failure.executionPackage)
  for (const record of [policy, cpu, cpuClaim, claim, failure, execution]) rehash(record)
  assert.equal(policy.schemaVersion, "stage4-mvp256-dry-v27-shared-hidden-execution-policy-v2")
  assert.equal(policy.capabilityVersion, "stage4_mvp256_dry_object_head_shared_hidden_v27_v2")
  assert.deepEqual(policy.cpuAcceptance, manifest.predecessorCpuAcceptance)
  assert.deepEqual(claim.candidateContract, manifest.predecessorPolicy)
  assert.deepEqual(execution.candidateContract, manifest.predecessorPolicy)
  assert.equal(execution.schemaVersion, "ai-painter-stage4-mvp256-dry-v27-v2-execution-package-v1")
  assert.equal(cpu.schemaVersion, "ai-painter-mvp256-dry-v27-v2-lifecycle-cpu-acceptance-v1")
  assert.equal(cpu.status, "v27_v2_lifecycle_cpu_acceptance_passed")
  assert.equal(cpuClaim.schemaVersion, "ai-painter-mvp256-dry-v27-v2-lifecycle-cpu-claim-v1")
  for (const key of ["programBindings", "modelCpuEvidence", "formalSpecification", "executionGuide"])
    assert.deepEqual(cpuClaim[key], cpu[key])
  assert.deepEqual(cpu.programBindings, policy.programBindings)
  assert.deepEqual(execution.programBindings, policy.programBindings)
  for (const [key, binding] of Object.entries(original)) {
    assert.deepEqual(policy[key], binding)
    assert.deepEqual(cpu[key], binding)
    assert.deepEqual(cpuClaim[key], binding)
  }
  for (const record of [claim, failure, execution]) {
    assert.equal(record.capabilityVersion, policy.capabilityVersion)
    assert.equal(record.runId, claim.runId)
    assert.equal(record.packageId, claim.packageId)
  }
  assert.equal(claim.automaticRetries, 0)
  assert.equal(failure.schemaVersion, "ai-painter-mvp256-dry-v27-v2-training-failure-v1")
  assert.equal(failure.status, "failed_closed")
  assert.equal(failure.executionState, "failed_closed")
  assert.ok(failure.error.includes("v27_gpu_preflight_failed_closed")
    && failure.error.includes("source SHA mismatch: .runtime/ai-painter/current-execution-registry/current.json"))
  assert.equal(failure.trainingStarted, false)
  assert.equal(failure.optimizerStepsGenerator, 0)
  assert.equal(failure.optimizerStepsDiscriminator, 0)
  for (const key of ["workerTerminal", "progress", "gpuQualificationFailure"]) assert.equal(failure[key], null)
  const previous = path.posix.dirname(failure.executionPackage.path)
  for (const name of ["zero-update-gpu-qualification.json", "zero-update-gpu-qualification-claim.json",
    "zero-update-gpu-qualification-failure.json", "training-ticket.json", "training-ticket-consumed.json",
    "phase-terminal.json", "progress.json"])
    assert.equal(fs.existsSync(inside(root, previous + "/" + name)), false, "V2 predecessor progressed after preflight")
  readNumericCpuProof(root, policy.modelCpuEvidence)
  return { ...original, predecessorV2SourceManifest: PREDECESSOR_V2_MANIFEST,
    predecessorV2ExecutionPolicy: manifest.predecessorPolicy, predecessorV2CpuAcceptance: manifest.predecessorCpuAcceptance,
    predecessorV2ExecutionClaim: PREDECESSOR_V2_CLAIM, predecessorV2PreflightFailure: manifest.predecessorFailure,
    historicalRegistryObservation: HISTORICAL_REGISTRY_OBSERVATION }
}

export function describePolicy({ root, cpuAcceptance, programBindings }) {
  const predecessorCandidate = bind(root, "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")
  const parent = boundJson(root, predecessorCandidate)
  return { schemaVersion: "stage4-mvp256-dry-v27-shared-hidden-execution-policy-v3",
    status: "cpu_accepted_not_gpu_qualified", capabilityVersion: CAPABILITY,
    executionVersion: "shared_hidden_historical_observation_repair_v27_v3", predecessorCandidate,
    ...readExecutionPredecessorProof(root),
    modelCpuEvidence: bind(root, MODEL_CPU_PATH), cpuAcceptance, programBindings,
    formalSpecification: bind(root, "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),
    executionGuide: bind(root, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"),
    aggregationRule: AGGREGATION_RULE, historicalQualificationMayBeReused: false,
    historicalCheckpointMayInitialize: false, executionCeiling: structuredClone(BUDGET),
    scope: parent.scope, dataUse: parent.dataUse, checkpointSelection: parent.checkpointSelection,
    singleChange: structuredClone(SINGLE_CHANGE),
    numericSuccessGate: { maximumValidationRgbMae: 0.06140733743086457,
      minimumExclusiveWorstApplicableObjectCorrelation: -0.08459185063838959,
      preselectedSampleId: parent.scope.subjectSampleId, allOriginalReviewsRequired: true },
    baseline: {
      trainingTerminal: { path: ".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2/training-finalize.json",
        sha256: "2f2b7a3ff091f54e511e7bad9ab2a53fabbe2fc626f5bd91e49db7c1ade33a26" },
      failedVisualAudit: { path: ".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2/dry-review/independent-audit.json",
        sha256: "c3c4db62221412523349ea57d8e925e13d49039903e6adffd2d4e10ce2556ae8" } },
    activation: { cpuAcceptanceCompleted: true, gpuQualificationAllowed: true,
      trainingAllowed: false, formalStage4QualificationAllowed: false, runtimePublicationAllowed: false } }
}

export function validatePolicy({ root, policy, policyBinding, parent }) {
  assert.equal(policyBinding.path, POLICY_PATH)
  validateProgramSources(root, policy.programBindings)
  assert.deepEqual(policy, describePolicy({ root, cpuAcceptance: policy.cpuAcceptance,
    programBindings: policy.programBindings }))
  readNumericCpuProof(root, policy.modelCpuEvidence)
  const cpu = boundJson(root, policy.cpuAcceptance)
  assert.equal(cpu.status, "v27_v3_lifecycle_cpu_acceptance_passed")
  assert.equal(cpu.schemaVersion, "ai-painter-mvp256-dry-v27-v3-lifecycle-cpu-acceptance-v1")
  assert.equal(cpu.capabilityVersion, CAPABILITY)
  for (const [key, binding] of Object.entries(readExecutionPredecessorProof(root)))
    assert.deepEqual(cpu[key], binding)
  assert.deepEqual(cpu.modelCpuEvidence, policy.modelCpuEvidence)
  assert.deepEqual(cpu.formalSpecification, policy.formalSpecification)
  assert.deepEqual(cpu.executionGuide, policy.executionGuide)
  assert.equal(cpu.failedTests, 0)
  assert.equal(cpu.skippedTests, 0)
  assert.ok(cpu.passedTests > 0)
  assert.equal(cpu.optimizerSteps, 0)
  assert.deepEqual(cpu.syntheticOptimizerSteps, { generator: 1, discriminator: 1 })
  assert.equal(cpu.gpuInitialized, false)
  assert.equal(cpu.trainingStarted, false)
  assert.equal("candidateContract" in cpu, false)
  const claim = boundJson(root, cpu.claim)
  assert.equal(claim.schemaVersion, "ai-painter-mvp256-dry-v27-v3-lifecycle-cpu-claim-v1")
  assert.equal(claim.capabilityVersion, CAPABILITY)
  assert.equal(claim.attempt, 1)
  assert.equal(claim.automaticRetries, 0)
  for (const key of ["programBindings", "modelCpuEvidence", "formalSpecification", "executionGuide",
    ...Object.keys(readExecutionPredecessorProof(root))])
    assert.deepEqual(claim[key], cpu[key])
  const pyResult = JSON.parse(boundJson(root, cpu.testOutputs.python).stdout.trim())
  const nodeOutput = boundJson(root, cpu.testOutputs.node).stdout
  const tapCount = name => {
    const match = nodeOutput.match(new RegExp("^# " + name + " (\\d+)\\s*$", "mu"))
    assert.ok(match, "missing actual CPU test count: " + name)
    return Number(match[1])
  }
  for (const key of ["failures", "errors", "skipped"]) assert.equal(pyResult[key], 0)
  assert.equal(pyResult.gpuInitialized, false)
  assert.deepEqual(pyResult.syntheticOptimizerSteps, { generator: 1, discriminator: 1 })
  for (const key of ["fail", "cancelled", "skipped"]) assert.equal(tapCount(key), 0)
  assert.equal(tapCount("tests"), tapCount("pass"))
  assert.equal(pyResult.testsRun + tapCount("pass"), cpu.passedTests)
  assert.deepEqual(cpu.programBindings, policy.programBindings)
  for (const item of Object.values(cpu.programBindings)) readBound(root, item)
  for (const [role, logical] of Object.entries(PROGRAMS))
    assert.deepEqual(cpu.programBindings[role], bind(root, logical))
  assert.match(readBound(root, policy.formalSpecification).toString("utf8"), /AI-PAINTER-SPEC-1\.41/u)
  for (const item of Object.values(parent.frozenBindings)) readBound(root, item)
  for (const item of Object.values(policy.baseline)) readBound(root, item)
  return cpu
}

export function buildBasePackage({ policy, parent, policyBinding, runId,
  packageId, outputRoot, programBindings }) {
  const base = {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-execution-package-v1",
    status: "issued_single_attempt", capabilityVersion: CAPABILITY,
    runId, packageId, outputRoot, candidateContract: policyBinding,
    sourceDataCandidate: policy.predecessorCandidate,
    cpuAcceptance: policy.cpuAcceptance,
    modelCpuEvidence: policy.modelCpuEvidence,
    datasetManifest: parent.frozenBindings.datasetManifest,
    trainSplit: parent.frozenBindings.trainSplit,
    validationSplit: parent.frozenBindings.validationSplit,
    resourceBudget: structuredClone(BUDGET), trainingPlan: structuredClone(PLAN),
    programBindings, trainingIntent: "bounded_once", trainingAllowed: false,
    managedExecutionRequired: "javascript_managed_orchestration",
    formalStage4QualificationAllowed: false, runtimePublicationAllowed: false,
    execution: { reviewPlan: { boundedDryReviewAllowed: true,
      formalStage4QualificationAllowed: false,
      runtimePublicationAllowed: false,
      numericThresholdContract: parent.frozenBindings.numericReview,
      detailThresholdContract: parent.frozenBindings.detailReview } },
  }
  validateBasePackage({ base, policy, parent, policyBinding })
  return base
}

export function validateWorkerTerminal(root, terminal, base, ticketBinding) {
  assert.equal(terminal.schemaVersion,
    "ai-painter-stage4-mvp256-dry-v27-v3-worker-terminal-v1")
  assert.equal(terminal.status, "training_completed_review_pending")
  assert.equal(terminal.executionState, "completed")
  assert.equal(terminal.capabilityVersion, CAPABILITY)
  assert.equal(terminal.runId, base.runId)
  assert.equal(terminal.packageId, base.packageId)
  assert.equal(terminal.optimizerStepsGenerator, 2304)
  assert.equal(terminal.optimizerStepsDiscriminator, 2304)
  assert.deepEqual(terminal.eligibleCheckpointEpochs, [24, 36, 48])
  assert.deepEqual(terminal.checkpoints?.map(row => row.epoch), [24, 36, 48])
  for (const row of terminal.checkpoints) {
    assert.equal(row.validation?.length, 8)
    assert.deepEqual(row.selection?.rank,
      [row.selection.worstApplicableObjectCorrelation,
        -row.selection.meanValidationRgbMae, -row.epoch])
    assert.deepEqual(row.checkpoint,
      { path: row.checkpoint.path, sha256: row.checkpointSha256 })
    readBound(root, row.checkpoint)
  }
  const selected = terminal.checkpoints.find(row => row.epoch === terminal.selectedEpoch)
  assert.ok(selected)
  assert.deepEqual(terminal.selectedCheckpoint, selected.checkpoint)
  assert.deepEqual(terminal.selectedRank, selected.selection.rank)
  assert.equal(terminal.selectedModelStateSha256, selected.stateSha256.Model)
  assert.equal(terminal.selectedCriticStateSha256, selected.stateSha256.Critic)
  assert.equal(terminal.checkpointReloadVerified, true)
  assert.equal(terminal.checkpointPromotable, false)
  assert.equal(terminal.challengeContentRead, false)
  assert.equal(terminal.regressionContentRead, false)
  assert.equal(terminal.historicalCheckpointLoaded, false)
  assert.equal(terminal.formalStage4QualificationAllowed, false)
  assert.equal(terminal.stage4QualificationGranted, false)
  assert.equal(terminal.runtimePublicationAllowed, false)
  const claim = boundJson(root, terminal.trainingTicketConsumption)
  assert.equal(claim.schemaVersion,
    "ai-painter-stage4-mvp256-dry-v27-v3-ticket-consumption-v1")
  assert.deepEqual(claim.trainingTicket, ticketBinding)
  assert.equal(claim.optimizerCreatedAtConsumption, false)
  assert.equal(claim.gpuInitializedAtConsumption, false)
  return selected
}

const productionRegistry = {
  read: root => readCurrentExecutionRegistry(root),
  advance: options => advanceCurrentExecutionRegistry(options),
}
const productionCommand = async ({ file, args, root, timeout, signal }) =>
  execFileAsync(file, args, { cwd: root, windowsHide: true, timeout, signal,
    maxBuffer: 16 * 1024 * 1024, encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1",
      PYTHONDONTWRITEBYTECODE: "1", OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2",
      PYTHONPATH: [path.join(root, "ml/ai-painter/src"), path.join(root, "ml/ai-painter/scripts")].join(path.delimiter) } })

export async function preflight({ projectRoot = ROOT, registry = productionRegistry,
  command = productionCommand } = {}) {
  const root = fs.realpathSync(projectRoot)


  const policyBinding = bind(root, POLICY_PATH)
  const policy = boundJson(root, policyBinding)
  const proposal = null
  const parent = boundJson(root, policy.predecessorCandidate)
  validatePolicy({ root, policy, policyBinding, parent, proposal })
  const programBindings = await collectProgramBindings(root, command)
  assert.deepEqual(programBindings, policy.programBindings)
  const current = await registry.read(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  assert.equal(current.registry.activeExecution, null,
    "another managed execution is active")
  assert.equal(current.registry.activeExecution, null)

  const worker = JSON.parse((await command({ file: inside(root, PYTHON),
    args: ["-B", inside(root, WORKER), "--cpu-preflight"], root,
    timeout: 120_000 })).stdout)
  const qualifier = JSON.parse((await command({ file: inside(root, PYTHON),
    args: ["-B", inside(root, GPU_QUALIFIER)], root,
    timeout: 120_000 })).stdout)
  assert.equal(worker.status, "cpu_preflight_passed_training_not_started")
  assert.equal(worker.capabilityVersion, CAPABILITY)
  assert.equal(worker.gpuInitialized, false)
  assert.equal(worker.trainingStarted, false)
  assert.equal(qualifier.status, "cpu_preflight_only_gpu_not_initialized")
  return { root, policy, policyBinding, proposal, parent, programBindings,
    registryRevision: current.registry.registryRevision,
    registrySha256: current.registrySha256 }
}

function identityFor(ready) {
  const digest = sha(Buffer.from(JSON.stringify({ capabilityVersion: CAPABILITY,
    policy: ready.policyBinding, sourceData: ready.policy.predecessorCandidate,
    cpuAcceptance: ready.policy.cpuAcceptance,
    programBindings: ready.programBindings, resourceBudget: BUDGET,
    trainingPlan: PLAN })))
  return { runId: `mvp256-dry-v27-v3-${digest.slice(0, 48)}`,
    packageId: `mvp256-dry-v27-v3-package-${digest.slice(0, 40)}` }
}

async function advance(registry, root, { runId, packageId, outputRoot,
  evidence, programBindings, activeExecution, activity, state,
  latestTrainingTerminal = null }) {
  const current = await registry.read(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  if (activeExecution) assert.equal(current.registry.activeExecution, null)
  else if (current.registry.activeExecution)
    assert.equal(current.registry.activeExecution.runId, runId)
  const capsule = writeExclusive(root,
    `${outputRoot}/${activeExecution ? "begin" : state === "completed"
      ? "training-complete" : "training-failed"}-capsule.json`, {
      schemaVersion: "ai-painter-local-task-capsule-v1", taskId: runId,
      integrity: { status: "verified" },
      evidence: [{ ...evidence, kind: "mvp256_dry_v27_bounded_training",
        sha256Verified: true }],
    })
  const result = await registry.advance({ projectRoot: root,
    capabilityVersion: CAPABILITY, packageId, taskId: runId,
    taskKind: "mvp256_dry_v27_bounded_training",
    taskGoal: "One bounded V27 256x192 dry-world train/validation comparison.",
    priority: 5, queueStatus: activeExecution ? "running" : state,
    nextMachineAction: null, queuedAtUtc: now(), runId,
    lifecycleStage: "dry_single_world_256x192",
    executionState: state, activity, taskCapsulePath: capsule.path,
    terminalEvidencePath: evidence.path, activeExecution,
    ...(latestTrainingTerminal ? { latestTrainingTerminal } : {}),
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  assert.equal(result.ok, true, "V27 current registry advance failed")
  return result
}

export function updateHeartbeat(root, outputRoot, identity, publicationOptions) {
  const target = inside(root, `${outputRoot}/heartbeat.json`)
  const heartbeat = JSON.parse(fs.readFileSync(target, "utf8"))
  assert.equal(heartbeat.runId, identity.runId)
  assert.equal(heartbeat.processId, identity.processId)
  heartbeat.heartbeatAtUtc = now()
  const temporary = `${target}.staged-${process.pid}-${crypto.randomBytes(6).toString("hex")}`
  const descriptor = fs.openSync(temporary, "wx")
  try { fs.writeFileSync(descriptor, `${JSON.stringify(heartbeat, null, 2)}\n`)
    fs.fsyncSync(descriptor) }
  finally { fs.closeSync(descriptor) }
  return replaceHeartbeatFile(temporary, target, publicationOptions)
}

export function heartbeatFailureEvidence(reason) {
  if (!reason) return null
  return {
    name: reason.name ?? null,
    message: String(reason.message ?? reason),
    stack: String(reason.stack ?? reason),
    code: reason.code ?? null,
    errno: reason.errno ?? null,
    syscall: reason.syscall ?? null,
    path: reason.path ?? null,
    dest: reason.dest ?? null,
    heartbeatPublication: reason.heartbeatPublication ?? null,
  }
}

export async function runReviewPipeline({ root, terminalBinding, command,
  registry = productionRegistry, programBindings, outputRoot, runId, packageId }) {
  // Review has its own failure boundary: never rewrite a successful training
  // terminal or register a review error as an optimizer failure.
  try {
    for (const item of Object.values(programBindings)) readBound(root, item)
    const compared = JSON.parse((await command({ file: inside(root, PYTHON),
      args: ["-B", inside(root, PROGRAMS.cpuReview), "--terminal", terminalBinding.path,
        "--sha256", terminalBinding.sha256, "--execute"], root, timeout: 180_000 })).stdout)
    readBound(root, compared)
    const reviewed = JSON.parse((await command({ file: process.execPath,
      args: [inside(root, PROGRAMS.independentAudit), "--execute", compared.path,
        compared.sha256], root, timeout: 180_000 })).stdout)
    readBound(root, reviewed.report)
    const closed = JSON.parse((await command({ file: process.execPath,
      args: [inside(root, PROGRAMS.reconciliation), "--execute", reviewed.report.path,
        reviewed.report.sha256], root, timeout: 120_000 })).stdout)
    assert.ok(["dry_single_world_review_failed_closed",
      "dry_single_world_numeric_passed_visual_approval_pending"].includes(closed.status))
    readBound(root, closed.terminal)
    return { ...closed, cpuComparison: compared, audit: reviewed.report }
  } catch (error) {
    const failure = writeExclusive(root, `${outputRoot}/review-pipeline-failure.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v27-v3-review-pipeline-failure-v1",
      status: "review_execution_failed_closed", executionState: "failed_closed",
      runId, packageId, capabilityVersion: CAPABILITY, trainingTerminal: terminalBinding,
      error: String(error.stack ?? error), optimizerStepsStartedByReview: 0,
      automaticRetryStarted: false, formalStage4QualificationGranted: false,
      runtimePublicationGranted: false, recordedAtUtc: now(),
    })
    const current = await registry.read(root)
    assert.equal(current.ok, true)
    assert.equal(current.registry.activeExecution, null)
    assert.equal(current.registry.runId, runId)
    assert.equal(current.registry.latestTrainingTerminal.sha256, terminalBinding.sha256)
    const capsule = writeExclusive(root, `${outputRoot}/review-failed-capsule.json`, {
      schemaVersion: "ai-painter-local-task-capsule-v1", taskId: `${runId}-review`,
      integrity: { status: "verified" }, evidence: [
        { ...failure, kind: "bounded_review_failure", sha256Verified: true },
        { ...terminalBinding, kind: "completed_training_terminal", sha256Verified: true },
      ],
    })
    const result = await registry.advance({ projectRoot: root,
      capabilityVersion: CAPABILITY, packageId, taskId: `${runId}-review`,
      taskKind: "mvp256_dry_v27_review_failure", taskGoal: "Close a failed bounded review; do not retrain.",
      priority: 5, queueStatus: "failed_closed", nextMachineAction: null,
      queuedAtUtc: now(), runId, lifecycleStage: "dry_single_world_256x192",
      executionState: "failed_closed", activity: "review_execution_failed_closed",
      taskCapsulePath: capsule.path, terminalEvidencePath: failure.path, activeExecution: null,
      expectedPreviousRegistryRevision: current.registry.registryRevision,
      expectedPreviousRegistrySha256: current.registrySha256,
    })
    assert.equal(result.ok, true)
    return { status: "review_execution_failed_closed", failure, stage4Advanced: false }
  }
}

export async function run({ projectRoot = ROOT, execute = false,
  registry = productionRegistry, command = productionCommand,
  processIdentityReader = processIdentity, preflightReady = null,
  intervalFactory = setInterval, intervalClear = clearInterval,
  heartbeatUpdater = updateHeartbeat } = {}) {

  const ready = preflightReady ?? await preflight({ projectRoot, registry, command })
  validateProgramSources(ready.root, ready.programBindings)
  if (!execute) return { status: "cpu_preflight_passed_training_not_started",
    registryRevision: ready.registryRevision, trainingStarted: false,
    gpuInitialized: false }
  const root = ready.root
  const before = await registry.read(root)
  assert.equal(before.ok, true)
  assert.equal(before.registry.registryRevision, ready.registryRevision)
  assert.equal(before.registrySha256, ready.registrySha256)
  assert.equal(before.registry.activeExecution, null)
  const { runId, packageId } = identityFor(ready)
  const outputRoot = `${OUTPUT_PARENT}/${runId}`
  fs.mkdirSync(inside(root, OUTPUT_PARENT), { recursive: true })
  const claim = writeExclusive(root, CLAIM_PATH, {
    schemaVersion: "ai-painter-mvp256-dry-v27-v3-single-training-attempt-claim-v1",
    capabilityVersion: CAPABILITY, candidateContract: ready.policyBinding,
    executionVersion: "shared_hidden_historical_observation_repair_v27_v3",
    modelCpuEvidence: ready.policy.modelCpuEvidence,
    runId, packageId, automaticRetries: 0, claimedAtUtc: now(),
  })
  fs.mkdirSync(inside(root, outputRoot))
  let base = null
  let baseBinding = null
  let heartbeatTimer = null
  let activeRegistered = false
  const abort = new AbortController()
  try {
    base = buildBasePackage({ policy: ready.policy, parent: ready.parent,
      policyBinding: ready.policyBinding, runId, packageId, outputRoot,
      programBindings: ready.programBindings })
    baseBinding = writeExclusive(root, `${outputRoot}/execution-package.json`, base)
    const processIdentityValue = { capabilityVersion: CAPABILITY,
      runId, packageId, processId: process.pid,
      processStartIdentity: processIdentityReader(process.pid) }
    const registryLock = writeExclusive(root, `${outputRoot}/execution-lock.json`, {
      schemaVersion: "ai-painter-current-active-execution-lock-v1",
      ...processIdentityValue })
    writeExclusive(root, `${outputRoot}/heartbeat.json`, {
      schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
      ...processIdentityValue, executionState: "executing",
      heartbeatAtUtc: now(), ttlSeconds: 120 })
    const activeExecution = {
      schemaVersion: "ai-painter-current-active-execution-v1",
      ...processIdentityValue, executionState: "executing",
      programLineage: ready.programBindings, lock: registryLock,
      heartbeat: { path: `${outputRoot}/heartbeat.json`, ttlSeconds: 120 },
    }
    const dispatch = writeExclusive(root, `${outputRoot}/training-dispatched.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v27-v3-training-lifecycle-v1",
      status: "base_package_dispatched_gpu_gate_pending",
      executionState: "completed", runId, packageId,
      capabilityVersion: CAPABILITY, singleAttemptClaim: claim,
      executionPackage: baseBinding, trainingStarted: false,
      gpuQualificationStarted: false,
      formalStage4QualificationGranted: false,
      runtimePublicationGranted: false, recordedAtUtc: now(),
    })
    await advance(registry, root, { runId, packageId, outputRoot,
      evidence: dispatch, programBindings: ready.programBindings,
      activeExecution, activity: "gpu_qualification_pending", state: "executing" })
    activeRegistered = true
    heartbeatTimer = intervalFactory(() => {
      try { heartbeatUpdater(root, outputRoot, processIdentityValue) }
      catch (error) { abort.abort(error) }
    }, 10_000)
    const admissionResult = await command({ file: inside(root, PYTHON),
      args: ["-B", inside(root, GPU_QUALIFIER), "--admission-preflight",
        "--package", baseBinding.path, "--sha256", baseBinding.sha256], root,
      timeout: 120_000, signal: abort.signal })
    const admission = JSON.parse(admissionResult.stdout)
    assert.equal(admission.status, "managed_package_admission_passed_gpu_not_initialized")
    assert.equal(admission.capabilityVersion, CAPABILITY)
    assert.deepEqual(admission.executionPackage, baseBinding)
    assert.equal(admission.gpuInitialized, false)
    assert.equal(admission.optimizerCreated, false)
    assert.equal(admission.qualificationClaimCreated, false)
    const qualifierResult = await command({ file: inside(root, PYTHON),
      args: ["-B", inside(root, GPU_QUALIFIER), "--package", baseBinding.path,
        "--sha256", baseBinding.sha256, "--execute"], root,
      timeout: 660_000, signal: abort.signal })
    assert.equal(JSON.parse(qualifierResult.stdout).status,
      "current_candidate_zero_update_gpu_qualification_passed")
    const gpuBinding = bind(root, `${outputRoot}/zero-update-gpu-qualification.json`)
    const gpu = boundJson(root, gpuBinding)
    const managedLock = writeExclusive(root, `${outputRoot}/managed-training-lock.json`, {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-managed-lock-v1",
      status: "active_bound_single_attempt", runId, packageId,
      executionPackage: baseBinding, resourceBudget: structuredClone(BUDGET) })
    const launch = writeExclusive(root, `${outputRoot}/supervisor-launch-identity.json`, {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-launch-identity-v1",
      status: "managed_supervisor_identity_verified", runId, packageId,
      executionPackage: baseBinding, managedLock,
      processId: processIdentityValue.processId,
      processStartIdentity: processIdentityValue.processStartIdentity })
    const ticket = {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v27-v3-training-ticket-v1",
      status: "issued_single_use", capabilityVersion: CAPABILITY,
      runId, packageId, executionPackage: baseBinding,
      gpuQualification: gpuBinding, managedLock, launchIdentity: launch,
      consumptionClaimPath: `${outputRoot}/training-ticket-consumed.json`,
      trainingAllowed: true, automaticRetries: 0,
      formalStage4QualificationAllowed: false,
      runtimePublicationAllowed: false,
    }
    const ticketBinding = writeExclusive(root, `${outputRoot}/training-ticket.json`, ticket)
    const trainIds = boundJson(root, ready.parent.frozenBindings.trainSplit).sampleIds
    validateActivationChain({ base, baseBinding, gpu, gpuBinding,
      lock: boundJson(root, managedLock), lockBinding: managedLock,
      launch: boundJson(root, launch), launchBinding: launch,
      ticket, ticketBinding, trainIds })
    const activation = writeExclusive(root, `${outputRoot}/training-activated.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v27-v3-training-lifecycle-v1",
      status: "single_use_training_ticket_issued", executionState: "executing",
      runId, packageId, executionPackage: baseBinding,
      gpuQualification: gpuBinding, trainingTicket: ticketBinding,
      trainingStarted: false, recordedAtUtc: now(),
    })
    readBound(root, activation)
    await command({ file: inside(root, PYTHON),
      args: ["-B", inside(root, WORKER), "--run",
        "--training-ticket", ticketBinding.path,
        "--training-ticket-sha256", ticketBinding.sha256,
        "--output", `${outputRoot}/phase-terminal.json`], root,
      timeout: (BUDGET.maxWallSeconds + 120) * 1000,
      signal: abort.signal })
    const workerBinding = bind(root, `${outputRoot}/phase-terminal.json`)
    const worker = boundJson(root, workerBinding)
    const selected = validateWorkerTerminal(root, worker, base, ticketBinding)
    if (heartbeatTimer) intervalClear(heartbeatTimer)
    heartbeatTimer = null
    const final = writeExclusive(root, `${outputRoot}/training-finalize.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v27-v3-training-lifecycle-v1",
      status: "training_completed_review_pending", executionState: "completed",
      runId, packageId, capabilityVersion: CAPABILITY,
      executionPackage: baseBinding, gpuQualification: gpuBinding,
      trainingTicket: ticketBinding, workerTerminal: workerBinding,
      selectedEpoch: worker.selectedEpoch, selectedRank: worker.selectedRank,
      selectedCheckpoint: selected.checkpoint,
      checkpointReloadVerified: true, checkpointPromotable: false,
      trainingProgress: bind(root, `${outputRoot}/progress.json`),
      formalStage4QualificationGranted: false,
      runtimePublicationGranted: false, recordedAtUtc: now(),
    })
    await advance(registry, root, { runId, packageId, outputRoot,
      evidence: final, programBindings: ready.programBindings,
      activeExecution: null, activity: "training_completed_review_pending",
      state: "completed", latestTrainingTerminal: { runId,
        path: final.path, sha256: final.sha256,
        status: "training_completed_review_pending", evidence: {
          workerTerminal: workerBinding,
          trainingProgress: bind(root, `${outputRoot}/progress.json`) } } })
    activeRegistered = false
    const review = await runReviewPipeline({ root, terminalBinding: final, command,
      registry, programBindings: ready.programBindings, outputRoot, runId, packageId })
    return { status: review.status, runId, packageId, trainingStatus: "completed",
      executionPackage: baseBinding, workerTerminal: workerBinding,
      selectedCheckpoint: selected.checkpoint, review }
  } catch (error) {
    if (heartbeatTimer) intervalClear(heartbeatTimer)
    heartbeatTimer = null
    const available = {}
    for (const [key, logical] of [
      ["workerTerminal", `${outputRoot}/phase-terminal.json`],
      ["progress", `${outputRoot}/progress.json`],
      ["gpuFailure", `${outputRoot}/zero-update-gpu-qualification-failure.json`],
    ]) {
      try { if (fs.existsSync(inside(root, logical))) available[key] = bind(root, logical) }
      catch { /* the failure record below preserves the causal error */ }
    }
    const worker = available.workerTerminal ? boundJson(root, available.workerTerminal) : null
    const progress = available.progress ? boundJson(root, available.progress) : null
    const generatorSteps = worker?.optimizerStepsGenerator
      ?? progress?.optimizerStepsGenerator ?? 0
    const discriminatorSteps = worker?.optimizerStepsDiscriminator
      ?? progress?.optimizerStepsDiscriminator ?? 0
    const failure = writeExclusive(root, `${outputRoot}/failure.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v27-v3-training-failure-v1",
      status: "failed_closed", executionState: "failed_closed",
      runId, packageId, capabilityVersion: CAPABILITY,
      executionPackage: baseBinding, error: String(error.stack ?? error),
      abortReason: heartbeatFailureEvidence(abort.signal.reason),
      workerTerminal: available.workerTerminal ?? null,
      progress: available.progress ?? null,
      gpuQualificationFailure: available.gpuFailure ?? null,
      optimizerStepsGenerator: generatorSteps,
      optimizerStepsDiscriminator: discriminatorSteps,
      trainingStarted: generatorSteps > 0 || discriminatorSteps > 0,
      automaticRetryStarted: false, checkpointPromotable: false,
      formalStage4QualificationGranted: false,
      runtimePublicationGranted: false, recordedAtUtc: now(),
    })
    if (activeRegistered) {
      try {
        const current = await registry.read(root)
        if (current.ok && current.registry.activeExecution?.runId === runId) {
          const evidence = {}
          if (available.workerTerminal) evidence.workerTerminal = available.workerTerminal
          if (available.progress) evidence.trainingProgress = available.progress
          await advance(registry, root, { runId, packageId, outputRoot,
            evidence: failure, programBindings: ready.programBindings,
            activeExecution: null, activity: "failed_closed", state: "failed_closed",
            latestTrainingTerminal: { runId, path: failure.path,
              sha256: failure.sha256, status: "failed_closed", evidence } })
          activeRegistered = false
        }
      } catch (registryError) {
        writeExclusive(root, `${outputRoot}/registry-finalization-failure.json`, {
          schemaVersion: "ai-painter-mvp256-dry-v27-v3-registry-finalization-failure-v1",
          status: "failed_closed", runId, packageId,
          error: String(registryError.stack ?? registryError),
          recordedAtUtc: now(),
        })
      }
    }
    return { status: "failed_closed", runId, packageId,
      failure, error: String(error.message ?? error) }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const execute = process.argv.slice(2).includes("--execute")
  assert.deepEqual(process.argv.slice(2), execute ? ["--execute"] : [])
  process.stdout.write(`${JSON.stringify(await run({ execute }))}\n`)
}
