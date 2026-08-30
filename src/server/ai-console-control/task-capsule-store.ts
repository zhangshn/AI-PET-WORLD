import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export const taskCapsuleStoreLogicalPath = ".runtime/ai-console/evidence/task-capsule-index-v1.sqlite"
const schemaVersion = "ai_console_task_capsule_store_v1"
const storeIdentity = "ai_console_task_capsule_store"
const writerIdentity = "ai_console_task_capsule_writer_v1"
const sourceTaskRegistryIdentity = "ai_console_task_registry"
const capabilityDomains = [
  "visual_world_generation",
  "text_and_language",
  "speech_and_audio",
  "video_generation",
  "multimodal_orchestration",
] as const
const terminalStatuses = ["succeeded", "failed_closed", "cancelled", "blocked_policy_boundary"] as const

export type AiConsoleTaskCapsuleTerminalStatus = (typeof terminalStatuses)[number]
export type AiConsoleTaskCapsuleCapabilityDomain = (typeof capabilityDomains)[number]

export type AiConsoleTaskCapsuleInput = {
  taskId: string
  taskGoal: string
  capabilityDomain: AiConsoleTaskCapsuleCapabilityDomain
  capabilityVersionId: string | null
  inputEvidenceIds: readonly string[]
  executionId: string
  executionSummary: string
  terminalStatus: AiConsoleTaskCapsuleTerminalStatus
  terminalEventId: string
  resultEvidenceIds: readonly string[]
  policyBoundaryReportId: string | null
  startedAtUtc: string
  terminalAtUtc: string
  sourceTaskRegistryIdentity: typeof sourceTaskRegistryIdentity
  sourceTaskRegistryRevision: number
}

export type AiConsoleTaskCapsuleRecord = {
  schemaVersion: "ai_console_task_capsule_v1"
  storeIdentity: typeof storeIdentity
  capsuleId: string
  capsuleSequence: number
  taskId: string
  taskGoal: string
  taskGoalSha256: string
  capabilityDomain: AiConsoleTaskCapsuleCapabilityDomain
  capabilityVersionId: string | null
  inputEvidenceSetId: string
  inputEvidenceCount: number
  executionId: string
  executionSummary: string
  executionSummarySha256: string
  terminalStatus: AiConsoleTaskCapsuleTerminalStatus
  terminalEventId: string
  resultEvidenceSetId: string
  resultEvidenceCount: number
  policyBoundaryReportId: string | null
  startedAtUtc: string
  terminalAtUtc: string
  sourceTaskRegistryIdentity: typeof sourceTaskRegistryIdentity
  sourceTaskRegistryRevision: number
  contentSha256: string
  registeredAtUtc: string
  integrityStatus: "verified"
  previousCapsuleRecordSha256: string | null
  capsuleRecordSha256: string
}

export type AiConsoleTaskCapsuleStoreMetadata = {
  schemaVersion: typeof schemaVersion
  storeIdentity: typeof storeIdentity
  sourceBoundary: "new_ai_console_only"
  writerIdentity: typeof writerIdentity
  storeRevision: number
  capsuleCount: number
  createdAtUtc: string
  updatedAtUtc: string
  headCapsuleRecordSha256: string | null
  metadataSha256: string
}

export type AiConsoleTaskCapsuleStoreRead =
  | {
      status: "connected"
      records: readonly AiConsoleTaskCapsuleRecord[]
      metadata: AiConsoleTaskCapsuleStoreMetadata
      evidenceReferences: readonly string[]
    }
  | {
      status: "not_connected" | "unknown_or_stale"
      reasonCode: string
      evidenceReferences: readonly string[]
    }

type CapsulePayload = Omit<AiConsoleTaskCapsuleInput, "inputEvidenceIds" | "resultEvidenceIds"> & {
  schemaVersion: "ai_console_task_capsule_payload_v1"
  inputEvidenceIds: readonly string[]
  inputEvidenceSetId: string
  resultEvidenceIds: readonly string[]
  resultEvidenceSetId: string
}

type StoredCapsuleRecord = AiConsoleTaskCapsuleRecord & { contentBlob: Uint8Array }

export function isAiConsoleTaskCapsuleStoreInitialized(): boolean {
  return existsSync(getStorePath())
}

