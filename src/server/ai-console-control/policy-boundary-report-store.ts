import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export const policyBoundaryReportStoreLogicalPath = ".runtime/ai-console/evidence/policy-boundary-report-index-v1.sqlite"
const schemaVersion = "ai_console_policy_boundary_report_store_v1"
const storeIdentity = "ai_console_policy_boundary_report_store"
const writerIdentity = "ai_console_policy_boundary_report_writer_v1"
const sourcePolicyEngineIdentity = "ai_console_policy_boundary_engine"
const boundaryCategories = [
  "long_term_business_goal",
  "source_and_license",
  "external_cost",
  "irreversible_operation",
  "safety_upper_bound",
  "audit_integrity",
] as const

export type AiConsolePolicyBoundaryCategory = (typeof boundaryCategories)[number]

export type AiConsolePolicyBoundaryReportInput = {
  boundaryEventId: string
  boundaryCategory: AiConsolePolicyBoundaryCategory
  prohibitedAction: string
  failureCode: string
  affectedScope: string
  affectedTaskId: string | null
  affectedExecutionId: string | null
  detectionEvidenceIds: readonly string[]
  preservedStateEvidenceIds: readonly string[]
  preservationRequirement: string
  safeAlternativeRequirement: string
  terminalStatus: "blocked_policy_boundary"
  occurredAtUtc: string
  sourcePolicyEngineIdentity: typeof sourcePolicyEngineIdentity
  sourcePolicyRevision: number
}

export type AiConsolePolicyBoundaryReportRecord = {
  schemaVersion: "ai_console_policy_boundary_report_v1"
  storeIdentity: typeof storeIdentity
  policyBoundaryReportId: string
  reportSequence: number
  boundaryEventId: string
  boundaryCategory: AiConsolePolicyBoundaryCategory
  prohibitedAction: string
  failureCode: string
  affectedScope: string
  affectedTaskId: string | null
  affectedExecutionId: string | null
  detectionEvidenceSetId: string
  detectionEvidenceCount: number
  preservedStateEvidenceSetId: string
  preservedStateEvidenceCount: number
  preservationRequirement: string
  safeAlternativeRequirement: string
  terminalStatus: "blocked_policy_boundary"
  occurredAtUtc: string
  sourcePolicyEngineIdentity: typeof sourcePolicyEngineIdentity
  sourcePolicyRevision: number
  contentSha256: string
  registeredAtUtc: string
  integrityStatus: "verified"
  previousPolicyBoundaryReportSha256: string | null
  policyBoundaryReportRecordSha256: string
}

export type AiConsolePolicyBoundaryReportStoreMetadata = {
  schemaVersion: typeof schemaVersion
  storeIdentity: typeof storeIdentity
  sourceBoundary: "new_ai_console_only"
  writerIdentity: typeof writerIdentity
  storeRevision: number
  reportCount: number
  createdAtUtc: string
  updatedAtUtc: string
  headPolicyBoundaryReportSha256: string | null
  metadataSha256: string
}

export type AiConsolePolicyBoundaryReportStoreRead =
  | {
      status: "connected"
      records: readonly AiConsolePolicyBoundaryReportRecord[]
      metadata: AiConsolePolicyBoundaryReportStoreMetadata
      evidenceReferences: readonly string[]
    }
  | {
      status: "not_connected" | "unknown_or_stale"
      reasonCode: string
      evidenceReferences: readonly string[]
    }

type PolicyBoundaryPayload = AiConsolePolicyBoundaryReportInput & {
  schemaVersion: "ai_console_policy_boundary_report_payload_v1"
  detectionEvidenceSetId: string
  preservedStateEvidenceSetId: string
}

type StoredPolicyBoundaryReport = AiConsolePolicyBoundaryReportRecord & { contentBlob: Uint8Array }

export function isAiConsolePolicyBoundaryReportStoreInitialized(): boolean {
  return existsSync(getStorePath())
}

export function initializeAiConsolePolicyBoundaryReportStore(): AiConsolePolicyBoundaryReportStoreMetadata {
  const database = openWritableStore()
  try {
    return readAndVerifyMetadata(database)
  } finally {
    database.close()
  }
}

