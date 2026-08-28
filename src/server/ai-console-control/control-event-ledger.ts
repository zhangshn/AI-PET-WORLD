import { createHash, randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { appendFile, mkdir, open, readFile, rename, stat, unlink, writeFile, type FileHandle } from "node:fs/promises"
import path from "node:path"
import type { AiConsoleControlCommandReceipt } from "./control-command-service"

export const controlEventLedgerLogicalPath = ".runtime/ai-console/control/control-event-ledger-v1.jsonl"
export const controlEventLedgerHeadLogicalPath = ".runtime/ai-console/control/control-event-ledger-head-v1.json"
const controlEventLedgerLockLogicalPath = ".runtime/ai-console/control/control-event-ledger-v1.lock"
const ledgerIdentity = "ai_console_control_event_ledger"
const ledgerWriterIdentity = "ai_console_control_event_ledger_writer_v1"
const maximumLedgerBytes = 4 * 1024 * 1024
const maximumLedgerEvents = 10_000
const staleLockMilliseconds = 30_000
let ledgerMutationQueue: Promise<void> = Promise.resolve()

export type AiConsoleControlEvent = {
  schemaVersion: "ai_console_control_event_v1"
  ledgerIdentity: typeof ledgerIdentity
  eventId: string
  eventSequence: number
  previousEventSha256: string | null
  commandId: string
  commandType: "verify_primary_registry"
  executionId: string
  sourceState: "validating" | "executing"
  targetState: "succeeded" | "rejected" | "failed_closed"
  transactionId: string
  occurredAtUtc: string
  evidencePath: string
  evidenceSha256: string
  eventSha256: string
}

type ControlEventLedgerHead = {
  schemaVersion: "ai_console_control_event_ledger_head_v1"
  ledgerIdentity: typeof ledgerIdentity
  sourceBoundary: "new_ai_console_only"
  writerIdentity: typeof ledgerWriterIdentity
  ledgerRevision: number
  eventCount: number
  headEventId: string
  headEventSha256: string
  ledgerLogicalPath: typeof controlEventLedgerLogicalPath
  updatedAtUtc: string
  headRecordSha256: string
}

export type AiConsoleControlEventLedgerRead =
  | { status: "connected"; events: readonly AiConsoleControlEvent[]; head: ControlEventLedgerHead }
  | { status: "not_connected"; reasonCode: "ai_console_control_event_ledger_not_initialized" }
  | { status: "unknown_or_stale"; reasonCode: string }

export function isAiConsoleControlEventLedgerInitialized(): boolean {
  return existsSync(getLogicalPath(controlEventLedgerLogicalPath)) && existsSync(getLogicalPath(controlEventLedgerHeadLogicalPath))
}

export async function ensureAiConsoleControlReceiptEvent(receipt: AiConsoleControlCommandReceipt): Promise<AiConsoleControlEvent> {
  let resolveMutation: (event: AiConsoleControlEvent) => void
  let rejectMutation: (error: unknown) => void
  const result = new Promise<AiConsoleControlEvent>((resolve, reject) => {
    resolveMutation = resolve
    rejectMutation = reject
  })
  ledgerMutationQueue = ledgerMutationQueue.then(async () => {
    try {
      resolveMutation(await withLedgerLock(() => appendOrVerifyReceiptEvent(receipt)))
    } catch (error) {
      rejectMutation(error)
    }
  })
  return result
}

export async function readAiConsoleControlEventLedger(): Promise<AiConsoleControlEventLedgerRead> {
  try {
    const [ledgerText, headText] = await Promise.all([
      readOptionalText(getLogicalPath(controlEventLedgerLogicalPath)),
      readOptionalText(getLogicalPath(controlEventLedgerHeadLogicalPath)),
    ])
    if (ledgerText === null && headText === null) {
      return { status: "not_connected", reasonCode: "ai_console_control_event_ledger_not_initialized" }
    }
    if (ledgerText === null || headText === null) {
      return { status: "unknown_or_stale", reasonCode: "ai_console_control_event_ledger_surface_incomplete" }
    }
    const events = parseAndVerifyLedger(ledgerText)
    const head = parseAndVerifyHead(headText)
    verifyHeadAgainstEvents(head, events)
    return { status: "connected", events, head }
  } catch (error) {
    return {
      status: "unknown_or_stale",
      reasonCode: error instanceof Error ? error.message : "ai_console_control_event_ledger_read_failed",
    }
  }
}

async function appendOrVerifyReceiptEvent(receipt: AiConsoleControlCommandReceipt): Promise<AiConsoleControlEvent> {
  const ledgerPath = getLogicalPath(controlEventLedgerLogicalPath)
  const headPath = getLogicalPath(controlEventLedgerHeadLogicalPath)
  const ledgerText = await readOptionalText(ledgerPath)
  const events = ledgerText === null ? [] : parseAndVerifyLedger(ledgerText)
  const headText = await readOptionalText(headPath)
  if (headText !== null) {
    const head = parseAndVerifyHead(headText)
    verifyHeadPrefix(head, events)
  }

  const expectedEventId = deriveEventId(receipt.commandId)
  const existingEvent = events.find((event) => event.eventId === expectedEventId)
  if (existingEvent) {
    if (existingEvent.commandId !== receipt.commandId || existingEvent.evidenceSha256 !== receipt.receiptSha256) {
      throw new Error("ai_console_control_event_existing_binding_conflict")
    }
    await writeLedgerHead(events)
    return existingEvent
  }
  if (events.length >= maximumLedgerEvents) throw new Error("ai_console_control_event_ledger_capacity_exceeded")

  const event = createReceiptEvent(receipt, events)
  const serializedEvent = `${JSON.stringify(event)}\n`
  if (Buffer.byteLength(ledgerText ?? "", "utf8") + Buffer.byteLength(serializedEvent, "utf8") > maximumLedgerBytes) {
    throw new Error("ai_console_control_event_ledger_size_exceeded")
  }
  await appendFile(ledgerPath, serializedEvent, { encoding: "utf8", flag: "a" })
  const nextEvents = [...events, event]
  await writeLedgerHead(nextEvents)
  const verified = await readAiConsoleControlEventLedger()
  if (verified.status !== "connected" || verified.head.headEventId !== event.eventId) {
    throw new Error("ai_console_control_event_post_write_verification_failed")
  }
  return event
}

function createReceiptEvent(receipt: AiConsoleControlCommandReceipt, events: readonly AiConsoleControlEvent[]): AiConsoleControlEvent {
  const unsignedEvent: Omit<AiConsoleControlEvent, "eventSha256"> = {
    schemaVersion: "ai_console_control_event_v1",
    ledgerIdentity,
    eventId: deriveEventId(receipt.commandId),
    eventSequence: events.length + 1,
    previousEventSha256: events.at(-1)?.eventSha256 ?? null,
    commandId: receipt.commandId,
    commandType: receipt.commandType,
    executionId: receipt.commandId,
    sourceState: receipt.executionStatus === "rejected" ? "validating" : "executing",
    targetState: receipt.executionStatus,
    transactionId: deriveTransactionId(receipt.commandId),
    occurredAtUtc: receipt.finishedAtUtc,
    evidencePath: `.runtime/ai-console/control/command-receipts/${receipt.commandId}.json`,
    evidenceSha256: receipt.receiptSha256,
  }
  return { ...unsignedEvent, eventSha256: sha256(JSON.stringify(unsignedEvent)) }
}

function parseAndVerifyLedger(ledgerText: string): AiConsoleControlEvent[] {
  if (Buffer.byteLength(ledgerText, "utf8") > maximumLedgerBytes) throw new Error("ai_console_control_event_ledger_size_exceeded")
  if (!ledgerText.endsWith("\n")) throw new Error("ai_console_control_event_ledger_truncated")
  const lines = ledgerText.slice(0, -1).split("\n")
  if (lines.length === 0 || lines.length > maximumLedgerEvents) throw new Error("ai_console_control_event_ledger_count_invalid")
  const events: AiConsoleControlEvent[] = []
  const seenEventIds = new Set<string>()
  const seenTransactionIds = new Set<string>()
  for (const line of lines) {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      throw new Error("ai_console_control_event_invalid_json")
    }
    if (!isAiConsoleControlEvent(parsed, events.length + 1, events.at(-1)?.eventSha256 ?? null)) {
      throw new Error("ai_console_control_event_integrity_failure")
    }
    if (seenEventIds.has(parsed.eventId) || seenTransactionIds.has(parsed.transactionId)) {
      throw new Error("ai_console_control_event_duplicate_identity")
    }
    seenEventIds.add(parsed.eventId)
    seenTransactionIds.add(parsed.transactionId)
    events.push(parsed)
  }
  return events
}

