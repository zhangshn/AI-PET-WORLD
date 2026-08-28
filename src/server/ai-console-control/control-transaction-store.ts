import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { readAiConsoleControlEventLedger, type AiConsoleControlEvent } from "./control-event-ledger"
import type { AiConsoleControlCommandReceipt } from "./control-command-service"

export const controlTransactionStoreLogicalPath = ".runtime/ai-console/control/control-transactions-v1.sqlite"
const registryIdentity = "ai_console_control_transaction_registry"
const writerIdentity = "ai_console_control_transaction_writer_v1"
const schemaVersion = "ai_console_control_transaction_registry_v1"
const commitSurfaceSet = ["command_receipt", "control_event", "event_ledger_head", "sqlite_transaction_registry"] as const

export type AiConsoleControlTransaction = {
  schemaVersion: "ai_console_control_transaction_v1"
  registryIdentity: typeof registryIdentity
  transactionId: string
  transactionSequence: number
  commandId: string
  eventId: string
  commitSurfaceSet: readonly string[]
  commitStatus: "committed"
  recoveryStatus: "not_required"
  receiptPath: string
  receiptSha256: string
  eventSequence: number
  eventSha256: string
  eventLedgerRevision: number
  committedAtUtc: string
  previousTransactionSha256: string | null
  transactionRecordSha256: string
}

type TransactionMetadata = {
  schemaVersion: typeof schemaVersion
  registryIdentity: typeof registryIdentity
  sourceBoundary: "new_ai_console_only"
  writerIdentity: typeof writerIdentity
  registryRevision: number
  createdAtUtc: string
  updatedAtUtc: string
  metadataSha256: string
}

export type AiConsoleControlTransactionStoreRead =
  | { status: "connected"; records: readonly AiConsoleControlTransaction[]; metadata: TransactionMetadata }
  | { status: "not_connected"; reasonCode: "ai_console_control_transaction_store_not_initialized" }
  | { status: "unknown_or_stale"; reasonCode: string }

export function isAiConsoleControlTransactionStoreInitialized(): boolean {
  return existsSync(getStorePath())
}

export async function ensureAiConsoleControlTransaction(
  receipt: AiConsoleControlCommandReceipt,
  event: AiConsoleControlEvent,
): Promise<AiConsoleControlTransaction> {
  const ledger = await readAiConsoleControlEventLedger()
  if (ledger.status !== "connected") throw new Error("ai_console_control_transaction_event_ledger_unavailable")
  const ledgerEvent = ledger.events.find((candidate) => candidate.eventId === event.eventId)
  if (!ledgerEvent || ledgerEvent.commandId !== receipt.commandId || ledgerEvent.evidenceSha256 !== receipt.receiptSha256) {
    throw new Error("ai_console_control_transaction_event_binding_conflict")
  }

  const database = openWritableDatabase()
  let record: AiConsoleControlTransaction
  try {
    database.exec("BEGIN IMMEDIATE")
    const metadata = readAndVerifyMetadata(database)
    const existingRow = database.prepare(transactionSelectByIdSql).get(event.transactionId)
    if (existingRow) {
      record = recordFromRow(existingRow)
      verifyTransactionRecord(record, record.transactionSequence, record.previousTransactionSha256)
      verifyTransactionBindings(record, receipt, event)
    } else {
      const previousRow = database.prepare(`${transactionSelectSql} ORDER BY transaction_sequence DESC LIMIT 1`).get()
      const previousRecord = previousRow ? recordFromRow(previousRow) : null
      const unsignedRecord: Omit<AiConsoleControlTransaction, "transactionRecordSha256"> = {
        schemaVersion: "ai_console_control_transaction_v1",
        registryIdentity,
        transactionId: event.transactionId,
        transactionSequence: metadata.registryRevision + 1,
        commandId: receipt.commandId,
        eventId: event.eventId,
        commitSurfaceSet,
        commitStatus: "committed",
        recoveryStatus: "not_required",
        receiptPath: `.runtime/ai-console/control/command-receipts/${receipt.commandId}.json`,
        receiptSha256: receipt.receiptSha256,
        eventSequence: event.eventSequence,
        eventSha256: event.eventSha256,
        eventLedgerRevision: ledger.head.ledgerRevision,
        committedAtUtc: new Date().toISOString(),
        previousTransactionSha256: previousRecord?.transactionRecordSha256 ?? null,
      }
      record = { ...unsignedRecord, transactionRecordSha256: sha256(JSON.stringify(unsignedRecord)) }
      insertTransaction(database, record)
      updateMetadata(database, metadata, record.transactionSequence, record.committedAtUtc)
    }
    database.exec("COMMIT")
  } catch (error) {
    try {
      database.exec("ROLLBACK")
    } catch {
      // The transaction may already be closed by SQLite after a fatal statement error.
    }
    throw error
  } finally {
    database.close()
  }

  const verified = await readAiConsoleControlTransactionStore()
  if (verified.status !== "connected") throw new Error("ai_console_control_transaction_post_write_verification_failed")
  const verifiedRecord = verified.records.find((candidate) => candidate.transactionId === record.transactionId)
  if (!verifiedRecord || verifiedRecord.transactionRecordSha256 !== record.transactionRecordSha256) {
    throw new Error("ai_console_control_transaction_post_write_binding_failed")
  }
  return verifiedRecord
}

