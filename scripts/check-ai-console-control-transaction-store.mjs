import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { DatabaseSync } from "node:sqlite"

const projectRoot = process.cwd()
const runtimeRoot = path.join(projectRoot, ".runtime", "ai-console", "control")
const storePath = path.join(runtimeRoot, "control-transactions-v1.sqlite")
const ledgerPath = path.join(runtimeRoot, "control-event-ledger-v1.jsonl")
const headPath = path.join(runtimeRoot, "control-event-ledger-head-v1.json")
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-control-transaction-registry-v1.schema.json")
const storeSourcePath = path.join(projectRoot, "src", "server", "ai-console-control", "control-transaction-store.ts")
const projectionPath = path.join(projectRoot, "src", "server", "ai-console", "control-transaction-projection.ts")
const commandServicePath = path.join(projectRoot, "src", "server", "ai-console-control", "control-command-service.ts")
const commitSurfaces = ["command_receipt", "control_event", "event_ledger_head", "sqlite_transaction_registry"]
const transactionSelectSql = `
  SELECT transaction_id, transaction_sequence, command_id, event_id, commit_surface_set_json, commit_status,
    recovery_status, receipt_path, receipt_sha256, event_sequence, event_sha256, event_ledger_revision,
    committed_at_utc, previous_transaction_sha256, transaction_record_sha256
  FROM control_transactions
`
const failures = []

for (const [sourcePath, markers] of [
  [schemaPath, ["ai_console_control_transaction_v1", "ai_console_control_transaction_registry", "sqlite_transaction_registry", "transactionRecordSha256"]],
  [storeSourcePath, ["control-transactions-v1.sqlite", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "ensureAiConsoleControlTransaction", "transactionRecordSha256", "metadataSha256", "new_ai_console_only"]],
  [projectionPath, ["queryAiConsoleControlTransactionProjection", "verified_registry", "ai_console_control_transaction_registry_v1"]],
  [commandServicePath, ["ensureAiConsoleControlTransaction", "transaction: AiConsoleControlTransaction"]],
]) {
  if (!fs.existsSync(sourcePath)) {
    failures.push(`missing:${path.relative(projectRoot, sourcePath)}`)
    continue
  }
  const source = fs.readFileSync(sourcePath, "utf8")
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`contract_marker_missing:${path.relative(projectRoot, sourcePath)}:${marker}`)
  }
  if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(source)) failures.push(`legacy_source_coupling:${path.relative(projectRoot, sourcePath)}`)
}

