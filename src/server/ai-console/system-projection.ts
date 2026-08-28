import { access, statfs } from "node:fs/promises"
import { constants as fsConstants } from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  createNotConnectedProjection,
  createProjection,
  type AiConsoleProjectionResult,
} from "./projection-contract"

type CpuTimes = {
  idle: number
  total: number
}

function readCpuTimes(): CpuTimes {
  return os.cpus().reduce<CpuTimes>((summary, cpu) => {
    const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0)
    return { idle: summary.idle + cpu.times.idle, total: summary.total + total }
  }, { idle: 0, total: 0 })
}

async function sampleCpuUtilization(sampleWindowMs = 120): Promise<number | null> {
  const first = readCpuTimes()
  await new Promise((resolve) => setTimeout(resolve, sampleWindowMs))
  const second = readCpuTimes()
  const totalDelta = second.total - first.total
  const idleDelta = second.idle - first.idle
  if (totalDelta <= 0) return null
  return Number(Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100)).toFixed(2))
}

function percent(used: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null
  return Number(Math.max(0, Math.min(100, (used / total) * 100)).toFixed(2))
}

async function readResourceProjection(): Promise<AiConsoleProjectionResult> {
  const observedAtUtc = new Date().toISOString()
  const projectRoot = process.cwd()
  const [cpuUtilization, disk] = await Promise.all([
    sampleCpuUtilization(),
    statfs(projectRoot),
  ])
  const totalMemory = os.totalmem()
  const usedMemory = totalMemory - os.freemem()
  const unavailableFields = ["gpuUtilization", "vramUtilization"]

  return createProjection({
    dataStatus: "partial",
    sourceIdentity: "ai_console_local_resource_probe_v1",
    writerIdentity: "ai_console_query_service",
    observedAtUtc,
    reasonCode: "gpu_telemetry_adapter_not_connected",
    unavailableFields,
    records: [{
      sampledAtUtc: observedAtUtc,
      cpuUtilization,
      memoryUtilization: percent(usedMemory, totalMemory),
      gpuUtilization: null,
      vramUtilization: null,
      diskFreeBytes: disk.bavail * disk.bsize,
      diskTotalBytes: disk.blocks * disk.bsize,
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: totalMemory,
      hostPlatform: os.platform(),
      hostArchitecture: os.arch(),
      probeRoot: path.basename(projectRoot),
    }],
  })
}

function readServiceProjection(): AiConsoleProjectionResult {
  const observedAtUtc = new Date().toISOString()
  return createProjection({
    sourceIdentity: "ai_console_runtime_service_probe_v1",
    writerIdentity: "ai_console_query_service",
    observedAtUtc,
    records: [{
      serviceIdentity: "ai-console-query-service",
      processId: process.pid,
      launchMode: process.env.NODE_ENV === "production" ? "next-production-server" : "next-development-server",
      heartbeatAtUtc: observedAtUtc,
      serviceStatus: "responding",
      lastFailureCode: null,
      runtimeName: process.release.name,
      runtimeVersion: process.version,
      processUptimeSeconds: Math.floor(process.uptime()),
    }],
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
  if (selectedView === "GPU与驱动") return createNotConnectedProjection("gpu_health_adapter_not_connected")
  if (selectedView === "证据目录") return createNotConnectedProjection("evidence_health_adapter_not_connected")

  const observedAtUtc = new Date().toISOString()
  const projectRoot = process.cwd()
  let records: readonly Record<string, unknown>[]

  if (selectedView === "数据库与磁盘") {
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
    dataStatus: "partial",
    sourceIdentity: "ai_console_deterministic_health_probe_v1",
    writerIdentity: "ai_console_query_service",
    observedAtUtc,
    reasonCode: "persistent_health_ledger_not_connected",
    records,
  })
}

export function hasAiConsoleSystemProjection(workspaceSlug: string): boolean {
  return workspaceSlug === "resources" || workspaceSlug === "services" || workspaceSlug === "health"
}

export function getAiConsoleSystemProjectionAvailability(workspaceSlug: string): "connected" | "partial" | "not_connected" {
  if (workspaceSlug === "resources") return "partial"
  if (workspaceSlug === "services") return "connected"
  if (workspaceSlug === "health") return "partial"
  return "not_connected"
}

export async function queryAiConsoleSystemProjection(workspaceSlug: string, selectedView: string): Promise<AiConsoleProjectionResult> {
  if (workspaceSlug === "resources") return readResourceProjection()
  if (workspaceSlug === "services") return readServiceProjection()
  if (workspaceSlug === "health") return readHealthProjection(selectedView)
  return createNotConnectedProjection()
}