export async function readAiConsoleControlTransactionStore(): Promise<AiConsoleControlTransactionStoreRead> {
  if (!isAiConsoleControlTransactionStoreInitialized()) {
    return { status: "not_connected", reasonCode: "ai_console_control_transaction_store_not_initialized" }
  }
  let database: DatabaseSync | null = null
  try {
    database = new DatabaseSync(getStorePath(), { readOnly: true })
    database.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON")
    verifyDatabaseSchema(database)
    verifyDatabaseVersion(database)
    verifyDatabaseIntegrity(database)
    const metadata = readAndVerifyMetadata(database)
    const rows = database.prepare(`${transactionSelectSql} ORDER BY transaction_sequence ASC`).all()
    const records: AiConsoleControlTransaction[] = []
    let previousTransactionSha256: string | null = null
    for (const row of rows) {
      const record = recordFromRow(row)
      verifyTransactionRecord(record, records.length + 1, previousTransactionSha256)
      await verifyPersistedBindings(record)
      records.push(record)
      previousTransactionSha256 = record.transactionRecordSha256
    }
    if (metadata.registryRevision !== records.length) throw new Error("ai_console_control_transaction_revision_mismatch")
    return { status: "connected", records, metadata }
  } catch (error) {
    return {
      status: "unknown_or_stale",
      reasonCode: error instanceof Error ? error.message : "ai_console_control_transaction_store_read_failed",
    }
  } finally {
    database?.close()
  }
}

function openWritableDatabase(): DatabaseSync {
  const storePath = getStorePath()
  mkdirSync(path.dirname(storePath), { recursive: true })
  const database = new DatabaseSync(storePath)
  database.exec("PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000")
  database.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      schema_version TEXT NOT NULL,
      registry_identity TEXT NOT NULL,
      source_boundary TEXT NOT NULL,
      writer_identity TEXT NOT NULL,
      registry_revision INTEGER NOT NULL CHECK (registry_revision >= 0),
      created_at_utc TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL,
      metadata_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS control_transactions (
      transaction_id TEXT PRIMARY KEY,
      transaction_sequence INTEGER NOT NULL UNIQUE CHECK (transaction_sequence >= 1),
      command_id TEXT NOT NULL UNIQUE,
      event_id TEXT NOT NULL UNIQUE,
      commit_surface_set_json TEXT NOT NULL,
      commit_status TEXT NOT NULL CHECK (commit_status = 'committed'),
      recovery_status TEXT NOT NULL CHECK (recovery_status = 'not_required'),
      receipt_path TEXT NOT NULL,
      receipt_sha256 TEXT NOT NULL,
      event_sequence INTEGER NOT NULL CHECK (event_sequence >= 1),
      event_sha256 TEXT NOT NULL,
      event_ledger_revision INTEGER NOT NULL CHECK (event_ledger_revision >= event_sequence),
      committed_at_utc TEXT NOT NULL,
      previous_transaction_sha256 TEXT,
      transaction_record_sha256 TEXT NOT NULL
    );
  `)
  verifyDatabaseSchema(database)
  const metadataCount = Number((database.prepare("SELECT COUNT(*) AS count FROM metadata").get() as { count: number }).count)
  if (metadataCount === 0) insertInitialMetadata(database)
  if (metadataCount > 1) throw new Error("ai_console_control_transaction_metadata_cardinality_invalid")
  database.exec("PRAGMA user_version = 1")
  return database
}

function insertInitialMetadata(database: DatabaseSync) {
  const createdAtUtc = new Date().toISOString()
  const unsignedMetadata: Omit<TransactionMetadata, "metadataSha256"> = {
    schemaVersion,
    registryIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity,
    registryRevision: 0,
    createdAtUtc,
    updatedAtUtc: createdAtUtc,
  }
  const metadata = { ...unsignedMetadata, metadataSha256: sha256(JSON.stringify(unsignedMetadata)) }
  database.prepare(`
    INSERT INTO metadata (
      singleton, schema_version, registry_identity, source_boundary, writer_identity,
      registry_revision, created_at_utc, updated_at_utc, metadata_sha256
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    metadata.schemaVersion,
    metadata.registryIdentity,
    metadata.sourceBoundary,
    metadata.writerIdentity,
    metadata.registryRevision,
    metadata.createdAtUtc,
    metadata.updatedAtUtc,
    metadata.metadataSha256,
  )
}