export function writeAiConsolePolicyBoundaryReport(
  input: AiConsolePolicyBoundaryReportInput,
): AiConsolePolicyBoundaryReportRecord {
  validateInput(input)
  const payload = createPayload(input)
  const contentText = JSON.stringify(payload)
  const contentBlob = Buffer.from(contentText, "utf8")
  const contentSha256 = sha256Text(contentText)
  const policyBoundaryReportId = sha256Text(`ai_console_policy_boundary_report_v1\n${contentSha256}`)
  const database = openWritableStore()

  try {
    const existingRow = database.prepare(`${reportSelectSql} WHERE boundary_event_id = ?`).get(input.boundaryEventId)
    if (existingRow) {
      const existing = storedReportFromRow(existingRow)
      verifyStoredReport(existing, existing.reportSequence, existing.previousPolicyBoundaryReportSha256)
      if (existing.contentSha256 !== contentSha256 || existing.policyBoundaryReportId !== policyBoundaryReportId) {
        throw new Error("ai_console_policy_boundary_event_identity_conflict")
      }
      return stripContentBlob(existing)
    }

    const metadata = readAndVerifyMetadata(database)
    const registeredAtUtc = new Date().toISOString()
    const unsignedRecord: Omit<AiConsolePolicyBoundaryReportRecord, "policyBoundaryReportRecordSha256"> = {
      schemaVersion: "ai_console_policy_boundary_report_v1",
      storeIdentity,
      policyBoundaryReportId,
      reportSequence: metadata.reportCount + 1,
      boundaryEventId: input.boundaryEventId,
      boundaryCategory: input.boundaryCategory,
      prohibitedAction: input.prohibitedAction,
      failureCode: input.failureCode,
      affectedScope: input.affectedScope,
      affectedTaskId: input.affectedTaskId,
      affectedExecutionId: input.affectedExecutionId,
      detectionEvidenceSetId: payload.detectionEvidenceSetId,
      detectionEvidenceCount: payload.detectionEvidenceIds.length,
      preservedStateEvidenceSetId: payload.preservedStateEvidenceSetId,
      preservedStateEvidenceCount: payload.preservedStateEvidenceIds.length,
      preservationRequirement: input.preservationRequirement,
      safeAlternativeRequirement: input.safeAlternativeRequirement,
      terminalStatus: "blocked_policy_boundary",
      occurredAtUtc: input.occurredAtUtc,
      sourcePolicyEngineIdentity,
      sourcePolicyRevision: input.sourcePolicyRevision,
      contentSha256,
      registeredAtUtc,
      integrityStatus: "verified",
      previousPolicyBoundaryReportSha256: metadata.headPolicyBoundaryReportSha256,
    }
    const record: AiConsolePolicyBoundaryReportRecord = {
      ...unsignedRecord,
      policyBoundaryReportRecordSha256: sha256Text(JSON.stringify(unsignedRecord)),
    }

    database.exec("BEGIN IMMEDIATE")
    try {
      insertReport(database, record, contentBlob)
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

export function readAiConsolePolicyBoundaryReportStore(): AiConsolePolicyBoundaryReportStoreRead {
  const storePath = getStorePath()
  if (!existsSync(storePath)) {
    return {
      status: "not_connected",
      reasonCode: "ai_console_policy_boundary_report_store_not_initialized",
      evidenceReferences: [policyBoundaryReportStoreLogicalPath],
    }
  }

  let database: DatabaseSync | null = null
  try {
    database = new DatabaseSync(storePath, { open: true, readOnly: true })
    verifyDatabaseIntegrity(database)
    verifyDatabaseVersion(database)
    verifyDatabaseSchema(database)
    const metadata = readAndVerifyMetadata(database)
    const records = database.prepare(`${reportSelectSql} ORDER BY report_sequence ASC`).all().map(storedReportFromRow)
    if (records.length !== metadata.reportCount || metadata.storeRevision !== metadata.reportCount) {
      throw new Error("ai_console_policy_boundary_report_store_count_mismatch")
    }
    let previousSha256: string | null = null
    records.forEach((record, index) => {
      verifyStoredReport(record, index + 1, previousSha256)
      previousSha256 = record.policyBoundaryReportRecordSha256
    })
    if (metadata.headPolicyBoundaryReportSha256 !== previousSha256) {
      throw new Error("ai_console_policy_boundary_report_store_head_mismatch")
    }
    return {
      status: "connected",
      records: records.map(stripContentBlob).reverse(),
      metadata,
      evidenceReferences: [
        policyBoundaryReportStoreLogicalPath,
        "data/ai-console/schemas/ai-console-policy-boundary-report-v1.schema.json",
      ],
    }
  } catch (error) {
    return {
      status: "unknown_or_stale",
      reasonCode: error instanceof Error ? error.message : "ai_console_policy_boundary_report_store_read_failed",
      evidenceReferences: [policyBoundaryReportStoreLogicalPath],
    }
  } finally {
    database?.close()
  }
}

function createPayload(input: AiConsolePolicyBoundaryReportInput): PolicyBoundaryPayload {
  return {
    schemaVersion: "ai_console_policy_boundary_report_payload_v1",
    boundaryEventId: input.boundaryEventId,
    boundaryCategory: input.boundaryCategory,
    prohibitedAction: input.prohibitedAction,
    failureCode: input.failureCode,
    affectedScope: input.affectedScope,
    affectedTaskId: input.affectedTaskId,
    affectedExecutionId: input.affectedExecutionId,
    detectionEvidenceIds: input.detectionEvidenceIds,
    preservedStateEvidenceIds: input.preservedStateEvidenceIds,
    preservationRequirement: input.preservationRequirement,
    safeAlternativeRequirement: input.safeAlternativeRequirement,
    terminalStatus: "blocked_policy_boundary",
    occurredAtUtc: input.occurredAtUtc,
    sourcePolicyEngineIdentity,
    sourcePolicyRevision: input.sourcePolicyRevision,
    detectionEvidenceSetId: deriveEvidenceSetId("detection", input.detectionEvidenceIds),
    preservedStateEvidenceSetId: deriveEvidenceSetId("preserved_state", input.preservedStateEvidenceIds),
  }
}

function validateInput(input: AiConsolePolicyBoundaryReportInput) {
  if (!isPlainRecord(input)) throw new Error("ai_console_policy_boundary_report_input_invalid")
  const allowedFields = [
    "boundaryEventId", "boundaryCategory", "prohibitedAction", "failureCode", "affectedScope",
    "affectedTaskId", "affectedExecutionId", "detectionEvidenceIds", "preservedStateEvidenceIds",
    "preservationRequirement", "safeAlternativeRequirement", "terminalStatus", "occurredAtUtc",
    "sourcePolicyEngineIdentity", "sourcePolicyRevision",
  ].sort()
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify(allowedFields)) {
    throw new Error("ai_console_policy_boundary_report_input_field_set_invalid")
  }
  if (!isSha256(input.boundaryEventId)) throw new Error("ai_console_policy_boundary_event_identity_invalid")
  if (!boundaryCategories.includes(input.boundaryCategory)) throw new Error("ai_console_policy_boundary_category_invalid")
  if (!isBoundedText(input.prohibitedAction, 1, 1000) || !isBoundedText(input.affectedScope, 1, 1000)) {
    throw new Error("ai_console_policy_boundary_report_scope_invalid")
  }
  if (!/^[a-z0-9][a-z0-9._:-]{2,127}$/u.test(input.failureCode)) throw new Error("ai_console_policy_boundary_failure_code_invalid")
  if (input.affectedTaskId !== null && !isSha256(input.affectedTaskId)) throw new Error("ai_console_policy_boundary_task_identity_invalid")
  if (input.affectedExecutionId !== null && !isSha256(input.affectedExecutionId)) throw new Error("ai_console_policy_boundary_execution_identity_invalid")
  validateEvidenceIds(input.detectionEvidenceIds, "detection")
  validateEvidenceIds(input.preservedStateEvidenceIds, "preserved_state")
  if (!isBoundedText(input.preservationRequirement, 1, 2000) || !isBoundedText(input.safeAlternativeRequirement, 1, 2000)) {
    throw new Error("ai_console_policy_boundary_report_requirement_invalid")
  }
  if (input.terminalStatus !== "blocked_policy_boundary") throw new Error("ai_console_policy_boundary_terminal_status_invalid")
  if (!isUtcTimestamp(input.occurredAtUtc)) throw new Error("ai_console_policy_boundary_occurred_at_invalid")
  if (input.sourcePolicyEngineIdentity !== sourcePolicyEngineIdentity) throw new Error("ai_console_policy_boundary_source_engine_invalid")
  if (!Number.isInteger(input.sourcePolicyRevision) || input.sourcePolicyRevision < 1) throw new Error("ai_console_policy_boundary_source_revision_invalid")
}

function validateEvidenceIds(values: readonly string[], label: string) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 256 || values.some((value) => !isSha256(value))) {
    throw new Error(`ai_console_policy_boundary_${label}_evidence_invalid`)
  }
  if (new Set(values).size !== values.length || JSON.stringify([...values].sort()) !== JSON.stringify(values)) {
    throw new Error(`ai_console_policy_boundary_${label}_evidence_not_canonical`)
  }
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
      report_count INTEGER NOT NULL CHECK (report_count >= 0),
      created_at_utc TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL,
      head_policy_boundary_report_sha256 TEXT,
      metadata_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS policy_boundary_reports (
      policy_boundary_report_id TEXT PRIMARY KEY,
      report_sequence INTEGER NOT NULL UNIQUE CHECK (report_sequence >= 1),
      boundary_event_id TEXT NOT NULL UNIQUE,
      boundary_category TEXT NOT NULL,
      prohibited_action TEXT NOT NULL,
      failure_code TEXT NOT NULL,
      affected_scope TEXT NOT NULL,
      affected_task_id TEXT,
      affected_execution_id TEXT,
      detection_evidence_set_id TEXT NOT NULL,
      detection_evidence_count INTEGER NOT NULL CHECK (detection_evidence_count >= 1),
      preserved_state_evidence_set_id TEXT NOT NULL,
      preserved_state_evidence_count INTEGER NOT NULL CHECK (preserved_state_evidence_count >= 1),
      preservation_requirement TEXT NOT NULL,
      safe_alternative_requirement TEXT NOT NULL,
      terminal_status TEXT NOT NULL,
      occurred_at_utc TEXT NOT NULL,
      source_policy_engine_identity TEXT NOT NULL,
      source_policy_revision INTEGER NOT NULL CHECK (source_policy_revision >= 1),
      content_sha256 TEXT NOT NULL,
      content_blob BLOB NOT NULL,
      registered_at_utc TEXT NOT NULL,
      previous_policy_boundary_report_sha256 TEXT,
      policy_boundary_report_record_sha256 TEXT NOT NULL
    );
  `)
  verifyDatabaseSchema(database)
  const metadataCount = Number((database.prepare("SELECT COUNT(*) AS count FROM metadata").get() as { count: number }).count)
  if (metadataCount === 0) insertInitialMetadata(database)
  if (metadataCount > 1) throw new Error("ai_console_policy_boundary_report_metadata_cardinality_invalid")
  database.exec("PRAGMA user_version = 1")
  return database
}

function insertInitialMetadata(database: DatabaseSync) {
  const createdAtUtc = new Date().toISOString()
  const unsignedMetadata: Omit<AiConsolePolicyBoundaryReportStoreMetadata, "metadataSha256"> = {
    schemaVersion,
    storeIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity,
    storeRevision: 0,
    reportCount: 0,
    createdAtUtc,
    updatedAtUtc: createdAtUtc,
    headPolicyBoundaryReportSha256: null,
  }
  const metadata = { ...unsignedMetadata, metadataSha256: sha256Text(JSON.stringify(unsignedMetadata)) }
  database.prepare("INSERT INTO metadata VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    metadata.schemaVersion, metadata.storeIdentity, metadata.sourceBoundary, metadata.writerIdentity,
    metadata.storeRevision, metadata.reportCount, metadata.createdAtUtc, metadata.updatedAtUtc,
    metadata.headPolicyBoundaryReportSha256, metadata.metadataSha256,
  )
}

function insertReport(database: DatabaseSync, record: AiConsolePolicyBoundaryReportRecord, contentBlob: Uint8Array) {
  database.prepare(`
    INSERT INTO policy_boundary_reports (
      policy_boundary_report_id, report_sequence, boundary_event_id, boundary_category, prohibited_action,
      failure_code, affected_scope, affected_task_id, affected_execution_id, detection_evidence_set_id,
      detection_evidence_count, preserved_state_evidence_set_id, preserved_state_evidence_count,
      preservation_requirement, safe_alternative_requirement, terminal_status, occurred_at_utc,
      source_policy_engine_identity, source_policy_revision, content_sha256, content_blob, registered_at_utc,
      previous_policy_boundary_report_sha256, policy_boundary_report_record_sha256
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.policyBoundaryReportId, record.reportSequence, record.boundaryEventId, record.boundaryCategory,
    record.prohibitedAction, record.failureCode, record.affectedScope, record.affectedTaskId,
    record.affectedExecutionId, record.detectionEvidenceSetId, record.detectionEvidenceCount,
    record.preservedStateEvidenceSetId, record.preservedStateEvidenceCount, record.preservationRequirement,
    record.safeAlternativeRequirement, record.terminalStatus, record.occurredAtUtc,
    record.sourcePolicyEngineIdentity, record.sourcePolicyRevision, record.contentSha256, contentBlob,
    record.registeredAtUtc, record.previousPolicyBoundaryReportSha256, record.policyBoundaryReportRecordSha256,
  )
}

