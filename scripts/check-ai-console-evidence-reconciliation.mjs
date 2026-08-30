import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { DatabaseSync } from "node:sqlite"

const projectRoot = process.cwd()
const indexPath = path.join(projectRoot, ".runtime", "ai-console", "evidence", "formal-evidence-index-v1.sqlite")
const transactionPath = path.join(projectRoot, ".runtime", "ai-console", "control", "control-transactions-v1.sqlite")
const detailSchemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-formal-evidence-artifact-detail-v1.schema.json")
const detailRoutePath = path.join(projectRoot, "src", "app", "api", "ai-console", "evidence", "artifacts", "[evidenceId]", "route.ts")
const interactionPath = path.join(projectRoot, "src", "app", "ai-console", "ai-console-workspace-interactions.tsx")
const catalogPath = path.join(projectRoot, "src", "app", "ai-console", "ai-console-workspace-catalog.ts")
const reconciliationPath = path.join(projectRoot, "src", "server", "ai-console", "evidence-reconciliation-projection.ts")
const evidenceProjectionPath = path.join(projectRoot, "src", "server", "ai-console", "evidence-projection.ts")
const evidenceStorePath = path.join(projectRoot, "src", "server", "ai-console-control", "formal-evidence-index.ts")
const fixedEvidenceTypes = ["command_receipt", "control_event_ledger", "control_event_ledger_head", "control_transaction_registry"]
const failures = []

