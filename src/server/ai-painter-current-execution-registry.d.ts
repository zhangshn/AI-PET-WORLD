export const CURRENT_EXECUTION_REGISTRY_ROOT: string
export const CURRENT_EXECUTION_REGISTRY_PATH: string

export type CurrentExecutionRegistryReadResult = {
  ok: boolean
  status: "verified" | "unknown_or_stale"
  errorCode?: string
  registry: Record<string, unknown> | null
  registrySha256: string | null
  taskCapsule: Record<string, unknown> | null
  currentTaskTerminal: Record<string, unknown> | null
  latestTrainingExecution: Record<string, unknown> | null
  archivedNamespaces: string[]
}

export function readCurrentExecutionRegistry(
  projectRoot?: string,
): Promise<CurrentExecutionRegistryReadResult>

export function initializeCurrentExecutionRegistry(input: {
  projectRoot?: string
  currentTaskCapsulePath: string
  currentTaskTerminalPath: string
  currentCandidatePath: string
  latestTrainingTerminalPath: string
  archivedEvidenceNamespaces: string[]
}): Promise<CurrentExecutionRegistryReadResult>
