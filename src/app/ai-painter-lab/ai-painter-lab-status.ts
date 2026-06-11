import { readdir } from "node:fs/promises"
import path from "node:path"

export type AiPainterDatasetStatus = {
  accepted: number
  rejected: number
  engineeringTarget: number
  trainingMinimum: number
  acceptedSampleIds: string[]
}

export async function readAiPainterDatasetStatus(): Promise<AiPainterDatasetStatus> {
  const root = path.join(process.cwd(), "data", "ai-painter-datasets")
  const acceptedFiles = await readJsonFiles(
    path.join(root, "accepted", "dataset_v0", "metadata")
  )
  const rejectedFiles = await readJsonFiles(path.join(root, "rejected"))

  return {
    accepted: acceptedFiles.length,
    rejected: rejectedFiles.length,
    engineeringTarget: 20,
    trainingMinimum: 100,
    acceptedSampleIds: acceptedFiles.map((file) => file.replace(/\.json$/u, "")),
  }
}

async function readJsonFiles(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory))
      .filter((file) => file.endsWith(".json"))
      .sort()
  } catch {
    return []
  }
}