export function initializeAiConsoleTaskCapsuleStore(): AiConsoleTaskCapsuleStoreMetadata {
  const database = openWritableStore()
  try {
    return readAndVerifyMetadata(database)
  } finally {
    database.close()
  }
}

export function writeAiConsoleTaskCapsule(input: AiConsoleTaskCapsuleInput): AiConsoleTaskCapsuleRecord {
  validateInput(input)
  const payload = createPayload(input)
  const contentText = JSON.stringify(payload)
  const contentBlob = Buffer.from(contentText, "utf8")
  const contentSha256 = sha256Text(contentText)
  const capsuleId = sha256Text(`ai_console_task_capsule_v1\n${contentSha256}`)
  const database = openWritableStore()

  try {
    const existingRow = database.prepare(`${capsuleSelectSql} WHERE task_id = ?`).get(input.taskId)
    if (existingRow) {
      const existing = storedCapsuleFromRow(existingRow)
      verifyStoredCapsule(existing, existing.capsuleSequence, existing.previousCapsuleRecordSha256)
      if (existing.contentSha256 !== contentSha256 || existing.capsuleId !== capsuleId) {
        throw new Error("ai_console_task_capsule_task_identity_conflict")
      }
      return stripContentBlob(existing)
    }

    const metadata = readAndVerifyMetadata(database)
    const registeredAtUtc = new Date().toISOString()
    const unsignedRecord: Omit<AiConsoleTaskCapsuleRecord, "capsuleRecordSha256"> = {
      schemaVersion: "ai_console_task_capsule_v1",
      storeIdentity,
      capsuleId,
      capsuleSequence: metadata.capsuleCount + 1,
      taskId: input.taskId,
      taskGoal: input.taskGoal,
      taskGoalSha256: sha256Text(input.taskGoal),
      capabilityDomain: input.capabilityDomain,
      capabilityVersionId: input.capabilityVersionId,
      inputEvidenceSetId: payload.inputEvidenceSetId,
      inputEvidenceCount: payload.inputEvidenceIds.length,
      executionId: input.executionId,
      executionSummary: input.executionSummary,
      executionSummarySha256: sha256Text(input.executionSummary),
      terminalStatus: input.terminalStatus,
      terminalEventId: input.terminalEventId,
      resultEvidenceSetId: payload.resultEvidenceSetId,
      resultEvidenceCount: payload.resultEvidenceIds.length,
      policyBoundaryReportId: input.policyBoundaryReportId,
      startedAtUtc: input.startedAtUtc,
      terminalAtUtc: input.terminalAtUtc,
      sourceTaskRegistryIdentity,
      sourceTaskRegistryRevision: input.sourceTaskRegistryRevision,
      contentSha256,
      registeredAtUtc,
      integrityStatus: "verified",
      previousCapsuleRecordSha256: metadata.headCapsuleRecordSha256,
    }
    const record: AiConsoleTaskCapsuleRecord = {
      ...unsignedRecord,
      capsuleRecordSha256: sha256Text(JSON.stringify(unsignedRecord)),
    }

    database.exec("BEGIN IMMEDIATE")
    try {
      insertCapsule(database, record, contentBlob)
      updateMetadata(database, metadata, record)
      database.exec("COMMIT")
    } catch (error) {
      database.exec("ROLLBACK")
      throw error
    }
    return record
  } finally {
    database.close()
  }
}