function isAiConsoleControlEvent(value: unknown, expectedSequence: number, expectedPreviousSha256: string | null): value is AiConsoleControlEvent {
  if (!isPlainRecord(value)) return false
  const fields = [
    "schemaVersion", "ledgerIdentity", "eventId", "eventSequence", "previousEventSha256", "commandId", "commandType",
    "executionId", "sourceState", "targetState", "transactionId", "occurredAtUtc", "evidencePath", "evidenceSha256", "eventSha256",
  ]
  if (Object.keys(value).length !== fields.length || fields.some((field) => !(field in value))) return false
  if (value.schemaVersion !== "ai_console_control_event_v1" || value.ledgerIdentity !== ledgerIdentity) return false
  if (value.eventSequence !== expectedSequence || value.previousEventSha256 !== expectedPreviousSha256) return false
  if (typeof value.commandId !== "string" || !isSha256(value.commandId) || value.executionId !== value.commandId) return false
  if (value.commandType !== "verify_primary_registry" || value.eventId !== deriveEventId(value.commandId)) return false
  if (value.transactionId !== deriveTransactionId(value.commandId)) return false
  if (value.sourceState !== "validating" && value.sourceState !== "executing") return false
  if (value.targetState !== "succeeded" && value.targetState !== "rejected" && value.targetState !== "failed_closed") return false
  if ((value.targetState === "rejected") !== (value.sourceState === "validating")) return false
  if (typeof value.occurredAtUtc !== "string" || Number.isNaN(Date.parse(value.occurredAtUtc))) return false
  if (value.evidencePath !== `.runtime/ai-console/control/command-receipts/${value.commandId}.json`) return false
  if (typeof value.evidenceSha256 !== "string" || !isSha256(value.evidenceSha256)) return false
  if (typeof value.eventSha256 !== "string" || !isSha256(value.eventSha256)) return false
  const { eventSha256, ...unsignedEvent } = value
  return sha256(JSON.stringify(unsignedEvent)) === eventSha256
}

