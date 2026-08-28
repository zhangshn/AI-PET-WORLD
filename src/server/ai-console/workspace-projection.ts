import type { AiConsoleWorkspaceDefinition } from "@/app/ai-console/ai-console-workspace-catalog"
import { queryAiConsoleCapabilityProjection } from "./capability-projection"
import { queryAiConsoleControlProjection } from "./control-projection"
import { createNotConnectedProjection, type AiConsoleProjectionResult } from "./projection-contract"
import { queryAiConsoleDataProjection } from "./data-projection"
import { queryAiConsoleEvidenceProjection } from "./evidence-projection"
import { queryAiConsoleRuntimeProjection } from "./runtime-projection"
import { queryAiConsolePrimaryRegistryProjection } from "./registry-projection"
import { queryAiConsoleSystemProjection } from "./system-projection"
import { queryAiConsoleTaskProjection } from "./task-projection"

export async function queryAiConsoleWorkspaceProjection(
  workspace: AiConsoleWorkspaceDefinition,
  selectedView: string,
): Promise<AiConsoleProjectionResult> {
  if (workspace.moduleSlug === "system") {
    return queryAiConsoleSystemProjection(workspace.slug, selectedView)
  }
  if (workspace.moduleSlug === "capabilities") {
    return queryAiConsoleCapabilityProjection(workspace.slug, selectedView)
  }
  if (workspace.moduleSlug === "data") {
    return queryAiConsoleDataProjection(workspace.slug, selectedView)
  }
  if (workspace.moduleSlug === "tasks") {
    return queryAiConsoleTaskProjection(workspace.slug, selectedView)
  }
  if (workspace.moduleSlug === "runtime") {
    return queryAiConsoleRuntimeProjection(workspace.slug)
  }
  if (workspace.moduleSlug === "evidence") {
    return queryAiConsoleEvidenceProjection(workspace.slug, selectedView)
  }
  if (workspace.moduleSlug === "training" || workspace.moduleSlug === "reviews" || workspace.moduleSlug === "archive") {
    return queryAiConsolePrimaryRegistryProjection(workspace)
  }
  if (workspace.moduleSlug === "control") {
    return queryAiConsoleControlProjection(workspace.slug)
  }
  return createNotConnectedProjection()
}
