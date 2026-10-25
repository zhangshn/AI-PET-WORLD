import { createHash, randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { closeSync, fsyncSync, openSync } from "node:fs"
import {
  appendFile,
  link,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export const CURRENT_EXECUTION_REGISTRY_ROOT =
  ".runtime/ai-painter/current-execution-registry"
export const CURRENT_EXECUTION_REGISTRY_PATH =
  `${CURRENT_EXECUTION_REGISTRY_ROOT}/current.json`

const REGISTRY_SCHEMA = "ai-painter-current-execution-registry-v1"
const CAPSULE_SCHEMA = "ai-painter-local-task-capsule-v1"
const REGISTRY_TRANSACTION_SCHEMA = "ai-painter-current-execution-registry-transaction-v1"
const REGISTRY_DEPENDENCY_SCHEMA = "ai-painter-current-execution-registry-dependency-manifest-v1"
const REGISTRY_WRITER_CLAIM_PATH = `${CURRENT_EXECUTION_REGISTRY_ROOT}/writer.claim.json`
const ACTIVE_EXECUTION_SCHEMA = "ai-painter-current-active-execution-v1"
const ACTIVE_EXECUTION_LOCK_SCHEMA = "ai-painter-current-active-execution-lock-v1"
const ACTIVE_EXECUTION_HEARTBEAT_SCHEMA = "ai-painter-current-active-execution-heartbeat-v1"
const ACTIVE_EXECUTION_HEARTBEAT_MIN_TTL_SECONDS = 1
const ACTIVE_EXECUTION_HEARTBEAT_MAX_TTL_SECONDS = 3600
const ACTIVE_EXECUTION_HEARTBEAT_MAX_FUTURE_SKEW_MS = 300_000
const ACTIVE_EXECUTION_STATES = new Set([
  "preflight",
  "executing",
  "validating",
  "reviewing",
  "adjudicating",
  "finalizing",
])
const TERMINAL_EXECUTION_STATES = new Set([
  "completed",
  "failed_closed",
  "blocked_policy_boundary",
])
const VERIFIED_KERNEL_INTERRUPTION_CONTEXTS = new WeakSet()
const VERIFIED_HISTORICAL_SOURCE_CONTEXTS = new WeakSet()

export function requireRegistryDeadline(deadlineUnixMs = null) {
  if (deadlineUnixMs === null) return 10_000
  requireValue(Number.isSafeInteger(deadlineUnixMs), "registry_deadline_invalid")
  const remaining = deadlineUnixMs - Date.now()
  requireValue(remaining > 0, "registry_deadline_exhausted")
  return Math.min(10_000, remaining)
}

export async function readCurrentExecutionRegistry(projectRoot = process.cwd(), { deadlineUnixMs = null } = {}) {
  return readCurrentExecutionRegistryInternal(projectRoot, { deadlineUnixMs })
}

async function readCurrentExecutionRegistryInternal(
  projectRoot,
  { expiredActiveRecovery = null, deadlineUnixMs = null } = {},
) {
  try {
    requireRegistryDeadline(deadlineUnixMs)
    const current = await readBoundJson(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH)
    requireValue(current.value?.schemaVersion === REGISTRY_SCHEMA, "registry_schema_invalid")
    requireValue(Number.isInteger(current.value.registryRevision) && current.value.registryRevision > 0, "registry_revision_invalid")
    requireValue(Number.isInteger(current.value.eventSequence) && current.value.eventSequence > 0, "registry_event_sequence_invalid")
    requireValue(current.value.writerIdentity === "local_ai_capability_lifecycle_orchestrator", "registry_writer_invalid")
    requireValue(typeof current.value.transactionId === "string" && current.value.transactionId.length > 0, "registry_transaction_id_invalid")
    verifyTaskControlMetadataIfPresent(current.value)

    const transactionPath = `${CURRENT_EXECUTION_REGISTRY_ROOT}/transactions/${current.value.transactionId}/transaction.json`
    const transaction = await readBoundJson(projectRoot, transactionPath)
    requireValue(transaction.value?.schemaVersion === "ai-painter-current-execution-registry-transaction-v1", "registry_transaction_schema_invalid")
    requireValue(transaction.value?.status === "committed", "registry_transaction_not_committed")
    requireValue(transaction.value?.transactionId === current.value.transactionId, "registry_transaction_identity_mismatch")
    requireValue(transaction.value?.registryRevision === current.value.registryRevision, "registry_transaction_revision_mismatch")
    requireValue(transaction.value?.eventSequence === current.value.eventSequence, "registry_transaction_sequence_mismatch")
    requireValue(transaction.value?.currentSha256 === current.sha256, "registry_current_hash_mismatch")

    verifySqliteCommit(projectRoot, current.value, current.sha256)
    await verifyPublishedRegistryEvent(projectRoot, current.value, current.sha256)

    const archivedNamespaces = normalizeArchivedNamespaces(current.value.archivedEvidenceNamespaces)
    await verifyStoredActiveExecution(
      projectRoot,
      current.value,
      archivedNamespaces,
      expiredActiveRecovery,
      deadlineUnixMs,
    )
    const taskCapsule = await readRegistryBinding(
      projectRoot,
      current.value.taskCapsule,
      archivedNamespaces,
      "current_task_capsule",
    )
    requireValue(taskCapsule.value?.schemaVersion === CAPSULE_SCHEMA, "current_task_capsule_schema_invalid")
    requireValue(taskCapsule.value?.integrity?.status === "verified", "current_task_capsule_integrity_invalid")
    await verifyCapsuleEvidence(projectRoot, taskCapsule.value, archivedNamespaces)

    const terminalEvidence = await readRegistryBinding(
      projectRoot,
      current.value.terminalEvidence,
      archivedNamespaces,
      "current_task_terminal",
    )
    requireValue(isTerminalExecutionState(terminalEvidence.value?.executionState), "current_task_terminal_not_completed")
    requireValue(terminalEvidence.value?.status === current.value.terminalEvidence.status, "current_task_terminal_status_mismatch")

    const latestTrainingTerminal = await readLatestTrainingTerminal(
      projectRoot,
      current.value.latestTrainingTerminal,
      archivedNamespaces,
    )

    requireRegistryDeadline(deadlineUnixMs)
    return {
      ok: true,
      status: "verified",
      registry: current.value,
      registrySha256: current.sha256,
      taskCapsule: taskCapsule.value,
      currentTaskTerminal: terminalEvidence.value,
      latestTrainingExecution: latestTrainingTerminal,
      archivedNamespaces,
    }
  } catch (error) {
    return {
      ok: false,
      status: "unknown_or_stale",
      errorCode: error instanceof Error ? error.message : "registry_read_failed",
      registry: null,
      registrySha256: null,
      taskCapsule: null,
      currentTaskTerminal: null,
      latestTrainingExecution: null,
      archivedNamespaces: [],
    }
  }
}

export async function initializeCurrentExecutionRegistry({
  projectRoot = process.cwd(),
  currentTaskCapsulePath,
  currentTaskTerminalPath,
  currentCandidatePath,
  latestTrainingTerminalPath,
  archivedEvidenceNamespaces,
}) {
  const existing = await readFile(resolveProjectPath(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH)).catch(() => null)
  requireValue(existing === null, "current_execution_registry_already_exists")

  const sourceCapsule = await readBoundJson(projectRoot, currentTaskCapsulePath)
  const sourceTerminal = await readBoundJson(projectRoot, currentTaskTerminalPath)
  const currentCandidate = await readBoundJson(projectRoot, currentCandidatePath)
  const latestTrainingTerminal = await readBoundJson(projectRoot, latestTrainingTerminalPath)

  requireValue(sourceCapsule.value?.schemaVersion === "ai-painter-local-task-capsule-v2", "source_task_capsule_schema_invalid")
  requireValue(sourceTerminal.value?.schemaVersion === "stage4-post-decode-failure-bounded-planning-terminal-v1", "source_task_terminal_schema_invalid")
  requireValue(isTerminalExecutionState(sourceTerminal.value?.executionState), "source_task_terminal_not_completed")
  requireValue(sourceTerminal.value?.status === "bounded_candidate_planning_completed", "source_task_terminal_status_invalid")
  requireValue(currentCandidate.value?.schemaVersion === "stage4-post-decode-bounded-candidate-v1", "source_candidate_schema_invalid")
  requireValue(currentCandidate.value?.status === "cpu_inactive_candidate_planned_not_implemented", "source_candidate_status_invalid")
  requireValue(latestTrainingTerminal.value?.schemaVersion === "stage4-post-decode-object-rgb-stage0-terminal-v1", "latest_training_terminal_schema_invalid")
  requireValue(isTerminalExecutionState(latestTrainingTerminal.value?.executionState), "latest_training_terminal_not_completed")
  requireValue(latestTrainingTerminal.value?.status === "post_decode_object_rgb_stage0_real_visual_failure", "latest_training_terminal_status_invalid")
  requireValue(sourceCapsule.value?.latestTerminal?.path === normalizeRelativePath(currentTaskTerminalPath), "source_capsule_terminal_path_mismatch")
  requireValue(sourceCapsule.value?.latestTerminal?.sha256 === sourceTerminal.sha256, "source_capsule_terminal_hash_mismatch")
  requireValue(sourceTerminal.value?.candidate?.path === normalizeRelativePath(currentCandidatePath), "source_terminal_candidate_path_mismatch")
  requireValue(sourceTerminal.value?.candidate?.sha256 === currentCandidate.sha256, "source_terminal_candidate_hash_mismatch")

  const archivedNamespaces = normalizeArchivedNamespaces(archivedEvidenceNamespaces)
  for (const sourcePath of [currentTaskCapsulePath, currentTaskTerminalPath, currentCandidatePath, latestTrainingTerminalPath]) {
    rejectArchivedPath(normalizeRelativePath(sourcePath), archivedNamespaces)
  }

  const transactionId = `current-execution-registry-migration-${compactUtc()}-${randomUUID()}`
  const transactionRoot = `${CURRENT_EXECUTION_REGISTRY_ROOT}/transactions/${transactionId}`
  await mkdir(
    resolveProjectPath(projectRoot, `${CURRENT_EXECUTION_REGISTRY_ROOT}/transactions`),
    { recursive: true },
  )
  await mkdir(resolveProjectPath(projectRoot, transactionRoot), { recursive: false })

  const recordedAtUtc = new Date().toISOString()
  const projectedCapsule = buildProjectedCurrentTaskCapsule({
    sourceCapsule,
    sourceTerminal,
    currentCandidate,
    latestTrainingTerminal,
    recordedAtUtc,
  })
  const projectedCapsulePath = `${transactionRoot}/current-task-capsule.json`
  await writeExclusiveJson(projectRoot, projectedCapsulePath, projectedCapsule)
  const projectedCapsuleSha256 = await sha256File(projectRoot, projectedCapsulePath)

  const latestTrainingRoot = path.posix.dirname(normalizeRelativePath(latestTrainingTerminalPath))
  const latestTrainingBindings = await buildLatestTrainingBindings(projectRoot, latestTrainingRoot)
  const registryRevision = 1
  const eventSequence = 1
  const current = {
    schemaVersion: REGISTRY_SCHEMA,
    registryIdentity: "ai-painter-current-execution",
    registryRevision,
    eventSequence,
    capabilityVersion: "stage4-post-decode-full-condition-route-object-responsibility-renderer-change-candidate-v1",
    packageId: `current-task-${sourceTerminal.value.planningRunId}`,
    packageSha256: sourceTerminal.sha256,
    taskId: sourceTerminal.value.nextAction,
    taskKind: "cpu_inactive_candidate_implementation",
    taskGoal: "Implement the bounded CPU-inactive Stage4 candidate and preserve every bound evidence identity.",
    priority: 1,
    queueStatus: "ready",
    nextMachineAction: sourceTerminal.value.nextAction,
    queuedAtUtc: recordedAtUtc,
    runId: sourceTerminal.value.planningRunId,
    lifecycleStage: "change_candidate",
    executionState: "package_materialized",
    activity: "planned_not_started",
    taskCapsule: {
      path: projectedCapsulePath,
      sha256: projectedCapsuleSha256,
    },
    terminalEvidence: {
      path: normalizeRelativePath(currentTaskTerminalPath),
      sha256: sourceTerminal.sha256,
      status: sourceTerminal.value.status,
    },
    activeExecution: null,
    latestTrainingTerminal: {
      runId: latestTrainingTerminal.value.runId,
      path: normalizeRelativePath(latestTrainingTerminalPath),
      sha256: latestTrainingTerminal.sha256,
      status: latestTrainingTerminal.value.status,
      ...latestTrainingBindings,
    },
    selectedHistoricalRun: null,
    archivedEvidenceNamespaces: archivedNamespaces.map((archivePath) => ({
      path: archivePath,
      status: "historical_read_only_excluded_from_current_projection",
    })),
    supersedes: null,
    recordedAtUtc,
    recordedAtAsiaShanghai: asiaShanghaiTimestamp(recordedAtUtc),
    writerIdentity: "local_ai_capability_lifecycle_orchestrator",
    transactionId,
  }
  const currentBytes = jsonBytes(current)
  const currentSha256 = sha256Bytes(currentBytes)
  const event = {
    schemaVersion: "ai-painter-current-execution-registry-event-v1",
    registryRevision,
    eventSequence,
    transactionId,
    action: "migrate_current_task_and_archive_legacy_smoke",
    taskId: current.taskId,
    runId: current.runId,
    latestTrainingRunId: current.latestTrainingTerminal.runId,
    archivedEvidenceNamespaces: current.archivedEvidenceNamespaces,
    currentSha256,
    recordedAtUtc,
  }
  const pendingTransactionPath = `${transactionRoot}/transaction.pending.json`
  const transactionPath = `${transactionRoot}/transaction.json`
  const pendingTransaction = {
    schemaVersion: "ai-painter-current-execution-registry-transaction-v1",
    transactionId,
    status: "pending",
    registryRevision,
    eventSequence,
    currentSha256,
    recordedAtUtc,
  }
  await writeExclusiveJson(projectRoot, pendingTransactionPath, pendingTransaction)

  const registryRoot = resolveProjectPath(projectRoot, CURRENT_EXECUTION_REGISTRY_ROOT)
  await mkdir(registryRoot, { recursive: true })
  const databasePath = path.join(registryRoot, "registry.sqlite")
  const database = new DatabaseSync(databasePath)
  initializeDatabase(database)
  database.exec("BEGIN IMMEDIATE")
  try {
    const row = database.prepare("SELECT MAX(registry_revision) AS revision FROM registry_revisions").get()
    requireValue(row?.revision === null || row?.revision === undefined, "registry_database_not_empty")
    await appendDurableLine(projectRoot, `${CURRENT_EXECUTION_REGISTRY_ROOT}/events.jsonl`, event)
    await writeAtomicExclusiveBytes(
      projectRoot,
      CURRENT_EXECUTION_REGISTRY_PATH,
      currentBytes,
    )
    const committedTransaction = {
      ...pendingTransaction,
      status: "committed",
      committedAtUtc: new Date().toISOString(),
    }
    await writeExclusiveJson(projectRoot, transactionPath, committedTransaction)
    database.prepare(`
      INSERT INTO registry_transactions
      (transaction_id, status, current_sha256, recorded_at_utc)
      VALUES (?, 'committed', ?, ?)
    `).run(transactionId, currentSha256, recordedAtUtc)
    database.prepare(`
      INSERT INTO registry_revisions
      (registry_revision, event_sequence, transaction_id, current_sha256, task_id, run_id, recorded_at_utc)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(registryRevision, eventSequence, transactionId, currentSha256, current.taskId, current.runId, recordedAtUtc)
    database.exec("COMMIT")
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  } finally {
    database.close()
  }

  return readCurrentExecutionRegistry(projectRoot)
}

export async function prepareCurrentExecutionRegistryAdvance({
  projectRoot = process.cwd(),
  capabilityVersion,
  packageId,
  taskId,
  taskKind,
  taskGoal = null,
  priority = null,
  queueStatus = null,
  nextMachineAction = undefined,
  queuedAtUtc = null,
  runId,
  lifecycleStage,
  executionState,
  activity,
  taskCapsulePath,
  terminalEvidencePath,
  latestTrainingTerminal = null,
  activeExecution = null,
  expectedPreviousRegistryRevision = null,
  expectedPreviousRegistrySha256 = null,
  dependencyManifest = null,
  _testHooks = null,
  _expiredActiveRecovery = null,
  deadlineUnixMs = null,
}) {
  requireRegistryDeadline(deadlineUnixMs)
  const previous = _expiredActiveRecovery === null
    ? await readCurrentExecutionRegistry(projectRoot, { deadlineUnixMs })
    : await readCurrentExecutionRegistryInternal(projectRoot, {
        deadlineUnixMs,
        expiredActiveRecovery: {
          ..._expiredActiveRecovery,
          processProbe: _testHooks?.probeActiveExecutionProcess ?? null,
        },
      })
  requireValue(previous.ok === true, "current_execution_registry_not_verified")
  if (expectedPreviousRegistryRevision !== null) {
    requireValue(
      previous.registry.registryRevision === expectedPreviousRegistryRevision,
      "registry_expected_previous_revision_mismatch",
    )
  }
  if (expectedPreviousRegistrySha256 !== null) {
    requireValue(
      previous.registrySha256 === expectedPreviousRegistrySha256,
      "registry_expected_previous_sha256_mismatch",
    )
  }
  for (const value of [capabilityVersion, packageId, taskId, taskKind, runId, lifecycleStage, executionState, activity]) {
    requireValue(typeof value === "string" && value.length > 0, "registry_advance_identity_invalid")
  }
  const taskControl = normalizeTaskControlMetadata({
    taskId,
    taskKind,
    taskGoal,
    priority,
    queueStatus,
    nextMachineAction,
    queuedAtUtc,
    executionState,
    activity,
  })
  const archivedNamespaces = previous.archivedNamespaces
  const normalizedActiveExecution = await normalizeAndVerifyActiveExecution({
    projectRoot,
    activeExecution,
    capabilityVersion,
    packageId,
    runId,
    executionState,
    archivedNamespaces,
    deadlineUnixMs,
  })
  if (normalizedActiveExecution === null) {
    requireValue(!ACTIVE_EXECUTION_STATES.has(executionState), "registry_active_execution_missing")
  } else {
    requireValue(taskControl.queueStatus === "running", "registry_active_execution_queue_status_invalid")
    requireValue(taskControl.nextMachineAction === null, "registry_active_execution_next_action_forbidden")
  }
  const normalizedCapsulePath = normalizeRelativePath(taskCapsulePath)
  const normalizedTerminalPath = normalizeRelativePath(terminalEvidencePath)
  rejectArchivedPath(normalizedCapsulePath, archivedNamespaces)
  rejectArchivedPath(normalizedTerminalPath, archivedNamespaces)
  const capsule = await readBoundJson(projectRoot, normalizedCapsulePath)
  const terminal = await readBoundJson(projectRoot, normalizedTerminalPath)
  requireValue(capsule.value?.schemaVersion === CAPSULE_SCHEMA, "advanced_task_capsule_schema_invalid")
  requireValue(capsule.value?.integrity?.status === "verified", "advanced_task_capsule_integrity_invalid")
  await verifyCapsuleEvidence(projectRoot, capsule.value, archivedNamespaces)
  requireValue(isTerminalExecutionState(terminal.value?.executionState), "advanced_terminal_not_completed")
  requireValue(typeof terminal.value?.status === "string" && terminal.value.status.length > 0, "advanced_terminal_status_invalid")
  let nextLatestTrainingTerminal = previous.registry.latestTrainingTerminal
  if (latestTrainingTerminal !== null) {
    requireValue(typeof latestTrainingTerminal.runId === "string" && latestTrainingTerminal.runId.length > 0, "latest_training_run_id_invalid")
    const latestTerminal = await readBoundJson(projectRoot, normalizeRelativePath(latestTrainingTerminal.path))
    requireValue(latestTerminal.sha256 === latestTrainingTerminal.sha256, "latest_training_terminal_sha256_invalid")
    requireValue(isTerminalExecutionState(latestTerminal.value?.executionState), "latest_training_terminal_not_completed")
    requireValue(latestTerminal.value?.status === latestTrainingTerminal.status, "latest_training_terminal_status_invalid")
    requireValue(trainingTerminalRunId(latestTerminal.value) === latestTrainingTerminal.runId, "latest_training_run_id_mismatch")
    const normalizedEvidence = {}
    for (const [kind, binding] of Object.entries(latestTrainingTerminal.evidence ?? {})) {
      if (binding === null) {
        normalizedEvidence[kind] = null
        continue
      }
      const verified = await readBoundJson(projectRoot, normalizeRelativePath(binding.path))
      requireValue(verified.sha256 === binding.sha256, `latest_training_${kind}_sha256_invalid`)
      normalizedEvidence[kind] = { path: normalizeRelativePath(binding.path), sha256: verified.sha256 }
    }
    nextLatestTrainingTerminal = {
      runId: latestTrainingTerminal.runId,
      path: normalizeRelativePath(latestTrainingTerminal.path),
      sha256: latestTerminal.sha256,
      status: latestTrainingTerminal.status,
      evidence: normalizedEvidence,
    }
  }

  const recordedAtUtc = new Date().toISOString()
  const registryRevision = previous.registry.registryRevision + 1
  const eventSequence = previous.registry.eventSequence + 1
  const transactionId = `current-execution-registry-advance-${compactUtc()}-${randomUUID()}`
  const processIdentity = resolveCurrentProcessIdentity(_testHooks, deadlineUnixMs)
  const writerClaim = {
    schemaVersion: "ai-painter-current-execution-registry-writer-claim-v1",
    transactionId,
    processId: process.pid,
    processStartIdentity: processIdentity,
    claimedAtUtc: new Date().toISOString(),
  }
  requireRegistryDeadline(deadlineUnixMs)
  await acquireWriterClaim(projectRoot, writerClaim)
  let durablePrepared = false
  let transactionRoot = null
  try {
    const lockedPrevious = _expiredActiveRecovery === null
      ? await readCurrentExecutionRegistry(projectRoot, { deadlineUnixMs })
      : await readCurrentExecutionRegistryInternal(projectRoot, {
          deadlineUnixMs,
          expiredActiveRecovery: {
            ..._expiredActiveRecovery,
            processProbe: _testHooks?.probeActiveExecutionProcess ?? null,
          },
        })
    requireValue(lockedPrevious.ok === true, "current_execution_registry_not_verified_after_claim")
    requireValue(lockedPrevious.registrySha256 === previous.registrySha256, "registry_changed_before_writer_claim")
    requireValue(lockedPrevious.registry.registryRevision === previous.registry.registryRevision, "registry_revision_changed_before_writer_claim")
    transactionRoot = `${CURRENT_EXECUTION_REGISTRY_ROOT}/transactions/${transactionId}`
    await mkdir(resolveProjectPath(projectRoot, transactionRoot), { recursive: false })
    const current = {
    schemaVersion: REGISTRY_SCHEMA,
    registryIdentity: "ai-painter-current-execution",
    registryRevision,
    eventSequence,
    capabilityVersion,
    packageId,
    packageSha256: terminal.sha256,
    taskId,
    taskKind,
    taskGoal: taskControl.taskGoal,
    priority: taskControl.priority,
    queueStatus: taskControl.queueStatus,
    nextMachineAction: taskControl.nextMachineAction,
    queuedAtUtc: taskControl.queuedAtUtc,
    runId,
    lifecycleStage,
    executionState,
    activity,
    taskCapsule: { path: normalizedCapsulePath, sha256: capsule.sha256 },
    terminalEvidence: {
      path: normalizedTerminalPath,
      sha256: terminal.sha256,
      status: terminal.value.status,
    },
    activeExecution: normalizedActiveExecution,
    latestTrainingTerminal: nextLatestTrainingTerminal,
    selectedHistoricalRun: null,
    archivedEvidenceNamespaces: previous.registry.archivedEvidenceNamespaces,
    supersedes: {
      registryRevision: previous.registry.registryRevision,
      eventSequence: previous.registry.eventSequence,
      transactionId: previous.registry.transactionId,
      currentSha256: previous.registrySha256,
      taskId: previous.registry.taskId,
      runId: previous.registry.runId,
    },
    recordedAtUtc,
    recordedAtAsiaShanghai: asiaShanghaiTimestamp(recordedAtUtc),
    writerIdentity: "local_ai_capability_lifecycle_orchestrator",
    transactionId,
    }
    const currentBytes = jsonBytes(current)
    const currentSha256 = sha256Bytes(currentBytes)
    const registryEvent = {
    schemaVersion: "ai-painter-current-execution-registry-event-v1",
    registryRevision,
    eventSequence,
    transactionId,
    action: "advance_current_capability_lifecycle",
    taskId,
    runId,
    currentSha256,
    previousCurrentSha256: previous.registrySha256,
    recordedAtUtc,
    }
    const currentStagedPath = `${transactionRoot}/current.staged.json`
    const registryEventStagedPath = `${transactionRoot}/registry-event.staged.jsonl`
    const dependencyManifestPath = `${transactionRoot}/dependency-manifest.json`
    const normalizedDependencies = normalizeDependencyManifest(dependencyManifest)
    const registryEventBytes = Buffer.from(`${JSON.stringify(registryEvent)}\n`, "utf8")
    await writeExclusiveBytes(projectRoot, currentStagedPath, currentBytes)
    await writeExclusiveBytes(projectRoot, registryEventStagedPath, registryEventBytes)
    await writeExclusiveJson(projectRoot, dependencyManifestPath, normalizedDependencies)
    const pendingTransaction = {
    schemaVersion: REGISTRY_TRANSACTION_SCHEMA,
    transactionId,
    status: "pending",
    registryRevision,
    eventSequence,
    currentSha256,
    previousCurrentSha256: previous.registrySha256,
    previousRegistryRevision: previous.registry.registryRevision,
    currentStaged: { path: currentStagedPath, sha256: currentSha256 },
    registryEventStaged: {
      path: registryEventStagedPath,
      sha256: sha256Bytes(registryEventBytes),
    },
    dependencyManifest: {
      path: dependencyManifestPath,
      sha256: sha256Bytes(jsonBytes(normalizedDependencies)),
    },
    recordedAtUtc,
    }
    await writeExclusiveJson(
      projectRoot,
      `${transactionRoot}/transaction.pending.json`,
      pendingTransaction,
    )
    ensurePreparedDatabaseRows(
      projectRoot,
      pendingTransaction,
      stagedCurrentValueForDatabase(current),
      _testHooks,
    )
    durablePrepared = true
    invokeTransactionHook(_testHooks, "after_prepare_database_commit", { transactionId })
    return {
      ok: true,
      status: "prepared_not_published",
      transactionId,
      registryRevision,
      eventSequence,
      currentSha256,
      previousCurrentSha256: previous.registrySha256,
      transactionRoot,
      writerClaim,
    }
  } catch (error) {
    if (!durablePrepared) {
      if (transactionRoot !== null) {
        await writeAbortedPrepareRecord(
          projectRoot,
          transactionRoot,
          transactionId,
          error,
        ).catch(() => undefined)
      }
      await releaseWriterClaim(projectRoot, transactionId).catch(() => undefined)
    }
    throw error
  }
}

export async function advanceCurrentExecutionRegistry(options) {
  const beforeAtomicWrite = options.beforeAtomicWrite ?? null
  requireValue(beforeAtomicWrite === null || typeof beforeAtomicWrite === "function", "registry_atomic_write_guard_invalid")
  const prepared = await prepareCurrentExecutionRegistryAdvance(options)
  return finalizePreparedCurrentExecutionRegistryAdvance({
    projectRoot: options.projectRoot ?? process.cwd(),
    transactionId: prepared.transactionId,
    deadlineUnixMs: options.deadlineUnixMs ?? null,
    beforeAtomicWrite,
    _testHooks: options._testHooks ?? null,
  })
}

export async function recoverExpiredActiveExecutionToFailedClosed({
  projectRoot = process.cwd(),
  capabilityVersion,
  packageId,
  runId,
  taskCapsulePath,
  terminalEvidencePath,
  dependencyManifest = null,
  expectedPreviousRegistryRevision,
  expectedPreviousRegistrySha256,
  kernelInterruptionProfile = null,
  historicalSourceManifest = null,
  _testHooks = null,
  deadlineUnixMs = null,
  beforeAtomicWrite = null,
}) {
  requireRegistryDeadline(deadlineUnixMs)
  requireValue(beforeAtomicWrite === null || typeof beforeAtomicWrite === "function", "registry_atomic_write_guard_invalid")
  for (const value of [capabilityVersion, packageId, runId]) {
    requireValue(
      typeof value === "string" && value.length > 0,
      "registry_expired_active_recovery_identity_invalid",
    )
  }
  requireValue(
    Number.isInteger(expectedPreviousRegistryRevision)
      && expectedPreviousRegistryRevision > 0,
    "registry_expired_active_recovery_revision_invalid",
  )
  requireValue(
    typeof expectedPreviousRegistrySha256 === "string"
      && /^[a-f0-9]{64}$/u.test(expectedPreviousRegistrySha256),
    "registry_expired_active_recovery_registry_sha256_invalid",
  )

  const recoveryContext = {
    capabilityVersion,
    packageId,
    runId,
  }
  if (historicalSourceManifest !== null) {
    requireValue(kernelInterruptionProfile === null, "registry_recovery_context_conflict")
    const current = await readBoundJson(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH)
    recoveryContext.historicalSources = await verifyHistoricalSources(projectRoot, current.value, current.sha256, historicalSourceManifest, deadlineUnixMs)
  }
  if (kernelInterruptionProfile !== null) {
    const recovery = await import('../../scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs')
    const recheck = () => {
      const bound = recovery.loadRecoveryProfile(projectRoot, kernelInterruptionProfile.path, kernelInterruptionProfile.sha256)
      requireValue(recovery.isKernelInterruptionProfile(bound.profile), 'registry_kernel_interruption_profile_invalid')
      const historical = recovery.verifyHistoricalInputs(projectRoot, bound.profile)
      recovery.verifyLiveInterruptionGuard(projectRoot, bound.profile)
      const host = _testHooks?.queryKernelInterruptionHost?.() ?? recovery.queryNativeHost()
      recovery.verifyKernelInterruptionHost(historical, host)
      requireValue(historical.registry.runId === runId && historical.registry.packageId === packageId
        && historical.registry.capabilityVersion === capabilityVersion
        && bound.profile.registry.sha256 === expectedPreviousRegistrySha256
        && bound.profile.registry.revision === expectedPreviousRegistryRevision, 'registry_kernel_interruption_identity_mismatch')
      return { historical, host, bound }
    }
    const context = { recheck }
    VERIFIED_KERNEL_INTERRUPTION_CONTEXTS.add(context)
    recoveryContext.kernelInterruption = context
    recheck()
  }
  const stale = await readCurrentExecutionRegistryInternal(projectRoot, {
    deadlineUnixMs,
    expiredActiveRecovery: {
      ...recoveryContext,
      processProbe: _testHooks?.probeActiveExecutionProcess ?? null,
    },
  })
  requireValue(stale.ok === true, "registry_expired_active_recovery_source_not_verified")
  requireValue(
    stale.registry.registryRevision === expectedPreviousRegistryRevision,
    "registry_expired_active_recovery_revision_mismatch",
  )
  requireValue(
    stale.registrySha256 === expectedPreviousRegistrySha256,
    "registry_expired_active_recovery_registry_sha256_mismatch",
  )

  const terminal = await readBoundJson(projectRoot, normalizeRelativePath(terminalEvidencePath))
  requireValue(
    terminal.value?.executionState === "failed_closed",
    "registry_expired_active_recovery_terminal_not_failed_closed",
  )
  requireValue(
    terminal.value?.capabilityVersion === capabilityVersion,
    "registry_expired_active_recovery_terminal_capability_mismatch",
  )
  requireValue(
    terminal.value?.packageId === packageId,
    "registry_expired_active_recovery_terminal_package_mismatch",
  )
  requireValue(
    terminal.value?.runId === runId,
    "registry_expired_active_recovery_terminal_run_mismatch",
  )
  if (kernelInterruptionProfile !== null) {
    const proof = recoveryContext.kernelInterruption.recheck()
    const recovery = await import('../../scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs')
    const expectedTerminal = recovery.kernelInterruptionTerminalIdentity(proof.bound.profile)
    requireValue(terminal.value.schemaVersion === expectedTerminal.schemaVersion
      && terminal.value.status === expectedTerminal.status
      && terminal.value.profileSha256 === kernelInterruptionProfile.sha256
      && terminal.value.originalRegistry?.sha256 === expectedPreviousRegistrySha256
      && terminal.value.historicalCleanupCertified === false && terminal.value.oldExecutionMayReplay === false
      && terminal.value.trainingQualificationGranted === false, 'registry_kernel_interruption_terminal_invalid')
  }

  const prepared = await prepareCurrentExecutionRegistryAdvance({
    projectRoot,
    capabilityVersion,
    packageId,
    taskId: `${runId}-expired-active-recovery`,
    taskKind: "expired_active_execution_recovery_failed_closed",
    taskGoal: "Fail-close an expired active execution after verifying dead process identity, immutable evidence, and recovery lineage without replaying GPU work.",
    priority: 1,
    queueStatus: "failed_closed",
    nextMachineAction: null,
    queuedAtUtc: new Date().toISOString(),
    runId,
    lifecycleStage: "active_execution_recovery",
    executionState: "failed_closed",
    activity: "host_interruption_recovery_failed_closed",
    taskCapsulePath,
    terminalEvidencePath,
    latestTrainingTerminal: kernelInterruptionProfile === null || terminal.value.status === 'qualification_system_interrupted' ? null : {
      runId, path: terminalEvidencePath, sha256: terminal.sha256, status: terminal.value.status, evidence: {},
    },
    activeExecution: null,
    expectedPreviousRegistryRevision,
    expectedPreviousRegistrySha256,
    dependencyManifest,
    _testHooks,
    _expiredActiveRecovery: recoveryContext,
    deadlineUnixMs,
  })
  return finalizePreparedCurrentExecutionRegistryAdvance({
    projectRoot,
    transactionId: prepared.transactionId,
    _testHooks,
    deadlineUnixMs,
    beforeAtomicWrite,
  })
}

export async function finalizePreparedCurrentExecutionRegistryAdvance({
  projectRoot = process.cwd(),
  transactionId,
  _testHooks = null,
  deadlineUnixMs = null,
  beforeAtomicWrite = null,
}) {
  requireValue(beforeAtomicWrite === null || typeof beforeAtomicWrite === "function", "registry_resource_guard_invalid")
  requireRegistryDeadline(deadlineUnixMs)
  requireSafeTransactionId(transactionId)
  const claim = await readWriterClaim(projectRoot)
  requireValue(claim.transactionId === transactionId, "registry_writer_claim_transaction_mismatch")
  requireValue(claim.processId === process.pid, "registry_writer_claim_not_owned_by_current_process")
  requireValue(
    claim.processStartIdentity === resolveCurrentProcessIdentity(_testHooks, deadlineUnixMs),
    "registry_writer_claim_process_identity_mismatch",
  )
  return finalizePreparedAdvanceInternal({ projectRoot, transactionId, _testHooks, deadlineUnixMs, beforeAtomicWrite })
}

export async function recoverPreparedCurrentExecutionRegistryAdvance({
  projectRoot = process.cwd(),
  transactionId = null,
  _testHooks = null,
  deadlineUnixMs = null,
  historicalSourceManifest = null,
  beforeAtomicWrite = null,
}) {
  requireRegistryDeadline(deadlineUnixMs)
  requireValue(beforeAtomicWrite === null || typeof beforeAtomicWrite === "function", "registry_atomic_write_guard_invalid")
  const claim = await readWriterClaim(projectRoot)
  if (transactionId !== null) requireValue(claim.transactionId === transactionId, "registry_writer_claim_transaction_mismatch")
  requireSafeTransactionId(claim.transactionId)
  const probe = probeClaimProcess(claim, _testHooks, deadlineUnixMs)
  requireValue(probe.status !== "indeterminate", "registry_writer_claim_liveness_indeterminate")
  requireValue(probe.status !== "active", "registry_writer_claim_active")
  return finalizePreparedAdvanceInternal({
    projectRoot,
    transactionId: claim.transactionId,
    _testHooks,
    deadlineUnixMs,
    recoveryClaim: claim,
    historicalSourceManifest,
    beforeAtomicWrite,
  })
}

async function finalizePreparedAdvanceInternal({ projectRoot, transactionId, _testHooks, deadlineUnixMs = null, beforeAtomicWrite = null, recoveryClaim = null, historicalSourceManifest = null }) {
  requireRegistryDeadline(deadlineUnixMs)
  const initialClaim = await readBoundJson(projectRoot, REGISTRY_WRITER_CLAIM_PATH)
  requireValue(initialClaim.value.transactionId === transactionId, "registry_writer_claim_transaction_mismatch")
  if (recoveryClaim !== null) requireValue(JSON.stringify(initialClaim.value) === JSON.stringify(recoveryClaim), "registry_writer_claim_changed")
  const transactionRoot = `${CURRENT_EXECUTION_REGISTRY_ROOT}/transactions/${transactionId}`
  const pendingPath = `${transactionRoot}/transaction.pending.json`
  const committedPath = `${transactionRoot}/transaction.json`
  const pending = await readBoundJson(projectRoot, pendingPath)
  requireValue(pending.value?.schemaVersion === REGISTRY_TRANSACTION_SCHEMA, "registry_pending_transaction_schema_invalid")
  requireValue(pending.value?.transactionId === transactionId, "registry_pending_transaction_identity_mismatch")
  requireValue(pending.value?.status === "pending", "registry_pending_transaction_status_invalid")
  const stagedCurrent = await readRawBinding(projectRoot, pending.value.currentStaged, "registry_staged_current")
  const stagedEvent = await readRawBinding(projectRoot, pending.value.registryEventStaged, "registry_staged_event")
  const dependencyManifest = await readRegistryBindingWithoutArchive(
    projectRoot,
    pending.value.dependencyManifest,
    "registry_dependency_manifest",
  )
  requireValue(dependencyManifest.value?.schemaVersion === REGISTRY_DEPENDENCY_SCHEMA, "registry_dependency_manifest_schema_invalid")
  requireValue(sha256Bytes(stagedCurrent.bytes) === pending.value.currentSha256, "registry_staged_current_hash_mismatch")
  const stagedCurrentValue = JSON.parse(stagedCurrent.bytes.toString("utf8"))
  requireValue(stagedCurrentValue.transactionId === transactionId, "registry_staged_current_transaction_mismatch")
  requireValue(stagedCurrentValue.registryRevision === pending.value.registryRevision, "registry_staged_current_revision_mismatch")
  requireValue(stagedCurrentValue.eventSequence === pending.value.eventSequence, "registry_staged_current_sequence_mismatch")
  let expiredActiveRecovery = null
  let recoverDeadActive = false
  if (recoveryClaim !== null && stagedCurrentValue.activeExecution != null) {
    const active = stagedCurrentValue.activeExecution
    const probe = typeof _testHooks?.probeActiveExecutionProcess === "function"
      ? _testHooks.probeActiveExecutionProcess(active) : queryProcessIdentity(active.processId, deadlineUnixMs)
    requireValue(probe.status === "active" || probe.status === "dead", "registry_active_execution_process_identity_unavailable")
    recoverDeadActive = probe.status === "dead" || probe.identity !== active.processStartIdentity
  }
  if (recoverDeadActive) {
    const active = stagedCurrentValue.activeExecution
    requireValue(active.processId === recoveryClaim.processId && active.processStartIdentity === recoveryClaim.processStartIdentity,
      "registry_recovery_writer_active_identity_mismatch")
    await verifyCommittedHistoricalTransaction(projectRoot, stagedCurrentValue, pending.value.currentSha256)
    expiredActiveRecovery = {
      capabilityVersion: stagedCurrentValue.capabilityVersion, packageId: stagedCurrentValue.packageId, runId: stagedCurrentValue.runId,
      processProbe: _testHooks?.probeActiveExecutionProcess ?? null,
      historicalSources: historicalSourceManifest === null ? null
        : await verifyHistoricalSources(projectRoot, stagedCurrentValue, pending.value.currentSha256, historicalSourceManifest, deadlineUnixMs),
    }
  } else requireValue(historicalSourceManifest === null, "registry_historical_sources_without_dead_active")
  await verifyStoredActiveExecution(
    projectRoot,
    stagedCurrentValue,
    normalizeArchivedNamespaces(stagedCurrentValue.archivedEvidenceNamespaces),
    expiredActiveRecovery,
    deadlineUnixMs,
  )
  const stagedEventValue = parseSingleJsonLine(stagedEvent.bytes, "registry_staged_event_invalid")
  requireValue(stagedEventValue.transactionId === transactionId, "registry_staged_event_transaction_mismatch")
  requireValue(stagedEventValue.currentSha256 === pending.value.currentSha256, "registry_staged_event_current_hash_mismatch")

  const currentBytes = await readFile(resolveProjectPath(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH))
  const currentSha256 = sha256Bytes(currentBytes)
  const alreadyPublished = currentSha256 === pending.value.currentSha256
  if (!alreadyPublished) {
    requireValue(currentSha256 === pending.value.previousCurrentSha256, "registry_previous_current_hash_changed")
    const currentValue = JSON.parse(currentBytes.toString("utf8"))
    requireValue(currentValue.registryRevision === pending.value.previousRegistryRevision, "registry_previous_revision_changed")
  }

  requireRegistryDeadline(deadlineUnixMs)
  ensurePreparedDatabaseRows(
    projectRoot,
    pending.value,
    stagedCurrentValueForDatabase(stagedCurrentValue),
    _testHooks,
  )
  verifyPreparedDatabaseRows(projectRoot, pending.value)
  const dependencyVerification = await verifyDependencyManifest(projectRoot, dependencyManifest.value)
  invokeTransactionHook(_testHooks, "after_dependencies_verified", { transactionId })

  requireRegistryDeadline(deadlineUnixMs)
  await ensureAtomicJsonlEvent(
    projectRoot,
    `${CURRENT_EXECUTION_REGISTRY_ROOT}/events.jsonl`,
    stagedEvent.bytes,
    transactionId,
    beforeAtomicWrite,
  )
  await verifyRegistryEventBytes(projectRoot, stagedEventValue)
  invokeTransactionHook(_testHooks, "after_registry_event_committed", { transactionId })

  requireRegistryDeadline(deadlineUnixMs)
  commitPreparedDatabaseRows(projectRoot, pending.value)
  invokeTransactionHook(_testHooks, "after_database_committed", { transactionId })

  const committedTransaction = {
    ...pending.value,
    status: "committed",
    dependencyVerification,
    committedAtUtc: new Date().toISOString(),
  }
  if (await fileExists(projectRoot, committedPath)) {
    const existing = await readBoundJson(projectRoot, committedPath)
    requireValue(existing.value?.transactionId === transactionId, "registry_committed_transaction_identity_mismatch")
    requireValue(existing.value?.status === "committed", "registry_committed_transaction_status_invalid")
    requireValue(existing.value?.currentSha256 === pending.value.currentSha256, "registry_committed_transaction_hash_mismatch")
  } else {
    await writeExclusiveJson(projectRoot, committedPath, committedTransaction)
  }
  invokeTransactionHook(_testHooks, "before_current_publish", { transactionId })

  const recheckPublication = async () => {
    requireRegistryDeadline(deadlineUnixMs)
    const claim = await readWriterClaim(projectRoot)
    requireValue((await readBoundJson(projectRoot, REGISTRY_WRITER_CLAIM_PATH)).sha256 === initialClaim.sha256, "registry_writer_claim_changed")
    requireValue(claim.transactionId === transactionId, "registry_writer_claim_transaction_mismatch")
    if (recoveryClaim === null) {
      requireValue(claim.processId === process.pid && claim.processStartIdentity === resolveCurrentProcessIdentity(_testHooks, deadlineUnixMs), "registry_writer_claim_process_identity_mismatch")
    } else {
      const probe = probeClaimProcess(claim, _testHooks, deadlineUnixMs)
      requireValue(probe.status === "dead", "registry_recovery_writer_not_dead")
    }
    requireValue((await readBoundJson(projectRoot, pendingPath)).sha256 === pending.sha256, "registry_pending_transaction_changed")
    await readRawBinding(projectRoot, pending.value.currentStaged, "registry_staged_current")
    await readRawBinding(projectRoot, pending.value.registryEventStaged, "registry_staged_event")
    await readRawBinding(projectRoot, pending.value.dependencyManifest, "registry_dependency_manifest")
    await verifyDependencyManifest(projectRoot, dependencyManifest.value)
    await verifyStoredActiveExecution(projectRoot, stagedCurrentValue, normalizeArchivedNamespaces(stagedCurrentValue.archivedEvidenceNamespaces), expiredActiveRecovery, deadlineUnixMs)
    await verifyCommittedHistoricalTransaction(projectRoot, stagedCurrentValue, pending.value.currentSha256)
    const beforePublish = await readBoundJson(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH)
    if (beforePublish.sha256 === pending.value.currentSha256) return true
    requireValue(beforePublish.sha256 === pending.value.previousCurrentSha256 && beforePublish.value.registryRevision === pending.value.previousRegistryRevision,
      "registry_previous_current_changed_before_publish")
    requireRegistryDeadline(deadlineUnixMs)
    return false
  }
  const publicationDiagnostics = alreadyPublished ? (await recheckPublication(), null)
    : await publishCurrentBytes(projectRoot, stagedCurrent.bytes, { transactionId, deadlineUnixMs, beforeAtomicWrite, recheckPublication, _testHooks })
  invokeTransactionHook(_testHooks, "after_current_publish", { transactionId })
  const published = await readFile(resolveProjectPath(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH))
  requireValue(sha256Bytes(published) === pending.value.currentSha256, "registry_current_publish_hash_mismatch")
  verifyCommittedDatabaseRows(projectRoot, stagedCurrentValue, pending.value.currentSha256)
  await verifyRegistryEventBytes(projectRoot, stagedEventValue)
  await releaseWriterClaim(projectRoot, transactionId)
  const result = await readCurrentExecutionRegistry(projectRoot, { deadlineUnixMs })
  if (expiredActiveRecovery !== null) return { ...result, ok: false, status: "unknown_or_stale", publicationRecovered: true,
    recoveredRegistryRevision: stagedCurrentValue.registryRevision, recoveredRegistrySha256: pending.value.currentSha256,
    trainingContinuationAllowed: false, publicationDiagnostics }
  return publicationDiagnostics === null ? result : { ...result, publicationDiagnostics }
}

function trainingTerminalRunId(terminal) {
  if (terminal?.schemaVersion !== "ai-painter-learning-capacity-experiment-terminal-v1") return terminal?.runId
  // The isolated schema originally used experimentIdentity, not runId. Keep
  // immutable failed evidence readable without treating it as formal training.
  requireValue(typeof terminal.experimentIdentity === "string" && terminal.experimentIdentity.length > 0, "experiment_terminal_identity_invalid")
  requireValue(terminal.runId === undefined || terminal.runId === terminal.experimentIdentity, "experiment_terminal_identity_conflict")
  for (const flag of ["formalTrainingQualified", "formalStageAdvanced", "checkpointPromotable", "worldEntryAllowed"]) {
    requireValue(terminal[flag] === false, "experiment_terminal_formal_claim_forbidden")
  }
  requireValue(["experiment_completed_not_formal_qualified", "experiment_failed_closed"].includes(terminal.status), "experiment_terminal_status_invalid")
  requireValue(terminal.executionState === (terminal.status === "experiment_failed_closed" ? "failed_closed" : "completed"), "experiment_terminal_state_invalid")
  return terminal.experimentIdentity
}

async function readLatestTrainingTerminal(projectRoot, binding, archivedNamespaces) {
  if (binding === null || binding === undefined) return null
  requireValue(typeof binding.runId === "string" && binding.runId.length > 0, "latest_training_run_id_invalid")
  const terminal = await readRegistryBinding(projectRoot, binding, archivedNamespaces, "latest_training_terminal")
  requireValue(trainingTerminalRunId(terminal.value) === binding.runId, "latest_training_run_id_mismatch")
  requireValue(terminal.value?.status === binding.status, "latest_training_status_mismatch")
  const evidence = {}
  for (const [key, value] of Object.entries(binding.evidence ?? {})) {
    if (value === null) {
      evidence[key] = null
      continue
    }
    evidence[key] = (await readRegistryBinding(projectRoot, value, archivedNamespaces, `latest_training_${key}`)).value
  }
  return {
    runId: binding.runId,
    terminalPath: binding.path,
    terminal: terminal.value,
    statePath: binding.evidence?.executionState?.path ?? "",
    state: evidence.executionState ?? {},
    reviewPath: binding.evidence?.machineReview?.path ?? "",
    review: evidence.machineReview ?? null,
    reviewProgressPath: binding.evidence?.reviewProgress?.path ?? "",
    reviewProgress: evidence.reviewProgress ?? null,
    progressPath: binding.evidence?.trainingProgress?.path ?? "",
    progress: evidence.trainingProgress ?? null,
    occurredAtUtc:
      terminal.value?.recordedAtUtc ??
      evidence.executionState?.updatedAtUtc ??
      evidence.trainingProgress?.updatedAtUtc ??
      null,
  }
}

async function buildLatestTrainingBindings(projectRoot, latestTrainingRoot) {
  const candidates = {
    executionState: `${latestTrainingRoot}/execution-state.json`,
    machineReview: `${latestTrainingRoot}/machine-review.json`,
    reviewProgress: `${latestTrainingRoot}/review-progress.json`,
    trainingProgress: `${latestTrainingRoot}/training-output/progress.json`,
  }
  const evidence = {}
  for (const [key, relativePath] of Object.entries(candidates)) {
    const hash = await sha256File(projectRoot, relativePath).catch(() => null)
    evidence[key] = hash ? { path: relativePath, sha256: hash } : null
  }
  requireValue(evidence.executionState !== null, "latest_training_execution_state_missing")
  requireValue(evidence.machineReview !== null, "latest_training_machine_review_missing")
  requireValue(evidence.trainingProgress !== null, "latest_training_progress_missing")
  return { evidence }
}

function buildProjectedCurrentTaskCapsule({
  sourceCapsule,
  sourceTerminal,
  currentCandidate,
  latestTrainingTerminal,
  recordedAtUtc,
}) {
  const progress = sourceTerminal.value.fixedTotalProgress ?? {}
  const evidence = [
    evidenceRow("current_task_source_capsule", "当前规划任务胶囊", sourceCapsule),
    evidenceRow("current_task_terminal", "当前规划成功终态", sourceTerminal),
    evidenceRow("bounded_candidate", "有界候选结构", currentCandidate),
    evidenceRow("latest_training_terminal", "最近训练失败终态", latestTrainingTerminal),
  ]
  return {
    schemaVersion: CAPSULE_SCHEMA,
    capsuleId: `current-${sourceTerminal.value.planningRunId}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: {
      completedStages: progress.completedStages ?? null,
      totalStages: progress.totalStages ?? null,
      percent: progress.percent ?? null,
      source: "current_execution_registry",
    },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "Stage 0→1→2完整训练",
      status: "bounded_candidate_planned_cpu_implementation_pending",
    },
    candidateTerminal: {
      runId: sourceTerminal.value.planningRunId,
      status: "planned",
      programStatus: sourceTerminal.value.status,
      previewMachineStatus: null,
      modelQualificationStatus: "cpu_inactive_candidate_not_implemented",
      previewCount: null,
      previewPassCount: null,
      previewFailCount: null,
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc: sourceTerminal.value.recordedAtUtc ?? recordedAtUtc,
      recordedAtAsiaShanghai: asiaShanghaiTimestamp(sourceTerminal.value.recordedAtUtc ?? recordedAtUtc),
    },
    latestBlocker: {
      code: "current_candidate_cpu_implementation_pending",
      summaryZh: "最近Stage 0已真实视觉失败并关闭；本地程序已形成唯一有界候选，当前等待CPU未激活实现，不允许回退读取历史Smoke。",
    },
    nextAllowedAction: {
      code: sourceTerminal.value.nextAction,
      labelZh: "实施解码后完整条件道路与对象责任渲染器的CPU未激活支持，并完成正反合同回归。",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: [
      "read_archived_smoke_as_current",
      "reuse_failed_checkpoint",
      "start_gpu_before_cpu_contract",
      "start_stage1_or_stage2",
      "lower_machine_review_threshold",
    ],
    taskIdentity: {
      modelId: currentCandidate.value.selectedCandidate?.candidateKind ?? null,
      sampleId: "194",
      conditionLabel: "v7-complete-map-194",
      sampleSplit: "validation",
      seed: 20263722,
      requiredBoundarySides: ["west"],
    },
    evidence,
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_active",
    },
  }
}

function evidenceRow(kind, labelZh, binding) {
  return {
    kind,
    labelZh,
    path: binding.path,
    sha256: binding.sha256,
    expectedSha256: binding.sha256,
    sha256Verified: true,
    recordedAtUtc: binding.value?.recordedAtUtc ?? null,
    recordedAtAsiaShanghai: binding.value?.recordedAtUtc
      ? asiaShanghaiTimestamp(binding.value.recordedAtUtc)
      : null,
  }
}

async function verifyCapsuleEvidence(projectRoot, capsule, archivedNamespaces) {
  requireValue(Array.isArray(capsule.evidence) && capsule.evidence.length > 0, "current_task_capsule_evidence_missing")
  for (const evidence of capsule.evidence) {
    requireValue(evidence?.sha256Verified === true, "current_task_capsule_evidence_unverified")
    await readRegistryBinding(projectRoot, evidence, archivedNamespaces, `current_task_evidence_${evidence?.kind ?? "unknown"}`)
  }
}

async function readRegistryBinding(projectRoot, binding, archivedNamespaces, role) {
  requireValue(binding && typeof binding === "object", `${role}_binding_missing`)
  requireValue(typeof binding.path === "string" && binding.path.length > 0, `${role}_path_missing`)
  requireValue(typeof binding.sha256 === "string" && /^[a-f0-9]{64}$/.test(binding.sha256), `${role}_hash_invalid`)
  const relativePath = normalizeRelativePath(binding.path)
  rejectArchivedPath(relativePath, archivedNamespaces)
  const value = await readBoundJson(projectRoot, relativePath)
  requireValue(value.sha256 === binding.sha256, `${role}_hash_mismatch`)
  return value
}

function verifySqliteCommit(projectRoot, registry, currentSha256) {
  const databasePath = resolveProjectPath(projectRoot, `${CURRENT_EXECUTION_REGISTRY_ROOT}/registry.sqlite`)
  const database = new DatabaseSync(databasePath, { readOnly: true })
  try {
    const revision = database.prepare(`
      SELECT registry_revision, event_sequence, transaction_id, current_sha256
      FROM registry_revisions WHERE registry_revision = ?
    `).get(registry.registryRevision)
    const transaction = database.prepare(`
      SELECT transaction_id, status, current_sha256
      FROM registry_transactions WHERE transaction_id = ?
    `).get(registry.transactionId)
    requireValue(revision?.event_sequence === registry.eventSequence, "registry_sqlite_sequence_mismatch")
    requireValue(revision?.transaction_id === registry.transactionId, "registry_sqlite_transaction_mismatch")
    requireValue(revision?.current_sha256 === currentSha256, "registry_sqlite_current_hash_mismatch")
    requireValue(transaction?.status === "committed", "registry_sqlite_transaction_not_committed")
    requireValue(transaction?.current_sha256 === currentSha256, "registry_sqlite_transaction_hash_mismatch")
    const newer = database.prepare(`
      SELECT r.registry_revision FROM registry_revisions r
      JOIN registry_transactions t ON t.transaction_id = r.transaction_id
      WHERE t.status = 'committed' AND (r.registry_revision > ? OR r.event_sequence > ?) LIMIT 1
    `).get(registry.registryRevision, registry.eventSequence)
    requireValue(newer === undefined, "registry_current_behind_committed_revision")
  } finally {
    database.close()
  }
}

function verifyPreparedDatabaseRows(projectRoot, pending) {
  const database = new DatabaseSync(resolveProjectPath(projectRoot, `${CURRENT_EXECUTION_REGISTRY_ROOT}/registry.sqlite`), { readOnly: true })
  try {
    const transaction = database.prepare(`
      SELECT transaction_id, status, current_sha256
      FROM registry_transactions WHERE transaction_id = ?
    `).get(pending.transactionId)
    const revision = database.prepare(`
      SELECT registry_revision, event_sequence, transaction_id, current_sha256
      FROM registry_revisions WHERE registry_revision = ?
    `).get(pending.registryRevision)
    requireValue(["prepared", "committed"].includes(transaction?.status), "registry_prepared_database_transaction_missing")
    requireValue(transaction?.current_sha256 === pending.currentSha256, "registry_prepared_database_transaction_hash_mismatch")
    requireValue(revision?.event_sequence === pending.eventSequence, "registry_prepared_database_sequence_mismatch")
    requireValue(revision?.transaction_id === pending.transactionId, "registry_prepared_database_transaction_mismatch")
    requireValue(revision?.current_sha256 === pending.currentSha256, "registry_prepared_database_current_hash_mismatch")
  } finally {
    database.close()
  }
}

function stagedCurrentValueForDatabase(current) {
  return {
    taskId: current.taskId,
    runId: current.runId,
  }
}

function ensurePreparedDatabaseRows(projectRoot, pending, current, testHooks = null) {
  const database = new DatabaseSync(resolveProjectPath(projectRoot, `${CURRENT_EXECUTION_REGISTRY_ROOT}/registry.sqlite`))
  initializeDatabase(database)
  let transactionStarted = false
  try {
    invokeTransactionHook(testHooks, "before_prepare_database_begin", {
      transactionId: pending.transactionId,
    })
    database.exec("BEGIN IMMEDIATE")
    transactionStarted = true
    invokeTransactionHook(testHooks, "after_prepare_database_begin", {
      transactionId: pending.transactionId,
    })
    const transaction = database.prepare(`
      SELECT transaction_id, status, current_sha256
      FROM registry_transactions WHERE transaction_id = ?
    `).get(pending.transactionId)
    const revision = database.prepare(`
      SELECT registry_revision, event_sequence, transaction_id, current_sha256, task_id, run_id
      FROM registry_revisions WHERE registry_revision = ?
    `).get(pending.registryRevision)
    if (transaction) {
      requireValue(["prepared", "committed"].includes(transaction.status), "registry_prepared_database_transaction_status_invalid")
      requireValue(transaction.current_sha256 === pending.currentSha256, "registry_prepared_database_transaction_hash_mismatch")
    } else {
      database.prepare(`
        INSERT INTO registry_transactions
        (transaction_id, status, current_sha256, recorded_at_utc)
        VALUES (?, 'prepared', ?, ?)
      `).run(pending.transactionId, pending.currentSha256, pending.recordedAtUtc)
      invokeTransactionHook(testHooks, "after_prepare_transaction_insert", {
        transactionId: pending.transactionId,
      })
    }
    if (revision) {
      requireValue(revision.event_sequence === pending.eventSequence, "registry_prepared_database_sequence_mismatch")
      requireValue(revision.transaction_id === pending.transactionId, "registry_prepared_database_transaction_mismatch")
      requireValue(revision.current_sha256 === pending.currentSha256, "registry_prepared_database_current_hash_mismatch")
      requireValue(revision.task_id === current.taskId, "registry_prepared_database_task_mismatch")
      requireValue(revision.run_id === current.runId, "registry_prepared_database_run_mismatch")
    } else {
      const row = database.prepare("SELECT MAX(registry_revision) AS revision FROM registry_revisions").get()
      requireValue(row?.revision === pending.previousRegistryRevision, "registry_concurrent_revision_conflict")
      database.prepare(`
        INSERT INTO registry_revisions
        (registry_revision, event_sequence, transaction_id, current_sha256, task_id, run_id, recorded_at_utc)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        pending.registryRevision,
        pending.eventSequence,
        pending.transactionId,
        pending.currentSha256,
        current.taskId,
        current.runId,
        pending.recordedAtUtc,
      )
      invokeTransactionHook(testHooks, "after_prepare_revision_insert", {
        transactionId: pending.transactionId,
      })
    }
    invokeTransactionHook(testHooks, "before_prepare_database_commit", {
      transactionId: pending.transactionId,
    })
    database.exec("COMMIT")
    transactionStarted = false
  } catch (error) {
    if (transactionStarted) database.exec("ROLLBACK")
    throw error
  } finally {
    database.close()
  }
}

async function writeAbortedPrepareRecord(
  projectRoot,
  transactionRoot,
  transactionId,
  error,
) {
  const abortedPath = `${transactionRoot}/transaction.aborted.json`
  if (await fileExists(projectRoot, abortedPath)) return
  await writeExclusiveJson(projectRoot, abortedPath, {
    schemaVersion: REGISTRY_TRANSACTION_SCHEMA,
    transactionId,
    status: "aborted_before_durable_prepare",
    errorCode: error instanceof Error ? error.message : "registry_prepare_failed",
    abortedAtUtc: new Date().toISOString(),
  })
}

function commitPreparedDatabaseRows(projectRoot, pending) {
  const database = new DatabaseSync(resolveProjectPath(projectRoot, `${CURRENT_EXECUTION_REGISTRY_ROOT}/registry.sqlite`))
  initializeDatabase(database)
  database.exec("BEGIN IMMEDIATE")
  try {
    const transaction = database.prepare(`
      SELECT status, current_sha256 FROM registry_transactions WHERE transaction_id = ?
    `).get(pending.transactionId)
    requireValue(["prepared", "committed"].includes(transaction?.status), "registry_prepared_database_transaction_missing")
    requireValue(transaction?.current_sha256 === pending.currentSha256, "registry_prepared_database_transaction_hash_mismatch")
    if (transaction.status !== "committed") {
      database.prepare(`
        UPDATE registry_transactions SET status = 'committed' WHERE transaction_id = ?
      `).run(pending.transactionId)
    }
    database.exec("COMMIT")
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  } finally {
    database.close()
  }
}

function verifyCommittedDatabaseRows(projectRoot, registry, currentSha256) {
  verifySqliteCommit(projectRoot, registry, currentSha256)
}

async function verifyPublishedRegistryEvent(projectRoot, registry, currentSha256) {
  const eventsPath = resolveProjectPath(projectRoot, `${CURRENT_EXECUTION_REGISTRY_ROOT}/events.jsonl`)
  const bytes = await readFile(eventsPath)
  const events = parseCompleteJsonLines(bytes, "registry_event_log_invalid")
  requireValue(!events.some(event => event.registryRevision > registry.registryRevision || event.eventSequence > registry.eventSequence),
    "registry_current_behind_published_event")
  const matches = events.filter((event) => event.transactionId === registry.transactionId)
  requireValue(matches.length === 1, "registry_event_transaction_count_invalid")
  const event = matches[0]
  requireValue(event.registryRevision === registry.registryRevision, "registry_event_revision_mismatch")
  requireValue(event.eventSequence === registry.eventSequence, "registry_event_sequence_mismatch")
  requireValue(event.currentSha256 === currentSha256, "registry_event_current_hash_mismatch")
}

async function verifyRegistryEventBytes(projectRoot, expected) {
  const eventsPath = resolveProjectPath(projectRoot, `${CURRENT_EXECUTION_REGISTRY_ROOT}/events.jsonl`)
  const events = parseCompleteJsonLines(await readFile(eventsPath), "registry_event_log_invalid")
  const matches = events.filter((event) => event.transactionId === expected.transactionId)
  requireValue(matches.length === 1, "registry_event_transaction_count_invalid")
  requireValue(JSON.stringify(matches[0]) === JSON.stringify(expected), "registry_event_bytes_mismatch")
}

async function ensureAtomicJsonlEvent(projectRoot, relativePath, stagedBytes, transactionId, beforeAtomicWrite = null) {
  const absolutePath = resolveProjectPath(projectRoot, relativePath)
  const existing = await readFile(absolutePath).catch((error) => {
    if (error?.code === "ENOENT") return Buffer.alloc(0)
    throw error
  })
  const source = existing.toString("utf8").replace(/^\uFEFF/u, "")
  const endsWithNewline = source.length === 0 || source.endsWith("\n")
  const segments = source.split("\n")
  const fragment = endsWithNewline ? "" : segments.pop()
  if (endsWithNewline) segments.pop()
  const completeLines = segments.filter((line) => line.trim() !== "")
  const targetLine = stagedBytes.toString("utf8").trimEnd()
  const target = parseSingleJsonLine(stagedBytes, "registry_staged_event_invalid")
  const parsed = completeLines.map((line) => JSON.parse(line.replace(/^\uFEFF/u, "")))
  const matches = parsed.map((event, index) => ({ event, index })).filter(({ event }) => event.transactionId === transactionId)
  requireValue(matches.length <= 1, "registry_event_duplicate_transaction")
  if (matches.length === 1) {
    requireValue(completeLines[matches[0].index] === targetLine, "registry_event_existing_bytes_mismatch")
    if (fragment !== "") {
      requireValue(targetLine.startsWith(fragment), "registry_event_trailing_unrelated_partial")
      await writeAtomicReplaceBytes(
        projectRoot,
        relativePath,
        Buffer.from(`${completeLines.join("\n")}\n`, "utf8"),
        beforeAtomicWrite,
      )
    }
    return
  }
  if (fragment !== "") {
    requireValue(targetLine.startsWith(fragment), "registry_event_unrelated_partial_line")
  }
  const nextLines = [...completeLines, targetLine]
  await writeAtomicReplaceBytes(projectRoot, relativePath, Buffer.from(`${nextLines.join("\n")}\n`, "utf8"), beforeAtomicWrite)
  const after = parseCompleteJsonLines(await readFile(absolutePath), "registry_event_log_invalid")
  requireValue(after.filter((event) => event.transactionId === transactionId).length === 1, "registry_event_repair_failed")
  requireValue(JSON.stringify(after.find((event) => event.transactionId === transactionId)) === JSON.stringify(target), "registry_event_repair_bytes_mismatch")
}

function normalizeDependencyManifest(value) {
  if (value === null || value === undefined) {
    return {
      schemaVersion: REGISTRY_DEPENDENCY_SCHEMA,
      mode: "none",
      dependencies: [],
    }
  }
  requireValue(value?.schemaVersion === REGISTRY_DEPENDENCY_SCHEMA, "registry_dependency_manifest_schema_invalid")
  requireValue(value?.mode === "external", "registry_dependency_manifest_mode_invalid")
  requireValue(value.outerJournal && typeof value.outerJournal.path === "string", "registry_dependency_outer_journal_missing")
  requireValue(/^[a-f0-9]{64}$/u.test(value.outerJournal.sha256 ?? ""), "registry_dependency_outer_journal_hash_missing")
  requireValue(typeof value.outerJournal.requiredState === "string", "registry_dependency_outer_journal_state_missing")
  requireValue(typeof value.outerJournal.operationId === "string" && value.outerJournal.operationId.length > 0, "registry_dependency_outer_journal_operation_missing")
  requireValue(Array.isArray(value.bindings), "registry_dependency_bindings_missing")
  requireValue(value.programEvent && typeof value.programEvent.event === "object", "registry_dependency_program_event_missing")
  requireValue(value.programEvent.event.id === value.programEvent.eventId, "registry_dependency_program_event_identity_mismatch")
  requireValue(typeof value.programEvent.ledgerPath === "string", "registry_dependency_program_ledger_missing")
  requireValue(typeof value.programEvent.latestPath === "string", "registry_dependency_program_latest_missing")
  requireValue(typeof value.programEvent.catalogDatabasePath === "string", "registry_dependency_catalog_database_missing")
  requireValue(Array.isArray(value.catalogArtifacts), "registry_dependency_catalog_artifacts_missing")
  return JSON.parse(JSON.stringify(value))
}

async function verifyDependencyManifest(projectRoot, manifest) {
  if (manifest.mode === "none") {
    requireValue(Array.isArray(manifest.dependencies) && manifest.dependencies.length === 0, "registry_dependency_none_not_empty")
    return { status: "verified", mode: "none", dependencyCount: 0 }
  }
  requireValue(manifest.mode === "external", "registry_dependency_manifest_mode_invalid")
  const outerJournal = await readBoundJson(projectRoot, manifest.outerJournal.path)
  requireValue(outerJournal.sha256 === manifest.outerJournal.sha256, "registry_dependency_outer_journal_hash_mismatch")
  requireValue(outerJournal.value?.state === manifest.outerJournal.requiredState, "registry_dependency_outer_journal_incomplete")
  requireValue(outerJournal.value?.operationId === manifest.outerJournal.operationId, "registry_dependency_outer_journal_operation_mismatch")
  for (const binding of manifest.bindings) await readRawBinding(projectRoot, binding, `registry_dependency_${binding.role ?? "binding"}`)

  const expectedEvent = manifest.programEvent.event
  const ledgerBytes = await readFile(resolveProjectPath(projectRoot, manifest.programEvent.ledgerPath))
  const ledgerEvents = parseCompleteJsonLines(ledgerBytes, "registry_dependency_program_ledger_invalid")
  const ledgerMatches = ledgerEvents.filter((event) => event.id === manifest.programEvent.eventId)
  requireValue(ledgerMatches.length === 1, "registry_dependency_program_event_count_invalid")
  requireValue(JSON.stringify(ledgerMatches[0]) === JSON.stringify(expectedEvent), "registry_dependency_program_event_mismatch")
  const latest = await readBoundJson(projectRoot, manifest.programEvent.latestPath)
  const latestMatches = (latest.value?.events ?? []).filter((event) => event.id === manifest.programEvent.eventId)
  requireValue(latestMatches.length === 1, "registry_dependency_latest_event_count_invalid")
  requireValue(JSON.stringify(latestMatches[0]) === JSON.stringify(expectedEvent), "registry_dependency_latest_event_mismatch")

  const catalog = new DatabaseSync(
    resolveTrustedCatalogDatabasePath(projectRoot, manifest.programEvent.catalogDatabasePath),
    { readOnly: true },
  )
  try {
    const row = catalog.prepare("SELECT event_json FROM program_events WHERE event_id = ?").get(manifest.programEvent.eventId)
    requireValue(typeof row?.event_json === "string", "registry_dependency_catalog_program_event_missing")
    requireValue(JSON.stringify(JSON.parse(row.event_json)) === JSON.stringify(expectedEvent), "registry_dependency_catalog_program_event_mismatch")
    for (const artifact of manifest.catalogArtifacts) {
      const indexed = catalog.prepare("SELECT sha256 FROM artifacts WHERE logical_path = ?").get(artifact.logicalPath)
      requireValue(indexed?.sha256 === artifact.sha256, "registry_dependency_catalog_artifact_mismatch")
    }
  } finally {
    catalog.close()
  }
  return {
    status: "verified",
    mode: "external",
    dependencyCount: manifest.bindings.length + manifest.catalogArtifacts.length + 4,
    programEventId: manifest.programEvent.eventId,
  }
}

function initializeDatabase(database) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS registry_transactions (
      transaction_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      current_sha256 TEXT NOT NULL,
      recorded_at_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS registry_revisions (
      registry_revision INTEGER PRIMARY KEY,
      event_sequence INTEGER NOT NULL UNIQUE,
      transaction_id TEXT NOT NULL UNIQUE,
      current_sha256 TEXT NOT NULL,
      task_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      recorded_at_utc TEXT NOT NULL
    );
  `)
}

async function readBoundJson(projectRoot, relativePath) {
  const normalized = normalizeRelativePath(relativePath)
  const bytes = await readFile(resolveProjectPath(projectRoot, normalized))
  return {
    path: normalized,
    sha256: sha256Bytes(bytes),
    value: JSON.parse(bytes.toString("utf8")),
  }
}

async function sha256File(projectRoot, relativePath) {
  const bytes = await readFile(resolveProjectPath(projectRoot, normalizeRelativePath(relativePath)))
  return sha256Bytes(bytes)
}

async function readRawBinding(projectRoot, binding, role) {
  requireValue(binding && typeof binding === "object", `${role}_binding_missing`)
  requireValue(typeof binding.path === "string" && binding.path.length > 0, `${role}_path_missing`)
  requireValue(typeof binding.sha256 === "string" && /^[a-f0-9]{64}$/.test(binding.sha256), `${role}_hash_invalid`)
  const normalized = normalizeRelativePath(binding.path)
  const bytes = await readFile(resolveProjectPath(projectRoot, normalized))
  requireValue(sha256Bytes(bytes) === binding.sha256, `${role}_hash_mismatch`)
  return { path: normalized, sha256: binding.sha256, bytes }
}

async function readRegistryBindingWithoutArchive(projectRoot, binding, role) {
  const raw = await readRawBinding(projectRoot, binding, role)
  return { ...raw, value: JSON.parse(raw.bytes.toString("utf8")) }
}

function parseSingleJsonLine(bytes, code) {
  const source = bytes.toString("utf8").replace(/^\uFEFF/u, "")
  requireValue(source.endsWith("\n"), code)
  const lines = source.split(/\r?\n/u).filter((line) => line !== "")
  requireValue(lines.length === 1, code)
  return JSON.parse(lines[0])
}

function parseCompleteJsonLines(bytes, code) {
  const source = bytes.toString("utf8").replace(/^\uFEFF/u, "")
  requireValue(source === "" || source.endsWith("\n"), code)
  try {
    return source.split(/\r?\n/u).filter((line) => line !== "").map((line) => JSON.parse(line))
  } catch {
    throw new Error(code)
  }
}

function isTerminalExecutionState(value) {
  return typeof value === "string" && TERMINAL_EXECUTION_STATES.has(value)
}

async function verifyStoredActiveExecution(
  projectRoot,
  registry,
  archivedNamespaces,
  expiredActiveRecovery = null,
  deadlineUnixMs = null,
) {
  if (expiredActiveRecovery !== null) {
    requirePlainObject(expiredActiveRecovery, "registry_expired_active_recovery_invalid")
    requireValue(registry.activeExecution !== null && registry.activeExecution !== undefined, "registry_expired_active_recovery_missing")
    requireValue(
      registry.capabilityVersion === expiredActiveRecovery.capabilityVersion,
      "registry_expired_active_recovery_capability_mismatch",
    )
    requireValue(
      registry.packageId === expiredActiveRecovery.packageId,
      "registry_expired_active_recovery_package_mismatch",
    )
    requireValue(
      registry.runId === expiredActiveRecovery.runId,
      "registry_expired_active_recovery_run_mismatch",
    )
  }
  const normalized = await normalizeAndVerifyActiveExecution({
    projectRoot,
    activeExecution: registry.activeExecution ?? null,
    capabilityVersion: registry.capabilityVersion,
    packageId: registry.packageId,
    runId: registry.runId,
    executionState: registry.executionState,
    archivedNamespaces,
    expiredActiveRecovery,
    deadlineUnixMs,
  })
  if (normalized === null) {
    requireValue(!ACTIVE_EXECUTION_STATES.has(registry.executionState), "registry_active_execution_missing")
    return
  }
  requireValue(registry.queueStatus === "running", "registry_active_execution_queue_status_invalid")
  requireValue(registry.nextMachineAction === null, "registry_active_execution_next_action_forbidden")
  requireValue(
    JSON.stringify(normalized) === JSON.stringify(registry.activeExecution),
    "registry_active_execution_not_canonical",
  )
}

async function normalizeAndVerifyActiveExecution({
  projectRoot,
  activeExecution,
  capabilityVersion,
  packageId,
  runId,
  executionState,
  archivedNamespaces,
  expiredActiveRecovery = null,
  deadlineUnixMs = null,
}) {
  if (activeExecution === null) return null
  const kernelContext = expiredActiveRecovery?.kernelInterruption ?? null
  const historicalContext = expiredActiveRecovery?.historicalSources ?? null
  requireValue(historicalContext === null || VERIFIED_HISTORICAL_SOURCE_CONTEXTS.has(historicalContext), "registry_historical_source_context_untrusted")
  const historicalBindings = historicalContext === null ? null : await historicalContext.recheck()
  requireValue(kernelContext === null || VERIFIED_KERNEL_INTERRUPTION_CONTEXTS.has(kernelContext), 'registry_kernel_interruption_context_untrusted')
  const kernelProof = kernelContext?.recheck() ?? null
  requirePlainObject(activeExecution, "registry_active_execution_invalid")
  requireExactKeys(activeExecution, [
    "schemaVersion",
    "capabilityVersion",
    "packageId",
    "runId",
    "executionState",
    "processId",
    "processStartIdentity",
    "programLineage",
    "lock",
    "heartbeat",
  ], "registry_active_execution_fields_invalid")
  requireValue(activeExecution.schemaVersion === ACTIVE_EXECUTION_SCHEMA, "registry_active_execution_schema_invalid")
  requireValue(activeExecution.capabilityVersion === capabilityVersion, "registry_active_execution_capability_mismatch")
  requireValue(activeExecution.packageId === packageId, "registry_active_execution_package_mismatch")
  requireValue(activeExecution.runId === runId, "registry_active_execution_run_mismatch")
  requireValue(activeExecution.executionState === executionState, "registry_active_execution_state_mismatch")
  requireValue(ACTIVE_EXECUTION_STATES.has(activeExecution.executionState), "registry_active_execution_state_invalid")
  requireValue(
    Number.isInteger(activeExecution.processId)
      && activeExecution.processId > 0
      && activeExecution.processId <= 0x7fffffff,
    "registry_active_execution_pid_invalid",
  )
  requireValue(
    typeof activeExecution.processStartIdentity === "string"
      && activeExecution.processStartIdentity === activeExecution.processStartIdentity.trim()
      && activeExecution.processStartIdentity.length > 0
      && activeExecution.processStartIdentity.length <= 1024,
    "registry_active_execution_process_start_invalid",
  )
  const processProbe = typeof expiredActiveRecovery?.processProbe === "function"
    ? expiredActiveRecovery.processProbe(activeExecution)
    : queryProcessIdentity(activeExecution.processId, deadlineUnixMs)
  requireValue(
    processProbe.status !== "indeterminate",
    "registry_active_execution_process_identity_unavailable",
  )
  if (expiredActiveRecovery === null) {
    requireValue(processProbe.status === "active", "registry_active_execution_process_not_active")
    requireValue(
      processProbe.identity === activeExecution.processStartIdentity,
      "registry_active_execution_process_start_identity_mismatch",
    )
  } else {
    requireValue(
      processProbe.status === "dead"
        || (processProbe.status === "active"
          && processProbe.identity !== activeExecution.processStartIdentity),
      "registry_expired_active_recovery_process_still_active",
    )
  }

  const normalizedProgramLineage = {}
  requirePlainObject(activeExecution.programLineage, "registry_active_execution_program_lineage_invalid")
  const lineageEntries = Object.entries(activeExecution.programLineage)
  requireValue(lineageEntries.length > 0, "registry_active_execution_program_lineage_missing")
  for (const [role, binding] of lineageEntries) {
    requireValue(/^[A-Za-z0-9._-]{1,80}$/u.test(role), "registry_active_execution_program_role_invalid")
    requireValue(!["__proto__", "prototype", "constructor"].includes(role), "registry_active_execution_program_role_invalid")
    requirePlainObject(binding, `registry_active_execution_program_${role}_binding_invalid`)
    requireExactKeys(binding, ["path", "sha256"], `registry_active_execution_program_${role}_fields_invalid`)
    const normalizedPath = normalizeRelativePath(binding.path)
    rejectArchivedPath(normalizedPath, archivedNamespaces)
    const verified = historicalBindings !== null
      ? historicalBindings.get(normalizedPath)
      : kernelProof === null ? await readRawBinding(projectRoot, binding, `registry_active_execution_program_${role}`)
        : kernelProof.historical.readProgramBinding(binding)
    requireValue(verified?.path === normalizedPath && verified.sha256 === binding.sha256, "registry_historical_program_binding_mismatch")
    normalizedProgramLineage[role] = { path: verified.path, sha256: verified.sha256 }
  }

  requirePlainObject(activeExecution.lock, "registry_active_execution_lock_binding_invalid")
  requireExactKeys(activeExecution.lock, ["path", "sha256"], "registry_active_execution_lock_fields_invalid")
  const lockPath = normalizeRelativePath(activeExecution.lock.path)
  rejectArchivedPath(lockPath, archivedNamespaces)
  const lock = await readRegistryBinding(
    projectRoot,
    activeExecution.lock,
    archivedNamespaces,
    "registry_active_execution_lock",
  )
  requireExactKeys(lock.value, [
    "schemaVersion",
    "capabilityVersion",
    "packageId",
    "runId",
    "processId",
    "processStartIdentity",
  ], "registry_active_execution_lock_record_fields_invalid")
  requireValue(lock.value?.schemaVersion === ACTIVE_EXECUTION_LOCK_SCHEMA, "registry_active_execution_lock_schema_invalid")
  verifyActiveExecutionIdentityRecord(lock.value, activeExecution, "registry_active_execution_lock")

  requirePlainObject(activeExecution.heartbeat, "registry_active_execution_heartbeat_binding_invalid")
  requireExactKeys(activeExecution.heartbeat, ["path", "ttlSeconds"], "registry_active_execution_heartbeat_fields_invalid")
  const heartbeatPath = normalizeRelativePath(activeExecution.heartbeat.path)
  rejectArchivedPath(heartbeatPath, archivedNamespaces)
  requireValue(heartbeatPath !== lockPath, "registry_active_execution_lock_heartbeat_path_collision")
  requireValue(
    Number.isInteger(activeExecution.heartbeat.ttlSeconds)
      && activeExecution.heartbeat.ttlSeconds >= ACTIVE_EXECUTION_HEARTBEAT_MIN_TTL_SECONDS
      && activeExecution.heartbeat.ttlSeconds <= ACTIVE_EXECUTION_HEARTBEAT_MAX_TTL_SECONDS,
    "registry_active_execution_heartbeat_ttl_invalid",
  )
  if (kernelProof !== null) {
    requireValue(kernelProof.historical.inputs.heartbeat.path === heartbeatPath
      && JSON.stringify(kernelProof.historical.registry.activeExecution) === JSON.stringify(activeExecution), 'registry_kernel_interruption_active_mismatch')
    return {
      schemaVersion: ACTIVE_EXECUTION_SCHEMA, capabilityVersion, packageId, runId, executionState,
      processId: activeExecution.processId, processStartIdentity: activeExecution.processStartIdentity,
      programLineage: normalizedProgramLineage, lock: { path: lockPath, sha256: lock.sha256 },
      heartbeat: { path: heartbeatPath, ttlSeconds: activeExecution.heartbeat.ttlSeconds },
    }
  }
  const heartbeat = await readBoundJson(projectRoot, heartbeatPath)
  requireExactKeys(heartbeat.value, [
    "schemaVersion",
    "capabilityVersion",
    "packageId",
    "runId",
    "executionState",
    "processId",
    "processStartIdentity",
    "heartbeatAtUtc",
    "ttlSeconds",
  ], "registry_active_execution_heartbeat_record_fields_invalid")
  requireValue(
    heartbeat.value?.schemaVersion === ACTIVE_EXECUTION_HEARTBEAT_SCHEMA,
    "registry_active_execution_heartbeat_schema_invalid",
  )
  verifyActiveExecutionIdentityRecord(heartbeat.value, activeExecution, "registry_active_execution_heartbeat")
  requireValue(
    heartbeat.value.executionState === activeExecution.executionState,
    "registry_active_execution_heartbeat_state_mismatch",
  )
  requireValue(
    heartbeat.value.ttlSeconds === activeExecution.heartbeat.ttlSeconds,
    "registry_active_execution_heartbeat_ttl_mismatch",
  )
  requireValue(
    typeof heartbeat.value.heartbeatAtUtc === "string"
      && heartbeat.value.heartbeatAtUtc.endsWith("Z")
      && Number.isFinite(Date.parse(heartbeat.value.heartbeatAtUtc)),
    "registry_active_execution_heartbeat_timestamp_invalid",
  )
  const heartbeatAgeMs = Date.now() - Date.parse(heartbeat.value.heartbeatAtUtc)
  requireValue(
    heartbeatAgeMs >= -ACTIVE_EXECUTION_HEARTBEAT_MAX_FUTURE_SKEW_MS,
    "registry_active_execution_heartbeat_from_future",
  )
  if (expiredActiveRecovery === null) {
    requireValue(
      heartbeatAgeMs <= activeExecution.heartbeat.ttlSeconds * 1000,
      "registry_active_execution_heartbeat_expired",
    )
  } else {
    requireValue(
      heartbeatAgeMs > activeExecution.heartbeat.ttlSeconds * 1000,
      "registry_expired_active_recovery_heartbeat_not_expired",
    )
  }

  return {
    schemaVersion: ACTIVE_EXECUTION_SCHEMA,
    capabilityVersion,
    packageId,
    runId,
    executionState,
    processId: activeExecution.processId,
    processStartIdentity: activeExecution.processStartIdentity,
    programLineage: normalizedProgramLineage,
    lock: { path: lockPath, sha256: lock.sha256 },
    heartbeat: {
      path: heartbeatPath,
      ttlSeconds: activeExecution.heartbeat.ttlSeconds,
    },
  }
}

function verifyActiveExecutionIdentityRecord(record, activeExecution, codePrefix) {
  requireValue(record.capabilityVersion === activeExecution.capabilityVersion, `${codePrefix}_capability_mismatch`)
  requireValue(record.packageId === activeExecution.packageId, `${codePrefix}_package_mismatch`)
  requireValue(record.runId === activeExecution.runId, `${codePrefix}_run_mismatch`)
  requireValue(record.processId === activeExecution.processId, `${codePrefix}_pid_mismatch`)
  requireValue(
    record.processStartIdentity === activeExecution.processStartIdentity,
    `${codePrefix}_process_start_mismatch`,
  )
}

function requirePlainObject(value, code) {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), code)
}

function requireExactKeys(value, expectedKeys, code) {
  requirePlainObject(value, code)
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  requireValue(actual.length === expected.length && actual.every((key, index) => key === expected[index]), code)
}

function normalizeTaskControlMetadata({
  taskId,
  taskKind,
  taskGoal,
  priority,
  queueStatus,
  nextMachineAction,
  queuedAtUtc,
  executionState,
  activity,
}) {
  const normalizedGoal = taskGoal === null
    ? `Execute ${taskKind} task ${taskId} within the bound AI Painter capability lifecycle.`
    : taskGoal
  requireValue(
    typeof normalizedGoal === "string" && normalizedGoal.trim().length >= 4 && normalizedGoal.length <= 2000,
    "registry_task_goal_invalid",
  )
  const normalizedPriority = priority === null ? 5 : priority
  requireValue(
    Number.isInteger(normalizedPriority) && normalizedPriority >= 1 && normalizedPriority <= 9,
    "registry_task_priority_invalid",
  )
  const inferredQueueStatus = executionState === "package_materialized"
    ? "ready"
    : executionState === "failed_closed"
      ? "failed_closed"
      : executionState === "blocked_policy_boundary"
        ? "blocked_policy_boundary"
        : activity === "running"
          ? "running"
          : "completed"
  const normalizedQueueStatus = queueStatus === null ? inferredQueueStatus : queueStatus
  requireValue(
    ["ready", "running", "completed", "failed_closed", "blocked_policy_boundary"].includes(normalizedQueueStatus),
    "registry_task_queue_status_invalid",
  )
  const normalizedNextMachineAction = nextMachineAction === undefined
    ? (normalizedQueueStatus === "ready" ? taskId : null)
    : nextMachineAction
  requireValue(
    normalizedNextMachineAction === null
      || (typeof normalizedNextMachineAction === "string" && normalizedNextMachineAction.length > 0),
    "registry_next_machine_action_invalid",
  )
  requireValue(
    normalizedQueueStatus !== "ready" || normalizedNextMachineAction !== null,
    "registry_ready_task_next_machine_action_missing",
  )
  const normalizedQueuedAtUtc = queuedAtUtc === null ? new Date().toISOString() : queuedAtUtc
  requireValue(
    typeof normalizedQueuedAtUtc === "string"
      && Number.isFinite(Date.parse(normalizedQueuedAtUtc))
      && normalizedQueuedAtUtc.endsWith("Z"),
    "registry_task_queued_at_utc_invalid",
  )
  return {
    taskGoal: normalizedGoal.trim(),
    priority: normalizedPriority,
    queueStatus: normalizedQueueStatus,
    nextMachineAction: normalizedNextMachineAction,
    queuedAtUtc: normalizedQueuedAtUtc,
  }
}

function verifyTaskControlMetadataIfPresent(registry) {
  const fields = ["taskGoal", "priority", "queueStatus", "nextMachineAction", "queuedAtUtc"]
  if (fields.every((field) => !Object.prototype.hasOwnProperty.call(registry, field))) return
  requireValue(fields.every((field) => Object.prototype.hasOwnProperty.call(registry, field)), "registry_task_control_metadata_incomplete")
  const normalized = normalizeTaskControlMetadata({
    taskId: registry.taskId,
    taskKind: registry.taskKind,
    taskGoal: registry.taskGoal,
    priority: registry.priority,
    queueStatus: registry.queueStatus,
    nextMachineAction: registry.nextMachineAction,
    queuedAtUtc: registry.queuedAtUtc,
    executionState: registry.executionState,
    activity: registry.activity,
  })
  requireValue(normalized.taskGoal === registry.taskGoal, "registry_task_goal_not_normalized")
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function normalizeArchivedNamespaces(value) {
  const raw = Array.isArray(value) ? value : []
  return raw.map((item) =>
    normalizeRelativePath(typeof item === "string" ? item : item?.path),
  )
}

function rejectArchivedPath(relativePath, archivedNamespaces) {
  for (const archivePath of archivedNamespaces) {
    if (relativePath === archivePath || relativePath.startsWith(`${archivePath}/`)) {
      throw new Error("archived_evidence_forbidden_in_current_projection")
    }
  }
}

function normalizeRelativePath(value) {
  requireValue(typeof value === "string" && value.length > 0, "project_relative_path_missing")
  const candidate = value.replaceAll("\\", "/")
  requireValue(!path.posix.isAbsolute(candidate) && !/^[A-Za-z]:\//.test(candidate), "absolute_path_forbidden")
  const normalized = path.posix.normalize(candidate)
  requireValue(normalized !== ".." && !normalized.startsWith("../"), "parent_path_forbidden")
  return normalized
}

function resolveProjectPath(projectRoot, relativePath) {
  const normalized = normalizeRelativePath(relativePath)
  const absoluteRoot = path.resolve(projectRoot)
  const absolutePath = path.resolve(absoluteRoot, ...normalized.split("/"))
  const relative = path.relative(absoluteRoot, absolutePath)
  requireValue(relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), "project_boundary_violation")
  return absolutePath
}

function resolveTrustedCatalogDatabasePath(projectRoot, value) {
  requireValue(typeof value === "string" && value.length > 0, "registry_dependency_catalog_database_missing")
  if (!path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/u.test(value)) {
    return resolveProjectPath(projectRoot, value)
  }
  const configuredDataRoot = path.resolve(
    process.env.AI_PET_WORLD_DATA_ROOT
      ?? (process.platform === "win32"
        ? "D:\\AI-PET-WORLD-DATA"
        : path.join(path.resolve(projectRoot), ".ai-pet-world-data")),
  )
  const expected = path.resolve(configuredDataRoot, "catalog", "ai-pet-world-catalog.sqlite")
  const actual = path.resolve(value)
  const samePath = process.platform === "win32"
    ? actual.toLowerCase() === expected.toLowerCase()
    : actual === expected
  requireValue(samePath, "registry_dependency_catalog_database_untrusted")
  return actual
}

async function writeExclusiveJson(projectRoot, relativePath, value) {
  const absolutePath = resolveProjectPath(projectRoot, relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, jsonBytes(value), { flag: "wx" })
  fsyncFile(absolutePath)
}

async function writeExclusiveBytes(projectRoot, relativePath, bytes) {
  const absolutePath = resolveProjectPath(projectRoot, relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, bytes, { flag: "wx" })
  fsyncFile(absolutePath)
}

async function acquireWriterClaim(projectRoot, claim) {
  const absolutePath = resolveProjectPath(projectRoot, REGISTRY_WRITER_CLAIM_PATH)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  try {
    await writeFile(absolutePath, jsonBytes(claim), { flag: "wx" })
    fsyncFile(absolutePath)
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("registry_global_writer_claim_conflict")
    throw error
  }
}

async function readWriterClaim(projectRoot) {
  const claim = await readBoundJson(projectRoot, REGISTRY_WRITER_CLAIM_PATH)
  requireValue(claim.value?.schemaVersion === "ai-painter-current-execution-registry-writer-claim-v1", "registry_writer_claim_schema_invalid")
  requireSafeTransactionId(claim.value.transactionId)
  requireValue(Number.isInteger(claim.value.processId) && claim.value.processId > 0, "registry_writer_claim_pid_invalid")
  requireValue(typeof claim.value.processStartIdentity === "string" && claim.value.processStartIdentity.length > 0, "registry_writer_claim_process_identity_invalid")
  return claim.value
}

async function releaseWriterClaim(projectRoot, transactionId) {
  const claim = await readWriterClaim(projectRoot)
  requireValue(claim.transactionId === transactionId, "registry_writer_claim_transaction_mismatch")
  await unlink(resolveProjectPath(projectRoot, REGISTRY_WRITER_CLAIM_PATH))
}

function resolveCurrentProcessIdentity(testHooks, deadlineUnixMs = null) {
  if (typeof testHooks?.currentProcessIdentity === "string") return testHooks.currentProcessIdentity
  const probe = queryProcessIdentity(process.pid, deadlineUnixMs)
  requireValue(probe.status === "active", "registry_current_process_identity_unavailable")
  return probe.identity
}

function probeClaimProcess(claim, testHooks, deadlineUnixMs = null) {
  if (typeof testHooks?.probeClaimProcess === "function") return testHooks.probeClaimProcess(claim)
  const probe = queryProcessIdentity(claim.processId, deadlineUnixMs)
  if (probe.status === "indeterminate") return probe
  if (probe.status === "dead") return probe
  return {
    status: probe.identity === claim.processStartIdentity ? "active" : "dead",
    identity: probe.identity,
  }
}

function queryProcessIdentity(processId, deadlineUnixMs = null) {
  const timeout = requireRegistryDeadline(deadlineUnixMs)
  try {
    if (process.platform === "win32") {
      const script = [
        "$ErrorActionPreference='Stop'",
        `$p=Get-CimInstance -ClassName Win32_Process -Filter \"ProcessId = ${processId}\" -ErrorAction Stop`,
        "if ($null -eq $p) { exit 3 }",
        "$o=[pscustomobject]@{ processId=[int]$p.ProcessId; creationDate=$p.CreationDate.ToUniversalTime().ToString('o') }",
        "ConvertTo-Json -InputObject $o -Compress",
      ].join("; ")
      const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
        encoding: "utf8",
        windowsHide: true,
        timeout,
      })
      if (result.status === 3) return { status: "dead" }
      if (result.error || result.status !== 0) return { status: "indeterminate" }
      const value = JSON.parse(String(result.stdout).replace(/^\uFEFF/u, ""))
      if (Number(value.processId) !== processId || typeof value.creationDate !== "string") return { status: "indeterminate" }
      return { status: "active", identity: `${processId}:${value.creationDate}` }
    }
    const result = spawnSync("ps", ["-o", "lstart=", "-p", String(processId)], {
      encoding: "utf8",
      timeout,
    })
    if (result.status === 1 || String(result.stdout).trim() === "") return { status: "dead" }
    if (result.error || result.status !== 0) return { status: "indeterminate" }
    return { status: "active", identity: `${processId}:${String(result.stdout).trim()}` }
  } catch {
    return { status: "indeterminate" }
  }
}

function requireSafeTransactionId(value) {
  requireValue(typeof value === "string" && /^current-execution-registry-[a-z0-9-]+$/u.test(value), "registry_transaction_id_invalid")
}

function invokeTransactionHook(testHooks, point, detail) {
  if (typeof testHooks?.onTransactionPoint === "function") testHooks.onTransactionPoint(point, detail)
}

async function fileExists(projectRoot, relativePath) {
  return readFile(resolveProjectPath(projectRoot, relativePath)).then(() => true, (error) => {
    if (error?.code === "ENOENT") return false
    throw error
  })
}

async function writeAtomicExclusiveBytes(projectRoot, relativePath, bytes) {
  const absolutePath = resolveProjectPath(projectRoot, relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  const temporaryPath = `${absolutePath}.tmp-${process.pid}-${randomUUID()}`
  await writeFile(temporaryPath, bytes, { flag: "wx" })
  fsyncFile(temporaryPath)
  try {
    // A same-directory hard link publishes the prepared bytes atomically and
    // fails when the destination already exists. This prevents a concurrent
    // writer from overwriting the current registry revision.
    await link(temporaryPath, absolutePath)
    fsyncFile(absolutePath)
  } finally {
    await unlink(temporaryPath).catch(() => undefined)
  }
}

async function verifyCommittedHistoricalTransaction(projectRoot, registry, currentSha256) {
  const committed = await readBoundJson(projectRoot, `${CURRENT_EXECUTION_REGISTRY_ROOT}/transactions/${registry.transactionId}/transaction.json`)
  requireValue(committed.value.schemaVersion === REGISTRY_TRANSACTION_SCHEMA && committed.value.status === "committed"
    && committed.value.transactionId === registry.transactionId && committed.value.registryRevision === registry.registryRevision
    && committed.value.eventSequence === registry.eventSequence && committed.value.currentSha256 === currentSha256,
  "registry_recovery_committed_transaction_mismatch")
  verifySqliteCommit(projectRoot, registry, currentSha256)
  await verifyPublishedRegistryEvent(projectRoot, registry, currentSha256)
}

async function readHistoricalBinding(projectRoot, binding, deadlineUnixMs, remainingBytes = 1024 * 1024) {
  requireRegistryDeadline(deadlineUnixMs)
  requireExactKeys(binding, ["path", "sha256"], "registry_historical_binding_fields_invalid")
  requireValue(typeof binding.sha256 === "string" && /^[a-f0-9]{64}$/u.test(binding.sha256), "registry_historical_binding_hash_invalid")
  const file = await open(resolveProjectPath(projectRoot, normalizeRelativePath(binding.path)), "r")
  try {
    const info = await file.stat()
    requireValue(info.isFile() && info.size <= 1024 * 1024, "registry_historical_file_size_exceeded")
    requireValue(info.size <= remainingBytes, "registry_historical_total_size_exceeded")
    const buffer = Buffer.alloc(info.size + 1)
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0)
    requireValue(bytesRead === info.size && (await file.stat()).size === info.size, "registry_historical_file_size_changed")
    const bytes = buffer.subarray(0, bytesRead)
    requireValue(sha256Bytes(bytes) === binding.sha256, "registry_historical_snapshot_hash_mismatch")
    requireRegistryDeadline(deadlineUnixMs)
    return bytes
  } finally { await file.close() }
}

async function verifyHistoricalSources(projectRoot, registry, currentSha256, manifestBinding, deadlineUnixMs) {
  requireValue(registry.activeExecution != null, "registry_historical_active_missing")
  await verifyCommittedHistoricalTransaction(projectRoot, registry, currentSha256)
  const recheck = async () => {
    const value = JSON.parse((await readHistoricalBinding(projectRoot, manifestBinding, deadlineUnixMs)).toString("utf8"))
    requireExactKeys(value, ["schemaVersion", "transactionId", "registryRevision", "currentSha256", "capabilityVersion", "packageId", "runId", "sources"], "registry_historical_sources_fields_invalid")
    requireValue(value.schemaVersion === "ai-painter-registry-historical-sources-v1", "registry_historical_sources_schema_invalid")
    for (const key of ["transactionId", "registryRevision", "capabilityVersion", "packageId", "runId"])
      requireValue(value[key] === registry[key], `registry_historical_sources_${key}_mismatch`)
    requireValue(value.currentSha256 === currentSha256, "registry_historical_sources_current_hash_mismatch")
    const expected = new Map()
    for (const binding of Object.values(registry.activeExecution.programLineage)) {
      const logical = normalizeRelativePath(binding.path)
      requireValue(!expected.has(logical) || expected.get(logical) === binding.sha256, "registry_historical_source_identity_conflict")
      expected.set(logical, binding.sha256)
    }
    requireValue(Array.isArray(value.sources) && value.sources.length > 0 && value.sources.length <= 256
      && value.sources.length === expected.size, "registry_historical_source_count_mismatch")
    const verified = new Map()
    let totalBytes = 0
    for (const source of value.sources) {
      requireExactKeys(source, ["path", "sha256", "snapshot"], "registry_historical_source_fields_invalid")
      requireExactKeys(source.snapshot, ["path", "sha256"], "registry_historical_snapshot_fields_invalid")
      const logical = normalizeRelativePath(source.path)
      requireValue(!verified.has(logical) && expected.get(logical) === source.sha256 && source.snapshot.sha256 === source.sha256,
        "registry_historical_source_identity_mismatch")
      requireValue(normalizeRelativePath(source.snapshot.path).startsWith(".runtime/ai-painter/controller-repair-reviews/"), "registry_historical_snapshot_namespace_invalid")
      totalBytes += (await readHistoricalBinding(projectRoot, source.snapshot, deadlineUnixMs, 16 * 1024 * 1024 - totalBytes)).length
      requireValue(totalBytes <= 16 * 1024 * 1024, "registry_historical_total_size_exceeded")
      verified.set(logical, { path: logical, sha256: source.sha256 })
    }
    return verified
  }
  await recheck()
  const context = { recheck }
  VERIFIED_HISTORICAL_SOURCE_CONTEXTS.add(context)
  return context
}

// Retry only the final current pointer publication. Event/dependency writes do
// not inherit this behavior, and the original absolute deadline never moves.
async function publishCurrentBytes(projectRoot, bytes, { transactionId, deadlineUnixMs, beforeAtomicWrite, recheckPublication, _testHooks }) {
  beforeAtomicWrite?.(CURRENT_EXECUTION_REGISTRY_PATH, bytes.length)
  const absolutePath = resolveProjectPath(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH)
  const temporaryPath = `${absolutePath}.tmp-${process.pid}-${randomUUID()}`
  let firstError = null
  const diagnostics = { transactionId, status: "pending", attempts: [] }
  const describe = error => ({ code: typeof error?.code === "string" ? error.code : null,
    message: String(error?.message ?? error).slice(0, 1024) })
  try {
    await writeFile(temporaryPath, bytes, { flag: "wx" })
    fsyncFile(temporaryPath)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // The existing temporary bytes are already accounted for. Recheck the
        // caller's guard without charging a second allocation on each retry.
        beforeAtomicWrite?.(CURRENT_EXECUTION_REGISTRY_PATH, 0)
        if (await recheckPublication()) {
          diagnostics.status = "already_published"
          return diagnostics
        }
        requireValue(sha256Bytes(await readFile(temporaryPath)) === sha256Bytes(bytes), "registry_publication_temporary_hash_changed")
        requireRegistryDeadline(deadlineUnixMs)
      } catch (error) {
        if (firstError === null) throw error
        diagnostics.secondaryError = describe(error)
        throw firstError
      }
      try {
        if (typeof _testHooks?.renameCurrent === "function") await _testHooks.renameCurrent(temporaryPath, absolutePath, attempt)
        else await rename(temporaryPath, absolutePath)
      } catch (error) {
        firstError ??= error
        diagnostics.attempts.push({ attempt, atUtc: new Date().toISOString(), ...describe(error) })
        if (!["EPERM", "EACCES", "EBUSY"].includes(error?.code) || attempt === 3) throw firstError
        const delay = attempt === 1 ? 25 : 50
        try {
          requireValue(deadlineUnixMs === null || deadlineUnixMs - Date.now() > delay, "registry_deadline_exhausted")
          await new Promise(resolve => setTimeout(resolve, delay))
          requireRegistryDeadline(deadlineUnixMs)
        } catch (secondary) {
          diagnostics.secondaryError = describe(secondary)
          throw firstError
        }
        continue
      }
      fsyncFile(absolutePath)
      diagnostics.attempts.push({ attempt, atUtc: new Date().toISOString(), status: "published" })
      diagnostics.status = "published"
      return diagnostics
    }
  } catch (error) {
    diagnostics.status = "failed_closed"
    if (firstError !== null && error !== firstError) diagnostics.secondaryError = describe(error)
    const primary = firstError ?? error
    primary.publicationDiagnostics = diagnostics
    throw primary
  } finally {
    await unlink(temporaryPath).catch(error => {
      if (error?.code !== "ENOENT") diagnostics.cleanupError = describe(error)
    })
  }
}

