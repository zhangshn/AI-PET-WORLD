import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import {
  controlEventLedgerHeadLogicalPath,
  controlEventLedgerLogicalPath,
  readAiConsoleControlEventLedger,
} from "./control-event-ledger"
import type { AiConsoleControlCommandReceipt } from "./control-command-service"
import {
  controlTransactionStoreLogicalPath,
  readAiConsoleControlTransactionStore,
  type AiConsoleControlTransaction,
} from "./control-transaction-store"

export const formalEvidenceIndexLogicalPath = ".runtime/ai-console/evidence/formal-evidence-index-v1.sqlite"
const indexIdentity = "ai_console_formal_evidence_index"
const writerIdentity = "ai_console_formal_evidence_index_writer_v1"
const schemaVersion = "ai_console_formal_evidence_index_v1"
const fixedEvidenceTypes = [
  "command_receipt",
  "control_event_ledger",
  "control_event_ledger_head",
  "control_transaction_registry",
] as const

export type AiConsoleFormalEvidenceType = (typeof fixedEvidenceTypes)[number]

export type AiConsoleFormalEvidenceRecord = {
  schemaVersion: "ai_console_formal_evidence_artifact_v1"
  indexIdentity: typeof indexIdentity
  evidenceId: string
  evidenceSequence: number
  registrationId: string
  evidenceType: AiConsoleFormalEvidenceType
  logicalPath: string
  mediaType: "application/json" | "application/x-ndjson" | "application/vnd.sqlite3"
  contentByteLength: number
  contentSha256: string
  sourceRevision: number
  sourceBindingSha256: string
  transactionId: string
  commandId: string
  registeredAtUtc: string
  storageMode: "embedded_immutable_blob"
  integrityStatus: "verified"
  previousEvidenceRecordSha256: string | null
  evidenceRecordSha256: string
}

export type AiConsoleFormalEvidenceRegistration = {
  schemaVersion: "ai_console_formal_evidence_registration_v1"
  indexIdentity: typeof indexIdentity
  registrationId: string
  indexRevision: number
  transactionId: string
  transactionSequence: number
  commandId: string
  evidenceRecordCount: 4
  firstEvidenceSequence: number
  lastEvidenceSequence: number
  registrationEvidenceHeadSha256: string
  registeredAtUtc: string
  previousRegistrationSha256: string | null
  registrationRecordSha256: string
}

export type AiConsoleFormalEvidenceIndexMetadata = {
  schemaVersion: typeof schemaVersion
  indexIdentity: typeof indexIdentity
  sourceBoundary: "new_ai_console_only"
  writerIdentity: typeof writerIdentity
  indexRevision: number
  evidenceRecordCount: number
  firstEligibleTransactionSequence: number
  createdAtUtc: string
  updatedAtUtc: string
  metadataSha256: string
}

export type AiConsoleFormalEvidenceIndexRead =
  | {
      status: "connected"
      records: readonly AiConsoleFormalEvidenceRecord[]
      registrations: readonly AiConsoleFormalEvidenceRegistration[]
      metadata: AiConsoleFormalEvidenceIndexMetadata
    }
  | { status: "not_connected"; reasonCode: "ai_console_formal_evidence_index_not_initialized" }
  | { status: "unknown_or_stale"; reasonCode: string }

export type AiConsoleFormalEvidenceArtifactRead =
  | { status: "connected"; record: AiConsoleFormalEvidenceRecord; contentBytes: Uint8Array }
  | { status: "not_found"; reasonCode: "ai_console_formal_evidence_artifact_not_found" }
  | { status: "not_connected"; reasonCode: "ai_console_formal_evidence_index_not_initialized" }
  | { status: "unknown_or_stale"; reasonCode: string }

type EvidenceSnapshot = {
  evidenceType: AiConsoleFormalEvidenceType
  logicalPath: string
  mediaType: AiConsoleFormalEvidenceRecord["mediaType"]
  content: Uint8Array
  sourceRevision: number
  sourceBindingSha256: string
}

type StoredEvidenceRecord = AiConsoleFormalEvidenceRecord & { contentBlob: Uint8Array }

export function isAiConsoleFormalEvidenceIndexInitialized(): boolean {
  return existsSync(getIndexPath())
}