export function readAiConsoleTaskCapsuleStore(): AiConsoleTaskCapsuleStoreRead {
  const storePath = getStorePath()
  if (!existsSync(storePath)) {
    return {
      status: "not_connected",
      reasonCode: "ai_console_task_capsule_store_not_initialized",
      evidenceReferences: [taskCapsuleStoreLogicalPath],
    }
  }

  let database: DatabaseSync | null = null
  try {
    database = new DatabaseSync(storePath, { open: true, readOnly: true })
    verifyDatabaseIntegrity(database)
    verifyDatabaseVersion(database)
    verifyDatabaseSchema(database)
    const metadata = readAndVerifyMetadata(database)
    const storedRecords = database.prepare(`${capsuleSelectSql} ORDER BY capsule_sequence ASC`).all().map(storedCapsuleFromRow)
    if (storedRecords.length !== metadata.capsuleCount || metadata.storeRevision !== metadata.capsuleCount) {
      throw new Error("ai_console_task_capsule_store_count_mismatch")
    }
    let previousSha256: string | null = null
    storedRecords.forEach((record, index) => {
      verifyStoredCapsule(record, index + 1, previousSha256)
      previousSha256 = record.capsuleRecordSha256
    })
    if (metadata.headCapsuleRecordSha256 !== previousSha256) throw new Error("ai_console_task_capsule_store_head_mismatch")
    return {
      status: "connected",
      records: storedRecords.map(stripContentBlob).reverse(),
      metadata,
      evidenceReferences: [
        taskCapsuleStoreLogicalPath,
        "data/ai-console/schemas/ai-console-task-capsule-v1.schema.json",
      ],
    }
  } catch (error) {
    return {
      status: "unknown_or_stale",
      reasonCode: error instanceof Error ? error.message : "ai_console_task_capsule_store_read_failed",
      evidenceReferences: [taskCapsuleStoreLogicalPath],
    }
  } finally {
    database?.close()
  }
}

function createPayload(input: AiConsoleTaskCapsuleInput): CapsulePayload {
  return {
    schemaVersion: "ai_console_task_capsule_payload_v1",
    taskId: input.taskId,
    taskGoal: input.taskGoal,
    capabilityDomain: input.capabilityDomain,
    capabilityVersionId: input.capabilityVersionId,
    inputEvidenceIds: input.inputEvidenceIds,
    inputEvidenceSetId: deriveEvidenceSetId("input", input.inputEvidenceIds),
    executionId: input.executionId,
    executionSummary: input.executionSummary,
    terminalStatus: input.terminalStatus,
    terminalEventId: input.terminalEventId,
    resultEvidenceIds: input.resultEvidenceIds,
    resultEvidenceSetId: deriveEvidenceSetId("result", input.resultEvidenceIds),
    policyBoundaryReportId: input.policyBoundaryReportId,
    startedAtUtc: input.startedAtUtc,
    terminalAtUtc: input.terminalAtUtc,
    sourceTaskRegistryIdentity,
    sourceTaskRegistryRevision: input.sourceTaskRegistryRevision,
  }
}

function validateInput(input: AiConsoleTaskCapsuleInput) {
  if (!isPlainRecord(input)) throw new Error("ai_console_task_capsule_input_invalid")
  const allowedFields = [
    "taskId", "taskGoal", "capabilityDomain", "capabilityVersionId", "inputEvidenceIds", "executionId",
    "executionSummary", "terminalStatus", "terminalEventId", "resultEvidenceIds", "policyBoundaryReportId",
    "startedAtUtc", "terminalAtUtc", "sourceTaskRegistryIdentity", "sourceTaskRegistryRevision",
  ].sort()
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify(allowedFields)) throw new Error("ai_console_task_capsule_input_field_set_invalid")
  if (!isSha256(input.taskId) || !isSha256(input.executionId) || !isSha256(input.terminalEventId)) throw new Error("ai_console_task_capsule_core_identity_invalid")
  if (!isBoundedText(input.taskGoal, 1, 2000) || !isBoundedText(input.executionSummary, 1, 4000)) throw new Error("ai_console_task_capsule_text_invalid")
  if (!capabilityDomains.includes(input.capabilityDomain)) throw new Error("ai_console_task_capsule_capability_domain_invalid")
  if (input.capabilityVersionId !== null && !/^[a-z0-9][a-z0-9._:-]{2,127}$/u.test(input.capabilityVersionId)) throw new Error("ai_console_task_capsule_capability_version_invalid")
  validateEvidenceIds(input.inputEvidenceIds, "input")
  validateEvidenceIds(input.resultEvidenceIds, "result")
  if (!terminalStatuses.includes(input.terminalStatus)) throw new Error("ai_console_task_capsule_terminal_status_invalid")
  if (input.terminalStatus === "blocked_policy_boundary") {
    if (input.policyBoundaryReportId === null || !isSha256(input.policyBoundaryReportId)) throw new Error("ai_console_task_capsule_policy_report_required")
  } else if (input.policyBoundaryReportId !== null) {
    throw new Error("ai_console_task_capsule_policy_report_not_allowed")
  }
  if (!isUtcTimestamp(input.startedAtUtc) || !isUtcTimestamp(input.terminalAtUtc) || Date.parse(input.terminalAtUtc) < Date.parse(input.startedAtUtc)) throw new Error("ai_console_task_capsule_time_range_invalid")
  if (input.sourceTaskRegistryIdentity !== sourceTaskRegistryIdentity) throw new Error("ai_console_task_capsule_source_registry_invalid")
  if (!Number.isInteger(input.sourceTaskRegistryRevision) || input.sourceTaskRegistryRevision < 1) throw new Error("ai_console_task_capsule_source_revision_invalid")
}

