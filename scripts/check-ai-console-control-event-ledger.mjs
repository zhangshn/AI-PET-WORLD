import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const projectRoot = process.cwd()
const controlRuntimeRoot = path.join(projectRoot, ".runtime", "ai-console", "control")
const ledgerPath = path.join(controlRuntimeRoot, "control-event-ledger-v1.jsonl")
const headPath = path.join(controlRuntimeRoot, "control-event-ledger-head-v1.json")
const receiptRoot = path.join(controlRuntimeRoot, "command-receipts")
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-control-event-ledger-v1.schema.json")
const ledgerServicePath = path.join(projectRoot, "src", "server", "ai-console-control", "control-event-ledger.ts")
const eventProjectionPath = path.join(projectRoot, "src", "server", "ai-console", "control-event-projection.ts")
const commandServicePath = path.join(projectRoot, "src", "server", "ai-console-control", "control-command-service.ts")
const failures = []

for (const [sourcePath, markers] of [
  [schemaPath, ["ai_console_control_event_v1", "ai_console_control_event_ledger_head_v1", "new_ai_console_only", "previousEventSha256", "headRecordSha256"]],
  [ledgerServicePath, ["control-event-ledger-v1.jsonl", "control-event-ledger-head-v1.json", "ensureAiConsoleControlReceiptEvent", "eventSequence", "previousEventSha256", "eventSha256", "headRecordSha256", "ai_console_control_event_post_write_verification_failed"]],
  [eventProjectionPath, ["queryAiConsoleControlEventProjection", "verified_registry", "ai_console_control_event_ledger_v1", "controlEventLedgerHeadLogicalPath"]],
  [commandServicePath, ["ensureAiConsoleControlReceiptEvent", "event: AiConsoleControlEvent"]],
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

const ledgerExists = fs.existsSync(ledgerPath)
const headExists = fs.existsSync(headPath)
let events = []
if (ledgerExists !== headExists) failures.push("ledger_surface_incomplete")

if (ledgerExists && headExists) {
  const ledgerText = fs.readFileSync(ledgerPath, "utf8")
  if (!ledgerText.endsWith("\n")) failures.push("ledger_truncated")
  const lines = ledgerText.endsWith("\n") ? ledgerText.slice(0, -1).split("\n") : []
  let previousEventSha256 = null
  const seenEventIds = new Set()
  const seenTransactionIds = new Set()
  events = lines.map((line, index) => {
    let event
    try {
      event = JSON.parse(line)
    } catch {
      failures.push(`event_invalid_json:${index + 1}`)
      return null
    }
    const sequence = index + 1
    const expectedFields = [
      "schemaVersion", "ledgerIdentity", "eventId", "eventSequence", "previousEventSha256", "commandId", "commandType",
      "executionId", "sourceState", "targetState", "transactionId", "occurredAtUtc", "evidencePath", "evidenceSha256", "eventSha256",
    ]
    if (Object.keys(event).length !== expectedFields.length || expectedFields.some((field) => !(field in event))) failures.push(`event_fields_invalid:${sequence}`)
    if (event.schemaVersion !== "ai_console_control_event_v1" || event.ledgerIdentity !== "ai_console_control_event_ledger") failures.push(`event_identity_invalid:${sequence}`)
    if (event.eventSequence !== sequence || event.previousEventSha256 !== previousEventSha256) failures.push(`event_chain_invalid:${sequence}`)
    if (!isSha256(event.commandId) || event.executionId !== event.commandId) failures.push(`event_execution_binding_invalid:${sequence}`)
    if (event.eventId !== sha256(`ai_console_control_event_v1\n${event.commandId}`)) failures.push(`event_id_derivation_invalid:${sequence}`)
    if (event.transactionId !== sha256(`ai_console_control_receipt_event_transaction_v1\n${event.commandId}`)) failures.push(`event_transaction_derivation_invalid:${sequence}`)
    if (seenEventIds.has(event.eventId) || seenTransactionIds.has(event.transactionId)) failures.push(`event_duplicate_identity:${sequence}`)
    seenEventIds.add(event.eventId)
    seenTransactionIds.add(event.transactionId)
    if (event.evidencePath !== `.runtime/ai-console/control/command-receipts/${event.commandId}.json`) failures.push(`event_evidence_path_invalid:${sequence}`)
    const { eventSha256, ...unsignedEvent } = event
    if (!isSha256(eventSha256) || eventSha256 !== sha256(JSON.stringify(unsignedEvent))) failures.push(`event_sha256_invalid:${sequence}`)

    const receiptPath = path.join(receiptRoot, `${event.commandId}.json`)
    if (!fs.existsSync(receiptPath)) {
      failures.push(`event_receipt_missing:${sequence}`)
    } else {
      const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"))
      if (receipt.receiptSha256 !== event.evidenceSha256) failures.push(`event_receipt_sha256_mismatch:${sequence}`)
      if (receipt.executionStatus !== event.targetState || receipt.finishedAtUtc !== event.occurredAtUtc) failures.push(`event_receipt_state_mismatch:${sequence}`)
      const expectedSourceState = receipt.executionStatus === "rejected" ? "validating" : "executing"
      if (event.sourceState !== expectedSourceState) failures.push(`event_source_state_mismatch:${sequence}`)
    }
    previousEventSha256 = event.eventSha256
    return event
  }).filter(Boolean)

  const head = JSON.parse(fs.readFileSync(headPath, "utf8"))
  const { headRecordSha256, ...unsignedHead } = head
  if (head.schemaVersion !== "ai_console_control_event_ledger_head_v1" || head.ledgerIdentity !== "ai_console_control_event_ledger") failures.push("head_identity_invalid")
  if (head.sourceBoundary !== "new_ai_console_only" || head.writerIdentity !== "ai_console_control_event_ledger_writer_v1") failures.push("head_source_invalid")
  if (head.ledgerRevision !== events.length || head.eventCount !== events.length) failures.push("head_revision_invalid")
  const lastEvent = events.at(-1)
  if (!lastEvent || head.headEventId !== lastEvent.eventId || head.headEventSha256 !== lastEvent.eventSha256) failures.push("head_event_binding_invalid")
  if (!lastEvent || Date.parse(head.updatedAtUtc) < Date.parse(lastEvent.occurredAtUtc)) failures.push("head_time_invalid")
  if (head.ledgerLogicalPath !== ".runtime/ai-console/control/control-event-ledger-v1.jsonl") failures.push("head_path_invalid")
  if (!isSha256(headRecordSha256) || headRecordSha256 !== sha256(JSON.stringify(unsignedHead))) failures.push("head_sha256_invalid")
}

if (fs.existsSync(controlRuntimeRoot)) {
  for (const entry of fs.readdirSync(controlRuntimeRoot)) {
    if (/\.lock$|\.tmp$/u.test(entry)) failures.push(`temporary_control_entry_present:${entry}`)
  }
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  ledgerIdentity: "ai_console_control_event_ledger",
  ledgerInitialized: ledgerExists && headExists,
  eventCount: events.length,
  failures,
}, null, 2))
if (failures.length > 0) process.exitCode = 1

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}
