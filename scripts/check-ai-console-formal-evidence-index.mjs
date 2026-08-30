import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { DatabaseSync } from "node:sqlite"

const projectRoot = process.cwd()
const indexLogicalPath = ".runtime/ai-console/evidence/formal-evidence-index-v1.sqlite"
const indexPath = path.join(projectRoot, ...indexLogicalPath.split("/"))
const evidenceRuntimeRoot = path.dirname(indexPath)
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-formal-evidence-index-v1.schema.json")
const storePath = path.join(projectRoot, "src", "server", "ai-console-control", "formal-evidence-index.ts")
const projectionPath = path.join(projectRoot, "src", "server", "ai-console", "formal-evidence-projection.ts")
const evidenceProjectionPath = path.join(projectRoot, "src", "server", "ai-console", "evidence-projection.ts")
const commandServicePath = path.join(projectRoot, "src", "server", "ai-console-control", "control-command-service.ts")
const commandRoutePath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "commands", "route.ts")
const fixedEvidenceTypes = ["command_receipt", "control_event_ledger", "control_event_ledger_head", "control_transaction_registry"]
const failures = []

for (const [sourcePath, markers] of [
  [schemaPath, ["ai_console_formal_evidence_index_v1", "ai_console_formal_evidence_registration_v1", "embedded_immutable_blob", "new_ai_console_only", "contentSha256", "sourceBindingSha256"]],
  [storePath, ["formal-evidence-index-v1.sqlite", "BEGIN IMMEDIATE", "PRAGMA integrity_check", "ensureAiConsoleFormalEvidenceRegistration", "embedded_immutable_blob", "firstEligibleTransactionSequence", "ai_console_formal_evidence_pre_v7_transaction_not_eligible"]],
  [projectionPath, ["queryAiConsoleFormalEvidenceProjection", "ai_console_formal_evidence_index_v1", "verified_registry", "evidenceRecordSha256"]],
  [evidenceProjectionPath, ["isAiConsoleFormalEvidenceIndexInitialized", "queryAiConsoleFormalEvidenceProjection", 'selectedView === "正式证据记录"']],
  [commandServicePath, ["ensureAiConsoleFormalEvidenceRegistration", "evidenceRegistration", "evidenceRecords"]],
  [commandRoutePath, ["evidenceIndexStatus", "evidenceIndexLogicalPath", "evidenceRegistration", "evidenceRecordSet"]],
]) {
  if (!fs.existsSync(sourcePath)) {
    failures.push(`missing:${path.relative(projectRoot, sourcePath)}`)
    continue
  }
  const source = fs.readFileSync(sourcePath, "utf8")
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`contract_marker_missing:${path.relative(projectRoot, sourcePath)}:${marker}`)
  }
  if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(source)) {
    failures.push(`legacy_source_coupling:${path.relative(projectRoot, sourcePath)}`)
  }
}