function updateMetadata(
  database: DatabaseSync,
  metadata: AiConsolePolicyBoundaryReportStoreMetadata,
  record: AiConsolePolicyBoundaryReportRecord,
) {
  const unsignedMetadata: Omit<AiConsolePolicyBoundaryReportStoreMetadata, "metadataSha256"> = {
    schemaVersion,
    storeIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity,
    storeRevision: metadata.storeRevision + 1,
    reportCount: metadata.reportCount + 1,
    createdAtUtc: metadata.createdAtUtc,
    updatedAtUtc: record.registeredAtUtc,
    headPolicyBoundaryReportSha256: record.policyBoundaryReportRecordSha256,
  }
  const metadataSha256 = sha256Text(JSON.stringify(unsignedMetadata))
  const result = database.prepare(`
    UPDATE metadata SET store_revision = ?, report_count = ?, updated_at_utc = ?,
      head_policy_boundary_report_sha256 = ?, metadata_sha256 = ?
    WHERE singleton = 1 AND store_revision = ? AND report_count = ?
  `).run(
    unsignedMetadata.storeRevision, unsignedMetadata.reportCount, unsignedMetadata.updatedAtUtc,
    unsignedMetadata.headPolicyBoundaryReportSha256, metadataSha256, metadata.storeRevision, metadata.reportCount,
  )
  if (Number(result.changes) !== 1) throw new Error("ai_console_policy_boundary_report_metadata_revision_conflict")
}

