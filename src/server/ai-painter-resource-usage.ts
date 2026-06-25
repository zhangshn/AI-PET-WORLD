import { execFile } from "node:child_process"
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const runtimeRoot = path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "ai-painter")
const usageDir = path.join(runtimeRoot, "training-resource-usage")
const currentSessionPath = path.join(usageDir, "current-session.json")
const latestSessionPath = path.join(usageDir, "latest-session.json")
const historyPath = path.join(usageDir, "session-history.jsonl")

export type ResourceUsageSample = {
  sampledAt: string
  gpuAvailable: boolean
  gpuName: string
  driver: string
  memoryTotalMiB: number
  memoryUsedMiB: number
  utilizationPercent: number
  temperatureCelsius: number
  powerDrawWatts: number | null
  powerLimitWatts: number | null
  powerSource: "nvidia-smi" | "estimated" | "unavailable"
}

export type ResourceUsageSessionSummary = {
  sessionId: string
  action: string
  status: "running" | "completed" | "failed"
  startedAt: string
  finishedAt: string | null
  durationSeconds: number
  telemetrySampleCount: number
  sampleCount: number
  gpuName: string
  driver: string
  averageGpuUtilizationPercent: number
  maxGpuUtilizationPercent: number
  maxMemoryUsedMiB: number
  maxTemperatureCelsius: number
  averagePowerWatts: number
  maxPowerWatts: number
  electricity: {
    estimatedKwh: number
    estimatedCny: number
    cnyPerKwh: number
    formula: string
  }
  tokenLedger: {
    externalApiTokens: number
    externalApiCostCny: number
    localComputeTokens: number
    localComputeTokenRule: string
  }
  error: string | null
}

export type ResourceUsageSession = {
  sessionId: string
  finish: (result: { status: "completed" | "failed"; error: string | null }) => Promise<ResourceUsageSessionSummary>
}

export async function startResourceUsageSession(action: string): Promise<ResourceUsageSession> {
  await mkdir(usageDir, { recursive: true })

  const startedAt = new Date().toISOString()
  const sessionId = `${startedAt.replace(/[:.]/g, "-")}-${action}`
  const samplePath = path.join(usageDir, `${sessionId}.samples.jsonl`)
  const samples: ResourceUsageSample[] = []
  const sampleMs = readPositiveNumber(process.env.AI_PAINTER_RESOURCE_SAMPLE_MS, 2000)
  let finished = false

  const writeCurrent = async () => {
    const summary = buildSummary({ sessionId, action, startedAt, finishedAt: null, status: "running", samples, error: null })
    await writeFile(currentSessionPath, JSON.stringify(summary, null, 2) + "\n", "utf8")
  }

  const collect = async () => {
    if (finished) return
    const sample = await readGpuSample()
    samples.push(sample)
    await appendFile(samplePath, JSON.stringify(sample) + "\n", "utf8")
    await writeCurrent()
  }

  await collect()
  const timer = setInterval(() => {
    void collect()
  }, sampleMs)

  return {
    sessionId,
    async finish(result) {
      if (finished) {
        return readLatestSession()
      }
      finished = true
      clearInterval(timer)

      const finalSample = await readGpuSample()
      samples.push(finalSample)
      await appendFile(samplePath, JSON.stringify(finalSample) + "\n", "utf8")

      const summary = buildSummary({
        sessionId,
        action,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: result.status,
        samples,
        error: result.error,
      })
      await writeFile(latestSessionPath, JSON.stringify(summary, null, 2) + "\n", "utf8")
      await appendFile(historyPath, JSON.stringify(summary) + "\n", "utf8")
      await rm(currentSessionPath, { force: true })
      return summary
    },
  }
}

export async function readResourceUsageLedger() {
  return {
    current: await readJson<ResourceUsageSessionSummary>(currentSessionPath),
    latest: await readJson<ResourceUsageSessionSummary>(latestSessionPath),
    history: await readHistory(),
  }
}

async function readLatestSession() {
  return (
    (await readJson<ResourceUsageSessionSummary>(latestSessionPath)) ??
    buildSummary({
      sessionId: "unknown",
      action: "unknown",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: "failed",
      samples: [],
      error: "Resource usage session already finished, but latest summary was not found.",
    })
  )
}

