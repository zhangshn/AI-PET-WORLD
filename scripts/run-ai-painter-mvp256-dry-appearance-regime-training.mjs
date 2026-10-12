// One managed V28 dry-world attempt. CPU, GPU, training, and review are distinct.
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
  validateBasePackage, addDependencyBindings, validateProgramBindings } from "./lib/ai-painter-mvp256-dry-appearance-regime-package-chain-v1.mjs"
import { replaceHeartbeatFile, heartbeatPublicationRule } from "./run-ai-painter-learning-capacity-experiment.mjs"

const execFileAsync = promisify(execFile)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-appearance-regime-bias-precision-execution-policy-v1.json"
export const PROPOSAL_PATH = null
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const WORKER = "ml/ai-painter/scripts/painter_stage4_appearance_regime_checkpoint_worker.py"
const GPU_QUALIFIER = "ml/ai-painter/scripts/qualify_stage4_appearance_regime_gpu.py"
const OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp256-dry-v28-executions"
const CLAIM_PATH = `${OUTPUT_PARENT}/single-training-attempt-claim.json`
const MODEL_CPU_PATH = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/season-managed-execution-t-q4-36/numeric/report.json"
export const PROGRAMS = {
  "supervisor": "scripts/run-ai-painter-mvp256-dry-appearance-regime-training.mjs",
  "packageChain": "scripts/lib/ai-painter-mvp256-dry-appearance-regime-package-chain-v1.mjs",
  "cpuAcceptance": "scripts/run-ai-painter-mvp256-dry-appearance-regime-cpu-acceptance.mjs",
  "independentAudit": "scripts/run-ai-painter-mvp256-dry-appearance-regime-independent-audit.mjs",
  "reconciliation": "scripts/reconcile-ai-painter-mvp256-dry-appearance-regime-review.mjs",
  "worker": "ml/ai-painter/scripts/painter_stage4_appearance_regime_checkpoint_worker.py",
  "gpuQualifier": "ml/ai-painter/scripts/qualify_stage4_appearance_regime_gpu.py",
  "cpuReview": "ml/ai-painter/scripts/review_stage4_appearance_regime_cpu.py",
  "supervisorTests": "scripts/tests/run-ai-painter-mvp256-dry-appearance-regime-training.test.mjs",
  "packageChainTests": "scripts/tests/ai-painter-mvp256-dry-appearance-regime-package-chain-v1.test.mjs",
  "reviewTests": "scripts/tests/ai-painter-mvp256-dry-appearance-regime-review.test.mjs",
  "workerTests": "ml/ai-painter/tests/test_painter_stage4_appearance_regime_checkpoint_worker.py",
  "gpuQualifierTests": "ml/ai-painter/tests/test_qualify_stage4_appearance_regime_gpu.py",
  "cpuReviewTests": "ml/ai-painter/tests/test_review_stage4_appearance_regime_cpu.py",
  "model": "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_bias_precision.py",
  "modelTests": "ml/ai-painter/tests/test_object_appearance_regime_bias_precision.py",
  "probe": "ml/ai-painter/scripts/painter_stage4_appearance_regime_probe.py",
  "probeTests": "ml/ai-painter/tests/test_painter_stage4_appearance_regime_probe.py",
  "priority": "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_priority_update.py",
  "priorityTests": "ml/ai-painter/tests/test_object_appearance_regime_priority_update.py",
  "precision": "ml/ai-painter/src/ai_painter/complete_world/rgb_bias_reduction_precision.py",
  "precisionTests": "ml/ai-painter/tests/test_rgb_bias_reduction_precision.py",
  "cpuChecker": "ml/ai-painter/scripts/check_stage4_appearance_regime_execution_cpu.py",
  "cpuCheckerTests": "ml/ai-painter/tests/test_check_stage4_appearance_regime_execution_cpu.py",
  "v24Worker": "ml/ai-painter/scripts/painter_stage4_v24_dry_single_world_checkpoint_worker.py",
  "v24Profile": "ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py"
}
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
const now = () => new Date().toISOString()