function readAndVerifyMetadata(database: DatabaseSync): AiConsolePolicyBoundaryReportStoreMetadata {
  const rows = database.prepare("SELECT * FROM metadata ORDER BY singleton ASC").all()
  if (rows.length !== 1) throw new Error("ai_console_policy_boundary_report_metadata_cardinality_invalid")
  const row = rows[0] as Record<string, unknown>
  const metadata: AiConsolePolicyBoundaryReportStoreMetadata = {
    schemaVersion: String(row.schema_version) as typeof schemaVersion,
    storeIdentity: String(row.store_identity) as typeof storeIdentity,
    sourceBoundary: String(row.source_boundary) as "new_ai_console_only",
    writerIdentity: String(row.writer_identity) as typeof writerIdentity,
    storeRevision: Number(row.store_revision),
    reportCount: Number(row.report_count),
    createdAtUtc: String(row.created_at_utc),
    updatedAtUtc: String(row.updated_at_utc),
    headPolicyBoundaryReportSha256: row.head_policy_boundary_report_sha256 === null ? null : String(row.head_policy_boundary_report_sha256),
    metadataSha256: String(row.metadata_sha256),
  }
  if (metadata.schemaVersion !== schemaVersion || metadata.storeIdentity !== storeIdentity || metadata.sourceBoundary !== "new_ai_console_only" || metadata.writerIdentity !== writerIdentity) {
    throw new Error("ai_console_policy_boundary_report_metadata_identity_invalid")
  }
  if (!Number.isInteger(metadata.storeRevision) || metadata.storeRevision < 0 || !Number.isInteger(metadata.reportCount) || metadata.reportCount < 0) {
    throw new Error("ai_console_policy_boundary_report_metadata_revision_invalid")
  }
  if (!isUtcTimestamp(metadata.createdAtUtc) || !isUtcTimestamp(metadata.updatedAtUtc)) throw new Error("ai_console_policy_boundary_report_metadata_time_invalid")
  if (metadata.headPolicyBoundaryReportSha256 !== null && !isSha256(metadata.headPolicyBoundaryReportSha256)) throw new Error("ai_console_policy_boundary_report_metadata_head_invalid")
  const { metadataSha256, ...unsignedMetadata } = metadata
  if (!isSha256(metadataSha256) || sha256Text(JSON.stringify(unsignedMetadata)) !== metadataSha256) throw new Error("ai_console_policy_boundary_report_metadata_sha256_mismatch")
  return metadata
}

