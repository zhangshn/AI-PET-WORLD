import {
  readAiConsoleRuntimeReleaseRegistryStore,
} from "@/server/ai-console-control/runtime-release-registry-store"
import {
  readAiConsoleWorldControlRegistryStore,
} from "@/server/ai-console-control/world-control-registry-store"
import {
  createNotConnectedProjection,
  createProjection,
  createUnknownOrStaleProjection,
  type AiConsoleProjectionResult,
} from "./projection-contract"

const runtimeReleaseSource = "ai_console_runtime_release_registry"
const worldControlSource = "ai_console_world_control_registry"

export function getAiConsoleRuntimeProjectionAvailability(workspaceSlug: string): "connected" | "partial" | "not_connected" {
  if (workspaceSlug === "candidates" || workspaceSlug === "frames") return "connected"
  if (workspaceSlug === "world") return "connected"
  return "not_connected"
}

export async function queryAiConsoleRuntimeProjection(
  workspaceSlug: string,
): Promise<AiConsoleProjectionResult> {
  if (workspaceSlug === "candidates" || workspaceSlug === "frames") {
    return queryRuntimeReleaseProjection(workspaceSlug)
  }
  if (workspaceSlug === "world") return queryWorldControlProjection()
  return createNotConnectedProjection()
}

function queryRuntimeReleaseProjection(workspaceSlug: "candidates" | "frames"): AiConsoleProjectionResult {
  const store = readAiConsoleRuntimeReleaseRegistryStore()
  if (store.status === "not_connected") return createNotConnectedProjection(store.reasonCode)
  if (store.status !== "connected") {
    return createUnknownOrStaleProjection({
      sourceIdentity: runtimeReleaseSource,
      writerIdentity: "ai_console_runtime_release_registry_writer_v1",
      reasonCode: store.reasonCode,
      evidenceReferences: store.evidenceReferences,
    })
  }

  const records: readonly Record<string, unknown>[] = workspaceSlug === "candidates"
    ? store.candidates
    : store.publications
  return createProjection({
    sourceIdentity: runtimeReleaseSource,
    writerIdentity: store.metadata.writerIdentity,
    observedAtUtc: store.metadata.updatedAtUtc,
    sourceRevision: store.metadata.registryRevision,
    evidenceReferences: store.evidenceReferences,
    trustStatus: "verified_registry",
    records,
  })
}

function queryWorldControlProjection(): AiConsoleProjectionResult {
  const store = readAiConsoleWorldControlRegistryStore()
  if (store.status === "not_connected") return createNotConnectedProjection(store.reasonCode)
  if (store.status !== "connected") {
    return createUnknownOrStaleProjection({
      sourceIdentity: worldControlSource,
      writerIdentity: "ai_console_world_control_registry_writer_v1",
      reasonCode: store.reasonCode,
      evidenceReferences: store.evidenceReferences,
    })
  }
  return createProjection({
    sourceIdentity: worldControlSource,
    writerIdentity: store.metadata.writerIdentity,
    observedAtUtc: store.metadata.updatedAtUtc,
    sourceRevision: store.metadata.registryRevision,
    evidenceReferences: store.evidenceReferences,
    trustStatus: "verified_registry",
    records: store.currentWorldStates,
  })
}
