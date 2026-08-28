import {
  formalEvidenceIndexLogicalPath,
  readAiConsoleFormalEvidenceIndex,
} from "@/server/ai-console-control/formal-evidence-index"
import {
  createNotConnectedProjection,
  createProjection,
  createUnknownOrStaleProjection,
  type AiConsoleProjectionResult,
} from "./projection-contract"

export async function queryAiConsoleFormalEvidenceProjection(): Promise<AiConsoleProjectionResult> {
  const index = await readAiConsoleFormalEvidenceIndex()
  if (index.status === "not_connected") return createNotConnectedProjection(index.reasonCode)
  if (index.status === "unknown_or_stale") {
    return createUnknownOrStaleProjection({
      sourceIdentity: "ai_console_formal_evidence_index",
      writerIdentity: "ai_console_formal_evidence_index_writer_v1",
      reasonCode: index.reasonCode,
      evidenceReferences: [formalEvidenceIndexLogicalPath],
    })
  }

  return createProjection({
    sourceIdentity: "ai_console_formal_evidence_index_v1",
    writerIdentity: "ai_console_formal_evidence_index_writer_v1",
    observedAtUtc: index.metadata.updatedAtUtc,
    sourceRevision: index.metadata.indexRevision,
    evidenceReferences: [formalEvidenceIndexLogicalPath],
    trustStatus: "verified_registry",
    records: index.records.map((record) => ({
      evidenceId: record.evidenceId,
      evidenceType: record.evidenceType,
      logicalPath: record.logicalPath,
      integrityStatus: record.integrityStatus,
      evidenceSequence: record.evidenceSequence,
      registrationId: record.registrationId,
      mediaType: record.mediaType,
      contentByteLength: record.contentByteLength,
      contentSha256: record.contentSha256,
      sourceRevision: record.sourceRevision,
      sourceBindingSha256: record.sourceBindingSha256,
      transactionId: record.transactionId,
      commandId: record.commandId,
      registeredAtUtc: record.registeredAtUtc,
      storageMode: record.storageMode,
      previousEvidenceRecordSha256: record.previousEvidenceRecordSha256,
      evidenceRecordSha256: record.evidenceRecordSha256,
      evidenceTypeId: null,
      requiredIdentityFields: null,
      immutabilityRule: null,
      integrityRule: null,
      retentionRule: null,
    })),
  })
}
