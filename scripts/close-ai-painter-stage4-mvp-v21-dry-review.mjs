// Records the V21 review failure independently of the immutable training terminal.
// This dry screening does not claim formal Stage0 qualification or adjudication.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"

import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from
  "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4_mvp_native_rgb_object_residual_v21_support_trial"
const AUDIT_SCHEMA = "ai-painter-stage4-mvp-v21-dry-independent-audit-v1"
const REPORT_SCHEMA = "ai-painter-stage4-mvp-object-residual-v21-dry-review-materialization-v1"
const RUN_ID = "mvp-v21-dry-stage0-123c625425ce959dbc0a8d5065bf158ecf97c164b07aaa4e"
const RUN_ROOT = ".runtime/ai-painter/stage4-mvp-object-residual-v21-dry-executions/" +
  "mvp-v21-dry-batch-123c625425ce959dbc0a8d5065bf158ecf97c164/stages/" + RUN_ID
const REVIEW_ROOT = `${RUN_ROOT}/dry-review`
const EXPECTED_REGISTRY = { revision: 322,
  sha256: "641ed00804bdd4796210fe32c6985cd66dc422e8e92373a0668e94e079e0e27e" }
const TRAINING = { path: `${RUN_ROOT}/training-finalize.json`,
  sha256: "e4d981d2a3c197e878670dbefcc6076ae3bd0f161fbf960ad1cdebf126770e18" }
const WORKER = { path: `${RUN_ROOT}/phase-terminal.json`,
  sha256: "9f6cfecc136a863beb6449dd0179e3924fe9408114f6fc0ca2da809ae567c8fb" }
const CHECKPOINT = { path: `${RUN_ROOT}/epochs/epoch-12.pt`,
  sha256: "3ea4bdb543f02310b83bbc292b8324e52c99d77d11144ea911ce41df0c596115" }
const MATERIALIZATION = { path: `${REVIEW_ROOT}/report.json`,
  sha256: "7e5cb08af4be30f47c9a7f46065ecffd7a27af2f54e517cc4f04fed4bd3a164f" }
const AUDIT = { path: `${REVIEW_ROOT}/independent-audit.json`,
  sha256: "eef04665b1f92dfae7bcb57f900c8539cfac33ff650d508341414b1297fa29b9" }
const SUBJECT = "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2"
const ISSUE_CODES = [
  "condition_object_footprints_reference_semantic_mismatch",
  "condition_object_tree_reference_semantic_mismatch",
  "condition_object_rock_reference_semantic_mismatch",
  "condition_object_vegetation_reference_semantic_mismatch",
]
const sha = bytes => createHash("sha256").update(bytes).digest("hex")

function inside(projectRoot, logical) {
  assert.equal(typeof logical, "string", "binding path missing")
  assert.ok(logical && !path.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical)
    && !logical.includes("\\") && logical.split("/").every(part =>
      part && part !== "." && part !== ".." && part !== "latest" && part !== "latest.json"),
  "unsafe evidence path")
  const absolute = path.resolve(projectRoot, logical)
  assert.ok(absolute.startsWith(`${path.resolve(projectRoot)}${path.sep}`), "evidence path escaped project")
  return absolute
}

function verifiedBytes(projectRoot, binding) {
  assert.ok(binding && typeof binding.path === "string"
    && /^[a-f0-9]{64}$/u.test(binding.sha256), "invalid evidence binding")
  const bytes = readFileSync(inside(projectRoot, binding.path))
  assert.equal(sha(bytes), binding.sha256, `evidence hash mismatch: ${binding.path}`)
  return bytes
}

function bound(projectRoot, binding) {
  return JSON.parse(verifiedBytes(projectRoot, binding).toString("utf8"))
}