let transactionCount = 0
if (fs.existsSync(storePath)) {
  const database = new DatabaseSync(storePath, { readOnly: true })
  try {
    database.exec("PRAGMA query_only = ON")
    const integrity = database.prepare("PRAGMA integrity_check").get()
    if (!integrity || !Object.values(integrity).includes("ok")) failures.push("sqlite_integrity_failure")
    const userVersion = database.prepare("PRAGMA user_version").get()
    if (!userVersion || !Object.values(userVersion).includes(1)) failures.push("sqlite_user_version_invalid")
    const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String(row.name))
    if (JSON.stringify(tables) !== JSON.stringify(["control_transactions", "metadata"])) failures.push("table_set_invalid")
    verifyColumnSet(database, "metadata", ["singleton", "schema_version", "registry_identity", "source_boundary", "writer_identity", "registry_revision", "created_at_utc", "updated_at_utc", "metadata_sha256"])
    verifyColumnSet(database, "control_transactions", ["transaction_id", "transaction_sequence", "command_id", "event_id", "commit_surface_set_json", "commit_status", "recovery_status", "receipt_path", "receipt_sha256", "event_sequence", "event_sha256", "event_ledger_revision", "committed_at_utc", "previous_transaction_sha256", "transaction_record_sha256"])

    const metadataRows = database.prepare("SELECT * FROM metadata").all()
    if (metadataRows.length !== 1) failures.push("metadata_cardinality_invalid")
    const metadataRow = metadataRows[0] ?? {}
    const metadata = {
      schemaVersion: String(metadataRow.schema_version),
      registryIdentity: String(metadataRow.registry_identity),
      sourceBoundary: String(metadataRow.source_boundary),
      writerIdentity: String(metadataRow.writer_identity),
      registryRevision: Number(metadataRow.registry_revision),
      createdAtUtc: String(metadataRow.created_at_utc),
      updatedAtUtc: String(metadataRow.updated_at_utc),
    }
    if (metadata.schemaVersion !== "ai_console_control_transaction_registry_v1" || metadata.registryIdentity !== "ai_console_control_transaction_registry") failures.push("metadata_identity_invalid")
    if (metadata.sourceBoundary !== "new_ai_console_only" || metadata.writerIdentity !== "ai_console_control_transaction_writer_v1") failures.push("metadata_source_invalid")
    if (sha256(JSON.stringify(metadata)) !== metadataRow.metadata_sha256) failures.push("metadata_sha256_invalid")

    const eventLines = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, "utf8").trimEnd().split("\n").map((line) => JSON.parse(line)) : []
    const ledgerHead = fs.existsSync(headPath) ? JSON.parse(fs.readFileSync(headPath, "utf8")) : null
    const rows = database.prepare(`${transactionSelectSql} ORDER BY transaction_sequence ASC`).all()
    transactionCount = rows.length
    let previousTransactionSha256 = null
    rows.forEach((row, index) => {
      const sequence = index + 1
      const surfaces = JSON.parse(String(row.commit_surface_set_json))
      const record = {
        schemaVersion: "ai_console_control_transaction_v1",
        registryIdentity: "ai_console_control_transaction_registry",
        transactionId: String(row.transaction_id),
        transactionSequence: Number(row.transaction_sequence),
        commandId: String(row.command_id),
        eventId: String(row.event_id),
        commitSurfaceSet: surfaces,
        commitStatus: String(row.commit_status),
        recoveryStatus: String(row.recovery_status),
        receiptPath: String(row.receipt_path),
        receiptSha256: String(row.receipt_sha256),
        eventSequence: Number(row.event_sequence),
        eventSha256: String(row.event_sha256),
        eventLedgerRevision: Number(row.event_ledger_revision),
        committedAtUtc: String(row.committed_at_utc),
        previousTransactionSha256: row.previous_transaction_sha256 === null ? null : String(row.previous_transaction_sha256),
      }
      if (record.transactionSequence !== sequence || record.previousTransactionSha256 !== previousTransactionSha256) failures.push(`transaction_chain_invalid:${sequence}`)
      if (record.transactionId !== sha256(`ai_console_control_receipt_event_transaction_v1\n${record.commandId}`)) failures.push(`transaction_id_invalid:${sequence}`)
      if (JSON.stringify(record.commitSurfaceSet) !== JSON.stringify(commitSurfaces) || record.commitStatus !== "committed" || record.recoveryStatus !== "not_required") failures.push(`transaction_status_invalid:${sequence}`)
      if (record.receiptPath !== `.runtime/ai-console/control/command-receipts/${record.commandId}.json`) failures.push(`transaction_receipt_path_invalid:${sequence}`)
      const expectedRecordSha256 = sha256(JSON.stringify(record))
      if (row.transaction_record_sha256 !== expectedRecordSha256) failures.push(`transaction_sha256_invalid:${sequence}`)
      const receiptPath = path.join(projectRoot, ...record.receiptPath.split("/"))
      if (!fs.existsSync(receiptPath)) {
        failures.push(`transaction_receipt_missing:${sequence}`)
      } else {
        const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"))
        if (receipt.receiptSha256 !== record.receiptSha256 || receipt.commandId !== record.commandId) failures.push(`transaction_receipt_binding_invalid:${sequence}`)
      }
      const event = eventLines.find((candidate) => candidate.eventId === record.eventId)
      if (!event || event.commandId !== record.commandId || event.eventSha256 !== record.eventSha256 || event.eventSequence !== record.eventSequence) failures.push(`transaction_event_binding_invalid:${sequence}`)
      if (!ledgerHead || ledgerHead.ledgerRevision < record.eventLedgerRevision || record.eventLedgerRevision < record.eventSequence) failures.push(`transaction_ledger_revision_invalid:${sequence}`)
      previousTransactionSha256 = String(row.transaction_record_sha256)
    })
    if (metadata.registryRevision !== transactionCount) failures.push("metadata_revision_mismatch")
  } finally {
    database.close()
  }
}

if (fs.existsSync(runtimeRoot)) {
  for (const entry of fs.readdirSync(runtimeRoot)) {
    if (/control-transactions-v1\.sqlite-(?:journal|wal|shm)$/u.test(entry)) failures.push(`temporary_sqlite_entry_present:${entry}`)
  }
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  registryIdentity: "ai_console_control_transaction_registry",
  storeInitialized: fs.existsSync(storePath),
  transactionCount,
  failures,
}, null, 2))
if (failures.length > 0) process.exitCode = 1

function verifyColumnSet(database, tableName, expectedColumns) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => String(row.name))
  if (JSON.stringify(columns) !== JSON.stringify(expectedColumns)) failures.push(`column_set_invalid:${tableName}`)
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}