export async function ensureAiConsoleFormalEvidenceRegistration(
  receipt: AiConsoleControlCommandReceipt,
  transaction: AiConsoleControlTransaction,
): Promise<{ registration: AiConsoleFormalEvidenceRegistration; records: readonly AiConsoleFormalEvidenceRecord[] }> {
  if (receipt.commandId !== transaction.commandId || receipt.receiptSha256 !== transaction.receiptSha256) {
    throw new Error("ai_console_formal_evidence_command_transaction_binding_conflict")
  }

  const snapshots = await readFormalSurfaceSnapshots(receipt, transaction)
  const database = openWritableDatabase(transaction.transactionSequence)
  let registration: AiConsoleFormalEvidenceRegistration
  try {
    database.exec("BEGIN IMMEDIATE")
    const metadata = readAndVerifyMetadata(database)
    const expectedRegistrationId = deriveRegistrationId(transaction.transactionId)
    const existingRow = database.prepare(`${registrationSelectSql} WHERE transaction_id = ?`).get(transaction.transactionId)
    if (existingRow) {
      registration = registrationFromRow(existingRow)
      const existingRecords = readStoredRecordsForRegistration(database, registration.registrationId)
      verifyRegistration(registration, existingRecords, registration.indexRevision, registration.previousRegistrationSha256)
      if (registration.commandId !== receipt.commandId || registration.registrationId !== expectedRegistrationId) {
        throw new Error("ai_console_formal_evidence_existing_registration_binding_conflict")
      }
    } else {
      if (transaction.transactionSequence < metadata.firstEligibleTransactionSequence) {
        throw new Error("ai_console_formal_evidence_pre_v7_transaction_not_eligible")
      }
      const previousRegistrationRow = database.prepare(`${registrationSelectSql} ORDER BY index_revision DESC LIMIT 1`).get()
      const previousRegistration = previousRegistrationRow ? registrationFromRow(previousRegistrationRow) : null
      const previousEvidenceRow = database.prepare(`${evidenceSelectSql} ORDER BY evidence_sequence DESC LIMIT 1`).get()
      const previousEvidence = previousEvidenceRow ? storedEvidenceRecordFromRow(previousEvidenceRow) : null
      const registeredAtUtc = new Date().toISOString()
      const registrationId = expectedRegistrationId
      const records = createEvidenceRecords({
        snapshots,
        registrationId,
        transaction,
        registeredAtUtc,
        firstSequence: metadata.evidenceRecordCount + 1,
        previousEvidenceRecordSha256: previousEvidence?.evidenceRecordSha256 ?? null,
      })
      const unsignedRegistration: Omit<AiConsoleFormalEvidenceRegistration, "registrationRecordSha256"> = {
        schemaVersion: "ai_console_formal_evidence_registration_v1",
        indexIdentity,
        registrationId,
        indexRevision: metadata.indexRevision + 1,
        transactionId: transaction.transactionId,
        transactionSequence: transaction.transactionSequence,
        commandId: transaction.commandId,
        evidenceRecordCount: 4,
        firstEvidenceSequence: records[0].evidenceSequence,
        lastEvidenceSequence: records.at(-1)!.evidenceSequence,
        registrationEvidenceHeadSha256: records.at(-1)!.evidenceRecordSha256,
        registeredAtUtc,
        previousRegistrationSha256: previousRegistration?.registrationRecordSha256 ?? null,
      }
      registration = {
        ...unsignedRegistration,
        registrationRecordSha256: sha256Text(JSON.stringify(unsignedRegistration)),
      }
      insertRegistration(database, registration)
      records.forEach((record, index) => insertEvidenceRecord(database, record, snapshots[index].content))
      updateMetadata(database, metadata, registration, records.length)
    }
    database.exec("COMMIT")
  } catch (error) {
    try {
      database.exec("ROLLBACK")
    } catch {
      // SQLite may already have closed the transaction after a fatal statement error.
    }
    throw error
  } finally {
    database.close()
  }

  const verified = await readAiConsoleFormalEvidenceIndex()
  if (verified.status !== "connected") throw new Error("ai_console_formal_evidence_index_post_write_verification_failed")
  const verifiedRegistration = verified.registrations.find((candidate) => candidate.registrationId === registration.registrationId)
  const verifiedRecords = verified.records.filter((record) => record.registrationId === registration.registrationId)
  if (!verifiedRegistration || verifiedRegistration.registrationRecordSha256 !== registration.registrationRecordSha256 || verifiedRecords.length !== 4) {
    throw new Error("ai_console_formal_evidence_index_post_write_binding_failed")
  }
  return { registration: verifiedRegistration, records: verifiedRecords }
}