export function validateV21ReviewClosure({ registry, audit, materialization, trainingTerminal,
  workerTerminal, registrySha256, auditBinding, materializationBinding }) {
  assert.equal(registry.registryRevision, EXPECTED_REGISTRY.revision)
  assert.equal(registrySha256, EXPECTED_REGISTRY.sha256)
  assert.equal(registry.capabilityVersion, CAPABILITY)
  assert.equal(registry.taskKind, "dry_single_world_bounded_training")
  assert.equal(registry.executionState, "completed")
  assert.equal(registry.activity, "training_completed_review_pending")
  assert.equal(registry.activeExecution, null)
  assert.equal(registry.queueStatus, "completed")
  assert.equal(registry.nextMachineAction, "v21_dry_materialization_adapter_required")
  assert.equal(registry.taskId, registry.runId)
  assert.equal(registry.runId, RUN_ID)
  assert.equal(registry.packageId, "mvp-v21-dry-package-123c625425ce959dbc0a8d5065bf158ecf97c164")
  assert.equal(registry.packageSha256, TRAINING.sha256)
  assert.deepEqual({ path: registry.latestTrainingTerminal?.path,
    sha256: registry.latestTrainingTerminal?.sha256 }, TRAINING)
  assert.equal(registry.latestTrainingTerminal?.runId, registry.runId)
  assert.deepEqual(registry.terminalEvidence,
    { path: registry.latestTrainingTerminal.path, sha256: registry.latestTrainingTerminal.sha256,
      status: registry.latestTrainingTerminal.status })
  assert.equal(registry.latestTrainingTerminal.status, "training_completed_review_pending")
  assert.equal(trainingTerminal.runId, registry.runId)
  assert.equal(trainingTerminal.schemaVersion, "ai-painter-stage4-mvp-v21-dry-training-lifecycle-v1")
  assert.equal(trainingTerminal.status, "training_completed_review_pending")
  assert.equal(trainingTerminal.executionState, "completed")
  assert.equal(trainingTerminal.formalStage0QualificationGranted, false)
  assert.equal(trainingTerminal.runtimePublicationGranted, false)
  assert.deepEqual(trainingTerminal.workerTerminal, WORKER)
  assert.deepEqual(trainingTerminal.checkpoint, CHECKPOINT)
  assert.equal(workerTerminal.schemaVersion,
    "ai-painter-stage4-mvp-object-residual-v21-dry-stage0-training-terminal-v1")
  assert.equal(workerTerminal.runId, RUN_ID)
  assert.equal(workerTerminal.status, "training_completed_review_pending")
  assert.equal(workerTerminal.executionState, "completed")
  assert.deepEqual(workerTerminal.checkpoint, CHECKPOINT)
  assert.equal(workerTerminal.selectedEpoch, 12)
  assert.equal(workerTerminal.completedEpochs, 24)
  assert.equal(workerTerminal.optimizerStepsGenerator, 1152)
  assert.equal(workerTerminal.optimizerStepsDiscriminator, 1152)
  assert.equal(workerTerminal.checkpointReloadVerified, true)
  assert.equal(workerTerminal.stagePassed, false)
  assert.equal(workerTerminal.stage4QualificationGranted, false)
  assert.equal(materialization.schemaVersion, REPORT_SCHEMA)
  assert.equal(materialization.status, "dry_review_materialized_pending_independent_audit")
  assert.equal(materialization.capabilityVersion, CAPABILITY)
  assert.equal(materialization.runId, registry.runId)
  assert.deepEqual(materialization.workerTerminal, WORKER)
  assert.deepEqual(materialization.checkpoint, CHECKPOINT)
  assert.equal(materialization.selectedEpoch, 12)
  assert.equal(materialization.device, "cuda")
  assert.equal(materialization.precision, "bfloat16")
  assert.equal(materialization.weightsUnmodifiedVerified, true)
  for (const flag of ["formalStage0QualificationGranted", "stage4ProgressIncreaseGranted",
    "runtimePublicationGranted", "visualQualityGranted"])
    assert.equal(materialization[flag], false, `materialization ${flag} was granted`)
  assert.equal(materialization.candidateCount, 1)
  assert.equal(materialization.candidate?.sampleId, SUBJECT)
  assert.equal(materialization.candidate?.split, "validation")
  assert.equal(materialization.candidate?.sampleIndex, 0)
  assert.deepEqual(materialization.candidate?.referenceRgb, materialization.sampleIdentity?.image)
  assert.deepEqual(materialization.candidate?.candidateRgb && {
    path: materialization.candidate.candidateRgb.path,
    sha256: materialization.candidate.candidateRgb.sha256,
  }, materialization.artifacts?.["generated.png"])
  assert.equal(materialization.modelStateSha256, workerTerminal.modelStateSha256)
  assert.equal(materialization.modelStateSha256Before, workerTerminal.modelStateSha256)
  assert.equal(materialization.modelStateSha256After, workerTerminal.modelStateSha256)
  assert.deepEqual(materialization.trainingTerminal,
    { path: registry.latestTrainingTerminal.path, sha256: registry.latestTrainingTerminal.sha256 })
  assert.equal(audit.schemaVersion, AUDIT_SCHEMA)
  assert.equal(audit.status, "dry_single_world_visual_slice_failed_closed")
  assert.equal(audit.runId, registry.runId)
  assert.equal(audit.sampleId, SUBJECT)
  assert.deepEqual(audit.candidateRgb, materialization.candidate.candidateRgb)
  assert.equal(audit.selectedEpoch, workerTerminal.selectedEpoch)
  assert.deepEqual(audit.selectedRank, workerTerminal.selectedRank)
  assert.deepEqual(audit.objectResidualEvidence, materialization.objectResidualEvidence)
  assert.deepEqual(audit.materialization, materializationBinding)
  assert.equal(audit.detail?.passed, true)
  assert.equal(audit.aesthetic?.passed, true)
  assert.equal(audit.alignment?.passed, false)
  assert.deepEqual(audit.issueCodes, ISSUE_CODES)
  for (const flag of ["formalStage0QualificationGranted", "stage4ProgressIncreaseGranted",
    "runtimePublicationGranted", "visualQualityGranted"])
    assert.equal(audit[flag], false, `${flag} was granted`)
  assert.deepEqual(materializationBinding, MATERIALIZATION)
  assert.deepEqual(auditBinding, AUDIT)
  return {
    schemaVersion: "ai-painter-stage4-mvp-v21-dry-review-terminal-v1",
    capabilityVersion: CAPABILITY,
    taskId: `${registry.taskId}-independent-review`,
    runId: registry.runId,
    taskKind: "dry_single_world_independent_review",
    executionState: "failed_closed",
    machineReviewStatus: "review_failed",
    status: "review_failed",
    sourceTrainingTerminal: {
      path: registry.latestTrainingTerminal.path,
      sha256: registry.latestTrainingTerminal.sha256,
      status: registry.latestTrainingTerminal.status,
    },
    materialization: materializationBinding,
    independentAudit: auditBinding,
    issueCodes: audit.issueCodes,
    formalStage0QualificationGranted: false,
    stage4ProgressIncreaseGranted: false,
    runtimePublicationGranted: false,
    visualQualityGranted: false,
    automaticRetryStarted: false,
    optimizerSteps: 0,
    nextMachineAction: null,
  }
}

