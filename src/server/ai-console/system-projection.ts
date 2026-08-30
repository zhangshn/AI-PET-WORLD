import { access, statfs } from "node:fs/promises"
import { constants as fsConstants } from "node:fs"
import os from "node:os"
import path from "node:path"
import { sampleAiConsoleLiveObservability } from "../ai-console-observability/local-observability"
import {
  createNotConnectedProjection,
  createProjection,
  type AiConsoleProjectionResult,
} from "./projection-contract"

async function readResourceProjection(): Promise<AiConsoleProjectionResult> {
  const snapshot = await sampleAiConsoleLiveObservability()
  const unavailableFields: string[] = []
  if (snapshot.resources.gpuUtilization === null) unavailableFields.push("gpuUtilization")
  if (snapshot.resources.vramUtilization === null) unavailableFields.push("vramUtilization")
  if (snapshot.resources.gpuTemperatureCelsius === null) unavailableFields.push("gpuTemperatureCelsius")
  if (snapshot.resources.gpuPowerDrawWatts === null) unavailableFields.push("gpuPowerDrawWatts")

  return createProjection({
    dataStatus: unavailableFields.length > 0 ? "partial" : "connected",
    sourceIdentity: "ai_console_local_observability_probe_v1",
    writerIdentity: "ai_console_query_service",
    observedAtUtc: snapshot.observedAtUtc,
    reasonCode: snapshot.reasonCodes[0] ?? null,
    unavailableFields,
    records: [{
      sampledAtUtc: snapshot.observedAtUtc,
      cpuUtilization: snapshot.resources.cpuUtilization,
      memoryUtilization: snapshot.resources.memoryUtilization,
      gpuUtilization: snapshot.resources.gpuUtilization,
      vramUtilization: snapshot.resources.vramUtilization,
      gpuTemperatureCelsius: snapshot.resources.gpuTemperatureCelsius,
      gpuPowerDrawWatts: snapshot.resources.gpuPowerDrawWatts,
      diskUtilization: snapshot.resources.diskUtilization,
      diskFreeBytes: snapshot.resources.diskFreeBytes,
      diskTotalBytes: snapshot.resources.diskTotalBytes,
      logicalCpuCount: snapshot.resources.logicalCpuCount,
      totalMemoryBytes: snapshot.resources.memoryTotalBytes,
      gpuMemoryUsedBytes: snapshot.resources.gpuMemoryUsedBytes,
      gpuMemoryTotalBytes: snapshot.resources.gpuMemoryTotalBytes,
      detectedTrainingProcessCount: snapshot.trainingProcesses.records.length,
      hostPlatform: snapshot.host.platform,
      hostArchitecture: snapshot.host.architecture,
    }],
  })
}

async function readServiceProjection(): Promise<AiConsoleProjectionResult> {
  const snapshot = await sampleAiConsoleLiveObservability()
  const processRecords = snapshot.trainingProcesses.records.map((record) => ({
    serviceIdentity: `observed-training-process:${record.processId}`,
    processId: record.processId,
    launchMode: record.commandSummary,
    heartbeatAtUtc: snapshot.observedAtUtc,
    serviceStatus: "observed_process_only",
    lastFailureCode: null,
    runtimeName: record.processName,
    runtimeVersion: null,
    processUptimeSeconds: record.startedAtUtc ? Math.max(0, Math.floor((Date.now() - Date.parse(record.startedAtUtc)) / 1000)) : null,
  }))
  return createProjection({
    dataStatus: snapshot.trainingProcesses.status === "connected" ? "connected" : "partial",
    sourceIdentity: "ai_console_runtime_service_probe_v2",
    writerIdentity: "ai_console_query_service",
    observedAtUtc: snapshot.observedAtUtc,
    reasonCode: snapshot.trainingProcesses.reasonCode,
    records: [{
      serviceIdentity: "ai-console-query-service",
      processId: snapshot.host.queryServiceProcessId,
      launchMode: process.env.NODE_ENV === "production" ? "next-production-server" : "next-development-server",
      heartbeatAtUtc: snapshot.observedAtUtc,
      serviceStatus: "responding",
      lastFailureCode: null,
      runtimeName: process.release.name,
      runtimeVersion: process.version,
      processUptimeSeconds: snapshot.host.queryServiceUptimeSeconds,
    }, ...processRecords],
  })
}

async function checkReadableDirectory(componentId: string, directoryPath: string, observedAtUtc: string): Promise<Record<string, unknown>> {
  try {
    await access(directoryPath, fsConstants.R_OK)
    return {
      healthCheckId: `${componentId}:${observedAtUtc}`,
      componentId,
      componentVersion: path.basename(directoryPath),
      healthStatus: "healthy",
      failureCode: null,
      checkedAtUtc: observedAtUtc,
    }
  } catch {
    return {
      healthCheckId: `${componentId}:${observedAtUtc}`,
      componentId,
      componentVersion: path.basename(directoryPath),
      healthStatus: "unavailable",
      failureCode: "directory_not_readable",
      checkedAtUtc: observedAtUtc,
    }
  }
}

