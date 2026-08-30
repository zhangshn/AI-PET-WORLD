import { execFile } from "node:child_process"
import { statfs } from "node:fs/promises"
import os from "node:os"
import { promisify } from "node:util"
import { readLatestAiConsoleTrainingTelemetry, type AiConsoleTrainingTelemetryRecord } from "./training-telemetry-store"

const execFileAsync = promisify(execFile)
const targetRefreshIntervalMs = 250
const snapshotCacheWindowMs = 75
const gpuProbeCacheWindowMs = 200
const processProbeCacheWindowMs = 2_000
const cpuSampleWindowMs = 80

type CpuTimes = { idle: number; total: number }
type TimedSample<T> = { value: T; sampledAtUtc: string; sampleDurationMs: number }
type ChannelTiming = { sampledAtUtc: string; sampleDurationMs: number }

export type AiConsoleGpuAdapterSnapshot = {
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
}

export type AiConsoleObservedTrainingProcess = {
  processId: number
  processName: string
  commandSummary: string
  startedAtUtc: string | null
  workingSetBytes: number | null
  gpuMemoryBytes: number | null
  observationKind: "training_process_pattern_match"
}

export type AiConsoleLiveObservabilitySnapshot = {
  schemaVersion: "ai_console_live_observability_v2"
  observedAtUtc: string
  sampleSequence: number
  sampleStartedAtUtc: string
  sampleCompletedAtUtc: string
  sampleDurationMs: number
  timestampPrecision: "milliseconds"
  refreshIntervalMs: number
  channelTimings: {
    cpu: ChannelTiming
    memory: ChannelTiming
    disk: ChannelTiming
    gpu: ChannelTiming
    trainingProcesses: ChannelTiming
    trainingTelemetry: ChannelTiming
  }
  sourceIdentity: "ai_console_local_observability_probe_v1"
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
    probeIdentity: "nvidia_smi_readonly_probe_v1"
    adapters: readonly AiConsoleGpuAdapterSnapshot[]
    reasonCode: string | null
  }
  trainingProcesses: {
    status: "connected" | "not_available"
    probeIdentity: "local_process_readonly_probe_v1"
    records: readonly AiConsoleObservedTrainingProcess[]
    reasonCode: string | null
  }
  trainingTelemetry: {
    status: "connected" | "not_connected" | "unknown_or_stale"
    reporterIdentity: string | null
    latest: AiConsoleTrainingTelemetryRecord | null
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

type ProcessProbeResult = AiConsoleLiveObservabilitySnapshot["trainingProcesses"]
type GpuProbeResult = AiConsoleLiveObservabilitySnapshot["gpu"] & { processMemoryByPid: ReadonlyMap<number, number> }

let cachedSnapshot: AiConsoleLiveObservabilitySnapshot | null = null
let cachedSnapshotAt = 0
let snapshotInFlight: Promise<AiConsoleLiveObservabilitySnapshot> | null = null
let cachedGpuProbe: TimedSample<GpuProbeResult> | null = null
let cachedGpuProbeAt = 0
let gpuProbeInFlight: Promise<TimedSample<GpuProbeResult>> | null = null
let cachedProcessProbe: TimedSample<ProcessProbeResult> | null = null
let cachedProcessProbeAt = 0
let processProbeInFlight: Promise<TimedSample<ProcessProbeResult>> | null = null
let liveSampleSequence = 0

function elapsedMilliseconds(startedAt: bigint): number {
  return Number((Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(3))
}

async function captureTimed<T>(operation: () => Promise<T> | T): Promise<TimedSample<T>> {
  const startedAt = process.hrtime.bigint()
  const value = await operation()
  return { value, sampledAtUtc: new Date().toISOString(), sampleDurationMs: elapsedMilliseconds(startedAt) }
}

function timingOf<T>(sample: TimedSample<T>): ChannelTiming {
  return { sampledAtUtc: sample.sampledAtUtc, sampleDurationMs: sample.sampleDurationMs }
}

function readCpuTimes(): CpuTimes {
  return os.cpus().reduce<CpuTimes>((summary, cpu) => {
    const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0)
    return { idle: summary.idle + cpu.times.idle, total: summary.total + total }
  }, { idle: 0, total: 0 })
}

async function sampleCpuUtilization(sampleWindowMs = cpuSampleWindowMs): Promise<number | null> {
  const first = readCpuTimes()
  await new Promise((resolve) => setTimeout(resolve, sampleWindowMs))
  const second = readCpuTimes()
  const totalDelta = second.total - first.total
  const idleDelta = second.idle - first.idle
  if (totalDelta <= 0) return null
  return roundPercent(((totalDelta - idleDelta) / totalDelta) * 100)
}

function roundPercent(value: number): number {
  return Number(Math.max(0, Math.min(100, value)).toFixed(2))
}

function percent(used: number, total: number): number | null {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return null
  return roundPercent((used / total) * 100)
}

function parseNullableNumber(value: string | undefined): number | null {
  if (!value) return null
  const normalized = value.trim()
  if (!normalized || /^N\/A|\[Not Supported\]|Not Supported$/iu.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function mibToBytes(value: number | null): number | null {
  return value === null ? null : Math.round(value * 1024 * 1024)
}

function csvRows(stdout: string): string[][] {
  return stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).map((line) => line.split(",").map((cell) => cell.trim()))
}

async function probeGpuUncached(): Promise<GpuProbeResult> {
  const adapterArguments = [
    "--query-gpu=index,name,uuid,driver_version,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,power.limit,fan.speed",
    "--format=csv,noheader,nounits",
  ]
  try {
    const [adapterResult, processResult] = await Promise.all([
      execFileAsync("nvidia-smi", adapterArguments, { timeout: 2_000, windowsHide: true, maxBuffer: 256 * 1024 }),
      execFileAsync("nvidia-smi", ["--query-compute-apps=pid,used_gpu_memory", "--format=csv,noheader,nounits"], { timeout: 2_000, windowsHide: true, maxBuffer: 256 * 1024 }).catch(() => ({ stdout: "", stderr: "" })),
    ])
    const adapters = csvRows(String(adapterResult.stdout)).map<AiConsoleGpuAdapterSnapshot>((cells) => {
      const memoryUsedBytes = mibToBytes(parseNullableNumber(cells[5]))
      const memoryTotalBytes = mibToBytes(parseNullableNumber(cells[6]))
      return {
        index: Number(cells[0]),
        name: cells[1] || "NVIDIA GPU",
        uuid: cells[2] || "unavailable",
        driverVersion: cells[3] || null,
        gpuUtilization: parseNullableNumber(cells[4]),
        memoryUsedBytes,
        memoryTotalBytes,
        vramUtilization: memoryUsedBytes !== null && memoryTotalBytes !== null ? percent(memoryUsedBytes, memoryTotalBytes) : null,
        temperatureCelsius: parseNullableNumber(cells[7]),
        powerDrawWatts: parseNullableNumber(cells[8]),
        powerLimitWatts: parseNullableNumber(cells[9]),
        fanSpeedPercent: parseNullableNumber(cells[10]),
      }
    }).filter((adapter) => Number.isInteger(adapter.index))
    const processMemoryByPid = new Map<number, number>()
    for (const [pidValue, memoryValue] of csvRows(String(processResult.stdout))) {
      const pid = Number(pidValue)
      const memory = mibToBytes(parseNullableNumber(memoryValue))
      if (Number.isInteger(pid) && memory !== null) processMemoryByPid.set(pid, memory)
    }
    return { status: "connected", probeIdentity: "nvidia_smi_readonly_probe_v1", adapters, reasonCode: null, processMemoryByPid }
  } catch {
    return {
      status: "not_available",
      probeIdentity: "nvidia_smi_readonly_probe_v1",
      adapters: [],
      reasonCode: "nvidia_smi_readonly_probe_unavailable",
      processMemoryByPid: new Map(),
    }
  }
}

async function refreshGpuProbe(): Promise<TimedSample<GpuProbeResult>> {
  if (gpuProbeInFlight) return gpuProbeInFlight
  gpuProbeInFlight = captureTimed(probeGpuUncached).then((sample) => {
    cachedGpuProbe = sample
    cachedGpuProbeAt = Date.now()
    return sample
  }).finally(() => {
    gpuProbeInFlight = null
  })
  return gpuProbeInFlight
}

async function probeGpu(): Promise<TimedSample<GpuProbeResult>> {
  const availableSample = cachedGpuProbe
  if (!availableSample) return refreshGpuProbe()
  return Date.now() - cachedGpuProbeAt >= gpuProbeCacheWindowMs ? refreshGpuProbe() : availableSample
}

function trainingProcessPatternMatches(processName: string, commandLine: string): boolean {
  const name = processName.toLowerCase()
  if (!/(?:python|pythonw|torchrun|accelerate|node)/u.test(name)) return false
  return /(?:^|[\\/\s_.-])(?:train|training|trainer)(?:[\\/\s_.-]|$)|torchrun|accelerate\s+launch/iu.test(commandLine)
}

function commandSummary(processName: string, commandLine: string): string {
  const scriptMatch = commandLine.match(/(?:^|\s|")([^"\s]+\.(?:py|mjs|js|ps1))(?:(?:")|\s|$)/iu)
  if (!scriptMatch?.[1]) return processName
  return `${processName} · ${scriptMatch[1].split(/[\\/]/u).pop() ?? scriptMatch[1]}`
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

async function probeWindowsProcesses(): Promise<ProcessProbeResult> {
  const command = "$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='pythonw.exe' OR Name='node.exe' OR Name='torchrun.exe' OR Name='accelerate.exe'\" | Select-Object ProcessId,Name,CommandLine,CreationDate,WorkingSetSize | ConvertTo-Json -Compress -Depth 3"
  const result = await execFileAsync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], {
    timeout: 3_000,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  })
  const parsed = JSON.parse(String(result.stdout)) as Record<string, unknown> | readonly Record<string, unknown>[]
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  const records = rows.flatMap<AiConsoleObservedTrainingProcess>((row) => {
    const processId = Number(row.ProcessId)
    const processName = typeof row.Name === "string" ? row.Name : "unknown"
    const processCommandLine = typeof row.CommandLine === "string" ? row.CommandLine : ""
    if (!Number.isInteger(processId) || !trainingProcessPatternMatches(processName, processCommandLine)) return []
    const workingSetBytes = Number(row.WorkingSetSize)
    return [{
      processId,
      processName,
      commandSummary: commandSummary(processName, processCommandLine),
      startedAtUtc: normalizeDate(row.CreationDate),
      workingSetBytes: Number.isFinite(workingSetBytes) ? workingSetBytes : null,
      gpuMemoryBytes: null,
      observationKind: "training_process_pattern_match",
    }]
  })
  return { status: "connected", probeIdentity: "local_process_readonly_probe_v1", records, reasonCode: null }
}

async function probePosixProcesses(): Promise<ProcessProbeResult> {
  const result = await execFileAsync("ps", ["-eo", "pid=,comm=,etimes=,rss=,args="], { timeout: 2_000, maxBuffer: 4 * 1024 * 1024 })
  const records: AiConsoleObservedTrainingProcess[] = []
  for (const line of String(result.stdout).split(/\r?\n/u)) {
    const match = line.trim().match(/^(\d+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(.+)$/u)
    if (!match) continue
    const [, processIdValue, processName, elapsedValue, rssValue, processCommandLine] = match
    if (!trainingProcessPatternMatches(processName, processCommandLine)) continue
    const elapsedSeconds = Number(elapsedValue)
    records.push({
      processId: Number(processIdValue),
      processName,
      commandSummary: commandSummary(processName, processCommandLine),
      startedAtUtc: Number.isFinite(elapsedSeconds) ? new Date(Date.now() - elapsedSeconds * 1000).toISOString() : null,
      workingSetBytes: Number(rssValue) * 1024,
      gpuMemoryBytes: null,
      observationKind: "training_process_pattern_match",
    })
  }
  return { status: "connected", probeIdentity: "local_process_readonly_probe_v1", records, reasonCode: null }
}

async function refreshTrainingProcesses(): Promise<TimedSample<ProcessProbeResult>> {
  if (processProbeInFlight) return processProbeInFlight
  processProbeInFlight = captureTimed(async () => {
    try {
      return os.platform() === "win32" ? await probeWindowsProcesses() : await probePosixProcesses()
    } catch {
      return {
        status: "not_available" as const,
        probeIdentity: "local_process_readonly_probe_v1" as const,
        records: [],
        reasonCode: "local_process_readonly_probe_unavailable",
      }
    }
  }).then((sample) => {
    cachedProcessProbe = sample
    cachedProcessProbeAt = Date.now()
    return sample
  }).finally(() => {
    processProbeInFlight = null
  })
  return processProbeInFlight
}

async function probeTrainingProcesses(): Promise<TimedSample<ProcessProbeResult>> {
  const availableSample = cachedProcessProbe
  if (!availableSample) return refreshTrainingProcesses()
  if (Date.now() - cachedProcessProbeAt >= processProbeCacheWindowMs) void refreshTrainingProcesses()
  return availableSample
}

function sumNullable(values: readonly (number | null)[]): number | null {
  const available = values.filter((value): value is number => value !== null)
  return available.length > 0 ? available.reduce((sum, value) => sum + value, 0) : null
}

function averageNullable(values: readonly (number | null)[]): number | null {
  const available = values.filter((value): value is number => value !== null)
  return available.length > 0 ? Number((available.reduce((sum, value) => sum + value, 0) / available.length).toFixed(2)) : null
}

function maximumNullable(values: readonly (number | null)[]): number | null {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value))
  return available.length > 0 ? Math.max(...available) : null
}

async function sampleSnapshot(): Promise<AiConsoleLiveObservabilitySnapshot> {
  const sampleStartedAtUtc = new Date().toISOString()
  const sampleStartedAt = process.hrtime.bigint()
  const projectRoot = process.cwd()
  const [cpuSample, memorySample, diskSample, gpuSample, processSample] = await Promise.all([
    captureTimed(() => sampleCpuUtilization()),
    captureTimed(() => {
      const totalMemory = os.totalmem()
      return { totalMemory, memoryUsedBytes: totalMemory - os.freemem() }
    }),
    captureTimed(() => statfs(projectRoot)),
    probeGpu(),
    probeTrainingProcesses(),
  ])
  const cpuUtilization = cpuSample.value
  const { totalMemory, memoryUsedBytes } = memorySample.value
  const disk = diskSample.value
  const gpuProbe = gpuSample.value
  const processProbe = processSample.value
  const diskTotalBytes = disk.blocks * disk.bsize
  const diskFreeBytes = disk.bavail * disk.bsize
  const diskUsedBytes = Math.max(0, diskTotalBytes - diskFreeBytes)
  const gpuMemoryUsedBytes = sumNullable(gpuProbe.adapters.map((adapter) => adapter.memoryUsedBytes))
  const gpuMemoryTotalBytes = sumNullable(gpuProbe.adapters.map((adapter) => adapter.memoryTotalBytes))
  const trainingProcesses = {
    ...processProbe,
    records: processProbe.records.map((record) => ({ ...record, gpuMemoryBytes: gpuProbe.processMemoryByPid.get(record.processId) ?? null })),
  }
  const telemetrySample = await captureTimed(() => readLatestAiConsoleTrainingTelemetry())
  const telemetry = telemetrySample.value
  const reasonCodes = [gpuProbe.reasonCode, processProbe.reasonCode, telemetry.reasonCode].filter((reason): reason is string => Boolean(reason))
  const sampleCompletedAtUtc = new Date().toISOString()
  const sampleDurationMs = elapsedMilliseconds(sampleStartedAt)
  const sampleSequence = ++liveSampleSequence

  return {
    schemaVersion: "ai_console_live_observability_v2",
    observedAtUtc: sampleCompletedAtUtc,
    sampleSequence,
    sampleStartedAtUtc,
    sampleCompletedAtUtc,
    sampleDurationMs,
    timestampPrecision: "milliseconds",
    refreshIntervalMs: targetRefreshIntervalMs,
    channelTimings: {
      cpu: timingOf(cpuSample),
      memory: timingOf(memorySample),
      disk: timingOf(diskSample),
      gpu: timingOf(gpuSample),
      trainingProcesses: timingOf(processSample),
      trainingTelemetry: timingOf(telemetrySample),
    },
    sourceIdentity: "ai_console_local_observability_probe_v1",
    trustStatus: "direct_observation",
    dataStatus: reasonCodes.length === 0 ? "connected" : "partial",
    reasonCodes,
    resources: {
      cpuUtilization,
      logicalCpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model ?? null,
      memoryUsedBytes,
      memoryTotalBytes: totalMemory,
      memoryUtilization: percent(memoryUsedBytes, totalMemory),
      diskUsedBytes,
      diskFreeBytes,
      diskTotalBytes,
      diskUtilization: percent(diskUsedBytes, diskTotalBytes),
      gpuUtilization: averageNullable(gpuProbe.adapters.map((adapter) => adapter.gpuUtilization)),
      gpuMemoryUsedBytes,
      gpuMemoryTotalBytes,
      vramUtilization: gpuMemoryUsedBytes !== null && gpuMemoryTotalBytes !== null ? percent(gpuMemoryUsedBytes, gpuMemoryTotalBytes) : null,
      gpuTemperatureCelsius: maximumNullable(gpuProbe.adapters.map((adapter) => adapter.temperatureCelsius)),
      gpuPowerDrawWatts: sumNullable(gpuProbe.adapters.map((adapter) => adapter.powerDrawWatts)),
      gpuPowerLimitWatts: sumNullable(gpuProbe.adapters.map((adapter) => adapter.powerLimitWatts)),
    },
    gpu: {
      status: gpuProbe.status,
      probeIdentity: gpuProbe.probeIdentity,
      adapters: gpuProbe.adapters,
      reasonCode: gpuProbe.reasonCode,
    },
    trainingProcesses,
    trainingTelemetry: {
      status: telemetry.status,
      reporterIdentity: telemetry.latest?.reporterIdentity ?? null,
      latest: telemetry.latest,
      reasonCode: telemetry.reasonCode,
      sourceRevision: telemetry.sourceRevision,
      evidenceReferences: telemetry.evidenceReferences,
    },
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      architecture: os.arch(),
      release: os.release(),
      systemUptimeSeconds: Math.floor(os.uptime()),
      queryServiceProcessId: process.pid,
      queryServiceUptimeSeconds: Math.floor(process.uptime()),
    },
  }
}

export async function sampleAiConsoleLiveObservability(): Promise<AiConsoleLiveObservabilitySnapshot> {
  if (cachedSnapshot && Date.now() - cachedSnapshotAt < snapshotCacheWindowMs) return cachedSnapshot
  if (snapshotInFlight) return snapshotInFlight
  snapshotInFlight = sampleSnapshot().then((snapshot) => {
    cachedSnapshot = snapshot
    cachedSnapshotAt = Date.now()
    return snapshot
  }).finally(() => {
    snapshotInFlight = null
  })
  return snapshotInFlight
}