async function readGpuSample(): Promise<ResourceUsageSample> {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [
        "--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw,power.limit,driver_version",
        "--format=csv,noheader,nounits",
      ],
      { windowsHide: true, timeout: 5000 },
    )
    const [name, memoryTotal, memoryUsed, utilization, temperature, powerDraw, powerLimit, driver] = stdout
      .trim()
      .split(",")
      .map((value) => value.trim())

    const parsedPower = finiteNumber(powerDraw)
    const estimatedPower = readPositiveNumber(process.env.AI_PAINTER_GPU_ESTIMATED_WATTS, 100)
    return {
      sampledAt: new Date().toISOString(),
      gpuAvailable: true,
      gpuName: name || "NVIDIA GPU",
      driver: driver || "--",
      memoryTotalMiB: finiteNumber(memoryTotal) ?? 0,
      memoryUsedMiB: finiteNumber(memoryUsed) ?? 0,
      utilizationPercent: finiteNumber(utilization) ?? 0,
      temperatureCelsius: finiteNumber(temperature) ?? 0,
      powerDrawWatts: parsedPower ?? estimatedPower,
      powerLimitWatts: finiteNumber(powerLimit),
      powerSource: parsedPower === null ? "estimated" : "nvidia-smi",
    }
  } catch {
    return {
      sampledAt: new Date().toISOString(),
      gpuAvailable: false,
      gpuName: "NVIDIA GPU not detected",
      driver: "--",
      memoryTotalMiB: 0,
      memoryUsedMiB: 0,
      utilizationPercent: 0,
      temperatureCelsius: 0,
      powerDrawWatts: readPositiveNumber(process.env.AI_PAINTER_GPU_ESTIMATED_WATTS, 100),
      powerLimitWatts: null,
      powerSource: "estimated",
    }
  }
}

function buildSummary(input: {
  sessionId: string
  action: string
  startedAt: string
  finishedAt: string | null
  status: "running" | "completed" | "failed"
  samples: ResourceUsageSample[]
  error: string | null
}): ResourceUsageSessionSummary {
  const startedMs = Date.parse(input.startedAt)
  const finishedMs = input.finishedAt ? Date.parse(input.finishedAt) : Date.now()
  const durationSeconds = Math.max(0, Math.round((finishedMs - startedMs) / 1000))
  const powerValues = input.samples.map((sample) => sample.powerDrawWatts).filter(isNumber)
  const utilizationValues = input.samples.map((sample) => sample.utilizationPercent).filter(isNumber)
  const averagePowerWatts = average(powerValues)
  const averageGpuUtilizationPercent = average(utilizationValues)
  const cnyPerKwh = readPositiveNumber(process.env.AI_PAINTER_ELECTRICITY_CNY_PER_KWH, 0.6)
  const estimatedKwh = (averagePowerWatts * durationSeconds) / 3600000
  const estimatedCny = estimatedKwh * cnyPerKwh
  const gpuActiveSeconds = durationSeconds * (averageGpuUtilizationPercent / 100)

  return {
    sessionId: input.sessionId,
    action: input.action,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationSeconds,
    telemetrySampleCount: input.samples.length,
    sampleCount: input.samples.length,
    gpuName: input.samples.at(-1)?.gpuName ?? "NVIDIA GPU not detected",
    driver: input.samples.at(-1)?.driver ?? "--",
    averageGpuUtilizationPercent: round2(averageGpuUtilizationPercent),
    maxGpuUtilizationPercent: round2(max(input.samples.map((sample) => sample.utilizationPercent))),
    maxMemoryUsedMiB: round2(max(input.samples.map((sample) => sample.memoryUsedMiB))),
    maxTemperatureCelsius: round2(max(input.samples.map((sample) => sample.temperatureCelsius))),
    averagePowerWatts: round2(averagePowerWatts),
    maxPowerWatts: round2(max(powerValues)),
    electricity: {
      estimatedKwh: round6(estimatedKwh),
      estimatedCny: round4(estimatedCny),
      cnyPerKwh,
      formula: "kWh = averagePowerWatts * durationSeconds / 3600000; cost = kWh * cnyPerKwh.",
    },
    tokenLedger: {
      externalApiTokens: 0,
      externalApiCostCny: 0,
      localComputeTokens: Math.round(gpuActiveSeconds * 1000),
      localComputeTokenRule: "localComputeTokens = gpuActiveSeconds * 1000; local training comparison only, not third-party API tokens.",
    },
    error: input.error,
  }
}

async function readHistory() {
  try {
    const lines = (await readFile(historyPath, "utf8")).trim().split(/\r?\n/).filter(Boolean)
    return lines.slice(-20).map((line) => JSON.parse(line) as ResourceUsageSessionSummary)
  } catch {
    return []
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T
  } catch {
    return null
  }
}

function finiteNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function max(values: number[]) {
  return values.length ? Math.max(...values) : 0
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

function round6(value: number) {
  return Math.round(value * 1000000) / 1000000
}

function readPositiveNumber(raw: string | undefined, fallback: number) {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}
