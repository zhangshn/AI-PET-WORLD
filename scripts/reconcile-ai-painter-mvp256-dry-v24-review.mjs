// Close the already-reviewed V24 task in the current registry without rerunning audit.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from
  "../src/server/ai-painter-current-execution-registry.mjs"
import { preflight as auditPreflight } from
  "./run-ai-painter-mvp256-dry-v24-independent-audit.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const RUN = "mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2"
const REVIEW = `.runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/${RUN}/dry-review`
const AUDIT_SHA = "c3c4db62221412523349ea57d8e925e13d49039903e6adffd2d4e10ce2556ae8"
const TRAINING_TERMINAL_SHA = "2f2b7a3ff091f54e511e7bad9ab2a53fabbe2fc626f5bd91e49db7c1ade33a26"
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")

function projectFile(root, logical) {
  assert.ok(typeof logical === "string" && logical.startsWith(`${REVIEW}/`)
    && !logical.includes("\\") && logical.split("/").every(part =>
      part && part !== "." && part !== ".." && part !== "latest"),
  "review path escaped frozen V24 run")
  return path.join(root, ...logical.split("/"))
}

function binding(root, logical) {
  return { path: logical, sha256: sha(fs.readFileSync(projectFile(root, logical))) }
}

function writeOrVerify(root, logical, value) {
  const target = projectFile(root, logical)
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  if (fs.existsSync(target)) {
    assert.ok(fs.readFileSync(target).equals(bytes), `review receipt differs: ${logical}`)
  } else {
    const fd = fs.openSync(target, "wx")
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) }
    finally { fs.closeSync(fd) }
  }
  return { path: logical, sha256: sha(bytes) }
}

export async function reconcile({ root = ROOT, execute = false,
  registryApi = { read: readCurrentExecutionRegistry,
    advance: advanceCurrentExecutionRegistry } } = {}) {
  root = fs.realpathSync(root)
  const current = await registryApi.read(root)
  assert.equal(current.ok, true, current.errorCode ?? "registry invalid")
  assert.equal(current.registry.activeExecution, null, "active task cannot be displaced")
  assert.equal(current.registry.runId, RUN)
  assert.equal(current.registry.latestTrainingTerminal?.sha256,
    TRAINING_TERMINAL_SHA, "V24 training terminal changed")
  const auditBinding = binding(root, `${REVIEW}/independent-audit.json`)
  assert.equal(auditBinding.sha256, AUDIT_SHA,
    "frozen V24 independent audit changed")
  const audit = JSON.parse(fs.readFileSync(projectFile(root, auditBinding.path), "utf8"))
  assert.equal(audit.runId, RUN)
  assert.equal(audit.status, "dry_single_world_review_failed_closed")
  assert.deepEqual(audit.issueCodes, [
    "condition_object_rock_reference_semantic_mismatch",
    "condition_object_vegetation_reference_semantic_mismatch"])
  assert.equal(audit.visualApprovalGranted, false)
  assert.equal(audit.formalStage4QualificationGranted, false)
  assert.equal(audit.runtimePublicationGranted, false)
  assert.equal(audit.selectedEpoch, 36)
  assert.equal(audit.input.path, `${REVIEW}/candidate-manifest.json`)
  assert.deepEqual(binding(root, audit.input.path), audit.input)

  if (current.registry.activity === "dry_single_world_review_failed_closed") {
    assert.equal(current.registry.nextMachineAction, null)
    assert.equal(current.registry.terminalEvidence?.status, audit.status)
    return { status: "already_reconciled", revision: current.registry.registryRevision,
      stage4Advanced: false }
  }
  assert.equal(current.registry.activity, "training_completed_review_pending")
  assert.equal(current.registry.terminalEvidence?.sha256,
    TRAINING_TERMINAL_SHA, "current V24 terminal changed")
  assert.equal(current.registry.nextMachineAction,
    "materialize_mvp256_dry_v24_selected_candidate")
  assert.equal(current.registry.latestTrainingTerminal?.runId, RUN)
  assert.equal(current.registry.latestTrainingTerminal?.status,
    "training_completed_review_pending")
  // The original audit's full source, checkpoint, condition and world-fact
  // bindings are rechecked before any registry write.
  await auditPreflight(root, audit.input)
  if (!execute) return { status: "review_reconciliation_preflight_passed",
    revision: current.registry.registryRevision, audit: auditBinding,
    registryWritten: false, stage4Advanced: false }

  const terminal = writeOrVerify(root, `${REVIEW}/review-terminal.json`, {
    schemaVersion: "ai-painter-mvp256-dry-v24-review-terminal-v1",
    status: audit.status, executionState: "failed_closed", runId: RUN,
    audit: auditBinding,
    selectedCheckpoint: audit.selectedCheckpoint,
    visualApprovalGranted: false, formalStage4QualificationGranted: false,
    runtimePublicationGranted: false,
    trainingStartedByReconciliation: false,
  })
  const capsule = writeOrVerify(root, `${REVIEW}/review-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    taskId: `${RUN}-review-reconciliation`,
    integrity: { status: "verified" },
    evidence: [{ ...auditBinding, kind: "dry_single_world_review_audit",
      sha256Verified: true }],
  })
  const outcome = await registryApi.advance({ projectRoot: root,
    capabilityVersion: current.registry.capabilityVersion,
    packageId: current.registry.packageId,
    taskId: `${RUN}-review-reconciliation`,
    taskKind: "mvp256_dry_v24_review_reconciliation",
    taskGoal: "Close the already-audited V24 dry-world visual failure without training.",
    priority: current.registry.priority,
    queueStatus: "failed_closed", nextMachineAction: null,
    queuedAtUtc: current.registry.queuedAtUtc,
    runId: RUN, lifecycleStage: current.registry.lifecycleStage,
    executionState: "failed_closed", activity: audit.status,
    taskCapsulePath: capsule.path, terminalEvidencePath: terminal.path,
    activeExecution: null,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256 })
  assert.equal(outcome.ok, true)
  return { status: audit.status, previousRevision: current.registry.registryRevision,
    reviewTerminal: terminal, audit: auditBinding, stage4Advanced: false }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.deepEqual(process.argv.slice(2), process.argv.includes("--execute")
    ? ["--execute"] : ["--check"])
  process.stdout.write(`${JSON.stringify(await reconcile({ execute:
    process.argv.includes("--execute") }))}\n`)
}