function writeImmutable(projectRoot, logical, value) {
  const target = inside(projectRoot, logical)
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  mkdirSync(path.dirname(target), { recursive: true })
  if (existsSync(target)) {
    assert.equal(sha(readFileSync(target)), sha(bytes), `immutable output conflict: ${logical}`)
  } else {
    writeFileSync(target, bytes, { flag: "wx" })
  }
  return { path: logical, sha256: sha(bytes) }
}

export async function preflightV21ReviewClosure(projectRoot = ROOT) {
  const current = await readCurrentExecutionRegistry(projectRoot)
  assert.equal(current.ok, true, `current registry unverified: ${current.errorCode}`)
  const registry = current.registry
  assert.equal(current.registrySha256, EXPECTED_REGISTRY.sha256)
  assert.equal(registry.registryRevision, EXPECTED_REGISTRY.revision)
  const trainingTerminal = bound(projectRoot, TRAINING)
  const workerTerminal = bound(projectRoot, WORKER)
  const materialization = bound(projectRoot, MATERIALIZATION)
  const audit = bound(projectRoot, AUDIT)
  // Hash-only artifact checks; no image or checkpoint deserialization/decoding.
  verifiedBytes(projectRoot, CHECKPOINT)
  verifiedBytes(projectRoot, audit.reviewProgram)
  bound(projectRoot, audit.thresholdContract)
  bound(projectRoot, audit.minimumDetailContract)
  verifiedBytes(projectRoot, audit.candidateRgb)
  verifiedBytes(projectRoot, materialization.candidate.referenceRgb)
  const terminal = validateV21ReviewClosure({ registry, audit, materialization, trainingTerminal,
    workerTerminal, registrySha256: current.registrySha256,
    auditBinding: AUDIT, materializationBinding: MATERIALIZATION })
  terminal.sourceRegistry = { registryRevision: registry.registryRevision,
    registrySha256: current.registrySha256, taskId: registry.taskId }
  terminal.closureProgram = {
    path: "scripts/close-ai-painter-stage4-mvp-v21-dry-review.mjs",
    sha256: sha(readFileSync(inside(projectRoot,
      "scripts/close-ai-painter-stage4-mvp-v21-dry-review.mjs"))),
  }
  return { status: "cpu_preflight_passed_no_write", registry, registrySha256: current.registrySha256,
    terminal, trainingTerminal: TRAINING, workerTerminal: WORKER, checkpoint: CHECKPOINT,
    materialization: MATERIALIZATION, independentAudit: AUDIT,
    samplePixelsDecoded: false, checkpointDeserialized: false, gpuInitialized: false,
    trainingStarted: false, registryWritten: false }
}