async function readHealthProjection(selectedView: string): Promise<AiConsoleProjectionResult> {
  const snapshot = await sampleAiConsoleLiveObservability()
  const observedAtUtc = snapshot.observedAtUtc
  const projectRoot = process.cwd()
  let records: readonly Record<string, unknown>[]

  if (selectedView === "GPU与驱动") {
    records = snapshot.gpu.adapters.map((adapter) => ({
      healthCheckId: `gpu:${adapter.uuid}:${observedAtUtc}`,
      componentId: adapter.name,
      componentVersion: adapter.driverVersion,
      healthStatus: "healthy",
      failureCode: null,
      checkedAtUtc: observedAtUtc,
      gpuUtilization: adapter.gpuUtilization,
      vramUtilization: adapter.vramUtilization,
      gpuTemperatureCelsius: adapter.temperatureCelsius,
    }))
    if (snapshot.gpu.status !== "connected") return createNotConnectedProjection(snapshot.gpu.reasonCode ?? "gpu_health_probe_unavailable")
  } else if (selectedView === "证据目录") {
    records = [
      await checkReadableDirectory("ai-console-evidence-root", path.join(projectRoot, ".runtime", "ai-console", "evidence"), observedAtUtc),
      await checkReadableDirectory("ai-console-control-root", path.join(projectRoot, ".runtime", "ai-console", "control"), observedAtUtc),
    ]
  } else if (selectedView === "数据库与磁盘") {
    const disk = await statfs(projectRoot)
    records = [
      {
        healthCheckId: `project-filesystem:${observedAtUtc}`,
        componentId: "project-filesystem",
        componentVersion: `${os.platform()}-${os.release()}`,
        healthStatus: disk.bavail > 0 ? "healthy" : "capacity_exhausted",
        failureCode: disk.bavail > 0 ? null : "disk_capacity_exhausted",
        checkedAtUtc: observedAtUtc,
        diskFreeBytes: disk.bavail * disk.bsize,
      },
      await checkReadableDirectory("project-data-root", path.join(projectRoot, "data"), observedAtUtc),
    ]
  } else {
    records = [
      {
        healthCheckId: `node-runtime:${observedAtUtc}`,
        componentId: "node-runtime",
        componentVersion: process.version,
        healthStatus: "healthy",
        failureCode: null,
        checkedAtUtc: observedAtUtc,
      },
      {
        healthCheckId: `host-runtime:${observedAtUtc}`,
        componentId: "host-runtime",
        componentVersion: `${os.platform()}-${os.release()}-${os.arch()}`,
        healthStatus: "healthy",
        failureCode: null,
        checkedAtUtc: observedAtUtc,
      },
    ]
  }

  return createProjection({
    dataStatus: "connected",
    sourceIdentity: "ai_console_deterministic_health_probe_v2",
    writerIdentity: "ai_console_query_service",
    observedAtUtc,
    records,
  })
}

async function readTelemetryProjection(): Promise<AiConsoleProjectionResult> {
  const snapshot = await sampleAiConsoleLiveObservability()
  const samples = [
    ["cpu_utilization", snapshot.resources.cpuUtilization, "percent"],
    ["memory_utilization", snapshot.resources.memoryUtilization, "percent"],
    ["gpu_utilization", snapshot.resources.gpuUtilization, "percent"],
    ["vram_utilization", snapshot.resources.vramUtilization, "percent"],
    ["gpu_temperature", snapshot.resources.gpuTemperatureCelsius, "celsius"],
    ["gpu_power_draw", snapshot.resources.gpuPowerDrawWatts, "watt"],
    ["disk_utilization", snapshot.resources.diskUtilization, "percent"],
  ] as const
  return createProjection({
    dataStatus: "partial",
    sourceIdentity: "ai_console_live_resource_sample_v1",
    writerIdentity: "ai_console_query_service",
    observedAtUtc: snapshot.observedAtUtc,
    reasonCode: "browser_session_history_is_not_formal_evidence",
    records: samples.map(([resourceType, sampleValue, unit]) => ({
      resourceSampleId: `${resourceType}:${snapshot.observedAtUtc}`,
      sampledAtUtc: snapshot.observedAtUtc,
      resourceType,
      sampleValue,
      unit,
      anomalyStatus: sampleValue === null ? "unavailable" : "not_evaluated",
    })),
  })
}

export function hasAiConsoleSystemProjection(workspaceSlug: string): boolean {
  return workspaceSlug === "resources" || workspaceSlug === "services" || workspaceSlug === "health" || workspaceSlug === "telemetry"
}

export function getAiConsoleSystemProjectionAvailability(workspaceSlug: string): "connected" | "partial" | "not_connected" {
  if (workspaceSlug === "resources" || workspaceSlug === "telemetry") return "partial"
  if (workspaceSlug === "services" || workspaceSlug === "health") return "connected"
  return "not_connected"
}

export async function queryAiConsoleSystemProjection(workspaceSlug: string, selectedView: string): Promise<AiConsoleProjectionResult> {
  if (workspaceSlug === "resources") return readResourceProjection()
  if (workspaceSlug === "services") return readServiceProjection()
  if (workspaceSlug === "health") return readHealthProjection(selectedView)
  if (workspaceSlug === "telemetry") return readTelemetryProjection()
  return createNotConnectedProjection()
}
