import { readAiConsoleTrainingDesignStore, trainingDesignStoreLogicalPath } from "@/server/ai-console-control/training-design-store"
import { createNotConnectedProjection, createProjection, createUnknownOrStaleProjection, type AiConsoleProjectionResult } from "./projection-contract"

export function getAiConsoleTrainingDesignProjectionAvailability(workspaceSlug: string): "connected" | "not_connected" {
  return workspaceSlug === "models" || workspaceSlug === "plans" ? "connected" : "not_connected"
}

export function queryAiConsoleTrainingDesignProjection(workspaceSlug: string, selectedView?: string): AiConsoleProjectionResult {
  if (workspaceSlug !== "models" && workspaceSlug !== "plans") return createNotConnectedProjection("training_design_workspace_not_connected")
  const store = readAiConsoleTrainingDesignStore()
  if (store.status !== "connected") {
    if (store.status === "not_connected") return createNotConnectedProjection(store.reasonCode)
    return createUnknownOrStaleProjection({ sourceIdentity: "ai_console_training_design_registry", writerIdentity: "ai_console_training_design_writer_v1", reasonCode: store.reasonCode, evidenceReferences: store.evidenceReferences })
  }
  let records: readonly Record<string, unknown>[] = workspaceSlug === "models" ? store.modelStructures : store.trainingPlans
  if (workspaceSlug === "models" && selectedView === "输入输出") records = store.modelStructures.map((record) => ({ ...record, modelFamily: `${record.inputConditionSchemaId} → ${record.outputSchemaId}` }))
  if (workspaceSlug === "plans" && selectedView === "数据与种子") records = store.trainingPlans
  return createProjection({
    sourceIdentity: "ai_console_training_design_registry",
    writerIdentity: store.metadata.writerIdentity,
    observedAtUtc: new Date().toISOString(),
    sourceRevision: store.metadata.registryRevision,
    evidenceReferences: [...store.evidenceReferences, trainingDesignStoreLogicalPath],
    trustStatus: "verified_registry",
    records,
  })
}
