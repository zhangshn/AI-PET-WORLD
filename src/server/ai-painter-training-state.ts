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
  controllerPid?: number | null
  childPid?: number | null
}

export const aiPainterRuntimeRoot = path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "ai-painter")
export const trainingControlDir = path.join(aiPainterRuntimeRoot, "training-control")
export const trainingControlStatePath = path.join(trainingControlDir, "state.json")
export const trainingControlLogPath = path.join(trainingControlDir, "console.log")
export const trainingProcessLedgerDir = path.join(aiPainterRuntimeRoot, "training-process-ledger")
export const trainingProcessLedgerPath = path.join(trainingProcessLedgerDir, "events.jsonl")
export const trainingProcessLedgerLatestPath = path.join(trainingProcessLedgerDir, "latest.json")
export const trainingRuntimeStatusDir = path.join(aiPainterRuntimeRoot, "runtime-status")
export const trainingRuntimeHeartbeatPath = path.join(trainingRuntimeStatusDir, "heartbeat.json")

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
  titleZh?: string
  detail?: string
  detailZh?: string
  script?: string
  currentStep?: string
  error?: string | null
  errorZh?: string | null
  autoAnalysisVersion?: string
  resultScope?: string
  resultScopeZh?: string
  successMeaning?: string
  successMeaningZh?: string
  failureMeaning?: string
  failureMeaningZh?: string
  finalGameMapSuccess?: boolean
  finalGameMapMeaning?: string
  finalGameMapMeaningZh?: string
  canEnterWorld?: boolean
  worldEntryMeaning?: string
  worldEntryMeaningZh?: string
  evidenceRequirement?: string
  evidenceRequirementZh?: string
  nextAction?: string
  nextActionZh?: string
  resourceSessionId?: string
  archiveId?: string
  evidencePath?: string
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

export type TrainingRuntimeHeartbeatStatus =
  | "idle"
  | "dataset_building"
  | "training"
  | "inferencing"
  | "reviewing"
  | "diagnosing"
  | "backwriting"
  | "waiting_owner_review"
  | "blocked"
  | "completed_round"

export type TrainingRuntimeHeartbeat = {
  schemaVersion: "ai-painter-runtime-heartbeat-v1"
  heartbeatId: string
  timestampUtc: string
  timestampLocal: string
  timezone: "Asia/Shanghai"
  status: TrainingRuntimeHeartbeatStatus
  activeTaskId: string | null
  activeAction: string | null
  activeModelRole: string | null
  activeStep: string | null
  activeScript: string | null
  pid: number
  controllerPid: number
  childPid: number | null
  lastOutputRef: string | null
  source: "training_controller"
}

export type TrainingRuntimeStatusSnapshot = {
  schemaVersion: "ai-painter-runtime-status-snapshot-v1"
  status: TrainingRuntimeHeartbeatStatus
  statusSource: "runtime_heartbeat" | "missing_heartbeat" | "stale_runtime_heartbeat"
  heartbeat: TrainingRuntimeHeartbeat | null
  heartbeatPath: string
  stale: boolean
  ageMs: number | null
  staleAfterMs: number
}

const runtimeHeartbeatStaleAfterMs = 120_000

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

export async function writeTrainingRuntimeHeartbeat(
  input: Pick<TrainingRuntimeHeartbeat, "status"> &
    Partial<
      Pick<
        TrainingRuntimeHeartbeat,
        | "activeTaskId"
        | "activeAction"
        | "activeModelRole"
        | "activeStep"
        | "activeScript"
        | "lastOutputRef"
        | "childPid"
      >
    >,
) {
  const now = new Date()
  const heartbeat: TrainingRuntimeHeartbeat = {
    schemaVersion: "ai-painter-runtime-heartbeat-v1",
    heartbeatId: randomUUID(),
    timestampUtc: now.toISOString(),
    timestampLocal: formatShanghaiTimestamp(now),
    timezone: "Asia/Shanghai",
    status: input.status,
    activeTaskId: input.activeTaskId ?? null,
    activeAction: input.activeAction ?? null,
    activeModelRole: input.activeModelRole ?? null,
    activeStep: input.activeStep ?? null,
    activeScript: input.activeScript ?? null,
    pid: process.pid,
    controllerPid: process.pid,
    childPid: input.childPid ?? null,
    lastOutputRef: input.lastOutputRef ?? null,
    source: "training_controller",
  }
  await mkdir(trainingRuntimeStatusDir, { recursive: true })
  await writeFile(trainingRuntimeHeartbeatPath, JSON.stringify(heartbeat, null, 2) + "\n", "utf8")
  return heartbeat
}

export async function readTrainingRuntimeHeartbeat() {
  try {
    return JSON.parse(await readFile(trainingRuntimeHeartbeatPath, "utf8")) as TrainingRuntimeHeartbeat
  } catch {
    return null
  }
}

export async function readTrainingRuntimeStatus(): Promise<TrainingRuntimeStatusSnapshot> {
  const heartbeat = await readTrainingRuntimeHeartbeat()
  if (!heartbeat) {
    return {
      schemaVersion: "ai-painter-runtime-status-snapshot-v1",
      status: "idle",
      statusSource: "missing_heartbeat",
      heartbeat: null,
      heartbeatPath: trainingRuntimeHeartbeatPath,
      stale: false,
      ageMs: null,
      staleAfterMs: runtimeHeartbeatStaleAfterMs,
    }
  }
  const ageMs = Math.max(0, Date.now() - Date.parse(heartbeat.timestampUtc))
  const stale = ageMs > runtimeHeartbeatStaleAfterMs
  return {
    schemaVersion: "ai-painter-runtime-status-snapshot-v1",
    status: heartbeat.status,
    statusSource: stale ? "stale_runtime_heartbeat" : "runtime_heartbeat",
    heartbeat,
    heartbeatPath: trainingRuntimeHeartbeatPath,
    stale,
    ageMs,
    staleAfterMs: runtimeHeartbeatStaleAfterMs,
  }
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

function formatShanghaiTimestamp(date: Date) {
  const local = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
  return `${local.replace(" ", "T")}+08:00`
}