export const NUMERIC_CPU = MODEL_CPU_PATH
export const AGGREGATION_RULE = "strict_deterministic_index_add_scoped_to_object_assembly_v1"
export const SINGLE_CHANGE = { operation: "four_independent_rgb_heads_zero_source_bound_season_branch_fp64_bias_device_v1",
  trainingAndInference: true, dropoutEnabled: false, fullV23ContextPreserved: true,
  groupCount: 5, modelParameterTensorCount: 107, modelParameterElementCount: 2240671,
  objectParameterTensorCount: 16, objectParameterElementCount: 4876,
  seasonalParameterTensorCount: 1, seasonalParameterElementCount: 1152 }
export const ARCHITECTURE = "fresh_v23_four_heads_zero_season_branch_rgb_bias_fp64_device_v1"
export function validateNumericCpuReport(report) {
  assert.equal(report.capabilityVersion, CAPABILITY)
  assert.equal(report.architecture, ARCHITECTURE)
  assert.equal(report.status, "cpu_execution_bridge_checked_not_gpu_qualified")
  assert.equal(report.synthetic, false)
  assert.deepEqual(report.callCounts, { modelForwardsAttempted: 4, modelForwardsCompleted: 4,
    generatorGradCallsAttempted: 16, generatorGradCallsCompleted: 16,
    discriminatorGradCallsAttempted: 4, discriminatorGradCallsCompleted: 4 })
  assert.equal(report.optimizerSteps, 0)
  assert.equal(report.gpuInitialized, false)
  assert.equal(report.terminalAssertionsCompleted, true)
  assert.deepEqual(report.initialState, report.finalState)
  assert.equal(report.actualGraph?.tensors, 107)
  assert.equal(report.actualGraph.elements, 2240671)
  assert.equal(report.actualGraph.seasonalElements, 1152)
  assert.equal(report.actualGraph.parameters?.length, 107)
  assert.equal(report.parameterInitialization?.originalParameterDigest, report.parameterInitialization?.successorParameterDigest)
  assert.match(report.parameterInitialization.successorParameterDigest, /^[0-9a-f]{64}$/u)
  assert.ok(report.inputBindings?.length > 0)
  return report
}
export const FROZEN_REGISTRY_INPUT = {
  "observed": {
    "path": ".runtime/ai-painter/current-execution-registry/current.json",
    "sha256": "1dab2b28f25a2e087498f10627dfa3352ec2f18edb87bf402b59634d3df8b5aa"
  },
  "transaction": {
    "path": ".runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c/transaction.json",
    "sha256": "5b97e75842d4d56f0d60c25b2eeb95a54891a0f0058556d187323c1522fa1482"
  },
  "snapshot": {
    "path": ".runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c/current.staged.json",
    "sha256": "1dab2b28f25a2e087498f10627dfa3352ec2f18edb87bf402b59634d3df8b5aa"
  },
  "event": {
    "path": ".runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c/registry-event.staged.jsonl",
    "sha256": "5eff2a54dcab0893f299c57dbce24bebbe652bcbf8447a775ed048754fab0983"
  },
  "transactionId": "current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c",
  "registryRevision": 371
}
export function readNumericInput(root, binding) {
  if (binding.path !== FROZEN_REGISTRY_INPUT.observed.path) return readBound(root, binding)
  assert.deepEqual(binding, FROZEN_REGISTRY_INPUT.observed)
  const frozen = FROZEN_REGISTRY_INPUT
  const transaction = boundJson(root, frozen.transaction)
  const snapshot = boundJson(root, frozen.snapshot)
  const event = boundJson(root, frozen.event)
  assert.equal(transaction.status, "committed")
  assert.deepEqual(transaction.currentStaged, frozen.snapshot)
  assert.deepEqual(transaction.registryEventStaged, frozen.event)
  assert.equal(transaction.currentSha256, frozen.observed.sha256)
  assert.equal(event.currentSha256, frozen.observed.sha256)
  for (const record of [transaction, snapshot, event]) {
    assert.equal(record.transactionId, frozen.transactionId)
    assert.equal(record.registryRevision, frozen.registryRevision)
    assert.equal(record.eventSequence, frozen.registryRevision)
  }
  assert.equal(snapshot.activeExecution, null)
  assert.ok(Date.parse(transaction.committedAtUtc) >= Date.parse(transaction.recordedAtUtc))
  return readBound(root, frozen.snapshot)
}
export function readNumericCpuProof(root, binding) {
  assert.equal(binding.path, NUMERIC_CPU)
  const report = validateNumericCpuReport(boundJson(root, binding))
  const claim = boundJson(root, bind(root, path.posix.dirname(NUMERIC_CPU) + "/claim.json"))
  assert.equal(claim.task, "T-Q4-36-N")
  assert.equal(claim.synthetic, false)
  assert.equal(claim.attempt, 1)
  assert.equal(claim.automaticRetries, 0)
  assert.deepEqual(claim.binding, report.binding)
  readBound(root, report.binding)
  for (const item of report.inputBindings) readNumericInput(root, item)
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


export function describePolicy({ root, cpuAcceptance, programBindings }) {
  const predecessorCandidate = bind(root, "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")
  const parent = boundJson(root, predecessorCandidate)
  return { schemaVersion: "stage4-mvp256-dry-appearance-regime-bias-precision-execution-policy-v1",
    status: "cpu_accepted_not_gpu_qualified", capabilityVersion: CAPABILITY,
    executionVersion: "appearance_regime_bias_precision_device_v1", predecessorCandidate,
    modelCpuEvidence: bind(root, MODEL_CPU_PATH),
    modelCpuClaim: bind(root, path.posix.dirname(MODEL_CPU_PATH) + "/claim.json"), cpuAcceptance, programBindings,
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
  assert.equal(cpu.status, "v28_lifecycle_cpu_acceptance_passed")
  assert.equal(cpu.schemaVersion, "ai-painter-mvp256-dry-v28-lifecycle-cpu-acceptance-v1")
  assert.equal(cpu.scope, "synthetic_cpu_tests_and_real_isolated_registry_package_admission_not_gpu_qualification")
  assert.equal(cpu.isolatedAdmission?.admission?.status, "managed_package_admission_passed_gpu_not_initialized")
  assert.equal(cpu.isolatedAdmission.admission.capabilityVersion, CAPABILITY)
  assert.equal(cpu.isolatedAdmission.admission.gpuInitialized, false)
  assert.equal(cpu.isolatedAdmission.admission.qualificationClaimCreated, false)
  assert.equal(cpu.productionRegistryUnchanged, true)
  assert.equal(cpu.productionPolicyWritten, false)
  assert.equal(cpu.capabilityVersion, CAPABILITY)
  assert.deepEqual(cpu.modelCpuEvidence, policy.modelCpuEvidence)
  assert.deepEqual(cpu.formalSpecification, policy.formalSpecification)
  assert.deepEqual(cpu.executionGuide, policy.executionGuide)
  assert.equal(cpu.failedTests, 0)
  assert.equal(cpu.skippedTests, 0)
  assert.ok(cpu.passedTests > 0)
  assert.equal(cpu.optimizerSteps, 0)
  assert.deepEqual(cpu.syntheticOptimizerSteps, { generator: 0, discriminator: 0 })
  assert.equal(cpu.gpuInitialized, false)
  assert.equal(cpu.trainingStarted, false)
  assert.equal("candidateContract" in cpu, false)
  const claim = boundJson(root, cpu.claim)
  assert.equal(claim.schemaVersion, "ai-painter-mvp256-dry-v28-lifecycle-cpu-claim-v1")
  assert.equal(claim.capabilityVersion, CAPABILITY)
  assert.equal(claim.attempt, 1)
  assert.equal(claim.automaticRetries, 0)
  for (const key of ["programBindings", "modelCpuEvidence", "formalSpecification", "executionGuide",
    ])
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
  assert.deepEqual(pyResult.syntheticOptimizerSteps, { generator: 0, discriminator: 0 })
  for (const key of ["fail", "cancelled", "skipped"]) assert.equal(tapCount(key), 0)
  assert.equal(tapCount("tests"), tapCount("pass"))
  assert.equal(pyResult.testsRun + tapCount("pass"), cpu.passedTests)
  assert.deepEqual(cpu.programBindings, policy.programBindings)
  for (const item of Object.values(cpu.programBindings)) readBound(root, item)
  for (const [role, logical] of Object.entries(PROGRAMS))
    assert.deepEqual(cpu.programBindings[role], bind(root, logical))
  assert.match(readBound(root, policy.formalSpecification).toString("utf8"), /AI-PAINTER-SPEC-1\.44/u)
  for (const item of Object.values(parent.frozenBindings)) readBound(root, item)
  for (const item of Object.values(policy.baseline)) readBound(root, item)
  return cpu
}

export function buildBasePackage({ policy, parent, policyBinding, runId,
  packageId, outputRoot, programBindings }) {
  const base = {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v28-execution-package-v1",
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
    "ai-painter-stage4-mvp256-dry-v28-worker-terminal-v1")
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
    "ai-painter-stage4-mvp256-dry-v28-ticket-consumption-v1")
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
  return { runId: `mvp256-dry-v28-${digest.slice(0, 48)}`,
    packageId: `mvp256-dry-v28-package-${digest.slice(0, 40)}` }
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
      evidence: [{ ...evidence, kind: "mvp256_dry_v28_bounded_training",
        sha256Verified: true }],
    })
  const result = await registry.advance({ projectRoot: root,
    capabilityVersion: CAPABILITY, packageId, taskId: runId,
    taskKind: "mvp256_dry_v28_bounded_training",
    taskGoal: "One bounded V28 256x192 dry-world train/validation comparison.",
    priority: 5, queueStatus: activeExecution ? "running" : state,
    nextMachineAction: null, queuedAtUtc: now(), runId,
    lifecycleStage: "dry_single_world_256x192",
    executionState: state, activity, taskCapsulePath: capsule.path,
    terminalEvidencePath: evidence.path, activeExecution,
    ...(latestTrainingTerminal ? { latestTrainingTerminal } : {}),
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  assert.equal(result.ok, true, "V28 current registry advance failed")
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
      schemaVersion: "ai-painter-mvp256-dry-v28-review-pipeline-failure-v1",
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
      taskKind: "mvp256_dry_v28_review_failure", taskGoal: "Close a failed bounded review; do not retrain.",
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

  assert.ok(preflightReady === null || process.env.NODE_TEST_CONTEXT, "preflightReady is a test-only boundary")
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
    schemaVersion: "ai-painter-mvp256-dry-v28-single-training-attempt-claim-v1",
    capabilityVersion: CAPABILITY, candidateContract: ready.policyBinding,
    executionVersion: "appearance_regime_bias_precision_device_v1",
    modelCpuEvidence: ready.policy.modelCpuEvidence,
    runId, packageId, automaticRetries: 0, claimedAtUtc: now(),
  })
  fs.mkdirSync(inside(root, outputRoot))
  let base = null
  let baseBinding = null
  let heartbeatTimer = null
  let activeRegistered = false
  let workerCommandStarted = false
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
      schemaVersion: "ai-painter-mvp256-dry-v28-training-lifecycle-v1",
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
      schemaVersion: "ai-painter-stage4-mvp256-dry-v28-managed-lock-v1",
      status: "active_bound_single_attempt", runId, packageId,
      executionPackage: baseBinding, resourceBudget: structuredClone(BUDGET) })
    const launch = writeExclusive(root, `${outputRoot}/supervisor-launch-identity.json`, {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v28-launch-identity-v1",
      status: "managed_supervisor_identity_verified", runId, packageId,
      executionPackage: baseBinding, managedLock,
      processId: processIdentityValue.processId,
      processStartIdentity: processIdentityValue.processStartIdentity })
    const ticket = {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v28-training-ticket-v1",
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
      schemaVersion: "ai-painter-mvp256-dry-v28-training-lifecycle-v1",
      status: "single_use_training_ticket_issued", executionState: "executing",
      runId, packageId, executionPackage: baseBinding,
      gpuQualification: gpuBinding, trainingTicket: ticketBinding,
      trainingStarted: false, recordedAtUtc: now(),
    })
    readBound(root, activation)
    workerCommandStarted = true
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
      schemaVersion: "ai-painter-mvp256-dry-v28-training-lifecycle-v1",
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
    const diagnosticErrors = []
    const diagnostic = (binding, name) => {
      if (!binding) return null
      try {
        const value = boundJson(root, binding)
        assert.equal(value.runId, runId)
        assert.equal(value.packageId, packageId)
        assert.equal(value.capabilityVersion, CAPABILITY)
        return value
      } catch (secondary) {
        diagnosticErrors.push({ name, binding, error: String(secondary.stack ?? secondary) })
        return null
      }
    }
    const worker = diagnostic(available.workerTerminal, "workerTerminal")
    const progress = diagnostic(available.progress, "progress")
    const boundedCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 2304 ? value : null
    const generatorSteps = boundedCount(worker?.optimizerStepsGenerator)
      ?? boundedCount(progress?.optimizerStepsGenerator) ?? (workerCommandStarted ? null : 0)
    const discriminatorSteps = boundedCount(worker?.optimizerStepsDiscriminator)
      ?? boundedCount(progress?.optimizerStepsDiscriminator) ?? (workerCommandStarted ? null : 0)
    const optimizerCountsKnown = generatorSteps !== null && discriminatorSteps !== null
    const failureStatus = worker?.status ?? "failed_closed"
    const failure = writeExclusive(root, `${outputRoot}/failure.json`, {
      schemaVersion: "ai-painter-mvp256-dry-v28-training-lifecycle-v1",
      status: failureStatus, executionState: "failed_closed",
      runId, packageId, capabilityVersion: CAPABILITY,
      executionPackage: baseBinding, error: String(error.stack ?? error),
      abortReason: heartbeatFailureEvidence(abort.signal.reason),
      diagnosticErrors, diagnosticEvidence: available, optimizerCountsKnown,
      workerTerminal: worker ? available.workerTerminal : null,
      progress: progress ? available.progress : null,
      trainingProgress: progress ? available.progress : null,
      gpuQualificationFailure: available.gpuFailure ?? null,
      optimizerStepsGenerator: generatorSteps,
      optimizerStepsDiscriminator: discriminatorSteps,
      completedEpochs: worker?.completedEpochs ?? progress?.completedEpochs ?? (optimizerCountsKnown ? Math.floor(Math.min(generatorSteps, discriminatorSteps) / 48) : null),
      trainingStarted: workerCommandStarted,
      automaticRetryStarted: false, checkpointPromotable: false,
      formalStage4QualificationGranted: false,
      runtimePublicationGranted: false, recordedAtUtc: now(),
    })
    if (activeRegistered) {
      try {
        const current = await registry.read(root)
        if (current.ok && current.registry.activeExecution?.runId === runId) {
          const evidence = {}
          if (worker) evidence.workerTerminal = available.workerTerminal
          if (progress) evidence.trainingProgress = available.progress
          await advance(registry, root, { runId, packageId, outputRoot,
            evidence: failure, programBindings: ready.programBindings,
            activeExecution: null, activity: "failed_closed", state: "failed_closed",
            latestTrainingTerminal: { runId, path: failure.path,
              sha256: failure.sha256, status: failureStatus, evidence } })
          activeRegistered = false
        }
      } catch (registryError) {
        writeExclusive(root, `${outputRoot}/registry-finalization-failure.json`, {
          schemaVersion: "ai-painter-mvp256-dry-v28-registry-finalization-failure-v1",
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
