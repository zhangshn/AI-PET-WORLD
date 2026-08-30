import { createHash, randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { closeSync, fsyncSync, openSync } from "node:fs"
import {
  appendFile,
  link,
  mkdir,
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

export async function readCurrentExecutionRegistry(projectRoot = process.cwd()) {
  try {
    const current = await readBoundJson(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH)
    requireValue(current.value?.schemaVersion === REGISTRY_SCHEMA, "registry_schema_invalid")
    requireValue(Number.isInteger(current.value.registryRevision) && current.value.registryRevision > 0, "registry_revision_invalid")
    requireValue(Number.isInteger(current.value.eventSequence) && current.value.eventSequence > 0, "registry_event_sequence_invalid")
    requireValue(current.value.writerIdentity === "local_ai_capability_lifecycle_orchestrator", "registry_writer_invalid")
    requireValue(typeof current.value.transactionId === "string" && current.value.transactionId.length > 0, "registry_transaction_id_invalid")

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
    requireValue(terminalEvidence.value?.executionState === "completed", "current_task_terminal_not_completed")
    requireValue(terminalEvidence.value?.status === current.value.terminalEvidence.status, "current_task_terminal_status_mismatch")

    const latestTrainingTerminal = await readLatestTrainingTerminal(
      projectRoot,
      current.value.latestTrainingTerminal,
      archivedNamespaces,
    )

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
  requireValue(sourceTerminal.value?.executionState === "completed", "source_task_terminal_not_completed")
  requireValue(sourceTerminal.value?.status === "bounded_candidate_planning_completed", "source_task_terminal_status_invalid")
  requireValue(currentCandidate.value?.schemaVersion === "stage4-post-decode-bounded-candidate-v1", "source_candidate_schema_invalid")
  requireValue(currentCandidate.value?.status === "cpu_inactive_candidate_planned_not_implemented", "source_candidate_status_invalid")
  requireValue(latestTrainingTerminal.value?.schemaVersion === "stage4-post-decode-object-rgb-stage0-terminal-v1", "latest_training_terminal_schema_invalid")
  requireValue(latestTrainingTerminal.value?.executionState === "completed", "latest_training_terminal_not_completed")
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
  runId,
  lifecycleStage,
  executionState,
  activity,
  taskCapsulePath,
  terminalEvidencePath,
  latestTrainingTerminal = null,
  expectedPreviousRegistryRevision = null,
  expectedPreviousRegistrySha256 = null,
  dependencyManifest = null,
  _testHooks = null,
}) {
  const previous = await readCurrentExecutionRegistry(projectRoot)
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
  const archivedNamespaces = previous.archivedNamespaces
  const normalizedCapsulePath = normalizeRelativePath(taskCapsulePath)
  const normalizedTerminalPath = normalizeRelativePath(terminalEvidencePath)
  rejectArchivedPath(normalizedCapsulePath, archivedNamespaces)
  rejectArchivedPath(normalizedTerminalPath, archivedNamespaces)
  const capsule = await readBoundJson(projectRoot, normalizedCapsulePath)
  const terminal = await readBoundJson(projectRoot, normalizedTerminalPath)
  requireValue(capsule.value?.schemaVersion === CAPSULE_SCHEMA, "advanced_task_capsule_schema_invalid")
  requireValue(capsule.value?.integrity?.status === "verified", "advanced_task_capsule_integrity_invalid")
  await verifyCapsuleEvidence(projectRoot, capsule.value, archivedNamespaces)
  requireValue(terminal.value?.executionState === "completed", "advanced_terminal_not_completed")
  requireValue(typeof terminal.value?.status === "string" && terminal.value.status.length > 0, "advanced_terminal_status_invalid")
  let nextLatestTrainingTerminal = previous.registry.latestTrainingTerminal
  if (latestTrainingTerminal !== null) {
    requireValue(typeof latestTrainingTerminal.runId === "string" && latestTrainingTerminal.runId.length > 0, "latest_training_run_id_invalid")
    const latestTerminal = await readBoundJson(projectRoot, normalizeRelativePath(latestTrainingTerminal.path))
    requireValue(latestTerminal.sha256 === latestTrainingTerminal.sha256, "latest_training_terminal_sha256_invalid")
    requireValue(latestTerminal.value?.executionState === "completed", "latest_training_terminal_not_completed")
    requireValue(latestTerminal.value?.status === latestTrainingTerminal.status, "latest_training_terminal_status_invalid")
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
  const processIdentity = resolveCurrentProcessIdentity(_testHooks)
  const writerClaim = {
    schemaVersion: "ai-painter-current-execution-registry-writer-claim-v1",
    transactionId,
    processId: process.pid,
    processStartIdentity: processIdentity,
    claimedAtUtc: new Date().toISOString(),
  }
  await acquireWriterClaim(projectRoot, writerClaim)
  let durablePrepared = false
  let transactionRoot = null
  try {
    const lockedPrevious = await readCurrentExecutionRegistry(projectRoot)
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
    activeExecution: null,
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
  const prepared = await prepareCurrentExecutionRegistryAdvance(options)
  return finalizePreparedCurrentExecutionRegistryAdvance({
    projectRoot: options.projectRoot ?? process.cwd(),
    transactionId: prepared.transactionId,
    _testHooks: options._testHooks ?? null,
  })
}

export async function finalizePreparedCurrentExecutionRegistryAdvance({
  projectRoot = process.cwd(),
  transactionId,
  _testHooks = null,
}) {
  requireSafeTransactionId(transactionId)
  const claim = await readWriterClaim(projectRoot)
  requireValue(claim.transactionId === transactionId, "registry_writer_claim_transaction_mismatch")
  requireValue(claim.processId === process.pid, "registry_writer_claim_not_owned_by_current_process")
  requireValue(
    claim.processStartIdentity === resolveCurrentProcessIdentity(_testHooks),
    "registry_writer_claim_process_identity_mismatch",
  )
  return finalizePreparedAdvanceInternal({ projectRoot, transactionId, _testHooks })
}

export async function recoverPreparedCurrentExecutionRegistryAdvance({
  projectRoot = process.cwd(),
  transactionId = null,
  _testHooks = null,
}) {
  const claim = await readWriterClaim(projectRoot)
  if (transactionId !== null) requireValue(claim.transactionId === transactionId, "registry_writer_claim_transaction_mismatch")
  requireSafeTransactionId(claim.transactionId)
  const probe = probeClaimProcess(claim, _testHooks)
  requireValue(probe.status !== "indeterminate", "registry_writer_claim_liveness_indeterminate")
  requireValue(probe.status !== "active", "registry_writer_claim_active")
  return finalizePreparedAdvanceInternal({
    projectRoot,
    transactionId: claim.transactionId,
    _testHooks,
  })
}

async function finalizePreparedAdvanceInternal({ projectRoot, transactionId, _testHooks }) {
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

  ensurePreparedDatabaseRows(
    projectRoot,
    pending.value,
    stagedCurrentValueForDatabase(stagedCurrentValue),
    _testHooks,
  )
  verifyPreparedDatabaseRows(projectRoot, pending.value)
  const dependencyVerification = await verifyDependencyManifest(projectRoot, dependencyManifest.value)
  invokeTransactionHook(_testHooks, "after_dependencies_verified", { transactionId })

  await ensureAtomicJsonlEvent(
    projectRoot,
    `${CURRENT_EXECUTION_REGISTRY_ROOT}/events.jsonl`,
    stagedEvent.bytes,
    transactionId,
  )
  await verifyRegistryEventBytes(projectRoot, stagedEventValue)
  invokeTransactionHook(_testHooks, "after_registry_event_committed", { transactionId })

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

  if (!alreadyPublished) {
    const beforePublish = await readFile(resolveProjectPath(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH))
    requireValue(sha256Bytes(beforePublish) === pending.value.previousCurrentSha256, "registry_previous_current_changed_before_publish")
    await writeAtomicReplaceBytes(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH, stagedCurrent.bytes)
  }
  invokeTransactionHook(_testHooks, "after_current_publish", { transactionId })
  const published = await readFile(resolveProjectPath(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH))
  requireValue(sha256Bytes(published) === pending.value.currentSha256, "registry_current_publish_hash_mismatch")
  verifyCommittedDatabaseRows(projectRoot, stagedCurrentValue, pending.value.currentSha256)
  await verifyRegistryEventBytes(projectRoot, stagedEventValue)
  await releaseWriterClaim(projectRoot, transactionId)
  return readCurrentExecutionRegistry(projectRoot)
}

async function readLatestTrainingTerminal(projectRoot, binding, archivedNamespaces) {
  if (binding === null || binding === undefined) return null
  requireValue(typeof binding.runId === "string" && binding.runId.length > 0, "latest_training_run_id_invalid")
  const terminal = await readRegistryBinding(projectRoot, binding, archivedNamespaces, "latest_training_terminal")
  requireValue(terminal.value?.runId === binding.runId, "latest_training_run_id_mismatch")
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

async function ensureAtomicJsonlEvent(projectRoot, relativePath, stagedBytes, transactionId) {
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
      )
    }
    return
  }
  if (fragment !== "") {
    requireValue(targetLine.startsWith(fragment), "registry_event_unrelated_partial_line")
  }
  const nextLines = [...completeLines, targetLine]
  await writeAtomicReplaceBytes(projectRoot, relativePath, Buffer.from(`${nextLines.join("\n")}\n`, "utf8"))
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
  requireValue(typeof value.outerJournal.requiredState === "string", "registry_dependency_outer_journal_state_missing")
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
  if (manifest.outerJournal.sha256) requireValue(outerJournal.sha256 === manifest.outerJournal.sha256, "registry_dependency_outer_journal_hash_mismatch")
  requireValue(outerJournal.value?.state === manifest.outerJournal.requiredState, "registry_dependency_outer_journal_incomplete")
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

function resolveCurrentProcessIdentity(testHooks) {
  if (typeof testHooks?.currentProcessIdentity === "string") return testHooks.currentProcessIdentity
  const probe = queryProcessIdentity(process.pid)
  requireValue(probe.status === "active", "registry_current_process_identity_unavailable")
  return probe.identity
}

function probeClaimProcess(claim, testHooks) {
  if (typeof testHooks?.probeClaimProcess === "function") return testHooks.probeClaimProcess(claim)
  const probe = queryProcessIdentity(claim.processId)
  if (probe.status === "indeterminate") return probe
  if (probe.status === "dead") return probe
  return {
    status: probe.identity === claim.processStartIdentity ? "active" : "dead",
    identity: probe.identity,
  }
}

function queryProcessIdentity(processId) {
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
        timeout: 10_000,
      })
      if (result.status === 3) return { status: "dead" }
      if (result.error || result.status !== 0) return { status: "indeterminate" }
      const value = JSON.parse(String(result.stdout).replace(/^\uFEFF/u, ""))
      if (Number(value.processId) !== processId || typeof value.creationDate !== "string") return { status: "indeterminate" }
      return { status: "active", identity: `${processId}:${value.creationDate}` }
    }
    const result = spawnSync("ps", ["-o", "lstart=", "-p", String(processId)], {
      encoding: "utf8",
      timeout: 10_000,
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

async function writeAtomicReplaceBytes(projectRoot, relativePath, bytes) {
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
