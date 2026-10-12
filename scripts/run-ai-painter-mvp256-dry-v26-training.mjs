// One managed V26 dry-world attempt. CPU, GPU, training, and review are distinct.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath, pathToFileURL } from "node:url"

import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from
  "../src/server/ai-painter-current-execution-registry.mjs"
import { bind, boundJson, inside, processIdentity, readBound, writeExclusive } from
  "./run-ai-painter-mvp256-dry-v24-training.mjs"
import { BUDGET, CAPABILITY, PLAN, validateActivationChain,
  validateBasePackage } from "./lib/ai-painter-mvp256-dry-v26-package-chain-v1.mjs"
import { replaceHeartbeatFile, heartbeatPublicationRule } from "./run-ai-painter-learning-capacity-experiment.mjs"

const execFileAsync = promisify(execFile)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-v26-context-isolation-execution-policy-v1.json"
export const PROPOSAL_PATH = ".runtime/ai-painter/stage4-mvp256-dry-v25-executions/mvp256-dry-v25-7369b2cbb9bf36a2bead6a828c0391795fa60ddfca5a7af2/dry-review/object-expression-conclusion.json"
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const WORKER = "ml/ai-painter/scripts/painter_stage4_v26_dry_single_world_checkpoint_worker.py"
const GPU_QUALIFIER = "ml/ai-painter/scripts/qualify_stage4_mvp256_dry_v26_gpu.py"
const OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp256-dry-v26-executions"
const CLAIM_PATH = `${OUTPUT_PARENT}/single-training-attempt-claim.json`
const MODEL_CPU_PATH = ".runtime/ai-painter/stage4-mvp256-dry-v26-cpu/report.json"
export const PROGRAMS = {
  supervisor: "scripts/run-ai-painter-mvp256-dry-v26-training.mjs",
  supervisorTests: "scripts/tests/test-ai-painter-mvp256-dry-v26-training.mjs",
  worker: WORKER,
  workerTests: "ml/ai-painter/tests/test_stage4_v26_dry_single_world_checkpoint_worker.py",
  gpuQualifier: GPU_QUALIFIER,
  gpuQualifierTests: "ml/ai-painter/tests/test_qualify_stage4_mvp256_dry_v26_gpu.py",
  packageChain: "scripts/lib/ai-painter-mvp256-dry-v26-package-chain-v1.mjs",
  packageChainTests: "scripts/tests/test-ai-painter-mvp256-dry-v26-package-chain-v1.mjs",
  model: "ml/ai-painter/src/ai_painter/complete_world/object_local_context_isolation_v26_cpu.py",
  modelTests: "ml/ai-painter/tests/test_object_local_context_isolation_v26_cpu.py",
  probe: "ml/ai-painter/src/ai_painter/complete_world/object_local_context_isolation_v26_probe.py",
  probeTests: "ml/ai-painter/tests/test_object_local_context_isolation_v26_integration_cpu.py",
  v24Worker: "ml/ai-painter/scripts/painter_stage4_v24_dry_single_world_checkpoint_worker.py",
  v24Profile: "ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py",
  v21ObjectCore: "ml/ai-painter/scripts/painter_stage4_v21_object_core_fidelity_probe.py",
  v21FullExposure: "ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py",
  v24Update: "ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24.py",
  v23Renderer: "ml/ai-painter/src/ai_painter/complete_world/native_rgb_complete_support_partition_v23_cpu.py",
  v21Objective: "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_core_fidelity_candidate_cpu.py",
  structuredObjective: "ml/ai-painter/src/ai_painter/complete_world/native_rgb_structured_object_objective_cpu_v17.py",
  cpuAcceptance: "scripts/run-ai-painter-mvp256-dry-v26-cpu-acceptance.mjs",
  cpuReview: "ml/ai-painter/scripts/review_stage4_mvp256_dry_v26_cpu.py",
  cpuReviewTests: "ml/ai-painter/tests/test_review_stage4_mvp256_dry_v26_cpu.py",
  reviewMetrics: "ml/ai-painter/scripts/diagnose_stage4_v24_validation_shadow.py",
  reviewFiles: "ml/ai-painter/scripts/materialize_stage4_mvp256_dry_v24_candidate.py",
  responsibilityEncoder: "ml/ai-painter/src/ai_painter/complete_world/stage4_v17_responsibility_artifact.py",
  independentAudit: "scripts/run-ai-painter-mvp256-dry-v26-independent-audit.mjs",
  reviewTests: "scripts/tests/test-ai-painter-mvp256-dry-v26-independent-audit.mjs",
  reconciliation: "scripts/reconcile-ai-painter-mvp256-dry-v26-review.mjs",
  reconciliationTests: "scripts/tests/test-ai-painter-mvp256-dry-v26-review-closure.mjs",
  heartbeatPublisher: "scripts/run-ai-painter-learning-capacity-experiment.mjs",
  heartbeatPublisherTests: "scripts/tests/test-ai-painter-experiment-heartbeat.mjs",
}
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
const now = () => new Date().toISOString()

