import { createNotConnectedProjection, createProjection, createUnknownOrStaleProjection, type AiConsoleProjectionResult } from "./projection-contract"
import { readAiConsoleTaskCapsuleStore } from "@/server/ai-console-control/task-capsule-store"

export function queryAiConsoleTaskCapsuleProjection(): AiConsoleProjectionResult {
  const storeRead = readAiConsoleTaskCapsuleStore()
  if (storeRead.status !== "connected") {
    if (storeRead.status === "not_connected") return createNotConnectedProjection(storeRead.reasonCode)
    return createUnknownOrStaleProjection({
      sourceIdentity: "ai_console_task_capsule_store_v1",
      writerIdentity: "ai_console_task_capsule_reader_v1",
      reasonCode: storeRead.reasonCode,
      evidenceReferences: storeRead.evidenceReferences,
    })
  }

  return createProjection({
    sourceIdentity: "ai_console_task_capsule_store_v1",
    writerIdentity: storeRead.metadata.writerIdentity,
    observedAtUtc: storeRead.metadata.updatedAtUtc,
    sourceRevision: storeRead.metadata.storeRevision,
    evidenceReferences: storeRead.evidenceReferences,
    trustStatus: "verified_registry",
    records: storeRead.records,
  })
}
