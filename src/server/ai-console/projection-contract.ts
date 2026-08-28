export type AiConsoleProjectionDataStatus = "connected" | "partial" | "not_connected" | "unknown_or_stale"

export type AiConsoleProjectionTrustStatus = "direct_observation" | "verified_registry" | "not_available"

export type AiConsoleProjectionProvenance = {
  sourceIdentity: string
  writerIdentity: string
  observedAtUtc: string
  sourceRevision: number | null
  evidenceReferences: readonly string[]
  trustStatus: AiConsoleProjectionTrustStatus
}

export type AiConsoleProjectionResult<TRecord extends Record<string, unknown> = Record<string, unknown>> = {
  dataStatus: AiConsoleProjectionDataStatus
  sourceIdentity: string
  records: readonly TRecord[] | null
  total: number | null
  nextCursor: string | null
  reasonCode: string | null
  unavailableFields: readonly string[]
  provenance: AiConsoleProjectionProvenance
}

type ProjectionInput<TRecord extends Record<string, unknown>> = {
  sourceIdentity: string
  writerIdentity: string
  observedAtUtc: string
  records: readonly TRecord[]
  dataStatus?: Extract<AiConsoleProjectionDataStatus, "connected" | "partial">
  reasonCode?: string | null
  unavailableFields?: readonly string[]
  sourceRevision?: number | null
  evidenceReferences?: readonly string[]
  trustStatus?: Exclude<AiConsoleProjectionTrustStatus, "not_available">
}

export function createProjection<TRecord extends Record<string, unknown>>(
  input: ProjectionInput<TRecord>,
): AiConsoleProjectionResult<TRecord> {
  return {
    dataStatus: input.dataStatus ?? "connected",
    sourceIdentity: input.sourceIdentity,
    records: input.records,
    total: input.records.length,
    nextCursor: null,
    reasonCode: input.reasonCode ?? null,
    unavailableFields: input.unavailableFields ?? [],
    provenance: {
      sourceIdentity: input.sourceIdentity,
      writerIdentity: input.writerIdentity,
      observedAtUtc: input.observedAtUtc,
      sourceRevision: input.sourceRevision ?? null,
      evidenceReferences: input.evidenceReferences ?? [],
      trustStatus: input.trustStatus ?? "direct_observation",
    },
  }
}

export function createNotConnectedProjection(reasonCode = "authoritative_projection_service_not_connected"): AiConsoleProjectionResult {
  const observedAtUtc = new Date().toISOString()
  const sourceIdentity = "ai_console_projection_router_v1"

  return {
    dataStatus: "not_connected",
    sourceIdentity,
    records: null,
    total: null,
    nextCursor: null,
    reasonCode,
    unavailableFields: [],
    provenance: {
      sourceIdentity,
      writerIdentity: "ai_console_projection_router",
      observedAtUtc,
      sourceRevision: null,
      evidenceReferences: [],
      trustStatus: "not_available",
    },
  }
}

export function createUnknownOrStaleProjection(input: {
  sourceIdentity: string
  writerIdentity: string
  reasonCode: string
  evidenceReferences?: readonly string[]
}): AiConsoleProjectionResult {
  const observedAtUtc = new Date().toISOString()

  return {
    dataStatus: "unknown_or_stale",
    sourceIdentity: input.sourceIdentity,
    records: null,
    total: null,
    nextCursor: null,
    reasonCode: input.reasonCode,
    unavailableFields: [],
    provenance: {
      sourceIdentity: input.sourceIdentity,
      writerIdentity: input.writerIdentity,
      observedAtUtc,
      sourceRevision: null,
      evidenceReferences: input.evidenceReferences ?? [],
      trustStatus: "not_available",
    },
  }
}
