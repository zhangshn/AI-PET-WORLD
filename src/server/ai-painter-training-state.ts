import { randomUUID } from "node:crypto"
import { mkdir, open, readFile, rename, rm } from "node:fs/promises"
import path from "node:path"
import { aiPainterRuntimeRoot } from "@/server/ai-pet-world-storage"
import { indexTrainingProcessEvent, readIndexedTrainingProcessLedger } from "@/server/ai-pet-world-storage-catalog"

export { aiPainterRuntimeRoot } from "@/server/ai-pet-world-storage"

export type TrainingControlState = {
  status: "idle" | "running" | "completed" | "failed" | "corrupted_state" | "recovery_required"
  action: string | null
  currentStep: string | null
  startedAt: string | null
  finishedAt: string | null
  error: string | null
  controllerPid?: number | null
  childPid?: number | null
}

export const trainingControlDir = path.join(aiPainterRuntimeRoot, "training-control")
export const trainingControlStatePath = path.join(trainingControlDir, "state.json")
export const trainingControlLogPath = path.join(trainingControlDir, "console.log")
export const trainingProcessLedgerDir = path.join(aiPainterRuntimeRoot, "training-process-ledger")
export const trainingProcessLedgerPath = path.join(trainingProcessLedgerDir, "events.jsonl")
export const trainingProcessLedgerLatestPath = path.join(trainingProcessLedgerDir, "latest.json")
export const trainingRuntimeStatusDir = path.join(aiPainterRuntimeRoot, "runtime-status")
export const trainingRuntimeHeartbeatPath = path.join(trainingRuntimeStatusDir, "heartbeat.json")
export const trainingProcessLedgerDegradedPath = path.join(trainingProcessLedgerDir, "degraded.json")

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
  integrityStatus?: "complete" | "degraded"
  integrityError?: string | null
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
  statusSource:
    | "runtime_heartbeat"
    | "missing_heartbeat"
    | "stale_runtime_heartbeat"
    | "corrupted_runtime_heartbeat"
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
    const parsed = JSON.parse(await readFile(trainingControlStatePath, "utf8")) as Partial<TrainingControlState>
    return isTrainingControlState(parsed)
      ? parsed
      : corruptedControlState("training_control_state_schema_invalid")
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return idleState
    }
    return corruptedControlState(errorCode(error))
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
  await writeJsonAtomic(trainingControlStatePath, state)
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
  await writeJsonAtomic(trainingRuntimeHeartbeatPath, heartbeat)
  return heartbeat
}

export async function readTrainingRuntimeHeartbeat() {
  return (await readTrainingRuntimeHeartbeatRecord()).value
}

export async function readTrainingRuntimeStatus(): Promise<TrainingRuntimeStatusSnapshot> {
  const heartbeatRecord = await readTrainingRuntimeHeartbeatRecord()
  const heartbeat = heartbeatRecord.value
  if (heartbeatRecord.corrupted) {
    return {
      schemaVersion: "ai-painter-runtime-status-snapshot-v1",
      status: "blocked",
      statusSource: "corrupted_runtime_heartbeat",
      heartbeat: null,
      heartbeatPath: trainingRuntimeHeartbeatPath,
      stale: true,
      ageMs: null,
      staleAfterMs: runtimeHeartbeatStaleAfterMs,
    }
  }
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

async function readTrainingRuntimeHeartbeatRecord(): Promise<{
  value: TrainingRuntimeHeartbeat | null
  corrupted: boolean
}> {
  try {
    const parsed = JSON.parse(await readFile(trainingRuntimeHeartbeatPath, "utf8")) as unknown
    const valid = isTrainingRuntimeHeartbeat(parsed)
    return { value: valid ? parsed : null, corrupted: !valid }
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { value: null, corrupted: false }
    }
    return { value: null, corrupted: true }
  }
}

export async function appendTrainingProcessEvent(input: Omit<TrainingProcessEvent, "id" | "timestamp">) {
  let event: TrainingProcessEvent | null = null
  try {
    await mkdir(trainingProcessLedgerDir, { recursive: true })
    event = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...input,
    }
    const journal = await open(trainingProcessLedgerPath, "a")
    try {
      await journal.write(Buffer.from(`${JSON.stringify(event)}\n`, "utf8"))
      await journal.sync()
    } finally {
      await journal.close().catch(() => {})
    }
    indexTrainingProcessEvent(event as unknown as Record<string, unknown>)
    await writeJsonAtomic(trainingProcessLedgerLatestPath, await readTrainingProcessLedger())
    return event
  } catch (error) {
    await writeJsonAtomic(trainingProcessLedgerDegradedPath, {
      schemaVersion: "ai-painter-training-ledger-degraded-v1",
      status: "degraded",
      eventId: event?.id ?? null,
      error: errorCode(error),
      recordedAtUtc: new Date().toISOString(),
    }).catch(() => {})
    return null
  }
}