export function validatePolicy({ root, policy, policyBinding, parent, proposal }) {
  assert.equal(policy.schemaVersion, "stage4-mvp256-dry-v26-context-isolation-execution-policy-v1")
  assert.equal(policy.status, "cpu_accepted_not_gpu_qualified")
  assert.equal(policy.capabilityVersion, CAPABILITY)
  assert.equal(policyBinding.path, POLICY_PATH)
  assert.equal(policy.executionVersion, "context_isolation_v1")
  assert.equal(policy.historicalQualificationMayBeReused, false)
  assert.equal(policy.historicalCheckpointMayInitialize, false)
  assert.deepEqual(policy.scope, parent.scope)
  assert.deepEqual(policy.dataUse, parent.dataUse)
  assert.deepEqual(policy.checkpointSelection, parent.checkpointSelection)
  assert.deepEqual(policy.executionCeiling, BUDGET)
  assert.deepEqual(policy.singleChange, {
    operation: "zero_private_learned_terrain_patches_keep_local_facts_v1",
    trainingAndInference: true, dropoutEnabled: false,
    terrainUnchangedAtSameInitialWeights: true,
    stateDictionaryKeysAndParameterCountUnchanged: true,
  })
  assert.deepEqual(policy.activation, { cpuAcceptanceCompleted: true,
    gpuQualificationAllowed: true, trainingAllowed: false,
    formalStage4QualificationAllowed: false, runtimePublicationAllowed: false })
  assert.deepEqual(policy.cpuProposal, bind(root, PROPOSAL_PATH))
  assert.deepEqual(policy.predecessorCandidate, bind(root, policy.predecessorCandidate.path))
  assert.deepEqual(policy.formalSpecification,
    bind(root, "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"))
  assert.match(readBound(root, policy.formalSpecification).toString("utf8"), /AI-PAINTER-SPEC-1\.34/u)
  assert.equal(proposal.singleRepairProposal.maximumTrainingAttempts, 1)
  assert.equal(proposal.singleRepairProposal.automaticRetries, 0)
  assert.equal(policy.modelCpuEvidence.path, MODEL_CPU_PATH)
  const modelCpu = boundJson(root, policy.modelCpuEvidence)
  assert.equal(modelCpu.status, "cpu_contract_checked_not_execution_qualified")
  assert.deepEqual(modelCpu.proposal, policy.cpuProposal)
  assert.deepEqual(modelCpu.formalSpecification, policy.formalSpecification)
  assert.deepEqual(modelCpu.datasetManifest, parent.frozenBindings.datasetManifest)
  assert.equal(modelCpu.boundary.optimizerSteps, 0)
  assert.equal(modelCpu.boundary.gpuStarted, false)
  assert.equal(modelCpu.testedTrainSampleCount, 1)
  assert.equal(modelCpu.all48GradientProbesCompleted, false)
  for (const item of Object.values(modelCpu.programBindings)) readBound(root, item)
  const cpu = boundJson(root, policy.cpuAcceptance)
  assert.equal(cpu.status, "v26_lifecycle_cpu_acceptance_passed")
  assert.equal(cpu.capabilityVersion, CAPABILITY)
  assert.deepEqual(cpu.modelCpuEvidence, policy.modelCpuEvidence)
  assert.deepEqual(cpu.formalSpecification, policy.formalSpecification)
  assert.equal(cpu.failedTests, 0)
  assert.ok(cpu.passedTests > 0)
  assert.equal(cpu.optimizerSteps, 0)
  assert.equal(cpu.gpuInitialized, false)
  assert.equal(cpu.trainingStarted, false)
  for (const [role, item] of Object.entries(cpu.programBindings))
    assert.deepEqual(bind(root, item.path), item, `CPU evidence changed: ${role}`)
  for (const [role, logical] of Object.entries(PROGRAMS))
    assert.deepEqual(cpu.programBindings[role], bind(root, logical), `missing current tested program ${role}`)
  for (const item of Object.values(parent.frozenBindings)) readBound(root, item)
  for (const item of Object.values(policy.baseline)) readBound(root, item)
  assert.deepEqual(policy.predecessorReviewTerminal,
    bind(root, ".runtime/ai-painter/stage4-mvp256-dry-v25-executions/mvp256-dry-v25-7369b2cbb9bf36a2bead6a828c0391795fa60ddfca5a7af2/dry-review/review-terminal.json"))
  return cpu
}

