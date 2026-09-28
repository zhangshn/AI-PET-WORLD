import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SOURCE_CAPABILITY = "stage4_mvp_native_complete_rgb_object_crop_renderer_v8"
const TARGET_CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
const REENTRY_ACTION = "reconcile:ai-painter-stage4-mvp-diagnostic-to-v2-formal-reentry"
const CPU_TASK = "verify_stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2_cpu_contract"
const CPU_ACTION = "run:ai-painter-stage4-v2-cpu-contract-acceptance"
const V2_ADJUDICATION = ".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-failure-boundary-adjudications/joint-condition-full-data-screen-boundary-adjudication-20260830181103936-cfa6afd5/phase-terminal.json"
const V2_CONTRACT = "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json"
const OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp-formal-reentry-reconciliations"

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")

if (current.registry.taskId === CPU_TASK
  && current.registry.capabilityVersion === TARGET_CAPABILITY
  && current.registry.nextMachineAction === CPU_ACTION) {
  process.stdout.write(`${JSON.stringify({
    status: "stage4_v2_formal_cpu_reentry_already_materialized",
    registryRevision: current.registry.registryRevision,
    nextMachineAction: current.registry.nextMachineAction,
    trainingStarted: false,
    gpuStarted: false,
  }, null, 2)}\n`)
  process.exit(0)
}