function storedReportFromRow(value: unknown): StoredPolicyBoundaryReport {
  const row = value as Record<string, unknown>
  const contentBlob = row.content_blob
  if (!(contentBlob instanceof Uint8Array)) throw new Error("ai_console_policy_boundary_report_blob_invalid")
  return {
    schemaVersion: "ai_console_policy_boundary_report_v1",
    storeIdentity,
    policyBoundaryReportId: String(row.policy_boundary_report_id),
    reportSequence: Number(row.report_sequence),
    boundaryEventId: String(row.boundary_event_id),
    boundaryCategory: String(row.boundary_category) as AiConsolePolicyBoundaryCategory,
    prohibitedAction: String(row.prohibited_action),
    failureCode: String(row.failure_code),
    affectedScope: String(row.affected_scope),
    affectedTaskId: row.affected_task_id === null ? null : String(row.affected_task_id),
    affectedExecutionId: row.affected_execution_id === null ? null : String(row.affected_execution_id),
    detectionEvidenceSetId: String(row.detection_evidence_set_id),
    detectionEvidenceCount: Number(row.detection_evidence_count),
    preservedStateEvidenceSetId: String(row.preserved_state_evidence_set_id),
    preservedStateEvidenceCount: Number(row.preserved_state_evidence_count),
    preservationRequirement: String(row.preservation_requirement),
    safeAlternativeRequirement: String(row.safe_alternative_requirement),
    terminalStatus: String(row.terminal_status) as "blocked_policy_boundary",
    occurredAtUtc: String(row.occurred_at_utc),
    sourcePolicyEngineIdentity: String(row.source_policy_engine_identity) as typeof sourcePolicyEngineIdentity,
    sourcePolicyRevision: Number(row.source_policy_revision),
    contentSha256: String(row.content_sha256),
    registeredAtUtc: String(row.registered_at_utc),
    integrityStatus: "verified",
    previousPolicyBoundaryReportSha256: row.previous_policy_boundary_report_sha256 === null ? null : String(row.previous_policy_boundary_report_sha256),
    policyBoundaryReportRecordSha256: String(row.policy_boundary_report_record_sha256),
    contentBlob,
  }
}