export async function readTrainingProcessLedger(limit = 80): Promise<TrainingProcessLedger> {
  const degraded = await readLedgerDegradedMarker()
  const indexed = readIndexedTrainingProcessLedger(limit)
  if (indexed && indexed.summary.total > 0) {
    return {
      ...indexed as TrainingProcessLedger,
      integrityStatus: degraded ? "degraded" : "complete",
      integrityError: degraded?.error ?? null,
    }
  }
  const events = await readAllTrainingProcessEvents()
  const latestFirst = events.slice(-limit).reverse()
  return {
    schemaVersion: "ai-painter-training-process-ledger-v1",
    updatedAt: events.at(-1)?.timestamp ?? null,
    events: latestFirst,
    summary: buildTrainingProcessSummary(events),
    integrityStatus: degraded ? "degraded" : "complete",
    integrityError: degraded?.error ?? null,
  }
}

async function readLedgerDegradedMarker() {
  try {
    return JSON.parse(await readFile(trainingProcessLedgerDegradedPath, "utf8")) as { error?: string }
  } catch {
    return null
  }
}

function isTrainingControlState(value: Partial<TrainingControlState>): value is TrainingControlState {
  return (
    typeof value.status === "string" &&
    ["idle", "running", "completed", "failed", "corrupted_state", "recovery_required"].includes(value.status) &&
    (value.action === null || typeof value.action === "string") &&
    (value.currentStep === null || typeof value.currentStep === "string") &&
    (value.startedAt === null || typeof value.startedAt === "string") &&
    (value.finishedAt === null || typeof value.finishedAt === "string") &&
    (value.error === null || typeof value.error === "string")
  )
}

function isTrainingRuntimeHeartbeat(value: unknown): value is TrainingRuntimeHeartbeat {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const heartbeat = value as Partial<TrainingRuntimeHeartbeat>
  return (
    heartbeat.schemaVersion === "ai-painter-runtime-heartbeat-v1" &&
    typeof heartbeat.heartbeatId === "string" &&
    heartbeat.heartbeatId.length > 0 &&
    typeof heartbeat.timestampUtc === "string" &&
    Number.isFinite(Date.parse(heartbeat.timestampUtc)) &&
    typeof heartbeat.timestampLocal === "string" &&
    heartbeat.timestampLocal.length > 0 &&
    heartbeat.timezone === "Asia/Shanghai" &&
    typeof heartbeat.status === "string" &&
    [
      "idle",
      "dataset_building",
      "training",
      "inferencing",
      "reviewing",
      "diagnosing",
      "backwriting",
      "waiting_owner_review",
      "blocked",
      "completed_round",
    ].includes(heartbeat.status) &&
    (heartbeat.activeTaskId === null || typeof heartbeat.activeTaskId === "string") &&
    (heartbeat.activeAction === null || typeof heartbeat.activeAction === "string") &&
    (heartbeat.activeModelRole === null || typeof heartbeat.activeModelRole === "string") &&
    (heartbeat.activeStep === null || typeof heartbeat.activeStep === "string") &&
    (heartbeat.activeScript === null || typeof heartbeat.activeScript === "string") &&
    Number.isInteger(heartbeat.pid) &&
    Number.isInteger(heartbeat.controllerPid) &&
    (heartbeat.childPid === null || Number.isInteger(heartbeat.childPid)) &&
    (heartbeat.lastOutputRef === null || typeof heartbeat.lastOutputRef === "string") &&
    heartbeat.source === "training_controller"
  )
}

function corruptedControlState(error: string): TrainingControlState {
  return { ...idleState, status: "corrupted_state", error }
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  const handle = await open(temporaryPath, "wx")
  try {
    await handle.write(Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"))
    await handle.sync()
  } finally {
    await handle.close().catch(() => {})
  }
  try {
    await rename(temporaryPath, filePath)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {})
    throw error
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