export function buildBasePackage({ policy, parent, policyBinding, runId,
  packageId, outputRoot, programBindings }) {
  const base = {
    schemaVersion: "ai-painter-stage4-mvp256-dry-v26-execution-package-v1",
    status: "issued_single_attempt", capabilityVersion: CAPABILITY,
    runId, packageId, outputRoot, candidateContract: policyBinding,
    sourceDataCandidate: policy.predecessorCandidate,
    cpuAcceptance: policy.cpuAcceptance,
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
    "ai-painter-stage4-mvp256-dry-v26-worker-terminal-v1")
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
    "ai-painter-stage4-mvp256-dry-v26-ticket-consumption-v1")
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
      PYTHONPATH: path.join(root, "ml/ai-painter/src") } })

export async function preflight({ projectRoot = ROOT, registry = productionRegistry,
  command = productionCommand } = {}) {
  const root = fs.realpathSync(projectRoot)


  const policyBinding = bind(root, POLICY_PATH)
  const policy = boundJson(root, policyBinding)
  const proposal = boundJson(root, bind(root, PROPOSAL_PATH))
  const parent = boundJson(root, policy.predecessorCandidate)
  validatePolicy({ root, policy, policyBinding, parent, proposal })
  const programBindings = Object.fromEntries(Object.entries(PROGRAMS)
    .map(([name, logical]) => [name, bind(root, logical)]))
  const current = await registry.read(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  assert.equal(current.registry.activeExecution, null,
    "another managed execution is active")
  assert.deepEqual(current.registry.terminalEvidence, {
    ...policy.predecessorReviewTerminal, status: "dry_single_world_review_failed_closed",
  }, "V26 requires the bound closed V25 review")
  assert.equal(current.registry.activity, "dry_single_world_review_failed_closed")

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
  return { runId: `mvp256-dry-v26-${digest.slice(0, 48)}`,
    packageId: `mvp256-dry-v26-package-${digest.slice(0, 40)}` }
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
      evidence: [{ ...evidence, kind: "mvp256_dry_v26_bounded_training",
        sha256Verified: true }],
    })
  const result = await registry.advance({ projectRoot: root,
    capabilityVersion: CAPABILITY, packageId, taskId: runId,
    taskKind: "mvp256_dry_v26_bounded_training",
    taskGoal: "One bounded V26 256x192 dry-world train/validation comparison.",
    priority: 5, queueStatus: activeExecution ? "running" : state,
    nextMachineAction: null, queuedAtUtc: now(), runId,
    lifecycleStage: "dry_single_world_256x192",
    executionState: state, activity, taskCapsulePath: capsule.path,
    terminalEvidencePath: evidence.path, activeExecution,
    ...(latestTrainingTerminal ? { latestTrainingTerminal } : {}),
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  assert.equal(result.ok, true, "V26 current registry advance failed")
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
      schemaVersion: "ai-painter-mvp256-dry-v26-review-pipeline-failure-v1",
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
      taskKind: "mvp256_dry_v26_review_failure", taskGoal: "Close a failed bounded review; do not retrain.",
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
    schemaVersion: "ai-painter-mvp256-dry-v26-single-training-attempt-claim-v1",
    capabilityVersion: CAPABILITY, candidateContract: ready.policyBinding,
    executionVersion: "context_isolation_v1",
    predecessorReviewTerminal: ready.policy.predecessorReviewTerminal,
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
      schemaVersion: "ai-painter-mvp256-dry-v26-training-lifecycle-v1",
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
    const qualifierResult = await command({ file: inside(root, PYTHON),
      args: ["-B", inside(root, GPU_QUALIFIER), "--package", baseBinding.path,
        "--sha256", baseBinding.sha256, "--execute"], root,
      timeout: 660_000, signal: abort.signal })
    assert.equal(JSON.parse(qualifierResult.stdout).status,
      "current_candidate_zero_update_gpu_qualification_passed")
    const gpuBinding = bind(root, `${outputRoot}/zero-update-gpu-qualification.json`)
    const gpu = boundJson(root, gpuBinding)
    const managedLock = writeExclusive(root, `${outputRoot}/managed-training-lock.json`, {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v26-managed-lock-v1",
      status: "active_bound_single_attempt", runId, packageId,
      executionPackage: baseBinding, resourceBudget: structuredClone(BUDGET) })
    const launch = writeExclusive(root, `${outputRoot}/supervisor-launch-identity.json`, {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v26-launch-identity-v1",
      status: "managed_supervisor_identity_verified", runId, packageId,
      executionPackage: baseBinding, managedLock,
      processId: processIdentityValue.processId,
      processStartIdentity: processIdentityValue.processStartIdentity })
    const ticket = {
      schemaVersion: "ai-painter-stage4-mvp256-dry-v26-training-ticket-v1",
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
      schemaVersion: "ai-painter-mvp256-dry-v26-training-lifecycle-v1",
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
      schemaVersion: "ai-painter-mvp256-dry-v26-training-lifecycle-v1",
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
      schemaVersion: "ai-painter-mvp256-dry-v26-training-failure-v1",
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
          schemaVersion: "ai-painter-mvp256-dry-v26-registry-finalization-failure-v1",
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