export async function readAiConsoleFormalEvidenceIndex(): Promise<AiConsoleFormalEvidenceIndexRead> {
  if (!isAiConsoleFormalEvidenceIndexInitialized()) {
    return { status: "not_connected", reasonCode: "ai_console_formal_evidence_index_not_initialized" }
  }
  let database: DatabaseSync | null = null
  try {
    database = new DatabaseSync(getIndexPath(), { readOnly: true })
    database.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON")
    verifyDatabaseSchema(database)
    verifyDatabaseVersion(database)
    verifyDatabaseIntegrity(database)
    const metadata = readAndVerifyMetadata(database)
    const storedRecords = database.prepare(`${evidenceSelectSql} ORDER BY evidence_sequence ASC`).all().map(storedEvidenceRecordFromRow)
    let previousEvidenceRecordSha256: string | null = null
    storedRecords.forEach((record, index) => {
      verifyEvidenceRecord(record, index + 1, previousEvidenceRecordSha256)
      previousEvidenceRecordSha256 = record.evidenceRecordSha256
    })

    const registrations = database.prepare(`${registrationSelectSql} ORDER BY index_revision ASC`).all().map(registrationFromRow)
    let previousRegistrationSha256: string | null = null
    registrations.forEach((registration, index) => {
      const registrationRecords = storedRecords.filter((record) => record.registrationId === registration.registrationId)
      verifyRegistration(registration, registrationRecords, index + 1, previousRegistrationSha256)
      previousRegistrationSha256 = registration.registrationRecordSha256
    })
    if (metadata.indexRevision !== registrations.length || metadata.evidenceRecordCount !== storedRecords.length) {
      throw new Error("ai_console_formal_evidence_index_revision_mismatch")
    }
    if (registrations.length > 0 && metadata.firstEligibleTransactionSequence !== registrations[0].transactionSequence) {
      throw new Error("ai_console_formal_evidence_first_eligible_transaction_mismatch")
    }

    return {
      status: "connected",
      records: storedRecords.map(stripContentBlob),
      registrations,
      metadata,
    }
  } catch (error) {
    return {
      status: "unknown_or_stale",
      reasonCode: error instanceof Error ? error.message : "ai_console_formal_evidence_index_read_failed",
    }
  } finally {
    database?.close()
  }
}

export async function readAiConsoleFormalEvidenceArtifact(evidenceId: string): Promise<AiConsoleFormalEvidenceArtifactRead> {
  if (!isSha256(evidenceId)) return { status: "not_found", reasonCode: "ai_console_formal_evidence_artifact_not_found" }
  const index = await readAiConsoleFormalEvidenceIndex()
  if (index.status !== "connected") return index
  const verifiedPublicRecord = index.records.find((record) => record.evidenceId === evidenceId)
  if (!verifiedPublicRecord) return { status: "not_found", reasonCode: "ai_console_formal_evidence_artifact_not_found" }

  let database: DatabaseSync | null = null
  try {
    database = new DatabaseSync(getIndexPath(), { readOnly: true })
    database.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON")
    const row = database.prepare(`${evidenceSelectSql} WHERE evidence_id = ?`).get(evidenceId)
    if (!row) return { status: "not_found", reasonCode: "ai_console_formal_evidence_artifact_not_found" }
    const storedRecord = storedEvidenceRecordFromRow(row)
    verifyEvidenceRecord(storedRecord, storedRecord.evidenceSequence, storedRecord.previousEvidenceRecordSha256)
    if (storedRecord.evidenceRecordSha256 !== verifiedPublicRecord.evidenceRecordSha256 || storedRecord.contentSha256 !== verifiedPublicRecord.contentSha256) {
      throw new Error("ai_console_formal_evidence_artifact_public_binding_conflict")
    }
    return {
      status: "connected",
      record: stripContentBlob(storedRecord),
      contentBytes: Uint8Array.from(storedRecord.contentBlob),
    }
  } catch (error) {
    return {
      status: "unknown_or_stale",
      reasonCode: error instanceof Error ? error.message : "ai_console_formal_evidence_artifact_read_failed",
    }
  } finally {
    database?.close()
  }
}

async function readFormalSurfaceSnapshots(
  receipt: AiConsoleControlCommandReceipt,
  transaction: AiConsoleControlTransaction,
): Promise<readonly EvidenceSnapshot[]> {
  const [ledger, transactionStore] = await Promise.all([
    readAiConsoleControlEventLedger(),
    readAiConsoleControlTransactionStore(),
  ])
  if (ledger.status !== "connected") throw new Error("ai_console_formal_evidence_event_ledger_unavailable")
  if (transactionStore.status !== "connected") throw new Error("ai_console_formal_evidence_transaction_store_unavailable")
  const persistedTransaction = transactionStore.records.find((candidate) => candidate.transactionId === transaction.transactionId)
  const persistedEvent = ledger.events.find((candidate) => candidate.transactionId === transaction.transactionId)
  if (!persistedTransaction || persistedTransaction.transactionRecordSha256 !== transaction.transactionRecordSha256) {
    throw new Error("ai_console_formal_evidence_transaction_not_registered")
  }
  if (!persistedEvent || persistedEvent.commandId !== receipt.commandId || persistedEvent.evidenceSha256 !== receipt.receiptSha256) {
    throw new Error("ai_console_formal_evidence_event_binding_conflict")
  }
  const latestTransaction = transactionStore.records.at(-1)
  if (!latestTransaction) throw new Error("ai_console_formal_evidence_transaction_store_empty")

  const receiptPath = `.runtime/ai-console/control/command-receipts/${receipt.commandId}.json`
  const snapshots: readonly EvidenceSnapshot[] = [
    {
      evidenceType: "command_receipt",
      logicalPath: receiptPath,
      mediaType: "application/json",
      content: readLogicalFile(receiptPath),
      sourceRevision: 1,
      sourceBindingSha256: receipt.receiptSha256,
    },
    {
      evidenceType: "control_event_ledger",
      logicalPath: controlEventLedgerLogicalPath,
      mediaType: "application/x-ndjson",
      content: readLogicalFile(controlEventLedgerLogicalPath),
      sourceRevision: ledger.head.ledgerRevision,
      sourceBindingSha256: ledger.head.headEventSha256,
    },
    {
      evidenceType: "control_event_ledger_head",
      logicalPath: controlEventLedgerHeadLogicalPath,
      mediaType: "application/json",
      content: readLogicalFile(controlEventLedgerHeadLogicalPath),
      sourceRevision: ledger.head.ledgerRevision,
      sourceBindingSha256: ledger.head.headRecordSha256,
    },
    {
      evidenceType: "control_transaction_registry",
      logicalPath: controlTransactionStoreLogicalPath,
      mediaType: "application/vnd.sqlite3",
      content: readLogicalFile(controlTransactionStoreLogicalPath),
      sourceRevision: transactionStore.metadata.registryRevision,
      sourceBindingSha256: latestTransaction.transactionRecordSha256,
    },
  ]
  return snapshots
}