for (const [sourcePath, markers] of [
  [detailSchemaPath, ["ai_console_formal_evidence_artifact_detail_v1", "exact_evidence_identity", "verified_utf8_preview", "binary_metadata_only", "65536"]],
  [detailRoutePath, ["safeEvidenceIdentity", "verifyLocalControlRead", "readAiConsoleFormalEvidenceArtifact", "maximumTextPreviewBytes", "exact_evidence_identity", "X-Content-Type-Options"]],
  [interactionPath, ["EvidenceArtifactContentInspector", "EXACT CONTENT INSPECTION", "/api/ai-console/evidence/artifacts/", "binary_metadata_only", "不下载、不解析、不执行"]],
  [catalogPath, ["registrationId", "receiptEvidenceId", "eventLedgerEvidenceId", "eventHeadEvidenceId", "transactionRegistryEvidenceId", "crossSurfaceStatus"]],
  [reconciliationPath, ["queryAiConsoleEvidenceReconciliationProjection", "ai_console_evidence_reconciliation_v1", "fileConsistencyStatus", "eventConsistencyStatus", "sqliteConsistencyStatus", "indexConsistencyStatus", "crossSurfaceStatus"]],
  [evidenceProjectionPath, ["queryAiConsoleEvidenceReconciliationProjection", 'selectedView === "文件与事件"', 'selectedView === "SQLite一致性"']],
  [evidenceStorePath, ["readAiConsoleFormalEvidenceArtifact", "evidence_id = ?", "contentBytes", "ai_console_formal_evidence_artifact_public_binding_conflict"]],
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

let reconciliationCount = 0
if (!fs.existsSync(indexPath)) failures.push("formal_evidence_index_missing")
if (!fs.existsSync(transactionPath)) failures.push("control_transaction_store_missing")
if (fs.existsSync(indexPath) && fs.existsSync(transactionPath)) {
  const indexDatabase = new DatabaseSync(indexPath, { readOnly: true })
  const transactionDatabase = new DatabaseSync(transactionPath, { readOnly: true })
  try {
    indexDatabase.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON")
    transactionDatabase.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON")
    if (!Object.values(indexDatabase.prepare("PRAGMA integrity_check").get() ?? {}).includes("ok")) failures.push("evidence_index_integrity_invalid")
    if (!Object.values(transactionDatabase.prepare("PRAGMA integrity_check").get() ?? {}).includes("ok")) failures.push("transaction_store_integrity_invalid")

    const registrations = indexDatabase.prepare("SELECT * FROM registration_batches ORDER BY index_revision ASC").all()
    const evidenceRecords = indexDatabase.prepare("SELECT * FROM formal_evidence_records ORDER BY evidence_sequence ASC").all()
    const transactions = transactionDatabase.prepare("SELECT * FROM control_transactions ORDER BY transaction_sequence ASC").all()
    reconciliationCount = registrations.length

    registrations.forEach((registration) => {
      const revision = Number(registration.index_revision)
      const transaction = transactions.find((candidate) => candidate.transaction_id === registration.transaction_id)
      if (!transaction) {
        failures.push(`transaction_missing:${revision}`)
        return
      }
      const records = evidenceRecords.filter((record) => record.registration_id === registration.registration_id)
      if (records.length !== 4 || JSON.stringify(records.map((record) => record.evidence_type)) !== JSON.stringify(fixedEvidenceTypes)) {
        failures.push(`surface_set_invalid:${revision}`)
        return
      }
      const [receiptEvidence, ledgerEvidence, headEvidence, transactionEvidence] = records
      if (receiptEvidence.source_binding_sha256 !== transaction.receipt_sha256) failures.push(`receipt_source_binding_invalid:${revision}`)
      if (ledgerEvidence.source_binding_sha256 !== transaction.event_sha256) failures.push(`ledger_source_binding_invalid:${revision}`)
      if (Number(ledgerEvidence.source_revision) !== Number(transaction.event_ledger_revision) || Number(headEvidence.source_revision) !== Number(transaction.event_ledger_revision)) failures.push(`event_revision_binding_invalid:${revision}`)
      if (transactionEvidence.source_binding_sha256 !== transaction.transaction_record_sha256) failures.push(`transaction_source_binding_invalid:${revision}`)
      if (Number(transactionEvidence.source_revision) !== Number(transaction.transaction_sequence) || Number(registration.transaction_sequence) !== Number(transaction.transaction_sequence)) failures.push(`transaction_revision_binding_invalid:${revision}`)
      if (records.some((record) => record.command_id !== transaction.command_id || record.transaction_id !== transaction.transaction_id)) failures.push(`command_transaction_binding_invalid:${revision}`)

      const receipt = parseJsonBlob(receiptEvidence.content_blob, `receipt_blob_invalid:${revision}`)
      if (receipt && (receipt.commandId !== transaction.command_id || receipt.receiptSha256 !== transaction.receipt_sha256)) failures.push(`receipt_blob_binding_invalid:${revision}`)

      const ledgerText = Buffer.from(ledgerEvidence.content_blob).toString("utf8")
      const events = ledgerText.endsWith("\n") ? ledgerText.slice(0, -1).split("\n").map((line) => JSON.parse(line)) : []
      const event = events.find((candidate) => candidate.eventId === transaction.event_id)
      if (!event || event.commandId !== transaction.command_id || event.eventSha256 !== transaction.event_sha256 || event.eventSequence !== transaction.event_sequence) failures.push(`event_blob_binding_invalid:${revision}`)
      if (events.length !== Number(ledgerEvidence.source_revision) || events.at(-1)?.eventSha256 !== ledgerEvidence.source_binding_sha256) failures.push(`ledger_blob_head_invalid:${revision}`)

      const head = parseJsonBlob(headEvidence.content_blob, `head_blob_invalid:${revision}`)
      if (head && (head.ledgerRevision !== transaction.event_ledger_revision || head.headEventSha256 !== transaction.event_sha256 || head.headRecordSha256 !== headEvidence.source_binding_sha256)) failures.push(`head_blob_binding_invalid:${revision}`)
      if (Buffer.from(transactionEvidence.content_blob).subarray(0, 16).toString("utf8") !== "SQLite format 3\u0000") failures.push(`transaction_blob_header_invalid:${revision}`)
    })
  } finally {
    indexDatabase.close()
    transactionDatabase.close()
  }
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  projectionIdentity: "ai_console_evidence_reconciliation_v1",
  reconciliationCount,
  failures,
}, null, 2))
if (failures.length > 0) process.exitCode = 1

function parseJsonBlob(blob, failureCode) {
  try {
    return JSON.parse(Buffer.from(blob).toString("utf8"))
  } catch {
    failures.push(failureCode)
    return null
  }
}
