import { createNotConnectedProjection, createProjection, createUnknownOrStaleProjection, type AiConsoleProjectionResult } from "./projection-contract"
import { readAiConsolePolicyBoundaryReportStore } from "@/server/ai-console-control/policy-boundary-report-store"

export function queryAiConsolePolicyBoundaryReportProjection(): AiConsoleProjectionResult {
  const storeRead = readAiConsolePolicyBoundaryReportStore()
  if (storeRead.status !== "connected") {
    if (storeRead.status === "not_connected") return createNotConnectedProjection(storeRead.reasonCode)
    return createUnknownOrStaleProjection({
      sourceIdentity: "ai_console_policy_boundary_report_store_v1",
      writerIdentity: "ai_console_policy_boundary_report_reader_v1",
      reasonCode: storeRead.reasonCode,
      evidenceReferences: storeRead.evidenceReferences,
    })
  }

  return createProjection({
    sourceIdentity: "ai_console_policy_boundary_report_store_v1",
    writerIdentity: storeRead.metadata.writerIdentity,
    observedAtUtc: storeRead.metadata.updatedAtUtc,
    sourceRevision: storeRead.metadata.storeRevision,
    evidenceReferences: storeRead.evidenceReferences,
    trustStatus: "verified_registry",
    records: storeRead.records,
  })
}