assert.equal(current.registry.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(current.registry.taskKind, "stage0_machine_review_closure")
assert.equal(current.registry.lifecycleStage, "rejected")
assert.equal(current.registry.executionState, "failed_closed")
assert.equal(current.registry.activity, "stage4_mvp_stage0_machine_review_failed")
assert.equal(current.registry.nextMachineAction, null)
assert.equal(current.registry.activeExecution, null)

const sourceTerminal = readBinding(current.registry.terminalEvidence, "source review closure")
assert.equal(sourceTerminal.value.schemaVersion, "ai-painter-stage4-mvp-stage0-machine-review-terminal-v1")
assert.equal(sourceTerminal.value.executionState, "failed_closed")
assert.equal(sourceTerminal.value.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(sourceTerminal.value.stagePassed, false)
const review = readBinding(sourceTerminal.value.machineReview, "source machine review")
assert.equal(review.value.schemaVersion, "ai-painter-stage4-mvp-stage0-machine-review-v1")
assert.equal(review.value.status, "stage4_mvp_stage0_machine_review_failed")
assert.equal(review.value.candidatePassCount < review.value.candidateCount, true)
const threshold = readBinding(review.value.thresholdContract, "diagnostic threshold contract")
assert.equal(threshold.value.status, "cpu_supported_inactive")
assert.equal(threshold.value.activation?.formalReviewExecutionAllowed, false)
assert.equal(threshold.value.formalReviewBoundary?.dispatchable, false)

const adjudication = readBinding(bind(V2_ADJUDICATION), "V2 source adjudication")
assert.equal(adjudication.value.schemaVersion,
  "stage4-joint-condition-full-data-screen-failure-boundary-adjudication-terminal-v1")
assert.equal(adjudication.value.executionState, "completed")
assert.equal(adjudication.value.successorCapabilityVersion, TARGET_CAPABILITY)
const classification = readBinding(adjudication.value.capabilityChangeClassification,
  "V2 capability classification")
assert.equal(classification.value.successorCapabilityVersion, TARGET_CAPABILITY)
assert.deepEqual(classification.value.successorContract, bind(V2_CONTRACT))
const successorContract = readBinding(classification.value.successorContract, "V2 successor contract")
assert.equal(successorContract.value.architectureId, TARGET_CAPABILITY)

const reentryId = `mvp-formal-reentry-${sha256Text(
  `${sourceTerminal.binding.sha256}:${adjudication.binding.sha256}:${successorContract.binding.sha256}`,
).slice(0, 24)}`
const outputRoot = inside(`${OUTPUT_PARENT}/${reentryId}`)
fs.mkdirSync(outputRoot, { recursive: true })
const recordedAtUtc = new Date().toISOString()
const reconciliation = {
  schemaVersion: "ai-painter-stage4-mvp-diagnostic-formal-reentry-reconciliation-v1",
  executionState: "completed",
  status: "mvp_diagnostic_branch_isolated_v2_formal_cpu_reentry_materialized",
  reconciliationId: reentryId,
  rejectedDiagnosticCapability: SOURCE_CAPABILITY,
  targetFormalCapability: TARGET_CAPABILITY,
  sourceReviewClosure: sourceTerminal.binding,
  sourceMachineReview: review.binding,
  inactiveDiagnosticThreshold: threshold.binding,
  formalSourceAdjudication: adjudication.binding,
  formalCapabilityClassification: classification.binding,
  formalSuccessorContract: successorContract.binding,
  decisions: {
    v8WeightsEligibleForFormalReuse: false,
    diagnosticReviewMayAdvanceStage4: false,
    v9Materialized: false,
    formalCpuRequalificationRequired: true,
  },
  gpuStarted: false,
  trainingStarted: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
}
const reconciliationPath = path.join(outputRoot, "terminal.json")
writeOrVerify(reconciliationPath, reconciliation)
const reconciliationBinding = bind(projectPath(reconciliationPath))
const evidence = [
  sourceTerminal.binding,
  review.binding,
  threshold.binding,
  adjudication.binding,
  classification.binding,
  successorContract.binding,
  reconciliationBinding,
].map((item) => ({ ...item, sha256Verified: true }))
const capsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${reentryId}`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-stage4", nameZh: "AI Painter Stage4" },
  fixedOverallProgress: {
    completedStages: 3,
    totalStages: 5,
    percent: 60,
    source: "current_execution_registry",
  },
  currentStage: {
    number: 4,
    total: 5,
    labelZh: "Stage 0→1→2完整训练",
    status: "formal_cpu_requalification_ready",
  },
  taskIdentity: { modelId: TARGET_CAPABILITY, runId: reentryId },
  latestTerminal: reconciliationBinding,
  latestBlocker: null,
  nextAllowedAction: CPU_ACTION,
  forbiddenActions: [
    "reuse_v8_weights_for_formal_training",
    "treat_256_diagnostic_as_stage4_progress",
    "materialize_v9_without_new_adjudication",
    "lower_machine_review_threshold",
  ],
  evidence,
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
  },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
}
const capsulePath = path.join(outputRoot, "task-capsule.json")
writeOrVerify(capsulePath, capsule)
const capsuleBinding = bind(projectPath(capsulePath))

const adjudicationTask = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: SOURCE_CAPABILITY,
  packageId: reentryId,
  taskId: `${current.registry.runId}-failure-boundary-adjudication`,
  taskKind: "failure_boundary_adjudication",
  taskGoal: "Isolate the failed 256x192 diagnostic branch and determine whether a registered formal capability can be re-entered without reusing rejected weights.",
  priority: 1,
  queueStatus: "ready",
  nextMachineAction: REENTRY_ACTION,
  queuedAtUtc: recordedAtUtc,
  runId: current.registry.runId,
  lifecycleStage: "unknown_or_stale",
  executionState: "package_materialized",
  activity: "mvp_stage0_failure_boundary_adjudication_materialized",
  taskCapsulePath: capsuleBinding.path,
  terminalEvidencePath: reconciliationBinding.path,
  activeExecution: null,
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
})

const formalTask = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: TARGET_CAPABILITY,
  packageId: reentryId,
  taskId: CPU_TASK,
  taskKind: "cpu_contract_verification",
  taskGoal: "Recompute the registered Stage4 V2 CPU contract before any GPU qualification, Smoke, or formal Stage0 execution.",
  priority: 1,
  queueStatus: "ready",
  nextMachineAction: CPU_ACTION,
  queuedAtUtc: recordedAtUtc,
  runId: reentryId,
  lifecycleStage: "change_candidate",
  executionState: "package_materialized",
  activity: "cpu_contract_verification_ready",
  taskCapsulePath: capsuleBinding.path,
  terminalEvidencePath: adjudication.binding.path,
  activeExecution: null,
  expectedPreviousRegistryRevision: adjudicationTask.registry.registryRevision,
  expectedPreviousRegistrySha256: adjudicationTask.registrySha256,
})

process.stdout.write(`${JSON.stringify({
  status: reconciliation.status,
  reconciliation: reconciliationBinding,
  failureBoundaryRegistryRevision: adjudicationTask.registry.registryRevision,
  formalReentryRegistryRevision: formalTask.registry.registryRevision,
  nextMachineAction: formalTask.registry.nextMachineAction,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`)

function readBinding(binding, role) {
  assert.match(binding?.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA-256 invalid`)
  const absolute = inside(binding.path)
  assert.equal(fs.statSync(absolute).isFile(), true, `${role} is not a file`)
  assert.equal(sha256File(absolute), binding.sha256, `${role} SHA-256 mismatch`)
  return {
    value: JSON.parse(fs.readFileSync(absolute, "utf8")),
    binding: { path: projectPath(absolute), sha256: binding.sha256 },
  }
}

function inside(value) {
  assert.equal(path.isAbsolute(value), false, "project-relative path required")
  const resolved = path.resolve(ROOT, value)
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), "path escapes project")
  return resolved
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/")
}

function bind(value) {
  const absolute = inside(value)
  return { path: projectPath(absolute), sha256: sha256File(absolute) }
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function writeOrVerify(target, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`
  if (fs.existsSync(target)) {
    assert.equal(fs.readFileSync(target, "utf8"), bytes, `immutable evidence differs: ${target}`)
    return
  }
  fs.writeFileSync(target, bytes, { encoding: "utf8", flag: "wx" })
}