function createEvidenceRecords(input: {
  snapshots: readonly EvidenceSnapshot[]
  registrationId: string
  transaction: AiConsoleControlTransaction
  registeredAtUtc: string
  firstSequence: number
  previousEvidenceRecordSha256: string | null
}): StoredEvidenceRecord[] {
  let previousEvidenceRecordSha256 = input.previousEvidenceRecordSha256
  return input.snapshots.map((snapshot, index) => {
    const contentSha256 = sha256Bytes(snapshot.content)
    const evidenceId = deriveEvidenceId(snapshot.evidenceType, snapshot.logicalPath, contentSha256)
    const unsignedRecord: Omit<AiConsoleFormalEvidenceRecord, "evidenceRecordSha256"> = {
      schemaVersion: "ai_console_formal_evidence_artifact_v1",
      indexIdentity,
      evidenceId,
      evidenceSequence: input.firstSequence + index,
      registrationId: input.registrationId,
      evidenceType: snapshot.evidenceType,
      logicalPath: snapshot.logicalPath,
      mediaType: snapshot.mediaType,
      contentByteLength: snapshot.content.byteLength,
      contentSha256,
      sourceRevision: snapshot.sourceRevision,
      sourceBindingSha256: snapshot.sourceBindingSha256,
      transactionId: input.transaction.transactionId,
      commandId: input.transaction.commandId,
      registeredAtUtc: input.registeredAtUtc,
      storageMode: "embedded_immutable_blob",
      integrityStatus: "verified",
      previousEvidenceRecordSha256,
    }
    const record: StoredEvidenceRecord = {
      ...unsignedRecord,
      evidenceRecordSha256: sha256Text(JSON.stringify(unsignedRecord)),
      contentBlob: snapshot.content,
    }
    previousEvidenceRecordSha256 = record.evidenceRecordSha256
    return record
  })
}