function parseAndVerifyHead(headText: string): ControlEventLedgerHead {
  let parsed: unknown
  try {
    parsed = JSON.parse(headText)
  } catch {
    throw new Error("ai_console_control_event_ledger_head_invalid_json")
  }
  if (!isPlainRecord(parsed)) throw new Error("ai_console_control_event_ledger_head_invalid")
  const fields = [
    "schemaVersion", "ledgerIdentity", "sourceBoundary", "writerIdentity", "ledgerRevision", "eventCount",
    "headEventId", "headEventSha256", "ledgerLogicalPath", "updatedAtUtc", "headRecordSha256",
  ]
  if (Object.keys(parsed).length !== fields.length || fields.some((field) => !(field in parsed))) throw new Error("ai_console_control_event_ledger_head_invalid")
  if (parsed.schemaVersion !== "ai_console_control_event_ledger_head_v1" || parsed.ledgerIdentity !== ledgerIdentity) throw new Error("ai_console_control_event_ledger_head_identity_mismatch")
  if (parsed.sourceBoundary !== "new_ai_console_only" || parsed.writerIdentity !== ledgerWriterIdentity) throw new Error("ai_console_control_event_ledger_head_source_mismatch")
  if (!Number.isInteger(parsed.ledgerRevision) || parsed.ledgerRevision !== parsed.eventCount || Number(parsed.eventCount) < 1) throw new Error("ai_console_control_event_ledger_head_revision_invalid")
  if (typeof parsed.headEventId !== "string" || !isSha256(parsed.headEventId) || typeof parsed.headEventSha256 !== "string" || !isSha256(parsed.headEventSha256)) throw new Error("ai_console_control_event_ledger_head_hash_invalid")
  if (parsed.ledgerLogicalPath !== controlEventLedgerLogicalPath || typeof parsed.updatedAtUtc !== "string" || Number.isNaN(Date.parse(parsed.updatedAtUtc))) throw new Error("ai_console_control_event_ledger_head_contract_invalid")
  if (typeof parsed.headRecordSha256 !== "string" || !isSha256(parsed.headRecordSha256)) throw new Error("ai_console_control_event_ledger_head_hash_invalid")
  const { headRecordSha256, ...unsignedHead } = parsed
  if (sha256(JSON.stringify(unsignedHead)) !== headRecordSha256) throw new Error("ai_console_control_event_ledger_head_sha256_mismatch")
  return parsed as ControlEventLedgerHead
}

