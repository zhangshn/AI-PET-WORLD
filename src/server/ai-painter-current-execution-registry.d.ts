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

export type CurrentExecutionRegistryFileBinding = {
  path: string
  sha256: string
}

export type CurrentExecutionRegistryActiveExecution = {
  schemaVersion: "ai-painter-current-active-execution-v1"
  capabilityVersion: string
  packageId: string
  runId: string
  executionState: "preflight" | "executing" | "validating" | "reviewing" | "adjudicating" | "finalizing"
  processId: number
  processStartIdentity: string
  programLineage: Record<string, CurrentExecutionRegistryFileBinding>
  lock: CurrentExecutionRegistryFileBinding
  heartbeat: {
    path: string
    ttlSeconds: number
  }
}

export type CurrentExecutionRegistryAdvanceInput = {
  projectRoot?: string
  capabilityVersion: string
  packageId: string
  taskId: string
  taskKind: string
  taskGoal?: string | null
  priority?: number | null
  queueStatus?: "ready" | "running" | "completed" | "failed_closed" | "blocked_policy_boundary" | null
  nextMachineAction?: string | null
  queuedAtUtc?: string | null
  runId: string
  lifecycleStage: string
  executionState: string
  activity: string
  taskCapsulePath: string
  terminalEvidencePath: string
  latestTrainingTerminal?: Record<string, unknown> | null
  activeExecution?: CurrentExecutionRegistryActiveExecution | null
  expectedPreviousRegistryRevision?: number | null
  expectedPreviousRegistrySha256?: string | null
  dependencyManifest?: Record<string, unknown> | null
  _testHooks?: Record<string, unknown> | null
}

export function prepareCurrentExecutionRegistryAdvance(
  input: CurrentExecutionRegistryAdvanceInput,
): Promise<Record<string, unknown>>

export function advanceCurrentExecutionRegistry(
  input: CurrentExecutionRegistryAdvanceInput,
): Promise<CurrentExecutionRegistryReadResult>

export function recoverExpiredActiveExecutionToFailedClosed(input: {
  projectRoot?: string
  capabilityVersion: string
  packageId: string
  runId: string
  taskCapsulePath: string
  terminalEvidencePath: string
  dependencyManifest?: Record<string, unknown> | null
  expectedPreviousRegistryRevision: number
  expectedPreviousRegistrySha256: string
  _testHooks?: Record<string, unknown> | null
}): Promise<CurrentExecutionRegistryReadResult>

export function finalizePreparedCurrentExecutionRegistryAdvance(input: {
  projectRoot?: string
  transactionId: string
  _testHooks?: Record<string, unknown> | null
}): Promise<CurrentExecutionRegistryReadResult>

export function recoverPreparedCurrentExecutionRegistryAdvance(input: {
  projectRoot?: string
  transactionId?: string | null
  _testHooks?: Record<string, unknown> | null
}): Promise<CurrentExecutionRegistryReadResult>