function openWritableDatabase(firstEligibleTransactionSequence: number): DatabaseSync {
  const indexPath = getIndexPath()
  mkdirSync(path.dirname(indexPath), { recursive: true })
  const database = new DatabaseSync(indexPath)
  database.exec("PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000")
  database.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      schema_version TEXT NOT NULL,
      index_identity TEXT NOT NULL,
      source_boundary TEXT NOT NULL,
      writer_identity TEXT NOT NULL,
      index_revision INTEGER NOT NULL CHECK (index_revision >= 0),
      evidence_record_count INTEGER NOT NULL CHECK (evidence_record_count >= 0),
      first_eligible_transaction_sequence INTEGER NOT NULL CHECK (first_eligible_transaction_sequence >= 1),
      created_at_utc TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL,
      metadata_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS registration_batches (
      registration_id TEXT PRIMARY KEY,
      index_revision INTEGER NOT NULL UNIQUE CHECK (index_revision >= 1),
      transaction_id TEXT NOT NULL UNIQUE,
      transaction_sequence INTEGER NOT NULL UNIQUE CHECK (transaction_sequence >= 1),
      command_id TEXT NOT NULL UNIQUE,
      evidence_record_count INTEGER NOT NULL CHECK (evidence_record_count = 4),
      first_evidence_sequence INTEGER NOT NULL UNIQUE CHECK (first_evidence_sequence >= 1),
      last_evidence_sequence INTEGER NOT NULL UNIQUE CHECK (last_evidence_sequence >= first_evidence_sequence),
      registration_evidence_head_sha256 TEXT NOT NULL,
      registered_at_utc TEXT NOT NULL,
      previous_registration_sha256 TEXT,
      registration_record_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS formal_evidence_records (
      evidence_id TEXT PRIMARY KEY,
      evidence_sequence INTEGER NOT NULL UNIQUE CHECK (evidence_sequence >= 1),
      registration_id TEXT NOT NULL REFERENCES registration_batches(registration_id),
      evidence_type TEXT NOT NULL CHECK (evidence_type IN ('command_receipt', 'control_event_ledger', 'control_event_ledger_head', 'control_transaction_registry')),
      logical_path TEXT NOT NULL,
      media_type TEXT NOT NULL,
      content_byte_length INTEGER NOT NULL CHECK (content_byte_length >= 1),
      content_sha256 TEXT NOT NULL,
      content_blob BLOB NOT NULL,
      source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
      source_binding_sha256 TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      command_id TEXT NOT NULL,
      registered_at_utc TEXT NOT NULL,
      previous_evidence_record_sha256 TEXT,
      evidence_record_sha256 TEXT NOT NULL,
      UNIQUE (registration_id, evidence_type)
    );
  `)
  verifyDatabaseSchema(database)
  const metadataCount = Number((database.prepare("SELECT COUNT(*) AS count FROM metadata").get() as { count: number }).count)
  if (metadataCount === 0) insertInitialMetadata(database, firstEligibleTransactionSequence)
  if (metadataCount > 1) throw new Error("ai_console_formal_evidence_metadata_cardinality_invalid")
  database.exec("PRAGMA user_version = 1")
  return database
}

function insertInitialMetadata(database: DatabaseSync, firstEligibleTransactionSequence: number) {
  const createdAtUtc = new Date().toISOString()
  const unsignedMetadata: Omit<AiConsoleFormalEvidenceIndexMetadata, "metadataSha256"> = {
    schemaVersion,
    indexIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity,
    indexRevision: 0,
    evidenceRecordCount: 0,
    firstEligibleTransactionSequence,
    createdAtUtc,
    updatedAtUtc: createdAtUtc,
  }
  const metadata = { ...unsignedMetadata, metadataSha256: sha256Text(JSON.stringify(unsignedMetadata)) }
  database.prepare(`
    INSERT INTO metadata (
      singleton, schema_version, index_identity, source_boundary, writer_identity, index_revision,
      evidence_record_count, first_eligible_transaction_sequence, created_at_utc, updated_at_utc, metadata_sha256
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    metadata.schemaVersion,
    metadata.indexIdentity,
    metadata.sourceBoundary,
    metadata.writerIdentity,
    metadata.indexRevision,
    metadata.evidenceRecordCount,
    metadata.firstEligibleTransactionSequence,
    metadata.createdAtUtc,
    metadata.updatedAtUtc,
    metadata.metadataSha256,
  )
}

function updateMetadata(
  database: DatabaseSync,
  metadata: AiConsoleFormalEvidenceIndexMetadata,
  registration: AiConsoleFormalEvidenceRegistration,
  addedRecordCount: number,
) {
  const unsignedMetadata: Omit<AiConsoleFormalEvidenceIndexMetadata, "metadataSha256"> = {
    schemaVersion,
    indexIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity,
    indexRevision: registration.indexRevision,
    evidenceRecordCount: metadata.evidenceRecordCount + addedRecordCount,
    firstEligibleTransactionSequence: metadata.firstEligibleTransactionSequence,
    createdAtUtc: metadata.createdAtUtc,
    updatedAtUtc: registration.registeredAtUtc,
  }
  const metadataSha256 = sha256Text(JSON.stringify(unsignedMetadata))
  const result = database.prepare(`
    UPDATE metadata SET index_revision = ?, evidence_record_count = ?, updated_at_utc = ?, metadata_sha256 = ?
    WHERE singleton = 1 AND index_revision = ? AND evidence_record_count = ?
  `).run(
    unsignedMetadata.indexRevision,
    unsignedMetadata.evidenceRecordCount,
    unsignedMetadata.updatedAtUtc,
    metadataSha256,
    metadata.indexRevision,
    metadata.evidenceRecordCount,
  )
  if (Number(result.changes) !== 1) throw new Error("ai_console_formal_evidence_metadata_revision_conflict")
}

function insertRegistration(database: DatabaseSync, registration: AiConsoleFormalEvidenceRegistration) {
  database.prepare(`
    INSERT INTO registration_batches (
      registration_id, index_revision, transaction_id, transaction_sequence, command_id, evidence_record_count,
      first_evidence_sequence, last_evidence_sequence, registration_evidence_head_sha256, registered_at_utc,
      previous_registration_sha256, registration_record_sha256
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    registration.registrationId,
    registration.indexRevision,
    registration.transactionId,
    registration.transactionSequence,
    registration.commandId,
    registration.evidenceRecordCount,
    registration.firstEvidenceSequence,
    registration.lastEvidenceSequence,
    registration.registrationEvidenceHeadSha256,
    registration.registeredAtUtc,
    registration.previousRegistrationSha256,
    registration.registrationRecordSha256,
  )
}

function insertEvidenceRecord(database: DatabaseSync, record: AiConsoleFormalEvidenceRecord, content: Uint8Array) {
  database.prepare(`
    INSERT INTO formal_evidence_records (
      evidence_id, evidence_sequence, registration_id, evidence_type, logical_path, media_type,
      content_byte_length, content_sha256, content_blob, source_revision, source_binding_sha256,
      transaction_id, command_id, registered_at_utc, previous_evidence_record_sha256, evidence_record_sha256
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.evidenceId,
    record.evidenceSequence,
    record.registrationId,
    record.evidenceType,
    record.logicalPath,
    record.mediaType,
    record.contentByteLength,
    record.contentSha256,
    content,
    record.sourceRevision,
    record.sourceBindingSha256,
    record.transactionId,
    record.commandId,
    record.registeredAtUtc,
    record.previousEvidenceRecordSha256,
    record.evidenceRecordSha256,
  )
}

function readAndVerifyMetadata(database: DatabaseSync): AiConsoleFormalEvidenceIndexMetadata {
  const rows = database.prepare("SELECT * FROM metadata ORDER BY singleton ASC").all()
  if (rows.length !== 1) throw new Error("ai_console_formal_evidence_metadata_cardinality_invalid")
  const row = rows[0] as Record<string, unknown>
  const metadata: AiConsoleFormalEvidenceIndexMetadata = {
    schemaVersion: String(row.schema_version) as typeof schemaVersion,
    indexIdentity: String(row.index_identity) as typeof indexIdentity,
    sourceBoundary: String(row.source_boundary) as "new_ai_console_only",
    writerIdentity: String(row.writer_identity) as typeof writerIdentity,
    indexRevision: Number(row.index_revision),
    evidenceRecordCount: Number(row.evidence_record_count),
    firstEligibleTransactionSequence: Number(row.first_eligible_transaction_sequence),
    createdAtUtc: String(row.created_at_utc),
    updatedAtUtc: String(row.updated_at_utc),
    metadataSha256: String(row.metadata_sha256),
  }
  if (metadata.schemaVersion !== schemaVersion || metadata.indexIdentity !== indexIdentity) throw new Error("ai_console_formal_evidence_metadata_identity_invalid")
  if (metadata.sourceBoundary !== "new_ai_console_only" || metadata.writerIdentity !== writerIdentity) throw new Error("ai_console_formal_evidence_metadata_source_invalid")
  if (!Number.isInteger(metadata.indexRevision) || metadata.indexRevision < 0 || !Number.isInteger(metadata.evidenceRecordCount) || metadata.evidenceRecordCount < 0) throw new Error("ai_console_formal_evidence_metadata_revision_invalid")
  if (!Number.isInteger(metadata.firstEligibleTransactionSequence) || metadata.firstEligibleTransactionSequence < 1) throw new Error("ai_console_formal_evidence_first_eligible_transaction_invalid")
  if (Number.isNaN(Date.parse(metadata.createdAtUtc)) || Number.isNaN(Date.parse(metadata.updatedAtUtc))) throw new Error("ai_console_formal_evidence_metadata_time_invalid")
  const { metadataSha256, ...unsignedMetadata } = metadata
  if (!isSha256(metadataSha256) || sha256Text(JSON.stringify(unsignedMetadata)) !== metadataSha256) throw new Error("ai_console_formal_evidence_metadata_sha256_mismatch")
  return metadata
}

function storedEvidenceRecordFromRow(value: unknown): StoredEvidenceRecord {
  const row = value as Record<string, unknown>
  const blob = row.content_blob
  if (!(blob instanceof Uint8Array)) throw new Error("ai_console_formal_evidence_blob_invalid")
  return {
    schemaVersion: "ai_console_formal_evidence_artifact_v1",
    indexIdentity,
    evidenceId: String(row.evidence_id),
    evidenceSequence: Number(row.evidence_sequence),
    registrationId: String(row.registration_id),
    evidenceType: String(row.evidence_type) as AiConsoleFormalEvidenceType,
    logicalPath: String(row.logical_path),
    mediaType: String(row.media_type) as AiConsoleFormalEvidenceRecord["mediaType"],
    contentByteLength: Number(row.content_byte_length),
    contentSha256: String(row.content_sha256),
    sourceRevision: Number(row.source_revision),
    sourceBindingSha256: String(row.source_binding_sha256),
    transactionId: String(row.transaction_id),
    commandId: String(row.command_id),
    registeredAtUtc: String(row.registered_at_utc),
    storageMode: "embedded_immutable_blob",
    integrityStatus: "verified",
    previousEvidenceRecordSha256: row.previous_evidence_record_sha256 === null ? null : String(row.previous_evidence_record_sha256),
    evidenceRecordSha256: String(row.evidence_record_sha256),
    contentBlob: blob,
  }
}

function registrationFromRow(value: unknown): AiConsoleFormalEvidenceRegistration {
  const row = value as Record<string, unknown>
  return {
    schemaVersion: "ai_console_formal_evidence_registration_v1",
    indexIdentity,
    registrationId: String(row.registration_id),
    indexRevision: Number(row.index_revision),
    transactionId: String(row.transaction_id),
    transactionSequence: Number(row.transaction_sequence),
    commandId: String(row.command_id),
    evidenceRecordCount: Number(row.evidence_record_count) as 4,
    firstEvidenceSequence: Number(row.first_evidence_sequence),
    lastEvidenceSequence: Number(row.last_evidence_sequence),
    registrationEvidenceHeadSha256: String(row.registration_evidence_head_sha256),
    registeredAtUtc: String(row.registered_at_utc),
    previousRegistrationSha256: row.previous_registration_sha256 === null ? null : String(row.previous_registration_sha256),
    registrationRecordSha256: String(row.registration_record_sha256),
  }
}

function verifyEvidenceRecord(record: StoredEvidenceRecord, expectedSequence: number, expectedPreviousSha256: string | null) {
  if (record.schemaVersion !== "ai_console_formal_evidence_artifact_v1" || record.indexIdentity !== indexIdentity) throw new Error("ai_console_formal_evidence_record_identity_invalid")
  if (record.evidenceSequence !== expectedSequence || record.previousEvidenceRecordSha256 !== expectedPreviousSha256) throw new Error("ai_console_formal_evidence_record_chain_invalid")
  if (!fixedEvidenceTypes.includes(record.evidenceType)) throw new Error("ai_console_formal_evidence_type_invalid")
  if (!record.logicalPath.startsWith(".runtime/ai-console/control/")) throw new Error("ai_console_formal_evidence_logical_path_out_of_boundary")
  if (!Number.isInteger(record.contentByteLength) || record.contentByteLength < 1 || record.contentBlob.byteLength !== record.contentByteLength) throw new Error("ai_console_formal_evidence_byte_length_invalid")
  if (!Number.isInteger(record.sourceRevision) || record.sourceRevision < 1) throw new Error("ai_console_formal_evidence_source_revision_invalid")
  if (!isSha256(record.contentSha256) || sha256Bytes(record.contentBlob) !== record.contentSha256) throw new Error("ai_console_formal_evidence_content_sha256_mismatch")
  if (!isSha256(record.sourceBindingSha256) || !isSha256(record.transactionId) || !isSha256(record.commandId)) throw new Error("ai_console_formal_evidence_binding_invalid")
  if (record.evidenceId !== deriveEvidenceId(record.evidenceType, record.logicalPath, record.contentSha256)) throw new Error("ai_console_formal_evidence_id_derivation_invalid")
  if (record.storageMode !== "embedded_immutable_blob" || record.integrityStatus !== "verified") throw new Error("ai_console_formal_evidence_storage_status_invalid")
  if (Number.isNaN(Date.parse(record.registeredAtUtc))) throw new Error("ai_console_formal_evidence_registered_time_invalid")
  const { evidenceRecordSha256, contentBlob: _contentBlob, ...unsignedRecord } = record
  void _contentBlob
  if (!isSha256(evidenceRecordSha256) || sha256Text(JSON.stringify(unsignedRecord)) !== evidenceRecordSha256) throw new Error("ai_console_formal_evidence_record_sha256_mismatch")
}

function verifyRegistration(
  registration: AiConsoleFormalEvidenceRegistration,
  records: readonly StoredEvidenceRecord[],
  expectedRevision: number,
  expectedPreviousSha256: string | null,
) {
  if (registration.schemaVersion !== "ai_console_formal_evidence_registration_v1" || registration.indexIdentity !== indexIdentity) throw new Error("ai_console_formal_evidence_registration_identity_invalid")
  if (registration.indexRevision !== expectedRevision || registration.previousRegistrationSha256 !== expectedPreviousSha256) throw new Error("ai_console_formal_evidence_registration_chain_invalid")
  if (registration.registrationId !== deriveRegistrationId(registration.transactionId) || !isSha256(registration.commandId)) throw new Error("ai_console_formal_evidence_registration_binding_invalid")
  if (records.length !== 4 || registration.evidenceRecordCount !== 4) throw new Error("ai_console_formal_evidence_registration_cardinality_invalid")
  if (JSON.stringify(records.map((record) => record.evidenceType)) !== JSON.stringify(fixedEvidenceTypes)) throw new Error("ai_console_formal_evidence_registration_type_set_invalid")
  if (records.some((record) => record.registrationId !== registration.registrationId || record.transactionId !== registration.transactionId || record.commandId !== registration.commandId || record.registeredAtUtc !== registration.registeredAtUtc)) throw new Error("ai_console_formal_evidence_registration_record_binding_invalid")
  if (registration.firstEvidenceSequence !== records[0].evidenceSequence || registration.lastEvidenceSequence !== records.at(-1)!.evidenceSequence) throw new Error("ai_console_formal_evidence_registration_sequence_invalid")
  if (registration.registrationEvidenceHeadSha256 !== records.at(-1)!.evidenceRecordSha256) throw new Error("ai_console_formal_evidence_registration_head_invalid")
  if (!Number.isInteger(registration.transactionSequence) || registration.transactionSequence < 1 || Number.isNaN(Date.parse(registration.registeredAtUtc))) throw new Error("ai_console_formal_evidence_registration_value_invalid")
  const { registrationRecordSha256, ...unsignedRegistration } = registration
  if (!isSha256(registrationRecordSha256) || sha256Text(JSON.stringify(unsignedRegistration)) !== registrationRecordSha256) throw new Error("ai_console_formal_evidence_registration_sha256_mismatch")
}

function readStoredRecordsForRegistration(database: DatabaseSync, registrationId: string): StoredEvidenceRecord[] {
  return database.prepare(`${evidenceSelectSql} WHERE registration_id = ? ORDER BY evidence_sequence ASC`).all(registrationId).map(storedEvidenceRecordFromRow)
}

function stripContentBlob(record: StoredEvidenceRecord): AiConsoleFormalEvidenceRecord {
  const { contentBlob: _contentBlob, ...publicRecord } = record
  void _contentBlob
  return publicRecord
}

function verifyDatabaseSchema(database: DatabaseSync) {
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String((row as { name: unknown }).name))
  if (JSON.stringify(tables) !== JSON.stringify(["formal_evidence_records", "metadata", "registration_batches"])) throw new Error("ai_console_formal_evidence_table_set_invalid")
  verifyColumnSet(database, "metadata", ["singleton", "schema_version", "index_identity", "source_boundary", "writer_identity", "index_revision", "evidence_record_count", "first_eligible_transaction_sequence", "created_at_utc", "updated_at_utc", "metadata_sha256"])
  verifyColumnSet(database, "registration_batches", ["registration_id", "index_revision", "transaction_id", "transaction_sequence", "command_id", "evidence_record_count", "first_evidence_sequence", "last_evidence_sequence", "registration_evidence_head_sha256", "registered_at_utc", "previous_registration_sha256", "registration_record_sha256"])
  verifyColumnSet(database, "formal_evidence_records", ["evidence_id", "evidence_sequence", "registration_id", "evidence_type", "logical_path", "media_type", "content_byte_length", "content_sha256", "content_blob", "source_revision", "source_binding_sha256", "transaction_id", "command_id", "registered_at_utc", "previous_evidence_record_sha256", "evidence_record_sha256"])
}

function verifyColumnSet(database: DatabaseSync, tableName: string, expectedColumns: readonly string[]) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => String((row as { name: unknown }).name))
  if (JSON.stringify(columns) !== JSON.stringify(expectedColumns)) throw new Error(`ai_console_formal_evidence_column_set_invalid:${tableName}`)
}