function updateMetadata(database: DatabaseSync, metadata: TransactionMetadata, registryRevision: number, updatedAtUtc: string) {
  const unsignedMetadata: Omit<TransactionMetadata, "metadataSha256"> = {
    schemaVersion,
    registryIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity,
    registryRevision,
    createdAtUtc: metadata.createdAtUtc,
    updatedAtUtc,
  }
  const metadataSha256 = sha256(JSON.stringify(unsignedMetadata))
  const result = database.prepare(`
    UPDATE metadata SET registry_revision = ?, updated_at_utc = ?, metadata_sha256 = ? WHERE singleton = 1 AND registry_revision = ?
  `).run(registryRevision, updatedAtUtc, metadataSha256, metadata.registryRevision)
  if (Number(result.changes) !== 1) throw new Error("ai_console_control_transaction_metadata_revision_conflict")
}

function insertTransaction(database: DatabaseSync, record: AiConsoleControlTransaction) {
  database.prepare(`
    INSERT INTO control_transactions (
      transaction_id, transaction_sequence, command_id, event_id, commit_surface_set_json, commit_status,
      recovery_status, receipt_path, receipt_sha256, event_sequence, event_sha256, event_ledger_revision,
      committed_at_utc, previous_transaction_sha256, transaction_record_sha256
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.transactionId,
    record.transactionSequence,
    record.commandId,
    record.eventId,
    JSON.stringify(record.commitSurfaceSet),
    record.commitStatus,
    record.recoveryStatus,
    record.receiptPath,
    record.receiptSha256,
    record.eventSequence,
    record.eventSha256,
    record.eventLedgerRevision,
    record.committedAtUtc,
    record.previousTransactionSha256,
    record.transactionRecordSha256,
  )
}

function readAndVerifyMetadata(database: DatabaseSync): TransactionMetadata {
  const rows = database.prepare("SELECT * FROM metadata ORDER BY singleton ASC").all()
  if (rows.length !== 1) throw new Error("ai_console_control_transaction_metadata_cardinality_invalid")
  const row = rows[0] as Record<string, unknown>
  const metadata: TransactionMetadata = {
    schemaVersion: String(row.schema_version) as typeof schemaVersion,
    registryIdentity: String(row.registry_identity) as typeof registryIdentity,
    sourceBoundary: String(row.source_boundary) as "new_ai_console_only",
    writerIdentity: String(row.writer_identity) as typeof writerIdentity,
    registryRevision: Number(row.registry_revision),
    createdAtUtc: String(row.created_at_utc),
    updatedAtUtc: String(row.updated_at_utc),
    metadataSha256: String(row.metadata_sha256),
  }
  if (metadata.schemaVersion !== schemaVersion || metadata.registryIdentity !== registryIdentity) throw new Error("ai_console_control_transaction_metadata_identity_invalid")
  if (metadata.sourceBoundary !== "new_ai_console_only" || metadata.writerIdentity !== writerIdentity) throw new Error("ai_console_control_transaction_metadata_source_invalid")
  if (!Number.isInteger(metadata.registryRevision) || metadata.registryRevision < 0) throw new Error("ai_console_control_transaction_metadata_revision_invalid")
  if (Number.isNaN(Date.parse(metadata.createdAtUtc)) || Number.isNaN(Date.parse(metadata.updatedAtUtc))) throw new Error("ai_console_control_transaction_metadata_time_invalid")
  const { metadataSha256, ...unsignedMetadata } = metadata
  if (!isSha256(metadataSha256) || sha256(JSON.stringify(unsignedMetadata)) !== metadataSha256) throw new Error("ai_console_control_transaction_metadata_sha256_mismatch")
  return metadata
}

function recordFromRow(value: unknown): AiConsoleControlTransaction {
  const row = value as Record<string, unknown>
  let surfaces: unknown
  try {
    surfaces = JSON.parse(String(row.commit_surface_set_json))
  } catch {
    throw new Error("ai_console_control_transaction_surface_set_invalid")
  }
  return {
    schemaVersion: "ai_console_control_transaction_v1",
    registryIdentity,
    transactionId: String(row.transaction_id),
    transactionSequence: Number(row.transaction_sequence),
    commandId: String(row.command_id),
    eventId: String(row.event_id),
    commitSurfaceSet: Array.isArray(surfaces) ? surfaces.map(String) : [],
    commitStatus: String(row.commit_status) as "committed",
    recoveryStatus: String(row.recovery_status) as "not_required",
    receiptPath: String(row.receipt_path),
    receiptSha256: String(row.receipt_sha256),
    eventSequence: Number(row.event_sequence),
    eventSha256: String(row.event_sha256),
    eventLedgerRevision: Number(row.event_ledger_revision),
    committedAtUtc: String(row.committed_at_utc),
    previousTransactionSha256: row.previous_transaction_sha256 === null ? null : String(row.previous_transaction_sha256),
    transactionRecordSha256: String(row.transaction_record_sha256),
  }
}

function verifyTransactionRecord(record: AiConsoleControlTransaction, expectedSequence: number, expectedPreviousSha256: string | null) {
  if (record.schemaVersion !== "ai_console_control_transaction_v1" || record.registryIdentity !== registryIdentity) throw new Error("ai_console_control_transaction_identity_invalid")
  if (record.transactionSequence !== expectedSequence || record.previousTransactionSha256 !== expectedPreviousSha256) throw new Error("ai_console_control_transaction_chain_invalid")
  if (!isSha256(record.transactionId) || !isSha256(record.commandId) || !isSha256(record.eventId)) throw new Error("ai_console_control_transaction_binding_identity_invalid")
  if (record.transactionId !== deriveTransactionId(record.commandId)) throw new Error("ai_console_control_transaction_id_derivation_invalid")
  if (JSON.stringify(record.commitSurfaceSet) !== JSON.stringify(commitSurfaceSet)) throw new Error("ai_console_control_transaction_surface_set_invalid")
  if (record.commitStatus !== "committed" || record.recoveryStatus !== "not_required") throw new Error("ai_console_control_transaction_status_invalid")
  if (record.receiptPath !== `.runtime/ai-console/control/command-receipts/${record.commandId}.json`) throw new Error("ai_console_control_transaction_receipt_path_invalid")
  if (!isSha256(record.receiptSha256) || !isSha256(record.eventSha256) || !isSha256(record.transactionRecordSha256)) throw new Error("ai_console_control_transaction_sha256_invalid")
  if (!Number.isInteger(record.eventSequence) || record.eventSequence < 1 || !Number.isInteger(record.eventLedgerRevision) || record.eventLedgerRevision < record.eventSequence) throw new Error("ai_console_control_transaction_event_revision_invalid")
  if (Number.isNaN(Date.parse(record.committedAtUtc))) throw new Error("ai_console_control_transaction_time_invalid")
  const { transactionRecordSha256, ...unsignedRecord } = record
  if (sha256(JSON.stringify(unsignedRecord)) !== transactionRecordSha256) throw new Error("ai_console_control_transaction_record_sha256_mismatch")
}

function verifyTransactionBindings(record: AiConsoleControlTransaction, receipt: AiConsoleControlCommandReceipt, event: AiConsoleControlEvent) {
  if (record.commandId !== receipt.commandId || record.receiptSha256 !== receipt.receiptSha256) throw new Error("ai_console_control_transaction_receipt_binding_conflict")
  if (record.eventId !== event.eventId || record.eventSha256 !== event.eventSha256 || record.eventSequence !== event.eventSequence) throw new Error("ai_console_control_transaction_event_binding_conflict")
}

async function verifyPersistedBindings(record: AiConsoleControlTransaction) {
  const receiptPath = path.join(process.cwd(), ...record.receiptPath.split("/"))
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as Record<string, unknown>
  const { receiptSha256, ...unsignedReceipt } = receipt
  if (receipt.commandId !== record.commandId || receiptSha256 !== record.receiptSha256 || sha256(JSON.stringify(unsignedReceipt)) !== receiptSha256) {
    throw new Error("ai_console_control_transaction_receipt_integrity_failure")
  }
  const ledger = await readAiConsoleControlEventLedger()
  if (ledger.status !== "connected") throw new Error("ai_console_control_transaction_event_ledger_unavailable")
  const event = ledger.events.find((candidate) => candidate.eventId === record.eventId)
  if (!event || event.commandId !== record.commandId || event.eventSha256 !== record.eventSha256 || event.eventSequence !== record.eventSequence) {
    throw new Error("ai_console_control_transaction_event_integrity_failure")
  }
  if (ledger.head.ledgerRevision < record.eventLedgerRevision) throw new Error("ai_console_control_transaction_event_ledger_revision_regressed")
}

function verifyDatabaseSchema(database: DatabaseSync) {
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String((row as { name: unknown }).name))
  if (JSON.stringify(tables) !== JSON.stringify(["control_transactions", "metadata"])) throw new Error("ai_console_control_transaction_table_set_invalid")
  verifyColumnSet(database, "metadata", ["singleton", "schema_version", "registry_identity", "source_boundary", "writer_identity", "registry_revision", "created_at_utc", "updated_at_utc", "metadata_sha256"])
  verifyColumnSet(database, "control_transactions", ["transaction_id", "transaction_sequence", "command_id", "event_id", "commit_surface_set_json", "commit_status", "recovery_status", "receipt_path", "receipt_sha256", "event_sequence", "event_sha256", "event_ledger_revision", "committed_at_utc", "previous_transaction_sha256", "transaction_record_sha256"])
}

function verifyColumnSet(database: DatabaseSync, tableName: string, expectedColumns: readonly string[]) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => String((row as { name: unknown }).name))
  if (JSON.stringify(columns) !== JSON.stringify(expectedColumns)) throw new Error(`ai_console_control_transaction_column_set_invalid:${tableName}`)
}

function verifyDatabaseIntegrity(database: DatabaseSync) {
  const result = database.prepare("PRAGMA integrity_check").get() as Record<string, unknown>
  if (!result || !Object.values(result).includes("ok")) throw new Error("ai_console_control_transaction_sqlite_integrity_failure")
}

function verifyDatabaseVersion(database: DatabaseSync) {
  const result = database.prepare("PRAGMA user_version").get() as Record<string, unknown>
  if (!result || !Object.values(result).includes(1)) throw new Error("ai_console_control_transaction_sqlite_version_invalid")
}

const transactionSelectSql = `
  SELECT transaction_id, transaction_sequence, command_id, event_id, commit_surface_set_json, commit_status,
    recovery_status, receipt_path, receipt_sha256, event_sequence, event_sha256, event_ledger_revision,
    committed_at_utc, previous_transaction_sha256, transaction_record_sha256
  FROM control_transactions
`
const transactionSelectByIdSql = `${transactionSelectSql} WHERE transaction_id = ?`

function getStorePath(): string {
  return path.join(process.cwd(), ...controlTransactionStoreLogicalPath.split("/"))
}

function deriveTransactionId(commandId: string): string {
  return sha256(`ai_console_control_receipt_event_transaction_v1\n${commandId}`)
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value)
}