function validateEvidenceIds(values: readonly string[], label: string) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 256 || values.some((value) => !isSha256(value))) throw new Error(`ai_console_task_capsule_${label}_evidence_invalid`)
  if (new Set(values).size !== values.length || JSON.stringify([...values].sort()) !== JSON.stringify(values)) throw new Error(`ai_console_task_capsule_${label}_evidence_not_canonical`)
}

function openWritableStore(): DatabaseSync {
  const storePath = getStorePath()
  mkdirSync(path.dirname(storePath), { recursive: true })
  const database = new DatabaseSync(storePath)
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL;")
  database.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      schema_version TEXT NOT NULL,
      store_identity TEXT NOT NULL,
      source_boundary TEXT NOT NULL,
      writer_identity TEXT NOT NULL,
      store_revision INTEGER NOT NULL CHECK (store_revision >= 0),
      capsule_count INTEGER NOT NULL CHECK (capsule_count >= 0),
      created_at_utc TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL,
      head_capsule_record_sha256 TEXT,
      metadata_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_capsules (
      capsule_id TEXT PRIMARY KEY,
      capsule_sequence INTEGER NOT NULL UNIQUE CHECK (capsule_sequence >= 1),
      task_id TEXT NOT NULL UNIQUE,
      task_goal TEXT NOT NULL,
      task_goal_sha256 TEXT NOT NULL,
      capability_domain TEXT NOT NULL,
      capability_version_id TEXT,
      input_evidence_set_id TEXT NOT NULL,
      input_evidence_count INTEGER NOT NULL CHECK (input_evidence_count >= 1),
      execution_id TEXT NOT NULL,
      execution_summary TEXT NOT NULL,
      execution_summary_sha256 TEXT NOT NULL,
      terminal_status TEXT NOT NULL,
      terminal_event_id TEXT NOT NULL,
      result_evidence_set_id TEXT NOT NULL,
      result_evidence_count INTEGER NOT NULL CHECK (result_evidence_count >= 1),
      policy_boundary_report_id TEXT,
      started_at_utc TEXT NOT NULL,
      terminal_at_utc TEXT NOT NULL,
      source_task_registry_identity TEXT NOT NULL,
      source_task_registry_revision INTEGER NOT NULL CHECK (source_task_registry_revision >= 1),
      content_sha256 TEXT NOT NULL,
      content_blob BLOB NOT NULL,
      registered_at_utc TEXT NOT NULL,
      previous_capsule_record_sha256 TEXT,
      capsule_record_sha256 TEXT NOT NULL
    );
  `)
  verifyDatabaseSchema(database)
  const metadataCount = Number((database.prepare("SELECT COUNT(*) AS count FROM metadata").get() as { count: number }).count)
  if (metadataCount === 0) insertInitialMetadata(database)
  if (metadataCount > 1) throw new Error("ai_console_task_capsule_metadata_cardinality_invalid")
  database.exec("PRAGMA user_version = 1")
  return database
}

function insertInitialMetadata(database: DatabaseSync) {
  const createdAtUtc = new Date().toISOString()
  const unsignedMetadata: Omit<AiConsoleTaskCapsuleStoreMetadata, "metadataSha256"> = {
    schemaVersion,
    storeIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity,
    storeRevision: 0,
    capsuleCount: 0,
    createdAtUtc,
    updatedAtUtc: createdAtUtc,
    headCapsuleRecordSha256: null,
  }
  const metadata = { ...unsignedMetadata, metadataSha256: sha256Text(JSON.stringify(unsignedMetadata)) }
  database.prepare(`INSERT INTO metadata VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    metadata.schemaVersion, metadata.storeIdentity, metadata.sourceBoundary, metadata.writerIdentity,
    metadata.storeRevision, metadata.capsuleCount, metadata.createdAtUtc, metadata.updatedAtUtc,
    metadata.headCapsuleRecordSha256, metadata.metadataSha256,
  )
}

