import {
  formalEvidenceIndexLogicalPath,
  readAiConsoleFormalEvidenceIndex,
  type AiConsoleFormalEvidenceRecord,
  type AiConsoleFormalEvidenceType,
} from "@/server/ai-console-control/formal-evidence-index"
import {
  controlTransactionStoreLogicalPath,
  readAiConsoleControlTransactionStore,
} from "@/server/ai-console-control/control-transaction-store"
import {
  createNotConnectedProjection,
  createProjection,
  createUnknownOrStaleProjection,
  type AiConsoleProjectionResult,
} from "./projection-contract"

export async function queryAiConsoleEvidenceReconciliationProjection(
  selectedView: "文件与事件" | "SQLite一致性",
): Promise<AiConsoleProjectionResult> {
  const [index, transactionStore] = await Promise.all([
    readAiConsoleFormalEvidenceIndex(),
    readAiConsoleControlTransactionStore(),
  ])
  if (index.status === "not_connected") return createNotConnectedProjection(index.reasonCode)
  if (transactionStore.status === "not_connected") return createNotConnectedProjection(transactionStore.reasonCode)
  if (index.status === "unknown_or_stale") {
    return createUnknownOrStaleProjection({
      sourceIdentity: "ai_console_evidence_reconciliation",
      writerIdentity: "ai_console_evidence_reconciliation_reader_v1",
      reasonCode: index.reasonCode,
      evidenceReferences: [formalEvidenceIndexLogicalPath, controlTransactionStoreLogicalPath],
    })
  }
  if (transactionStore.status === "unknown_or_stale") {
    return createUnknownOrStaleProjection({
      sourceIdentity: "ai_console_evidence_reconciliation",
      writerIdentity: "ai_console_evidence_reconciliation_reader_v1",
      reasonCode: transactionStore.reasonCode,
      evidenceReferences: [formalEvidenceIndexLogicalPath, controlTransactionStoreLogicalPath],
    })
  }

  const checkedAtUtc = new Date().toISOString()
  let records: Record<string, unknown>[]
  try {
    records = index.registrations.map((registration) => {
    const evidenceSet = index.records.filter((record) => record.registrationId === registration.registrationId)
    const transaction = transactionStore.records.find((record) => record.transactionId === registration.transactionId)
    if (!transaction) throw new Error("ai_console_evidence_reconciliation_transaction_missing")
    const receiptEvidence = findEvidence(evidenceSet, "command_receipt")
    const eventLedgerEvidence = findEvidence(evidenceSet, "control_event_ledger")
    const eventHeadEvidence = findEvidence(evidenceSet, "control_event_ledger_head")
    const transactionRegistryEvidence = findEvidence(evidenceSet, "control_transaction_registry")

    const fileConsistencyStatus = receiptEvidence.sourceBindingSha256 === transaction.receiptSha256
      && receiptEvidence.commandId === transaction.commandId
      && receiptEvidence.transactionId === transaction.transactionId
      ? "verified"
      : "conflict"
    const eventConsistencyStatus = eventLedgerEvidence.sourceBindingSha256 === transaction.eventSha256
      && eventLedgerEvidence.sourceRevision === transaction.eventLedgerRevision
      && eventHeadEvidence.sourceRevision === transaction.eventLedgerRevision
      && eventLedgerEvidence.commandId === transaction.commandId
      && eventHeadEvidence.commandId === transaction.commandId
      ? "verified"
      : "conflict"
    const sqliteConsistencyStatus = transactionRegistryEvidence.sourceBindingSha256 === transaction.transactionRecordSha256
      && transactionRegistryEvidence.sourceRevision === transaction.transactionSequence
      && registration.transactionSequence === transaction.transactionSequence
      ? "verified"
      : "conflict"
    const indexConsistencyStatus = evidenceSet.length === registration.evidenceRecordCount
      && evidenceSet.every((record) => record.integrityStatus === "verified")
      && evidenceSet.at(-1)?.evidenceRecordSha256 === registration.registrationEvidenceHeadSha256
      ? "verified"
      : "conflict"
    const crossSurfaceStatus = [fileConsistencyStatus, eventConsistencyStatus, sqliteConsistencyStatus, indexConsistencyStatus].every((status) => status === "verified")
      ? "verified"
      : "conflict"
    if (crossSurfaceStatus !== "verified") throw new Error("ai_console_evidence_reconciliation_conflict")

    return {
      transactionId: transaction.transactionId,
      transactionSequence: transaction.transactionSequence,
      commandId: transaction.commandId,
      eventId: transaction.eventId,
      commitSurfaceSet: transaction.commitSurfaceSet,
      commitStatus: transaction.commitStatus,
      recoveryStatus: transaction.recoveryStatus,
      receiptPath: transaction.receiptPath,
      receiptSha256: transaction.receiptSha256,
      eventSequence: transaction.eventSequence,
      eventSha256: transaction.eventSha256,
      eventLedgerRevision: transaction.eventLedgerRevision,
      committedAtUtc: transaction.committedAtUtc,
      previousTransactionSha256: transaction.previousTransactionSha256,
      transactionRecordSha256: transaction.transactionRecordSha256,
      transactionGateId: null,
      gateOrder: null,
      commitSurface: null,
      consistencyRequirement: null,
      failureTerminal: null,
      registrationId: registration.registrationId,
      indexRevision: registration.indexRevision,
      reconciliationScope: selectedView === "文件与事件" ? "file_and_event" : "sqlite_and_cross_surface",
      receiptEvidenceId: receiptEvidence.evidenceId,
      eventLedgerEvidenceId: eventLedgerEvidence.evidenceId,
      eventHeadEvidenceId: eventHeadEvidence.evidenceId,
      transactionRegistryEvidenceId: transactionRegistryEvidence.evidenceId,
      fileConsistencyStatus,
      eventConsistencyStatus,
      sqliteConsistencyStatus,
      indexConsistencyStatus,
      crossSurfaceStatus,
      evidenceRecordCount: registration.evidenceRecordCount,
      registrationRecordSha256: registration.registrationRecordSha256,
      checkedAtUtc,
    }
    })
  } catch (error) {
    return createUnknownOrStaleProjection({
      sourceIdentity: "ai_console_evidence_reconciliation",
      writerIdentity: "ai_console_evidence_reconciliation_reader_v1",
      reasonCode: error instanceof Error ? error.message : "ai_console_evidence_reconciliation_failed",
      evidenceReferences: [formalEvidenceIndexLogicalPath, controlTransactionStoreLogicalPath],
    })
  }

  return createProjection({
    sourceIdentity: "ai_console_evidence_reconciliation_v1",
    writerIdentity: "ai_console_evidence_reconciliation_reader_v1",
    observedAtUtc: checkedAtUtc,
    sourceRevision: index.metadata.indexRevision,
    evidenceReferences: [formalEvidenceIndexLogicalPath, controlTransactionStoreLogicalPath],
    trustStatus: "verified_registry",
    records,
  })
}

function findEvidence(
  records: readonly AiConsoleFormalEvidenceRecord[],
  evidenceType: AiConsoleFormalEvidenceType,
): AiConsoleFormalEvidenceRecord {
  const matches = records.filter((record) => record.evidenceType === evidenceType)
  if (matches.length !== 1) throw new Error(`ai_console_evidence_reconciliation_surface_cardinality_invalid:${evidenceType}`)
  return matches[0]
}
