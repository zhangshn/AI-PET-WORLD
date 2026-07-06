import { randomUUID } from "node:crypto"
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
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
export const trainingProcessLedgerDir = path.join(aiPainterRuntimeRoot, "training-process-ledger")
export const trainingProcessLedgerPath = path.join(trainingProcessLedgerDir, "events.jsonl")
export const trainingProcessLedgerLatestPath = path.join(trainingProcessLedgerDir, "latest.json")

export type TrainingProcessEventKind =
  | "run_started"
  | "step_started"
  | "step_completed"
  | "step_failed"
  | "run_completed"
  | "run_failed"
  | "archive_completed"
  | "archive_skipped"
  | "archive_failed"
  | "promotion_completed"
  | "promotion_failed"

export type TrainingProcessEventStatus = "running" | "success" | "failed" | "error" | "blocked" | "info"

export type TrainingProcessEvent = {
  id: string
  timestamp: string
  action: string
  runId: string
  kind: TrainingProcessEventKind
  status: TrainingProcessEventStatus
  title: string
  detail?: string
  script?: string
  currentStep?: string
  error?: string | null
  resourceSessionId?: string
  archiveId?: string
}

export type TrainingProcessLedger = {
  schemaVersion: "ai-painter-training-process-ledger-v1"
  updatedAt: string | null
  events: TrainingProcessEvent[]
  summary: {
    total: number
    running: number
    success: number
    failed: number
    error: number
    blocked: number
    info: number
    lastEvent: TrainingProcessEvent | null
  }
}

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

export async function appendTrainingProcessEvent(input: Omit<TrainingProcessEvent, "id" | "timestamp">) {
  try {
    await mkdir(trainingProcessLedgerDir, { recursive: true })
    const event: TrainingProcessEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...input,
    }
    await appendFile(trainingProcessLedgerPath, JSON.stringify(event) + "\n", "utf8")
    await writeFile(trainingProcessLedgerLatestPath, JSON.stringify(await readTrainingProcessLedger(), null, 2) + "\n", "utf8")
    return event
  } catch {
    return null
  }
}

export async function readTrainingProcessLedger(limit = 80): Promise<TrainingProcessLedger> {
  const events = await readAllTrainingProcessEvents()
  const latestFirst = events.slice(-limit).reverse()
  return {
    schemaVersion: "ai-painter-training-process-ledger-v1",
    updatedAt: events.at(-1)?.timestamp ?? null,
    events: latestFirst,
    summary: buildTrainingProcessSummary(events),
  }
}

async function readAllTrainingProcessEvents() {
  try {
    return (await readFile(trainingProcessLedgerPath, "utf8"))
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TrainingProcessEvent)
  } catch {
    return []
  }
}

function buildTrainingProcessSummary(events: TrainingProcessEvent[]): TrainingProcessLedger["summary"] {
  const initial = {
    total: events.length,
    running: 0,
    success: 0,
    failed: 0,
    error: 0,
    blocked: 0,
    info: 0,
    lastEvent: events.at(-1) ?? null,
  }
  return events.reduce((summary, event) => {
    summary[event.status] += 1
    return summary
  }, initial)
}
