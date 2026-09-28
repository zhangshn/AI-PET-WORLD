// Records the V18 review failure independently of the immutable training terminal.
// This dry screening does not claim formal Stage0 qualification or adjudication.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"

import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from
  "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4_mvp_native_rgb_structured_object_v18"
const AUDIT_SCHEMA = "ai-painter-stage4-mvp-v18-dry-independent-audit-v1"
const REPORT_SCHEMA = "ai-painter-stage4-mvp-structured-object-v18-dry-review-materialization-v1"
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

export function validateV18ReviewClosure({ registry, audit, materialization, trainingTerminal,
  auditBinding, materializationBinding }) {
  assert.equal(registry.capabilityVersion, CAPABILITY)
  assert.equal(registry.taskKind, "dry_single_world_bounded_training")
  assert.equal(registry.executionState, "completed")
  assert.equal(registry.activity, "training_completed_review_pending")
  assert.equal(registry.activeExecution, null)
  assert.equal(registry.taskId, registry.runId)
  assert.equal(registry.latestTrainingTerminal?.runId, registry.runId)
  assert.deepEqual(registry.terminalEvidence,
    { path: registry.latestTrainingTerminal.path, sha256: registry.latestTrainingTerminal.sha256,
      status: registry.latestTrainingTerminal.status })
  assert.equal(registry.latestTrainingTerminal.status, "training_completed_review_pending")
  assert.equal(trainingTerminal.runId, registry.runId)
  assert.equal(trainingTerminal.status, "training_completed_review_pending")
  assert.equal(trainingTerminal.executionState, "completed")
  assert.equal(materialization.schemaVersion, REPORT_SCHEMA)
  assert.equal(materialization.status, "dry_review_materialized_pending_independent_audit")
  assert.equal(materialization.capabilityVersion, CAPABILITY)
  assert.equal(materialization.runId, registry.runId)
  assert.equal(materialization.candidateCount, 1)
  assert.deepEqual(materialization.trainingTerminal,
    { path: registry.latestTrainingTerminal.path, sha256: registry.latestTrainingTerminal.sha256 })
  assert.equal(audit.schemaVersion, AUDIT_SCHEMA)
  assert.equal(audit.status, "dry_single_world_visual_slice_failed_closed")
  assert.equal(audit.runId, registry.runId)
  assert.deepEqual(audit.materialization, materializationBinding)
  assert.equal(audit.detail?.passed && audit.aesthetic?.passed && audit.alignment?.passed, false)
  assert.ok(Array.isArray(audit.issueCodes) && audit.issueCodes.length > 0)
  assert.equal(new Set(audit.issueCodes).size, audit.issueCodes.length)
  for (const flag of ["formalStage0QualificationGranted", "stage4ProgressIncreaseGranted",
    "runtimePublicationGranted", "visualQualityGranted"])
    assert.equal(audit[flag], false, `${flag} was granted`)
  assert.equal(auditBinding.path,
    `${path.posix.dirname(materializationBinding.path)}/independent-audit.json`)
  return {
    schemaVersion: "ai-painter-stage4-mvp-v18-dry-review-terminal-v1",
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

export async function closeV18Review(projectRoot = ROOT) {
  const current = await readCurrentExecutionRegistry(projectRoot)
  assert.equal(current.ok, true, `current registry unverified: ${current.errorCode}`)
  const registry = current.registry
  if (registry.taskKind === "dry_single_world_independent_review") {
    assert.equal(registry.capabilityVersion, CAPABILITY)
    assert.equal(registry.executionState, "failed_closed")
    assert.equal(registry.activity, "review_failed")
    assert.equal(registry.nextMachineAction, null)
    assert.equal(registry.activeExecution, null)
    assert.equal(current.currentTaskTerminal.status, "review_failed")
    assert.deepEqual(current.currentTaskTerminal.sourceTrainingTerminal, {
      path: registry.latestTrainingTerminal.path,
      sha256: registry.latestTrainingTerminal.sha256,
      status: registry.latestTrainingTerminal.status,
    })
    return { status: "already_registered", registryRevision: registry.registryRevision,
      reviewTerminal: registry.terminalEvidence, latestTrainingTerminal: registry.latestTrainingTerminal }
  }
  const trainingTerminal = bound(projectRoot, registry.latestTrainingTerminal)
  const reviewRoot = `${path.posix.dirname(registry.latestTrainingTerminal.path)}/dry-review`
  const materializationPath = `${reviewRoot}/report.json`
  const auditPath = `${reviewRoot}/independent-audit.json`
  const materializationBinding = {
    path: materializationPath, sha256: sha(readFileSync(inside(projectRoot, materializationPath))),
  }
  const auditBinding = { path: auditPath, sha256: sha(readFileSync(inside(projectRoot, auditPath))) }
  const materialization = bound(projectRoot, materializationBinding)
  const audit = bound(projectRoot, auditBinding)
  bound(projectRoot, materialization.trainingTerminal)
  verifiedBytes(projectRoot, audit.reviewProgram)
  bound(projectRoot, audit.thresholdContract)
  bound(projectRoot, audit.minimumDetailContract)
  verifiedBytes(projectRoot, audit.candidateRgb)
  const terminal = validateV18ReviewClosure({ registry, audit, materialization, trainingTerminal,
    auditBinding, materializationBinding })
  terminal.sourceRegistry = { registryRevision: registry.registryRevision,
    registrySha256: current.registrySha256, taskId: registry.taskId }
  terminal.closureProgram = {
    path: "scripts/close-ai-painter-stage4-mvp-v18-dry-review.mjs",
    sha256: sha(readFileSync(inside(projectRoot,
      "scripts/close-ai-painter-stage4-mvp-v18-dry-review.mjs"))),
  }
  const terminalBinding = writeImmutable(projectRoot, `${reviewRoot}/lifecycle-closure/review-terminal.json`, terminal)
  const capsule = {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    taskId: terminal.taskId,
    integrity: { status: "verified" },
    evidence: [
      { ...terminalBinding, kind: "independent_review_terminal", sha256Verified: true },
      { ...auditBinding, kind: "independent_review_audit", sha256Verified: true },
      { path: registry.latestTrainingTerminal.path, sha256: registry.latestTrainingTerminal.sha256,
        kind: "source_training_terminal", sha256Verified: true },
    ],
  }
  const capsuleBinding = writeImmutable(projectRoot,
    `${reviewRoot}/lifecycle-closure/review-capsule.json`, capsule)
  const advanced = await advanceCurrentExecutionRegistry({
    projectRoot,
    capabilityVersion: CAPABILITY,
    packageId: registry.packageId,
    taskId: terminal.taskId,
    taskKind: terminal.taskKind,
    taskGoal: "Record the failed V18 dry single-world independent review without formal Stage0 credit.",
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
  assert.equal(process.argv.length, 2, "usage: node scripts/close-ai-painter-stage4-mvp-v18-dry-review.mjs")
  process.stdout.write(`${JSON.stringify(await closeV18Review())}\n`)
}
