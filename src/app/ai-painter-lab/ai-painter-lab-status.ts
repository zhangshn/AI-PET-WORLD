import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

export type AiPainterDatasetStatus = {
  sourceMaterials: number
  engineeringAssets: number
  candidateAssets: number
  trainableAssets: number
  rejected: number
  engineeringTarget: number
  trainingMinimum: number
  vjB2Acceptable: number
  vjB2Unacceptable: number
  vjB2MinimumPerLabel: number
}

export async function readAiPainterDatasetStatus(): Promise<AiPainterDatasetStatus> {
  const root = path.join(process.cwd(), "data", "ai-painter-datasets")
  const sourceMaterials = await readPngFiles(path.join(root, "source-originals"))
  const engineeringAssets = await readJsonFiles(path.join(process.cwd(), "data", "ai-painter-assets", "engineering"), true)
  const candidateAssets = await readJsonFiles(path.join(process.cwd(), "data", "ai-painter-assets", "candidates"), true)
  const trainableAssets = await readJsonFiles(path.join(process.cwd(), "data", "ai-painter-assets", "accepted"), true)
  const rejectedFiles = await readJsonFiles(path.join(root, "rejected"))
  const qualityCounts = await readQualityLabels(path.join(process.cwd(), "data", "ai-painter-quality", "vj-b2", "samples"))

  return {
    sourceMaterials: sourceMaterials.length,
    engineeringAssets: engineeringAssets.length,
    candidateAssets: candidateAssets.length,
    trainableAssets: trainableAssets.length,
    rejected: rejectedFiles.length,
    engineeringTarget: 20,
    trainingMinimum: 100,
    vjB2Acceptable: qualityCounts.acceptable,
    vjB2Unacceptable: qualityCounts.unacceptable,
    vjB2MinimumPerLabel: 40,
  }
}

async function readQualityLabels(directory: string): Promise<{ acceptable: number; unacceptable: number }> {
  const counts = { acceptable: 0, unacceptable: 0 }
  try {
    const files = (await readdir(directory, { recursive: true })).filter((file) => file.endsWith("label.json"))
    for (const file of files) {
      try {
        const value = JSON.parse(await readFile(path.join(directory, file), "utf8")) as { qualityLabel?: string }
        if (value.qualityLabel === "acceptable" || value.qualityLabel === "unacceptable") counts[value.qualityLabel] += 1
      } catch {
        // Invalid labels are excluded and reported by the Python readiness audit.
      }
    }
  } catch {
    return counts
  }
  return counts
}

async function readPngFiles(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory)).filter((file) => file.endsWith(".png")).sort()
  } catch {
    return []
  }
}

async function readJsonFiles(directory: string, recursive = false): Promise<string[]> {
  try {
    return (await readdir(directory, { recursive }))
      .filter((file) => file.endsWith(recursive ? "metadata.json" : ".json"))
      .sort()
  } catch {
    return []
  }
}
