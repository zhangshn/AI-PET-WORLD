import {
  controlTransactionStoreLogicalPath,
  readAiConsoleControlTransactionStore,
} from "@/server/ai-console-control/control-transaction-store"
import { createNotConnectedProjection, createProjection, createUnknownOrStaleProjection, type AiConsoleProjectionResult } from "./projection-contract"

export async function queryAiConsoleControlTransactionProjection(): Promise<AiConsoleProjectionResult> {
  const store = await readAiConsoleControlTransactionStore()
  if (store.status === "not_connected") return createNotConnectedProjection(store.reasonCode)
  if (store.status === "unknown_or_stale") {
    return createUnknownOrStaleProjection({
      sourceIdentity: "ai_console_control_transaction_registry",
      writerIdentity: "ai_console_control_transaction_writer_v1",
      reasonCode: store.reasonCode,
      evidenceReferences: [controlTransactionStoreLogicalPath],
    })
  }

  return createProjection({
    sourceIdentity: "ai_console_control_transaction_registry_v1",
    writerIdentity: "ai_console_control_transaction_writer_v1",
    observedAtUtc: store.metadata.updatedAtUtc,
    sourceRevision: store.metadata.registryRevision,
    evidenceReferences: [controlTransactionStoreLogicalPath],
    trustStatus: "verified_registry",
    records: store.records.map((record) => ({
      transactionId: record.transactionId,
      transactionSequence: record.transactionSequence,
      commandId: record.commandId,
      eventId: record.eventId,
      commitSurfaceSet: record.commitSurfaceSet,
      commitStatus: record.commitStatus,
      recoveryStatus: record.recoveryStatus,
      receiptPath: record.receiptPath,
      receiptSha256: record.receiptSha256,
      eventSequence: record.eventSequence,
      eventSha256: record.eventSha256,
      eventLedgerRevision: record.eventLedgerRevision,
      committedAtUtc: record.committedAtUtc,
      previousTransactionSha256: record.previousTransactionSha256,
      transactionRecordSha256: record.transactionRecordSha256,
      transactionGateId: null,
      gateOrder: null,
      commitSurface: null,
      consistencyRequirement: null,
      failureTerminal: null,
    })),
  })
}