let registrationCount = 0
let evidenceRecordCount = 0
if (!fs.existsSync(indexPath)) {
  failures.push("formal_evidence_index_not_initialized")
} else {
  const database = new DatabaseSync(indexPath, { readOnly: true })
  try {
    database.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON")
    const integrity = database.prepare("PRAGMA integrity_check").get()
    if (!integrity || !Object.values(integrity).includes("ok")) failures.push("sqlite_integrity_invalid")
    const userVersion = database.prepare("PRAGMA user_version").get()
    if (!userVersion || !Object.values(userVersion).includes(1)) failures.push("sqlite_user_version_invalid")
    const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String(row.name))
    if (JSON.stringify(tables) !== JSON.stringify(["formal_evidence_records", "metadata", "registration_batches"])) failures.push("table_set_invalid")
    verifyColumnSet(database, "metadata", ["singleton", "schema_version", "index_identity", "source_boundary", "writer_identity", "index_revision", "evidence_record_count", "first_eligible_transaction_sequence", "created_at_utc", "updated_at_utc", "metadata_sha256"])
    verifyColumnSet(database, "registration_batches", ["registration_id", "index_revision", "transaction_id", "transaction_sequence", "command_id", "evidence_record_count", "first_evidence_sequence", "last_evidence_sequence", "registration_evidence_head_sha256", "registered_at_utc", "previous_registration_sha256", "registration_record_sha256"])
    verifyColumnSet(database, "formal_evidence_records", ["evidence_id", "evidence_sequence", "registration_id", "evidence_type", "logical_path", "media_type", "content_byte_length", "content_sha256", "content_blob", "source_revision", "source_binding_sha256", "transaction_id", "command_id", "registered_at_utc", "previous_evidence_record_sha256", "evidence_record_sha256"])

    const metadataRows = database.prepare("SELECT * FROM metadata").all()
    if (metadataRows.length !== 1) failures.push("metadata_cardinality_invalid")
    const metadataRow = metadataRows[0] ?? {}
    const metadata = {
      schemaVersion: String(metadataRow.schema_version),
      indexIdentity: String(metadataRow.index_identity),
      sourceBoundary: String(metadataRow.source_boundary),
      writerIdentity: String(metadataRow.writer_identity),
      indexRevision: Number(metadataRow.index_revision),
      evidenceRecordCount: Number(metadataRow.evidence_record_count),
      firstEligibleTransactionSequence: Number(metadataRow.first_eligible_transaction_sequence),
      createdAtUtc: String(metadataRow.created_at_utc),
      updatedAtUtc: String(metadataRow.updated_at_utc),
    }
    if (metadata.schemaVersion !== "ai_console_formal_evidence_index_v1" || metadata.indexIdentity !== "ai_console_formal_evidence_index") failures.push("metadata_identity_invalid")
    if (metadata.sourceBoundary !== "new_ai_console_only" || metadata.writerIdentity !== "ai_console_formal_evidence_index_writer_v1") failures.push("metadata_source_invalid")
    if (sha256Text(JSON.stringify(metadata)) !== metadataRow.metadata_sha256) failures.push("metadata_sha256_invalid")

    const evidenceRows = database.prepare(`
      SELECT evidence_id, evidence_sequence, registration_id, evidence_type, logical_path, media_type,
        content_byte_length, content_sha256, content_blob, source_revision, source_binding_sha256,
        transaction_id, command_id, registered_at_utc, previous_evidence_record_sha256, evidence_record_sha256
      FROM formal_evidence_records ORDER BY evidence_sequence ASC
    `).all()
    evidenceRecordCount = evidenceRows.length
    let previousEvidenceRecordSha256 = null
    const records = evidenceRows.map((row, index) => {
      const contentBlob = row.content_blob
      const record = {
        schemaVersion: "ai_console_formal_evidence_artifact_v1",
        indexIdentity: "ai_console_formal_evidence_index",
        evidenceId: String(row.evidence_id),
        evidenceSequence: Number(row.evidence_sequence),
        registrationId: String(row.registration_id),
        evidenceType: String(row.evidence_type),
        logicalPath: String(row.logical_path),
        mediaType: String(row.media_type),
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
      }
      const sequence = index + 1
      if (record.evidenceSequence !== sequence || record.previousEvidenceRecordSha256 !== previousEvidenceRecordSha256) failures.push(`evidence_chain_invalid:${sequence}`)
      if (!fixedEvidenceTypes.includes(record.evidenceType)) failures.push(`evidence_type_invalid:${sequence}`)
      if (!record.logicalPath.startsWith(".runtime/ai-console/control/")) failures.push(`evidence_path_out_of_boundary:${sequence}`)
      if (!(contentBlob instanceof Uint8Array) || contentBlob.byteLength !== record.contentByteLength) failures.push(`evidence_blob_invalid:${sequence}`)
      if (sha256Bytes(contentBlob) !== record.contentSha256) failures.push(`evidence_content_sha256_invalid:${sequence}`)
      if (record.evidenceId !== deriveEvidenceId(record.evidenceType, record.logicalPath, record.contentSha256)) failures.push(`evidence_id_invalid:${sequence}`)
      const expectedRecordSha256 = sha256Text(JSON.stringify(record))
      if (row.evidence_record_sha256 !== expectedRecordSha256) failures.push(`evidence_record_sha256_invalid:${sequence}`)
      previousEvidenceRecordSha256 = String(row.evidence_record_sha256)
      return { ...record, evidenceRecordSha256: String(row.evidence_record_sha256), contentBlob }
    })

    const registrationRows = database.prepare(`
      SELECT registration_id, index_revision, transaction_id, transaction_sequence, command_id, evidence_record_count,
        first_evidence_sequence, last_evidence_sequence, registration_evidence_head_sha256, registered_at_utc,
        previous_registration_sha256, registration_record_sha256
      FROM registration_batches ORDER BY index_revision ASC
    `).all()
    registrationCount = registrationRows.length
    let previousRegistrationSha256 = null
    registrationRows.forEach((row, index) => {
      const registration = {
        schemaVersion: "ai_console_formal_evidence_registration_v1",
        indexIdentity: "ai_console_formal_evidence_index",
        registrationId: String(row.registration_id),
        indexRevision: Number(row.index_revision),
        transactionId: String(row.transaction_id),
        transactionSequence: Number(row.transaction_sequence),
        commandId: String(row.command_id),
        evidenceRecordCount: Number(row.evidence_record_count),
        firstEvidenceSequence: Number(row.first_evidence_sequence),
        lastEvidenceSequence: Number(row.last_evidence_sequence),
        registrationEvidenceHeadSha256: String(row.registration_evidence_head_sha256),
        registeredAtUtc: String(row.registered_at_utc),
        previousRegistrationSha256: row.previous_registration_sha256 === null ? null : String(row.previous_registration_sha256),
      }
      const revision = index + 1
      if (registration.indexRevision !== revision || registration.previousRegistrationSha256 !== previousRegistrationSha256) failures.push(`registration_chain_invalid:${revision}`)
      if (registration.registrationId !== sha256Text(`ai_console_formal_evidence_registration_v1\n${registration.transactionId}`)) failures.push(`registration_id_invalid:${revision}`)
      const registrationRecords = records.filter((record) => record.registrationId === registration.registrationId)
      if (registrationRecords.length !== 4 || JSON.stringify(registrationRecords.map((record) => record.evidenceType)) !== JSON.stringify(fixedEvidenceTypes)) failures.push(`registration_type_set_invalid:${revision}`)
      if (registrationRecords.some((record) => record.transactionId !== registration.transactionId || record.commandId !== registration.commandId || record.registeredAtUtc !== registration.registeredAtUtc)) failures.push(`registration_binding_invalid:${revision}`)
      if (registrationRecords[0]?.evidenceSequence !== registration.firstEvidenceSequence || registrationRecords.at(-1)?.evidenceSequence !== registration.lastEvidenceSequence) failures.push(`registration_sequence_invalid:${revision}`)
      if (registrationRecords.at(-1)?.evidenceRecordSha256 !== registration.registrationEvidenceHeadSha256) failures.push(`registration_head_invalid:${revision}`)
      const expectedRegistrationSha256 = sha256Text(JSON.stringify(registration))
      if (row.registration_record_sha256 !== expectedRegistrationSha256) failures.push(`registration_sha256_invalid:${revision}`)
      previousRegistrationSha256 = String(row.registration_record_sha256)
    })

    if (metadata.indexRevision !== registrationCount || metadata.evidenceRecordCount !== evidenceRecordCount) failures.push("metadata_revision_mismatch")
    if (registrationRows.length > 0 && metadata.firstEligibleTransactionSequence !== Number(registrationRows[0].transaction_sequence)) failures.push("first_eligible_transaction_mismatch")

    const latestRegistrationId = String(registrationRows.at(-1)?.registration_id ?? "")
    const latestRecords = records.filter((record) => record.registrationId === latestRegistrationId)
    latestRecords.forEach((record) => {
      const livePath = path.join(projectRoot, ...record.logicalPath.split("/"))
      if (!fs.existsSync(livePath)) {
        failures.push(`latest_live_surface_missing:${record.evidenceType}`)
      } else if (sha256Bytes(fs.readFileSync(livePath)) !== record.contentSha256) {
        failures.push(`latest_live_surface_sha256_mismatch:${record.evidenceType}`)
      }
    })

    const latestReceipt = latestRecords.find((record) => record.evidenceType === "command_receipt")
    if (latestReceipt) {
      const receipt = JSON.parse(Buffer.from(latestReceipt.contentBlob).toString("utf8"))
      if (receipt.commandId !== latestReceipt.commandId || receipt.receiptSha256 !== latestReceipt.sourceBindingSha256) failures.push("latest_receipt_binding_invalid")
    }
    const latestLedger = latestRecords.find((record) => record.evidenceType === "control_event_ledger")
    if (latestLedger) {
      const ledgerText = Buffer.from(latestLedger.contentBlob).toString("utf8")
      const events = ledgerText.endsWith("\n") ? ledgerText.slice(0, -1).split("\n").map((line) => JSON.parse(line)) : []
      if (events.length !== latestLedger.sourceRevision || events.at(-1)?.eventSha256 !== latestLedger.sourceBindingSha256) failures.push("latest_ledger_binding_invalid")
    }
    const latestHead = latestRecords.find((record) => record.evidenceType === "control_event_ledger_head")
    if (latestHead) {
      const head = JSON.parse(Buffer.from(latestHead.contentBlob).toString("utf8"))
      if (head.ledgerRevision !== latestHead.sourceRevision || head.headRecordSha256 !== latestHead.sourceBindingSha256) failures.push("latest_head_binding_invalid")
    }
    const latestTransaction = latestRecords.find((record) => record.evidenceType === "control_transaction_registry")
    if (latestTransaction && Buffer.from(latestTransaction.contentBlob).subarray(0, 16).toString("utf8") !== "SQLite format 3\u0000") failures.push("latest_transaction_blob_header_invalid")
  } finally {
    database.close()
  }
}

if (fs.existsSync(evidenceRuntimeRoot)) {
  const allowedEvidenceRuntimeEntries = new Set(["formal-evidence-index-v1.sqlite", "task-capsule-index-v1.sqlite", "policy-boundary-report-index-v1.sqlite"])
  for (const entry of fs.readdirSync(evidenceRuntimeRoot)) {
    if (!allowedEvidenceRuntimeEntries.has(entry)) failures.push(`unexpected_evidence_runtime_entry:${entry}`)
  }
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  indexIdentity: "ai_console_formal_evidence_index",
  indexInitialized: fs.existsSync(indexPath),
  registrationCount,
  evidenceRecordCount,
  failures,
}, null, 2))
if (failures.length > 0) process.exitCode = 1

function verifyColumnSet(database, tableName, expectedColumns) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => String(row.name))
  if (JSON.stringify(columns) !== JSON.stringify(expectedColumns)) failures.push(`column_set_invalid:${tableName}`)
}

function deriveEvidenceId(evidenceType, logicalPath, contentSha256) {
  return sha256Text(`ai_console_formal_evidence_artifact_v1\n${evidenceType}\n${logicalPath}\n${contentSha256}`)
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex")
}
