import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { readTrainingControlState, readTrainingLogTail } from "@/server/ai-painter-training-controller"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const execFileAsync = promisify(execFile)
const runtimeDir = path.join(process.cwd(), ".runtime", "ai-painter", "bootstrap-training")

export async function GET() {
  const summary = await readJson(path.join(runtimeDir, "training-summary.json"))
  const latest = await readLastJsonLine(path.join(runtimeDir, "training-log.jsonl"))
  const checkpointReady = await exists(path.join(runtimeDir, "best.pt"))
  const inferenceReady = await exists(path.join(process.cwd(), ".runtime", "ai-painter", "bootstrap-inference", "bootstrap-world-001.png"))
  const epoch = numberValue(latest?.epoch ?? summary?.epochs)
  const targetEpochs = 120
  const control = await readTrainingControlState()

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    system: await readGpuInfo(),
    dataset: {
      formalSceneSamples: await countDirectories(path.join(process.cwd(), "data", "ai-painter-datasets", "accepted", "dataset_v0", "scene", "world")),
      bootstrapSamples: await countDirectories(path.join(process.cwd(), ".runtime", "ai-painter", "bootstrap-dataset", "accepted", "dataset_v0", "scene", "world")),
      imageSize: "256 × 192",
      conditionChannels: 8,
    },
    model: { name: "AI-PET-WORLD Tiny U-Net v0", baseChannels: 32, outputChannels: 3, framework: "PyTorch" },
    multiscene: {
      samples: await countDirectories(path.join(process.cwd(), ".runtime", "ai-painter", "multiscene-dataset", "accepted", "dataset_v0", "scene", "world")),
      baseSummary: await readJson(path.join(process.cwd(), ".runtime", "ai-painter", "multiscene-training", "training-summary.json")),
      ganSummary: await readJson(path.join(process.cwd(), ".runtime", "ai-painter", "multiscene-gan-training", "training-summary.json")),
      structuralV2Summary: await readJson(path.join(process.cwd(), ".runtime", "ai-painter", "structural-v2-training", "training-summary.json")),
      structuralV2GanSummary: await readJson(path.join(process.cwd(), ".runtime", "ai-painter", "structural-v2-gan-training", "training-summary.json")),
      inferenceReady: await exists(path.join(process.cwd(), ".runtime", "ai-painter", "multiscene-gan-inference", "scene-world-11-e0e7975b.png")),
      structuralV2InferenceReady: await exists(path.join(process.cwd(), ".runtime", "ai-painter", "structural-v2-inference", "scene-world-11-e0e7975b.png")),
      reviewStatus: "failed_visual_quality",
    },
    control,
    logs: await readTrainingLogTail(),
    training: {
      status: control.status === "running" ? "running" : summary?.status === "completed" ? "completed" : "not_started",
      epoch,
      targetEpochs,
      percent: Math.min(100, Math.round((epoch / targetEpochs) * 100)),
      loss: latest?.trainLoss ?? summary?.bestSelectionLoss ?? null,
      device: latest?.device ?? summary?.device ?? "等待训练",
      checkpointReady,
      inferenceReady,
    },
  })
}

async function readGpuInfo() {
  try {
    const { stdout } = await execFileAsync("nvidia-smi", [
      "--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu,driver_version",
      "--format=csv,noheader,nounits",
    ], { windowsHide: true, timeout: 5000 })
    const [name, memoryTotal, memoryUsed, utilization, temperature, driver] = stdout.trim().split(",").map((value) => value.trim())
    return { gpuAvailable: true, name, memoryTotalMiB: Number(memoryTotal), memoryUsedMiB: Number(memoryUsed), utilizationPercent: Number(utilization), temperatureCelsius: Number(temperature), driver }
  } catch {
    return { gpuAvailable: false, name: "未检测到 NVIDIA GPU", memoryTotalMiB: 0, memoryUsedMiB: 0, utilizationPercent: 0, temperatureCelsius: 0, driver: "--" }
  }
}

async function countDirectories(directory: string) {
  try { return (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).length } catch { return 0 }
}

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try { return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown> } catch { return null }
}

async function readLastJsonLine(file: string): Promise<Record<string, unknown> | null> {
  try {
    const lines = (await readFile(file, "utf8")).trim().split(/\r?\n/)
    return lines.length ? JSON.parse(lines.at(-1)!) as Record<string, unknown> : null
  } catch { return null }
}

async function exists(file: string) {
  try { await stat(file); return true } catch { return false }
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
