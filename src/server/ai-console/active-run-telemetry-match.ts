export function matchesCurrentTrainingTelemetry(input: {
  registryVerified: boolean
  activeRunId: unknown
  activeProcessId: unknown
  telemetryStatus: string
  reportedRunId: unknown
  reportedProcessId: unknown
}): boolean {
  return input.registryVerified
    && input.telemetryStatus === "connected"
    && typeof input.activeRunId === "string"
    && input.activeRunId.length > 0
    && input.reportedRunId === input.activeRunId
    && typeof input.activeProcessId === "number"
    && Number.isSafeInteger(input.activeProcessId)
    && input.activeProcessId > 0
    && input.reportedProcessId === input.activeProcessId
}