function verifyHeadAgainstEvents(head: ControlEventLedgerHead, events: readonly AiConsoleControlEvent[]) {
  if (head.eventCount !== events.length) throw new Error("ai_console_control_event_ledger_head_count_mismatch")
  verifyHeadPrefix(head, events)
  const headEvent = events.at(-1)
  if (!headEvent || Date.parse(head.updatedAtUtc) < Date.parse(headEvent.occurredAtUtc)) {
    throw new Error("ai_console_control_event_ledger_head_time_invalid")
  }
}

function verifyHeadPrefix(head: ControlEventLedgerHead, events: readonly AiConsoleControlEvent[]) {
  if (head.eventCount > events.length) throw new Error("ai_console_control_event_ledger_head_ahead_of_ledger")
  const boundEvent = events[head.eventCount - 1]
  if (!boundEvent || head.headEventId !== boundEvent.eventId || head.headEventSha256 !== boundEvent.eventSha256) {
    throw new Error("ai_console_control_event_ledger_head_binding_mismatch")
  }
}

async function writeLedgerHead(events: readonly AiConsoleControlEvent[]) {
  const headEvent = events.at(-1)
  if (!headEvent) throw new Error("ai_console_control_event_ledger_head_without_event")
  const unsignedHead: Omit<ControlEventLedgerHead, "headRecordSha256"> = {
    schemaVersion: "ai_console_control_event_ledger_head_v1",
    ledgerIdentity,
    sourceBoundary: "new_ai_console_only",
    writerIdentity: ledgerWriterIdentity,
    ledgerRevision: events.length,
    eventCount: events.length,
    headEventId: headEvent.eventId,
    headEventSha256: headEvent.eventSha256,
    ledgerLogicalPath: controlEventLedgerLogicalPath,
    updatedAtUtc: new Date().toISOString(),
  }
  const head: ControlEventLedgerHead = { ...unsignedHead, headRecordSha256: sha256(JSON.stringify(unsignedHead)) }
  const headPath = getLogicalPath(controlEventLedgerHeadLogicalPath)
  const temporaryPath = `${headPath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(head, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
    await rename(temporaryPath, headPath)
  } finally {
    await unlink(temporaryPath).catch((error: unknown) => {
      if (!isNodeError(error, "ENOENT")) throw error
    })
  }
}

async function withLedgerLock<T>(operation: () => Promise<T>): Promise<T> {
  const runtimeDirectory = getLogicalPath(".runtime/ai-console/control")
  await mkdir(runtimeDirectory, { recursive: true })
  const lockPath = getLogicalPath(controlEventLedgerLockLogicalPath)
  const handle = await acquireLedgerLock(lockPath)
  try {
    return await operation()
  } finally {
    await handle.close()
    await unlink(lockPath).catch((error: unknown) => {
      if (!isNodeError(error, "ENOENT")) throw error
    })
  }
}

async function acquireLedgerLock(lockPath: string): Promise<FileHandle> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx")
      try {
        await handle.writeFile(JSON.stringify({ writerIdentity: ledgerWriterIdentity, processId: process.pid, acquiredAtUtc: new Date().toISOString() }), "utf8")
        return handle
      } catch (error) {
        await handle.close()
        await unlink(lockPath).catch(() => undefined)
        throw error
      }
    } catch (error) {
      if (!isNodeError(error, "EEXIST")) throw error
      const lockStat = await stat(lockPath).catch(() => null)
      if (lockStat && Date.now() - lockStat.mtimeMs > staleLockMilliseconds) {
        await unlink(lockPath).catch((unlinkError: unknown) => {
          if (!isNodeError(unlinkError, "ENOENT")) throw unlinkError
        })
        continue
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  throw new Error("ai_console_control_event_ledger_lock_timeout")
}

async function readOptionalText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8")
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return null
    throw error
  }
}

function getLogicalPath(logicalPath: string): string {
  return path.join(process.cwd(), ...logicalPath.split("/"))
}

function deriveEventId(commandId: string): string {
  return sha256(`ai_console_control_event_v1\n${commandId}`)
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code
}