export async function closeV21Review(projectRoot = ROOT) {
  const preflight = await preflightV21ReviewClosure(projectRoot)
  const current = await readCurrentExecutionRegistry(projectRoot)
  assert.equal(current.ok, true, `current registry unverified: ${current.errorCode}`)
  assert.equal(current.registrySha256, preflight.registrySha256,
    "registry changed after V21 closure preflight")
  const registry = preflight.registry
  const terminal = preflight.terminal
  const terminalBinding = writeImmutable(projectRoot,
    `${REVIEW_ROOT}/lifecycle-closure/review-terminal.json`, terminal)
  const capsule = {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    taskId: terminal.taskId,
    integrity: { status: "verified" },
    evidence: [
      { ...terminalBinding, kind: "independent_review_terminal", sha256Verified: true },
      { ...AUDIT, kind: "independent_review_audit", sha256Verified: true },
      { path: registry.latestTrainingTerminal.path, sha256: registry.latestTrainingTerminal.sha256,
        kind: "source_training_terminal", sha256Verified: true },
    ],
  }
  const capsuleBinding = writeImmutable(projectRoot,
    `${REVIEW_ROOT}/lifecycle-closure/review-capsule.json`, capsule)
  const advanced = await advanceCurrentExecutionRegistry({
    projectRoot,
    capabilityVersion: CAPABILITY,
    packageId: registry.packageId,
    taskId: terminal.taskId,
    taskKind: terminal.taskKind,
    taskGoal: "Record the failed V21 dry single-world independent review without formal Stage0 credit.",
    priority: registry.priority,
    queueStatus: "failed_closed",
    nextMachineAction: null,
    runId: terminal.runId,
    lifecycleStage: registry.lifecycleStage,
    executionState: "failed_closed",
    activity: "review_failed",
    taskCapsulePath: capsuleBinding.path,
    terminalEvidencePath: terminalBinding.path,
    activeExecution: null,
    expectedPreviousRegistryRevision: registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  return {
    status: "review_failed_registered",
    reviewTerminal: terminalBinding,
    reviewCapsule: capsuleBinding,
    latestTrainingTerminal: registry.latestTrainingTerminal,
    sourceRegistryRevision: registry.registryRevision,
    sourceRegistrySha256: current.registrySha256,
    registryAdvance: advanced,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  assert.ok(process.argv.length === 3 && ["--preflight", "--execute"].includes(process.argv[2]),
    "usage: node scripts/close-ai-painter-stage4-mvp-v21-dry-review.mjs --preflight|--execute")
  if (process.argv[2] === "--execute") {
    process.stdout.write(`${JSON.stringify(await closeV21Review())}\n`)
  } else {
    const result = await preflightV21ReviewClosure()
    process.stdout.write(`${JSON.stringify({ status: result.status,
      runId: result.registry.runId, sourceRegistryRevision: result.registry.registryRevision,
      sourceRegistrySha256: result.registrySha256, trainingTerminal: result.trainingTerminal,
      workerTerminal: result.workerTerminal, checkpoint: result.checkpoint,
      materialization: result.materialization, independentAudit: result.independentAudit,
      issueCodes: result.terminal.issueCodes,
      samplePixelsDecoded: result.samplePixelsDecoded,
      checkpointDeserialized: result.checkpointDeserialized,
      gpuInitialized: result.gpuInitialized, trainingStarted: result.trainingStarted,
      registryWritten: result.registryWritten })}\n`)
  }
}
