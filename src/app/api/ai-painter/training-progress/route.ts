import { execFile } from "node:child_process"
import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"
import { readResourceUsageLedger } from "@/server/ai-painter-resource-usage"
import { buildTrainingQualityGateReport } from "@/server/ai-painter-training-quality-gate"
import { readTrainingControlState, readTrainingLogTail } from "@/server/ai-painter-training-state"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const execFileAsync = promisify(execFile)
const aiPainterRuntimeRoot = path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "ai-painter")
const bootstrapTrainingDir = path.join(aiPainterRuntimeRoot, "bootstrap-training")

export async function GET() {
  const summary = await readJson(path.join(bootstrapTrainingDir, "training-summary.json"))
  const latest = await readLastJsonLine(path.join(bootstrapTrainingDir, "training-log.jsonl"))
  const checkpointReady = await exists(path.join(bootstrapTrainingDir, "best.pt"))
  const inferenceReady = await exists(path.join(aiPainterRuntimeRoot, "bootstrap-inference", "bootstrap-world-001.png"))
  const epoch = numberValue(latest?.epoch ?? summary?.epochs)
  const control = await readTrainingControlState()
  const naturalHomeMultisourceLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v20-multisource-generalization", "latest.json"),
  )
  const naturalHomeWarningFocusLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v22-warning-focus", "latest.json"),
  )
  const naturalHomeCandidateConsolidationLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v23-candidate-consolidation", "latest.json"),
  )
  const naturalHomeDiversityGenerationLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v24-diversity-generation", "latest.json"),
  )
  const naturalHomeDiversityGeneralizationLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v25-diversity-generation", "latest.json"),
  )
  const naturalHomeDiversityRefinerLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v26-diversity-refiner-generation", "latest.json"),
  )
  const naturalHomeV27AugmentedDatasetManifest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v27-augmented-diversity-dataset", "dataset-manifest.json"),
  )
  const naturalHomeV27StructureSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v27-structure-guided-training", "training-summary.json"),
  )
  const naturalHomeV27RefinerSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v27-refiner-training", "training-summary.json"),
  )
  const naturalHomeV27DiversityRefinerLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v27-diversity-refiner-generation", "latest.json"),
  )
  const naturalHomeV28RealMaskRemixDatasetManifest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v28-real-mask-remix-dataset", "dataset-manifest.json"),
  )
  const naturalHomeV28StructureSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v28-structure-guided-training", "training-summary.json"),
  )
  const naturalHomeV28RefinerSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v28-refiner-training", "training-summary.json"),
  )
  const naturalHomeV28DiversityRefinerLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v28-diversity-refiner-generation", "latest.json"),
  )
  const trainingQualityGateSource = naturalHomeCandidateConsolidationLatest ?? naturalHomeWarningFocusLatest ?? naturalHomeMultisourceLatest
  const trainingQualityGate = trainingQualityGateSource
    ? buildTrainingQualityGateReport(trainingQualityGateSource)
    : null

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    system: await readGpuInfo(),
    dataset: {
      formalSceneSamples: await countDirectories(path.join(process.cwd(), "data", "ai-painter-datasets", "accepted", "dataset_v0", "scene", "world")),
      bootstrapSamples: await countDirectories(path.join(aiPainterRuntimeRoot, "bootstrap-dataset", "accepted", "dataset_v0", "scene", "world")),
      imageSize: "256 x 192",
      conditionChannels: 14,
    },
    model: { name: "AI-PET-WORLD Local Painter", framework: "PyTorch", ownership: "project-owned local model" },
    multiscene: {
      samples: await countDirectories(path.join(aiPainterRuntimeRoot, "multiscene-dataset", "accepted", "dataset_v0", "scene", "world")),
      baseSummary: await readJson(path.join(aiPainterRuntimeRoot, "multiscene-training", "training-summary.json")),
      ganSummary: await readJson(path.join(aiPainterRuntimeRoot, "multiscene-gan-training", "training-summary.json")),
      structuralV2Summary: await readJson(path.join(aiPainterRuntimeRoot, "structural-v2-training", "training-summary.json")),
      structuralV2GanSummary: await readJson(path.join(aiPainterRuntimeRoot, "structural-v2-gan-training", "training-summary.json")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "multiscene-gan-inference", "scene-world-11-e0e7975b.png")),
      structuralV2InferenceReady: await exists(path.join(aiPainterRuntimeRoot, "structural-v2-inference", "scene-world-11-e0e7975b.png")),
      reviewStatus: "failed_visual_quality",
    },
    structureGuided: {
      summary: await readJson(path.join(aiPainterRuntimeRoot, "structure-guided-training", "training-summary.json")),
      latest: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "structure-guided-training", "training-log.jsonl")),
      checkpointReady: await exists(path.join(aiPainterRuntimeRoot, "structure-guided-training", "best.pt")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "structure-guided-inference", "generated.png")),
      structurePreviewReady: await exists(path.join(aiPainterRuntimeRoot, "structure-guided-inference", "structure-preview.png")),
    },
    rgbRefiner: {
      summary: await readJson(path.join(aiPainterRuntimeRoot, "rgb-refiner-training", "training-summary.json")),
      latest: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "rgb-refiner-training", "training-log.jsonl")),
      checkpointReady: await exists(path.join(aiPainterRuntimeRoot, "rgb-refiner-training", "best.pt")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "rgb-refiner-inference", "generated.png")),
    },
    localAssets: {
      dataset: await readJson(path.join(aiPainterRuntimeRoot, "local-asset-dataset", "manifest.json")),
      summary: await readJson(path.join(aiPainterRuntimeRoot, "local-asset-training", "training-summary.json")),
      inference: await readJson(path.join(aiPainterRuntimeRoot, "local-asset-inference", "latest.json")),
      compositeReady: await exists(path.join(aiPainterRuntimeRoot, "local-asset-inference", "composite.png")),
      reviewStatus: "failed_visual_quality",
    },
    discreteAssets: {
      summary: await readJson(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "training-summary.json")),
      inference: await readJson(path.join(aiPainterRuntimeRoot, "discrete-asset-inference", "latest.json")),
      latestByCategory: {
        building: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "building", "training-log.jsonl")),
        tree: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "tree", "training-log.jsonl")),
        road: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "road", "training-log.jsonl")),
        shoreline: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "shoreline", "training-log.jsonl")),
      },
      compositeReady: await exists(path.join(aiPainterRuntimeRoot, "discrete-asset-inference", "composite.png")),
      reviewStatus: "failed_visual_quality",
    },
    componentReadiness: await readJson(path.join(aiPainterRuntimeRoot, "component-instance-dataset", "report.json")),
    trainingExpansion: {
      manifest: await readJson(path.join(aiPainterRuntimeRoot, "multiscene-dataset", "dataset-manifest.json")),
    },
    autonomousTraining: {
      structureSummary: await readJson(path.join(aiPainterRuntimeRoot, "structure-guided-training", "training-summary.json")),
      rgbSummary: await readJson(path.join(aiPainterRuntimeRoot, "rgb-refiner-training", "training-summary.json")),
      localSummary: await readJson(path.join(aiPainterRuntimeRoot, "local-asset-training", "training-summary.json")),
      discreteSummary: await readJson(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "training-summary.json")),
      latestStructure: await readJson(path.join(aiPainterRuntimeRoot, "structure-guided-inference", "latest.json")),
      latestRgb: await exists(path.join(aiPainterRuntimeRoot, "rgb-refiner-inference", "generated.png")),
      latestLocal: await readJson(path.join(aiPainterRuntimeRoot, "local-asset-inference", "latest.json")),
      latestDiscrete: await readJson(path.join(aiPainterRuntimeRoot, "discrete-asset-inference", "latest.json")),
      reviewStatus: "failed_visual_quality",
    },
    mvpGap: await readJson(path.join(aiPainterRuntimeRoot, "mvp-gap-report", "report.json")),
    naturalHomeReadiness: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-readiness", "report.json")),
    naturalHomeQuality: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-quality", "report.json")),
    naturalHomeTraining: {
      datasetManifest: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-dataset", "dataset-manifest.json")),
      cleanDatasetManifest: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-clean-dataset", "dataset-manifest.json")),
      summary: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-training", "training-summary.json")),
      latest: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "natural-home-training", "training-log.jsonl")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-inference", "natural-home-crop-v7-12-forest-stream-clean.png")),
    },
    naturalHomeStructure: {
      summary: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-structure-guided-training", "training-summary.json")),
      latest: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "natural-home-structure-guided-training", "training-log.jsonl")),
      checkpointReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-structure-guided-training", "best.pt")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-structure-guided-inference", "generated.png")),
      structurePreviewReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-structure-guided-inference", "structure-preview.png")),
    },
    naturalHomeRefiner: {
      summary: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-rgb-refiner-training", "training-summary.json")),
      latest: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "natural-home-rgb-refiner-training", "training-log.jsonl")),
      checkpointReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-rgb-refiner-training", "best.pt")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-rgb-refiner-inference", "generated.png")),
      diagnosis: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-rgb-refiner-diagnosis", "report.json")),
      nextTrainingPlan: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-next-training-plan", "plan.json")),
    },
    naturalHomeSourceExpertBank: {
      latest: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v18-source-expert-bank", "latest.json")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v18-source-expert-bank", "contact-sheet.png")),
    },
    naturalHomePromotedSource: {
      latest: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v19-promoted-source", "latest.json")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v19-promoted-source", "contact-sheet.png")),
    },
    naturalHomeMultisourceGeneralization: {
      latest: naturalHomeMultisourceLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v20-multisource-generalization", "contact-sheet.png")),
    },
    naturalHomeWarningFocus: {
      latest: naturalHomeWarningFocusLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v22-warning-focus", "contact-sheet.png")),
    },
    naturalHomeCandidateConsolidation: {
      latest: naturalHomeCandidateConsolidationLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v23-candidate-consolidation", "contact-sheet.png")),
    },
    naturalHomeDiversityGeneration: {
      latest: naturalHomeDiversityGenerationLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v24-diversity-generation", "contact-sheet.png")),
    },
    naturalHomeDiversityGeneralization: {
      latest: naturalHomeDiversityGeneralizationLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v25-diversity-generation", "contact-sheet.png")),
    },
    naturalHomeDiversityRefiner: {
      latest: naturalHomeDiversityRefinerLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v26-diversity-refiner-generation", "contact-sheet.png")),
    },
    naturalHomeV27AugmentedDiversity: {
      datasetManifest: naturalHomeV27AugmentedDatasetManifest,
      structureSummary: naturalHomeV27StructureSummary,
      refinerSummary: naturalHomeV27RefinerSummary,
      latest: naturalHomeV27DiversityRefinerLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v27-diversity-refiner-generation", "contact-sheet.png")),
    },
    naturalHomeV28RealMaskRemix: {
      datasetManifest: naturalHomeV28RealMaskRemixDatasetManifest,
      structureSummary: naturalHomeV28StructureSummary,
      refinerSummary: naturalHomeV28RefinerSummary,
      latest: naturalHomeV28DiversityRefinerLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v28-diversity-refiner-generation", "contact-sheet.png")),
    },
    trainingQualityGate,
    control,
    resourceUsage: await readResourceUsageLedger(),
    logs: await readTrainingLogTail(),
    training: {
      status: control.status === "running" ? "running" : summary?.status === "completed" ? "completed" : "not_started",
      epoch,
      targetEpochs: 120,
      percent: Math.min(100, Math.round((epoch / 120) * 100)),
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
  try {
    return (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).length
  } catch {
    return 0
  }
}

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

async function readLastJsonLine(file: string): Promise<Record<string, unknown> | null> {
  try {
    const lines = (await readFile(file, "utf8")).trim().split(/\r?\n/)
    return lines.length ? JSON.parse(lines.at(-1)!) as Record<string, unknown> : null
  } catch {
    return null
  }
}

async function exists(file: string) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