function verifyStoredReport(
  record: StoredPolicyBoundaryReport,
  expectedSequence: number,
  expectedPreviousSha256: string | null,
) {
  if (record.schemaVersion !== "ai_console_policy_boundary_report_v1" || record.storeIdentity !== storeIdentity) throw new Error("ai_console_policy_boundary_report_record_identity_invalid")
  if (record.reportSequence !== expectedSequence || record.previousPolicyBoundaryReportSha256 !== expectedPreviousSha256) throw new Error("ai_console_policy_boundary_report_record_chain_invalid")
  if (!isSha256(record.policyBoundaryReportId) || !isSha256(record.boundaryEventId)) throw new Error("ai_console_policy_boundary_report_binding_invalid")
  if (!boundaryCategories.includes(record.boundaryCategory) || record.terminalStatus !== "blocked_policy_boundary") throw new Error("ai_console_policy_boundary_report_enum_invalid")
  if (!isSha256(record.detectionEvidenceSetId) || !isSha256(record.preservedStateEvidenceSetId)) throw new Error("ai_console_policy_boundary_report_evidence_set_invalid")
  if (!Number.isInteger(record.detectionEvidenceCount) || record.detectionEvidenceCount < 1 || !Number.isInteger(record.preservedStateEvidenceCount) || record.preservedStateEvidenceCount < 1) throw new Error("ai_console_policy_boundary_report_evidence_count_invalid")
  if (!isUtcTimestamp(record.occurredAtUtc) || !isUtcTimestamp(record.registeredAtUtc)) throw new Error("ai_console_policy_boundary_report_time_invalid")
  const payloadText = Buffer.from(record.contentBlob).toString("utf8")
  if (sha256Text(payloadText) !== record.contentSha256 || record.policyBoundaryReportId !== sha256Text(`ai_console_policy_boundary_report_v1\n${record.contentSha256}`)) throw new Error("ai_console_policy_boundary_report_content_identity_mismatch")
  let payload: unknown
  try { payload = JSON.parse(payloadText) } catch { throw new Error("ai_console_policy_boundary_report_payload_invalid_json") }
  if (!isPlainRecord(payload) || payload.schemaVersion !== "ai_console_policy_boundary_report_payload_v1") throw new Error("ai_console_policy_boundary_report_payload_shape_invalid")
  const payloadInput = payload as unknown as AiConsolePolicyBoundaryReportInput
  const { schemaVersion: _schemaVersion, detectionEvidenceSetId, preservedStateEvidenceSetId, ...inputFields } = payload
  void _schemaVersion
  validateInput(inputFields as AiConsolePolicyBoundaryReportInput)
  if (detectionEvidenceSetId !== record.detectionEvidenceSetId || preservedStateEvidenceSetId !== record.preservedStateEvidenceSetId) throw new Error("ai_console_policy_boundary_report_evidence_binding_mismatch")
  if (deriveEvidenceSetId("detection", payloadInput.detectionEvidenceIds) !== record.detectionEvidenceSetId || payloadInput.detectionEvidenceIds.length !== record.detectionEvidenceCount) throw new Error("ai_console_policy_boundary_report_detection_binding_mismatch")
  if (deriveEvidenceSetId("preserved_state", payloadInput.preservedStateEvidenceIds) !== record.preservedStateEvidenceSetId || payloadInput.preservedStateEvidenceIds.length !== record.preservedStateEvidenceCount) throw new Error("ai_console_policy_boundary_report_preservation_binding_mismatch")
  const expectedPayload = createPayload(payloadInput)
  if (JSON.stringify(payload) !== JSON.stringify(expectedPayload)) throw new Error("ai_console_policy_boundary_report_payload_binding_mismatch")
  if (
    record.boundaryEventId !== payloadInput.boundaryEventId || record.boundaryCategory !== payloadInput.boundaryCategory ||
    record.prohibitedAction !== payloadInput.prohibitedAction || record.failureCode !== payloadInput.failureCode ||
    record.affectedScope !== payloadInput.affectedScope || record.affectedTaskId !== payloadInput.affectedTaskId ||
    record.affectedExecutionId !== payloadInput.affectedExecutionId || record.preservationRequirement !== payloadInput.preservationRequirement ||
    record.safeAlternativeRequirement !== payloadInput.safeAlternativeRequirement || record.occurredAtUtc !== payloadInput.occurredAtUtc ||
    record.sourcePolicyEngineIdentity !== payloadInput.sourcePolicyEngineIdentity || record.sourcePolicyRevision !== payloadInput.sourcePolicyRevision
  ) throw new Error("ai_console_policy_boundary_report_record_payload_mismatch")
  const { policyBoundaryReportRecordSha256, contentBlob: _contentBlob, ...unsignedRecord } = record
  void _contentBlob
  if (!isSha256(policyBoundaryReportRecordSha256) || sha256Text(JSON.stringify(unsignedRecord)) !== policyBoundaryReportRecordSha256) throw new Error("ai_console_policy_boundary_report_record_sha256_mismatch")
}

