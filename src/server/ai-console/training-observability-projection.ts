import { sampleAiConsoleLiveObservability } from "../ai-console-observability/local-observability"
import { createProjection, type AiConsoleProjectionResult } from "./projection-contract"
import { readAiPainterCurrentExecutionSnapshot } from "./ai-painter-current-execution-projection"
// This module is a pure mapper with type-only dependencies, shared with the UI.
import { mapTrainingSummary, type CurrentSummarySnapshot } from "../../app/ai-console/ai-console-training-summary-model"

export async function queryAiConsoleTrainingObservabilityProjection(): Promise<AiConsoleProjectionResult> {
  const [snapshot, current] = await Promise.all([
    sampleAiConsoleLiveObservability(),
    readAiPainterCurrentExecutionSnapshot(),
  ])
  const summary = mapTrainingSummary(
    { connection: "ready", snapshot: current as CurrentSummarySnapshot, errorCode: current.reasonCode },
    { connection: "connected", snapshot: { ...snapshot, ok: true } },
  )
  const currentRunId = summary.registryFresh ? summary.activeRunId
    ?? current.latestTrainingTerminal?.runId
    ?? current.currentProjectTask?.runId
    ?? null : null
  const legacy = summary.metricSource === "matched_training_telemetry_v1" ? snapshot.trainingTelemetry.latest : null
  const record = {
    sampledAtUtc: snapshot.observedAtUtc,
    registryRevision: summary.registryFresh ? current.registryRevision : null,
    currentProjectTaskId: summary.registryFresh ? current.currentProjectTask?.taskId ?? null : null,
    runId: currentRunId,
    lifecycleStage: summary.registryFresh ? current.currentProjectTask?.lifecycleStage ?? null : null,
    executionState: summary.registryFresh ? current.currentProjectTask?.executionState ?? null : null,
    activeExecution: summary.registryFresh && current.activeExecution !== null,
    recordedAtAsiaShanghai: summary.registryFresh ? current.recordedAtAsiaShanghai : null,
    latestTrainingStatus: summary.registryFresh ? current.latestTrainingTerminal?.status ?? null : null,
    evidenceIntegrity: summary.registryFresh ? current.integrityStatus : "unavailable",
    training: summary.training,
    trainingStatus: summary.status,
    phase: summary.metricPhase,
    metricsReasonCode: summary.metricReasonCode,
    metricsSourceIdentity: summary.metricSource,
    metricsSourcePath: summary.metricSourcePath,
    metricsSourceSha256: summary.metricSourceSha256,
    processId: summary.processId,
    executionId: summary.training ? legacy?.executionId ?? null : null,
    trainingStage: summary.training ? legacy?.trainingStage ?? current.currentProjectTask?.lifecycleStage ?? null : null,
    epoch: summary.epoch,
    batchIndex: summary.batchIndex,
    batchCount: summary.batchCount,
    optimizationStep: summary.optimizerStep,
    discriminatorOptimizerSteps: summary.discriminatorOptimizerSteps,
    targetEpochs: summary.targetEpochs,
    targetOptimizerSteps: summary.targetOptimizerSteps,
    targetDiscriminatorOptimizerSteps: summary.targetDiscriminatorOptimizerSteps,
    loss: summary.loss,
    learningRate: summary.learningRate,
    throughputSamplesPerSecond: summary.throughputSamplesPerSecond,
    estimatedCompletionAtUtc: summary.eta,
    checkpointIdentity: summary.checkpointIdentity,
    reportedAtUtc: summary.lastMetricAt,
    heartbeatAtUtc: summary.heartbeatAtUtc,
    lastKnownEpoch: summary.lastKnownEpoch,
    lastKnownGeneratorSteps: summary.lastKnownGeneratorSteps,
    lastKnownCriticSteps: summary.lastKnownCriticSteps,
    lastKnownMetricAt: summary.lastKnownMetricAt,
    terminalEpochs: summary.terminalEpochs,
    terminalGeneratorSteps: summary.terminalGeneratorSteps,
    terminalCriticSteps: summary.terminalCriticSteps,
    cpuUtilization: snapshot.resources.cpuUtilization,
    memoryUtilization: snapshot.resources.memoryUtilization,
    gpuUtilization: snapshot.resources.gpuUtilization,
    vramUtilization: snapshot.resources.vramUtilization,
    gpuTemperatureCelsius: snapshot.resources.gpuTemperatureCelsius,
    gpuPowerDrawWatts: snapshot.resources.gpuPowerDrawWatts,
    detectedTrainingProcessCount: snapshot.trainingProcesses.records.length,
    processObservationStatus: snapshot.trainingProcesses.status,
  }
  const unavailableFields = Object.entries(record).filter(([key, value]) => key !== "metricsReasonCode" && value === null).map(([key]) => key)
  if (!summary.registryFresh) unavailableFields.push("activeExecution", "evidenceIntegrity")

  return createProjection({
    dataStatus: summary.registryFresh && summary.metricSource ? "connected" : "partial",
    sourceIdentity: "ai_painter_current_execution_with_live_resources_v1",
    writerIdentity: current.writerIdentity ?? snapshot.trainingTelemetry.reporterIdentity ?? "ai_console_query_service",
    observedAtUtc: snapshot.observedAtUtc,
    sourceRevision: summary.registryFresh ? current.registryRevision : null,
    reasonCode: summary.metricReasonCode,
    unavailableFields,
    evidenceReferences: [...new Set([
      ...current.evidenceReferences,
      ...(summary.metricSourcePath ? [summary.metricSourcePath] : []),
      ...(legacy ? snapshot.trainingTelemetry.evidenceReferences : []),
    ])],
    trustStatus: summary.registryFresh ? "verified_registry" : "direct_observation",
    records: [record],
  })
}
