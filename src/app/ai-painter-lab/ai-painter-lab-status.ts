import { readdir } from "node:fs/promises"
import path from "node:path"

export type AiPainterDatasetStatus = {
  accepted: number
  totalAccepted: number
  rejected: number
  engineeringTarget: number
  trainingMinimum: number
  acceptedSampleIds: string[]
  byLayer: Record<string, number>
}

export async function readAiPainterDatasetStatus(): Promise<AiPainterDatasetStatus> {
  const root = path.join(process.cwd(), "data", "ai-painter-datasets")
  const acceptedRoot = path.join(root, "accepted", "dataset_v0")
  const acceptedFiles = await readJsonFiles(acceptedRoot, true)
  const rejectedFiles = await readJsonFiles(path.join(root, "rejected"))
  const byLayer = countByLayer(acceptedFiles)

  return {
    accepted: byLayer.scene ?? 0,
    totalAccepted: acceptedFiles.length,
    rejected: rejectedFiles.length,
    engineeringTarget: 20,
    trainingMinimum: 100,
    acceptedSampleIds: acceptedFiles.map((file) => path.basename(path.dirname(file))),
    byLayer,
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

function countByLayer(files: string[]) {
  return files.reduce<Record<string, number>>((counts, file) => {
    const layer = file.split(/[\\/]/u)[0]
    counts[layer] = (counts[layer] ?? 0) + 1
    return counts
  }, {})
}
