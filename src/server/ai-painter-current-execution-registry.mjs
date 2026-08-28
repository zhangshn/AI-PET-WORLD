import { createHash, randomUUID } from "node:crypto"
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

export async function advanceCurrentExecutionRegistry({
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
  const transactionRoot = `${CURRENT_EXECUTION_REGISTRY_ROOT}/transactions/${transactionId}`
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
  const pendingTransaction = {
    schemaVersion: "ai-painter-current-execution-registry-transaction-v1",
    transactionId,
    status: "pending",
    registryRevision,
    eventSequence,
    currentSha256,
    previousCurrentSha256: previous.registrySha256,
    recordedAtUtc,
  }
  await writeExclusiveJson(
    projectRoot,
    `${transactionRoot}/transaction.pending.json`,
    pendingTransaction,
  )

  const database = new DatabaseSync(resolveProjectPath(
    projectRoot,
    `${CURRENT_EXECUTION_REGISTRY_ROOT}/registry.sqlite`,
  ))
  initializeDatabase(database)
  database.exec("BEGIN IMMEDIATE")
  try {
    const row = database.prepare("SELECT MAX(registry_revision) AS revision FROM registry_revisions").get()
    requireValue(row?.revision === previous.registry.registryRevision, "registry_concurrent_revision_conflict")
    const committedTransaction = {
      ...pendingTransaction,
      status: "committed",
      committedAtUtc: new Date().toISOString(),
    }
    await writeExclusiveJson(projectRoot, `${transactionRoot}/transaction.json`, committedTransaction)
    database.prepare(`
      INSERT INTO registry_transactions
      (transaction_id, status, current_sha256, recorded_at_utc)
      VALUES (?, 'committed', ?, ?)
    `).run(transactionId, currentSha256, recordedAtUtc)
    database.prepare(`
      INSERT INTO registry_revisions
      (registry_revision, event_sequence, transaction_id, current_sha256, task_id, run_id, recorded_at_utc)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(registryRevision, eventSequence, transactionId, currentSha256, taskId, runId, recordedAtUtc)
    database.exec("COMMIT")
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  } finally {
    database.close()
  }

  await appendDurableLine(projectRoot, `${CURRENT_EXECUTION_REGISTRY_ROOT}/events.jsonl`, {
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
  })
  await writeAtomicReplaceBytes(
    projectRoot,
    CURRENT_EXECUTION_REGISTRY_PATH,
    currentBytes,
  )
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

async function writeExclusiveJson(projectRoot, relativePath, value) {
  const absolutePath = resolveProjectPath(projectRoot, relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, jsonBytes(value), { flag: "wx" })
  fsyncFile(absolutePath)
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