function stripContentBlob(record: StoredPolicyBoundaryReport): AiConsolePolicyBoundaryReportRecord {
  const { contentBlob: _contentBlob, ...publicRecord } = record
  void _contentBlob
  return publicRecord
}

function verifyDatabaseSchema(database: DatabaseSync) {
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String((row as { name: unknown }).name))
  if (JSON.stringify(tables) !== JSON.stringify(["metadata", "policy_boundary_reports"])) throw new Error("ai_console_policy_boundary_report_table_set_invalid")
  verifyColumnSet(database, "metadata", ["singleton", "schema_version", "store_identity", "source_boundary", "writer_identity", "store_revision", "report_count", "created_at_utc", "updated_at_utc", "head_policy_boundary_report_sha256", "metadata_sha256"])
  verifyColumnSet(database, "policy_boundary_reports", ["policy_boundary_report_id", "report_sequence", "boundary_event_id", "boundary_category", "prohibited_action", "failure_code", "affected_scope", "affected_task_id", "affected_execution_id", "detection_evidence_set_id", "detection_evidence_count", "preserved_state_evidence_set_id", "preserved_state_evidence_count", "preservation_requirement", "safe_alternative_requirement", "terminal_status", "occurred_at_utc", "source_policy_engine_identity", "source_policy_revision", "content_sha256", "content_blob", "registered_at_utc", "previous_policy_boundary_report_sha256", "policy_boundary_report_record_sha256"])
}