function insertCapsule(database: DatabaseSync, record: AiConsoleTaskCapsuleRecord, contentBlob: Uint8Array) {
  database.prepare(`
    INSERT INTO task_capsules (
      capsule_id, capsule_sequence, task_id, task_goal, task_goal_sha256, capability_domain,
      capability_version_id, input_evidence_set_id, input_evidence_count, execution_id, execution_summary,
      execution_summary_sha256, terminal_status, terminal_event_id, result_evidence_set_id,
      result_evidence_count, policy_boundary_report_id, started_at_utc, terminal_at_utc,
      source_task_registry_identity, source_task_registry_revision, content_sha256, content_blob,
      registered_at_utc, previous_capsule_record_sha256, capsule_record_sha256
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.capsuleId, record.capsuleSequence, record.taskId, record.taskGoal, record.taskGoalSha256,
    record.capabilityDomain, record.capabilityVersionId, record.inputEvidenceSetId, record.inputEvidenceCount,
    record.executionId, record.executionSummary, record.executionSummarySha256, record.terminalStatus,
    record.terminalEventId, record.resultEvidenceSetId, record.resultEvidenceCount, record.policyBoundaryReportId,
    record.startedAtUtc, record.terminalAtUtc, record.sourceTaskRegistryIdentity, record.sourceTaskRegistryRevision,
    record.contentSha256, contentBlob, record.registeredAtUtc, record.previousCapsuleRecordSha256,
    record.capsuleRecordSha256,
  )
}

function updateMetadata(database: DatabaseSync, metadata: AiConsoleTaskCapsuleStoreMetadata, record: AiConsoleTaskCapsuleRecord) {
  const unsignedMetadata: Omit<AiConsoleTaskCapsuleStoreMetadata, "metadataSha256"> = {
    schemaVersion,
    storeIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity,
    storeRevision: metadata.storeRevision + 1,
    capsuleCount: metadata.capsuleCount + 1,
    createdAtUtc: metadata.createdAtUtc,
    updatedAtUtc: record.registeredAtUtc,
    headCapsuleRecordSha256: record.capsuleRecordSha256,
  }
  const metadataSha256 = sha256Text(JSON.stringify(unsignedMetadata))
  const result = database.prepare(`
    UPDATE metadata SET store_revision = ?, capsule_count = ?, updated_at_utc = ?,
      head_capsule_record_sha256 = ?, metadata_sha256 = ?
    WHERE singleton = 1 AND store_revision = ? AND capsule_count = ?
  `).run(
    unsignedMetadata.storeRevision, unsignedMetadata.capsuleCount, unsignedMetadata.updatedAtUtc,
    unsignedMetadata.headCapsuleRecordSha256, metadataSha256, metadata.storeRevision, metadata.capsuleCount,
  )
  if (Number(result.changes) !== 1) throw new Error("ai_console_task_capsule_metadata_revision_conflict")
}

function readAndVerifyMetadata(database: DatabaseSync): AiConsoleTaskCapsuleStoreMetadata {
  const rows = database.prepare("SELECT * FROM metadata ORDER BY singleton ASC").all()
  if (rows.length !== 1) throw new Error("ai_console_task_capsule_metadata_cardinality_invalid")
  const row = rows[0] as Record<string, unknown>
  const metadata: AiConsoleTaskCapsuleStoreMetadata = {
    schemaVersion: String(row.schema_version) as typeof schemaVersion,
    storeIdentity: String(row.store_identity) as typeof storeIdentity,
    sourceBoundary: String(row.source_boundary) as "new_ai_console_only",
    writerIdentity: String(row.writer_identity) as typeof writerIdentity,
    storeRevision: Number(row.store_revision),
    capsuleCount: Number(row.capsule_count),
    createdAtUtc: String(row.created_at_utc),
    updatedAtUtc: String(row.updated_at_utc),
    headCapsuleRecordSha256: row.head_capsule_record_sha256 === null ? null : String(row.head_capsule_record_sha256),
    metadataSha256: String(row.metadata_sha256),
  }
  if (metadata.schemaVersion !== schemaVersion || metadata.storeIdentity !== storeIdentity || metadata.sourceBoundary !== "new_ai_console_only" || metadata.writerIdentity !== writerIdentity) throw new Error("ai_console_task_capsule_metadata_identity_invalid")
  if (!Number.isInteger(metadata.storeRevision) || metadata.storeRevision < 0 || !Number.isInteger(metadata.capsuleCount) || metadata.capsuleCount < 0) throw new Error("ai_console_task_capsule_metadata_revision_invalid")
  if (!isUtcTimestamp(metadata.createdAtUtc) || !isUtcTimestamp(metadata.updatedAtUtc)) throw new Error("ai_console_task_capsule_metadata_time_invalid")
  if (metadata.headCapsuleRecordSha256 !== null && !isSha256(metadata.headCapsuleRecordSha256)) throw new Error("ai_console_task_capsule_metadata_head_invalid")
  const { metadataSha256, ...unsignedMetadata } = metadata
  if (!isSha256(metadataSha256) || sha256Text(JSON.stringify(unsignedMetadata)) !== metadataSha256) throw new Error("ai_console_task_capsule_metadata_sha256_mismatch")
  return metadata
}

function storedCapsuleFromRow(value: unknown): StoredCapsuleRecord {
  const row = value as Record<string, unknown>
  const contentBlob = row.content_blob
  if (!(contentBlob instanceof Uint8Array)) throw new Error("ai_console_task_capsule_blob_invalid")
  return {
    schemaVersion: "ai_console_task_capsule_v1",
    storeIdentity,
    capsuleId: String(row.capsule_id),
    capsuleSequence: Number(row.capsule_sequence),
    taskId: String(row.task_id),
    taskGoal: String(row.task_goal),
    taskGoalSha256: String(row.task_goal_sha256),
    capabilityDomain: String(row.capability_domain) as AiConsoleTaskCapsuleCapabilityDomain,
    capabilityVersionId: row.capability_version_id === null ? null : String(row.capability_version_id),
    inputEvidenceSetId: String(row.input_evidence_set_id),
    inputEvidenceCount: Number(row.input_evidence_count),
    executionId: String(row.execution_id),
    executionSummary: String(row.execution_summary),
    executionSummarySha256: String(row.execution_summary_sha256),
    terminalStatus: String(row.terminal_status) as AiConsoleTaskCapsuleTerminalStatus,
    terminalEventId: String(row.terminal_event_id),
    resultEvidenceSetId: String(row.result_evidence_set_id),
    resultEvidenceCount: Number(row.result_evidence_count),
    policyBoundaryReportId: row.policy_boundary_report_id === null ? null : String(row.policy_boundary_report_id),
    startedAtUtc: String(row.started_at_utc),
    terminalAtUtc: String(row.terminal_at_utc),
    sourceTaskRegistryIdentity: String(row.source_task_registry_identity) as typeof sourceTaskRegistryIdentity,
    sourceTaskRegistryRevision: Number(row.source_task_registry_revision),
    contentSha256: String(row.content_sha256),
    registeredAtUtc: String(row.registered_at_utc),
    integrityStatus: "verified",
    previousCapsuleRecordSha256: row.previous_capsule_record_sha256 === null ? null : String(row.previous_capsule_record_sha256),
    capsuleRecordSha256: String(row.capsule_record_sha256),
    contentBlob,
  }
}

function verifyStoredCapsule(record: StoredCapsuleRecord, expectedSequence: number, expectedPreviousSha256: string | null) {
  if (record.schemaVersion !== "ai_console_task_capsule_v1" || record.storeIdentity !== storeIdentity) throw new Error("ai_console_task_capsule_record_identity_invalid")
  if (record.capsuleSequence !== expectedSequence || record.previousCapsuleRecordSha256 !== expectedPreviousSha256) throw new Error("ai_console_task_capsule_record_chain_invalid")
  if (!isSha256(record.taskId) || !isSha256(record.executionId) || !isSha256(record.terminalEventId)) throw new Error("ai_console_task_capsule_record_binding_invalid")
  if (!capabilityDomains.includes(record.capabilityDomain) || !terminalStatuses.includes(record.terminalStatus)) throw new Error("ai_console_task_capsule_record_enum_invalid")
  if (record.sourceTaskRegistryIdentity !== sourceTaskRegistryIdentity || !Number.isInteger(record.sourceTaskRegistryRevision) || record.sourceTaskRegistryRevision < 1) throw new Error("ai_console_task_capsule_record_source_invalid")
  if (!isUtcTimestamp(record.startedAtUtc) || !isUtcTimestamp(record.terminalAtUtc) || !isUtcTimestamp(record.registeredAtUtc)) throw new Error("ai_console_task_capsule_record_time_invalid")
  if (record.taskGoalSha256 !== sha256Text(record.taskGoal) || record.executionSummarySha256 !== sha256Text(record.executionSummary)) throw new Error("ai_console_task_capsule_record_text_sha256_mismatch")
  const payloadText = Buffer.from(record.contentBlob).toString("utf8")
  if (sha256Text(payloadText) !== record.contentSha256 || record.capsuleId !== sha256Text(`ai_console_task_capsule_v1\n${record.contentSha256}`)) throw new Error("ai_console_task_capsule_content_identity_mismatch")
  let payload: unknown
  try { payload = JSON.parse(payloadText) } catch { throw new Error("ai_console_task_capsule_payload_invalid_json") }
  if (!isPlainRecord(payload) || payload.schemaVersion !== "ai_console_task_capsule_payload_v1") throw new Error("ai_console_task_capsule_payload_shape_invalid")
  const payloadInput: AiConsoleTaskCapsuleInput = {
    taskId: payload.taskId as string,
    taskGoal: payload.taskGoal as string,
    capabilityDomain: payload.capabilityDomain as AiConsoleTaskCapsuleCapabilityDomain,
    capabilityVersionId: payload.capabilityVersionId as string | null,
    inputEvidenceIds: payload.inputEvidenceIds as readonly string[],
    executionId: payload.executionId as string,
    executionSummary: payload.executionSummary as string,
    terminalStatus: payload.terminalStatus as AiConsoleTaskCapsuleTerminalStatus,
    terminalEventId: payload.terminalEventId as string,
    resultEvidenceIds: payload.resultEvidenceIds as readonly string[],
    policyBoundaryReportId: payload.policyBoundaryReportId as string | null,
    startedAtUtc: payload.startedAtUtc as string,
    terminalAtUtc: payload.terminalAtUtc as string,
    sourceTaskRegistryIdentity: payload.sourceTaskRegistryIdentity as typeof sourceTaskRegistryIdentity,
    sourceTaskRegistryRevision: payload.sourceTaskRegistryRevision as number,
  }
  validateInput(payloadInput)
  if (deriveEvidenceSetId("input", payloadInput.inputEvidenceIds) !== record.inputEvidenceSetId || payloadInput.inputEvidenceIds.length !== record.inputEvidenceCount) throw new Error("ai_console_task_capsule_input_evidence_binding_mismatch")
  if (deriveEvidenceSetId("result", payloadInput.resultEvidenceIds) !== record.resultEvidenceSetId || payloadInput.resultEvidenceIds.length !== record.resultEvidenceCount) throw new Error("ai_console_task_capsule_result_evidence_binding_mismatch")
  const expectedPayload = payloadFromStoredRecord(record, payload)
  if (JSON.stringify(payload) !== JSON.stringify(expectedPayload)) throw new Error("ai_console_task_capsule_payload_binding_mismatch")
  const { capsuleRecordSha256, contentBlob: _contentBlob, ...unsignedRecord } = record
  void _contentBlob
  if (!isSha256(capsuleRecordSha256) || sha256Text(JSON.stringify(unsignedRecord)) !== capsuleRecordSha256) throw new Error("ai_console_task_capsule_record_sha256_mismatch")
}

function payloadFromStoredRecord(record: StoredCapsuleRecord, payload: Record<string, unknown>): CapsulePayload {
  return {
    schemaVersion: "ai_console_task_capsule_payload_v1",
    taskId: record.taskId,
    taskGoal: record.taskGoal,
    capabilityDomain: record.capabilityDomain,
    capabilityVersionId: record.capabilityVersionId,
    inputEvidenceIds: payload.inputEvidenceIds as readonly string[],
    inputEvidenceSetId: record.inputEvidenceSetId,
    executionId: record.executionId,
    executionSummary: record.executionSummary,
    terminalStatus: record.terminalStatus,
    terminalEventId: record.terminalEventId,
    resultEvidenceIds: payload.resultEvidenceIds as readonly string[],
    resultEvidenceSetId: record.resultEvidenceSetId,
    policyBoundaryReportId: record.policyBoundaryReportId,
    startedAtUtc: record.startedAtUtc,
    terminalAtUtc: record.terminalAtUtc,
    sourceTaskRegistryIdentity,
    sourceTaskRegistryRevision: record.sourceTaskRegistryRevision,
  }
}

function stripContentBlob(record: StoredCapsuleRecord): AiConsoleTaskCapsuleRecord {
  const { contentBlob: _contentBlob, ...publicRecord } = record
  void _contentBlob
  return publicRecord
}

function verifyDatabaseSchema(database: DatabaseSync) {
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String((row as { name: unknown }).name))
  if (JSON.stringify(tables) !== JSON.stringify(["metadata", "task_capsules"])) throw new Error("ai_console_task_capsule_table_set_invalid")
  verifyColumnSet(database, "metadata", ["singleton", "schema_version", "store_identity", "source_boundary", "writer_identity", "store_revision", "capsule_count", "created_at_utc", "updated_at_utc", "head_capsule_record_sha256", "metadata_sha256"])
  verifyColumnSet(database, "task_capsules", ["capsule_id", "capsule_sequence", "task_id", "task_goal", "task_goal_sha256", "capability_domain", "capability_version_id", "input_evidence_set_id", "input_evidence_count", "execution_id", "execution_summary", "execution_summary_sha256", "terminal_status", "terminal_event_id", "result_evidence_set_id", "result_evidence_count", "policy_boundary_report_id", "started_at_utc", "terminal_at_utc", "source_task_registry_identity", "source_task_registry_revision", "content_sha256", "content_blob", "registered_at_utc", "previous_capsule_record_sha256", "capsule_record_sha256"])
}

function verifyColumnSet(database: DatabaseSync, tableName: string, expectedColumns: readonly string[]) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => String((row as { name: unknown }).name))
  if (JSON.stringify(columns) !== JSON.stringify(expectedColumns)) throw new Error(`ai_console_task_capsule_column_set_invalid:${tableName}`)
}

function verifyDatabaseIntegrity(database: DatabaseSync) {
  const result = database.prepare("PRAGMA integrity_check").get() as Record<string, unknown>
  if (!result || !Object.values(result).includes("ok")) throw new Error("ai_console_task_capsule_sqlite_integrity_failure")
}

function verifyDatabaseVersion(database: DatabaseSync) {
  const result = database.prepare("PRAGMA user_version").get() as Record<string, unknown>
  if (!result || !Object.values(result).includes(1)) throw new Error("ai_console_task_capsule_sqlite_version_invalid")
}

function deriveEvidenceSetId(setType: "input" | "result", evidenceIds: readonly string[]): string {
  return sha256Text(`ai_console_task_capsule_${setType}_evidence_set_v1\n${JSON.stringify(evidenceIds)}`)
}

function getStorePath(): string {
  return path.join(process.cwd(), ...taskCapsuleStoreLogicalPath.split("/"))
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function isUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.endsWith("Z") && !Number.isNaN(Date.parse(value))
}

function isBoundedText(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && value === value.trim() && value.length >= minimum && value.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const capsuleSelectSql = `
  SELECT capsule_id, capsule_sequence, task_id, task_goal, task_goal_sha256, capability_domain,
    capability_version_id, input_evidence_set_id, input_evidence_count, execution_id, execution_summary,
    execution_summary_sha256, terminal_status, terminal_event_id, result_evidence_set_id,
    result_evidence_count, policy_boundary_report_id, started_at_utc, terminal_at_utc,
    source_task_registry_identity, source_task_registry_revision, content_sha256, content_blob,
    registered_at_utc, previous_capsule_record_sha256, capsule_record_sha256
  FROM task_capsules
`
