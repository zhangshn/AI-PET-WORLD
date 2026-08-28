import {
  controlEventLedgerHeadLogicalPath,
  controlEventLedgerLogicalPath,
  readAiConsoleControlEventLedger,
} from "@/server/ai-console-control/control-event-ledger"
import { createNotConnectedProjection, createProjection, createUnknownOrStaleProjection, type AiConsoleProjectionResult } from "./projection-contract"

export async function queryAiConsoleControlEventProjection(): Promise<AiConsoleProjectionResult> {
  const ledger = await readAiConsoleControlEventLedger()
  if (ledger.status === "not_connected") {
    return createNotConnectedProjection(ledger.reasonCode)
  }
  if (ledger.status === "unknown_or_stale") {
    return createUnknownOrStaleProjection({
      sourceIdentity: "ai_console_control_event_ledger",
      writerIdentity: "ai_console_control_event_ledger_writer_v1",
      reasonCode: ledger.reasonCode,
      evidenceReferences: [controlEventLedgerLogicalPath, controlEventLedgerHeadLogicalPath],
    })
  }

  return createProjection({
    sourceIdentity: "ai_console_control_event_ledger_v1",
    writerIdentity: "ai_console_control_event_ledger_writer_v1",
    observedAtUtc: ledger.head.updatedAtUtc,
    sourceRevision: ledger.head.ledgerRevision,
    evidenceReferences: [controlEventLedgerLogicalPath, controlEventLedgerHeadLogicalPath],
    trustStatus: "verified_registry",
    records: ledger.events.map((event) => ({
      eventId: event.eventId,
      eventSequence: event.eventSequence,
      executionId: event.executionId,
      sourceState: event.sourceState,
      targetState: event.targetState,
      transactionId: event.transactionId,
      occurredAtUtc: event.occurredAtUtc,
      evidencePath: event.evidencePath,
      evidenceSha256: event.evidenceSha256,
      previousEventSha256: event.previousEventSha256,
      eventSha256: event.eventSha256,
    })),
  })
}