async function writeAtomicReplaceBytes(projectRoot, relativePath, bytes, beforeAtomicWrite = null) {
  beforeAtomicWrite?.(relativePath, bytes.length)
  const absolutePath = resolveProjectPath(projectRoot, relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  const temporaryPath = `${absolutePath}.tmp-${process.pid}-${randomUUID()}`
  await writeFile(temporaryPath, bytes, { flag: "wx" })
  fsyncFile(temporaryPath)
  try {
    await rename(temporaryPath, absolutePath)
    fsyncFile(absolutePath)
  } finally {
    await unlink(temporaryPath).catch(() => undefined)
  }
}

async function appendDurableLine(projectRoot, relativePath, value) {
  const absolutePath = resolveProjectPath(projectRoot, relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await appendFile(absolutePath, `${JSON.stringify(value)}\n`, "utf8")
  fsyncFile(absolutePath)
}

function fsyncFile(absolutePath) {
  // Windows rejects FlushFileBuffers on a read-only handle. Every caller owns
  // the file being durably published, so a read/write handle is appropriate.
  const descriptor = openSync(absolutePath, "r+")
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function compactUtc() {
  return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)
}

function asiaShanghaiTimestamp(utc) {
  const date = new Date(utc)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`
}

function requireValue(condition, code) {
  if (!condition) throw new Error(code)
}