function verifyDatabaseIntegrity(database: DatabaseSync) {
  const result = database.prepare("PRAGMA integrity_check").get() as Record<string, unknown>
  if (!result || !Object.values(result).includes("ok")) throw new Error("ai_console_formal_evidence_sqlite_integrity_failure")
}

function verifyDatabaseVersion(database: DatabaseSync) {
  const result = database.prepare("PRAGMA user_version").get() as Record<string, unknown>
  if (!result || !Object.values(result).includes(1)) throw new Error("ai_console_formal_evidence_sqlite_version_invalid")
}

const evidenceSelectSql = `
  SELECT evidence_id, evidence_sequence, registration_id, evidence_type, logical_path, media_type,
    content_byte_length, content_sha256, content_blob, source_revision, source_binding_sha256,
    transaction_id, command_id, registered_at_utc, previous_evidence_record_sha256, evidence_record_sha256
  FROM formal_evidence_records
`

const registrationSelectSql = `
  SELECT registration_id, index_revision, transaction_id, transaction_sequence, command_id, evidence_record_count,
    first_evidence_sequence, last_evidence_sequence, registration_evidence_head_sha256, registered_at_utc,
    previous_registration_sha256, registration_record_sha256
  FROM registration_batches
`

function readLogicalFile(logicalPath: string): Uint8Array {
  return readFileSync(path.join(process.cwd(), ...logicalPath.split("/")))
}

function getIndexPath(): string {
  return path.join(process.cwd(), ...formalEvidenceIndexLogicalPath.split("/"))
}

function deriveEvidenceId(evidenceType: AiConsoleFormalEvidenceType, logicalPath: string, contentSha256: string): string {
  return sha256Text(`ai_console_formal_evidence_artifact_v1\n${evidenceType}\n${logicalPath}\n${contentSha256}`)
}

function deriveRegistrationId(transactionId: string): string {
  return sha256Text(`ai_console_formal_evidence_registration_v1\n${transactionId}`)
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value)
}