function verifyColumnSet(database: DatabaseSync, tableName: string, expectedColumns: readonly string[]) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => String((row as { name: unknown }).name))
  if (JSON.stringify(columns) !== JSON.stringify(expectedColumns)) throw new Error(`ai_console_policy_boundary_report_column_set_invalid:${tableName}`)
}

function verifyDatabaseIntegrity(database: DatabaseSync) {
  const result = database.prepare("PRAGMA integrity_check").get() as Record<string, unknown>
  if (!result || !Object.values(result).includes("ok")) throw new Error("ai_console_policy_boundary_report_sqlite_integrity_failure")
}

function verifyDatabaseVersion(database: DatabaseSync) {
  const result = database.prepare("PRAGMA user_version").get() as Record<string, unknown>
  if (!result || !Object.values(result).includes(1)) throw new Error("ai_console_policy_boundary_report_sqlite_version_invalid")
}

function deriveEvidenceSetId(setType: "detection" | "preserved_state", evidenceIds: readonly string[]): string {
  return sha256Text(`ai_console_policy_boundary_${setType}_evidence_set_v1\n${JSON.stringify(evidenceIds)}`)
}

function getStorePath(): string {
  return path.join(process.cwd(), ...policyBoundaryReportStoreLogicalPath.split("/"))
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

const reportSelectSql = `
  SELECT policy_boundary_report_id, report_sequence, boundary_event_id, boundary_category, prohibited_action,
    failure_code, affected_scope, affected_task_id, affected_execution_id, detection_evidence_set_id,
    detection_evidence_count, preserved_state_evidence_set_id, preserved_state_evidence_count,
    preservation_requirement, safe_alternative_requirement, terminal_status, occurred_at_utc,
    source_policy_engine_identity, source_policy_revision, content_sha256, content_blob, registered_at_utc,
    previous_policy_boundary_report_sha256, policy_boundary_report_record_sha256
  FROM policy_boundary_reports
`
