import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export type TrainingControlState = {
  status: "idle" | "running" | "completed" | "failed"
  action: string | null
  currentStep: string | null
  startedAt: string | null
  finishedAt: string | null
  error: string | null
}

export const aiPainterRuntimeRoot = path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "ai-painter")
export const trainingControlDir = path.join(aiPainterRuntimeRoot, "training-control")
export const trainingControlStatePath = path.join(trainingControlDir, "state.json")
export const trainingControlLogPath = path.join(trainingControlDir, "console.log")

const idleState: TrainingControlState = {
  status: "idle",
  action: null,
  currentStep: null,
  startedAt: null,
  finishedAt: null,
  error: null,
}

export async function readTrainingControlState() {
  try {
    return JSON.parse(await readFile(trainingControlStatePath, "utf8")) as TrainingControlState
  } catch {
    return idleState
  }
}

export async function readTrainingLogTail(maxLines = 80) {
  try {
    return (await readFile(trainingControlLogPath, "utf8")).trim().split(/\r?\n/).slice(-maxLines)
  } catch {
    return []
  }
}

export async function writeTrainingControlState(state: TrainingControlState) {
  await mkdir(trainingControlDir, { recursive: true })
  await writeFile(trainingControlStatePath, JSON.stringify(state, null, 2) + "\n", "utf8")
}
