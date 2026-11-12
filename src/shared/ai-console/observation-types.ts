export type AiConsoleLiveSnapshot = {
  ok: true
  schemaVersion: "ai_console_live_observability_v2"
  observedAtUtc: string
  sampleSequence: number
  sampleStartedAtUtc: string
  sampleCompletedAtUtc: string
  sampleDurationMs: number
  timestampPrecision: "milliseconds"
  refreshIntervalMs: number
  channelTimings: Record<"cpu" | "memory" | "disk" | "gpu" | "trainingProcesses" | "trainingTelemetry", {
    sampledAtUtc: string
    sampleDurationMs: number
  }>
  sourceIdentity: string
  trustStatus: "direct_observation"
  dataStatus: "connected" | "partial"
  reasonCodes: readonly string[]
  resources: {
    cpuUtilization: number | null
    logicalCpuCount: number
    cpuModel: string | null
    memoryUsedBytes: number
    memoryTotalBytes: number
    memoryUtilization: number | null
    diskUsedBytes: number
    diskFreeBytes: number
    diskTotalBytes: number
    diskUtilization: number | null
    gpuUtilization: number | null
    gpuMemoryUsedBytes: number | null
    gpuMemoryTotalBytes: number | null
    vramUtilization: number | null
    gpuTemperatureCelsius: number | null
    gpuPowerDrawWatts: number | null
    gpuPowerLimitWatts: number | null
  }
  gpu: {
    status: "connected" | "not_available"
    probeIdentity: string
    adapters: readonly {
      index: number
      name: string
      uuid: string
      driverVersion: string | null
      gpuUtilization: number | null
      memoryUsedBytes: number | null
      memoryTotalBytes: number | null
      vramUtilization: number | null
      temperatureCelsius: number | null
      powerDrawWatts: number | null
      powerLimitWatts: number | null
      fanSpeedPercent: number | null
    }[]
    reasonCode: string | null
  }
  trainingProcesses: {
    status: "connected" | "not_available"
    probeIdentity: string
    records: readonly {
      processId: number
      processName: string
      commandSummary: string
      startedAtUtc: string | null
      workingSetBytes: number | null
      gpuMemoryBytes: number | null
      observationKind: "training_process_pattern_match"
    }[]
    reasonCode: string | null
  }
  trainingTelemetry: {
    status: "connected" | "not_connected" | "unknown_or_stale"
    reporterIdentity: string | null
    latest: {
      sampleId: string
      sampleSequence: number
      runId: string
      executionId: string
      processId: number | null
      trainingStage: string | null
      epoch: number | null
      batchIndex: number | null
      batchCount: number | null
      optimizationStep: number | null
      loss: number | null
      learningRate: number | null
      throughputSamplesPerSecond: number | null
      estimatedCompletionAtUtc: string | null
      checkpointIdentity: string | null
      heartbeatAtUtc: string
      reportedAtUtc: string
      reporterIdentity: string
      schemaVersion: string
      recordSha256: string
    } | null
    reasonCode: string | null
    sourceRevision: number | null
    evidenceReferences: readonly string[]
  }
  host: {
    hostname: string
    platform: string
    architecture: string
    release: string
    systemUptimeSeconds: number
    queryServiceProcessId: number
    queryServiceUptimeSeconds: number
  }
}

export type ExperimentTiming = { availability: string; scope: string; elapsedSeconds: number;
  startedAtUtc: null; endedAtUtc: null; sourcePath: string; sourceSha256: string }
