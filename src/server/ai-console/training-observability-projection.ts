import { sampleAiConsoleLiveObservability } from "../ai-console-observability/local-observability"
import { createProjection, type AiConsoleProjectionResult } from "./projection-contract"
import { readAiPainterCurrentExecutionSnapshot } from "./ai-painter-current-execution-projection"

export async function queryAiConsoleTrainingObservabilityProjection(): Promise<AiConsoleProjectionResult> {
  const [snapshot, current] = await Promise.all([
    sampleAiConsoleLiveObservability(),
    readAiPainterCurrentExecutionSnapshot(),
  ])
  const activeRunId = readString(current.activeExecution?.runId)
  const reportedTelemetry = snapshot.trainingTelemetry.latest
  const telemetry = activeRunId && reportedTelemetry?.runId === activeRunId ? reportedTelemetry : null
  const currentRunId = activeRunId
    ?? current.latestTrainingTerminal?.runId
    ?? current.currentProjectTask?.runId
    ?? null
  const unavailableFields = telemetry ? [] : [
    "executionId",
    "epoch",
    "batchIndex",
    "batchCount",
    "optimizationStep",
    "loss",
    "learningRate",
    "throughputSamplesPerSecond",
    "estimatedCompletionAtUtc",
    "checkpointIdentity",
    "heartbeatAtUtc",
  ]
  if (!current.ok) unavailableFields.push(
    "registryRevision",
    "currentProjectTaskId",
    "runId",
    "lifecycleStage",
    "executionState",
    "activeExecution",
    "recordedAtAsiaShanghai",
    "latestTrainingStatus",
    "evidenceIntegrity",
  )

  return createProjection({
    dataStatus: current.ok && telemetry ? "connected" : "partial",
    sourceIdentity: "ai_painter_current_execution_with_live_resources_v1",
    writerIdentity: current.writerIdentity ?? snapshot.trainingTelemetry.reporterIdentity ?? "ai_console_query_service",
    observedAtUtc: snapshot.observedAtUtc,
    sourceRevision: current.registryRevision,
    reasonCode: !current.ok
      ? current.reasonCode
      : telemetry
        ? null
        : activeRunId
          ? "active_execution_has_no_matching_training_telemetry"
          : "active_execution_not_registered",
    unavailableFields,
    evidenceReferences: [
      ...current.evidenceReferences,
      ...(telemetry ? snapshot.trainingTelemetry.evidenceReferences : []),
    ],
    trustStatus: current.ok ? "verified_registry" : "direct_observation",
    records: [{
      sampledAtUtc: snapshot.observedAtUtc,
      registryRevision: current.registryRevision,
      currentProjectTaskId: current.currentProjectTask?.taskId ?? null,
      runId: currentRunId,
      lifecycleStage: current.currentProjectTask?.lifecycleStage ?? null,
      executionState: current.currentProjectTask?.executionState ?? null,
      activeExecution: current.activeExecution !== null,
      recordedAtAsiaShanghai: current.recordedAtAsiaShanghai,
      latestTrainingStatus: current.latestTrainingTerminal?.status ?? null,
      evidenceIntegrity: current.integrityStatus,
      executionId: telemetry?.executionId ?? null,
      trainingStage: telemetry?.trainingStage ?? current.currentProjectTask?.lifecycleStage ?? null,
      epoch: telemetry?.epoch ?? null,
      batchIndex: telemetry?.batchIndex ?? null,
      batchCount: telemetry?.batchCount ?? null,
      optimizationStep: telemetry?.optimizationStep ?? null,
      loss: telemetry?.loss ?? null,
      learningRate: telemetry?.learningRate ?? null,
      throughputSamplesPerSecond: telemetry?.throughputSamplesPerSecond ?? null,
      estimatedCompletionAtUtc: telemetry?.estimatedCompletionAtUtc ?? null,
      checkpointIdentity: telemetry?.checkpointIdentity ?? null,
      heartbeatAtUtc: telemetry?.heartbeatAtUtc ?? null,
      cpuUtilization: snapshot.resources.cpuUtilization,
      memoryUtilization: snapshot.resources.memoryUtilization,
      gpuUtilization: snapshot.resources.gpuUtilization,
      vramUtilization: snapshot.resources.vramUtilization,
      gpuTemperatureCelsius: snapshot.resources.gpuTemperatureCelsius,
      gpuPowerDrawWatts: snapshot.resources.gpuPowerDrawWatts,
      detectedTrainingProcessCount: snapshot.trainingProcesses.records.length,
      processObservationStatus: snapshot.trainingProcesses.status,
    }],
  })
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}
